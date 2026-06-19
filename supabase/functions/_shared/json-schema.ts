// supabase/functions/_shared/json-schema.ts
/**
 * Normaliza un JSON Schema para que cumpla los requisitos del modo
 * `strict: true` de structured outputs de OpenAI:
 *
 *   - Todo nodo `object` lleva `additionalProperties: false`.
 *   - El `required` de todo nodo `object` lista TODAS las llaves de `properties`.
 *
 * En modo estricto OpenAI no admite campos opcionales: cada propiedad debe ir en
 * `required` (para modelar un valor "opcional" se usa un tipo nullable / `anyOf`
 * con `{ "type": "null" }`). Las definiciones de estructura son editables por el
 * usuario, así que pueden quedar fuera de cumplimiento; esto garantiza un esquema
 * válido en el momento de la petición.
 *
 * Recorre recursivamente `properties`, `items`, `anyOf`, `oneOf`, `allOf`,
 * `$defs`/`definitions`, etc., sin mutar el esquema original.
 */
export function enforceStrictJsonSchema<T>(schema: T): T {
  return normalizeNode(schema) as T
}

function normalizeNode(node: unknown): unknown {
  if (Array.isArray(node)) {
    return node.map(normalizeNode)
  }
  if (node === null || typeof node !== 'object') {
    return node
  }

  const source = node as Record<string, unknown>
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(source)) {
    out[key] = normalizeNode(value)
  }

  // Un nodo es "objeto" si declara `properties` o si su `type` es 'object'.
  const hasProperties =
    typeof out['properties'] === 'object' && out['properties'] !== null
  const isObjectNode = out['type'] === 'object' || hasProperties

  if (isObjectNode) {
    const properties = (out['properties'] ?? {}) as Record<string, unknown>
    out['required'] = Object.keys(properties)
    out['additionalProperties'] = false
  }

  return out
}
