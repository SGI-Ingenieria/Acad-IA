import {
  Archive,
  ArrowDownWideNarrow,
  Check,
  ChevronRight,
  Download,
  Braces,
  FileImage,
  FileSpreadsheet,
  FileText,
  Folder,
  FolderInput,
  FolderOpen,
  GraduationCap,
  Loader2,
  MoreHorizontal,
  Plus,
  Presentation,
  RefreshCw,
  Search,
  Upload,
} from 'lucide-react'
import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

import type {
  DocumentoArchivo,
  DocumentoColeccion,
  OrdenBiblioteca,
} from '@/data/api/documentos.api'

import { GlobalFileDropOverlay } from '@/components/referencias/GlobalFileDropOverlay'
import { showAppConfirm } from '@/components/ui/app-alert-dialog'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { documentos_url_firmada } from '@/data/api/documentos.api'
import {
  useAgregarDocumentoAColeccion,
  useArchivarColeccion,
  useBibliotecaReferencias,
  useCrearColeccion,
  useSubirDocumento,
} from '@/data/hooks/useDocumentos'
import { notify } from '@/lib/toast'
import { cn } from '@/lib/utils'

const ACCEPT =
  '.pdf,.docx,.pptx,.xlsx,.txt,.md,.csv,.json,.png,.jpg,.jpeg,.webp'

export type ReferenceLibraryScope = 'personal' | 'curriculum' | 'chat'

export type ReferenceLibraryProps = {
  className?: string
  compact?: boolean
  variant?: 'catalog' | 'picker' | 'aside'
  scope?: ReferenceLibraryScope
  defaultScope?: Exclude<ReferenceLibraryScope, 'chat'>
  query?: string
  defaultQuery?: string
  sort?: OrdenBiblioteca
  defaultSort?: OrdenBiblioteca
  activeCollectionId?: string | null
  defaultActiveCollectionId?: string | null
  scopes?: Array<ReferenceLibraryScope>
  showScopeSwitcher?: boolean
  showManagementActions?: boolean
  showUploadAction?: boolean
  showCreateAction?: boolean
  selectedFileIds?: Array<string>
  selectedCollectionIds?: Array<string>
  conversationFileIds?: Array<string>
  removableConversationFileIds?: Array<string>
  onScopeChange?: (scope: ReferenceLibraryScope) => void
  onQueryChange?: (query: string) => void
  onSortChange?: (sort: OrdenBiblioteca) => void
  onActiveCollectionIdChange?: (
    collectionId: string | null,
    reason?: 'navigate' | 'invalid',
  ) => void
  onToggleFile?: (file: DocumentoArchivo, selected: boolean) => void
  onToggleCollection?: (
    collection: DocumentoColeccion,
    selected: boolean,
  ) => void
  onUploadFiles?: (files: Array<File>) => void | Promise<void>
  onUploadComplete?: (fileId: string) => void
}

const statusLabel: Record<DocumentoArchivo['status'], string> = {
  uploading: 'Subiendo',
  pending: 'En cola',
  processing: 'Procesando',
  ready: 'Listo para IA',
  partial_error: 'Requiere revisión',
  failed: 'No se pudo procesar',
  deleted: 'Archivado',
}

function formatReferenceSize(bytes: number | null | undefined) {
  if (!bytes || bytes <= 0) return null
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function iconoArchivo(filename: string) {
  const extension = filename.split('.').pop()?.toLocaleLowerCase('es-MX')
  if (['png', 'jpg', 'jpeg', 'webp'].includes(extension ?? '')) {
    return FileImage
  }
  if (['xlsx', 'csv'].includes(extension ?? '')) return FileSpreadsheet
  if (extension === 'pptx') return Presentation
  if (extension === 'json') return Braces
  return FileText
}

function CollectionTile({
  collection,
  selected,
  onPrimary,
  onPreview,
  onDropFile,
  onArchive,
}: {
  collection: DocumentoColeccion
  selected: boolean
  onPrimary: () => void
  onPreview: () => void
  onDropFile?: (fileId: string) => void
  onArchive?: () => void
}) {
  const [dragOver, setDragOver] = useState(false)
  const Icon =
    collection.kind === 'curriculum_repository' ? GraduationCap : Folder

  return (
    <div
      className={cn(
        'group gap-relacionado p-relacionado flex min-w-0 items-center rounded-xl transition-colors',
        'hover:bg-muted/70 focus-within:bg-muted/70',
        selected && 'bg-primary/10 text-primary',
        dragOver && 'bg-primary/15 ring-primary/50 ring-2',
      )}
      onDragEnter={(event) => {
        if (
          onDropFile &&
          event.dataTransfer.types.includes('application/x-acadia-file')
        ) {
          event.preventDefault()
          setDragOver(true)
        }
      }}
      onDragOver={(event) => {
        if (
          onDropFile &&
          event.dataTransfer.types.includes('application/x-acadia-file')
        ) {
          event.preventDefault()
        }
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(event) => {
        if (!onDropFile) return
        event.preventDefault()
        setDragOver(false)
        const fileId = event.dataTransfer.getData('application/x-acadia-file')
        if (fileId) onDropFile(fileId)
      }}
    >
      <button
        type="button"
        className="gap-control flex min-w-0 flex-1 items-center rounded-lg text-left outline-none focus-visible:ring-2"
        onClick={onPrimary}
      >
        <span className="bg-primary/10 text-primary relative grid size-10 shrink-0 place-items-center rounded-xl">
          <Icon className="size-5" />
          {selected ? (
            <span className="bg-primary text-primary-foreground absolute -top-1 -right-1 grid size-4 place-items-center rounded-full">
              <Check className="size-2.5" />
            </span>
          ) : null}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium">
            {collection.name}
          </span>
          <span className="text-muted-foreground block text-xs">
            {collection.fileIds.length}{' '}
            {collection.fileIds.length === 1 ? 'archivo' : 'archivos'}
          </span>
        </span>
      </button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 shrink-0 opacity-60 group-hover:opacity-100"
            aria-label={`Opciones de ${collection.name}`}
          >
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={onPreview}>
            <FolderOpen className="size-4" />
            Ver contenido
          </DropdownMenuItem>
          {onArchive ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={onArchive}>
                <Archive className="size-4" />
                Archivar colección
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

function FileRow({
  file,
  collections,
  selected,
  onToggle,
  onMove,
  onRetry,
}: {
  file: DocumentoArchivo
  collections: Array<DocumentoColeccion>
  selected: boolean
  onToggle?: (selected: boolean) => void
  onMove?: (collectionId: string) => void
  onRetry: () => void
}) {
  const available = file.status === 'ready'
  const FileIcon = iconoArchivo(file.display_name)
  const open = async (download: boolean) => {
    if (file.id.startsWith('upload:')) return
    const popup = window.open('about:blank', '_blank')
    if (popup) popup.opener = null
    try {
      const url = await documentos_url_firmada(file.id, download)
      if (!popup) {
        notify.warning(
          'El navegador bloqueó la nueva pestaña. Permite ventanas emergentes para abrir referencias.',
        )
        return
      }
      popup.location.replace(url)
    } catch (error) {
      popup?.close()
      notify.error(error, {
        description: download
          ? 'No se pudo descargar el archivo.'
          : 'No se pudo previsualizar el archivo.',
      })
    }
  }
  const primary = () => {
    if (onToggle && available) onToggle(!selected)
    else if (!file.id.startsWith('upload:')) void open(false)
  }

  return (
    <div
      className={cn(
        'group gap-micro px-relacionado py-micro grid min-w-0 grid-cols-[1fr_auto] items-center transition-colors',
        'hover:bg-muted/60 focus-within:bg-muted/60',
        selected && 'bg-primary/5',
      )}
    >
      <button
        type="button"
        draggable={!file.id.startsWith('upload:')}
        onDragStart={(event) => {
          event.dataTransfer.setData('application/x-acadia-file', file.id)
          event.dataTransfer.effectAllowed = 'copyMove'
        }}
        onClick={primary}
        className="gap-control px-micro py-relacionado grid min-w-0 grid-cols-[auto_1fr] items-center rounded-lg text-left outline-none focus-visible:ring-2"
      >
        <span className="bg-muted text-muted-foreground relative grid size-9 place-items-center rounded-lg">
          {file.status === 'uploading' || file.status === 'processing' ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <FileIcon className="size-4" />
          )}
          {selected ? (
            <span className="bg-primary text-primary-foreground absolute -top-1 -right-1 grid size-4 place-items-center rounded-full">
              <Check className="size-2.5" />
            </span>
          ) : null}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium">
            {file.display_name}
          </span>
          <span
            className={cn(
              'text-muted-foreground block truncate text-xs',
              file.status === 'failed' && 'text-destructive',
            )}
          >
            {file.status === 'uploading'
              ? [
                  `Subiendo ${file.uploadProgress ?? 0}%`,
                  formatReferenceSize(file.size_bytes),
                ]
                  .filter(Boolean)
                  .join(' · ')
              : file.status === 'processing'
                ? ['Procesando', formatReferenceSize(file.size_bytes)]
                    .filter(Boolean)
                    .join(' · ')
                : statusLabel[file.status]}
          </span>
        </span>
      </button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 opacity-60 group-hover:opacity-100"
            aria-label={`Opciones de ${file.display_name}`}
          >
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="truncate">
            {file.display_name}
          </DropdownMenuLabel>
          {onToggle && available ? (
            <DropdownMenuItem onSelect={() => onToggle(!selected)}>
              {selected ? (
                <Check className="size-4" />
              ) : (
                <Plus className="size-4" />
              )}
              {selected ? 'Quitar de esta solicitud' : 'Usar como referencia'}
            </DropdownMenuItem>
          ) : null}
          {file.status === 'failed' && file.localFile ? (
            <DropdownMenuItem onSelect={onRetry}>
              <RefreshCw className="size-4" />
              Reintentar carga
            </DropdownMenuItem>
          ) : null}
          {!file.id.startsWith('upload:') ? (
            <>
              <DropdownMenuItem onSelect={() => void open(false)}>
                <FolderOpen className="size-4" />
                Previsualizar
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => void open(true)}>
                <Download className="size-4" />
                Descargar
              </DropdownMenuItem>
            </>
          ) : null}
          {onMove && collections.length && !file.id.startsWith('upload:') ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <FolderInput className="size-4" />
                  Añadir a colección
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  {collections.map((collection) => (
                    <DropdownMenuItem
                      key={collection.id}
                      onSelect={() => onMove(collection.id)}
                    >
                      <Folder className="size-4" />
                      {collection.name}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

const scopeLabel: Record<ReferenceLibraryScope, string> = {
  personal: 'Mis referencias',
  curriculum: 'Planeación curricular',
  chat: 'Archivos del chat',
}

export function obtenerArchivosSueltos(
  files: Array<DocumentoArchivo>,
  collections: Array<DocumentoColeccion>,
) {
  const organizados = new Set(
    collections.flatMap((collection) => collection.fileIds),
  )
  return files.filter((file) => !organizados.has(file.id))
}

export function ordenarColecciones(
  collections: Array<DocumentoColeccion>,
  sort: OrdenBiblioteca,
) {
  return [...collections].sort((left, right) => {
    if (sort === 'name_asc') return left.name.localeCompare(right.name, 'es-MX')
    if (sort === 'name_desc')
      return right.name.localeCompare(left.name, 'es-MX')
    if (sort === 'created_desc')
      return right.created_at.localeCompare(left.created_at)
    return right.updated_at.localeCompare(left.updated_at)
  })
}

export function ReferenceLibrary({
  className,
  compact = false,
  variant = compact ? 'picker' : 'catalog',
  scope: controlledScope,
  defaultScope = 'personal',
  query: controlledQuery,
  defaultQuery = '',
  sort: controlledSort,
  defaultSort = 'updated_desc',
  activeCollectionId: controlledActiveCollectionId,
  defaultActiveCollectionId = null,
  scopes = ['personal', 'curriculum'],
  showScopeSwitcher = true,
  showManagementActions = variant === 'catalog',
  showUploadAction = showManagementActions,
  showCreateAction = showManagementActions,
  selectedFileIds = [],
  selectedCollectionIds = [],
  conversationFileIds = [],
  removableConversationFileIds = [],
  onScopeChange,
  onQueryChange,
  onSortChange,
  onActiveCollectionIdChange,
  onToggleFile,
  onToggleCollection,
  onUploadFiles,
  onUploadComplete,
}: ReferenceLibraryProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uncontrolledScope, setUncontrolledScope] =
    useState<ReferenceLibraryScope>(defaultScope)
  const currentScope = controlledScope ?? uncontrolledScope
  const [uncontrolledQuery, setUncontrolledQuery] = useState(defaultQuery)
  const query = controlledQuery ?? uncontrolledQuery
  const deferredQuery = useDeferredValue(
    query.trim().toLocaleLowerCase('es-MX'),
  )
  const [uncontrolledSort, setUncontrolledSort] =
    useState<OrdenBiblioteca>(defaultSort)
  const sort = controlledSort ?? uncontrolledSort
  const [uncontrolledActiveCollectionId, setUncontrolledActiveCollectionId] =
    useState<string | null>(defaultActiveCollectionId)
  const activeCollectionId =
    controlledActiveCollectionId === undefined
      ? uncontrolledActiveCollectionId
      : controlledActiveCollectionId
  const [previewCollectionId, setPreviewCollectionId] = useState<string | null>(
    null,
  )
  const [createOpen, setCreateOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [newKind, setNewKind] =
    useState<DocumentoColeccion['kind']>('collection')

  const changeQuery = useCallback(
    (next: string) => {
      if (controlledQuery === undefined) setUncontrolledQuery(next)
      onQueryChange?.(next)
    },
    [controlledQuery, onQueryChange],
  )
  const changeSort = useCallback(
    (next: OrdenBiblioteca) => {
      if (controlledSort === undefined) setUncontrolledSort(next)
      onSortChange?.(next)
    },
    [controlledSort, onSortChange],
  )
  const changeActiveCollection = useCallback(
    (next: string | null, reason: 'navigate' | 'invalid' = 'navigate') => {
      if (controlledActiveCollectionId === undefined) {
        setUncontrolledActiveCollectionId(next)
      }
      onActiveCollectionIdChange?.(next, reason)
    },
    [controlledActiveCollectionId, onActiveCollectionIdChange],
  )

  // El catálogo completo permite encontrar archivos dentro de carpetas y
  // abrir una colección sin otra consulta. La búsqueda se proyecta localmente.
  const library = useBibliotecaReferencias({ query: '', sort })
  const upload = useSubirDocumento()
  const createCollection = useCrearColeccion()
  const archiveCollection = useArchivarColeccion()
  const addToCollection = useAgregarDocumentoAColeccion()
  const data = library.data ?? { files: [], collections: [] }
  const personalCollections = data.collections.filter(
    (collection) => collection.kind === 'collection',
  )
  const curriculumRepositories = data.collections.filter(
    (collection) => collection.kind === 'curriculum_repository',
  )
  const scopeCollections =
    currentScope === 'personal'
      ? personalCollections
      : currentScope === 'curriculum'
        ? curriculumRepositories
        : data.collections.filter((collection) =>
            selectedCollectionIds.includes(collection.id),
          )
  const activeCollection = scopeCollections.find(
    (collection) => collection.id === activeCollectionId,
  )
  const previewCollection = data.collections.find(
    (collection) => collection.id === previewCollectionId,
  )
  const looseFiles = useMemo(
    () => obtenerArchivosSueltos(data.files, data.collections),
    [data.collections, data.files],
  )
  const personalFileIds = useMemo(
    () =>
      new Set(personalCollections.flatMap((collection) => collection.fileIds)),
    [personalCollections],
  )
  const curriculumFileIds = useMemo(
    () =>
      new Set(
        curriculumRepositories.flatMap((collection) => collection.fileIds),
      ),
    [curriculumRepositories],
  )
  const conversationIds = useMemo(
    () => new Set(conversationFileIds),
    [conversationFileIds],
  )
  const removableIds = useMemo(
    () => new Set(removableConversationFileIds),
    [removableConversationFileIds],
  )
  const matchesQuery = useCallback(
    (file: DocumentoArchivo) =>
      !deferredQuery ||
      file.display_name.toLocaleLowerCase('es-MX').includes(deferredQuery) ||
      file.description?.toLocaleLowerCase('es-MX').includes(deferredQuery) ===
        true,
    [deferredQuery],
  )
  const visibleCollections = ordenarColecciones(
    scopeCollections.filter(
      (collection) =>
        !deferredQuery ||
        collection.name.toLocaleLowerCase('es-MX').includes(deferredQuery) ||
        collection.description
          ?.toLocaleLowerCase('es-MX')
          .includes(deferredQuery) === true,
    ),
    sort,
  )
  const files = useMemo(() => {
    const inScope = activeCollection
      ? data.files.filter((file) => activeCollection.fileIds.includes(file.id))
      : deferredQuery && currentScope === 'personal'
        ? data.files.filter(
            (file) =>
              personalFileIds.has(file.id) || !curriculumFileIds.has(file.id),
          )
        : deferredQuery && currentScope === 'curriculum'
          ? data.files.filter((file) => curriculumFileIds.has(file.id))
          : currentScope === 'personal'
            ? looseFiles
            : currentScope === 'chat'
              ? data.files.filter((file) => conversationIds.has(file.id))
              : []
    const matched = inScope.filter(matchesQuery)
    // En un selector de referencias solo tienen sentido los archivos usables por
    // la IA (indexados = 'ready'); ocultamos procesando/requiere revisión/etc.
    // La vista de gestión (catalog) los sigue mostrando para administrarlos.
    return variant === 'catalog'
      ? matched
      : matched.filter((file) => file.status === 'ready')
  }, [
    activeCollection,
    currentScope,
    data.files,
    deferredQuery,
    curriculumFileIds,
    looseFiles,
    personalFileIds,
    conversationIds,
    matchesQuery,
    variant,
  ])
  const previewFiles = previewCollection
    ? data.files.filter((file) => previewCollection.fileIds.includes(file.id))
    : []

  const changeScope = (next: ReferenceLibraryScope) => {
    if (controlledActiveCollectionId === undefined) {
      setUncontrolledActiveCollectionId(null)
    }
    setPreviewCollectionId(null)
    if (controlledScope === undefined) setUncontrolledScope(next)
    onScopeChange?.(next)
  }
  useEffect(() => {
    if (!activeCollectionId || !library.isSuccess || activeCollection) return
    changeActiveCollection(null, 'invalid')
  }, [
    activeCollection,
    activeCollectionId,
    changeActiveCollection,
    library.isSuccess,
  ])
  const openCollection = (collection: DocumentoColeccion) => {
    changeQuery('')
    changeActiveCollection(collection.id)
  }
  const submitFiles = async (fileList: FileList | Array<File>) => {
    const selected = Array.from(fileList).slice(0, 5)
    if (onUploadFiles) {
      await onUploadFiles(selected)
      return
    }
    const results = await Promise.allSettled(
      selected.map((file) => upload.mutateAsync(file)),
    )
    results.forEach((result) => {
      if (result.status === 'fulfilled' && result.value.fileId) {
        onUploadComplete?.(result.value.fileId)
      }
    })
  }
  const create = async () => {
    if (!newName.trim()) return
    await createCollection.mutateAsync({ name: newName.trim(), kind: newKind })
    setNewName('')
    setCreateOpen(false)
  }
  const archive = async (collection: DocumentoColeccion) => {
    const confirmed = await showAppConfirm({
      title: 'Archivar colección',
      description:
        'Los archivos permanecerán disponibles y podrás organizarlos de nuevo.',
    })
    if (confirmed) archiveCollection.mutate(collection.id)
  }

  const emptyTitle = activeCollection
    ? 'Esta carpeta aún está vacía'
    : currentScope === 'curriculum'
      ? 'Aún no hay repositorios curriculares'
      : currentScope === 'chat'
        ? 'Aún no hay archivos en este chat'
        : 'No hay archivos sueltos'
  return (
    <section className={cn('gap-grupo flex min-h-0 flex-col', className)}>
      {showManagementActions ? (
        <GlobalFileDropOverlay onFiles={submitFiles} />
      ) : null}
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={ACCEPT}
        className="sr-only"
        onChange={(event) => {
          const selected = Array.from(event.target.files ?? [])
          event.target.value = ''
          if (selected.length) void submitFiles(selected)
        }}
      />

      {showScopeSwitcher && scopes.length > 1 ? (
        <Tabs
          value={currentScope}
          onValueChange={(value) => changeScope(value as ReferenceLibraryScope)}
        >
          <TabsList
            className={cn(
              'grid h-auto w-full',
              scopes.length === 3 ? 'grid-cols-3' : 'grid-cols-2',
            )}
          >
            {scopes.map((item) => (
              <TabsTrigger
                key={item}
                value={item}
                className="px-relacionado min-w-0"
              >
                <span className="truncate">{scopeLabel[item]}</span>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      ) : null}

      <div className="gap-relacionado flex min-w-0 flex-col sm:flex-row sm:items-center">
        <div className="relative min-w-0 flex-1">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <Input
            value={query}
            onChange={(event) => changeQuery(event.target.value)}
            placeholder={
              currentScope === 'curriculum'
                ? 'Buscar repositorios'
                : currentScope === 'chat'
                  ? 'Buscar en este chat'
                  : 'Buscar archivos y colecciones'
            }
            className="pl-pagina"
          />
        </div>
        <div className="gap-relacionado flex min-w-0">
          {/* Orden como icono; se resalta en azul cuando el orden activo no es
              el predeterminado (updated_desc). */}
          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    aria-label="Ordenar referencias"
                    className={cn(
                      'shrink-0',
                      sort !== defaultSort &&
                        'border-primary/40 bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary',
                    )}
                  >
                    <ArrowDownWideNarrow className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent>Ordenar referencias</TooltipContent>
            </Tooltip>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Ordenar por</DropdownMenuLabel>
              <DropdownMenuRadioGroup
                value={sort}
                onValueChange={(value) => changeSort(value as OrdenBiblioteca)}
              >
                <DropdownMenuRadioItem value="updated_desc">
                  Actualizados
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="created_desc">
                  Subidos recientemente
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="used_desc">
                  Usados recientemente
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="name_asc">
                  Nombre A–Z
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="name_desc">
                  Nombre Z–A
                </DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>

          {showUploadAction || showCreateAction ? (
            <>
              {showCreateAction ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="shrink-0"
                      aria-label="Crear colección"
                      onClick={() => {
                        setNewKind(
                          currentScope === 'curriculum'
                            ? 'curriculum_repository'
                            : 'collection',
                        )
                        setCreateOpen(true)
                      }}
                    >
                      <Folder className="size-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Crear carpeta</TooltipContent>
                </Tooltip>
              ) : null}
              {showUploadAction ? (
                <Button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  className="shrink-0"
                >
                  {upload.isPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Upload className="size-4" />
                  )}
                  {upload.isPending ? 'Añadir más' : 'Añadir'}
                </Button>
              ) : null}
            </>
          ) : null}
        </div>
      </div>

      <div
        className={cn(
          'min-h-44 overflow-hidden',
          // En el aside el panel ya aporta la superficie: sin tarjeta anidada
          // (borde/redondeo) para evitar el doble contenedor.
          variant !== 'aside' && 'border-border/70 rounded-2xl border',
        )}
      >
        {/* En el aside, la fila breadcrumb solo aparece al entrar en una
            colección; en la raíz duplicaría el encabezado del propio aside. */}
        {variant === 'aside' && !activeCollection ? null : (
          <div
            className={cn(
              'gap-micro flex min-h-11 items-center text-sm',
              variant === 'aside'
                ? 'pb-micro'
                : 'border-border/70 bg-muted/20 px-control border-b',
            )}
          >
            <button
              type="button"
              className="hover:text-foreground text-muted-foreground px-relacionado py-micro rounded-md"
              onClick={() => changeActiveCollection(null)}
            >
              {scopeLabel[currentScope]}
            </button>
            {activeCollection ? (
              <>
                <ChevronRight className="text-muted-foreground size-3.5" />
                <span className="min-w-0 truncate font-medium">
                  {activeCollection.name}
                </span>
              </>
            ) : null}
          </div>
        )}

        {library.isLoading ? (
          <div className="text-muted-foreground gap-relacionado p-seccion flex items-center text-sm">
            <Loader2 className="size-4 animate-spin" />
            Cargando referencias…
          </div>
        ) : null}

        {!library.isLoading &&
        !activeCollection &&
        visibleCollections.length ? (
          <div
            className={cn(
              'gap-micro p-relacionado grid',
              compact ? 'grid-cols-1' : 'sm:grid-cols-2 lg:grid-cols-3',
              files.length && 'border-border/70 border-b',
            )}
          >
            {visibleCollections.map((collection) => {
              const selectable = Boolean(onToggleCollection)
              const selected = selectedCollectionIds.includes(collection.id)
              return (
                <CollectionTile
                  key={collection.id}
                  collection={collection}
                  selected={selected}
                  onPrimary={() =>
                    selectable
                      ? onToggleCollection?.(collection, !selected)
                      : openCollection(collection)
                  }
                  onPreview={() => setPreviewCollectionId(collection.id)}
                  onDropFile={
                    showManagementActions
                      ? (fileId) =>
                          addToCollection.mutate({
                            collectionId: collection.id,
                            fileId,
                          })
                      : undefined
                  }
                  onArchive={
                    showManagementActions && collection.canManage
                      ? () => void archive(collection)
                      : undefined
                  }
                />
              )
            })}
          </div>
        ) : null}

        {files.length ? (
          <div className="divide-border/70 divide-y">
            {files.map((file) => {
              const canToggle =
                Boolean(onToggleFile) &&
                (currentScope !== 'chat' || removableIds.has(file.id))
              return (
                <FileRow
                  key={file.id}
                  file={file}
                  collections={personalCollections}
                  selected={selectedFileIds.includes(file.id)}
                  onToggle={
                    canToggle
                      ? (selected) => onToggleFile?.(file, selected)
                      : undefined
                  }
                  onMove={
                    showManagementActions
                      ? (collectionId) =>
                          addToCollection.mutate({
                            collectionId,
                            fileId: file.id,
                          })
                      : undefined
                  }
                  onRetry={() =>
                    file.localFile && upload.mutate(file.localFile)
                  }
                />
              )
            })}
          </div>
        ) : null}

        {!library.isLoading &&
        !files.length &&
        (activeCollection || !visibleCollections.length) ? (
          <div className="p-region text-center">
            <FileText className="text-muted-foreground mb-relacionado mx-auto size-5" />
            <p className="text-sm font-medium">
              {deferredQuery ? 'No encontramos coincidencias' : emptyTitle}
            </p>
          </div>
        ) : null}
      </div>

      <Dialog
        open={Boolean(previewCollection)}
        onOpenChange={(open) => {
          if (!open) setPreviewCollectionId(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{previewCollection?.name}</DialogTitle>
            <DialogDescription>
              {previewFiles.length}{' '}
              {previewFiles.length === 1
                ? 'archivo disponible'
                : 'archivos disponibles'}
            </DialogDescription>
          </DialogHeader>
          <div className="border-border/70 max-h-[55vh] divide-y overflow-y-auto rounded-xl border">
            {previewFiles.map((file) => (
              <FileRow
                key={file.id}
                file={file}
                collections={[]}
                selected={selectedFileIds.includes(file.id)}
                onToggle={
                  onToggleFile
                    ? (selected) => onToggleFile(file, selected)
                    : undefined
                }
                onRetry={() => file.localFile && upload.mutate(file.localFile)}
              />
            ))}
            {!previewFiles.length ? (
              <p className="text-muted-foreground p-seccion text-center text-sm">
                Esta carpeta aún no contiene archivos.
              </p>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nueva carpeta</DialogTitle>
            <DialogDescription>
              Organiza referencias de trabajo o crea un acervo de planeación
              curricular.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-control">
            <Input
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
              placeholder="Nombre de la carpeta"
              onKeyDown={(event) => {
                if (event.key === 'Enter') void create()
              }}
            />
            <Select
              value={newKind}
              onValueChange={(value) =>
                setNewKind(value as DocumentoColeccion['kind'])
              }
            >
              <SelectTrigger aria-label="Tipo de carpeta">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="collection">Colección de trabajo</SelectItem>
                <SelectItem value="curriculum_repository">
                  Repositorio de planeación curricular
                </SelectItem>
              </SelectContent>
            </Select>
            <Button
              type="button"
              className="w-full"
              onClick={() => void create()}
              disabled={!newName.trim() || createCollection.isPending}
            >
              {createCollection.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Plus className="size-4" />
              )}
              Crear carpeta
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  )
}
