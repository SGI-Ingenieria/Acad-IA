import '@supabase/functions-js/edge-runtime.d.ts'
import { z } from 'zod'
import { preflightResponse } from '../_shared/cors.ts'
import {
  logEdgeRequest,
  readJsonBody,
  requireJsonContentType,
  requireMethod,
} from '../_shared/request.ts'
import { edgeErrorResponse, HttpError, sendSuccess } from '../_shared/utils.ts'
import { validateInput } from '../_shared/validation.ts'

console.log('Starting buscar-bibliografia function')

type GoogleBooksVolume = Record<string, unknown>
type OpenLibraryDoc = Record<string, unknown>

type EndpointResult =
  | { endpoint: 'google'; item: GoogleBooksVolume }
  | { endpoint: 'open_library'; item: OpenLibraryDoc }

interface GoogleBooksVolumesListResponse {
  kind?: string
  totalItems?: number
  items?: GoogleBooksVolume[]
}

interface OpenLibrarySearchResponse {
  num_found?: number
  start?: number
  docs?: OpenLibraryDoc[]
}

const ISO6391 = z.string().regex(/^[a-z]{2}$/i, 'Debe ser ISO 639-1 (2 letras)')
const ISO6392 = z.string().regex(/^[a-z]{3}$/i, 'Debe ser ISO 639-2 (3 letras)')

const SearchTermsSchema = z
  .object({
    q: z.string().min(1, 'q es requerido'),
  })
  .strict()

const GoogleParamsSchema = z
  .object({
    orderBy: z.enum(['newest', 'relevance']).optional(),
    langRestrict: ISO6391.optional(),
    startIndex: z.number().int().min(0).optional(),
  })
  .passthrough()
  .optional()
  .default({})

const OpenLibraryParamsSchema = z
  .object({
    language: ISO6392.optional(),
    page: z.number().int().min(1).optional(),
    sort: z.string().optional(),
  })
  .passthrough()
  .optional()
  .default({})

const BodySchema = z
  .object({
    searchTerms: SearchTermsSchema,

    // Parámetros por endpoint
    google: GoogleParamsSchema,
    openLibrary: OpenLibraryParamsSchema,
  })
  .strict()

type BuscarBibliografiaRequest = z.infer<typeof BodySchema>

function buildUrlWithSearchTerms(
  baseUrl: string,
  searchTerms: Record<string, unknown>,
): string {
  const url = new URL(baseUrl)
  for (const [key, value] of Object.entries(searchTerms)) {
    if (value === undefined || value === null) continue
    if (Array.isArray(value)) {
      for (const v of value) {
        if (v === undefined || v === null) continue
        url.searchParams.append(key, String(v))
      }
      continue
    }
    url.searchParams.set(key, String(value))
  }
  return url.toString()
}

function pickSerializableParams(
  input: Record<string, unknown>,
): Record<
  string,
  string | number | boolean | Array<string | number | boolean>
> {
  const out: Record<
    string,
    string | number | boolean | Array<string | number | boolean>
  > = {}

  for (const [key, value] of Object.entries(input)) {
    if (value === undefined || value === null) continue

    if (Array.isArray(value)) {
      const arr = value
        .filter((v) => v !== undefined && v !== null)
        .filter((v) =>
          ['string', 'number', 'boolean'].includes(typeof v),
        ) as Array<string | number | boolean>
      if (arr.length) out[key] = arr
      continue
    }

    if (['string', 'number', 'boolean'].includes(typeof value)) {
      out[key] = value as string | number | boolean
    }
  }

  return out
}

Deno.serve(async (req: Request): Promise<Response> => {
  const functionName = logEdgeRequest(req, 'buscar-bibliografia')

  if (req.method === 'OPTIONS') {
    return preflightResponse()
  }

  try {
    requireMethod(req, 'POST')
    requireJsonContentType(req)
    const rawBody = await readJsonBody(req)

    const parsed = validateInput(BodySchema, rawBody)

    const body: BuscarBibliografiaRequest = parsed.data

    const GOOGLE_API_KEY = Deno.env.get('GOOGLE_API_KEY')
    if (!GOOGLE_API_KEY) {
      throw new HttpError(
        500,
        'Configuración del servidor incompleta.',
        'MISSING_ENV',
        { missing: ['GOOGLE_API_KEY'] },
      )
    }

    const baseUrl = 'https://www.googleapis.com/books/v1/volumes'
    const googleParams = pickSerializableParams({
      ...body.google,
      ...body.searchTerms,
      key: GOOGLE_API_KEY,
      maxResults: 20,
      startIndex: (body.google as Record<string, unknown>)?.startIndex ?? 0,
    })
    // No mandar parámetros exclusivos de Open Library a Google
    delete (googleParams as Record<string, unknown>)['page']
    delete (googleParams as Record<string, unknown>)['language']

    const googleUrl = buildUrlWithSearchTerms(baseUrl, googleParams)

    const openLibraryBaseUrl = 'https://openlibrary.org/search.json'
    const openLibraryParams = pickSerializableParams({
      ...body.openLibrary,
      q: body.searchTerms.q,
      limit: 20,
      page: (body.openLibrary as Record<string, unknown>)?.page ?? 1,
    })
    // No mandar parámetros exclusivos de Google a Open Library
    delete (openLibraryParams as Record<string, unknown>)['langRestrict']
    delete (openLibraryParams as Record<string, unknown>)['orderBy']
    delete (openLibraryParams as Record<string, unknown>)['startIndex']

    const openLibraryUrl = buildUrlWithSearchTerms(
      openLibraryBaseUrl,
      openLibraryParams,
    )

    const [googleResp, openLibraryResp] = await Promise.all([
      fetch(googleUrl, { headers: { Accept: 'application/json' } }),
      fetch(openLibraryUrl, {
        headers: {
          Accept: 'application/json',
          'User-Agent': 'Acad-IA info.ingenieria.lci@gmail.com',
        },
      }),
    ])

    if (!googleResp.ok) {
      const text = await googleResp.text().catch(() => '')
      throw new HttpError(
        502,
        'Error al consultar Google Books.',
        'GOOGLE_BOOKS_REQUEST_FAILED',
        {
          status: googleResp.status,
          statusText: googleResp.statusText,
          body: text || null,
        },
      )
    }

    if (!openLibraryResp.ok) {
      const text = await openLibraryResp.text().catch(() => '')
      throw new HttpError(
        502,
        'Error al consultar Open Library.',
        'OPEN_LIBRARY_REQUEST_FAILED',
        {
          status: openLibraryResp.status,
          statusText: openLibraryResp.statusText,
          body: text || null,
        },
      )
    }

    const googleData =
      (await googleResp.json()) as GoogleBooksVolumesListResponse
    const openLibraryData =
      (await openLibraryResp.json()) as OpenLibrarySearchResponse

    const googleItems = Array.isArray(googleData?.items)
      ? googleData.items.slice(0, 20)
      : []
    const openLibraryDocs = Array.isArray(openLibraryData?.docs)
      ? openLibraryData.docs.slice(0, 20)
      : []

    const results: EndpointResult[] = [
      ...googleItems.map((item) => ({ endpoint: 'google', item }) as const),
      ...openLibraryDocs.map(
        (item) => ({ endpoint: 'open_library', item }) as const,
      ),
    ]

    return sendSuccess(results)
  } catch (error) {
    return edgeErrorResponse(error, functionName)
  }
})

/* To invoke locally:

  1. Run `supabase start` (see: https://supabase.com/docs/reference/cli/supabase-start)
  2. Make an HTTP request:

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/buscar-bibliografia' \
    --header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0' \
    --header 'Content-Type: application/json' \
    --data '{"name":"Functions"}'

*/
