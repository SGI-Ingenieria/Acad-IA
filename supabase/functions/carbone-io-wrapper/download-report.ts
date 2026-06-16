import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { corsHeaders } from '../_shared/cors.ts'
import type { Database, Json } from '../_shared/database.types.ts'
import { HttpError } from '../_shared/utils.ts'
import { CarboneClient } from './carbone.ts'
import { Workbook } from '@cj-tech-master/excelts'
import {
  applyColumnWidthPattern,
  applyMergePattern,
} from './CombinateCells/excelUtils.ts'
import { Buffer } from 'node:buffer'
import {
  CAMPOS_SIEMPRE_ASIGNATURA,
  CAMPOS_SIEMPRE_PLAN,
  construirDatos,
} from '../_shared/camposDocumento.ts'

const DownloadReportBodySchema = z.record(z.unknown()).optional().default({})

const DownloadReportPlanSchema = z
  .object({
    action: z.literal('downloadReport'),
    plan_estudio_id: z.string().min(1),
    body: DownloadReportBodySchema,
  })
  .strict()

const DownloadReportAsignaturaSchema = z
  .object({
    action: z.literal('downloadReport'),
    asignatura_id: z.string().min(1),
    body: DownloadReportBodySchema,
  })
  .strict()

export const DownloadReportSchema = z.union([
  DownloadReportPlanSchema,
  DownloadReportAsignaturaSchema,
])

export type DownloadReportInput = z.infer<typeof DownloadReportSchema>

type SupabaseClient = ReturnType<typeof createClient<Database>>

type CarboneDownload = {
  buffer: Uint8Array
  contentType: string | null
  contentDisposition: string | null
}

async function prepararDatosParaExcel(
  supabase: SupabaseClient,
  planEstudioId: string,
) {
  const { data: plan, error: planError } = await supabase
    .from('planes_estudio')
    .select('*, estructura:estructuras_plan(*)')
    .eq('id', planEstudioId)
    .single()

  const { data: asignaturas, error: asigError } = await supabase
    .from('asignaturas')
    .select('*, linea:lineas_plan(nombre)')
    .eq('plan_estudio_id', planEstudioId)
    .order('numero_ciclo', { ascending: true })

  if (planError || asigError)
    throw new Error('Error obteniendo datos de la base de datos.')

  // --- MAPA DE BÚSQUEDA PARA PRERREQUISITOS ---
  const mapaClaves = asignaturas.reduce(
    (acc, asig) => {
      acc[asig.id] = asig.codigo
      return acc
    },
    {} as Record<string, string>,
  )

  // 1. Cálculo de métricas de estructura
  const materiasPorCiclo = Array.from(
    { length: plan.numero_ciclos },
    (_, i) => asignaturas.filter((a) => a.numero_ciclo === i + 1).length,
  )
  const maxMaterias = Math.max(...materiasPorCiclo)

  // 2. Transformación de Semestres (con datos por materia)
  const semestres = Array.from({ length: plan.numero_ciclos }, (_, i) => {
    const materiasDelCiclo = asignaturas.filter((a) => a.numero_ciclo === i + 1)

    const totalHi = materiasDelCiclo.reduce(
      (sum, a) => sum + (a.horas_independientes || 0),
      0,
    )
    const totalHp = materiasDelCiclo.reduce(
      (sum, a) => sum + (a.horas_academicas || 0),
      0,
    )
    const totalCreditos = materiasDelCiclo.reduce(
      (sum, a) => sum + (Number(a.creditos) || 0),
      0,
    )

    const listaMaterias = materiasDelCiclo.map((a) => {
      const idPrerrequisito = a.prerrequisito_asignatura_id
      const clavePrerrequisito = idPrerrequisito
        ? mapaClaves[idPrerrequisito] || null
        : null

      return {
        clave: a.codigo,
        nombre: a.nombre,
        clave_prerrequisito: clavePrerrequisito,
        tipo: a.tipo,
        instalacion: (a.datos as any)?.instalacion || 'Aula',
        creditos: Number(a.creditos),
        hi: a.horas_independientes,
        hp: a.horas_academicas,
      }
    })

    const materiasRellenas = [
      ...listaMaterias,
      ...Array(maxMaterias - listaMaterias.length).fill(null),
    ]

    return {
      nombre:
        [
          'Primer',
          'Segundo',
          'Tercer',
          'Cuarto',
          'Quinto',
          'Sexto',
          'Séptimo',
          'Octavo',
          'Noveno',
          'Décimo',
        ][i] || `Ciclo ${i + 1}`,
      creditos: totalCreditos,
      hi: totalHi,
      hp: totalHp,
      materias: materiasRellenas,
    }
  })

  // --- CÁLCULO DE TOTALES GLOBALES ---
  const totalPlanCreditos = semestres.reduce((sum, s) => sum + s.creditos, 0)
  const totalPlanHi = semestres.reduce((sum, s) => sum + s.hi, 0)
  const totalPlanHp = semestres.reduce((sum, s) => sum + s.hp, 0)

  // --- RETORNO DEL JSON FINAL ---
  return {
    nombre_plan: plan.nombre, // Tomado de planes_estudio.nombre
    tipo_ciclo: plan.tipo_ciclo,
    modalidad: 'Presencial', // Valor default solicitado
    semestres,
    lineas_plan: [
      ...new Set(asignaturas.map((a) => a.linea?.nombre).filter(Boolean)),
    ].map((n) => ({ nombre: n })),
    creditos: totalPlanCreditos,
    hi: totalPlanHi,
    hp: totalPlanHp,
    // Estos se usan para el post-procesado de celdas
    config: {
      ciclos: plan.numero_ciclos,
      maxMaterias: maxMaterias,
    },
  }
}
export async function postProcessExcel(
  buffer: Uint8Array,
  config: { ciclos: number; maxMaterias: number },
) {
  const workbook = new Workbook()
  await workbook.xlsx.load(buffer as any)
  const sheet = workbook.getWorksheet('RÍGIDO-Anexo 2 (A)')

  if (!sheet) throw new Error('Hoja no encontrada')

  const { ciclos, maxMaterias } = config

  const matrizAsignaturas = {
    startColumn: 'C',
    numberOfColumns: maxMaterias,
    firstStartRow: 8,
    mergeWidthInColumns: 5,
    mergeHeightInRows: 3,
    mergeBlockCount: ciclos,
    rowStepBetweenBlocks: 14 - 8,
  } as const
  const semestres = {
    startColumn: 'A',
    numberOfColumns: 1,
    firstStartRow: 7,
    mergeWidthInColumns: 1,
    mergeHeightInRows: 5,
    mergeBlockCount: ciclos,
    rowStepBetweenBlocks: 13 - 7,
  } as const
  const clave_materias = {
    startColumn: 'C',
    numberOfColumns: maxMaterias,
    firstStartRow: 7,
    mergeWidthInColumns: 3,
    mergeHeightInRows: 1,
    mergeBlockCount: ciclos,
    columnStepBetweenBlocks: 3,
    rowStepBetweenBlocks: 14 - 8,
  } as const

  const columnWidths = {
    fromColumn: 'I',
    numberOfBlocks: maxMaterias - 1,
    columnStepBetweenBlocks: 5 + 1,
    rowStepBetweenBlocks: 14 - 8,
    widths: [4, 0.25, 4, 7.29, 13.57, 2.43],
  } as const

  applyMergePattern(sheet, matrizAsignaturas)
  applyMergePattern(sheet, semestres)
  applyMergePattern(sheet, clave_materias)
  applyColumnWidthPattern(sheet, columnWidths)

  return await workbook.xlsx.writeBuffer()
}

type PlanContext = {
  plan: Record<string, unknown>
  carrera: Record<string, unknown> | null
  definicion: unknown
  datos: Json
  estructura_id: string
}

async function loadPlanContext(
  supabase: SupabaseClient,
  planEstudioId: string,
): Promise<PlanContext> {
  const { data, error } = await supabase
    .from('planes_estudio')
    .select(
      'nombre, numero_ciclos, tipo_ciclo, datos, estructura_id, carrera:carreras(nombre, nivel, clave_sep), estructura:estructuras_plan(definicion)',
    )
    .eq('id', planEstudioId)
    .maybeSingle()

  if (error) {
    throw new HttpError(
      500,
      'Error consultando el plan de estudios.',
      'DB_ERROR',
      {
        message: error.message,
        details: error.details,
        hint: error.hint,
      },
    )
  }
  if (!data) {
    throw new HttpError(404, 'Plan de estudios no encontrado.', 'NOT_FOUND', {
      plan_estudio_id: planEstudioId,
    })
  }

  const planAny = data as Record<string, unknown>
  const carrera = (planAny.carrera ?? null) as Record<string, unknown> | null
  const estructura = (planAny.estructura ?? null) as Record<
    string,
    unknown
  > | null

  return {
    plan: planAny,
    carrera,
    definicion: estructura?.definicion ?? null,
    datos: data.datos,
    estructura_id: data.estructura_id,
  }
}

/**
 * Arma el objeto `data` del documento de un plan de estudios.
 *
 * SIEMPRE construye el JSON contra la estructura (fuente de verdad): campos
 * siempre incluidos (nombre, nivel, carrera, número de ciclos, tipo de ciclo…)
 * resueltos por su valor canónico, más cada campo declarado en la estructura
 * (`datos[key] ?? null`). Nunca devuelve `{}`.
 */
export async function prepararDatosParaPlan(
  supabase: SupabaseClient,
  planEstudioId: string,
): Promise<unknown> {
  const ctx = await loadPlanContext(supabase, planEstudioId)
  return construirDatos(
    CAMPOS_SIEMPRE_PLAN,
    { plan: ctx.plan, carrera: ctx.carrera },
    ctx.definicion,
    ctx.datos,
  )
}

async function loadTemplateIdForEstructura(
  supabase: SupabaseClient,
  estructuraId: string,
): Promise<string> {
  const { data, error } = await supabase
    .from('estructuras_plan')
    .select('template_id')
    .eq('id', estructuraId)
    .maybeSingle()

  if (error) {
    throw new HttpError(
      500,
      'Error consultando la estructura del plan.',
      'DB_ERROR',
      {
        message: error.message,
        details: error.details,
        hint: error.hint,
      },
    )
  }
  if (!data) {
    throw new HttpError(
      404,
      'Estructura del plan no encontrada.',
      'NOT_FOUND',
      {
        estructura_id: estructuraId,
      },
    )
  }
  if (!data.template_id) {
    throw new HttpError(
      409,
      'La estructura del plan no tiene template_id configurado.',
      'MISSING_TEMPLATE_ID',
      { estructura_id: estructuraId },
    )
  }

  return data.template_id
}

async function loadTemplateIdForAsignatura(
  supabase: SupabaseClient,
  asignaturaId: string,
): Promise<string> {
  const { data, error } = await supabase
    .from('plantilla_asignatura')
    .select('template_id')
    .eq('asignatura_id', asignaturaId)
    .maybeSingle()

  if (error) {
    throw new HttpError(
      500,
      'Error consultando la plantilla de la asignatura.',
      'DB_ERROR',
      {
        message: error.message,
        details: error.details,
        hint: error.hint,
      },
    )
  }
  if (!data) {
    throw new HttpError(404, 'Asignatura no encontrada.', 'NOT_FOUND', {
      asignatura_id: asignaturaId,
    })
  }
  if (!data.template_id) {
    throw new HttpError(
      409,
      'La asignatura no tiene template_id configurado.',
      'MISSING_TEMPLATE_ID',
      { asignatura_id: asignaturaId },
    )
  }

  return data.template_id
}

/**
 * Arma el objeto `data` para el documento de una asignatura.
 *
 * Se hace en la edge function (no en el frontend) para GARANTIZAR que ciertos
 * campos SIEMPRE viajen al documento SEP, aunque la estructura no los declare:
 * contenido temático, sistema de evaluación, bibliografía (básica y
 * complementaria) y el nivel (que vive en la carrera, no en el plan).
 */
export async function prepararDatosParaAsignatura(
  supabase: SupabaseClient,
  asignaturaId: string,
): Promise<Record<string, unknown>> {
  const { data: asig, error } = await supabase
    .from('asignaturas')
    .select(
      '*, plan:planes_estudio(nombre, numero_ciclos, tipo_ciclo, carrera:carreras(nombre, nivel, clave_sep)), estructura:estructuras_asignatura(definicion)',
    )
    .eq('id', asignaturaId)
    .single()

  if (error || !asig) {
    throw new HttpError(404, 'Asignatura no encontrada.', 'NOT_FOUND', {
      asignatura_id: asignaturaId,
      message: error?.message,
    })
  }

  const { data: biblio, error: bibErr } = await supabase
    .from('bibliografia_asignatura')
    .select('tipo, cita, creado_en')
    .eq('asignatura_id', asignaturaId)
    .order('creado_en', { ascending: true })

  if (bibErr) {
    throw new HttpError(500, 'Error consultando la bibliografía.', 'DB_ERROR', {
      message: bibErr.message,
    })
  }

  const bibliografia = biblio ?? []
  const bibliografia_basica = bibliografia
    .filter((b) => b.tipo === 'BASICA')
    .map((b) => b.cita)
  const bibliografia_complementaria = bibliografia
    .filter((b) => b.tipo === 'COMPLEMENTARIA')
    .map((b) => b.cita)

  const asigAny = asig as Record<string, unknown>
  const plan = (asigAny.plan ?? null) as Record<string, unknown> | null
  const carrera = (plan?.carrera ?? null) as Record<string, unknown> | null
  const estructura = (asigAny.estructura ?? null) as Record<
    string,
    unknown
  > | null

  // Fuente de verdad: la estructura. Solo viajan los campos siempre incluidos
  // (resueltos por su valor canónico) más los declarados en la estructura.
  return construirDatos(
    CAMPOS_SIEMPRE_ASIGNATURA,
    {
      asig: asigAny,
      plan,
      carrera,
      bibliografia_basica,
      bibliografia_complementaria,
    },
    estructura?.definicion ?? null,
    asigAny.datos,
  )
}

function ensureCarboneDownload(result: unknown): CarboneDownload {
  if (!(result && typeof result === 'object' && 'buffer' in result)) {
    throw new HttpError(
      502,
      'Respuesta inválida de Carbone.',
      'UPSTREAM_INVALID_RESPONSE',
    )
  }

  const download = result as CarboneDownload
  if (!(download.buffer instanceof Uint8Array)) {
    throw new HttpError(
      502,
      'Respuesta inválida de Carbone.',
      'UPSTREAM_INVALID_RESPONSE',
    )
  }

  return download
}

function downloadToResponse(download: CarboneDownload): Response {
  const headers = new Headers({
    ...corsHeaders,
    'Content-Type':
      download.contentType === 'application/pdf'
        ? 'application/pdf'
        : 'application/octet-stream',
    Connection: 'keep-alive',
  })

  if (download.contentDisposition) {
    headers.set('Content-Disposition', download.contentDisposition)
  }

  const body = new Uint8Array(
    download.buffer.buffer as ArrayBuffer,
    download.buffer.byteOffset,
    download.buffer.byteLength,
  )
  return new Response(body, { status: 200, headers })
}

export async function handleDownloadReportAction(args: {
  bodyUnknown: unknown
  supabase: SupabaseClient
  carboneBaseUrl: string
  carboneApiToken: string
}): Promise<Response> {
  const input: DownloadReportInput = DownloadReportSchema.parse(
    args.bodyUnknown,
  )
  const carbone = new CarboneClient(args.carboneBaseUrl, args.carboneApiToken)

  if ('plan_estudio_id' in input) {
    const { convertTo } = input.body as any
    if (convertTo === 'xlsx') {
      const datosExcel = await prepararDatosParaExcel(
        args.supabase,
        input.plan_estudio_id,
      )

      const result = await carbone.render(
        '1402917575045089616',
        { data: datosExcel },
        { download: true, format: 'xlsx' },
      )

      const processedBuffer = await postProcessExcel(
        result.buffer,
        datosExcel.config,
      )

      return downloadToResponse({
        ...result,
        buffer: processedBuffer as Uint8Array,
      })
    }

    const ctx = await loadPlanContext(args.supabase, input.plan_estudio_id)
    const templateId = await loadTemplateIdForEstructura(
      args.supabase,
      ctx.estructura_id,
    )

    // Mismo constructor determinista que usa previewPayload: campos siempre
    // incluidos + campos de la estructura. Nunca se manda `{}`.
    const data = construirDatos(
      CAMPOS_SIEMPRE_PLAN,
      { plan: ctx.plan, carrera: ctx.carrera },
      ctx.definicion,
      ctx.datos,
    )

    const { data: _ignoredData, ...extraBody } = input.body
    const result = await carbone.render(
      templateId,
      { data, ...extraBody },
      { download: true },
    )

    return downloadToResponse(ensureCarboneDownload(result))
  }

  const templateId = await loadTemplateIdForAsignatura(
    args.supabase,
    input.asignatura_id,
  )

  // La edge function arma los datos desde la BD para garantizar que siempre
  // viajen contenido temático, evaluación, bibliografía y nivel.
  const data = await prepararDatosParaAsignatura(
    args.supabase,
    input.asignatura_id,
  )

  // Permitimos overrides/extra opcionales desde el cliente (p. ej. convertTo),
  // pero ignoramos cualquier `data` que mande para no romper la garantía.
  const { data: _ignoredData, ...extraBody } = input.body as Record<
    string,
    unknown
  >
  const result = await carbone.render(
    templateId,
    { data, ...extraBody },
    { download: true },
  )

  return downloadToResponse(ensureCarboneDownload(result))
}
