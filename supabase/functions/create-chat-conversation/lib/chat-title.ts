import OpenAI from 'npm:openai@6.16.0'

const TITLE_MODEL =
  Deno.env.get('CREATE_CHAT_CONVERSATION_TITLE_MODELO') ?? 'gpt-5-nano'

let titleClient: OpenAI | null = null

function getTitleClient() {
  const apiKey = Deno.env.get('OPENAI_API_KEY')
  if (!apiKey) return null

  if (!titleClient) {
    titleClient = new OpenAI({ apiKey })
  }

  return titleClient
}

export function shouldReplaceGeneratedChatName(
  name: string | null | undefined,
  userMessage?: string | null,
) {
  const normalized = String(name ?? '').trim()
  if (!normalized || /^Chat\s+\d{4}-\d{2}-\d{2}/.test(normalized)) {
    return true
  }

  const promptTitle = buildPromptChatTitle(userMessage ?? '')
  return Boolean(
    promptTitle &&
    normalizeForComparison(normalized) === normalizeForComparison(promptTitle),
  )
}

export function buildPromptChatTitle(content: string) {
  const source = content.replace(/\s+/g, ' ').trim()
  if (!source) return null

  const cleaned = source
    .replace(/^[/"'`*_#>\s-]+/, '')
    .replace(
      /^(por favor\s+)?(ay[uú]dame a|puedes|podr[ií]as|quiero|necesito|mejora|mejorar|redacta|genera|crea|analiza|revisa|califica)\s+/i,
      '',
    )
    .split(/[.?!]/)[0]
    .replace(/\s+/g, ' ')
    .trim()

  const title = cleaned || source
  const withoutTrailingPunctuation = title.replace(/[:;,.\s]+$/, '').trim()
  const bounded =
    withoutTrailingPunctuation.length <= 72
      ? withoutTrailingPunctuation
      : withoutTrailingPunctuation
          .slice(0, 72)
          .replace(/\s+\S*$/, '')
          .trim()

  return bounded || null
}

function normalizeForComparison(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

export async function generateChatTitle({
  userMessage,
  assistantMessage,
}: {
  userMessage: string
  assistantMessage: string
}) {
  const client = getTitleClient()
  if (!client) return null

  const response = await client.responses.create({
    model: TITLE_MODEL,
    max_output_tokens: 24,
    input: [
      {
        role: 'system',
        content:
          'Escribe un titulo breve en espanol para una conversacion academica. Maximo 6 palabras. Devuelve solo el titulo, sin comillas ni puntuacion final.',
      },
      {
        role: 'user',
        content: [
          'Solicitud del usuario:',
          userMessage.slice(0, 900),
          '',
          'Respuesta del asistente:',
          assistantMessage.slice(0, 900),
        ].join('\n'),
      },
    ],
  })

  const rawTitle =
    typeof response.output_text === 'string' ? response.output_text : ''

  const cleaned = rawTitle.replace(/["'`]/g, '').replace(/\s+/g, ' ').trim()

  return cleaned ? cleaned.slice(0, 80) : null
}
