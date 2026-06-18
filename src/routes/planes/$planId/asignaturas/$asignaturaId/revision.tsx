import { createFileRoute } from '@tanstack/react-router'
import { format, formatDistanceToNow, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  CheckCircle2,
  Loader2,
  MessageSquare,
  RotateCcw,
  Send,
  Undo2,
} from 'lucide-react'
import { useState } from 'react'

import type { EstadoAsignaturaTransicion } from '@/data/api/workflow.api'
import type { ComentarioAsignatura } from '@/data/types/domain'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { useSubject } from '@/data'
import { usePermissions } from '@/data/hooks/usePermissions'
import {
  useComentariosAsignatura,
  useCrearComentarioAsignatura,
  useTransitionSubjectEstado,
} from '@/data/hooks/useWorkflow'
import { notify } from '@/lib/toast'


export const Route = createFileRoute(
  '/planes/$planId/asignaturas/$asignaturaId/revision',
)({
  component: RouteComponent,
})

const ESTADO_LABEL: Record<string, string> = {
  borrador: 'Borrador',
  revisada: 'En revisión',
  aprobada: 'Aprobada',
  generando: 'Generando',
  fallida: 'Fallida',
  archivada: 'Archivada',
}

const categoriaLabel: Record<string, string> = {
  INTERNO: 'Interno',
  EXPERTO: 'Experto',
  SEDE: 'Sede',
}

type Accion = {
  nuevoEstado: EstadoAsignaturaTransicion
  titulo: string
  requiereComentario: boolean
}

function RouteComponent() {
  const { asignaturaId } = Route.useParams()
  const { has } = usePermissions()
  const { data: subject } = useSubject(asignaturaId)
  const { data: comentarios } = useComentariosAsignatura(asignaturaId)
  const transition = useTransitionSubjectEstado()
  const crearComentario = useCrearComentarioAsignatura()

  const [accion, setAccion] = useState<Accion | null>(null)
  const [comentarioAccion, setComentarioAccion] = useState('')
  const [comentarioNuevo, setComentarioNuevo] = useState('')

  const estado = subject?.estado ?? 'borrador'
  const puedeEditar = has('asignaturas.editar')
  const puedeAprobar = has('asignaturas.aprobar')
  const puedeComentar =
    has('comentarios.crear') || has('comentarios.externos.crear')

  // Acciones contextuales por estado (analogía issue/PR).
  const acciones: Array<
    Accion & { icon: typeof Send; variant?: 'destructive' }
  > = []
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

  const confirmarAccion = () => {
    if (!accion) return
    if (accion.requiereComentario && comentarioAccion.trim().length === 0) {
      notify.error('Agrega un comentario indicando los cambios solicitados.')
      return
    }
    transition.mutate(
      {
        asignaturaId,
        nuevoEstado: accion.nuevoEstado,
        comentario: comentarioAccion.trim() || undefined,
      },
      {
        onSuccess: () => {
          notify.success(`Asignatura: ${accion.titulo.toLowerCase()}.`)
          setAccion(null)
          setComentarioAccion('')
        },
      },
    )
  }

  const agregarComentario = () => {
    if (comentarioNuevo.trim().length === 0) return
    crearComentario.mutate(
      { asignaturaId, cuerpo: comentarioNuevo },
      { onSuccess: () => setComentarioNuevo('') },
    )
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      {/* Hilo de comentarios (estilo PR) */}
      <div className="lg:col-span-2">
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <MessageSquare className="h-4 w-4" /> Revisión de la asignatura
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <ComentariosAsignaturaLista comentarios={comentarios ?? []} />
            {puedeComentar && (
              <div className="space-y-2 border-t pt-4">
                <Textarea
                  value={comentarioNuevo}
                  onChange={(e) => setComentarioNuevo(e.target.value)}
                  placeholder="Escribe un comentario para el profesor o el revisor…"
                  className="min-h-20"
                />
                <div className="flex justify-end">
                  <Button
                    size="sm"
                    onClick={agregarComentario}
                    disabled={
                      crearComentario.isPending ||
                      comentarioNuevo.trim().length === 0
                    }
                  >
                    {crearComentario.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="mr-2 h-4 w-4" />
                    )}
                    Comentar
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Estado + acciones */}
      <div className="lg:col-span-1">
        <Card className="sticky top-6">
          <CardHeader className="py-3">
            <CardTitle className="text-lg">Estado de la asignatura</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-muted/20 rounded-lg border p-3 text-center">
              <p className="text-muted-foreground text-xs">Estado actual</p>
              <Badge variant="secondary" className="mt-1">
                {ESTADO_LABEL[estado] ?? estado}
              </Badge>
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
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function ComentariosAsignaturaLista({
  comentarios,
}: {
  comentarios: Array<ComentarioAsignatura>
}) {
  if (comentarios.length === 0) {
    return (
      <p className="text-muted-foreground py-4 text-center text-sm">
        Aún no hay comentarios. Inicia la conversación de revisión.
      </p>
    )
  }
  return (
    <ul className="space-y-3">
      {comentarios.map((c) => (
        <li key={c.id} className="rounded-lg border p-3">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold">
              {c.autor?.nombre_completo ?? 'Usuario'}
            </span>
            {c.categoria !== 'INTERNO' && (
              <Badge variant="outline" className="text-[10px]">
                {categoriaLabel[c.categoria] ?? c.categoria}
              </Badge>
            )}
            <span className="text-muted-foreground ml-auto text-xs">
              {formatDistanceToNow(parseISO(c.creado_en), {
                addSuffix: true,
                locale: es,
              })}
            </span>
          </div>
          <p className="text-foreground text-sm whitespace-pre-wrap">
            {c.cuerpo}
          </p>
          <p className="text-muted-foreground/70 mt-1 text-[11px]">
            {format(parseISO(c.creado_en), "d 'de' MMMM, HH:mm", {
              locale: es,
            })}
          </p>
        </li>
      ))}
    </ul>
  )
}
