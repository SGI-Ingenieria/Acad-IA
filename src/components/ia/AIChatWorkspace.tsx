import { Link } from '@tanstack/react-router'
import {
  AlertTriangle,
  Archive,
  Brain,
  Check,
  FileText,
  Globe2,
  Maximize2,
  MessageSquare,
  MessageSquarePlus,
  Minimize2,
  Paperclip,
  PanelLeftOpen,
  Plus,
  Upload,
  X,
} from 'lucide-react'
import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react'

import type { ChatReferenceUploadItem } from '@/components/ia/chatReferenceUploads'
import type { ReasoningEffortOption } from '@/components/ia/ReasoningEffortSelect'
import type { ReactNode } from 'react'

import { AssistantMessageActions } from '@/components/ia/AssistantMessageActions'
import { ChatReferenceUploadAttachments } from '@/components/ia/ChatReferenceUploadAttachments'
import {
  CHAT_REFERENCE_FILE_ACCEPT,
  chatReferenceFileFingerprint,
  chatReferenceUploadReducer,
  extractClipboardReferenceFiles,
  revokeChatReferencePreviewUrls,
  selectChatReferenceUploadBatch,
} from '@/components/ia/chatReferenceUploads'
import { buildIsolatedChatRetryContext } from '@/components/ia/chatRetryContext'
import { ChatSendButton } from '@/components/ia/ChatSendButton'
import { ChatSidebar, formatChatTitle } from '@/components/ia/ChatSidebar'
import { FieldSuggestions } from '@/components/ia/FieldSuggestions'
import { REASONING_EFFORT_OPTIONS } from '@/components/ia/ReasoningEffortSelect'
import { VoiceDictation } from '@/components/ia/VoiceDictation'
import { ChatFilesAside } from '@/components/referencias/ChatFilesAside'
import { GlobalFileDropOverlay } from '@/components/referencias/GlobalFileDropOverlay'
import { Button } from '@/components/ui/button'
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  useAdjuntarArchivoConversacion,
  useArchivosConversacion,
  useBibliotecaReferencias,
  useQuitarArchivoConversacion,
  useSubirDocumento,
} from '@/data/hooks/useDocumentos'
import { getEdgeFunctionErrorCode } from '@/data/supabase/invokeEdge'
import {
  getOrganicMotion,
  gsap,
  organicDuration,
  organicEase,
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
  createdAt?: string | null
  requestContent?: string
  requestFieldKeys?: Array<string>
}

export interface AIChatSendPayload {
  content: string
  fields: Array<AIChatField>
  fieldKeys: Array<string>
  references: {
    fileIds: Array<string>
    collectionIds: Array<string>
  }
  webSearchEnabled: boolean
  reasoningEffort: ReasoningEffortOption
  retryOfMessageId?: string
}

export type AIChatCancellationOutcome =
  | 'cancelled'
  | 'finished'
  | 'pending'
  | 'stale'

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
  conversationType,
  conversations,
  messages,
  activeChatId,
  onActiveChatChange,
  conversationsLoading = false,
  messagesLoading = false,
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
  conversationType: 'plan' | 'asignatura'
  conversations: Array<AIChatConversation>
  messages: Array<AIChatMessage>
  activeChatId: string | undefined
  onActiveChatChange: (id: string | undefined) => void
  conversationsLoading?: boolean
  messagesLoading?: boolean
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
  onCancelMessage?: (
    message: AIChatMessage,
  ) => Promise<AIChatCancellationOutcome>
  renderAssistantExtras?: (
    message: AIChatMessage,
    helpers: AIChatRenderHelpers,
  ) => ReactNode
}) {
  const [openIA, setOpenIA] = useState(false)
  const [selectedArchivoIds, setSelectedArchivoIds] = useState<Array<string>>(
    [],
  )
  const [selectedColeccionIds, setSelectedColeccionIds] = useState<
    Array<string>
  >([])
  const [pendingReferenceUploads, dispatchReferenceUpload] = useReducer(
    chatReferenceUploadReducer,
    [],
  )
  const pendingReferenceUploadsRef = useRef<Array<ChatReferenceUploadItem>>([])
  const uploadIdByFileRef = useRef(new WeakMap<File, string>())
  const knownUploadFingerprintsRef = useRef(new Set<string>())
  const previewUrlsRef = useRef(new Map<string, string>())
  const activeChatIdRef = useRef(activeChatId)
  const uploadInputRef = useRef<HTMLInputElement>(null)
  const referenceLibrary = useBibliotecaReferencias({
    query: '',
    sort: 'updated_desc',
  })
  const uploadReference = useSubirDocumento({
    onProgress: (file, progress) => {
      const uploadId = uploadIdByFileRef.current.get(file)
      if (uploadId) {
        dispatchReferenceUpload({
          type: 'progress',
          id: uploadId,
          progress: progress.percentage,
        })
      }
    },
  })
  const conversationFiles = useArchivosConversacion(
    conversationType,
    activeChatId,
  )
  const attachConversationFile = useAdjuntarArchivoConversacion()
  const detachConversationFile = useQuitarArchivoConversacion()
  const [input, setInput] = useState('')
  const [selectedFields, setSelectedFields] = useState<Array<AIChatField>>([])
  const [webSearchEnabled, setWebSearchEnabled] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [filterQuery, setFilterQuery] = useState('')
  const [highlightedIndex, setHighlightedIndex] = useState(0)
  const [showArchived, setShowArchived] = useState(false)
  const [isChatListCollapsed, setIsChatListCollapsed] = useState(false)
  const [isHistoryOpen, setIsHistoryOpen] = useState(false)
  const [pendingMessage, setPendingMessage] =
    useState<PendingChatMessage | null>(null)
  const [cancellingMessageId, setCancellingMessageId] = useState<string | null>(
    null,
  )
  const [retryingMessageId, setRetryingMessageId] = useState<string | null>(
    null,
  )

  const conversationReferencesById = useMemo(
    () =>
      new Map(
        (conversationFiles.data ?? []).map((reference) => [
          reference.fileId,
          reference,
        ]),
      ),
    [conversationFiles.data],
  )

  const releaseReferenceUploadPreview = useCallback((uploadId: string) => {
    const url = previewUrlsRef.current.get(uploadId)
    if (!url) return
    URL.revokeObjectURL(url)
    previewUrlsRef.current.delete(uploadId)
  }, [])

  const clearPendingReferenceUploads = useCallback(() => {
    revokeChatReferencePreviewUrls(previewUrlsRef.current)
    pendingReferenceUploadsRef.current = []
    uploadIdByFileRef.current = new WeakMap<File, string>()
    knownUploadFingerprintsRef.current.clear()
    dispatchReferenceUpload({ type: 'clear' })
  }, [])

  useEffect(() => {
    activeChatIdRef.current = activeChatId
  }, [activeChatId])

  useEffect(() => {
    clearPendingReferenceUploads()
    setSelectedArchivoIds([])
    setSelectedColeccionIds([])
  }, [activeChatId, clearPendingReferenceUploads])

  useEffect(
    () => () => revokeChatReferencePreviewUrls(previewUrlsRef.current),
    [],
  )

  useEffect(() => {
    if (activeChatId && conversationFiles.data) {
      setSelectedArchivoIds(
        conversationFiles.data
          .filter((reference) => reference.active)
          .map((reference) => reference.fileId),
      )
    }
  }, [activeChatId, conversationFiles.data])
  const [draftChatStarted, setDraftChatStarted] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [reasoningEffort, setReasoningEffort] =
    useState<ReasoningEffortOption>('auto')
  const lastPrefillToken = useRef<string | number | null | undefined>(undefined)
  const workspaceRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const composerRef = useRef<HTMLDivElement>(null)
  const composerShellRef = useRef<HTMLDivElement>(null)
  const suggestionsRef = useRef<HTMLDivElement>(null)
  const pendingFieldUndo = useRef<AIChatField | null>(null)
  const isInitialLoad = useRef(true)
  const prevMessagesCount = useRef<number>(0)
  const lastAnimatedChatKey = useRef<string | null>(null)
  const animatedMessageCount = useRef(0)

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

  const safeHighlightedIndex =
    filteredFields.length > 0
      ? Math.min(highlightedIndex, filteredFields.length - 1)
      : 0

  const totalReferencias =
    selectedArchivoIds.length +
    selectedColeccionIds.length +
    pendingReferenceUploads.length
  const hasUnresolvedReferenceUploads = pendingReferenceUploads.length > 0

  const archivoLabelsById = useMemo(
    () =>
      new Map(
        (referenceLibrary.data?.files ?? []).map((archivo) => [
          archivo.id,
          archivo.display_name,
        ]),
      ),
    [referenceLibrary.data?.files],
  )

  const coleccionLabelsById = useMemo(
    () =>
      new Map(
        (referenceLibrary.data?.collections ?? []).map((coleccion) => [
          coleccion.id,
          coleccion.name,
        ]),
      ),
    [referenceLibrary.data?.collections],
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
        selectedColeccionIds.length > 0
          ? {
              key: 'colecciones',
              label: compactReferenceLabel(
                'Colección',
                selectedColeccionIds,
                coleccionLabelsById,
              ),
            }
          : null,
      ].filter((chip): chip is { key: string; label: string } => Boolean(chip)),
    [
      archivoLabelsById,
      coleccionLabelsById,
      selectedArchivoIds,
      selectedColeccionIds,
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

    const visibleMessages = messages.filter(
      (message) =>
        !(
          message.role === 'assistant' &&
          (message.isProcessing || message.status === 'processing')
        ),
    )

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

    return [...draftMessages, ...visibleMessages, ...pendingMessages]
  }, [draftChatStarted, messages, visiblePendingMessage])

  const activeProcessingMessage = useMemo(
    () =>
      [...messages]
        .reverse()
        .find(
          (message) =>
            message.role === 'assistant' &&
            (message.isProcessing || message.status === 'processing'),
        ) ?? null,
    [messages],
  )
  const activeProcessingMessageId = activeProcessingMessage
    ? (activeProcessingMessage.dbMessageId ?? activeProcessingMessage.id)
    : null
  const canCancelActiveMessage = Boolean(
    onCancelMessage &&
    activeProcessingMessage?.dbMessageId &&
    activeProcessingMessage.openaiResponseId,
  )
  const isCancellingActiveMessage = Boolean(
    activeProcessingMessageId &&
    cancellingMessageId === activeProcessingMessageId,
  )
  const isChatHydrating = Boolean(activeChatId && messagesLoading)
  // Fase (a): mensaje enviado pero aún sin confirmación del servidor (no existe
  // todavía un mensaje del asistente "procesando"). Solo mostramos los puntitos.
  const isPendingConfirmation =
    Boolean(visiblePendingMessage) && !activeProcessingMessage && isBusy
  // El texto "La IA está analizando…" solo en fase (b) o al hidratar/cargar,
  // nunca durante la fase (a) de puntitos.
  const showActivityIndicator =
    (isBusy || isChatHydrating || (conversationsLoading && !activeChatId)) &&
    !isPendingConfirmation
  const isComposerLocked = isBusy || isChatHydrating
  const activityLabel =
    isChatHydrating && !isBusy
      ? 'Cargando conversación...'
      : conversationsLoading && !activeChatId
        ? 'Cargando historial...'
        : busyLabel

  const mainStatusLabel =
    isBusy || isChatHydrating
      ? isChatHydrating && !isBusy
        ? 'Cargando chat'
        : 'Analizando solicitud'
      : activeChatId
        ? 'Chat activo'
        : 'Sin chat seleccionado'

  const reasoningEffortLabel =
    REASONING_EFFORT_OPTIONS.find((option) => option.value === reasoningEffort)
      ?.label ?? 'Auto'

  const isEmptyChat =
    !activeChatId &&
    displayMessages.length === 0 &&
    !visiblePendingMessage &&
    !conversationsLoading

  useGSAP(
    () => {
      if (!getOrganicMotion()) return

      const shell = composerShellRef.current
      if (!shell) return

      gsap.fromTo(
        shell,
        { y: 10, opacity: 0.86 },
        {
          y: 0,
          opacity: 1,
          duration: organicDuration.slow,
          ease: organicEase,
        },
      )
    },
    { scope: workspaceRef },
  )

  useGSAP(
    () => {
      if (!getOrganicMotion()) return

      const messageElements = Array.from(
        workspaceRef.current?.querySelectorAll('.ai-chat-message') ?? [],
      )

      if (messageElements.length === 0) {
        animatedMessageCount.current = 0
        return
      }

      const chatKey = `${activeChatId ?? 'draft'}-${draftChatStarted}`
      const isNewBatch = lastAnimatedChatKey.current !== chatKey
      lastAnimatedChatKey.current = chatKey

      const targets = isNewBatch
        ? messageElements
        : messageElements.slice(animatedMessageCount.current)
      animatedMessageCount.current = messageElements.length

      if (targets.length === 0) return

      gsap.fromTo(
        targets,
        { y: 8, opacity: 0, filter: 'blur(6px)' },
        {
          y: 0,
          opacity: 1,
          filter: 'blur(0px)',
          duration: organicDuration.slow,
          ease: organicEase,
          stagger: isNewBatch ? 0.025 : 0,
          overwrite: 'auto',
        },
      )
    },
    {
      scope: workspaceRef,
      dependencies: [displayMessages.length, activeChatId, draftChatStarted],
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
    if (isBusy || isChatHydrating) return
    setPendingMessage(null)
  }, [isBusy, isChatHydrating])

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

  useEffect(() => {
    if (!showSuggestions) return

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node
      if (
        suggestionsRef.current?.contains(target) ||
        composerRef.current?.contains(target)
      ) {
        return
      }
      setShowSuggestions(false)
      setFilterQuery('')
      setHighlightedIndex(0)
    }

    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [showSuggestions])

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

  const closeSuggestions = () => {
    setShowSuggestions(false)
    setFilterQuery('')
    setHighlightedIndex(0)
  }

  const createNewChat = () => {
    onActiveChatChange(undefined)
    setDraftChatStarted(true)
    setPendingMessage(null)
    setInput('')
    setSelectedFields([])
    setSelectedArchivoIds([])
    setSelectedColeccionIds([])
    clearPendingReferenceUploads()
    setWebSearchEnabled(false)
    setReasoningEffort('auto')
    closeSuggestions()
    pendingFieldUndo.current = null
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
    pendingFieldUndo.current = null
    const val = e.currentTarget.innerText.replace(/\u00a0/g, ' ')
    const cursorPosition = getComposerCaretOffset(e.currentTarget)
    setInput(val)

    const textBeforeCursor = val.slice(0, cursorPosition)
    const match = textBeforeCursor.match(/\/(\w*)$/)

    if (match) {
      setShowSuggestions(true)
      setFilterQuery(match[1])
      setHighlightedIndex(0)
    } else {
      setShowSuggestions(false)
      setFilterQuery('')
    }
  }

  const handleComposerPaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    const files = extractClipboardReferenceFiles(e.clipboardData)
    if (files.length > 0) {
      e.preventDefault()
      e.stopPropagation()
      handleReferenceFiles(files)
      return
    }

    e.preventDefault()
    const pastedText = e.clipboardData.getData('text/plain')
    document.execCommand('insertText', false, pastedText)
  }

  const focusComposerAtEnd = () => {
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

  const toggleField = (field: AIChatField) => {
    setSelectedFields((prev) => {
      const isSelected = prev.find((item) => item.key === field.key)
      return isSelected ? prev : [...prev, field]
    })

    setInput((prev) => prev.replace(/\/(\w*)$/, ` ${field.label} `))

    closeSuggestions()
    pendingFieldUndo.current = field
    focusComposerAtEnd()
  }

  // Deshacer el campo recién insertado con Tab/Enter: solo es válido mientras
  // no se haya escrito nada más (pendingFieldUndo se limpia en el onInput).
  const undoPendingField = () => {
    const field = pendingFieldUndo.current
    pendingFieldUndo.current = null
    if (!field) return false

    if (!selectedFields.some((item) => item.key === field.key)) return false

    removeSelectedField(field.key)
    setInput((prev) => {
      const suffix = ` ${field.label} `
      return prev.endsWith(suffix)
        ? prev.slice(0, prev.length - suffix.length)
        : prev
    })
    focusComposerAtEnd()
    return true
  }

  const removeSelectedField = (fieldKey: string) => {
    if (pendingFieldUndo.current?.key === fieldKey) {
      pendingFieldUndo.current = null
    }
    setSelectedFields((prev) => prev.filter((field) => field.key !== fieldKey))
  }

  const clearComposer = () => {
    setInput('')
    closeSuggestions()
    pendingFieldUndo.current = null
    syncComposerText('')
  }

  const handleTranscript = (text: string) => {
    setInput((prev) => {
      const sep = prev && !/\s$/.test(prev) ? ' ' : ''
      const next = `${prev}${sep}${text}`
      syncComposerText(next)
      return next
    })
    focusComposerAtEnd()
  }

  const handleSend = async () => {
    const rawText = input
    if (hasUnresolvedReferenceUploads) {
      notify.info('Termina o retira las cargas pendientes antes de enviar.')
      return
    }
    if (isComposerLocked || (!rawText.trim() && selectedFields.length === 0)) {
      return
    }

    const currentFields = [...selectedFields]
    const finalContent = rawText.trim()
      ? rawText
      : `Mejora ${currentFields.map((field) => field.label).join(', ')}.`
    const fileIds = Array.from(new Set(selectedArchivoIds))
    const collectionIds = Array.from(new Set(selectedColeccionIds))
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
        references: { fileIds, collectionIds },
        webSearchEnabled,
        reasoningEffort,
      })

      if (response?.conversationId) {
        onActiveChatChange(response.conversationId)
      }

      if (activeChatId) void conversationFiles.refetch()

      setPendingMessage(null)
      setSelectedFields([])
      setSelectedColeccionIds([])
      setWebSearchEnabled(false)
      setDraftChatStarted(false)
    } catch (error) {
      setPendingMessage(null)
      setInput(finalContent)
      syncComposerText(finalContent)
      if (wasDraftChat) {
        setDraftChatStarted(true)
      }
      if (getEdgeFunctionErrorCode(error) === 'DOCUMENT_STILL_PROCESSING') {
        notify.warning(
          'El documento sigue preparándose; reintenta en unos momentos.',
          {
            description:
              'Tu mensaje y sus referencias siguen listos en el compositor.',
          },
        )
      } else {
        notify.error('No se pudo enviar el mensaje.', {
          description:
            'Tu mensaje y sus referencias siguen listos para reintentar.',
        })
      }
      console.error(error)
    }
  }

  async function uploadPendingReference(upload: ChatReferenceUploadItem) {
    try {
      const result = await uploadReference.mutateAsync(upload.file)
      if (!result.fileId) {
        throw new Error(
          'El archivo se transfirió, pero todavía no está disponible. Reintenta la carga.',
        )
      }

      const stillTracked = pendingReferenceUploadsRef.current.some(
        (current) => current.id === upload.id,
      )
      if (!stillTracked) {
        releaseReferenceUploadPreview(upload.id)
        uploadIdByFileRef.current.delete(upload.file)
        return
      }

      const fileId = result.fileId
      if ((activeChatIdRef.current ?? null) === upload.conversationId) {
        setSelectedArchivoIds((current) =>
          Array.from(new Set([...current, fileId])),
        )
      }

      if (upload.conversationId) {
        attachConversationFile.mutate({
          conversationType,
          conversationId: upload.conversationId,
          fileId,
        })
      }

      releaseReferenceUploadPreview(upload.id)
      uploadIdByFileRef.current.delete(upload.file)
      pendingReferenceUploadsRef.current =
        pendingReferenceUploadsRef.current.filter(
          (current) => current.id !== upload.id,
        )
      dispatchReferenceUpload({ type: 'remove', id: upload.id })
    } catch (error) {
      if (
        !pendingReferenceUploadsRef.current.some(
          (current) => current.id === upload.id,
        )
      ) {
        return
      }
      dispatchReferenceUpload({
        type: 'failed',
        id: upload.id,
        error:
          error instanceof Error
            ? error.message
            : 'No se pudo subir el archivo.',
      })
    }
  }

  function handleReferenceFiles(files: Array<File>) {
    const { accepted, duplicateCount, overflowCount } =
      selectChatReferenceUploadBatch(files, knownUploadFingerprintsRef.current)

    if (duplicateCount > 0) {
      notify.info(
        duplicateCount === 1
          ? 'Ese archivo ya se está añadiendo o fue añadido.'
          : `Se omitieron ${duplicateCount} archivos duplicados.`,
      )
    }
    if (overflowCount > 0) {
      notify.warning('Puedes añadir hasta cinco archivos a la vez.', {
        description: `Se omitieron ${overflowCount} archivos adicionales.`,
      })
    }
    if (!accepted.length) return

    const uploads = accepted.map((file) => {
      const fingerprint = chatReferenceFileFingerprint(file)
      const id = `chat-upload:${crypto.randomUUID()}`
      const previewUrl = file.type.startsWith('image/')
        ? URL.createObjectURL(file)
        : null

      knownUploadFingerprintsRef.current.add(fingerprint)
      uploadIdByFileRef.current.set(file, id)
      if (previewUrl) previewUrlsRef.current.set(id, previewUrl)

      return {
        id,
        fingerprint,
        file,
        previewUrl,
        status: 'uploading' as const,
        progress: 0,
        error: null,
        conversationId: activeChatId ?? null,
      }
    })

    pendingReferenceUploadsRef.current = [
      ...pendingReferenceUploadsRef.current,
      ...uploads,
    ]
    dispatchReferenceUpload({ type: 'queue', items: uploads })
    uploads.forEach((upload) => void uploadPendingReference(upload))
  }

  function retryReferenceUpload(upload: ChatReferenceUploadItem) {
    dispatchReferenceUpload({ type: 'retry', id: upload.id })
    uploadIdByFileRef.current.set(upload.file, upload.id)
    void uploadPendingReference(upload)
  }

  function removeFailedReferenceUpload(upload: ChatReferenceUploadItem) {
    knownUploadFingerprintsRef.current.delete(upload.fingerprint)
    uploadIdByFileRef.current.delete(upload.file)
    releaseReferenceUploadPreview(upload.id)
    pendingReferenceUploadsRef.current =
      pendingReferenceUploadsRef.current.filter(
        (current) => current.id !== upload.id,
      )
    dispatchReferenceUpload({ type: 'remove', id: upload.id })
  }

  const handleDroppedReferences = (files: Array<File>) => {
    handleReferenceFiles(files)
  }

  const selectUploadedReference = (fileId: string) => {
    if (!fileId) return
    if ((activeChatIdRef.current ?? null) === (activeChatId ?? null)) {
      setSelectedArchivoIds((current) =>
        Array.from(new Set([...current, fileId])),
      )
    }
    if (activeChatId)
      attachConversationFile.mutate({
        conversationType,
        conversationId: activeChatId,
        fileId,
      })
  }

  const toggleConversationFile = (fileId: string, selected: boolean) => {
    const persistedReference = conversationReferencesById.get(fileId)
    if (!selected && persistedReference && !persistedReference.canRemove) {
      notify.info('Esta referencia ya forma parte del historial del chat.', {
        description: 'Los archivos utilizados no se pueden retirar.',
      })
      return
    }

    setSelectedArchivoIds((current) =>
      selected
        ? Array.from(new Set([...current, fileId]))
        : current.filter((id) => id !== fileId),
    )
    if (!activeChatId) return
    const fileLink = {
      conversationType,
      conversationId: activeChatId,
      fileId,
    }
    if (selected) attachConversationFile.mutate(fileLink)
    else detachConversationFile.mutate(fileLink)
  }

  const toggleReferenceCollection = (
    collectionId: string,
    selected: boolean,
  ) => {
    setSelectedColeccionIds((current) =>
      selected
        ? Array.from(new Set([...current, collectionId]))
        : current.filter((id) => id !== collectionId),
    )
  }

  const handleCancelAssistantMessage = async (message: AIChatMessage) => {
    if (!onCancelMessage) return

    const messageId = message.dbMessageId ?? message.id
    const toastId = notify.loading('Cancelando respuesta...')
    setCancellingMessageId(messageId)

    try {
      const outcome = await onCancelMessage(message)
      notify.dismiss(toastId)
      if (outcome === 'cancelled') {
        notify.success('Respuesta cancelada')
      } else if (outcome === 'finished') {
        notify.info('La respuesta terminó antes de poder cancelarla.')
      } else if (outcome === 'pending') {
        notify.info(
          'Otra línea de defensa está aplicando la respuesta. Seguimos esperando.',
        )
      } else {
        notify.info('Esta respuesta ya no era la generación vigente.')
      }
    } catch (error) {
      notify.dismiss(toastId)
      notify.error('No se pudo cancelar la respuesta.')
      console.error(error)
    } finally {
      setCancellingMessageId(null)
    }
  }

  const handleRetryAssistantMessage = async (message: AIChatMessage) => {
    const retryContext = buildIsolatedChatRetryContext(message)
    const { content, retryOfMessageId } = retryContext
    if (
      !content ||
      !retryOfMessageId ||
      isComposerLocked ||
      retryingMessageId
    ) {
      return
    }

    notify.info('Se reutilizará la solicitud original completa.', {
      description:
        'El servidor conservará texto, campos, referencias y ajustes sin mezclar el compositor actual.',
    })
    setRetryingMessageId(message.id)
    setPendingMessage({
      id: `pending-retry-message-${Date.now()}`,
      content,
      baseMessageCount: messages.length,
    })

    try {
      const response = await onSend({
        content,
        fields: [],
        fieldKeys: [],
        references: { fileIds: [], collectionIds: [] },
        webSearchEnabled: false,
        reasoningEffort: 'auto',
        retryOfMessageId,
      })
      if (response?.conversationId) {
        onActiveChatChange(response.conversationId)
      }
      if (activeChatId) void conversationFiles.refetch()
      setPendingMessage(null)
      notify.success('Generando una nueva respuesta.')
    } catch (error) {
      setPendingMessage(null)
      notify.error('No se pudo volver a generar la respuesta.')
      console.error(error)
    } finally {
      setRetryingMessageId(null)
    }
  }

  return (
    <div
      ref={workspaceRef}
      className={
        chatOnly
          ? 'flex h-dvh w-full flex-col gap-2 overflow-hidden pt-2 pb-1'
          : 'flex h-[calc(100vh-80px)] w-full flex-col gap-3 pb-1 md:h-[calc(100vh-160px)] md:max-h-[calc(100vh-160px)] md:overflow-hidden'
      }
    >
      <GlobalFileDropOverlay onFiles={handleDroppedReferences} acceptPaste />
      <input
        ref={uploadInputRef}
        type="file"
        multiple
        accept={CHAT_REFERENCE_FILE_ACCEPT}
        className="sr-only"
        onChange={(event) => {
          const files = Array.from(event.target.files ?? [])
          event.target.value = ''
          handleReferenceFiles(files)
        }}
      />
      {chatOnly && (
        <div className="flex shrink-0 justify-end gap-2 px-4 md:px-5">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setOpenIA(true)}
          >
            <Paperclip size={14} />
            Archivos{totalReferencias ? ` (${totalReferencias})` : ''}
          </Button>
          <Link
            to={exitRoute.to}
            params={exitRoute.params as any}
            className="bg-secondary text-secondary-foreground hover:bg-secondary/80 flex items-center gap-2 rounded-md px-3 py-2 text-xs font-medium transition"
          >
            <Minimize2 size={14} className="opacity-70" />
          </Link>
        </div>
      )}

      {!chatOnly && (
        <div className="border-border/40 bg-background flex shrink-0 items-center justify-between rounded-lg border-[0.5px] p-2 md:hidden">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsHistoryOpen(true)}
          >
            <Archive size={18} className="mr-2" /> Historial
          </Button>
        </div>
      )}

      <div
        className={
          chatOnly
            ? 'bg-background flex min-h-0 w-full flex-1 overflow-hidden'
            : 'border-border/50 bg-background flex min-h-0 flex-1 overflow-hidden rounded-xl border-[0.5px]'
        }
      >
        {!chatOnly && (
          <ChatSidebar
            collapsed={isChatListCollapsed}
            activeChats={visibleActiveChats}
            archivedChats={archivedChats}
            activeChatId={activeChatId}
            showArchived={showArchived}
            onShowArchivedChange={setShowArchived}
            onSelectChat={(id) => onActiveChatChange(id)}
            onNewChat={createNewChat}
            onArchive={handleArchive}
            onUnarchive={handleUnarchive}
            onRename={(id, nextName, previousName) => {
              void renameChatById(id, nextName, previousName)
            }}
            onCollapse={() => setIsChatListCollapsed(true)}
          />
        )}

        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          {!chatOnly && (
            <div className="border-border/40 bg-background flex min-h-12 shrink-0 items-center gap-2 border-b-[0.5px] px-3 py-2">
              {isChatListCollapsed && (
                <TooltipProvider delayDuration={250}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => setIsChatListCollapsed(false)}
                        aria-label="Mostrar lista de chats"
                        className="hidden h-8 w-8 shrink-0 md:inline-flex"
                      >
                        <PanelLeftOpen size={16} />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Mostrar lista de chats</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}

              <div className="flex min-w-0 flex-1 items-center">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span
                      role="textbox"
                      tabIndex={activeChatId ? 0 : -1}
                      contentEditable={Boolean(activeChatId)}
                      suppressContentEditableWarning
                      spellCheck={false}
                      aria-label="Nombre del chat"
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
                      className={`text-foreground max-w-full min-w-0 border-b text-sm leading-6 font-medium whitespace-pre-wrap outline-none ${
                        activeChatId
                          ? 'hover:border-input focus:border-ring/50 cursor-text border-transparent wrap-break-word'
                          : 'cursor-default border-transparent'
                      }`}
                    >
                      {activeChatTitle}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    {activeChatId
                      ? 'Nombre del chat'
                      : 'Selecciona o crea un chat para nombrarlo'}
                  </TooltipContent>
                </Tooltip>
              </div>

              <span role="status" className="sr-only">
                {mainStatusLabel}
              </span>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="relative size-8"
                    aria-label="Ver archivos en el chat"
                    onClick={() => setOpenIA(true)}
                  >
                    <Paperclip size={15} />
                    {totalReferencias > 0 ? (
                      <span className="bg-primary text-primary-foreground absolute -top-1 -right-1 grid size-4 place-items-center rounded-full text-[9px] font-semibold">
                        {totalReferencias}
                      </span>
                    ) : null}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Ver archivos en el chat</TooltipContent>
              </Tooltip>

              <Link
                to={wideRoute.to}
                params={wideRoute.params as any}
                mask={wideRoute.mask as any}
                className="bg-secondary text-secondary-foreground hover:bg-secondary/80 inline-flex h-8 shrink-0 items-center gap-2 rounded-md px-3 text-xs font-medium transition"
              >
                <Maximize2 size={14} className="opacity-70" />
              </Link>
            </div>
          )}

          <div className="relative flex min-h-0 flex-1 flex-col">
            <ScrollArea ref={scrollRef} className="h-full w-full">
              <div
                className={
                  isEmptyChat
                    ? 'mx-auto flex min-h-full w-full max-w-3xl flex-col justify-center gap-5 px-4 py-5 md:px-6'
                    : 'mx-auto flex w-full max-w-3xl flex-col gap-5 px-4 py-5 md:px-6'
                }
              >
                {isEmptyChat ? (
                  <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
                    <MessageSquarePlus
                      size={40}
                      className="text-muted-foreground/40 mb-4"
                    />
                    <h3 className="text-foreground text-base font-semibold">
                      No hay un chat seleccionado
                    </h3>
                    <p className="text-muted-foreground mt-2 max-w-md text-sm leading-6">
                      {headerHelpText}
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
                      const isError = isAI && msg.status === 'error'
                      const isCancelled = isAI && msg.status === 'cancelled'

                      return (
                        <div
                          key={msg.id}
                          className={`ai-chat-message flex max-w-[90%] flex-col ${
                            isUser ? 'ml-auto items-end' : 'items-start'
                          }`}
                        >
                          <div
                            className={`relative text-base whitespace-pre-wrap ${
                              isUser
                                ? 'bg-muted text-foreground rounded-2xl rounded-br-md px-4 py-2.5'
                                : 'text-foreground w-full px-0 py-1 leading-7'
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

                            {isError ? (
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
                              !isError &&
                              !isCancelled &&
                              renderAssistantExtras?.(msg, {
                                removeSelectedField,
                              })}

                            {isAI && msg.dbMessageId && !msg.isProcessing ? (
                              <AssistantMessageActions
                                content={msg.content}
                                answeredAt={msg.createdAt}
                                status={msg.status}
                                retrying={retryingMessageId === msg.id}
                                onRetry={
                                  msg.dbMessageId &&
                                  msg.requestContent &&
                                  !isComposerLocked
                                    ? () => handleRetryAssistantMessage(msg)
                                    : undefined
                                }
                              />
                            ) : null}
                          </div>
                        </div>
                      )
                    })}

                    {showActivityIndicator && (
                      <div
                        aria-busy="true"
                        aria-live="polite"
                        className="animate-in fade-in text-muted-foreground flex items-center gap-2 text-sm"
                      >
                        <span className="bg-foreground/50 h-2 w-2 animate-pulse rounded-full" />
                        <span>{activityLabel}</span>
                        {canCancelActiveMessage && (
                          <span className="text-muted-foreground/70 text-xs">
                            — puedes cancelar
                          </span>
                        )}
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
                ? 'bg-background shrink-0 px-4 pt-1 pb-2 md:px-5'
                : 'bg-background shrink-0 px-4 pt-1 pb-3 md:px-5'
            }
          >
            <div className="relative mx-auto max-w-3xl">
              {showSuggestions && (
                <FieldSuggestions
                  ref={suggestionsRef}
                  query={filterQuery}
                  fields={filteredFields}
                  highlightedIndex={safeHighlightedIndex}
                  onHighlight={setHighlightedIndex}
                  onSelect={toggleField}
                />
              )}

              <div className="flex flex-col gap-1.5">
                {isPendingConfirmation && (
                  <div
                    role="status"
                    aria-label="Enviando tu solicitud"
                    className="animate-in fade-in slide-in-from-bottom-1 mb-0.5 flex justify-center"
                  >
                    <span className="bg-muted flex items-center gap-1 rounded-full px-3 py-2">
                      <span className="bg-foreground/50 h-1.5 w-1.5 animate-bounce rounded-full [animation-delay:-0.3s]" />
                      <span className="bg-foreground/50 h-1.5 w-1.5 animate-bounce rounded-full [animation-delay:-0.15s]" />
                      <span className="bg-foreground/50 h-1.5 w-1.5 animate-bounce rounded-full" />
                    </span>
                  </div>
                )}
                <div
                  ref={composerShellRef}
                  className="border-input bg-card relative rounded-3xl border-[0.5px] px-2.5 py-1.5 shadow-sm"
                >
                  <ChatReferenceUploadAttachments
                    uploads={pendingReferenceUploads}
                    onRetry={retryReferenceUpload}
                    onRemove={removeFailedReferenceUpload}
                  />
                  {(selectedFields.length > 0 ||
                    referenceChips.length > 0 ||
                    webSearchEnabled ||
                    reasoningEffort !== 'auto') && (
                    <div className="flex flex-wrap gap-1.5 px-1 pt-1.5 pb-0.5">
                      {selectedFields.map((field) => (
                        <div
                          key={field.key}
                          className="bg-primary/10 text-primary animate-in zoom-in-95 flex min-w-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium"
                        >
                          <span className="max-w-42 truncate">
                            {field.label}
                          </span>
                          <button
                            type="button"
                            onClick={() => removeSelectedField(field.key)}
                            className="hover:bg-primary/20 ml-0.5 rounded-full p-0.5 transition-colors"
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
                          className="bg-muted text-muted-foreground hover:bg-muted/80 flex min-w-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs transition-colors"
                        >
                          <Paperclip size={11} />
                          <span className="max-w-40 truncate">
                            {chip.label}
                          </span>
                        </button>
                      ))}

                      {webSearchEnabled && (
                        <div className="bg-primary/10 text-primary flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium">
                          <Globe2 size={11} />
                          Web
                          <button
                            type="button"
                            onClick={() => setWebSearchEnabled(false)}
                            className="hover:bg-primary/20 ml-0.5 rounded-full p-0.5 transition-colors"
                            aria-label="Desactivar búsqueda web"
                          >
                            <X size={10} />
                          </button>
                        </div>
                      )}

                      {reasoningEffort !== 'auto' && (
                        <div className="bg-muted text-muted-foreground flex items-center gap-1 rounded-full px-2.5 py-1 text-xs">
                          <Brain size={11} />
                          {reasoningEffortLabel}
                          <button
                            type="button"
                            onClick={() => setReasoningEffort('auto')}
                            className="hover:bg-muted-foreground/20 ml-0.5 rounded-full p-0.5 transition-colors"
                            aria-label="Restablecer razonamiento a auto"
                          >
                            <X size={10} />
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex items-end gap-1.5">
                    {!isRecording && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            disabled={isComposerLocked}
                            aria-label="Abrir opciones del mensaje"
                            className="text-muted-foreground hover:bg-muted hover:text-foreground mb-1 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors disabled:pointer-events-none disabled:opacity-50"
                          >
                            <Plus size={18} />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          align="start"
                          side="top"
                          className="w-60"
                        >
                          <DropdownMenuItem
                            onSelect={() => uploadInputRef.current?.click()}
                          >
                            <Upload size={16} />
                            Subir archivos
                          </DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => setOpenIA(true)}>
                            <Paperclip size={16} />
                            Añadir referencias
                            {totalReferencias > 0 && (
                              <span className="text-muted-foreground ml-auto text-xs">
                                {totalReferencias}
                              </span>
                            )}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onSelect={() =>
                              setWebSearchEnabled((enabled) => !enabled)
                            }
                          >
                            <Globe2 size={16} />
                            Búsqueda web
                            {webSearchEnabled && (
                              <Check
                                size={16}
                                className="text-primary ml-auto"
                              />
                            )}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuSub>
                            <DropdownMenuSubTrigger>
                              <Brain
                                size={16}
                                className="text-muted-foreground"
                              />
                              Razonamiento
                              <span className="text-muted-foreground ml-auto pl-4 text-xs">
                                {reasoningEffortLabel}
                              </span>
                            </DropdownMenuSubTrigger>
                            <DropdownMenuSubContent>
                              <DropdownMenuRadioGroup
                                value={reasoningEffort}
                                onValueChange={(value) =>
                                  setReasoningEffort(
                                    value as ReasoningEffortOption,
                                  )
                                }
                              >
                                {REASONING_EFFORT_OPTIONS.map((option) => (
                                  <DropdownMenuRadioItem
                                    key={option.value}
                                    value={option.value}
                                  >
                                    {option.label}
                                  </DropdownMenuRadioItem>
                                ))}
                              </DropdownMenuRadioGroup>
                            </DropdownMenuSubContent>
                          </DropdownMenuSub>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}

                    {!isRecording && (
                      <div className="relative min-w-0 flex-1 px-1 py-2">
                        {!input.trim() && (
                          <div className="text-muted-foreground pointer-events-none absolute top-2 left-1 text-sm leading-6 md:text-base md:leading-7">
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
                          contentEditable={!isComposerLocked}
                          suppressContentEditableWarning={true}
                          spellCheck={false}
                          onInput={handleComposerInput}
                          onPaste={handleComposerPaste}
                          onKeyDown={(e) => {
                            if (showSuggestions) {
                              if (
                                e.key === 'ArrowDown' ||
                                e.key === 'ArrowUp'
                              ) {
                                e.preventDefault()
                                if (filteredFields.length > 0) {
                                  const delta = e.key === 'ArrowDown' ? 1 : -1
                                  setHighlightedIndex(
                                    (safeHighlightedIndex +
                                      delta +
                                      filteredFields.length) %
                                      filteredFields.length,
                                  )
                                }
                                return
                              }

                              if (e.key === 'Tab' || e.key === 'Enter') {
                                if (filteredFields.length > 0) {
                                  e.preventDefault()
                                  toggleField(
                                    filteredFields[safeHighlightedIndex],
                                  )
                                }
                                return
                              }

                              if (e.key === 'Escape') {
                                e.preventDefault()
                                closeSuggestions()
                                return
                              }
                            } else if (
                              e.key === 'Backspace' &&
                              pendingFieldUndo.current
                            ) {
                              if (undoPendingField()) {
                                e.preventDefault()
                                return
                              }
                            }

                            if (
                              e.key === 'Enter' &&
                              !e.shiftKey &&
                              !showSuggestions
                            ) {
                              e.preventDefault()

                              if (isComposerLocked) return

                              void handleSend()
                            }
                          }}
                          className="max-h-40 min-h-6 overflow-y-auto bg-transparent p-0 text-sm leading-6 wrap-break-word whitespace-pre-wrap outline-none md:min-h-7 md:text-base md:leading-7"
                        />
                      </div>
                    )}

                    <div
                      className={cn(
                        'mb-0.5 flex items-center',
                        isRecording ? 'min-w-0 flex-1' : 'shrink-0',
                      )}
                    >
                      <VoiceDictation
                        onTranscript={handleTranscript}
                        onRecordingChange={setIsRecording}
                        disabled={isComposerLocked}
                      />
                    </div>

                    {!isRecording && (
                      <div className="flex shrink-0 items-center pb-0.5">
                        <ChatSendButton
                          mode={
                            isCancellingActiveMessage
                              ? 'cancelling'
                              : isComposerLocked
                                ? 'busy'
                                : 'send'
                          }
                          canCancel={canCancelActiveMessage}
                          disabled={
                            hasUnresolvedReferenceUploads ||
                            (!input.trim() && selectedFields.length === 0)
                          }
                          onSend={() => void handleSend()}
                          onCancel={() => {
                            if (activeProcessingMessage) {
                              void handleCancelAssistantMessage(
                                activeProcessingMessage,
                              )
                            }
                          }}
                        />
                      </div>
                    )}
                  </div>
                </div>

                <p className="text-muted-foreground/70 hidden text-center text-[11px] md:block">
                  Enter para enviar · Shift + Enter para salto de línea
                </p>
              </div>
            </div>
          </div>
        </div>
        <ChatFilesAside
          open={openIA}
          selectedFileIds={selectedArchivoIds}
          selectedCollectionIds={selectedColeccionIds}
          conversationReferences={conversationFiles.data ?? []}
          onOpenChange={setOpenIA}
          onToggleFile={(file, selected) =>
            toggleConversationFile(file.id, selected)
          }
          onToggleCollection={(collection, selected) =>
            toggleReferenceCollection(collection.id, selected)
          }
          onUploadComplete={selectUploadedReference}
        />
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
    </div>
  )
}

function injectFieldsIntoInput(baseInput: string, fields: Array<AIChatField>) {
  const cleaned = baseInput.replace(/[/\s]+[^/]*$/, '').trim()

  if (fields.length === 0) return cleaned

  const fieldLabels = fields.map((field) => field.label).join(', / ')
  return `${cleaned}  ${fieldLabels},  `
}
