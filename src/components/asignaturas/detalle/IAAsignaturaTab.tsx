import { useQueryClient } from '@tanstack/react-query'
import { useLocation, useParams } from '@tanstack/react-router'
import { useMemo, useState } from 'react'

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
  const { data: rawMessages } = useMessagesBySubjectChat(activeChatId ?? null)
  const { mutateAsync: sendMessage } = useAISubjectChat()
  const { mutateAsync: updateStatusAsync } =
    useUpdateSubjectConversationStatus()
  const { mutateAsync: updateNameAsync } = useUpdateSubjectConversationName()
  const [isSending, setIsSending] = useState(false)

  const availableFields = useMemo<Array<AIChatField>>(() => {
    const estructuraProps =
      (datosGenerales?.estructuras_asignatura?.definicion as any)?.properties ||
      {}
    const datos: Record<string, any> = (datosGenerales?.datos as any) || {}

    const dynamicFields = Object.entries(estructuraProps).map(
      ([key, fieldDef]: any) => {
        const realKey = fieldDef['x-column'] || key
        let value = ''

        if (datos[realKey] !== undefined && datos[realKey] !== null) {
          value =
            typeof datos[realKey] === 'string'
              ? datos[realKey]
              : JSON.stringify(datos[realKey])
        }

        if (
          realKey === 'contenido_tematico' &&
          datosGenerales?.contenido_tematico
        ) {
          value = JSON.stringify(datosGenerales.contenido_tematico)
        }

        if (
          realKey === 'criterios_de_evaluacion' &&
          datosGenerales?.criterios_de_evaluacion
        ) {
          value = JSON.stringify(datosGenerales.criterios_de_evaluacion)
        }

        return {
          key: realKey,
          label: fieldDef?.title || realKey.replace(/_/g, ' ').toUpperCase(),
          value,
        }
      },
    )

    return dynamicFields.filter(
      (field, index, self) =>
        index === self.findIndex((item) => item.key === field.key),
    )
  }, [datosGenerales])

  const messages = useMemo<Array<AIChatMessage>>(() => {
    if (!rawMessages) return []

    return rawMessages.flatMap((message: any) => {
      const renderedMessages: Array<AIChatMessage> = [
        {
          id: `${message.id}-user`,
          role: 'user',
          content: message.mensaje,
        },
      ]

      if (message.respuesta) {
        renderedMessages.push({
          id: `${message.id}-ai`,
          dbMessageId: message.id,
          role: 'assistant',
          content: message.respuesta,
          isRefusal: message.is_refusal,
          suggestions:
            message.propuesta?.recommendations?.map(
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
            ) || [],
        })
      }

      return renderedMessages
    })
  }, [availableFields, rawMessages])

  const isAiThinking = useMemo(() => {
    if (isSending) return true
    if (!rawMessages || rawMessages.length === 0) return false

    const lastMessage = rawMessages[rawMessages.length - 1] as any
    return (
      lastMessage.estado === 'PROCESANDO' || lastMessage.estado === 'PENDIENTE'
    )
  }, [isSending, rawMessages])

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
      })

      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ['conversation-by-subject', asignaturaId],
        }),
        queryClient.invalidateQueries({
          queryKey: ['subject-messages', response.conversacionId],
        }),
      ])

      return { conversationId: response.conversacionId }
    } finally {
      setIsSending(false)
    }
  }

  return (
    <AIChatWorkspace
      chatOnly={chatOnly}
      conversations={todasConversaciones ?? []}
      conversationsLoading={loadingConv}
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
      renderAssistantExtras={(message, helpers) => {
        if (!message.suggestions || message.suggestions.length === 0) {
          return null
        }

        return (
          <div className="mt-3 w-full space-y-3">
            <div className="space-y-3">
              {message.suggestions.map((suggestion) => (
                <ImprovementCard
                  key={suggestion.id}
                  sug={suggestion}
                  asignaturaId={asignaturaId}
                  onApplied={helpers.removeSelectedField}
                />
              ))}
            </div>
          </div>
        )
      }}
    />
  )
}
