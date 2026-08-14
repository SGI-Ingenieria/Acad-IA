import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'

import {
  ai_plan_chat_v2,
  ai_improve_field,
  ai_plan_improve,
  ai_subject_improve,
  create_conversation,
  get_chat_history,
  getConversationByPlan,
  library_search,
  update_conversation_status,
  update_recommendation_applied_status,
  update_conversation_title,
  getMessagesByConversation,
  update_subject_conversation_status,
  update_subject_recommendation_applied,
  getMessagesBySubjectConversation,
  getConversationBySubject,
  ai_subject_chat_v2,
  create_subject_conversation,
  update_subject_conversation_name,
  expireStalePlanChatMessages,
  expireStaleSubjectChatMessages,
} from '../api/ai.api'
import { openai_response_status } from '../api/openaiResponses.api'
import { mk, qk } from '../query/keys'
import { freshChannel } from '../realtime/freshChannel'
import { supabaseBrowser } from '../supabase/client'

import type { UUID } from 'node:crypto'

import { isActiveChatMessageGeneration } from '@/lib/chat-generation-state'

type ReasoningEffort = 'auto' | 'none' | 'low' | 'medium' | 'high'

function hasActiveChatMessageGeneration(data: unknown) {
  if (!Array.isArray(data)) return false

  return data.some((message: any) => isActiveChatMessageGeneration(message))
}

async function reconcileActiveChatMessages(
  data: unknown,
  kind: 'plan-chat' | 'subject-chat',
) {
  if (!Array.isArray(data)) return false
  const active = data.filter(
    (message: any) =>
      ['PROCESANDO', 'PENDIENTE'].includes(String(message?.estado ?? '')) &&
      typeof message?.id === 'string' &&
      typeof message?.openai_response_id === 'string',
  )
  if (!active.length) return false

  const results = await Promise.all(
    active.map(async (message: any) => {
      try {
        return await openai_response_status({
          kind,
          entityId: message.id,
          responseId: message.openai_response_id,
        })
      } catch (error) {
        console.warn('[useAI] No se pudo reconciliar un mensaje activo:', error)
        return null
      }
    }),
  )
  return results.some(
    (result) =>
      result?.resolution === 'applied' ||
      result?.resolution === 'already_applied' ||
      result?.resolution === 'stale',
  )
}

export function useAIPlanImprove() {
  return useMutation({
    mutationFn: ai_plan_improve,
    // Sin consumidores que avisen: el toast lo pone la red global.
    meta: { errorMessage: 'No se pudo generar la mejora del plan con IA.' },
  })
}

export function useAIImproveField() {
  return useMutation({
    mutationFn: ai_improve_field,
    // IACampoPanel y CampoCanvasCard capturan el error y notifican ellos.
    meta: { errorMessage: false },
  })
}

export function useAIPlanChat() {
  return useMutation({
    mutationFn: async (payload: {
      planId: UUID
      content: string
      campos?: Array<string>
      conversacionId?: string
      references?: {
        fileIds?: Array<string>
        collectionIds?: Array<string>
      }
      mentions?: Array<{ sourceMessageId: string; excerpt: string }>
      webSearchEnabled?: boolean
      reasoningEffort?: ReasoningEffort
      retryOfMessageId?: string
    }) => {
      let currentId = payload.conversacionId

      if (payload.retryOfMessageId && !currentId) {
        throw new Error(
          'No se puede reintentar un mensaje sin una conversación activa.',
        )
      }

      // 1. Si no hay ID, creamos la conversación
      if (!currentId) {
        const response = await create_conversation(
          payload.planId,
          payload.content,
          payload.campos,
        )
        currentId = response.conversation_plan.id
      }

      // 2. Ahora enviamos el mensaje con el ID garantizado
      const result = await ai_plan_chat_v2({
        conversacionId: currentId!,
        content: payload.content,
        mentions: payload.mentions,
        campos: payload.campos,
        references: payload.references,
        webSearchEnabled: payload.webSearchEnabled,
        reasoningEffort: payload.reasoningEffort,
        retryOfMessageId: payload.retryOfMessageId,
      })

      // Retornamos el resultado del chat y el ID para el estado del componente
      return { ...result, conversacionId: currentId }
    },
    // AIChatWorkspace captura el fallo de envío y notifica con su propio toast.
    meta: { errorMessage: false },
  })
}

export function useChatHistory(conversacionId?: string) {
  return useQuery({
    queryKey: qk.planChatHistory(conversacionId),
    queryFn: async () => {
      return get_chat_history(conversacionId!)
    },
    enabled: Boolean(conversacionId),
  })
}

export function useUpdateConversationStatus() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: ({
      id,
      estado,
      planId: _planId,
    }: {
      id: string
      estado: 'ARCHIVADA' | 'ACTIVA'
      planId?: string
    }) => update_conversation_status(id, estado),
    mutationKey: mk.conversacionEstado(),
    // AIChatWorkspace gestiona el aviso (toast con "Deshacer" y restauración
    // de su snapshot local); aquí solo se hace el rollback de caché.
    meta: { errorMessage: false },
    onMutate: async (vars) => {
      if (!vars.planId) return {}

      await qc.cancelQueries({
        queryKey: qk.planConversations(vars.planId),
      })
      const previousChats = qc.getQueryData(qk.planConversations(vars.planId))

      qc.setQueryData(qk.planConversations(vars.planId), (current: any) => {
        if (!Array.isArray(current)) return current

        return current.map((chat) =>
          chat.id === vars.id ? { ...chat, estado: vars.estado } : chat,
        )
      })

      return { previousChats, planId: vars.planId }
    },
    onError: (_error, _vars, context) => {
      if (context?.planId) {
        qc.setQueryData(
          qk.planConversations(context.planId),
          context.previousChats,
        )
      }
    },
    onSuccess: (_data, vars) => {
      if (vars.planId) {
        qc.invalidateQueries({
          queryKey: qk.planConversations(vars.planId),
        })
      }
    },
  })
}

export function useConversationByPlan(planId: string | null) {
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: qk.planConversations(planId),
    queryFn: () => getConversationByPlan(planId!),
    enabled: !!planId, // solo ejecuta si existe planId
  })

  useEffect(() => {
    if (!planId) return

    const supabase = supabaseBrowser()
    const channel = freshChannel(supabase, `plan-conversations-${planId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'conversaciones_plan',
          filter: `plan_estudio_id=eq.${planId}`,
        },
        () => {
          queryClient.invalidateQueries({
            queryKey: qk.planConversations(planId),
          })
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [planId, queryClient])

  return query
}

export function useMessagesByChat(conversationId: string | null) {
  const queryClient = useQueryClient()
  const supabase = supabaseBrowser()

  const query = useQuery({
    queryKey: qk.planMessages(conversationId),
    queryFn: async () => {
      if (!conversationId) throw new Error('Conversation ID is required')
      let messages = await getMessagesByConversation(conversationId)
      try {
        if (await expireStalePlanChatMessages(messages)) {
          messages = await getMessagesByConversation(conversationId)
        }
      } catch (error) {
        console.warn('[useAI] No se pudo cerrar un mensaje huérfano:', error)
      }
      const shouldRefresh = await reconcileActiveChatMessages(
        messages,
        'plan-chat',
      )
      return shouldRefresh
        ? await getMessagesByConversation(conversationId)
        : messages
    },
    enabled: !!conversationId,
    refetchInterval: (queryInfo) =>
      hasActiveChatMessageGeneration(queryInfo.state.data) ? 5000 : false,
  })

  useEffect(() => {
    if (!conversationId) return

    // Suscribirse a cambios en los mensajes de ESTA conversación
    const channel = freshChannel(
      supabase,
      `realtime-messages-${conversationId}`,
    )
      .on(
        'postgres_changes',
        {
          event: '*', // Escuchamos INSERT y UPDATE
          schema: 'public',
          table: 'plan_mensajes_ia',
          filter: `conversacion_plan_id=eq.${conversationId}`,
        },
        (_payload) => {
          // Opción A: Invalidar la query para que React Query haga refetch (más seguro)
          queryClient.invalidateQueries({
            queryKey: qk.planMessages(conversationId),
          })

          /* Opción B: Actualización manual del caché (más rápido/fluido)
             if (payload.eventType === 'INSERT') {
               queryClient.setQueryData(['conversation-messages', conversationId], (old: any) => [...old, payload.new])
             } else if (payload.eventType === 'UPDATE') {
               queryClient.setQueryData(['conversation-messages', conversationId], (old: any) => 
                 old.map((m: any) => m.id === payload.new.id ? payload.new : m)
               )
             }
          */
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [conversationId, queryClient, supabase])

  return query
}

export function useUpdateRecommendationApplied() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: ({
      mensajeId,
      campoAfectado,
      conversationId: _conversationId,
    }: {
      mensajeId: string
      campoAfectado: string
      conversationId?: string
    }) => update_recommendation_applied_status(mensajeId, campoAfectado),
    mutationKey: mk.recomendacionAplicada(),
    // Rollback manual abajo; el toast lo pone la red global.
    meta: {
      errorMessage: 'No se pudo marcar la recomendación como aplicada.',
    },

    onMutate: async (vars) => {
      if (!vars.conversationId) return {}

      await qc.cancelQueries({
        queryKey: qk.planMessages(vars.conversationId),
      })
      const previousMessages = qc.getQueryData(
        qk.planMessages(vars.conversationId),
      )

      qc.setQueryData(qk.planMessages(vars.conversationId), (current: any) => {
        if (!Array.isArray(current)) return current

        return current.map((msg: any) => {
          if (msg.id !== vars.mensajeId) return msg

          const proposal = msg.propuesta
          if (!proposal?.recommendations) return msg

          return {
            ...msg,
            propuesta: {
              ...proposal,
              recommendations: proposal.recommendations.map((rec: any) =>
                rec.campo_afectado === vars.campoAfectado
                  ? { ...rec, aplicada: true }
                  : rec,
              ),
            },
          }
        })
      })

      return { previousMessages, conversationId: vars.conversationId }
    },

    onError: (_error, _vars, context) => {
      if (context?.conversationId) {
        qc.setQueryData(
          qk.planMessages(context.conversationId),
          context.previousMessages,
        )
      }
    },

    onSuccess: (_data, vars) => {
      if (vars.conversationId) {
        qc.invalidateQueries({
          queryKey: qk.planMessages(vars.conversationId),
        })
      }
    },
  })
}

export function useAISubjectImprove() {
  return useMutation({
    mutationFn: ai_subject_improve,
    // Sin consumidores que avisen: el toast lo pone la red global.
    meta: {
      errorMessage: 'No se pudo generar la mejora de la asignatura con IA.',
    },
  })
}

export function useLibrarySearch() {
  return useMutation({
    mutationFn: library_search,
    // Sin consumidores que avisen: el toast lo pone la red global.
    meta: { errorMessage: 'No se pudo buscar en la biblioteca.' },
  })
}

export function useUpdateConversationTitle() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: ({
      id,
      nombre,
      planId: _planId,
    }: {
      id: string
      nombre: string
      planId?: string
    }) => update_conversation_title(id, nombre),
    mutationKey: mk.conversacionTitulo(),
    // AIChatWorkspace gestiona el aviso del renombrado (toast con "Deshacer");
    // aquí solo se hace el rollback de caché.
    meta: { errorMessage: false },
    onMutate: async (vars) => {
      if (!vars.planId) return {}

      await qc.cancelQueries({
        queryKey: qk.planConversations(vars.planId),
      })
      const previousChats = qc.getQueryData(qk.planConversations(vars.planId))

      qc.setQueryData(qk.planConversations(vars.planId), (current: any) => {
        if (!Array.isArray(current)) return current

        return current.map((chat) =>
          chat.id === vars.id ? { ...chat, nombre: vars.nombre } : chat,
        )
      })

      return { previousChats, planId: vars.planId }
    },
    onError: (_error, _vars, context) => {
      if (context?.planId) {
        qc.setQueryData(
          qk.planConversations(context.planId),
          context.previousChats,
        )
      }
    },
    onSuccess: (_data, vars) => {
      if (vars.planId) {
        qc.invalidateQueries({
          queryKey: qk.planConversations(vars.planId),
        })
      }
    },
  })
}

// Asignaturas

export function useAISubjectChat() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (payload: {
      subjectId: UUID
      content: string
      campos?: Array<string>
      conversacionId?: string
      references?: {
        fileIds?: Array<string>
        collectionIds?: Array<string>
      }
      mentions?: Array<{ sourceMessageId: string; excerpt: string }>
      webSearchEnabled?: boolean
      reasoningEffort?: ReasoningEffort
      retryOfMessageId?: string
    }) => {
      let currentId = payload.conversacionId

      if (payload.retryOfMessageId && !currentId) {
        throw new Error(
          'No se puede reintentar un mensaje sin una conversación activa.',
        )
      }

      // 1. Si no hay ID, creamos la conversación de asignatura
      if (!currentId) {
        const response = await create_subject_conversation(
          payload.subjectId,
          payload.content,
          payload.campos,
        )
        currentId = response.conversation_asignatura.id
      }

      // 2. Enviamos mensaje al endpoint de asignatura
      const result = await ai_subject_chat_v2({
        conversacionId: currentId!,
        content: payload.content,
        mentions: payload.mentions,
        campos: payload.campos,
        references: payload.references,
        webSearchEnabled: payload.webSearchEnabled,
        reasoningEffort: payload.reasoningEffort,
        retryOfMessageId: payload.retryOfMessageId,
      })

      return { ...result, conversacionId: currentId }
    },
    // AIChatWorkspace captura el fallo de envío y notifica con su propio toast.
    meta: { errorMessage: false },
    onSuccess: (data) => {
      // Invalidamos mensajes para que se refresque el chat
      qc.invalidateQueries({
        queryKey: qk.subjectMessages(data.conversacionId),
      })
    },
  })
}

export function useConversationBySubject(subjectId: string | null) {
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: qk.subjectConversations(subjectId),
    queryFn: () => getConversationBySubject(subjectId!),
    enabled: !!subjectId,
  })

  useEffect(() => {
    if (!subjectId) return

    const supabase = supabaseBrowser()
    const channel = freshChannel(supabase, `subject-conversations-${subjectId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'conversaciones_asignatura',
          filter: `asignatura_id=eq.${subjectId}`,
        },
        () => {
          queryClient.invalidateQueries({
            queryKey: qk.subjectConversations(subjectId),
          })
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [subjectId, queryClient])

  return query
}

export function useMessagesBySubjectChat(conversationId: string | null) {
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: qk.subjectMessages(conversationId),
    queryFn: async () => {
      if (!conversationId) throw new Error('Conversation ID is required')
      let messages = await getMessagesBySubjectConversation(conversationId)
      try {
        if (await expireStaleSubjectChatMessages(messages)) {
          messages = await getMessagesBySubjectConversation(conversationId)
        }
      } catch (error) {
        console.warn('[useAI] No se pudo cerrar un mensaje huérfano:', error)
      }
      const shouldRefresh = await reconcileActiveChatMessages(
        messages,
        'subject-chat',
      )
      return shouldRefresh
        ? await getMessagesBySubjectConversation(conversationId)
        : messages
    },
    enabled: !!conversationId,
    refetchInterval: (queryInfo) =>
      hasActiveChatMessageGeneration(queryInfo.state.data) ? 5000 : false,
  })

  useEffect(() => {
    if (!conversationId) return

    const supabase = supabaseBrowser()

    // Suscripción a cambios en la tabla específica para esta conversación
    const channel = freshChannel(supabase, `subject_messages_${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'asignatura_mensajes_ia',
          filter: `conversacion_asignatura_id=eq.${conversationId}`,
        },
        () => {
          queryClient.invalidateQueries({
            queryKey: qk.subjectMessages(conversationId),
          })
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [conversationId, queryClient])

  return query
}

export function useUpdateSubjectRecommendation() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: (payload: { mensajeId: string; campoAfectado: string }) =>
      update_subject_recommendation_applied(
        payload.mensajeId,
        payload.campoAfectado,
      ),
    mutationKey: mk.recomendacionAplicada(),
    // ImprovementCard dispara esta mutación sin capturar el error: el toast
    // de la red global es el único aviso.
    meta: {
      errorMessage: 'No se pudo marcar la recomendación como aplicada.',
    },
    onSuccess: () => {
      // Refrescamos los mensajes para ver el check de "aplicado"
      qc.invalidateQueries({ queryKey: qk.subjectMessagesRoot() })
    },
  })
}

export function useUpdateSubjectConversationStatus() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: (payload: {
      id: string
      estado: 'ARCHIVADA' | 'ACTIVA'
      subjectId?: string
    }) => update_subject_conversation_status(payload.id, payload.estado),
    mutationKey: mk.conversacionEstado(),
    // AIChatWorkspace gestiona el aviso (toast con "Deshacer" y restauración
    // de su snapshot local); aquí solo se hace el rollback de caché.
    meta: { errorMessage: false },
    onMutate: async (vars) => {
      if (!vars.subjectId) return {}

      await qc.cancelQueries({
        queryKey: qk.subjectConversations(vars.subjectId),
      })
      const previousChats = qc.getQueryData(
        qk.subjectConversations(vars.subjectId),
      )

      qc.setQueryData(
        qk.subjectConversations(vars.subjectId),
        (current: any) => {
          if (!Array.isArray(current)) return current

          return current.map((chat) =>
            chat.id === vars.id ? { ...chat, estado: vars.estado } : chat,
          )
        },
      )

      return { previousChats, subjectId: vars.subjectId }
    },
    onError: (_error, _vars, context) => {
      if (context?.subjectId) {
        qc.setQueryData(
          qk.subjectConversations(context.subjectId),
          context.previousChats,
        )
      }
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({
        queryKey: vars.subjectId
          ? qk.subjectConversations(vars.subjectId)
          : qk.subjectConversationsRoot(),
      })
    },
  })
}

export function useUpdateSubjectConversationName() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: (payload: { id: string; nombre: string; subjectId?: string }) =>
      update_subject_conversation_name(payload.id, payload.nombre),
    mutationKey: mk.conversacionTitulo(),
    // AIChatWorkspace gestiona el aviso del renombrado (toast con "Deshacer");
    // aquí solo se hace el rollback de caché.
    meta: { errorMessage: false },
    onMutate: async (vars) => {
      if (!vars.subjectId) return {}

      await qc.cancelQueries({
        queryKey: qk.subjectConversations(vars.subjectId),
      })
      const previousChats = qc.getQueryData(
        qk.subjectConversations(vars.subjectId),
      )

      qc.setQueryData(
        qk.subjectConversations(vars.subjectId),
        (current: any) => {
          if (!Array.isArray(current)) return current

          return current.map((chat) =>
            chat.id === vars.id ? { ...chat, nombre: vars.nombre } : chat,
          )
        },
      )

      return { previousChats, subjectId: vars.subjectId }
    },
    onError: (_error, _vars, context) => {
      if (context?.subjectId) {
        qc.setQueryData(
          qk.subjectConversations(context.subjectId),
          context.previousChats,
        )
      }
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({
        queryKey: vars.subjectId
          ? qk.subjectConversations(vars.subjectId)
          : qk.subjectConversationsRoot(),
      })
      // También invalidamos los mensajes si el título se muestra en la cabecera
      qc.invalidateQueries({ queryKey: qk.subjectMessagesRoot() })
    },
  })
}
