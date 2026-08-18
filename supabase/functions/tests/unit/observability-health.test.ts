import { assertEquals } from 'jsr:@std/assert@1'

import { classifyAIGenerationRecoveryHealth } from '../../observability-health/ai-generation-health.ts'
import { classifyEdgeProbeResult } from '../../observability-health/edge-health.ts'
import {
  compareMigrations,
  migrationVersionFromPath,
} from '../../observability-health/migrations.ts'

Deno.test(
  'classifyEdgeProbeResult treats InvalidWorkerCreation as critical',
  () => {
    const result = classifyEdgeProbeResult({
      functionName: 'ai-generate-plan',
      status: 500,
      bodyText: JSON.stringify({
        msg: 'InvalidWorkerCreation: worker failed during startup',
      }),
    })

    assertEquals(result.status, 'error')
  },
)

Deno.test('classifyEdgeProbeResult treats boot errors as critical', () => {
  const result = classifyEdgeProbeResult({
    functionName: 'openai-responses',
    status: 503,
    errorCode: 'BOOT_ERROR',
    bodyText: 'Internal Worker Boot Error',
  })

  assertEquals(result.status, 'error')
})

Deno.test(
  'classifyEdgeProbeResult accepts diagnostic 405 as loaded function',
  () => {
    const result = classifyEdgeProbeResult({
      functionName: 'openai-webhook-responses',
      status: 405,
      bodyText: 'Method Not Allowed',
    })

    assertEquals(result.status, 'ok')
  },
)

Deno.test(
  'compareMigrations detects missing migrations from GitHub main',
  () => {
    const comparison = compareMigrations({
      applied: ['20260701000000'],
      expected: ['20260701000000', '20260702000000'],
    })

    assertEquals(comparison.missing, ['20260702000000'])
    assertEquals(comparison.extra, [])
  },
)

Deno.test('migrationVersionFromPath extracts timestamp prefix', () => {
  assertEquals(
    migrationVersionFromPath(
      'supabase/migrations/20260708120000_observability_dashboard.sql',
    ),
    '20260708120000',
  )
})

Deno.test(
  'AI recovery health accepts the conditioned five-minute fallback',
  () => {
    assertEquals(
      classifyAIGenerationRecoveryHealth({
        cron_activo: true,
        cron_programacion: '*/5 * * * *',
        cron_fallos_1h: 0,
        recuperaciones_errores_1h: 0,
        recuperaciones_1h: 0,
        recuperaciones_vacias_1h: 0,
        arrendamientos_vencidos: 0,
      }).status,
      'ok',
    )
  },
)

Deno.test('AI recovery health warns about excessive empty invocations', () => {
  const result = classifyAIGenerationRecoveryHealth({
    cron_activo: true,
    cron_programacion: '*/5 * * * *',
    cron_fallos_1h: 0,
    recuperaciones_errores_1h: 0,
    recuperaciones_1h: 30,
    recuperaciones_vacias_1h: 29,
    arrendamientos_vencidos: 0,
  })

  assertEquals(result.status, 'warning')
})

Deno.test('AI recovery health warns when cron fails or is disabled', () => {
  assertEquals(
    classifyAIGenerationRecoveryHealth({
      cron_activo: false,
      cron_programacion: '*/5 * * * *',
    }).status,
    'warning',
  )
  assertEquals(
    classifyAIGenerationRecoveryHealth({
      cron_activo: true,
      cron_programacion: '*/5 * * * *',
      cron_fallos_1h: 1,
    }).status,
    'warning',
  )
})
