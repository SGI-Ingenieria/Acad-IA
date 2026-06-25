import { useQueryClient } from '@tanstack/react-query'
import { useLocation, useParams } from '@tanstack/react-router'
import { useEffect, useMemo, useRef, useState } from 'react'

import { ImprovementCard } from './SaveAsignatura/ImprovementCardProps'

import type {
  AIChatField,
  AIChatMessage,
  AIChatSendPayload,
} from '@/components/ia/AIChatWorkspace'

import { AIChatWorkspace } from '@/components/ia/AIChatWorkspace'
import {
  useAISubjectChat,
  useConversationBySubject,
  useMessagesBySubjectChat,
  useSubject,
  useUpdateSubjectConversationName,
  useUpdateSubjectConversationStatus,
} from '@/data'
import { openai_response_cancel } from '@/data/api/openaiResponses.api'
import {
  getOrganicMotion,
  gsap,
  organicDuration,
  organicEase,
  useGSAP,
} from '@/lib/animations'

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

  return 'error'
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

export function IAAsignaturaTab({
  chatOnly = false,
}: {
  chatOnly?: boolean
} = {}) {
  const queryClient = useQueryClient()
  const { planId, asignaturaId } = useParams({
    from: '/planes/$planId/asignaturas/$asignaturaId',
  })
  const location = useLocation()
  const { data: datosGenerales } = useSubject(asignaturaId)
  const { data: todasConversaciones, isLoading: loadingConv } =
    useConversationBySubject(asignaturaId)
  const [activeChatId, setActiveChatId] = useState<string | undefined>()
  const { data: rawMessages, isLoading: isLoadingMessages } =
    useMessagesBySubjectChat(activeChatId ?? null)
  const { mutateAsync: sendMessage } = useAISubjectChat()
  const { mutateAsync: updateStatusAsync } =
    useUpdateSubjectConversationStatus()
  const { mutateAsync: updateNameAsync } = useUpdateSubjectConversationName()
  const [isSending, setIsSending] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)

  const availableFields = useMemo<Array<AIChatField>>(() => {
    const estructuraProps =
      (datosGenerales?.estructuras_asignatura?.definicion as any)?.properties ||
      {}
    const datos: Record<string, any> = (datosGenerales?.datos as any) || {}

    // Campos declarados en la estructura (viven en `datos`).
    const dynamicFields = Object.entries(estructuraProps).map(
      ([key, fieldDef]: any) => {
        let value = ''
        if (datos[key] !== undefined && datos[key] !== null) {
          value =
            typeof datos[key] === 'string'
              ? datos[key]
              : JSON.stringify(datos[key])
        }

        return {
          key,
          label: fieldDef?.title || key.replace(/_/g, ' ').toUpperCase(),
          value,
        }
      },
    )

    // Campos siempre incluidos (resueltos por su columna canónica) que la IA
    // también puede mejorar, aunque no estén declarados en la estructura.
    const camposSiempreIncluidos: Array<AIChatField> = [
      {
        key: 'contenido_tematico',
        label: 'CONTENIDO TEMÁTICO',
        value: datosGenerales?.contenido_tematico
          ? JSON.stringify(datosGenerales.contenido_tematico)
          : '',
      },
      {
        key: 'criterios_de_evaluacion',
        label: 'CRITERIOS DE EVALUACIÓN',
        value: datosGenerales?.criterios_de_evaluacion
          ? JSON.stringify(datosGenerales.criterios_de_evaluacion)
          : '',
      },
    ]

    return [...dynamicFields, ...camposSiempreIncluidos].filter(
      (field, index, self) =>
        index === self.findIndex((item) => item.key === field.key),
    )
  }, [datosGenerales])

  const messages = useMemo<Array<AIChatMessage>>(() => {
    if (!activeChatId || !rawMessages) return []

    return rawMessages.flatMap((message: any) => {
      const renderedMessages: Array<AIChatMessage> = [
        {
          id: `${message.id}-user`,
          role: 'user',
          content: message.mensaje,
        },
      ]

      const status = getAssistantStatus(message)

      if (status) {
        renderedMessages.push({
          id: `${message.id}-ai`,
          dbMessageId: message.id,
          role: 'assistant',
          content: getAssistantContent(message, status),
          status,
          isProcessing: status === 'processing',
          isRefusal: status === 'completed' ? message.is_refusal : false,
          openaiResponseId: message.openai_response_id ?? null,
          suggestions:
            status === 'completed'
              ? message.propuesta?.recommendations?.map(
                  (rec: any, index: number) => ({
                    id: `${message.id}-sug-${index}`,
                    messageId: message.id,
                    campoKey: rec.campo_afectado,
                    campoNombre:
                      availableFields.find(
                        (field) => field.key === rec.campo_afectado,
                      )?.label ?? rec.campo_afectado.replace(/_/g, ' '),
                    valorSugerido: rec.texto_mejora,
                    aceptada: rec.aplicada,
                  }),
                ) || []
              : [],
        })
      }

      return renderedMessages
    })
  }, [activeChatId, availableFields, rawMessages])

  const isAiThinking = useMemo(
    () =>
      isSending ||
      isSyncing ||
      (rawMessages?.some(isProcessingDbMessage) ?? false),
    [isSending, isSyncing, rawMessages],
  )

  useEffect(() => {
    if (!isSyncing || !rawMessages || rawMessages.length === 0) return

    if (!rawMessages.some(isProcessingDbMessage)) {
      setIsSyncing(false)
      setIsSending(false)
    }
  }, [isSyncing, rawMessages])

  const prefill = useMemo(() => {
    const state = location.state as any

    if (state?.activeTab !== 'ia' || !state?._ts || !state.prefillCampo) {
      return undefined
    }

    return {
      fieldKey: state.prefillCampo as string,
      token: state._ts as number,
      baseInput: 'Mejora este campo:',
    }
  }, [location.state])

  const handleSend = async (payload: AIChatSendPayload) => {
    setIsSending(true)

    try {
      const response = await sendMessage({
        subjectId: asignaturaId as any,
        content: payload.content,
        campos: payload.fieldKeys,
        conversacionId: activeChatId,
        archivosReferencia: payload.archivosReferencia,
        repositoriosIds: payload.repositoriosIds,
        webSearchEnabled: payload.webSearchEnabled,
        reasoningEffort: payload.reasoningEffort,
      })

      setIsSyncing(true)

      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ['conversation-by-subject', asignaturaId],
        }),
        queryClient.invalidateQueries({
          queryKey: ['subject-messages', response.conversacionId],
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
      kind: 'subject-chat',
      entityId: message.dbMessageId,
      responseId: message.openaiResponseId,
    })

    await queryClient.invalidateQueries({
      queryKey: ['subject-messages', activeChatId],
    })
  }

  return (
    <AIChatWorkspace
      chatOnly={chatOnly}
      conversations={todasConversaciones ?? []}
      conversationsLoading={loadingConv}
      messagesLoading={Boolean(activeChatId && isLoadingMessages)}
      messages={messages}
      activeChatId={activeChatId}
      onActiveChatChange={setActiveChatId}
      availableFields={availableFields}
      prefill={prefill}
      isBusy={isAiThinking}
      headerHelpText="Asistente personalizado para tu asignatura. Las referencias se usan cuando el contenido depende de archivos o repositorios."
      wideRoute={{
        to: '/planes/$planId/asignaturas/$asignaturaId/iaasignatura/chat' as any,
        params: { planId, asignaturaId },
        mask: {
          to: '/planes/$planId/asignaturas/$asignaturaId/iaasignatura' as any,
          params: { planId, asignaturaId },
        },
      }}
      exitRoute={{
        to: '/planes/$planId/asignaturas/$asignaturaId/iaasignatura' as any,
        params: { planId, asignaturaId },
      }}
      onSend={handleSend}
      onArchive={(id) =>
        updateStatusAsync({
          id,
          estado: 'ARCHIVADA',
          subjectId: asignaturaId,
        }).then(() => {})
      }
      onUnarchive={(id) =>
        updateStatusAsync({
          id,
          estado: 'ACTIVA',
          subjectId: asignaturaId,
        }).then(() => {})
      }
      onRename={(id, nombre) =>
        updateNameAsync({ id, nombre, subjectId: asignaturaId }).then(() => {})
      }
      onCancelMessage={handleCancelMessage}
      renderAssistantExtras={(message, helpers) => {
        if (!message.suggestions || message.suggestions.length === 0) {
          return null
        }

        return (
          <SubjectSuggestionList
            suggestions={message.suggestions}
            asignaturaId={asignaturaId}
            onApplied={helpers.removeSelectedField}
          />
        )
      }}
    />
  )
}

/**
 * Lista de tarjetas de sugerencia con entrada escalonada (§7.3): cada tarjeta
 * aparece con un leve desplazamiento y desenfoque, en cascada, en lugar de
 * mostrarse todas de golpe. Respeta `prefers-reduced-motion`.
 */
function SubjectSuggestionList({
  suggestions,
  asignaturaId,
  onApplied,
}: {
  suggestions: Array<any>
  asignaturaId: string
  onApplied: (campoKey: string) => void
}) {
  const listRef = useRef<HTMLDivElement>(null)

  useGSAP(
    () => {
      if (!getOrganicMotion()) return

      const cards = listRef.current?.querySelectorAll('.improvement-card')
      if (!cards || cards.length === 0) return

      gsap.fromTo(
        cards,
        { y: 10, opacity: 0, filter: 'blur(6px)' },
        {
          y: 0,
          opacity: 1,
          filter: 'blur(0px)',
          duration: organicDuration.slow,
          ease: organicEase,
          stagger: 0.06,
          overwrite: 'auto',
        },
      )
    },
    { scope: listRef, dependencies: [suggestions.length] },
  )

  return (
    <div ref={listRef} className="mt-3 w-full space-y-3">
      <div className="space-y-3">
        {suggestions.map((suggestion) => (
          <ImprovementCard
            key={suggestion.id}
            sug={suggestion}
            asignaturaId={asignaturaId}
            onApplied={onApplied}
          />
        ))}
      </div>
    </div>
  )
}
