import { createFileRoute } from '@tanstack/react-router'
import {
  ArrowRight,
  GitBranch,
  Loader2,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react'
import { useState } from 'react'

import type { EstadoPlanRow } from '@/data/types/domain'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
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
import { requireAnyPermission } from '@/data/auth/routeGuards'
import { useEstadosPlan } from '@/data/hooks/useMeta'
import {
  useEstadosPlanCrud,
  useRoles,
  useTransiciones,
  useTransicionesCrud,
} from '@/data/hooks/useWorkflow'

export const Route = createFileRoute('/flujos-estados')({
  beforeLoad: ({ context }) =>
    requireAnyPermission(context.queryClient, ['catalogos.gestionar']),
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <main className="bg-background min-h-screen w-full">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 md:px-6 lg:px-8 lg:py-8">
        <div className="flex items-center gap-3">
          <div className="text-primary bg-primary/10 rounded-lg p-2">
            <GitBranch className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-foreground text-3xl font-bold">
              Flujos y Estados
            </h1>
            <p className="text-muted-foreground text-sm">
              Configura los estados del ciclo de vida y las transiciones por rol
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <EstadosSection />
          <TransicionesSection />
        </div>
      </div>
    </main>
  )
}

// ── Estados ─────────────────────────────────────────────────────────────────────
function EstadosSection() {
  const { data: estados, isLoading } = useEstadosPlan()
  const { create, update, remove } = useEstadosPlanCrud()
  const [editing, setEditing] = useState<EstadoPlanRow | null>(null)
  const [creating, setCreating] = useState(false)
  const [toDelete, setToDelete] = useState<EstadoPlanRow | null>(null)

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg">Estados del ciclo de vida</CardTitle>
        <Button size="sm" onClick={() => setCreating(true)}>
          <Plus className="mr-1 h-4 w-4" /> Nuevo
        </Button>
      </CardHeader>
      <CardContent className="space-y-2">
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="text-primary h-6 w-6 animate-spin" />
          </div>
        ) : (
          (estados ?? []).map((estado) => (
            <div
              key={estado.id}
              className="flex items-center gap-3 rounded-lg border p-2.5"
            >
              <span
                className="h-4 w-4 shrink-0 rounded-full border"
                style={{ backgroundColor: estado.color ?? '#cccccc' }}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {estado.etiqueta}
                </p>
                <p className="text-muted-foreground font-mono text-[11px]">
                  {estado.clave} · orden {estado.orden}
                </p>
              </div>
              {estado.es_final && (
                <Badge variant="outline" className="text-[10px]">
                  Final
                </Badge>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setEditing(estado)}
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="text-destructive h-8 w-8"
                onClick={() => setToDelete(estado)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))
        )}
      </CardContent>

      {(creating || editing) && (
        <EstadoDialog
          estado={editing}
          onClose={() => {
            setCreating(false)
            setEditing(null)
          }}
          onSubmit={(values) => {
            if (editing) {
              update.mutate(
                { id: editing.id, input: values },
                { onSuccess: () => setEditing(null) },
              )
            } else {
              create.mutate(values, { onSuccess: () => setCreating(false) })
            }
          }}
          pending={create.isPending || update.isPending}
        />
      )}

      <AlertDialog
        open={Boolean(toDelete)}
        onOpenChange={(open) => !open && setToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar estado?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará «{toDelete?.etiqueta}». No podrás eliminarlo si algún
              plan o transición lo usa.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (toDelete) remove.mutate(toDelete.id)
                setToDelete(null)
              }}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}

type EstadoValues = {
  clave: string
  etiqueta: string
  orden: number
  es_final: boolean
  color: string
}

function EstadoDialog({
  estado,
  onClose,
  onSubmit,
  pending,
}: {
  estado: EstadoPlanRow | null
  onClose: () => void
  onSubmit: (values: EstadoValues) => void
  pending: boolean
}) {
  const [clave, setClave] = useState(estado?.clave ?? '')
  const [etiqueta, setEtiqueta] = useState(estado?.etiqueta ?? '')
  const [orden, setOrden] = useState(String(estado?.orden ?? 0))
  const [esFinal, setEsFinal] = useState(estado?.es_final ?? false)
  const [color, setColor] = useState(estado?.color ?? '#3b82f6')

  const isEdit = Boolean(estado)
  const valido =
    etiqueta.trim().length > 0 && (isEdit || clave.trim().length > 0)

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Editar estado' : 'Nuevo estado'}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 py-2">
          {!isEdit && (
            <div className="grid gap-1">
              <Label htmlFor="clave">Clave</Label>
              <Input
                id="clave"
                value={clave}
                onChange={(e) => setClave(e.target.value)}
                placeholder="EN_CONSEJO_FACULTAD"
                className="font-mono"
              />
            </div>
          )}
          <div className="grid gap-1">
            <Label htmlFor="etiqueta">Etiqueta</Label>
            <Input
              id="etiqueta"
              value={etiqueta}
              onChange={(e) => setEtiqueta(e.target.value)}
              placeholder="En Consejo Académico de Facultad"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1">
              <Label htmlFor="orden">Orden</Label>
              <Input
                id="orden"
                type="number"
                value={orden}
                onChange={(e) => setOrden(e.target.value)}
              />
            </div>
            <div className="grid gap-1">
              <Label htmlFor="color">Color</Label>
              <Input
                id="color"
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="h-9 p-1"
              />
            </div>
          </div>
          <label
            htmlFor="estado-es-final"
            className="flex items-center gap-2 text-sm"
          >
            <Checkbox
              id="estado-es-final"
              checked={esFinal}
              onCheckedChange={(c) => setEsFinal(c === true)}
            />
            Estado final (cierra el flujo)
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            disabled={!valido || pending}
            onClick={() =>
              onSubmit({
                clave,
                etiqueta,
                orden: Number(orden) || 0,
                es_final: esFinal,
                color,
              })
            }
          >
            {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Transiciones ──────────────────────────────────────────────────────────────
function TransicionesSection() {
  const { data: transiciones, isLoading } = useTransiciones()
  const { create, remove } = useTransicionesCrud()
  const { data: estados } = useEstadosPlan()
  const { data: roles } = useRoles()
  const [creating, setCreating] = useState(false)

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg">Transiciones por rol</CardTitle>
        <Button size="sm" onClick={() => setCreating(true)}>
          <Plus className="mr-1 h-4 w-4" /> Nueva
        </Button>
      </CardHeader>
      <CardContent className="space-y-2">
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="text-primary h-6 w-6 animate-spin" />
          </div>
        ) : (transiciones ?? []).length === 0 ? (
          <p className="text-muted-foreground py-6 text-center text-sm">
            Sin transiciones configuradas.
          </p>
        ) : (
          [...(transiciones ?? [])]
            .sort((a, b) => (a.desde?.orden ?? 0) - (b.desde?.orden ?? 0))
            .map((t) => (
              <div
                key={t.id}
                className="flex items-center gap-2 rounded-lg border p-2.5 text-sm"
              >
                <span className="font-medium">{t.desde?.etiqueta ?? '—'}</span>
                <ArrowRight className="text-muted-foreground h-4 w-4 shrink-0" />
                <span className="font-medium">{t.hacia?.etiqueta ?? '—'}</span>
                <Badge variant="secondary" className="ml-1 text-[10px]">
                  {t.rol?.nombre ?? t.rol?.clave ?? '—'}
                </Badge>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-destructive ml-auto h-8 w-8"
                  onClick={() => remove.mutate(t.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))
        )}
      </CardContent>

      {creating && (
        <TransicionDialog
          estados={estados ?? []}
          roles={roles ?? []}
          pending={create.isPending}
          onClose={() => setCreating(false)}
          onSubmit={(values) =>
            create.mutate(values, { onSuccess: () => setCreating(false) })
          }
        />
      )}
    </Card>
  )
}

function TransicionDialog({
  estados,
  roles,
  pending,
  onClose,
  onSubmit,
}: {
  estados: Array<EstadoPlanRow>
  roles: Array<{ id: string; clave: string; nombre: string }>
  pending: boolean
  onClose: () => void
  onSubmit: (values: {
    desdeEstadoId: string
    haciaEstadoId: string
    rolPermitidoId: string
  }) => void
}) {
  const [desde, setDesde] = useState('')
  const [hacia, setHacia] = useState('')
  const [rol, setRol] = useState('')
  const valido = desde && hacia && rol && desde !== hacia

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nueva transición</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 py-2">
          <EstadoSelect
            label="Desde"
            value={desde}
            onChange={setDesde}
            estados={estados}
          />
          <EstadoSelect
            label="Hacia"
            value={hacia}
            onChange={setHacia}
            estados={estados}
          />
          <div className="grid gap-1">
            <Label>Rol permitido</Label>
            <Select value={rol} onValueChange={setRol}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona un rol" />
              </SelectTrigger>
              <SelectContent>
                {roles.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {desde && hacia && desde === hacia && (
            <p className="text-destructive text-xs">
              El estado origen y destino no pueden ser el mismo.
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            disabled={!valido || pending}
            onClick={() =>
              onSubmit({
                desdeEstadoId: desde,
                haciaEstadoId: hacia,
                rolPermitidoId: rol,
              })
            }
          >
            {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Crear
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function EstadoSelect({
  label,
  value,
  onChange,
  estados,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  estados: Array<EstadoPlanRow>
}) {
  return (
    <div className="grid gap-1">
      <Label>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue placeholder="Selecciona un estado" />
        </SelectTrigger>
        <SelectContent>
          {[...estados]
            .sort((a, b) => a.orden - b.orden)
            .map((e) => (
              <SelectItem key={e.id} value={e.id}>
                {e.etiqueta}
              </SelectItem>
            ))}
        </SelectContent>
      </Select>
    </div>
  )
}
