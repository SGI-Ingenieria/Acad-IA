import { useRouter } from '@tanstack/react-router'
import { Loader2, Power, Search, UserCog, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import type {
  ResponsableRolSimulado,
  Rol,
  SimulacionAsignaturaOption,
} from '@/data'

import { FacultadIconPill } from '@/components/shared/FacultadIconPill'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { getSessionAuthzSimulation } from '@/data/auth/permissions'
import { useSession } from '@/data/hooks/useAuth'
import { usePermissions } from '@/data/hooks/usePermissions'
import {
  useActivateRoleSimulation,
  useDeactivateRoleSimulation,
  useRoleSimulationCatalogos,
  useRoleSimulationSubjects,
} from '@/data/hooks/useRoleSimulation'
import { NIVEL_ORDEN } from '@/features/usuarios/usuario-ui'
import { formatCarreraNombre, formatFacultadNombre } from '@/lib/facultad-utils'
import { notify } from '@/lib/toast'

const responsableOptions: Array<{
  value: ResponsableRolSimulado
  label: string
}> = [
  { value: 'PROFESOR_RESPONSABLE', label: 'Profesor responsable' },
  { value: 'COAUTOR', label: 'Coautor' },
  { value: 'REVISOR', label: 'Revisor' },
]

function roleRequiresFacultad(role: Rol | undefined) {
  return role?.alcance_default === 'facultad'
}

function roleRequiresCarrera(role: Rol | undefined) {
  return role?.alcance_default === 'carrera'
}

function roleRequiresAsignatura(role: Rol | undefined) {
  return (
    role?.alcance_default === 'asignatura' ||
    role?.alcance_default === 'externo'
  )
}

function activeLabel(simulation: ReturnType<typeof getSessionAuthzSimulation>) {
  if (!simulation) return 'Simular rol'
  if (simulation.asignatura_nombre) {
    return `${simulation.rol_nombre ?? 'Rol'} · ${simulation.asignatura_nombre}`
  }
  if (simulation.carrera_nombre) {
    return `${simulation.rol_nombre ?? 'Rol'} · ${simulation.carrera_nombre}`
  }
  if (simulation.facultad_nombre) {
    return `${simulation.rol_nombre ?? 'Rol'} · ${simulation.facultad_nombre}`
  }
  return simulation.rol_nombre ?? 'Simulación activa'
}

// En planes curriculares el nombre del plan ya incluye nivel + carrera
// ("Licenciatura en X - Plan Agosto 2026"), así que repetir la carrera es
// redundante: la omitimos cuando el nombre del plan ya la contiene.
function planCarreraLabel(subject: SimulacionAsignaturaOption): string {
  const plan = subject.plan_nombre?.trim() || null
  const carrera = subject.carrera_nombre?.trim() || null
  const carreraRedundante =
    !!plan && !!carrera && plan.toLowerCase().includes(carrera.toLowerCase())
  return [plan, carreraRedundante ? null : carrera].filter(Boolean).join(' · ')
}

function subjectLabel(subject: SimulacionAsignaturaOption) {
  return [subject.codigo, subject.nombre, planCarreraLabel(subject)]
    .filter(Boolean)
    .join(' · ')
}

export function RoleSimulationControl() {
  const router = useRouter()
  const { data: session } = useSession()
  const permissions = usePermissions()
  const simulation = useMemo(
    () => getSessionAuthzSimulation(session),
    [session],
  )
  const [open, setOpen] = useState(false)
  const [roleId, setRoleId] = useState('')
  const [facultadId, setFacultadId] = useState('')
  const [carreraId, setCarreraId] = useState('')
  const [subjectQuery, setSubjectQuery] = useState('')
  const [selectedSubject, setSelectedSubject] =
    useState<SimulacionAsignaturaOption | null>(null)
  const [responsableRol, setResponsableRol] = useState<ResponsableRolSimulado>(
    'PROFESOR_RESPONSABLE',
  )

  const catalogosQuery = useRoleSimulationCatalogos(open)
  const activateMutation = useActivateRoleSimulation()
  const deactivateMutation = useDeactivateRoleSimulation()
  const isCatalogLoading = catalogosQuery.isLoading || catalogosQuery.isFetching

  const roles = useMemo(
    () =>
      (catalogosQuery.data?.roles ?? []).filter(
        (role) => !['ADMIN', 'COORD_DHP'].includes(role.clave),
      ),
    [catalogosQuery.data?.roles],
  )
  const selectedRole = roles.find((role) => role.id === roleId)
  const needsFacultad = roleRequiresFacultad(selectedRole)
  const needsCarrera = roleRequiresCarrera(selectedRole)
  const needsSubject = roleRequiresAsignatura(selectedRole)

  const facultades = catalogosQuery.data?.facultades ?? []
  const selectedFacultad = facultades.find(
    (facultad) => facultad.id === facultadId,
  )
  const carreras = useMemo(() => {
    const all = catalogosQuery.data?.carreras ?? []
    if (!facultadId) return []
    return all.filter((carrera) => carrera.facultad_id === facultadId)
  }, [catalogosQuery.data?.carreras, facultadId])
  const carrerasPorNivel = useMemo(() => {
    return NIVEL_ORDEN.map((nivel) => ({
      nivel,
      carreras: carreras.filter((carrera) => carrera.nivel === nivel),
    })).filter((grupo) => grupo.carreras.length > 0)
  }, [carreras])
  const selectedCarrera = carreras.find((carrera) => carrera.id === carreraId)
  const carreraPlaceholder = !facultadId
    ? 'Selecciona primero una facultad'
    : catalogosQuery.isLoading
      ? 'Cargando carreras'
      : carreras.length === 0
        ? 'Esta facultad no tiene carreras'
        : 'Seleccionar carrera'
  const carreraDisabled =
    !facultadId || catalogosQuery.isLoading || carreras.length === 0

  const subjectsQuery = useRoleSimulationSubjects(
    { q: subjectQuery, limit: 12 },
    open && needsSubject && subjectQuery.trim().length >= 2,
  )

  const isBusy = activateMutation.isPending || deactivateMutation.isPending
  const controlsDisabled = isBusy || isCatalogLoading
  const isVisible = !!session && (permissions.isAdmin || !!simulation)

  useEffect(() => {
    if (!open) return
    const firstRoleId = roles.length > 0 ? roles[0].id : ''
    setRoleId(simulation?.rol_id ?? firstRoleId)
    setFacultadId(simulation?.facultad_id ?? '')
    setCarreraId(simulation?.carrera_id ?? '')
    setSubjectQuery(simulation?.asignatura_nombre ?? '')
    setSelectedSubject(
      simulation?.asignatura_id
        ? {
            id: simulation.asignatura_id,
            nombre: simulation.asignatura_nombre ?? null,
            codigo: null,
            plan_estudio_id: simulation.plan_estudio_id ?? null,
            plan_nombre: simulation.plan_nombre ?? null,
            carrera_id: simulation.carrera_id ?? null,
            carrera_nombre: simulation.carrera_nombre ?? null,
            facultad_id: simulation.facultad_id ?? null,
            facultad_nombre: simulation.facultad_nombre ?? null,
          }
        : null,
    )
  }, [open, roles, simulation])

  useEffect(() => {
    if (!needsCarrera) return
    if (!facultadId) {
      if (carreraId) setCarreraId('')
      return
    }
    if (!carreraId) return
    if (carreras.some((carrera) => carrera.id === carreraId)) return
    setCarreraId('')
  }, [carreraId, carreras, facultadId, needsCarrera])

  if (!isVisible) return null

  const handleActivate = async () => {
    if (!selectedRole) {
      notify.error('Selecciona un rol.')
      return
    }
    if (needsFacultad && !facultadId) {
      notify.error('Selecciona una facultad.')
      return
    }
    if (needsCarrera && !carreraId) {
      notify.error('Selecciona una carrera.')
      return
    }
    if (needsSubject && !selectedSubject) {
      notify.error('Selecciona una asignatura.')
      return
    }

    try {
      const result = await activateMutation.mutateAsync({
        rol_id: selectedRole.id,
        facultad_id: needsFacultad ? facultadId : null,
        carrera_id: needsCarrera ? carreraId : null,
        asignatura_id: needsSubject ? selectedSubject?.id : null,
        responsable_rol:
          selectedRole.clave === 'PROFESOR' ? responsableRol : undefined,
      })
      await router.invalidate()
      notify.success(`Simulando ${result.rol_nombre}.`)
      setOpen(false)
    } catch (error) {
      notify.error(
        error instanceof Error
          ? error.message
          : 'No se pudo activar la simulación.',
      )
    }
  }

  const handleDeactivate = async () => {
    try {
      await deactivateMutation.mutateAsync()
      await router.invalidate()
      notify.success('Simulación desactivada.')
      setOpen(false)
    } catch (error) {
      notify.error(
        error instanceof Error
          ? error.message
          : 'No se pudo desactivar la simulación.',
      )
    }
  }

  return (
    <>
      <Button
        type="button"
        variant={simulation ? 'secondary' : 'outline'}
        size="sm"
        onClick={() => setOpen(true)}
        className="max-w-[12rem] rounded-xl px-2.5 sm:max-w-[18rem]"
      >
        <UserCog className="h-4 w-4" />
        <span className="hidden min-w-0 truncate sm:inline">
          {activeLabel(simulation)}
        </span>
      </Button>

      <Dialog
        open={open}
        onOpenChange={(nextOpen) => !isBusy && setOpen(nextOpen)}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Simular rol</DialogTitle>
            <DialogDescription className="sr-only">
              Selecciona un rol y un alcance para probar permisos.
            </DialogDescription>
          </DialogHeader>

          {simulation ? (
            <div className="border-border bg-muted/40 flex items-start justify-between gap-3 rounded-lg border p-3">
              <div className="min-w-0">
                <p className="text-sm font-medium">Activo</p>
                <p className="text-muted-foreground truncate text-sm">
                  {activeLabel(simulation)}
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleDeactivate}
                disabled={isBusy}
              >
                {deactivateMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Power className="h-4 w-4" />
                )}
                Salir
              </Button>
            </div>
          ) : null}

          {isCatalogLoading ? (
            <div className="border-border bg-muted/30 text-muted-foreground flex items-center gap-2 rounded-lg border p-3 text-sm">
              <Loader2 className="h-4 w-4 animate-spin" />
              Cargando roles y alcances
            </div>
          ) : null}

          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label>Rol</Label>
              <Select
                value={roleId}
                onValueChange={setRoleId}
                disabled={controlsDisabled || roles.length === 0}
              >
                <SelectTrigger className="w-full">
                  <SelectValue
                    placeholder={
                      isCatalogLoading ? 'Cargando roles' : 'Seleccionar rol'
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {roles.map((role) => (
                    <SelectItem key={role.id} value={role.id}>
                      {role.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {needsFacultad || needsCarrera ? (
              <div className="grid gap-2">
                <Label>Facultad</Label>
                <Select
                  value={facultadId}
                  onValueChange={setFacultadId}
                  disabled={controlsDisabled || facultades.length === 0}
                >
                  <SelectTrigger className="w-full">
                    {selectedFacultad ? (
                      <span className="flex min-w-0 items-center gap-2">
                        <FacultadIconPill facultad={selectedFacultad} />
                        <span className="truncate">
                          {formatFacultadNombre(selectedFacultad)}
                        </span>
                      </span>
                    ) : (
                      <SelectValue placeholder="Seleccionar facultad" />
                    )}
                  </SelectTrigger>
                  <SelectContent>
                    {facultades.map((facultad) => (
                      <SelectItem
                        key={facultad.id}
                        value={facultad.id}
                        textValue={formatFacultadNombre(facultad)}
                      >
                        <span className="flex items-center gap-2">
                          <FacultadIconPill facultad={facultad} />
                          {formatFacultadNombre(facultad)}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}

            {needsCarrera ? (
              <div className="grid gap-2">
                <Label>Carrera</Label>
                <Select
                  value={carreraId}
                  onValueChange={setCarreraId}
                  disabled={controlsDisabled || carreraDisabled}
                >
                  <SelectTrigger className="w-full">
                    {selectedCarrera ? (
                      <span className="truncate">
                        {formatCarreraNombre(selectedCarrera)}
                      </span>
                    ) : (
                      <SelectValue placeholder={carreraPlaceholder} />
                    )}
                  </SelectTrigger>
                  <SelectContent>
                    {carrerasPorNivel.map((grupo) => (
                      <SelectGroup key={grupo.nivel}>
                        <SelectLabel>{grupo.nivel}</SelectLabel>
                        {grupo.carreras.map((carrera) => (
                          <SelectItem
                            key={carrera.id}
                            value={carrera.id}
                            textValue={carrera.nombre}
                          >
                            {carrera.nombre}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}

            {needsSubject ? (
              <div className="grid gap-2">
                <Label>Asignatura</Label>
                <div className="relative">
                  <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
                  <Input
                    value={subjectQuery}
                    onChange={(event) => {
                      setSubjectQuery(event.target.value)
                      setSelectedSubject(null)
                    }}
                    placeholder="Buscar asignatura"
                    className="pr-9 pl-9"
                    disabled={controlsDisabled}
                  />
                  {selectedSubject ? (
                    <button
                      type="button"
                      aria-label="Limpiar asignatura"
                      onClick={() => {
                        setSubjectQuery('')
                        setSelectedSubject(null)
                      }}
                      className="text-muted-foreground hover:text-foreground absolute top-1/2 right-2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  ) : null}
                </div>

                {selectedSubject ? (
                  <div className="flex min-w-0 flex-wrap gap-2">
                    <Badge
                      variant="secondary"
                      title={subjectLabel(selectedSubject)}
                      className="max-w-full min-w-0 shrink"
                    >
                      <span className="min-w-0 truncate">
                        {subjectLabel(selectedSubject)}
                      </span>
                    </Badge>
                  </div>
                ) : null}

                {!selectedSubject && subjectQuery.trim().length >= 2 ? (
                  <div className="border-border max-h-56 overflow-y-auto rounded-lg border">
                    {subjectsQuery.isLoading ? (
                      <div className="text-muted-foreground flex items-center gap-2 p-3 text-sm">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Buscando
                      </div>
                    ) : (subjectsQuery.data ?? []).length > 0 ? (
                      <div className="divide-border divide-y">
                        {(subjectsQuery.data ?? []).map((subject) => (
                          <button
                            key={subject.id}
                            type="button"
                            onClick={() => {
                              setSelectedSubject(subject)
                              setSubjectQuery(subject.nombre ?? '')
                            }}
                            className="hover:bg-muted/60 flex w-full flex-col items-start gap-1 px-3 py-2 text-left text-sm transition"
                          >
                            <span className="font-medium">
                              {subject.nombre}
                            </span>
                            <span className="text-muted-foreground text-xs">
                              {planCarreraLabel(subject) || 'Sin plan'}
                            </span>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="text-muted-foreground p-3 text-sm">
                        Sin resultados
                      </p>
                    )}
                  </div>
                ) : null}
              </div>
            ) : null}

            {selectedRole?.clave === 'PROFESOR' ? (
              <div className="grid gap-2">
                <Label>Responsabilidad</Label>
                <Select
                  value={responsableRol}
                  onValueChange={(value) =>
                    setResponsableRol(value as ResponsableRolSimulado)
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {responsableOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
          </div>

          <DialogFooter>
            <Button
              type="button"
              onClick={handleActivate}
              disabled={controlsDisabled}
            >
              {activateMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <UserCog className="h-4 w-4" />
              )}
              Activar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
