/* eslint-disable jsx-a11y/click-events-have-key-events */
/* eslint-disable jsx-a11y/no-static-element-interactions */
import { useQueryClient } from '@tanstack/react-query'
import { createFileRoute, useRouterState } from '@tanstack/react-router'
import {
  Send,
  Target,
  Lightbulb,
  FileText,
  GraduationCap,
  BookOpen,
  Check,
  X,
  MessageSquarePlus,
  Archive,
  Loader2,
  Sparkles,
  RotateCcw,
} from 'lucide-react'
import { useState, useEffect, useRef, useMemo } from 'react'

import type { UploadedFile } from '@/components/planes/wizard/PasoDetallesPanel/FileDropZone'

import { ImprovementCard } from '@/components/planes/detalle/Ia/ImprovementCard'
import ReferenciasParaIA from '@/components/planes/wizard/PasoDetallesPanel/ReferenciasParaIA'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Drawer, DrawerContent } from '@/components/ui/drawer'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Textarea } from '@/components/ui/textarea'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  useAIPlanChat,
  useConversationByPlan,
  useMessagesByChat,
  useUpdateConversationStatus,
  useUpdateConversationTitle,
  useUpdatePlanFields,
  useUpdateRecommendationApplied,
} from '@/data'
import { usePlan } from '@/data/hooks/usePlans'

const PRESETS = [
  {
    id: 'objetivo',
    label: 'Mejorar objetivo general',
    icon: Target,
    prompt: 'Mejora la redacción del objetivo general...',
  },
  {
    id: 'perfil-egreso',
    label: 'Redactar perfil de egreso',
    icon: GraduationCap,
    prompt: 'Genera un perfil de egreso detallado...',
  },
  {
    id: 'competencias',
    label: 'Sugerir competencias',
    icon: BookOpen,
    prompt: 'Genera una lista de competencias...',
  },
  {
    id: 'pertinencia',
    label: 'Justificar pertinencia',
    icon: FileText,
    prompt: 'Redacta una justificación de pertinencia...',
  },
]

// --- Tipado y Helpers ---
interface SelectedField {
  key: string
  label: string
  value: string
}
interface EstructuraDefinicion {
  properties?: {
    [key: string]: {
      title: string
      description?: string
    }
  }
}
interface ChatMessageJSON {
  user: 'user' | 'assistant'
  message?: string
  prompt?: string
  refusal?: boolean
  recommendations?: Array<{
    campo_afectado: string
    texto_mejora: string
    aplicada: boolean
  }>
}
export const Route = createFileRoute('/planes/$planId/_detalle/iaplan')({
  component: RouteComponent,
})

function RouteComponent() {
  const { planId } = Route.useParams()
  const { data } = usePlan(planId)
  const routerState = useRouterState()
  const [openIA, setOpenIA] = useState(false)
  const { mutateAsync: sendChat, isPending: isLoading } = useAIPlanChat()
  const { mutate: updateStatusMutation } = useUpdateConversationStatus()
  const [isSyncing, setIsSyncing] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const isBusy = isSending || isSyncing
  const [activeChatId, setActiveChatId] = useState<string | undefined>(
    undefined,
  )
  const { data: lastConversation, isLoading: isLoadingConv } =
    useConversationByPlan(planId)
  const { data: mensajesDelChat, isLoading: isLoadingMessages } =
    useMessagesByChat(activeChatId ?? null)
  const [selectedArchivoIds, setSelectedArchivoIds] = useState<Array<string>>(
    [],
  )
  const [selectedRepositorioIds, setSelectedRepositorioIds] = useState<
    Array<string>
  >([])
  const [uploadedFiles, setUploadedFiles] = useState<Array<UploadedFile>>([])

  const [messages, setMessages] = useState<Array<any>>([])
  const [input, setInput] = useState('')
  const [selectedFields, setSelectedFields] = useState<Array<SelectedField>>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [pendingSuggestion, setPendingSuggestion] = useState<any>(null)
  const queryClient = useQueryClient()
  const scrollRef = useRef<HTMLDivElement>(null)
  const isInitialLoad = useRef(true)
  const [showArchived, setShowArchived] = useState(false)
  const [editingChatId, setEditingChatId] = useState<string | null>(null)
  const editableRef = useRef<HTMLSpanElement>(null)
  const { mutate: updateTitleMutation } = useUpdateConversationTitle()  
  const [optimisticMessage, setOptimisticMessage] = useState<string | null>(
    null,
  )
  const [filterQuery, setFilterQuery] = useState('')

  const [isHistoryOpen, setIsHistoryOpen] = useState(false)
  const [isActionsOpen, setIsActionsOpen] = useState(false)

  const [selectedImprovements, setSelectedImprovements] = useState<
    Array<string>
  >([])
  const updatePlan = useUpdatePlanFields()
  const updateAppliedStatus = useUpdateRecommendationApplied()

  const availableFields = useMemo(() => {
    const definicion = data?.estructuras_plan
      ?.definicion as EstructuraDefinicion

    if (!definicion?.properties) return []

    return Object.entries(definicion.properties).map(([key, value]) => ({
      key,
      label: value.title,
      value: String(value.description || ''),
    }))
  }, [data])

  const filteredFields = useMemo(() => {
    return availableFields.filter(
      (field) =>
        field.label.toLowerCase().includes(filterQuery.toLowerCase()) &&
        !selectedFields.some((s) => s.key === field.key),
    )
  }, [availableFields, filterQuery, selectedFields])

  const chatMessages = useMemo(() => {
    if (!activeChatId || !mensajesDelChat) return []

    return mensajesDelChat.flatMap((msg: any) => {
      const messages = []

      messages.push({
        id: `${msg.id}-user`,
        role: 'user',
        content: msg.mensaje,
        selectedFields: msg.campos || [],
      })

      if (msg.respuesta) {
        const rawRecommendations = msg.propuesta?.recommendations || []

        messages.push({
          id: `${msg.id}-ai`,
          dbMessageId: msg.id,
          role: 'assistant',
          content: msg.respuesta,
          isRefusal: msg.is_refusal,
          suggestions: rawRecommendations.map((rec: any) => {
            const fieldConfig = availableFields.find(
              (f) => f.key === rec.campo_afectado,
            )
            return {
              key: rec.campo_afectado,
              label: fieldConfig
                ? fieldConfig.label
                : rec.campo_afectado.replace(/_/g, ' '),
              newValue: rec.texto_mejora,
              applied: rec.aplicada,
            }
          }),
        })
      }

      return messages
    })
  }, [mensajesDelChat, activeChatId, availableFields])

  const handleApplyMultiple = async (
    sugerencias: Array<any>,
    dbMessageId: string,
  ) => {
    if (!planId || !data?.datos || sugerencias.length === 0) return

    setIsSending(true)
    try {
      const datosActualizados = { ...data.datos }

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

      await updatePlan.mutateAsync({
        planId: planId as any,
        patch: { datos: datosActualizados },
      })

      for (const sug of sugerencias) {
        try {
          await updateAppliedStatus.mutateAsync({
            conversacionId: dbMessageId,
            campoAfectado: sug.key,
          })
          removeSelectedField(sug.key)
        } catch (err) {
          console.error(
            `Error al marcar aplicada la sugerencia: ${sug.key}`,
            err,
          )
        }
      }

      setSelectedImprovements([])
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['plan', planId] }),
        queryClient.invalidateQueries({ queryKey: ['conversation-messages'] }),
      ])
    } catch (error) {
      console.error('Error crítico en aplicación masiva:', error)
    } finally {
      setIsSending(false)
    }
  }

  const toggleImprovementSelection = (sugKey: string) => {
    setSelectedImprovements((prev) =>
      prev.includes(sugKey)
        ? prev.filter((key) => key !== sugKey)
        : [...prev, sugKey],
    )
  }

  const toggleAllFromMessage = (suggestions: Array<any>) => {
    const pending = suggestions.filter((s) => !s.applied)
    const allKeys = pending.map((s) => s.key)
    const allSelected = allKeys.every((key) =>
      selectedImprovements.includes(key),
    )

    if (allSelected) {
      setSelectedImprovements((prev) =>
        prev.filter((key) => !allKeys.includes(key)),
      )
    } else {
      setSelectedImprovements((prev) =>
        Array.from(new Set([...prev, ...allKeys])),
      )
    }
  }

  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    if (scrollRef.current) {
      const scrollContainer = scrollRef.current.querySelector(
        '[data-radix-scroll-area-viewport]',
      )
      if (scrollContainer) {
        scrollContainer.scrollTo({
          top: scrollContainer.scrollHeight,
          behavior,
        })
      }
    }
  }

  const { activeChats, archivedChats } = useMemo(() => {
    const allChats = lastConversation || []
    return {
      activeChats: allChats.filter((chat: any) => chat.estado === 'ACTIVA'),
      archivedChats: allChats.filter(
        (chat: any) => chat.estado === 'ARCHIVADA',
      ),
    }
  }, [lastConversation])

  useEffect(() => {
    if (chatMessages.length > 0) {
      if (isInitialLoad.current) {
        scrollToBottom('instant')
        isInitialLoad.current = false
      } else {
        scrollToBottom('smooth')
      }
    }
  }, [chatMessages])

  useEffect(() => {
    isInitialLoad.current = true
  }, [activeChatId])

  useEffect(() => {
    if (isLoadingConv || isSending) return

    const currentChatExists = activeChats.some(
      (chat) => chat.id === activeChatId,
    )
    const isCreationMode = messages.length === 1 && messages[0].id === 'welcome'

    if (activeChatId && !currentChatExists && !isCreationMode) {
      setActiveChatId(undefined)
      setMessages([])
      return
    }

    if (
      !activeChatId &&
      activeChats.length > 0 &&
      !isCreationMode &&
      chatMessages.length === 0
    ) {
      setActiveChatId(activeChats[0].id)
    }
  }, [
    activeChats,
    activeChatId,
    isLoadingConv,
    isSending,
    messages.length,
    chatMessages.length,
    messages,
  ])

 const [initialized, setInitialized] = useState(false)
useEffect(() => {
  if (initialized) return

  const state = routerState.location.state as any

  if (!state?.campo_edit) {
    setInitialized(true)
    return
  }

  const field = availableFields.find(
    (f) =>
      f.value === state.campo_edit || f.key === state.campo_edit,
  )

  if (!field) {
    setInitialized(true)
    return
  }

  setSelectedFields([field])
  setInput(injectFieldsIntoInput('Mejora este campo:', [field]))
  setInitialized(true)
}, [availableFields, routerState.location.state, initialized])


  const createNewChat = () => {
    setActiveChatId(undefined)
    setMessages([
      {
        id: 'welcome',
        role: 'assistant',
        content: 'Iniciando una nueva conversación. ¿En qué puedo ayudarte?',
      },
    ])
    setInput('')
  }

  const archiveChat = (e: React.MouseEvent, id: string) => {
    e.stopPropagation()

    updateStatusMutation(
      { id, estado: 'ARCHIVADA' },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({
            queryKey: ['conversation-by-plan', planId],
          })

          if (activeChatId === id) {
            setActiveChatId(undefined)
            setMessages([])
            setOptimisticMessage(null)
            setInput('')
            setSelectedFields([])
          }
        },
      },
    )
  }
  const unarchiveChat = (e: React.MouseEvent, id: string) => {
    e.stopPropagation()

    updateStatusMutation(
      { id, estado: 'ACTIVA' },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({
            queryKey: ['conversation-by-plan', planId],
          })
        },
      },
    )
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value
    const cursorPosition = e.target.selectionStart
    setInput(val)

    const textBeforeCursor = val.slice(0, cursorPosition)
    const match = textBeforeCursor.match(/:(\w*)$/)

    if (match) {
      setShowSuggestions(true)
      setFilterQuery(match[1])
    } else {
      setShowSuggestions(false)
      setFilterQuery('')
    }
  }

  const injectFieldsIntoInput = (
    input: string,
    fields: Array<SelectedField>,
  ) => {
    const cleaned = input.replace(/[:\s]+[^:]*$/, '').trim()

    if (fields.length === 0) return cleaned

    const fieldLabels = fields.map((f) => f.label).join(', ')
    return `${cleaned}: ${fieldLabels}`
  }

  const toggleField = (field: SelectedField) => {
    setSelectedFields((prev) => {
      const isSelected = prev.find((f) => f.key === field.key)
      return isSelected ? prev : [...prev, field]
    })

    setInput((prev) => {
      const nuevoTexto = prev.replace(/:(\w*)$/, field.label)
      return nuevoTexto + ' '
    })

    setShowSuggestions(false)
    setFilterQuery('')
  }

  const buildPrompt = (userInput: string, fields: Array<SelectedField>) => {
    if (fields.length === 0) return userInput
    return ` ${userInput}`
  }

  const handleSend = async (promptOverride?: string) => {
    const rawText = promptOverride || input
    if (isBusy || (!rawText.trim() && selectedFields.length === 0)) return

    const currentFields = [...selectedFields]
    const finalContent = buildPrompt(rawText, currentFields)
    setIsSending(true)
    setOptimisticMessage(finalContent)
    setInput('')

    try {
      // Construir lista de archivosReferencia: union de selectedArchivoIds + openaiFileId de uploadedFiles
      const openaiFileIdsFromUploads = uploadedFiles
        .map((a) => a.openaiFileId)
        .filter((x): x is string => Boolean(x))

      const archivosReferencia = Array.from(
        new Set([...(selectedArchivoIds || []), ...openaiFileIdsFromUploads]),
      )

      const payload = {
        planId: planId as any,
        content: finalContent,
        conversacionId: activeChatId,
        campos:
          currentFields.length > 0
            ? currentFields.map((f) => f.key)
            : undefined,
        archivosReferencia,
        repositoriosIds: selectedRepositorioIds || [],
      }

      const response = await sendChat(payload)
      setIsSyncing(true)
      if (response.conversacionId && response.conversacionId !== activeChatId) {
        setActiveChatId(response.conversacionId)
      }

      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ['conversation-by-plan', planId],
        }),
        queryClient.invalidateQueries({
          queryKey: ['conversation-messages', response.conversacionId],
        }),
      ])
    } catch (error) {
      console.error('Error:', error)
      setOptimisticMessage(null)
    } finally {
      //setIsSending(false)
    }
  }

  useEffect(() => {
  if (!isSyncing || !mensajesDelChat || mensajesDelChat.length === 0) return

  const ultimoMensajeDB = mensajesDelChat[mensajesDelChat.length - 1] as any

  if (ultimoMensajeDB?.respuesta) {
    setIsSyncing(false)
    setIsSending(false)
    setOptimisticMessage(null)
  }
}, [mensajesDelChat, isSyncing])

  const totalReferencias = useMemo(() => {
    return (
      selectedArchivoIds.length +
      selectedRepositorioIds.length +
      uploadedFiles.length
    )
  }, [selectedArchivoIds, selectedRepositorioIds, uploadedFiles])

  const removeSelectedField = (fieldKey: string) => {
    console.log("aqui");
    console.log(fieldKey);
    
    setSelectedFields((prev) => prev.filter((f) => f.key !== fieldKey))
  }

  return (
    <div className="flex h-[calc(100vh-80px)] w-full flex-col gap-4 pb-1 md:h-[calc(100vh-160px)] md:max-h-[calc(100vh-160px)] md:flex-row md:overflow-hidden">
      {/* --- HEADER MÓVIL --- */}
      <div className="bg-background flex shrink-0 items-center justify-between rounded-lg border p-2 shadow-sm md:hidden">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsHistoryOpen(true)}
        >
          <Archive size={18} className="mr-2" /> Historial
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsActionsOpen(true)}
        >
          <Lightbulb size={18} className="text-primary mr-2" /> Acciones
        </Button>
      </div>

      {/* --- PANEL IZQUIERDO: HISTORIAL --- */}
      <div className="hidden w-64 flex-col border-r pr-4 md:flex">
        <h2 className="text-muted-foreground text-xs font-bold tracking-wider uppercase">
          Chats
        </h2>
        <Button
          onClick={createNewChat}
          variant="outline"
          className="mt-2 mb-4 w-full justify-start gap-2"
        >
          <MessageSquarePlus size={18} /> Nuevo chat
        </Button>
        <ScrollArea className="flex-1">
          <div className="space-y-1 pr-2">
            {!showArchived ? (
              activeChats.map((chat) => (
                <div
                  key={chat.id}
                  onClick={() => setActiveChatId(chat.id)}
                  className={`group relative flex w-full items-center overflow-hidden rounded-lg px-3 py-3 text-sm transition-colors ${
                    activeChatId === chat.id
                      ? 'bg-accent text-foreground font-medium'
                      : 'text-muted-foreground hover:bg-accent/50'
                  }`}
                >
                  <div
                    className="flex min-w-0 flex-1 items-center gap-3 transition-all duration-200"
                    style={{
                      maskImage:
                        'linear-gradient(to right, black 70%, transparent 95%)',
                      WebkitMaskImage:
                        'linear-gradient(to right, black 70%, transparent 95%)',
                    }}
                  >
                    <FileText size={16} className="shrink-0 opacity-40" />
                    <TooltipProvider delayDuration={400}>
                      <Tooltip>
                        <TooltipTrigger asChild className="min-w-0 flex-1">
                          <div className="min-w-0 flex-1">
                            <span
                              ref={
                                editingChatId === chat.id ? editableRef : null
                              }
                              contentEditable={editingChatId === chat.id}
                              suppressContentEditableWarning={true}
                              className={`block truncate outline-none ${
                                editingChatId === chat.id
                                  ? 'bg-background ring-primary max-h-20 min-w-[100px] cursor-text overflow-y-auto rounded px-1 break-all shadow-sm ring-1'
                                  : 'cursor-pointer'
                              }`}
                              onDoubleClick={(e) => {
                                e.stopPropagation()
                                setEditingChatId(chat.id)
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault()
                                  e.currentTarget.blur()
                                }
                                if (e.key === 'Escape') {
                                  setEditingChatId(null)
                                  e.currentTarget.textContent =
                                    chat.nombre || ''
                                }
                              }}
                              onBlur={(e) => {
                                if (editingChatId === chat.id) {
                                  const newTitle =
                                    e.currentTarget.textContent.trim() || ''
                                  if (newTitle && newTitle !== chat.nombre) {
                                    updateTitleMutation({
                                      id: chat.id,
                                      nombre: newTitle,
                                    })
                                  }
                                  setEditingChatId(null)
                                }
                              }}
                            >
                              {chat.nombre ||
                                `Chat ${chat.creado_en.split('T')[0]}`}
                            </span>
                          </div>
                        </TooltipTrigger>
                        {editingChatId !== chat.id && (
                          <TooltipContent
                            side="right"
                            className="max-w-[280px] break-all"
                          >
                            {chat.nombre || 'Conversación'}
                          </TooltipContent>
                        )}
                      </Tooltip>
                    </TooltipProvider>
                  </div>

                  <div
                    className={`absolute top-1/2 right-2 z-20 flex -translate-y-1/2 items-center gap-1 rounded-md px-1 opacity-0 transition-opacity group-hover:opacity-100 ${
                      activeChatId === chat.id ? 'bg-accent' : 'bg-transparent'
                    }`}
                  >
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setEditingChatId(chat.id)
                        setTimeout(() => editableRef.current?.focus(), 50)
                      }}
                      className="text-muted-foreground hover:text-primary rounded-md p-1 transition-colors"
                    >
                      <Send size={12} className="rotate-45" />
                    </button>
                    <button
                      onClick={(e) => archiveChat(e, chat.id)}
                      className="text-muted-foreground hover:text-destructive rounded-md p-1 transition-colors"
                    >
                      <Archive size={14} />
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="animate-in fade-in slide-in-from-left-2 px-1">
                <p className="text-muted-foreground mb-2 px-2 text-[10px] font-bold uppercase">
                  Archivados
                </p>
                {archivedChats.map((chat) => (
                  <div
                    key={chat.id}
                    className="bg-muted/50 text-muted-foreground group relative mb-1 flex w-full items-center overflow-hidden rounded-lg px-3 py-2 text-sm"
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-3 pr-10">
                      <Archive size={14} className="shrink-0 opacity-30" />
                      <span className="block truncate">
                        {chat.nombre ||
                          `Archivado ${chat.creado_en.split('T')[0]}`}
                      </span>
                    </div>
                    <button
                      onClick={(e) => unarchiveChat(e, chat.id)}
                      className="bg-accent hover:text-primary absolute top-1/2 right-2 shrink-0 -translate-y-1/2 rounded p-1 opacity-0 transition-opacity group-hover:opacity-100"
                    >
                      <RotateCcw size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* --- PANEL DE CHAT PRINCIPAL --- */}
      <div className="border-border/60 bg-muted/30 relative flex min-w-0 flex-1 flex-col overflow-hidden rounded-xl border shadow-sm md:h-full md:flex-[3]">
        <div className="bg-background z-10 shrink-0 border-b p-3">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-[10px] font-bold uppercase">
              Mejorar con IA
            </span>
            <button
              onClick={() => setOpenIA(true)}
              className="bg-secondary text-secondary-foreground hover:bg-secondary/80 flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium transition"
            >
              <Archive size={14} className="opacity-70" />
              Referencias
              {totalReferencias > 0 && (
                <span className="bg-primary text-primary-foreground flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[10px]">
                  {totalReferencias}
                </span>
              )}
            </button>
          </div>
        </div>

        <div className="relative flex min-h-0 flex-1 flex-col">
          <ScrollArea ref={scrollRef} className="h-full w-full">
            <div className="mx-auto flex max-w-3xl flex-col gap-6 p-6">
              {!activeChatId &&
              chatMessages.length === 0 &&
              !optimisticMessage ? (
                <div className="flex h-[400px] flex-col items-center justify-center text-center opacity-40">
                  <MessageSquarePlus
                    size={48}
                    className="text-muted-foreground/50 mb-4"
                  />
                  <h3 className="text-foreground text-lg font-medium">
                    No hay un chat seleccionado
                  </h3>
                  <p className="text-muted-foreground text-sm">
                    Selecciona un chat del historial o crea uno nuevo para
                    empezar.
                  </p>
                </div>
              ) : (
                <>
                  {chatMessages.map((msg: any) => {
                    const isAI = msg.role === 'assistant'
                    const isUser = msg.role === 'user'
                    const isProcessing = msg.isProcessing

                    return (
                      <div
                        key={msg.id}
                        className={`flex max-w-[85%] flex-col ${
                          isUser ? 'ml-auto items-end' : 'items-start'
                        }`}
                      >
                        <div
                          className={`relative rounded-2xl p-3 text-sm whitespace-pre-wrap shadow-sm transition-all duration-300 ${
                            isUser
                              ? 'bg-primary text-primary-foreground rounded-tr-none'
                              : `bg-card text-card-foreground rounded-tl-none border ${
                                  msg.isRefusal
                                    ? 'border-destructive/50 bg-destructive/10 ring-destructive/20 ring-1'
                                    : 'border-border'
                                }`
                          }`}
                        >
                          {msg.isRefusal && (
                            <div className="text-destructive mb-1 flex items-center gap-1 text-[10px] font-bold uppercase">
                              <span>Aviso del Asistente</span>
                            </div>
                          )}

                          {isAI && isProcessing ? (
                            <div className="flex items-center gap-2 py-1">
                              <div className="flex gap-1">
                                <span className="bg-primary h-1.5 w-1.5 animate-bounce rounded-full" />
                                <span className="bg-primary h-1.5 w-1.5 animate-bounce rounded-full [animation-delay:-0.15s]" />
                                <span className="bg-primary h-1.5 w-1.5 animate-bounce rounded-full [animation-delay:-0.3s]" />
                              </div>
                            </div>
                          ) : (
                            msg.content
                          )}

                          {isAI && msg.suggestions?.length > 0 && (
                            <div className="border-border/60 bg-muted/50 mt-4 w-full space-y-3 rounded-xl border p-3">
                              <div className="flex items-center justify-between px-1">
                                <span className="text-muted-foreground text-[10px] font-bold uppercase">
                                  Sugerencias de mejora
                                </span>
                                {msg.suggestions.some(
                                  (s: any) => !s.applied,
                                ) && (
                                  <Button
                                    variant="ghost"
                                    className="text-primary hover:bg-primary/10 h-6 px-2 text-[10px]"
                                    onClick={() =>
                                      toggleAllFromMessage(msg.suggestions)
                                    }
                                  >
                                    {msg.suggestions
                                      .filter((s: any) => !s.applied)
                                      .every((s: any) =>
                                        selectedImprovements.includes(s.key),
                                      )
                                      ? 'Desmarcar todo'
                                      : 'Seleccionar todo'}
                                  </Button>
                                )}
                              </div>

                              {msg.suggestions.map((sug: any) => (
                                <div key={sug.key} className="flex gap-2">
                                  {!sug.applied && (
                                    <input
                                      type="checkbox"
                                      className="border-input accent-primary mt-4 h-4 w-4 shrink-0 rounded"
                                      checked={selectedImprovements.includes(
                                        sug.key,
                                      )}
                                      onChange={() =>
                                        toggleImprovementSelection(sug.key)
                                      }
                                    />
                                  )}
                                  <div className="flex-1">
                                    <ImprovementCard
                                      suggestions={[sug]}
                                      dbMessageId={msg.dbMessageId}
                                      planId={planId}
                                      currentDatos={data?.datos}
                                      activeChatId={activeChatId}
                                      onApplySuccess={(key) =>
                                        removeSelectedField(key)
                                      }
                                    />
                                  </div>
                                </div>
                              ))}

                              {msg.suggestions.some((s: any) =>
                                selectedImprovements.includes(s.key),
                              ) && (
                                <Button
                                  size="sm"
                                  disabled={isSending}
                                  className="w-full py-1 text-xs font-bold"
                                  onClick={() => {
                                    const seleccionadas =
                                      msg.suggestions.filter((s: any) =>
                                        selectedImprovements.includes(s.key),
                                      )
                                    handleApplyMultiple(
                                      seleccionadas,
                                      msg.dbMessageId,
                                    )
                                  }}
                                >
                                  {isSending ? (
                                    <Loader2
                                      className="mr-2 animate-spin"
                                      size={12}
                                    />
                                  ) : (
                                    <Check className="mr-2" size={12} />
                                  )}
                                  Aplicar seleccionadas (
                                  {
                                    msg.suggestions.filter((s: any) =>
                                      selectedImprovements.includes(s.key),
                                    ).length
                                  }
                                  )
                                </Button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}

                  {(isSending || isSyncing) && (
                    <div className="animate-in fade-in slide-in-from-bottom-2 flex gap-4">
                      <Avatar className="bg-primary text-primary-foreground h-9 w-9 shrink-0 border shadow-sm">
                        <AvatarFallback>
                          <Sparkles size={16} className="animate-pulse" />
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col items-start gap-2">
                        <div className="bg-card border-border rounded-2xl rounded-tl-none border p-4 shadow-sm">
                          <div className="flex gap-1">
                            <span className="bg-muted-foreground/50 h-1.5 w-1.5 animate-bounce rounded-full [animation-delay:-0.3s]"></span>
                            <span className="bg-muted-foreground/50 h-1.5 w-1.5 animate-bounce rounded-full [animation-delay:-0.15s]"></span>
                            <span className="bg-muted-foreground/50 h-1.5 w-1.5 animate-bounce rounded-full"></span>
                          </div>
                        </div>
                        <span className="text-muted-foreground text-[10px] font-medium italic">
                          La IA está analizando tu solicitud...
                        </span>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </ScrollArea>

          {pendingSuggestion && !isLoading && (
            <div className="animate-in fade-in slide-in-from-bottom-2 bg-card border-border absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 gap-2 rounded-full border p-1.5 shadow-2xl">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPendingSuggestion(null)}
                className="h-8 rounded-full text-xs"
              >
                <X className="mr-1 h-3 w-3" /> Descartar
              </Button>
              <Button size="sm" className="h-8 rounded-full text-xs">
                <Check className="mr-1 h-3 w-3" /> Aplicar cambios
              </Button>
            </div>
          )}
        </div>

        {/* INPUT FIJO AL FONDO */}
        <div className="bg-background border-border shrink-0 border-t p-4">
          <div className="relative mx-auto max-w-4xl">
            {showSuggestions && (
              <div className="animate-in slide-in-from-bottom-2 bg-popover border-border absolute bottom-full mb-2 w-full rounded-xl border shadow-2xl">
                <div className="bg-muted text-muted-foreground border-b px-3 py-2 text-[10px] font-bold uppercase">
                  Resultados para "{filterQuery}"
                </div>
                <div className="max-h-64 overflow-y-auto p-1">
                  {filteredFields.length > 0 ? (
                    filteredFields.map((field, index) => (
                      <button
                        key={field.key}
                        onClick={() => toggleField(field)}
                        className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                          index === 0
                            ? 'bg-primary/10 text-primary ring-primary/30 ring-1 ring-inset'
                            : 'hover:bg-accent'
                        }`}
                      >
                        <span>{field.label}</span>
                        {index === 0 && (
                          <span className="font-mono text-[10px] opacity-50">
                            TAB
                          </span>
                        )}
                      </button>
                    ))
                  ) : (
                    <div className="text-muted-foreground p-3 text-center text-xs">
                      No hay coincidencias
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="bg-muted/50 focus-within:bg-background focus-within:ring-primary flex flex-col gap-2 rounded-xl border p-2 transition-all focus-within:ring-1">
              {selectedFields.length > 0 && (
                <div className="flex flex-wrap gap-2 px-2 pt-1">
                  {selectedFields.map((field) => (
                    <div
                      key={field.key}
                      className="animate-in zoom-in-95 border-primary/20 bg-primary/10 text-primary flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-semibold"
                    >
                      <span className="opacity-70">Campo:</span> {field.label}
                      <button
                        onClick={() => removeSelectedField(field.key)}
                        className="hover:bg-primary/20 ml-1 rounded-full p-0.5 transition-colors"
                      >
                        <X size={10} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex items-end gap-2">
                <Textarea
                  value={input}
                  disabled={isBusy}
                  onChange={handleInputChange}
                  onKeyDown={(e) => {
                    if (showSuggestions) {
                      if (e.key === 'Tab' || e.key === 'Enter') {
                        if (filteredFields.length > 0) {
                          e.preventDefault()
                          toggleField(filteredFields[0])
                        }
                      }
                      if (e.key === 'Escape') {
                        e.preventDefault()
                        setShowSuggestions(false)
                        setFilterQuery('')
                      }
                    } else {
                      if (
                        e.key === 'Backspace' &&
                        input === '' &&
                        selectedFields.length > 0
                      ) {
                        setSelectedFields((prev) => prev.slice(0, -1))
                      }
                    }

                    if (e.key === 'Enter' && !e.shiftKey && !showSuggestions) {
                      e.preventDefault()

                      if (isBusy) return

                      handleSend()
                    }
                  }}
                  placeholder={
                    selectedFields.length > 0
                      ? 'Escribe instrucciones adicionales...'
                      : 'Escribe tu solicitud o ":" para campos...'
                  }
                />

                <Button
                  onClick={() => handleSend()}
                  disabled={
                    isBusy || (!input.trim() && selectedFields.length === 0)
                  }
                  size="icon"
                  className="mb-1 h-9 w-9 shrink-0"
                >
                  {isBusy  ? (
                    <Loader2 className="animate-spin" size={16} />
                  ) : (
                    <Send size={16} />
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* --- PANEL LATERAL: ACCIONES RÁPIDAS --- */}
      <div className="hidden flex-[1] flex-col gap-4 overflow-y-auto md:flex">
        <h4 className="text-foreground flex items-center gap-2 text-left text-sm font-bold">
          <Lightbulb size={18} className="text-primary" /> Acciones rápidas
        </h4>
        <div className="space-y-2 p-1">
          {PRESETS.map((preset) => (
            <button
              key={preset.id}
              onClick={() => handleSend(preset.prompt)}
              className="bg-card hover:border-primary hover:bg-primary/5 group flex w-full items-center gap-3 rounded-xl border p-3 text-left text-sm shadow-sm transition-all"
            >
              <div className="bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary rounded-lg p-2 transition-colors">
                <preset.icon size={16} />
              </div>
              <span className="text-foreground leading-tight font-medium">
                {preset.label}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* --- DRAWER: HISTORIAL (Móvil) --- */}
      <Drawer open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
        <DrawerContent className="h-[80vh] p-4">
          <Button
            onClick={() => {
              createNewChat()
              setIsHistoryOpen(false)
            }}
            className="mb-4 w-full"
          >
            <MessageSquarePlus size={18} className="mr-2" /> Nuevo Chat
          </Button>
          <ScrollArea className="flex-1">
            <p className="text-muted-foreground mb-4 text-xs font-bold uppercase">
              Historial Reciente
            </p>
            {activeChats.map((chat) => (
              <div
                key={chat.id}
                onClick={() => {
                  setActiveChatId(chat.id)
                  setIsHistoryOpen(false)
                }}
                className="border-border border-b p-3 text-sm"
              >
                {chat.nombre || 'Chat sin nombre'}
              </div>
            ))}
          </ScrollArea>
        </DrawerContent>
      </Drawer>

      {/* --- DRAWER: ACCIONES RÁPIDAS (Móvil) --- */}
      <Drawer open={isActionsOpen} onOpenChange={setIsActionsOpen}>
        <DrawerContent className="h-[60vh] p-4">
          <h4 className="mb-4 flex items-center gap-2 font-bold">
            <Lightbulb size={18} className="text-primary" /> Acciones rápidas
          </h4>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {PRESETS.map((preset) => (
              <button
                key={preset.id}
                onClick={() => {
                  handleSend(preset.prompt)
                  setIsActionsOpen(false)
                }}
                className="border-border flex items-center gap-3 rounded-xl border p-4 text-left text-sm"
              >
                <preset.icon size={16} />
                <span>{preset.label}</span>
              </button>
            ))}
          </div>
        </DrawerContent>
      </Drawer>

      <Drawer open={openIA} onOpenChange={setOpenIA}>
        <DrawerContent className="bg-background fixed inset-x-0 bottom-0 mx-auto mb-4 flex h-[80vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border shadow-2xl">
          <div className="bg-muted/50 border-border flex items-center justify-between border-b px-4 py-3">
            <h2 className="text-muted-foreground text-xs font-bold tracking-wider uppercase">
              Referencias para la IA
            </h2>
            <button
              onClick={() => setOpenIA(false)}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            <ReferenciasParaIA
              selectedArchivoIds={selectedArchivoIds}
              selectedRepositorioIds={selectedRepositorioIds}
              uploadedFiles={uploadedFiles}
              autoScrollToDropzone={false}
              enableSha256Dedupe={true}
              enableAutoUpload={true}
              onToggleArchivo={(id, checked) => {
                setSelectedArchivoIds((prev) =>
                  checked ? [...prev, id] : prev.filter((a) => a !== id),
                )
              }}
              onToggleRepositorio={(id, checked) => {
                setSelectedRepositorioIds((prev) =>
                  checked ? [...prev, id] : prev.filter((r) => r !== id),
                )
              }}
              onFilesChange={(files) => {
                setUploadedFiles(files)
              }}
            />
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  )
}
