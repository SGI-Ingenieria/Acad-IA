import { supabaseBrowser } from '../supabase/client'
import { invokeEdge } from '../supabase/invokeEdge'

import { buildRange, requireData, throwIfError } from './_helpers'

import type { Database } from '../../types/supabase'
import type {
  Asignatura,
  CambioPlan,
  LineaPlan,
  NivelPlanEstudio,
  Paged,
  PlanDatosSep,
  PlanEstudio,
  TipoCiclo,
  UUID,
} from '../types/domain'

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

  limit?: number
  offset?: number
}

// Helper para limpiar texto (lo movemos fuera para reutilizar o lo dejas en un utils)
const cleanText = (text: string) => {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

const recalculoVectoresAsignaturasInFlight = new Set<string>()

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
): Promise<Paged<PlanEstudio>> {
  const supabase = supabaseBrowser()

  // 1. Construimos la query base
  // NOTA IMPORTANTE: Para filtrar planes basados en facultad (que está en carreras),
  // necesitamos hacer un INNER JOIN. En Supabase se usa "!inner".
  // Si filters.facultadId existe, forzamos el inner join, si no, lo dejamos normal.

  const carreraModifier =
    filters.facultadId && filters.facultadId !== 'todas' ? '!inner' : ''

  let q = supabase
    .from('planes_estudio')
    .select(
      `
      *,
      carreras${carreraModifier} (
        *,
        facultades (*)
      ),
      estructuras_plan (*),
      estados_plan (*)
      `,
      { count: 'exact' },
    )
    .order('creado_en', { ascending: false })

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

  // 3. Paginación
  const { from, to } = buildRange(filters.limit, filters.offset)
  if (from !== undefined && to !== undefined) q = q.range(from, to)

  const { data, error, count } = await q
  throwIfError(error)

  return {
    // 1. Si data es null, usa [].
    // 2. Luego dile a TS que el resultado es tu Array tipado.
    data: (data ?? []) as unknown as Array<PlanEstudio>,
    count: count ?? 0,
  }
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
      estructuras_plan (*),
      estados_plan (*)
    `,
    )
    .eq('id', planId)
    .single()

  throwIfError(error)
  return requireData(data, 'Plan no encontrado.')
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
      estructuras_plan (*),
      estados_plan (*)
    `,
    )
    .eq('id', planId)
    .maybeSingle()

  throwIfError(error)
  return (data ?? null) as unknown as PlanEstudio | null
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
      'id,plan_estudio_id,nombre,orden,area,creado_en,actualizado_en,color',
    )
    .eq('plan_estudio_id', planId)
    .order('orden', { ascending: true })

  throwIfError(error)
  return data ?? []
}

export async function plan_asignaturas_list(
  planId: UUID,
): Promise<Array<Asignatura>> {
  const supabase = supabaseBrowser()
  const { data, error } = await supabase
    .from('asignaturas')
    .select(
      'id,plan_estudio_id,horas_academicas,horas_independientes,estructura_id,codigo,nombre,tipo,creditos,numero_ciclo,linea_plan_id,orden_celda,estado,datos,contenido_tematico,criterios_de_evaluacion,asignatura_hash,tipo_origen,meta_origen,creado_por,actualizado_por,creado_en,actualizado_en,prerrequisito_asignatura_id,search_vector',
    )
    .eq('plan_estudio_id', planId)
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

export async function plans_history(
  planId: UUID,
  page: number = 0,
  pageSize: number = 4,
): Promise<{ data: Array<CambioPlan>; count: number }> {
  // Cambiamos el retorno
  const supabase = supabaseBrowser()
  const from = page * pageSize
  const to = from + pageSize - 1

  const { data, error, count } = await supabase
    .from('cambios_plan')
    .select(
      'id,plan_estudio_id,cambiado_por,cambiado_en,tipo,campo,valor_anterior,valor_nuevo,response_id',
      { count: 'exact' }, // <--- Pedimos el conteo exacto
    )
    .eq('plan_estudio_id', planId)
    .order('cambiado_en', { ascending: false })
    .range(from, to)

  throwIfError(error)
  return {
    data: data ?? [],
    count: count ?? 0,
  }
}

/** Wizard: crear plan manual (Edge Function) */
export type PlansCreateManualInput = {
  carreraId: UUID
  estructuraId: UUID
  nombre: string
  nivel: NivelPlanEstudio
  tipoCiclo: TipoCiclo
  numCiclos: number
  datos?: Partial<PlanDatosSep> & Record<string, any>
}

export async function plans_create_manual(
  input: PlansCreateManualInput,
): Promise<PlanEstudio> {
  const supabase = supabaseBrowser()

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
    })
    .eq('id', input.carreraId)

  if (carreraError) {
    throw new Error(carreraError.message)
  }

  // 3. Preparar insert
  const planInsert: Database['public']['Tables']['planes_estudio']['Insert'] = {
    activo: true,
    actualizado_en: new Date().toISOString(),
    carrera_id: input.carreraId,
    creado_en: new Date().toISOString(),
    datos: input.datos || {},
    estado_actual_id: estado?.id || null,
    estructura_id: input.estructuraId,
    nombre: input.nombre,
    numero_ciclos: input.numCiclos,
    tipo_ciclo: input.tipoCiclo,
    tipo_origen: 'MANUAL',
  }

  // 4. Insertar
  const { data: nuevoPlan, error: planError } = await supabase
    .from('planes_estudio')
    .insert([planInsert])
    .select(
      `
      *,
      carreras (*, facultades(*)),
      estructuras_plan (*),
      estados_plan (*)
      `,
    )
    .single()

  if (planError) {
    throw new Error(planError.message)
  }

  return nuevoPlan as unknown as PlanEstudio
}

/** Wizard: IA genera preview JSON (Edge Function) */
export type AIGeneratePlanInput = {
  clonacionPlan?: boolean
  datosBasicos: {
    nombrePlan?: string
    carreraId?: UUID
    facultadId?: UUID
    nivel?: string
    tipoCiclo?: TipoCiclo
    numCiclos?: number
    estructuraPlanId: UUID
  }
  iaConfig: {
    descripcionEnfoqueAcademico?: string
    instruccionesAdicionalesIA?: string
    archivosReferencia?: Array<string>
    repositoriosIds?: Array<UUID>
  }
}

export async function ai_generate_plan(
  input: AIGeneratePlanInput,
): Promise<any> {
  console.log('input ai generate', input)

  const edgeFunctionBody = new FormData()
  edgeFunctionBody.append('datosBasicos', JSON.stringify(input.datosBasicos))
  edgeFunctionBody.append('iaConfig', JSON.stringify(input.iaConfig))
  if (typeof input.clonacionPlan !== 'undefined') {
    edgeFunctionBody.append(
      'clonacionPlan',
      String(Boolean(input.clonacionPlan)),
    )
  }

  return invokeEdge<any>(
    EDGE.ai_generate_plan,
    edgeFunctionBody,
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
    Pick<PlanEstudio, 'nombre' | 'tipo_ciclo' | 'numero_ciclos'>
  > & {
    nivel?: NivelPlanEstudio
    carrera_id?: UUID
    estructura_id?: UUID
    datos?: Partial<PlanDatosSep> & Record<string, any>
  }
}): Promise<PlanEstudio> {
  return invokeEdge<PlanEstudio>(EDGE.plans_clone_from_existing, payload)
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
  nivel?: NivelPlanEstudio
  tipo_ciclo?: TipoCiclo
  numero_ciclos?: number
  datos?: Partial<PlanDatosSep> & Record<string, any>
}

export async function plans_update_fields(
  planId: UUID,
  patch: PlansUpdateFieldsPatch,
): Promise<PlanEstudio> {
  const supabase = supabaseBrowser()

  const { nivel, ...planPatch } = patch

  if (nivel !== undefined) {
    const currentPlan = await plans_get(planId)
    const carreraId = currentPlan.carreras?.id

    if (!carreraId) {
      throw new Error('No se pudo resolver la carrera asociada al plan.')
    }

    const { error: carreraError } = await supabase
      .from('carreras')
      .update({
        nivel,
        actualizado_en: new Date().toISOString(),
      })
      .eq('id', carreraId)

    throwIfError(carreraError)
  }

  if (Object.keys(planPatch).length > 0) {
    const { error } = await supabase
      .from('planes_estudio')
      .update(planPatch)
      .eq('id', planId)

    throwIfError(error)
  }

  return plans_get(planId)
  // Alternativa Edge Function:
  // return invokeEdge<PlanEstudio>(EDGE.plans_update_fields, { planId, patch })
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
        ascending: true,
      }),
    ])

  return {
    facultades: facultadesRes.data ?? [],
    carreras: carrerasRes.data ?? [],
    estados: estadosRes.data ?? [],
    estructurasPlan: estructurasPlanRes.data ?? [],
  }
}
