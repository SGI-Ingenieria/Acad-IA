// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import '@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'

import { normalizarAlcance } from './alcance.ts'
import { generarAsignaturasDelPlan } from './asignaturas.ts'
import { corsHeaders } from '../_shared/cors.ts'
import {
  MAX_GENERATION_REFERENCE_IDS,
  normalizeGenerationReferences,
} from '../_shared/ai-generation-references.ts'
import {
  buildEntityAttemptOpenAIRequest,
  prepareEntityGenerationAttempt,
  publishDurableEntityResponse,
  requeueEntityGenerationAttempt,
} from '../_shared/entity-generation-attempts.ts'
import { registrarInteraccionIA } from '../_shared/interacciones-ia.ts'
import {
  buildReferenceTools,
  persistDocumentReferences,
  resolveDocumentReferences,
} from '../_shared/documentos-referencias.ts'
import {
  resolveTenantId,
  serviceClient,
} from '../_shared/documentos-academicos.ts'
import {
  enforceStrictJsonSchema,
  stripRestrictedJsonSchemaProperties,
} from '../_shared/json-schema.ts'
import { OpenAIService } from '../_shared/openai-service.ts'
import {
  buildReasoningParam,
  buildSafetyIdentifier,
} from '../_shared/openai-response-controls.ts'
import { HttpError, sendError, sendSuccess } from '../_shared/utils.ts'

import { systemPrompt } from './prompts.ts'

import type { AIGeneratePlanInput } from './types.ts'
import type { Database, Json } from '../_shared/database.types.ts'
import type { StructuredResponseOptions } from '../_shared/openai-service.ts'
// Typed aliases for strict field unions.

type BeforeUnloadWithDetail = Event & { detail?: { reason?: unknown } }

const PALETA_BLOQUES = [
  '#4F46E5',
  '#7C3AED',
  '#9333EA',
  '#C026D3',
  '#DB2777',
  '#E11D48',
  '#059669',
  '#16A34A',
  '#65A30D',
  '#CA8A04',
  '#D97706',
  '#EA580C',
  '#DC2626',
  '#0D9488',
  '#0891B2',
  '#0284C7',
  '#2563EB',
] as const

const GenerationReferencesSchema = z
  .object({
    fileIds: z
      .array(z.string().uuid())
      .max(MAX_GENERATION_REFERENCE_IDS)
      .default([]),
    collectionIds: z
      .array(z.string().uuid())
      .max(MAX_GENERATION_REFERENCE_IDS)
      .default([]),
  })
  .strict()
  .default({ fileIds: [], collectionIds: [] })

function esFechaPasada(fechaIso: string): boolean {
  const fecha = new Date(`${fechaIso}T00:00:00`)
  if (isNaN(fecha.getTime())) return false

  const hoy = new Date()
  const mesActual = new Date(hoy.getFullYear(), hoy.getMonth(), 1).getTime()
  const mesSeleccionado = new Date(
    fecha.getFullYear(),
    fecha.getMonth(),
    1,
  ).getTime()

  return mesSeleccionado < mesActual
}

/**
 * Línea de prompt con la duración de cada ciclo, sólo cuando se conoce.
 *
 * Un semestre o un cuatrimestre traen su duración en el nombre; un ciclo
 * «Otro» no, y sin decírsela al modelo dimensiona la carga a ojo.
 */
function lineaDuracionCiclo(
  datosBasicos: AIGeneratePlanInput['datosBasicos'],
): string {
  if (datosBasicos.tipoCiclo !== 'Otro' || !datosBasicos.semanasPorCiclo) {
    return ''
  }
  return `\n- Duración de cada ciclo: ${datosBasicos.semanasPorCiclo} semanas`
}

// Re-registramos con tipo estricto (evita `any` en análisis)
addEventListener('beforeunload', (ev: BeforeUnloadWithDetail) => {
  console.error('ALERTA: La función se va a apagar. Razón:', ev.detail?.reason)
})

declare const EdgeRuntime: { waitUntil: (promise: Promise<unknown>) => void }

Deno.serve(async (req: Request): Promise<Response> => {
  const url = new URL(req.url)
  const functionName = url.pathname.split('/').pop()
  console.log(
    `[${new Date().toISOString()}][${functionName}]: Request received`,
  )

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders })
  }

  try {
    const method = req.method
    if (method !== 'POST') {
      console.error(
        `[${new Date().toISOString()}][${functionName}]: Invalid method: ${method}`,
      )
      throw new HttpError(405, 'Método no permitido.', 'METHOD_NOT_ALLOWED', {
        method,
      })
    }

    const authHeaderRaw =
      req.headers.get('Authorization') ?? req.headers.get('authorization')
    if (!authHeaderRaw) {
      console.error(
        `[${new Date().toISOString()}][${functionName}]: Missing Authorization header`,
      )
      throw new HttpError(401, 'No autorizado.', 'UNAUTHORIZED', {
        reason: 'missing_authorization_header',
      })
    }

    const contentType = (req.headers.get('content-type') || '').toLowerCase()
    if (!contentType.startsWith('multipart/form-data')) {
      console.error(
        `[${new Date().toISOString()}][${functionName}]: Unsupported content type: ${contentType}`,
      )
      throw new HttpError(
        415,
        'Content-Type no soportado.',
        'UNSUPPORTED_MEDIA_TYPE',
        { contentType },
      )
    }

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
    const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      throw new HttpError(
        500,
        'Configuración del servidor incompleta.',
        'MISSING_ENV',
        {
          missing: [
            !SUPABASE_URL ? 'SUPABASE_URL' : null,
            !SUPABASE_ANON_KEY ? 'SUPABASE_ANON_KEY' : null,
          ].filter(Boolean),
        },
      )
    }

    const supabaseAnon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeaderRaw } },
    })

    const { data: userData, error: userErr } = await supabaseAnon.auth.getUser()
    if (userErr || !userData?.user) {
      throw new HttpError(401, 'Token inválido.', 'UNAUTHORIZED', {
        reason: userErr?.message ?? 'invalid_token',
      })
    }
    const user = userData.user

    const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!SERVICE_ROLE_KEY) {
      throw new HttpError(
        500,
        'Configuración del servidor incompleta.',
        'MISSING_ENV',
        { missing: ['SUPABASE_SERVICE_ROLE_KEY'] },
      )
    }

    const supabaseService = createClient<Database>(
      SUPABASE_URL,
      SERVICE_ROLE_KEY,
    )

    // Model name controlled via env var (single use)
    const AI_GENERATE_PLAN_MODELO =
      Deno.env.get('AI_GENERATE_PLAN_MODELO') ?? 'gpt-5.6-luna'
    const safetyIdentifier = await buildSafetyIdentifier(user.id)

    const formData = await req.formData()
    const validation = parseAndValidate(formData)
    if (!validation.success) {
      console.error(
        `[${new Date().toISOString()}][${functionName}]: Validation errors:`,
        validation.errors,
      )
      const message = validation.errors
        .map((e, i) => `(${i + 1}) ${e}`)
        .join('\n')

      throw new HttpError(422, message, 'VALIDATION_ERROR', {
        errors: validation.errors,
      })
    }

    const payload: AIGeneratePlanInput = validation.data

    const { data: estructuraPlan, error: estructuraPlanError } =
      await supabaseService
        .from('estructuras_plan')
        .select('id,nombre,tipo,template_id,definicion')
        .eq('id', payload.datosBasicos.estructuraPlanId)
        .single()
    if (estructuraPlanError) {
      const maybeCode = (estructuraPlanError as { code?: string }).code
      if (maybeCode === 'PGRST116') {
        throw new HttpError(
          404,
          'No se encontró la estructura del plan.',
          'NOT_FOUND',
          {
            table: 'estructuras_plan',
            id: payload.datosBasicos.estructuraPlanId,
          },
        )
      }
      throw new HttpError(
        500,
        'No se pudo obtener la estructura del plan.',
        'SUPABASE_QUERY_FAILED',
        estructuraPlanError,
      )
    }

    const esEstructuraCurricular = estructuraPlan.tipo === 'CURRICULAR'
    if (esEstructuraCurricular) {
      if (!payload.datosBasicos.fechaInicioImparticion) {
        throw new HttpError(
          422,
          'Los planes con estructura CURRICULAR requieren inicio de impartición.',
          'FECHA_INICIO_IMPARTICION_REQUERIDA',
        )
      }

      if (
        esFechaPasada(payload.datosBasicos.fechaInicioImparticion) &&
        !payload.datosBasicos.confirmarFechaPasada
      ) {
        throw new HttpError(
          422,
          'El inicio de impartición es anterior al mes actual. Confirma que deseas continuar con una carga histórica o regularización.',
          'FECHA_PASADA_SIN_CONFIRMAR',
        )
      }
    } else if (!payload.clonacionPlan && !payload.datosBasicos.nombrePlan) {
      throw new HttpError(
        422,
        'El nombre del plan es requerido para estructuras no curriculares.',
        'NOMBRE_REQUERIDO',
      )
    }

    const references = normalizeGenerationReferences(
      payload.iaConfig.references,
    )

    // CLONADO_TRADICIONAL: flujo síncrono, genera todas las columnas e inserta directamente
    if (payload.clonacionPlan) {
      if (
        references.fileIds.length !== 1 ||
        references.collectionIds.length !== 0
      ) {
        throw new HttpError(
          422,
          'Se requiere un único documento de referencia.',
          'ONE_FILE_REQUIRED',
        )
      }

      // Estados: se usará BORRADOR
      const { data: estadoBorr } = await supabaseService
        .from('estados_plan')
        .select('id,clave')
        .eq('clave', 'BORRADOR')
        .maybeSingle()
      if (!estadoBorr?.id) {
        throw new HttpError(
          500,
          'No se encontró el estado BORRADOR.',
          'MISSING_STATE',
          {
            clave: 'BORRADOR',
          },
        )
      }

      // Catálogo de carreras para que la IA seleccione la más cercana
      const { data: carrerasAll, error: carrerasErr } = await supabaseService
        .from('carreras')
        .select('id,nombre')
      if (carrerasErr) {
        throw new HttpError(
          500,
          'No se pudieron obtener las carreras.',
          'SUPABASE_QUERY_FAILED',
          carrerasErr,
        )
      }

      const carrerasList = (Array.isArray(carrerasAll) ? carrerasAll : []).map(
        (c) => ({
          id: String(c.id),
          nombre: String(c.nombre),
        }),
      )

      // Construcción de schema: datos = definicion; además pide columnas principales.
      // La definición es editable por el usuario, así que la normalizamos para que
      // cumpla el modo `strict` de OpenAI (required completo + additionalProperties).
      const datosSchema: Record<string, unknown> = enforceStrictJsonSchema(
        stripRestrictedJsonSchemaProperties(
          typeof estructuraPlan.definicion === 'object' &&
            estructuraPlan.definicion !== null
            ? (estructuraPlan.definicion as Record<string, unknown>)
            : {},
        ),
      )

      const fullPlanSchema = {
        type: 'object',
        additionalProperties: false,
        required: [
          'analisis_documento',
          'refusal',
          'nombre',
          'tipo_ciclo',
          'numero_ciclos',
          'carrera_id',
          'datos',
        ],
        properties: {
          analisis_documento: {
            type: 'string',
            description:
              'Paso 1: Analiza brevemente de qué trata el documento. Determina explícitamente si contiene una tira de materias, créditos y estructura académica, o si es un documento técnico/informativo diferente.',
          },
          refusal: {
            type: 'string',
            description:
              'Paso 2: Basado en el analisis_documento, si el texto NO es un plan de estudios, escribe aquí el motivo exacto del rechazo. Si sí es un plan válido, deja vacío este campo.',
          },
          nombre: {
            type: 'string',
            minLength: 1,
            description:
              'No debe incluir el nivel del plan. Por lo tanto no debe empezar con Licenciatura en, Ingeniería en, etc.',
          },
          tipo_ciclo: {
            type: 'string',
            enum: ['Semestre', 'Cuatrimestre', 'Trimestre', 'Otro'],
          },
          numero_ciclos: { type: 'integer', minimum: 1 },
          carrera_id: {
            type: 'string',
            minLength: 1,
            description:
              'Debe ser uno de los ids proporcionados en la lista de carreras.',
          },
          datos: datosSchema,
        },
      } as const

      const carrerasText = carrerasList
        .map((c) => `- ${c.nombre} (id: ${c.id})`)
        .join('\n')

      const systemPromptClone = `Eres un extractor de datos altamente preciso. Tu único objetivo es volcar información de un documento adjunto hacia un formato estructurado JSON. Eres un puente de transferencia de información, no un redactor.

Reglas de Extracción:
1. Validación Estricta del Documento (Gatekeeper): evalúa si el documento es genuinamente un Plan de Estudios. Un plan de estudios real DEBE contener elementos como: fines de aprendizaje, perfil de ingreso, modalidad, etc. Si no es un documento que describe un plan de estudios o si el documento trata de cualquier otro tema (por ejemplo, manuales técnicos, presentaciones, artículos), ESTÁ ESTRICTAMENTE PROHIBIDO extraer información. En su lugar, debes llenar ÚNICAMENTE el campo "refusal" con el motivo (ej. "El documento es una presentación sobre redes, no un plan de estudios") y dejar todos los demás campos vacíos o nulos.
2. Copia Textual (Verbatim): Extrae el contenido del documento y cópialo de manera EXACTA. Está estrictamente prohibido parafrasear, resumir, alucinar información o modificar la redacción original.
3. Mapeo Inteligente de Campos: Relaciona las secciones del documento con los campos de la estructura esperada basándote en similitud semántica. Por ejemplo, mapea "FIN DEL APRENDIZAJE" o "fines de aprendizaje" hacia el campo equivalente en el esquema (ej. "Fines de aprendizaje o formación").
4. Manejo de Ausencias: Si un campo de la estructura esperada no existe en el documento adjunto o no hay un equivalente claro, déjalo vacío (string vacío, null, o array vacío según el esquema). Si el campo es un listado cerrado (enum) y es obligatorio, selecciona la opción que tenga más sentido lógico. Nunca inventes información para rellenar vacíos.

Reglas de Formato (Aplicables al contenido extraído):
1. Estilo Visual: Redacta el contenido exclusivamente para visualización en texto plano (estilo 'white-space: pre-wrap').
2. Estructura Vertical: Utiliza saltos de línea explícitos (\\n) para romper líneas y doble salto de línea (\\n\\n) para separar párrafos.
3. Indentación Estricta: Usa exactamente 2 espacios para la indentación jerárquica. No uses tabuladores.
4. Listas: Utiliza un guion seguido de un espacio ("- ") para los elementos de lista.
5. Prohibiciones: No incluyas etiquetas HTML, sintaxis Markdown (asteriscos, numerales, etc.) ni caracteres de escape literales visibles en el texto final. Asegúrate de que el JSON final contenga saltos de línea válidos ('\\n') y no texto escapado.`

      const userPromptClone = `Clonar plan de estudios a partir del Word o pdf adjunto. Requisitos:
- Elegir 'carrera_id' de esta lista, seleccionando la más cercana por nombre:
${carrerasText}
- Generar 'nombre', 'nivel', 'tipo_ciclo', 'numero_ciclos' y 'datos' respetando el contenido del documento.
- El campo 'datos' debe seguir estrictamente el esquema provisto.
- El nombre de la institución/universidad (si se pide) es Universidad La Salle México`
      const documentSupabase = serviceClient()
      const documentReferences = await resolveDocumentReferences({
        supabase: documentSupabase,
        userId: user.id,
        fileIds: references.fileIds,
        collectionIds: references.collectionIds,
        query: userPromptClone,
        // La clonación copia el documento textualmente: contenido íntegro.
        forceDirect: true,
      })
      if (documentReferences.mode !== 'direct') {
        throw new HttpError(
          409,
          'El documento aún no está listo para clonar el plan.',
          'DOCUMENT_NOT_READY',
        )
      }

      const svc = OpenAIService.fromEnv()
      if (!(svc instanceof OpenAIService)) {
        throw new HttpError(
          500,
          'Configuración de OpenAI incompleta.',
          'OPENAI_MISCONFIGURED',
          svc,
        )
      }

      const structuredPayload: StructuredResponseOptions = {
        model: 'gpt-4o-mini',
        background: false,
        safety_identifier: safetyIdentifier,
        input: [
          { role: 'system', content: systemPromptClone },
          {
            role: 'user',
            content: [
              ...documentReferences.inputFiles,
              {
                type: 'input_text',
                text: documentReferences.context
                  ? `${documentReferences.context}\n\n${userPromptClone}`
                  : userPromptClone,
              },
            ],
          },
        ],
        text: {
          format: {
            type: 'json_schema',
            name: 'plan_de_estudios_completo',
            schema: fullPlanSchema as unknown as Record<string, unknown>,
            strict: true,
          },
        },
      }

      const aiResultSync = await svc.createStructuredResponse<{
        nombre: string
        nivel: string
        tipo_ciclo: Database['public']['Tables']['planes_estudio']['Insert']['tipo_ciclo']
        numero_ciclos: number
        carrera_id: string
        datos: Json
      }>(structuredPayload)
      if (!aiResultSync.ok) {
        const status = aiResultSync.code === 'MissingEnv' ? 500 : 502
        throw new HttpError(
          status,
          'La IA no pudo generar el plan clonado.',
          'OPENAI_REQUEST_FAILED',
          aiResultSync,
        )
      }

      // Se espera que el servicio empaquete la salida json en aiResultSync.data
      const out = aiResultSync.output as {
        nombre: string
        nivel: string
        tipo_ciclo: Database['public']['Tables']['planes_estudio']['Insert']['tipo_ciclo']
        numero_ciclos: number
        carrera_id: string
        datos: Json
        refusal: string
      }

      if (out.refusal) {
        throw new HttpError(
          422,
          'La IA no pudo generar el plan.',
          'AI_GENERATION_FAILED',
          { refusal: out.refusal },
        )
      }

      const carreraOk = carrerasList.some((c) => c.id === out.carrera_id)
      if (!carreraOk) {
        throw new HttpError(
          422,
          'La IA devolvió una carrera_id no válida.',
          'INVALID_CARRERA_ID',
          {
            carrera_id: out.carrera_id,
          },
        )
      }

      const { data: inserted, error: insErr } = await supabaseService
        .from('planes_estudio')
        .insert({
          nombre: esEstructuraCurricular ? null : out.nombre,
          nombre_propuesto: esEstructuraCurricular ? null : out.nombre,
          nombre_display: out.nombre,
          tipo_ciclo: out.tipo_ciclo,
          numero_ciclos: out.numero_ciclos,
          carrera_id: out.carrera_id,
          estructura_id: estructuraPlan.id,
          fecha_inicio_imparticion: payload.datosBasicos.fechaInicioImparticion,
          estado_actual_id: estadoBorr.id,
          activo: true,
          tipo_origen: 'IA',
          creado_por: user.id,
          datos: out.datos,
          meta_origen: {
            generado_por: 'ai-generate-plan',
            clonacionPlan: true,
            referencias: { fileId: references.fileIds[0] },
          } as unknown as Json,
        })
        .select('id,nombre,nombre_display')
        .single()

      if (insErr) {
        throw new HttpError(
          500,
          'No se pudo insertar el plan clonado.',
          'SUPABASE_INSERT_FAILED',
          insErr,
        )
      }

      await persistDocumentReferences({
        supabase: documentSupabase,
        tenantId: await resolveTenantId(documentSupabase, user.id),
        requestId: aiResultSync.responseId,
        conversationType: 'plan',
        conversationId: String(inserted.id),
        references: documentReferences.references,
        mode: documentReferences.mode,
        query: userPromptClone,
      })

      await registrarInteraccionIA(supabaseService, {
        usuarioId: user.id,
        planEstudioId: String(inserted.id),
        tipo: 'GENERAR',
        modelo: AI_GENERATE_PLAN_MODELO,
      })

      console.log(
        `[${new Date().toISOString()}][${functionName}]: Request processed successfully`,
      )
      return sendSuccess(inserted)
    }

    // Ensure the JSON schema is an object as required by OpenAI types.
    // La definición es editable por el usuario, por lo que la normalizamos para
    // cumplir el modo `strict` de OpenAI (required completo + additionalProperties).
    const schemaDef: Record<string, unknown> = enforceStrictJsonSchema(
      stripRestrictedJsonSchemaProperties(
        typeof estructuraPlan.definicion === 'object' &&
          estructuraPlan.definicion !== null
          ? (estructuraPlan.definicion as Record<string, unknown>)
          : {},
      ),
    )

    if (!payload.clonacionPlan) {
      const userPrompt = `Genera un borrador completo del PLAN DE ESTUDIOS con base en lo siguiente:
      - Nombre de la institución: Universidad La Salle México
    - Nombre del plan: ${String(payload.datosBasicos.nombrePlan)}
    - Tipo de ciclo: ${String(payload.datosBasicos.tipoCiclo)}
    - Número de ciclos: ${String(payload.datosBasicos.numCiclos)}${lineaDuracionCiclo(payload.datosBasicos)}
    - Descripción del enfoque académico (sobre el contenido de la respuesta generada): ${String(
      payload.iaConfig.descripcionEnfoqueAcademico,
    )}
    - Notas adicionales (sobre el formato de la respuesta generada): ${String(
      payload.iaConfig.instruccionesAdicionalesIA ?? 'Ninguna',
    )}
    - Brief curricular confirmado (distingue fundamentos, respuestas y supuestos): ${
      payload.iaConfig.briefCurricular
        ? JSON.stringify(payload.iaConfig.briefCurricular)
        : 'No disponible'
    }`

      const { data: estado } = await supabaseService
        .from('estados_plan')
        .select('id,clave,orden')
        .eq('clave', 'GENERANDO')
        .maybeSingle()

      if (!estado?.id) {
        throw new HttpError(
          500,
          'No se encontró el estado GENERANDO.',
          'MISSING_STATE',
          { clave: 'GENERANDO' },
        )
      }

      const { data: carrera, error: carreraError } = await supabaseService
        .from('carreras')
        .select('id,nombre,facultad_id,facultades(id,nombre,nombre_corto)')
        .eq('id', String(payload.datosBasicos.carreraId))
        .maybeSingle()
      if (carreraError) {
        throw new HttpError(
          500,
          'No se pudo obtener la carrera.',
          'SUPABASE_QUERY_FAILED',
          carreraError,
        )
      }
      if (!carrera) {
        throw new HttpError(404, 'No se encontró la carrera.', 'NOT_FOUND', {
          table: 'carreras',
          id: payload.datosBasicos.carreraId,
        })
      }

      const planInsert = {
        carrera_id: carrera.id,
        estructura_id: estructuraPlan.id,
        fecha_inicio_imparticion: payload.datosBasicos.fechaInicioImparticion,
        nombre: esEstructuraCurricular
          ? null
          : String(payload.datosBasicos.nombrePlan),
        nombre_propuesto: esEstructuraCurricular
          ? null
          : String(payload.datosBasicos.nombrePlan),
        nombre_display: String(payload.datosBasicos.nombrePlan),
        tipo_ciclo: String(
          payload.datosBasicos.tipoCiclo,
        ) as Database['public']['Tables']['planes_estudio']['Insert']['tipo_ciclo'],
        numero_ciclos: Number(payload.datosBasicos.numCiclos),
        semanas_por_ciclo:
          payload.datosBasicos.tipoCiclo === 'Otro'
            ? (payload.datosBasicos.semanasPorCiclo ?? null)
            : null,
        // IMPORTANTE: se inserta SIN `datos` (se actualiza vía webhook)
        estado_actual_id: estado.id,
        activo: true,
        tipo_origen: 'IA',
        estructura_recomendada_id:
          payload.datosBasicos.estructuraRecomendadaId ?? null,
        seleccion_estructura:
          payload.datosBasicos.estructuraRecomendadaId &&
          payload.datosBasicos.estructuraRecomendadaId !==
            payload.datosBasicos.estructuraPlanId
            ? 'MANUAL'
            : 'AUTOMATICA',
        motivo_estructura_manual:
          payload.datosBasicos.estructuraRecomendadaId &&
          payload.datosBasicos.estructuraRecomendadaId !==
            payload.datosBasicos.estructuraPlanId
            ? payload.datosBasicos.motivoEstructuraManual
            : null,
        fase_diseno: 'FUNDAMENTOS',
        creado_por: user.id,
        meta_origen: {
          generado_por: 'ai-generate-plan',
          referencias: {
            fileIds: references.fileIds,
            collectionIds: references.collectionIds,
          },
          iaConfig: {
            descripcionEnfoqueAcademico:
              payload.iaConfig.descripcionEnfoqueAcademico,
            instruccionesAdicionalesIA:
              payload.iaConfig.instruccionesAdicionalesIA ?? null,
            webSearchEnabled: payload.iaConfig.webSearchEnabled ?? false,
            briefCurricular: payload.iaConfig.briefCurricular ?? null,
            borradorDisenoId: payload.iaConfig.borradorDisenoId ?? null,
          },
        } as unknown as Json,
      } as unknown as Database['public']['Tables']['planes_estudio']['Insert']

      const { data: plan, error: planError } = await supabaseService
        .from('planes_estudio')
        .insert(planInsert)
        .select(
          'id,nombre,nombre_propuesto,nombre_display,fecha_inicio_imparticion,tipo_ciclo,numero_ciclos,semanas_por_ciclo,carrera_id,estructura_id,estado_actual_id,activo,tipo_origen,meta_origen,creado_por,actualizado_por,creado_en,actualizado_en,datos',
        )
        .single()

      if (planError) {
        const maybeCode = (planError as { code?: string }).code
        const status = maybeCode ? 409 : 500
        throw new HttpError(
          status,
          'No se pudo guardar el plan de estudios.',
          'SUPABASE_INSERT_FAILED',
          { ...planError, code: maybeCode },
        )
      }

      if (payload.iaConfig.borradorDisenoId) {
        const draftsClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
        await draftsClient
          .from('borradores_diseno_plan')
          .update({
            estado: 'CONSUMIDO',
            actualizado_en: new Date().toISOString(),
          })
          .eq('id', payload.iaConfig.borradorDisenoId)
          .eq('usuario_id', user.id)
      }

      // Initialize OpenAI service once — used for both lineas (sync) and plan generation (background)
      const svc = OpenAIService.fromEnv()
      if (!(svc instanceof OpenAIService)) {
        throw new HttpError(
          500,
          'Configuración del servidor incompleta.',
          'OPENAI_MISCONFIGURED',
          svc,
        )
      }

      const alcance = normalizarAlcance(payload.alcance)
      // Las líneas generadas se conservan para acomodar las asignaturas: sin
      // sus ids, «acomodarlas» sólo podría fijar el ciclo.
      const lineasGeneradas: Array<{
        id: string
        nombre: string
        orden: number
      }> = []

      // Generate líneas curriculares via AI (synchronous, lightweight call)
      const lineasSchema = {
        type: 'object',
        additionalProperties: false,
        required: ['lineas'],
        properties: {
          lineas: {
            type: 'array',
            minItems: 2,
            maxItems: 8,
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['nombre', 'orden', 'area', 'color', 'proposito'],
              properties: {
                nombre: { type: 'string', minLength: 1 },
                orden: { type: 'integer', minimum: 1 },
                area: { type: 'string' },
                color: { anyOf: [{ type: 'string' }, { type: 'null' }] },
                proposito: { type: 'string', minLength: 1 },
              },
            },
          },
        },
      }

      const lineasUserPrompt = `Propón entre 3 y 6 líneas curriculares para el siguiente plan de estudios:
- Nombre del plan: ${String(payload.datosBasicos.nombrePlan)}
- Carrera: ${carrera.nombre}
- Facultad: ${(carrera as any).facultades?.nombre ?? ''}
- Tipo de ciclo: ${String(payload.datosBasicos.tipoCiclo)}
- Número de ciclos: ${String(payload.datosBasicos.numCiclos)}${lineaDuracionCiclo(payload.datosBasicos)}
- Enfoque académico: ${String(
        payload.iaConfig.descripcionEnfoqueAcademico || 'No especificado',
      )}
- Fundamentos y decisiones confirmadas: ${
        payload.iaConfig.briefCurricular
          ? JSON.stringify(payload.iaConfig.briefCurricular)
          : 'No especificados'
      }

Genera bloques de conocimiento coherentes con el perfil de egreso, los fines formativos y los lineamientos del Acuerdo 17/11/17 SEP. Ordénalos de los conocimientos básicos a los especializados. Cada bloque debe tener un nombre claro, un área temática y un propósito breve que explique qué organiza y qué aporta al perfil de egreso. Asigna orden secuencial comenzando en 1.`

      // Generar líneas es ahora una opción del alcance: se salta la llamada
      // entera, no sólo la inserción, para no gastar una petición cuyo
      // resultado se iba a tirar.
      const lineasResult = !alcance.lineasCurriculares
        ? null
        : await svc.createStructuredResponse<{
            lineas: Array<{
              nombre: string
              orden: number
              area: string
              color: string | null
              proposito: string
            }>
          }>({
            model: 'gpt-4o-mini',
            background: false,
            safety_identifier: safetyIdentifier,
            input: [
              {
                role: 'system',
                content:
                  'Eres un experto en diseño curricular universitario en México. Genera líneas curriculares contextualizadas y coherentes con el programa, siguiendo los lineamientos normativos SEP (Acuerdo 17/11/17).',
              },
              { role: 'user', content: lineasUserPrompt },
            ],
            text: {
              format: {
                type: 'json_schema',
                name: 'lineas_curriculares',
                schema: lineasSchema as unknown as Record<string, unknown>,
                strict: true,
              },
            },
          })

      if (
        lineasResult?.ok &&
        Array.isArray(lineasResult.output?.lineas) &&
        lineasResult.output.lineas.length > 0
      ) {
        const coloresUsados = new Set<string>()
        const lineasInsert = lineasResult.output.lineas.map((l, index) => {
          const propuesto = l.color?.trim().toUpperCase() ?? ''
          const valido = /^#[0-9A-F]{6}$/.test(propuesto)
          const color =
            valido && !coloresUsados.has(propuesto)
              ? propuesto
              : (PALETA_BLOQUES.find(
                  (candidato) => !coloresUsados.has(candidato),
                ) ?? PALETA_BLOQUES[index % PALETA_BLOQUES.length])
          coloresUsados.add(color)

          return {
            nombre: l.nombre,
            orden: l.orden,
            area: l.area,
            color,
            proposito: l.proposito,
            plan_estudio_id: plan.id,
            creado_por: user.id,
          }
        })

        const { data: lineasInsertadas, error: lineasError } =
          await supabaseService
            .from('lineas_plan')
            .insert(lineasInsert)
            .select('id,nombre,orden')

        if (lineasError) {
          console.warn(
            `[${new Date().toISOString()}][${functionName}]: Failed to insert AI-generated lineas:`,
            lineasError,
          )
        } else if (lineasInsertadas) {
          lineasGeneradas.push(
            ...[...lineasInsertadas].sort((a, b) => a.orden - b.orden),
          )
          await supabaseService
            .from('planes_estudio')
            .update({ fase_diseno: 'BLOQUES' })
            .eq('id', plan.id)
        }
      } else if (lineasResult && !lineasResult.ok) {
        console.warn(
          `[${new Date().toISOString()}][${functionName}]: AI lineas generation failed (non-critical):`,
          lineasResult,
        )
      }

      const documentSupabase = serviceClient()
      const documentReferences = await resolveDocumentReferences({
        supabase: documentSupabase,
        userId: user.id,
        fileIds: references.fileIds,
        collectionIds: references.collectionIds,
        query: userPrompt,
      })
      const augmentedPrompt = documentReferences.context
        ? `${documentReferences.context}\n\nSolicitud de generación:\n${userPrompt}`
        : userPrompt
      // El snapshot durable conserva texto y versiones, nunca URLs firmadas ni
      // file_data. Los archivos directos se rehidratan justo antes de OpenAI.
      const userContent =
        documentReferences.mode === 'direct'
          ? `Usa únicamente estas referencias autorizadas cuando sean pertinentes.\n\n${augmentedPrompt}`
          : augmentedPrompt

      const reasoning = buildReasoningParam(
        AI_GENERATE_PLAN_MODELO,
        payload.iaConfig.reasoningEffort,
      )
      const aiStructuredPayload: StructuredResponseOptions = {
        model: AI_GENERATE_PLAN_MODELO,
        background: true,
        metadata: {
          tabla: 'planes_estudio',
          accion: 'crear',
          id: String(plan.id),
          reasoningEffort: payload.iaConfig.reasoningEffort ?? 'auto',
        },
        safety_identifier: safetyIdentifier,
        ...(reasoning ? { reasoning } : {}),
        tools: buildReferenceTools({
          webSearchEnabled: payload.iaConfig.webSearchEnabled ?? false,
          vectorStoreId: documentReferences.vectorStoreId,
        }),
        input: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent },
        ],
        text: {
          format: {
            type: 'json_schema',
            name: 'plan_de_estudios_standard',
            schema: schemaDef,
            strict: true,
          },
        },
      }

      // INICIO DE CÓDIGO PARA DEBBUGGING
      // console.log(
      //   `[${
      //     new Date().toISOString()
      //   }][${functionName}]: Request processed successfully`,
      // );
      // const { data: plan_debug } = await supabaseService
      //   .from("planes_estudio")
      //   .select("*")
      //   .eq("id", "7ce657b1-1abf-4972-858d-5fffe1d51499")
      //   .maybeSingle();
      // return sendSuccess(plan_debug);
      // FIN DE CÓDIGO PARA DEBBUGGING

      const generationAttempt = await prepareEntityGenerationAttempt({
        supabase: supabaseService,
        attemptId: crypto.randomUUID(),
        kind: 'plan',
        entityId: String(plan.id),
        userId: user.id,
        request: aiStructuredPayload,
        referenceMode: documentReferences.mode,
        referenceQuery: userPrompt,
        references: documentReferences.references,
        context: {
          source: 'ai-generate-plan',
          model: AI_GENERATE_PLAN_MODELO,
          reasoningEffort: payload.iaConfig.reasoningEffort ?? 'auto',
        },
        actor: 'edge:ai-generate-plan',
      })
      const durableRequest = await buildEntityAttemptOpenAIRequest({
        attempt: generationAttempt,
        supabase: documentSupabase,
      })
      const aiResult = await svc.createStructuredResponse(durableRequest)
      if (!aiResult.ok) {
        await requeueEntityGenerationAttempt({
          supabase: supabaseService,
          attempt: generationAttempt,
          error: aiResult,
        })
        const status = aiResult.code === 'MissingEnv' ? 500 : 502
        throw new HttpError(
          status,
          'No se pudo iniciar la generación del plan con IA.',
          'OPENAI_REQUEST_FAILED',
          aiResult,
        )
      }

      const publication = await publishDurableEntityResponse({
        supabase: supabaseService,
        attempt: generationAttempt,
        response: aiResult,
        cancelDuplicateResponse: async (responseId) => {
          await svc.cancelResponse(responseId)
        },
      })
      if (
        publication.resolution === 'stale' ||
        !publication.attempt?.openai_response_id ||
        !publication.entity
      ) {
        throw new HttpError(
          409,
          'Una generación más reciente sustituyó esta solicitud.',
          'AI_GENERATION_SUPERSEDED',
          publication,
        )
      }
      const planWithResponseId = publication.entity

      try {
        await registrarInteraccionIA(supabaseService, {
          usuarioId: user.id,
          planEstudioId: String(plan.id),
          tipo: 'GENERAR',
          modelo: AI_GENERATE_PLAN_MODELO,
        })
      } catch (interactionError) {
        console.warn(
          'La generación se publicó, pero no se registró la interacción:',
          interactionError,
        )
      }

      // Las asignaturas se generan después de responder: el wizard necesita el
      // `plan.id` en segundos para arrancar el watcher, y esta etapa puede
      // tardar minutos. No es crítica —un plan sin asignaturas sigue siendo
      // usable— así que se resuelve fuera del ciclo de la petición.
      if (alcance.asignaturas) {
        EdgeRuntime.waitUntil(
          generarAsignaturasDelPlan({
            svc,
            supabase: supabaseService,
            userId: user.id,
            alcance,
            lineas: lineasGeneradas,
            estructuraPlanId: String(payload.datosBasicos.estructuraPlanId),
            safetyIdentifier,
            contexto: {
              planId: String(plan.id),
              planNombre: String(payload.datosBasicos.nombrePlan ?? ''),
              carreraNombre: carrera.nombre,
              facultadNombre:
                (carrera as { facultades?: { nombre?: string } }).facultades
                  ?.nombre ?? '',
              tipoCiclo: String(payload.datosBasicos.tipoCiclo),
              numCiclos: Number(payload.datosBasicos.numCiclos),
              enfoqueAcademico:
                payload.iaConfig.descripcionEnfoqueAcademico ?? '',
              instruccionesAdicionales:
                payload.iaConfig.instruccionesAdicionalesIA ?? '',
            },
          }).catch((error) => {
            console.error(
              `[${new Date().toISOString()}][${functionName}]: Fallo la generación de asignaturas:`,
              error,
            )
          }),
        )
      }

      console.log(
        `[${new Date().toISOString()}][${functionName}]: Request processed successfully`,
      )
      return sendSuccess({
        plan: planWithResponseId,
        openai: { responseId: publication.attempt.openai_response_id },
      })
    } // fin flujo no clonación

    throw new HttpError(
      500,
      'Flujo no manejado en ai-generate-plan',
      'UNREACHABLE',
    )
  } catch (error) {
    if (error instanceof HttpError) {
      console.error(
        `[${new Date().toISOString()}][${functionName}] ⚠️ Handled Error:`,
        {
          message: error.message,
          code: error.code,
          internalDetails: error.internalDetails || 'N/A',
        },
      )

      // RESPONSE: Solo enviamos el mensaje limpio y el código
      return sendError(error.status, error.message, error.code)
    }

    // CASO B: Error Inesperado (Crash, Bug, Syntax Error, etc.)
    // El usuario NO debe ver esto.
    const unexpectedError =
      error instanceof Error ? error : new Error(String(error))

    // LOG: Full stack trace y mensaje real
    console.error(
      `[${new Date().toISOString()}][${functionName}] 💥 CRITICAL UNHANDLED ERROR:`,
      unexpectedError.stack || unexpectedError.message, // Esto es lo que necesitas para debuguear
    )

    // RESPONSE: Mensaje genérico y seguro
    return sendError(
      500,
      'Ocurrió un error inesperado en el servidor.',
      'INTERNAL_SERVER_ERROR',
    )
  }
})

// Este helper recibe un esquema (ej. DatosBasicosSchema) y devuelve un validador
// que acepta un string JSON y lo valida contra ese esquema.
const jsonFromString = <T extends z.ZodTypeAny>(schema: T) =>
  z
    .string()
    .transform((str, ctx) => {
      try {
        return JSON.parse(str)
      } catch {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'El formato no es un JSON válido',
        })
        return z.NEVER // Detiene la ejecución aquí si falla el parseo
      }
    })
    .pipe(schema) // Si el parseo es exitoso, pasa los datos al esquema real

// --- VALIDACIÓN ESTRICTA DE DATOS BÁSICOS ---
const dateStringSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'La fecha debe tener formato YYYY-MM-DD')
  .nullable()
  .optional()

const DatosBasicosSchema: z.ZodType<AIGeneratePlanInput['datosBasicos']> = z
  .object({
    nombrePlan: z.string().optional(),
    fechaInicioImparticion: dateStringSchema,
    confirmarFechaPasada: z.boolean().optional(),
    carreraId: z.string().uuid('carreraId debe ser un UUID'),
    facultadId: z.string().uuid('facultadId debe ser un UUID').optional(),
    tipoCiclo: z.enum(['Semestre', 'Cuatrimestre', 'Trimestre', 'Otro']),
    numCiclos: z.number().int().positive(),
    semanasPorCiclo: z.number().int().min(1).max(104).nullable().optional(),
    estructuraPlanId: z.string().uuid('estructuraPlanId debe ser un UUID'),
    estructuraRecomendadaId: z.string().uuid().nullable().optional(),
    motivoEstructuraManual: z.string().max(1000).nullable().optional(),
  })
  // Un ciclo «Otro» no declara su duración en el nombre, y sin ella el
  // modelo no puede dimensionar la carga de cada ciclo.
  .superRefine((value, ctx) => {
    if (value.tipoCiclo === 'Otro' && !value.semanasPorCiclo) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['semanasPorCiclo'],
        message:
          'Indica cuántas semanas dura cada ciclo cuando el tipo de ciclo es «Otro».',
      })
    }
  })

const LineaPlanSchema = z.object({
  nombre: z.string().min(1, 'El nombre de la línea es requerido'),
  orden: z.number().int().nonnegative(),
  area: z.string().optional(),
  color: z.string().nullable().optional(),
  proposito: z.string().nullable().optional(),
  aporte_perfil_egreso: z.string().nullable().optional(),
  alcance_formativo: z.string().nullable().optional(),
})

const IAConfigSchema: z.ZodType<AIGeneratePlanInput['iaConfig']> = z
  .object({
    descripcionEnfoqueAcademico: z.string(),
    instruccionesAdicionalesIA: z.string().optional(),
    references: GenerationReferencesSchema,
    webSearchEnabled: z.boolean().optional().default(false),
    reasoningEffort: z
      .enum(['auto', 'none', 'low', 'medium', 'high'])
      .optional()
      .default('auto'),
    briefCurricular: z.record(z.string(), z.unknown()).optional(),
    borradorDisenoId: z.string().uuid().nullable().optional(),
  })
  .strict()

const AlcanceSchema = z
  .object({
    lineasCurriculares: z.boolean(),
    asignaturas: z.boolean(),
    acomodarAsignaturas: z.boolean(),
    ordenarAsignaturas: z.boolean(),
    horasAsignaturas: z.boolean(),
    bibliografia: z.boolean(),
  })
  .partial()

const SolicitudSchema = z.object({
  // Usamos el helper aquí. Zod recibe string -> parsea -> valida estructura
  datosBasicos: jsonFromString(DatosBasicosSchema),

  iaConfig: jsonFromString(IAConfigSchema),

  lineas: jsonFromString(z.array(LineaPlanSchema)).optional(),

  alcance: jsonFromString(AlcanceSchema).optional(),
})

function parseAndValidate(formData: FormData):
  | { success: true; data: AIGeneratePlanInput }
  | {
      success: false
      errors: Array<string>
    } {
  // Detectar clonación
  const clonacionPlanRaw = formData.get('clonacionPlan')
  const clonacionPlan = String(clonacionPlanRaw ?? '').toLowerCase() === 'true'

  if (clonacionPlan) {
    const DatosBasicosClone = z.object({
      estructuraPlanId: z.string().uuid('estructuraPlanId debe ser un UUID'),
      fechaInicioImparticion: dateStringSchema,
      confirmarFechaPasada: z.boolean().optional(),
    })
    const IAConfigClone = z
      .object({
        references: GenerationReferencesSchema.refine(
          (references) =>
            references.fileIds.length === 1 &&
            references.collectionIds.length === 0,
          'La clonación requiere exactamente un archivo documental.',
        ),
        webSearchEnabled: z.boolean().optional().default(false),
        reasoningEffort: z
          .enum(['auto', 'none', 'low', 'medium', 'high'])
          .optional()
          .default('auto'),
      })
      .strict()

    const datosBasicosStr = formData.get('datosBasicos')
    const iaConfigStr = formData.get('iaConfig')

    let datosBasicosParsed: unknown
    let iaConfigParsed: unknown
    try {
      datosBasicosParsed = JSON.parse(String(datosBasicosStr))
      iaConfigParsed = JSON.parse(String(iaConfigStr))
    } catch {
      return {
        success: false,
        errors: ['datosBasicos o iaConfig no son JSON válidos'],
      }
    }

    let dbData: z.infer<typeof DatosBasicosClone> | null = null
    let iaData: z.infer<typeof IAConfigClone> | null = null
    const errs: Array<string> = []
    try {
      dbData = DatosBasicosClone.parse(datosBasicosParsed)
    } catch (e) {
      const ze = e as z.ZodError
      errs.push(
        ...ze.issues.map(
          (issue: z.ZodIssue) =>
            `datosBasicos.${issue.path.join('.')}: ${issue.message}`,
        ),
      )
    }
    try {
      iaData = IAConfigClone.parse(iaConfigParsed)
    } catch (e) {
      const ze = e as z.ZodError
      errs.push(
        ...ze.issues.map(
          (issue: z.ZodIssue) =>
            `iaConfig.${issue.path.join('.')}: ${issue.message}`,
        ),
      )
    }
    if (errs.length) return { success: false, errors: errs }

    return {
      success: true,
      data: {
        clonacionPlan: true,
        datosBasicos: dbData as AIGeneratePlanInput['datosBasicos'],
        iaConfig: iaData as AIGeneratePlanInput['iaConfig'],
      },
    }
  }

  // Flujo normal (no clonación)
  const rawInput = {
    datosBasicos: formData.get('datosBasicos'),
    iaConfig: formData.get('iaConfig'),
    lineas: formData.get('lineas') ?? undefined,
    alcance: formData.get('alcance') ?? undefined,
  }

  const result = SolicitudSchema.safeParse(rawInput)
  if (!result.success) {
    const errors: Array<string> = result.error.issues.map(
      (issue: z.ZodIssue) => {
        const path = issue.path.join('.')
        return `${path}: ${issue.message}`
      },
    )

    return { success: false, errors }
  }
  return { success: true, data: result.data }
}
