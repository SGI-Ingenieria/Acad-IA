const AI_DISABLED_PLAN_STATES = new Set([
  'REV_PLANEACION',
  'CONSULTA_EXPERTOS',
  'REV_SEDES',
  'CONSEJO_FACULTAD',
  'CONSEJO_UNIVERSITARIO',
  'JUNTA_GOBIERNO',
  'ENVIADO_SEP',
  'APROBADO',
  'RECHAZADO',
])

export function isPlanAIBlockedState(state: unknown): boolean {
  return AI_DISABLED_PLAN_STATES.has(String(state ?? ''))
}
