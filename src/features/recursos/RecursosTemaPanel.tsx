import { Plus } from 'lucide-react'
import { useState } from 'react'

import { GenerarRecursosModal } from './GenerarRecursosModal'
import { PaquetesTemaSection } from './PaquetesTemaSection'
import { RecursoDrawer } from './RecursoDrawer'
import { RecursoItem } from './RecursoItem'
import { ScoreBadge } from './ScoreBadge'

import type { RecursoEstado, RecursoTipo } from '@/data/api/recursos.api'
import type { Tables } from '@/types/supabase'

import { Button } from '@/components/ui/button'
import {
  useActualizarRecurso,
  useAsignaturaLearningScores,
  useAsignaturaRecursos,
  useGenerarRecursos,
} from '@/data/hooks/useRecursos'

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
  const { data: scores = [] } = useAsignaturaLearningScores(asignaturaId)
  const generar = useGenerarRecursos()
  const actualizar = useActualizarRecurso(asignaturaId)
  const [modalOpen, setModalOpen] = useState(false)
  const [recursoActivo, setRecursoActivo] =
    useState<Tables<'learning_objects'> | null>(null)

  const recursosDelTema = recursos.filter(
    (r) => r.unidad_id === unidadId && r.tema_id === temaId,
  )

  const score =
    scores.find((s) => s.unidad_id === unidadId && s.tema_id === temaId)
      ?.score_total ?? null

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
        <ScoreBadge score={score} label="Score de preparación" />
        {canManage && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => setModalOpen(true)}
            disabled={generar.isPending}
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            {generar.isPending ? 'Generando...' : 'Generar recursos'}
          </Button>
        )}
      </div>

      {generar.isPending && (
        <p className="text-muted-foreground mb-2 text-sm">
          Generando recursos con IA...
        </p>
      )}

      {isLoading ? (
        <p className="text-muted-foreground text-sm">Cargando recursos...</p>
      ) : recursosDelTema.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          No hay recursos generados aún.
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
