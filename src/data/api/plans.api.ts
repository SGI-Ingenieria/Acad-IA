import {
  supabaseBrowser,
  supabaseBrowserParaEscritura,
} from '../supabase/client'
import { invokeEdge } from '../supabase/invokeEdge'

import {
  ApiError,
  buildRange,
  getUserIdOrThrow,
  requireData,
  throwIfError,
} from './_helpers'
import { normalizeAIGenerationReferences } from './aiGenerationReferences'

import type { AIGenerationReferences } from './aiGenerationReferences'
import type { Database, Tables } from '../../types/supabase'
import type {
  Asignatura,
  CambioAsignatura,
  CambioPlan,
  LineaPlan,
  NivelPlanEstudio,
  Paged,
  PlanDatosSep,
  PlanEstudio,
  TipoCiclo,
  TipoEstructuraPlan,
  UUID,
} from '../types/domain'

import { requiereSemanasPorCiclo } from '@/lib/ciclo-utils'
import { isFechaCurricularPasada } from '@/lib/plan-curricular'

const EDGE = {
  plans_create_manual: 'plans_create_manual',
  ai_generate_plan: 'ai-generate-plan',
  plans_persist_from_ai: 'plans_persist_from_ai',
  plans_clone_from_existing: 'plans_clone_from_existing',

  plans_import_from_files: 'plans_import_from_files',

  // plans_update_fields: 'plans_update_fields',
  plans_update_map: 'plans_update_map',
  plans_transition_state: 'plans_transition_state',

  plans_generate_document: 'plans_generate_document',
  plans_get_document: 'plans_get_document',
} as const

export type PlanListFilters = {
  search?: string
  carreraId?: UUID
  facultadId?: UUID // filtra por carreras.facultad_id
  estadoId?: UUID
  activo?: boolean
  nivelFilter?: string // filtra por carreras.nivel
  tipoEstructura?: TipoEstructuraPlan
  catalogMode?: boolean
  sort?: 'creado_desc' | 'actualizado_desc' | 'nombre_asc' | 'nombre_desc'

  limit?: number
  offset?: number
}

export type PlanEstudioListItem = PlanEstudio & {
  puede_abrir_detalle?: boolean
}

type PlanCatalogRpcRow = {
  plan: Record<string, unknown> | null
  carrera: Tables<'carreras'> | null
  facultad: Tables<'facultades'> | null
  estructura_plan: Tables<'estructuras_plan'> | null
  estado_plan: Tables<'estados_plan'> | null
  puede_abrir_detalle: boolean | null
  total_count: number | string | null
}

// Helper para limpiar texto (lo movemos fuera para reutilizar o lo dejas en un utils)
const cleanText = (text: string) => {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

const nullableUuidFilter = (value?: UUID) =>
  value && value !== 'todas' && value !== 'todos' ? value : null

const nullableTextFilter = (value?: string) =>
  value && value !== 'todas' && value !== 'todos' ? value : null

const recalculoVectoresAsignaturasInFlight = new Set<string>()

function jsonObjectRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }
  return {}
}

type HistoryUserRef = {
  nombre_completo: string | null
} | null

export type PlanHistoryItem =
  | (CambioPlan & {
      source: 'plan'
      usuarios_app?: HistoryUserRef
    })
  | (CambioAsignatura & {
      source: 'asignatura'
      plan_estudio_id: UUID
      response_id?: null
      usuarios_app?: HistoryUserRef
      asignaturas?: {
        id: UUID
        nombre: string | null
        codigo: string | null
        plan_estudio_id: UUID
      } | null
    })

export type PlanRegistroOficialInput = {
  claveSep: string
  numeroAcuerdo: string
  autoridad?: string | null
  fechaAprobacion: string
  vigenciaInicio: string
  vigenciaFin?: string | null
  documentoArchivoId?: UUID | null
  documentoBucket?: string | null
  documentoPath?: string | null
  documentoNombre?: string | null
  documentoMime?: string | null
  documentoSize?: number | null
  documentoUrl?: string | null
  observaciones?: string | null
}

export type PlanRegistroOficial = Tables<'registros_oficiales_plan'>

export type PlanRegistroOficialDetalle =
  Tables<'registros_oficiales_plan_detalle'>

function normalizeRegistroOficialInput(input: PlanRegistroOficialInput) {
  return {
    clave_sep: input.claveSep.trim(),
    numero_acuerdo: input.numeroAcuerdo.trim(),
    autoridad: input.autoridad?.trim() || 'SEP',
    fecha_aprobacion: input.fechaAprobacion,
    vigencia_inicio: input.vigenciaInicio,
    vigencia_fin: input.vigenciaFin || null,
    documento_archivo_id: input.documentoArchivoId || null,
    documento_bucket: input.documentoBucket?.trim() || 'documentos-oficiales',
    documento_path: input.documentoPath?.trim() || null,
    documento_nombre: input.documentoNombre?.trim() || null,
    documento_mime: input.documentoMime?.trim() || null,
    documento_size:
      typeof input.documentoSize === 'number' ? input.documentoSize : null,
    documento_url: input.documentoUrl?.trim() || null,
    observaciones: input.observaciones?.trim() || null,
  }
}

function triggerRecalculoVectoresAsignaturasNonBlocking(
  supabase: ReturnType<typeof supabaseBrowser>,
  planId: UUID,
) {
  const key = String(planId)
  if (recalculoVectoresAsignaturasInFlight.has(key)) return

  recalculoVectoresAsignaturasInFlight.add(key)

  void (async () => {
    const { error } = await supabase.rpc('recalcular_vectores_asignaturas')
    if (error) {
      // No debe bloquear ni romper el flujo principal.
      console.warn(
        '[recalcular_vectores_asignaturas] RPC error:',
        error.message,
      )
    }
  })()
    .catch((err: unknown) => {
      console.warn('[recalcular_vectores_asignaturas] RPC failed:', err)
    })
    .finally(() => {
      recalculoVectoresAsignaturasInFlight.delete(key)
    })
}

export async function plans_list(
  filters: PlanListFilters = {},
): Promise<Paged<PlanEstudioListItem>> {
  if (filters.catalogMode) {
    return plans_catalog_list(filters)
  }

  const supabase = supabaseBrowser()

  // 1. Construimos la query base
  // NOTA IMPORTANTE: Para filtrar planes basados en facultad (que está en carreras),
  // necesitamos hacer un INNER JOIN. En Supabase se usa "!inner".
  // Si filters.facultadId existe, forzamos el inner join, si no, lo dejamos normal.

  const needsInnerJoin =
    (filters.facultadId && filters.facultadId !== 'todas') ||
    (filters.nivelFilter && filters.nivelFilter !== 'todos')

  const carreraModifier = needsInnerJoin ? '!inner' : ''
  const estructuraModifier = filters.tipoEstructura ? '!inner' : ''

  let q = supabase.from('planes_estudio').select(
    `
      *,
      carreras${carreraModifier} (
        *,
        facultades (*)
      ),
      estructuras_plan!planes_estudio_estructura_id_fkey${estructuraModifier} (*),
      estados_plan (*)
      `,
    { count: 'exact' },
  )

  switch (filters.sort) {
    case 'actualizado_desc':
      q = q.order('actualizado_en', { ascending: false })
      break
    case 'nombre_asc':
      q = q.order('nombre_search', { ascending: true })
      break
    case 'nombre_desc':
      q = q.order('nombre_search', { ascending: false })
      break
    default:
      q = q.order('creado_en', { ascending: false })
  }
  q = q.order('id', { ascending: true })

  // 2. Aplicamos filtros dinámicos

  // SOLUCIÓN SEARCH: Limpiamos el input y buscamos en la columna generada
  if (filters.search?.trim()) {
    const cleanTerm = cleanText(filters.search.trim())
    // Usamos la columna nueva creada en el Paso 1
    q = q.ilike('nombre_search', `%${cleanTerm}%`)
  }

  if (filters.carreraId && filters.carreraId !== 'todas') {
    q = q.eq('carrera_id', filters.carreraId)
  }

  if (filters.estadoId && filters.estadoId !== 'todos') {
    q = q.eq('estado_actual_id', filters.estadoId)
  }

  if (typeof filters.activo === 'boolean') {
    q = q.eq('activo', filters.activo)
  }

  // Filtro por facultad (gracias al !inner arriba, esto filtrará los planes)
  if (filters.facultadId && filters.facultadId !== 'todas') {
    q = q.eq('carreras.facultad_id', filters.facultadId)
  }

  if (filters.nivelFilter && filters.nivelFilter !== 'todos') {
    q = q.eq(
      'carreras.nivel',
      filters.nivelFilter as
        | 'Licenciatura'
        | 'Maestría'
        | 'Doctorado'
        | 'Especialidad'
        | 'Diplomado'
        | 'Otro',
    )
  }

  if (filters.tipoEstructura) {
    q = q.eq('estructuras_plan.tipo', filters.tipoEstructura)
  }

  // 3. Paginación
  const { from, to } = buildRange(filters.limit, filters.offset)
  if (from !== undefined && to !== undefined) q = q.range(from, to)

  const { data, error, count } = await q
  throwIfError(error)

  return {
    // 1. Si data es null, usa [].
    // 2. Luego dile a TS que el resultado es tu Array tipado.
    data: (data ?? []) as unknown as Array<PlanEstudioListItem>,
    count: count ?? 0,
  }
}

async function plans_catalog_list(
  filters: PlanListFilters,
): Promise<Paged<PlanEstudioListItem>> {
  const supabase = supabaseBrowser()
  const { data, error } = await (supabase.rpc as any)(
    'planes_catalogo_buscar',
    {
      p_search: filters.search?.trim() || null,
      p_facultad_id: nullableUuidFilter(filters.facultadId),
      p_carrera_id: nullableUuidFilter(filters.carreraId),
      p_estado_id: nullableUuidFilter(filters.estadoId),
      p_nivel: nullableTextFilter(filters.nivelFilter),
      p_tipo_estructura: filters.tipoEstructura ?? null,
      p_activo: filters.activo ?? null,
      p_sort: filters.sort ?? 'creado_desc',
      p_limit: filters.limit ?? 50,
      p_offset: filters.offset ?? 0,
    },
  )
  throwIfError(error)

  const rows = (data ?? []) as Array<PlanCatalogRpcRow>
  const mapped = rows
    .map((row) => {
      if (!row.plan) return null

      const carrera = row.carrera
        ? { ...row.carrera, facultades: row.facultad ?? null }
        : null

      return {
        ...row.plan,
        carreras: carrera,
        estructuras_plan: row.estructura_plan ?? null,
        estados_plan: row.estado_plan ?? null,
        puede_abrir_detalle: row.puede_abrir_detalle === true,
      } as unknown as PlanEstudioListItem
    })
    .filter(Boolean) as Array<PlanEstudioListItem>

  return {
    data: mapped,
    count: rows.length > 0 ? Number(rows[0].total_count ?? 0) : 0,
  }
}

/**
 * Devuelve los ids de estado que realmente están presentes entre los planes
 * accesibles (respetando el alcance facultad/carrera/nivel, pero ignorando el
 * propio filtro de estado y la paginación). Sirve para que el desplegable de
 * "Estado" sólo ofrezca los estados que el usuario tiene, no el catálogo
 * completo. La exclusión de FALLIDO se hace en el cliente con el catálogo.
 */
export async function plans_estados_disponibles(
  filters: PlanListFilters = {},
): Promise<Array<UUID>> {
  const supabase = supabaseBrowser()

  if (filters.catalogMode) {
    const { data, error } = await (supabase.rpc as any)(
      'planes_catalogo_buscar',
      {
        p_search: null,
        p_facultad_id: nullableUuidFilter(filters.facultadId),
        p_carrera_id: nullableUuidFilter(filters.carreraId),
        p_estado_id: null,
        p_nivel: nullableTextFilter(filters.nivelFilter),
        p_tipo_estructura: filters.tipoEstructura ?? null,
        p_activo: filters.activo ?? null,
        p_sort: 'creado_desc',
        p_limit: 1000,
        p_offset: 0,
      },
    )
    throwIfError(error)

    const ids = new Set<UUID>()
    for (const row of (data ?? []) as Array<PlanCatalogRpcRow>) {
      const estadoId =
        row.estado_plan?.id ??
        (row.plan as { estado_actual_id?: UUID | null } | null)
          ?.estado_actual_id ??
        null
      if (estadoId) ids.add(estadoId)
    }
    return Array.from(ids)
  }

  const needsInnerJoin =
    (filters.facultadId && filters.facultadId !== 'todas') ||
    (filters.nivelFilter && filters.nivelFilter !== 'todos')

  let q = supabase
    .from('planes_estudio')
    .select(
      needsInnerJoin
        ? 'estado_actual_id, carreras!inner (facultad_id, nivel)'
        : 'estado_actual_id',
    )

  if (filters.carreraId && filters.carreraId !== 'todas') {
    q = q.eq('carrera_id', filters.carreraId)
  }

  if (filters.facultadId && filters.facultadId !== 'todas') {
    q = q.eq('carreras.facultad_id', filters.facultadId)
  }

  if (filters.nivelFilter && filters.nivelFilter !== 'todos') {
    q = q.eq(
      'carreras.nivel',
      filters.nivelFilter as
        | 'Licenciatura'
        | 'Maestría'
        | 'Doctorado'
        | 'Especialidad'
        | 'Diplomado'
        | 'Otro',
    )
  }

  const { data, error } = await q
  throwIfError(error)

  const ids = new Set<UUID>()
  for (const row of data ?? []) {
    const id = (row as { estado_actual_id?: UUID | null }).estado_actual_id
    if (id) ids.add(id)
  }
  return Array.from(ids)
}

export async function plans_get(planId: UUID): Promise<PlanEstudio> {
  console.log('plans_get')

  const supabase = supabaseBrowser()

  const { data, error } = await supabase
    .from('planes_estudio')
    .select(
      `
      *,
      carreras (*, facultades(*)),
      estructuras_plan!planes_estudio_estructura_id_fkey (*),
      estados_plan (*)
    `,
    )
    .eq('id', planId)
    .single()

  throwIfError(error)
  return requireData(data, 'Plan no encontrado.')
}

export async function plan_registro_oficial_get(
  planId: UUID,
): Promise<PlanRegistroOficial | null> {
  const supabase = supabaseBrowser()
  const { data, error } = await supabase
    .from('registros_oficiales_plan')
    .select('*')
    .eq('plan_estudio_id', planId)
    .maybeSingle()

  throwIfError(error)
  return data ?? null
}

export async function plan_registro_oficial_upsert(input: {
  planId: UUID
  registro: PlanRegistroOficialInput
}): Promise<PlanRegistroOficial> {
  const supabase = supabaseBrowser()
  const userId = await getUserIdOrThrow(supabase)
  const now = new Date().toISOString()

  const { data, error } = await supabase
    .from('registros_oficiales_plan')
    .upsert(
      {
        plan_estudio_id: input.planId,
        ...normalizeRegistroOficialInput(input.registro),
        registrado_por: userId,
        actualizado_por: userId,
        actualizado_en: now,
      },
      { onConflict: 'plan_estudio_id' },
    )
    .select('*')
    .single()

  throwIfError(error)
  return data as PlanRegistroOficial
}

export async function registros_oficiales_list(): Promise<
  Array<PlanRegistroOficialDetalle>
> {
  const supabase = supabaseBrowser()
  const { data, error } = await supabase
    .from('registros_oficiales_plan_detalle')
    .select('*')
    .eq('estado_clave', 'APROBADO')
    .order('fecha_aprobacion', { ascending: false })
    .order('actualizado_en', { ascending: false })

  throwIfError(error)
  return data ?? []
}

/**
 * Variante de `plans_get` que NO lanza si no existe (devuelve null).
 * Útil para flujos de polling donde el plan puede tardar en aparecer.
 */
export async function plans_get_maybe(
  planId: UUID,
): Promise<PlanEstudio | null> {
  const supabase = supabaseBrowser()

  const { data, error } = await supabase
    .from('planes_estudio')
    .select(
      `
      *,
      carreras (*, facultades(*)),
      estructuras_plan!planes_estudio_estructura_id_fkey (*),
      estados_plan (*)
    `,
    )
    .eq('id', planId)
    .maybeSingle()

  throwIfError(error)
  return data ?? null
}

export async function plans_delete(planId: UUID): Promise<{ id: UUID }> {
  const supabase = supabaseBrowser()

  const { data, error } = await supabase
    .from('planes_estudio')
    .delete()
    .eq('id', planId)
    .select('id')
    .maybeSingle()

  throwIfError(error)

  // Si por alguna razón no retorna fila (RLS / triggers), devolvemos el id solicitado.
  return { id: ((data as any)?.id ?? planId) as UUID }
}

export async function plan_lineas_list(
  planId: UUID,
): Promise<Array<LineaPlan>> {
  const supabase = supabaseBrowser()
  const { data, error } = await supabase
    .from('lineas_plan')
    .select(
      'id,plan_estudio_id,nombre,orden,area,creado_en,creado_por,actualizado_en,actualizado_por,color',
    )
    .eq('plan_estudio_id', planId)
    .order('orden', { ascending: true })

  throwIfError(error)
  return data || []
}

export async function plan_asignaturas_list(
  planId: UUID,
  conjunto: 'activas' | 'archivadas' = 'activas',
): Promise<Array<Asignatura>> {
  const supabase = supabaseBrowser()
  let query = supabase
    .from('asignaturas')
    .select(
      'id,plan_estudio_id,horas_academicas,horas_independientes,estructura_id,codigo,nombre,tipo,creditos,numero_ciclo,linea_plan_id,orden_celda,estado,datos,contenido_tematico,criterios_de_evaluacion,asignatura_hash,tipo_origen,meta_origen,creado_por,actualizado_por,creado_en,actualizado_en,prerrequisito_asignatura_id,search_vector',
    )
    .eq('plan_estudio_id', planId)

  query =
    conjunto === 'archivadas'
      ? query.eq('estado', 'archivada')
      : query.neq('estado', 'archivada')

  const { data, error } = await query
    .order('numero_ciclo', { ascending: true, nullsFirst: false })
    .order('orden_celda', { ascending: true, nullsFirst: false })
    .order('nombre', { ascending: true })

  throwIfError(error)

  // No bloqueante: si el primer registro viene sin vector, dispara el recalculo.
  const first: any = (data as any)?.[0]
  if (first && first.search_vector === null) {
    triggerRecalculoVectoresAsignaturasNonBlocking(supabase, planId)
  }

  return data ?? []
}

/** Cambios por página del historial del plan (la UI agrupa por categoría). */
export const PLAN_HISTORY_PAGE_SIZE = 12

export async function plans_history(
  planId: UUID,
  page: number = 0,
  pageSize: number = PLAN_HISTORY_PAGE_SIZE,
): Promise<{ data: Array<PlanHistoryItem>; count: number }> {
  const supabase = supabaseBrowser()
  const from = page * pageSize
  const to = from + pageSize - 1
  const sourceTo = Math.max(to, pageSize - 1)

  const [planChanges, subjectChanges] = await Promise.all([
    supabase
      .from('cambios_plan')
      .select(
        'id,plan_estudio_id,cambiado_por,cambiado_en,tipo,campo,valor_anterior,valor_nuevo,response_id,fuente,interaccion_ia_id,agente_sesion_id,agente_contexto,usuarios_app:cambiado_por(nombre_completo)',
        { count: 'exact' },
      )
      .eq('plan_estudio_id', planId)
      .order('cambiado_en', { ascending: false })
      .range(0, sourceTo),
    supabase
      .from('cambios_asignatura')
      .select(
        'id,asignatura_id,cambiado_por,cambiado_en,tipo,campo,valor_anterior,valor_nuevo,fuente,interaccion_ia_id,agente_sesion_id,agente_contexto,usuarios_app:cambiado_por(nombre_completo),asignaturas!inner(id,nombre,codigo,plan_estudio_id)',
        { count: 'exact' },
      )
      .eq('asignaturas.plan_estudio_id', planId)
      .order('cambiado_en', { ascending: false })
      .range(0, sourceTo),
  ])

  throwIfError(planChanges.error)
  throwIfError(subjectChanges.error)

  const planItems = (planChanges.data ?? []).map((item) => ({
    ...item,
    source: 'plan' as const,
  }))

  const subjectItems = (subjectChanges.data ?? []).map((item: any) => ({
    ...item,
    source: 'asignatura' as const,
    plan_estudio_id: item.asignaturas?.plan_estudio_id ?? planId,
    response_id: null,
  }))

  const data = [...planItems, ...subjectItems]
    .sort((a, b) => {
      const timeDiff =
        new Date(b.cambiado_en).getTime() - new Date(a.cambiado_en).getTime()
      if (timeDiff !== 0) return timeDiff
      return String(b.id).localeCompare(String(a.id))
    })
    .slice(from, to + 1) as Array<PlanHistoryItem>

  return {
    data,
    count: (planChanges.count ?? 0) + (subjectChanges.count ?? 0),
  }
}

/**
 * Un día natural del historial. La paginación por bloques de N cambios partía
 * un mismo día entre dos páginas y mezclaba dos días en una, así que la fecha
 * no podía encabezar nada; paginando por día, la página *es* el día.
 */
export type PlanHistoryDay = { dia: string; total: number }

/** Techo de marcas leídas para construir el índice de días. */
const PLAN_HISTORY_DAYS_SCAN = 2000

/** `yyyy-MM-dd` en la zona del navegador: el día es el del usuario. */
function claveDiaLocal(iso: string): string {
  const fecha = new Date(iso)
  const mes = String(fecha.getMonth() + 1).padStart(2, '0')
  const dia = String(fecha.getDate()).padStart(2, '0')
  return `${fecha.getFullYear()}-${mes}-${dia}`
}

export async function plans_history_days(
  planId: UUID,
): Promise<Array<PlanHistoryDay>> {
  const supabase = supabaseBrowser()

  const [planChanges, subjectChanges] = await Promise.all([
    supabase
      .from('cambios_plan')
      .select('cambiado_en')
      .eq('plan_estudio_id', planId)
      .order('cambiado_en', { ascending: false })
      .limit(PLAN_HISTORY_DAYS_SCAN),
    supabase
      .from('cambios_asignatura')
      .select('cambiado_en,asignaturas!inner(plan_estudio_id)')
      .eq('asignaturas.plan_estudio_id', planId)
      .order('cambiado_en', { ascending: false })
      .limit(PLAN_HISTORY_DAYS_SCAN),
  ])

  throwIfError(planChanges.error)
  throwIfError(subjectChanges.error)

  const totalPorDia = new Map<string, number>()
  for (const fila of [
    ...(planChanges.data ?? []),
    ...(subjectChanges.data ?? []),
  ]) {
    const dia = claveDiaLocal(fila.cambiado_en)
    totalPorDia.set(dia, (totalPorDia.get(dia) ?? 0) + 1)
  }

  return Array.from(totalPorDia, ([dia, total]) => ({ dia, total })).sort(
    (a, b) => b.dia.localeCompare(a.dia),
  )
}

/**
 * Todos los cambios de un día natural. No se pagina dentro del día: si un día
 * tuviera cientos de cambios seguiría siendo una sola lectura de esa fecha, que
 * es la unidad que el usuario reconoce.
 */
export async function plans_history_day(
  planId: UUID,
  dia: string,
): Promise<Array<PlanHistoryItem>> {
  const supabase = supabaseBrowser()

  // El día se interpreta en la zona del navegador y se traduce a instantes
  // absolutos para la consulta; `timestamptz` compara en UTC.
  const desde = new Date(`${dia}T00:00:00`)
  const hasta = new Date(desde)
  hasta.setDate(hasta.getDate() + 1)
  const desdeIso = desde.toISOString()
  const hastaIso = hasta.toISOString()

  const [planChanges, subjectChanges] = await Promise.all([
    supabase
      .from('cambios_plan')
      .select(
        'id,plan_estudio_id,cambiado_por,cambiado_en,tipo,campo,valor_anterior,valor_nuevo,response_id,fuente,interaccion_ia_id,agente_sesion_id,agente_contexto,usuarios_app:cambiado_por(nombre_completo)',
      )
      .eq('plan_estudio_id', planId)
      .gte('cambiado_en', desdeIso)
      .lt('cambiado_en', hastaIso)
      .order('cambiado_en', { ascending: false }),
    supabase
      .from('cambios_asignatura')
      .select(
        'id,asignatura_id,cambiado_por,cambiado_en,tipo,campo,valor_anterior,valor_nuevo,fuente,interaccion_ia_id,agente_sesion_id,agente_contexto,usuarios_app:cambiado_por(nombre_completo),asignaturas!inner(id,nombre,codigo,plan_estudio_id)',
      )
      .eq('asignaturas.plan_estudio_id', planId)
      .gte('cambiado_en', desdeIso)
      .lt('cambiado_en', hastaIso)
      .order('cambiado_en', { ascending: false }),
  ])

  throwIfError(planChanges.error)
  throwIfError(subjectChanges.error)

  const planItems = (planChanges.data ?? []).map((item) => ({
    ...item,
    source: 'plan' as const,
  }))

  const subjectItems = (subjectChanges.data ?? []).map((item: any) => ({
    ...item,
    source: 'asignatura' as const,
    plan_estudio_id: item.asignaturas?.plan_estudio_id ?? planId,
    response_id: null,
  }))

  return [...planItems, ...subjectItems].sort((a, b) => {
    const timeDiff =
      new Date(b.cambiado_en).getTime() - new Date(a.cambiado_en).getTime()
    if (timeDiff !== 0) return timeDiff
    return String(b.id).localeCompare(String(a.id))
  }) as Array<PlanHistoryItem>
}

/** Wizard: crear plan manual (Edge Function) */
export type PlansCreateManualInput = {
  carreraId: UUID
  estructuraId: UUID
  nombre?: string
  nombrePropuesto?: string | null
  fechaInicioImparticion?: string | null
  confirmarFechaPasada?: boolean
  estructuraRecomendadaId?: UUID | null
  motivoEstructuraManual?: string | null
  nivel: NivelPlanEstudio
  tipoCiclo: TipoCiclo
  numCiclos: number
  /** Obligatoria con `tipoCiclo === 'Otro'`; ignorada en cualquier otro tipo. */
  semanasPorCiclo?: number | null
  datos?: Partial<PlanDatosSep> & Record<string, any>
  lineas?: Array<{
    nombre: string
    orden: number
    area?: string
    color?: string | null
  }>
}

/**
 * Semanas que se guardan para un plan.
 *
 * La base de datos acepta el nulo —hay planes históricos con ciclos «Otro» sin
 * medir— así que la regla se aplica aquí, que es donde sí se conoce el dato:
 * un ciclo «Otro» sin duración no se puede convertir en carga horaria, y un
 * semestre con semanas sueltas guardaría una duración que nadie declaró.
 */
function resolverSemanasPorCiclo(
  tipoCiclo: TipoCiclo,
  semanasPorCiclo: number | null | undefined,
): number | null {
  if (!requiereSemanasPorCiclo(tipoCiclo)) return null
  if (!semanasPorCiclo) {
    throw new ApiError(
      'Indica cuántas semanas dura cada ciclo cuando el tipo de ciclo es «Otro».',
      'SEMANAS_POR_CICLO_REQUERIDAS',
    )
  }
  return semanasPorCiclo
}

async function resolverEstructuraPlan(
  supabase: ReturnType<typeof supabaseBrowser>,
  estructuraId: UUID,
) {
  const { data, error } = await supabase
    .from('estructuras_plan')
    .select('id, tipo')
    .eq('id', estructuraId)
    .single()
  throwIfError(error)
  return data
}

export async function plans_create_manual(
  input: PlansCreateManualInput,
): Promise<PlanEstudio> {
  const supabase = supabaseBrowser()
  const userId = await getUserIdOrThrow(supabase)

  const estructura = await resolverEstructuraPlan(supabase, input.estructuraId)
  const esCurricular = estructura?.tipo === 'CURRICULAR'

  // Antes de tocar nada: esta función escribe el nivel en la carrera antes de
  // insertar el plan, y una validación tardía dejaría ese cambio suelto.
  const semanasPorCiclo = resolverSemanasPorCiclo(
    input.tipoCiclo,
    input.semanasPorCiclo,
  )

  // 1. Obtener estado 'BORRADOR'
  const { data: estado, error: estadoError } = await supabase
    .from('estados_plan')
    .select('id,clave,orden')
    .ilike('clave', 'BORRADOR%')
    .order('orden', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (estadoError) {
    throw new Error(estadoError.message)
  }

  // 2. Guardar el nivel en la carrera, que ahora es la fuente de verdad.
  const { error: carreraError } = await supabase
    .from('carreras')
    .update({
      nivel: input.nivel,
      actualizado_en: new Date().toISOString(),
      actualizado_por: userId,
    })
    .eq('id', input.carreraId)

  if (carreraError) {
    throw new Error(carreraError.message)
  }

  const nombrePropuesto = (input.nombrePropuesto ?? input.nombre ?? '').trim()
  let nombreLegacy: string | null = nombrePropuesto || null
  let nombrePropuestoInsert: string | null = nombrePropuesto || null
  let fechaInicioImparticion: string | null = null

  if (esCurricular) {
    if (!input.fechaInicioImparticion) {
      throw new ApiError(
        'Los planes con estructura CURRICULAR requieren inicio de impartición.',
      )
    }

    if (
      isFechaCurricularPasada(input.fechaInicioImparticion) &&
      !input.confirmarFechaPasada
    ) {
      throw new ApiError(
        'El inicio de impartición es anterior al mes actual. Confirma que deseas continuar con una carga histórica o regularización.',
        'FECHA_PASADA_SIN_CONFIRMAR',
      )
    }

    nombreLegacy = null
    nombrePropuestoInsert = null
    fechaInicioImparticion = input.fechaInicioImparticion
  } else if (!nombrePropuesto) {
    throw new ApiError('El nombre propuesto del plan es requerido.')
  }

  // 3. Preparar insert
  const planInsert: Database['public']['Tables']['planes_estudio']['Insert'] & {
    estructura_recomendada_id?: string | null
    seleccion_estructura?: 'AUTOMATICA' | 'MANUAL'
    motivo_estructura_manual?: string | null
    fase_diseno?: 'FUNDAMENTOS'
  } = {
    activo: true,
    actualizado_en: new Date().toISOString(),
    carrera_id: input.carreraId,
    creado_en: new Date().toISOString(),
    datos: input.datos || {},
    estado_actual_id: estado?.id || null,
    estructura_id: input.estructuraId,
    nombre: nombreLegacy,
    nombre_display: nombrePropuesto || input.nombre || 'Plan de estudios',
    nombre_propuesto: nombrePropuestoInsert,
    numero_ciclos: input.numCiclos,
    tipo_ciclo: input.tipoCiclo,
    semanas_por_ciclo: semanasPorCiclo,
    tipo_origen: 'MANUAL',
    creado_por: userId,
    estructura_recomendada_id: input.estructuraRecomendadaId ?? null,
    seleccion_estructura:
      input.estructuraRecomendadaId &&
      input.estructuraRecomendadaId !== input.estructuraId
        ? 'MANUAL'
        : 'AUTOMATICA',
    motivo_estructura_manual:
      input.estructuraRecomendadaId &&
      input.estructuraRecomendadaId !== input.estructuraId
        ? input.motivoEstructuraManual?.trim() || null
        : null,
    fase_diseno: 'FUNDAMENTOS',
  }

  if (fechaInicioImparticion) {
    planInsert.fecha_inicio_imparticion = fechaInicioImparticion
  }

  // 4. Insertar
  const { data: nuevoPlan, error: planError } = await supabase
    .from('planes_estudio')
    .insert([
      planInsert as unknown as Database['public']['Tables']['planes_estudio']['Insert'],
    ])
    .select(
      `
      *,
      carreras (*, facultades(*)),
      estructuras_plan!planes_estudio_estructura_id_fkey (*),
      estados_plan (*)
      `,
    )
    .single()

  if (planError) {
    throw new Error(planError.message)
  }

  if (input.lineas && input.lineas.length > 0) {
    const lineasInsert = input.lineas.map((linea) => ({
      ...linea,
      plan_estudio_id: (nuevoPlan as any).id,
      creado_por: userId,
    }))

    const { error: lineasError } = await supabase
      .from('lineas_plan')
      .insert(lineasInsert)

    if (lineasError) {
      throw new Error(lineasError.message)
    }
  }

  return nuevoPlan
}

/** Wizard: IA genera preview JSON (Edge Function) */
export type AIGeneratePlanInput = {
  clonacionPlan?: boolean
  datosBasicos: {
    nombrePlan?: string
    fechaInicioImparticion?: string | null
    confirmarFechaPasada?: boolean
    carreraId?: UUID
    facultadId?: UUID
    nivel?: string
    tipoCiclo?: TipoCiclo
    numCiclos?: number
    /** Obligatoria con `tipoCiclo === 'Otro'`; ignorada en cualquier otro tipo. */
    semanasPorCiclo?: number | null
    estructuraPlanId: UUID
    estructuraRecomendadaId?: UUID | null
    motivoEstructuraManual?: string | null
  }
  iaConfig: {
    descripcionEnfoqueAcademico?: string
    instruccionesAdicionalesIA?: string
    references?: AIGenerationReferences
    webSearchEnabled?: boolean
    reasoningEffort?: 'auto' | 'none' | 'low' | 'medium' | 'high'
    briefCurricular?: Record<string, unknown>
    borradorDisenoId?: UUID | null
  }
  lineas?: Array<{
    nombre: string
    orden: number
    area?: string
    color?: string | null
  }>
  /**
   * Qué genera la IA además del plan. El servidor normaliza las dependencias
   * entre opciones (`ai-generate-plan/alcance.ts`), así que aquí basta con
   * enviar lo que el usuario marcó.
   */
  alcance?: AlcanceGeneracionPlan
}

/** Opciones de generación del wizard de plan con IA. */
export type AlcanceGeneracionPlan = {
  lineasCurriculares: boolean
  asignaturas: boolean
  acomodarAsignaturas: boolean
  ordenarAsignaturas: boolean
  horasAsignaturas: boolean
  bibliografia: boolean
}

export function buildAIGeneratePlanFormData(
  input: AIGeneratePlanInput,
): FormData {
  const references = normalizeAIGenerationReferences(input.iaConfig.references)
  const edgeFunctionBody = new FormData()
  edgeFunctionBody.append('datosBasicos', JSON.stringify(input.datosBasicos))
  edgeFunctionBody.append(
    'iaConfig',
    JSON.stringify({
      descripcionEnfoqueAcademico: input.iaConfig.descripcionEnfoqueAcademico,
      instruccionesAdicionalesIA: input.iaConfig.instruccionesAdicionalesIA,
      references,
      webSearchEnabled: input.iaConfig.webSearchEnabled ?? false,
      reasoningEffort: input.iaConfig.reasoningEffort ?? 'auto',
      briefCurricular: input.iaConfig.briefCurricular,
      borradorDisenoId: input.iaConfig.borradorDisenoId,
    }),
  )
  if (typeof input.lineas !== 'undefined') {
    edgeFunctionBody.append('lineas', JSON.stringify(input.lineas))
  }
  if (typeof input.alcance !== 'undefined') {
    edgeFunctionBody.append('alcance', JSON.stringify(input.alcance))
  }
  if (typeof input.clonacionPlan !== 'undefined') {
    edgeFunctionBody.append(
      'clonacionPlan',
      String(Boolean(input.clonacionPlan)),
    )
  }
  return edgeFunctionBody
}

export async function ai_generate_plan(
  input: AIGeneratePlanInput,
): Promise<any> {
  return invokeEdge<any>(
    EDGE.ai_generate_plan,
    buildAIGeneratePlanFormData(input),
    undefined,
    supabaseBrowser(),
  )
}

export async function plans_persist_from_ai(payload: {
  jsonPlan: any
}): Promise<PlanEstudio> {
  return invokeEdge<PlanEstudio>(EDGE.plans_persist_from_ai, payload)
}

export async function plans_clone_from_existing(payload: {
  planOrigenId: UUID
  overrides: Partial<
    Pick<
      PlanEstudio,
      | 'nombre'
      | 'nombre_propuesto'
      | 'tipo_ciclo'
      | 'numero_ciclos'
      | 'semanas_por_ciclo'
    >
  > & {
    nivel?: NivelPlanEstudio
    carrera_id?: UUID
    estructura_id?: UUID
    fechaInicioImparticion?: string | null
    confirmarFechaPasada?: boolean
    datos?: Partial<PlanDatosSep> & Record<string, any>
  }
}): Promise<PlanEstudio> {
  const supabase = supabaseBrowser()
  const userId = await getUserIdOrThrow(supabase)
  const now = new Date().toISOString()

  const source = await plans_get(payload.planOrigenId)
  const targetCarreraId = payload.overrides.carrera_id ?? source.carrera_id
  const targetEstructuraId =
    payload.overrides.estructura_id ?? source.estructura_id

  const targetEstructura = await resolverEstructuraPlan(
    supabase,
    targetEstructuraId,
  )
  const esCurricular = targetEstructura?.tipo === 'CURRICULAR'

  if (payload.overrides.nivel !== undefined) {
    const { error: carreraError } = await supabase
      .from('carreras')
      .update({
        nivel: payload.overrides.nivel,
        actualizado_en: now,
        actualizado_por: userId,
      })
      .eq('id', targetCarreraId)

    throwIfError(carreraError)
  }

  const { data: estado, error: estadoError } = await supabase
    .from('estados_plan')
    .select('id,clave,orden')
    .ilike('clave', 'BORRADOR%')
    .order('orden', { ascending: true })
    .limit(1)
    .maybeSingle()

  throwIfError(estadoError)

  const sourceDisplayName = source.nombre_display || 'Plan sin nombre'
  const nombrePropuesto = String(
    payload.overrides.nombre_propuesto ??
      payload.overrides.nombre ??
      `${sourceDisplayName} (copia)`,
  ).trim()
  let nombreLegacy: string | null = nombrePropuesto || null
  let nombrePropuestoInsert: string | null = nombrePropuesto || null
  let fechaInicioImparticion: string | null = null

  if (esCurricular) {
    if (!payload.overrides.fechaInicioImparticion) {
      throw new ApiError(
        'Los planes con estructura CURRICULAR requieren inicio de impartición.',
      )
    }

    if (
      isFechaCurricularPasada(payload.overrides.fechaInicioImparticion) &&
      !payload.overrides.confirmarFechaPasada
    ) {
      throw new ApiError(
        'El inicio de impartición es anterior al mes actual. Confirma que deseas continuar con una carga histórica o regularización.',
        'FECHA_PASADA_SIN_CONFIRMAR',
      )
    }

    nombreLegacy = null
    nombrePropuestoInsert = null
    fechaInicioImparticion = payload.overrides.fechaInicioImparticion
  } else if (!nombrePropuesto) {
    throw new ApiError('El nombre propuesto del plan es requerido.')
  }

  const tipoCicloClon = payload.overrides.tipo_ciclo ?? source.tipo_ciclo

  const cloneInsert: Database['public']['Tables']['planes_estudio']['Insert'] =
    {
      activo: true,
      actualizado_en: now,
      actualizado_por: userId,
      carrera_id: targetCarreraId,
      creado_en: now,
      creado_por: userId,
      datos: payload.overrides.datos ?? source.datos ?? {},
      estado_actual_id: estado?.id ?? null,
      estructura_id: targetEstructuraId,
      meta_origen: {
        tipo: 'CLONADO_INTERNO',
        plan_origen_id: source.id,
      },
      nombre: nombreLegacy,
      nombre_display:
        nombrePropuesto || sourceDisplayName || 'Plan de estudios',
      nombre_propuesto: nombrePropuestoInsert,
      numero_ciclos: payload.overrides.numero_ciclos ?? source.numero_ciclos,
      tipo_ciclo: tipoCicloClon,
      // La duración se arrastra sólo si el clon sigue teniendo ciclos «Otro».
      // No se exige aquí —a diferencia de la creación— porque el origen puede
      // ser un plan antiguo sin medir y eso no debe impedir clonarlo.
      semanas_por_ciclo: requiereSemanasPorCiclo(tipoCicloClon)
        ? (payload.overrides.semanas_por_ciclo ?? source.semanas_por_ciclo)
        : null,
      tipo_origen: 'CLONADO_INTERNO',
    }

  if (fechaInicioImparticion) {
    cloneInsert.fecha_inicio_imparticion = fechaInicioImparticion
  }

  const { data: nuevoPlan, error: planError } = await supabase
    .from('planes_estudio')
    .insert(cloneInsert)
    .select(
      `
      *,
      carreras (*, facultades(*)),
      estructuras_plan!planes_estudio_estructura_id_fkey (*),
      estados_plan (*)
      `,
    )
    .single()

  throwIfError(planError)
  const newPlanId = requireData(nuevoPlan, 'No se pudo crear el plan.').id

  const { data: sourceLineas, error: lineasError } = await supabase
    .from('lineas_plan')
    .select('id,nombre,orden,area,color')
    .eq('plan_estudio_id', source.id)
    .order('orden', { ascending: true })

  throwIfError(lineasError)

  const lineaIdMap = new Map<string, string>()
  const lineasInsert = (sourceLineas ?? []).map((linea) => {
    const nextId = crypto.randomUUID()
    lineaIdMap.set(linea.id, nextId)
    return {
      id: nextId,
      plan_estudio_id: newPlanId,
      nombre: linea.nombre,
      orden: linea.orden,
      area: linea.area,
      color: linea.color,
      creado_en: now,
      creado_por: userId,
      actualizado_en: now,
      actualizado_por: userId,
    }
  })

  if (lineasInsert.length > 0) {
    const { error } = await supabase.from('lineas_plan').insert(lineasInsert)
    throwIfError(error)
  }

  const { data: sourceAsignaturas, error: asignaturasError } = await supabase
    .from('asignaturas')
    .select(
      'id,codigo,nombre,tipo,creditos,numero_ciclo,linea_plan_id,orden_celda,datos,contenido_tematico,criterios_de_evaluacion,estructura_id,horas_academicas,horas_independientes,prerrequisito_asignatura_id,estado',
    )
    .eq('plan_estudio_id', source.id)
    .neq('estado', 'archivada')
    .order('numero_ciclo', { ascending: true, nullsFirst: false })
    .order('orden_celda', { ascending: true, nullsFirst: false })

  throwIfError(asignaturasError)

  const sourceEstructuraIds = Array.from(
    new Set(
      (sourceAsignaturas ?? [])
        .map((asignatura) => asignatura.estructura_id)
        .filter((id): id is string => Boolean(id)),
    ),
  )

  const structureIdMap = new Map<string, string>()
  if (sourceEstructuraIds.length > 0) {
    const { data: sourceStructures, error: sourceStructuresError } =
      await supabase
        .from('estructuras_asignatura')
        .select('id,nombre,estructura_plan_id')
        .in('id', sourceEstructuraIds)

    throwIfError(sourceStructuresError)

    const { data: targetStructures, error: targetStructuresError } =
      await supabase
        .from('estructuras_asignatura')
        .select('id,nombre,estructura_plan_id')
        .eq('estructura_plan_id', targetEstructuraId)
        .order('nombre', { ascending: true })

    throwIfError(targetStructuresError)

    const targetByName = new Map(
      (targetStructures ?? []).map((item) => [item.nombre, item.id]),
    )
    const firstTargetId = targetStructures?.[0]?.id

    for (const sourceStructureId of sourceEstructuraIds) {
      const sourceStructure = sourceStructures?.find(
        (item) => item.id === sourceStructureId,
      )
      if (sourceStructure?.estructura_plan_id === targetEstructuraId) {
        structureIdMap.set(sourceStructureId, sourceStructureId)
        continue
      }

      const mappedId =
        (sourceStructure?.nombre
          ? targetByName.get(sourceStructure.nombre)
          : undefined) ?? firstTargetId

      if (!mappedId) {
        throw new Error(
          'No existe una estructura de asignatura hija para la estructura del plan destino.',
        )
      }

      structureIdMap.set(sourceStructureId, mappedId)
    }
  }

  const asignaturaIdMap = new Map<string, string>()
  for (const asignatura of sourceAsignaturas ?? []) {
    asignaturaIdMap.set(asignatura.id, crypto.randomUUID())
  }

  const asignaturasInsert = (sourceAsignaturas ?? []).map((asignatura) => ({
    id: asignaturaIdMap.get(asignatura.id),
    plan_estudio_id: newPlanId,
    codigo: asignatura.codigo,
    nombre: asignatura.nombre,
    tipo: asignatura.tipo,
    // `creditos` no se copia: es una columna generada y mencionarla en el
    // INSERT aborta el clon con 428C9. Postgres la recalcula idéntica a partir
    // de las horas, que sí se copian.
    numero_ciclo: asignatura.numero_ciclo,
    linea_plan_id: asignatura.linea_plan_id
      ? (lineaIdMap.get(asignatura.linea_plan_id) ?? null)
      : null,
    orden_celda: asignatura.orden_celda,
    datos: asignatura.datos ?? {},
    contenido_tematico: asignatura.contenido_tematico ?? [],
    criterios_de_evaluacion: asignatura.criterios_de_evaluacion ?? [],
    estructura_id:
      structureIdMap.get(asignatura.estructura_id) ?? asignatura.estructura_id,
    horas_academicas: asignatura.horas_academicas,
    horas_independientes: asignatura.horas_independientes,
    prerrequisito_asignatura_id: asignatura.prerrequisito_asignatura_id
      ? (asignaturaIdMap.get(asignatura.prerrequisito_asignatura_id) ?? null)
      : null,
    estado: asignatura.estado,
    tipo_origen: 'CLONADO_INTERNO' as const,
    meta_origen: {
      tipo: 'CLONADO_INTERNO',
      asignatura_origen_id: asignatura.id,
      plan_origen_id: source.id,
    } as any,
    creado_en: now,
    creado_por: userId,
    actualizado_en: now,
    actualizado_por: userId,
  }))

  if (asignaturasInsert.length > 0) {
    const { error } = await supabase
      .from('asignaturas')
      .insert(asignaturasInsert)
    throwIfError(error)
  }

  const sourceAsignaturaIds = Array.from(asignaturaIdMap.keys())
  if (sourceAsignaturaIds.length > 0) {
    const { data: sourceBibliografia, error: biblioError } = await supabase
      .from('bibliografia_asignatura')
      .select(
        'asignatura_id,tipo,cita,autores,titulo,anio,editorial,isbn,referencia_biblioteca,referencia_en_linea,formato',
      )
      .in('asignatura_id', sourceAsignaturaIds)

    throwIfError(biblioError)

    const bibliografiaInsert = (sourceBibliografia ?? [])
      .map((item) => {
        const asignaturaId = asignaturaIdMap.get(item.asignatura_id)
        if (!asignaturaId) return null
        return {
          asignatura_id: asignaturaId,
          tipo: item.tipo,
          cita: item.cita,
          autores: item.autores ?? [],
          titulo: item.titulo,
          anio: item.anio,
          editorial: item.editorial,
          isbn: item.isbn,
          referencia_biblioteca: item.referencia_biblioteca,
          referencia_en_linea: item.referencia_en_linea,
          formato: item.formato,
          creado_en: now,
          creado_por: userId,
          actualizado_en: now,
          actualizado_por: userId,
        }
      })
      .filter(Boolean)

    if (bibliografiaInsert.length > 0) {
      const { error } = await supabase
        .from('bibliografia_asignatura')
        .insert(bibliografiaInsert as any)
      throwIfError(error)
    }
  }

  return plans_get(newPlanId)
}

export async function plans_import_from_files(payload: {
  datosBasicos: {
    nombrePlan: string
    carreraId: UUID
    estructuraId: UUID
    nivel: string
    tipoCiclo: TipoCiclo
    numCiclos: number
  }
  archivoWordPlanId: UUID
  archivoMapaExcelId?: UUID | null
  archivoAsignaturasExcelId?: UUID | null
}): Promise<PlanEstudio> {
  return invokeEdge<PlanEstudio>(EDGE.plans_import_from_files, payload)
}

/** Update de tarjetas/fields del plan (Edge Function: merge server-side) */
export type PlansUpdateFieldsPatch = {
  nombre?: string
  nombre_propuesto?: string | null
  fecha_inicio_imparticion?: string | null
  nivel?: NivelPlanEstudio
  tipo_ciclo?: TipoCiclo
  numero_ciclos?: number
  semanas_por_ciclo?: number | null
  datos?: Partial<PlanDatosSep> & Record<string, any>
}

export type FaseDisenoCurricular = 'FUNDAMENTOS' | 'BLOQUES' | 'MAPA'

export async function plans_update_design_phase(
  planId: UUID,
  fase: FaseDisenoCurricular,
): Promise<void> {
  type PhaseRpcClient = {
    rpc: (
      fn: string,
      args: Record<string, unknown>,
    ) => PromiseLike<{ data: unknown; error: { message: string } | null }>
  }
  const supabase = supabaseBrowser() as unknown as PhaseRpcClient
  const { error } = await supabase.rpc('actualizar_fase_diseno_plan', {
    p_plan_id: planId,
    p_fase: fase,
  })
  if (error) throw new ApiError(error.message, 'FASE_DISENO_UPDATE_FAILED')
}

export async function plans_update_fields(
  planId: UUID,
  patch: PlansUpdateFieldsPatch,
  adminOverrideReason?: string | null,
): Promise<PlanEstudio> {
  const supabase = supabaseBrowserParaEscritura(adminOverrideReason)
  const userId = await getUserIdOrThrow(supabase)
  const updatedAt = new Date().toISOString()

  const { nivel, ...planPatch } = patch
  const currentPlan = await plans_get(planId)

  if (
    currentPlan.estructuras_plan?.tipo === 'CURRICULAR' &&
    (planPatch.nombre !== undefined ||
      planPatch.nombre_propuesto !== undefined ||
      planPatch.fecha_inicio_imparticion !== undefined)
  ) {
    throw new ApiError(
      'El nombre y el inicio de impartición de un plan CURRICULAR no se pueden modificar.',
      'NOMBRE_CURRICULAR_INMUTABLE',
    )
  }

  if (nivel !== undefined) {
    const carreraId = currentPlan.carreras?.id

    if (!carreraId) {
      throw new Error('No se pudo resolver la carrera asociada al plan.')
    }

    const { error: carreraError } = await supabase
      .from('carreras')
      .update({
        nivel,
        actualizado_en: updatedAt,
        actualizado_por: userId,
      })
      .eq('id', carreraId)

    throwIfError(carreraError)
  }

  if (
    planPatch.nombre !== undefined &&
    planPatch.nombre_propuesto === undefined
  ) {
    planPatch.nombre_propuesto = planPatch.nombre
  }

  if (Object.keys(planPatch).length > 0) {
    const { error } = await supabase
      .from('planes_estudio')
      .update({
        ...planPatch,
        actualizado_en: updatedAt,
        actualizado_por: userId,
      })
      .eq('id', planId)

    throwIfError(error)
  }

  return plans_get(planId)
  // Alternativa Edge Function:
  // return invokeEdge<PlanEstudio>(EDGE.plans_update_fields, { planId, patch })
}

export type PlansRestoreHistoryValueInput = {
  planId: UUID
  campo: string
  value: unknown
  adminOverrideReason?: string | null
}

const PLAN_DIRECT_RESTORE_FIELDS = new Set([
  'activo',
  'carrera_id',
  'estructura_id',
  'nombre',
  'nombre_propuesto',
  'fecha_inicio_imparticion',
  'numero_ciclos',
  'tipo_ciclo',
  'semanas_por_ciclo',
])

export async function plans_restore_history_value({
  planId,
  campo,
  value,
  adminOverrideReason,
}: PlansRestoreHistoryValueInput): Promise<PlanEstudio> {
  const supabase = supabaseBrowserParaEscritura(adminOverrideReason)
  const userId = await getUserIdOrThrow(supabase)
  const updatedAt = new Date().toISOString()

  const currentPlan = await plans_get(planId)

  if (currentPlan.estructuras_plan?.tipo === 'CURRICULAR') {
    if (campo === 'nombre' || campo === 'nombre_propuesto') {
      throw new ApiError(
        'El nombre de un plan CURRICULAR no se puede restaurar.',
        'NOMBRE_CURRICULAR_INMUTABLE',
      )
    }

    if (campo === 'fecha_inicio_imparticion') {
      throw new ApiError(
        'El inicio de impartición de un plan CURRICULAR no se puede restaurar.',
        'FECHA_CURRICULAR_INMUTABLE',
      )
    }
  }

  if (campo === 'nivel') {
    const carreraId = currentPlan.carreras?.id
    if (!carreraId) {
      throw new Error('No se pudo resolver la carrera asociada al plan.')
    }

    const { error } = await supabase
      .from('carreras')
      .update({
        nivel:
          value as Database['public']['Tables']['carreras']['Update']['nivel'],
        actualizado_en: updatedAt,
        actualizado_por: userId,
      })
      .eq('id', carreraId)

    throwIfError(error)
    return plans_get(planId)
  }

  const patch: Database['public']['Tables']['planes_estudio']['Update'] = {
    actualizado_en: updatedAt,
    actualizado_por: userId,
  }

  if (campo === 'estado' || campo === 'estado_actual_id') {
    patch.estado_actual_id =
      value === null || typeof value === 'string' ? value : undefined
  } else if (PLAN_DIRECT_RESTORE_FIELDS.has(campo)) {
    const mutablePatch = patch as Record<string, unknown>
    mutablePatch[campo] = value
  } else if (campo === 'datos' && value && typeof value === 'object') {
    patch.datos =
      value as Database['public']['Tables']['planes_estudio']['Update']['datos']
  } else {
    patch.datos = {
      ...jsonObjectRecord(currentPlan.datos),
      [campo]: value ?? null,
    } as Database['public']['Tables']['planes_estudio']['Update']['datos']
  }

  const { error } = await supabase
    .from('planes_estudio')
    .update(patch)
    .eq('id', planId)

  throwIfError(error)
  return plans_get(planId)
}

/** Operaciones del mapa curricular (mover/reordenar) */
export type PlanMapOperation =
  | {
      op: 'MOVE_ASIGNATURA'
      asignaturaId: UUID
      numero_ciclo: number | null
      linea_plan_id: UUID | null
      orden_celda?: number | null
    }
  | {
      op: 'REORDER_CELDA'
      linea_plan_id: UUID
      numero_ciclo: number
      asignaturaIdsOrdenados: Array<UUID>
    }

export async function plans_update_map(
  planId: UUID,
  ops: Array<PlanMapOperation>,
): Promise<{ ok: true }> {
  return invokeEdge<{ ok: true }>(EDGE.plans_update_map, { planId, ops })
}

export async function plans_transition_state(payload: {
  planId: UUID
  haciaEstadoId: UUID
  comentario?: string
  registroOficial?: PlanRegistroOficialInput
}): Promise<{ ok: true }> {
  return invokeEdge<{ ok: true }>(EDGE.plans_transition_state, payload)
}

/** Documento (Edge Function: genera y devuelve URL firmada o metadata) */
export type DocumentoResult = {
  archivoId: UUID
  signedUrl: string
  mimeType?: string
  nombre?: string
}

export async function plans_generate_document(
  planId: UUID,
): Promise<DocumentoResult> {
  return invokeEdge<DocumentoResult>(EDGE.plans_generate_document, { planId })
}

export async function plans_get_document(
  planId: UUID,
): Promise<DocumentoResult | null> {
  return invokeEdge<DocumentoResult | null>(EDGE.plans_get_document, {
    planId,
  })
}

export async function getCatalogos() {
  const supabase = supabaseBrowser()

  const [facultadesRes, carrerasRes, estadosRes, estructurasPlanRes] =
    await Promise.all([
      supabase.from('facultades').select('*').order('nombre'),
      supabase.from('carreras').select('*').order('nombre'),
      supabase.from('estados_plan').select('*').order('orden'),
      supabase.from('estructuras_plan').select('*').order('creado_en', {
        ascending: false,
      }),
    ])

  return {
    facultades: facultadesRes.data ?? [],
    carreras: carrerasRes.data ?? [],
    estados: estadosRes.data ?? [],
    estructurasPlan: estructurasPlanRes.data ?? [],
  }
}
