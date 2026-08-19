import { asRecord } from './value.ts'
import { HttpError } from './utils.ts'

export function extractOpenAIResponseText(response: unknown): string {
  const item = asRecord(response)
  if (typeof item?.output_text === 'string') return item.output_text
  if (!Array.isArray(item?.output)) return ''

  return item.output
    .filter((outputItem) => asRecord(outputItem)?.type === 'message')
    .flatMap((outputItem) => {
      const content = asRecord(outputItem)?.content
      return Array.isArray(content) ? content : []
    })
    .filter((contentItem) => asRecord(contentItem)?.type === 'output_text')
    .map((contentItem) => String(asRecord(contentItem)?.text ?? ''))
    .join('')
}

export function sanitizeJsonControlChars(raw: string): string {
  let inString = false
  let escaped = false
  let result = ''

  for (const char of raw) {
    if (escaped) {
      result += char
      escaped = false
      continue
    }
    if (char === '\\') {
      escaped = true
      result += char
      continue
    }
    if (char === '"') {
      inString = !inString
      result += char
      continue
    }
    if (!inString || char.charCodeAt(0) >= 0x20) {
      result += char
      continue
    }

    switch (char) {
      case '\n':
        result += '\\n'
        break
      case '\r':
        result += '\\r'
        break
      case '\t':
        result += '\\t'
        break
      default:
        result += `\\u${char.charCodeAt(0).toString(16).padStart(4, '0')}`
    }
  }

  return result
}

export function parseOpenAIJsonText(raw: string): unknown {
  try {
    return JSON.parse(raw)
  } catch {
    return JSON.parse(sanitizeJsonControlChars(raw))
  }
}

export function resolveStructuredResponseOutput<Output>(
  result: { output?: Output; outputText?: string },
  invalidMessage = 'La respuesta de la IA no es JSON válido.',
): Output | null {
  if (result.output !== undefined && result.output !== null) {
    return result.output
  }
  if (!result.outputText) return null
  try {
    return parseOpenAIJsonText(result.outputText) as Output
  } catch (error) {
    throw new HttpError(502, invalidMessage, 'OPENAI_INVALID_JSON', {
      outputText: result.outputText,
      cause: error,
    })
  }
}
