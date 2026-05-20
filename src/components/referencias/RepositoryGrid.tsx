/* eslint-disable jsx-a11y/label-has-associated-control */
/* eslint-disable jsx-a11y/no-static-element-interactions */
/* eslint-disable jsx-a11y/click-events-have-key-events */
import { Check, Folder, Plus, Settings, Users, Lock } from "lucide-react"
import { useEffect, useState } from "react"

import { Badge } from "../ui/badge"
import { Button } from "../ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "../ui/dialog"
import { Input } from "../ui/input"
import { ScrollArea } from "../ui/scroll-area"
import { Separator } from "../ui/separator"

import { FileTableDetailed } from "./FileTableDetailed"

import { useAttachFileToVectorStore, useCreateRepositorio, useRepositorios } from "@/data/hooks/useFiles"
import { cn } from "@/lib/utils"





export function RepositoryGrid() {
  // 2. Estado para el repositorio seleccionado (por defecto el primero)
  const { mutate: createRepositorio } =useCreateRepositorio()
  const { data: repositorios } =
  useRepositorios()
  const [selectedRepo, setSelectedRepo] = useState<any>(null)

  const [openAttachModal, setOpenAttachModal] =
  useState(false)

const [selectedFiles, setSelectedFiles] =
  // eslint-disable-next-line @typescript-eslint/array-type
  useState<string[]>([])

const [openCreateModal, setOpenCreateModal] =
  useState(false)

const [repoName, setRepoName] =
  useState('')

const { mutate: attachFile } =
  useAttachFileToVectorStore()

  useEffect(() => {
  if (
    repositorios?.length &&
    !selectedRepo
  ) {
    setSelectedRepo(repositorios[0])
  }
}, [repositorios])

const handleAttachFiles = async () => {

  if (!selectedRepo?.openai_vector_store_id)
    return

  for (const archivoId of selectedFiles) {
    attachFile({
      vectorStoreId:
        selectedRepo.openai_vector_store_id,
      archivoId,
    })
  }

  setOpenAttachModal(false)
  setSelectedFiles([])
}
const handleCreateRepository = () => {
  if (!repoName.trim()) return

  createRepositorio(
    {
      action: 'create_vector_store',
      nombre: repoName,
    },
    {
      onSuccess: () => {
        setRepoName('')
        setOpenCreateModal(false)
      },
    },
  )
}


  return (
    <div className="grid grid-cols-[350px_1fr] gap-6 h-[calc(100vh-200px)]">
      {/* Columna Izquierda: Lista de Repositorios */}
      <ScrollArea className="pr-4 border-r">
        <div className="space-y-6">
          <section>
            <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-3 px-2">Mis Repositorios</h4>
            <div className="space-y-2">
              {repositorios?.map((repo: any) => (
                <RepoSidebarItem
                  key={repo.id}
                  title={repo.nombre}
                  count={
                    repo.archivos_repositorios?.[0]
                      ?.count || 0
                  }
                  status={
                    repo.status === 'completed'
                      ? 'Listo'
                      : repo.status === 'in_progress'
                      ? 'Procesando'
                      : 'Error'
                  }
                  active={selectedRepo?.id === repo.id}
                  onClick={() => setSelectedRepo(repo)}
                />
              ))}
            </div>
          </section>
          
          <section>
            <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-3 px-2">Compartidos</h4>
            <div className="space-y-2">
              
            </div>
          </section>
        </div>
      </ScrollArea>

      {/* Columna Derecha: Detalle Dinámico */}
      <div className="space-y-6 bg-background rounded-xl border border-border p-6 shadow-sm">
        <header className="flex justify-between items-start">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold font-heading">{selectedRepo?.name}</h2>
              {selectedRepo?.shared ? <Users className="w-4 h-4 text-muted-foreground" /> : <Lock className="w-4 h-4 text-muted-foreground" />}
              
              <StatusBadge
              status={
                selectedRepo?.status === 'completed'
                  ? 'Listo'
                  : selectedRepo?.status === 'in_progress'
                  ? 'Procesando'
                  : 'Error'
              }
            />
            </div>
            <p className="text-sm text-muted-foreground">{selectedRepo?.description}</p>
            <div className="text-xs text-muted-foreground flex gap-2">
              <span>Propósito: {selectedRepo?.purpose}</span>
              <span>•</span>
              <span>Actualizado {selectedRepo?.updatedAt}</span>
            </div>
          </div>
          <div className="flex gap-2">
            <Dialog
              open={openAttachModal}
              onOpenChange={setOpenAttachModal}
            >
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <Settings className="w-4 h-4 mr-2" />
                  Agregar archivo
                </Button>
              </DialogTrigger>

              <DialogContent className="max-w-2xl bg-background border-border text-foreground">
                <DialogHeader>
                  <DialogTitle>Vincular archivos al repositorio</DialogTitle>
                </DialogHeader>

                {/* Tu contenedor con scroll */}
                <div className="max-h-[500px] overflow-auto p-1">
                  <FileTableDetailed
                    selectable
                    viewType="custom-grid" // <--- Activa la nueva vista del Mockup
                    selectedFiles={selectedFiles}
                    onToggleFile={(fileId, checked) => {
                      if (checked) {
                        setSelectedFiles((prev) => [...prev, fileId])
                      } else {
                        setSelectedFiles((prev) => prev.filter((id) => id !== fileId))
                      }
                    }}
                  />
                </div>

                <div className="flex justify-end gap-2 mt-4">
                  <Button variant="outline" onClick={() => setOpenAttachModal(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={handleAttachFiles}>
                    Vincular archivos
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
            <Dialog
              open={openCreateModal}
              onOpenChange={setOpenCreateModal}
            >
              <DialogTrigger asChild>
                <Button
                  size="sm"
                  
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Agregar Repositorio
                </Button>
              </DialogTrigger>

              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>
                    Crear repositorio
                  </DialogTitle>
                </DialogHeader>

                <form
                  className="space-y-4"
                  onSubmit={(e) => {
                    e.preventDefault()
                    handleCreateRepository()
                  }}
                >
                  <div className="space-y-2">
                    <label className="text-sm font-medium">
                      Nombre
                    </label>

                    <Input
                      placeholder="Ej. Bibliografía IA"
                      value={repoName}
                      onChange={(e) =>
                        setRepoName(e.target.value)
                      }
                    />
                  </div>

                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() =>
                        setOpenCreateModal(false)
                      }
                    >
                      Cancelar
                    </Button>

                    <Button type="submit">
                      Crear repositorio
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </header>

        <Separator />

        <div className="space-y-4">
          <h3 className="font-semibold text-sm">Archivos en este repositorio ( {selectedRepo?.file_counts?.total || 0})</h3>
            {selectedRepo?.id ? (
              <FileTableDetailed
                repositorioId={selectedRepo.id}
              />
            ) : (
              <div className="p-8 text-center text-muted-foreground">
                Cargando repositorio...
              </div>
            )}
        </div>
      </div>
    </div>
  )
}

// Actualizamos el SidebarItem para recibir el evento onClick
function RepoSidebarItem({ title, count, status, active, shared, onClick }: any) {
  return (
    <div 
      onClick={onClick}
      className={cn(
        "p-4 rounded-xl border transition-all cursor-pointer group",
        active
        ? "border-primary bg-primary/5"
        : "hover:border-border"
      )}
    >
      <div className="flex items-start gap-3">
        <div className={cn(
          "p-2 rounded-lg transition-colors",
          active
          ? "bg-primary/10"
          : "bg-muted group-hover:bg-background"
        )}>
          <Folder className={cn("w-5 h-5", active
            ? "text-primary"
            : "text-muted-foreground")} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1">
            <p className={cn("text-sm font-semibold truncate", active && "text-primary")}>{title}</p>
            {shared ? <Users className="w-3 h-3 text-muted-foreground" /> : <Lock className="w-3 h-3 text-muted-foreground" />}
          </div>
          <p className="text-xs text-muted-foreground mb-3">{count} archivos</p>
          
          <div className="flex justify-between items-center">
             <StatusBadge status={status='Listo'} />
             <span className="text-[10px] text-muted-foreground">hace 2 años</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const styles: any = {
      Listo:
        'bg-primary/10 text-primary border-primary/20',

      Error:
        'bg-destructive/10 text-destructive border-destructive/20',

      Procesando:
        'bg-muted text-muted-foreground border-border',
    }
  
  return (
    <Badge variant="outline" className={cn("px-2 py-0 h-5 text-[10px] font-medium", styles[status])}>
      {status === 'Listo' && <Check className="w-2.5 h-2.5 mr-1" />}
      {status}
    </Badge>
  )
}