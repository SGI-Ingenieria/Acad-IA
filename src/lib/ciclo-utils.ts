import type { TipoCiclo } from '@/data/types/domain'

/**
 * Nombre singular del tipo de ciclo de un plan, p. ej. "Semestre".
 * Cuando el tipo es "Otro" (o no está definido) se usa el término genérico "Ciclo".
 */
export function nombreTipoCiclo(
  tipoCiclo: TipoCiclo | null | undefined,
): string {
  if (!tipoCiclo || tipoCiclo === 'Otro') return 'Ciclo'
  return tipoCiclo
}

/**
 * Etiqueta de un ciclo concreto según el tipo del plan, p. ej. "Semestre 1"
 * o "Ciclo 3" (cuando el tipo es "Otro").
 */
export function formatCiclo(
  tipoCiclo: TipoCiclo | null | undefined,
  numeroCiclo: number | null | undefined,
): string {
  return `${nombreTipoCiclo(tipoCiclo)} ${numeroCiclo}`
}

/**
 * Etiqueta para una asignatura sin ciclo asignado, p. ej. "Sin semestre asignado".
 */
export function sinCicloLabel(tipoCiclo: TipoCiclo | null | undefined): string {
  return `Sin ${nombreTipoCiclo(tipoCiclo).toLowerCase()} asignado`
}
