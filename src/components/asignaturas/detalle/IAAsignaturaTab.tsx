import { useQueryClient } from '@tanstack/react-query'
import { useLocation, useParams } from '@tanstack/react-router'
import {
  Sparkles,
  Send,
  Target,
  UserCheck,
  Lightbulb,
  FileText,
  GraduationCap,
  BookOpen,
  Check,
  X,
  MessageSquarePlus,
  Archive,
  History,
  Edit2,
  Loader2,
} from 'lucide-react'
import { useState, useEffect, useRef, useMemo } from 'react'

import { ImprovementCard } from './SaveAsignatura/ImprovementCardProps'

import type { UploadedFile } from '@/components/planes/wizard/PasoDetallesPanel/FileDropZone'

import ReferenciasParaIA from '@/components/planes/wizard/PasoDetallesPanel/ReferenciasParaIA'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  Drawer,
  DrawerContent,
  DrawerOverlay,
  DrawerPortal,
} from '@/components/ui/drawer'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Textarea } from '@/components/ui/textarea'
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
  useUpdateAsignatura,
  useUpdateSubjectConversationName,
  useUpdateSubjectConversationStatus,
  useUpdateSubjectRecommendation,
} from '@/data'
import { cn } from '@/lib/utils'

interface SelectedField {
  key: string
  label: string
  value: string
}

export function IAAsignaturaTab() {
  const queryClient = useQueryClient()
  const { asignaturaId } = useParams({
    from: '/planes/$planId/asignaturas/$asignaturaId',
  })
  const location = useLocation()

  // --- ESTADOS ---
  const [activeChatId, setActiveChatId] = useState<string | undefined>(
    undefined,
  )
  const [showArchived, setShowArchived] = useState(false)
  const [input, setInput] = useState('')
  const [selectedFields, setSelectedFields] = useState<Array<SelectedField>>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)

  const updateAsignatura = useUpdateAsignatura()
  const updateRecommendation = useUpdateSubjectRecommendation()

  // --- DATA QUERIES ---
  const { data: datosGenerales } = useSubject(asignaturaId)
  const { data: todasConversaciones, isLoading: loadingConv } =
    useConversationBySubject(asignaturaId)
  const { data: rawMessages } = useMessagesBySubjectChat(activeChatId, {
    enabled: !!activeChatId,
  })
  const { mutateAsync: sendMessage } = useAISubjectChat()
  const { mutate: updateStatus } = useUpdateSubjectConversationStatus()
  const [isCreatingNewChat, setIsCreatingNewChat] = useState(false)
  const hasInitialSelected = useRef(false)
  const { mutate: updateName } = useUpdateSubjectConversationName()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [tempName, setTempName] = useState('')
  const [openIA, setOpenIA] = useState(false)

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

  const handleApplyMultiple = async (sugerencias: Array<any>) => {
    if (!asignaturaId || !datosGenerales || sugerencias.length === 0) return

    setIsSending(true)
    try {
      const patchData: any = {
        datos: { ...datosGenerales.datos },
      }

      for (const sug of sugerencias) {
        if (sug.campoKey === 'contenido_tematico') {
          patchData.contenido_tematico = sug.valorSugerido
        } else if (sug.campoKey === 'criterios_de_evaluacion') {
          patchData.criterios_de_evaluacion = sug.valorSugerido
        } else {
          patchData.datos[sug.campoKey] = sug.valorSugerido
        }
      }

      await updateAsignatura.mutateAsync({
        asignaturaId: asignaturaId as any,
        patch: patchData,
      })

      for (const sug of sugerencias) {
        await updateRecommendation.mutateAsync({
          mensajeId: sug.messageId,
          campoAfectado: sug.campoKey,
        })
      }

      const appliedKeys = sugerencias.map((s) => s.campoKey)
      setSelectedFields((prev) =>
        prev.filter((f) => !appliedKeys.includes(f.key)),
      )
      setSelectedImprovements([])

      queryClient.invalidateQueries({ queryKey: ['subject', asignaturaId] })
    } catch (error) {
      console.error('Error en aplicación masiva:', error)
    } finally {
      setIsSending(false)
    }
  }

  const toggleImprovementSelection = (sugId: string) => {
    setSelectedImprovements((prev) =>
      prev.includes(sugId)
        ? prev.filter((id) => id !== sugId)
        : [...prev, sugId],
    )
  }

  const toggleAllFromMessage = (sugerencias: Array<any>) => {
    const allIds = sugerencias.map((s) => s.id)
    const allSelected = allIds.every((id) => selectedImprovements.includes(id))

    if (allSelected) {
      setSelectedImprovements((prev) =>
        prev.filter((id) => !allIds.includes(id)),
      )
    } else {
      setSelectedImprovements((prev) =>
        Array.from(new Set([...prev, ...allIds])),
      )
    }
  }

  const totalReferencias =
    selectedArchivoIds.length +
    selectedRepositorioIds.length +
    uploadedFiles.length

  const isAiThinking = useMemo(() => {
    if (isSending) return true
    if (!rawMessages || rawMessages.length === 0) return false

    const lastMessage = rawMessages[rawMessages.length - 1]
    return (
      lastMessage.estado === 'PROCESANDO' || lastMessage.estado === 'PENDIENTE'
    )
  }, [isSending, rawMessages])

  useEffect(() => {
    const viewport = scrollRef.current?.querySelector(
      '[data-radix-scroll-area-viewport]',
    )
    if (viewport) {
      viewport.scrollTop = viewport.scrollHeight
    }
  }, [rawMessages, isSending])

  const { activeChats, archivedChats } = useMemo(() => {
    const chats = todasConversaciones || []
    return {
      activeChats: chats.filter((c: any) => c.estado === 'ACTIVA'),
      archivedChats: chats.filter((c: any) => c.estado === 'ARCHIVADA'),
    }
  }, [todasConversaciones])

const availableFields = useMemo(() => {
  const estructuraProps =
    datosGenerales?.estructuras_asignatura?.definicion?.properties || {}

  const datos = datosGenerales?.datos || {}

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
        label:
          fieldDef?.title || realKey.replace(/_/g, ' ').toUpperCase(),
        value,
      }
    },
  )

  // Evitar duplicados
  const uniqueFields = dynamicFields.filter(
    (field, index, self) =>
      index === self.findIndex((f) => f.key === field.key),
  )

  return uniqueFields
}, [datosGenerales])

  const messages = useMemo(() => {
    const msgs: Array<any> = []

    if (rawMessages) {
      rawMessages.forEach((m) => {
        msgs.push({ id: `${m.id}-user`, role: 'user', content: m.mensaje })

        if (m.respuesta) {
          const sugerencias =
            m.propuesta?.recommendations?.map((rec: any, index: number) => ({
              id: `${m.id}-sug-${index}`,
              messageId: m.id,
              campoKey: rec.campo_afectado,
              campoNombre: rec.campo_afectado.replace(/_/g, ' '),
              valorSugerido: rec.texto_mejora,
              aceptada: rec.aplicada,
            })) || []

          msgs.push({
            id: `${m.id}-ai`,
            role: 'assistant',
            content: m.respuesta,
            sugerencias: sugerencias,
          })
        }
      })
    }

    if (isSending && input.trim()) {
      msgs.push({ id: 'optimistic-user-msg', role: 'user', content: input })
    }

    return msgs
  }, [rawMessages, isSending, input])

  useEffect(() => {
    if (activeChatId || hasInitialSelected.current) return

    if (activeChats.length > 0 && !loadingConv) {
      setActiveChatId(activeChats[0].id)
      hasInitialSelected.current = true
    }
  }, [activeChats, loadingConv])

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value
    const selectionStart = e.target.selectionStart
    setInput(value)

    const lastChar = value.slice(selectionStart - 1, selectionStart)

    if (lastChar === ':') {
      setShowSuggestions(true)
    } else if (!value.includes(':')) {
      setShowSuggestions(false)
    }
  }

  const filteredFields = useMemo(() => {
    if (!showSuggestions || !input) return availableFields

    const lastColonIndex = input.lastIndexOf(':')
    if (lastColonIndex === -1) return availableFields

    const textAfterColon = input.slice(lastColonIndex + 1)
    const query = textAfterColon.split(/\s/)[0].toLowerCase()

    if (!query) return availableFields

    return availableFields.filter(
      (f) =>
        f.label.toLowerCase().includes(query) ||
        f.key.toLowerCase().includes(query),
    )
  }, [availableFields, input, showSuggestions])

  useEffect(() => {
    const state = location.state as any

    if (state?.activeTab === 'ia' && state?._ts) {
      if (state.prefillCampo) {
        const fieldToSelect = availableFields.find(
          (f) => f.key === state.prefillCampo,
        )

        if (fieldToSelect) {
          setSelectedFields([fieldToSelect])
          const autoPrompt = `Mejora el contenido de: ${fieldToSelect.label}`
          setInput(autoPrompt)
        }
      }
    }
  }, [location.state, availableFields])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowSuggestions(false)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const handleSelectField = (field: SelectedField) => {
    if (!selectedFields.find((f) => f.key === field.key)) {
      setSelectedFields((prev) => [...prev, field])
    }

    const lastColonIndex = input.lastIndexOf(':')
    if (lastColonIndex !== -1) {
      const parteAntesDelColon = input.slice(0, lastColonIndex)
      const textoDespuesDelColon = input.slice(lastColonIndex + 1)
      const espacioIndex = textoDespuesDelColon.indexOf(' ')
      const parteRestante =
        espacioIndex !== -1 ? textoDespuesDelColon.slice(espacioIndex) : ''

      const nuevoTexto = `${parteAntesDelColon}${field.label}${parteRestante}`
      setInput(nuevoTexto)
    }

    setShowSuggestions(false)
  }

  const handleSaveName = (id: string) => {
    if (tempName.trim()) {
      updateName({ id, nombre: tempName })
    }
    setEditingId(null)
  }

  const handleSend = async (promptOverride?: string) => {
    if (isAiThinking) return
    const text = promptOverride || input
    if (!text.trim() && selectedFields.length === 0) return

    setIsSending(true)
    try {
      const openaiFileIdsFromUploads = uploadedFiles
        .map((a) => a.openaiFileId)
        .filter((x): x is string => Boolean(x))

      const archivosReferencia = Array.from(
        new Set([...(selectedArchivoIds || []), ...openaiFileIdsFromUploads]),
      )

      const response = await sendMessage({
        subjectId: asignaturaId as any,
        content: text,
        campos: selectedFields.map((f) => f.key),
        conversacionId: activeChatId,
        archivosReferencia,
        repositoriosIds: selectedRepositorioIds || [],
      })

      if (response.conversacionId) {
        setActiveChatId(response.conversacionId)
      }

      setInput('')
      queryClient.invalidateQueries({
        queryKey: ['conversation-by-subject', asignaturaId],
      })
    } catch (error) {
      console.error('Error al enviar mensaje:', error)
    } finally {
      setIsSending(false)
    }
  }

  const toggleField = (field: SelectedField) => {
    setSelectedFields((prev) =>
      prev.find((f) => f.key === field.key)
        ? prev.filter((f) => f.key !== field.key)
        : [...prev, field],
    )
  }

  const createNewChat = () => {
    setActiveChatId(undefined)
    setInput('')
    setSelectedFields([])
  }

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

  return (
    <div className="bg-background flex h-full w-full overflow-hidden">
      <div className="bg-background/80 fixed top-0 z-40 flex w-full items-center justify-between border-b p-2 backdrop-blur-md">
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground"
          onClick={() => setIsSidebarOpen(true)}
        >
          <History size={18} className="mr-2" /> Historial
        </Button>

        <div className="flex flex-col items-center">
          <span className="text-primary text-[9px] font-bold tracking-wider uppercase">
            Asistente
          </span>
        </div>

        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground"
          onClick={() => setOpenIA(true)}
        >
          <FileText size={18} className="text-primary mr-2" /> Referencias
        </Button>
      </div>

      {/* 1. PANEL IZQUIERDO (HISTORIAL) - Desktop */}
      <aside className="bg-background hidden h-full w-64 shrink-0 flex-col border-r pr-4 md:flex">
        <div className="mb-4 flex items-center justify-between px-2 pt-4">
          <h2 className="text-muted-foreground flex items-center gap-2 text-xs font-bold uppercase">
            <History size={14} /> Historial
          </h2>
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              'h-8 w-8',
              showArchived && 'bg-accent text-accent-foreground',
            )}
            onClick={() => setShowArchived(!showArchived)}
          >
            <Archive size={16} />
          </Button>
        </div>

        <Button
          onClick={() => {
            setActiveChatId(undefined)
            setIsCreatingNewChat(true)
            setInput('')
            setSelectedFields([])
            queryClient.setQueryData(['subject-messages', undefined], [])
          }}
          variant="outline"
          className="border-border text-muted-foreground hover:border-primary hover:bg-primary/10 mb-4 w-full justify-start gap-2 border-dashed"
        >
          <MessageSquarePlus size={18} /> Nuevo Chat
        </Button>

        <ScrollArea className="flex-1">
          <div className="flex flex-col gap-1 pr-3">
            {(showArchived ? archivedChats : activeChats).map((chat: any) => (
              <div
                key={chat.id}
                className={cn(
                  'group relative flex w-full min-w-0 items-center justify-between gap-2 overflow-hidden rounded-lg px-3 py-2 text-sm transition-all',
                  activeChatId === chat.id
                    ? 'bg-accent text-foreground font-medium'
                    : 'text-muted-foreground hover:bg-muted',
                )}
                onDoubleClick={() => {
                  setEditingId(chat.id)
                  setTempName(chat.nombre || chat.titulo || 'Conversacion')
                }}
              >
                {editingId === chat.id ? (
                  <div className="flex min-w-0 flex-1 items-center">
                    <input
                      autoFocus
                      className="bg-background ring-primary w-full rounded border-none px-1 text-xs ring-1 outline-none"
                      value={tempName}
                      onChange={(e) => setTempName(e.target.value)}
                      onBlur={() => handleSaveName(chat.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveName(chat.id)
                        if (e.key === 'Escape') setEditingId(null)
                      }}
                    />
                  </div>
                ) : (
                  <>
                    <span
                      onClick={() => setActiveChatId(chat.id)}
                      className="block max-w-[140px] min-w-0 flex-1 cursor-pointer truncate pr-1"
                      title={chat.nombre || chat.titulo}
                    >
                      {chat.nombre || chat.titulo || 'Conversación'}
                    </span>

                    <div
                      className={cn(
                        'z-10 flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100',
                        activeChatId === chat.id
                          ? 'bg-accent'
                          : 'bg-transparent',
                      )}
                    >
                      <TooltipProvider delayDuration={300}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                setEditingId(chat.id)
                                setTempName(chat.nombre || chat.titulo || '')
                              }}
                              className="hover:bg-muted hover:text-primary rounded-md p-1 transition-colors"
                            >
                              <Edit2 size={14} />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="text-[10px]">
                            Editar nombre
                          </TooltipContent>
                        </Tooltip>

                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                const nuevoEstado =
                                  chat.estado === 'ACTIVA'
                                    ? 'ARCHIVADA'
                                    : 'ACTIVA'
                                updateStatus({
                                  id: chat.id,
                                  estado: nuevoEstado,
                                })
                              }}
                              className={cn(
                                'hover:bg-muted rounded-md p-1 transition-colors',
                                chat.estado === 'ACTIVA'
                                  ? 'hover:text-destructive'
                                  : 'hover:text-primary',
                              )}
                            >
                              {chat.estado === 'ACTIVA' ? (
                                <Archive size={14} />
                              ) : (
                                <History size={14} className="scale-x-[-1]" />
                              )}
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="text-[10px]">
                            {chat.estado === 'ACTIVA'
                              ? 'Archivar'
                              : 'Desarchivar'}
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>
      </aside>

      {/* 2. PANEL CENTRAL (CHAT) */}
      <main
        className={cn(
          'bg-muted/30 relative flex min-w-0 flex-1 flex-col overflow-hidden shadow-sm',
          'mt-[50px] h-[calc(100svh-50px)]',
          'md:border-border md:m-2 md:mt-0 md:h-[calc(100vh-160px)] md:rounded-xl md:border',
        )}
      >
        {/* Header Interno */}
        <div className="bg-background flex shrink-0 items-center justify-between border-b p-3">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setIsSidebarOpen(true)}
            >
              <History size={20} className="text-muted-foreground" />
            </Button>
            <div className="flex flex-col">
              <span className="text-primary text-[10px] font-bold tracking-wider uppercase">
                Asistente Académico
              </span>
              <span className="text-muted-foreground text-[11px]">
                Personalizado para tu asignatura
              </span>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setOpenIA(true)}
              className="bg-secondary text-secondary-foreground hover:bg-secondary/80 flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
            >
              <FileText size={14} />
              <span className="xs:inline hidden">Referencias</span>
              {totalReferencias > 0 && (
                <span className="bg-primary text-primary-foreground flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[10px]">
                  {totalReferencias}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Área de Mensajes */}
        <div className="relative min-h-0 w-full flex-1 overflow-hidden">
          <ScrollArea ref={scrollRef} className="h-full w-full">
            <div className="mx-auto max-w-3xl space-y-6 p-3 md:p-6">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={cn(
                    'flex gap-4',
                    msg.role === 'user' ? 'flex-row-reverse' : 'flex-row',
                  )}
                >
                  <Avatar
                    className={cn(
                      'h-9 w-9 shrink-0 border shadow-sm',
                      msg.role === 'assistant'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground',
                    )}
                  >
                    <AvatarFallback>
                      {msg.role === 'assistant' ? (
                        <Sparkles size={16} />
                      ) : (
                        <UserCheck size={16} />
                      )}
                    </AvatarFallback>
                  </Avatar>

                  <div
                    className={cn(
                      'flex max-w-[85%] flex-col gap-3',
                      msg.role === 'user' ? 'items-end' : 'items-start',
                    )}
                  >
                    <div
                      className={cn(
                        'relative overflow-hidden rounded-2xl border shadow-sm',
                        msg.role === 'user'
                          ? 'border-primary bg-primary text-primary-foreground rounded-tr-none px-4 py-3'
                          : 'bg-card text-card-foreground border-border w-full rounded-tl-none',
                      )}
                    >
                      <div
                        style={{ whiteSpace: 'pre-line' }}
                        className={cn(
                          'text-sm leading-relaxed',
                          msg.role === 'assistant' && 'p-4',
                        )}
                      >
                        {msg.content}
                      </div>

                      {msg.role === 'assistant' &&
                        msg.sugerencias?.length > 0 && (
                          <div className="border-border bg-muted/50 space-y-3 border-t p-3">
                            <div className="flex items-center justify-between">
                              <p className="text-muted-foreground text-[10px] font-bold uppercase">
                                Mejoras disponibles
                              </p>

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

                            {msg.sugerencias.map((sug: any) => (
                              <div key={sug.id} className="flex gap-2">
                                {!sug.aceptada && (
                                  <input
                                    type="checkbox"
                                    className="border-input accent-primary mt-4 h-4 w-4 rounded"
                                    checked={selectedImprovements.includes(
                                      sug.id,
                                    )}
                                    onChange={() =>
                                      toggleImprovementSelection(sug.id)
                                    }
                                  />
                                )}
                                <div className="flex-1">
                                  <ImprovementCard
                                    sug={sug}
                                    asignaturaId={asignaturaId}
                                    onApplied={(key) =>
                                      setSelectedFields((prev) =>
                                        prev.filter((f) => f.key !== key),
                                      )
                                    }
                                  />
                                </div>
                              </div>
                            ))}

                            {msg.sugerencias.some((s: any) =>
                              selectedImprovements.includes(s.id),
                            ) && (
                              <Button
                                size="sm"
                                disabled={isSending}
                                className="w-full text-xs font-bold shadow-md"
                                onClick={() => {
                                  const seleccionadasDeEsteMensaje =
                                    msg.sugerencias.filter((s: any) =>
                                      selectedImprovements.includes(s.id),
                                    )
                                  handleApplyMultiple(
                                    seleccionadasDeEsteMensaje,
                                  )
                                }}
                              >
                                {isSending ? (
                                  <Loader2
                                    className="mr-2 animate-spin"
                                    size={14}
                                  />
                                ) : (
                                  <Check className="mr-2" size={14} />
                                )}
                                Aplicar mejoras seleccionadas
                              </Button>
                            )}
                          </div>
                        )}
                    </div>
                  </div>
                </div>
              ))}
              {isAiThinking && (
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
              <div className="h-4" />
            </div>
          </ScrollArea>
        </div>

        {/* Input de Chat */}
        <footer className="bg-background border-t p-3 md:p-4">
          <div className="relative mx-auto max-w-4xl">
            {showSuggestions && (
              <div className="animate-in fade-in slide-in-from-bottom-2 bg-popover border-border absolute bottom-full left-0 z-50 mb-2 w-72 overflow-hidden rounded-xl border shadow-2xl">
                <div className="bg-muted text-muted-foreground flex justify-between border-b px-3 py-2 text-[10px] font-bold uppercase">
                  <span>Filtrando campos...</span>
                  <span className="bg-muted-foreground/20 text-muted-foreground rounded px-1 text-[9px]">
                    ESC para cerrar
                  </span>
                </div>
                <div className="max-h-60 overflow-y-auto p-1">
                  {filteredFields.length > 0 ? (
                    filteredFields.map((field) => (
                      <button
                        key={field.key}
                        onClick={() => handleSelectField(field)}
                        className="hover:bg-accent flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors"
                      >
                        <div className="flex flex-col">
                          <span className="text-foreground font-medium">
                            {field.label}
                          </span>
                        </div>
                        {selectedFields.find((f) => f.key === field.key) && (
                          <Check size={14} className="text-primary" />
                        )}
                      </button>
                    ))
                  ) : (
                    <div className="text-muted-foreground p-4 text-center text-xs italic">
                      No se encontraron coincidencias
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="bg-muted/50 focus-within:bg-background focus-within:ring-primary flex flex-col gap-2 rounded-xl border p-2 transition-all focus-within:ring-1">
              {selectedFields.length > 0 && (
                <div className="flex flex-wrap gap-1.5 px-2 pt-1">
                  {selectedFields.map((field) => (
                    <div
                      key={field.key}
                      className="animate-in zoom-in-95 border-primary/20 bg-primary/10 text-primary flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-bold shadow-sm"
                    >
                      <Target size={10} />
                      {field.label}
                      <button
                        onClick={() => toggleField(field)}
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
                  disabled={isAiThinking}
                  value={input}
                  onChange={(e) => {
                    const val = e.target.value
                    const cursor = e.target.selectionStart
                    setInput(val)

                    const textBeforeCursor = val.slice(0, cursor)
                    const lastColonIndex = textBeforeCursor.lastIndexOf(':')

                    if (lastColonIndex !== -1) {
                      const textSinceColon = textBeforeCursor.slice(
                        lastColonIndex + 1,
                      )

                      if (!textSinceColon.includes(' ')) {
                        setShowSuggestions(true)
                      } else {
                        setShowSuggestions(false)
                      }
                    } else {
                      setShowSuggestions(false)
                    }
                  }}
                  onKeyDown={(e) => {
                    if (isAiThinking) {
                      e.preventDefault()
                      return
                    }

                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      handleSend()
                    }
                  }}
                  placeholder='Escribe ":" para referenciar un campo...'
                  className="max-h-[120px] min-h-[40px] flex-1 resize-none border-none bg-transparent text-sm shadow-none focus-visible:ring-0"
                />
                <Button
                  onClick={() => handleSend()}
                  disabled={
                    (!input.trim() && selectedFields.length === 0) || isAiThinking
                  }
                  size="icon"
                  className="mb-1 h-9 w-9 shrink-0"
                >
                  {isSending ? (
                    <Loader2 className="animate-spin" size={16} />
                  ) : (
                    <Send size={16} />
                  )}
                </Button>
              </div>
            </div>
          </div>
        </footer>
      </main>

      {/* 3. PANEL DERECHO (ATAJOS) */}
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

      {/* DRAWERS (Referencias e Historial Móvil) */}
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

      <Drawer open={isSidebarOpen} onOpenChange={setIsSidebarOpen}>
        <DrawerPortal>
          <DrawerOverlay />
          <DrawerContent className="fixed right-0 bottom-0 left-0 h-[70vh] p-4 outline-none">
            <div className="flex h-full flex-col overflow-hidden pt-8">
              <Button
                onClick={() => {
                  setActiveChatId(undefined)
                  setIsCreatingNewChat(true)
                  setInput('')
                  setSelectedFields([])
                  queryClient.setQueryData(['subject-messages', undefined], [])
                  setIsSidebarOpen(false)
                }}
                variant="outline"
                className="border-primary/50 bg-primary/10 text-primary hover:bg-primary/20 mb-6 w-full justify-center gap-2 border-dashed"
              >
                <MessageSquarePlus size={18} /> Nuevo Chat
              </Button>
              <h2 className="mb-4 font-bold">Historial de Chats</h2>
              {(showArchived ? archivedChats : activeChats).map((chat: any) => (
                <div
                  key={chat.id}
                  className={cn(
                    'group relative flex w-full min-w-0 items-center justify-between gap-2 overflow-hidden rounded-lg px-3 py-2 text-sm transition-all',
                    activeChatId === chat.id
                      ? 'bg-accent text-accent-foreground font-medium'
                      : 'text-muted-foreground hover:bg-muted',
                  )}
                  onDoubleClick={() => {
                    setEditingId(chat.id)
                    setTempName(chat.nombre || chat.titulo || 'Conversacion')
                  }}
                >
                  {editingId === chat.id ? (
                    <div className="flex min-w-0 flex-1 items-center">
                      <input
                        autoFocus
                        className="bg-background ring-primary w-full rounded border-none px-1 text-xs ring-1 outline-none"
                        value={tempName}
                        onChange={(e) => setTempName(e.target.value)}
                        onBlur={() => handleSaveName(chat.id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveName(chat.id)
                          if (e.key === 'Escape') setEditingId(null)
                        }}
                      />
                    </div>
                  ) : (
                    <>
                      <span
                        onClick={() => setActiveChatId(chat.id)}
                        className="block max-w-[140px] min-w-0 flex-1 cursor-pointer truncate pr-1"
                        title={chat.nombre || chat.titulo}
                      >
                        {chat.nombre || chat.titulo || 'Conversación'}
                      </span>

                      <div
                        className={cn(
                          'z-10 flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100',
                          activeChatId === chat.id
                            ? 'bg-accent'
                            : 'bg-transparent',
                        )}
                      >
                        <TooltipProvider delayDuration={300}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setEditingId(chat.id)
                                  setTempName(chat.nombre || chat.titulo || '')
                                }}
                                className="hover:bg-muted hover:text-primary rounded-md p-1 transition-colors"
                              >
                                <Edit2 size={14} />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="text-[10px]">
                              Editar nombre
                            </TooltipContent>
                          </Tooltip>

                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  const nuevoEstado =
                                    chat.estado === 'ACTIVA'
                                      ? 'ARCHIVADA'
                                      : 'ACTIVA'
                                  updateStatus({
                                    id: chat.id,
                                    estado: nuevoEstado,
                                  })
                                }}
                                className={cn(
                                  'hover:bg-muted rounded-md p-1 transition-colors',
                                  chat.estado === 'ACTIVA'
                                    ? 'hover:text-destructive'
                                    : 'hover:text-primary',
                                )}
                              >
                                {chat.estado === 'ACTIVA' ? (
                                  <Archive size={14} />
                                ) : (
                                  <History size={14} className="scale-x-[-1]" />
                                )}
                              </button>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="text-[10px]">
                              {chat.estado === 'ACTIVA'
                                ? 'Archivar'
                                : 'Desarchivar'}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </DrawerContent>
        </DrawerPortal>
      </Drawer>
    </div>
  )
}
