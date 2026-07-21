import { supabaseBrowser } from '../supabase/client'
import { invokeEdge } from '../supabase/invokeEdge'

import { throwIfError, requireData, getUserIdOrThrow } from './_helpers'
import { normalizeAIGenerationReferences } from './aiGenerationReferences'

import type { AIGenerationReferences } from './aiGenerationReferences'
import type { UUID } from '../types/domain'
import type {
  Database,
  Tables,
  TablesInsert,
  TablesUpdate,
} from '@/types/supabase'

const EDGE = {
  learning_object_generate: 'learning-object-generate',
  learning_object_status: 'learning-object-generate/status',
} as const

export type RecursoTipo = Database['public']['Enums']['learning_object_tipo']
export type GeneracionScope =
  Database['public']['Enums']['learning_generation_scope']
export type GeneracionEstado =
  Database['public']['Enums']['learning_generation_estado']
export type RecursosReasoningEffort =
  | 'auto'
  | 'none'
  | 'low'
  | 'medium'
  | 'high'

export type GenerarRecursosResult = {
  ok: boolean
  job: {
    id: UUID
    estado: GeneracionEstado
    openai_response_id?: string | null
    error?: string | null
  }
  responseStatus?: string | null
  applied?: boolean
  resolution?:
    | 'active'
    | 'applied'
    | 'already_applied'
    | 'claimed_elsewhere'
    | 'stale'
  learning_objects: Array<Tables<'learning_objects'>>
  quality_score: Tables<'learning_quality_scores'> | null
  resumen_generacion: string | null
  openai?: {
    responseId: string
    model: string
    usage?: unknown
  }
}

export const RECURSO_TIPO_LABEL: Record<RecursoTipo, string> = {
  outline_presentacion: 'Presentaciones',
  apunte: 'Apuntes',
  quiz: 'Quizzes',
  ejercicios: 'Ejercicios',
  actividad: 'Actividades',
  rubrica: 'Rúbricas',
  recursos_externos: 'Fuentes confiables',
}

export const RECURSO_TIPO_SINGULAR_LABEL: Record<RecursoTipo, string> = {
  outline_presentacion: 'Presentación',
  apunte: 'Apunte',
  quiz: 'Quiz',
  ejercicios: 'Ejercicios',
  actividad: 'Actividad',
  rubrica: 'Rúbrica',
  recursos_externos: 'Fuentes confiables',
}

export const RECURSOS_TIPOS_OPCIONES: Array<{
  value: RecursoTipo
  label: string
  description: string
  hint?: string
}> = [
  {
    value: 'outline_presentacion',
    label: RECURSO_TIPO_LABEL.outline_presentacion,
    description: 'Crear material para exponer el tema en clase.',
    hint: 'Puede exportarse a PPTX.',
  },
  {
    value: 'apunte',
    label: RECURSO_TIPO_LABEL.apunte,
    description: 'Crear material de estudio para alumnos.',
  },
  {
    value: 'quiz',
    label: RECURSO_TIPO_LABEL.quiz,
    description: 'Crear preguntas de opción múltiple.',
  },
  {
    value: 'ejercicios',
    label: RECURSO_TIPO_LABEL.ejercicios,
    description: 'Crear ejercicios prácticos con solución.',
  },
  {
    value: 'actividad',
    label: RECURSO_TIPO_LABEL.actividad,
    description: 'Crear una actividad de aprendizaje.',
  },
  {
    value: 'rubrica',
    label: RECURSO_TIPO_LABEL.rubrica,
    description: 'Crear una rúbrica vinculada a una actividad.',
  },
  {
    value: 'recursos_externos',
    label: RECURSO_TIPO_LABEL.recursos_externos,
    description: 'Buscar recursos confiables en internet.',
  },
]

export async function recursos_list(
  asignaturaId: UUID,
): Promise<Array<Tables<'learning_objects'>>> {
  const supabase = supabaseBrowser()
  const { data, error } = await supabase
    .from('learning_objects')
    .select('*')
    .eq('asignatura_id', asignaturaId)
    .order('creado_en', { ascending: true })

  throwIfError(error)
  return data ?? []
}

export async function recursos_scores_list(
  asignaturaId: UUID,
): Promise<Array<Tables<'learning_quality_scores'>>> {
  const supabase = supabaseBrowser()
  const { data, error } = await supabase
    .from('learning_quality_scores')
    .select('*')
    .eq('asignatura_id', asignaturaId)
    .order('calculado_en', { ascending: false })

  throwIfError(error)
  return data ?? []
}

export async function recursos_recalcular_scores(
  asignaturaId: UUID,
): Promise<void> {
  const supabase = supabaseBrowser()
  const { error } = await supabase.rpc('recalcular_learning_quality_scores', {
    p_asignatura_id: asignaturaId,
  })
  throwIfError(error)
}

export function buildRecursosGenerationBody(
  asignaturaId: UUID,
  unidadId: string | null | undefined,
  temaId: string | null | undefined,
  tipos: Array<RecursoTipo>,
  instruccionesAdicionalesIA?: string,
  model?: string,
  references?: AIGenerationReferences,
  reasoningEffort: RecursosReasoningEffort = 'auto',
  webSearchEnabled = false,
) {
  const scope: GeneracionScope = temaId
    ? 'tema'
    : unidadId
      ? 'unidad'
      : 'asignatura'

  const instrucciones = instruccionesAdicionalesIA?.trim()
  const normalizedReferences = normalizeAIGenerationReferences(references)

  return {
    asignaturaId,
    scope,
    ...(unidadId ? { unidadId } : {}),
    ...(temaId ? { temaId } : {}),
    requestedTypes: tipos,
    iaConfig: {
      ...(instrucciones ? { instruccionesAdicionalesIA: instrucciones } : {}),
      ...(model ? { model } : {}),
      references: normalizedReferences,
      reasoningEffort,
      webSearchEnabled,
    },
  }
}

export async function recursos_generar(
  asignaturaId: UUID,
  unidadId: string | null | undefined,
  temaId: string | null | undefined,
  tipos: Array<RecursoTipo>,
  instruccionesAdicionalesIA?: string,
  model?: string,
  references?: AIGenerationReferences,
  reasoningEffort: RecursosReasoningEffort = 'auto',
  webSearchEnabled = false,
): Promise<GenerarRecursosResult> {
  return invokeEdge<GenerarRecursosResult>(
    EDGE.learning_object_generate,
    buildRecursosGenerationBody(
      asignaturaId,
      unidadId,
      temaId,
      tipos,
      instruccionesAdicionalesIA,
      model,
      references,
      reasoningEffort,
      webSearchEnabled,
    ),
  )
}

export async function recursos_job_status(
  jobId: UUID,
): Promise<GenerarRecursosResult> {
  return invokeEdge<GenerarRecursosResult>(EDGE.learning_object_status, {
    jobId,
  })
}

export async function recursos_update(
  recursoId: UUID,
  patch: TablesUpdate<'learning_objects'>,
): Promise<Tables<'learning_objects'>> {
  const supabase = supabaseBrowser()
  const userId = await getUserIdOrThrow(supabase)

  const { data, error } = await supabase
    .from('learning_objects')
    .update({ ...patch, actualizado_por: userId })
    .eq('id', recursoId)
    .select()
    .single()

  throwIfError(error)
  return requireData(data, 'No se pudo actualizar el recurso.')
}

export async function recursos_delete(recursoId: UUID): Promise<void> {
  const supabase = supabaseBrowser()
  const { error } = await supabase
    .from('learning_objects')
    .delete()
    .eq('id', recursoId)
  throwIfError(error)
}

export async function recursos_jobs_list(
  asignaturaId: UUID,
): Promise<Array<Tables<'learning_generation_jobs'>>> {
  const supabase = supabaseBrowser()
  const { data, error } = await supabase
    .from('learning_generation_jobs')
    .select('*')
    .eq('asignatura_id', asignaturaId)
    .order('creado_en', { ascending: false })

  throwIfError(error)
  return data ?? []
}

export async function recursos_job_create(
  payload: TablesInsert<'learning_generation_jobs'>,
): Promise<Tables<'learning_generation_jobs'>> {
  const supabase = supabaseBrowser()
  const userId = await getUserIdOrThrow(supabase)

  const { data, error } = await supabase
    .from('learning_generation_jobs')
    .insert({ ...payload, creado_por: userId })
    .select()
    .single()

  throwIfError(error)
  return requireData(data, 'No se pudo crear el job de generación.')
}
