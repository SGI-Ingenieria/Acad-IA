import { Edit3, Plus, Sparkles } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'

import { RecursoDrawer } from './RecursoDrawer'
import { RecursoItem, TIPO_ICON } from './RecursoItem'
import { RecursoPreviewModal } from './RecursoPreviewModal'

import type { RecursoTipo } from '@/data/api/recursos.api'
import type { Tables } from '@/types/supabase'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  RECURSOS_TIPOS_OPCIONES,
  RECURSO_TIPO_SINGULAR_LABEL,
} from '@/data/api/recursos.api'
import {
  useActualizarRecurso,
  useAsignaturaLearningJobs,
  useAsignaturaRecursos,
  useGenerarRecursos,
  useSincronizarLearningJob,
} from '@/data/hooks/useRecursos'

const JOBS_ACTIVOS = new Set(['queued', 'running', 'needs_review'])
const JOBS_FINALIZANDO = new Set(['needs_review'])
const JOB_POLLING_INTERVAL_MS = 10_000

function formatConteo(tipo: RecursoTipo, count: number): string {
  const label = RECURSO_TIPO_SINGULAR_LABEL[tipo].toLowerCase()
  if (tipo === 'recursos_externos') {
    return count === 1 ? `1 ${label}` : `${count} ${label}`
  }
  return count === 1 ? `1 ${label}` : `${count} ${label}`
}

export function RecursosTemaPanel({
  asignaturaId,
  unidadId,
  temaId,
  canManage,
}: {
  asignaturaId: string
  unidadId: string
  temaId: string
  canManage: boolean
}) {
  const { data: recursos = [], isLoading } = useAsignaturaRecursos(asignaturaId)
  const { data: jobs = [] } = useAsignaturaLearningJobs(asignaturaId)
  const generar = useGenerarRecursos()
  const { mutate: sincronizarJob } = useSincronizarLearningJob(asignaturaId)
  const actualizar = useActualizarRecurso(asignaturaId)

  const [recursoPreview, setRecursoPreview] =
    useState<Tables<'learning_objects'> | null>(null)
  const [recursoEdicion, setRecursoEdicion] =
    useState<Tables<'learning_objects'> | null>(null)
  const [contenidosOpen, setContenidosOpen] = useState(false)
  const [tipoActivo, setTipoActivo] = useState<RecursoTipo>(
    'outline_presentacion',
  )
  const [instruccionesPorTipo, setInstruccionesPorTipo] = useState<
    Partial<Record<RecursoTipo, string>>
  >({})

  const recursosDelTema = recursos.filter((r) => {
    if (r.unidad_id !== unidadId || r.tema_id !== temaId) return false
    const payload = r.contenido_json as Record<string, unknown> | null
    const datos = payload?.[r.tipo]
    return datos != null && typeof datos === 'object'
  })
  const jobsDelTema = useMemo(
    () =>
      jobs.filter(
        (job) => job.unidad_id === unidadId && job.tema_id === temaId,
      ),
    [jobs, temaId, unidadId],
  )
  const jobsActivos = useMemo(
    () => jobsDelTema.filter((job) => JOBS_ACTIVOS.has(job.estado)),
    [jobsDelTema],
  )
  const jobsFinalizando = useMemo(
    () => jobsDelTema.filter((job) => JOBS_FINALIZANDO.has(job.estado)),
    [jobsDelTema],
  )
  const activeJobIdsKey = useMemo(
    () =>
      jobsActivos
        .map((job) => job.id)
        .sort()
        .join('|'),
    [jobsActivos],
  )
  const hayGeneracionActiva =
    generar.isPending || jobsActivos.length > 0 || jobsFinalizando.length > 0
  const sincronizarJobRef = useRef(sincronizarJob)
  const syncingJobIdsRef = useRef(new Set<string>())

  useEffect(() => {
    sincronizarJobRef.current = sincronizarJob
  }, [sincronizarJob])

  const recursosPorTipo = useMemo(() => {
    const map = new Map<RecursoTipo, Array<Tables<'learning_objects'>>>()
    for (const tipo of RECURSOS_TIPOS_OPCIONES.map((o) => o.value)) {
      map.set(tipo, [])
    }
    for (const recurso of recursosDelTema) {
      const lista = map.get(recurso.tipo) ?? []
      lista.push(recurso)
      map.set(recurso.tipo, lista)
    }
    return map
  }, [recursosDelTema])

  useEffect(() => {
    if (!activeJobIdsKey) return

    const activeJobIds = activeJobIdsKey.split('|').filter(Boolean)
    const sincronizar = () => {
      for (const jobId of activeJobIds) {
        if (syncingJobIdsRef.current.has(jobId)) continue

        syncingJobIdsRef.current.add(jobId)
        sincronizarJobRef.current(jobId, {
          onSettled: () => {
            syncingJobIdsRef.current.delete(jobId)
          },
        })
      }
    }

    sincronizar()
    const interval = window.setInterval(sincronizar, JOB_POLLING_INTERVAL_MS)
    return () => window.clearInterval(interval)
  }, [activeJobIdsKey])

  const handleGenerar = (tipo: RecursoTipo) => {
    const instruccionesAdicionalesIA = instruccionesPorTipo[tipo]?.trim()
    generar.mutate(
      {
        asignaturaId,
        unidadId,
        temaId,
        tipos: [tipo],
        instruccionesAdicionalesIA,
      },
      {
        onSuccess: () =>
          setInstruccionesPorTipo((prev) => ({ ...prev, [tipo]: '' })),
      },
    )
  }

  const handleGuardar = (patch: { titulo: string; descripcion: string }) => {
    if (!recursoEdicion) return
    actualizar.mutate(
      { recursoId: recursoEdicion.id, patch },
      { onSuccess: () => setRecursoEdicion(null) },
    )
  }

  if (isLoading) {
    return (
      <p className="text-muted-foreground text-sm">
        Cargando contenidos del tema…
      </p>
    )
  }

  return (
    <div className="bg-card/50 mt-3 rounded-md border p-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-muted-foreground text-sm">
          {recursosDelTema.length === 0
            ? 'Aún no hay contenidos generados para este tema.'
            : `${recursosDelTema.length} contenido${recursosDelTema.length === 1 ? '' : 's'} en este tema.`}
        </p>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => setContenidosOpen(true)}
        >
          <Sparkles className="mr-1.5 h-3.5 w-3.5" />
          Contenidos
        </Button>
      </div>

      {hayGeneracionActiva && (
        <p className="text-muted-foreground mt-3 flex items-center gap-2 text-sm">
          <Sparkles className="h-3.5 w-3.5 animate-pulse" />
          Generando contenidos. Puedes seguir trabajando o recargar la página.
        </p>
      )}

      <Dialog open={contenidosOpen} onOpenChange={setContenidosOpen}>
        <DialogContent className="flex max-h-[88vh] flex-col sm:max-w-3xl">
          <DialogHeader className="shrink-0">
            <DialogTitle>Contenidos</DialogTitle>
            <DialogDescription>
              {recursosDelTema.length === 0
                ? 'Sin contenidos en este tema.'
                : `${recursosDelTema.length} contenido${recursosDelTema.length === 1 ? '' : 's'} disponible${recursosDelTema.length === 1 ? '' : 's'}.`}
            </DialogDescription>
          </DialogHeader>

          {hayGeneracionActiva && (
            <p className="text-muted-foreground flex shrink-0 items-center gap-2 text-sm">
              <Sparkles className="h-3.5 w-3.5 animate-pulse" />
              Generando contenidos.
            </p>
          )}

          <Tabs
            value={tipoActivo}
            onValueChange={(value) => setTipoActivo(value as RecursoTipo)}
            className="min-h-0 flex-1"
          >
            <TabsList className="grid h-auto w-full grid-cols-2 gap-1 sm:grid-cols-4">
              {RECURSOS_TIPOS_OPCIONES.map((opcion) => {
                const Icon = TIPO_ICON[opcion.value]
                const conteo = recursosPorTipo.get(opcion.value)?.length ?? 0

                return (
                  <TabsTrigger
                    key={opcion.value}
                    value={opcion.value}
                    className="h-10 justify-start px-2"
                  >
                    <Icon className="h-3.5 w-3.5" />
                    <span className="truncate">{opcion.label}</span>
                    <span className="text-muted-foreground ml-auto text-xs">
                      {conteo}
                    </span>
                  </TabsTrigger>
                )
              })}
            </TabsList>

            {RECURSOS_TIPOS_OPCIONES.map((opcion) => {
              const tipo = opcion.value
              const lista = recursosPorTipo.get(tipo) ?? []
              const conteo = lista.length

              return (
                <TabsContent
                  key={tipo}
                  value={tipo}
                  className="min-h-0 overflow-y-auto pr-1"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium">{opcion.label}</p>
                        <p className="text-muted-foreground text-xs">
                          {conteo === 0
                            ? 'Sin contenidos'
                            : formatConteo(tipo, conteo)}
                        </p>
                      </div>
                      {canManage && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleGenerar(tipo)}
                          disabled={hayGeneracionActiva}
                        >
                          <Plus className="mr-1.5 h-3.5 w-3.5" />
                          {conteo === 0 ? 'Generar' : 'Generar otro'}
                        </Button>
                      )}
                    </div>

                    {lista.length > 0 ? (
                      <div className="space-y-1.5">
                        {lista.map((recurso) => (
                          <div
                            key={recurso.id}
                            className="flex items-center gap-2"
                          >
                            <div className="min-w-0 flex-1">
                              <RecursoItem
                                recurso={recurso}
                                onClick={() => setRecursoPreview(recurso)}
                              />
                            </div>
                            {canManage && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="text-muted-foreground hover:text-foreground h-8 w-8 shrink-0"
                                    aria-label="Editar metadatos"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      setRecursoEdicion(recurso)
                                    }}
                                  >
                                    <Edit3 className="h-3.5 w-3.5" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  Editar metadatos
                                </TooltipContent>
                              </Tooltip>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="rounded-md border border-dashed p-4 text-sm">
                        No hay {opcion.label.toLowerCase()} todavía.
                      </div>
                    )}

                    {canManage && (
                      <Textarea
                        value={instruccionesPorTipo[tipo] ?? ''}
                        onChange={(event) =>
                          setInstruccionesPorTipo((prev) => ({
                            ...prev,
                            [tipo]: event.target.value,
                          }))
                        }
                        placeholder="Opcional: afina el enfoque, nivel de dificultad o formato."
                        className="min-h-20 resize-none"
                        disabled={hayGeneracionActiva}
                      />
                    )}
                  </div>
                </TabsContent>
              )
            })}
          </Tabs>
        </DialogContent>
      </Dialog>

      <RecursoPreviewModal
        recurso={recursoPreview}
        asignaturaId={asignaturaId}
        open={recursoPreview !== null}
        onOpenChange={(open) => {
          if (!open) setRecursoPreview(null)
        }}
      />

      <RecursoDrawer
        recurso={recursoEdicion}
        open={recursoEdicion !== null}
        onOpenChange={(open) => {
          if (!open) setRecursoEdicion(null)
        }}
        onGuardar={handleGuardar}
        isPending={actualizar.isPending}
        readOnly={!canManage}
      />
    </div>
  )
}
