// supabase/functions/_shared/json-schema.ts
import { isRecord } from './value.ts'

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

export function stripRestrictedJsonSchemaProperties<T>(schema: T): T {
  return stripRestrictedNode(schema) as T
}

type JsonObjectTransform = (
  source: Record<string, unknown>,
  recurse: (value: unknown) => unknown,
) => unknown

function transformJsonNode(
  node: unknown,
  transformObject: JsonObjectTransform,
): unknown {
  if (Array.isArray(node)) {
    return node.map((value) => transformJsonNode(value, transformObject))
  }
  if (!isRecord(node)) return node

  return transformObject(node, (value) =>
    transformJsonNode(value, transformObject),
  )
}

function normalizeNode(node: unknown): unknown {
  return transformJsonNode(node, (source, recurse) => {
    const out = Object.fromEntries(
      Object.entries(source).map(([key, value]) => [key, recurse(value)]),
    )

    // Un nodo es "objeto" si declara `properties` o si su `type` es 'object'.
    const hasProperties = isRecord(out.properties)
    const isObjectNode = out.type === 'object' || hasProperties

    if (isObjectNode) {
      const properties = isRecord(out.properties) ? out.properties : {}
      out.required = Object.keys(properties)
      out.additionalProperties = false
    }

    return out
  })
}

function stripRestrictedNode(node: unknown): unknown {
  return transformJsonNode(node, (source, recurse) => {
    const out: Record<string, unknown> = {}

    for (const [key, value] of Object.entries(source)) {
      // Los metadatos propietarios nunca deben viajar al esquema de OpenAI.
      if (key === 'x-acad-ia') continue

      // Filtra las propiedades restringidas evaluando la restricción sobre el
      // nodo ORIGINAL (todavía con `x-acad-ia`). Debe hacerse ANTES de recursar:
      // la recursión elimina `x-acad-ia`, así que evaluar después nunca detectaría
      // la restricción y el campo restringido se colaría al esquema.
      if (key === 'properties' && isRecord(value)) {
        const filtered: Record<string, unknown> = {}
        for (const [propKey, prop] of Object.entries(value)) {
          if (hasRestrictedMetadata(prop)) continue
          filtered[propKey] = recurse(prop)
        }
        out.properties = filtered
        continue
      }

      out[key] = recurse(value)
    }

    // Depura `required` para no exigir propiedades que acabamos de eliminar.
    if (Array.isArray(out.required) && isRecord(out.properties)) {
      const props = out.properties
      out.required = out.required.filter(
        (key): key is string =>
          typeof key === 'string' &&
          Object.prototype.hasOwnProperty.call(props, key),
      )
    }

    return out
  })
}

function hasRestrictedMetadata(value: unknown) {
  if (!isRecord(value)) return false
  const metadata = value['x-acad-ia']
  if (!isRecord(metadata)) return false
  return isRecord(metadata.restriccion)
}
