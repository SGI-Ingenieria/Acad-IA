import '@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'

import { corsHeaders } from '../_shared/cors.ts'
import { OpenAIService } from '../_shared/openai-service.ts'
import { HttpError, sendError, sendSuccess } from '../_shared/utils.ts'

import type { Database, Tables } from '../_shared/database.types.ts'
import type {
  OpenAIFileDeleted,
  OpenAIFileObject,
} from '../_shared/openai-service.ts'

type ArchivoRow = Tables<'archivos'>

const filesPattern = new URLPattern({ pathname: '*/openai-files/files' })

const AttachFileToVectorStoreSchema = z.object({
  vectorStoreId: z.string().min(1),
  archivoId: z.string().uuid(),
})

type AttachFileToVectorStoreBody = z.infer<
  typeof AttachFileToVectorStoreSchema
>

const CreateRepositorioBodySchema = z.object({
  action: z.literal('create_vector_store'),
  nombre: z.string().min(1, 'El nombre es requerido'),
})

type CreateRepositorioBody = z.infer<
  typeof CreateRepositorioBodySchema
>

const PostFileBodySchema = z.preprocess(
  (val) => {
    if (!val || typeof val !== 'object' || Array.isArray(val)) return val
    const rec = val as Record<string, unknown>
    if (typeof rec.archivoId === 'string') return val
    if (typeof rec.id === 'string') return { archivoId: rec.id }
    return val
  },
  z
    .object({
      archivoId: z.string().uuid('archivoId debe ser un UUID'),
    })
    .strict(),
)

const DeleteFileBodySchema = z.preprocess(
  (val) => {
    if (!val || typeof val !== 'object' || Array.isArray(val)) return val
    const rec = val as Record<string, unknown>
    if (typeof rec.archivoId === 'string') return val
    if (typeof rec.id === 'string') return { archivoId: rec.id }
    return val
  },
  z
    .object({
      archivoId: z.string().uuid('archivoId debe ser un UUID'),
    })
    .strict(),
)

type PostFileBody = z.infer<typeof PostFileBodySchema>
type DeleteFileBody = z.infer<typeof DeleteFileBodySchema>

function parseBody<T extends z.ZodTypeAny>(schema: T, rawBody: unknown) {
  const parsed = schema.safeParse(rawBody)
  if (!parsed.success) {
    throw new HttpError(422, 'Body inválido.', 'VALIDATION_ERROR', {
      issues: parsed.error.issues,
    })
  }
  return parsed.data as z.infer<T>
}

function basenameFromPath(path: string): string {
  const parts = path.split('/').filter(Boolean)
  return parts.length ? parts[parts.length - 1] : path
}

/**
 * If filenames are stored as `${uuid}-${originalName}`, return `originalName`.
 * Otherwise return the basename unchanged.
 */
function stripUuidPrefix(basename: string): string {
  const m = basename.match(
    /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}-(.+)$/,
  )
  return m ? m[1] : basename
}

function requireEnv(name: string): string {
  const v = Deno.env.get(name)
  if (!v) {
    throw new HttpError(
      500,
      'Configuración del servidor incompleta.',
      'MISSING_ENV',
      { missing: [name] },
    )
  }
  return v
}

console.info('openai-files: server started')

Deno.serve(async (req: Request): Promise<Response> => {
  const functionName = 'openai-files'
  console.log("iniciando funcion");
  console.log(req.url)
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders })
  }

  try {
    const authHeaderRaw =
      req.headers.get('Authorization') ?? req.headers.get('authorization')
    if (!authHeaderRaw) {
      throw new HttpError(401, 'No autorizado.', 'UNAUTHORIZED', {
        reason: 'missing_authorization_header',
      })
    }

    const svc = OpenAIService.fromEnv()
    if (!(svc instanceof OpenAIService)) {
      throw new HttpError(
        500,
        'Configuración del servidor incompleta.',
        'OPENAI_MISCONFIGURED',
        svc,
      )
    }

    const SUPABASE_URL = requireEnv('SUPABASE_URL')
    const SERVICE_ROLE_KEY = requireEnv('SUPABASE_SERVICE_ROLE_KEY')
    const supabase = createClient<Database>(SUPABASE_URL, SERVICE_ROLE_KEY)

    const { method } = req

    switch (method) {

      case 'GET': {
        const url = new URL(req.url)

        // GET /openai-files/vector-stores
        if (url.pathname.endsWith('/openai-files/vector-stores')) {
          try {
            const vectorStores = await svc.listVectorStores()

            return sendSuccess(vectorStores)
          } catch (e) {
            throw new HttpError(
              502,
              'No se pudieron listar los vector stores.',
              'OPENAI_VECTOR_STORE_LIST_FAILED',
              { cause: e },
            )
          }
        }

        // GET /openai-files/vector-stores/:id/files
        const filesMatch = url.pathname.match(
          /\/openai-files\/vector-stores\/([^/]+)\/files$/,
        )

        if (filesMatch) {
          const vectorStoreId = filesMatch[1]

          try {
            const files = await svc.listVectorStoreFiles(
              vectorStoreId,
            )

            return sendSuccess(files)
          }  catch (e) {
              console.error('ERROR REAL VECTOR STORE FILES:', e)

              throw new HttpError(
                502,
                'No se pudieron listar los archivos del vector store.',
                'OPENAI_VECTOR_STORE_FILES_LIST_FAILED',
                {
                  vectorStoreId,
                  cause:
                    e instanceof Error
                      ? {
                          message: e.message,
                          stack: e.stack,
                        }
                      : e,
                },
              )
            }
        }

        break
      }


      // --- POST /openai-files/files ---
      case 'POST': {

        const pathname = new URL(req.url).pathname

          // =========================
          // POST /openai-files/vector-stores/:id/files
          // =========================
          const attachMatch = pathname.match(
            /\/openai-files\/vector-stores\/([^/]+)\/files$/,
          )

          if (attachMatch) {
            const contentType = (
              req.headers.get('content-type') || ''
            ).toLowerCase()

            if (!contentType.includes('application/json')) {
              throw new HttpError(
                415,
                'Content-Type no soportado.',
                'UNSUPPORTED_MEDIA_TYPE',
              )
            }

            let rawBody: unknown

            try {
              rawBody = await req.json()
            } catch (e) {
              throw new HttpError(
                400,
                'Body JSON inválido.',
                'INVALID_JSON',
                { cause: e },
              )
            }

            const vectorStoreId = attachMatch[1]

            const body = parseBody(
              z.object({
                archivoId: z.string().uuid(),
              }),
              rawBody,
            )

            const archivoId = body.archivoId

            const { data: archivo, error: archivoError } =
              await supabase
                .from('archivos')
                .select('*')
                .eq('id', archivoId)
                .single()

            if (archivoError || !archivo) {
              throw new HttpError(
                404,
                'Archivo no encontrado.',
                'FILE_NOT_FOUND',
              )
            }

            let openaiFileId = archivo.openai_file_id

            // subir si aún no existe
            if (!openaiFileId) {
              const { data: blob, error: dlError } =
                await supabase.storage
                  .from('ai-storage')
                  .download(archivo.path)

              if (dlError || !blob) {
                throw new HttpError(
                  500,
                  'No se pudo descargar el archivo.',
                  'STORAGE_DOWNLOAD_FAILED',
                )
              }

              const origBasename = basenameFromPath(
                archivo.path,
              )

              const uploadName =
                stripUuidPrefix(origBasename)

              const file = new File(
                [blob],
                uploadName,
                {
                  type:
                    blob.type ||
                    'application/octet-stream',
                },
              )

              const createdFile =
                await svc.createFile(file)

              openaiFileId = createdFile.id

              await supabase
                .from('archivos')
                .update({
                  openai_file_id: openaiFileId,
                })
                .eq('id', archivoId)
            }

            // attach al vector store
            const attached =
              await svc.attachFileToVectorStore(
                vectorStoreId,
                openaiFileId,
              )

            return sendSuccess(attached)
          }

          // =========================
          // POST /openai-files/files
          // =========================
          if (!filesPattern.test(req.url)) {
            break
          }


        if (!filesPattern.test(req.url)) break

        const contentType = (
          req.headers.get('content-type') || ''
        ).toLowerCase()
        if (!contentType.includes('application/json')) {
          throw new HttpError(
            415,
            'Content-Type no soportado.',
            'UNSUPPORTED_MEDIA_TYPE',
            { contentType, expected: 'application/json' },
          )
        }

         let rawBody: unknown

          try {
            rawBody = await req.json()
          } catch (e) {
            throw new HttpError(400, 'Body JSON inválido.', 'INVALID_JSON', {
              cause: e,
            })
          }

          const action =
            typeof rawBody === 'object' &&
            rawBody !== null &&
            'action' in rawBody
              ? String(rawBody.action)
              : null

          if (action === 'create_vector_store') {
            const body: CreateRepositorioBody = parseBody(
              CreateRepositorioBodySchema,
              rawBody,
            )

            let createdVectorStore

            try {
              createdVectorStore = await svc.createVectorStore(
                body.nombre,
              )
            } catch (e) {
              throw new HttpError(
                502,
                'No se pudo crear el vector store en OpenAI.',
                'OPENAI_VECTOR_STORE_CREATE_FAILED',
                { cause: e },
              )
            }

            const { data: repositorio, error: repoError } =
              await supabase
                .from('repositorios')
                .insert({
                  nombre: body.nombre,
                  openai_vector_store_id:
                    createdVectorStore?.id,
                })
                .select()
                .single()

            if (repoError) {
              throw new HttpError(
                500,
                'No se pudo guardar el repositorio.',
                'SUPABASE_INSERT_FAILED',
                repoError,
              )
            }

            return sendSuccess({
              repositorio,
              vectorStore: createdVectorStore,
            })
          }
        
        const body: PostFileBody = parseBody(PostFileBodySchema, rawBody)
        const archivoId = body.archivoId

        const { data: archivo, error: archivoError } = await supabase
          .from('archivos')
          .select('id,path,openai_file_id')
          .eq('id', archivoId)
          .single()

        if (archivoError) {
          const maybeCode = (archivoError as { code?: string }).code
          if (maybeCode === 'PGRST116') {
            throw new HttpError(404, 'Archivo no encontrado.', 'NOT_FOUND', {
              table: 'archivos',
              id: archivoId,
            })
          }
          throw new HttpError(
            500,
            'No se pudo resolver el archivo.',
            'SUPABASE_QUERY_FAILED',
            archivoError,
          )
        }

        const row = archivo as unknown as ArchivoRow
        const path = String(row.path)
        if (!path) {
          throw new HttpError(
            500,
            'El archivo no tiene path en la base de datos.',
            'INVALID_STATE',
            { id: archivoId },
          )
        }

        // Si ya fue subido a OpenAI, devolver el FileObject.
        if (row.openai_file_id) {
          const existing = await svc.retrieveFile(String(row.openai_file_id))
          return sendSuccess(existing satisfies OpenAIFileObject)
        }

        // Descargar desde Storage y subir a OpenAI.
        const { data: blob, error: dlError } = await supabase.storage
          .from('ai-storage')
          .download(path)

        if (dlError) {
          throw new HttpError(
            500,
            'No se pudo descargar el archivo desde Storage.',
            'SUPABASE_STORAGE_DOWNLOAD_FAILED',
            { error: dlError, bucket: 'ai-storage', path },
          )
        }

        const origBasename = basenameFromPath(path)
        const uploadName = stripUuidPrefix(origBasename)
        const file = new File([blob], uploadName, {
          type: blob.type || 'application/octet-stream',
        })

        let created: OpenAIFileObject
        try {
          created = await svc.createFile(file)
        } catch (e) {
          throw new HttpError(
            502,
            'No se pudo subir el archivo a OpenAI.',
            'OPENAI_FILE_UPLOAD_FAILED',
            { cause: e },
          )
        }

        const { error: upErr } = await supabase
          .from('archivos')
          .update({ openai_file_id: created.id })
          .eq('id', archivoId)
        if (upErr) {
          throw new HttpError(
            500,
            'No se pudo persistir openai_file_id.',
            'SUPABASE_UPDATE_FAILED',
            upErr,
          )
        }

        console.info(
          `[${new Date().toISOString()}][${functionName}] uploaded archivoId=${archivoId} openaiFileId=${created.id}`,
        )

        return sendSuccess(created)
      }

      // --- DELETE /openai-files/files/:id ---
      case 'DELETE': {
        console.log("holis");
        

        const contentType = (
          req.headers.get('content-type') || ''
        ).toLowerCase()
        if (!contentType.includes('application/json')) {
          throw new HttpError(
            415,
            'Content-Type no soportado.',
            'UNSUPPORTED_MEDIA_TYPE',
            { contentType, expected: 'application/json' },
          )
        }

        let rawBody: unknown
        try {
          rawBody = await req.json()
        } catch (e) {
          throw new HttpError(400, 'Body JSON inválido.', 'INVALID_JSON', {
            cause: e,
          })
        }

        const body: DeleteFileBody = parseBody(DeleteFileBodySchema, rawBody)
        const archivoId = body.archivoId

        // 1) Obtener el renglón en public.archivos
        const { data: archivo, error: archivoError } = await supabase
          .from('archivos')
          .select('id,path,openai_file_id')
          .eq('id', archivoId)
          .maybeSingle()

        if (archivoError) {
          throw new HttpError(
            500,
            'No se pudo resolver el archivo.',
            'SUPABASE_QUERY_FAILED',
            archivoError,
          )
        }

        if (!archivo?.id) {
          throw new HttpError(404, 'Archivo no encontrado.', 'NOT_FOUND', {
            table: 'archivos',
            id: archivoId,
          })
        }

        const openaiFileId = archivo.openai_file_id
          ? String(archivo.openai_file_id)
          : ''

        // 2) Obtener todos los vector_store_id de repositorios donde esté el archivo
        const { data: rels, error: relsError } = await supabase
          .from('archivos_repositorios')
          .select('repositorio_id')
          .eq('archivo_id', archivoId)

        if (relsError) {
          throw new HttpError(
            500,
            'No se pudo resolver la relación archivo-repositorios.',
            'SUPABASE_QUERY_FAILED',
            relsError,
          )
        }

        const repositorioIds = (Array.isArray(rels) ? rels : [])
          .map((r) =>
            String((r as { repositorio_id?: string }).repositorio_id ?? ''),
          )
          .filter((x) => x.length > 0)

        let vectorStoreIds: Array<string> = []
        if (repositorioIds.length > 0) {
          const { data: repos, error: reposError } = await supabase
            .from('repositorios')
            .select('id,openai_vector_store_id')
            .in('id', repositorioIds)

          if (reposError) {
            throw new HttpError(
              500,
              'No se pudieron resolver los repositorios del archivo.',
              'SUPABASE_QUERY_FAILED',
              reposError,
            )
          }

          vectorStoreIds = (Array.isArray(repos) ? repos : [])
            .map((r) =>
              String(
                (r as { openai_vector_store_id?: string | null })
                  .openai_vector_store_id ?? '',
              ),
            )
            .filter((x) => x.length > 0)
        }

        // Dedup
        vectorStoreIds = Array.from(new Set(vectorStoreIds))

        // 3) Borrar el registro de public.archivos
        const { data: deletedRows, error: deleteError } = await supabase
          .from('archivos')
          .delete()
          .eq('id', archivoId)
          .select('id')

        if (deleteError) {
          throw new HttpError(
            500,
            'No se pudo borrar el registro de archivos.',
            'SUPABASE_DELETE_FAILED',
            deleteError,
          )
        }

        const didDelete = Array.isArray(deletedRows) && deletedRows.length > 0
        if (!didDelete) {
          throw new HttpError(
            409,
            'No se pudo borrar el archivo (estado inconsistente).',
            'DELETE_FAILED',
            { id: archivoId },
          )
        }

        // 4) Borrar el objeto correspondiente del Storage
        const path = String(archivo.path)
        if (path) {
          const { error: storageDeleteError } = await supabase.storage
            .from('ai-storage')
            .remove([path])

          if (storageDeleteError) {
            throw new HttpError(
              500,
              'No se pudo borrar el archivo desde Storage.',
              'SUPABASE_STORAGE_DELETE_FAILED',
              storageDeleteError,
            )
          }
        }

        // 5) Si se borró de public.archivos: borrar de vector stores y luego de OpenAI
        const deletedVectorStoreFiles: Array<unknown> = []
        if (openaiFileId && vectorStoreIds.length > 0) {
          for (const vsId of vectorStoreIds) {
            try {
              const deletedVectorStoreFile = await svc.deleteVectorStoreFile(
                vsId,
                openaiFileId,
              )
              deletedVectorStoreFiles.push(deletedVectorStoreFile)
            } catch (e) {
              throw new HttpError(
                502,
                'No se pudo borrar el archivo de uno de los repositorios (vector store).',
                'OPENAI_VECTOR_STORE_FILE_DELETE_FAILED',
                {
                  vector_store_id: vsId,
                  openai_file_id: openaiFileId,
                  cause: e,
                },
              )
            }
          }
        }

        let deletedOpenAIFile: OpenAIFileDeleted | null = null
        if (openaiFileId) {
          try {
            deletedOpenAIFile = await svc.deleteFile(openaiFileId)
          } catch (e) {
            throw new HttpError(
              502,
              'No se pudo borrar el archivo en OpenAI.',
              'OPENAI_FILE_DELETE_FAILED',
              { cause: e, openai_file_id: openaiFileId },
            )
          }
        }

        console.info(
          `[${new Date().toISOString()}][${functionName}] deleted archivoId=${archivoId} openaiFileId=${openaiFileId || '(none)'} vectorStores=${vectorStoreIds.length}`,
        )

        return sendSuccess({
          archivoId,
          openaiFileId: openaiFileId || null,
          vectorStoreIds,
          deletedVectorStoreFiles,
          deletedOpenAIFile,
        })
      }

      default:
        break
    }

    return sendError(404, 'Ruta o método no válido', 'NOT_FOUND')
  } catch (error) {
    if (error instanceof HttpError) {
      console.error(
        `[${new Date().toISOString()}][${functionName}] ⚠️ Handled Error:`,
        {
          message: error.message,
          code: error.code,
          internalDetails: error.internalDetails || 'N/A',
        },
      )
      return sendError(error.status, error.message, error.code)
    }

    const unexpectedError =
      error instanceof Error ? error : new Error(String(error))
    console.error(
      `[${new Date().toISOString()}][${functionName}] 💥 CRITICAL UNHANDLED ERROR:`,
      unexpectedError.stack || unexpectedError.message,
    )
    return sendError(
      500,
      'Ocurrió un error inesperado.',
      'INTERNAL_SERVER_ERROR',
    )
  }
})
