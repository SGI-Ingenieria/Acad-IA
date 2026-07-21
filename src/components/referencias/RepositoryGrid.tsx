/* eslint-disable jsx-a11y/label-has-associated-control */
/* eslint-disable jsx-a11y/click-events-have-key-events */
import { Navigate, useNavigate, useParams } from '@tanstack/react-router'
import { FilePlus, Folder, Loader2, Plus, Lock } from 'lucide-react'
import { useState } from 'react'

import { Button } from '../ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../ui/dialog'
import { Input } from '../ui/input'
import { ScrollArea } from '../ui/scroll-area'
import { Separator } from '../ui/separator'

import { FileTableDetailed } from './FileTableDetailed'

import {
  useAttachFileToVectorStore,
  useCreateRepositorio,
  useRepositorios,
} from '@/data/hooks/useFiles'
import { cn } from '@/lib/utils'

export function RepositoryGrid() {
  const { mutate: createRepositorio } = useCreateRepositorio()
  const { data: repositorios } = useRepositorios()
  const { repoId } = useParams({
    from: '/referencias/repositorios/{-$repoId}',
  })
  const navigate = useNavigate()

  const selectedRepo =
    repositorios?.find((repo: any) => repo.id === repoId) ?? null

  const goToRepo = (nextRepoId: string | undefined) =>
    navigate({
      to: '/referencias/repositorios/{-$repoId}',
      params: { repoId: nextRepoId },
    })

  const [openAttachModal, setOpenAttachModal] = useState(false)

  const [selectedFiles, setSelectedFiles] =
    // eslint-disable-next-line @typescript-eslint/array-type
    useState<string[]>([])

  const [openCreateModal, setOpenCreateModal] = useState(false)

  const [repoName, setRepoName] = useState('')

  const { mutate: attachFile } = useAttachFileToVectorStore()

  const handleAttachFiles = async () => {
    const vectorStoreId = selectedRepo?.openai_vector_store_id
    const repositorioId = selectedRepo?.id
    if (!vectorStoreId || !repositorioId) return

    await Promise.all(
      selectedFiles.map((archivoId) =>
        attachFile({
          vectorStoreId,

          repositorioId,

          archivoId,
        }),
      ),
    )

    setOpenAttachModal(false)
    setSelectedFiles([])
  }
  const handleCreateRepository = () => {
    if (!repoName.trim()) return

    // Cerramos al instante; el optimistic update ya pinta el repo con badge
    // "Creando…" en el sidebar.
    createRepositorio({ nombre: repoName })
    setRepoName('')
    setOpenCreateModal(false)
  }

  const totalRepos = repositorios?.length ?? 0
  const totalFiles = selectedRepo?.archivos_repositorios[0]?.count ?? 0
  const updatedAt = selectedRepo?.created_at
  const formattedDate = updatedAt
    ? new Date(updatedAt).toLocaleDateString()
    : null

  // Normalización declarativa de la URL (sin useEffect): si el repo de la URL
  // no existe, redirige al primer repositorio real. Los repos optimistas
  // (`__optimistic`, con id temporal) aún no son navegables.
  const fallbackRepoId = repositorios?.find(
    (repo: any) => !repo.__optimistic,
  )?.id
  if (repositorios?.length && !selectedRepo && fallbackRepoId) {
    return (
      <Navigate
        to="/referencias/repositorios/{-$repoId}"
        params={{ repoId: fallbackRepoId }}
      />
    )
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
      <aside className="border-border bg-card/60 rounded-2xl border p-4 shadow-sm">
        <div className="flex items-center justify-between px-1">
          <div>
            <p className="text-muted-foreground text-xs font-semibold uppercase">
              Repositorios
            </p>
            <p className="text-foreground text-sm font-medium">
              {totalRepos} disponibles
            </p>
          </div>
          <Dialog open={openCreateModal} onOpenChange={setOpenCreateModal}>
            <DialogTrigger asChild>
              <Button size="sm" variant="secondary">
                <Plus className="mr-2 h-4 w-4" />
                Nuevo
              </Button>
            </DialogTrigger>

            <DialogContent className="sm:max-w-2xl">
              <DialogHeader>
                <DialogTitle>Crear repositorio</DialogTitle>
              </DialogHeader>

              <form
                className="space-y-4"
                onSubmit={(e) => {
                  e.preventDefault()
                  handleCreateRepository()
                }}
              >
                <div className="space-y-2">
                  <label className="text-sm font-medium">Nombre</label>

                  <Input
                    placeholder="Ej. Bibliografía IA"
                    value={repoName}
                    onChange={(e) => setRepoName(e.target.value)}
                  />
                </div>

                <div className="flex justify-end gap-2">
                  <Button type="submit">Crear repositorio</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Separator className="my-4" />

        <ScrollArea className="max-h-[60vh] pr-3 lg:max-h-[calc(100vh-320px)]">
          <div className="space-y-2">
            {repositorios?.length ? (
              repositorios.map((repo: any) => {
                const pending = Boolean(repo.__optimistic)
                return (
                  <RepoSidebarItem
                    key={repo.id}
                    title={repo.nombre}
                    count={repo.archivos_repositorios?.[0]?.count || 0}
                    active={selectedRepo?.id === repo.id}
                    updatedAt={repo.updated_at || repo.created_at}
                    pending={pending}
                    onClick={pending ? undefined : () => goToRepo(repo.id)}
                  />
                )
              })
            ) : (
              <div className="text-muted-foreground rounded-xl border border-dashed p-6 text-center text-sm">
                Aún no hay repositorios creados.
              </div>
            )}
          </div>
        </ScrollArea>
      </aside>

      <section className="border-border bg-card/60 space-y-6 rounded-2xl border p-5 shadow-sm md:p-6">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <h2 className="text-foreground text-xl font-semibold">
                {selectedRepo?.nombre || 'Selecciona un repositorio'}
              </h2>
              {selectedRepo?.id && (
                <span className="text-muted-foreground inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs">
                  <Lock className="h-3.5 w-3.5" />
                  Privado
                </span>
              )}
            </div>
            {selectedRepo?.id && (
              <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-xs">
                <span>{totalFiles} archivos</span>
                {formattedDate && (
                  <>
                    <span>•</span>
                    <span>Actualizado {formattedDate}</span>
                  </>
                )}
              </div>
            )}
          </div>
          <Dialog
            open={openAttachModal}
            onOpenChange={(open) => {
              setOpenAttachModal(open)

              if (!open) {
                setSelectedFiles([])
              }
            }}
          >
            <DialogTrigger asChild>
              <Button
                size="sm"
                variant="secondary"
                disabled={!selectedRepo?.id}
              >
                <FilePlus className="mr-2 h-4 w-4" />
                Agregar archivo
              </Button>
            </DialogTrigger>

            <DialogContent
              className={cn(
                'p-0',
                'w-full sm:max-w-5xl',
                'max-h-[90vh] overflow-hidden rounded-3xl',
              )}
            >
              <DialogHeader className="border-border border-b px-6 py-5">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <DialogTitle>Vincular archivos al repositorio</DialogTitle>

                    <p className="text-muted-foreground mt-1 text-sm">
                      Selecciona uno o varios archivos para agregarlos a{' '}
                      <span className="text-foreground font-medium">
                        {selectedRepo?.nombre}
                      </span>
                    </p>
                  </div>

                  {selectedFiles.length > 0 && (
                    <div className="bg-primary/10 text-primary shrink-0 rounded-full px-3 py-1 text-xs font-medium">
                      {selectedFiles.length} seleccionado
                      {selectedFiles.length > 1 ? 's' : ''}
                    </div>
                  )}
                </div>
              </DialogHeader>

              <div className="max-h-[calc(90vh-180px)] overflow-y-auto px-6 py-5">
                <FileTableDetailed
                  selectable
                  viewType="list"
                  selectedFiles={selectedFiles}
                  onToggleFile={(fileId, checked) => {
                    if (checked) {
                      setSelectedFiles((prev) =>
                        prev.includes(fileId) ? prev : [...prev, fileId],
                      )
                    } else {
                      setSelectedFiles((prev) =>
                        prev.filter((id) => id !== fileId),
                      )
                    }
                  }}
                />
              </div>

              <div className="bg-background border-border flex items-center justify-between gap-3 border-t px-6 py-4">
                <p className="text-muted-foreground text-xs">
                  {selectedFiles.length === 0
                    ? 'Selecciona al menos un archivo para continuar.'
                    : `${selectedFiles.length} archivo${
                        selectedFiles.length > 1 ? 's' : ''
                      } listo${selectedFiles.length > 1 ? 's' : ''} para vincular.`}
                </p>

                <div className="flex justify-end gap-2">
                  <Button
                    onClick={handleAttachFiles}
                    disabled={selectedFiles.length === 0}
                  >
                    Vincular archivos
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </header>

        <Separator />

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-foreground text-sm font-semibold">Archivos</h3>
            {selectedRepo?.id && (
              <span className="text-muted-foreground text-xs">
                {totalFiles} en total
              </span>
            )}
          </div>
          {selectedRepo?.id ? (
            <FileTableDetailed repositorioId={selectedRepo.id} />
          ) : (
            <div className="text-muted-foreground rounded-xl border border-dashed p-8 text-center text-sm">
              Elige un repositorio para ver sus archivos.
            </div>
          )}
        </div>
      </section>
    </div>
  )
}

interface RepoSidebarItemProps {
  title: string | null
  count: number
  active: boolean
  updatedAt: string | null
  onClick?: () => void
  pending?: boolean
}

// Actualizamos el SidebarItem para recibir el evento onClick
function RepoSidebarItem({
  title,
  count,
  active,
  updatedAt,
  onClick,
  pending = false,
}: RepoSidebarItemProps) {
  const formattedDate = updatedAt
    ? new Date(updatedAt).toLocaleDateString()
    : null

  return (
    <div
      onClick={pending ? undefined : onClick}
      aria-disabled={pending || undefined}
      className={cn(
        'group rounded-xl border p-3 transition-all',
        pending ? 'cursor-progress border-dashed opacity-70' : 'cursor-pointer',
        active && !pending
          ? 'border-primary/40 bg-primary/5'
          : !pending && 'hover:border-muted-foreground/40',
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            'rounded-lg border p-2 transition-colors',
            active && !pending
              ? 'bg-primary/10 border-primary/20'
              : 'bg-muted/40 border-border group-hover:bg-background',
          )}
        >
          {pending ? (
            <Loader2 className="text-muted-foreground h-5 w-5 animate-spin" />
          ) : (
            <Folder
              className={cn(
                'h-5 w-5',
                active ? 'text-primary' : 'text-muted-foreground',
              )}
            />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p
              className={cn(
                'truncate text-sm font-semibold',
                active && !pending && 'text-primary',
              )}
            >
              {title || 'Sin nombre'}
            </p>
            {pending && (
              <span className="text-muted-foreground border-muted-foreground/30 inline-flex shrink-0 items-center rounded-full border px-1.5 py-0.5 text-[10px] font-medium tracking-wide uppercase">
                Creando…
              </span>
            )}
          </div>
          <div className="text-muted-foreground mt-1 flex flex-wrap items-center gap-2 text-xs">
            {pending ? (
              <span>Sincronizando con OpenAI…</span>
            ) : (
              <>
                <span>{count} archivos</span>
                {formattedDate && (
                  <>
                    <span>•</span>
                    <span>{formattedDate}</span>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
