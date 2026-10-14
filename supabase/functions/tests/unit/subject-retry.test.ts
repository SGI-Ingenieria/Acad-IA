import { assertEquals, assertRejects } from 'jsr:@std/assert@1'

import {
  buildEntityAttemptOpenAIRequest,
  retrySubjectGenerationAttempt,
} from '../../_shared/entity-generation-attempts.ts'
import { HttpError } from '../../_shared/utils.ts'
import type { EntityGenerationAttempt } from '../../_shared/entity-generation-attempts.ts'
import type { ServiceRoleClient } from '../../_shared/supabase.ts'

Deno.test(
  'el reintento traduce permisos, conflictos y solicitudes ausentes',
  async () => {
    for (const [dbCode, status, code] of [
      ['42501', 403, 'AI_RETRY_FORBIDDEN'],
      ['P0002', 404, 'NOT_FOUND'],
      ['55000', 409, 'AI_RETRY_CONFLICT'],
      ['P0001', 409, 'AI_RETRY_SNAPSHOT_MISSING'],
      ['PGRST202', 503, 'AI_RETRY_NOT_CONFIGURED'],
    ] as const) {
      const error = await assertRejects(
        () =>
          retrySubjectGenerationAttempt({
            supabase: {
              rpc: () =>
                Promise.resolve({ data: null, error: { code: dbCode } }),
            },
            subjectId: 'asignatura',
            userId: 'usuario',
            safetyIdentifier: 'safety',
          }),
        HttpError,
      )
      assertEquals(error.status, status)
      assertEquals(error.code, code)
      if (dbCode === 'PGRST202') {
        assertEquals(error.internalDetails, { code: 'PGRST202' })
      }
    }
  },
)

Deno.test(
  'el reintento conserva el prompt y el modelo originales y renueva la identidad',
  async () => {
    const solicitud = {
      model: 'modelo-original',
      background: true,
      input: [
        { role: 'system' as const, content: 'Reglas originales' },
        {
          role: 'user' as const,
          content: 'Prompt original con referencias congeladas',
        },
      ],
      metadata: {
        tabla: 'asignaturas',
        id: 'asignatura',
        generation_attempt_id: 'anterior',
      },
      reasoning: { effort: 'high' as const },
    }
    const attempt: EntityGenerationAttempt = {
      id: 'nuevo',
      estado: 'reclamado',
      tipo_entidad: 'asignatura',
      entidad_id: 'asignatura',
      handler: 'subject',
      consulta_referencias: 'consulta original',
      openai_response_id: null,
      estado_openai: null,
      iniciado_en: null,
      token_reclamacion: 'token',
      reclamado_por: 'test',
      reclamado_hasta: null,
      intentos: 1,
      siguiente_intento: '2026-10-13T00:00:00Z',
      fecha_limite: '2026-10-13T01:00:00Z',
      solicitud,
      payload_version: 1,
      modo_referencias: 'retrieval',
      referencias: [
        {
          fileId: 'archivo',
          fileVersionId: 'version-original',
          chunkIds: ['fragmento-original'],
          scores: {},
        },
      ],
      contexto: { userId: 'usuario' },
    }
    const request = await buildEntityAttemptOpenAIRequest({
      attempt,
      supabase: {} as ServiceRoleClient,
    })
    assertEquals(request.input, solicitud.input)
    assertEquals(request.model, solicitud.model)
    assertEquals(request.reasoning, solicitud.reasoning)
    assertEquals(request.metadata?.generation_attempt_id, 'nuevo')
    assertEquals(solicitud.metadata.generation_attempt_id, 'anterior')
  },
)
