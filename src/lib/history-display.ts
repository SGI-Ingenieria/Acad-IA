import { format, isToday, isYesterday, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'

import { isLikelyTechnicalId, safeHumanText } from './display-safe'

/**
 * Rótulo del día de una jornada del historial. «Hoy» y «Ayer» son la
 * referencia real del usuario cuando revisa lo que acaba de pasar; a partir de
 * ahí la fecha larga con el día de la semana, que es lo que sitúa un cambio de
 * hace semanas.
 *
 * Vive aquí y no en cada panel porque el historial del plan y el de la
 * asignatura son la misma lectura sobre dos entidades: si un lado dijera «Hoy»
 * y el otro «viernes 24 de julio», la diferencia parecería significar algo.
 *
 * `dia` es una fecha ISO sin hora (`yyyy-MM-dd`); se le añade la medianoche
 * local para que no se interprete como UTC y retroceda un día.
 */
export function etiquetaDiaHistorial(dia: string): string {
  const fecha = parseISO(`${dia}T00:00:00`)
  if (isToday(fecha)) return 'Hoy'
  if (isYesterday(fecha)) return 'Ayer'
  const etiqueta = format(fecha, "EEEE d 'de' MMMM 'de' yyyy", { locale: es })
  return etiqueta.charAt(0).toLocaleUpperCase('es') + etiqueta.slice(1)
}

export type HistoryReferenceItem = {
  id: string
  label: string
}

export type HistoryReferenceCatalog = {
  estados?: Array<HistoryReferenceItem>
  carreras?: Array<HistoryReferenceItem>
  facultades?: Array<HistoryReferenceItem>
  estructuras?: Array<HistoryReferenceItem>
  lineas?: Array<HistoryReferenceItem>
  usuarios?: Array<HistoryReferenceItem>
  roles?: Array<HistoryReferenceItem>
  planes?: Array<HistoryReferenceItem>
  asignaturas?: Array<HistoryReferenceItem>
}

export type HistoryChangeSource = 'plan' | 'asignatura'

export type HistoryGroupId =
  | 'datos_basicos_plan'
  | 'detalles_plan'
  | 'estructura_plan'
  | 'mapa_curricular'
  | 'cambios_asignatura'
  | 'transiciones'

export type HistoryGroupConfig = {
  id: HistoryGroupId
  label: string
  description: string
}

export type HistoryDisplayValue =
  | string
  | number
  | boolean
  | null
  | Array<HistoryDisplayValue>
  | HistoryDisplayObject

export type HistoryDisplayObject = {
  [key: string]: HistoryDisplayValue
}

const FIELD_LABELS: Record<string, string> = {
  activo: 'Activo',
  carrera_id: 'Carrera',
  codigo: 'Código',
  contenido_tematico: 'Contenido temático',
  criterios_de_evaluacion: 'Criterios de evaluación',
  datos: 'Datos generales',
  estado: 'Estado',
  estado_actual_id: 'Estado',
  estructura_id: 'Estructura',
  facultad_id: 'Facultad',
  horas_academicas: 'Horas académicas',
  horas_independientes: 'Horas independientes',
  linea_plan_id: 'Línea curricular',
  nivel: 'Nivel',
  nombre: 'Nombre',
  numero_ciclo: 'Ciclo',
  numero_ciclos: 'Número de ciclos',
  orden_celda: 'Orden',
  plan_estudio_id: 'Plan de estudios',
  prerrequisito_asignatura_id: 'Prerrequisito',
  tipo: 'Tipo',
  tipo_ciclo: 'Tipo de ciclo',
  tipo_origen: 'Origen',
  usuario_id: 'Usuario',
  rol_id: 'Rol',
  asignatura_id: 'Asignatura',
}

const TECHNICAL_KEYS = new Set([
  'id',
  'response_id',
  'responseid',
  'conversation_id',
  'conversationid',
  'openai_file_id',
  'openai_vector_store_id',
  'asignatura_hash',
  'plan_hash',
  'search_vector',
])

export const HISTORY_GROUPS: Record<HistoryGroupId, HistoryGroupConfig> = {
  datos_basicos_plan: {
    id: 'datos_basicos_plan',
    label: 'Datos básicos del plan',
    description: 'Nombre, carrera, estructura base y estado activo.',
  },
  detalles_plan: {
    id: 'detalles_plan',
    label: 'Detalles del plan',
    description: 'Campos descriptivos y datos SEP del plan de estudios.',
  },
  estructura_plan: {
    id: 'estructura_plan',
    label: 'Estructura del plan',
    description: 'Ciclos, tipo de ciclo y organización general.',
  },
  mapa_curricular: {
    id: 'mapa_curricular',
    label: 'Mapa curricular',
    description: 'Ciclo, línea curricular, seriación y acomodo de materias.',
  },
  cambios_asignatura: {
    id: 'cambios_asignatura',
    label: 'Cambios de asignatura',
    description: 'Datos editables de la materia dentro del plan.',
  },
  transiciones: {
    id: 'transiciones',
    label: 'Transiciones',
    description: 'Cambios de estado del flujo de revisión.',
  },
}

const PLAN_BASIC_FIELDS = new Set([
  'activo',
  'carrera_id',
  'estructura_id',
  'nombre',
  'tipo_origen',
])

const PLAN_STRUCTURE_FIELDS = new Set(['numero_ciclos', 'tipo_ciclo', 'nivel'])

const CURRICULUM_MAP_FIELDS = new Set([
  'linea_plan_id',
  'numero_ciclo',
  'orden_celda',
  'plan_estudio_id',
  'prerrequisito_asignatura_id',
])

export function isHistoryTransitionChange(
  tipo?: string | null,
  campo?: string | null,
) {
  return (
    tipo === 'TRANSICION_ESTADO' ||
    campo === 'estado' ||
    campo === 'estado_actual_id'
  )
}

export function isCurriculumMapField(campo?: string | null) {
  return campo ? CURRICULUM_MAP_FIELDS.has(campo) : false
}

export function getHistoryGroupForChange(input: {
  source: HistoryChangeSource
  tipo?: string | null
  campo?: string | null
}): HistoryGroupConfig {
  const { source, tipo, campo } = input

  if (isHistoryTransitionChange(tipo, campo)) return HISTORY_GROUPS.transiciones

  if (source === 'asignatura') {
    if (
      tipo === 'ACTUALIZACION_MAPA' ||
      tipo === 'CREACION' ||
      campo === 'DELETE' ||
      isCurriculumMapField(campo)
    ) {
      return HISTORY_GROUPS.mapa_curricular
    }

    return HISTORY_GROUPS.cambios_asignatura
  }

  if (campo && PLAN_BASIC_FIELDS.has(campo)) {
    return HISTORY_GROUPS.datos_basicos_plan
  }

  if (campo && PLAN_STRUCTURE_FIELDS.has(campo)) {
    return HISTORY_GROUPS.estructura_plan
  }

  return HISTORY_GROUPS.detalles_plan
}

function titleCaseWords(value: string) {
  return value
    .replace(/_/g, ' ')
    .replace(/\s+id$/i, '')
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

export function formatHistoryFieldLabel(key?: string | null): string {
  if (!key) return 'Cambio'
  return FIELD_LABELS[key] ?? titleCaseWords(key)
}

function mapById(items?: Array<HistoryReferenceItem>) {
  return new Map((items ?? []).map((item) => [item.id, item.label]))
}

function resolveReference(
  key: string | undefined,
  value: string,
  catalog: HistoryReferenceCatalog,
): string | undefined {
  const maps = {
    estados: mapById(catalog.estados),
    carreras: mapById(catalog.carreras),
    facultades: mapById(catalog.facultades),
    estructuras: mapById(catalog.estructuras),
    lineas: mapById(catalog.lineas),
    usuarios: mapById(catalog.usuarios),
    roles: mapById(catalog.roles),
    planes: mapById(catalog.planes),
    asignaturas: mapById(catalog.asignaturas),
  }

  const normalizedKey = String(key ?? '').toLowerCase()
  const direct =
    normalizedKey === 'estado' || normalizedKey === 'estado_actual_id'
      ? maps.estados.get(value)
      : normalizedKey === 'carrera_id'
        ? maps.carreras.get(value)
        : normalizedKey === 'facultad_id'
          ? maps.facultades.get(value)
          : normalizedKey === 'estructura_id'
            ? maps.estructuras.get(value)
            : normalizedKey === 'linea_plan_id'
              ? maps.lineas.get(value)
              : normalizedKey === 'usuario_id' ||
                  normalizedKey === 'cambiado_por' ||
                  normalizedKey === 'creado_por' ||
                  normalizedKey === 'actualizado_por'
                ? maps.usuarios.get(value)
                : normalizedKey === 'rol_id'
                  ? maps.roles.get(value)
                  : normalizedKey === 'plan_estudio_id'
                    ? maps.planes.get(value)
                    : normalizedKey === 'asignatura_id' ||
                        normalizedKey === 'prerrequisito_asignatura_id'
                      ? maps.asignaturas.get(value)
                      : undefined

  if (direct) return direct

  for (const map of Object.values(maps)) {
    const label = map.get(value)
    if (label) return label
  }

  return undefined
}

function tryParseJsonString(value: string): unknown {
  const trimmed = value.trim()
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return value

  try {
    return JSON.parse(trimmed)
  } catch {
    return value
  }
}

function shouldHideObjectKey(key: string) {
  const normalized = key.toLowerCase()
  return TECHNICAL_KEYS.has(normalized)
}

export function toHistoryDisplayValue(
  value: unknown,
  catalog: HistoryReferenceCatalog = {},
  key?: string,
): HistoryDisplayValue {
  if (value === null || value === undefined || value === '') {
    return 'Sin información'
  }

  if (typeof value === 'string') {
    const parsed = tryParseJsonString(value)
    if (parsed !== value) return toHistoryDisplayValue(parsed, catalog, key)

    const resolved = resolveReference(key, value, catalog)
    if (resolved) return resolved
    if (isLikelyTechnicalId(value)) return 'Referencia no disponible'

    return safeHumanText(value, 'Sin información')
  }

  if (typeof value === 'number' || typeof value === 'boolean') return value

  if (Array.isArray(value)) {
    if (value.length === 0) return ['Lista vacía']
    return value.map((item) => toHistoryDisplayValue(item, catalog))
  }

  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([entryKey]) => !shouldHideObjectKey(entryKey))
      .map(([entryKey, entryValue]) => [
        formatHistoryFieldLabel(entryKey),
        toHistoryDisplayValue(entryValue, catalog, entryKey),
      ])

    if (entries.length === 0) return 'Sin información'

    return Object.fromEntries(entries) as Record<string, HistoryDisplayValue>
  }

  return safeHumanText(value, 'Sin información')
}

export function areHistoryValuesEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null)
}

/* ───────────────────── Ausencia de valor y redacción ───────────────────── */

/**
 * Marcadores que `toHistoryDisplayValue` produce cuando no hay dato. Se tratan
 * como «vacío» para poder redactar «se eliminó X» en vez de «X → Sin
 * información», que no le dice nada al usuario.
 */
const EMPTY_MARKERS = new Set([
  'Sin información',
  'Sin datos previos',
  'Sin información previa',
  'Vacío',
  'Lista vacía',
])

export function isEmptyHistoryValue(
  value: HistoryDisplayValue | undefined,
): boolean {
  if (value === null || value === undefined || value === '') return true
  if (typeof value === 'string') return EMPTY_MARKERS.has(value.trim())
  if (Array.isArray(value)) {
    return (
      value.length === 0 ||
      value.every(
        (item) => typeof item === 'string' && EMPTY_MARKERS.has(item.trim()),
      )
    )
  }
  if (typeof value === 'object') {
    return Object.values(value).every((item) => isEmptyHistoryValue(item))
  }
  return false
}

/**
 * Frase nominal de cada campo para poder redactar en español natural:
 * «se editaron los créditos» en vez de «Campo: Créditos».
 *
 * Los campos que no están aquí son campos dinámicos de datos generales (viven
 * en el JSON `datos` y su título lo define la estructura), así que se redactan
 * como «se editó el campo “Descripción”».
 */
const FIELD_NOUN: Record<string, { frase: string; plural?: boolean }> = {
  activo: { frase: 'el estado activo' },
  carrera_id: { frase: 'la carrera' },
  codigo: { frase: 'el código' },
  contenido_tematico: { frase: 'el contenido temático' },
  creditos: { frase: 'los créditos', plural: true },
  criterios_de_evaluacion: {
    frase: 'los criterios de evaluación',
    plural: true,
  },
  datos: { frase: 'los datos generales', plural: true },
  estructura_id: { frase: 'la estructura' },
  facultad_id: { frase: 'la facultad' },
  horas_academicas: { frase: 'las horas académicas', plural: true },
  horas_independientes: { frase: 'las horas independientes', plural: true },
  nivel: { frase: 'el nivel' },
  nombre: { frase: 'el nombre' },
  numero_ciclos: { frase: 'el número de ciclos' },
  orden_celda: { frase: 'la posición en el mapa' },
  plan_estudio_id: { frase: 'el plan de estudios' },
  tipo: { frase: 'el tipo' },
  tipo_ciclo: { frase: 'el tipo de ciclo' },
  tipo_origen: { frase: 'el origen' },
}

export type HistoryChangeKind =
  | 'creacion'
  | 'alta'
  | 'baja'
  | 'edicion'
  | 'transicion'

export type HistoryChangeDescription = {
  /** Frase completa, autoexplicativa, lista para mostrarse. */
  text: string
  kind: HistoryChangeKind
}

export type DescribeHistoryChangeInput = {
  source: HistoryChangeSource
  tipo?: string | null
  campo?: string | null
  /** Etiqueta ya resuelta (título de la estructura o `FIELD_LABELS`). */
  campoLabel: string
  from: HistoryDisplayValue
  to: HistoryDisplayValue
  subjectName?: string | null
  /** Nombra el ciclo según el plan («semestre 7», «cuatrimestre 2»). */
  formatCiclo?: (numero: number) => string
}

function asPlainText(value: HistoryDisplayValue): string | null {
  if (value === null || typeof value === 'object') return null
  const text = String(value).trim()
  return text.length > 0 ? text : null
}

function lowerFirst(value: string) {
  return value.charAt(0).toLocaleLowerCase('es') + value.slice(1)
}

function cicloText(
  value: HistoryDisplayValue,
  formatCiclo?: (numero: number) => string,
) {
  const numero = Number(value)
  if (!Number.isFinite(numero)) return null
  return formatCiclo ? formatCiclo(numero) : `ciclo ${numero}`
}

/** Redacción de los campos del mapa curricular, que se leen mejor en contexto. */
function describeCurriculumMapChange(
  input: DescribeHistoryChangeInput,
  vacioAntes: boolean,
  vacioDespues: boolean,
): HistoryChangeDescription | null {
  const { campo, from, to, formatCiclo } = input

  if (campo === 'numero_ciclo') {
    const antes = cicloText(from, formatCiclo)
    const despues = cicloText(to, formatCiclo)
    if (vacioDespues && antes)
      return { text: `Se quitó del ${antes}`, kind: 'baja' }
    if (vacioAntes && despues)
      return { text: `Se colocó en el ${despues}`, kind: 'alta' }
    if (antes && despues)
      return { text: `Pasó del ${antes} al ${despues}`, kind: 'edicion' }
    return null
  }

  if (campo === 'linea_plan_id') {
    const antes = asPlainText(from)
    const despues = asPlainText(to)
    if (vacioDespues && antes)
      return { text: `Se quitó de la línea ${antes}`, kind: 'baja' }
    if (vacioAntes && despues)
      return { text: `Se asignó a la línea ${despues}`, kind: 'alta' }
    if (despues)
      return { text: `Se movió a la línea ${despues}`, kind: 'edicion' }
    return null
  }

  if (campo === 'prerrequisito_asignatura_id') {
    const antes = asPlainText(from)
    const despues = asPlainText(to)
    if (vacioDespues && antes)
      return { text: `Se quitó el prerrequisito ${antes}`, kind: 'baja' }
    if (vacioAntes && despues)
      return {
        text: `Se estableció ${despues} como prerrequisito`,
        kind: 'alta',
      }
    if (despues)
      return {
        text: `Se cambió el prerrequisito a ${despues}`,
        kind: 'edicion',
      }
    return null
  }

  return null
}

/**
 * Convierte un registro del historial en una frase que se explica sola.
 *
 * El objetivo es que la fila diga qué pasó («se eliminó el prerrequisito X»)
 * y no cómo está guardado («campo: prerrequisito, X → Sin información»).
 */
export function describeHistoryChange(
  input: DescribeHistoryChangeInput,
): HistoryChangeDescription {
  const { source, tipo, campo, campoLabel, from, to, subjectName } = input

  const withSubject = (description: HistoryChangeDescription) =>
    source === 'asignatura' && subjectName
      ? {
          ...description,
          text: `${subjectName}: ${lowerFirst(description.text)}`,
        }
      : description

  if (isHistoryTransitionChange(tipo, campo)) {
    const antes = asPlainText(from)
    const despues = asPlainText(to)
    return withSubject({
      text: despues
        ? antes
          ? `Pasó de “${antes}” a “${despues}”`
          : `Pasó a “${despues}”`
        : 'Cambió de estado',
      kind: 'transicion',
    })
  }

  if (tipo === 'CREACION') {
    return source === 'plan'
      ? { text: 'Se creó el plan de estudios', kind: 'creacion' }
      : {
          text: `Se agregó ${subjectName ?? 'una asignatura'} al plan`,
          kind: 'creacion',
        }
  }

  if (campo === 'DELETE') {
    return {
      text: `Se quitó ${subjectName ?? 'una asignatura'} del plan`,
      kind: 'baja',
    }
  }

  const vacioAntes = isEmptyHistoryValue(from)
  const vacioDespues = isEmptyHistoryValue(to)

  const mapa = describeCurriculumMapChange(input, vacioAntes, vacioDespues)
  if (mapa) return withSubject(mapa)

  const noun = campo ? FIELD_NOUN[campo] : undefined
  // Los campos dinámicos de datos generales sí se nombran como «campo», porque
  // su etiqueta viene del formulario y no forma una frase por sí sola.
  const frase = noun?.frase ?? `el campo “${campoLabel}”`
  const plural = noun?.plural ?? false

  if (vacioAntes && vacioDespues) {
    return withSubject({ text: `Se registró ${frase}`, kind: 'edicion' })
  }
  if (vacioAntes) {
    return withSubject({
      text: `Se ${plural ? 'agregaron' : 'agregó'} ${frase}`,
      kind: 'alta',
    })
  }
  if (vacioDespues) {
    return withSubject({
      text: `Se ${plural ? 'eliminaron' : 'eliminó'} ${frase}`,
      kind: 'baja',
    })
  }

  return withSubject({
    text: `Se ${plural ? 'editaron' : 'editó'} ${frase}`,
    kind: 'edicion',
  })
}
