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
  resolve: (ctx: Ctx) => unknown
}

function isRecord(value: unknown): value is Rec {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function asArray(value: unknown): Array<unknown> {
  return Array.isArray(value) ? value : []
}

// ── Plan de estudios ───────────────────────────────────────────────────────

export type PlanCtx = {
  plan: Rec | null
  carrera: Rec | null
}

export const CAMPOS_SIEMPRE_PLAN: ReadonlyArray<CampoSiempre<PlanCtx>> = [
  { key: 'nombre', resolve: (c) => c.plan?.nombre },
  { key: 'nivel', resolve: (c) => c.carrera?.nivel },
  { key: 'carrera', resolve: (c) => c.carrera?.nombre },
  { key: 'numero_ciclos', resolve: (c) => c.plan?.numero_ciclos },
  { key: 'tipo_ciclo', resolve: (c) => c.plan?.tipo_ciclo },
  { key: 'clave_sep', resolve: (c) => c.carrera?.clave_sep },
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
  { key: 'nombre', resolve: (c) => c.asig.nombre },
  { key: 'codigo', resolve: (c) => c.asig.codigo },
  { key: 'creditos', resolve: (c) => c.asig.creditos },
  { key: 'tipo', resolve: (c) => c.asig.tipo },
  { key: 'numero_ciclo', resolve: (c) => c.asig.numero_ciclo },
  { key: 'horas_academicas', resolve: (c) => c.asig.horas_academicas },
  { key: 'horas_independientes', resolve: (c) => c.asig.horas_independientes },
  { key: 'contenido_tematico', resolve: (c) => asArray(c.asig.contenido_tematico) },
  {
    key: 'criterios_de_evaluacion',
    resolve: (c) => asArray(c.asig.criterios_de_evaluacion),
  },
  { key: 'bibliografia_basica', resolve: (c) => c.bibliografia_basica },
  {
    key: 'bibliografia_complementaria',
    resolve: (c) => c.bibliografia_complementaria,
  },
  { key: 'nivel', resolve: (c) => c.carrera?.nivel },
  { key: 'carrera', resolve: (c) => c.carrera?.nombre },
  { key: 'clave_sep', resolve: (c) => c.carrera?.clave_sep },
  { key: 'nombre_plan', resolve: (c) => c.plan?.nombre },
  { key: 'numero_ciclos', resolve: (c) => c.plan?.numero_ciclos },
  { key: 'tipo_ciclo', resolve: (c) => c.plan?.tipo_ciclo },
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
    for (const key of Object.keys(props)) {
      if (key in out) continue // la fija ya ganó
      const value = isRecord(datos) ? datos[key] : undefined
      out[key] = value ?? null
    }
  }

  return out
}
