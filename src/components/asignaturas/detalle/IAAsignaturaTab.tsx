/* eslint-disable jsx-a11y/click-events-have-key-events */
/* eslint-disable jsx-a11y/no-static-element-interactions */
import { useQueryClient } from '@tanstack/react-query'
import { useLocation, useParams } from '@tanstack/react-router'
import {
  Send,
  FileText,
  X,
  MessageSquarePlus,
  Archive,
  Loader2,
  Sparkles,
  AlertTriangle,
  RotateCcw,
  Maximize2,
  Minimize2,
  Target,
  BookOpen,
  GraduationCap,
  Lightbulb,
} from 'lucide-react'
import { useState, useEffect, useRef, useMemo } from 'react'
import { toast } from 'sonner'

import { ImprovementCard } from './SaveAsignatura/ImprovementCardProps'

import type { UploadedFile } from '@/components/planes/wizard/PasoDetallesPanel/FileDropZone'

import ReferenciasParaIA from '@/components/planes/wizard/PasoDetallesPanel/ReferenciasParaIA'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Drawer, DrawerContent } from '@/components/ui/drawer'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  useAISubjectChat,
  useConversationBySubject,
  useMessagesBySubjectChat,
  useSubject,
  useUpdateSubjectConversationName,
  useUpdateSubjectConversationStatus,
} from '@/data'

// --- Tipado y Helpers ---
interface SelectedField {
  key: string
  label: string
  value: string
}

interface ChatSnapshot {
  activeChatId: string | undefined
  optimisticMessage: string | null
  input: string
  selectedFields: Array<SelectedField>
}

export function IAAsignaturaTab({
  chatOnly = false,
}: {
  chatOnly?: boolean
} = {}) {
  const queryClient = useQueryClient()
  const { asignaturaId } = useParams({
    from: '/planes/$planId/asignaturas/$asignaturaId',
  })
  const location = useLocation()

  // --- DATA QUERIES ---
  const { data: datosGenerales } = useSubject(asignaturaId)
  const { data: todasConversaciones, isLoading: loadingConv } =
    useConversationBySubject(asignaturaId)
  const [activeChatId, setActiveChatId] = useState<string | undefined>(
    undefined,
  )
  const { data: rawMessages } = useMessagesBySubjectChat(activeChatId ?? null)
  const { mutateAsync: sendMessage } = useAISubjectChat()
  const { mutateAsync: updateStatusAsync } =
    useUpdateSubjectConversationStatus()
  const { mutateAsync: updateNameAsync } = useUpdateSubjectConversationName()

  // --- ESTADOS ---
  const [openIA, setOpenIA] = useState(false)
  const [isWide, setIsWide] = useState(false)
  const wide = chatOnly || isWide
  const [isSending, setIsSending] = useState(false)
  const [showArchived, setShowArchived] = useState(false)
  const [input, setInput] = useState('')
  const [selectedFields, setSelectedFields] = useState<Array<SelectedField>>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [filterQuery, setFilterQuery] = useState('')
  const [optimisticMessage, setOptimisticMessage] = useState<string | null>(
    null,
  )
  const [isHistoryOpen, setIsHistoryOpen] = useState(false)
  const [editingChatId, setEditingChatId] = useState<string | null>(null)

  const [selectedArchivoIds, setSelectedArchivoIds] = useState<Array<string>>(
    [],
  )
  const [selectedRepositorioIds, setSelectedRepositorioIds] = useState<
    Array<string>
  >([])
  const [uploadedFiles, setUploadedFiles] = useState<Array<UploadedFile>>([])
  const [selectedImprovements, setSelectedImprovements] = useState<
    Array<string>
  >([])

  const scrollRef = useRef<HTMLDivElement>(null)
  const composerRef = useRef<HTMLDivElement>(null)
  const editableRef = useRef<HTMLSpanElement>(null)
  const hasInitialSelected = useRef(false)
  const isInitialLoad = useRef(true)
  const prevMessagesCount = useRef<number>(0)

  // --- CAMPOS DISPONIBLES (lógica propia de asignatura: x-column + columnas raíz) ---
  const availableFields = useMemo(() => {
    const estructuraProps =
      (datosGenerales?.estructuras_asignatura?.definicion as any)?.properties ||
      {}

    const datos: Record<string, any> = (datosGenerales?.datos as any) || {}

    // TODOS los campos definidos en la estructura
    const dynamicFields = Object.entries(estructuraProps).map(
      ([key, fieldDef]: any) => {
        // Si el campo usa x-column, usamos ese valor real
        const realKey = fieldDef['x-column'] || key

        let value = ''

        // Buscar valor en datos normales
        if (datos[realKey] !== undefined && datos[realKey] !== null) {
          value =
            typeof datos[realKey] === 'string'
              ? datos[realKey]
              : JSON.stringify(datos[realKey])
        }

        // Buscar valor en columnas root del modelo
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

    // Evitar duplicados
    return dynamicFields.filter(
      (field, index, self) =>
        index === self.findIndex((f) => f.key === field.key),
    )
  }, [datosGenerales])

  const filteredFields = useMemo(() => {
    return availableFields.filter(
      (field) =>
        field.label.toLowerCase().includes(filterQuery.toLowerCase()) &&
        !selectedFields.some((s) => s.key === field.key),
    )
  }, [availableFields, filterQuery, selectedFields])

  // --- MENSAJES ---
  const messages = useMemo(() => {
    const msgs: Array<any> = []

    if (rawMessages) {
      rawMessages.forEach((m: any) => {
        msgs.push({
          id: `${m.id}-user`,
          role: 'user',
          content: m.mensaje,
        })

        if (m.respuesta) {
          const sugerencias =
            m.propuesta?.recommendations?.map((rec: any, index: number) => ({
              id: `${m.id}-sug-${index}`,
              messageId: m.id,
              campoKey: rec.campo_afectado,
              campoNombre:
                availableFields.find((f) => f.key === rec.campo_afectado)
                  ?.label ?? rec.campo_afectado.replace(/_/g, ' '),
              valorSugerido: rec.texto_mejora,
              aceptada: rec.aplicada,
            })) || []

          msgs.push({
            id: `${m.id}-ai`,
            role: 'assistant',
            content: m.respuesta,
            isRefusal: m.is_refusal,
            sugerencias,
          })
        }
      })
    }

    // Mensaje optimista del usuario mientras la IA responde
    if (isSending && optimisticMessage) {
      msgs.push({
        id: 'optimistic-user-msg',
        role: 'user',
        content: optimisticMessage,
      })
    }

    return msgs
  }, [rawMessages, isSending, optimisticMessage, availableFields])

  const isAiThinking = useMemo(() => {
    if (isSending) return true
    if (!rawMessages || rawMessages.length === 0) return false

    const lastMessage = rawMessages[rawMessages.length - 1] as any
    return (
      lastMessage.estado === 'PROCESANDO' || lastMessage.estado === 'PENDIENTE'
    )
  }, [isSending, rawMessages])

  const isBusy = isAiThinking

  const { activeChats, archivedChats } = useMemo(() => {
    const chats = todasConversaciones || []
    return {
      activeChats: chats.filter((c: any) => c.estado === 'ACTIVA'),
      archivedChats: chats.filter((c: any) => c.estado === 'ARCHIVADA'),
    }
  }, [todasConversaciones])

  const activeChatCount = activeChats.length
  const archivedChatCount = archivedChats.length

  const totalReferencias =
    selectedArchivoIds.length +
    selectedRepositorioIds.length +
    uploadedFiles.length

  const mainStatusLabel = isBusy
    ? 'Analizando solicitud'
    : activeChatId
      ? 'Chat activo'
      : 'Sin chat seleccionado'

  const mainStatusTone = isBusy
    ? 'border-amber-500/20 bg-amber-500/10 text-amber-700'
    : activeChatId
      ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700'
      : 'border-border bg-muted/50 text-muted-foreground'

  const isEmptyChat = !activeChatId && messages.length === 0 && !optimisticMessage

  // --- SCROLL ---
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

  useEffect(() => {
    if (messages.length === 0) {
      prevMessagesCount.current = 0
      return
    }

    if (isInitialLoad.current) {
      scrollToBottom('instant')
      isInitialLoad.current = false
    } else if (messages.length > prevMessagesCount.current) {
      scrollToBottom('smooth')
    }

    prevMessagesCount.current = messages.length
  }, [messages, isSending])

  useEffect(() => {
    isInitialLoad.current = true
  }, [activeChatId])

  // Auto-seleccionar el primer chat activo al cargar
  useEffect(() => {
    if (activeChatId || hasInitialSelected.current) return

    if (activeChats.length > 0 && !loadingConv) {
      setActiveChatId(activeChats[0].id)
      hasInitialSelected.current = true
    }
  }, [activeChats, loadingConv, activeChatId])

  // Prefill desde navegación (state.prefillCampo)
  useEffect(() => {
    const state = location.state as any

    if (state?.activeTab === 'ia' && state?._ts) {
      if (state.prefillCampo) {
        const fieldToSelect = availableFields.find(
          (f) => f.key === state.prefillCampo,
        )

        if (fieldToSelect) {
          setSelectedFields([fieldToSelect])
          setInput(`Mejora este campo: ${fieldToSelect.label} `)
        }
      }
    }
  }, [location.state, availableFields])

  // Sincroniza el texto externo (clear / inyección) con el composer editable
  useEffect(() => {
    const editor = composerRef.current
    if (!editor) return

    const currentVisualText = editor.innerText.replace(/\u00a0/g, ' ').trim()
    const nextText = input.replace(/\u00a0/g, ' ').trim()

    if (currentVisualText !== nextText) {
      editor.innerText = input
    }
  }, [input])

  // --- COMPOSER ---
  const getComposerCaretOffset = (element: HTMLDivElement) => {
    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0)
      return element.innerText.length

    const range = selection.getRangeAt(0)
    if (!element.contains(range.startContainer)) return element.innerText.length

    const preRange = range.cloneRange()
    preRange.selectNodeContents(element)
    preRange.setEnd(range.startContainer, range.startOffset)

    return preRange.toString().length
  }

  const syncComposerText = (nextValue: string) => {
    const editor = composerRef.current
    if (!editor) return

    if (editor.innerText !== nextValue) {
      editor.innerText = nextValue
    }
  }

  const handleComposerInput = (e: React.FormEvent<HTMLDivElement>) => {
    const val = e.currentTarget.innerText.replace(/\u00a0/g, ' ')
    const cursorPosition = getComposerCaretOffset(e.currentTarget)
    setInput(val)

    const textBeforeCursor = val.slice(0, cursorPosition)
    const match = textBeforeCursor.match(/\/(\w*)$/)

    if (match) {
      setShowSuggestions(true)
      setFilterQuery(match[1])
    } else {
      setShowSuggestions(false)
      setFilterQuery('')
    }
  }

  const handleComposerPaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault()
    const pastedText = e.clipboardData.getData('text/plain')
    document.execCommand('insertText', false, pastedText)
  }

  const toggleField = (field: SelectedField) => {
    setSelectedFields((prev) => {
      const isSelected = prev.find((f) => f.key === field.key)
      return isSelected ? prev : [...prev, field]
    })

    setInput((prev) => prev.replace(/\/(\w*)$/, ` ${field.label} `))

    setShowSuggestions(false)
    setFilterQuery('')

    setTimeout(() => {
      const editor = composerRef.current
      if (editor) {
        editor.focus()
        const range = document.createRange()
        const sel = window.getSelection()
        range.selectNodeContents(editor)
        range.collapse(false)
        sel?.removeAllRanges()
        sel?.addRange(range)
      }
    }, 20)
  }

  const removeSelectedField = (fieldKey: string) => {
    setSelectedFields((prev) => prev.filter((f) => f.key !== fieldKey))
  }

  const clearComposer = () => {
    setInput('')
    setShowSuggestions(false)
    setFilterQuery('')
    syncComposerText('')
  }

  // --- ENVÍO ---
  const handleSend = async (promptOverride?: string) => {
    const rawText = promptOverride || input
    if (isBusy || (!rawText.trim() && selectedFields.length === 0)) return

    const currentFields = [...selectedFields]
    setIsSending(true)
    setOptimisticMessage(rawText)
    clearComposer()

    try {
      const openaiFileIdsFromUploads = uploadedFiles
        .map((a) => a.openaiFileId)
        .filter((x): x is string => Boolean(x))

      const archivosReferencia = Array.from(
        new Set([...selectedArchivoIds, ...openaiFileIdsFromUploads]),
      )

      const response = await sendMessage({
        subjectId: asignaturaId as any,
        content: rawText,
        campos: currentFields.map((f) => f.key),
        conversacionId: activeChatId,
        archivosReferencia,
        repositoriosIds: selectedRepositorioIds,
      })

      setSelectedArchivoIds([])
      setUploadedFiles([])
      setSelectedRepositorioIds([])

      if (response.conversacionId) {
        setActiveChatId(response.conversacionId)
      }

      queryClient.invalidateQueries({
        queryKey: ['conversation-by-subject', asignaturaId],
      })
    } catch (error) {
      console.error('Error al enviar mensaje:', error)
    } finally {
      setIsSending(false)
      setOptimisticMessage(null)
    }
  }


  const toggleAllFromMessage = (sugerencias: Array<any>) => {
    const pendientes = sugerencias.filter((s: any) => !s.aceptada)
    const allIds = pendientes.map((s) => s.id)
    const allSelected = allIds.every((id) => selectedImprovements.includes(id))

    if (allSelected) {
      setSelectedImprovements((prev) => prev.filter((id) => !allIds.includes(id)))
    } else {
      setSelectedImprovements((prev) => Array.from(new Set([...prev, ...allIds])))
    }
  }

  // --- HISTORIAL: crear / archivar / renombrar (con undo) ---
  const createNewChat = () => {
    setActiveChatId(undefined)
    setOptimisticMessage(null)
    setInput('')
    setSelectedFields([])
    queryClient.setQueryData(['subject-messages', undefined], [])
  }

  const restoreChatSnapshot = (snapshot: ChatSnapshot) => {
    setActiveChatId(snapshot.activeChatId)
    setOptimisticMessage(snapshot.optimisticMessage)
    setInput(snapshot.input)
    setSelectedFields(snapshot.selectedFields)
  }

  const archiveChatById = async (id: string, snapshot?: ChatSnapshot) => {
    const toastId = toast.loading('Archivando chat...')

    if (activeChatId === id) {
      setActiveChatId(undefined)
      setOptimisticMessage(null)
      setInput('')
      setSelectedFields([])
    }

    try {
      await updateStatusAsync({ id, estado: 'ARCHIVADA' })
      toast.dismiss(toastId)
      toast.success('Chat archivado', {
        action: {
          label: 'Deshacer',
          onClick: () => {
            void unarchiveChatById(id, snapshot)
          },
        },
      })
    } catch (error) {
      toast.dismiss(toastId)
      if (snapshot) restoreChatSnapshot(snapshot)
      toast.error('No se pudo archivar el chat. Se restauró el estado anterior.')
      console.error(error)
    }
  }

  const unarchiveChatById = async (id: string, snapshot?: ChatSnapshot) => {
    const toastId = toast.loading('Restaurando chat...')

    try {
      await updateStatusAsync({ id, estado: 'ACTIVA' })
      toast.dismiss(toastId)
      toast.success('Chat restaurado', {
        action: {
          label: 'Deshacer',
          onClick: () => {
            void archiveChatById(id, snapshot)
          },
        },
      })
    } catch (error) {
      toast.dismiss(toastId)
      toast.error('No se pudo restaurar el chat.')
      console.error(error)
    }
  }

  const archiveChat = (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    const snapshot: ChatSnapshot = {
      activeChatId,
      optimisticMessage,
      input,
      selectedFields,
    }
    void archiveChatById(id, snapshot)
  }

  const unarchiveChat = (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    void unarchiveChatById(id)
  }

  const renameChatById = async (
    id: string,
    nextName: string,
    previousName: string,
  ) => {
    const toastId = toast.loading('Guardando nombre del chat...')

    try {
      await updateNameAsync({ id, nombre: nextName })
      toast.dismiss(toastId)
      toast.success('Nombre actualizado', {
        action: {
          label: 'Deshacer',
          onClick: () => {
            void renameChatById(id, previousName, nextName)
          },
        },
      })
    } catch (error) {
      toast.dismiss(toastId)
      toast.error('No se pudo cambiar el nombre del chat.')
      console.error(error)
    }
  }

  // --- ATAJOS RÁPIDOS (propio de asignatura) ---
  const PRESETS = [
    {
      id: 'mejorar-obj',
      label: 'Mejorar objetivo',
      icon: Target,
      prompt: 'Mejora la redacción del objetivo...',
    },
    {
      id: 'sugerir-cont',
      label: 'Sugerir contenido',
      icon: BookOpen,
      prompt: 'Genera un desglose de temas...',
    },
    {
      id: 'actividades',
      label: 'Actividades',
      icon: GraduationCap,
      prompt: 'Sugiere actividades prácticas...',
    },
  ]

  const chatName = (chat: any) =>
    chat.nombre || chat.titulo || 'Conversación'

  return (
    <div
      className={
        wide
          ? 'bg-background fixed inset-0 z-50 flex h-dvh w-screen flex-col gap-2 overflow-hidden pt-2 pb-1'
          : 'flex h-[calc(100vh-80px)] w-full flex-col gap-4 pb-1 md:h-[calc(100vh-160px)] md:max-h-[calc(100vh-160px)] md:flex-row md:overflow-hidden'
      }
    >
      {wide && (
        <div className="flex shrink-0 justify-end px-4 md:px-5">
          <button
            onClick={() => setIsWide(false)}
            className="bg-secondary text-secondary-foreground hover:bg-secondary/80 flex items-center gap-2 rounded-md px-3 py-2 text-xs font-medium transition"
          >
            <Minimize2 size={14} className="opacity-70" />
            Salir de vista amplia
          </button>
        </div>
      )}

      {/* --- HEADER MÓVIL --- */}
      {!wide && (
        <div className="bg-background flex shrink-0 items-center justify-between rounded-lg border p-2 shadow-sm md:hidden">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsHistoryOpen(true)}
          >
            <Archive size={18} className="mr-2" /> Historial
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setOpenIA(true)}>
            <FileText size={18} className="text-primary mr-2" /> Referencias
          </Button>
        </div>
      )}

      {/* --- PANEL IZQUIERDO: HISTORIAL --- */}
      {!wide && (
        <div className="hidden w-80 flex-col border-r pr-5 md:flex">
          <div className="mb-4 flex flex-col gap-3">
            <div className="space-y-1">
              <h2 className="text-foreground text-xs font-bold tracking-wider uppercase">
                Chats
              </h2>
              <p className="text-muted-foreground max-w-[16rem] text-[11px] leading-5">
                Reutiliza conversaciones o archiva lo que ya no uses.
              </p>
            </div>
            <div className="bg-muted grid grid-cols-2 gap-1 rounded-xl border p-1">
              <Button
                type="button"
                size="sm"
                variant={!showArchived ? 'secondary' : 'ghost'}
                onClick={() => setShowArchived(false)}
                className="h-8 min-w-0 px-2 text-xs"
              >
                <span className="truncate">Activos</span>
                <span className="ml-2 shrink-0 opacity-60">
                  {activeChatCount}
                </span>
              </Button>
              <Button
                type="button"
                size="sm"
                variant={showArchived ? 'secondary' : 'ghost'}
                onClick={() => setShowArchived(true)}
                className="h-8 min-w-0 px-2 text-xs"
              >
                <span className="truncate">Archivados</span>
                <span className="ml-2 shrink-0 opacity-60">
                  {archivedChatCount}
                </span>
              </Button>
            </div>
          </div>
          <Button
            onClick={createNewChat}
            variant="outline"
            className="mb-4 w-full justify-start gap-2"
          >
            <MessageSquarePlus size={18} /> Nuevo chat
          </Button>
          <ScrollArea className="flex-1">
            <div className="space-y-2 pr-2">
              {!showArchived ? (
                activeChats.map((chat: any) => (
                  <div
                    key={chat.id}
                    onClick={() => setActiveChatId(chat.id)}
                    className={`group relative flex w-full items-center overflow-hidden rounded-xl px-3 py-3 text-sm transition-all ${
                      activeChatId === chat.id
                        ? 'bg-accent text-foreground ring-primary/10 font-medium shadow-sm ring-1 ring-inset'
                        : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
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
                                    ? 'bg-background ring-primary max-h-20 min-w-25 cursor-text overflow-y-auto rounded px-1 break-all shadow-sm ring-1'
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
                                    e.currentTarget.textContent = chatName(chat)
                                  }
                                }}
                                onBlur={(e) => {
                                  if (editingChatId === chat.id) {
                                    const newTitle =
                                      e.currentTarget.textContent.trim() || ''
                                    if (
                                      newTitle &&
                                      newTitle !== (chat.nombre || chat.titulo)
                                    ) {
                                      void renameChatById(
                                        chat.id,
                                        newTitle,
                                        chat.nombre || chat.titulo || '',
                                      )
                                    }
                                    setEditingChatId(null)
                                  }
                                }}
                              >
                                {chatName(chat)}
                              </span>
                            </div>
                          </TooltipTrigger>
                          {editingChatId !== chat.id && (
                            <TooltipContent
                              side="right"
                              className="max-w-70 break-all"
                            >
                              {chatName(chat)}
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
                  {archivedChats.map((chat: any) => (
                    <div
                      key={chat.id}
                      className="bg-muted/50 text-muted-foreground group relative mb-2 flex w-full items-center overflow-hidden rounded-xl px-3 py-2 text-sm"
                    >
                      <div className="flex min-w-0 flex-1 items-center gap-3 pr-10">
                        <Archive size={14} className="shrink-0 opacity-30" />
                        <span className="block truncate">{chatName(chat)}</span>
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
      )}

      {/* --- PANEL DE CHAT PRINCIPAL --- */}
      <div
        className={
          wide
            ? 'relative flex min-w-0 flex-1 flex-col overflow-hidden'
            : 'border-border/60 bg-muted/30 relative flex min-w-0 flex-1 flex-col overflow-hidden rounded-xl border shadow-sm md:h-full md:flex-4'
        }
      >
        {!wide && (
          <div className="bg-background z-10 shrink-0 border-b px-4 py-3 md:px-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-foreground text-base font-semibold md:text-lg">
                    Mejorar con IA
                  </span>
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${mainStatusTone}`}
                  >
                    {mainStatusLabel}
                  </span>
                </div>
                <p className="text-muted-foreground mt-1 max-w-2xl text-xs leading-5">
                  Asistente personalizado para tu asignatura. Las referencias se
                  usan cuando el contenido depende de archivos o repositorios.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 lg:self-start">
                <button
                  onClick={() => setIsWide(true)}
                  className="bg-secondary text-secondary-foreground hover:bg-secondary/80 flex items-center gap-2 rounded-md px-3 py-2 text-xs font-medium transition"
                >
                  <Maximize2 size={14} className="opacity-70" />
                  Vista amplia
                </button>

                <button
                  onClick={() => setOpenIA(true)}
                  className="bg-secondary text-secondary-foreground hover:bg-secondary/80 flex items-center gap-2 rounded-md px-3 py-2 text-xs font-medium transition"
                >
                  <FileText size={14} className="opacity-70" />
                  Referencias
                  {totalReferencias > 0 && (
                    <span className="bg-primary text-primary-foreground flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px]">
                      {totalReferencias}
                    </span>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="relative flex min-h-0 flex-1 flex-col">
          <ScrollArea ref={scrollRef} className="h-full w-full">
            <div
              className={
                isEmptyChat
                  ? 'mx-auto flex min-h-full max-w-5xl flex-col justify-center gap-6 px-4 py-5 md:px-6 md:py-6'
                  : 'mx-auto flex max-w-5xl flex-col gap-6 px-4 py-5 md:px-6 md:py-6'
              }
            >
              {isEmptyChat ? (
                <div className="border-border/70 bg-background/60 flex min-h-105 flex-col items-center justify-center rounded-2xl border border-dashed px-6 text-center">
                  <MessageSquarePlus
                    size={48}
                    className="text-muted-foreground/50 mb-4"
                  />
                  <h3 className="text-foreground text-lg font-semibold">
                    No hay un chat seleccionado
                  </h3>
                  <p className="text-muted-foreground mt-2 max-w-sm text-sm leading-6">
                    Selecciona un chat del historial o crea uno nuevo para
                    empezar.
                  </p>
                  <div className="mt-6 flex flex-wrap justify-center gap-2">
                    <Button onClick={createNewChat} size="sm">
                      <MessageSquarePlus size={16} className="mr-2" /> Nuevo chat
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setOpenIA(true)}
                    >
                      <FileText size={16} className="mr-2" /> Revisar
                      referencias
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  {messages.map((msg: any) => {
                    const isAI = msg.role === 'assistant'
                    const isUser = msg.role === 'user'

                    return (
                      <div
                        key={msg.id}
                        className={`flex max-w-[90%] flex-col ${
                          isUser ? 'ml-auto items-end' : 'items-start'
                        }`}
                      >
                        <div
                          className={`relative text-base whitespace-pre-wrap transition-all duration-300 ${
                            isUser
                              ? 'from-muted/80 via-muted/70 to-muted/60 text-foreground border-border/60 rounded-3xl rounded-tr-sm border bg-linear-to-br px-4 py-4 shadow-sm ring-1 shadow-black/5 ring-white/30 ring-inset'
                              : 'text-card-foreground rounded-none border-l-0 bg-transparent px-0 py-1 pl-2 shadow-none'
                          }`}
                        >
                          {msg.isRefusal && (
                            <div
                              role="status"
                              aria-live="polite"
                              className="border-destructive/30 bg-destructive/10 mb-3 flex items-start gap-3 rounded-md border px-3 py-2"
                            >
                              <span className="text-destructive mt-0.5">
                                <AlertTriangle size={16} />
                              </span>
                              <div className="flex-1">
                                <div className="text-destructive mb-1 text-[12px] font-semibold uppercase">
                                  Aviso del Asistente
                                </div>
                                <div className="text-card-foreground text-sm leading-5">
                                  {msg.content}
                                </div>
                              </div>
                            </div>
                          )}

                          {msg.isRefusal ? null : msg.content}

                          {isAI && msg.sugerencias?.length > 0 && (
                            <div className="mt-3 w-full space-y-3">
                              <div className="flex items-center justify-between px-0">
                                <span className="text-muted-foreground text-[10px] font-bold uppercase">
                                  Mejoras disponibles
                                </span>
                                {msg.sugerencias.some(
                                  (s: any) => !s.aceptada,
                                ) && (
                                  <Button
                                    variant="ghost"
                                    className="text-primary hover:bg-primary/10 h-6 text-[10px]"
                                    onClick={() =>
                                      toggleAllFromMessage(msg.sugerencias)
                                    }
                                  >
                                    {msg.sugerencias
                                      .filter((s: any) => !s.aceptada)
                                      .every((s: any) =>
                                        selectedImprovements.includes(s.id),
                                      )
                                      ? 'Desmarcar todas'
                                      : 'Seleccionar todas'}
                                  </Button>
                                )}
                              </div>

                              <div className="space-y-3">
                                {msg.sugerencias.map((sug: any) => (
                                  <ImprovementCard
                                    key={sug.id}
                                    sug={sug}
                                    asignaturaId={asignaturaId}
                                    onApplied={(key) =>
                                      setSelectedFields((prev) =>
                                        prev.filter((f) => f.key !== key),
                                      )
                                    }
                                  />
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}

                  {isAiThinking && (
                    <div className="animate-in fade-in slide-in-from-bottom-2 flex gap-4">
                      <Avatar className="bg-primary text-primary-foreground h-9 w-9 shrink-0 border shadow-sm">
                        <AvatarFallback>
                          <Sparkles size={16} className="animate-pulse" />
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col items-start gap-2">
                        <div className="rounded-none bg-transparent p-0 shadow-none">
                          <div className="flex items-start gap-3">
                            <div className="bg-muted-foreground/20 h-8 w-8 animate-pulse rounded-full" />
                            <div className="flex-1 space-y-2 py-1">
                              <div className="bg-muted-foreground/20 h-3 w-[70%] animate-pulse rounded" />
                              <div className="bg-muted-foreground/15 h-3 w-[50%] animate-pulse rounded" />
                            </div>
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
        </div>

        {/* INPUT FIJO AL FONDO */}
        <div
          className={
            wide
              ? 'bg-background border-border shrink-0 border-t px-4 py-2 md:px-5'
              : 'bg-background border-border shrink-0 border-t px-4 py-4 md:px-5'
          }
        >
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

            <div className={wide ? 'flex flex-col gap-2' : 'flex flex-col gap-3'}>
              {selectedFields.length > 0 && (
                <div className="flex flex-wrap gap-2 px-1 pt-0.5">
                  {selectedFields.map((field) => (
                    <div
                      key={field.key}
                      className="animate-in zoom-in-95 border-primary/20 bg-primary/10 text-primary flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold"
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
                <div className="relative flex-1 px-1 py-0.5 transition">
                  {!input.trim() && (
                    <div className="text-muted-foreground pointer-events-none absolute top-1 left-1 text-sm md:text-base">
                      {selectedFields.length > 0
                        ? 'Escribe instrucciones adicionales...'
                        : 'Escribe tu solicitud o "/" para campos...'}
                    </div>
                  )}
                  <div
                    ref={composerRef}
                    role="textbox"
                    tabIndex={0}
                    aria-multiline="true"
                    aria-label="Escribir solicitud para IA"
                    contentEditable={!isBusy}
                    suppressContentEditableWarning={true}
                    spellCheck={false}
                    onInput={handleComposerInput}
                    onPaste={handleComposerPaste}
                    onKeyDown={(e) => {
                      if (showSuggestions) {
                        if (e.key === 'Tab' || e.key === 'Enter') {
                          if (filteredFields.length > 0) {
                            e.preventDefault()
                            toggleField(filteredFields[0])
                          }
                          return
                        }

                        if (e.key === 'Escape') {
                          e.preventDefault()
                          setShowSuggestions(false)
                          setFilterQuery('')
                          return
                        }
                      } else if (
                        e.key === 'Backspace' &&
                        input.trim() === '' &&
                        selectedFields.length > 0
                      ) {
                        setSelectedFields((prev) => prev.slice(0, -1))
                      }

                      if (e.key === 'Enter' && !e.shiftKey && !showSuggestions) {
                        e.preventDefault()
                        if (isBusy) return
                        void handleSend()
                      }
                    }}
                    className="min-h-8 bg-transparent p-0 text-sm wrap-break-word whitespace-pre-wrap outline-none md:min-h-10 md:text-base"
                  />
                </div>

                <Button
                  onClick={() => handleSend()}
                  disabled={
                    isBusy || (!input.trim() && selectedFields.length === 0)
                  }
                  size="icon"
                  aria-label="Enviar solicitud"
                  className="border-border/70 bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:ring-primary/30 mb-1 h-10 w-10 shrink-0 rounded-xl border shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md focus-visible:ring-2 focus-visible:ring-offset-2 active:translate-y-0 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none disabled:hover:translate-y-0 md:h-11 md:w-11"
                >
                  {isBusy ? (
                    <Loader2 className="animate-spin" size={15} />
                  ) : (
                    <Send size={15} />
                  )}
                </Button>
              </div>

              <div
                className={
                  wide
                    ? 'text-muted-foreground flex flex-wrap items-center gap-2 px-1 pb-0 text-[11px]'
                    : 'text-muted-foreground flex flex-wrap items-center gap-2 px-1 pb-0.5 text-[11px]'
                }
              >
                <span className="border-border bg-background rounded-full border px-2 py-1">
                  Enter para enviar
                </span>
                <span className="border-border bg-background rounded-full border px-2 py-1">
                  Shift + Enter para salto de línea
                </span>
                {selectedFields.length > 0 && (
                  <span className="border-primary/20 bg-primary/10 text-primary rounded-full border px-2 py-1">
                    {selectedFields.length} campo(s) seleccionados
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* --- PANEL DERECHO: ATAJOS RÁPIDOS (propio de asignatura) --- */}
      {!wide && (
        <aside className="hidden w-64 shrink-0 flex-col gap-4 overflow-y-auto p-4 lg:flex">
          <h4 className="text-foreground flex items-center gap-2 text-sm font-bold">
            <Lightbulb size={18} className="text-primary" /> Atajos Rápidos
          </h4>
          <div className="space-y-2">
            {PRESETS.map((preset) => (
              <button
                key={preset.id}
                onClick={() => handleSend(preset.prompt)}
                className="bg-card border-border hover:border-primary group flex w-full items-center gap-3 rounded-xl border p-3 text-left text-sm transition-all hover:shadow-sm"
              >
                <div className="bg-muted group-hover:bg-primary/10 group-hover:text-primary rounded-lg p-2 transition-colors">
                  <preset.icon size={16} />
                </div>
                <span className="text-muted-foreground group-hover:text-foreground font-medium">
                  {preset.label}
                </span>
              </button>
            ))}
          </div>
        </aside>
      )}

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
            {(showArchived ? archivedChats : activeChats).map((chat: any) => (
              <div
                key={chat.id}
                onClick={() => {
                  setActiveChatId(chat.id)
                  setIsHistoryOpen(false)
                }}
                className="border-border border-b p-3 text-sm"
              >
                {chatName(chat)}
              </div>
            ))}
          </ScrollArea>
        </DrawerContent>
      </Drawer>

      {/* --- DRAWER: REFERENCIAS --- */}
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
              onFilesChange={(files) => setUploadedFiles(files)}
            />
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  )
}
