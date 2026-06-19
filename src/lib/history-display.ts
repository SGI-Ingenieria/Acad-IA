import { isLikelyTechnicalId, safeHumanText } from './display-safe'

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
