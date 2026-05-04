function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function parseContenidoTematicoToPlainText(value: unknown): string {
  if (!Array.isArray(value)) return ''

  const blocks: Array<string> = []

  for (const item of value) {
    if (!isRecord(item)) continue

    const unidad =
      typeof item.unidad === 'number' && Number.isFinite(item.unidad)
        ? item.unidad
        : undefined
    const titulo = typeof item.titulo === 'string' ? item.titulo : ''

    const header = `${unidad ?? ''}${unidad ? '.' : ''} ${titulo}`.trim()
    if (!header) continue

    const lines: Array<string> = [header]

    const temas = Array.isArray(item.temas) ? item.temas : []
    temas.forEach((tema, idx) => {
      const temaNombre =
        typeof tema === 'string'
          ? tema
          : isRecord(tema) && typeof tema.nombre === 'string'
            ? tema.nombre
            : ''
      if (!temaNombre) return

      if (unidad != null) {
        lines.push(`${unidad}.${idx + 1} ${temaNombre}`.trim())
      } else {
        lines.push(`${idx + 1}. ${temaNombre}`)
      }
    })

    blocks.push(lines.join('\n'))
  }

  return blocks.join('\n\n').trimEnd()
}

export function parseCriteriosEvaluacionToPlainText(value: unknown): string {
  if (!Array.isArray(value)) return ''

  const lines: Array<string> = []
  for (const item of value) {
    if (!isRecord(item)) continue
    const label = typeof item.criterio === 'string' ? item.criterio.trim() : ''
    const valueNum =
      typeof item.porcentaje === 'number'
        ? item.porcentaje
        : typeof item.porcentaje === 'string'
          ? Number(item.porcentaje)
          : NaN

    if (!label) continue
    if (!Number.isFinite(valueNum)) continue

    const v = Math.trunc(valueNum)
    if (v < 1 || v > 100) continue

    lines.push(`${label}: ${v}%`)
  }

  return lines.join('\n')
}

export function parseClaveDeLaAsignaturaToPlainText(value: unknown): string {
  if (typeof value === 'string') {
    return value.trim()
  }
  return ''
}

export const columnParsers: Partial<
  Record<string, (value: unknown) => string>
> = {
  contenido_tematico: parseContenidoTematicoToPlainText,
  criterios_de_evaluacion: parseCriteriosEvaluacionToPlainText,
  clave_de_la_asignatura: parseClaveDeLaAsignaturaToPlainText,
}
