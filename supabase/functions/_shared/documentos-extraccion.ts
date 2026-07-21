import {
  MAX_EXTRACTED_CHARACTERS,
  MAX_EXTRACTION_PAGES_PER_JOB,
  serviceClient,
} from './documentos-academicos.ts'
import { HttpError } from './utils.ts'

type OpenAIResponseLike = {
  id: string
  status?: unknown
  output_text?: unknown
  output?: unknown
  error?: unknown
  incomplete_details?: unknown
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function outputText(response: OpenAIResponseLike): string {
  if (typeof response.output_text === 'string') return response.output_text
  if (!Array.isArray(response.output)) return ''
  return response.output
    .filter((item) => record(item)?.type === 'message')
    .flatMap((item) =>
      Array.isArray(record(item)?.content)
        ? (record(item)?.content as Array<unknown>)
        : [],
    )
    .filter((item) => record(item)?.type === 'output_text')
    .map((item) => String(record(item)?.text ?? ''))
    .join('')
}

function sanitizeControls(raw: string) {
  let quoted = false
  let escaped = false
  let result = ''
  for (const character of raw) {
    if (escaped) {
      result += character
      escaped = false
      continue
    }
    if (character === '\\') {
      result += character
      escaped = true
      continue
    }
    if (character === '"') {
      result += character
      quoted = !quoted
      continue
    }
    if (quoted && character.charCodeAt(0) < 0x20)
      result += JSON.stringify(character).slice(1, -1)
    else result += character
  }
  return result
}

export type ExtractedDocument = {
  pages: Array<{
    page: number
    text: string
    headings: Array<string>
    tables: Array<{ title?: string; rows: Array<Array<string>> }>
  }>
  language: string
  qualityFlags: Array<string>
}

export function parseExtractedDocument(
  response: OpenAIResponseLike,
): ExtractedDocument {
  const raw = outputText(response)
  if (!raw)
    throw new HttpError(
      502,
      'OpenAI no devolvió contenido de extracción.',
      'EXTRACTION_EMPTY',
    )
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    parsed = JSON.parse(sanitizeControls(raw))
  }
  const root = record(parsed)
  if (
    !root ||
    !Array.isArray(root.pages) ||
    typeof root.language !== 'string'
  ) {
    throw new HttpError(
      502,
      'La extracción no cumple el esquema esperado.',
      'EXTRACTION_INVALID_SCHEMA',
    )
  }
  if (
    root.pages.length < 1 ||
    root.pages.length > MAX_EXTRACTION_PAGES_PER_JOB
  ) {
    throw new HttpError(
      502,
      'La extracción excede el máximo de páginas por trabajo.',
      'EXTRACTION_PAGE_LIMIT',
    )
  }
  let characters = 0
  const pages = root.pages.map((value, index) => {
    const page = record(value)
    if (
      !page ||
      !Number.isInteger(page.page) ||
      typeof page.text !== 'string'
    ) {
      throw new HttpError(
        502,
        `La página ${index + 1} no es válida.`,
        'EXTRACTION_INVALID_SCHEMA',
      )
    }
    characters += page.text.length
    const headings = Array.isArray(page.headings)
      ? page.headings.filter(
          (heading): heading is string => typeof heading === 'string',
        )
      : []
    const tables = Array.isArray(page.tables)
      ? page.tables.flatMap((table) => {
          const candidate = record(table)
          if (!candidate || !Array.isArray(candidate.rows)) return []
          const rows = candidate.rows.map((row) =>
            Array.isArray(row) ? row.map((cell) => String(cell)) : [],
          )
          return [
            {
              title:
                typeof candidate.title === 'string'
                  ? candidate.title
                  : undefined,
              rows,
            },
          ]
        })
      : []
    return { page: page.page as number, text: page.text, headings, tables }
  })
  if (characters > MAX_EXTRACTED_CHARACTERS) {
    throw new HttpError(
      502,
      'La extracción excede el límite de caracteres.',
      'EXTRACTION_TOO_LARGE',
    )
  }
  return {
    pages,
    language: root.language,
    qualityFlags: Array.isArray(root.qualityFlags)
      ? root.qualityFlags.filter(
          (flag): flag is string => typeof flag === 'string',
        )
      : [],
  }
}

export async function finalizeOpenAIExtraction(args: {
  supabase: ReturnType<typeof serviceClient>
  response: OpenAIResponseLike
}) {
  const status = String(args.response.status ?? '')
  if (status === 'queued' || status === 'in_progress')
    return { applied: false, reason: 'active' as const }
  let finalStatus = 'failed'
  let content: ExtractedDocument | null = null
  let details: Record<string, unknown> = record(args.response.error) ??
    record(args.response.incomplete_details) ?? {
      provider_status: status || 'unknown',
    }
  if (status === 'completed') {
    try {
      content = parseExtractedDocument(args.response)
      finalStatus = 'completed'
      details = {}
    } catch (error) {
      details = {
        code:
          error instanceof HttpError ? error.code : 'EXTRACTION_INVALID_OUTPUT',
        message: error instanceof Error ? error.message : String(error),
      }
    }
  }
  const { data, error } = await args.supabase.rpc(
    'finalizar_extraccion_openai_documental',
    {
      p_response_id: args.response.id,
      p_estado: finalStatus,
      p_contenido: content,
      p_error: details,
    },
  )
  if (error)
    throw new HttpError(
      500,
      'No se pudo finalizar la extracción de OpenAI.',
      'EXTRACTION_SAVE_FAILED',
    )
  const result = Array.isArray(data) ? data[0] : data
  if (!result) return { applied: false, reason: 'unknown_response' as const }
  if (!result.applied)
    return { applied: false, reason: 'already_applied' as const }
  return { applied: true, reason: finalStatus as 'completed' | 'failed' }
}
