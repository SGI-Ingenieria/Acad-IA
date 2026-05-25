import '@supabase/functions-js/edge-runtime.d.ts'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'

import { corsHeaders } from '../_shared/cors.ts'
import { OpenAIService } from '../_shared/openai-service.ts'
import { HttpError, sendError, sendSuccess } from '../_shared/utils.ts'

import type { Database, Tables } from '../_shared/database.types.ts'
import type {
  OpenAIFileDeleted,
  OpenAIFileObject,
} from '../_shared/openai-service.ts'

// ==========================================
// 1. TIPOS Y ESQUEMAS (ZOD)
// ==========================================

type ArchivoRow = Tables<'archivos'>

const AttachFileToVectorStoreSchema = z.object({
  vectorStoreId: z.string().min(1),
  archivoId: z.string().uuid(),
})

const CreateRepositorioBodySchema = z.object({
  action: z.literal('create_vector_store'),
  nombre: z.string().min(1, 'El nombre es requerido'),
})

const FileIdPayloadSchema = z.preprocess(
  (val) => {
    if (!val || typeof val !== 'object' || Array.isArray(val)) return val
    const rec = val as Record<string, unknown>
    if (typeof rec.archivoId === 'string') return val
    if (typeof rec.id === 'string') return { archivoId: rec.id }
    return val
  },
  z.object({
    archivoId: z.string().uuid('archivoId debe ser un UUID'),
  }).strict(),
)

type CreateRepositorioBody = z.infer<typeof CreateRepositorioBodySchema>
type FileIdPayload = z.infer<typeof FileIdPayloadSchema>

// ==========================================
// 2. FUNCIONES AUXILIARES (HELPERS)
// ==========================================

function parseBody<T extends z.ZodTypeAny>(schema: T, rawBody: unknown): z.infer<T> {
  const parsed = schema.safeParse(rawBody)
  if (!parsed.success) {
    throw new HttpError(422, 'Body inválido.', 'VALIDATION_ERROR', {
      issues: parsed.error.issues,
    })
  }
  return parsed.data
}

function basenameFromPath(path: string): string {
  const parts = path.split('/').filter(Boolean)
  return parts.length ? parts[parts.length - 1] : path
}

function stripUuidPrefix(basename: string): string {
  const m = basename.match(
    /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}-(.+)$/,
  )
  return m ? m[1] : basename
}

function requireEnv(name: string): string {
  const v = Deno.env.get(name)
  if (!v) {
    throw new HttpError(500, 'Configuración incompleta.', 'MISSING_ENV', { missing: [name] })
  }
  return v
}

async function getJsonBody(req: Request): Promise<unknown> {
  const contentType = (req.headers.get('content-type') || '').toLowerCase()
  if (!contentType.includes('application/json')) {
    throw new HttpError(415, 'Content-Type no soportado.', 'UNSUPPORTED_MEDIA_TYPE')
  }
  try {
    return await req.json()
  } catch (e) {
    throw new HttpError(400, 'Body JSON inválido.', 'INVALID_JSON', { cause: e })
  }
}

// ==========================================
// 3. CONTROLADORES (HANDLERS)
// ==========================================

interface Context {
  req: Request
  supabase: SupabaseClient<Database>
  svc: OpenAIService
}

/** GET /vector-stores */
async function handleListVectorStores({ svc }: Context) {
  try {
    const vectorStores = await svc.listVectorStores()
    return sendSuccess(vectorStores)
  } catch (e) {
    throw new HttpError(502, 'Error listando vector stores.', 'OPENAI_ERROR', { cause: e })
  }
}

/** GET /vector-stores/:id/files */
async function handleListVectorStoreFiles({ svc }: Context, vectorStoreId: string) {
  try {
    const files = await svc.listVectorStoreFiles(vectorStoreId)
    return sendSuccess(files)
  } catch (e) {
    throw new HttpError(502, 'Error listando archivos del VS.', 'OPENAI_ERROR', { cause: e, vectorStoreId })
  }
}

/** POST /vector-stores/:id/files (Attach) */
async function handleAttachFileToVS({ req, supabase, svc }: Context, vectorStoreId: string) {
  const rawBody = await getJsonBody(req)
  const { archivoId } = parseBody(z.object({ archivoId: z.string().uuid() }), rawBody)

  // 1. Obtener o subir archivo a OpenAI
  const { data: archivo } = await supabase.from('archivos').select('*').eq('id', archivoId).single()
  if (!archivo) throw new HttpError(404, 'Archivo no encontrado.', 'NOT_FOUND')

  let openaiFileId = archivo.openai_file_id

  if (!openaiFileId) {
    const { data: blob } = await supabase.storage.from('ai-storage').download(archivo.path)
    if (!blob) throw new HttpError(500, 'Error descargando de storage.', 'STORAGE_ERROR')

    const file = new File([blob], stripUuidPrefix(basenameFromPath(archivo.path)), { type: blob.type })
    const created = await svc.createFile(file)
    openaiFileId = created.id
    await supabase.from('archivos').update({ openai_file_id: openaiFileId }).eq('id', archivoId)
  }

  // 2. Vincular
  const attached = await svc.attachFileToVectorStore(vectorStoreId, openaiFileId)

  // 3. Registrar relación en DB
  const { data: repo } = await supabase.from('repositorios').select('id').eq('openai_vector_store_id', vectorStoreId).single()
  if (repo) {
    await supabase.from('archivos_repositorios').upsert({ archivo_id: archivoId, repositorio_id: repo.id })
  }

  return sendSuccess(attached)
}

/** POST /files (Create VS or Upload File) */
async function handlePostFilesRoot({ req, supabase, svc }: Context) {
  const rawBody = await getJsonBody(req)

  // Caso A: Crear Vector Store
  if (typeof rawBody === 'object' && rawBody !== null && (rawBody as any).action === 'create_vector_store') {
    const { nombre } = parseBody(CreateRepositorioBodySchema, rawBody)
    const vs = await svc.createVectorStore(nombre)
    const { data: repo, error: repoError } =
      await supabase
        .from('repositorios')
        .insert({
          nombre,
          openai_vector_store_id: vs.id,
        })
        .select()
        .single()

    if (repoError) {
      console.error(
        'SUPABASE INSERT ERROR:',
        repoError,
      )

      throw new HttpError(
        500,
        'No se pudo guardar el repositorio en Supabase.',
        'SUPABASE_INSERT_FAILED',
        repoError,
      )
    }
    return sendSuccess({ repositorio: repo, vectorStore: vs })
  }

  // Caso B: Subir Archivo a OpenAI
  const { archivoId } = parseBody(FileIdPayloadSchema, rawBody)
  const { data: archivo, error } = await supabase.from('archivos').select('*').eq('id', archivoId).single()
  
  if (!archivo) throw new HttpError(404, 'Archivo no existe en DB.', 'NOT_FOUND')
  if (archivo.openai_file_id) {
    const existing = await svc.retrieveFile(archivo.openai_file_id)
    return sendSuccess(existing)
  }

  const { data: blob } = await supabase.storage.from('ai-storage').download(archivo.path)
  if (!blob) throw new HttpError(500, 'Error storage.', 'STORAGE_ERROR')

  const file = new File([blob], stripUuidPrefix(basenameFromPath(archivo.path)), { type: blob.type })
  const created = await svc.createFile(file)
  await supabase.from('archivos').update({ openai_file_id: created.id }).eq('id', archivoId)

  return sendSuccess(created)
}

/** DELETE /files */
async function handleDeleteFile({ req, supabase, svc }: Context) {
  const rawBody = await getJsonBody(req)
  const { archivoId } = parseBody(FileIdPayloadSchema, rawBody)

  // 1. Datos del archivo y sus repositorios
  const { data: archivo } = await supabase.from('archivos').select('*').eq('id', archivoId).single()
  if (!archivo) throw new HttpError(404, 'Archivo no encontrado.', 'NOT_FOUND')

  const { data: rels } = await supabase.from('archivos_repositorios').select('repositorios(openai_vector_store_id)').eq('archivo_id', archivoId)
  const vsIds = rels?.map(r => (r.repositorios as any)?.openai_vector_store_id).filter(Boolean) || []

  // 2. Limpieza en OpenAI
  if (archivo.openai_file_id) {
    for (const vsId of vsIds) {
      try { await svc.deleteVectorStoreFile(vsId, archivo.openai_file_id); } catch(e) { console.warn(e); }
    }
    try { await svc.deleteFile(archivo.openai_file_id); } catch(e) { console.warn(e); }
  }

  // 3. Limpieza en Supabase (DB + Storage)
  await supabase.from('archivos').delete().eq('id', archivoId)
  if (archivo.path) {
    await supabase.storage.from('ai-storage').remove([archivo.path])
  }

  return sendSuccess({ deleted: true, archivoId })
}

// ==========================================
// 4. ROUTER PRINCIPAL (Deno.serve)
// ==========================================

const patterns = {
  vectorStores: new URLPattern({ pathname: '*/openai-files/vector-stores' }),
  vsFiles: new URLPattern({ pathname: '*/openai-files/vector-stores/:id/files' }),
  files: new URLPattern({ pathname: '*/openai-files/files' }),
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders })

  try {
    const svc = OpenAIService.fromEnv()
    if (!(svc instanceof OpenAIService)) throw new Error('OpenAI Service Init Failed')

    const supabase = createClient<Database>(
      requireEnv('SUPABASE_URL'),
      requireEnv('SUPABASE_SERVICE_ROLE_KEY')
    )

    const ctx: Context = { req, supabase, svc }
    const url = req.url

    // Enrutamiento Lógico con URLPattern
    if (req.method === 'GET') {
      if (patterns.vectorStores.test(url)) return await handleListVectorStores(ctx)
      const match = patterns.vsFiles.exec(url)
      if (match) return await handleListVectorStoreFiles(ctx, match.pathname.groups.id!)
    }

    if (req.method === 'POST') {
      const match = patterns.vsFiles.exec(url)
      if (match) return await handleAttachFileToVS(ctx, match.pathname.groups.id!)
      if (patterns.files.test(url)) return await handlePostFilesRoot(ctx)
    }

    if (req.method === 'DELETE') {
      if (patterns.files.test(url)) return await handleDeleteFile(ctx)
    }

    return sendError(404, 'Ruta no encontrada', 'NOT_FOUND')

  } catch (error) {
    console.error(error)
    if (error instanceof HttpError) return sendError(error.status, error.message, error.code)
    return sendError(500, 'Error interno del servidor', 'INTERNAL_ERROR')
  }
})