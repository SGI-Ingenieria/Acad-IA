/**
 * Registro canónico de "campos siempre incluidos" + constructor determinista
 * del JSON que se envía a Carbone.IO.
 *
 * Convención (fuente de verdad: la estructura):
 *   JSON = campos siempre incluidos (resueltos por su llave) + campos de la
 *          estructura (definicion.properties → datos[key] ?? null).
 *
 * La LLAVE es el mapeo: `nivel`→carreras.nivel, `contenido_tematico`→su columna,
 * `bibliografia_*`→tabla de bibliografía. No existe `x-column`: una llave fija
 * siempre apunta, por convención, a su fuente canónica.
 */

type Rec = Record<string, unknown>

type CampoSiempre<Ctx> = {
  key: string
  title: string
  resolve: (ctx: Ctx) => unknown
}

export type FieldMeta = {
  key: string
  title: string
  isAlways: boolean
  isRichtext: boolean
}

function isRecord(value: unknown): value is Rec {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function asArray(value: unknown): Array<unknown> {
  return Array.isArray(value) ? value : []
}

function isRichtextSchema(schema: unknown): boolean {
  return (
    isRecord(schema) &&
    (schema['x-richtext'] === true || schema.format === 'html')
  )
}

export function stripHtmlToText(value: unknown): string {
  if (typeof value !== 'string') return value == null ? '' : String(value)

  return value
    .replace(/<\s*br\s*\/?\s*>/gi, '\n')
    .replace(/<\/\s*(p|h1|h2|h3|li|blockquote|pre)\s*>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#039;/gi, "'")
    .replace(/&apos;/gi, "'")
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

// ── Plan de estudios ───────────────────────────────────────────────────────

export type PlanCtx = {
  plan: Rec | null
  carrera: Rec | null
}

export const CAMPOS_SIEMPRE_PLAN: ReadonlyArray<CampoSiempre<PlanCtx>> = [
  { key: 'nombre', title: 'Nombre', resolve: (c) => c.plan?.nombre },
  { key: 'nivel', title: 'Nivel', resolve: (c) => c.carrera?.nivel },
  { key: 'carrera', title: 'Carrera', resolve: (c) => c.carrera?.nombre },
  {
    key: 'numero_ciclos',
    title: 'Número de ciclos',
    resolve: (c) => c.plan?.numero_ciclos,
  },
  {
    key: 'tipo_ciclo',
    title: 'Tipo de ciclo',
    resolve: (c) => c.plan?.tipo_ciclo,
  },
  {
    key: 'clave_sep',
    title: 'Clave SEP',
    resolve: (c) => c.carrera?.clave_sep,
  },
]

// ── Asignatura ───────────────────────────────────────────────────────────────

export type AsignaturaCtx = {
  asig: Rec
  plan: Rec | null
  carrera: Rec | null
  bibliografia_basica: Array<unknown>
  bibliografia_complementaria: Array<unknown>
}

export const CAMPOS_SIEMPRE_ASIGNATURA: ReadonlyArray<
  CampoSiempre<AsignaturaCtx>
> = [
  { key: 'nombre', title: 'Nombre', resolve: (c) => c.asig.nombre },
  { key: 'codigo', title: 'Código', resolve: (c) => c.asig.codigo },
  { key: 'creditos', title: 'Créditos', resolve: (c) => c.asig.creditos },
  { key: 'tipo', title: 'Tipo', resolve: (c) => c.asig.tipo },
  {
    key: 'numero_ciclo',
    title: 'Número de ciclo',
    resolve: (c) => c.asig.numero_ciclo,
  },
  {
    key: 'horas_academicas',
    title: 'Horas académicas',
    resolve: (c) => c.asig.horas_academicas,
  },
  {
    key: 'horas_independientes',
    title: 'Horas independientes',
    resolve: (c) => c.asig.horas_independientes,
  },
  {
    key: 'contenido_tematico',
    title: 'Contenido temático',
    resolve: (c) => asArray(c.asig.contenido_tematico),
  },
  {
    key: 'criterios_de_evaluacion',
    title: 'Criterios de evaluación',
    resolve: (c) => asArray(c.asig.criterios_de_evaluacion),
  },
  {
    key: 'bibliografia_basica',
    title: 'Bibliografía básica',
    resolve: (c) => c.bibliografia_basica,
  },
  {
    key: 'bibliografia_complementaria',
    title: 'Bibliografía complementaria',
    resolve: (c) => c.bibliografia_complementaria,
  },
  { key: 'nivel', title: 'Nivel', resolve: (c) => c.carrera?.nivel },
  { key: 'carrera', title: 'Carrera', resolve: (c) => c.carrera?.nombre },
  {
    key: 'clave_sep',
    title: 'Clave SEP',
    resolve: (c) => c.carrera?.clave_sep,
  },
  {
    key: 'nombre_plan',
    title: 'Nombre del plan',
    resolve: (c) => c.plan?.nombre,
  },
  {
    key: 'numero_ciclos',
    title: 'Número de ciclos',
    resolve: (c) => c.plan?.numero_ciclos,
  },
  {
    key: 'tipo_ciclo',
    title: 'Tipo de ciclo',
    resolve: (c) => c.plan?.tipo_ciclo,
  },
]

/** Llaves reservadas: no se pueden declarar como campo de estructura. */
export const RESERVED_KEYS_PLAN: ReadonlySet<string> = new Set(
  CAMPOS_SIEMPRE_PLAN.map((c) => c.key),
)
export const RESERVED_KEYS_ASIGNATURA: ReadonlySet<string> = new Set(
  CAMPOS_SIEMPRE_ASIGNATURA.map((c) => c.key),
)

/**
 * Arma el objeto `data` determinista: campos siempre incluidos (valor canónico
 * o `null`) + cada campo declarado en la estructura (`datos[key] ?? null`).
 * Una llave fija nunca es pisada por `datos`. Las claves de `datos` que no estén
 * declaradas en la estructura se ignoran (la estructura es la fuente de verdad).
 */
export function construirDatos<Ctx>(
  camposSiempre: ReadonlyArray<CampoSiempre<Ctx>>,
  ctx: Ctx,
  definicion: unknown,
  datos: unknown,
  options: { stripRichtext?: boolean } = {},
): Record<string, unknown> {
  const out: Record<string, unknown> = {}

  for (const campo of camposSiempre) {
    const value = campo.resolve(ctx)
    out[campo.key] = value ?? null
  }

  const props =
    isRecord(definicion) && isRecord(definicion.properties)
      ? definicion.properties
      : null

  if (props) {
    for (const [key, schema] of Object.entries(props)) {
      if (key in out) continue // la fija ya ganó
      const value = isRecord(datos) ? datos[key] : undefined
      out[key] =
        options.stripRichtext && isRichtextSchema(schema)
          ? stripHtmlToText(value)
          : (value ?? null)
    }
  }

  return out
}

/**
 * Construye el array de metadatos de campos para el preview:
 * campos siempre incluidos (con sus títulos fijos) + campos de la estructura
 * (con el title del JSON Schema, o la clave como fallback).
 */
export function construirMetadata<Ctx>(
  camposSiempre: ReadonlyArray<CampoSiempre<Ctx>>,
  definicion: unknown,
): FieldMeta[] {
  const meta: FieldMeta[] = []
  const siempreKeys = new Set<string>()

  for (const campo of camposSiempre) {
    meta.push({
      key: campo.key,
      title: campo.title,
      isAlways: true,
      isRichtext: false,
    })
    siempreKeys.add(campo.key)
  }

  const props =
    isRecord(definicion) && isRecord(definicion.properties)
      ? definicion.properties
      : null

  if (props) {
    for (const [key, schema] of Object.entries(props)) {
      if (siempreKeys.has(key)) continue
      const title =
        isRecord(schema) && typeof schema.title === 'string'
          ? schema.title
          : key
      meta.push({
        key,
        title,
        isAlways: false,
        isRichtext: isRichtextSchema(schema),
      })
    }
  }

  return meta
}
