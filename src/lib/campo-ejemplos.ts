/**
 * Ejemplo redactado que la estructura normativa adjunta a un campo.
 *
 * En JSON Schema `examples` es **un arreglo**, no una cadena: asignarlo tal cual
 * a un placeholder deja `[object Object]` o, peor, un valor que el consumidor
 * descarta en silencio por no ser texto —que es justo lo que hacía desaparecer
 * los ejemplos de las tarjetas de campo—. Esta función es el único sitio donde
 * se normaliza.
 *
 * Tolera las tres formas que aparecen en estructuras reales: el arreglo
 * canónico, una cadena suelta de estructuras antiguas, y la ausencia total.
 */
export function ejemploDeEsquema(schema: unknown): string {
  if (!schema || typeof schema !== 'object') return ''

  const examples = (schema as Record<string, unknown>).examples

  if (typeof examples === 'string') return examples.trim()

  if (Array.isArray(examples)) {
    const primero = examples.find(
      (item): item is string => typeof item === 'string' && item.trim() !== '',
    )
    return primero?.trim() ?? ''
  }

  return ''
}
