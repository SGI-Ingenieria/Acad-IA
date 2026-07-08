import { Edit3, Plus, Sparkles } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'

import { RecursoDrawer } from './RecursoDrawer'
import { RecursoItem, TIPO_ICON } from './RecursoItem'
import { RecursoPreviewModal } from './RecursoPreviewModal'

import type { RecursoTipo } from '@/data/api/recursos.api'
import type { Tables } from '@/types/supabase'

import { Button } from '@/components/ui/button'
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

const JOBS_ACTIVOS = new Set(['queued', 'running'])
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
    generar.mutate({ asignaturaId, unidadId, temaId, tipos: [tipo] })
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
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-muted-foreground text-sm">
          {recursosDelTema.length === 0
            ? 'Aún no hay contenidos generados para este tema.'
            : `${recursosDelTema.length} contenido${recursosDelTema.length === 1 ? '' : 's'} en este tema.`}
        </p>
      </div>

      {hayGeneracionActiva && (
        <p className="text-muted-foreground mb-3 flex items-center gap-2 text-sm">
          <Sparkles className="h-3.5 w-3.5 animate-pulse" />
          Generando contenidos. Puedes seguir trabajando o recargar la página.
        </p>
      )}

      <div className="grid gap-3">
        {RECURSOS_TIPOS_OPCIONES.map((opcion) => {
          const tipo = opcion.value
          const lista = recursosPorTipo.get(tipo) ?? []
          const conteo = lista.length
          const Icon = TIPO_ICON[tipo]

          return (
            <div
              key={tipo}
              className="bg-background rounded-lg border p-3 transition-colors"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <span className="bg-muted text-muted-foreground flex size-8 items-center justify-center rounded-md">
                    <Icon className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-sm font-medium">{opcion.label}</p>
                    <p className="text-muted-foreground text-xs">
                      {conteo === 0
                        ? 'Sin contenidos'
                        : formatConteo(tipo, conteo)}
                    </p>
                  </div>
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

              {lista.length > 0 && (
                <div className="mt-2.5 space-y-1.5">
                  {lista.map((recurso) => (
                    <div key={recurso.id} className="flex items-center gap-2">
                      <div className="flex-1">
                        <RecursoItem
                          recurso={recurso}
                          onClick={() => setRecursoPreview(recurso)}
                        />
                      </div>
                      {canManage && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="text-muted-foreground hover:text-foreground h-8 w-8 shrink-0"
                          onClick={(e) => {
                            e.stopPropagation()
                            setRecursoEdicion(recurso)
                          }}
                          title="Editar metadatos"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

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
