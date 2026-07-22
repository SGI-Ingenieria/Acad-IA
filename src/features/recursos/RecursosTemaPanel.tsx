import { Edit3, Info, Layers, Loader2, Plus, Sparkles, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'

import { RecursoDrawer } from './RecursoDrawer'
import { RecursoItem, TIPO_ICON } from './RecursoItem'
import { RecursoPreviewModal } from './RecursoPreviewModal'

import type { ReasoningEffortOption } from '@/components/ia/ReasoningEffortSelect'
import type { H5PTipo, RecursoTipo } from '@/data/api/recursos.api'
import type { Tables } from '@/types/supabase'

import { AIRequestComposer } from '@/components/ia/AIRequestComposer'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  H5P_TIPO_LABEL,
  H5P_TIPOS,
  RECURSOS_TIPOS_OPCIONES,
  RECURSO_TIPO_SINGULAR_LABEL,
} from '@/data/api/recursos.api'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import {
  useActualizarRecurso,
  useAsignaturaLearningJobs,
  useAsignaturaRecursos,
  useEliminarRecurso,
  useGenerarRecursos,
  useSincronizarLearningJob,
} from '@/data/hooks/useRecursos'
import { showAppConfirm } from '@/components/ui/app-alert-dialog'
import { cn } from '@/lib/utils'

const JOBS_ACTIVOS = new Set(['queued', 'running', 'needs_review'])
const JOBS_FINALIZANDO = new Set(['needs_review'])
const JOB_POLLING_INTERVAL_MS = 10_000

type ProfundidadFuentes = 'basica' | 'estandar'

const MODELO_POR_PROFUNDIDAD_FUENTES: Record<ProfundidadFuentes, string> = {
  basica: 'o4-mini-deep-research',
  estandar: 'o3-deep-research',
}

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
  const eliminar = useEliminarRecurso(asignaturaId)

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
  const [profundidadFuentes, setProfundidadFuentes] =
    useState<ProfundidadFuentes>('basica')
  const [archivosPorTipo, setArchivosPorTipo] = useState<
    Partial<Record<RecursoTipo, Array<string>>>
  >({})
  const [coleccionesPorTipo, setColeccionesPorTipo] = useState<
    Partial<Record<RecursoTipo, Array<string>>>
  >({})
  const [razonamientoPorTipo, setRazonamientoPorTipo] = useState<
    Partial<Record<RecursoTipo, ReasoningEffortOption>>
  >({})
  const [busquedaWebPorTipo, setBusquedaWebPorTipo] = useState<
    Partial<Record<RecursoTipo, boolean>>
  >({})
  const [cargasSinResolverPorTipo, setCargasSinResolverPorTipo] = useState<
    Partial<Record<RecursoTipo, number>>
  >({})
  const [h5pTypesPorTipo, setH5pTypesPorTipo] = useState<
    Partial<Record<RecursoTipo, Array<H5PTipo>>>
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
    if ((cargasSinResolverPorTipo[tipo] ?? 0) > 0) return
    const instruccionesAdicionalesIA = instruccionesPorTipo[tipo]?.trim()
    const model =
      tipo === 'recursos_externos'
        ? MODELO_POR_PROFUNDIDAD_FUENTES[profundidadFuentes]
        : undefined
    generar.mutate(
      {
        asignaturaId,
        unidadId,
        temaId,
        tipos: [tipo],
        instruccionesAdicionalesIA,
        model,
        references: {
          fileIds: archivosPorTipo[tipo] ?? [],
          collectionIds: coleccionesPorTipo[tipo] ?? [],
        },
        reasoningEffort: razonamientoPorTipo[tipo] ?? 'auto',
        webSearchEnabled: busquedaWebPorTipo[tipo] ?? false,
        h5pTypes:
          tipo === 'ejercicios' && (h5pTypesPorTipo['ejercicios']?.length ?? 0) > 0
            ? h5pTypesPorTipo['ejercicios']
            : undefined,
      },
      {
        onSuccess: () => {
          setInstruccionesPorTipo((prev) => ({ ...prev, [tipo]: '' }))
          setArchivosPorTipo((prev) => ({ ...prev, [tipo]: [] }))
          setColeccionesPorTipo((prev) => ({ ...prev, [tipo]: [] }))
        },
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

  const totalContenidos = recursosDelTema.length
  const contenidosTooltip =
    totalContenidos > 0
      ? `${totalContenidos} contenido${totalContenidos === 1 ? '' : 's'}${hayGeneracionActiva ? ' · generando…' : ''}`
      : hayGeneracionActiva
        ? 'Generando contenidos…'
        : canManage
          ? 'Generar contenidos'
          : 'Sin contenidos'

  if (isLoading) {
    return (
      <Loader2
        className="text-muted-foreground/50 h-3.5 w-3.5 shrink-0 animate-spin"
        aria-label="Cargando contenidos del tema"
      />
    )
  }

  // Sin contenidos y sin permiso para generar: no hay nada que mostrar ni hacer.
  if (totalContenidos === 0 && !canManage && !hayGeneracionActiva) return null

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => setContenidosOpen(true)}
            aria-label={contenidosTooltip}
            className={cn(
              'h-7 shrink-0 gap-1 px-2 text-xs',
              totalContenidos > 0
                ? 'text-foreground'
                : 'text-muted-foreground/70 hover:text-foreground',
            )}
          >
            <Layers
              className={cn(
                'h-3.5 w-3.5',
                hayGeneracionActiva && 'animate-pulse',
              )}
            />
            {totalContenidos > 0 && (
              <span className="tabular-nums">{totalContenidos}</span>
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>{contenidosTooltip}</TooltipContent>
      </Tooltip>

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

            {/* Radix sólo monta el TabsContent activo si no se usa forceMount;
                por ello existe un único listener global de arrastre/pegado. */}
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
                          disabled={
                            hayGeneracionActiva ||
                            (cargasSinResolverPorTipo[tipo] ?? 0) > 0
                          }
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
                                recurso={{
                                  ...recurso,
                                  contenido_json: recurso.contenido_json,
                                }}
                                onClick={() => setRecursoPreview(recurso)}
                              />
                            </div>
                            {canManage && (
                              <div className="flex items-center">
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
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="text-muted-foreground hover:text-destructive h-8 w-8 shrink-0"
                                      aria-label="Eliminar recurso"
                                      disabled={eliminar.isPending}
                                      onClick={async (e) => {
                                        e.stopPropagation()
                                        const confirmed = await showAppConfirm({
                                          title: 'Eliminar recurso',
                                          description: `Se eliminará "${recurso.titulo}". Esta acción no puede deshacerse.`,
                                          variant: 'destructive',
                                        })
                                        if (confirmed) {
                                          eliminar.mutate(recurso.id)
                                        }
                                      }}
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Eliminar</TooltipContent>
                                </Tooltip>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="rounded-md border border-dashed p-4 text-sm">
                        No hay {opcion.label.toLowerCase()} todavía.
                      </div>
                    )}

                    {canManage && tipo === 'ejercicios' && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-1.5">
                          <p className="text-muted-foreground text-xs font-medium">
                            Tipos de ejercicio
                          </p>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="text-muted-foreground h-3 w-3" />
                            </TooltipTrigger>
                            <TooltipContent>
                              Selecciona los tipos que quieres generar. Si no
                              seleccionas ninguno, la IA elegirá los más
                              apropiados para el tema.
                            </TooltipContent>
                          </Tooltip>
                        </div>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                          {H5P_TIPOS.map((h5pTipo) => {
                            const selected =
                              h5pTypesPorTipo['ejercicios']?.includes(h5pTipo) ??
                              false
                            return (
                              <div
                                key={h5pTipo}
                                className="flex items-center gap-2"
                              >
                                <Checkbox
                                  id={`h5p-${h5pTipo}`}
                                  checked={selected}
                                  disabled={hayGeneracionActiva}
                                  onCheckedChange={(checked) => {
                                    setH5pTypesPorTipo((prev) => {
                                      const current =
                                        prev['ejercicios'] ?? []
                                      return {
                                        ...prev,
                                        ejercicios: checked
                                          ? [...current, h5pTipo]
                                          : current.filter(
                                              (t) => t !== h5pTipo,
                                            ),
                                      }
                                    })
                                  }}
                                />
                                <Label
                                  htmlFor={`h5p-${h5pTipo}`}
                                  className="text-xs font-normal"
                                >
                                  {H5P_TIPO_LABEL[h5pTipo]}
                                </Label>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}

                    {canManage && tipo === 'recursos_externos' && (
                      <div className="flex items-center gap-2">
                        <Select
                          value={profundidadFuentes}
                          onValueChange={(value) =>
                            setProfundidadFuentes(value as ProfundidadFuentes)
                          }
                          disabled={hayGeneracionActiva}
                        >
                          <SelectTrigger size="sm" className="w-40">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="basica">Básica</SelectItem>
                            <SelectItem value="estandar">Profunda</SelectItem>
                          </SelectContent>
                        </Select>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="text-muted-foreground h-3.5 w-3.5" />
                          </TooltipTrigger>
                          <TooltipContent>
                            Profunda investiga más detalladamente y con mejor
                            concentración (más citas y mayor precisión) pero
                            tarda varios minutos más y tiene mayor costo.
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    )}

                    {canManage && (
                      <AIRequestComposer
                        value={instruccionesPorTipo[tipo] ?? ''}
                        onChange={(value) =>
                          setInstruccionesPorTipo((prev) => ({
                            ...prev,
                            [tipo]: value,
                          }))
                        }
                        reasoningEffort={razonamientoPorTipo[tipo] ?? 'auto'}
                        onReasoningEffortChange={(value) =>
                          setRazonamientoPorTipo((prev) => ({
                            ...prev,
                            [tipo]: value,
                          }))
                        }
                        selectedFileIds={archivosPorTipo[tipo] ?? []}
                        onSelectedFileIdsChange={(fileIds) =>
                          setArchivosPorTipo((prev) => ({
                            ...prev,
                            [tipo]: fileIds,
                          }))
                        }
                        selectedCollectionIds={coleccionesPorTipo[tipo] ?? []}
                        onSelectedCollectionIdsChange={(collectionIds) =>
                          setColeccionesPorTipo((prev) => ({
                            ...prev,
                            [tipo]: collectionIds,
                          }))
                        }
                        webSearchEnabled={busquedaWebPorTipo[tipo] ?? false}
                        onWebSearchEnabledChange={(enabled) =>
                          setBusquedaWebPorTipo((prev) => ({
                            ...prev,
                            [tipo]: enabled,
                          }))
                        }
                        onUnresolvedUploadsChange={(count) =>
                          setCargasSinResolverPorTipo((prev) => ({
                            ...prev,
                            [tipo]: count,
                          }))
                        }
                        placeholder="Opcional: afina el enfoque, nivel de dificultad o formato."
                        disabled={hayGeneracionActiva}
                        compact
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
    </>
  )
}
