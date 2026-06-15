/**
 * Calcula los créditos de una asignatura según el Acuerdo 17/11/17, Art. 11 + Anexo 2.
 * Cada hora efectiva vale 0.0625 créditos (1/16).
 * El resultado se expresa a centésimas, SIN redondear (truncamiento).
 */
export function calcularCreditos(
  horasAcademicas: number | null | undefined,
  horasIndependientes: number | null | undefined,
): number {
  const total = (horasAcademicas ?? 0) + (horasIndependientes ?? 0)
  return Math.floor((total / 16) * 100) / 100
}

export function formatCreditos(creditos: number): string {
  return creditos.toFixed(2)
}
