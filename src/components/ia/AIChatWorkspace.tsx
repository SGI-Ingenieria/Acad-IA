/* eslint-disable jsx-a11y/click-events-have-key-events */
/* eslint-disable jsx-a11y/no-static-element-interactions */
import { Link } from '@tanstack/react-router'
import {
  AlertTriangle,
  Archive,
  FileText,
  Globe2,
  Info,
  Loader2,
  Maximize2,
  MessageSquare,
  MessageSquarePlus,
  Paperclip,
  Minimize2,
  PanelLeftClose,
  PanelLeftOpen,
  RotateCcw,
  Send,
  Sparkles,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'

import type { ReasoningEffortOption } from '@/components/ia/ReasoningEffortSelect'
import type { UploadedFile } from '@/components/planes/wizard/PasoDetallesPanel/FileDropZone'
import type { ReferenciasIAMetadata } from '@/components/planes/wizard/PasoDetallesPanel/ReferenciasParaIA'
import type { ReactNode } from 'react'

import { ReasoningEffortSelect } from '@/components/ia/ReasoningEffortSelect'
import ReferenciasParaIA from '@/components/planes/wizard/PasoDetallesPanel/ReferenciasParaIA'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  getOrganicMotion,
  gsap,
  organicDuration,
  organicEase,
  organicInOut,
  useGSAP,
} from '@/lib/animations'
import { notify } from '@/lib/toast'
import { cn } from '@/lib/utils'

export interface AIChatField {
  key: string
  label: string
  value: string
}

export interface AIChatConversation {
  id: string
  nombre?: string | null
  titulo?: string | null
  creado_en?: string | null
  estado: 'ACTIVA' | 'ARCHIVADA' | string
}

export interface AIChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  status?: 'processing' | 'completed' | 'error' | 'cancelled'
  isRefusal?: boolean
  isProcessing?: boolean
  dbMessageId?: string
  openaiResponseId?: string | null
  suggestions?: Array<any>
}

export interface AIChatSendPayload {
  content: string
  fields: Array<AIChatField>
  fieldKeys: Array<string>
  archivosReferencia: Array<string>
  repositoriosIds: Array<string>
  webSearchEnabled: boolean
  reasoningEffort: ReasoningEffortOption
}

export interface AIChatRenderHelpers {
  removeSelectedField: (fieldKey: string) => void
}

type RouteDescriptor = {
  to: any
  params?: Record<string, unknown>
  mask?: {
    to: any
    params?: Record<string, unknown>
  }
}

type PrefillRequest = {
  fieldKey?: string | null
  fieldValue?: string | null
  token?: string | number | null
  baseInput?: string
}

type ChatSnapshot = {
  activeChatId: string | undefined
  pendingMessage: PendingChatMessage | null
  input: string
  selectedFields: Array<AIChatField>
  draftChatStarted: boolean
}

type PendingChatMessage = {
  id: string
  content: string
  baseMessageCount: number
}

function compactReferenceLabel(
  singular: string,
  selectedIds: Array<string>,
  labelsById: Map<string, string>,
) {
  const labels = selectedIds.map(
    (id, index) => labelsById.get(id) ?? `${singular} ${index + 1}`,
  )

  if (labels.length === 0) return ''
  if (labels.length === 1) return labels[0]

  return `${labels[0]} + ${labels.length - 1}`
}

export function AIChatWorkspace({
  chatOnly = false,
  conversations,
  messages,
  activeChatId,
  onActiveChatChange,
  conversationsLoading = false,
  availableFields,
  prefill,
  isBusy,
  busyLabel = 'La IA está analizando tu solicitud...',
  headerHelpText,
  wideRoute,
  exitRoute,
  onSend,
  onArchive,
  onUnarchive,
  onRename,
  onCancelMessage,
  renderAssistantExtras,
}: {
  chatOnly?: boolean
  conversations: Array<AIChatConversation>
  messages: Array<AIChatMessage>
  activeChatId: string | undefined
  onActiveChatChange: (id: string | undefined) => void
  conversationsLoading?: boolean
  availableFields: Array<AIChatField>
  prefill?: PrefillRequest
  isBusy: boolean
  busyLabel?: string
  headerHelpText: string
  wideRoute: RouteDescriptor
  exitRoute: RouteDescriptor
  onSend: (
    payload: AIChatSendPayload,
  ) => Promise<{ conversationId?: string } | void>
  onArchive: (id: string) => Promise<void>
  onUnarchive: (id: string) => Promise<void>
  onRename: (id: string, nextName: string) => Promise<void>
  onCancelMessage?: (message: AIChatMessage) => Promise<void>
  renderAssistantExtras?: (
    message: AIChatMessage,
    helpers: AIChatRenderHelpers,
  ) => ReactNode
}) {
  const [openIA, setOpenIA] = useState(false)
  const [selectedArchivoIds, setSelectedArchivoIds] = useState<Array<string>>(
    [],
  )
  const [selectedRepositorioIds, setSelectedRepositorioIds] = useState<
    Array<string>
  >([])
  const [uploadedFiles, setUploadedFiles] = useState<Array<UploadedFile>>([])
  const [referenceMetadata, setReferenceMetadata] =
    useState<ReferenciasIAMetadata>({
      archivos: [],
      repositorios: [],
    })
  const [input, setInput] = useState('')
  const [selectedFields, setSelectedFields] = useState<Array<AIChatField>>([])
  const [webSearchEnabled, setWebSearchEnabled] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [filterQuery, setFilterQuery] = useState('')
  const [showArchived, setShowArchived] = useState(false)
  const [isChatListCollapsed, setIsChatListCollapsed] = useState(false)
  const [isHistoryOpen, setIsHistoryOpen] = useState(false)
  const [editingChatId, setEditingChatId] = useState<string | null>(null)
  const [pendingMessage, setPendingMessage] =
    useState<PendingChatMessage | null>(null)
  const [cancellingMessageId, setCancellingMessageId] = useState<string | null>(
    null,
  )
  const [draftChatStarted, setDraftChatStarted] = useState(false)
  const [reasoningEffort, setReasoningEffort] =
    useState<ReasoningEffortOption>('auto')
  const lastPrefillToken = useRef<string | number | null | undefined>(undefined)
  const workspaceRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const composerRef = useRef<HTMLDivElement>(null)
  const composerShellRef = useRef<HTMLDivElement>(null)
  const editableRef = useRef<HTMLSpanElement>(null)
  const isInitialLoad = useRef(true)
  const prevMessagesCount = useRef<number>(0)

  const { activeChats, archivedChats } = useMemo(() => {
    return {
      activeChats: conversations.filter((chat) => chat.estado === 'ACTIVA'),
      archivedChats: conversations.filter(
        (chat) => chat.estado === 'ARCHIVADA',
      ),
    }
  }, [conversations])

  const visibleActiveChats = activeChats

  const activeChat = useMemo(() => {
    if (!activeChatId) return null
    return conversations.find((chat) => chat.id === activeChatId) ?? null
  }, [activeChatId, conversations])

  const filteredFields = useMemo(() => {
    return availableFields.filter(
      (field) =>
        field.label.toLowerCase().includes(filterQuery.toLowerCase()) &&
        !selectedFields.some((selected) => selected.key === field.key),
    )
  }, [availableFields, filterQuery, selectedFields])

  const totalReferencias =
    selectedArchivoIds.length +
    selectedRepositorioIds.length +
    uploadedFiles.length

  const archivoLabelsById = useMemo(
    () =>
      new Map(
        referenceMetadata.archivos.map((archivo) => [
          archivo.id,
          archivo.label,
        ]),
      ),
    [referenceMetadata.archivos],
  )

  const repositorioLabelsById = useMemo(
    () =>
      new Map(
        referenceMetadata.repositorios.map((repositorio) => [
          repositorio.id,
          repositorio.label,
        ]),
      ),
    [referenceMetadata.repositorios],
  )

  const referenceChips = useMemo(
    () =>
      [
        selectedArchivoIds.length > 0
          ? {
              key: 'archivos',
              label: compactReferenceLabel(
                'Archivo',
                selectedArchivoIds,
                archivoLabelsById,
              ),
            }
          : null,
        selectedRepositorioIds.length > 0
          ? {
              key: 'repositorios',
              label: compactReferenceLabel(
                'Repositorio',
                selectedRepositorioIds,
                repositorioLabelsById,
              ),
            }
          : null,
        uploadedFiles.length > 0
          ? {
              key: 'subidos',
              label:
                uploadedFiles.length === 1
                  ? uploadedFiles[0]?.file.name || 'Archivo subido'
                  : `${uploadedFiles[0]?.file.name || 'Archivo subido'} + ${
                      uploadedFiles.length - 1
                    }`,
            }
          : null,
      ].filter((chip): chip is { key: string; label: string } => Boolean(chip)),
    [
      archivoLabelsById,
      repositorioLabelsById,
      selectedArchivoIds,
      selectedRepositorioIds,
      uploadedFiles,
    ],
  )

  const visiblePendingMessage = useMemo(() => {
    if (!pendingMessage) return null

    const confirmedUserMessage = messages
      .slice(pendingMessage.baseMessageCount)
      .some(
        (message) =>
          message.role === 'user' &&
          message.content.trim() === pendingMessage.content.trim(),
      )

    return confirmedUserMessage ? null : pendingMessage
  }, [messages, pendingMessage])

  const displayMessages = useMemo(() => {
    const showDraftWelcome =
      draftChatStarted && !visiblePendingMessage && messages.length === 0

    const draftMessages: Array<AIChatMessage> = showDraftWelcome
      ? [
          {
            id: 'draft-welcome',
            role: 'assistant',
            content:
              'Iniciando una nueva conversación. ¿En qué puedo ayudarte?',
          },
        ]
      : []

    const pendingMessages: Array<AIChatMessage> = visiblePendingMessage
      ? [
          {
            id: visiblePendingMessage.id,
            role: 'user',
            content: visiblePendingMessage.content,
          },
        ]
      : []

    return [...draftMessages, ...messages, ...pendingMessages]
  }, [draftChatStarted, messages, visiblePendingMessage])

  const hasProcessingDisplayMessage = useMemo(
    () =>
      displayMessages.some(
        (message) =>
          message.role === 'assistant' &&
          (message.isProcessing || message.status === 'processing'),
      ),
    [displayMessages],
  )

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

  const isEmptyChat =
    !activeChatId && displayMessages.length === 0 && !visiblePendingMessage

  useGSAP(
    () => {
      if (!getOrganicMotion()) return

      const shell = composerShellRef.current
      if (shell) {
        gsap.fromTo(
          shell,
          { y: 10, opacity: 0.86, scale: 0.99 },
          {
            y: 0,
            opacity: 1,
            scale: 1,
            duration: organicDuration.slow,
            ease: organicEase,
          },
        )
      }

      const messageElements =
        workspaceRef.current?.querySelectorAll('.ai-chat-message')
      if (!messageElements || messageElements.length === 0) return

      gsap.fromTo(
        messageElements,
        { y: 12, opacity: 0, filter: 'blur(8px)' },
        {
          y: 0,
          opacity: 1,
          filter: 'blur(0px)',
          duration: organicDuration.slow,
          ease: organicEase,
          stagger: 0.025,
          overwrite: 'auto',
        },
      )
    },
    {
      scope: workspaceRef,
      dependencies: [displayMessages.length, activeChatId, draftChatStarted],
    },
  )

  useGSAP(
    () => {
      if (!getOrganicMotion()) return

      const aura = workspaceRef.current?.querySelector('.ai-composer-aura')
      if (!aura) return

      gsap.to(aura, {
        opacity: webSearchEnabled || totalReferencias > 0 ? 0.78 : 0.44,
        scale: webSearchEnabled || isBusy ? 1.035 : 1.015,
        duration: 2.6,
        ease: organicInOut,
        yoyo: true,
        repeat: -1,
      })
    },
    {
      scope: workspaceRef,
      dependencies: [isBusy, totalReferencias, webSearchEnabled],
    },
  )

  const activeChatTitle = activeChat
    ? formatChatTitle(activeChat)
    : draftChatStarted || pendingMessage
      ? 'Nuevo chat'
      : 'Selecciona un chat'

  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    if (!scrollRef.current) return

    const scrollContainer = scrollRef.current.querySelector(
      '[data-radix-scroll-area-viewport]',
    )

    if (!scrollContainer) return

    scrollContainer.scrollTo({
      top: scrollContainer.scrollHeight,
      behavior,
    })
  }

  useEffect(() => {
    if (displayMessages.length === 0) {
      prevMessagesCount.current = 0
      return
    }

    if (isInitialLoad.current) {
      scrollToBottom('instant')
      isInitialLoad.current = false
    } else if (displayMessages.length > prevMessagesCount.current) {
      scrollToBottom('smooth')
    }

    prevMessagesCount.current = displayMessages.length
  }, [displayMessages])

  useEffect(() => {
    isInitialLoad.current = true
    if (activeChatId) {
      setDraftChatStarted(false)
    }
  }, [activeChatId])

  useEffect(() => {
    if (isBusy) return
    setPendingMessage(null)
  }, [isBusy])

  useEffect(() => {
    if (conversationsLoading || draftChatStarted || pendingMessage) return

    const currentChatExists = activeChats.some(
      (chat) => chat.id === activeChatId,
    )

    if (activeChatId && !currentChatExists) {
      onActiveChatChange(undefined)
      return
    }

    if (!activeChatId && activeChats.length > 0 && messages.length === 0) {
      onActiveChatChange(activeChats[0].id)
    }
  }, [
    activeChatId,
    activeChats,
    conversationsLoading,
    draftChatStarted,
    messages.length,
    onActiveChatChange,
    pendingMessage,
  ])

  useEffect(() => {
    const editor = composerRef.current
    if (!editor) return

    const currentVisualText = editor.innerText.replace(/\u00a0/g, ' ').trim()
    const nextText = input.replace(/\u00a0/g, ' ').trim()

    if (currentVisualText !== nextText) {
      editor.innerText = input
    }
  }, [input])

  useEffect(() => {
    if (!prefill) return

    const token =
      prefill.token ?? prefill.fieldKey ?? prefill.fieldValue ?? undefined

    if (token === undefined || lastPrefillToken.current === token) return
    lastPrefillToken.current = token

    const field = availableFields.find(
      (item) =>
        item.key === prefill.fieldKey || item.value === prefill.fieldValue,
    )

    if (!field) return

    setSelectedFields([field])
    setInput(
      injectFieldsIntoInput(prefill.baseInput ?? 'Mejora este campo:', [field]),
    )
  }, [availableFields, prefill])

  const restoreChatSnapshot = (snapshot: ChatSnapshot) => {
    onActiveChatChange(snapshot.activeChatId)
    setPendingMessage(snapshot.pendingMessage)
    setInput(snapshot.input)
    setSelectedFields(snapshot.selectedFields)
    setDraftChatStarted(snapshot.draftChatStarted)
  }

  const takeSnapshot = (): ChatSnapshot => ({
    activeChatId,
    pendingMessage,
    input,
    selectedFields,
    draftChatStarted,
  })

  const createNewChat = () => {
    onActiveChatChange(undefined)
    setDraftChatStarted(true)
    setPendingMessage(null)
    setInput('')
    setSelectedFields([])
    setWebSearchEnabled(false)
    setReasoningEffort('auto')
    setShowSuggestions(false)
    setFilterQuery('')
    syncComposerText('')
  }

  const handleArchive = (event: React.MouseEvent, id: string) => {
    event.stopPropagation()

    const snapshot = takeSnapshot()

    if (activeChatId === id) {
      onActiveChatChange(undefined)
      setDraftChatStarted(false)
      setPendingMessage(null)
      setInput('')
      setSelectedFields([])
    }

    const toastId = notify.loading('Archivando chat...')

    void (async () => {
      try {
        await onArchive(id)
        notify.dismiss(toastId)
        notify.success('Chat archivado', {
          action: {
            label: 'Deshacer',
            onClick: () => {
              void handleUnarchiveById(id, snapshot)
            },
          },
        })
      } catch (error) {
        notify.dismiss(toastId)
        restoreChatSnapshot(snapshot)
        notify.error(
          'No se pudo archivar el chat. Se restauró el estado anterior.',
        )
        console.error(error)
      }
    })()
  }

  const handleUnarchiveById = async (id: string, snapshot?: ChatSnapshot) => {
    const toastId = notify.loading('Restaurando chat...')

    try {
      await onUnarchive(id)
      notify.dismiss(toastId)
      notify.success('Chat restaurado', {
        action: snapshot
          ? {
              label: 'Deshacer',
              onClick: () => {
                void handleArchiveById(id, snapshot)
              },
            }
          : undefined,
      })
    } catch (error) {
      notify.dismiss(toastId)
      notify.error('No se pudo restaurar el chat.')
      console.error(error)
    }
  }

  const handleArchiveById = async (id: string, snapshot?: ChatSnapshot) => {
    const toastId = notify.loading('Archivando chat...')

    if (activeChatId === id) {
      onActiveChatChange(undefined)
      setDraftChatStarted(false)
      setPendingMessage(null)
      setInput('')
      setSelectedFields([])
    }

    try {
      await onArchive(id)
      notify.dismiss(toastId)
      notify.success('Chat archivado', {
        action: snapshot
          ? {
              label: 'Deshacer',
              onClick: () => {
                void handleUnarchiveById(id, snapshot)
              },
            }
          : undefined,
      })
    } catch (error) {
      notify.dismiss(toastId)
      if (snapshot) restoreChatSnapshot(snapshot)
      notify.error(
        'No se pudo archivar el chat. Se restauró el estado anterior.',
      )
      console.error(error)
    }
  }

  const handleUnarchive = (event: React.MouseEvent, id: string) => {
    event.stopPropagation()
    void handleUnarchiveById(id)
  }

  const renameChatById = async (
    id: string,
    nextName: string,
    previousName: string,
  ) => {
    const toastId = notify.loading('Guardando nombre del chat...')

    try {
      await onRename(id, nextName)
      notify.dismiss(toastId)
      notify.success('Nombre actualizado', {
        action: {
          label: 'Deshacer',
          onClick: () => {
            void renameChatById(id, previousName, nextName)
          },
        },
      })
    } catch (error) {
      notify.dismiss(toastId)
      notify.error('No se pudo cambiar el nombre del chat.')
      console.error(error)
    }
  }

  const handleHeaderTitleBlur = (e: React.FocusEvent<HTMLSpanElement>) => {
    const nextName = e.currentTarget.textContent.trim()

    if (!activeChatId || !activeChat) {
      e.currentTarget.textContent = activeChatTitle
      return
    }

    if (!nextName) {
      e.currentTarget.textContent = activeChatTitle
      return
    }

    if (nextName !== activeChatTitle) {
      void renameChatById(activeChatId, nextName, activeChat.nombre || '')
    }
  }

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

  const toggleField = (field: AIChatField) => {
    setSelectedFields((prev) => {
      const isSelected = prev.find((item) => item.key === field.key)
      return isSelected ? prev : [...prev, field]
    })

    setInput((prev) => prev.replace(/\/(\w*)$/, ` ${field.label} `))

    setShowSuggestions(false)
    setFilterQuery('')

    setTimeout(() => {
      const editor = composerRef.current
      if (!editor) return

      editor.focus()

      const range = document.createRange()
      const sel = window.getSelection()
      range.selectNodeContents(editor)
      range.collapse(false)
      sel?.removeAllRanges()
      sel?.addRange(range)
    }, 20)
  }

  const removeSelectedField = (fieldKey: string) => {
    setSelectedFields((prev) => prev.filter((field) => field.key !== fieldKey))
  }

  const clearComposer = () => {
    setInput('')
    setShowSuggestions(false)
    setFilterQuery('')
    syncComposerText('')
  }

  const handleSend = async () => {
    const rawText = input
    if (isBusy || (!rawText.trim() && selectedFields.length === 0)) return

    const currentFields = [...selectedFields]
    const finalContent = rawText.trim()
      ? rawText
      : `Mejora ${currentFields.map((field) => field.label).join(', ')}.`
    const openaiFileIdsFromUploads = uploadedFiles
      .map((file) => file.openaiFileId)
      .filter((id): id is string => Boolean(id))
    const archivosReferencia = Array.from(
      new Set([...selectedArchivoIds, ...openaiFileIdsFromUploads]),
    )
    const wasDraftChat = draftChatStarted && !activeChatId

    setDraftChatStarted(false)
    setPendingMessage({
      id: `pending-user-message-${Date.now()}`,
      content: finalContent,
      baseMessageCount: messages.length,
    })
    clearComposer()

    try {
      const response = await onSend({
        content: finalContent,
        fields: currentFields,
        fieldKeys: currentFields.map((field) => field.key),
        archivosReferencia,
        repositoriosIds: selectedRepositorioIds,
        webSearchEnabled,
        reasoningEffort,
      })

      if (response?.conversationId) {
        onActiveChatChange(response.conversationId)
      }

      setPendingMessage(null)
      setSelectedArchivoIds([])
      setUploadedFiles([])
      setSelectedRepositorioIds([])
      setSelectedFields([])
      setWebSearchEnabled(false)
      setDraftChatStarted(false)
    } catch (error) {
      setPendingMessage(null)
      if (wasDraftChat) {
        setDraftChatStarted(true)
      }
      notify.error('No se pudo enviar el mensaje.')
      console.error(error)
    }
  }

  const handleCancelAssistantMessage = async (message: AIChatMessage) => {
    if (!onCancelMessage) return

    const messageId = message.dbMessageId ?? message.id
    const toastId = notify.loading('Cancelando respuesta...')
    setCancellingMessageId(messageId)

    try {
      await onCancelMessage(message)
      notify.dismiss(toastId)
      notify.success('Respuesta cancelada')
    } catch (error) {
      notify.dismiss(toastId)
      notify.error('No se pudo cancelar la respuesta.')
      console.error(error)
    } finally {
      setCancellingMessageId(null)
    }
  }

  return (
    <div
      ref={workspaceRef}
      className={
        chatOnly
          ? 'flex h-dvh w-full flex-col gap-2 overflow-hidden pt-2 pb-1'
          : 'flex h-[calc(100vh-80px)] w-full flex-col gap-4 pb-1 md:h-[calc(100vh-160px)] md:max-h-[calc(100vh-160px)] md:flex-row md:overflow-hidden'
      }
    >
      {chatOnly && (
        <div className="flex shrink-0 justify-end px-4 md:px-5">
          <Link
            to={exitRoute.to}
            params={exitRoute.params as any}
            className="bg-secondary text-secondary-foreground hover:bg-secondary/80 flex items-center gap-2 rounded-md px-3 py-2 text-xs font-medium transition"
          >
            <Minimize2 size={14} className="opacity-70" />
            Salir de vista amplia
          </Link>
        </div>
      )}

      {!chatOnly && (
        <div className="bg-background flex shrink-0 items-center justify-between rounded-lg border p-2 shadow-sm md:hidden">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsHistoryOpen(true)}
          >
            <Archive size={18} className="mr-2" /> Historial
          </Button>
        </div>
      )}

      {!chatOnly && !isChatListCollapsed && (
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
                  {visibleActiveChats.length}
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
                  {archivedChats.length}
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
                visibleActiveChats.map((chat) => (
                  <div
                    key={chat.id}
                    onClick={() => {
                      onActiveChatChange(chat.id)
                    }}
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
                                    e.currentTarget.textContent =
                                      chat.nombre || ''
                                  }
                                }}
                                onBlur={(e) => {
                                  if (editingChatId !== chat.id) return

                                  const newTitle =
                                    e.currentTarget.textContent.trim()
                                  if (newTitle && newTitle !== chat.nombre) {
                                    void renameChatById(
                                      chat.id,
                                      newTitle,
                                      chat.nombre || '',
                                    )
                                  }
                                  setEditingChatId(null)
                                }}
                              >
                                {formatChatTitle(chat)}
                              </span>
                            </div>
                          </TooltipTrigger>
                          {editingChatId !== chat.id && (
                            <TooltipContent
                              side="right"
                              className="max-w-70 break-all"
                            >
                              {formatChatTitle(chat)}
                            </TooltipContent>
                          )}
                        </Tooltip>
                      </TooltipProvider>
                    </div>

                    <div
                      className={`absolute top-1/2 right-2 z-20 flex -translate-y-1/2 items-center gap-1 rounded-md px-1 opacity-0 transition-opacity group-hover:opacity-100 ${
                        activeChatId === chat.id
                          ? 'bg-accent'
                          : 'bg-transparent'
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
                        onClick={(e) => handleArchive(e, chat.id)}
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
                      className="bg-muted/50 text-muted-foreground group relative mb-2 flex w-full items-center overflow-hidden rounded-xl px-3 py-2 text-sm"
                    >
                      <div className="flex min-w-0 flex-1 items-center gap-3 pr-10">
                        <Archive size={14} className="shrink-0 opacity-30" />
                        <span className="block truncate">
                          {formatChatTitle(chat, 'Archivado')}
                        </span>
                      </div>
                      <button
                        onClick={(e) => handleUnarchive(e, chat.id)}
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

      <div
        className={
          chatOnly
            ? 'relative flex min-w-0 flex-1 flex-col overflow-hidden'
            : 'border-border/60 bg-muted/30 relative flex min-w-0 flex-1 flex-col overflow-hidden rounded-xl border shadow-sm md:h-full md:flex-4'
        }
      >
        {!chatOnly && (
          <div className="bg-background z-10 shrink-0 border-b px-4 py-3 md:px-5">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex min-w-0 flex-1 items-start gap-3">
                <TooltipProvider delayDuration={250}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() =>
                          setIsChatListCollapsed((collapsed) => !collapsed)
                        }
                        aria-label={
                          isChatListCollapsed
                            ? 'Mostrar lista de chats'
                            : 'Ocultar lista de chats'
                        }
                        className="mt-0.5 hidden h-8 w-8 shrink-0 md:inline-flex"
                      >
                        {isChatListCollapsed ? (
                          <PanelLeftOpen size={16} />
                        ) : (
                          <PanelLeftClose size={16} />
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      {isChatListCollapsed
                        ? 'Mostrar lista de chats'
                        : 'Ocultar lista de chats'}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>

                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <span
                      role="textbox"
                      tabIndex={activeChatId ? 0 : -1}
                      contentEditable={Boolean(activeChatId)}
                      suppressContentEditableWarning
                      spellCheck={false}
                      aria-label="Nombre del chat"
                      title={
                        activeChatId
                          ? 'Nombre del chat'
                          : 'Selecciona o crea un chat para nombrarlo'
                      }
                      onPaste={(e) => {
                        e.preventDefault()
                        document.execCommand(
                          'insertText',
                          false,
                          e.clipboardData.getData('text/plain'),
                        )
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          e.currentTarget.blur()
                        }

                        if (e.key === 'Escape') {
                          e.currentTarget.textContent = activeChatTitle
                          e.currentTarget.blur()
                        }
                      }}
                      onBlur={handleHeaderTitleBlur}
                      className={`text-foreground max-w-full min-w-0 border-b text-base leading-7 font-semibold whitespace-pre-wrap transition-colors outline-none md:text-lg ${
                        activeChatId
                          ? 'hover:border-input focus:border-primary cursor-text border-transparent wrap-break-word'
                          : 'cursor-default border-transparent'
                      }`}
                    >
                      {activeChatTitle}
                    </span>
                    <span
                      className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium ${mainStatusTone}`}
                    >
                      {mainStatusLabel}
                    </span>
                    <TooltipProvider delayDuration={250}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            aria-label="Información del chat"
                            className="text-muted-foreground hover:text-foreground inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-colors"
                          >
                            <Info size={15} />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-72 text-xs leading-5">
                          {headerHelpText}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2 self-start overflow-x-auto xl:self-center">
                <Link
                  to={wideRoute.to}
                  params={wideRoute.params as any}
                  mask={wideRoute.mask as any}
                  className="bg-secondary text-secondary-foreground hover:bg-secondary/80 inline-flex h-9 shrink-0 items-center gap-2 rounded-md px-3 text-xs font-medium transition"
                >
                  <Maximize2 size={14} className="opacity-70" />
                  Vista amplia
                </Link>
              </div>
            </div>
          </div>
        )}

        <div className="relative flex min-h-0 flex-1 flex-col">
          <ScrollArea ref={scrollRef} className="h-full w-full">
            <div
              className={
                isEmptyChat
                  ? 'mx-auto flex min-h-full w-full max-w-5xl flex-col justify-center gap-6 px-4 py-5 md:px-6'
                  : 'mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-5 md:px-6'
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
                      <MessageSquarePlus size={16} className="mr-2" /> Nuevo
                      chat
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
                  {displayMessages.map((msg) => {
                    const isAI = msg.role === 'assistant'
                    const isUser = msg.role === 'user'
                    const isProcessing =
                      isAI && (msg.isProcessing || msg.status === 'processing')
                    const isError = isAI && msg.status === 'error'
                    const isCancelled = isAI && msg.status === 'cancelled'
                    const canCancel =
                      isProcessing &&
                      Boolean(
                        onCancelMessage &&
                        msg.dbMessageId &&
                        msg.openaiResponseId,
                      )
                    const isCancelling =
                      cancellingMessageId === (msg.dbMessageId ?? msg.id)

                    return (
                      <div
                        key={msg.id}
                        className={`ai-chat-message flex max-w-[90%] flex-col ${
                          isUser ? 'ml-auto items-end' : 'items-start'
                        }`}
                      >
                        <div
                          className={`relative text-base whitespace-pre-wrap transition-all duration-300 ${
                            isUser
                              ? 'from-muted/80 via-muted/70 to-muted/60 text-foreground border-border/60 rounded-3xl rounded-tr-sm border bg-linear-to-br px-4 py-4 shadow-sm ring-1 shadow-black/5 ring-white/30 ring-inset'
                              : `text-card-foreground rounded-none border-l-0 bg-transparent px-0 py-1 pl-2 shadow-none ${
                                  msg.isRefusal || isError
                                    ? 'border-destructive/50'
                                    : 'border-border/30'
                                }`
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

                          {isProcessing ? (
                            <div className="flex flex-wrap items-center gap-3 py-1">
                              <div className="flex gap-1" aria-hidden="true">
                                <span className="bg-primary h-1.5 w-1.5 animate-bounce rounded-full" />
                                <span className="bg-primary h-1.5 w-1.5 animate-bounce rounded-full [animation-delay:-0.15s]" />
                                <span className="bg-primary h-1.5 w-1.5 animate-bounce rounded-full [animation-delay:-0.3s]" />
                              </div>
                              <span className="text-muted-foreground text-sm">
                                Generando respuesta...
                              </span>
                              {canCancel && (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  disabled={isCancelling}
                                  onClick={() =>
                                    void handleCancelAssistantMessage(msg)
                                  }
                                  className="border-border/60 h-7 rounded-md border px-2 text-[11px]"
                                >
                                  {isCancelling ? (
                                    <Loader2
                                      size={12}
                                      className="mr-1 animate-spin"
                                    />
                                  ) : (
                                    <X size={12} className="mr-1" />
                                  )}
                                  {isCancelling ? 'Cancelando' : 'Cancelar'}
                                </Button>
                              )}
                            </div>
                          ) : isError ? (
                            <div
                              role="alert"
                              className="border-destructive/30 bg-destructive/10 flex items-start gap-3 rounded-md border px-3 py-2"
                            >
                              <span className="text-destructive mt-0.5">
                                <AlertTriangle size={16} />
                              </span>
                              <div className="flex-1">
                                <div className="text-destructive mb-1 text-[12px] font-semibold uppercase">
                                  Error al generar
                                </div>
                                <div className="text-card-foreground text-sm leading-5">
                                  {msg.content ||
                                    'No se pudo generar la respuesta de la IA.'}
                                </div>
                              </div>
                            </div>
                          ) : isCancelled ? (
                            <div
                              role="status"
                              className="border-border bg-muted/40 text-muted-foreground flex items-center gap-2 rounded-md border px-3 py-2 text-sm"
                            >
                              <X size={15} />
                              <span>
                                {msg.content ||
                                  'Esta respuesta se ha cancelado.'}
                              </span>
                            </div>
                          ) : msg.isRefusal ? null : (
                            msg.content
                          )}

                          {isAI &&
                            !isProcessing &&
                            !isError &&
                            !isCancelled &&
                            renderAssistantExtras?.(msg, {
                              removeSelectedField,
                            })}
                        </div>
                      </div>
                    )
                  })}

                  {isBusy && !hasProcessingDisplayMessage && (
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
                          {busyLabel}
                        </span>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </ScrollArea>
        </div>

        <div
          className={
            chatOnly
              ? 'bg-background/92 border-border shrink-0 border-t px-4 py-2 backdrop-blur-xl md:px-5'
              : 'bg-background/92 border-border shrink-0 border-t px-4 py-4 backdrop-blur-xl md:px-5'
          }
        >
          <div className="relative mx-auto max-w-4xl">
            {showSuggestions && (
              <div className="organic-surface gradient-border animate-in slide-in-from-bottom-2 bg-popover border-border absolute bottom-full mb-3 w-full overflow-hidden rounded-2xl border shadow-2xl">
                <div className="bg-muted/70 text-muted-foreground border-b px-3 py-2 text-[10px] font-bold uppercase">
                  Resultados para "{filterQuery}"
                </div>
                <div className="max-h-64 overflow-y-auto p-1">
                  {filteredFields.length > 0 ? (
                    filteredFields.map((field, index) => (
                      <button
                        key={field.key}
                        onClick={() => toggleField(field)}
                        className={`organic-interactive flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm ${
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

            <div
              className={
                chatOnly ? 'flex flex-col gap-2' : 'flex flex-col gap-3'
              }
            >
              <div
                ref={composerShellRef}
                className={cn(
                  'organic-surface gradient-border organic-glow relative overflow-hidden rounded-[1.65rem] border border-transparent px-3 py-3 shadow-sm md:px-4',
                  webSearchEnabled && 'ring-primary/20 ring-2',
                )}
              >
                <div className="ai-composer-aura breathing-aura" />

                {(selectedFields.length > 0 || referenceChips.length > 0) && (
                  <div className="mb-2 flex flex-wrap gap-2">
                    {selectedFields.map((field) => (
                      <div
                        key={field.key}
                        className="organic-chip animate-in zoom-in-95 flex min-w-0 items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold"
                      >
                        <span className="shrink-0 opacity-70">Campo:</span>
                        <span className="max-w-42 truncate">{field.label}</span>
                        <button
                          type="button"
                          onClick={() => removeSelectedField(field.key)}
                          className="hover:bg-primary/20 ml-1 rounded-full p-0.5 transition-colors"
                          aria-label={`Quitar campo ${field.label}`}
                        >
                          <X size={10} />
                        </button>
                      </div>
                    ))}

                    {referenceChips.map((chip) => (
                      <button
                        key={chip.key}
                        type="button"
                        onClick={() => setOpenIA(true)}
                        className="organic-chip organic-interactive flex min-w-0 items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold"
                      >
                        <Paperclip size={11} />
                        <span className="max-w-40 truncate">{chip.label}</span>
                      </button>
                    ))}
                  </div>
                )}

                <div className="flex items-end gap-2">
                  <div className="relative min-w-0 flex-1 px-1 py-0.5 transition">
                    {!input.trim() && (
                      <div className="text-muted-foreground pointer-events-none absolute top-1 left-1 text-sm md:text-base">
                        {selectedFields.length > 0 || totalReferencias > 0
                          ? 'Añade instrucciones o ajusta el contexto...'
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

                        if (
                          e.key === 'Enter' &&
                          !e.shiftKey &&
                          !showSuggestions
                        ) {
                          e.preventDefault()

                          if (isBusy) return

                          void handleSend()
                        }
                      }}
                      className="max-h-44 min-h-10 overflow-y-auto bg-transparent p-0 text-sm leading-6 wrap-break-word whitespace-pre-wrap outline-none md:text-base md:leading-7"
                    />
                  </div>

                  <div className="flex shrink-0 items-center gap-1.5 pb-0.5">
                    <ReasoningEffortSelect
                      compact
                      value={reasoningEffort}
                      onChange={setReasoningEffort}
                      disabled={isBusy}
                    />

                    <TooltipProvider delayDuration={250}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            onClick={() => setOpenIA(true)}
                            className={cn(
                              'organic-interactive border-border/70 bg-background/70 text-muted-foreground hover:bg-accent hover:text-accent-foreground inline-flex h-9 w-9 items-center justify-center rounded-full border shadow-sm',
                              totalReferencias > 0 &&
                                'border-primary/30 bg-primary/10 text-primary',
                            )}
                            aria-label="Gestionar referencias"
                          >
                            <Paperclip size={15} />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>
                          {totalReferencias > 0
                            ? `${totalReferencias} referencia(s)`
                            : 'Agregar referencias'}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>

                    <TooltipProvider delayDuration={250}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            onClick={() =>
                              setWebSearchEnabled((enabled) => !enabled)
                            }
                            className={cn(
                              'organic-interactive inline-flex h-9 items-center gap-1.5 rounded-full border px-2.5 text-[11px] font-semibold shadow-sm',
                              webSearchEnabled
                                ? 'border-primary/40 bg-primary text-primary-foreground'
                                : 'border-border/70 bg-background/70 text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                            )}
                            aria-pressed={webSearchEnabled}
                            aria-label={
                              webSearchEnabled
                                ? 'Desactivar busqueda web'
                                : 'Activar busqueda web'
                            }
                          >
                            <Globe2 size={14} />
                            <span className="hidden sm:inline">Web</span>
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>
                          {webSearchEnabled
                            ? 'Buscar en internet activado'
                            : 'Buscar en internet desactivado'}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>

                    <Button
                      onClick={() => handleSend()}
                      disabled={
                        isBusy || (!input.trim() && selectedFields.length === 0)
                      }
                      size="icon"
                      aria-label="Enviar solicitud"
                      className="border-border/70 bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:ring-primary/30 h-10 w-10 shrink-0 rounded-full border shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md focus-visible:ring-2 focus-visible:ring-offset-2 active:translate-y-0 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none disabled:hover:translate-y-0 md:h-11 md:w-11"
                    >
                      {isBusy ? (
                        <Loader2 className="animate-spin" size={15} />
                      ) : (
                        <Send size={15} />
                      )}
                    </Button>
                  </div>
                </div>
              </div>

              <div
                className={
                  chatOnly
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
                <span
                  className={cn(
                    'rounded-full border px-2 py-1',
                    webSearchEnabled
                      ? 'border-primary/20 bg-primary/10 text-primary'
                      : 'border-border bg-background',
                  )}
                >
                  Web {webSearchEnabled ? 'activada' : 'apagada'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Drawer open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
        <DrawerContent className="mx-auto flex h-[82vh] w-full max-w-2xl flex-col">
          <DrawerHeader className="px-4 pt-1 pb-3">
            <DrawerTitle>Historial de chats</DrawerTitle>
          </DrawerHeader>

          <div className="px-4 pb-3">
            <Button
              onClick={() => {
                createNewChat()
                setIsHistoryOpen(false)
              }}
              className="w-full shadow-sm"
            >
              <MessageSquarePlus size={18} className="mr-2" /> Nuevo Chat
            </Button>
          </div>

          <ScrollArea className="flex-1 px-2 pb-4">
            <p className="text-muted-foreground px-2 pt-1 pb-2 text-xs font-bold tracking-wider uppercase">
              {showArchived ? 'Archivados' : 'Historial Reciente'}
            </p>
            <div className="space-y-1">
              {(showArchived ? archivedChats : visibleActiveChats).map(
                (chat) => (
                  <button
                    type="button"
                    key={chat.id}
                    onClick={() => {
                      onActiveChatChange(chat.id)
                      setIsHistoryOpen(false)
                    }}
                    className={cn(
                      'hover:bg-accent/60 flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm transition-colors',
                      chat.id === activeChatId &&
                        'bg-primary/10 text-foreground font-medium',
                    )}
                  >
                    <MessageSquare className="text-muted-foreground/60 h-4 w-4 shrink-0" />
                    <span className="line-clamp-1 flex-1">
                      {formatChatTitle(chat)}
                    </span>
                  </button>
                ),
              )}
              {(showArchived ? archivedChats : visibleActiveChats).length ===
                0 && (
                <p className="text-muted-foreground px-3 py-8 text-center text-sm">
                  No hay chats {showArchived ? 'archivados' : 'todavía'}.
                </p>
              )}
            </div>
          </ScrollArea>
        </DrawerContent>
      </Drawer>

      <Drawer open={openIA} onOpenChange={setOpenIA}>
        <DrawerContent className="bg-background fixed inset-x-0 bottom-0 mx-auto mb-4 flex h-[80vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border shadow-2xl">
          <DrawerHeader className="bg-muted/50 border-border flex-row items-center justify-between border-b px-4 py-3 text-left">
            <div className="min-w-0">
              <DrawerTitle className="text-muted-foreground text-xs font-bold tracking-wider uppercase">
                Referencias para la IA
              </DrawerTitle>
              <DrawerDescription className="sr-only">
                Selecciona archivos, repositorios o documentos subidos para
                usarlos como contexto de la conversación.
              </DrawerDescription>
            </div>
            <button
              type="button"
              aria-label="Cerrar referencias"
              onClick={() => setOpenIA(false)}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <X size={18} />
            </button>
          </DrawerHeader>

          <div className="flex-1 overflow-y-auto p-4">
            <ReferenciasParaIA
              selectedArchivoIds={selectedArchivoIds}
              selectedRepositorioIds={selectedRepositorioIds}
              uploadedFiles={uploadedFiles}
              onReferenceMetadataChange={setReferenceMetadata}
              autoScrollToDropzone={false}
              enableSha256Dedupe={true}
              enableAutoUpload={true}
              onToggleArchivo={(id, checked) => {
                setSelectedArchivoIds((prev) =>
                  checked ? [...prev, id] : prev.filter((item) => item !== id),
                )
              }}
              onToggleRepositorio={(id, checked) => {
                setSelectedRepositorioIds((prev) =>
                  checked ? [...prev, id] : prev.filter((item) => item !== id),
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

function formatChatTitle(
  chat: AIChatConversation | null,
  fallbackPrefix = 'Chat',
) {
  if (!chat) return 'Selecciona un chat'
  if (chat.nombre) return chat.nombre
  if (chat.titulo) return chat.titulo

  const [date = '', time = ''] = String(chat.creado_en || '').split('T')
  const shortTime = time ? time.slice(0, 5) : ''
  return `${fallbackPrefix} ${date} ${shortTime}`.trim()
}

function injectFieldsIntoInput(baseInput: string, fields: Array<AIChatField>) {
  const cleaned = baseInput.replace(/[/\s]+[^/]*$/, '').trim()

  if (fields.length === 0) return cleaned

  const fieldLabels = fields.map((field) => field.label).join(', / ')
  return `${cleaned}  ${fieldLabels},  `
}
