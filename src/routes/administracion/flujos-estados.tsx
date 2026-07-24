import { createFileRoute } from '@tanstack/react-router'
import {
  ArrowRight,
  GitBranch,
  KeyRound,
  Loader2,
  Pencil,
  Plus,
  ShieldCheck,
  Trash2,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { z } from 'zod'

import type { RolAdmin } from '@/data/api/workflow.api'
import type { EstadoPlanRow, TipoEstructuraPlan } from '@/data/types/domain'

import { useAppForm } from '@/components/form'
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

export const Route = createFileRoute('/administracion/flujos-estados')({
  beforeLoad: ({ context }) =>
    requireAnyPermission(context.queryClient, ['catalogos.gestionar']),
  component: RouteComponent,
})

function RouteComponent() {
  // El título y las pestañas de nivel superior los pone el layout de
  // /administracion; esta página solo renderiza su contenido.
  return (
    <main className="bg-background w-full">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 md:px-6 lg:px-8 lg:py-8">
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

// Validadores por campo (zod como Standard Schema).
const nombreRequerido = z.string().trim().min(1, 'El nombre es requerido.')
const claveRequerida = z.string().trim().min(1, 'La clave es requerida.')
const etiquetaRequerida = z.string().trim().min(1, 'La etiqueta es requerida.')

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
          key={editing?.id ?? 'nuevo'}
          rol={editing}
          onClose={() => {
            setCreating(false)
            setEditing(null)
          }}
          onSubmit={(values) =>
            editing
              ? update.mutateAsync({ id: editing.id, input: values })
              : create.mutateAsync(values)
          }
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
  onClose,
  onSubmit,
}: {
  rol: RolAdmin | null
  onClose: () => void
  onSubmit: (values: RolValues) => Promise<unknown>
}) {
  const isEdit = Boolean(rol)

  const form = useAppForm({
    defaultValues: {
      clave: rol?.clave ?? '',
      nombre: rol?.nombre ?? '',
      descripcion: rol?.descripcion ?? '',
      nivel: String(rol?.nivel_jerarquico ?? 100),
      alcance: rol?.alcance_default ?? 'global',
    },
    onSubmit: async ({ value }) => {
      try {
        await onSubmit({
          clave: value.clave,
          nombre: value.nombre,
          descripcion: value.descripcion,
          nivel_jerarquico: Number(value.nivel) || 100,
          alcance_default: value.alcance,
        })
        onClose()
      } catch {
        // El toast global (meta.errorMessage del hook) ya avisó; el diálogo
        // queda abierto para corregir o reintentar.
      }
    },
  })

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            void form.handleSubmit()
          }}
        >
          <DialogHeader>
            <DialogTitle>{isEdit ? 'Editar rol' : 'Nuevo rol'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            {!isEdit && (
              <form.AppField
                name="clave"
                validators={{ onChange: claveRequerida }}
              >
                {(field) => (
                  <field.TextField
                    label="Clave"
                    placeholder="COORDINADOR_AREA"
                    className="font-mono"
                  />
                )}
              </form.AppField>
            )}
            <form.AppField
              name="nombre"
              validators={{ onChange: nombreRequerido }}
            >
              {(field) => (
                <field.TextField
                  label="Nombre"
                  placeholder="Coordinador de área"
                />
              )}
            </form.AppField>
            <form.AppField name="descripcion">
              {(field) => (
                <field.TextField
                  label="Descripción"
                  placeholder="Responsable de revisión curricular"
                />
              )}
            </form.AppField>
            <div className="grid grid-cols-2 gap-3">
              <form.AppField name="nivel">
                {(field) => <field.TextField label="Nivel" type="number" />}
              </form.AppField>
              <form.AppField name="alcance">
                {(field) => (
                  <field.SelectField
                    label="Alcance"
                    placeholder="Selecciona alcance"
                    options={ALCANCE_OPTIONS.map((option) => ({
                      value: option.value,
                      label: option.label,
                    }))}
                  />
                )}
              </form.AppField>
            </div>
          </div>
          <DialogFooter>
            <form.AppForm>
              <form.SubmitButton>Guardar</form.SubmitButton>
            </form.AppForm>
          </DialogFooter>
        </form>
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
          key={editing?.id ?? 'nuevo'}
          estado={editing}
          onClose={() => {
            setCreating(false)
            setEditing(null)
          }}
          onSubmit={(values) =>
            editing
              ? update.mutateAsync({ id: editing.id, input: values })
              : create.mutateAsync(values)
          }
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
}: {
  estado: EstadoPlanRow | null
  onClose: () => void
  onSubmit: (values: EstadoValues) => Promise<unknown>
}) {
  const isEdit = Boolean(estado)

  const form = useAppForm({
    defaultValues: {
      clave: estado?.clave ?? '',
      etiqueta: estado?.etiqueta ?? '',
      orden: String(estado?.orden ?? 0),
      es_final: estado?.es_final ?? false,
      color: estado?.color ?? '#3b82f6',
    },
    onSubmit: async ({ value }) => {
      try {
        await onSubmit({
          clave: value.clave,
          etiqueta: value.etiqueta,
          orden: Number(value.orden) || 0,
          es_final: value.es_final,
          color: value.color,
        })
        onClose()
      } catch {
        // El toast global (meta.errorMessage del hook) ya avisó; el diálogo
        // queda abierto para corregir o reintentar.
      }
    },
  })

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            void form.handleSubmit()
          }}
        >
          <DialogHeader>
            <DialogTitle>
              {isEdit ? 'Editar estado' : 'Nuevo estado'}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            {!isEdit && (
              <form.AppField
                name="clave"
                validators={{ onChange: claveRequerida }}
              >
                {(field) => (
                  <field.TextField
                    label="Clave"
                    placeholder="EN_CONSEJO_FACULTAD"
                    className="font-mono"
                  />
                )}
              </form.AppField>
            )}
            <form.AppField
              name="etiqueta"
              validators={{ onChange: etiquetaRequerida }}
            >
              {(field) => (
                <field.TextField
                  label="Etiqueta"
                  placeholder="En Consejo Académico de Facultad"
                />
              )}
            </form.AppField>
            <div className="grid grid-cols-2 gap-3">
              <form.AppField name="orden">
                {(field) => <field.TextField label="Orden" type="number" />}
              </form.AppField>
              <form.AppField name="color">
                {(field) => (
                  <field.TextField
                    label="Color"
                    type="color"
                    className="h-9 p-1"
                  />
                )}
              </form.AppField>
            </div>
            <form.AppField name="es_final">
              {(field) => (
                <field.CheckboxField label="Estado final (cierra el flujo)" />
              )}
            </form.AppField>
          </div>
          <DialogFooter>
            <form.AppForm>
              <form.SubmitButton>Guardar</form.SubmitButton>
            </form.AppForm>
          </DialogFooter>
        </form>
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
          onClose={() => setCreating(false)}
          onSubmit={(values) => create.mutateAsync(values)}
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
  onClose,
  onSubmit,
}: {
  estados: Array<EstadoPlanRow>
  roles: Array<{ id: string; clave: string; nombre: string }>
  onClose: () => void
  onSubmit: (values: {
    desdeEstadoId: string
    haciaEstadoId: string
    rolPermitidoId: string
    tipoEstructura: TipoEstructuraPlan | null
  }) => Promise<unknown>
}) {
  const estadoOptions = [...estados]
    .sort((a, b) => a.orden - b.orden)
    .map((e) => ({ value: e.id, label: e.etiqueta }))

  const form = useAppForm({
    defaultValues: {
      desde: '',
      hacia: '',
      rol: '',
      tipo: '' as TipoEstructuraPlan | '',
    },
    onSubmit: async ({ value }) => {
      try {
        await onSubmit({
          desdeEstadoId: value.desde,
          haciaEstadoId: value.hacia,
          rolPermitidoId: value.rol,
          tipoEstructura: value.tipo || null,
        })
        onClose()
      } catch {
        // El toast global (meta.errorMessage del hook) ya avisó; el diálogo
        // queda abierto para corregir o reintentar.
      }
    },
  })

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            void form.handleSubmit()
          }}
        >
          <DialogHeader>
            <DialogTitle>Nueva transición</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <form.AppField
              name="desde"
              validators={{
                onChange: ({ value }) =>
                  value ? undefined : 'Selecciona un estado.',
              }}
            >
              {(field) => (
                <field.SelectField
                  label="Desde"
                  placeholder="Selecciona un estado"
                  options={estadoOptions}
                />
              )}
            </form.AppField>
            <form.AppField
              name="hacia"
              validators={{
                // Ligado a `desde`: se revalida cuando cambia el estado origen.
                onChangeListenTo: ['desde'],
                onChange: ({ value, fieldApi }) => {
                  if (!value) return 'Selecciona un estado.'
                  if (value === fieldApi.form.getFieldValue('desde')) {
                    return 'El estado origen y destino no pueden ser el mismo.'
                  }
                  return undefined
                },
              }}
            >
              {(field) => (
                <field.SelectField
                  label="Hacia"
                  placeholder="Selecciona un estado"
                  options={estadoOptions}
                />
              )}
            </form.AppField>
            <form.AppField
              name="rol"
              validators={{
                onChange: ({ value }) =>
                  value ? undefined : 'Selecciona un rol.',
              }}
            >
              {(field) => (
                <field.SelectField
                  label="Rol permitido"
                  placeholder="Selecciona un rol"
                  options={roles.map((r) => ({ value: r.id, label: r.nombre }))}
                />
              )}
            </form.AppField>
            <form.AppField name="tipo">
              {(field) => (
                <field.SelectField
                  label="Tipo de plan"
                  placeholder="Ambos tipos"
                  options={[
                    { value: '', label: 'Ambos tipos' },
                    { value: 'CURRICULAR', label: TIPO_LABEL.CURRICULAR },
                    {
                      value: 'NO_CURRICULAR',
                      label: TIPO_LABEL.NO_CURRICULAR,
                    },
                  ]}
                />
              )}
            </form.AppField>
          </div>
          <DialogFooter>
            <form.AppForm>
              <form.SubmitButton>Crear</form.SubmitButton>
            </form.AppForm>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
