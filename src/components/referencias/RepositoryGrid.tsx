import { Check, Folder, Plus, Settings, Users, Lock } from "lucide-react"
import { useEffect, useState } from "react"

import { Badge } from "../ui/badge"
import { Button } from "../ui/button"
import { Checkbox } from "../ui/checkbox"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "../ui/dialog"
import { ScrollArea } from "../ui/scroll-area"
import { Separator } from "../ui/separator"

import { FileTableDetailed } from "./FileTableDetailed"

import { useAttachFileToVectorStore, useCreateRepositorio, useFilesList, useVectorStores } from "@/data/hooks/useFiles"
import { cn } from "@/lib/utils"


// 1. Datos centralizados para que el visualizador sea dinámico
const MOCK_REPOS = [
  { 
    id: 1, 
    title: 'Mis referencias - Sistemas', 
    description: 'Documentos personales para el programa de Sistemas',
    purpose: 'Generación de materias',
    count: 15, 
    status: 'Listo', 
    shared: false,
    updatedAt: 'hace alrededor de 2 años'
  },
  { 
    id: 2, 
    title: 'Bibliografía Especializada', 
    description: 'Textos y artículos académicos de referencia general',
    purpose: 'Investigación',
    count: 23, 
    status: 'Error', 
    shared: false,
    updatedAt: 'hace 1 mes'
  },
  { 
    id: 3, 
    title: 'Marco Curricular Nacional', 
    description: 'Documentos oficiales del marco curricular nacional actualizado',
    purpose: 'Normativa',
    count: 12, 
    status: 'Listo', 
    shared: true,
    updatedAt: 'hace 1 año'
  }
];

export function RepositoryGrid() {
  // 2. Estado para el repositorio seleccionado (por defecto el primero)
  const { mutate: createRepositorio } =useCreateRepositorio()
  const { data: repositorios, isLoading } = useVectorStores()
  const [selectedRepo, setSelectedRepo] = useState<any>(null)

  const [openAttachModal, setOpenAttachModal] =
  useState(false)

const [selectedFiles, setSelectedFiles] =
  useState<string[]>([])

const { data: filesData } = useFilesList()

const { mutate: attachFile } =
  useAttachFileToVectorStore()

  useEffect(() => {
    console.log(filesData);
    
  if (repositorios?.data?.length && !selectedRepo) {
    setSelectedRepo(repositorios.data[0])
  }
}, [repositorios, selectedRepo])

const handleAttachFiles = async () => {
  if (!selectedRepo?.id) return

  for (const archivoId of selectedFiles) {
    attachFile({
      vectorStoreId: selectedRepo.id,
      archivoId,
    })
  }

  setOpenAttachModal(false)
  setSelectedFiles([])
}


  return (
    <div className="grid grid-cols-[350px_1fr] gap-6 h-[calc(100vh-200px)]">
      {/* Columna Izquierda: Lista de Repositorios */}
      <ScrollArea className="pr-4 border-r">
        <div className="space-y-6">
          <section>
            <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-3 px-2">Mis Repositorios</h4>
            <div className="space-y-2">
              {repositorios?.data?.map((repo: any) => (
                <RepoSidebarItem
                  key={repo.id}
                  title={repo.name}
                  count={repo.file_counts?.total || 0}
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
              {MOCK_REPOS.filter(r => r.shared).map(repo => (
                <RepoSidebarItem 
                  key={repo.id}
                  title={repo.title}
                  count={repo.count}
                  status={repo.status}
                  shared
                  active={selectedRepo?.id === repo.id}
                  onClick={() => setSelectedRepo(repo)}
                />
              ))}
            </div>
          </section>
        </div>
      </ScrollArea>

      {/* Columna Derecha: Detalle Dinámico */}
      <div className="space-y-6 bg-white rounded-xl border p-6 shadow-sm">
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

              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>
                    Vincular archivos al repositorio
                  </DialogTitle>
                </DialogHeader>

                <div className="space-y-4 max-h-[400px] overflow-auto">
                  {filesData?.map((file: any) => {
                    const checked =
                      selectedFiles.includes(file.id)

                    return (
                      <div
                        key={file.id}
                        className="flex items-center justify-between border rounded-lg p-3"
                      >
                        <div>
                          <p className="font-medium text-sm">
                            {file.nombre || file.id}
                          </p>

                          <p className="text-xs text-muted-foreground">
                            {file.path}
                          </p>
                        </div>

                        <Checkbox
                          checked={checked}
                          onCheckedChange={(value) => {
                            if (value) {
                              setSelectedFiles((prev) => [
                                ...prev,
                                file.id,
                              ])
                            } else {
                              setSelectedFiles((prev) =>
                                prev.filter(
                                  (id) => id !== file.id,
                                ),
                              )
                            }
                          }}
                        />
                      </div>
                    )
                  })}
                </div>

                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() =>
                      setOpenAttachModal(false)
                    }
                  >
                    Cancelar
                  </Button>

                  <Button onClick={handleAttachFiles}>
                    Vincular archivos
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
            <Button
            size="sm"
            className="bg-blue-600 hover:bg-blue-700"
            onClick={() => {
              const nombre = window.prompt('Nombre del repositorio')

              if (!nombre) return

              createRepositorio(
                {
                  action: 'create_vector_store',
                  nombre,
                },
                {
                  onSuccess: (data) => {
                    console.log('Repositorio creado', data)
                  },
                  onError: (error) => {
                    console.error(error)
                  },
                },
              )
            }}
          >
            <Plus className="w-4 h-4 mr-2" />
            Agregar Repositorio
          </Button>
          </div>
        </header>

        <Separator />

        <div className="space-y-4">
          <h3 className="font-semibold text-sm">Archivos en este repositorio ( {selectedRepo?.file_counts?.total || 0}))</h3>
          {/* Aquí podrías pasar el ID del repo a la tabla para filtrar archivos reales */}
          <FileTableDetailed
            vectorStoreId={selectedRepo?.id}
          />
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
        active ? "border-blue-500 bg-blue-50/30" : "hover:border-slate-300"
      )}
    >
      <div className="flex items-start gap-3">
        <div className={cn(
          "p-2 rounded-lg transition-colors",
          active ? "bg-blue-100" : "bg-slate-100 group-hover:bg-white"
        )}>
          <Folder className={cn("w-5 h-5", active ? "text-blue-600" : "text-slate-600")} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1">
            <p className={cn("text-sm font-semibold truncate", active && "text-blue-900")}>{title}</p>
            {shared ? <Users className="w-3 h-3 text-muted-foreground" /> : <Lock className="w-3 h-3 text-muted-foreground" />}
          </div>
          <p className="text-xs text-muted-foreground mb-3">{count} archivos</p>
          
          <div className="flex justify-between items-center">
             <StatusBadge status={status} />
             <span className="text-[10px] text-muted-foreground">hace 2 años</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const styles: any = {
    Listo: "bg-green-50 text-green-700 border-green-200",
    Error: "bg-red-50 text-red-700 border-red-200",
    Procesando: "bg-orange-50 text-orange-700 border-orange-200"
  }
  return (
    <Badge variant="outline" className={cn("px-2 py-0 h-5 text-[10px] font-medium", styles[status])}>
      {status === 'Listo' && <Check className="w-2.5 h-2.5 mr-1" />}
      {status}
    </Badge>
  )
}