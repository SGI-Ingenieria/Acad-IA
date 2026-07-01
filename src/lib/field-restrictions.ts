export type CampoRestriccion = {
  estados_editables: Array<string>
  visibilidad: 'oculto_hasta_llenarse'
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function readStringArray(value: unknown): Array<string> {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : []
}

export function getCampoRestriccion(schema: unknown): CampoRestriccion | null {
  if (!isRecord(schema)) return null
  const metadata = schema['x-acad-ia']
  if (!isRecord(metadata)) return null
  const restriccion = metadata.restriccion
  if (!isRecord(restriccion)) return null

  const estados = readStringArray(restriccion.estados_editables)

  return {
    estados_editables: estados,
    visibilidad: 'oculto_hasta_llenarse',
  }
}

export function isCampoRestringido(schema: unknown) {
  return getCampoRestriccion(schema) !== null
}

function stripHtml(value: string) {
  return value
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .trim()
}

export function hasFieldValue(value: unknown): boolean {
  if (value === undefined || value === null) return false
  if (typeof value === 'string') return stripHtml(value).length > 0
  if (typeof value === 'number') return Number.isFinite(value)
  if (typeof value === 'boolean') return true
  if (Array.isArray(value)) return value.length > 0
  if (isRecord(value)) {
    if ('description' in value) return hasFieldValue(value.description)
    return Object.keys(value).length > 0
  }
  return true
}

export function canEditRestrictedField({
  schema,
  estadoClave,
  canEditBase,
}: {
  schema: unknown
  estadoClave?: string | null
  canEditBase: boolean
}) {
  const restriccion = getCampoRestriccion(schema)
  if (!restriccion) return false
  if (!estadoClave) return false
  if (!canEditBase) return false
  return restriccion.estados_editables.includes(estadoClave)
}

export function resolveFieldAccess({
  schema,
  value,
  estadoClave,
  canEditBase,
}: {
  schema: unknown
  value: unknown
  estadoClave?: string | null
  canEditBase: boolean
}) {
  const restriccion = getCampoRestriccion(schema)
  if (!restriccion) {
    return { restricted: false, visible: true, canEdit: canEditBase }
  }

  const canEdit = canEditRestrictedField({
    schema,
    estadoClave,
    canEditBase,
  })

  return {
    restricted: true,
    visible: canEdit || hasFieldValue(value),
    canEdit,
  }
}

export function getSchemaType(schema: unknown) {
  if (!isRecord(schema)) return null
  if (Array.isArray(schema.enum)) return 'string'
  if (typeof schema.type === 'string') return schema.type
  if (Array.isArray(schema.type)) {
    return schema.type.find((item) =>
      ['integer', 'number', 'string', 'boolean', 'array', 'object'].includes(
        String(item),
      ),
    )
  }
  return null
}

export function coerceValueForSchema(value: unknown, schema: unknown) {
  const type = getSchemaType(schema)
  if (type !== 'integer' && type !== 'number') return value

  if (value === '' || value === null || value === undefined) return null
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return null
    return type === 'integer' ? Math.trunc(value) : value
  }

  if (typeof value !== 'string') return value

  const trimmed = value.trim()
  if (!trimmed) return null

  const parsed = Number(trimmed)
  if (!Number.isFinite(parsed)) return value

  return type === 'integer' ? Math.trunc(parsed) : parsed
}

export function cloneRestriccion(
  restriccion: CampoRestriccion | undefined,
): CampoRestriccion | undefined {
  if (!restriccion) return undefined
  return {
    ...restriccion,
    estados_editables: [...restriccion.estados_editables],
  }
}
