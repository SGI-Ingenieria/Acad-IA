import { asRecord } from './value.ts'

type SupabaseRpcClient = any

export type AIGenerationKind =
  | 'plan'
  | 'subject'
  | 'plan-chat'
  | 'subject-chat'
  | 'learning-resources'
  | 'observability'

export type AIGenerationResolution =
  | 'active'
  | 'applied'
  | 'already_applied'
  | 'claimed_elsewhere'
  | 'stale'

export type AIGenerationJob = {
  id: string
  tipo_entidad:
    | 'plan'
    | 'asignatura'
    | 'chat_plan'
    | 'chat_asignatura'
    | 'recursos_aprendizaje'
    | 'observabilidad'
  entidad_id: string
  openai_response_id: string
  estado:
    | 'pendiente'
    | 'reclamado'
    | 'completado'
    | 'fallido'
    | 'cancelado'
    | 'incompleto'
    | 'expirado'
    | 'obsoleto'
  estado_openai: string | null
  token_reclamacion: string | null
  reclamado_por: string | null
  reclamado_hasta: string | null
  intentos: number
  proxima_revision_en: string
  ultimo_error: unknown
  metadata: unknown
  cancelacion_solicitada_en: string | null
  iniciado_en: string
  fecha_limite: string
  completado_en: string | null
  creado_en: string
  actualizado_en: string
}

export type GenerationIdentity = {
  kind: AIGenerationKind
  entityId: string
}

const KIND_TO_DB = {
  plan: 'plan',
  subject: 'asignatura',
  'plan-chat': 'chat_plan',
  'subject-chat': 'chat_asignatura',
  'learning-resources': 'recursos_aprendizaje',
  observability: 'observabilidad',
} as const

const DB_TO_KIND: Record<AIGenerationJob['tipo_entidad'], AIGenerationKind> = {
  plan: 'plan',
  asignatura: 'subject',
  chat_plan: 'plan-chat',
  chat_asignatura: 'subject-chat',
  recursos_aprendizaje: 'learning-resources',
  observabilidad: 'observability',
}

function rpcRow(value: unknown): AIGenerationJob | null {
  const candidate = Array.isArray(value) ? value[0] : value
  const row = asRecord(candidate)
  return row?.id ? (row as unknown as AIGenerationJob) : null
}

function requireRpc<T>(
  error: { message?: string } | null,
  data: unknown,
  operation: string,
): T {
  if (error) {
    throw new Error(
      `${operation}: ${error.message ?? 'error de base de datos'}`,
    )
  }
  return data as T
}

export function inferGenerationIdentity(
  metadataValue: unknown,
): GenerationIdentity | null {
  const metadata = asRecord(metadataValue)
  const table = typeof metadata?.tabla === 'string' ? metadata.tabla : ''

  if (table === 'planes_estudio' && typeof metadata?.id === 'string') {
    return { kind: 'plan', entityId: metadata.id }
  }
  if (table === 'asignaturas' && typeof metadata?.id === 'string') {
    return { kind: 'subject', entityId: metadata.id }
  }
  if (
    table === 'plan_mensajes_ia' &&
    typeof metadata?.mensaje_id === 'string'
  ) {
    return { kind: 'plan-chat', entityId: metadata.mensaje_id }
  }
  if (
    table === 'asignatura_mensajes_ia' &&
    typeof metadata?.mensaje_id === 'string'
  ) {
    return { kind: 'subject-chat', entityId: metadata.mensaje_id }
  }
  if (table === 'learning_objects' && typeof metadata?.id === 'string') {
    return { kind: 'learning-resources', entityId: metadata.id }
  }
  if (
    table === 'observability' &&
    typeof metadata?.observability_test_run_id === 'string'
  ) {
    return {
      kind: 'observability',
      entityId: metadata.observability_test_run_id,
    }
  }
  return null
}

export function identityFromJob(job: AIGenerationJob): GenerationIdentity {
  return { kind: DB_TO_KIND[job.tipo_entidad], entityId: job.entidad_id }
}

export async function registerGenerationJob(args: {
  supabase: SupabaseRpcClient
  kind: AIGenerationKind
  entityId: string
  responseId: string
  openaiStatus?: string | null
  startedAt?: string | null
  metadata?: Record<string, unknown>
}): Promise<AIGenerationJob> {
  const { data, error } = await args.supabase.rpc(
    'registrar_trabajo_generacion_ia',
    {
      p_tipo_entidad: KIND_TO_DB[args.kind],
      p_entidad_id: args.entityId,
      p_openai_response_id: args.responseId,
      p_estado_openai: args.openaiStatus ?? 'queued',
      p_iniciado_en: args.startedAt ?? new Date().toISOString(),
      p_metadata: args.metadata ?? {},
    },
  )
  requireRpc(error, data, 'No se pudo registrar la generación')
  const job = rpcRow(data)
  if (!job) throw new Error('La RPC no devolvió el trabajo registrado.')
  return job
}

export async function adoptGenerationResponse(args: {
  supabase: SupabaseRpcClient
  response: {
    id: string
    status?: unknown
    metadata?: unknown
    created_at?: unknown
  }
}): Promise<AIGenerationJob | null> {
  const identity = inferGenerationIdentity(args.response.metadata)
  if (!identity) return null
  const createdAt =
    typeof args.response.created_at === 'number'
      ? new Date(args.response.created_at * 1000).toISOString()
      : null
  return await registerGenerationJob({
    supabase: args.supabase,
    ...identity,
    responseId: args.response.id,
    openaiStatus:
      typeof args.response.status === 'string' ? args.response.status : null,
    startedAt: createdAt,
    metadata: asRecord(args.response.metadata) ?? {},
  })
}

export async function claimGenerationJob(args: {
  supabase: SupabaseRpcClient
  responseId: string
  actor: string
}): Promise<AIGenerationJob | null> {
  const { data, error } = await args.supabase.rpc(
    'reclamar_trabajo_generacion_ia',
    {
      p_openai_response_id: args.responseId,
      p_reclamado_por: args.actor,
      p_arrendamiento: '2 minutes',
    },
  )
  requireRpc(error, data, 'No se pudo reclamar la generación')
  return rpcRow(data)
}

export async function claimGenerationBatch(args: {
  supabase: SupabaseRpcClient
  actor: string
  limit?: number
}): Promise<Array<AIGenerationJob>> {
  const { data, error } = await args.supabase.rpc(
    'reclamar_lote_trabajos_generacion_ia',
    {
      p_reclamado_por: args.actor,
      p_limite: args.limit ?? 20,
      p_arrendamiento: '2 minutes',
    },
  )
  return requireRpc<Array<AIGenerationJob>>(
    error,
    Array.isArray(data) ? data : [],
    'No se pudo reclamar el lote de generaciones',
  )
}

export async function getGenerationJob(
  supabase: SupabaseRpcClient,
  responseId: string,
): Promise<AIGenerationJob | null> {
  const { data, error } = await supabase
    .from('trabajos_generacion_ia')
    .select('*')
    .eq('openai_response_id', responseId)
    .maybeSingle()
  if (error) throw new Error(error.message ?? 'No se pudo leer la generación.')
  return data ? (data as AIGenerationJob) : null
}

export async function releaseGenerationJob(args: {
  supabase: SupabaseRpcClient
  job: AIGenerationJob
  openaiStatus?: string | null
  nextReviewAt: string
  error?: Record<string, unknown> | null
}): Promise<boolean> {
  if (!args.job.token_reclamacion) return false
  const { data, error } = await args.supabase.rpc(
    'liberar_trabajo_generacion_ia',
    {
      p_trabajo_id: args.job.id,
      p_token_reclamacion: args.job.token_reclamacion,
      p_estado_openai: args.openaiStatus ?? args.job.estado_openai,
      p_proxima_revision_en: args.nextReviewAt,
      p_error: args.error ?? null,
    },
  )
  return requireRpc<boolean>(error, data, 'No se pudo liberar la generación')
}

export async function finalizeGenerationJob(args: {
  supabase: SupabaseRpcClient
  job: AIGenerationJob
  state: 'completado' | 'fallido' | 'cancelado' | 'incompleto' | 'expirado'
  openaiStatus: string
  result?: Record<string, unknown> | null
  error?: Record<string, unknown> | null
}): Promise<AIGenerationJob | null> {
  if (!args.job.token_reclamacion) return null
  const { data, error } = await args.supabase.rpc(
    'finalizar_trabajo_generacion_ia',
    {
      p_trabajo_id: args.job.id,
      p_token_reclamacion: args.job.token_reclamacion,
      p_estado: args.state,
      p_estado_openai: args.openaiStatus,
      p_resultado: args.result ?? null,
      p_error: args.error ?? null,
    },
  )
  requireRpc(error, data, 'No se pudo finalizar la generación')
  return rpcRow(data)
}

export async function requestGenerationCancellation(
  supabase: SupabaseRpcClient,
  responseId: string,
): Promise<AIGenerationJob | null> {
  const { data, error } = await supabase.rpc(
    'solicitar_cancelacion_trabajo_generacion_ia',
    { p_openai_response_id: responseId },
  )
  requireRpc(error, data, 'No se pudo registrar la solicitud de cancelación')
  return rpcRow(data)
}

export async function finalizeProvisionalCancellation(args: {
  supabase: SupabaseRpcClient
  job: AIGenerationJob
}): Promise<boolean> {
  if (!args.job.token_reclamacion) return false
  const { data, error } = await args.supabase.rpc(
    'finalizar_cancelacion_generacion_ia',
    {
      p_trabajo_id: args.job.id,
      p_token_reclamacion: args.job.token_reclamacion,
    },
  )
  return requireRpc<boolean>(error, data, 'No se pudo finalizar la cancelación')
}

export function retryDelayMs(attempts: number): number {
  if (attempts <= 1) return 30_000
  if (attempts === 2) return 60_000
  if (attempts === 3) return 120_000
  return 300_000
}

export function resolutionForJob(
  job: AIGenerationJob | null,
): AIGenerationResolution {
  if (!job) return 'claimed_elsewhere'
  if (job.estado === 'obsoleto') return 'stale'
  if (job.estado === 'reclamado') return 'claimed_elsewhere'
  if (job.estado === 'pendiente') return 'active'
  return 'already_applied'
}
