// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import '@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { corsHeaders } from '../_shared/cors.ts'
import type { Database } from '../_shared/database.types.ts'
import { HttpError, sendError } from '../_shared/utils.ts'
import { handleDownloadReportAction } from './download-report.ts'

const ActionSchema = z.object({
  action: z.string().min(1),
  format: z.enum(['pdf', 'xlsx']).default('pdf'),
})
// getAuthHeader
function getAuthHeader(req: Request): string | null {
  return req.headers.get('Authorization') ?? req.headers.get('authorization')
}

Deno.serve(async (req: Request): Promise<Response> => {
  const url = new URL(req.url)
  const functionName = url.pathname.split('/').pop()
  console.log(
    `[${new Date().toISOString()}][${functionName}]: Request received`,
  )

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders })
  }

  try {
    if (req.method !== 'POST') {
      throw new HttpError(405, 'Método no permitido.', 'METHOD_NOT_ALLOWED', {
        method: req.method,
      })
    }

    const authHeader = getAuthHeader(req)
    if (!authHeader) {
      throw new HttpError(401, 'No autorizado.', 'UNAUTHORIZED', {
        reason: 'missing_authorization_header',
      })
    }

    const contentType = (req.headers.get('content-type') || '').toLowerCase()
    if (!contentType.startsWith('application/json')) {
      throw new HttpError(
        415,
        'Content-Type no soportado.',
        'UNSUPPORTED_MEDIA_TYPE',
        { contentType },
      )
    }

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
    const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
      throw new HttpError(
        500,
        'Configuración del servidor incompleta.',
        'MISSING_ENV',
        {
          missing: [
            !SUPABASE_URL ? 'SUPABASE_URL' : null,
            !SERVICE_ROLE_KEY ? 'SUPABASE_SERVICE_ROLE_KEY' : null,
          ].filter(Boolean),
        },
      )
    }

    const CARBONE_API_TOKEN = Deno.env.get('CARBONE_API_TOKEN')
    const CARBONE_BASE_URL =
      Deno.env.get('CARBONE_BASE_URL') || 'https://carbone.lci.ulsa.mx'
    if (!CARBONE_API_TOKEN) {
      throw new HttpError(
        500,
        'Configuración del servidor incompleta.',
        'MISSING_ENV',
        {
          missing: [!CARBONE_API_TOKEN ? 'CARBONE_API_TOKEN' : null].filter(
            Boolean,
          ),
        },
      )
    }

    const bodyUnknown: unknown = await req.json()
    const { action } = ActionSchema.parse(bodyUnknown)

    const supabase = createClient<Database>(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    })

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
      default:
        throw new HttpError(400, 'Acción no soportada.', 'UNSUPPORTED_ACTION', {
          action,
        })
    }
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
      'Ocurrió un error inesperado en el servidor.',
      'INTERNAL_SERVER_ERROR',
    )
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
