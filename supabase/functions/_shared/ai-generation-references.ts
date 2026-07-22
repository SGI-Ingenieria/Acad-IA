export const MAX_GENERATION_REFERENCE_IDS = 5

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export type GenerationReferences = {
  fileIds: Array<string>
  collectionIds: Array<string>
}

export function normalizeGenerationReferences(
  value: unknown,
): GenerationReferences {
  if (value == null) return { fileIds: [], collectionIds: [] }
  if (typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError('Las referencias documentales deben ser un objeto.')
  }

  const record = value as Record<string, unknown>
  if (
    Object.keys(record).some(
      (key) => !['fileIds', 'collectionIds'].includes(key),
    )
  ) {
    throw new TypeError(
      'El contrato contiene propiedades de referencia no permitidas.',
    )
  }

  const normalizeIds = (input: unknown, kind: string): Array<string> => {
    if (input == null) return []
    if (
      !Array.isArray(input) ||
      input.some((id) => typeof id !== 'string' || !UUID.test(id))
    ) {
      throw new TypeError(`${kind} debe contener únicamente UUID válidos.`)
    }
    if (input.length > MAX_GENERATION_REFERENCE_IDS) {
      throw new TypeError(
        `${kind} admite como máximo ${MAX_GENERATION_REFERENCE_IDS} referencias.`,
      )
    }
    return Array.from(new Set(input))
  }

  return {
    fileIds: normalizeIds(record.fileIds, 'fileIds'),
    collectionIds: normalizeIds(record.collectionIds, 'collectionIds'),
  }
}

export function buildGenerationTools(
  webSearchEnabled: boolean,
): Array<{ type: 'web_search' }> | undefined {
  return webSearchEnabled ? [{ type: 'web_search' }] : undefined
}
