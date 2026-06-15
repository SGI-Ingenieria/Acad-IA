import type { Database, Json } from './database.types.ts'

type JsonObject = { [k: string]: Json | undefined }

type AsignaturaUpdate = Database['public']['Tables']['asignaturas']['Update']
type TipoAsignatura = Database['public']['Enums']['tipo_asignatura']

type SchemaObject = Record<string, unknown>

type BuildSchemaParams = {
  definicion: unknown
  clonacionTradicional: boolean
}

type ParseOutputParams = {
  aiOutput: unknown
  clonacionTradicional: boolean
}

export type AsignaturaAIGatekeeper = {
  analisis_documento: string
  refusal: string
}

export type AsignaturaAIParsedPatch = {
  gatekeeper?: AsignaturaAIGatekeeper
  patch: Pick<
    AsignaturaUpdate,
    | 'datos'
    | 'codigo'
    | 'contenido_tematico'
    | 'criterios_de_evaluacion'
    | 'nombre'
    | 'tipo'
    | 'numero_ciclo'
    | 'horas_academicas'
    | 'horas_independientes'
  >
}

export const TIPO_ASIGNATURA_VALUES = [
  'OBLIGATORIA',
  'OPTATIVA',
  'TRONCAL',
  'OTRA',
] as const satisfies ReadonlyArray<TipoAsignatura>

const TIPO_ASIGNATURA_SET = new Set<string>(TIPO_ASIGNATURA_VALUES)

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isJsonObject(value: unknown): value is JsonObject {
  return isRecord(value)
}

function nonEmptyString(value: unknown): string | undefined {
  if (typeof value !== 'string') return
  const trimmed = value.trim()
  return trimmed.length ? trimmed : undefined
}

function tipoAsignatura(value: unknown): TipoAsignatura | undefined {
  if (typeof value !== 'string') return
  const normalized = value.trim().toUpperCase()
  if (!normalized.length) return
  if (!TIPO_ASIGNATURA_SET.has(normalized)) return
  return normalized as TipoAsignatura
}

function nullableString(value: unknown): string | null | undefined {
  if (value === null) return null
  return nonEmptyString(value)
}

function finiteNumber(value: unknown): number | undefined {
  if (typeof value !== 'number') return
  if (!Number.isFinite(value)) return
  return value
}

function positiveNumber(value: unknown): number | undefined {
  const n = finiteNumber(value)
  if (n === undefined) return
  return n > 0 ? n : undefined
}

function nonNegativeIntegerOrNull(value: unknown): number | null | undefined {
  if (value === null) return null
  if (typeof value !== 'number') return
  if (!Number.isFinite(value)) return
  if (!Number.isInteger(value)) return
  return value >= 0 ? value : undefined
}

function positiveIntegerOrNull(value: unknown): number | null | undefined {
  if (value === null) return null
  if (typeof value !== 'number') return
  if (!Number.isFinite(value)) return
  if (!Number.isInteger(value)) return
  return value > 0 ? value : undefined
}

function jsonArray(value: unknown): Json | undefined {
  if (!Array.isArray(value)) return
  return value as unknown as Json
}

function jsonObject(value: unknown): Json | undefined {
  if (!isJsonObject(value)) return
  return value as unknown as Json
}

function getColumnValueSchema(column: string): SchemaObject | null {
  switch (column) {
    case 'contenido_tematico':
      return {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            unidad: { type: 'integer' },
            titulo: { type: 'string' },
            temas: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  nombre: { type: 'string' },
                  horasEstimadas: { type: 'integer' },
                },
                required: ['nombre', 'horasEstimadas'],
                additionalProperties: false,
              },
            },
          },
          required: ['unidad', 'titulo', 'temas'],
          additionalProperties: false,
        },
      }
    case 'criterios_de_evaluacion':
      return {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            criterio: { type: 'string' },
            porcentaje: { type: 'integer' },
          },
          required: ['criterio', 'porcentaje'],
          additionalProperties: false,
        },
      }
    case 'codigo':
      return { anyOf: [{ type: 'string' }, { type: 'null' }] }
    default:
      return null
  }
}

function buildDatosSchemaFromDefinicion(definicion: unknown): {
  schema: SchemaObject
  xColumnKeys: Set<string>
} {
  const empty = {
    schema: {
      type: 'object',
      properties: {},
      required: [],
      additionalProperties: false,
    },
    xColumnKeys: new Set<string>(),
  }

  if (!isRecord(definicion)) return empty

  const propsRaw = definicion.properties
  if (!isRecord(propsRaw)) return empty

  const requiredRaw = Array.isArray(definicion.required)
    ? definicion.required.filter((x) => typeof x === 'string')
    : []

  const datosProps: Record<string, unknown> = {}
  const datosRequired: Array<string> = []
  const xColumnKeys = new Set<string>()

  for (const [key, prop] of Object.entries(propsRaw)) {
    if (!isRecord(prop)) continue
    const xColumn = prop['x-column']
    if (typeof xColumn === 'string' && xColumn.length) {
      xColumnKeys.add(key)
      continue
    }

    // Copy prop as-is into datos (no x-column)
    datosProps[key] = prop
    if (requiredRaw.includes(key)) datosRequired.push(key)
  }

  return {
    schema: {
      type: 'object',
      properties: datosProps,
      required: datosRequired,
      additionalProperties: false,
    },
    xColumnKeys,
  }
}

function buildTopLevelColumnsSchemaFromDefinicion(definicion: unknown): {
  schemaProps: Record<string, unknown>
  requiredKeys: Array<string>
} {
  const schemaProps: Record<string, unknown> = {}
  const requiredKeys: Array<string> = []

  if (!isRecord(definicion)) return { schemaProps, requiredKeys }

  const propsRaw = definicion.properties
  if (!isRecord(propsRaw)) return { schemaProps, requiredKeys }

  const requiredRaw = Array.isArray(definicion.required)
    ? definicion.required.filter((x) => typeof x === 'string')
    : []

  for (const [key, prop] of Object.entries(propsRaw)) {
    if (!isRecord(prop)) continue
    const xColumn = prop['x-column']
    if (typeof xColumn !== 'string' || !xColumn.length) continue

    const valueSchema = getColumnValueSchema(xColumn) ?? {
      // Fallback: if the property schema is already something usable, prefer it.
      ...prop,
      // but ensure x-column does not leak to the model output
      'x-column': undefined,
    }

    schemaProps[xColumn] = valueSchema
    if (requiredRaw.includes(key)) requiredKeys.push(xColumn)
  }

  return { schemaProps, requiredKeys }
}

function ensureAllRequired(schema: SchemaObject): void {
  const props = schema.properties
  if (!isRecord(props)) return
  schema.required = Object.keys(props)
}

export function buildAsignaturaUpdateJsonSchema({
  definicion,
  clonacionTradicional,
}: BuildSchemaParams): SchemaObject {
  const { schema: datosSchema } = buildDatosSchemaFromDefinicion(definicion)
  const { schemaProps: columnasDesdeDef, requiredKeys: requiredColumnKeys } =
    buildTopLevelColumnsSchemaFromDefinicion(definicion)

  const baseProps: Record<string, unknown> = {
    datos: datosSchema,
    ...columnasDesdeDef,
    // Always generate codigo as part of the DB patch.
    codigo: getColumnValueSchema('codigo')!,
    // These two are always needed in both flows
    contenido_tematico: getColumnValueSchema('contenido_tematico')!,
    criterios_de_evaluacion: getColumnValueSchema('criterios_de_evaluacion')!,
  }

  const cloneExtraProps: Record<string, unknown> = clonacionTradicional
    ? {
        nombre: { type: 'string' },
        tipo: { type: 'string', enum: TIPO_ASIGNATURA_VALUES },
        numero_ciclo: { anyOf: [{ type: 'integer' }, { type: 'null' }] },
        horas_academicas: { anyOf: [{ type: 'integer' }, { type: 'null' }] },
        horas_independientes: {
          anyOf: [{ type: 'integer' }, { type: 'null' }],
        },
      }
    : {}

  const schema: SchemaObject = {
    type: 'object',
    additionalProperties: false,
    properties: {
      ...(clonacionTradicional
        ? {
            analisis_documento: { type: 'string' },
            refusal: { type: 'string' },
          }
        : {}),
      ...baseProps,
      ...cloneExtraProps,
    },
  }

  // If a column was required in the definicion, ensure it is required in output too.
  // Note: OpenAI strict mode currently expects top-level required to include every key.
  // We still keep an internal required list in datos to enforce content.
  ensureAllRequired(schema)

  // Also enforce required inside datos schema (as provided by the definition).
  // Ensure the base-level required for definicion-mapped columns is not lost (debug aid).
  void requiredColumnKeys

  return schema
}

type Spec<TKey extends keyof AsignaturaAIParsedPatch['patch']> = {
  key: TKey
  parse: (value: unknown) => AsignaturaAIParsedPatch['patch'][TKey] | undefined
  required: boolean
}

const BASE_SPECS: Array<Spec<any>> = [
  { key: 'datos', parse: (v) => jsonObject(v), required: true },
  { key: 'codigo', parse: (v) => nullableString(v), required: true },
  {
    key: 'contenido_tematico',
    parse: (v) => jsonArray(v),
    required: true,
  },
  {
    key: 'criterios_de_evaluacion',
    parse: (v) => jsonArray(v),
    required: true,
  },
]

const CLONE_SPECS: Array<Spec<any>> = [
  { key: 'nombre', parse: (v) => nonEmptyString(v), required: true },
  { key: 'tipo', parse: (v) => tipoAsignatura(v), required: true },
  {
    key: 'numero_ciclo',
    parse: (v) => positiveIntegerOrNull(v),
    required: true,
  },
  {
    key: 'horas_academicas',
    parse: (v) => nonNegativeIntegerOrNull(v),
    required: true,
  },
  {
    key: 'horas_independientes',
    parse: (v) => nonNegativeIntegerOrNull(v),
    required: true,
  },
]

export function parseAsignaturaAIOutputToUpdatePatch({
  aiOutput,
  clonacionTradicional,
}: ParseOutputParams):
  | { ok: true; value: AsignaturaAIParsedPatch }
  | { ok: false; error: { code: string; message: string; extra?: unknown } } {
  if (!isRecord(aiOutput)) {
    return {
      ok: false,
      error: {
        code: 'AI_OUTPUT_NOT_OBJECT',
        message: 'El output de IA no es un objeto JSON.',
        extra: { aiOutputType: typeof aiOutput },
      },
    }
  }

  const record = aiOutput

  const gatekeeper: AsignaturaAIGatekeeper | undefined = clonacionTradicional
    ? {
        analisis_documento:
          typeof record.analisis_documento === 'string'
            ? record.analisis_documento
            : '',
        refusal: typeof record.refusal === 'string' ? record.refusal : '',
      }
    : undefined

  const specs = clonacionTradicional
    ? [...BASE_SPECS, ...CLONE_SPECS]
    : BASE_SPECS

  const patch: Record<string, unknown> = {}
  const missing: Array<string> = []

  for (const spec of specs) {
    const parsed = spec.parse(record[spec.key as string])
    if (parsed === undefined) {
      if (spec.required) missing.push(String(spec.key))
      continue
    }
    patch[spec.key as string] = parsed
  }

  if (missing.length) {
    return {
      ok: false,
      error: {
        code: 'AI_OUTPUT_MISSING_REQUIRED',
        message: `Faltan campos requeridos en output IA: ${missing.join(', ')}`,
        extra: { missing },
      },
    }
  }

  return {
    ok: true,
    value: {
      gatekeeper,
      patch: patch as AsignaturaAIParsedPatch['patch'],
    },
  }
}
