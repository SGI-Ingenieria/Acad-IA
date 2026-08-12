import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  Archive,
  Clock,
  FileText,
  Pencil,
  RotateCcw,
  Search,
} from 'lucide-react'
import { useMemo, useState } from 'react'

import type { AIChatConversation } from '@/components/ia/AIChatWorkspace'

import { formatChatTitle } from '@/components/ia/ChatSidebar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

export function CompactChatSessionMenu({
  activeChats,
  archivedChats,
  activeChatId,
  showArchived,
  onShowArchivedChange,
  onSelectChat,
  onArchive,
  onUnarchive,
  onRename,
}: {
  activeChats: Array<AIChatConversation>
  archivedChats: Array<AIChatConversation>
  activeChatId: string | undefined
  showArchived: boolean
  onShowArchivedChange: (showArchived: boolean) => void
  onSelectChat: (id: string) => void
  onArchive: (event: React.MouseEvent, id: string) => void
  onUnarchive: (event: React.MouseEvent, id: string) => void
  onRename: (id: string, nextName: string, previousName: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')

  const chats = showArchived ? archivedChats : activeChats
  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase()
    if (!term) return chats
    return chats.filter((chat) =>
      formatChatTitle(chat).toLowerCase().includes(term),
    )
  }, [chats, query])

  const startRename = (chat: AIChatConversation) => {
    setEditingId(chat.id)
    setEditingName(chat.nombre || '')
  }

  const saveRename = (chat: AIChatConversation) => {
    const nextName = editingName.trim()
    const previousName = chat.nombre || ''
    if (nextName && nextName !== previousName) {
      onRename(chat.id, nextName, previousName)
    }
    setEditingId(null)
    setEditingName('')
  }

  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    chat: AIChatConversation,
  ) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      saveRename(chat)
    }
    if (e.key === 'Escape') {
      setEditingId(null)
      setEditingName('')
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="relative size-8"
              aria-label="Conversaciones recientes"
            >
              <Clock size={16} />
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent>Conversaciones recientes</TooltipContent>
      </Tooltip>
      <PopoverContent
        align="end"
        className="w-80 p-0"
        sideOffset={8}
        onCloseAutoFocus={() => setQuery('')}
      >
        <div className="border-border gap-relacionado px-control py-relacionado flex items-center border-b">
          <Search className="text-muted-foreground h-4 w-4" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar conversaciones…"
            className="h-8 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
          />
        </div>

        <div className="gap-micro p-micro flex items-center border-b">
          <Button
            type="button"
            size="sm"
            variant={!showArchived ? 'secondary' : 'ghost'}
            className="h-7 flex-1 text-xs"
            onClick={() => onShowArchivedChange(false)}
          >
            Activos
            <span
              className={cn(
                'ml-relacionado px-relacionado py-micro rounded-full text-[10px]',
                !showArchived
                  ? 'bg-background text-foreground'
                  : 'bg-muted text-muted-foreground',
              )}
            >
              {activeChats.length}
            </span>
          </Button>
          <Button
            type="button"
            size="sm"
            variant={showArchived ? 'secondary' : 'ghost'}
            className="h-7 flex-1 text-xs"
            onClick={() => onShowArchivedChange(true)}
          >
            Archivados
            <span
              className={cn(
                'ml-relacionado px-relacionado py-micro rounded-full text-[10px]',
                showArchived
                  ? 'bg-background text-foreground'
                  : 'bg-muted text-muted-foreground',
              )}
            >
              {archivedChats.length}
            </span>
          </Button>
        </div>

        <ScrollArea className="max-h-80">
          <div className="p-micro">
            {filtered.length === 0 ? (
              <div className="text-muted-foreground px-control py-seccion text-center text-xs">
                {query ? 'Sin coincidencias.' : 'No hay conversaciones.'}
              </div>
            ) : (
              filtered.map((chat) => {
                const isActive = chat.id === activeChatId
                const isEditing = editingId === chat.id
                const displayTitle = formatChatTitle(chat)
                const createdAt = chat.creado_en
                  ? format(parseISO(chat.creado_en), 'd MMM, HH:mm', {
                      locale: es,
                    })
                  : ''

                return (
                  <div
                    key={chat.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      onSelectChat(chat.id)
                      setOpen(false)
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        onSelectChat(chat.id)
                        setOpen(false)
                      }
                    }}
                    className={cn(
                      'group gap-relacionado px-relacionado py-relacionado relative flex cursor-pointer items-center rounded-md transition-colors',
                      isActive
                        ? 'bg-muted text-foreground'
                        : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
                    )}
                  >
                    {showArchived ? (
                      <Archive className="h-3.5 w-3.5 shrink-0 opacity-40" />
                    ) : (
                      <FileText className="h-3.5 w-3.5 shrink-0 opacity-40" />
                    )}

                    <div className="min-w-0 flex-1">
                      {isEditing ? (
                        <Input
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          onKeyDown={(e) => handleKeyDown(e, chat)}
                          onBlur={() => saveRename(chat)}
                          onClick={(e) => e.stopPropagation()}
                          className="px-micro h-6 py-0 text-xs"
                        />
                      ) : (
                        <>
                          <p className="truncate text-sm">{displayTitle}</p>
                          {createdAt && (
                            <p className="text-muted-foreground text-[10px]">
                              {createdAt}
                            </p>
                          )}
                        </>
                      )}
                    </div>

                    {!isEditing && (
                      <div className="gap-micro hidden items-center group-hover:flex">
                        {showArchived ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="size-7"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  onUnarchive(e, chat.id)
                                }}
                                aria-label="Restaurar chat"
                              >
                                <RotateCcw size={13} />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Restaurar</TooltipContent>
                          </Tooltip>
                        ) : (
                          <>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="size-7"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    startRename(chat)
                                  }}
                                  aria-label="Renombrar chat"
                                >
                                  <Pencil size={13} />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Renombrar</TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="hover:text-destructive size-7"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    onArchive(e, chat.id)
                                  }}
                                  aria-label="Archivar chat"
                                >
                                  <Archive size={13} />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Archivar</TooltipContent>
                            </Tooltip>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  )
}
