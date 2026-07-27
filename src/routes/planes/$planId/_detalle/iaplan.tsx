import { useQueryClient } from '@tanstack/react-query'
import {
  createFileRoute,
  Navigate,
  useRouterState,
} from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'

import type {
  AIChatField,
  AIChatMessage,
  AIChatSendPayload,
} from '@/components/ia/AIChatWorkspace'

import { AIChatWorkspace } from '@/components/ia/AIChatWorkspace'
import {
  ChatProposedFieldCard,
  tryParseChatValue,
} from '@/components/ia/ChatProposedFieldCard'
import { Button } from '@/components/ui/button'
import {
  useAIPlanChat,
  useConversationByPlan,
  useMessagesByChat,
  useUpdateConversationStatus,
  useUpdateConversationTitle,
  useUpdatePlanFields,
  useUpdateRecommendationApplied,
} from '@/data'
import {
  openai_response_cancel,
  resolverResultadoCancelacion,
} from '@/data/api/openaiResponses.api'
import { usePlan } from '@/data/hooks/usePlans'
import { qk } from '@/data/query/keys'
import {
  getChatAssistantContent,
  getChatAssistantStatus,
  isActiveChatMessageGeneration,
} from '@/lib/chat-generation-state'
import { notify } from '@/lib/toast'

interface EstructuraDefinicion {
  properties?: {
    [key: string]: {
      title: string
      description?: string
    }
  }
}

function isProcessingDbMessage(message: any) {
  return isActiveChatMessageGeneration(message)
}

export const Route = createFileRoute('/planes/$planId/_detalle/iaplan')({
  component: RouteComponent,
})

function RouteComponent() {
  const { planId } = Route.useParams()
  return (
    <Navigate
      to="/planes/$planId"
      params={{ planId }}
      state={(previous) => ({
        ...previous,
        reopenContextualPanel: 'plan-ia',
      })}
      replace
    />
  )
}

export function IaPlanChatView({
  planId,
  chatOnly = false,
  compact = false,
  onCerrar,
}: {
  planId: string
  chatOnly?: boolean
  compact?: boolean
  onCerrar?: () => void
}) {
  const { data } = usePlan(planId)
  const routerState = useRouterState()
  const queryClient = useQueryClient()
  const { mutateAsync: sendChat } = useAIPlanChat()
  const { mutateAsync: updateStatusAsync } = useUpdateConversationStatus()
  const { mutateAsync: updateTitleAsync } = useUpdateConversationTitle()
  const { mutateAsync: updatePlanAsync } = useUpdatePlanFields()
  const { mutateAsync: updateAppliedStatusAsync } =
    useUpdateRecommendationApplied()
  const { data: lastConversation, isLoading: isLoadingConv } =
    useConversationByPlan(planId)
  const [activeChatId, setActiveChatId] = useState<string | undefined>()
  const { data: mensajesDelChat, isLoading: isLoadingMessages } =
    useMessagesByChat(activeChatId ?? null)
  const [isSyncing, setIsSyncing] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const hasProcessingMessage = useMemo(
    () => mensajesDelChat?.some(isProcessingDbMessage) ?? false,
    [mensajesDelChat],
  )
  const isBusy = isSending || isSyncing || hasProcessingMessage

  const availableFields = useMemo<Array<AIChatField>>(() => {
    const definicion = data?.estructuras_plan?.definicion as
      | EstructuraDefinicion
      | undefined

    if (!definicion?.properties) return []

    return Object.entries(definicion.properties).map(([key, value]) => ({
      key,
      label: value.title,
      value: String(value.description || ''),
    }))
  }, [data])

  const chatMessages = useMemo<Array<AIChatMessage>>(() => {
    if (!activeChatId || !mensajesDelChat) return []

    return mensajesDelChat.flatMap((msg: any) => {
      const renderedMessages: Array<AIChatMessage> = [
        {
          id: `${msg.id}-user`,
          role: 'user',
          content: msg.mensaje,
        },
      ]

      const status = getChatAssistantStatus(msg)
      const rawRecommendations = msg.propuesta?.recommendations || []

      renderedMessages.push({
        id: `${msg.id}-ai`,
        dbMessageId: msg.id,
        role: 'assistant',
        content: getChatAssistantContent(msg, status),
        status,
        createdAt: msg.fecha_actualizacion ?? msg.fecha_creacion ?? null,
        requestContent: String(msg.mensaje ?? ''),
        requestFieldKeys: Array.isArray(msg.campos) ? msg.campos : [],
        isProcessing: status === 'processing',
        isRefusal: status === 'completed' ? msg.is_refusal : false,
        openaiResponseId: msg.openai_response_id ?? null,
        suggestions:
          status === 'completed'
            ? rawRecommendations.map((rec: any) => {
                const fieldConfig = availableFields.find(
                  (field) => field.key === rec.campo_afectado,
                )

                return {
                  key: rec.campo_afectado,
                  label: fieldConfig
                    ? fieldConfig.label
                    : rec.campo_afectado.replace(/_/g, ' '),
                  newValue: rec.texto_mejora,
                  previousValue: rec.valor_anterior ?? null,
                  explanation: rec.explicacion ?? null,
                  applied: rec.aplicada,
                }
              })
            : [],
      })

      return renderedMessages
    })
  }, [activeChatId, availableFields, mensajesDelChat])

  useEffect(() => {
    if (!isSyncing || !mensajesDelChat || mensajesDelChat.length === 0) return

    if (!mensajesDelChat.some(isProcessingDbMessage)) {
      setIsSyncing(false)
      setIsSending(false)
    }
  }, [isSyncing, mensajesDelChat])

  const prefill = useMemo(() => {
    const state = routerState.location.state as any
    if (!state?.campo_edit) return undefined

    return {
      fieldKey: state.campo_edit as string,
      fieldValue: state.campo_edit as string,
      token: state.campo_edit as string,
      baseInput: 'Mejora este campo:',
    }
  }, [routerState.location.state])

  const handleSend = async (payload: AIChatSendPayload) => {
    setIsSending(true)

    try {
      const response = await sendChat({
        planId: planId as any,
        content: payload.content,
        conversacionId: activeChatId,
        campos: payload.fieldKeys.length > 0 ? payload.fieldKeys : undefined,
        references: payload.references,
        webSearchEnabled: payload.webSearchEnabled,
        reasoningEffort: payload.reasoningEffort,
        retryOfMessageId: payload.retryOfMessageId,
      })

      setIsSyncing(true)

      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: qk.planConversations(planId),
        }),
        queryClient.invalidateQueries({
          queryKey: qk.planMessages(response.conversacionId),
        }),
      ])

      return { conversationId: response.conversacionId }
    } catch (error) {
      setIsSending(false)
      setIsSyncing(false)
      throw error
    }
  }

  const handleCancelMessage = async (message: AIChatMessage) => {
    if (!message.dbMessageId || !message.openaiResponseId) {
      throw new Error('No se encontró la generación activa para cancelar.')
    }

    const result = await openai_response_cancel({
      kind: 'plan-chat',
      entityId: message.dbMessageId,
      responseId: message.openaiResponseId,
    })

    await queryClient.invalidateQueries({
      queryKey: qk.planMessages(activeChatId),
    })

    return resolverResultadoCancelacion(result)
  }

  const handleApplyMultiple = async (
    sugerencias: Array<any>,
    dbMessageId: string,
    removeSelectedField: (fieldKey: string) => void,
  ) => {
    if (!planId || !data?.datos || sugerencias.length === 0) return

    setIsSending(true)
    try {
      const datosActualizados = {
        ...(data.datos as Record<string, unknown>),
      }

      for (const sug of sugerencias) {
        const key = sug.key
        const newValue = tryParseChatValue(sug.newValue)
        const currentValue = datosActualizados[key]

        if (
          typeof currentValue === 'object' &&
          currentValue !== null &&
          'description' in currentValue
        ) {
          datosActualizados[key] = { ...currentValue, description: newValue }
        } else {
          datosActualizados[key] = newValue
        }
      }

      await updatePlanAsync({
        planId: planId,
        patch: { datos: datosActualizados },
      })

      for (const sug of sugerencias) {
        await updateAppliedStatusAsync({
          mensajeId: dbMessageId,
          campoAfectado: sug.key,
          conversationId: activeChatId ?? undefined,
        })
        removeSelectedField(sug.key)
      }

      notify.success('Sugerencias aplicadas')
    } catch (error) {
      notify.error('No se pudieron aplicar todas las sugerencias.')
      console.error('Error crítico en aplicación masiva:', error)
    } finally {
      setIsSending(false)
    }
  }

  return (
    <AIChatWorkspace
      conversationType="plan"
      chatOnly={chatOnly}
      compact={compact}
      onCerrar={onCerrar}
      conversations={lastConversation ?? []}
      conversationsLoading={isLoadingConv}
      messagesLoading={Boolean(activeChatId && isLoadingMessages)}
      messages={chatMessages}
      activeChatId={activeChatId}
      onActiveChatChange={setActiveChatId}
      availableFields={availableFields}
      prefill={prefill}
      isBusy={isBusy}
      headerHelpText="Prioriza una sola conversación a la vez. Las referencias se usan cuando el contenido depende de archivos o repositorios."
      wideRoute={{
        to: '/planes/$planId/iaplan/chat' as any,
        params: { planId },
        mask: {
          to: '/planes/$planId/iaplan' as any,
          params: { planId },
        },
      }}
      exitRoute={{
        to: '/planes/$planId' as any,
        params: { planId },
        state: { reopenContextualPanel: 'plan-ia' },
      }}
      onSend={handleSend}
      onArchive={(id) =>
        updateStatusAsync({ id, estado: 'ARCHIVADA', planId }).then(() => {})
      }
      onUnarchive={(id) =>
        updateStatusAsync({ id, estado: 'ACTIVA', planId }).then(() => {})
      }
      onRename={(id, nombre) =>
        updateTitleAsync({ id, nombre, planId }).then(() => {})
      }
      onCancelMessage={handleCancelMessage}
      renderAssistantExtras={(message, helpers) => {
        if (!message.suggestions || message.suggestions.length === 0) {
          return null
        }

        const pending = message.suggestions.filter(
          (suggestion) => !suggestion.applied,
        )

        return (
          <div className="mt-3 w-full space-y-3">
            {pending.length > 1 && message.dbMessageId && (
              <div className="flex justify-end">
                <Button
                  size="sm"
                  className="bg-primary text-primary-foreground hover:bg-primary/90 h-7 px-3 text-[12px] shadow-none"
                  onClick={() => {
                    void handleApplyMultiple(
                      pending,
                      message.dbMessageId!,
                      helpers.removeSelectedField,
                    )
                  }}
                >
                  Aplicar todas
                </Button>
              </div>
            )}

            <div className="space-y-3">
              {message.suggestions.map((suggestion) => (
                <ChatProposedFieldCard
                  key={suggestion.key}
                  suggestion={suggestion}
                  onApply={async (sug) => {
                    await handleApplyMultiple(
                      [sug],
                      message.dbMessageId!,
                      helpers.removeSelectedField,
                    )
                  }}
                />
              ))}
            </div>
          </div>
        )
      }}
    />
  )
}
