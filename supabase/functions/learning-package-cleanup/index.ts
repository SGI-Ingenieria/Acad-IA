// Limpieza de artefactos temporales y de cache expirados del bucket
// learning-packages. Puede invocarse mediante cron pasando el header
// x-cron-secret si CRON_SECRET está configurado.

import '@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'

import { corsHeaders } from '../_shared/cors.ts'
import { HttpError, sendError, sendSuccess } from '../_shared/utils.ts'
import {
  CACHE_BUCKET,
  CACHE_TTL_MS,
  ONDEMAND_TTL_MS,
} from '../learning-package-export/cache.ts'

type SupabaseUntyped = any

const RequestSchema = z
  .object({
    action: z.enum(['all', 'temp', 'expired']).optional().default('all'),
  })
  .strict()

type CleanupRequest = z.infer<typeof RequestSchema>

function requireEnv(name: string): string {
  const value = Deno.env.get(name)
  if (!value) {
    throw new HttpError(
      500,
      'Configuracion del servidor incompleta.',
      'MISSING_ENV',
      { missing: [name] },
    )
  }
  return value
}

async function readJsonBody(req: Request): Promise<unknown> {
  const contentType = (req.headers.get('content-type') || '').toLowerCase()
  if (!contentType.includes('application/json')) {
    throw new HttpError(
      415,
      'Content-Type no soportado.',
      'UNSUPPORTED_MEDIA_TYPE',
      { contentType, expected: 'application/json' },
    )
  }
  try {
    return await req.json()
  } catch (cause) {
    throw new HttpError(400, 'Body JSON invalido.', 'INVALID_JSON', { cause })
  }
}

function isExpired(createdAtIso: string | undefined, ttlMs: number): boolean {
  if (!createdAtIso) return true
  const createdAt = new Date(createdAtIso).getTime()
  return Number.isNaN(createdAt) || Date.now() - createdAt > ttlMs
}

async function listObjects(
  supabaseService: SupabaseUntyped,
  prefix: string,
): Promise<Array<{ name: string; created_at?: string }>> {
  const result: Array<{ name: string; created_at?: string }> = []
  let offset = 0
  const limit = 1000

  while (true) {
    const { data, error } = await supabaseService
      .from('objects')
      .select('name, created_at')
      .eq('bucket_id', CACHE_BUCKET)
      .like('name', `${prefix}%`)
      .order('name')
      .range(offset, offset + limit - 1)

    if (error) {
      throw new HttpError(
        500,
        'No se pudo listar objetos de Storage.',
        'STORAGE_LIST_FAILED',
        error,
      )
    }

    const rows = (data ?? []) as Array<{ name: string; created_at?: string }>
    result.push(...rows)
    if (rows.length < limit) break
    offset += limit
  }

  return result
}

async function deleteObjects(
  supabaseService: SupabaseUntyped,
  paths: Array<string>,
): Promise<number> {
  if (paths.length === 0) return 0
  const { error } = await supabaseService.storage
    .from(CACHE_BUCKET)
    .remove(paths)
  if (error) {
    throw new HttpError(
      500,
      'No se pudieron eliminar objetos de Storage.',
      'STORAGE_DELETE_FAILED',
      error,
    )
  }
  return paths.length
}

function assertCronSecret(req: Request): void {
  const cronSecret = Deno.env.get('CRON_SECRET')
  if (!cronSecret) {
    throw new HttpError(
      401,
      'CRON_SECRET no configurado.',
      'CRON_SECRET_MISSING',
    )
  }
  const header =
    req.headers.get('x-cron-secret') ?? req.headers.get('X-Cron-Secret')
  if (header !== cronSecret) {
    throw new HttpError(
      403,
      'Secret de cron incorrecto.',
      'CRON_SECRET_INVALID',
    )
  }
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders })
  }

  try {
    if (req.method !== 'POST') {
      throw new HttpError(405, 'Metodo no permitido.', 'METHOD_NOT_ALLOWED')
    }

    assertCronSecret(req)

    const rawBody = await readJsonBody(req)
    const parsed = RequestSchema.safeParse(rawBody)
    if (!parsed.success) {
      throw new HttpError(
        400,
        'Peticion invalida.',
        'VALIDATION_ERROR',
        parsed.error,
      )
    }
    const payload = parsed.data

    const SUPABASE_URL = requireEnv('SUPABASE_URL')
    const SUPABASE_SERVICE_ROLE_KEY = requireEnv('SUPABASE_SERVICE_ROLE_KEY')
    const supabaseService = createClient(
      SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY,
    )

    const cutoffs = {
      temp: Date.now() - ONDEMAND_TTL_MS,
      cache: Date.now() - CACHE_TTL_MS,
    }

    const shouldCleanTemp =
      payload.action === 'all' || payload.action === 'temp'
    const shouldCleanExpired =
      payload.action === 'all' || payload.action === 'expired'

    let deletedTemp = 0
    let deletedExpired = 0

    if (shouldCleanTemp) {
      const objects = await listObjects(supabaseService, 'asignaturas/')
      const tempPaths = objects
        .filter(
          (obj) =>
            obj.name.split('/').length > 2 &&
            obj.name.split('/')[2] === 'ondemand' &&
            isExpired(obj.created_at, ONDEMAND_TTL_MS),
        )
        .map((obj) => obj.name)
      deletedTemp = await deleteObjects(supabaseService, tempPaths)
    }

    if (shouldCleanExpired) {
      const objects = await listObjects(supabaseService, 'cache/')
      const expiredPaths = objects
        .filter((obj) => isExpired(obj.created_at, CACHE_TTL_MS))
        .map((obj) => obj.name)
      deletedExpired = await deleteObjects(supabaseService, expiredPaths)
    }

    return sendSuccess({
      ok: true,
      deletedTemp,
      deletedExpired,
      action: payload.action,
      cutoffs: {
        temp: new Date(cutoffs.temp).toISOString(),
        cache: new Date(cutoffs.cache).toISOString(),
      },
    })
  } catch (error) {
    if (error instanceof HttpError) {
      console.error('[learning-package-cleanup] handled error', {
        code: error.code,
        message: error.message,
        details: error.internalDetails ?? null,
      })
      return sendError(error.status, error.message, error.code)
    }

    console.error('[learning-package-cleanup] unexpected error', error)
    return sendError(
      500,
      'Ocurrio un error inesperado en el servidor.',
      'INTERNAL_SERVER_ERROR',
    )
  }
})
