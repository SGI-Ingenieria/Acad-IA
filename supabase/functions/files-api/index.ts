import '@supabase/functions-js/edge-runtime.d.ts'

import { preflightResponse } from '../_shared/cors.ts'
import {
  assertDocumentPermission,
  DOCUMENTOS_BUCKET,
  resolveTenantId,
  temporaryUploadPath,
  validateUploadDeclaration,
} from '../_shared/documentos-academicos.ts'
import { readJsonBody, requireJsonContentType } from '../_shared/request.ts'
import {
  createAnonClient,
  getServiceRoleClient,
  getAuthorizationHeader,
  requireAuthenticatedUser,
} from '../_shared/supabase.ts'
import { edgeErrorResponse, HttpError, sendSuccess } from '../_shared/utils.ts'
import {
  conversationTableName,
  hasConversationFileAccess,
  normalizeReferenceIds,
  projectAuthorizedCollections,
  type AuthorizedCollectionRow,
  type ConversationAccessMode,
  type ConversationType,
} from './library-access.ts'

type UploadSessionBody = {
  filename?: unknown
  size?: unknown
  mimeType?: unknown
  clientSha256?: unknown
  source?: unknown
}

type CollectionBody = {
  name?: unknown
  description?: unknown
  kind?: unknown
  fileId?: unknown
}

type LibraryFileRow = {
  id: string
  display_name: string
  description: string | null
  status: string
  source: 'upload' | 'note'
  detected_mime: string | null
  size_bytes: number | null
  created_at: string
  updated_at: string
  current_version_id: string | null
  last_viewed_at: string | null
  last_used_at: string | null
  pinned_at: string | null
  archived_at: string | null
  total_count: number
}

type ConversationFileRow = {
  file_id: string
  added_at: string
  active: boolean
  used: boolean
  first_used_at: string | null
  can_remove: boolean
}

type ResolvedDocumentReference = {
  id: string
  name: string
  type: 'file' | 'collection'
  status: string
}

function authenticatedClient(request: Request) {
  const authorization = getAuthorizationHeader(request)
  if (!authorization) {
    throw new HttpError(401, 'Debes iniciar sesión.', 'UNAUTHORIZED')
  }
  return createAnonClient(authorization)
}

async function jsonBody(request: Request): Promise<Record<string, unknown>> {
  requireJsonContentType(request, { message: 'Se requiere un cuerpo JSON.' })
  const body = await readJsonBody(request, {
    message: 'El cuerpo JSON no es válido.',
  })
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new HttpError(400, 'El cuerpo JSON no es válido.', 'INVALID_JSON')
  }
  return body as Record<string, unknown>
}

function uploadDeclaration(body: UploadSessionBody) {
  if (
    typeof body.filename !== 'string' ||
    typeof body.size !== 'number' ||
    typeof body.mimeType !== 'string'
  ) {
    throw new HttpError(
      422,
      'Faltan los metadatos de la carga.',
      'VALIDATION_ERROR',
    )
  }
  validateUploadDeclaration({
    filename: body.filename,
    size: body.size,
    mimeType: body.mimeType,
  })
  if (
    body.clientSha256 !== undefined &&
    (typeof body.clientSha256 !== 'string' ||
      !/^[a-f0-9]{64}$/i.test(body.clientSha256))
  ) {
    throw new HttpError(
      422,
      'El hash cliente no tiene formato SHA-256.',
      'VALIDATION_ERROR',
    )
  }
  if (
    body.source !== undefined &&
    body.source !== 'upload' &&
    body.source !== 'note'
  ) {
    throw new HttpError(
      422,
      'La procedencia del archivo no es válida.',
      'VALIDATION_ERROR',
    )
  }
  return {
    filename: body.filename.trim(),
    size: body.size,
    mimeType: body.mimeType.toLowerCase(),
    clientSha256:
      typeof body.clientSha256 === 'string'
        ? body.clientSha256.toLowerCase()
        : null,
    source: body.source === 'note' ? ('note' as const) : ('upload' as const),
  }
}

async function createUploadSession(request: Request) {
  const user = await requireAuthenticatedUser(request)
  const supabase = getServiceRoleClient()
  const tenantId = await resolveTenantId(supabase, user.id)
  const declaration = uploadDeclaration(
    (await jsonBody(request)) as UploadSessionBody,
  )
  const sessionId = crypto.randomUUID()
  const temporaryPath = temporaryUploadPath(tenantId, sessionId)
  const { data, error } = await supabase
    .from('upload_sessions')
    .insert({
      id: sessionId,
      tenant_id: tenantId,
      user_id: user.id,
      temporary_path: temporaryPath,
      original_filename: declaration.filename,
      declared_mime: declaration.mimeType,
      declared_size: declaration.size,
      client_sha256: declaration.clientSha256,
      source: declaration.source,
    })
    .select('id, temporary_path, expires_at, status')
    .single()
  if (error || !data) {
    throw new HttpError(
      500,
      'No se pudo crear la sesión de carga.',
      'UPLOAD_SESSION_CREATE_FAILED',
    )
  }

  return sendSuccess(
    {
      data: {
        id: data.id,
        temporaryPath: data.temporary_path,
        bucket: DOCUMENTOS_BUCKET,
        expiresAt: data.expires_at,
        upload: {
          // El cliente resuelve esta ruta contra su SUPABASE_PUBLIC_URL. No se
          // debe filtrar el hostname interno de Docker (por ejemplo, localhost:54321).
          endpointPath: '/storage/v1/upload/resumable',
          metadata: {
            bucketName: DOCUMENTOS_BUCKET,
            objectName: data.temporary_path,
            contentType: declaration.mimeType,
          },
        },
      },
    },
    201,
  )
}

async function listFiles(request: Request) {
  const url = new URL(request.url)
  const limit = Math.min(
    Math.max(Number(url.searchParams.get('limit') ?? 30), 1),
    50,
  )
  const rawOffset = Number(url.searchParams.get('cursor') ?? 0)
  const { files, offset, totalCount } = await authorizedFiles(request, {
    sort: 'updated_desc',
    limit,
    offset: Number.isInteger(rawOffset) ? rawOffset : 0,
  })
  return sendSuccess({
    data: files,
    nextCursor:
      offset + files.length < totalCount ? String(offset + files.length) : null,
  })
}

async function authorizedFiles(
  request: Request,
  options: {
    query?: string
    sort?: string
    limit?: number
    offset?: number
  } = {},
) {
  const user = await requireAuthenticatedUser(request)
  const supabase = getServiceRoleClient()
  const tenantId = await resolveTenantId(supabase, user.id)
  const limit = Math.min(Math.max(options.limit ?? 100, 1), 200)
  const offset = Math.max(options.offset ?? 0, 0)
  const sort = [
    'updated_desc',
    'created_desc',
    'used_desc',
    'name_asc',
    'name_desc',
  ].includes(options.sort ?? '')
    ? options.sort
    : 'updated_desc'
  const { data, error } = await supabase.rpc('listar_biblioteca_documental', {
    p_usuario_id: user.id,
    p_tenant_id: tenantId,
    p_query: options.query?.trim() || undefined,
    p_sort: sort,
    p_limit: limit,
    p_offset: offset,
  })
  if (error) {
    throw new HttpError(
      500,
      'No se pudieron listar los archivos.',
      'FILE_LIST_FAILED',
      error,
    )
  }

  const rows = (data ?? []) as Array<LibraryFileRow>
  const totalCount = Number(rows[0]?.total_count ?? 0)
  const files = rows.map(
    ({
      total_count: _totalCount,
      last_viewed_at,
      last_used_at,
      pinned_at,
      archived_at,
      ...file
    }) => ({
      ...file,
      user_state:
        last_viewed_at || last_used_at || pinned_at || archived_at
          ? {
              last_viewed_at,
              last_used_at,
              pinned_at,
              archived_at,
            }
          : null,
    }),
  )
  return { user, supabase, tenantId, files, limit, offset, totalCount }
}

async function listLibrary(request: Request) {
  const url = new URL(request.url)
  const requestedLimit = Number(url.searchParams.get('limit') ?? 100)
  const requestedOffset = Number(url.searchParams.get('offset') ?? 0)
  const { user, supabase, tenantId, files, limit, offset, totalCount } =
    await authorizedFiles(request, {
      query: url.searchParams.get('query') ?? '',
      sort: url.searchParams.get('sort') ?? 'updated_desc',
      limit: Number.isInteger(requestedLimit) ? requestedLimit : 100,
      offset: Number.isInteger(requestedOffset) ? requestedOffset : 0,
    })
  const { data: collections, error } = await supabase.rpc(
    'listar_colecciones_documentales',
    {
      p_usuario_id: user.id,
      p_tenant_id: tenantId,
    },
  )
  if (error) {
    throw new HttpError(
      500,
      'No se pudieron listar las colecciones.',
      'COLLECTION_LIST_FAILED',
    )
  }
  const visibleIds = new Set(files.map((file) => file.id))
  return sendSuccess({
    data: {
      files,
      collections: projectAuthorizedCollections(
        (collections ?? []) as Array<AuthorizedCollectionRow>,
        visibleIds,
        user.id,
      ),
    },
    pagination: {
      limit,
      offset,
      totalCount,
      nextOffset:
        offset + files.length < totalCount ? offset + files.length : null,
    },
  })
}

async function resolveReferences(request: Request) {
  const user = await requireAuthenticatedUser(request)
  const supabase = getServiceRoleClient()
  const tenantId = await resolveTenantId(supabase, user.id)
  const body = await jsonBody(request)
  const fileIds = normalizeReferenceIds(body.fileIds)
  const collectionIds = normalizeReferenceIds(body.collectionIds)

  const authorizedFileIds = (
    await Promise.all(
      fileIds.map(async (fileId) => {
        const { data, error } = await supabase.rpc(
          'autorizar_uso_archivo_documental',
          {
            p_usuario_id: user.id,
            p_file_id: fileId,
            p_permiso: 'view',
          },
        )
        if (error) {
          throw new HttpError(
            500,
            'No se pudieron comprobar las referencias.',
            'REFERENCE_ACCESS_CHECK_FAILED',
            error,
          )
        }
        return data === true ? fileId : null
      }),
    )
  ).filter((fileId): fileId is string => fileId !== null)

  const { data: fileRows, error: fileError } = authorizedFileIds.length
    ? await supabase
        .from('files')
        .select('id, display_name, status')
        .eq('tenant_id', tenantId)
        .in('id', authorizedFileIds)
        .is('deleted_at', null)
    : { data: [], error: null }
  if (fileError) {
    throw new HttpError(
      500,
      'No se pudieron resolver los archivos de referencia.',
      'REFERENCE_FILES_READ_FAILED',
      fileError,
    )
  }

  const { data: collectionRows, error: collectionError } = collectionIds.length
    ? await supabase.rpc('listar_colecciones_documentales', {
        p_usuario_id: user.id,
        p_tenant_id: tenantId,
      })
    : { data: [], error: null }
  if (collectionError) {
    throw new HttpError(
      500,
      'No se pudieron resolver las colecciones de referencia.',
      'REFERENCE_COLLECTIONS_READ_FAILED',
      collectionError,
    )
  }

  const requestedCollections = new Set(collectionIds)
  const collections = projectAuthorizedCollections(
    (collectionRows ?? []) as Array<AuthorizedCollectionRow>,
    new Set<string>(),
    user.id,
  ).filter((collection) => requestedCollections.has(collection.id))

  const references: Array<ResolvedDocumentReference> = [
    ...(fileRows ?? []).map((file) => ({
      id: file.id,
      name: file.display_name,
      type: 'file' as const,
      status: file.status,
    })),
    ...collections.map((collection) => ({
      id: collection.id,
      name: collection.name,
      type: 'collection' as const,
      status: collection.status,
    })),
  ]

  return sendSuccess({
    data: {
      references,
      unavailableCount:
        fileIds.length + collectionIds.length - references.length,
    },
  })
}

function collectionDeclaration(body: CollectionBody, partial = false) {
  if (!partial && typeof body.name !== 'string') {
    throw new HttpError(
      422,
      'Escribe un nombre para la colección.',
      'VALIDATION_ERROR',
    )
  }
  if (
    body.name !== undefined &&
    (typeof body.name !== 'string' ||
      !body.name.trim() ||
      body.name.length > 120)
  ) {
    throw new HttpError(
      422,
      'El nombre de la colección no es válido.',
      'VALIDATION_ERROR',
    )
  }
  if (
    body.description !== undefined &&
    body.description !== null &&
    (typeof body.description !== 'string' || body.description.length > 600)
  ) {
    throw new HttpError(422, 'La descripción no es válida.', 'VALIDATION_ERROR')
  }
  if (
    body.kind !== undefined &&
    !['collection', 'curriculum_repository'].includes(String(body.kind))
  ) {
    throw new HttpError(
      422,
      'El tipo de colección no es válido.',
      'VALIDATION_ERROR',
    )
  }
  return {
    ...(body.name !== undefined ? { name: String(body.name).trim() } : {}),
    ...(body.description !== undefined
      ? {
          description: body.description
            ? String(body.description).trim()
            : null,
        }
      : {}),
    ...(body.kind !== undefined ? { kind: String(body.kind) } : {}),
  }
}

async function createCollection(request: Request) {
  const user = await requireAuthenticatedUser(request)
  const supabase = getServiceRoleClient()
  const tenantId = await resolveTenantId(supabase, user.id)
  const declaration = collectionDeclaration(
    (await jsonBody(request)) as CollectionBody,
  )
  const { data, error } = await supabase
    .from('collections')
    .insert({ ...declaration, tenant_id: tenantId, created_by: user.id })
    .select(
      'id, name, description, kind, status, created_by, created_at, updated_at',
    )
    .single()
  if (error || !data) {
    throw new HttpError(
      error?.code === '23505' ? 409 : 500,
      error?.code === '23505'
        ? 'Ya existe una colección con ese nombre.'
        : 'No se pudo crear la colección.',
      error?.code === '23505'
        ? 'COLLECTION_NAME_CONFLICT'
        : 'COLLECTION_CREATE_FAILED',
    )
  }
  return sendSuccess({ data: { ...data, fileIds: [], canManage: true } }, 201)
}

async function ownedCollection(request: Request, collectionId: string) {
  const user = await requireAuthenticatedUser(request)
  const supabase = getServiceRoleClient()
  const tenantId = await resolveTenantId(supabase, user.id)
  const { data, error } = await supabase
    .from('collections')
    .select('id, created_by, status')
    .eq('id', collectionId)
    .eq('tenant_id', tenantId)
    .maybeSingle()
  if (error || !data) {
    throw new HttpError(
      404,
      'No se encontró la colección.',
      'COLLECTION_NOT_FOUND',
    )
  }
  if (data.created_by !== user.id) {
    throw new HttpError(
      403,
      'No puedes modificar esta colección.',
      'COLLECTION_FORBIDDEN',
    )
  }
  return { user, supabase, tenantId, collection: data }
}

async function updateCollection(request: Request, collectionId: string) {
  const { supabase } = await ownedCollection(request, collectionId)
  const declaration = collectionDeclaration(
    (await jsonBody(request)) as CollectionBody,
    true,
  )
  const { data, error } = await supabase
    .from('collections')
    .update(declaration)
    .eq('id', collectionId)
    .select(
      'id, name, description, kind, status, created_by, created_at, updated_at',
    )
    .single()
  if (error || !data) {
    throw new HttpError(
      500,
      'No se pudo actualizar la colección.',
      'COLLECTION_UPDATE_FAILED',
    )
  }
  return sendSuccess({ data })
}

async function archiveCollection(request: Request, collectionId: string) {
  const { supabase } = await ownedCollection(request, collectionId)
  const { error } = await supabase
    .from('collections')
    .update({ status: 'archived' })
    .eq('id', collectionId)
  if (error) {
    throw new HttpError(
      500,
      'No se pudo archivar la colección.',
      'COLLECTION_ARCHIVE_FAILED',
    )
  }
  return sendSuccess({ data: { id: collectionId, archived: true } })
}

async function addFileToCollection(
  request: Request,
  collectionId: string,
  fileId: string,
) {
  const { user, supabase, tenantId } = await ownedCollection(
    request,
    collectionId,
  )
  await assertDocumentPermission({
    supabase,
    userId: user.id,
    fileId,
    permission: 'use',
  })
  const { error } = await supabase.from('collection_files').upsert(
    {
      tenant_id: tenantId,
      collection_id: collectionId,
      file_id: fileId,
      added_by: user.id,
    },
    { onConflict: 'collection_id,file_id' },
  )
  if (error) {
    throw new HttpError(
      500,
      'No se pudo añadir el archivo.',
      'COLLECTION_FILE_ADD_FAILED',
    )
  }
  return sendSuccess({ data: { collectionId, fileId, added: true } })
}

async function removeFileFromCollection(
  request: Request,
  collectionId: string,
  fileId: string,
) {
  const { supabase } = await ownedCollection(request, collectionId)
  const { error } = await supabase
    .from('collection_files')
    .delete()
    .eq('collection_id', collectionId)
    .eq('file_id', fileId)
  if (error) {
    throw new HttpError(
      500,
      'No se pudo retirar el archivo.',
      'COLLECTION_FILE_REMOVE_FAILED',
    )
  }
  return sendSuccess({ data: { collectionId, fileId, removed: true } })
}

async function authorizedConversation(
  request: Request,
  conversationType: ConversationType,
  conversationId: string,
  accessMode: ConversationAccessMode,
) {
  const user = await requireAuthenticatedUser(request)
  const supabase = getServiceRoleClient()
  const tenantId = await resolveTenantId(supabase, user.id)
  const authenticated = authenticatedClient(request)
  const scopeColumn =
    conversationType === 'plan' ? 'plan_estudio_id' : 'asignatura_id'
  const { data, error } = await authenticated
    .from(conversationTableName(conversationType))
    .select(`id, ${scopeColumn}`)
    .eq('id', conversationId)
    .maybeSingle()
  if (error || !data) {
    throw new HttpError(
      404,
      'No se encontró la conversación.',
      'CONVERSATION_NOT_FOUND',
    )
  }

  if (accessMode === 'write') {
    const scopeId =
      'plan_estudio_id' in data ? data.plan_estudio_id : data.asignatura_id
    const capability =
      conversationType === 'plan'
        ? await authenticated.rpc('authz_plan_ia_allowed', {
            p_plan_id: scopeId,
          })
        : await authenticated.rpc('authz_asignatura_ia_allowed', {
            p_asignatura_id: scopeId,
          })

    if (capability.error) {
      throw new HttpError(
        500,
        'No se pudo comprobar el permiso de IA para la conversación.',
        'CONVERSATION_CAPABILITY_READ_FAILED',
        capability.error,
      )
    }
    if (!hasConversationFileAccess('write', true, capability.data === true)) {
      throw new HttpError(
        403,
        'No tienes permiso para modificar los archivos de esta conversación.',
        'CONVERSATION_WRITE_FORBIDDEN',
      )
    }
  }
  return { user, supabase, tenantId }
}

async function listConversationFiles(
  request: Request,
  conversationType: 'plan' | 'asignatura',
  conversationId: string,
) {
  const { user, supabase, tenantId } = await authorizedConversation(
    request,
    conversationType,
    conversationId,
    'read',
  )
  const { data, error } = await supabase.rpc(
    'listar_archivos_conversacion_documental',
    {
      p_usuario_id: user.id,
      p_tenant_id: tenantId,
      p_conversation_type: conversationType,
      p_conversation_id: conversationId,
    },
  )
  if (error) {
    throw new HttpError(
      500,
      'No se pudieron listar los archivos del chat.',
      'CONVERSATION_FILES_READ_FAILED',
      error,
    )
  }
  const references = ((data ?? []) as Array<ConversationFileRow>).map(
    (row) => ({
      fileId: row.file_id,
      addedAt: row.added_at,
      active: row.active,
      used: row.used,
      firstUsedAt: row.first_used_at,
      canRemove: row.can_remove,
    }),
  )
  return sendSuccess({
    data: {
      references,
      // Compatibilidad temporal para consumidores que aún no leen metadatos.
      fileIds: references.map((reference) => reference.fileId),
    },
  })
}

async function attachConversationFile(
  request: Request,
  conversationType: 'plan' | 'asignatura',
  conversationId: string,
  fileId: string,
) {
  const { user, supabase, tenantId } = await authorizedConversation(
    request,
    conversationType,
    conversationId,
    'write',
  )
  await assertDocumentPermission({
    supabase,
    userId: user.id,
    fileId,
    permission: 'use',
  })
  const { error } = await supabase.from('conversation_files').upsert(
    {
      tenant_id: tenantId,
      conversation_type: conversationType,
      conversation_id: conversationId,
      file_id: fileId,
      added_by: user.id,
      removed_at: null,
    },
    { onConflict: 'conversation_type,conversation_id,file_id' },
  )
  if (error) {
    throw new HttpError(
      500,
      'No se pudo añadir el archivo al chat.',
      'CONVERSATION_FILE_ATTACH_FAILED',
    )
  }
  return sendSuccess({ data: { conversationId, fileId, attached: true } })
}

async function detachConversationFile(
  request: Request,
  conversationType: 'plan' | 'asignatura',
  conversationId: string,
  fileId: string,
) {
  const { supabase, tenantId } = await authorizedConversation(
    request,
    conversationType,
    conversationId,
    'write',
  )
  const { data: usage, error: usageError } = await supabase
    .from('ai_request_references')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('conversation_type', conversationType)
    .eq('conversation_id', conversationId)
    .eq('file_id', fileId)
    .limit(1)
    .maybeSingle()
  if (usageError) {
    throw new HttpError(
      500,
      'No se pudo comprobar el uso del archivo.',
      'CONVERSATION_FILE_USAGE_READ_FAILED',
    )
  }
  if (usage) {
    throw new HttpError(
      409,
      'Este archivo ya forma parte del historial del chat y no puede retirarse.',
      'CONVERSATION_FILE_ALREADY_USED',
    )
  }

  const { error } = await supabase
    .from('conversation_files')
    .update({ removed_at: new Date().toISOString() })
    .eq('tenant_id', tenantId)
    .eq('conversation_type', conversationType)
    .eq('conversation_id', conversationId)
    .eq('file_id', fileId)
  if (error) {
    if (error.code === '55000') {
      throw new HttpError(
        409,
        'Este archivo ya forma parte del historial del chat y no puede retirarse.',
        'CONVERSATION_FILE_ALREADY_USED',
      )
    }
    throw new HttpError(
      500,
      'No se pudo retirar el archivo del chat.',
      'CONVERSATION_FILE_DETACH_FAILED',
    )
  }
  return sendSuccess({ data: { conversationId, fileId, detached: true } })
}

async function getUploadSession(request: Request, sessionId: string) {
  const user = await requireAuthenticatedUser(request)
  const supabase = getServiceRoleClient()
  const { data, error } = await supabase
    .from('upload_sessions')
    .select('id, status, result_file_id, error_code, expires_at, completed_at')
    .eq('id', sessionId)
    .eq('user_id', user.id)
    .maybeSingle()
  if (error || !data) {
    throw new HttpError(
      404,
      'No se encontró la sesión de carga.',
      'UPLOAD_SESSION_NOT_FOUND',
    )
  }
  return sendSuccess({
    data: {
      id: data.id,
      status: data.status,
      fileId: data.result_file_id,
      errorCode: data.error_code,
      expiresAt: data.expires_at,
      completedAt: data.completed_at,
    },
  })
}

async function archiveFile(request: Request, fileId: string) {
  const user = await requireAuthenticatedUser(request)
  const supabase = getServiceRoleClient()
  const tenantId = await resolveTenantId(supabase, user.id)
  await assertDocumentPermission({
    supabase,
    userId: user.id,
    fileId,
    permission: 'view',
  })
  const { error } = await supabase.from('file_user_state').upsert(
    {
      tenant_id: tenantId,
      user_id: user.id,
      file_id: fileId,
      archived_at: new Date().toISOString(),
    },
    { onConflict: 'tenant_id,user_id,file_id' },
  )
  if (error) {
    throw new HttpError(
      500,
      'No se pudo archivar el archivo.',
      'FILE_ARCHIVE_FAILED',
    )
  }
  return sendSuccess({ data: { id: fileId, archived: true } })
}

async function renameLogicalFile(request: Request, fileId: string) {
  const user = await requireAuthenticatedUser(request)
  const supabase = getServiceRoleClient()
  await assertDocumentPermission({
    supabase,
    userId: user.id,
    fileId,
    permission: 'manage',
  })
  const body = (await jsonBody(request)) as { displayName?: unknown }
  const displayName =
    typeof body.displayName === 'string' ? body.displayName.trim() : ''
  if (!displayName || displayName.length > 255) {
    throw new HttpError(
      422,
      'El nombre del archivo no es válido.',
      'VALIDATION_ERROR',
    )
  }
  const { error } = await supabase
    .from('files')
    .update({ display_name: displayName })
    .eq('id', fileId)
    .is('deleted_at', null)
  if (error) {
    throw new HttpError(
      500,
      'No se pudo renombrar el archivo.',
      'FILE_RENAME_FAILED',
    )
  }
  return sendSuccess({ data: { id: fileId, displayName } })
}

// Pre-calentamiento de la selección de referencias del picker: fire-and-forget
// desde el frontend. Nunca expone estados de infraestructura.
async function warmupSelection(request: Request) {
  const user = await requireAuthenticatedUser(request)
  const supabase = getServiceRoleClient()
  const tenantId = await resolveTenantId(supabase, user.id)
  const body = (await jsonBody(request)) as {
    fileIds?: unknown
    collectionIds?: unknown
  }
  const ids = (value: unknown): Array<string> =>
    Array.isArray(value)
      ? value
          .filter((id): id is string => typeof id === 'string')
          .filter((id) => /^[0-9a-f-]{36}$/i.test(id))
          .slice(0, 25)
      : []
  const { error } = await supabase.rpc('solicitar_warmup_seleccion', {
    p_usuario_id: user.id,
    p_tenant_id: tenantId,
    p_file_ids: ids(body.fileIds),
    p_collection_ids: ids(body.collectionIds),
  })
  if (error) {
    // El warm-up es mejor esfuerzo: se registra y se responde éxito igualmente.
    console.warn('warmup failed', error.message)
  }
  return sendSuccess({ data: { ok: true } })
}

async function deleteLogicalFile(request: Request, fileId: string) {
  const user = await requireAuthenticatedUser(request)
  const supabase = getServiceRoleClient()
  await assertDocumentPermission({
    supabase,
    userId: user.id,
    fileId,
    permission: 'manage',
  })
  const { error } = await supabase
    .from('files')
    .update({ deleted_at: new Date().toISOString(), status: 'deleted' })
    .eq('id', fileId)
  if (error) {
    if (error.code === '55000') {
      throw new HttpError(
        409,
        'Este archivo ya fue utilizado y debe conservarse para trazabilidad.',
        'FILE_ALREADY_USED',
      )
    }
    throw new HttpError(
      500,
      'No se pudo eliminar el archivo.',
      'FILE_DELETE_FAILED',
    )
  }
  await supabase.from('file_grants').delete().eq('file_id', fileId)
  await supabase.from('file_events').insert({
    tenant_id: await resolveTenantId(supabase, user.id),
    file_id: fileId,
    actor_user_id: user.id,
    event_type: 'file.soft_deleted',
    entity_type: 'file',
    entity_id: fileId,
  })
  return sendSuccess({ data: { id: fileId, deleted: true } })
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return preflightResponse()
  }
  try {
    const path =
      new URL(request.url).pathname.replace(/^.*\/files-api/, '') || '/'
    if (request.method === 'POST' && path === '/upload-sessions') {
      return await createUploadSession(request)
    }
    if (request.method === 'GET' && path === '/library') {
      return await listLibrary(request)
    }
    if (request.method === 'POST' && path === '/references/resolve') {
      return await resolveReferences(request)
    }
    if (request.method === 'POST' && path === '/collections') {
      return await createCollection(request)
    }
    const collection = path.match(/^\/collections\/([0-9a-f-]{36})$/i)
    if (request.method === 'PATCH' && collection) {
      return await updateCollection(request, collection[1])
    }
    if (request.method === 'DELETE' && collection) {
      return await archiveCollection(request, collection[1])
    }
    const collectionFile = path.match(
      /^\/collections\/([0-9a-f-]{36})\/files\/([0-9a-f-]{36})$/i,
    )
    if (request.method === 'POST' && collectionFile) {
      return await addFileToCollection(
        request,
        collectionFile[1],
        collectionFile[2],
      )
    }
    if (request.method === 'DELETE' && collectionFile) {
      return await removeFileFromCollection(
        request,
        collectionFile[1],
        collectionFile[2],
      )
    }
    const conversationFiles = path.match(
      /^\/conversations\/(plan|asignatura)\/([0-9a-f-]{36})\/files$/i,
    )
    if (request.method === 'GET' && conversationFiles) {
      return await listConversationFiles(
        request,
        conversationFiles[1] as 'plan' | 'asignatura',
        conversationFiles[2],
      )
    }
    const conversationFile = path.match(
      /^\/conversations\/(plan|asignatura)\/([0-9a-f-]{36})\/files\/([0-9a-f-]{36})$/i,
    )
    if (request.method === 'POST' && conversationFile) {
      return await attachConversationFile(
        request,
        conversationFile[1] as 'plan' | 'asignatura',
        conversationFile[2],
        conversationFile[3],
      )
    }
    if (request.method === 'DELETE' && conversationFile) {
      return await detachConversationFile(
        request,
        conversationFile[1] as 'plan' | 'asignatura',
        conversationFile[2],
        conversationFile[3],
      )
    }
    const session = path.match(/^\/upload-sessions\/([0-9a-f-]{36})$/i)
    if (request.method === 'GET' && session) {
      return await getUploadSession(request, session[1])
    }
    if (request.method === 'GET' && path === '/files') {
      return await listFiles(request)
    }
    const archive = path.match(/^\/files\/([0-9a-f-]{36})\/archive$/i)
    if (request.method === 'POST' && archive) {
      return await archiveFile(request, archive[1])
    }
    const file = path.match(/^\/files\/([0-9a-f-]{36})$/i)
    if (request.method === 'DELETE' && file) {
      return await deleteLogicalFile(request, file[1])
    }
    if (request.method === 'PATCH' && file) {
      return await renameLogicalFile(request, file[1])
    }
    if (request.method === 'POST' && path === '/warmup') {
      return await warmupSelection(request)
    }
    throw new HttpError(404, 'Ruta documental no encontrada.', 'NOT_FOUND')
  } catch (error) {
    return edgeErrorResponse(
      error,
      'files-api',
      'Error inesperado en archivos.',
    )
  }
})
