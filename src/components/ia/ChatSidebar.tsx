/* eslint-disable jsx-a11y/click-events-have-key-events */
/* eslint-disable jsx-a11y/no-static-element-interactions */
import {
  Archive,
  FileText,
  MessageSquarePlus,
  PanelLeftClose,
  Pencil,
  RotateCcw,
} from 'lucide-react'
import { useRef, useState } from 'react'

import type { AIChatConversation } from '@/components/ia/AIChatWorkspace'

import { Button } from '@/components/ui/button'
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
  useGSAP,
} from '@/lib/animations'
import { cn } from '@/lib/utils'

export function formatChatTitle(
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

export function ChatSidebar({
  collapsed,
  activeChats,
  archivedChats,
  activeChatId,
  showArchived,
  onShowArchivedChange,
  onSelectChat,
  onNewChat,
  onArchive,
  onUnarchive,
  onRename,
  onCollapse,
}: {
  collapsed: boolean
  activeChats: Array<AIChatConversation>
  archivedChats: Array<AIChatConversation>
  activeChatId: string | undefined
  showArchived: boolean
  onShowArchivedChange: (showArchived: boolean) => void
  onSelectChat: (id: string) => void
  onNewChat: () => void
  onArchive: (event: React.MouseEvent, id: string) => void
  onUnarchive: (event: React.MouseEvent, id: string) => void
  onRename: (id: string, nextName: string, previousName: string) => void
  onCollapse: () => void
}) {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const innerRef = useRef<HTMLDivElement>(null)
  const hasMounted = useRef(false)
  const [editingChatId, setEditingChatId] = useState<string | null>(null)
  const editableRef = useRef<HTMLSpanElement>(null)

  useGSAP(
    () => {
      const el = wrapperRef.current
      if (!el) return

      // El ancho expandido se mide del contenido (w-64 depende de --spacing,
      // que este proyecto redefine) — nunca usar un px hardcodeado.
      const expandedWidth = innerRef.current?.offsetWidth ?? el.scrollWidth
      const autoAlpha = collapsed ? 0 : 1
      const skipTween = !hasMounted.current || !getOrganicMotion()
      hasMounted.current = true

      if (skipTween) {
        gsap.set(el, { width: collapsed ? 0 : 'auto', autoAlpha })
        return
      }

      gsap.to(el, {
        width: collapsed ? 0 : expandedWidth,
        autoAlpha,
        duration: organicDuration.base,
        ease: organicEase,
        overwrite: 'auto',
        onComplete: () => {
          if (!collapsed) gsap.set(el, { width: 'auto' })
        },
      })
    },
    { dependencies: [collapsed] },
  )

  return (
    <div
      ref={wrapperRef}
      className="border-border/40 bg-muted/30 hidden shrink-0 overflow-hidden border-r-[0.5px] md:block"
    >
      <div
        ref={innerRef}
        className="flex h-full w-64 min-w-64 flex-col px-3 py-3"
      >
        <div className="mb-2 flex items-center gap-1">
          <Button
            onClick={onNewChat}
            variant="ghost"
            className="min-w-0 flex-1 justify-start gap-2 text-sm"
          >
            <MessageSquarePlus size={16} /> Nuevo chat
          </Button>
          <TooltipProvider delayDuration={250}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={onCollapse}
                  aria-label="Ocultar lista de chats"
                  className="h-8 w-8 shrink-0"
                >
                  <PanelLeftClose size={16} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Ocultar lista de chats</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        <div className="bg-muted/60 mb-3 grid grid-cols-2 gap-0.5 rounded-full p-0.5">
          <button
            type="button"
            onClick={() => onShowArchivedChange(false)}
            className={cn(
              'flex h-7 min-w-0 items-center justify-center gap-1.5 rounded-full px-2 text-xs font-medium transition-colors',
              !showArchived
                ? 'bg-background text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <span className="truncate">Activos</span>
            <span className="shrink-0 opacity-60">{activeChats.length}</span>
          </button>
          <button
            type="button"
            onClick={() => onShowArchivedChange(true)}
            className={cn(
              'flex h-7 min-w-0 items-center justify-center gap-1.5 rounded-full px-2 text-xs font-medium transition-colors',
              showArchived
                ? 'bg-background text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <span className="truncate">Archivados</span>
            <span className="shrink-0 opacity-60">{archivedChats.length}</span>
          </button>
        </div>

        <ScrollArea className="min-h-0 flex-1">
          <div className="space-y-1 pr-2">
            {!showArchived
              ? activeChats.map((chat) => (
                  <div
                    key={chat.id}
                    onClick={() => onSelectChat(chat.id)}
                    className={`group relative flex w-full items-center overflow-hidden rounded-lg px-3 py-2 text-sm transition-colors ${
                      activeChatId === chat.id
                        ? 'bg-muted text-foreground font-medium'
                        : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
                    }`}
                  >
                    <div
                      className="flex min-w-0 flex-1 items-center gap-2.5"
                      style={{
                        maskImage:
                          'linear-gradient(to right, black 70%, transparent 95%)',
                        WebkitMaskImage:
                          'linear-gradient(to right, black 70%, transparent 95%)',
                      }}
                    >
                      <FileText size={15} className="shrink-0 opacity-40" />
                      <div className="min-w-0 flex-1">
                        <span
                          ref={editingChatId === chat.id ? editableRef : null}
                          contentEditable={editingChatId === chat.id}
                          suppressContentEditableWarning={true}
                          className={`block truncate outline-none ${
                            editingChatId === chat.id
                              ? 'bg-background ring-ring/40 max-h-20 min-w-25 cursor-text overflow-y-auto rounded px-1 break-all ring-1'
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
                              e.currentTarget.textContent = chat.nombre || ''
                            }
                          }}
                          onBlur={(e) => {
                            if (editingChatId !== chat.id) return

                            const newTitle = e.currentTarget.textContent.trim()
                            if (newTitle && newTitle !== chat.nombre) {
                              onRename(chat.id, newTitle, chat.nombre || '')
                            }
                            setEditingChatId(null)
                          }}
                        >
                          {formatChatTitle(chat)}
                        </span>
                      </div>
                    </div>

                    <div
                      className={`absolute top-1/2 right-2 z-20 flex -translate-y-1/2 items-center gap-1 rounded-md px-1 opacity-0 transition-opacity group-hover:opacity-100 ${
                        activeChatId === chat.id ? 'bg-muted' : 'bg-transparent'
                      }`}
                    >
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setEditingChatId(chat.id)
                          setTimeout(() => editableRef.current?.focus(), 50)
                        }}
                        className="text-muted-foreground hover:text-foreground rounded-md p-1 transition-colors"
                        aria-label="Renombrar chat"
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        onClick={(e) => onArchive(e, chat.id)}
                        className="text-muted-foreground hover:text-destructive rounded-md p-1 transition-colors"
                        aria-label="Archivar chat"
                      >
                        <Archive size={14} />
                      </button>
                    </div>
                  </div>
                ))
              : archivedChats.map((chat) => (
                  <div
                    key={chat.id}
                    className="bg-muted/40 text-muted-foreground group relative flex w-full items-center overflow-hidden rounded-lg px-3 py-2 text-sm"
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-2.5 pr-10">
                      <Archive size={14} className="shrink-0 opacity-30" />
                      <span className="block truncate">
                        {formatChatTitle(chat, 'Archivado')}
                      </span>
                    </div>
                    <button
                      onClick={(e) => onUnarchive(e, chat.id)}
                      className="bg-muted hover:text-foreground absolute top-1/2 right-2 shrink-0 -translate-y-1/2 rounded p-1 opacity-0 transition-opacity group-hover:opacity-100"
                      aria-label="Restaurar chat"
                    >
                      <RotateCcw size={14} />
                    </button>
                  </div>
                ))}
          </div>
        </ScrollArea>
      </div>
    </div>
  )
}
