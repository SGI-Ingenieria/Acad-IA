/**
 * Los tres fundamentos del plan: perfil de ingreso, perfil de egreso y fines
 * de aprendizaje.
 *
 * No son campos más de la estructura. Son el punto de partida del que se
 * derivan las líneas, los ciclos y las asignaturas, y por eso «Datos
 * generales» los ordena primero, los pinta sobre su propia superficie y ofrece
 * leerlos juntos en solo lectura.
 *
 * La identificación es **semántica**, no por nombre de clave: cada estructura
 * normativa nombra sus propiedades como quiere, así que el vínculo estable es
 * `x-acad-ia.semantic-key` dentro del JSON Schema. La clave literal sólo se usa
 * como red de seguridad para las estructuras antiguas que aún no la declaran.
 */
export const FUNDAMENTOS_PLAN = [
  {
    semanticKey: 'perfil_ingreso',
    fallbackKey: 'perfil_de_ingreso',
    label: 'Perfil de ingreso',
    placeholder:
      '¿Con qué conocimientos, experiencia y condiciones llega quien empieza este plan? Descríbelo como lo reconocerías en una persona real, no como una lista de requisitos administrativos.',
  },
  {
    semanticKey: 'perfil_egreso',
    fallbackKey: 'perfil_de_egreso',
    label: 'Perfil de egreso',
    placeholder:
      '¿En quién se transforma al terminar? Qué sabe hacer, ante qué problemas responde y qué decisiones puede tomar que antes no podía.',
  },
  {
    semanticKey: 'fines_aprendizaje',
    fallbackKey: 'fines_de_aprendizaje_o_formacion',
    label: 'Fines de aprendizaje o formación',
    placeholder:
      '¿Qué aprendizajes articulan el recorrido entre el ingreso y el egreso? Son los que después dan sentido a las líneas curriculares y a cada asignatura.',
  },
] as const

export type FundamentoPlan = (typeof FUNDAMENTOS_PLAN)[number]

type EsquemaCampo = {
  ['x-acad-ia.semantic-key']?: string
} & Record<string, unknown>

/**
 * Empareja cada fundamento con la propiedad de la estructura que lo
 * representa. Devuelve un mapa `clave del campo → fundamento` para que quien
 * recorre las propiedades pueda preguntar por clave sin repetir la búsqueda.
 */
export function mapearFundamentos(
  // Los valores admiten nulo: `definicion.properties` viene de la base sin
  // garantía de que cada clave traiga un esquema.
  properties:
    | Record<string, EsquemaCampo | null | undefined>
    | undefined
    | null,
): Map<string, FundamentoPlan> {
  const mapa = new Map<string, FundamentoPlan>()
  if (!properties) return mapa

  const entradas = Object.entries(properties)
  for (const fundamento of FUNDAMENTOS_PLAN) {
    const porSemantica = entradas.find(
      ([, schema]) =>
        schema?.['x-acad-ia.semantic-key'] === fundamento.semanticKey,
    )
    const entrada =
      porSemantica ??
      entradas.find(([clave]) => clave === fundamento.fallbackKey)
    if (entrada) mapa.set(entrada[0], fundamento)
  }

  return mapa
}

/** Orden canónico de los fundamentos (ingreso → egreso → fines). */
export function ordenFundamento(fundamento: FundamentoPlan): number {
  return FUNDAMENTOS_PLAN.indexOf(fundamento)
}
