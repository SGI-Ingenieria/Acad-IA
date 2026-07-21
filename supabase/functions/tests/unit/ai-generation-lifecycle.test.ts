import { assertEquals, assertNotEquals } from 'jsr:@std/assert@1'

import { canCancelOwnGeneration } from '../../_shared/ai-cancellation-auth.ts'
import {
  claimGenerationJob,
  inferGenerationIdentity,
  resolutionForJob,
  retryDelayMs,
} from '../../_shared/ai-generation-jobs.ts'
import {
  collectPaginated,
  mapWithConcurrency,
  recoveryHeadersAuthorized,
  secureSecretsMatch,
} from '../../_shared/ai-recovery.ts'

import type { AIGenerationJob } from '../../_shared/ai-generation-jobs.ts'

Deno.test('infiere las seis clases de generación asíncrona', () => {
  assertEquals(
    inferGenerationIdentity({ tabla: 'planes_estudio', id: 'plan-id' }),
    { kind: 'plan', entityId: 'plan-id' },
  )
  assertEquals(
    inferGenerationIdentity({ tabla: 'asignaturas', id: 'subject-id' }),
    { kind: 'subject', entityId: 'subject-id' },
  )
  assertEquals(
    inferGenerationIdentity({
      tabla: 'plan_mensajes_ia',
      mensaje_id: 'plan-message-id',
    }),
    { kind: 'plan-chat', entityId: 'plan-message-id' },
  )
  assertEquals(
    inferGenerationIdentity({
      tabla: 'asignatura_mensajes_ia',
      mensaje_id: 'subject-message-id',
    }),
    { kind: 'subject-chat', entityId: 'subject-message-id' },
  )
  assertEquals(
    inferGenerationIdentity({ tabla: 'learning_objects', id: 'job-id' }),
    { kind: 'learning-resources', entityId: 'job-id' },
  )
  assertEquals(
    inferGenerationIdentity({
      tabla: 'observability',
      observability_test_run_id: 'test-id',
    }),
    { kind: 'observability', entityId: 'test-id' },
  )
})

Deno.test('usa backoff de 30 s, 1 min, 2 min y máximo 5 min', () => {
  assertEquals(retryDelayMs(1), 30_000)
  assertEquals(retryDelayMs(2), 60_000)
  assertEquals(retryDelayMs(3), 120_000)
  assertEquals(retryDelayMs(4), 300_000)
  assertEquals(retryDelayMs(25), 300_000)
})

Deno.test(
  'tres actores que reclaman la misma respuesta producen un ganador',
  async () => {
    let claimed = false
    const token = crypto.randomUUID()
    const job = {
      id: crypto.randomUUID(),
      openai_response_id: 'resp_race',
      token_reclamacion: token,
    }
    const fakeSupabase = {
      rpc: async (name: string) => {
        if (name !== 'reclamar_trabajo_generacion_ia' || claimed) {
          return { data: null, error: null }
        }
        claimed = true
        return { data: job, error: null }
      },
      from: () => ({}),
    }

    const claims = await Promise.all(
      ['webhook', 'frontend', 'cron'].map((actor) =>
        claimGenerationJob({
          supabase: fakeSupabase as any,
          responseId: 'resp_race',
          actor,
        }),
      ),
    )
    assertEquals(claims.filter(Boolean).length, 1)
    assertNotEquals(claims.find(Boolean)?.token_reclamacion, null)
  },
)

Deno.test(
  'el reconciliador nunca supera cinco consultas concurrentes',
  async () => {
    let active = 0
    let maximum = 0
    await mapWithConcurrency(
      Array.from({ length: 20 }, (_, index) => index),
      5,
      async () => {
        active += 1
        maximum = Math.max(maximum, active)
        await new Promise((resolve) => setTimeout(resolve, 2))
        active -= 1
      },
    )
    assertEquals(maximum, 5)
  },
)

Deno.test(
  'el secreto exclusivo del cron se compara sin aceptar variantes',
  async () => {
    assertEquals(
      await secureSecretsMatch('secreto-correcto', 'secreto-correcto'),
      true,
    )
    assertEquals(
      await secureSecretsMatch('secreto-incorrecto', 'secreto-correcto'),
      false,
    )
    assertEquals(await secureSecretsMatch('', 'secreto-correcto'), false)
  },
)

Deno.test(
  'el cron exige publishable key en apikey y Bearer además del secreto',
  async () => {
    const expectedKey = 'sb_publishable_prueba'
    const expectedSecret = 'secreto-recuperacion'
    const headers = new Headers({
      apikey: expectedKey,
      authorization: `Bearer ${expectedKey}`,
      'x-ai-recovery-secret': expectedSecret,
    })
    assertEquals(
      await recoveryHeadersAuthorized(headers, expectedKey, expectedSecret),
      true,
    )

    for (const [name, value] of [
      ['apikey', 'sb_publishable_incorrecta'],
      ['authorization', 'Bearer sb_publishable_incorrecta'],
      ['x-ai-recovery-secret', 'secreto-incorrecto'],
    ]) {
      const invalid = new Headers(headers)
      invalid.set(name, value)
      assertEquals(
        await recoveryHeadersAuthorized(invalid, expectedKey, expectedSecret),
        false,
      )
    }
  },
)

Deno.test(
  'la detección paginada no hambrea registros después de cien',
  async () => {
    const source = Array.from({ length: 235 }, (_, index) => index)
    const pages: Array<[number, number]> = []
    const result = await collectPaginated(async (from, to) => {
      pages.push([from, to])
      return source.slice(from, to + 1)
    }, 100)

    assertEquals(result, source)
    assertEquals(result.at(100), 100)
    assertEquals(result.at(234), 234)
    assertEquals(pages, [
      [0, 99],
      [100, 199],
      [200, 299],
    ])
  },
)

Deno.test(
  'cancelar exige ser iniciador y conservar capacidad de edición con IA',
  () => {
    assertEquals(
      canCancelOwnGeneration({
        userId: 'usuario-iniciador',
        initiatedBy: 'usuario-iniciador',
        canUseAI: true,
      }),
      true,
    )
    assertEquals(
      canCancelOwnGeneration({
        userId: 'otro-editor',
        initiatedBy: 'usuario-iniciador',
        canUseAI: true,
      }),
      false,
    )
    assertEquals(
      canCancelOwnGeneration({
        userId: 'usuario-iniciador',
        initiatedBy: 'usuario-iniciador',
        canUseAI: false,
      }),
      false,
    )
  },
)

Deno.test(
  'las resoluciones distinguen trabajo activo, aplicado y obsoleto',
  () => {
    const base = {
      estado: 'pendiente',
    } as AIGenerationJob
    assertEquals(resolutionForJob(base), 'active')
    assertEquals(
      resolutionForJob({ ...base, estado: 'reclamado' }),
      'claimed_elsewhere',
    )
    assertEquals(
      resolutionForJob({ ...base, estado: 'completado' }),
      'already_applied',
    )
    assertEquals(resolutionForJob({ ...base, estado: 'obsoleto' }), 'stale')
  },
)
