import type { Tables } from '@/types/supabase'

export type EstructuraPlan = Tables<'estructuras_plan'>
export type EstructuraAsignatura = Tables<'estructuras_asignatura'>

export type TipoEstructura = 'CURRICULAR' | 'NO_CURRICULAR'

// Todo campo de texto es rich text: ya no existe un tipo "richtext" aparte.
export type TipoCampo = 'string' | 'integer' | 'enum'

// Representación interna de un campo (vista de edición)
export type CampoDefinicion = {
  uid?: string // stable React key — never serialized to JSON schema
  key: string
  titulo: string
  descripcion: string
  tipo?: string | Array<string>
  enum?: Array<string>
  ejemplos?: Array<string>
  minimum?: number
  maximum?: number
  referencia_normativa?: string
  requerido: boolean
  orden: number
}

export function getTipoCampo(campo: CampoDefinicion): TipoCampo {
  if (Array.isArray(campo.enum)) return 'enum'
  if (campo.tipo === 'integer' || campo.tipo === 'number') return 'integer'
  // 'string' implica texto enriquecido.
  return 'string'
}

// Forma del JSON Schema almacenado en `definicion`
type JsonSchemaDefinicion = {
  type?: string
  required?: Array<string>
  properties?: Record<string, JsonSchemaProperty>
  additionalProperties?: boolean
  [k: string]: unknown
}

type JsonSchemaProperty = {
  type?: string | Array<string>
  title?: string
  description?: string
  enum?: Array<string>
  minimum?: number
  maximum?: number
  referencia_normativa?: string
  format?: string
  'x-richtext'?: boolean
  [k: string]: unknown
}

export function parseCampos(definicion: unknown): Array<CampoDefinicion> {
  if (!definicion || typeof definicion !== 'object') return []
  const def = definicion as JsonSchemaDefinicion
  const properties = def.properties
  const required: Array<string> = Array.isArray(def.required)
    ? def.required
    : []

  if (!properties || typeof properties !== 'object') return []

  return Object.entries(properties).map(([key, prop], i) => ({
    uid: crypto.randomUUID(),
    key,
    titulo: prop.title ?? '',
    descripcion: prop.description ?? '',
    tipo: prop.type,
    enum: Array.isArray(prop.enum) ? prop.enum : undefined,
    ejemplos: Array.isArray(prop.examples)
      ? (prop.examples as Array<string>).filter((e) => typeof e === 'string')
      : [],
    minimum: typeof prop.minimum === 'number' ? prop.minimum : undefined,
    maximum: typeof prop.maximum === 'number' ? prop.maximum : undefined,
    referencia_normativa: prop.referencia_normativa ?? undefined,
    requerido: required.includes(key),
    orden: i,
  }))
}

export function camposToDefinicion(campos: Array<CampoDefinicion>): object {
  const properties: Record<string, JsonSchemaProperty> = {}
  const required: Array<string> = []

  for (const c of campos) {
    const tipoCampo = getTipoCampo(c)
    const prop: JsonSchemaProperty = {
      type: tipoCampo === 'enum' ? 'string' : (c.tipo ?? 'string'),
      title: c.titulo,
      description: c.descripcion,
    }
    // Un campo de texto (type 'string' sin enum) es rich text por convención;
    // ya no se emite el marcador x-richtext/format:'html'.
    if (tipoCampo === 'enum' && c.enum && c.enum.length > 0) prop.enum = c.enum
    if (tipoCampo === 'integer' && c.minimum !== undefined)
      prop.minimum = c.minimum
    if (tipoCampo === 'integer' && c.maximum !== undefined)
      prop.maximum = c.maximum
    if (tipoCampo === 'string' && c.ejemplos && c.ejemplos.length > 0)
      prop.examples = c.ejemplos
    if (c.referencia_normativa)
      prop.referencia_normativa = c.referencia_normativa

    properties[c.key] = prop
    if (c.requerido) required.push(c.key)
  }

  return {
    type: 'object',
    required,
    properties,
    additionalProperties: false,
  }
}

export function formatFecha(iso: string) {
  return new Date(iso).toLocaleDateString('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}
