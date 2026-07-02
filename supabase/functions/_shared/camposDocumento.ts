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

function planDisplayName(plan: Rec | null): unknown {
  return plan?.nombre_display ?? plan?.nombre_propuesto ?? plan?.nombre
}

function isRichtextSchema(schema: unknown): boolean {
  if (!isRecord(schema)) return false
  // Todo campo de texto (type 'string' sin enum) es rich text por convención.
  if (schema.type === 'string' && !Array.isArray(schema.enum)) return true
  // Compatibilidad con estructuras antiguas que aún declaran el marcador.
  return schema['x-richtext'] === true || schema.format === 'html'
}

export function collectRichtextKeys(definicion: unknown): string[] {
  const props =
    isRecord(definicion) && isRecord(definicion.properties)
      ? definicion.properties
      : null

  if (!props) return []

  return Object.entries(props)
    .filter(([, schema]) => isRichtextSchema(schema))
    .map(([key]) => key)
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

const UNSAFE_BLOCK_RE =
  /<\s*(script|style|iframe|object|embed|svg|math)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi
const UNSAFE_SELF_CLOSING_RE =
  /<\s*(script|style|iframe|object|embed|svg|math)[^>]*\/?\s*>/gi
const HTML_COMMENT_RE = /<!--[\s\S]*?-->/g
const HTML_EVENT_ATTR_RE = /\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi
const JAVASCRIPT_HREF_RE = /\s+href\s*=\s*("|')?\s*javascript:[^"'\s>]*(\1)?/gi
const TAG_RE = /<\/?([a-zA-Z][a-zA-Z0-9]*)\b[^>]*>/g
const ALLOWED_RICHTEXT_TAGS = new Set([
  'a',
  'b',
  'blockquote',
  'br',
  'code',
  'del',
  'em',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'i',
  'li',
  'ol',
  'p',
  'pre',
  's',
  'strong',
  'u',
  'ul',
])

function sanitizeStyleAttribute(rawStyle: string): string | null {
  const declarations = rawStyle
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)

  const safe = declarations.filter((decl) => {
    const [property, ...valueParts] = decl.split(':')
    const prop = property?.trim().toLowerCase()
    const value = valueParts.join(':').trim()
    if (!prop || !value) return false
    if (prop !== 'color' && prop !== 'background-color') return false
    return !/url\s*\(|expression\s*\(|javascript:/i.test(value)
  })

  return safe.length ? safe.join('; ') : null
}

function sanitizeRichtextTag(tag: string, tagName: string): string {
  const lower = tagName.toLowerCase()
  if (!ALLOWED_RICHTEXT_TAGS.has(lower)) return ''
  if (tag.startsWith('</')) return `</${lower}>`
  if (lower === 'br') return '<br>'

  const attributes: string[] = []
  const href = tag.match(/\s+href\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/i)
  if (lower === 'a' && href) {
    const url = href[2] ?? href[3] ?? href[4] ?? ''
    if (/^(https?:|mailto:|tel:|#|\/)/i.test(url)) {
      attributes.push(`href="${url.replace(/"/g, '&quot;')}"`)
    }
  }

  const style = tag.match(/\s+style\s*=\s*("([^"]*)"|'([^']*)')/i)
  if (style) {
    const safeStyle = sanitizeStyleAttribute(style[2] ?? style[3] ?? '')
    if (safeStyle) attributes.push(`style="${safeStyle}"`)
  }

  return `<${lower}${attributes.length ? ` ${attributes.join(' ')}` : ''}>`
}

export function sanitizeRichtextForDocument(value: unknown): string {
  if (typeof value !== 'string') return value == null ? '' : String(value)

  return value
    .replace(HTML_COMMENT_RE, '')
    .replace(UNSAFE_BLOCK_RE, '')
    .replace(UNSAFE_SELF_CLOSING_RE, '')
    .replace(HTML_EVENT_ATTR_RE, '')
    .replace(JAVASCRIPT_HREF_RE, '')
    .replace(TAG_RE, (tag, tagName: string) =>
      sanitizeRichtextTag(tag, tagName),
    )
    .trim()
}

// ── Plan de estudios ───────────────────────────────────────────────────────

export type PlanCtx = {
  plan: Rec | null
  carrera: Rec | null
}

export const CAMPOS_SIEMPRE_PLAN: ReadonlyArray<CampoSiempre<PlanCtx>> = [
  { key: 'nombre', title: 'Nombre', resolve: (c) => planDisplayName(c.plan) },
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
    resolve: (c) => planDisplayName(c.plan),
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
  options: { richtextMode?: 'preserve' | 'plain' | 'documentHtml' } = {},
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
      if (isRichtextSchema(schema)) {
        if (options.richtextMode === 'plain') {
          out[key] = stripHtmlToText(value)
          continue
        }
        if (options.richtextMode === 'documentHtml') {
          out[key] = sanitizeRichtextForDocument(value)
          continue
        }
      }
      out[key] = value ?? null
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
