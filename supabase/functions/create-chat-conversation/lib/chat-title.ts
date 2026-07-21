import OpenAI from 'npm:openai@6.16.0'

export const DEFAULT_CHAT_TITLE_MODEL = 'gpt-5.6-luna'

export function resolveChatTitleModel(configuredModel?: string | null) {
  return configuredModel?.trim() || DEFAULT_CHAT_TITLE_MODEL
}

const TITLE_MODEL = resolveChatTitleModel(
  Deno.env.get('CREATE_CHAT_CONVERSATION_TITLE_MODELO'),
)

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

  if (isGenericInitialTitle(normalized)) return true

  const promptTitle = buildPromptChatTitle(userMessage ?? '')
  return Boolean(
    promptTitle &&
    normalizeForComparison(normalized) === normalizeForComparison(promptTitle),
  )
}

function isGenericInitialTitle(value: string) {
  return ['Consulta académica', 'Mejora de campos', 'Consulta academica'].some(
    (title) => normalizeForComparison(title) === normalizeForComparison(value),
  )
}

export async function generateInitialChatTitle({
  userMessage,
  fieldKeys = [],
}: {
  userMessage: string
  fieldKeys?: Array<string>
}) {
  // El nombre inicial es deliberadamente determinista. Así la creación del
  // chat no depende de otra llamada de red y podemos reconocerlo con seguridad
  // como provisional cuando llegue la primera respuesta. Un nombre manual del
  // usuario nunca coincide con este valor y, por tanto, no se sobrescribe.
  return fallbackGeneratedChatTitle(userMessage, fieldKeys)
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

export function fallbackGeneratedChatTitle(
  content: string,
  fieldKeys: Array<string>,
) {
  const promptTitle = buildPromptChatTitle(content)
  if (promptTitle) return promptTitle

  if (fieldKeys.length === 1) {
    return humanizeFieldTitle(fieldKeys[0])
  }
  if (fieldKeys.length > 1) {
    return 'Mejora de campos'
  }

  return 'Consulta académica'
}

function humanizeFieldTitle(fieldKey: string) {
  const words = fieldKey.replace(/_/g, ' ').replace(/\s+/g, ' ').trim()
  if (!words) return 'Consulta académica'

  return words.charAt(0).toUpperCase() + words.slice(1)
}

function cleanGeneratedTitle(value: unknown) {
  if (typeof value !== 'string') return null

  const cleaned = value
    .replace(/["'`]/g, '')
    .replace(/[.。]+$/, '')
    .replace(/\s+/g, ' ')
    .trim()

  return cleaned ? cleaned.slice(0, 80) : null
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
  const fallback = fallbackGeneratedChatTitle(userMessage, [])
  const client = getTitleClient()
  if (!client) return fallback

  try {
    const response = await client.responses.create({
      model: TITLE_MODEL,
      max_output_tokens: 64,
      reasoning: { effort: 'none' },
      input: [
        {
          role: 'system',
          content:
            'Escribe un título preciso en español para una conversación académica. Sintetiza tanto la solicitud como la respuesta. Máximo 6 palabras. Devuelve solo el título, sin comillas ni puntuación final.',
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

    return cleanGeneratedTitle(response.output_text) ?? fallback
  } catch (error) {
    console.warn('No se pudo generar el título final del chat:', error)
    return fallback
  }
}
