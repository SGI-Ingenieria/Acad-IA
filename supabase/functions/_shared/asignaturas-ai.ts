import type { Database, Json } from './database.types.ts'
import {
  enforceStrictJsonSchema,
  stripRestrictedJsonSchemaProperties,
} from './json-schema.ts'

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

/**
 * Columnas reales de la asignatura que SIEMPRE viajan como campos propios del
 * patch (no como parte de `datos`). Por convención se resuelven por su llave;
 * si una estructura las declarara, se omiten de `datos` para no duplicarlas.
 */
const COLUMNAS_SIEMPRE_INCLUIDAS = new Set<string>([
  'contenido_tematico',
  'criterios_de_evaluacion',
  'codigo',
])

function buildDatosSchemaFromDefinicion(definicion: unknown): SchemaObject {
  const empty: SchemaObject = {
    type: 'object',
    properties: {},
    required: [],
    additionalProperties: false,
  }

  if (!isRecord(definicion)) return empty

  const definicionFiltrada = stripRestrictedJsonSchemaProperties(definicion)

  const propsRaw = definicionFiltrada.properties
  if (!isRecord(propsRaw)) return empty

  const datosProps: Record<string, unknown> = {}

  for (const [key, prop] of Object.entries(propsRaw)) {
    if (!isRecord(prop)) continue
    // Las columnas siempre incluidas no se declaran dentro de `datos`.
    if (COLUMNAS_SIEMPRE_INCLUIDAS.has(key)) continue

    datosProps[key] = prop
  }

  // `required` lo fija después `enforceStrictJsonSchema` con TODAS las llaves:
  // en modo estricto OpenAI no admite propiedades opcionales, así que el
  // `required` de la definición de la estructura no se puede propagar tal cual.
  return {
    type: 'object',
    properties: datosProps,
    required: [],
    additionalProperties: false,
  }
}

export function buildAsignaturaUpdateJsonSchema({
  definicion,
  clonacionTradicional,
}: BuildSchemaParams): SchemaObject {
  const datosSchema = buildDatosSchemaFromDefinicion(definicion)

  const baseProps: Record<string, unknown> = {
    datos: datosSchema,
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

  // Normalización recursiva, no sólo del nivel superior: `datos` se construye a
  // partir de la definición de la estructura, que el usuario edita libremente, y
  // OpenAI rechaza el esquema entero si *cualquier* nodo objeto tiene una
  // propiedad fuera de su `required` («Missing 'hola'»). Es la misma llamada que
  // ya hace `ai-generate-plan`; antes aquí sólo se arreglaba la raíz, así que
  // cualquier campo personalizado nuevo rompía la generación.
  return enforceStrictJsonSchema(schema)
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
