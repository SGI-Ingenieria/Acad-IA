import { Building2, Loader2, Plus, Trash2, UserCheck } from 'lucide-react'
import { useMemo, useState } from 'react'

import type { TipoExperto, UUID } from '@/data/types/domain'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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

export function PlanExpertosCard({
  planId,
  canManage,
}: {
  planId: UUID
  canManage: boolean
}) {
  const { data: asignados, isLoading } = usePlanExpertos(planId)
  const quitar = useQuitarPlanExperto(planId)
  const [open, setOpen] = useState(false)

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between py-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <UserCheck className="h-4 w-4" /> Expertos y sedes
        </CardTitle>
        {canManage && (
          <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
            <Plus className="mr-1 h-4 w-4" /> Invitar
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-2">
        {isLoading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="text-primary h-5 w-5 animate-spin" />
          </div>
        ) : (asignados ?? []).length === 0 ? (
          <p className="text-muted-foreground py-4 text-center text-sm">
            No hay expertos ni sedes invitados a este plan.
          </p>
        ) : (
          (asignados ?? []).map((pe) => (
            <div
              key={pe.id}
              className="flex items-center gap-3 rounded-lg border p-2.5"
            >
              <span className="bg-muted text-muted-foreground rounded-full p-1.5">
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
              <Badge variant="secondary" className="text-[10px]">
                {TIPO_LABEL[(pe.expertos?.tipo ?? 'EXPERTO') as TipoExperto]}
              </Badge>
              {canManage && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-destructive h-8 w-8"
                  onClick={() => quitar.mutate(pe.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))
        )}
      </CardContent>

      {open && (
        <InvitarExpertoDialog
          planId={planId}
          asignadosIds={(asignados ?? []).map((pe) => pe.experto_id)}
          onClose={() => setOpen(false)}
        />
      )}
    </Card>
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

        <div className="space-y-5 py-2">
          {disponibles.length > 0 && (
            <div className="space-y-2">
              <Label>Invitar uno existente</Label>
              <div className="flex gap-2">
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

          <div className="space-y-3 border-t pt-4">
            <Label className="text-muted-foreground text-xs uppercase">
              Registrar nuevo
            </Label>
            <div className="grid gap-1">
              <Label htmlFor="exp-nombre">Nombre</Label>
              <Input
                id="exp-nombre"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Nombre del experto o de la sede"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1">
                <Label htmlFor="exp-inst">Institución</Label>
                <Input
                  id="exp-inst"
                  value={institucion}
                  onChange={(e) => setInstitucion(e.target.value)}
                />
              </div>
              <div className="grid gap-1">
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
            <div className="grid gap-1">
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
            {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Registrar e invitar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
