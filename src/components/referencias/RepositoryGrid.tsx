/* eslint-disable jsx-a11y/label-has-associated-control */
/* eslint-disable jsx-a11y/no-static-element-interactions */
/* eslint-disable jsx-a11y/click-events-have-key-events */
import { FilePlus, Folder, Plus, Users, Lock } from 'lucide-react'
import { useEffect, useState } from 'react'

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
  // 2. Estado para el repositorio seleccionado (por defecto el primero)
  const { mutate: createRepositorio } = useCreateRepositorio()
  const { data: repositorios } = useRepositorios()
  const [selectedRepo, setSelectedRepo] = useState<any>(null)

  const [openAttachModal, setOpenAttachModal] = useState(false)

  const [selectedFiles, setSelectedFiles] =
    // eslint-disable-next-line @typescript-eslint/array-type
    useState<string[]>([])

  const [openCreateModal, setOpenCreateModal] = useState(false)

  const [repoName, setRepoName] = useState('')

  const { mutate: attachFile } = useAttachFileToVectorStore()

  useEffect(() => {
    if (!repositorios?.length) {
      setSelectedRepo(null)
      return
    }

    const hasSelected =
      selectedRepo &&
      repositorios.some((repo: any) => repo.id === selectedRepo.id)

    if (!hasSelected) {
      setSelectedRepo(repositorios[0])
    }
  }, [repositorios, selectedRepo])

  const handleAttachFiles = async () => {
    if (!selectedRepo?.openai_vector_store_id) return

    await Promise.all(
      selectedFiles.map((archivoId) =>
        attachFile({
          vectorStoreId: selectedRepo.openai_vector_store_id,

          repositorioId: selectedRepo.id,

          archivoId,
        }),
      ),
    )

    setOpenAttachModal(false)
    setSelectedFiles([])
  }
  const handleCreateRepository = () => {
    if (!repoName.trim()) return

    createRepositorio(
      { nombre: repoName },
      {
        onSuccess: () => {
          setRepoName('')
          setOpenCreateModal(false)
        },
      },
    )
  }

  const totalRepos = repositorios?.length ?? 0
  const totalFiles =
    selectedRepo?.archivos_repositorios?.[0]?.count ??
    selectedRepo?.file_counts?.total ??
    0
  const updatedAt = selectedRepo?.updated_at || selectedRepo?.created_at
  const formattedDate = updatedAt
    ? new Date(updatedAt).toLocaleDateString()
    : null
  const isShared = Boolean(selectedRepo?.shared)

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

            <DialogContent className="max-w-md">
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
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setOpenCreateModal(false)}
                  >
                    Cancelar
                  </Button>

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
              repositorios.map((repo: any) => (
                <RepoSidebarItem
                  key={repo.id}
                  title={repo.nombre}
                  count={repo.archivos_repositorios?.[0]?.count || 0}
                  active={selectedRepo?.id === repo.id}
                  updatedAt={repo.updated_at || repo.created_at}
                  onClick={() => setSelectedRepo(repo)}
                />
              ))
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
                  {isShared ? (
                    <Users className="h-3.5 w-3.5" />
                  ) : (
                    <Lock className="h-3.5 w-3.5" />
                  )}
                  {isShared ? 'Compartido' : 'Privado'}
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
          <Dialog open={openAttachModal} onOpenChange={setOpenAttachModal}>
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

            <DialogContent className="bg-background border-border text-foreground max-w-2xl">
              <DialogHeader>
                <DialogTitle>Vincular archivos al repositorio</DialogTitle>
              </DialogHeader>

              <div className="max-h-125 overflow-auto p-1">
                <FileTableDetailed
                  selectable
                  viewType="custom-grid"
                  selectedFiles={selectedFiles}
                  onToggleFile={(fileId, checked) => {
                    if (checked) {
                      setSelectedFiles((prev) => [...prev, fileId])
                    } else {
                      setSelectedFiles((prev) =>
                        prev.filter((id) => id !== fileId),
                      )
                    }
                  }}
                />
              </div>

              <div className="mt-4 flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setOpenAttachModal(false)}
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleAttachFiles}
                  disabled={selectedFiles.length === 0}
                >
                  Vincular archivos
                </Button>
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

// Actualizamos el SidebarItem para recibir el evento onClick
function RepoSidebarItem({ title, count, active, updatedAt, onClick }: any) {
  const formattedDate = updatedAt
    ? new Date(updatedAt).toLocaleDateString()
    : null

  return (
    <div
      onClick={onClick}
      className={cn(
        'group cursor-pointer rounded-xl border p-3 transition-all',
        active
          ? 'border-primary/40 bg-primary/5'
          : 'hover:border-muted-foreground/40',
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            'rounded-lg border p-2 transition-colors',
            active
              ? 'bg-primary/10 border-primary/20'
              : 'bg-muted/40 border-border group-hover:bg-background',
          )}
        >
          <Folder
            className={cn(
              'h-5 w-5',
              active ? 'text-primary' : 'text-muted-foreground',
            )}
          />
        </div>
        <div className="min-w-0 flex-1">
          <p
            className={cn(
              'truncate text-sm font-semibold',
              active && 'text-primary',
            )}
          >
            {title || 'Sin nombre'}
          </p>
          <div className="text-muted-foreground mt-1 flex flex-wrap items-center gap-2 text-xs">
            <span>{count} archivos</span>
            {formattedDate && (
              <>
                <span>•</span>
                <span>{formattedDate}</span>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
