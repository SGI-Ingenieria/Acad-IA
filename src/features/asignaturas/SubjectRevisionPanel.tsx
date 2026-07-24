import { CheckCircle2, Loader2, RotateCcw, Send, Undo2 } from 'lucide-react'
import { useState } from 'react'

import type { EstadoAsignaturaTransicion } from '@/data/api/workflow.api'
import type { LucideIcon } from 'lucide-react'

import { showAppConfirm } from '@/components/ui/app-alert-dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { useSubject } from '@/data'
import { usePlanCapabilities } from '@/data/auth/planCapabilities'
import { usePermissions } from '@/data/hooks/usePermissions'
import { usePlan } from '@/data/hooks/usePlans'
import { useTransitionSubjectEstado } from '@/data/hooks/useWorkflow'
import { notify } from '@/lib/toast'

const ESTADO_LABEL: Record<string, string> = {
  borrador: 'Borrador',
  revisada: 'En revisión',
  aprobada: 'Aprobada',
  generando: 'Generando',
  fallida: 'Fallida',
  archivada: 'Archivada',
}

type Accion = {
  nuevoEstado: EstadoAsignaturaTransicion
  titulo: string
  requiereComentario: boolean
  icon: LucideIcon
  variant?: 'destructive'
}

export function SubjectRevisionPanel({
  planId,
  asignaturaId,
}: {
  planId: string
  asignaturaId: string
}) {
  const { has } = usePermissions()
  const { data: subject } = useSubject(asignaturaId)
  const { data: plan } = usePlan(planId)
  const capabilities = usePlanCapabilities(plan)
  const transition = useTransitionSubjectEstado()

  const [accion, setAccion] = useState<Accion | null>(null)
  const [comentarioAccion, setComentarioAccion] = useState('')

  const estado = subject?.estado ?? 'borrador'
  const puedeEditar =
    capabilities.canEditAsignaturas && has('asignaturas.editar')
  const puedeAprobar =
    capabilities.canEditAsignaturas && has('asignaturas.aprobar')

  const acciones: Array<Accion> = []
  if (estado === 'borrador' && (puedeEditar || puedeAprobar)) {
    acciones.push({
      nuevoEstado: 'revisada',
      titulo: 'Enviar a revisión',
      requiereComentario: false,
      icon: Send,
    })
  }
  if (estado === 'revisada' && puedeAprobar) {
    acciones.push({
      nuevoEstado: 'aprobada',
      titulo: 'Aprobar',
      requiereComentario: false,
      icon: CheckCircle2,
    })
    acciones.push({
      nuevoEstado: 'borrador',
      titulo: 'Pedir cambios',
      requiereComentario: true,
      icon: Undo2,
    })
  }
  if (estado === 'aprobada' && puedeAprobar) {
    acciones.push({
      nuevoEstado: 'borrador',
      titulo: 'Reabrir',
      requiereComentario: true,
      icon: RotateCcw,
    })
  }

  const ejecutarTransicion = (accionAEjecutar: Accion) => {
    if (
      accionAEjecutar.requiereComentario &&
      comentarioAccion.trim().length === 0
    ) {
      notify.error('Agrega un comentario indicando los cambios solicitados.')
      return
    }
    transition.mutate(
      {
        asignaturaId,
        nuevoEstado: accionAEjecutar.nuevoEstado,
        comentario: comentarioAccion.trim() || undefined,
      },
      {
        onSuccess: () => {
          notify.success(`Asignatura: ${accionAEjecutar.titulo.toLowerCase()}.`)
          setAccion(null)
          setComentarioAccion('')
        },
      },
    )
  }

  const confirmarAccion = async () => {
    if (!accion) return

    if (accion.titulo === 'Enviar a revisión') {
      const confirmed = await showAppConfirm({
        title: 'Enviar a revisión',
        description:
          'Esta acción confirma que esta es tu versión final. No podrás editar la asignatura hasta que te la regresen para cambios.',
        confirmLabel: 'Enviar a revisión',
      })
      if (!confirmed) return
    }

    ejecutarTransicion(accion)
  }

  return (
    <div className="mx-auto max-w-md">
      <section className="space-y-4">
        <div className="border-b pb-4">
          <h2 className="text-lg font-semibold">Estado de la asignatura</h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Estado actual:{' '}
            <span className="text-foreground font-medium">
              {ESTADO_LABEL[estado] ?? estado}
            </span>
          </p>
        </div>

        {accion ? (
          <div className="space-y-2">
            <p className="text-sm font-medium">{accion.titulo}</p>
            <Textarea
              value={comentarioAccion}
              onChange={(e) => setComentarioAccion(e.target.value)}
              placeholder={
                accion.requiereComentario
                  ? 'Describe los cambios solicitados…'
                  : 'Comentario (opcional)…'
              }
              className="min-h-24"
            />
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setAccion(null)
                  setComentarioAccion('')
                }}
              >
                Cancelar
              </Button>
              <Button
                className="flex-1"
                onClick={confirmarAccion}
                disabled={
                  transition.isPending ||
                  (accion.requiereComentario &&
                    comentarioAccion.trim().length === 0)
                }
              >
                {transition.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Confirmar
              </Button>
            </div>
          </div>
        ) : acciones.length > 0 ? (
          <div className="space-y-2">
            {acciones.map((a) => (
              <Button
                key={a.titulo}
                variant={a.titulo === 'Aprobar' ? 'default' : 'outline'}
                className="w-full justify-start"
                onClick={() => {
                  setAccion(a)
                  setComentarioAccion('')
                }}
              >
                <a.icon className="mr-2 h-4 w-4" />
                {a.titulo}
              </Button>
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">
            No hay acciones disponibles para tu rol en este estado.
          </p>
        )}
      </section>
    </div>
  )
}
