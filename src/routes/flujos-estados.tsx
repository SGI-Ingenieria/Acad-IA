import { createFileRoute } from '@tanstack/react-router'
import {
  ArrowRight,
  GitBranch,
  KeyRound,
  Loader2,
  Pencil,
  Plus,
  Settings2,
  ShieldCheck,
  Trash2,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import type { RolAdmin } from '@/data/api/workflow.api'
import type { EstadoPlanRow, TipoEstructuraPlan } from '@/data/types/domain'

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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { requireAnyPermission } from '@/data/auth/routeGuards'
import { useEstadosPlan } from '@/data/hooks/useMeta'
import {
  useEstadosPlanCrud,
  usePermisos,
  useRolPermisoCrud,
  useRoles,
  useRolesCrud,
  useRolesPermisos,
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
            <Settings2 className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-foreground text-3xl font-bold">
              Administración
            </h1>
            <p className="text-muted-foreground text-sm">
              Roles, permisos, estados y flujos del sistema
            </p>
          </div>
        </div>

        <Tabs defaultValue="roles" className="gap-5">
          <TabsList className="h-auto w-full justify-start overflow-x-auto rounded-md">
            <TabsTrigger value="roles">
              <ShieldCheck className="h-4 w-4" />
              Roles y permisos
            </TabsTrigger>
            <TabsTrigger value="estados">
              <KeyRound className="h-4 w-4" />
              Estados
            </TabsTrigger>
            <TabsTrigger value="flujos">
              <GitBranch className="h-4 w-4" />
              Flujos
            </TabsTrigger>
          </TabsList>

          <TabsContent value="roles">
            <RolesPermisosSection />
          </TabsContent>
          <TabsContent value="estados">
            <EstadosSection />
          </TabsContent>
          <TabsContent value="flujos">
            <TransicionesSection />
          </TabsContent>
        </Tabs>
      </div>
    </main>
  )
}

const ALCANCE_OPTIONS = [
  { value: 'global', label: 'Global' },
  { value: 'facultad', label: 'Facultad' },
  { value: 'carrera', label: 'Carrera' },
  { value: 'asignatura', label: 'Asignatura' },
  { value: 'externo', label: 'Externo' },
] as const

function groupLabel(value: string) {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

// ── Roles y permisos ────────────────────────────────────────────────────────────
function RolesPermisosSection() {
  const { data: roles, isLoading: rolesLoading } = useRoles()
  const { data: permisos, isLoading: permisosLoading } = usePermisos()
  const { data: rolesPermisos, isLoading: rolesPermisosLoading } =
    useRolesPermisos()
  const { create, update, remove } = useRolesCrud()
  const permisoMutation = useRolPermisoCrud()
  const [editing, setEditing] = useState<RolAdmin | null>(null)
  const [creating, setCreating] = useState(false)
  const [toDelete, setToDelete] = useState<RolAdmin | null>(null)
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null)

  const permissionKeys = useMemo(
    () =>
      new Set(
        (rolesPermisos ?? []).map(
          (item) => `${item.rol_id}:${item.permiso_id}`,
        ),
      ),
    [rolesPermisos],
  )

  const permisosByGroup = useMemo(() => {
    const grouped = new Map<string, typeof permisos>()
    for (const permiso of permisos ?? []) {
      grouped.set(permiso.grupo, [
        ...(grouped.get(permiso.grupo) ?? []),
        permiso,
      ])
    }
    return Array.from(grouped.entries())
  }, [permisos])

  const isLoading = rolesLoading || permisosLoading || rolesPermisosLoading
  const selectedRole =
    (roles ?? []).find((rol) => rol.id === selectedRoleId) ?? null

  useEffect(() => {
    const availableRoles = roles ?? []
    if (availableRoles.length === 0) {
      setSelectedRoleId(null)
      return
    }
    if (
      !selectedRoleId ||
      !availableRoles.some((rol) => rol.id === selectedRoleId)
    ) {
      setSelectedRoleId(availableRoles[0].id)
    }
  }, [roles, selectedRoleId])

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(18rem,22rem)_1fr]">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Roles</CardTitle>
          <Button size="sm" onClick={() => setCreating(true)}>
            <Plus className="mr-1 h-4 w-4" /> Nuevo
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {rolesLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="text-primary h-6 w-6 animate-spin" />
            </div>
          ) : (
            (roles ?? []).map((rol) => {
              const isSelected = selectedRoleId === rol.id
              const permisosCount = (rolesPermisos ?? []).filter(
                (item) => item.rol_id === rol.id,
              ).length

              return (
                <div
                  key={rol.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedRoleId(rol.id)}
                  onKeyDown={(event) => {
                    if (event.key !== 'Enter' && event.key !== ' ') return
                    event.preventDefault()
                    setSelectedRoleId(rol.id)
                  }}
                  className={`flex cursor-pointer items-center gap-3 rounded-lg border p-2.5 text-left transition ${
                    isSelected
                      ? 'border-primary bg-primary/5 ring-primary/20 ring-2'
                      : 'hover:bg-muted/40'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{rol.nombre}</p>
                    <p className="text-muted-foreground font-mono text-[11px]">
                      {rol.clave} · nivel {rol.nivel_jerarquico}
                    </p>
                  </div>
                  <Badge
                    variant={isSelected ? 'default' : 'secondary'}
                    className="text-[10px]"
                  >
                    {permisosCount}
                  </Badge>
                  <Badge variant="outline" className="text-[10px]">
                    {ALCANCE_OPTIONS.find(
                      (o) => o.value === rol.alcance_default,
                    )?.label ?? rol.alcance_default}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={(event) => {
                      event.stopPropagation()
                      setEditing(rol)
                    }}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive h-8 w-8"
                    onClick={(event) => {
                      event.stopPropagation()
                      setToDelete(rol)
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              )
            })
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            {selectedRole ? `Permisos de ${selectedRole.nombre}` : 'Permisos'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="text-primary h-6 w-6 animate-spin" />
            </div>
          ) : !selectedRole ? (
            <div className="text-muted-foreground rounded-lg border border-dashed p-8 text-center text-sm">
              Selecciona un rol para ver sus permisos.
            </div>
          ) : (
            <div className="rounded-lg border p-4">
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold">{selectedRole.nombre}</p>
                <Badge variant="secondary" className="text-[10px]">
                  {selectedRole.clave}
                </Badge>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                {permisosByGroup.map(([grupo, permisosGrupo]) => (
                  <div key={grupo} className="space-y-2">
                    <p className="text-muted-foreground text-[10px] font-bold tracking-wider uppercase">
                      {groupLabel(grupo)}
                    </p>
                    <div className="space-y-2">
                      {(permisosGrupo ?? []).map((permiso) => {
                        const checked = permissionKeys.has(
                          `${selectedRole.id}:${permiso.id}`,
                        )

                        return (
                          <label
                            key={permiso.id}
                            htmlFor={`${selectedRole.id}-${permiso.id}`}
                            className="hover:bg-muted/40 flex items-start gap-2 rounded-md border p-2 text-sm"
                          >
                            <Checkbox
                              id={`${selectedRole.id}-${permiso.id}`}
                              checked={checked}
                              disabled={permisoMutation.isPending}
                              onCheckedChange={(value) =>
                                permisoMutation.mutate({
                                  rolId: selectedRole.id,
                                  permisoId: permiso.id,
                                  enabled: value === true,
                                })
                              }
                            />
                            <span className="min-w-0">
                              <span className="block font-medium">
                                {permiso.nombre}
                              </span>
                              <span className="text-muted-foreground block truncate font-mono text-[11px]">
                                {permiso.clave}
                              </span>
                            </span>
                          </label>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {(creating || editing) && (
        <RolDialog
          rol={editing}
          pending={create.isPending || update.isPending}
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
        />
      )}

      <AlertDialog
        open={Boolean(toDelete)}
        onOpenChange={(open) => !open && setToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar rol?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará «{toDelete?.nombre}». No podrás eliminarlo si algún
              usuario o transición lo usa.
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
    </div>
  )
}

type RolValues = {
  clave: string
  nombre: string
  descripcion: string
  nivel_jerarquico: number
  alcance_default: string
}

function RolDialog({
  rol,
  pending,
  onClose,
  onSubmit,
}: {
  rol: RolAdmin | null
  pending: boolean
  onClose: () => void
  onSubmit: (values: RolValues) => void
}) {
  const [clave, setClave] = useState(rol?.clave ?? '')
  const [nombre, setNombre] = useState(rol?.nombre ?? '')
  const [descripcion, setDescripcion] = useState(rol?.descripcion ?? '')
  const [nivel, setNivel] = useState(String(rol?.nivel_jerarquico ?? 100))
  const [alcance, setAlcance] = useState(rol?.alcance_default ?? 'global')

  const isEdit = Boolean(rol)
  const valido = nombre.trim().length > 0 && (isEdit || clave.trim().length > 0)

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Editar rol' : 'Nuevo rol'}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 py-2">
          {!isEdit && (
            <div className="grid gap-1">
              <Label htmlFor="rol-clave">Clave</Label>
              <Input
                id="rol-clave"
                value={clave}
                onChange={(e) => setClave(e.target.value)}
                placeholder="COORDINADOR_AREA"
                className="font-mono"
              />
            </div>
          )}
          <div className="grid gap-1">
            <Label htmlFor="rol-nombre">Nombre</Label>
            <Input
              id="rol-nombre"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Coordinador de área"
            />
          </div>
          <div className="grid gap-1">
            <Label htmlFor="rol-descripcion">Descripción</Label>
            <Input
              id="rol-descripcion"
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Responsable de revisión curricular"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1">
              <Label htmlFor="rol-nivel">Nivel</Label>
              <Input
                id="rol-nivel"
                type="number"
                value={nivel}
                onChange={(e) => setNivel(e.target.value)}
              />
            </div>
            <div className="grid gap-1">
              <Label>Alcance</Label>
              <Select value={alcance} onValueChange={setAlcance}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona alcance" />
                </SelectTrigger>
                <SelectContent>
                  {ALCANCE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
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
                nombre,
                descripcion,
                nivel_jerarquico: Number(nivel) || 100,
                alcance_default: alcance,
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
                {t.tipo_estructura && (
                  <Badge
                    variant={
                      t.tipo_estructura === 'CURRICULAR' ? 'default' : 'outline'
                    }
                    className="text-[10px]"
                  >
                    {t.tipo_estructura === 'CURRICULAR'
                      ? 'Curricular'
                      : 'No curricular'}
                  </Badge>
                )}
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

const TIPO_LABEL: Record<NonNullable<TipoEstructuraPlan>, string> = {
  CURRICULAR: 'Curricular',
  NO_CURRICULAR: 'No curricular',
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
    tipoEstructura: TipoEstructuraPlan | null
  }) => void
}) {
  const [desde, setDesde] = useState('')
  const [hacia, setHacia] = useState('')
  const [rol, setRol] = useState('')
  const [tipo, setTipo] = useState<TipoEstructuraPlan | ''>('')
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
          <div className="grid gap-1">
            <Label>Tipo de plan</Label>
            <Select
              value={tipo}
              onValueChange={(value) =>
                setTipo(value as TipoEstructuraPlan | '')
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Ambos tipos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Ambos tipos</SelectItem>
                <SelectItem value="CURRICULAR">
                  {TIPO_LABEL.CURRICULAR}
                </SelectItem>
                <SelectItem value="NO_CURRICULAR">
                  {TIPO_LABEL.NO_CURRICULAR}
                </SelectItem>
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
                tipoEstructura: tipo || null,
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
