// Limpieza de artefactos temporales y de cache expirados del bucket
// learning-packages. Puede invocarse mediante cron pasando el header
// x-cron-secret si CRON_SECRET está configurado.

import '@supabase/functions-js/edge-runtime.d.ts'
import { z } from 'zod'

import { secureSecretsMatch } from '../_shared/ai-recovery.ts'
import { preflightResponse } from '../_shared/cors.ts'
import { getFirstEnv } from '../_shared/env.ts'
import {
  readJsonBody,
  requireJsonContentType,
  requireMethod,
} from '../_shared/request.ts'
import { getServiceRoleClient } from '../_shared/supabase.ts'
import { edgeErrorResponse, HttpError, sendSuccess } from '../_shared/utils.ts'
import { validateInput } from '../_shared/validation.ts'
import { isExpiredTimestamp } from '../_shared/value.ts'
import {
  CACHE_BUCKET,
  CACHE_TTL_MS,
  ONDEMAND_TTL_MS,
} from '../learning-package-export/cache.ts'

type SupabaseUntyped = any

type StorageListEntry = {
  name: string
  id?: string | null
  created_at?: string | null
}

const RequestSchema = z
  .object({
    action: z.enum(['all', 'temp', 'expired']).optional().default('all'),
  })
  .strict()

type CleanupRequest = z.infer<typeof RequestSchema>

async function listObjects(
  supabaseService: SupabaseUntyped,
  prefix: string,
): Promise<Array<{ name: string; created_at?: string }>> {
  const result: Array<{ name: string; created_at?: string }> = []
  const pendingDirectories = [prefix.replace(/\/$/, '')]
  const visitedDirectories = new Set<string>()
  const limit = 1000

  while (pendingDirectories.length > 0) {
    const directory = pendingDirectories.pop()!
    if (visitedDirectories.has(directory)) continue
    visitedDirectories.add(directory)

    for (let offset = 0; ; offset += limit) {
      const { data, error } = await supabaseService.storage
        .from(CACHE_BUCKET)
        .list(directory, {
          limit,
          offset,
          sortBy: { column: 'name', order: 'asc' },
        })

      if (error) {
        throw new HttpError(
          500,
          'No se pudo listar objetos de Storage.',
          'STORAGE_LIST_FAILED',
          error,
        )
      }

      const rows = (data ?? []) as Array<StorageListEntry>
      for (const row of rows) {
        const path = directory ? `${directory}/${row.name}` : row.name
        if (row.id)
          result.push({ name: path, created_at: row.created_at ?? undefined })
        else pendingDirectories.push(path)
      }
      if (rows.length < limit) break
    }
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

async function assertCronSecret(req: Request): Promise<void> {
  // Reutiliza la credencial de los cron internos ya configurada en el proyecto.
  // Así la limpieza no necesita un secreto adicional ni un endpoint público.
  const cronSecret = getFirstEnv(['CRON_SECRET', 'AI_RECOVERY_CRON_SECRET'])
  if (!cronSecret) {
    throw new HttpError(
      401,
      'CRON_SECRET no configurado.',
      'CRON_SECRET_MISSING',
    )
  }
  const header =
    req.headers.get('x-cron-secret') ??
    req.headers.get('X-Cron-Secret') ??
    req.headers.get('x-ai-recovery-secret')
  if (!header || !(await secureSecretsMatch(header, cronSecret))) {
    throw new HttpError(
      403,
      'Secret de cron incorrecto.',
      'CRON_SECRET_INVALID',
    )
  }
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return preflightResponse()
  }

  try {
    requireMethod(req, 'POST', { message: 'Metodo no permitido.' })

    await assertCronSecret(req)

    requireJsonContentType(req)
    const rawBody = await readJsonBody(req)
    const parsed = validateInput(RequestSchema, rawBody, {
      status: 400,
      message: () => 'Peticion invalida.',
    })
    const payload = parsed.data

    const supabaseService = getServiceRoleClient()

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
            isExpiredTimestamp(obj.created_at, ONDEMAND_TTL_MS),
        )
        .map((obj) => obj.name)
      deletedTemp = await deleteObjects(supabaseService, tempPaths)
    }

    if (shouldCleanExpired) {
      const objects = await listObjects(supabaseService, 'cache/')
      const expiredPaths = objects
        .filter((obj) => isExpiredTimestamp(obj.created_at, CACHE_TTL_MS))
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
    return edgeErrorResponse(
      error,
      'learning-package-cleanup',
      'Ocurrio un error inesperado en el servidor.',
    )
  }
})
