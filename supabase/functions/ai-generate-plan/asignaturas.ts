import type { AlcanceGeneracionPlan } from './alcance.ts'
import type { Database } from '../_shared/database.types.ts'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { OpenAIService } from '../_shared/openai-service.ts'

type ClienteServicio = SupabaseClient<Database>

export type LineaGenerada = { id: string; nombre: string; orden: number }

export type ContextoAsignaturas = {
  planId: string
  planNombre: string
  carreraNombre: string
  facultadNombre: string
  tipoCiclo: string
  numCiclos: number
  enfoqueAcademico: string
  instruccionesAdicionales: string
}

type AsignaturaGenerada = {
  nombre: string
  codigo: string | null
  tipo: 'OBLIGATORIA' | 'OPTATIVA' | 'TRONCAL' | 'OTRA'
  numero_ciclo: number | null
  linea: number | null
  orden_celda: number | null
  creditos: number | null
  horas_academicas: number | null
  horas_independientes: number | null
  bibliografia: Array<{
    cita: string
    titulo: string | null
    autores: Array<string>
    anio: number | null
    editorial: string | null
    tipo: 'BASICA' | 'COMPLEMENTARIA'
  }>
}

const MODELO_ASIGNATURAS = 'gpt-4o-mini'

/** Tope de seguridad: un plan de 10 ciclos no debería pasar de ~8 por ciclo. */
const MAX_ASIGNATURAS = 80

function construirSchema(alcance: AlcanceGeneracionPlan, numCiclos: number) {
  const nulable = (tipo: string) => ({
    anyOf: [{ type: tipo }, { type: 'null' }],
  })

  // `strict: true` obliga a que todas las propiedades estén en `required`, así
  // que las opciones apagadas no se quitan del esquema: se piden igualmente y
  // se descartan al insertar. Enviar `null` es más barato que mantener cinco
  // esquemas distintos, y el prompt ya le dice al modelo cuáles ignorar.
  const asignatura = {
    type: 'object',
    additionalProperties: false,
    required: [
      'nombre',
      'codigo',
      'tipo',
      'numero_ciclo',
      'linea',
      'orden_celda',
      'creditos',
      'horas_academicas',
      'horas_independientes',
      'bibliografia',
    ],
    properties: {
      nombre: { type: 'string', minLength: 1 },
      codigo: nulable('string'),
      tipo: { type: 'string', enum: ['OBLIGATORIA', 'OPTATIVA', 'TRONCAL'] },
      numero_ciclo: {
        anyOf: [
          { type: 'integer', minimum: 1, maximum: numCiclos },
          { type: 'null' },
        ],
      },
      linea: {
        anyOf: [{ type: 'integer', minimum: 1 }, { type: 'null' }],
        description: 'Número de la línea curricular del listado.',
      },
      orden_celda: {
        anyOf: [{ type: 'integer', minimum: 1 }, { type: 'null' }],
      },
      creditos: nulable('number'),
      horas_academicas: nulable('number'),
      horas_independientes: nulable('number'),
      bibliografia: {
        type: 'array',
        maxItems: alcance.bibliografia ? 6 : 0,
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['cita', 'titulo', 'autores', 'anio', 'editorial', 'tipo'],
          properties: {
            cita: { type: 'string', minLength: 1 },
            titulo: nulable('string'),
            autores: { type: 'array', items: { type: 'string' } },
            anio: nulable('integer'),
            editorial: nulable('string'),
            tipo: { type: 'string', enum: ['BASICA', 'COMPLEMENTARIA'] },
          },
        },
      },
    },
  }

  return {
    type: 'object',
    additionalProperties: false,
    required: ['asignaturas'],
    properties: {
      asignaturas: {
        type: 'array',
        minItems: 1,
        maxItems: MAX_ASIGNATURAS,
        items: asignatura,
      },
    },
  }
}

function construirPrompt(
  contexto: ContextoAsignaturas,
  alcance: AlcanceGeneracionPlan,
  lineas: Array<LineaGenerada>,
) {
  const listaLineas = lineas.length
    ? lineas.map((linea, indice) => `${indice + 1}. ${linea.nombre}`).join('\n')
    : 'No hay líneas curriculares definidas.'

  const instrucciones: Array<string> = [
    `Propón el mapa de asignaturas del plan, entre ${contexto.numCiclos * 4} y ${contexto.numCiclos * 7} en total, distribuidas de forma pareja.`,
    'Cada asignatura debe tener un nombre académico real y una clave corta en «codigo».',
  ]

  if (alcance.acomodarAsignaturas) {
    instrucciones.push(
      `Asigna a cada asignatura su «numero_ciclo» (de 1 a ${contexto.numCiclos}) y el número de «linea» del listado, respetando la progresión de lo básico a lo especializante.`,
    )
  } else {
    instrucciones.push(
      'Devuelve «numero_ciclo» y «linea» en null: el usuario las acomodará después.',
    )
  }

  instrucciones.push(
    alcance.ordenarAsignaturas
      ? 'Dentro de cada combinación de línea y ciclo, numera «orden_celda» desde 1 siguiendo el orden en que conviene cursarlas.'
      : 'Devuelve «orden_celda» en null.',
  )

  instrucciones.push(
    alcance.horasAsignaturas
      ? 'Asigna «creditos», «horas_academicas» y «horas_independientes» coherentes entre sí según el Acuerdo 17/11/17 SEP: un crédito equivale a 16 horas totales entre académicas e independientes.'
      : 'Devuelve «creditos», «horas_academicas» y «horas_independientes» en null.',
  )

  instrucciones.push(
    alcance.bibliografia
      ? 'Incluye de 3 a 5 referencias por asignatura, mayoría BASICA, existentes y verificables, con autores, año y editorial reales. No inventes ISBN.'
      : 'Devuelve «bibliografia» como arreglo vacío.',
  )

  return `Diseña las asignaturas del siguiente plan de estudios:
- Plan: ${contexto.planNombre}
- Carrera: ${contexto.carreraNombre}
- Facultad: ${contexto.facultadNombre}
- Tipo de ciclo: ${contexto.tipoCiclo}
- Número de ciclos: ${contexto.numCiclos}
- Enfoque académico: ${contexto.enfoqueAcademico || 'No especificado'}
${contexto.instruccionesAdicionales ? `- Instrucciones adicionales: ${contexto.instruccionesAdicionales}` : ''}

Líneas curriculares disponibles:
${listaLineas}

${instrucciones.map((linea, i) => `${i + 1}. ${linea}`).join('\n')}`
}

/**
 * Genera las asignaturas del plan y, si se pidió, su bibliografía.
 *
 * Corre después de responder al cliente (`EdgeRuntime.waitUntil`): el wizard
 * necesita el `plan.id` en segundos para arrancar el watcher, y esta llamada
 * puede tardar minutos. Nada de lo que hace es crítico para que el plan exista,
 * así que cualquier fallo se registra y se abandona en vez de propagarse: un
 * plan sin asignaturas es recuperable a mano; un plan que no se creó, no.
 */
export async function generarAsignaturasDelPlan({
  svc,
  supabase,
  userId,
  contexto,
  alcance,
  lineas,
  estructuraPlanId,
  safetyIdentifier,
}: {
  svc: OpenAIService
  supabase: ClienteServicio
  userId: string
  contexto: ContextoAsignaturas
  alcance: AlcanceGeneracionPlan
  lineas: Array<LineaGenerada>
  estructuraPlanId: string
  safetyIdentifier?: string
}): Promise<void> {
  if (!alcance.asignaturas) return

  // Las asignaturas heredan la plantilla de asignatura de la estructura del
  // plan. Sin plantilla no hay `estructura_id`, que es obligatorio, y no se
  // puede insertar nada: se abandona antes de gastar una llamada al modelo.
  const { data: estructuras, error: estructurasError } = await supabase
    .from('estructuras_asignatura')
    .select('id,nombre')
    .eq('estructura_plan_id', estructuraPlanId)
    .order('nombre', { ascending: true })
    .limit(1)

  const estructuraAsignaturaId = estructuras?.[0]?.id
  if (estructurasError || !estructuraAsignaturaId) {
    console.warn(
      '[ai-generate-plan] Sin plantilla de asignatura para la estructura del plan; no se generan asignaturas.',
      estructurasError,
    )
    return
  }

  const resultado = await svc.createStructuredResponse<{
    asignaturas: Array<AsignaturaGenerada>
  }>({
    model: MODELO_ASIGNATURAS,
    background: false,
    safety_identifier: safetyIdentifier,
    input: [
      {
        role: 'system',
        content:
          'Eres un experto en diseño curricular universitario en México. Diseñas mapas curriculares coherentes con el perfil de egreso y con los lineamientos normativos SEP (Acuerdo 17/11/17).',
      },
      {
        role: 'user',
        content: construirPrompt(contexto, alcance, lineas),
      },
    ],
    text: {
      format: {
        type: 'json_schema',
        name: 'asignaturas_del_plan',
        schema: construirSchema(
          alcance,
          contexto.numCiclos,
        ) as unknown as Record<string, unknown>,
        strict: true,
      },
    },
  })

  const generadas = resultado.ok ? resultado.output?.asignaturas : null
  if (!resultado.ok || !Array.isArray(generadas) || generadas.length === 0) {
    console.warn(
      '[ai-generate-plan] La generación de asignaturas falló o vino vacía (no crítico):',
      resultado,
    )
    return
  }

  const filas = generadas.slice(0, MAX_ASIGNATURAS).map((asignatura) => {
    // El modelo numera las líneas por posición en el listado que se le dio;
    // fuera de rango se trata como «sin línea» en vez de romper la inserción
    // con una clave ajena inexistente.
    const linea =
      alcance.acomodarAsignaturas && asignatura.linea
        ? (lineas[asignatura.linea - 1] ?? null)
        : null

    return {
      plan_estudio_id: contexto.planId,
      estructura_id: estructuraAsignaturaId,
      nombre: asignatura.nombre,
      codigo: asignatura.codigo,
      tipo: asignatura.tipo,
      estado: 'borrador' as const,
      tipo_origen: 'IA' as const,
      creado_por: userId,
      linea_plan_id: linea?.id ?? null,
      numero_ciclo: alcance.acomodarAsignaturas
        ? (asignatura.numero_ciclo ?? null)
        : null,
      orden_celda: alcance.ordenarAsignaturas
        ? (asignatura.orden_celda ?? null)
        : null,
      creditos: alcance.horasAsignaturas ? (asignatura.creditos ?? null) : null,
      horas_academicas: alcance.horasAsignaturas
        ? (asignatura.horas_academicas ?? null)
        : null,
      horas_independientes: alcance.horasAsignaturas
        ? (asignatura.horas_independientes ?? null)
        : null,
    }
  })

  const { data: insertadas, error: insertError } = await supabase
    .from('asignaturas')
    .insert(filas)
    .select('id')

  if (insertError || !insertadas) {
    console.warn(
      '[ai-generate-plan] No se pudieron insertar las asignaturas generadas:',
      insertError,
    )
    return
  }

  if (
    filas.some(
      (fila) => fila.linea_plan_id !== null && fila.numero_ciclo !== null,
    )
  ) {
    const { error: faseError } = await supabase
      .from('planes_estudio')
      .update({ fase_diseno: 'MAPA' })
      .eq('id', contexto.planId)

    if (faseError) {
      console.warn(
        '[ai-generate-plan] Las asignaturas se insertaron, pero no se actualizó la fase del plan:',
        faseError,
      )
    }
  }

  if (!alcance.bibliografia) return

  // El orden de `insert(...).select()` corresponde al de las filas enviadas,
  // así que se emparejan por índice: no hay otra clave estable, porque el
  // nombre puede repetirse entre líneas.
  const bibliografia = insertadas.flatMap((fila, indice) => {
    const asignatura = generadas[indice]
    if (!asignatura) return []
    return asignatura.bibliografia.map((referencia) => ({
      asignatura_id: fila.id,
      cita: referencia.cita,
      titulo: referencia.titulo,
      autores: referencia.autores,
      anio: referencia.anio,
      editorial: referencia.editorial,
      tipo: referencia.tipo,
      creado_por: userId,
    }))
  })

  if (bibliografia.length === 0) return

  const { error: bibliografiaError } = await supabase
    .from('bibliografia_asignatura')
    .insert(bibliografia)

  if (bibliografiaError) {
    console.warn(
      '[ai-generate-plan] No se pudo insertar la bibliografía generada:',
      bibliografiaError,
    )
  }
}
