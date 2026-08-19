import { getServiceRoleClient } from './supabase.ts'
import {
  generateChatTitle,
  shouldReplaceGeneratedChatName,
} from './chat-title.ts'

export type ChatConversationKind = 'plan' | 'asignatura'

export async function maybeUpdateConversationTitle(args: {
  messageId: string
  assistantMessage: string
  messageTable: 'plan_mensajes_ia' | 'asignatura_mensajes_ia'
  conversationTable: 'conversaciones_plan' | 'conversaciones_asignatura'
  conversationColumn: 'conversacion_plan_id' | 'conversacion_asignatura_id'
  warningContext: string
}): Promise<void> {
  if (!args.assistantMessage) return

  const supabase = getServiceRoleClient()
  try {
    const { data: messageRow, error: messageError } = await supabase
      .from(args.messageTable)
      .select(`id,${args.conversationColumn}`)
      .eq('id', args.messageId)
      .single()
    const messageRecord = messageRow as unknown as Record<
      string,
      unknown
    > | null
    const conversationId = messageRecord?.[args.conversationColumn]
    if (messageError || !conversationId) return

    const { data: firstMessage, error: firstMessageError } = await supabase
      .from(args.messageTable)
      .select('id,mensaje')
      .eq(args.conversationColumn, conversationId)
      .order('fecha_creacion', { ascending: true })
      .order('id', { ascending: true })
      .limit(1)
      .maybeSingle()
    if (
      firstMessageError ||
      !firstMessage ||
      String(firstMessage.id) !== String(messageRecord?.id)
    ) {
      return
    }

    const userMessage = String(firstMessage.mensaje ?? '')
    const { data: conversationRow, error: conversationError } = await supabase
      .from(args.conversationTable)
      .select('nombre')
      .eq('id', conversationId)
      .single()
    if (
      conversationError ||
      !shouldReplaceGeneratedChatName(conversationRow?.nombre, userMessage)
    ) {
      return
    }

    const title = await generateChatTitle({
      userMessage,
      assistantMessage: args.assistantMessage,
    })
    if (!title) return

    const observedName = conversationRow?.nombre ?? null
    const updateQuery = supabase
      .from(args.conversationTable)
      .update({ nombre: title })
      .eq('id', conversationId)
    const { error: updateError } =
      observedName === null
        ? await updateQuery.is('nombre', null)
        : await updateQuery.eq('nombre', observedName)

    if (updateError) throw updateError
  } catch (error) {
    console.warn(args.warningContext, error)
  }
}

export async function maybeUpdateChatConversationTitle(
  kind: ChatConversationKind,
  messageId: string,
  assistantMessage: string,
): Promise<void> {
  await maybeUpdateConversationTitle(
    kind === 'plan'
      ? {
          messageId,
          assistantMessage,
          messageTable: 'plan_mensajes_ia',
          conversationTable: 'conversaciones_plan',
          conversationColumn: 'conversacion_plan_id',
          warningContext: 'No se pudo generar título para el chat de plan:',
        }
      : {
          messageId,
          assistantMessage,
          messageTable: 'asignatura_mensajes_ia',
          conversationTable: 'conversaciones_asignatura',
          conversationColumn: 'conversacion_asignatura_id',
          warningContext:
            'No se pudo generar título para el chat de asignatura:',
        },
  )
}
