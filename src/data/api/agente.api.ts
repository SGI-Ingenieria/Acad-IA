import { invokeEdge } from '../supabase/invokeEdge'

import type { UUID } from '../types/domain'

const EDGE = {
  ai_agente_accion: 'ai-agente-accion',
} as const

export type AgenteReasoningEffort = 'auto' | 'none' | 'low' | 'medium' | 'high'

/**
 * Acciones que el modo agente sabe ejecutar. El nombre es el discriminante que
 * la Edge Function usa para elegir contrato de entrada y JSON Schema de salida.
 */
export type AgenteAccionTipo =
  | 'mejorar_campo'
  | 'asignar_asignatura'
  | 'ajustar_creditos_horas'
  | 'reorganizar_mapa'
  | 'proponer_para_celda'
  | 'ordenar_lineas'
  | 'proponer_linea'
  | 'reubicar_unidad'
  | 'nombrar_unidad'
  | 'nombrar_tema'
  | 'proponer_contenido'
  | 'proponer_evaluacion'
  | 'proponer_bibliografia'
  | 'proponer_prerrequisito'

export type AgenteAmbito =
  | { tipo: 'plan'; planId: UUID }
  | { tipo: 'asignatura'; asignaturaId: UUID; planId: UUID }

/**
 * Carga útil de `mejorar_campo`, la acción más transversal del modo: la usan los
 * datos generales del plan, los nombres de unidad y tema, y los criterios de
 * evaluación. El contrato vive aquí —y no en cada componente— para que la Edge
 * Function y sus consumidores no se desincronicen, y para no dispersar detalles
 * del proveedor por la interfaz.
 */
export type PayloadMejorarCampo = {
  entidad: 'plan' | 'asignatura'
  entidad_id: UUID
  clave: string
  /** Etiqueta legible; le dice al modelo qué representa el campo. */
  label: string
  /** Descripción del campo en la estructura, si la hay. */
  ayuda?: string
  contenido_actual: string
  /** `true` cuando el valor es HTML; `false` para texto plano, números y enums. */
  es_richtext: boolean
  /** Sub-esquema JSON del campo, cuando la estructura del plan lo define. */
  campo_schema?: Record<string, unknown> | null
  /** Valores admitidos si el campo es un enum: el resultado debe ser uno de ellos. */
  opciones?: Array<string>
  minimo?: number | null
  maximo?: number | null
}

/** Resultado de `mejorar_campo`: el valor ya listo para escribirse tal cual. */
export type ResultadoMejorarCampo = {
  /** HTML si el campo era richtext; texto plano en cualquier otro caso. */
  contenido: string
}

/**
 * Retrato mínimo de una asignatura para las acciones del mapa. No se manda la
 * asignatura entera: el modelo sólo necesita su carga, su posición y su
 * seriación para decidir dónde encaja, y todo lo demás sería ruido en el
 * contexto (y datos del plan viajando sin motivo).
 */
export type AsignaturaMapa = {
  id: UUID
  nombre: string
  clave: string | null
  creditos: number
  horas_academicas: number
  horas_independientes: number
  tipo: string
  numero_ciclo: number | null
  linea_plan_id: UUID | null
  prerrequisito_asignatura_id: UUID | null
}

export type LineaMapa = {
  id: UUID
  nombre: string
  orden: number
}

/** Estado del mapa que acompaña a toda acción curricular. */
export type ContextoMapa = {
  lineas: Array<LineaMapa>
  asignaturas: Array<AsignaturaMapa>
  numero_ciclos: number
  /** Cómo llama el plan a sus ciclos ("Semestre", "Cuatrimestre", …). */
  nombre_ciclo: string
}

/** Colocar una asignatura suelta: la IA elige línea y ciclo. */
export type PayloadAsignarAsignatura = ContextoMapa & {
  asignatura_id: UUID
}

export type ResultadoAsignarAsignatura = {
  linea_plan_id: UUID
  numero_ciclo: number
}

export type PayloadAjustarCreditosHoras = {
  asignatura_id: UUID
  nombre: string
  horas_academicas: number
  horas_independientes: number
  creditos: number
  /** Horas que equivalen a un crédito en este plan. */
  horas_por_credito: number
}

/** Los créditos se derivan de las horas; por eso sólo vuelven las horas. */
export type ResultadoAjustarCreditosHoras = {
  horas_academicas: number
  horas_independientes: number
}

/** El `+` de una celda vacía: la IA elige qué pendiente encaja ahí, o rechaza. */
export type PayloadProponerParaCelda = ContextoMapa & {
  linea_plan_id: UUID
  linea_nombre: string
  numero_ciclo: number
  candidatas: Array<AsignaturaMapa>
}

export type ResultadoProponerParaCelda = {
  asignatura_id: UUID
}

export type PayloadReorganizarMapa = ContextoMapa & {
  /** Acota la reorganización a una línea; si falta, se reorganiza todo. */
  linea_plan_id?: UUID
}

/**
 * Una reorganización puede necesitar líneas que aún no existen. Vuelven con una
 * `clave_temporal` porque el modelo no puede conocer los identificadores que
 * generará la base de datos: el cliente crea la línea, resuelve la clave al id
 * real y recién entonces coloca las asignaturas.
 */
export type ResultadoReorganizarMapa = {
  lineas_nuevas: Array<{
    clave_temporal: string
    nombre: string
    color?: string | null
  }>
  movimientos: Array<{
    asignatura_id: UUID
    numero_ciclo: number
    /** Id de una línea existente o `clave_temporal` de una recién propuesta. */
    linea: string
  }>
  /**
   * Seriaciones que cambian con la reorganización. Van en la misma respuesta y
   * no en una acción aparte porque son parte del mismo acto: mover una
   * asignatura de ciclo cambia qué puede exigirse antes que ella, y aplicar una
   * cosa sin la otra dejaría el mapa coherente en apariencia y roto en el fondo.
   */
  seriaciones: Array<{
    asignatura_id: UUID
    /** `null` retira la seriación que la asignatura tuviera. */
    prerrequisito_asignatura_id: UUID | null
  }>
}

export type PayloadOrdenarLineas = {
  lineas: Array<LineaMapa>
  /** Línea desde la que el usuario disparó la acción, si la hubo. */
  linea_plan_id?: UUID
}

export type ResultadoOrdenarLineas = {
  orden: Array<{ linea_plan_id: UUID; orden: number }>
}

/**
 * "Agregar línea" en modo agente: en vez de abrir el diálogo y pedirle al
 * usuario que elija de un catálogo, la IA deduce qué línea le falta al plan
 * leyendo el mapa completo — de ahí que la carga útil sea el mapa entero.
 */
export type PayloadProponerLinea = ContextoMapa

export type ResultadoProponerLinea = {
  nombre: string
  /** Hexadecimal `#rrggbb`, o `null` para que el cliente genere uno contrastante. */
  color: string | null
  /** Una frase que explica qué agrupa la línea; se muestra al confirmar. */
  justificacion: string | null
}

/**
 * Los identificadores de unidad y tema los genera el cliente (`u-1`, `t-1-0`),
 * no la base de datos: el contenido temático se guarda como un JSON completo en
 * la asignatura. Por eso son `string` y no `UUID`.
 */
export type TemaContexto = {
  id: string
  nombre: string
  horas_estimadas: number
}

export type UnidadContexto = {
  id: string
  numero: number
  titulo: string
  temas: Array<TemaContexto>
}

/**
 * Contenido temático completo. Las acciones de esta superficie lo mandan
 * entero porque cualquiera de ellas —dónde va una unidad, cómo se llama la
 * siguiente, qué tema falta— sólo tiene sentido leyendo el temario completo.
 */
export type PayloadContenidoTematico = {
  asignatura_id: UUID
  asignatura_nombre: string
  unidades: Array<UnidadContexto>
}

/** Mover una unidad de sitio, o un tema a otra unidad. */
export type PayloadReubicarUnidad = PayloadContenidoTematico & {
  unidad_id: string
  /** Presente cuando lo que se reubica es un tema dentro del temario. */
  tema_id?: string
}

export type ResultadoReubicarUnidad = {
  /** Posición destino, 1-based, dentro de la lista correspondiente. */
  posicion: number
  /** Unidad de destino cuando se reubica un tema; nulo si no cambia de unidad. */
  unidad_destino_id?: string | null
}

/** Nombrar la unidad que está a punto de insertarse en `posicion` (1-based). */
export type PayloadNombrarUnidad = PayloadContenidoTematico & {
  posicion: number
}

export type ResultadoNombrarUnidad = {
  titulo: string
}

/** Nombrar el tema que está a punto de añadirse al final de una unidad. */
export type PayloadNombrarTema = PayloadContenidoTematico & {
  unidad_id: string
}

export type ResultadoNombrarTema = {
  nombre: string
  horas_estimadas: number
}

/**
 * Sustitución integral del temario. El modelo no devuelve identificadores:
 * pertenecen al borrador local y el cliente los crea al aplicar la propuesta.
 */
export type ResultadoProponerContenido = {
  unidades: Array<{
    titulo: string
    temas: Array<{ nombre: string; horas_estimadas: number }>
  }>
}

/**
 * Los criterios de evaluación se proponen siempre en bloque: los porcentajes
 * tienen que sumar 100, así que tocar uno solo produciría un sistema inválido.
 * De ahí que la interfaz encierre todos los porcentajes en un mismo contenedor.
 *
 * El temario no viaja en la carga útil aunque la evaluación deba cubrirlo: la
 * Edge Function ya tiene el `asignatura_id` y lo lee de la base, que además es
 * la versión autoritativa.
 */
export type PayloadProponerEvaluacion = {
  asignatura_id: UUID
  asignatura_nombre: string
  criterios: Array<{ criterio: string; porcentaje: number }>
}

export type ResultadoProponerEvaluacion = {
  criterios: Array<{ criterio: string; porcentaje: number }>
}

export type PayloadProponerBibliografia = {
  asignatura_id: UUID
  asignatura_nombre: string
  /** Estilo de cita dominante en la asignatura ("apa", "ieee", …). */
  formato: string
  /** Lo que ya está: la propuesta no debe repetirlo. */
  existentes: Array<{ titulo: string | null; cita: string }>
}

/**
 * Una referencia lista para insertarse en `bibliografia_asignatura`. La `cita`
 * viene ya formateada en el estilo pedido porque es la columna que el documento
 * oficial imprime literalmente; los campos sueltos acompañan para poder
 * reformatear después sin volver a buscar la obra.
 */
export type ResultadoProponerBibliografia = {
  cita: string
  tipo: 'BASICA' | 'COMPLEMENTARIA'
  formato: string
  titulo: string | null
  autores: Array<string>
  editorial: string | null
  anio: number | null
  isbn: string | null
  /** URL de la fuente cuando la referencia se localizó en línea. */
  referencia_en_linea: string | null
  /** ID del catálogo La Salle cuando la propuesta se verificó allí. */
  referencia_biblioteca: string | null
}

/**
 * Elegir la seriación (prerrequisito) de una asignatura, o rechazar. No reutiliza
 * `ContextoMapa` porque la decisión no depende de créditos ni de horas: el filtro
 * de elegibilidad —sólo ciclos anteriores— ya lo aplica el cliente, y lo único
 * que queda por decidir es cuál de las candidatas es realmente antecedente.
 */
export type PayloadProponerPrerrequisito = {
  asignatura_id: UUID
  asignatura_nombre: string
  numero_ciclo: number | null
  /** Cómo llama el plan a sus ciclos ("Semestre", "Cuatrimestre", …). */
  nombre_ciclo: string
  prerrequisito_actual: UUID | null
  candidatas: Array<{
    id: UUID
    nombre: string
    clave: string | null
    numero_ciclo: number | null
    /** `true` si comparte línea curricular con la asignatura. */
    misma_linea: boolean
  }>
}

export type ResultadoProponerPrerrequisito = {
  /** `null` significa "quitar la seriación": es una respuesta válida. */
  asignatura_id: UUID | null
}

export type AgenteAccionInput = {
  accion: AgenteAccionTipo
  ambito: AgenteAmbito
  /**
   * Las pocas palabras que el usuario puede haber escrito en el dock. Es
   * opcional: señalar un elemento ya expresa una intención, y sin contexto el
   * backend decide con el criterio académico general.
   */
  contexto?: string
  /** Identificador de la sesión de agente; agrupa los cambios en el historial. */
  sesion_id: UUID
  /** Carga útil específica de cada acción (ids, valores actuales, etc.). */
  payload: Record<string, unknown>
  reasoning_effort?: AgenteReasoningEffort
}

/**
 * Sobre de respuesta común. El rechazo razonado no es un error: la IA puede
 * concluir legítimamente que no hay nada que cambiar ("yo considero que está en
 * la mejor posición"), y eso debe llegar al usuario como información, no como
 * fallo. Por eso viaja en un 200 y no en un `EdgeFunctionError`.
 */
export type AgenteAccionOutput<TResultado = unknown> =
  | { ok: true; resultado: TResultado; interaccion_id?: UUID }
  | { ok: true; rechazo: { motivo: string } }

export function esRechazo<T>(
  salida: AgenteAccionOutput<T>,
): salida is { ok: true; rechazo: { motivo: string } } {
  return 'rechazo' in salida
}

export function buildAgenteAccionBody(input: AgenteAccionInput) {
  return {
    accion: input.accion,
    ambito: input.ambito,
    contexto: input.contexto?.trim() ?? '',
    sesion_id: input.sesion_id,
    payload: input.payload,
    reasoning_effort: input.reasoning_effort ?? 'none',
  }
}

export async function agente_accion<TResultado = unknown>(
  input: AgenteAccionInput,
): Promise<AgenteAccionOutput<TResultado>> {
  return invokeEdge<AgenteAccionOutput<TResultado>>(
    EDGE.ai_agente_accion,
    buildAgenteAccionBody(input),
    { headers: { 'Content-Type': 'application/json' } },
  )
}
