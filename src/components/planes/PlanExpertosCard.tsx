import { Building2, Loader2, Plus, Trash2, UserCheck } from 'lucide-react'
import { useMemo, useState } from 'react'

import type { TipoExperto, UUID } from '@/data/types/domain'

import { showAppConfirm } from '@/components/ui/app-alert-dialog'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  useAgregarPlanExperto,
  useCrearExperto,
  useExpertos,
  usePlanExpertos,
  useQuitarPlanExperto,
} from '@/data/hooks/useWorkflow'

const TIPO_LABEL: Record<TipoExperto, string> = {
  EXPERTO: 'Experto',
  SEDE_HERMANA: 'Sede hermana',
}

/**
 * Invitación de un experto o sede. Vive fuera de `PlanExpertosCard` porque su
 * sitio es la cabecera del panel lateral, junto al cierre: antes era una fila
 * propia dentro de la lista y el aspa flotante del Sheet caía justo encima.
 * Trae consigo su diálogo y la lista de ya invitados, así que el host sólo
 * tiene que colocarlo.
 */
export function BotonInvitarExperto({ planId }: { planId: UUID }) {
  const { data: asignados } = usePlanExpertos(planId)
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <Plus className="mr-micro h-4 w-4" /> Invitar
      </Button>

      {open && (
        <InvitarExpertoDialog
          planId={planId}
          asignadosIds={(asignados ?? []).map((pe) => pe.experto_id)}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  )
}

export function PlanExpertosCard({
  planId,
  canManage,
}: {
  planId: UUID
  canManage: boolean
}) {
  const { data: asignados, isLoading } = usePlanExpertos(planId)
  const quitar = useQuitarPlanExperto(planId)

  // Quitar a alguien de la revisión externa se nota fuera de la aplicación
  // —deja de poder comentar—, así que se confirma nombrando a quién afecta.
  const quitarInvitacion = async (
    pe: NonNullable<typeof asignados>[number],
  ) => {
    const nombre = pe.expertos?.nombre ?? 'este experto'
    const confirmado = await showAppConfirm({
      title: `Quitar a ${nombre}`,
      description: `${nombre} dejará de participar en la revisión externa de este plan. Sus comentarios anteriores se conservan.`,
      variant: 'destructive',
    })
    if (confirmado) quitar.mutate(pe.id)
  }

  return (
    <section aria-label="Expertos y sedes invitados">
      <div>
        {isLoading ? (
          <div className="py-seccion flex justify-center">
            <Loader2 className="text-primary h-5 w-5 animate-spin" />
          </div>
        ) : (asignados ?? []).length === 0 ? (
          <div className="py-region text-center">
            <p className="text-foreground text-sm font-medium">
              Todavía nadie externo revisa este plan.
            </p>
            <p className="text-muted-foreground mt-relacionado mx-auto max-w-sm text-sm leading-relaxed">
              Los expertos y las sedes hermanas dejan comentarios sobre el plan
              en la etapa de revisión externa.
              {canManage
                ? ' Invítalos desde el botón de arriba.'
                : ' Quien coordina el plan puede invitarlos.'}
            </p>
          </div>
        ) : (
          <ul className="divide-border divide-y">
            {(asignados ?? []).map((pe) => (
              <li
                key={pe.id}
                className="gap-control py-control flex items-center"
              >
                <span className="bg-muted text-muted-foreground p-relacionado rounded-full">
                  {pe.expertos?.tipo === 'SEDE_HERMANA' ? (
                    <Building2 className="h-4 w-4" />
                  ) : (
                    <UserCheck className="h-4 w-4" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {pe.expertos?.nombre ?? 'Experto'}
                  </p>
                  <p className="text-muted-foreground truncate text-xs">
                    {[pe.expertos?.institucion, pe.expertos?.contacto]
                      .filter(Boolean)
                      .join(' · ') || 'Sin datos de contacto'}
                  </p>
                </div>
                <span className="text-muted-foreground text-xs">
                  {TIPO_LABEL[(pe.expertos?.tipo ?? 'EXPERTO') as TipoExperto]}
                </span>
                {canManage && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive h-8 w-8"
                        aria-label={`Quitar a ${pe.expertos?.nombre ?? 'este experto'} del plan`}
                        onClick={() => void quitarInvitacion(pe)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Quitar del plan</TooltipContent>
                  </Tooltip>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}

function InvitarExpertoDialog({
  planId,
  asignadosIds,
  onClose,
}: {
  planId: UUID
  asignadosIds: Array<UUID>
  onClose: () => void
}) {
  const { data: expertos } = useExpertos()
  const crear = useCrearExperto()
  const agregar = useAgregarPlanExperto()

  const [existente, setExistente] = useState('')
  const [nombre, setNombre] = useState('')
  const [institucion, setInstitucion] = useState('')
  const [contacto, setContacto] = useState('')
  const [tipo, setTipo] = useState<TipoExperto>('EXPERTO')

  const disponibles = useMemo(
    () => (expertos ?? []).filter((e) => !asignadosIds.includes(e.id)),
    [expertos, asignadosIds],
  )

  const pending = crear.isPending || agregar.isPending

  const invitarExistente = () => {
    if (!existente) return
    agregar.mutate(
      { planId, expertoId: existente },
      { onSuccess: () => onClose() },
    )
  }

  const registrarEInvitar = () => {
    if (nombre.trim().length === 0) return
    crear.mutate(
      {
        nombre,
        institucion: institucion || null,
        contacto: contacto || null,
        tipo,
      },
      {
        onSuccess: (experto) => {
          agregar.mutate(
            { planId, expertoId: experto.id },
            { onSuccess: () => onClose() },
          )
        },
      },
    )
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Invitar experto o sede</DialogTitle>
        </DialogHeader>

        <div className="space-y-seccion py-relacionado">
          {disponibles.length > 0 && (
            <div className="space-y-relacionado">
              <Label>Invitar uno existente</Label>
              <div className="gap-relacionado flex">
                <Select value={existente} onValueChange={setExistente}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Selecciona un experto/sede" />
                  </SelectTrigger>
                  <SelectContent>
                    {disponibles.map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.nombre}
                        {e.institucion ? ` · ${e.institucion}` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  disabled={!existente || pending}
                  onClick={invitarExistente}
                >
                  Invitar
                </Button>
              </div>
            </div>
          )}

          <div className="space-y-control pt-grupo border-t">
            <Label className="text-muted-foreground text-xs uppercase">
              Registrar nuevo
            </Label>
            <div className="gap-micro grid">
              <Label htmlFor="exp-nombre">Nombre</Label>
              <Input
                id="exp-nombre"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Nombre del experto o de la sede"
              />
            </div>
            <div className="gap-control grid grid-cols-2">
              <div className="gap-micro grid">
                <Label htmlFor="exp-inst">Institución</Label>
                <Input
                  id="exp-inst"
                  value={institucion}
                  onChange={(e) => setInstitucion(e.target.value)}
                />
              </div>
              <div className="gap-micro grid">
                <Label htmlFor="exp-tipo">Tipo</Label>
                <Select
                  value={tipo}
                  onValueChange={(v) => setTipo(v as TipoExperto)}
                >
                  <SelectTrigger id="exp-tipo">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="EXPERTO">Experto</SelectItem>
                    <SelectItem value="SEDE_HERMANA">Sede hermana</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="gap-micro grid">
              <Label htmlFor="exp-contacto">Contacto</Label>
              <Input
                id="exp-contacto"
                value={contacto}
                onChange={(e) => setContacto(e.target.value)}
                placeholder="Correo o teléfono"
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            disabled={nombre.trim().length === 0 || pending}
            onClick={registrarEInvitar}
          >
            {pending && (
              <Loader2 className="mr-relacionado h-4 w-4 animate-spin" />
            )}
            Registrar e invitar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
