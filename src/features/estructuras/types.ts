import type { Tables } from '@/types/supabase'

export type EstructuraPlan = Tables<'estructuras_plan'>
export type EstructuraAsignatura = Tables<'estructuras_asignatura'>

export type TipoEstructura = 'CURRICULAR' | 'NO_CURRICULAR'

// Representación interna de un campo (vista de edición)
export type CampoDefinicion = {
  key: string
  titulo: string
  descripcion: string
  tipo?: string | string[]
  enum?: string[]
  ejemplos?: string[]
  referencia_normativa?: string
  x_column?: string
  requerido: boolean
  orden: number
}

// Forma del JSON Schema almacenado en `definicion`
type JsonSchemaDefinicion = {
  type?: string
  required?: string[]
  properties?: Record<string, JsonSchemaProperty>
  additionalProperties?: boolean
  [k: string]: unknown
}

type JsonSchemaProperty = {
  type?: string | string[]
  title?: string
  description?: string
  examples?: unknown[]
  enum?: string[]
  referencia_normativa?: string
  'x-column'?: string
  [k: string]: unknown
}

export function parseCampos(definicion: unknown): CampoDefinicion[] {
  if (!definicion || typeof definicion !== 'object') return []
  const def = definicion as JsonSchemaDefinicion
  const properties = def.properties
  const required: string[] = Array.isArray(def.required) ? def.required : []

  if (!properties || typeof properties !== 'object') return []

  return Object.entries(properties).map(([key, prop], i) => ({
    key,
    titulo: prop.title ?? '',
    descripcion: prop.description ?? '',
    tipo: prop.type,
    enum: Array.isArray(prop.enum) ? prop.enum : undefined,
    ejemplos: Array.isArray(prop.examples)
      ? (prop.examples as string[]).filter((e) => typeof e === 'string')
      : [],
    referencia_normativa: prop.referencia_normativa ?? undefined,
    x_column: prop['x-column'] ?? undefined,
    requerido: required.includes(key),
    orden: i,
  }))
}

export function camposToDefinicion(campos: CampoDefinicion[]): object {
  const properties: Record<string, JsonSchemaProperty> = {}
  const required: string[] = []

  for (const c of campos) {
    const prop: JsonSchemaProperty = {
      type: c.tipo ?? 'string',
      title: c.titulo,
      description: c.descripcion,
    }
    if (c.ejemplos && c.ejemplos.length > 0) prop.examples = c.ejemplos
    if (c.referencia_normativa) prop.referencia_normativa = c.referencia_normativa
    if (c.x_column) prop['x-column'] = c.x_column
    if (c.enum && c.enum.length > 0) prop.enum = c.enum

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
