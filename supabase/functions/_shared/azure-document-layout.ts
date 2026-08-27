import { requireEnv } from './env.ts'
import { HttpError } from './utils.ts'

const API_VERSION = '2024-11-30'
const MODEL_ID = 'prebuilt-layout'
const DEFAULT_TIMEOUT_MS = 90_000
const POLL_INTERVAL_MS = 1_000

type AzureAnalyzeResult = {
  content?: string
  pages?: Array<{
    pageNumber?: number
    lines?: Array<{ content?: string }>
    words?: Array<{ content?: string }>
  }>
  tables?: Array<{
    rowCount?: number
    columnCount?: number
    cells?: Array<{
      rowIndex?: number
      columnIndex?: number
      content?: string
    }>
  }>
  keyValuePairs?: Array<unknown>
}

type AzureOperationResponse = {
  status?: string
  analyzeResult?: AzureAnalyzeResult
  error?: { code?: string; message?: string }
}

function endpointUrl(path: string) {
  return `${requireEnv('AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT').replace(
    /\/$/,
    '',
  )}${path}`
}

function timeoutMs() {
  const configured = Number(Deno.env.get('AZURE_DOCUMENT_LAYOUT_TIMEOUT_MS'))
  return Number.isFinite(configured) && configured > 0
    ? configured
    : DEFAULT_TIMEOUT_MS
}

async function azureFetch(input: RequestInfo | URL, init: RequestInit) {
  const response = await fetch(input, {
    ...init,
    headers: {
      ...(init.headers ?? {}),
      'Ocp-Apim-Subscription-Key': requireEnv(
        'AZURE_DOCUMENT_INTELLIGENCE_KEY',
      ),
    },
  })
  return response
}

function parseOperationLocation(response: Response) {
  const location = response.headers.get('Operation-Location')
  if (!location) {
    throw new HttpError(
      502,
      'Azure no devolvió la operación de análisis documental.',
      'AZURE_LAYOUT_INVALID_RESPONSE',
    )
  }
  return location
}

function resultText(result: AzureAnalyzeResult) {
  const content = result.content?.trim()
  const tables = (result.tables ?? [])
    .map((table, tableIndex) => {
      const rowCount = Math.max(0, table.rowCount ?? 0)
      const columnCount = Math.max(0, table.columnCount ?? 0)
      if (!rowCount || !columnCount || !table.cells?.length) return ''

      const cells = table.cells.map((cell) => ({
        row: Math.max(0, cell.rowIndex ?? 0),
        column: Math.max(0, cell.columnIndex ?? 0),
        content: cell.content?.trim() ?? '',
      }))
      const rows = Array.from({ length: rowCount }, (_, row) =>
        Array.from(
          { length: columnCount },
          (_, column) =>
            cells.find((cell) => cell.row === row && cell.column === column)
              ?.content ?? '',
        ),
      )
      const markdown = rows.map((row) => `| ${row.join(' | ')} |`)
      const separator = `| ${Array.from({ length: columnCount }, () => '---').join(' | ')} |`
      return `\n\n[TABLA ${tableIndex + 1}]\n${markdown[0]}\n${separator}\n${markdown.slice(1).join('\n')}\n[/TABLA ${tableIndex + 1}]`
    })
    .filter(Boolean)
    .join('')

  if (content || tables) return `${content ?? ''}${tables}`.trim()

  return (result.pages ?? [])
    .flatMap((page) =>
      (page.lines ?? []).map((line) => line.content?.trim()).filter(Boolean),
    )
    .join('\n')
    .trim()
}

export type AzureDocumentLayout = {
  content: string
  pages: number
  tables: number
  keyValuePairs: number
}

export async function extractDocumentLayout(args: {
  bytes: Uint8Array
  mimeType: string
  filename: string
}): Promise<AzureDocumentLayout> {
  const analyzeUrl = new URL(
    endpointUrl(`/documentintelligence/documentModels/${MODEL_ID}:analyze`),
  )
  analyzeUrl.searchParams.set('api-version', API_VERSION)
  // Azure Layout no admite keyValuePairs para archivos Office (DOCX/XLSX).
  // En esos formatos las tablas y el contenido Markdown son la evidencia útil.
  const isOfficeDocument = /\.(docx?|xlsx?|pptx?|html?)$/i.test(args.filename)
  if (!isOfficeDocument) {
    analyzeUrl.searchParams.set('features', 'keyValuePairs')
  }
  analyzeUrl.searchParams.set('outputContentFormat', 'markdown')

  const response = await azureFetch(analyzeUrl, {
    method: 'POST',
    headers: { 'Content-Type': args.mimeType },
    body: args.bytes.slice().buffer,
  })
  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    console.error('Azure Document Intelligence request failed', {
      filename: args.filename,
      status: response.status,
      detail: detail.slice(0, 500),
    })
    throw new HttpError(
      502,
      `Azure no pudo analizar ${args.filename}.`,
      'AZURE_LAYOUT_REQUEST_FAILED',
      { status: response.status, detail: detail.slice(0, 500) },
    )
  }

  const operationLocation = parseOperationLocation(response)
  const deadline = Date.now() + timeoutMs()
  while (Date.now() < deadline) {
    const operationResponse = await azureFetch(operationLocation, {
      method: 'GET',
    })
    const operation = (await operationResponse
      .json()
      .catch(() => null)) as AzureOperationResponse | null

    if (!operationResponse.ok || !operation) {
      throw new HttpError(
        502,
        `Azure no devolvió el resultado de ${args.filename}.`,
        'AZURE_LAYOUT_INVALID_RESPONSE',
        { status: operationResponse.status },
      )
    }
    const status = String(operation.status ?? '').toLowerCase()
    if (status === 'succeeded') {
      const result = operation.analyzeResult
      const content = result ? resultText(result) : ''
      if (!content) {
        throw new HttpError(
          422,
          `Azure no encontró texto en ${args.filename}.`,
          'AZURE_LAYOUT_EMPTY_RESULT',
        )
      }
      return {
        content,
        pages: result?.pages?.length ?? 0,
        tables: result?.tables?.length ?? 0,
        keyValuePairs: result?.keyValuePairs?.length ?? 0,
      }
    }
    if (status === 'failed') {
      throw new HttpError(
        502,
        `Azure falló al analizar ${args.filename}.`,
        'AZURE_LAYOUT_REQUEST_FAILED',
        operation.error,
      )
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS))
  }

  throw new HttpError(
    504,
    `Azure tardó demasiado en analizar ${args.filename}.`,
    'AZURE_LAYOUT_TIMEOUT',
  )
}

export function azureDocumentLayoutEnabled() {
  return Deno.env.get('AZURE_DOCUMENT_LAYOUT_ENABLED') === 'true'
}
