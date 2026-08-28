import '@supabase/functions-js/edge-runtime.d.ts'

import { construirPeticion, interpretarSalida } from './acciones.ts'
import {
  AgenteAccionRequestSchema as RequestSchema,
  verificarAmbito,
} from './contract.ts'

import { preflightResponse } from '../_shared/cors.ts'
import { registrarInteraccionIA } from '../_shared/interacciones-ia.ts'
import { buscarBibliotecaInstitucional } from '../_shared/biblioteca-institucional.ts'
import { OpenAIService } from '../_shared/openai-service.ts'
import {
  buildReasoningParam,
  buildSafetyIdentifier,
} from '../_shared/openai-response-controls.ts'
import { resolveStructuredResponseOutput } from '../_shared/openai-response.ts'
import {
  readJsonBody,
  requireJsonContentType,
  requireMethod,
} from '../_shared/request.ts'
import { createAuthenticatedContext } from '../_shared/supabase.ts'
import { edgeErrorResponse, HttpError, sendSuccess } from '../_shared/utils.ts'
import { validateInput } from '../_shared/validation.ts'

import type { AgenteAccionRequest, AgenteAccionTipo } from './contract.ts'
import type { Database } from '../_shared/database.types.ts'
import type { ReasoningEffort } from '../_shared/openai-response-controls.ts'
import type { StructuredResponseOptions } from '../_shared/openai-service.ts'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Una sola función para las acciones del modo agente. Todas comparten el
 * mismo sobre —autenticación, permiso de IA sobre el ámbito, envoltura de
 * rechazo y registro de la interacción— y sólo varía la carga útil, así que
 * partirla en doce funciones habría multiplicado el mismo preámbulo.
 */

const RANGO_ESFUERZO = { none: 0, low: 1, medium: 2, high: 3 } as const

/**
 * El cliente pide `none` por latencia: el modo agente vive de sentirse
 * instantáneo. Pero hay acciones cuya respuesta sin razonamiento es basura
 * —reorganizar un mapa entero, encontrar una obra real— y ahí la latencia es el
 * precio correcto. Este suelo es política del servidor, no del componente.
 */
const ESFUERZO_MINIMO: Partial<
  Record<AgenteAccionTipo, keyof typeof RANGO_ESFUERZO>
> = {
  asignar_asignatura: 'low',
  proponer_para_celda: 'low',
  ordenar_lineas: 'low',
  reubicar_unidad: 'low',
  proponer_contenido: 'medium',
  reorganizar_mapa: 'medium',
  proponer_evaluacion: 'low',
  proponer_bibliografia: 'medium',
  proponer_prerrequisito: 'low',
}

function resolverEsfuerzo(
  accion: AgenteAccionTipo,
  pedido: ReasoningEffort,
): ReasoningEffort {
  const minimo = ESFUERZO_MINIMO[accion]
  if (!minimo) return pedido
  if (pedido === 'auto') return minimo
  return RANGO_ESFUERZO[pedido] >= RANGO_ESFUERZO[minimo] ? pedido : minimo
}

const TIPO_INTERACCION: Record<
  AgenteAccionTipo,
  Database['public']['Enums']['tipo_interaccion_ia']
> = {
  mejorar_campo: 'MEJORAR_SECCION',
  nombrar_unidad: 'MEJORAR_SECCION',
  nombrar_tema: 'MEJORAR_SECCION',
  proponer_evaluacion: 'GENERAR',
  proponer_bibliografia: 'GENERAR',
  proponer_contenido: 'GENERAR',
  // Crea una línea curricular que no existía: es generación, no reacomodo.
  proponer_linea: 'GENERAR',
  asignar_asignatura: 'OTRA',
  ajustar_creditos_horas: 'OTRA',
  reorganizar_mapa: 'OTRA',
  proponer_para_celda: 'OTRA',
  ordenar_lineas: 'OTRA',
  reubicar_unidad: 'OTRA',
  proponer_prerrequisito: 'OTRA',
}

/** Acciones que necesitan el temario autoritativo, no el que tenga la pantalla. */
const NECESITAN_TEMARIO = new Set<AgenteAccionTipo>([
  'proponer_evaluacion',
  'proponer_bibliografia',
])

function esRegistro(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor)
}

/**
 * Renderiza `asignaturas.contenido_tematico` como un esquema legible. Tolera las
 * dos formas que conviven en la base —`unidad`/`horasEstimadas` de la generación
 * por IA y `numero`/`horas_estimadas` del editor— porque el temario es un JSON
 * libre y un plan antiguo puede traer cualquiera de las dos.
 */
function describirTemarioGuardado(contenido: unknown): string | null {
  if (!Array.isArray(contenido) || !contenido.length) return null

  const lineas: Array<string> = []
  contenido.forEach((unidadBruta, indice) => {
    if (!esRegistro(unidadBruta)) return
    const numero = Number(
      unidadBruta.unidad ?? unidadBruta.numero ?? indice + 1,
    )
    const titulo = String(unidadBruta.titulo ?? '').trim() || '(sin título)'
    lineas.push(
      `  Unidad ${Number.isFinite(numero) ? numero : indice + 1}: ${titulo}`,
    )

    const temas = unidadBruta.temas
    if (!Array.isArray(temas)) return
    for (const temaBruto of temas) {
      if (!esRegistro(temaBruto)) continue
      const nombre = String(temaBruto.nombre ?? '').trim()
      if (!nombre) continue
      const horas = Number(
        temaBruto.horasEstimadas ?? temaBruto.horas_estimadas,
      )
      lineas.push(
        `      - ${nombre}${Number.isFinite(horas) ? ` (${horas} h)` : ''}`,
      )
    }
  })

  return lineas.length ? lineas.join('\n') : null
}

async function leerTemario(
  supabase: SupabaseClient<Database>,
  asignaturaId: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from('asignaturas')
    .select('contenido_tematico')
    .eq('id', asignaturaId)
    .maybeSingle()

  if (error) {
    // El temario enriquece el prompt pero no lo condiciona: si no se puede leer,
    // vale más una propuesta sin él que un fallo que el usuario no entiende.
    console.warn('[ai-agente-accion] no se pudo leer el temario', error.message)
    return null
  }

  return describirTemarioGuardado(data?.contenido_tematico ?? null)
}

function idsDelAmbito(req: AgenteAccionRequest) {
  return req.ambito.tipo === 'plan'
    ? { planId: req.ambito.planId, asignaturaId: null }
    : { planId: req.ambito.planId, asignaturaId: req.ambito.asignaturaId }
}

function contextoBibliotecaInstitucional(
  referencias: Awaited<ReturnType<typeof buscarBibliotecaInstitucional>>,
) {
  if (!referencias.length) return ''
  return `\n\nRESULTADOS VERIFICADOS DEL CATÁLOGO DE BIBLIOTECA LA SALLE (FUENTE PREFERENTE):\n${referencias
    .map(
      (referencia) =>
        `- [ID La Salle: ${referencia.id}] ${referencia.titulo}${referencia.autor ? ` — ${referencia.autor}` : ''}${referencia.editorial ? ` (${referencia.editorial}` : ''}${referencia.anio ? `, ${referencia.anio}` : referencia.editorial ? ')' : ''}${referencia.isbn ? `; ISBN ${referencia.isbn}` : ''}`,
    )
    .join(
      '\n',
    )}\nDa preferencia a estas obras cuando sean pertinentes. Si ninguna responde a la solicitud, continúa con la búsqueda bibliográfica habitual y sólo propone obras reales y verificables; no inventes referencias.`
}

function normalizarDatoBibliografico(valor: string) {
  return valor
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase('es-MX')
    .replace(/[^a-z0-9]+/g, '')
}

function coincideConReferenciaBiblioteca(
  resultado: Record<string, unknown>,
  referencia: Awaited<ReturnType<typeof buscarBibliotecaInstitucional>>[number],
) {
  const isbn = typeof resultado.isbn === 'string' ? resultado.isbn : ''
  if (isbn && referencia.isbn) {
    return (
      normalizarDatoBibliografico(isbn) ===
      normalizarDatoBibliografico(referencia.isbn)
    )
  }

  const titulo = typeof resultado.titulo === 'string' ? resultado.titulo : ''
  const tituloPropuesto = normalizarDatoBibliografico(titulo)
  const tituloCatalogo = normalizarDatoBibliografico(referencia.titulo)
  return (
    tituloPropuesto.length >= 8 &&
    (tituloPropuesto.includes(tituloCatalogo) ||
      tituloCatalogo.includes(tituloPropuesto))
  )
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return preflightResponse()
  }

  try {
    requireMethod(req, 'POST')
    requireJsonContentType(req)
    const rawBody = await readJsonBody(req)

    const parsed = validateInput(RequestSchema, rawBody)

    const peticion = parsed.data
    const ambito = verificarAmbito(peticion)
    // El caso `comprobar-asignatura-del-plan` necesita la base, así que se
    // resuelve más abajo, en cuanto existe el cliente de servicio.
    if (ambito.ok === false) {
      throw new HttpError(403, ambito.motivo, 'AMBITO_INVALIDO')
    }

    const { user, serviceClient: supabaseService } =
      await createAuthenticatedContext(req, {
        missingAuthorizationMessage: 'No autorizado.',
        invalidAuthorizationMessage: 'Token inválido.',
      })

    // Desde el mapa curricular se ajustan el nombre y el tipo de una asignatura
    // sin salir del plan: el ámbito autorizado es el plan, pero la carga útil
    // apunta a una asignatura. Es legítimo mientras la asignatura sea de ese
    // plan, y eso sólo lo sabe la base. Se comprueba con la clave de servicio
    // para que un `entidad_id` ajeno no convierta un permiso legítimo sobre un
    // plan en una escritura sobre otro.
    if (ambito.ok === 'comprobar-asignatura-del-plan') {
      const { data: duena, error: duenaError } = await supabaseService
        .from('asignaturas')
        .select('plan_estudio_id')
        .eq('id', ambito.asignaturaId)
        .maybeSingle()

      if (duenaError) {
        throw new HttpError(
          500,
          'No se pudo validar el ámbito de la asignatura.',
          'AMBITO_ERROR',
          duenaError,
        )
      }

      if (!duena || duena.plan_estudio_id !== ambito.planId) {
        throw new HttpError(
          403,
          'El campo no pertenece al ámbito del modo agente.',
          'AMBITO_INVALIDO',
        )
      }
    }

    const { planId, asignaturaId } = idsDelAmbito(peticion)

    const { data: puedeUsarIA, error: authzError } =
      asignaturaId === null
        ? await supabaseService.rpc('usuario_puede_usar_ia_plan', {
            p_usuario_id: user.id,
            p_plan_id: planId,
          })
        : await supabaseService.rpc('usuario_puede_usar_ia_asignatura', {
            p_usuario_id: user.id,
            p_asignatura_id: asignaturaId,
          })

    if (authzError) {
      throw new HttpError(
        500,
        'No se pudo validar el permiso de IA.',
        'AUTHZ_ERROR',
        authzError,
      )
    }

    if (!puedeUsarIA) {
      throw new HttpError(
        403,
        'No tienes permiso para usar IA aquí.',
        'IA_NOT_ALLOWED',
      )
    }

    // El modo agente busca respuestas inmediatas: el frontend manda
    // reasoning_effort 'none', que sólo aceptan los modelos GPT-5.1+ (ver
    // supportsNoReasoning). De ahí que el valor por defecto sea el modelo rápido
    // del proyecto y no gpt-5-nano, que rechazaría 'none'.
    const model = Deno.env.get('AI_AGENTE_ACCION_MODELO') ?? 'gpt-5.6-luna'
    const svc = OpenAIService.fromEnv()
    if (!(svc instanceof OpenAIService)) {
      throw new HttpError(
        500,
        'Configuración del servidor incompleta.',
        'OPENAI_MISCONFIGURED',
        svc,
      )
    }

    const temario =
      NECESITAN_TEMARIO.has(peticion.accion) && asignaturaId !== null
        ? await leerTemario(supabaseService, asignaturaId)
        : null

    const referenciasBiblioteca =
      peticion.accion === 'proponer_bibliografia'
        ? await buscarBibliotecaInstitucional(
            peticion.contexto.trim() || peticion.payload.asignatura_nombre,
          ).catch((error) => {
            console.warn(
              '[ai-agente-accion] catálogo institucional no disponible',
              error,
            )
            return []
          })
        : []
    const plantilla = construirPeticion(peticion, temario)
    const reasoning = buildReasoningParam(
      model,
      resolverEsfuerzo(peticion.accion, peticion.reasoning_effort),
    )

    const options: StructuredResponseOptions = {
      model,
      ...(reasoning ? { reasoning } : {}),
      metadata: {
        accion: peticion.accion,
        ambito: peticion.ambito.tipo,
        plan_id: planId,
        sesion_agente: peticion.sesion_id,
      },
      safety_identifier: await buildSafetyIdentifier(user.id),
      input: [
        { role: 'system', content: plantilla.sistema },
        {
          role: 'user',
          content:
            plantilla.usuario +
            contextoBibliotecaInstitucional(referenciasBiblioteca),
        },
      ],
      text: {
        format: {
          type: 'json_schema',
          name: plantilla.nombreSchema,
          strict: true,
          schema: plantilla.schema,
        },
      },
    }

    const aiResult = await svc.createStructuredResponse(options)

    if (!aiResult.ok) {
      const status = aiResult.code === 'MissingEnv' ? 500 : 502
      throw new HttpError(
        status,
        'No se pudo ejecutar la acción con IA.',
        'OPENAI_REQUEST_FAILED',
        aiResult,
      )
    }

    const output = resolveStructuredResponseOutput(aiResult)

    const salida = interpretarSalida(peticion, output)
    if (
      peticion.accion === 'proponer_bibliografia' &&
      salida.tipo === 'aplicar'
    ) {
      const resultado = salida.resultado as Record<string, unknown>
      const referencia =
        typeof resultado.referencia_biblioteca === 'string'
          ? referenciasBiblioteca.find(
              (item) => item.id === resultado.referencia_biblioteca,
            )
          : null
      if (
        !referencia ||
        !coincideConReferenciaBiblioteca(resultado, referencia)
      ) {
        resultado.referencia_biblioteca = null
      }
    }

    if (salida.tipo === 'incoherente') {
      // No se coacciona una salida inválida hasta hacerla pasar por válida:
      // escribirla dejaría el plan en un estado que el usuario no pidió.
      throw new HttpError(
        502,
        'La IA devolvió una propuesta que no se puede aplicar.',
        'AI_RESULTADO_INCOHERENTE',
        { detalle: salida.detalle, accion: peticion.accion },
      )
    }

    const interaccionId = await registrarInteraccionIA(supabaseService, {
      usuarioId: user.id,
      tipo: TIPO_INTERACCION[peticion.accion],
      planEstudioId: planId,
      asignaturaId,
      modelo: aiResult.model,
    })

    if (salida.tipo === 'rechazar') {
      // Un rechazo razonado no es un fallo: viaja en un 200 para que el cliente
      // lo muestre como información y no lo apunte en la pila de deshacer.
      return sendSuccess({ ok: true, rechazo: { motivo: salida.motivo } })
    }

    return sendSuccess({
      ok: true,
      resultado: salida.resultado,
      ...(interaccionId ? { interaccion_id: interaccionId } : {}),
    })
  } catch (error) {
    return edgeErrorResponse(error, 'ai-agente-accion')
  }
})
