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
  create_conversation,
  create_plan_action_message,
  useAIPlanChat,
  useConversationByPlan,
  useCreateLinea,
  useDeleteLinea,
  useLanzarGeneracionAsignatura,
  useMessagesByChat,
  usePlanAsignaturas,
  usePlanLineas,
  useSubjectEstructuraDelPlan,
  useUpdateAsignatura,
  useUpdateConversationStatus,
  useUpdateConversationTitle,
  useUpdatePlanFields,
  useUpdateRecommendationApplied,
} from '@/data'
import { agente_accion, esRechazo } from '@/data/api/agente.api'
import {
  openai_response_cancel,
  resolverResultadoCancelacion,
} from '@/data/api/openaiResponses.api'
import { generate_subject_suggestions } from '@/data/api/subjects.api'
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
  const { data: lineas } = usePlanLineas(planId)
  const { data: asignaturas } = usePlanAsignaturas(planId)
  const { estructura: estructuraAsignatura } = useSubjectEstructuraDelPlan(
    data?.estructura_id,
  )
  const crearLinea = useCreateLinea()
  const eliminarLinea = useDeleteLinea()
  const actualizarAsignatura = useUpdateAsignatura()
  const lanzarAsignatura = useLanzarGeneracionAsignatura()
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

    const rendered = mensajesDelChat.flatMap((msg: any) => {
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
        actionProposals:
          status === 'completed' &&
          Array.isArray(msg.propuesta?.action_proposals)
            ? msg.propuesta.action_proposals
            : [],
      })

      return renderedMessages
    })
    return rendered
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
      const normalizedRequest = payload.content
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '')
      const requestedLine = normalizedRequest.match(
        /(?:agrega|anade|crea|genera|propon|propone)\s+(?:(?:una|la|nueva)\s+)*(?:linea)(?:\s+curricular)?(?:\s+de|\s+llamada|\s+para|\s+que\s+se\s+llame)?\s+(.+)/i,
      )
      const requestedLineDeletion = normalizedRequest.match(
        /(?:(?:puedes|podrias|me\s+puedes|me\s+podrias)\s+)?(?:borra|borrar|elimina|eliminar|quita|quitar)\s+(?:la\s+)?linea(?:\s+curricular)?(?:\s+llamada|\s+de\s+nombre|\s+nombre)?\s+(.+?)(?:\s+(?:por\s+favor|porfa))?[?.!]*$/i,
      )
      const requestedSubjects = normalizedRequest.match(
        /(?:(?:puedes|podrias|me\s+puedes|me\s+podrias)\s+)?(?:quiero|genera(?:me)?|generar|propon(?:er|es)?|propone)\s+(\d{1,2}|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez)\s+(?:asignatura|asignaturas|materia|materias)/i,
      )
      const requestedSubjectsTrailing = normalizedRequest.match(
        /(?:(?:puedes|podrias|me\s+puedes|me\s+podrias)\s+)?(?:quiero|genera(?:me)?|generar|propon(?:er|es)?|propone)\s+(?:las?\s+)?(?:asignaturas?|materias?)\b.*?\b(?:solo|solamente|unicamente|únicamente)?\s*(\d{1,2}|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez)\b/i,
      )
      const requestedSubjectsCount =
        requestedSubjects?.[1] ?? requestedSubjectsTrailing?.[1]
      const requestedAssignment = normalizedRequest.match(
        /(?:la\s+)?asignatura\s+se\s+llama\s+(.+?)\s+y\s+la\s+quiero\s+agregar\s+en\s+(?:la\s+)?(?:linea(?:\s+curricular)?|area)\s+(.+)/i,
      )
      const requestedCycleChange = normalizedRequest.match(
        /(?:(?:puedes|podrias|me\s+puedes|me\s+podrias)\s+)?(?:mover|cambiar|pasar)\s+(?:la\s+)?asignatura\s+(?:de\s+)?(.+?)\s+a\s+(?:el\s+)?(\d{1,2}|primer|primero|segundo|tercer|tercero|cuarto|quinto|sexto|septimo|octavo|noveno|decimo)\s+(?:semestre|ciclo)/i,
      )

      if (
        requestedLine ||
        requestedLineDeletion ||
        requestedSubjectsCount ||
        requestedAssignment ||
        requestedCycleChange
      ) {
        let actionConversationId = activeChatId
        if (!actionConversationId) {
          const conversation = await create_conversation(
            planId,
            payload.content,
            payload.fieldKeys,
          )
          actionConversationId = conversation.conversation_plan.id
          setActiveChatId(actionConversationId)
        }
        const conversationId = actionConversationId
        if (!conversationId) {
          throw new Error('No se pudo abrir la conversación del plan.')
        }

        if (requestedLineDeletion) {
          if (!lineas) {
            throw new Error(
              'Todavía se está cargando la estructura curricular.',
            )
          }
          const normalize = (value: string) =>
            value
              .normalize('NFD')
              .replace(/\p{Diacritic}/gu, '')
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, ' ')
              .trim()
          const nombreSolicitado = requestedLineDeletion[1].trim()
          const linea = lineas.find(
            (item) => normalize(item.nombre) === normalize(nombreSolicitado),
          )
          const afectadas = (asignaturas ?? []).filter(
            (asignatura: any) => asignatura.linea_plan_id === linea?.id,
          ).length
          const response = linea
            ? `Encontré la línea curricular “${linea.nombre}”. ${afectadas > 0 ? `${afectadas} ${afectadas === 1 ? 'asignatura quedará' : 'asignaturas quedarán'} sin línea asignada. ` : ''}Confirma la eliminación si deseas continuar.`
            : `No encontré la línea curricular “${nombreSolicitado}” en este plan.`
          await create_plan_action_message({
            conversationId,
            content: payload.content,
            response,
            actionProposals: linea
              ? [
                  {
                    tipo: 'eliminar_linea',
                    linea_plan_id: linea.id,
                    linea_nombre: linea.nombre,
                    asignaturas_afectadas: afectadas,
                  },
                ]
              : [],
          })
          await queryClient.invalidateQueries({
            queryKey: qk.planMessages(conversationId),
          })
          setIsSending(false)
          return
        }

        if (requestedAssignment) {
          const normalize = (value: string) =>
            value
              .normalize('NFD')
              .replace(/\p{Diacritic}/gu, '')
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, ' ')
              .trim()
          const asignatura = (asignaturas ?? []).find(
            (item: any) =>
              normalize(item.nombre) === normalize(requestedAssignment[1]),
          ) as any
          const linea = (lineas ?? []).find(
            (item) =>
              normalize(item.nombre) === normalize(requestedAssignment[2]),
          )
          const response =
            asignatura && linea
              ? `Puedo mover “${asignatura.nombre}” a “${linea.nombre}”. Revisa la propuesta y decide si deseas aplicarla.`
              : 'No encontré la asignatura o la línea curricular indicada.'
          await create_plan_action_message({
            conversationId,
            content: payload.content,
            response,
            actionProposals:
              asignatura && linea
                ? [
                    {
                      tipo: 'asignacion',
                      asignatura_id: asignatura.id,
                      asignatura_nombre: asignatura.nombre,
                      linea_plan_id: linea.id,
                      linea_nombre: linea.nombre,
                      numero_ciclo: asignatura.numero_ciclo,
                    },
                  ]
                : [],
          })
          await queryClient.invalidateQueries({
            queryKey: qk.planMessages(conversationId),
          })
          setIsSending(false)
          return
        }

        if (requestedCycleChange) {
          const cycleByText: Record<string, number> = {
            primer: 1,
            primero: 1,
            segundo: 2,
            tercer: 3,
            tercero: 3,
            cuarto: 4,
            quinto: 5,
            sexto: 6,
            septimo: 7,
            octavo: 8,
            noveno: 9,
            decimo: 10,
          }
          const cicloSolicitado = requestedCycleChange[2].toLowerCase()
          const numeroCiclo =
            cycleByText[cicloSolicitado] ?? Number(cicloSolicitado)
          const normalize = (value: string) =>
            value
              .normalize('NFD')
              .replace(/\p{Diacritic}/gu, '')
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, ' ')
              .trim()
          const asignatura = (asignaturas ?? []).find(
            (item: any) =>
              normalize(item.nombre) === normalize(requestedCycleChange[1]),
          ) as any
          const cicloValido =
            numeroCiclo >= 1 && numeroCiclo <= (data?.numero_ciclos ?? 0)
          const response =
            asignatura && cicloValido
              ? `Puedo mover “${asignatura.nombre}” al ${numeroCiclo}° semestre. Revisa la propuesta y decide si deseas aplicarla.`
              : !asignatura
                ? `No encontré la asignatura “${requestedCycleChange[1].trim()}” en este plan.`
                : `El ${numeroCiclo}° semestre no está disponible en este plan.`
          await create_plan_action_message({
            conversationId,
            content: payload.content,
            response,
            actionProposals:
              asignatura && cicloValido
                ? [
                    {
                      tipo: 'cambio_ciclo',
                      asignatura_id: asignatura.id,
                      asignatura_nombre: asignatura.nombre,
                      numero_ciclo: numeroCiclo,
                      ciclo_anterior: asignatura.numero_ciclo,
                    },
                  ]
                : [],
          })
          await queryClient.invalidateQueries({
            queryKey: qk.planMessages(conversationId),
          })
          setIsSending(false)
          return
        }

        if (requestedLine) {
          if (!lineas || !asignaturas || !data) {
            throw new Error('Todavía se está cargando el mapa curricular.')
          }
          const resultado = await agente_accion({
            accion: 'proponer_linea',
            ambito: { tipo: 'plan', planId: planId as any },
            contexto: payload.content,
            sesion_id: crypto.randomUUID() as any,
            payload: {
              lineas: lineas.map((linea) => ({
                id: linea.id,
                nombre: linea.nombre,
                orden: linea.orden,
              })),
              asignaturas: asignaturas.map((asignatura: any) => ({
                id: asignatura.id,
                nombre: asignatura.nombre,
                clave: asignatura.codigo ?? null,
                creditos: asignatura.creditos ?? 0,
                horas_academicas: asignatura.horas_academicas ?? 0,
                horas_independientes: asignatura.horas_independientes ?? 0,
                tipo: asignatura.tipo,
                numero_ciclo: asignatura.numero_ciclo,
                linea_plan_id: asignatura.linea_plan_id,
                prerrequisito_asignatura_id:
                  asignatura.prerrequisito_asignatura_id,
              })),
              numero_ciclos: data.numero_ciclos,
              nombre_ciclo: data.tipo_ciclo,
            },
          })

          const resultadoParaRender = esRechazo(resultado)
            ? {
                ok: true as const,
                resultado: {
                  nombre: requestedLine[1].trim(),
                  color: null,
                  justificacion:
                    'Línea solicitada explícitamente por el usuario; la decisión de crearla queda en sus manos.',
                },
              }
            : resultado
          const propuestaLinea = resultadoParaRender as any
          propuestaLinea.resultado.nombre = requestedLine[1].trim()
          const content = esRechazo(resultado)
            ? resultado.rechazo.motivo
            : `Propongo la línea curricular “${propuestaLinea.resultado.nombre}”. ${propuestaLinea.resultado.justificacion ?? ''}`
          await create_plan_action_message({
            conversationId,
            content: payload.content,
            response: content,
            actionProposals: esRechazo(resultadoParaRender)
              ? []
              : [{ tipo: 'linea', ...propuestaLinea.resultado }],
          })
        } else {
          const cantidadPorTexto: Record<string, number> = {
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
          const cantidad = Math.min(
            cantidadPorTexto[requestedSubjectsCount ?? ''] ??
              Number(requestedSubjectsCount ?? 1),
            15,
          )
          const propuestas = await generate_subject_suggestions({
            plan_estudio_id: planId as any,
            enfoque: payload.content,
            cantidad_de_sugerencias: cantidad,
            sugerencias_conservadas: [],
          })
          await create_plan_action_message({
            conversationId,
            content: payload.content,
            response: `Preparé ${propuestas.length} propuestas para tu plan. Selecciona las que quieras crear.`,
            actionProposals: propuestas.map((propuesta) => ({
              ...propuesta,
              tipo: 'asignatura',
            })),
          })
        }
        await Promise.all([
          queryClient.invalidateQueries({
            queryKey: qk.planConversations(planId),
          }),
          queryClient.invalidateQueries({
            queryKey: qk.planMessages(conversationId),
          }),
        ])
        setIsSending(false)
        return
      }

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

      const planActualizado = await updatePlanAsync({
        planId: planId,
        patch: { datos: datosActualizados },
      })

      // Escribir la respuesta canónica evita depender de que el refetch termine
      // antes de que la ruta de Datos Generales vuelva a renderizar.
      queryClient.setQueryData(qk.plan(planId), planActualizado)

      // El chat y la ficha de datos generales comparten la consulta del plan.
      // Revalidarla aquí evita que la ficha conserve la versión anterior hasta
      // que el usuario recargue la página.
      await queryClient.invalidateQueries({
        queryKey: qk.plan(planId),
      })

      for (const sug of sugerencias) {
        await updateAppliedStatusAsync({
          mensajeId: dbMessageId,
          campoAfectado: sug.key,
          conversationId: activeChatId ?? undefined,
        })
        removeSelectedField(sug.key)
      }

      // El estado de la recomendación se actualiza después del guardado del
      // plan. Reconciliamos la consulta activa al final para que las rutas
      // hermanas (Datos Generales y el chat) reciban la misma versión.
      await queryClient.refetchQueries({
        queryKey: qk.plan(planId),
        type: 'active',
      })

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
        if (message.actionProposals?.length) {
          return (
            <ChatAgentActionCards
              proposals={message.actionProposals}
              estructuraId={estructuraAsignatura?.id ?? null}
              planId={planId}
              onCreateLine={async (proposal) => {
                const nuevaLinea = await crearLinea.mutateAsync({
                  plan_estudio_id: planId,
                  nombre: String(proposal.nombre),
                  orden:
                    Math.max(
                      -1,
                      ...(lineas ?? []).map((linea) => linea.orden),
                    ) + 1,
                  color:
                    typeof proposal.color === 'string' ? proposal.color : null,
                })
                const asignaturaParaLinea =
                  (asignaturas ?? []).find(
                    (asignatura: any) => !asignatura.linea_plan_id,
                  ) ?? asignaturas?.[0]
                if (asignaturaParaLinea) {
                  await actualizarAsignatura.mutateAsync({
                    asignaturaId: asignaturaParaLinea.id,
                    patch: { linea_plan_id: nuevaLinea.id },
                  })
                }
                notify.success(`Se creó la línea “${proposal.nombre}”.`)
              }}
              onDeleteLine={async (proposal) => {
                await eliminarLinea.mutateAsync({
                  lineaId: String(proposal.linea_plan_id),
                  planId: planId as any,
                })
                notify.success(
                  `Se eliminó la línea curricular “${proposal.linea_nombre}”.`,
                )
              }}
              onCreateSubject={async (proposal) => {
                if (!estructuraAsignatura?.id) {
                  throw new Error(
                    'Este plan no tiene plantilla de asignaturas.',
                  )
                }
                const requestedLine = String(
                  proposal.lineaCurricular ?? '',
                ).trim()
                const normalize = (value: string) =>
                  value
                    .normalize('NFD')
                    .replace(/\p{Diacritic}/gu, '')
                    .toLowerCase()
                    .trim()
                let lineaPlanId = (lineas ?? []).find(
                  (linea) =>
                    requestedLine &&
                    normalize(linea.nombre) === normalize(requestedLine),
                )?.id
                if (!lineaPlanId && requestedLine) {
                  const nuevaLinea = await crearLinea.mutateAsync({
                    plan_estudio_id: planId,
                    nombre: requestedLine,
                    orden:
                      Math.max(
                        -1,
                        ...(lineas ?? []).map((linea) => linea.orden),
                      ) + 1,
                    color: null,
                  })
                  lineaPlanId = nuevaLinea.id
                }
                await lanzarAsignatura.mutateAsync({
                  tempId: `chat-${crypto.randomUUID()}`,
                  placeholder: {
                    plan_estudio_id: planId,
                    estructura_id: estructuraAsignatura.id,
                    nombre: String(proposal.nombre),
                    codigo:
                      typeof proposal.codigo === 'string'
                        ? proposal.codigo
                        : null,
                    linea_plan_id: lineaPlanId ?? null,
                    tipo: [
                      'OBLIGATORIA',
                      'OPTATIVA',
                      'TRONCAL',
                      'OTRA',
                    ].includes(String(proposal.tipo))
                      ? (proposal.tipo as any)
                      : 'OTRA',
                    numero_ciclo:
                      typeof proposal.numeroCiclo === 'number'
                        ? proposal.numeroCiclo
                        : null,
                    horas_academicas:
                      typeof proposal.horasAcademicas === 'number'
                        ? proposal.horasAcademicas
                        : null,
                    horas_independientes:
                      typeof proposal.horasIndependientes === 'number'
                        ? proposal.horasIndependientes
                        : null,
                    tipo_origen: 'IA',
                  },
                  ia: {
                    descripcionEnfoqueAcademico: String(
                      proposal.descripcion ?? '',
                    ),
                  },
                })
                notify.success(`Se creó la asignatura “${proposal.nombre}”.`)
              }}
              onAssignSubject={async (proposal) => {
                await actualizarAsignatura.mutateAsync({
                  asignaturaId: String(proposal.asignatura_id),
                  patch: {
                    linea_plan_id: String(proposal.linea_plan_id),
                    ...(typeof proposal.numero_ciclo === 'number'
                      ? { numero_ciclo: proposal.numero_ciclo }
                      : {}),
                  },
                })
                notify.success(
                  `Se agregó “${proposal.asignatura_nombre}” a “${proposal.linea_nombre}”.`,
                )
              }}
              onMoveSubject={async (proposal) => {
                await actualizarAsignatura.mutateAsync({
                  asignaturaId: String(proposal.asignatura_id),
                  patch: { numero_ciclo: Number(proposal.numero_ciclo) },
                })
                notify.success(
                  `“${proposal.asignatura_nombre}” se movió al ${proposal.numero_ciclo}° semestre.`,
                )
              }}
            />
          )
        }
        if (!message.suggestions || message.suggestions.length === 0) {
          return null
        }

        const pending = message.suggestions.filter(
          (suggestion) => !suggestion.applied,
        )

        return (
          <div className="mt-control space-y-control w-full">
            {pending.length > 1 && message.dbMessageId && (
              <div className="flex justify-end">
                <Button
                  size="sm"
                  className="bg-primary text-primary-foreground hover:bg-primary/90 px-control h-7 text-[12px] shadow-none"
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

            <div className="space-y-control">
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

function ChatAgentActionCards({
  proposals,
  onCreateLine,
  onDeleteLine,
  onCreateSubject,
  onAssignSubject,
  onMoveSubject,
}: {
  proposals: Array<Record<string, unknown>>
  estructuraId: string | null
  planId: string
  onCreateLine: (proposal: Record<string, unknown>) => Promise<void>
  onDeleteLine: (proposal: Record<string, unknown>) => Promise<void>
  onCreateSubject: (proposal: Record<string, unknown>) => Promise<void>
  onAssignSubject: (proposal: Record<string, unknown>) => Promise<void>
  onMoveSubject: (proposal: Record<string, unknown>) => Promise<void>
}) {
  const [selected, setSelected] = useState(
    () => new Set(proposals.map((_, index) => index)),
  )
  const [creating, setCreating] = useState(false)
  const subjectProposals = proposals.filter(
    (proposal) => proposal.tipo === 'asignatura',
  )

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
        if (proposal.tipo === 'linea') await onCreateLine(proposal)
        else if (proposal.tipo === 'eliminar_linea')
          await onDeleteLine(proposal)
        else if (proposal.tipo === 'asignacion') await onAssignSubject(proposal)
        else if (proposal.tipo === 'cambio_ciclo') await onMoveSubject(proposal)
        else await onCreateSubject(proposal)
      }
      setSelected(new Set())
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="mt-3 w-full space-y-3">
      <div className="grid gap-2 sm:grid-cols-2">
        {proposals.map((proposal, index) => {
          const name =
            proposal.tipo === 'asignacion'
              ? `${String(proposal.asignatura_nombre ?? '')} → ${String(proposal.linea_nombre ?? '')}`
              : proposal.tipo === 'cambio_ciclo'
                ? `${String(proposal.asignatura_nombre ?? '')} → ${String(proposal.numero_ciclo ?? '')}° semestre`
                : proposal.tipo === 'eliminar_linea'
                  ? `Eliminar ${String(proposal.linea_nombre ?? '')}`
                  : String(proposal.nombre ?? '')
          return (
            <button
              key={`${name}-${index}`}
              type="button"
              aria-pressed={selected.has(index)}
              onClick={() => toggle(index)}
              className={`border-border bg-card rounded-xl border p-3 text-left transition-colors ${selected.has(index) ? 'border-primary bg-primary/5' : 'opacity-70'}`}
            >
              <div className="flex items-start justify-between gap-2">
                <span className="font-semibold">{name}</span>
                <span className="text-primary text-xs">
                  {selected.has(index) ? 'Seleccionada' : 'Seleccionar'}
                </span>
              </div>
              <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
                {String(
                  proposal.descripcion ??
                    proposal.justificacion ??
                    (proposal.tipo === 'asignacion'
                      ? 'Mover esta asignatura dentro del mapa curricular.'
                      : proposal.tipo === 'cambio_ciclo'
                        ? `Cambiar del ${String(proposal.ciclo_anterior ?? 'actual')}° al ${String(proposal.numero_ciclo ?? '')}° semestre.`
                        : proposal.tipo === 'eliminar_linea'
                          ? `${String(proposal.asignaturas_afectadas ?? 0)} ${Number(proposal.asignaturas_afectadas ?? 0) === 1 ? 'asignatura quedará' : 'asignaturas quedarán'} sin línea curricular. Esta acción no elimina asignaturas.`
                          : ''),
                )}
              </p>
            </button>
          )
        })}
      </div>
      {proposals.length > 0 && (
        <Button
          size="sm"
          disabled={creating || selected.size === 0}
          onClick={() => void createSelected()}
        >
          {creating
            ? 'Creando propuestas…'
            : subjectProposals.length > 0
              ? `Crear seleccionadas (${selected.size})`
              : proposals[0]?.tipo === 'asignacion'
                ? 'Mover asignatura'
                : proposals[0]?.tipo === 'eliminar_linea'
                  ? 'Eliminar línea curricular'
                  : proposals[0]?.tipo === 'cambio_ciclo'
                    ? 'Cambiar semestre'
                    : 'Crear línea curricular'}
        </Button>
      )}
    </div>
  )
}
