import type { HealthStatus } from './edge-health.ts'

type RecoverySummary = Record<string, unknown>

function numeric(summary: RecoverySummary, key: string) {
  const value = Number(summary[key] ?? 0)
  return Number.isFinite(value) ? value : 0
}

export function classifyAIGenerationRecoveryHealth(summary: RecoverySummary): {
  status: HealthStatus
  message: string
} {
  const expiredLeases = numeric(summary, 'arrendamientos_vencidos')
  const cronFailures = numeric(summary, 'cron_fallos_1h')
  const recoveryRuns = numeric(summary, 'recuperaciones_1h')
  const emptyRuns = numeric(summary, 'recuperaciones_vacias_1h')
  const recoveryErrors = numeric(summary, 'recuperaciones_errores_1h')

  if (summary.cron_activo !== true) {
    return {
      status: 'warning',
      message: 'El respaldo programado de generaciones de IA está inactivo.',
    }
  }

  if (summary.cron_programacion !== '*/5 * * * *') {
    return {
      status: 'warning',
      message:
        'El respaldo de generaciones no conserva la frecuencia de 5 minutos.',
    }
  }

  if (cronFailures > 0 || recoveryErrors > 0) {
    return {
      status: 'warning',
      message: `La recuperación registró ${cronFailures + recoveryErrors} falla(s) en la última hora.`,
    }
  }

  if (expiredLeases > 0) {
    return {
      status: 'warning',
      message: `Hay ${expiredLeases} arrendamiento(s) de IA vencido(s).`,
    }
  }

  if (recoveryRuns > 24 && emptyRuns / recoveryRuns >= 0.9) {
    return {
      status: 'warning',
      message: `Se detectaron ${recoveryRuns} recuperaciones en una hora, casi todas vacías.`,
    }
  }

  return {
    status: 'ok',
    message:
      'Webhook principal y respaldo condicionado operando correctamente.',
  }
}
