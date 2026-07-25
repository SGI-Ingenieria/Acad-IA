import {
  supabaseBrowser,
  supabaseBrowserParaEscritura,
} from '../supabase/client'
import { invokeEdge } from '../supabase/invokeEdge'

import {
  throwIfError,
  requireData,
  getUserIdOrThrow,
  ApiError,
  esColumnaGeneradaAsignatura,
  sinColumnasGeneradasAsignatura,
} from './_helpers'
import { normalizeAIGenerationReferences } from './aiGenerationReferences'

import type { AIGenerationReferences } from './aiGenerationReferences'
import type { DocumentoResult } from './plans.api'
import type {
  Asignatura,
  BibliografiaAsignatura,
  CarreraRow,
  CambioAsignatura,
  CatalogoAsignaturaRow,
  EstadoAsignatura,
  EstructuraAsignatura,
  FacultadRow,
  Paged,
  PlanEstudioRow,
  TipoAsignatura,
  UUID,
} from '../types/domain'
import type { Database, Tables, TablesInsert } from '@/types/supabase'

const EDGE = {
  generate_subject_suggestions: 'generate-subject-suggestions',
  subjects_create_manual: 'subjects_create_manual',
  ai_generate_subject: 'ai-generate-subject',
  subjects_persist_from_ai: 'subjects_persist_from_ai',
  subjects_clone_from_existing: 'subjects_clone_from_existing',
  subjects_import_from_file: 'subjects_import_from_file',

  // Bibliografía
  buscar_bibliografia: 'buscar-bibliografia',

  subjects_update_fields: 'subjects_update_fields',
  subjects_update_bibliografia: 'subjects_update_bibliografia',

  subjects_generate_document: 'subjects_generate_document',
  subjects_get_document: 'subjects_get_document',
} as const

function jsonObjectRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }
  return {}
}

export type BuscarBibliografiaRequest = {
  searchTerms: {
    q: string
  }

  google: {
    orderBy?: 'newest' | 'relevance'
    langRestrict?: string
    startIndex?: number
    [k: string]: unknown
  }

  openLibrary: {
    language?: string
    page?: number
    sort?: string
    [k: string]: unknown
  }
}

export type GoogleBooksVolume = {
  kind?: 'books#volume'
  id: string
  etag?: string
  selfLink?: string
  volumeInfo?: {
    title?: string
    subtitle?: string
    authors?: Array<string>
    publisher?: string
    publishedDate?: string
    description?: string
    industryIdentifiers?: Array<{ type?: string; identifier?: string }>
    pageCount?: number
    categories?: Array<string>
    language?: string
    previewLink?: string
    infoLink?: string
    canonicalVolumeLink?: string
    imageLinks?: {
      smallThumbnail?: string
      thumbnail?: string
      small?: string
      medium?: string
      large?: string
      extraLarge?: string
    }
  }
  searchInfo?: {
    textSnippet?: string
  }
  [k: string]: unknown
}

export type OpenLibraryDoc = Record<string, unknown>

export type EndpointResult =
  | { endpoint: 'google'; item: GoogleBooksVolume }
  | { endpoint: 'open_library'; item: OpenLibraryDoc }

export async function buscar_bibliografia(
  input: BuscarBibliografiaRequest,
): Promise<Array<EndpointResult>> {
  const q = input.searchTerms.q

  if (typeof q !== 'string' || q.trim().length < 1) {
    throw new Error('q es requerido')
  }

  return await invokeEdge<Array<EndpointResult>>(
    EDGE.buscar_bibliografia,
    input,
    { headers: { 'Content-Type': 'application/json' } },
  )
}

export type ContenidoTemaApi =
  | string
  | {
      id?: string
      nombre: string
      horasEstimadas?: number
      descripcion?: string
      [key: string]: unknown
    }

/**
 * Estructura persistida en `asignaturas.contenido_tematico`.
 * La BDD guarda un arreglo de unidades, cada una con temas (strings u objetos).
 * Cada unidad y cada tema ahora lleva un `id` persistente generado por la BD.
 */
export type ContenidoApi = {
  id?: string
  unidad: number
  titulo: string
  temas: Array<ContenidoTemaApi>
  [key: string]: unknown
}

export type FacultadInSubject = Pick<
  FacultadRow,
  'id' | 'nombre' | 'nombre_corto' | 'color' | 'icono'
>

export type CarreraInSubject = Pick<
  CarreraRow,
  | 'id'
  | 'facultad_id'
  | 'nombre'
  | 'nombre_corto'
  | 'clave_sep'
  | 'activa'
  | 'nivel'
> & {
  facultades: FacultadInSubject | null
}

export type PlanEstudioInSubject = Pick<
  PlanEstudioRow,
  | 'id'
  | 'carrera_id'
  | 'estructura_id'
  | 'nombre'
  | 'tipo_ciclo'
  | 'numero_ciclos'
  | 'datos'
  | 'nombre_display'
  | 'estado_actual_id'
  | 'activo'
  | 'tipo_origen'
  | 'meta_origen'
  | 'creado_por'
  | 'actualizado_por'
  | 'creado_en'
  | 'actualizado_en'
> & {
  carreras: CarreraInSubject | null
}

export type EstructuraAsignaturaInSubject = Pick<
  EstructuraAsignatura,
  'id' | 'nombre' | 'definicion' | 'estructura_plan_id'
>

/**
 * Tipo real que devuelve `subjects_get` (asignatura + relaciones seleccionadas).
 * Nota: `asignaturas_update` (update directo) NO devuelve estas relaciones.
 */
export type AsignaturaDetail = Omit<Asignatura, 'contenido_tematico'> & {
  contenido_tematico: Array<ContenidoApi> | null
  planes_estudio: PlanEstudioInSubject | null
  estructuras_asignatura: EstructuraAsignaturaInSubject | null
}

export async function subjects_get(subjectId: UUID): Promise<AsignaturaDetail> {
  const supabase = supabaseBrowser()

  const { data, error } = await supabase
    .from('asignaturas')
    .select(
      `
      id,plan_estudio_id,estructura_id,codigo,nombre,tipo,creditos,numero_ciclo,linea_plan_id,orden_celda,estado,datos,contenido_tematico,horas_academicas,horas_independientes,asignatura_hash,tipo_origen,meta_origen,creado_por,actualizado_por,creado_en,actualizado_en,criterios_de_evaluacion,prerrequisito_asignatura_id,
      planes_estudio(
        id,carrera_id,estructura_id,nombre,nombre_display,tipo_ciclo,numero_ciclos,datos,estado_actual_id,activo,tipo_origen,meta_origen,creado_por,actualizado_por,creado_en,actualizado_en,
        carreras(id,facultad_id,nombre,nombre_corto,clave_sep,activa,nivel, facultades(id,nombre,nombre_corto,color,icono))
      ),
      estructuras_asignatura(id,nombre,definicion,estructura_plan_id)
    `,
    )
    .eq('id', subjectId)
    .single()

  throwIfError(error)
  return requireData(
    data,
    'Asignatura no encontrada.',
  ) as unknown as AsignaturaDetail
}

export async function subjects_history(
  subjectId: UUID,
): Promise<Array<CambioAsignatura>> {
  const supabase = supabaseBrowser()
  const { data, error } = await supabase
    .from('cambios_asignatura')
    .select(
      'id,asignatura_id,cambiado_por,cambiado_en,tipo,campo,valor_anterior,valor_nuevo,fuente,interaccion_ia_id,agente_sesion_id,agente_contexto,admin_override,admin_override_motivo,admin_override_estado_clave,usuarios_app:cambiado_por(nombre_completo)',
    )
    .eq('asignatura_id', subjectId)
    .order('cambiado_en', { ascending: false })

  throwIfError(error)
  return data ?? []
}

export type CatalogoAsignaturasFilters = {
  q?: string
  facultadId?: UUID | null
  carreraId?: UUID | null
  planId?: UUID | null
  /** `'all'` (o ausente) = sin filtro por tipo. */
  tipo?: TipoAsignatura | 'all'
  /** `'all'` (o ausente) = sin filtro por estado. */
  estado?: EstadoAsignatura | 'all'
  incluirArchivadas?: boolean
  sort?:
    | 'relevancia'
    | 'curricular'
    | 'nombre_asc'
    | 'nombre_desc'
    | 'ciclo_asc'
    | 'creditos_desc'
  limit?: number
  offset?: number
}

/**
 * Catálogo global de asignaturas visibles para el usuario (RPC
 * `catalogo_asignaturas_buscar`). El RLS/RPC ya filtra por permisos; aquí solo
 * mapeamos filtros de UI a parámetros y desempaquetamos el `total_count` que el
 * RPC repite en cada fila (window function) para la paginación.
 */
export async function subjects_catalog_search(
  filters: CatalogoAsignaturasFilters,
): Promise<Paged<CatalogoAsignaturaRow>> {
  const supabase = supabaseBrowser()

  const { data, error } = await (supabase.rpc as any)(
    'catalogo_asignaturas_buscar',
    {
      p_q: filters.q?.trim() ? filters.q.trim() : undefined,
      p_facultad_id: filters.facultadId ?? undefined,
      p_carrera_id: filters.carreraId ?? undefined,
      p_plan_estudio_id: filters.planId ?? undefined,
      p_tipo: filters.tipo && filters.tipo !== 'all' ? filters.tipo : undefined,
      p_estado:
        filters.estado && filters.estado !== 'all' ? filters.estado : undefined,
      p_incluir_archivadas: filters.incluirArchivadas ?? false,
      p_sort: filters.sort ?? 'relevancia',
      p_limit: filters.limit ?? 20,
      p_offset: filters.offset ?? 0,
    },
  )

  throwIfError(error)

  const rows = (data ?? []) as unknown as Array<CatalogoAsignaturaRow>
  const count = rows.length > 0 ? Number(rows[0].total_count) : 0
  return { data: rows, count }
}

export async function subjects_bibliografia_list(
  subjectId: UUID,
): Promise<Array<BibliografiaAsignatura>> {
  const supabase = supabaseBrowser()
  const { data, error } = await supabase
    .from('bibliografia_asignatura')
    .select('*')
    .eq('asignatura_id', subjectId)
    .order('tipo', { ascending: true })
    .order('creado_en', { ascending: true })

  throwIfError(error)
  return data ?? []
}

export async function subjects_create_manual(
  payload: TablesInsert<'asignaturas'>,
  adminOverrideReason?: string | null,
): Promise<Asignatura> {
  const supabase = supabaseBrowserParaEscritura(adminOverrideReason)
  const userId = await getUserIdOrThrow(supabase)
  const { data, error } = await supabase
    .from('asignaturas')
    .insert({ ...sinColumnasGeneradasAsignatura(payload), creado_por: userId })
    .select()
    .single()

  throwIfError(error)
  return requireData(data, 'No se pudo crear la asignatura.')
}

/**
 * Nuevo payload unificado (JSON) para la Edge `ai_generate_subject`.
 * - Siempre incluye `datosUpdate.plan_estudio_id`.
 * - `datosUpdate.id` es opcional (si no existe, la Edge puede crear).
 * En el frontend, insertamos primero y usamos `id` para actualizar.
 */
export type AISubjectUnifiedInput = {
  datosUpdate: Partial<{
    id: string
    plan_estudio_id: string
    estructura_id: string
    nombre: string
    codigo: string | null
    tipo: string | null
    horas_academicas: number | null
    horas_independientes: number | null
    numero_ciclo: number | null
    linea_plan_id: string | null
    orden_celda: number | null
  }> & {
    plan_estudio_id: string
  }
  iaConfig?: {
    clonacionTradicional?: boolean
    descripcionEnfoqueAcademico?: string
    instruccionesAdicionalesIA?: string
    references?: AIGenerationReferences
    webSearchEnabled?: boolean
    reasoningEffort?: 'auto' | 'none' | 'low' | 'medium' | 'high'
  }
}

export function buildAIGenerateSubjectBody(
  input: AISubjectUnifiedInput,
): AISubjectUnifiedInput {
  const iaConfig = input.iaConfig
  return {
    datosUpdate: input.datosUpdate,
    iaConfig: {
      clonacionTradicional: iaConfig?.clonacionTradicional ?? false,
      descripcionEnfoqueAcademico: iaConfig?.descripcionEnfoqueAcademico,
      instruccionesAdicionalesIA: iaConfig?.instruccionesAdicionalesIA,
      references: normalizeAIGenerationReferences(iaConfig?.references),
      webSearchEnabled: iaConfig?.webSearchEnabled ?? false,
      reasoningEffort: iaConfig?.reasoningEffort ?? 'auto',
    },
  }
}

export async function subjects_get_maybe(
  subjectId: UUID,
): Promise<Asignatura | null> {
  const supabase = supabaseBrowser()

  const { data, error } = await supabase
    .from('asignaturas')
    .select('id,plan_estudio_id,estado')
    .eq('id', subjectId)
    .maybeSingle()

  throwIfError(error)
  return (data ?? null) as unknown as Asignatura | null
}

/**
 * Asignatura propuesta por `generate-subject-suggestions`. Es la respuesta
 * cruda de la Edge Function: no lleva `id` porque no existe todavía en el
 * servidor —quien la muestre (hoy los post-its del modo agente) le pone el
 * suyo—.
 */
export type SugerenciaAsignatura = {
  nombre: Asignatura['nombre']
  codigo?: Asignatura['codigo']
  tipo: Asignatura['tipo'] | null
  creditos?: Asignatura['creditos'] | null
  horasAcademicas?: number | null
  horasIndependientes?: number | null
  descripcion: string
}

export type GenerateSubjectSuggestionsInput = {
  plan_estudio_id: UUID
  enfoque?: string
  cantidad_de_sugerencias: number
  sugerencias_conservadas: Array<{ nombre: string; descripcion: string }>
  references?: AIGenerationReferences
  webSearchEnabled?: boolean
  reasoning_effort?: 'auto' | 'none' | 'low' | 'medium' | 'high'
}

export function buildGenerateSubjectSuggestionsBody(
  input: GenerateSubjectSuggestionsInput,
) {
  const references = normalizeAIGenerationReferences(input.references)
  return {
    plan_estudio_id: input.plan_estudio_id,
    enfoque: input.enfoque,
    cantidad_de_sugerencias: input.cantidad_de_sugerencias,
    sugerencias_conservadas: input.sugerencias_conservadas,
    references,
    webSearchEnabled: input.webSearchEnabled ?? false,
    reasoning_effort: input.reasoning_effort ?? 'auto',
  }
}

export async function generate_subject_suggestions(
  input: GenerateSubjectSuggestionsInput,
): Promise<Array<SugerenciaAsignatura>> {
  const raw = await invokeEdge<Array<SugerenciaAsignatura>>(
    EDGE.generate_subject_suggestions,
    buildGenerateSubjectSuggestionsBody(input),
    { headers: { 'Content-Type': 'application/json' } },
  )

  return raw.map(
    (s): SugerenciaAsignatura => ({
      nombre: s.nombre,
      codigo: s.codigo,
      tipo: s.tipo ?? null,
      creditos: s.creditos ?? null,
      horasAcademicas: s.horasAcademicas ?? null,
      horasIndependientes: s.horasIndependientes ?? null,
      descripcion: s.descripcion,
    }),
  )
}

export async function ai_generate_subject(
  input: AISubjectUnifiedInput,
): Promise<any> {
  return invokeEdge<any>(
    EDGE.ai_generate_subject,
    buildAIGenerateSubjectBody(input),
    {
      headers: { 'Content-Type': 'application/json' },
    },
  )
}

export async function subjects_persist_from_ai(payload: {
  planId: UUID
  jsonAsignatura: any
}): Promise<Asignatura> {
  return invokeEdge<Asignatura>(EDGE.subjects_persist_from_ai, payload)
}

export async function subjects_clone_from_existing(payload: {
  asignaturaOrigenId: UUID
  planDestinoId: UUID
  overrides?: Partial<{
    nombre: string
    codigo: string
    tipo: TipoAsignatura
    horas_semana: number
  }>
}): Promise<Asignatura> {
  return invokeEdge<Asignatura>(EDGE.subjects_clone_from_existing, payload)
}

export async function subjects_import_from_file(payload: {
  planId: UUID
  archivoWordAsignaturaId: UUID
  archivosAdicionalesIds?: Array<UUID>
}): Promise<Asignatura> {
  return invokeEdge<Asignatura>(EDGE.subjects_import_from_file, payload)
}

/** Guardado de tarjetas/fields (Edge: merge server-side en asignaturas.datos y columnas) */
export type SubjectsUpdateFieldsPatch = Partial<{
  codigo: string | null
  nombre: string
  tipo: TipoAsignatura
  horas_semana: number | null
  numero_ciclo: number | null
  linea_plan_id: UUID | null

  datos: Record<string, any>
}>

export async function subjects_update_fields(
  subjectId: UUID,
  patch: SubjectsUpdateFieldsPatch,
  adminOverrideReason?: string | null,
): Promise<Asignatura> {
  return invokeEdge<Asignatura>(
    EDGE.subjects_update_fields,
    {
      subjectId,
      patch,
    },
    adminOverrideReason
      ? {
          headers: { 'x-admin-override-reason': adminOverrideReason },
        }
      : undefined,
  )
}

export type SubjectsRestoreHistoryValueInput = {
  subjectId: UUID
  campo: string
  value: unknown
  adminOverrideReason?: string | null
}

const SUBJECT_DIRECT_RESTORE_FIELDS = new Set([
  'codigo',
  'contenido_tematico',
  'criterios_de_evaluacion',
  // `creditos` NO va aquí: es una columna generada (ver
  // `COLUMNAS_GENERADAS_ASIGNATURA`). Restaurarla directamente devolvía 428C9.
  'estado',
  'estructura_id',
  'horas_academicas',
  'horas_independientes',
  'linea_plan_id',
  'nombre',
  'numero_ciclo',
  'orden_celda',
  'plan_estudio_id',
  'prerrequisito_asignatura_id',
  'tipo',
])

export async function subjects_restore_history_value({
  subjectId,
  campo,
  value,
  adminOverrideReason,
}: SubjectsRestoreHistoryValueInput): Promise<Asignatura> {
  // Sin esta guarda, un campo generado caería en la rama `datos` de abajo y se
  // «restauraría» escribiendo una copia muerta dentro del JSON, que es peor que
  // fallar: la columna real seguiría con su valor derivado.
  if (esColumnaGeneradaAsignatura(campo)) {
    throw new ApiError(
      'Ese valor lo calcula el sistema y no puede restaurarse por separado: los créditos se derivan de las horas académicas e independientes.',
      'COLUMNA_GENERADA',
    )
  }

  const supabase = supabaseBrowserParaEscritura(adminOverrideReason)
  const userId = await getUserIdOrThrow(supabase)

  const patch: Database['public']['Tables']['asignaturas']['Update'] = {
    actualizado_en: new Date().toISOString(),
    actualizado_por: userId,
  }

  if (campo === 'datos' && value && typeof value === 'object') {
    patch.datos =
      value as Database['public']['Tables']['asignaturas']['Update']['datos']
  } else if (SUBJECT_DIRECT_RESTORE_FIELDS.has(campo)) {
    const mutablePatch = patch as Record<string, unknown>
    mutablePatch[campo] = value
  } else {
    const current = await subjects_get(subjectId)
    patch.datos = {
      ...jsonObjectRecord(current.datos),
      [campo]: value ?? null,
    } as Database['public']['Tables']['asignaturas']['Update']['datos']
  }

  const { data, error } = await supabase
    .from('asignaturas')
    .update(patch)
    .eq('id', subjectId)
    .select()
    .single()

  throwIfError(error)
  return requireData(data, 'No se pudo restaurar la asignatura.')
}

export async function subjects_update_contenido(
  subjectId: UUID,
  unidades: Array<ContenidoApi>,
  adminOverrideReason?: string | null,
): Promise<Asignatura> {
  const supabase = supabaseBrowserParaEscritura(adminOverrideReason)

  type AsignaturaUpdate = Database['public']['Tables']['asignaturas']['Update']

  const { data, error } = await supabase
    .from('asignaturas')
    .update({
      contenido_tematico:
        unidades as unknown as AsignaturaUpdate['contenido_tematico'],
    })
    .eq('id', subjectId)
    .select()
    .single()

  throwIfError(error)
  return requireData(data, 'No se pudo actualizar la asignatura.')
}

export type BibliografiaUpsertInput = Array<{
  id?: UUID
  tipo: 'BASICA' | 'COMPLEMENTARIA'
  cita: string
  tipo_fuente?: 'MANUAL' | 'BIBLIOTECA'
  biblioteca_item_id?: string | null
}>

export async function subjects_update_bibliografia(
  subjectId: UUID,
  entries: BibliografiaUpsertInput,
): Promise<{ ok: true }> {
  return invokeEdge<{ ok: true }>(EDGE.subjects_update_bibliografia, {
    subjectId,
    entries,
  })
}

/** Documento SEP asignatura */
/* export type DocumentoResult = {
  archivoId: UUID;
  signedUrl: string;
  mimeType?: string;
  nombre?: string;
}; */

export async function subjects_generate_document(
  subjectId: UUID,
): Promise<DocumentoResult> {
  return invokeEdge<DocumentoResult>(EDGE.subjects_generate_document, {
    subjectId,
  })
}

export async function subjects_get_document(
  subjectId: UUID,
): Promise<DocumentoResult | null> {
  return invokeEdge<DocumentoResult | null>(EDGE.subjects_get_document, {
    subjectId,
  })
}

export async function subjects_get_structure_catalog(params?: {
  estructuraPlanId?: string | null
}): Promise<
  Array<Database['public']['Tables']['estructuras_asignatura']['Row']>
> {
  const supabase = supabaseBrowser()

  let q = supabase
    .from('estructuras_asignatura')
    .select('*')
    .order('nombre', { ascending: true })

  if (params?.estructuraPlanId) {
    q = q.eq('estructura_plan_id', params.estructuraPlanId)
  }

  const { data, error } = await q

  if (error) {
    throw error
  }

  return data
}

export async function asignaturas_update(
  asignaturaId: UUID,
  patch: Partial<Asignatura>, // O tu tipo específico para el Patch de materias
  adminOverrideReason?: string | null,
): Promise<Asignatura> {
  const supabase = supabaseBrowserParaEscritura(adminOverrideReason)
  const userId = await getUserIdOrThrow(supabase)

  const { data, error } = await supabase
    .from('asignaturas')
    .update({
      ...sinColumnasGeneradasAsignatura(patch),
      actualizado_en: new Date().toISOString(),
      actualizado_por: userId,
    })
    .eq('id', asignaturaId)
    .select() // Trae la materia actualizada
    .single()

  throwIfError(error)
  return requireData(data, 'No se pudo actualizar la asignatura.')
}

// Insertar una nueva línea
export async function lineas_insert(linea: {
  nombre: string
  plan_estudio_id: string
  orden: number
  area?: string
  color?: string | null
  adminOverrideReason?: string | null
}) {
  const { adminOverrideReason, ...lineaInsert } = linea
  const supabase = supabaseBrowserParaEscritura(adminOverrideReason)
  const userId = await getUserIdOrThrow(supabase)
  const { data, error } = await supabase
    .from('lineas_plan')
    .insert([{ ...lineaInsert, creado_por: userId }])
    .select()
    .single()

  if (error) throw error
  return data
}

// Actualizar una línea existente
export async function lineas_update(
  lineaId: string,
  patch: {
    nombre?: string
    orden?: number
    area?: string
    color?: string | null
    adminOverrideReason?: string | null
  },
) {
  const { adminOverrideReason, ...lineaPatch } = patch
  const supabase = supabaseBrowserParaEscritura(adminOverrideReason)
  const userId = await getUserIdOrThrow(supabase)
  const { data, error } = await supabase
    .from('lineas_plan')
    .update({ ...lineaPatch, actualizado_por: userId })
    .eq('id', lineaId)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function lineas_delete(
  lineaId: string,
  adminOverrideReason?: string | null,
) {
  const supabase = supabaseBrowserParaEscritura(adminOverrideReason)

  // Nota: Si configuraste "ON DELETE SET NULL" en tu base de datos,
  // las asignaturas se desvincularán solas. Si no, Supabase podría dar error.
  const { error } = await supabase
    .from('lineas_plan')
    .delete()
    .eq('id', lineaId)

  if (error) throw error
  return lineaId
}

export async function bibliografia_insert(
  entry: TablesInsert<'bibliografia_asignatura'>,
  adminOverrideReason?: string | null,
): Promise<Tables<'bibliografia_asignatura'>> {
  const supabase = supabaseBrowserParaEscritura(adminOverrideReason)
  const { data, error } = await supabase
    .from('bibliografia_asignatura')
    .insert([entry])
    .select()
    .single()

  if (error) throw error
  return data
}

export async function bibliografia_update(
  id: string,
  updates: {
    cita?: string
    tipo?: 'BASICA' | 'COMPLEMENTARIA'
    formato?: string
  },
  adminOverrideReason?: string | null,
) {
  const supabase = supabaseBrowserParaEscritura(adminOverrideReason)
  const { data, error } = await supabase
    .from('bibliografia_asignatura')
    .update(updates) // Ahora 'updates' es compatible con lo que espera Supabase
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function bibliografia_delete(
  id: string,
  adminOverrideReason?: string | null,
) {
  const supabase = supabaseBrowserParaEscritura(adminOverrideReason)
  const { error } = await supabase
    .from('bibliografia_asignatura')
    .delete()
    .eq('id', id)

  if (error) throw error
  return id
}

export async function checkPrerrequisitoConflicts(
  asignaturaId: string,
  nuevoCiclo: number,
): Promise<Array<string>> {
  const supabase = supabaseBrowser()

  // CORRECCIÓN 1: Agregamos 'id' al select
  // CORRECCIÓN 2: Quitamos espacios en el .or()
  const { data, error } = await supabase
    .from('asignaturas')
    .select('id, nombre, numero_ciclo, prerrequisito_asignatura_id')
    .or(`prerrequisito_asignatura_id.eq.${asignaturaId},id.eq.${asignaturaId}`)

  if (error) throw error

  const conflictos: Array<string> = []

  data.forEach((asig) => {
    // Caso 1: Materias que tienen a esta como prerrequisito (Hijas)
    // "Si yo me muevo al ciclo 5, y mi hija está en el 4, se rompe la regla"
    if (asig.prerrequisito_asignatura_id === asignaturaId) {
      if (asig.numero_ciclo !== null && asig.numero_ciclo <= nuevoCiclo) {
        conflictos.push(asig.nombre)
      }
    }

    // Caso 2: El prerrequisito de la materia que estoy moviendo (Padre)
    // "Si yo me muevo al ciclo 2, y mi padre está en el 3, se rompe la regla"
    if (asig.id === asignaturaId && asig.prerrequisito_asignatura_id) {
      const padre = data.find((p) => p.id === asig.prerrequisito_asignatura_id)
      if (
        padre &&
        padre.numero_ciclo !== null &&
        padre.numero_ciclo >= nuevoCiclo
      ) {
        conflictos.push(padre.nombre)
      }
    }
  })

  return conflictos
}
