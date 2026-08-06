export type ConversationType = 'plan' | 'asignatura'
export type ConversationAccessMode = 'read' | 'write'

export type AuthorizedCollectionRow = {
  id: string
  name: string
  description: string | null
  kind: 'collection' | 'curriculum_repository'
  status: string
  created_by: string
  created_at: string
  updated_at: string
  file_ids: Array<string> | null
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function normalizeReferenceIds(
  value: unknown,
  limit = 25,
): Array<string> {
  if (!Array.isArray(value)) return []

  return Array.from(
    new Set(
      value.filter(
        (candidate): candidate is string =>
          typeof candidate === 'string' && UUID_PATTERN.test(candidate),
      ),
    ),
  ).slice(0, limit)
}

export function conversationTableName(
  conversationType: ConversationType,
): 'conversaciones_plan' | 'conversaciones_asignatura' {
  return conversationType === 'plan'
    ? 'conversaciones_plan'
    : 'conversaciones_asignatura'
}

export function hasConversationFileAccess(
  mode: ConversationAccessMode,
  readable: boolean,
  iaAllowed: boolean,
): boolean {
  return readable && (mode === 'read' || iaAllowed)
}

export function projectAuthorizedCollections(
  collections: Array<AuthorizedCollectionRow>,
  visibleFileIds: ReadonlySet<string>,
  userId: string,
) {
  return collections
    .filter(
      (collection) =>
        collection.kind === 'curriculum_repository' ||
        collection.created_by === userId,
    )
    .map(({ file_ids, ...collection }) => ({
      ...collection,
      canManage: collection.created_by === userId,
      fileIds: (file_ids ?? []).filter((fileId) => visibleFileIds.has(fileId)),
    }))
}
