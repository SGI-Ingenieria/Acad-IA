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
  const fallback = fallbackGeneratedChatTitle(userMessage, fieldKeys)
  const client = getTitleClient()
  if (!client) return fallback

  try {
    const response = await client.responses.create({
      model: TITLE_MODEL,
      max_output_tokens: 18,
      input: [
        {
          role: 'system',
          content:
            'Propón un nombre breve en español para un chat académico. No copies la solicitud del usuario; sintetiza el tema. Máximo 5 palabras. Devuelve solo el nombre.',
        },
        {
          role: 'user',
          content: [
            'Solicitud:',
            userMessage.slice(0, 900),
            '',
            fieldKeys.length > 0
              ? `Campos seleccionados: ${fieldKeys.join(', ')}`
              : 'Sin campos seleccionados.',
          ].join('\n'),
        },
      ],
    })

    return cleanGeneratedTitle(response.output_text) ?? fallback
  } catch (error) {
    console.warn('No se pudo generar titulo inicial del chat:', error)
    return fallback
  }
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

function fallbackGeneratedChatTitle(content: string, fieldKeys: Array<string>) {
  const source = normalizeForComparison(`${content} ${fieldKeys.join(' ')}`)

  if (source.match(/\b(perfil|egreso|competencias?)\b/)) {
    return 'Perfil académico'
  }
  if (source.match(/\b(evaluacion|rubrica|criterios?|califica)\b/)) {
    return 'Evaluación académica'
  }
  if (source.match(/\b(bibliografia|referencias?|fuentes?)\b/)) {
    return 'Bibliografía'
  }
  if (source.match(/\b(mapa|curricular|seriacion|linea)\b/)) {
    return 'Mapa curricular'
  }
  if (source.match(/\b(objetivo|proposito|aprendizaje)\b/)) {
    return 'Objetivos de aprendizaje'
  }
  if (source.match(/\b(justificacion|pertinencia|fundamentacion)\b/)) {
    return 'Pertinencia del plan'
  }
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
