import { useQueryClient } from '@tanstack/react-query'
import { useLocation, useParams } from '@tanstack/react-router'
import { Check, ExternalLink, Globe, Library } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'

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
  useAISubjectChat,
  useConversationBySubject,
  useCreateBibliografia,
  useMessagesBySubjectChat,
  useSubject,
  useUpdateAsignatura,
  useUpdateSubjectConversationName,
  useUpdateSubjectConversationStatus,
  useUpdateSubjectRecommendation,
} from '@/data'
import {
  openai_response_cancel,
  resolverResultadoCancelacion,
} from '@/data/api/openaiResponses.api'
import { useAsignaturaCapabilities } from '@/data/auth/planCapabilities'
import { usePlan } from '@/data/hooks/usePlans'
import { qk } from '@/data/query/keys'
import { getBibliotecaInstitutionalHref } from '@/features/bibliografia/nueva/lib'
import {
  getOrganicMotion,
  gsap,
  organicDuration,
  organicEase,
  useGSAP,
} from '@/lib/animations'
import {
  getChatAssistantContent,
  getChatAssistantStatus,
  isActiveChatMessageGeneration,
} from '@/lib/chat-generation-state'

function isProcessingDbMessage(message: any) {
  return isActiveChatMessageGeneration(message)
}

export function IAAsignaturaTab({
  chatOnly = false,
  compact = false,
  onCerrar,
}: {
  chatOnly?: boolean
  compact?: boolean
  onCerrar?: () => void
} = {}) {
  const queryClient = useQueryClient()
  const { planId, asignaturaId } = useParams({
    from: '/planes/$planId/asignaturas/$asignaturaId',
  })
  const location = useLocation()
  const { data: datosGenerales } = useSubject(asignaturaId)
  const { data: plan } = usePlan(planId)
  const capabilities = useAsignaturaCapabilities(plan, asignaturaId)
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

      const status = getChatAssistantStatus(message)

      renderedMessages.push({
        id: `${message.id}-ai`,
        dbMessageId: message.id,
        role: 'assistant',
        content: getChatAssistantContent(message, status),
        status,
        createdAt:
          message.fecha_actualizacion ?? message.fecha_creacion ?? null,
        requestContent: String(message.mensaje ?? ''),
        requestFieldKeys: Array.isArray(message.campos) ? message.campos : [],
        isProcessing: status === 'processing',
        isRefusal: status === 'completed' ? message.is_refusal : false,
        openaiResponseId: message.openai_response_id ?? null,
        suggestions:
          status === 'completed'
            ? message.propuesta?.recommendations?.map(
                (rec: any, index: number) => ({
                  id: `${message.id}-sug-${index}`,
                  messageId: message.id,
                  key: rec.campo_afectado,
                  label:
                    availableFields.find(
                      (field) => field.key === rec.campo_afectado,
                    )?.label ?? rec.campo_afectado.replace(/_/g, ' '),
                  newValue: rec.texto_mejora,
                  previousValue: rec.valor_anterior ?? null,
                  explanation: rec.explicacion ?? null,
                  applied: rec.aplicada,
                }),
              ) || []
            : [],
        actionProposals:
          status === 'completed' &&
          Array.isArray(message.propuesta?.action_proposals)
            ? message.propuesta.action_proposals
            : [],
      })

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
        mentions: payload.mentions,
        campos: payload.fieldKeys,
        conversacionId: activeChatId,
        references: payload.references,
        webSearchEnabled: payload.webSearchEnabled,
        reasoningEffort: payload.reasoningEffort,
        retryOfMessageId: payload.retryOfMessageId,
      })

      setIsSyncing(true)

      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: qk.subjectConversations(asignaturaId),
        }),
        queryClient.invalidateQueries({
          queryKey: qk.subjectMessages(response.conversacionId),
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
      kind: 'subject-chat',
      entityId: message.dbMessageId,
      responseId: message.openaiResponseId,
    })

    await queryClient.invalidateQueries({
      queryKey: qk.subjectMessages(activeChatId),
    })

    return resolverResultadoCancelacion(result)
  }

  return (
    <AIChatWorkspace
      conversationType="asignatura"
      chatOnly={chatOnly}
      compact={compact}
      onCerrar={onCerrar}
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
        to: '/planes/$planId/asignaturas/$asignaturaId' as any,
        params: { planId, asignaturaId },
        state: { reopenContextualPanel: 'subject-ia' },
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
        const propuestasBibliografia = (message.actionProposals ?? []).filter(
          (proposal) => proposal.tipo === 'bibliografia',
        )
        if (propuestasBibliografia.length > 0) {
          return (
            <SubjectBibliographyProposalCards
              proposals={propuestasBibliografia}
              asignaturaId={asignaturaId}
              canCreate={capabilities.canEditAsignaturas}
            />
          )
        }
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

function SubjectBibliographyProposalCards({
  proposals,
  asignaturaId,
  canCreate,
}: {
  proposals: Array<Record<string, unknown>>
  asignaturaId: string
  canCreate: boolean
}) {
  const { mutateAsync: crearBibliografia } = useCreateBibliografia()
  const [selected, setSelected] = useState(
    () => new Set(proposals.map((_, index) => index)),
  )
  const [creating, setCreating] = useState(false)
  const [created, setCreated] = useState(false)
  const [clasificaciones, setClasificaciones] = useState<
    Partial<Record<number, 'BASICA' | 'COMPLEMENTARIA'>>
  >({})

  const toggle = (index: number) => {
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
  }

  const createSelected = async () => {
    setCreating(true)
    try {
      for (const [index, proposal] of proposals.entries()) {
        if (!selected.has(index)) continue
        await crearBibliografia({
          asignatura_id: asignaturaId,
          cita: String(proposal.cita ?? ''),
          tipo:
            clasificaciones[index] === 'COMPLEMENTARIA' ||
            (clasificaciones[index] === undefined &&
              proposal.clasificacion === 'COMPLEMENTARIA')
              ? 'COMPLEMENTARIA'
              : 'BASICA',
          formato: String(proposal.formato ?? 'apa'),
          titulo: String(proposal.titulo ?? ''),
          autores:
            typeof proposal.autores === 'string' ? proposal.autores : null,
          editorial:
            typeof proposal.editorial === 'string' ? proposal.editorial : null,
          anio:
            (typeof proposal.anio === 'string' ||
              typeof proposal.anio === 'number') &&
            Number.isFinite(Number(proposal.anio))
              ? Number(proposal.anio)
              : null,
          isbn: typeof proposal.isbn === 'string' ? proposal.isbn : null,
          referencia_biblioteca:
            typeof proposal.referencia_biblioteca === 'string'
              ? proposal.referencia_biblioteca
              : null,
          referencia_en_linea:
            typeof proposal.referencia_en_linea === 'string'
              ? proposal.referencia_en_linea
              : null,
        })
        setSelected((current) => {
          const next = new Set(current)
          next.delete(index)
          return next
        })
      }
      setCreated(true)
    } finally {
      setCreating(false)
    }
  }

  return (
    <section
      className="mt-control space-y-control w-full"
      aria-label="Bibliografía propuesta"
    >
      <div className="gap-relacionado grid sm:grid-cols-2">
        {proposals.map((proposal, index) => {
          const clasificacion =
            clasificaciones[index] ??
            (proposal.clasificacion === 'COMPLEMENTARIA'
              ? 'COMPLEMENTARIA'
              : 'BASICA')
          const referenciaBiblioteca =
            typeof proposal.referencia_biblioteca === 'string'
              ? proposal.referencia_biblioteca
              : null
          const esBiblioteca = referenciaBiblioteca !== null
          const fichaBiblioteca =
            getBibliotecaInstitutionalHref(referenciaBiblioteca)
          return (
            <div
              key={`${String(proposal.referencia_biblioteca ?? proposal.titulo)}-${index}`}
              className={`border-border bg-card p-control rounded-xl border text-left transition-colors ${selected.has(index) ? 'border-primary bg-primary/5' : 'opacity-70'}`}
            >
              <div className="gap-relacionado flex items-start justify-between">
                <div className="gap-micro flex items-center text-xs">
                  {esBiblioteca ? (
                    <Library className="text-primary h-4 w-4 shrink-0" />
                  ) : (
                    <Globe className="text-primary h-4 w-4 shrink-0" />
                  )}
                  <span>
                    {esBiblioteca ? 'Biblioteca La Salle' : 'En línea'}
                  </span>
                  {fichaBiblioteca ? (
                    <a
                      href={fichaBiblioteca}
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary gap-micro inline-flex items-center hover:underline"
                    >
                      Ver ficha
                      <ExternalLink className="size-3" />
                    </a>
                  ) : null}
                </div>
                <Button
                  type="button"
                  variant={selected.has(index) ? 'secondary' : 'outline'}
                  size="sm"
                  disabled={created || !canCreate}
                  aria-pressed={selected.has(index)}
                  onClick={() => toggle(index)}
                >
                  {selected.has(index) ? 'Seleccionada' : 'Seleccionar'}
                </Button>
              </div>
              <p className="mt-micro font-semibold">
                {String(proposal.titulo ?? '')}
              </p>
              {typeof proposal.autores === 'string' && (
                <p className="text-muted-foreground mt-micro text-xs">
                  {proposal.autores}
                </p>
              )}
              <p className="text-muted-foreground mt-micro text-xs leading-relaxed">
                {String(proposal.cita ?? '')}
              </p>
              <div
                className="gap-micro mt-control flex"
                aria-label="Clasificación bibliográfica"
              >
                {(['BASICA', 'COMPLEMENTARIA'] as const).map((tipo) => (
                  <Button
                    key={tipo}
                    type="button"
                    size="sm"
                    variant={clasificacion === tipo ? 'default' : 'outline'}
                    className={
                      clasificacion === tipo
                        ? 'bg-primary text-primary-foreground ring-primary/30 hover:bg-primary/90 shadow-xs ring-2'
                        : 'bg-background text-muted-foreground hover:text-foreground'
                    }
                    disabled={created || !canCreate}
                    aria-pressed={clasificacion === tipo}
                    onClick={() =>
                      setClasificaciones((current) => ({
                        ...current,
                        [index]: tipo,
                      }))
                    }
                  >
                    {clasificacion === tipo && (
                      <Check className="h-3.5 w-3.5" />
                    )}
                    {tipo === 'BASICA' ? 'Básica' : 'Complementaria'}
                  </Button>
                ))}
              </div>
            </div>
          )
        })}
      </div>
      <Button
        size="sm"
        disabled={!canCreate || creating || created || selected.size === 0}
        onClick={() => void createSelected()}
      >
        {creating
          ? 'Agregando referencias…'
          : created
            ? 'Referencias agregadas'
            : `Agregar seleccionadas (${selected.size})`}
      </Button>
    </section>
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
  const { data: asignatura } = useSubject(asignaturaId)
  const updateAsignatura = useUpdateAsignatura()
  const updateRecommendation = useUpdateSubjectRecommendation()

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

  const handleApply = async (sug: any) => {
    const parsedValue = tryParseChatValue(sug.newValue)
    let patchData = {}

    if (sug.key === 'contenido_tematico') {
      patchData = { contenido_tematico: parsedValue }
    } else if (sug.key === 'criterios_de_evaluacion') {
      patchData = { criterios_de_evaluacion: parsedValue }
    } else if (sug.key === 'ciclo') {
      const ciclo =
        typeof parsedValue === 'number'
          ? parsedValue
          : Number.parseInt(String(parsedValue).match(/\d+/)?.[0] ?? '', 10)
      if (!Number.isInteger(ciclo) || ciclo < 1) {
        throw new Error('La propuesta de ciclo no tiene un número válido.')
      }
      // `ciclo` es la etiqueta académica que vive en `datos`; el mapa y la
      // seriación dependen de la columna canónica `numero_ciclo`.
      patchData = {
        numero_ciclo: ciclo,
        datos: {
          ...(asignatura?.datos
            ? (asignatura.datos as Record<string, unknown>)
            : {}),
          ciclo: parsedValue,
        },
      }
    } else {
      patchData = {
        datos: {
          ...(asignatura?.datos
            ? (asignatura.datos as Record<string, unknown>)
            : {}),
          [sug.key]: parsedValue,
        },
      }
    }

    await updateAsignatura.mutateAsync({
      asignaturaId,
      patch: patchData as any,
    })

    await updateRecommendation.mutateAsync({
      mensajeId: sug.messageId,
      campoAfectado: sug.key,
    })

    onApplied(sug.key)
  }

  return (
    <div ref={listRef} className="mt-control space-y-control w-full">
      <div className="space-y-control">
        {suggestions.map((suggestion) => (
          <ChatProposedFieldCard
            key={suggestion.id}
            suggestion={suggestion}
            onApply={handleApply}
          />
        ))}
      </div>
    </div>
  )
}
