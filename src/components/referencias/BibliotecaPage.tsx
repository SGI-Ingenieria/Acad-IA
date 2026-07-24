import {
  Download,
  FileText,
  Folder,
  FolderInput,
  FolderOpen,
  GraduationCap,
  LayoutGrid,
  List,
  Loader2,
  MoreHorizontal,
  Pencil,
  Search,
  StickyNote,
  Trash2,
  Upload,
} from 'lucide-react'
import { useDeferredValue, useMemo, useRef, useState } from 'react'

import type {
  DocumentoArchivo,
  DocumentoColeccion,
} from '@/data/api/documentos.api'
import type { ReferenciasSearch } from '@/types/search'

import { GlobalFileDropOverlay } from '@/components/referencias/GlobalFileDropOverlay'
import { showAppConfirm, showAppPrompt } from '@/components/ui/app-alert-dialog'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  ListFilterSection,
  ListFiltersDialog,
  ListSortMenu,
  ListToolbar,
} from '@/components/ui/list-controls'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
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
  useCrearNota,
  useEliminarDocumento,
  useQuitarDocumentoDeColeccion,
  useRenombrarDocumento,
  useSubirDocumento,
} from '@/data/hooks/useDocumentos'
import { notify } from '@/lib/toast'
import { cn } from '@/lib/utils'
import { defaultReferenciasSearch } from '@/types/search'

const ACCEPT =
  '.pdf,.docx,.pptx,.xlsx,.txt,.md,.csv,.json,.png,.jpg,.jpeg,.webp'

const BIBLIOTECA_SORT_OPTIONS = [
  { value: 'updated_desc', label: 'Actualizados' },
  { value: 'created_desc', label: 'Subidos recientemente' },
  { value: 'used_desc', label: 'Usados recientemente' },
  { value: 'name_asc', label: 'Nombre A–Z' },
  { value: 'name_desc', label: 'Nombre Z–A' },
] as const

export type BibliotecaPageProps = {
  search: ReferenciasSearch
  onSearchChange: (
    patch: Partial<ReferenciasSearch>,
    options?: { replace?: boolean },
  ) => void
}

function esImagen(file: DocumentoArchivo): boolean {
  if (file.detected_mime) return file.detected_mime.startsWith('image/')
  return /\.(png|jpe?g|webp)$/i.test(file.display_name)
}

function extensionDe(file: DocumentoArchivo): string {
  if (file.source === 'note') return 'NOTA'
  return (file.display_name.split('.').pop() ?? '').toUpperCase() || 'DOC'
}

export function formatearTamano(bytes: number | null | undefined): string {
  if (!bytes || bytes <= 0) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024)
    return `${(bytes / 1024).toLocaleString('es-MX', { maximumFractionDigits: 1 })} KB`
  return `${(bytes / (1024 * 1024)).toLocaleString('es-MX', { maximumFractionDigits: 1 })} MB`
}

export function formatearModificado(iso: string): string {
  const fecha = new Date(iso)
  if (Number.isNaN(fecha.getTime())) return '—'
  const ahora = new Date()
  const dias = Math.floor((ahora.getTime() - fecha.getTime()) / 86_400_000)
  if (dias === 0) return 'hoy'
  if (dias === 1) return 'ayer'
  if (dias < 7) {
    return fecha.toLocaleDateString('es-MX', { weekday: 'long' })
  }
  return fecha.toLocaleDateString('es-MX', {
    day: 'numeric',
    month: 'short',
    ...(fecha.getFullYear() !== ahora.getFullYear() ? { year: 'numeric' } : {}),
  })
}

async function abrirDocumento(file: DocumentoArchivo, download: boolean) {
  if (file.id.startsWith('upload:') || file.id.startsWith('pending:')) return
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

function IconoDocumento({
  file,
  className,
}: {
  file: DocumentoArchivo
  className?: string
}) {
  if (file.status === 'uploading') {
    return <Loader2 className={cn('animate-spin', className)} />
  }
  if (file.source === 'note') return <StickyNote className={className} />
  return <FileText className={className} />
}

function MenuDocumento({
  file,
  carpetas,
  carpetaActual,
  onRenombrar,
  onMover,
  onQuitarDeCarpeta,
  onEliminar,
}: {
  file: DocumentoArchivo
  carpetas: Array<DocumentoColeccion>
  carpetaActual: DocumentoColeccion | null
  onRenombrar: () => void
  onMover: (carpetaId: string) => void
  onQuitarDeCarpeta: () => void
  onEliminar: () => void
}) {
  const pendiente =
    file.id.startsWith('upload:') || file.id.startsWith('pending:')
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100"
          aria-label={`Opciones de ${file.display_name}`}
        >
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        {!pendiente ? (
          <>
            <DropdownMenuItem onSelect={() => void abrirDocumento(file, false)}>
              <FolderOpen className="size-4" />
              Previsualizar
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => void abrirDocumento(file, true)}>
              <Download className="size-4" />
              Descargar
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onRenombrar}>
              <Pencil className="size-4" />
              Renombrar
            </DropdownMenuItem>
            {carpetas.length ? (
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <FolderInput className="size-4" />
                  Añadir a carpeta
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  {carpetas.map((carpeta) => (
                    <DropdownMenuItem
                      key={carpeta.id}
                      onSelect={() => onMover(carpeta.id)}
                    >
                      <Folder className="size-4" />
                      {carpeta.name}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            ) : null}
            {carpetaActual ? (
              <DropdownMenuItem onSelect={onQuitarDeCarpeta}>
                <FolderOpen className="size-4" />
                Quitar de esta carpeta
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={onEliminar}>
              <Trash2 className="size-4" />
              Eliminar
            </DropdownMenuItem>
          </>
        ) : (
          <DropdownMenuItem disabled>Subiendo…</DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/**
 * Biblioteca de referencias: la vista de catálogo. Todo el estado de filtro,
 * búsqueda, vista y carpeta vive en la URL (compartible y restaurable).
 * El usuario sólo ve archivos y carpetas; los estados visibles son
 * "subiendo" y "listo".
 */
export function BibliotecaPage({
  search,
  onSearchChange,
}: BibliotecaPageProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [notaAbierta, setNotaAbierta] = useState(false)
  const [notaTitulo, setNotaTitulo] = useState('')
  const [notaContenido, setNotaContenido] = useState('')
  const [carpetaAbierta, setCarpetaAbierta] = useState(false)
  const [carpetaNombre, setCarpetaNombre] = useState('')
  const [carpetaKind, setCarpetaKind] =
    useState<DocumentoColeccion['kind']>('collection')
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set())

  const deferredQuery = useDeferredValue(
    search.q.trim().toLocaleLowerCase('es-MX'),
  )

  const library = useBibliotecaReferencias({ query: '', sort: search.orden })
  const upload = useSubirDocumento()
  const crearNota = useCrearNota()
  const crearCarpeta = useCrearColeccion()
  const archivarCarpeta = useArchivarColeccion()
  const agregarACarpeta = useAgregarDocumentoAColeccion()
  const quitarDeCarpeta = useQuitarDocumentoDeColeccion()
  const eliminarDocumento = useEliminarDocumento()
  const renombrarDocumento = useRenombrarDocumento()

  const data = library.data ?? { files: [], collections: [] }
  const carpetaActual =
    data.collections.find((carpeta) => carpeta.id === search.coleccion) ?? null
  const carpetasPersonales = data.collections.filter(
    (carpeta) => carpeta.kind === 'collection',
  )

  const carpetasVisibles = useMemo(() => {
    if (carpetaActual || search.tab !== 'todo') return []
    return data.collections.filter(
      (carpeta) =>
        !deferredQuery ||
        carpeta.name.toLocaleLowerCase('es-MX').includes(deferredQuery),
    )
  }, [carpetaActual, data.collections, deferredQuery, search.tab])

  const archivosVisibles = useMemo(() => {
    const dentroDeCarpetas = new Set(
      data.collections.flatMap((carpeta) => carpeta.fileIds),
    )
    let base = carpetaActual
      ? data.files.filter((file) => carpetaActual.fileIds.includes(file.id))
      : deferredQuery
        ? data.files
        : data.files.filter((file) => !dentroDeCarpetas.has(file.id))
    if (search.tab === 'imagenes') base = base.filter(esImagen)
    if (search.tab === 'archivos') base = base.filter((f) => !esImagen(f))
    if (deferredQuery) {
      base = base.filter((file) =>
        file.display_name.toLocaleLowerCase('es-MX').includes(deferredQuery),
      )
    }
    return base
  }, [carpetaActual, data.collections, data.files, deferredQuery, search.tab])

  const subirArchivos = async (fileList: FileList | Array<File>) => {
    const seleccionados = Array.from(fileList).slice(0, 5)
    await Promise.allSettled(
      seleccionados.map((file) => upload.mutateAsync(file)),
    )
  }

  const guardarNota = async () => {
    if (!notaContenido.trim()) return
    setNotaAbierta(false)
    const titulo = notaTitulo
    const contenido = notaContenido
    setNotaTitulo('')
    setNotaContenido('')
    await crearNota.mutateAsync({ titulo, contenido }).catch(() => {})
  }

  const guardarCarpeta = async () => {
    if (!carpetaNombre.trim()) return
    setCarpetaAbierta(false)
    const nombre = carpetaNombre.trim()
    setCarpetaNombre('')
    await crearCarpeta
      .mutateAsync({ name: nombre, kind: carpetaKind })
      .catch(() => {})
  }

  const renombrar = async (file: DocumentoArchivo) => {
    const nombre = await showAppPrompt({
      title: 'Renombrar archivo',
      description: 'El nuevo nombre se mostrará en toda la biblioteca.',
      initialValue: file.display_name,
      confirmLabel: 'Renombrar',
      required: true,
    })
    if (nombre?.trim() && nombre.trim() !== file.display_name) {
      renombrarDocumento.mutate({ fileId: file.id, displayName: nombre.trim() })
    }
  }

  const eliminar = async (files: Array<DocumentoArchivo>) => {
    const confirmado = await showAppConfirm({
      title: files.length === 1 ? 'Eliminar archivo' : 'Eliminar archivos',
      description:
        files.length === 1
          ? `"${files[0].display_name}" dejará de estar disponible como referencia. Los documentos ya usados en generaciones conservan su trazabilidad.`
          : `${files.length} archivos dejarán de estar disponibles como referencia.`,
      variant: 'destructive',
    })
    if (!confirmado) return
    setSeleccion(new Set())
    files.forEach((file) => eliminarDocumento.mutate(file.id))
  }

  const archivarColeccionActual = async (carpeta: DocumentoColeccion) => {
    const confirmado = await showAppConfirm({
      title: 'Archivar carpeta',
      description:
        'Los archivos permanecerán disponibles en la biblioteca; sólo desaparece la agrupación.',
    })
    if (confirmado) {
      onSearchChange({ coleccion: '' })
      archivarCarpeta.mutate(carpeta.id)
    }
  }

  const toggleSeleccion = (fileId: string, selected: boolean) => {
    setSeleccion((previa) => {
      const siguiente = new Set(previa)
      if (selected) siguiente.add(fileId)
      else siguiente.delete(fileId)
      return siguiente
    })
  }
  const archivosSeleccionados = archivosVisibles.filter((file) =>
    seleccion.has(file.id),
  )

  const abrirCarpeta = (carpeta: DocumentoColeccion) =>
    onSearchChange({ coleccion: carpeta.id, q: '' })

  const vacioSinResultados = Boolean(deferredQuery)
  const vacio =
    !library.isLoading && !carpetasVisibles.length && !archivosVisibles.length

  return (
    <section className="flex min-h-0 flex-col gap-5">
      <GlobalFileDropOverlay onFiles={subirArchivos} />
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={ACCEPT}
        className="sr-only"
        onChange={(event) => {
          const seleccionados = event.target.files
          event.target.value = ''
          if (seleccionados) void subirArchivos(seleccionados)
        }}
      />

      {/* Encabezado: ruta (breadcrumb), búsqueda y creación */}
      <header className="flex flex-wrap items-center gap-3">
        <Breadcrumb className="min-w-0 flex-1">
          <BreadcrumbList className="text-base">
            <BreadcrumbItem>
              {carpetaActual ? (
                <BreadcrumbLink asChild>
                  <button
                    type="button"
                    onClick={() => onSearchChange({ coleccion: '' })}
                  >
                    Biblioteca
                  </button>
                </BreadcrumbLink>
              ) : (
                <BreadcrumbPage className="font-semibold">
                  Biblioteca
                </BreadcrumbPage>
              )}
            </BreadcrumbItem>
            {carpetaActual ? (
              <>
                <BreadcrumbSeparator />
                <BreadcrumbItem className="min-w-0">
                  <BreadcrumbPage className="flex min-w-0 items-center gap-1.5 font-semibold">
                    {carpetaActual.kind === 'curriculum_repository' ? (
                      <GraduationCap className="text-muted-foreground size-4 shrink-0" />
                    ) : null}
                    <span className="truncate">{carpetaActual.name}</span>
                  </BreadcrumbPage>
                </BreadcrumbItem>
              </>
            ) : null}
          </BreadcrumbList>
        </Breadcrumb>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" className="rounded-full">
              Nuevo
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem onSelect={() => inputRef.current?.click()}>
              <Upload className="size-4" />
              Cargar
            </DropdownMenuItem>
            {!carpetaActual ? (
              <DropdownMenuItem
                onSelect={() => {
                  setCarpetaKind('collection')
                  setCarpetaAbierta(true)
                }}
              >
                <Folder className="size-4" />
                Carpeta
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuItem onSelect={() => setNotaAbierta(true)}>
              <StickyNote className="size-4" />
              Nota
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      <ListToolbar
        search={
          <div className="relative w-full">
            <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
            <Input
              value={search.q}
              onChange={(event) =>
                onSearchChange({ q: event.target.value }, { replace: true })
              }
              placeholder="Buscar archivos y colecciones"
              className="pl-9"
              aria-label="Buscar en la biblioteca"
            />
          </div>
        }
        actions={
          <>
            <ListSortMenu
              value={search.orden}
              defaultValue={defaultReferenciasSearch.orden}
              options={[...BIBLIOTECA_SORT_OPTIONS]}
              onValueChange={(orden) => onSearchChange({ orden })}
              label="Ordenar biblioteca"
            />
            <ListFiltersDialog
              title="Filtrar la biblioteca"
              value={{ tab: search.tab }}
              defaultValue={{ tab: defaultReferenciasSearch.tab }}
              activeCount={search.tab === 'todo' ? 0 : 1}
              onApply={(next, { resetAll }) =>
                onSearchChange({
                  tab: next.tab,
                  q: resetAll ? '' : search.q,
                  orden: resetAll
                    ? defaultReferenciasSearch.orden
                    : search.orden,
                })
              }
              label="Filtrar biblioteca"
            >
              {(draft, setDraft) => (
                <ListFilterSection title="Tipo de contenido">
                  <RadioGroup
                    value={draft.tab}
                    onValueChange={(tab) =>
                      setDraft({
                        tab: tab as ReferenciasSearch['tab'],
                      })
                    }
                  >
                    {[
                      ['todo', 'Todo'],
                      ['imagenes', 'Imágenes'],
                      ['archivos', 'Archivos'],
                    ].map(([value, label]) => (
                      <Label
                        key={value}
                        className="border-border flex cursor-pointer items-center gap-3 rounded-md border px-3 py-3"
                      >
                        <RadioGroupItem value={value} />
                        {label}
                      </Label>
                    ))}
                  </RadioGroup>
                </ListFilterSection>
              )}
            </ListFiltersDialog>
          </>
        }
        view={
          <>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant={search.modo === 'grid' ? 'secondary' : 'ghost'}
                  size="icon"
                  aria-label="Vista de cuadrícula"
                  onClick={() => onSearchChange({ modo: 'grid' })}
                >
                  <LayoutGrid className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Cuadrícula</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant={search.modo === 'lista' ? 'secondary' : 'ghost'}
                  size="icon"
                  aria-label="Vista de lista"
                  onClick={() => onSearchChange({ modo: 'lista' })}
                >
                  <List className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Lista</TooltipContent>
            </Tooltip>
            {carpetaActual?.canManage ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Archivar carpeta"
                    onClick={() => void archivarColeccionActual(carpetaActual)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Archivar carpeta</TooltipContent>
              </Tooltip>
            ) : null}
          </>
        }
      />

      {/* Barra de acciones de selección múltiple */}
      {archivosSeleccionados.length ? (
        <div className="bg-muted/60 flex items-center gap-2 rounded-lg px-3 py-2 text-sm">
          <span className="font-medium">
            {archivosSeleccionados.length} seleccionado
            {archivosSeleccionados.length === 1 ? '' : 's'}
          </span>
          <div className="ml-auto flex items-center gap-1">
            {carpetasPersonales.length ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button type="button" variant="ghost" size="sm">
                    <FolderInput className="size-4" />
                    Añadir a carpeta
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {carpetasPersonales.map((carpeta) => (
                    <DropdownMenuItem
                      key={carpeta.id}
                      onSelect={() => {
                        archivosSeleccionados.forEach((file) =>
                          agregarACarpeta.mutate({
                            collectionId: carpeta.id,
                            fileId: file.id,
                          }),
                        )
                        setSeleccion(new Set())
                      }}
                    >
                      <Folder className="size-4" />
                      {carpeta.name}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive"
              onClick={() => void eliminar(archivosSeleccionados)}
            >
              <Trash2 className="size-4" />
              Eliminar
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setSeleccion(new Set())}
            >
              Cancelar
            </Button>
          </div>
        </div>
      ) : null}

      {/* Contenido */}
      {library.isLoading ? (
        <div className="text-muted-foreground flex items-center gap-2 py-10 text-sm">
          <Loader2 className="size-4 animate-spin" />
          Cargando tu biblioteca…
        </div>
      ) : vacio ? (
        <div className="py-16 text-center">
          <FileText className="text-muted-foreground mx-auto mb-3 size-6" />
          <p className="text-sm font-medium">
            {vacioSinResultados
              ? 'No encontramos coincidencias'
              : carpetaActual
                ? 'Esta carpeta aún está vacía'
                : search.tab === 'imagenes'
                  ? 'Aún no hay imágenes en tu biblioteca'
                  : 'Tu biblioteca está lista para empezar'}
          </p>
        </div>
      ) : search.modo === 'grid' ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {carpetasVisibles.map((carpeta) => (
            <button
              key={carpeta.id}
              type="button"
              onClick={() => abrirCarpeta(carpeta)}
              className="group bg-card hover:bg-muted/60 flex aspect-[4/3] flex-col rounded-xl border p-3 text-left transition-colors"
            >
              <span className="truncate text-sm font-medium">
                {carpeta.name}
              </span>
              <span className="grid flex-1 place-items-center">
                {carpeta.kind === 'curriculum_repository' ? (
                  <GraduationCap className="text-primary size-8" />
                ) : (
                  <Folder className="text-primary size-8" />
                )}
              </span>
              <span className="text-muted-foreground text-xs tracking-wide uppercase">
                {carpeta.fileIds.length}{' '}
                {carpeta.fileIds.length === 1 ? 'archivo' : 'archivos'}
              </span>
            </button>
          ))}
          {archivosVisibles.map((file) => (
            <div
              key={file.id}
              className="group bg-card hover:bg-muted/60 relative flex aspect-[4/3] flex-col rounded-xl border p-3 transition-colors"
            >
              <div className="flex min-w-0 items-start justify-between gap-1">
                <button
                  type="button"
                  className="min-w-0 truncate text-left text-sm font-medium"
                  onClick={() => void abrirDocumento(file, false)}
                >
                  {file.display_name}
                </button>
                <MenuDocumento
                  file={file}
                  carpetas={carpetasPersonales}
                  carpetaActual={carpetaActual}
                  onRenombrar={() => void renombrar(file)}
                  onMover={(carpetaId) =>
                    agregarACarpeta.mutate({
                      collectionId: carpetaId,
                      fileId: file.id,
                    })
                  }
                  onQuitarDeCarpeta={() =>
                    carpetaActual &&
                    quitarDeCarpeta.mutate({
                      collectionId: carpetaActual.id,
                      fileId: file.id,
                    })
                  }
                  onEliminar={() => void eliminar([file])}
                />
              </div>
              <span className="grid flex-1 place-items-center">
                <IconoDocumento file={file} className="text-primary size-8" />
              </span>
              <span className="text-muted-foreground text-xs tracking-wide uppercase">
                {file.status === 'uploading'
                  ? `Subiendo… ${file.uploadProgress ?? 0}%`
                  : `${extensionDe(file)} • ${formatearTamano(file.size_bytes)}`}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div className="min-w-0">
          <div className="text-muted-foreground grid grid-cols-[auto_1fr_8rem_6rem_2.5rem] items-center gap-3 border-b px-2 pb-2 text-xs font-medium">
            <span className="w-5" aria-hidden />
            <span>Nombre</span>
            <span>Modificado</span>
            <span>Tamaño</span>
            <span aria-hidden />
          </div>
          <ul className="divide-y">
            {carpetasVisibles.map((carpeta) => (
              <li
                key={carpeta.id}
                className="group grid grid-cols-[auto_1fr_8rem_6rem_2.5rem] items-center gap-3 px-2 py-2.5"
              >
                <span className="w-5" aria-hidden />
                <button
                  type="button"
                  className="flex min-w-0 items-center gap-3 text-left"
                  onClick={() => abrirCarpeta(carpeta)}
                >
                  <span className="bg-muted grid size-8 shrink-0 place-items-center rounded-lg">
                    {carpeta.kind === 'curriculum_repository' ? (
                      <GraduationCap className="size-4" />
                    ) : (
                      <Folder className="size-4" />
                    )}
                  </span>
                  <span className="truncate text-sm font-medium">
                    {carpeta.name}
                  </span>
                </button>
                <span className="text-muted-foreground text-sm">
                  {formatearModificado(carpeta.updated_at)}
                </span>
                <span className="text-muted-foreground text-sm">—</span>
                <span aria-hidden />
              </li>
            ))}
            {archivosVisibles.map((file) => {
              const seleccionado = seleccion.has(file.id)
              const pendiente =
                file.id.startsWith('upload:') || file.id.startsWith('pending:')
              return (
                <li
                  key={file.id}
                  className={cn(
                    'group grid grid-cols-[auto_1fr_8rem_6rem_2.5rem] items-center gap-3 px-2 py-2.5 transition-colors',
                    seleccionado && 'bg-primary/5',
                  )}
                >
                  <Checkbox
                    checked={seleccionado}
                    disabled={pendiente}
                    onCheckedChange={(checked) =>
                      toggleSeleccion(file.id, checked === true)
                    }
                    aria-label={`Seleccionar ${file.display_name}`}
                    className={cn(
                      'opacity-0 group-hover:opacity-100 focus-visible:opacity-100',
                      (seleccionado || seleccion.size > 0) && 'opacity-100',
                    )}
                  />
                  <button
                    type="button"
                    className="flex min-w-0 items-center gap-3 text-left"
                    onClick={() =>
                      seleccion.size
                        ? !pendiente && toggleSeleccion(file.id, !seleccionado)
                        : void abrirDocumento(file, false)
                    }
                  >
                    <span className="bg-muted grid size-8 shrink-0 place-items-center rounded-lg">
                      <IconoDocumento file={file} className="size-4" />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">
                        {file.display_name}
                      </span>
                      {file.status === 'uploading' ? (
                        <span className="text-muted-foreground block text-xs">
                          Subiendo… {file.uploadProgress ?? 0}%
                        </span>
                      ) : null}
                    </span>
                  </button>
                  <span className="text-muted-foreground text-sm">
                    {formatearModificado(file.updated_at)}
                  </span>
                  <span className="text-muted-foreground text-sm">
                    {formatearTamano(file.size_bytes)}
                  </span>
                  <MenuDocumento
                    file={file}
                    carpetas={carpetasPersonales}
                    carpetaActual={carpetaActual}
                    onRenombrar={() => void renombrar(file)}
                    onMover={(carpetaId) =>
                      agregarACarpeta.mutate({
                        collectionId: carpetaId,
                        fileId: file.id,
                      })
                    }
                    onQuitarDeCarpeta={() =>
                      carpetaActual &&
                      quitarDeCarpeta.mutate({
                        collectionId: carpetaActual.id,
                        fileId: file.id,
                      })
                    }
                    onEliminar={() => void eliminar([file])}
                  />
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {/* Nueva nota */}
      <Dialog open={notaAbierta} onOpenChange={setNotaAbierta}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nueva nota</DialogTitle>
            <DialogDescription>
              La nota se guarda como un archivo de texto y queda disponible como
              referencia para la IA.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="nota-titulo">Título</Label>
              <Input
                id="nota-titulo"
                value={notaTitulo}
                onChange={(event) => setNotaTitulo(event.target.value)}
                placeholder="Título de la nota"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nota-contenido">Contenido</Label>
              <Textarea
                id="nota-contenido"
                value={notaContenido}
                onChange={(event) => setNotaContenido(event.target.value)}
                placeholder="Escribe el contenido de la nota…"
                className="min-h-44"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              onClick={() => void guardarNota()}
              disabled={!notaContenido.trim()}
            >
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Nueva carpeta */}
      <Dialog open={carpetaAbierta} onOpenChange={setCarpetaAbierta}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nueva carpeta</DialogTitle>
            <DialogDescription>
              Agrupa referencias de trabajo o crea un acervo de planeación
              curricular.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="carpeta-nombre">Nombre</Label>
              <Input
                id="carpeta-nombre"
                value={carpetaNombre}
                onChange={(event) => setCarpetaNombre(event.target.value)}
                placeholder="Nombre de la carpeta"
                onKeyDown={(event) => {
                  if (event.key === 'Enter') void guardarCarpeta()
                }}
              />
            </div>
            <Select
              value={carpetaKind}
              onValueChange={(value) =>
                setCarpetaKind(value as DocumentoColeccion['kind'])
              }
            >
              <SelectTrigger aria-label="Tipo de carpeta">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="collection">Carpeta de trabajo</SelectItem>
                <SelectItem value="curriculum_repository">
                  Repositorio de planeación curricular
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button
              type="button"
              onClick={() => void guardarCarpeta()}
              disabled={!carpetaNombre.trim()}
            >
              Crear carpeta
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}
