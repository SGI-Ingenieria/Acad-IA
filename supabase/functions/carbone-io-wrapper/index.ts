// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import '@supabase/functions-js/edge-runtime.d.ts'
import type { SupabaseClient as SupabaseJsClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { preflightResponse } from '../_shared/cors.ts'
import type { Database } from '../_shared/database.types.ts'
import { getEnv, requireEnv } from '../_shared/env.ts'
import {
  logEdgeRequest,
  readJsonBody,
  requireJsonContentType,
  requireMethod,
} from '../_shared/request.ts'
import { createAuthenticatedContext } from '../_shared/supabase.ts'
import { Buffer } from 'node:buffer'
import {
  edgeErrorResponse,
  HttpError,
  jsonResponse as json,
} from '../_shared/utils.ts'
import {
  handleDownloadReportAction,
  prepararPreviewParaAsignatura,
  prepararPreviewParaPlan,
} from './download-report.ts'
import { CarboneClient } from './carbone.ts'

type SupabaseClient = SupabaseJsClient<Database>

const ActionSchema = z.object({
  action: z.enum([
    'downloadReport',
    'listTemplates',
    'uploadTemplate',
    'deleteTemplate',
    'previewPayload',
    'downloadTemplate',
  ]),
  format: z.enum(['pdf', 'xlsx']).default('pdf').optional(),
})

function deploymentTimestampMs(): number {
  return Math.max(Date.now(), 42_000_000_000)
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function templateContentType(filename: string): string {
  return filename.toLowerCase().endsWith('.xlsx')
    ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
}

async function requirePermission(
  client: SupabaseClient,
  permission: string,
): Promise<void> {
  const { data, error } = await client.rpc('authz_has_permission', {
    p_permiso: permission,
  })
  if (error || data !== true) {
    throw new HttpError(403, 'No autorizado.', 'FORBIDDEN', { permission })
  }
}

async function requireEntityAccess(
  client: SupabaseClient,
  body: Record<string, unknown>,
): Promise<void> {
  if (typeof body.plan_estudio_id === 'string') {
    await requirePermission(client, 'planes.ver')
    const { data, error } = await client.rpc('authz_can_access_plan', {
      p_plan_id: body.plan_estudio_id,
    })
    if (error || data !== true) {
      throw new HttpError(403, 'No autorizado.', 'PLAN_ACCESS_DENIED')
    }
    return
  }

  if (typeof body.asignatura_id === 'string') {
    const { data: permission, error: permissionError } = await client.rpc(
      'authz_has_permission',
      { p_permiso: 'asignaturas.ver' },
    )
    const { data: access, error: accessError } = await client.rpc(
      'authz_can_access_asignatura',
      { p_asignatura_id: body.asignatura_id },
    )
    if (
      permissionError ||
      accessError ||
      permission !== true ||
      access !== true
    ) {
      throw new HttpError(403, 'No autorizado.', 'SUBJECT_ACCESS_DENIED')
    }
    return
  }

  throw new HttpError(400, 'Entidad académica requerida.', 'ENTITY_REQUIRED')
}

Deno.serve(async (req: Request): Promise<Response> => {
  const functionName = logEdgeRequest(req, 'carbone-io-wrapper')

  if (req.method === 'OPTIONS') {
    return preflightResponse()
  }

  try {
    requireMethod(req, 'POST')
    requireJsonContentType(req)
    const CARBONE_API_TOKEN = requireEnv('CARBONE_API_TOKEN')
    const CARBONE_BASE_URL = getEnv(
      'CARBONE_BASE_URL',
      'https://carbone.lci.ulsa.mx',
    )!
    const bodyUnknown = await readJsonBody(req)
    const { action } = ActionSchema.parse(bodyUnknown)
    const { userClient: authClient, serviceClient: supabase } =
      await createAuthenticatedContext(req, {
        missingAuthorizationMessage: 'No autorizado.',
        invalidAuthorizationMessage: 'No autorizado.',
        invalidAuthorizationCode: 'INVALID_JWT',
      })

    const actionBody = bodyUnknown as Record<string, unknown>
    if (
      action === 'listTemplates' ||
      action === 'uploadTemplate' ||
      action === 'deleteTemplate' ||
      action === 'downloadTemplate'
    ) {
      await requirePermission(authClient, 'catalogos.gestionar')
    } else {
      await requireEntityAccess(authClient, actionBody)
    }

    const carbone = new CarboneClient(CARBONE_BASE_URL, CARBONE_API_TOKEN)

    switch (action) {
      case 'downloadReport': {
        const response = await handleDownloadReportAction({
          bodyUnknown,
          supabase,
          carboneBaseUrl: CARBONE_BASE_URL,
          carboneApiToken: CARBONE_API_TOKEN,
        })

        console.log(
          `[${new Date().toISOString()}][${functionName}]: Request processed successfully`,
        )

        return response
      }

      case 'listTemplates': {
        const schema = z.object({ category: z.string().optional() })
        const { category } = schema.parse(bodyUnknown)
        const result = await carbone.listTemplates({ category })
        return json(result)
      }

      case 'uploadTemplate': {
        const schema = z.object({
          template: z.string().min(1),
          filename: z.string().min(1),
          name: z.string().optional(),
          category: z.string().optional(),
          comment: z.string().optional(),
          existingId: z.string().optional(),
        })
        const input = schema.parse(bodyUnknown)
        const bytes = Uint8Array.from(atob(input.template), (c) =>
          c.charCodeAt(0),
        )
        const blob = new Blob([bytes], {
          type: templateContentType(input.filename),
        })
        try {
          const result = await carbone.uploadTemplateFile({
            file: blob,
            filename: input.filename,
            name: input.name ?? input.filename,
            category: input.category,
            comment: input.comment,
            versioning: true,
            id: input.existingId,
            deployedAt: deploymentTimestampMs(),
          })
          return json(result)
        } catch (error) {
          throw new HttpError(
            502,
            'No se pudo subir la plantilla a Carbone.',
            'CARBONE_TEMPLATE_UPLOAD_FAILED',
            { cause: errorMessage(error) },
          )
        }
      }

      case 'deleteTemplate': {
        const schema = z.object({ templateId: z.string().min(1) })
        const { templateId } = schema.parse(bodyUnknown)
        const result = await carbone.deleteTemplate(templateId)
        return json(result)
      }

      case 'previewPayload': {
        const schema = z.union([
          z.object({ plan_estudio_id: z.string().min(1) }),
          z.object({ asignatura_id: z.string().min(1) }),
        ])
        const parsed = schema.parse(bodyUnknown)
        if ('plan_estudio_id' in parsed) {
          const { data, fields } = await prepararPreviewParaPlan(
            supabase,
            parsed.plan_estudio_id,
          )
          return json({ success: true, data, fields })
        }
        const { data, fields } = await prepararPreviewParaAsignatura(
          supabase,
          parsed.asignatura_id,
        )
        return json({ success: true, data, fields })
      }

      case 'downloadTemplate': {
        const schema = z.object({ templateId: z.string().min(1) })
        const { templateId } = schema.parse(bodyUnknown)
        const result = await carbone.downloadTemplate(templateId)
        // JSON+base64 es más fiable que binario directo con el cliente Supabase
        const base64 = Buffer.from(result.buffer).toString('base64')
        const filename =
          result.contentDisposition?.match(/filename="?([^";\n]+)"?/)?.[1] ??
          null
        return json({
          base64,
          contentType:
            result.contentType ??
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          filename,
        })
      }

      default:
        throw new HttpError(400, 'Acción no soportada.', 'UNSUPPORTED_ACTION', {
          action,
        })
    }
  } catch (error) {
    return edgeErrorResponse(error, functionName)
  }
})

/* To invoke locally:

  1. Run `supabase start` (see: https://supabase.com/docs/reference/cli/supabase-start)
  2. Make an HTTP request:

  # Requires secrets:
  # - CARBONE_API_TOKEN
  # Optional:
  # - CARBONE_BASE_URL (defaults to https://carbone.lci.ulsa.mx)

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/carbone-io-wrapper' \
    --header 'Authorization: Bearer <JWT>' \
    --header 'Content-Type: application/json' \
    --data '{"action":"downloadReport","plan_estudio_id":"<uuid>","body":{}}'

  # Or for asignaturas (must include body.data):

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/carbone-io-wrapper' \
    --header 'Authorization: Bearer <JWT>' \
    --header 'Content-Type: application/json' \
    --data '{"action":"downloadReport","asignatura_id":"<uuid>","body":{"data":{}}}'

*/
