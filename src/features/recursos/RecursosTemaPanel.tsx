import { Plus } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import { GenerarRecursosModal } from './GenerarRecursosModal'
import { PaquetesTemaSection } from './PaquetesTemaSection'
import { RecursoDrawer } from './RecursoDrawer'
import { RecursoItem } from './RecursoItem'

import type { RecursoEstado, RecursoTipo } from '@/data/api/recursos.api'
import type { Tables } from '@/types/supabase'

import { Button } from '@/components/ui/button'
import {
  useActualizarRecurso,
  useAsignaturaLearningJobs,
  useAsignaturaRecursos,
  useGenerarRecursos,
  useSincronizarLearningJob,
} from '@/data/hooks/useRecursos'

const JOBS_ACTIVOS = new Set(['queued', 'running', 'needs_review'])

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
  const [modalOpen, setModalOpen] = useState(false)
  const [recursoActivo, setRecursoActivo] =
    useState<Tables<'learning_objects'> | null>(null)

  const recursosDelTema = recursos.filter(
    (r) => r.unidad_id === unidadId && r.tema_id === temaId,
  )
  const jobsDelTema = jobs.filter(
    (job) => job.unidad_id === unidadId && job.tema_id === temaId,
  )
  const jobsActivos = jobsDelTema.filter((job) => JOBS_ACTIVOS.has(job.estado))
  const ultimoJobFallido =
    jobsDelTema.length > 0 && jobsDelTema[0].estado === 'failed'
  const hayGeneracionActiva = generar.isPending || jobsActivos.length > 0
  const jobsActivosKey = useMemo(
    () => jobsActivos.map((job) => job.id).join('|'),
    [jobsActivos],
  )

  useEffect(() => {
    if (!jobsActivosKey) return

    const sincronizar = () => {
      for (const jobId of jobsActivosKey.split('|').filter(Boolean)) {
        sincronizarJob(jobId)
      }
    }

    sincronizar()
    const interval = window.setInterval(sincronizar, 4_000)
    return () => window.clearInterval(interval)
  }, [jobsActivosKey, sincronizarJob])

  const handleGenerar = (tipos: Array<RecursoTipo>) => {
    setModalOpen(false)
    generar.mutate({ asignaturaId, unidadId, temaId, tipos })
  }

  const handleGuardar = (patch: {
    titulo: string
    descripcion: string
    estado: RecursoEstado
  }) => {
    if (!recursoActivo) return
    actualizar.mutate(
      { recursoId: recursoActivo.id, patch },
      { onSuccess: () => setRecursoActivo(null) },
    )
  }

  return (
    <div className="bg-card/50 mt-3 rounded-md border p-3">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-muted-foreground text-sm">
          {recursosDelTema.length === 0
            ? 'Aún no hay contenidos generados para este tema.'
            : `${recursosDelTema.length} contenidos en este tema.`}
        </p>
        {canManage && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => setModalOpen(true)}
            disabled={hayGeneracionActiva}
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            {hayGeneracionActiva ? 'Generando...' : 'Generar contenidos'}
          </Button>
        )}
      </div>

      {hayGeneracionActiva && (
        <p className="text-muted-foreground mb-2 text-sm">
          Generando contenidos. Puedes seguir trabajando o recargar la página.
        </p>
      )}

      {!hayGeneracionActiva && ultimoJobFallido && (
        <p className="text-destructive mb-2 text-sm">
          La última generación no se completó. Puedes volver a intentarlo.
        </p>
      )}

      {isLoading ? (
        <p className="text-muted-foreground text-sm">Cargando contenidos...</p>
      ) : recursosDelTema.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          Selecciona una o varias piezas para empezar.
        </p>
      ) : (
        <div className="space-y-2">
          {recursosDelTema.map((recurso) => (
            <RecursoItem
              key={recurso.id}
              recurso={recurso}
              onClick={() => setRecursoActivo(recurso)}
            />
          ))}
        </div>
      )}

      <PaquetesTemaSection
        asignaturaId={asignaturaId}
        unidadId={unidadId}
        temaId={temaId}
        canManage={canManage}
      />

      <GenerarRecursosModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        onGenerar={handleGenerar}
        isPending={generar.isPending}
        recursosExistentes={recursosDelTema}
      />

      <RecursoDrawer
        recurso={recursoActivo}
        open={recursoActivo !== null}
        onOpenChange={(open) => {
          if (!open) setRecursoActivo(null)
        }}
        onGuardar={handleGuardar}
        isPending={actualizar.isPending}
        readOnly={!canManage}
      />
    </div>
  )
}
