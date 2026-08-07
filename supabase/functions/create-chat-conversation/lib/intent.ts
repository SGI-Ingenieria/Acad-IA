import type { OpenAIService } from '../../_shared/openai-service.ts'
import type { StructuredResponseOptions } from '../../_shared/openai-service.ts'

export type UserIntentResult =
  | { type: 'consulta'; respuesta: string }
  | { type: 'clarificacion'; pregunta: string; respuesta: string }
  | { type: 'edicion'; respuesta: string; campos: string[] }
  | {
      type: 'accion'
      accion:
        | 'proponer_linea'
        | 'proponer_asignaturas'
        | 'asignar_asignatura'
        | 'eliminar_linea'
      cantidad?: number
      nombre?: string
      asignaturaNombre?: string
      lineaNombre?: string
      respuesta: string
    }

const CANTIDADES: Record<string, number> = {
  una: 1,
  dos: 2,
  tres: 3,
  cuatro: 4,
  cinco: 5,
  seis: 6,
  siete: 7,
  ocho: 8,
  nueve: 9,
  diez: 10,
}

/** Reconoce órdenes de dominio antes de consultar los campos editables. */
export function detectConversationalAction(
  content: string,
): UserIntentResult | null {
  const normalized = content
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim()

  const line = normalized.match(
    /(?:agrega|anade|crea|genera|propon|propone)\s+(?:(?:una|la|nueva)\s+)*(?:linea)(?:\s+curricular)?(?:\s+de|\s+llamada|\s+para|\s+que\s+se\s+llame)?\s+(.+)/i,
  )
  if (line) {
    return {
      type: 'accion',
      accion: 'proponer_linea',
      nombre: line[1].trim(),
      respuesta:
        'Prepararé una línea curricular compatible con el mapa del plan.',
    }
  }

  const deletion = normalized.match(
    /(?:(?:puedes|podrias|me\s+puedes|me\s+podrias)\s+)?(?:borra|borrar|elimina|eliminar|quita|quitar)\s+(?:la\s+)?linea(?:\s+curricular)?(?:\s+llamada|\s+de\s+nombre|\s+nombre)?\s+(.+?)(?:\s+(?:por\s+favor|porfa))?[?.!]*$/i,
  )
  if (deletion) {
    return {
      type: 'accion',
      accion: 'eliminar_linea',
      lineaNombre: deletion[1].trim(),
      respuesta:
        'Prepararé la eliminación de la línea curricular para que la confirmes.',
    }
  }

  const assignment = normalized.match(
    /(?:la\s+)?asignatura\s+se\s+llama\s+(.+?)\s+y\s+la\s+quiero\s+agregar\s+en\s+(?:la\s+)?(?:linea(?:\s+curricular)?|area)\s+(.+)|(?:agrega|anade|asigna|incorpora|mueve)\s+(?:la\s+)?asignatura\s+(.+?)\s+(?:a|en|dentro de)\s+(?:la\s+)?(?:linea(?:\s+curricular)?|area)\s+(.+)/i,
  )
  if (assignment) {
    const asignaturaNombre = assignment[1] ?? assignment[3]
    const lineaNombre = assignment[2] ?? assignment[4]
    return {
      type: 'accion',
      accion: 'asignar_asignatura',
      asignaturaNombre: asignaturaNombre.trim(),
      lineaNombre: lineaNombre.trim(),
      respuesta:
        'Prepararé el movimiento de la asignatura dentro del mapa curricular.',
    }
  }

  const subjects = normalized.match(
    /(?:quiero|genera(?:me)?|propon)\s+(\d{1,2}|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez)\s+(?:asignaturas|materias)/i,
  )
  if (subjects) {
    const cantidad = Math.min(
      CANTIDADES[subjects[1]] ?? Number(subjects[1]),
      15,
    )
    return {
      type: 'accion',
      accion: 'proponer_asignaturas',
      cantidad,
      respuesta: `Prepararé ${cantidad} propuestas de asignatura para el plan.`,
    }
  }

  return null
}

export const EVALUAR_INTENCION_USUARIO_TOOL = {
  type: 'function' as const,
  strict: true,
  name: 'evaluar_intencion_usuario',
  description:
    'Invocar UNICAMENTE cuando el usuario quiera modificar uno o mas campos del plan o asignatura. ' +
    'Si solo esta preguntando, conversando o pidiendo retroalimentacion, responde normalmente con texto y NO invoques esta funcion.',
  parameters: {
    type: 'object',
    properties: {
      respuesta_conversacional: {
        type: 'string',
        description:
          'Mensaje corto y natural que se le mostrara al usuario. Si vas a preparar cambios, indicalo; si necesitas aclaracion, haz la pregunta aqui.',
      },
      quiere_editar: {
        type: 'boolean',
        description:
          'true solo si el usuario pidio explicita o implicitamente modificar campos.',
      },
      campos_a_editar: {
        type: ['array', 'null'],
        items: { type: 'string' },
        description:
          'Lista de claves de los campos que el usuario quiere editar. Solo cuando ya se sepa cuales son; usa null si no aplica.',
      },
      necesita_clarificacion: {
        type: 'boolean',
        description:
          'true si el usuario quiere editar pero no especifico que campo. En ese caso usa pregunta_clarificadora.',
      },
      pregunta_clarificadora: {
        type: ['string', 'null'],
        description:
          'Pregunta amable para aclarar sobre que campo desea trabajar; usa null si no aplica.',
      },
    },
    // OpenAI strict function calling exige que `required` incluya TODAS las
    // claves de `properties`; los campos opcionales se modelan como nullable.
    required: [
      'respuesta_conversacional',
      'quiere_editar',
      'campos_a_editar',
      'necesita_clarificacion',
      'pregunta_clarificadora',
    ],
    additionalProperties: false,
  },
}

type OpenAIRawOutputItem = {
  type: string
  name?: string
  arguments?: string
}

function extractFunctionCallArguments(
  openaiRaw: unknown,
): Record<string, unknown> | null {
  const raw = openaiRaw as Record<string, unknown> | undefined
  const output = raw?.output
  if (!Array.isArray(output)) return null

  const call = output.find((item: OpenAIRawOutputItem) => {
    return (
      item?.type === 'function_call' &&
      item?.name === EVALUAR_INTENCION_USUARIO_TOOL.name
    )
  }) as OpenAIRawOutputItem | undefined

  if (!call?.arguments) return null

  try {
    return JSON.parse(call.arguments) as Record<string, unknown>
  } catch {
    return null
  }
}

function extractOutputText(openaiRaw: unknown): string {
  const raw = openaiRaw as Record<string, unknown> | undefined
  if (typeof raw?.output_text === 'string') return raw.output_text
  const output = raw?.output
  if (!Array.isArray(output)) return ''
  return output
    .filter((item: any) => item?.type === 'message')
    .flatMap((item: any) => (Array.isArray(item?.content) ? item.content : []))
    .filter((part: any) => part?.type === 'output_text')
    .map((part: any) => String(part?.text ?? ''))
    .join('')
}

export function buildIntentSystemPrompt(args: {
  entityType: 'plan' | 'asignatura'
  entityJson: Record<string, unknown>
  editableFields: Array<{ key: string; label: string }>
  explicitlySelectedFields: string[]
}): string {
  const { entityType, entityJson, editableFields, explicitlySelectedFields } =
    args

  const fieldList = editableFields
    .map((f) => `- ${f.key} (${f.label})`)
    .join('\n')

  let prompt = `Eres un asistente experto en diseño curricular. El usuario esta conversando sobre ${entityType === 'plan' ? 'un plan de estudios' : 'una asignatura'}.

DATOS ACTUALES (pulidos para el prompt):
${JSON.stringify(entityJson, null, 2)}

CAMPOS EDITABLES DISPONIBLES:\n${fieldList}

REGLAS DE ORO:
1. Si el usuario solo pregunta, pide opinion o retroalimentacion, responde con texto normal y NO invoques la funcion.
2. Si el usuario quiere editar y ya dijo que campo(s), invoca la funcion con quiere_editar: true, campos_a_editar con las claves exactas, y una respuesta_conversacional amable.
3. Si el usuario quiere editar pero no especifico el campo, invoca la funcion con quiere_editar: true, necesita_clarificacion: true y una pregunta_clarificadora.
4. NUNCA propongas cambios para campos que no esten en la lista de editables.
5. Solo incluye en campos_a_editar campos que el usuario mencione explicita o implicitamente.`

  if (explicitlySelectedFields.length > 0) {
    prompt += `\n\nATENCION: El usuario ya selecciono explicitamente estos campos con el comando /: ${explicitlySelectedFields.join(', ')}. Considera que su intencion es editarlos, salvo que su mensaje sea claramente una consulta sobre ellos.`
  }

  return prompt
}

export async function detectUserIntent(args: {
  svc: OpenAIService
  model: string
  userContent: string
  systemPrompt: string
  /**
   * Se acepta por compatibilidad con las personas que llaman, pero se ignora
   * a propósito: la clasificación NO debe adjuntarse a la conversación
   * persistida (ver comentario en el cuerpo).
   */
  conversation?: string
}): Promise<UserIntentResult> {
  const { svc, model, userContent, systemPrompt } = args

  const conversationalAction = detectConversationalAction(userContent)
  if (conversationalAction) return conversationalAction

  // La detección de intención usa el tool de función `evaluar_intencion_usuario`
  // del que SOLO leemos los argumentos; nunca devolvemos su
  // `function_call_output`. Si esta llamada se adjuntara a la conversación
  // persistida (parámetro `conversation`), OpenAI guardaría un `function_call`
  // huérfano dentro de la conversación y el siguiente turno —incluida la
  // respuesta estructurada en background del mismo turno— fallaría con
  // `400 No tool output found for function call call_…`.
  //
  // Por eso la clasificación es SIN estado: sin `conversation` y con
  // `store: false`. La memoria conversacional real la conserva la respuesta
  // principal (consulta/estructurada), que sí usa `conversation`. (El
  // parámetro `conversation` y `store: false` son mutuamente excluyentes en la
  // API de Responses, así que deben ir juntos de esta forma.)
  const request: StructuredResponseOptions = {
    model,
    store: false,
    tools: [EVALUAR_INTENCION_USUARIO_TOOL],
    tool_choice: 'auto',
    input: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userContent },
    ],
  }

  const result = await svc.createStructuredResponse<unknown>(request)
  if (!result.ok) {
    // Si falla la clasificacion, tratamos la solicitud como consulta para no
    // bloquear al usuario; el error queda en logs.
    console.error('Intent detection failed:', result)
    return { type: 'consulta', respuesta: userContent }
  }

  const toolArgs = extractFunctionCallArguments(result.openaiRaw)
  if (toolArgs) {
    const respuesta = String(toolArgs.respuesta_conversacional ?? '')
    const quiereEditar = toolArgs.quiere_editar === true
    const necesitaClarificacion = toolArgs.necesita_clarificacion === true
    const campos = Array.isArray(toolArgs.campos_a_editar)
      ? toolArgs.campos_a_editar.map(String)
      : []

    if (quiereEditar && necesitaClarificacion) {
      return {
        type: 'clarificacion',
        pregunta: String(
          toolArgs.pregunta_clarificadora ??
            '¿Sobre que campo quieres trabajar?',
        ),
        respuesta,
      }
    }

    if (quiereEditar && campos.length > 0) {
      return { type: 'edicion', respuesta, campos }
    }

    // Tool llamado pero sin campos ni clarificacion: cae a consulta.
    return {
      type: 'consulta',
      respuesta: respuesta || extractOutputText(result.openaiRaw),
    }
  }

  return {
    type: 'consulta',
    respuesta: extractOutputText(result.openaiRaw),
  }
}
