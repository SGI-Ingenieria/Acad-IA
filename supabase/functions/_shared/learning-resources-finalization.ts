type SupabaseRpcClient = {
  rpc: (
    name: string,
    params: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: { message?: string } | null }>
}

export type LearningResourcePersistenceInput = {
  tipo: string
  titulo: string
  descripcion: string
  contenido_json: Record<string, unknown>
  score: number
  source_refs: Array<unknown>
  metadata: Record<string, unknown>
}

export type LearningQualityScorePersistenceInput = {
  score_total: number
  rubrica_json: Record<string, unknown>
  recomendaciones_json: Array<string>
}

export type GlobalLearningResourceClaim = {
  jobId: string
  token: string
}

export class LearningResourceClaimLostError extends Error {
  readonly code = 'GENERATION_CLAIM_LOST'

  constructor() {
    super('La reclamación global ya no está vigente.')
    this.name = 'LearningResourceClaimLostError'
  }
}

function rpcRow(value: unknown): Record<string, unknown> | null {
  const candidate = Array.isArray(value) ? value[0] : value
  return candidate && typeof candidate === 'object'
    ? (candidate as Record<string, unknown>)
    : null
}

export async function persistLearningResourcesAtomically(args: {
  supabase: SupabaseRpcClient
  generationJobId: string
  responseId: string
  openaiStatus?: string
  result: Record<string, unknown>
  resources: Array<LearningResourcePersistenceInput>
  qualityScore: LearningQualityScorePersistenceInput
  globalClaim?: GlobalLearningResourceClaim | null
}): Promise<Record<string, unknown>> {
  const commonParams = {
    p_generation_job_id: args.generationJobId,
    p_openai_response_id: args.responseId,
    p_resultado: args.result,
    p_objetos: args.resources,
    p_score: args.qualityScore,
  }
  const rpcName = args.globalClaim
    ? 'finalizar_recursos_aprendizaje_ia'
    : 'persistir_resultado_recursos_aprendizaje_ia'
  const params = args.globalClaim
    ? {
        ...commonParams,
        p_trabajo_id: args.globalClaim.jobId,
        p_token_reclamacion: args.globalClaim.token,
        p_estado_openai: args.openaiStatus ?? 'completed',
      }
    : commonParams

  const { data, error } = await args.supabase.rpc(rpcName, params)
  if (error) {
    throw new Error(
      `No se pudo persistir atómicamente la generación de recursos: ${error.message ?? 'error de base de datos'}`,
    )
  }

  const row = rpcRow(data)
  if (!row) {
    if (args.globalClaim) throw new LearningResourceClaimLostError()
    throw new Error(
      'La RPC atómica no devolvió el trabajo local de generación.',
    )
  }
  return row
}
