import { assertEquals, assertRejects } from 'jsr:@std/assert@1'

import {
  LearningResourceClaimLostError,
  persistLearningResourcesAtomically,
} from '../../_shared/learning-resources-finalization.ts'

const resource = {
  tipo: 'apunte',
  titulo: 'Apunte de prueba',
  descripcion: 'Descripción',
  contenido_json: { markdown: '# Contenido' },
  score: 90,
  source_refs: [],
  metadata: { generatedBy: 'test' },
}

const qualityScore = {
  score_total: 90,
  rubrica_json: { claridad: 90 },
  recomendaciones_json: [],
}

Deno.test(
  'la persistencia asíncrona entrega el lease token a la RPC atómica',
  async () => {
    let calledName = ''
    let calledParams: Record<string, unknown> = {}
    const supabase = {
      rpc: (name: string, params: Record<string, unknown>) => {
        calledName = name
        calledParams = params
        return Promise.resolve({
          data: { id: 'global-job', estado: 'completado' },
          error: null,
        })
      },
    }

    const row = await persistLearningResourcesAtomically({
      supabase,
      generationJobId: 'learning-job',
      responseId: 'resp_atomic',
      result: { resources: [resource], quality_score: qualityScore },
      resources: [resource],
      qualityScore,
      globalClaim: { jobId: 'global-job', token: 'lease-token' },
    })

    assertEquals(calledName, 'finalizar_recursos_aprendizaje_ia')
    assertEquals(calledParams.p_trabajo_id, 'global-job')
    assertEquals(calledParams.p_token_reclamacion, 'lease-token')
    assertEquals(calledParams.p_generation_job_id, 'learning-job')
    assertEquals(calledParams.p_openai_response_id, 'resp_atomic')
    assertEquals(calledParams.p_estado_openai, 'completed')
    assertEquals(calledParams.p_resultado, {
      resources: [resource],
      quality_score: qualityScore,
    })
    assertEquals(calledParams.p_objetos, [resource])
    assertEquals(calledParams.p_score, qualityScore)
    assertEquals(row.estado, 'completado')
  },
)

Deno.test(
  'la persistencia foreground usa la RPC local igualmente atómica',
  async () => {
    let calledName = ''
    let calledParams: Record<string, unknown> = {}
    const supabase = {
      rpc: (name: string, params: Record<string, unknown>) => {
        calledName = name
        calledParams = params
        return Promise.resolve({
          data: { id: 'learning-job', estado: 'completed' },
          error: null,
        })
      },
    }

    await persistLearningResourcesAtomically({
      supabase,
      generationJobId: 'learning-job',
      responseId: 'resp_foreground',
      result: { resources: [resource], quality_score: qualityScore },
      resources: [resource],
      qualityScore,
    })

    assertEquals(calledName, 'persistir_resultado_recursos_aprendizaje_ia')
    assertEquals(calledParams.p_generation_job_id, 'learning-job')
    assertEquals(calledParams.p_openai_response_id, 'resp_foreground')
    assertEquals('p_trabajo_id' in calledParams, false)
    assertEquals('p_token_reclamacion' in calledParams, false)
  },
)

Deno.test(
  'un trabajador que perdió el lease no puede declarar éxito',
  async () => {
    const supabase = {
      rpc: () => Promise.resolve({ data: null, error: null }),
    }

    await assertRejects(
      () =>
        persistLearningResourcesAtomically({
          supabase,
          generationJobId: 'learning-job',
          responseId: 'resp_lost',
          result: { resources: [resource], quality_score: qualityScore },
          resources: [resource],
          qualityScore,
          globalClaim: { jobId: 'global-job', token: 'expired-token' },
        }),
      LearningResourceClaimLostError,
      'La reclamación global ya no está vigente.',
    )
  },
)
