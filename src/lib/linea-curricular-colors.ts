/**
 * Paleta de respaldo para líneas antiguas que todavía no tienen color
 * persistido. El orden forma parte de la representación del plan: todas las
 * vistas deben resolver el mismo color para una misma línea.
 */
export const PALETA_LINEAS_CURRICULARES = [
  '#4F46E5',
  '#7C3AED',
  '#9333EA',
  '#C026D3',
  '#DB2777',
  '#E11D48',
  '#059669',
  '#16A34A',
  '#65A30D',
  '#CA8A04',
  '#D97706',
  '#EA580C',
  '#DC2626',
  '#0D9488',
  '#0891B2',
  '#0284C7',
  '#2563EB',
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

function normalizarHex(color: string): string {
  return color.trim().toUpperCase()
}

function hslAHex(hue: number, saturation = 68, lightness = 45): string {
  const s = saturation / 100
  const l = lightness / 100
  const chroma = (1 - Math.abs(2 * l - 1)) * s
  const segment = (((hue % 360) + 360) % 360) / 60
  const x = chroma * (1 - Math.abs((segment % 2) - 1))
  const [red, green, blue] =
    segment < 1
      ? [chroma, x, 0]
      : segment < 2
        ? [x, chroma, 0]
        : segment < 3
          ? [0, chroma, x]
          : segment < 4
            ? [0, x, chroma]
            : segment < 5
              ? [x, 0, chroma]
              : [chroma, 0, x]
  const match = l - chroma / 2
  const canal = (value: number) =>
    Math.round((value + match) * 255)
      .toString(16)
      .padStart(2, '0')

  return `#${canal(red)}${canal(green)}${canal(blue)}`.toUpperCase()
}

/**
 * Elige un color todavía libre. Al agotar la paleta, usa el ángulo áureo para
 * seguir separando visualmente bloques consecutivos sin depender del orden de
 * montaje de una vista.
 */
export function siguienteColorLineaCurricular(
  coloresUsados: Array<string | null | undefined>,
  random: () => number = Math.random,
): string {
  const usados = new Set(
    coloresUsados
      .filter((color): color is string => Boolean(color?.trim()))
      .map(normalizarHex),
  )
  const disponibles = PALETA_LINEAS_CURRICULARES.filter(
    (color) => !usados.has(normalizarHex(color)),
  )

  if (disponibles.length > 0) {
    return disponibles[Math.floor(random() * disponibles.length)]
  }

  const semilla = Math.floor(random() * 360)
  for (let intento = 1; intento <= 360; intento += 1) {
    const candidato = hslAHex(semilla + intento * 137.508)
    if (!usados.has(candidato)) return candidato
  }

  return hslAHex(semilla)
}
