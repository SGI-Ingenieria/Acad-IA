import { BookOpen, Files, GraduationCap, X } from 'lucide-react'
import { useMemo, useState } from 'react'

import type { ReferenceLibraryScope } from '@/components/referencias/ReferenceLibrary'
import type {
  DocumentoArchivo,
  DocumentoColeccion,
  DocumentoReferenciaConversacion,
} from '@/data/api/documentos.api'

import { ReferenceLibrary } from '@/components/referencias/ReferenceLibrary'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'

type Props = {
  open: boolean
  selectedFileIds: Array<string>
  selectedCollectionIds?: Array<string>
  conversationReferences?: Array<DocumentoReferenciaConversacion>
  onOpenChange: (open: boolean) => void
  onToggleFile: (file: DocumentoArchivo, selected: boolean) => void
  onToggleCollection?: (
    collection: DocumentoColeccion,
    selected: boolean,
  ) => void
  onUploadComplete?: (fileId: string) => void
}

const modeLabel: Record<ReferenceLibraryScope, string> = {
  chat: 'Archivos del chat',
  personal: 'Mis referencias',
  curriculum: 'Planeación curricular',
}

export function resolverArchivosConversacionAside(
  selectedFileIds: Array<string>,
  conversationReferences: Array<DocumentoReferenciaConversacion>,
) {
  const persisted = new Map(
    conversationReferences.map((reference) => [reference.fileId, reference]),
  )
  const conversationFileIds = Array.from(
    new Set([
      ...conversationReferences.map((reference) => reference.fileId),
      ...selectedFileIds,
    ]),
  )
  return {
    conversationFileIds,
    removableFileIds: conversationFileIds.filter(
      (fileId) => persisted.get(fileId)?.canRemove ?? true,
    ),
  }
}

export function ChatFilesAside({
  open,
  selectedFileIds,
  selectedCollectionIds = [],
  conversationReferences = [],
  onOpenChange,
  onToggleFile,
  onToggleCollection,
  onUploadComplete,
}: Props) {
  const [scope, setScope] = useState<ReferenceLibraryScope>('chat')
  const { conversationFileIds, removableFileIds } = useMemo(
    () =>
      resolverArchivosConversacionAside(
        selectedFileIds,
        conversationReferences,
      ),
    [conversationReferences, selectedFileIds],
  )

  return (
    <aside
      aria-label="Referencias de la conversación"
      className={cn(
        'bg-background border-border fixed inset-y-0 right-0 z-50 w-[min(92vw,390px)] min-w-0 flex-col border-l shadow-2xl',
        'xl:static xl:z-auto xl:w-[360px] xl:shrink-0 xl:shadow-none',
        open ? 'animate-in slide-in-from-right flex duration-200' : 'hidden',
      )}
    >
      <header className="border-border flex h-12 shrink-0 items-center justify-between border-b px-4">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold">{modeLabel[scope]}</h2>
          <p className="text-muted-foreground truncate text-xs">
            {scope === 'chat'
              ? `${conversationFileIds.length + selectedCollectionIds.length} en esta conversación`
              : scope === 'personal'
                ? 'Archivos y colecciones disponibles'
                : 'Acervos institucionales'}
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8 shrink-0"
          aria-label="Ocultar referencias"
          onClick={() => onOpenChange(false)}
        >
          <X className="size-4" />
        </Button>
      </header>

      <ScrollArea className="min-h-0 flex-1">
        <ReferenceLibrary
          compact
          variant="aside"
          scope={scope}
          showScopeSwitcher={false}
          showManagementActions={false}
          selectedFileIds={selectedFileIds}
          selectedCollectionIds={selectedCollectionIds}
          conversationFileIds={conversationFileIds}
          removableConversationFileIds={removableFileIds}
          onToggleFile={onToggleFile}
          onToggleCollection={onToggleCollection}
          onUploadComplete={onUploadComplete}
          className="p-3"
        />
      </ScrollArea>

      <footer className="border-border bg-background shrink-0 border-t p-2">
        <Tabs
          value={scope}
          onValueChange={(value) => setScope(value as ReferenceLibraryScope)}
        >
          <TabsList className="grid h-auto w-full grid-cols-3">
            <TabsTrigger value="chat" className="min-w-0 gap-1 px-1.5">
              <Files className="size-3.5 shrink-0" />
              <span className="truncate">Chat</span>
            </TabsTrigger>
            <TabsTrigger value="personal" className="min-w-0 gap-1 px-1.5">
              <BookOpen className="size-3.5 shrink-0" />
              <span className="truncate">Mis archivos</span>
            </TabsTrigger>
            <TabsTrigger value="curriculum" className="min-w-0 gap-1 px-1.5">
              <GraduationCap className="size-3.5 shrink-0" />
              <span className="truncate">Curricular</span>
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </footer>
    </aside>
  )
}
