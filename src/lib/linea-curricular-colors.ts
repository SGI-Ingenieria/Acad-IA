/**
 * Paleta de respaldo para líneas antiguas que todavía no tienen color
 * persistido. El orden forma parte de la representación del plan: todas las
 * vistas deben resolver el mismo color para una misma línea.
 */
export const PALETA_LINEAS_CURRICULARES = [
  '#4F46E5',
  '#7C3AED',
  '#EA580C',
  '#059669',
  '#DC2626',
  '#0891B2',
  '#CA8A04',
  '#C026D3',
]

export function colorLineaCurricular(
  linea: { color?: string | null },
  index: number,
): string {
  const colorPersistido = linea.color?.trim()
  if (colorPersistido) return colorPersistido

  const posicion =
    ((Math.trunc(index) % PALETA_LINEAS_CURRICULARES.length) +
      PALETA_LINEAS_CURRICULARES.length) %
    PALETA_LINEAS_CURRICULARES.length

  return PALETA_LINEAS_CURRICULARES[posicion]
}
