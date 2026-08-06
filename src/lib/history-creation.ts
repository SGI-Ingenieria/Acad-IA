export type HistoryCreationEntity = 'plan' | 'asignatura'

export type HistoryCreationInstruction = {
  label: string
  value: string
}

export type HistoryCreationSummary = {
  entity: HistoryCreationEntity
  name: string
  code?: string
  planName?: string
  createdAt: Date
  createdBy: string
  origin?: 'IA' | 'Manual' | 'Clonado' | 'Importado'
  instructions: Array<HistoryCreationInstruction>
  references: {
    fileIds: Array<string>
    collectionIds: Array<string>
  }
}

type UnknownRecord = Record<string, unknown>

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function isHistoryCreationEvent(tipo: unknown): boolean {
  return tipo === 'CREACION'
}

function record(value: unknown): UnknownRecord | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as UnknownRecord)
    : null
}

function cleanString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const normalized = value.trim()
  return normalized ? normalized.slice(0, 4_000) : undefined
}

function firstString(...values: Array<unknown>): string | undefined {
  for (const value of values) {
    const normalized = cleanString(value)
    if (normalized) return normalized
  }
  return undefined
}

function referenceIds(...values: Array<unknown>): Array<string> {
  return Array.from(
    new Set(
      values
        .flatMap((value) =>
          Array.isArray(value) ? value : value === undefined ? [] : [value],
        )
        .filter(
          (value): value is string =>
            typeof value === 'string' && UUID_PATTERN.test(value),
        ),
    ),
  )
}

function creationOrigin(raw: UnknownRecord, meta: UnknownRecord | null) {
  const value = firstString(raw.tipo_origen, meta?.tipo_origen)?.toUpperCase()
  if (value?.includes('IA') || (!value && meta?.generado_por)) return 'IA'
  if (value?.includes('MANUAL')) return 'Manual'
  if (value?.includes('CLON')) return 'Clonado'
  if (value?.includes('IMPORT')) return 'Importado'
  return undefined
}

function addInstruction(
  target: Array<HistoryCreationInstruction>,
  label: string,
  value: unknown,
) {
  const normalized = cleanString(value)
  if (!normalized || target.some((item) => item.value === normalized)) return
  target.push({ label, value: normalized })
}

export function normalizeHistoryCreation(input: {
  entity: HistoryCreationEntity
  rawValue: unknown
  createdAt: Date
  createdBy: string
  fallbackName?: string | null
  planName?: string | null
}): HistoryCreationSummary {
  const raw = record(input.rawValue) ?? {}
  const meta = record(raw.meta_origen)
  const iaConfig = record(meta?.iaConfig) ?? record(raw.iaConfig)
  const references = [
    record(meta?.referencias),
    record(iaConfig?.references),
    record(iaConfig?.referencias),
    record(raw.referencias),
  ].filter((value): value is UnknownRecord => value !== null)

  const instructions: Array<HistoryCreationInstruction> = []
  addInstruction(instructions, 'Prompt', iaConfig?.prompt)
  addInstruction(
    instructions,
    'Enfoque académico',
    firstString(
      iaConfig?.descripcionEnfoqueAcademico,
      iaConfig?.descripcionEnfoque,
    ),
  )
  addInstruction(
    instructions,
    'Instrucciones adicionales',
    firstString(
      iaConfig?.instruccionesAdicionalesIA,
      iaConfig?.notasAdicionales,
    ),
  )
  addInstruction(
    instructions,
    'Población objetivo',
    iaConfig?.poblacionObjetivo,
  )

  const fileIds = referenceIds(
    ...references.flatMap((source) => [
      source.fileIds,
      source.fileId,
      source.archivosReferenciaIds,
      source.archivosReferencia,
      source.archivos_referencia,
    ]),
  )
  const collectionIds = referenceIds(
    ...references.flatMap((source) => [
      source.collectionIds,
      source.collectionId,
      source.coleccionesReferenciaIds,
      source.coleccionesReferencia,
    ]),
  )

  const name =
    input.entity === 'plan'
      ? firstString(
          raw.nombre_display,
          raw.nombre_propuesto,
          raw.nombre,
          input.fallbackName,
        )
      : firstString(raw.nombre, input.fallbackName)

  return {
    entity: input.entity,
    name: name ?? (input.entity === 'plan' ? 'Plan de estudios' : 'Asignatura'),
    ...(input.entity === 'asignatura' && cleanString(raw.codigo)
      ? { code: cleanString(raw.codigo) }
      : {}),
    ...(input.entity === 'asignatura' && cleanString(input.planName)
      ? { planName: cleanString(input.planName) }
      : {}),
    createdAt: input.createdAt,
    createdBy: input.createdBy,
    origin: creationOrigin(raw, meta),
    instructions,
    references: { fileIds, collectionIds },
  }
}
