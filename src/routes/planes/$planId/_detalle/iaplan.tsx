import { useQueryClient } from '@tanstack/react-query'
import { createFileRoute, useRouterState } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'

import type {
  AIChatField,
  AIChatMessage,
  AIChatSendPayload,
} from '@/components/ia/AIChatWorkspace'

import { AIChatWorkspace } from '@/components/ia/AIChatWorkspace'
import { ImprovementCard } from '@/components/planes/detalle/Ia/ImprovementCard'
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
import { openai_response_cancel } from '@/data/api/openaiResponses.api'
import { usePlan } from '@/data/hooks/usePlans'
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
  return ['PROCESANDO', 'PENDIENTE'].includes(String(message?.estado ?? ''))
}

function getAssistantStatus(message: any): AIChatMessage['status'] | null {
  const estado = String(message?.estado ?? '')

  if (estado === 'PROCESANDO' || estado === 'PENDIENTE') return 'processing'
  if (estado === 'ERROR') return 'error'
  if (estado === 'CANCELADO') return 'cancelled'
  if (message?.respuesta) return 'completed'
  if (estado === 'COMPLETADO') return 'error'

  return null
}

function getAssistantContent(
  message: any,
  status: NonNullable<AIChatMessage['status']>,
) {
  if (status === 'processing') return 'Generando respuesta...'
  if (status === 'cancelled') {
    return message?.respuesta || 'Esta respuesta se ha cancelado.'
  }
  if (status === 'error') {
    return message?.respuesta || 'No se pudo generar la respuesta de la IA.'
  }

  return message?.respuesta || 'No se pudo procesar la respuesta de la IA.'
}

export const Route = createFileRoute('/planes/$planId/_detalle/iaplan')({
  component: RouteComponent,
})

function RouteComponent() {
  const { planId } = Route.useParams()
  return <IaPlanChatView planId={planId} chatOnly={false} />
}

export function IaPlanChatView({
  planId,
  chatOnly = false,
}: {
  planId: string
  chatOnly?: boolean
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
  const { data: mensajesDelChat } = useMessagesByChat(activeChatId ?? null)
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

      const status = getAssistantStatus(msg)

      if (status) {
        const rawRecommendations = msg.propuesta?.recommendations || []

        renderedMessages.push({
          id: `${msg.id}-ai`,
          dbMessageId: msg.id,
          role: 'assistant',
          content: getAssistantContent(msg, status),
          status,
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
                    applied: rec.aplicada,
                  }
                })
              : [],
        })
      }

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
        archivosReferencia: payload.archivosReferencia,
        repositoriosIds: payload.repositoriosIds,
        webSearchEnabled: payload.webSearchEnabled,
        reasoningEffort: payload.reasoningEffort,
      })

      setIsSyncing(true)

      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ['conversation-by-plan', planId],
        }),
        queryClient.invalidateQueries({
          queryKey: ['conversation-messages', response.conversacionId],
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

    await openai_response_cancel({
      kind: 'plan-chat',
      entityId: message.dbMessageId,
      responseId: message.openaiResponseId,
    })

    await queryClient.invalidateQueries({
      queryKey: ['conversation-messages', activeChatId],
    })
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
        const newValue = sug.newValue
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
        planId: planId as any,
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
      chatOnly={chatOnly}
      conversations={lastConversation ?? []}
      conversationsLoading={isLoadingConv}
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
        to: '/planes/$planId/iaplan' as any,
        params: { planId },
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

        return (
          <div className="mt-3 w-full space-y-3 border-l-0 bg-transparent px-0 py-0 pl-0 shadow-none">
            <div className="space-y-3 px-0 py-0">
              {message.suggestions.some((suggestion) => !suggestion.applied) &&
                message.dbMessageId && (
                  <div className="flex justify-end">
                    <Button
                      size="sm"
                      className="bg-primary text-primary-foreground hover:bg-primary/90 h-7 px-3 text-[12px] shadow-none"
                      onClick={() => {
                        const pendientes = message.suggestions!.filter(
                          (suggestion) => !suggestion.applied,
                        )
                        void handleApplyMultiple(
                          pendientes,
                          message.dbMessageId!,
                          helpers.removeSelectedField,
                        )
                      }}
                    >
                      Aplicar todas
                    </Button>
                  </div>
                )}

              {message.suggestions.map((suggestion) => (
                <div key={suggestion.key} className="flex w-full">
                  <div className="flex-1">
                    <ImprovementCard
                      suggestions={[suggestion]}
                      dbMessageId={message.dbMessageId!}
                      planId={planId}
                      currentDatos={data?.datos}
                      activeChatId={activeChatId}
                      onApplySuccess={helpers.removeSelectedField}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      }}
    />
  )
}
