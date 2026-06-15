import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'

import {
  ai_plan_chat_v2,
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
} from '../api/ai.api'
import { supabaseBrowser } from '../supabase/client'

import type { UUID } from 'node:crypto'

export function useAIPlanImprove() {
  return useMutation({ mutationFn: ai_plan_improve })
}

export function useAIPlanChat() {
  return useMutation({
    mutationFn: async (payload: {
      planId: UUID
      content: string
      campos?: Array<string>
      conversacionId?: string
      archivosReferencia?: Array<string>
      repositoriosIds?: Array<string>
    }) => {
      let currentId = payload.conversacionId

      // 1. Si no hay ID, creamos la conversación
      if (!currentId) {
        const response = await create_conversation(payload.planId)
        currentId = response.conversation_plan.id
      }

      // 2. Ahora enviamos el mensaje con el ID garantizado
      const result = await ai_plan_chat_v2({
        conversacionId: currentId!,
        content: payload.content,
        campos: payload.campos,
        archivosReferencia: payload.archivosReferencia,
        repositoriosIds: payload.repositoriosIds,
      })

      // Retornamos el resultado del chat y el ID para el estado del componente
      return { ...result, conversacionId: currentId }
    },
  })
}

export function useChatHistory(conversacionId?: string) {
  return useQuery({
    queryKey: ['chat-history', conversacionId],
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
    onMutate: async (vars) => {
      if (!vars.planId) return {}

      await qc.cancelQueries({
        queryKey: ['conversation-by-plan', vars.planId],
      })
      const previousChats = qc.getQueryData([
        'conversation-by-plan',
        vars.planId,
      ])

      qc.setQueryData(['conversation-by-plan', vars.planId], (current: any) => {
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
          ['conversation-by-plan', context.planId],
          context.previousChats,
        )
      }
    },
    onSuccess: (_data, vars) => {
      if (vars.planId) {
        qc.invalidateQueries({
          queryKey: ['conversation-by-plan', vars.planId],
        })
      }
    },
  })
}

export function useConversationByPlan(planId: string | null) {
  return useQuery({
    queryKey: ['conversation-by-plan', planId],
    queryFn: () => getConversationByPlan(planId!),
    enabled: !!planId, // solo ejecuta si existe planId
  })
}

export function useMessagesByChat(conversationId: string | null) {
  const queryClient = useQueryClient()
  const supabase = supabaseBrowser()

  const query = useQuery({
    queryKey: ['conversation-messages', conversationId],
    queryFn: () => {
      if (!conversationId) throw new Error('Conversation ID is required')
      return getMessagesByConversation(conversationId)
    },
    enabled: !!conversationId,
    placeholderData: (previousData) => previousData,
  })

  useEffect(() => {
    if (!conversationId) return

    // Suscribirse a cambios en los mensajes de ESTA conversación
    const channel = supabase
      .channel(`realtime-messages-${conversationId}`)
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
            queryKey: ['conversation-messages', conversationId],
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

    onMutate: async (vars) => {
      if (!vars.conversationId) return {}

      await qc.cancelQueries({
        queryKey: ['conversation-messages', vars.conversationId],
      })
      const previousMessages = qc.getQueryData([
        'conversation-messages',
        vars.conversationId,
      ])

      qc.setQueryData(
        ['conversation-messages', vars.conversationId],
        (current: any) => {
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
        },
      )

      return { previousMessages, conversationId: vars.conversationId }
    },

    onError: (_error, _vars, context) => {
      if (context?.conversationId) {
        qc.setQueryData(
          ['conversation-messages', context.conversationId],
          context.previousMessages,
        )
      }
    },

    onSuccess: (_data, vars) => {
      if (vars.conversationId) {
        qc.invalidateQueries({
          queryKey: ['conversation-messages', vars.conversationId],
        })
      }
    },
  })
}

export function useAISubjectImprove() {
  return useMutation({ mutationFn: ai_subject_improve })
}

export function useLibrarySearch() {
  return useMutation({ mutationFn: library_search })
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
    onMutate: async (vars) => {
      if (!vars.planId) return {}

      await qc.cancelQueries({
        queryKey: ['conversation-by-plan', vars.planId],
      })
      const previousChats = qc.getQueryData([
        'conversation-by-plan',
        vars.planId,
      ])

      qc.setQueryData(['conversation-by-plan', vars.planId], (current: any) => {
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
          ['conversation-by-plan', context.planId],
          context.previousChats,
        )
      }
    },
    onSuccess: (_data, vars) => {
      if (vars.planId) {
        qc.invalidateQueries({
          queryKey: ['conversation-by-plan', vars.planId],
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
      archivosReferencia?: Array<string>
      repositoriosIds?: Array<string>
    }) => {
      let currentId = payload.conversacionId

      // 1. Si no hay ID, creamos la conversación de asignatura
      if (!currentId) {
        const response = await create_subject_conversation(payload.subjectId)
        currentId = response.conversation_asignatura.id
      }

      // 2. Enviamos mensaje al endpoint de asignatura
      const result = await ai_subject_chat_v2({
        conversacionId: currentId!,
        content: payload.content,
        campos: payload.campos,
        archivosReferencia: payload.archivosReferencia,
        repositoriosIds: payload.repositoriosIds,
      })

      return { ...result, conversacionId: currentId }
    },
    onSuccess: (data) => {
      // Invalidamos mensajes para que se refresque el chat
      qc.invalidateQueries({
        queryKey: ['subject-messages', data.conversacionId],
      })
    },
  })
}

export function useConversationBySubject(subjectId: string | null) {
  return useQuery({
    queryKey: ['conversation-by-subject', subjectId],
    queryFn: () => getConversationBySubject(subjectId!),
    enabled: !!subjectId,
  })
}

export function useMessagesBySubjectChat(conversationId: string | null) {
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ['subject-messages', conversationId],
    queryFn: async () => {
      if (!conversationId) throw new Error('Conversation ID is required')
      return getMessagesBySubjectConversation(conversationId)
    },
    enabled: !!conversationId,
  })

  useEffect(() => {
    if (!conversationId) return

    const supabase = supabaseBrowser()

    // Suscripción a cambios en la tabla específica para esta conversación
    const channel = supabase
      .channel(`subject_messages_${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE', // Solo nos interesan las actualizaciones (cuando pasa de PROCESANDO a COMPLETADO)
          schema: 'public',
          table: 'asignatura_mensajes_ia',
          filter: `conversacion_asignatura_id=eq.${conversationId}`,
        },
        (payload) => {
          // Si el mensaje se completó o dio error, invalidamos la caché para traer los datos nuevos
          if (
            payload.new.estado === 'COMPLETADO' ||
            payload.new.estado === 'ERROR'
          ) {
            queryClient.invalidateQueries({
              queryKey: ['subject-messages', conversationId],
            })
          }
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
    onSuccess: () => {
      // Refrescamos los mensajes para ver el check de "aplicado"
      qc.invalidateQueries({ queryKey: ['subject-messages'] })
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
    onMutate: async (vars) => {
      if (!vars.subjectId) return {}

      await qc.cancelQueries({
        queryKey: ['conversation-by-subject', vars.subjectId],
      })
      const previousChats = qc.getQueryData([
        'conversation-by-subject',
        vars.subjectId,
      ])

      qc.setQueryData(
        ['conversation-by-subject', vars.subjectId],
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
          ['conversation-by-subject', context.subjectId],
          context.previousChats,
        )
      }
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({
        queryKey: vars.subjectId
          ? ['conversation-by-subject', vars.subjectId]
          : ['conversation-by-subject'],
      })
    },
  })
}

export function useUpdateSubjectConversationName() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: (payload: { id: string; nombre: string; subjectId?: string }) =>
      update_subject_conversation_name(payload.id, payload.nombre),
    onMutate: async (vars) => {
      if (!vars.subjectId) return {}

      await qc.cancelQueries({
        queryKey: ['conversation-by-subject', vars.subjectId],
      })
      const previousChats = qc.getQueryData([
        'conversation-by-subject',
        vars.subjectId,
      ])

      qc.setQueryData(
        ['conversation-by-subject', vars.subjectId],
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
          ['conversation-by-subject', context.subjectId],
          context.previousChats,
        )
      }
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({
        queryKey: vars.subjectId
          ? ['conversation-by-subject', vars.subjectId]
          : ['conversation-by-subject'],
      })
      // También invalidamos los mensajes si el título se muestra en la cabecera
      qc.invalidateQueries({ queryKey: ['subject-messages'] })
    },
  })
}
