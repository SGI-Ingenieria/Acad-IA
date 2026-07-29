import { useStore } from '@tanstack/react-form'
import { createFileRoute, stripSearchParams } from '@tanstack/react-router'
import {
  Search,
  ShieldCheck,
  ShieldPlus,
  Trash2,
  UserPlus,
  Users,
} from 'lucide-react'
import { AnimatePresence, MotionConfig } from 'motion/react'
import { useEffect, useMemo, useState } from 'react'
import { z } from 'zod'

import type { RolResponsable } from '@/data/api/responsables.api'
import type {
  AssignUsuarioRoleInput,
  Rol,
  Usuario,
  UsuariosCatalogos,
} from '@/data/api/usuarios.api'
import type { UsuariosSearch } from '@/types/search'

import { useAppForm } from '@/components/form'
import { FacultadIconPill } from '@/components/shared/FacultadIconPill'
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
import { Card } from '@/components/ui/card'
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
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
  ListFilterSection,
  ListFiltersDialog,
  ListSortMenu,
  ListToolbar,
} from '@/components/ui/list-controls'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ROLES_RESPONSABLE } from '@/data/api/responsables.api'
import { requireAnyPermissionOrBootstrap } from '@/data/auth/routeGuards'
import { usePermissions } from '@/data/hooks/usePermissions'
import {
  useAddResponsable,
  useAsignaturasAsignables,
  useRemoveResponsable,
} from '@/data/hooks/useResponsables'
import {
  useAssignUsuarioRole,
  useCreateUsuario,
  useCreateUsuarioDirecto,
  useReasignarResponsabilidades,
  useRemoveUsuarioRole,
  useUsuarios,
  useUsuariosCatalogos,
} from '@/data/hooks/useUsuarios'
import { usuariosOptions } from '@/data/query/queryOptions'
import { AuroraBackground } from '@/features/usuarios/AuroraBackground'
import { matchesSearch, NIVEL_ORDEN } from '@/features/usuarios/usuario-ui'
import { UsuarioDetailPanel } from '@/features/usuarios/UsuarioDetailPanel'
import { UsuarioRow } from '@/features/usuarios/UsuarioRow'
import { UsuariosJerarquia } from '@/features/usuarios/UsuariosJerarquia'
import { formatFacultadNombre } from '@/lib/facultad-utils'
import { notify } from '@/lib/toast'
import { defaultUsuariosSearch } from '@/types/search'

const FILTROS_USUARIO = [
  'todos',
  'internos',
  'externos',
  'inactivos',
] as const satisfies ReadonlyArray<UsuariosSearch['filtro']>

const USUARIOS_SORT_OPTIONS = [
  { value: 'nombre_asc', label: 'Nombre A–Z' },
  { value: 'nombre_desc', label: 'Nombre Z–A' },
  { value: 'creado_desc', label: 'Creación reciente' },
  { value: 'actualizado_desc', label: 'Actualización reciente' },
] as const

const parseUsuariosSearch = (
  search: Record<string, unknown>,
): UsuariosSearch => ({
  vista: search.vista === 'jerarquia' ? 'jerarquia' : 'lista',
  q: typeof search.q === 'string' ? search.q : defaultUsuariosSearch.q,
  filtro:
    typeof search.filtro === 'string' &&
    (FILTROS_USUARIO as ReadonlyArray<string>).includes(search.filtro)
      ? (search.filtro as UsuariosSearch['filtro'])
      : defaultUsuariosSearch.filtro,
  orden:
    search.orden === 'nombre_desc' ||
    search.orden === 'creado_desc' ||
    search.orden === 'actualizado_desc'
      ? search.orden
      : defaultUsuariosSearch.orden,
  detalle:
    typeof search.detalle === 'string'
      ? search.detalle
      : defaultUsuariosSearch.detalle,
})

export const Route = createFileRoute('/administracion/usuarios')({
  validateSearch: parseUsuariosSearch,
  search: {
    middlewares: [stripSearchParams(defaultUsuariosSearch)],
  },
  beforeLoad: ({ context }) =>
    requireAnyPermissionOrBootstrap(context.queryClient, [
      'usuarios.ver',
      'usuarios.gestionar',
    ]),
  loader: ({ context: { queryClient } }) => {
    void queryClient.prefetchQuery(usuariosOptions())
  },
  staleTime: 0,
  component: RouteComponent,
})

type TipoUsuario = 'internal' | 'external'
type FiltroUsuario = UsuariosSearch['filtro']

type RoleFormValues = {
  rolId: string
  facultadId: string
  carreraId: string
}

type DraftRol = {
  rolId: string
  facultadId: string
  carreraId: string
}

const DRAFT_ROL_INITIAL: DraftRol = {
  rolId: '',
  facultadId: '',
  carreraId: '',
}

const CLAVE_REGEX = /^(ad|do)\d{6}$/
const INTERNAL_EMAIL_REGEX = /@(lasalle\.mx|lasallistas\.org\.mx)$/i

// Validadores por campo del alta de usuario (los regex pasan a validadores).
const nombreCompletoSchema = z
  .string()
  .trim()
  .min(1, 'El nombre completo es requerido.')
const emailBaseSchema = z
  .string()
  .trim()
  .min(1, 'El correo electrónico es requerido.')
  .pipe(z.email('Ingresa un correo electrónico válido.'))

function getDraftRolNombre(
  draft: DraftRol,
  catalogos: UsuariosCatalogos | undefined,
) {
  return catalogos?.roles.find((rol) => rol.id === draft.rolId)?.nombre ?? 'Rol'
}

function getDraftScopeLabel(
  draft: DraftRol,
  catalogos: UsuariosCatalogos | undefined,
) {
  if (draft.carreraId) {
    const carrera = catalogos?.carreras.find((c) => c.id === draft.carreraId)
    return carrera?.nombre_corto ?? carrera?.nombre ?? 'Carrera'
  }
  if (draft.facultadId) {
    const facultad = catalogos?.facultades.find(
      (f) => f.id === draft.facultadId,
    )
    return (
      facultad?.prefijo ??
      facultad?.nombre_corto ??
      facultad?.nombre ??
      'Facultad'
    )
  }
  return 'Global'
}

function requiresFacultad(rol: Rol | undefined) {
  return rol?.alcance_default === 'facultad'
}

function requiresCarrera(rol: Rol | undefined) {
  return rol?.alcance_default === 'carrera'
}

// Roles con un único titular por alcance: asignar otro dispara un nombramiento.
const SINGLETON_ROLE_CLAVES = [
  'DIRECTOR_FACULTAD',
  'SECRETARIO_ACADEMICO',
  'JEFE_POSGRADO',
  'JEFE_CARRERA',
] as const

// Busca al titular vigente de un rol singleton para el mismo alcance (otro
// usuario distinto al destino). Devuelve undefined si el rol admite varios.
function findCurrentHolder(
  usuarios: Array<Usuario>,
  rol: Rol,
  facultadId: string | null,
  carreraId: string | null,
  exceptUsuarioId: string,
): Usuario | undefined {
  if (!(SINGLETON_ROLE_CLAVES as ReadonlyArray<string>).includes(rol.clave)) {
    return undefined
  }
  return usuarios.find(
    (u) =>
      u.id !== exceptUsuarioId &&
      u.roles.some((a) => {
        if (a.roles?.clave !== rol.clave) return false
        if (rol.alcance_default === 'facultad') {
          return !!facultadId && a.facultad_id === facultadId
        }
        if (rol.alcance_default === 'carrera') {
          return !!carreraId && a.carrera_id === carreraId
        }
        return false
      }),
  )
}

function RouteComponent() {
  const permissions = usePermissions()
  const { data: usuarios = [], isLoading: usuariosLoading } = useUsuarios()
  const { data: catalogos, isLoading: catalogosLoading } =
    useUsuariosCatalogos()
  const assignRoleMutation = useAssignUsuarioRole()
  const removeRoleMutation = useRemoveUsuarioRole()
  const addResponsableMutation = useAddResponsable()
  const removeResponsableMutation = useRemoveResponsable()

  const navigate = Route.useNavigate()
  const { vista, q, filtro, orden, detalle } = Route.useSearch()

  // Búsqueda con debounce: el input es local y se vuelca a la URL tras una pausa.
  const [qInput, setQInput] = useState(q)
  useEffect(() => setQInput(q), [q])
  useEffect(() => {
    const trimmed = qInput.trim()
    if (trimmed === q) return
    const id = setTimeout(() => {
      void navigate({
        search: (prev) => ({ ...prev, q: trimmed }),
        resetScroll: false,
      })
    }, 350)
    return () => clearTimeout(id)
  }, [qInput, navigate, q])

  // Estado efímero de UI: qué diálogos están abiertos y sobre qué usuario.
  // Los valores de los formularios viven en TanStack Form dentro de cada
  // diálogo (montado condicionalmente: al cerrar se desmonta y se resetea).
  const [dialogOpen, setDialogOpen] = useState(false)
  const [roleUsuarioId, setRoleUsuarioId] = useState<string | null>(null)
  const [nombramiento, setNombramiento] = useState<{
    input: AssignUsuarioRoleInput
    titularNombre: string
    nuevoNombre: string
    rolNombre: string
    alcanceNombre: string
  } | null>(null)
  const [reasignarUsuario, setReasignarUsuario] = useState<Usuario | null>(null)
  const [materiasUsuarioId, setMateriasUsuarioId] = useState<string | null>(
    null,
  )
  const [materiaToAdd, setMateriaToAdd] = useState('')
  const [materiaRol, setMateriaRol] = useState<RolResponsable>(
    'PROFESOR_RESPONSABLE',
  )
  // Usuario abierto en el panel de detalle (slide-over): vive en la URL
  // (param `detalle`) y se deriva en vivo de la lista para reflejar mutaciones
  // (p. ej. al retirar un rol) sin estado stale.
  const detalleUsuario = detalle
    ? (usuarios.find((u) => u.id === detalle) ?? null)
    : null

  const canBootstrap = permissions.hasBootstrapAccess()
  const canManageUsers =
    canBootstrap ||
    Boolean(catalogos?.gestion.puede_crear_usuarios) ||
    permissions.has('usuarios.gestionar')
  const canManageRoles =
    canBootstrap || Boolean(catalogos?.gestion.puede_gestionar_roles)
  const canManageResponsables =
    canBootstrap || permissions.has('asignaturas.responsables.gestionar')

  const { data: asignaturasAsignables = [] } =
    useAsignaturasAsignables(!!materiasUsuarioId)
  const materiasUsuario = materiasUsuarioId
    ? (usuarios.find((u) => u.id === materiasUsuarioId) ?? null)
    : null
  // Usuario destino del diálogo "Asignar rol", derivado en vivo de la lista.
  const selectedUsuario = roleUsuarioId
    ? (usuarios.find((u) => u.id === roleUsuarioId) ?? null)
    : null

  const filteredUsuarios = useMemo(() => {
    return usuarios
      .filter((usuario) => {
        if (filtro === 'internos' && usuario.externo) return false
        if (filtro === 'externos' && !usuario.externo) return false
        if (filtro === 'inactivos' && !usuario.dado_de_baja_en) return false
        if (filtro !== 'inactivos' && usuario.dado_de_baja_en) return false
        return matchesSearch(usuario, q)
      })
      .sort((left, right) => {
        if (orden === 'creado_desc')
          return right.creado_en.localeCompare(left.creado_en)
        if (orden === 'actualizado_desc')
          return right.actualizado_en.localeCompare(left.actualizado_en)
        const leftName = left.nombre_completo ?? left.email ?? ''
        const rightName = right.nombre_completo ?? right.email ?? ''
        return orden === 'nombre_desc'
          ? rightName.localeCompare(leftName, 'es')
          : leftName.localeCompare(rightName, 'es')
      })
  }, [filtro, orden, q, usuarios])

  const openRoleDialog = (usuario: Usuario) => {
    if (!canBootstrap && !usuario.gestion.puede_asignar_roles) return
    setRoleUsuarioId(usuario.id)
  }

  const closeRoleDialog = () => {
    setRoleUsuarioId(null)
  }

  const openReasignarDialog = (usuario: Usuario) => {
    if (!canBootstrap && !usuario.gestion.puede_reasignar) return
    setReasignarUsuario(usuario)
  }

  const closeReasignarDialog = () => {
    setReasignarUsuario(null)
  }

  const openMateriasDialog = (usuario: Usuario) => {
    if (!canBootstrap && !usuario.gestion.puede_gestionar_materias) return
    setMateriasUsuarioId(usuario.id)
    setMateriaToAdd('')
    setMateriaRol('PROFESOR_RESPONSABLE')
  }

  const closeMateriasDialog = () => {
    setMateriasUsuarioId(null)
    setMateriaToAdd('')
  }

  const handleAddMateria = async () => {
    if (!materiasUsuarioId || !materiaToAdd) {
      notify.error('Selecciona una materia.')
      return
    }
    try {
      await addResponsableMutation.mutateAsync({
        asignaturaId: materiaToAdd,
        usuarioId: materiasUsuarioId,
        rol: materiaRol,
      })
      notify.success('Materia asignada.')
      setMateriaToAdd('')
    } catch (err: unknown) {
      notify.error(
        err instanceof Error ? err.message : 'Error al asignar la materia.',
      )
    }
  }

  const handleRemoveMateria = async (
    responsableId: string,
    asignaturaId: string,
  ) => {
    if (!materiasUsuarioId) return
    try {
      await removeResponsableMutation.mutateAsync({
        id: responsableId,
        asignaturaId,
      })
      notify.success('Materia retirada.')
    } catch (err: unknown) {
      notify.error(
        err instanceof Error ? err.message : 'Error al retirar la materia.',
      )
    }
  }

  const candidatosDestino = useMemo(
    () =>
      usuarios.filter(
        (u) =>
          !u.externo &&
          !u.dado_de_baja_en &&
          u.id !== reasignarUsuario?.id &&
          (canBootstrap || u.gestion.puede_reasignar),
      ),
    [canBootstrap, usuarios, reasignarUsuario?.id],
  )

  const submitAssign = async (input: AssignUsuarioRoleInput) => {
    try {
      await assignRoleMutation.mutateAsync(input)
      notify.success(
        input.reemplazar ? 'Nombramiento realizado.' : 'Rol asignado.',
      )
      closeRoleDialog()
      setNombramiento(null)
    } catch {
      // El toast global (meta.errorMessage del hook) ya avisó; el diálogo
      // queda abierto para reintentar.
    }
  }

  // Recibe los valores ya validados por campo desde AsignarRolDialog.
  const handleAssignRole = async (values: RoleFormValues) => {
    if (!canBootstrap && !selectedUsuario?.gestion.puede_asignar_roles) {
      notify.error('No tienes permisos para asignar roles.')
      return
    }

    const selectedRol = catalogos?.roles.find((rol) => rol.id === values.rolId)
    if (!selectedUsuario || !selectedRol) {
      notify.error('Selecciona un rol.')
      return
    }

    const facultadId = requiresFacultad(selectedRol) ? values.facultadId : null
    const carreraId = requiresCarrera(selectedRol) ? values.carreraId : null
    const input: AssignUsuarioRoleInput = {
      usuarioId: selectedUsuario.id,
      rol_id: values.rolId,
      facultad_id: facultadId,
      carrera_id: carreraId,
    }

    // Rol singleton con titular vigente → confirmar proceso de nombramiento.
    const titular = findCurrentHolder(
      usuarios,
      selectedRol,
      facultadId,
      carreraId,
      selectedUsuario.id,
    )
    if (titular) {
      setNombramiento({
        input,
        titularNombre: titular.nombre_completo ?? 'el titular actual',
        nuevoNombre: selectedUsuario.nombre_completo ?? 'el nuevo responsable',
        rolNombre: selectedRol.nombre,
        alcanceNombre: getDraftScopeLabel(
          {
            rolId: values.rolId,
            facultadId: facultadId ?? '',
            carreraId: carreraId ?? '',
          },
          catalogos,
        ),
      })
      return
    }

    await submitAssign(input)
  }

  const handleRemoveRole = async (usuarioId: string, asignacionId: string) => {
    const usuario = usuarios.find((u) => u.id === usuarioId)
    if (!canBootstrap && !usuario?.gestion.puede_asignar_roles) {
      notify.error('No tienes permisos para retirar roles.')
      return
    }

    try {
      await removeRoleMutation.mutateAsync({ usuarioId, asignacionId })
      notify.success('Rol retirado.')
    } catch (err: unknown) {
      notify.error(err instanceof Error ? err.message : 'Error al retirar rol.')
    }
  }

  const isLoading = usuariosLoading || catalogosLoading

  return (
    <main className="relative min-h-screen w-full">
      <AuroraBackground />
      <MotionConfig reducedMotion="user">
        <div className="relative mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 py-6 md:px-6 lg:px-8 lg:py-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3">
              <div className="text-primary bg-primary/10 rounded-lg p-2">
                <Users className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-foreground text-2xl font-bold md:text-3xl">
                  Usuarios
                </h1>
              </div>
            </div>
            {canManageUsers && (
              <Button onClick={() => setDialogOpen(true)}>
                <UserPlus className="h-4 w-4" />
                Nuevo usuario
              </Button>
            )}
          </div>

          <Card className="gap-0 overflow-clip rounded-lg py-0">
            <div className="space-y-3 border-b p-4">
              <Tabs
                value={vista}
                onValueChange={(value) =>
                  navigate({
                    search: (prev) => ({
                      ...prev,
                      vista: value as UsuariosSearch['vista'],
                    }),
                    resetScroll: false,
                  })
                }
              >
                <TabsList className="grid w-full grid-cols-2 sm:w-fit">
                  <TabsTrigger value="lista">Lista</TabsTrigger>
                  <TabsTrigger value="jerarquia">Jerarquía</TabsTrigger>
                </TabsList>
              </Tabs>

              <ListToolbar
                search={
                  <div className="relative w-full">
                    <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
                    <Input
                      value={qInput}
                      onChange={(e) => setQInput(e.target.value)}
                      className="pl-9"
                      placeholder="Buscar usuario, correo o rol"
                      aria-label="Buscar usuarios"
                    />
                  </div>
                }
                actions={
                  <>
                    <ListSortMenu
                      value={orden}
                      defaultValue={defaultUsuariosSearch.orden}
                      options={[...USUARIOS_SORT_OPTIONS]}
                      onValueChange={(nextOrden) =>
                        navigate({
                          search: (prev) => ({
                            ...prev,
                            orden: nextOrden,
                          }),
                          resetScroll: false,
                        })
                      }
                      label="Ordenar usuarios"
                    />
                    {vista === 'lista' ? (
                      <ListFiltersDialog
                        title="Filtrar usuarios"
                        value={{ filtro }}
                        defaultValue={{
                          filtro: defaultUsuariosSearch.filtro,
                        }}
                        activeCount={filtro === 'todos' ? 0 : 1}
                        onApply={(next, { resetAll }) =>
                          navigate({
                            search: (prev) => ({
                              ...prev,
                              q: resetAll ? '' : prev.q,
                              orden: resetAll
                                ? defaultUsuariosSearch.orden
                                : prev.orden,
                              filtro: next.filtro,
                            }),
                            resetScroll: false,
                          })
                        }
                        label="Filtrar usuarios"
                      >
                        {(draft, setDraft) => (
                          <ListFilterSection title="Tipo de usuario">
                            <RadioGroup
                              value={draft.filtro}
                              onValueChange={(nextFiltro) =>
                                setDraft({
                                  filtro: nextFiltro as FiltroUsuario,
                                })
                              }
                            >
                              {[
                                ['todos', 'Todos'],
                                ['internos', 'Internos'],
                                ['externos', 'Externos'],
                                ['inactivos', 'Inactivos'],
                              ].map(([value, label]) => (
                                <Label
                                  key={value}
                                  className="border-border flex cursor-pointer items-center gap-3 rounded-md border px-3 py-3"
                                >
                                  <RadioGroupItem value={value} />
                                  {label}
                                </Label>
                              ))}
                            </RadioGroup>
                          </ListFilterSection>
                        )}
                      </ListFiltersDialog>
                    ) : null}
                  </>
                }
              />
            </div>

            {vista === 'jerarquia' ? (
              <UsuariosJerarquia
                usuarios={usuarios}
                catalogos={catalogos}
                isLoading={isLoading}
                canManageUsers={canManageUsers}
                canManageRoles={canManageRoles}
                canManageResponsables={canManageResponsables}
                searchTerm={q}
                onAssignRole={openRoleDialog}
                onReasignar={openReasignarDialog}
                onGestionarMaterias={openMateriasDialog}
              />
            ) : isLoading ? (
              <div className="space-y-3 p-6">
                {Array.from({ length: 5 }).map((_, index) => (
                  <div key={index} className="flex items-center gap-4">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-4 w-56" />
                    <Skeleton className="h-5 w-16 rounded-full" />
                    <Skeleton className="ml-auto h-8 w-24" />
                  </div>
                ))}
              </div>
            ) : filteredUsuarios.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 py-12">
                <Users className="text-muted-foreground h-10 w-10" />
                <div className="text-center">
                  <h2 className="text-foreground text-lg font-semibold">
                    Sin resultados
                  </h2>
                  <p className="text-muted-foreground text-sm">
                    Ajusta la búsqueda o cambia el filtro.
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-2.5 p-3 sm:gap-3 sm:p-4">
                <AnimatePresence initial={false}>
                  {filteredUsuarios.map((usuario, index) => {
                    const gestion = usuario.gestion
                    const rowCanManageUsers =
                      canBootstrap ||
                      gestion.puede_dar_baja ||
                      gestion.puede_reactivar ||
                      gestion.puede_reenviar_invitacion
                    const rowCanManageRoles =
                      canBootstrap || gestion.puede_asignar_roles
                    const rowCanReasignar =
                      canBootstrap || gestion.puede_reasignar
                    const rowCanManageResponsables =
                      canBootstrap || gestion.puede_gestionar_materias
                    const rowCanUseActions =
                      rowCanManageUsers ||
                      rowCanManageRoles ||
                      rowCanManageResponsables ||
                      gestion.puede_reasignar

                    return (
                      <UsuarioRow
                        key={usuario.id}
                        usuario={usuario}
                        index={index}
                        selected={detalle === usuario.id}
                        canManageUsers={rowCanManageUsers}
                        canManageRoles={rowCanManageRoles}
                        canReasignar={rowCanReasignar}
                        canManageResponsables={rowCanManageResponsables}
                        canUseActions={rowCanUseActions}
                        onOpen={(u) =>
                          navigate({
                            search: (prev) => ({ ...prev, detalle: u.id }),
                            resetScroll: false,
                          })
                        }
                        onAssignRole={openRoleDialog}
                        onReasignar={openReasignarDialog}
                        onGestionarMaterias={openMateriasDialog}
                      />
                    )
                  })}
                </AnimatePresence>
              </div>
            )}
          </Card>

          {canManageUsers && dialogOpen && (
            <NuevoUsuarioDialog
              canManageUsers={canManageUsers}
              canManageRoles={canManageRoles}
              onClose={() => setDialogOpen(false)}
            />
          )}

          {canManageRoles && selectedUsuario && (
            <AsignarRolDialog
              key={selectedUsuario.id}
              usuario={selectedUsuario}
              assignPending={assignRoleMutation.isPending}
              onClose={closeRoleDialog}
              onSubmit={handleAssignRole}
            />
          )}

          <AlertDialog
            open={!!nombramiento}
            onOpenChange={(open) => (open ? undefined : setNombramiento(null))}
          >
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Proceso de nombramiento</AlertDialogTitle>
                <AlertDialogDescription>
                  {nombramiento && (
                    <>
                      Ya existe un titular para{' '}
                      <span className="text-foreground font-medium">
                        {nombramiento.rolNombre}
                      </span>{' '}
                      en{' '}
                      <span className="text-foreground font-medium">
                        {nombramiento.alcanceNombre}
                      </span>
                      . Al continuar se dará de baja a{' '}
                      <span className="text-foreground font-medium">
                        {nombramiento.titularNombre}
                      </span>{' '}
                      y se nombrará a{' '}
                      <span className="text-foreground font-medium">
                        {nombramiento.nuevoNombre}
                      </span>{' '}
                      en su lugar.
                    </>
                  )}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={assignRoleMutation.isPending}>
                  Cancelar
                </AlertDialogCancel>
                <AlertDialogAction
                  disabled={assignRoleMutation.isPending}
                  onClick={(e) => {
                    e.preventDefault()
                    if (nombramiento) {
                      void submitAssign({
                        ...nombramiento.input,
                        reemplazar: true,
                      })
                    }
                  }}
                >
                  Confirmar nombramiento
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {reasignarUsuario &&
            (canBootstrap || reasignarUsuario.gestion.puede_reasignar) && (
              <ReasignarDialog
                key={reasignarUsuario.id}
                usuario={reasignarUsuario}
                candidatos={candidatosDestino}
                canBootstrap={canBootstrap}
                onClose={closeReasignarDialog}
              />
            )}

          <Dialog
            open={
              !!materiasUsuario &&
              (canBootstrap ||
                !!materiasUsuario.gestion.puede_gestionar_materias)
            }
            onOpenChange={(open) => (open ? undefined : closeMateriasDialog())}
          >
            <DialogContent className="sm:max-w-2xl">
              <DialogHeader>
                <DialogTitle>Materias del profesor</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="rounded-lg border p-3">
                  <p className="text-foreground text-sm font-medium">
                    {materiasUsuario?.nombre_completo ?? 'Usuario'}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {materiasUsuario?.email ?? 'Sin correo'}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Materias actuales</Label>
                  {!materiasUsuario || materiasUsuario.materias.length === 0 ? (
                    <p className="text-muted-foreground text-sm">
                      Sin materias asignadas.
                    </p>
                  ) : (
                    <div className="space-y-1">
                      {materiasUsuario.materias.map((materia) => (
                        <div
                          key={materia.responsable_id}
                          className="flex items-center justify-between gap-2 rounded-md border px-2.5 py-1.5"
                        >
                          <div className="min-w-0">
                            <p className="text-foreground truncate text-sm">
                              {materia.asignatura_nombre ?? 'Materia'}
                            </p>
                            <p className="text-muted-foreground truncate text-xs">
                              {[
                                materia.carrera_nombre,
                                ROLES_RESPONSABLE.find(
                                  (r) => r.value === materia.rol,
                                )?.label ?? materia.rol,
                              ]
                                .filter(Boolean)
                                .join(' · ')}
                            </p>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            disabled={removeResponsableMutation.isPending}
                            onClick={() =>
                              handleRemoveMateria(
                                materia.responsable_id,
                                materia.asignatura_id ?? '',
                              )
                            }
                          >
                            <Trash2 className="h-4 w-4" />
                            <span className="sr-only">Quitar materia</span>
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-2 border-t pt-3">
                  <Label>Agregar materia</Label>
                  <Command className="rounded-lg border">
                    <CommandInput placeholder="Buscar materia..." />
                    <CommandList className="max-h-48">
                      <CommandEmpty>Sin materias en tu ámbito.</CommandEmpty>
                      {asignaturasAsignables.map((a) => (
                        <CommandItem
                          key={a.id}
                          value={`${a.nombre} ${a.carrera_nombre ?? ''} ${a.codigo ?? ''}`}
                          onSelect={() => setMateriaToAdd(a.id)}
                          className={
                            materiaToAdd === a.id ? 'bg-primary/10' : undefined
                          }
                        >
                          <span className="truncate">
                            {a.nombre}
                            {a.carrera_nombre ? (
                              <span className="text-muted-foreground">
                                {' '}
                                · {a.carrera_nombre}
                              </span>
                            ) : null}
                          </span>
                        </CommandItem>
                      ))}
                    </CommandList>
                  </Command>

                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Select
                      value={materiaRol}
                      onValueChange={(v) => setMateriaRol(v as RolResponsable)}
                    >
                      <SelectTrigger className="w-full sm:w-56">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ROLES_RESPONSABLE.map((r) => (
                          <SelectItem key={r.value} value={r.value}>
                            {r.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      className="sm:flex-1"
                      onClick={handleAddMateria}
                      disabled={
                        !materiaToAdd || addResponsableMutation.isPending
                      }
                    >
                      <UserPlus className="h-4 w-4" />
                      Agregar materia
                    </Button>
                  </div>
                </div>

                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={closeMateriasDialog}
                  >
                    Cerrar
                  </Button>
                </DialogFooter>
              </div>
            </DialogContent>
          </Dialog>

          <UsuarioDetailPanel
            usuario={detalleUsuario}
            canManageUsers={
              canBootstrap ||
              !!detalleUsuario?.gestion.puede_dar_baja ||
              !!detalleUsuario?.gestion.puede_reactivar ||
              !!detalleUsuario?.gestion.puede_reenviar_invitacion
            }
            canManageRoles={
              canBootstrap || !!detalleUsuario?.gestion.puede_asignar_roles
            }
            canReasignar={
              canBootstrap || !!detalleUsuario?.gestion.puede_reasignar
            }
            canManageResponsables={
              canBootstrap || !!detalleUsuario?.gestion.puede_gestionar_materias
            }
            removingRole={removeRoleMutation.isPending}
            onClose={() =>
              navigate({
                search: (prev) => ({ ...prev, detalle: '' }),
                resetScroll: false,
              })
            }
            onAssignRole={openRoleDialog}
            onReasignar={openReasignarDialog}
            onGestionarMaterias={openMateriasDialog}
            onRemoveRole={handleRemoveRole}
          />
        </div>
      </MotionConfig>
    </main>
  )
}

/**
 * Catálogos de gestión derivados (roles asignables, facultades y carreras
 * gestionables) compartidos por los diálogos de alta y asignación de rol.
 */
function useGestionCatalogos() {
  const { data: catalogos, isLoading } = useUsuariosCatalogos()

  const rolesAsignablesIds = useMemo(
    () => new Set(catalogos?.gestion.roles_asignables ?? []),
    [catalogos?.gestion.roles_asignables],
  )
  const facultadesGestionablesIds = useMemo(
    () => new Set(catalogos?.gestion.facultades_gestionables ?? []),
    [catalogos?.gestion.facultades_gestionables],
  )
  const carrerasGestionablesIds = useMemo(
    () => new Set(catalogos?.gestion.carreras_gestionables ?? []),
    [catalogos?.gestion.carreras_gestionables],
  )
  const facultadesPropiasIds = useMemo(
    () => new Set(catalogos?.gestion.facultades_propias ?? []),
    [catalogos?.gestion.facultades_propias],
  )
  const carrerasPropiasIds = useMemo(
    () => new Set(catalogos?.gestion.carreras_propias ?? []),
    [catalogos?.gestion.carreras_propias],
  )

  // Los roles por materia (alcance 'asignatura', p. ej. PROFESOR) no se asignan
  // manualmente aquí: se obtienen al hacer al usuario responsable de una materia.
  const rolesAsignables = (catalogos?.roles ?? []).filter(
    (rol) =>
      rolesAsignablesIds.has(rol.id) &&
      rol.alcance_default !== 'asignatura' &&
      rol.alcance_default !== 'externo',
  )
  const facultadesGestionables = useMemo(() => {
    return (catalogos?.facultades ?? [])
      .filter((facultad) => facultadesGestionablesIds.has(facultad.id))
      .sort((a, b) => {
        const ownDiff =
          Number(facultadesPropiasIds.has(b.id)) -
          Number(facultadesPropiasIds.has(a.id))
        if (ownDiff !== 0) return ownDiff
        return a.nombre.localeCompare(b.nombre, 'es')
      })
  }, [catalogos?.facultades, facultadesGestionablesIds, facultadesPropiasIds])
  const carrerasGestionables = useMemo(() => {
    return (catalogos?.carreras ?? [])
      .filter((carrera) => carrerasGestionablesIds.has(carrera.id))
      .sort((a, b) => {
        const ownDiff =
          Number(carrerasPropiasIds.has(b.id)) -
          Number(carrerasPropiasIds.has(a.id))
        if (ownDiff !== 0) return ownDiff
        return a.nombre.localeCompare(b.nombre, 'es')
      })
  }, [catalogos?.carreras, carrerasGestionablesIds, carrerasPropiasIds])

  return {
    catalogos,
    isLoading,
    rolesAsignables,
    facultadesGestionables,
    carrerasGestionables,
    facultadesPropiasIds,
    carrerasPropiasIds,
  }
}

function agruparCarrerasPorNivel(carreras: UsuariosCatalogos['carreras']) {
  return NIVEL_ORDEN.map((nivel) => ({
    nivel,
    carreras: carreras.filter((carrera) => carrera.nivel === nivel),
  })).filter((grupo) => grupo.carreras.length > 0)
}

function FacultadSelectItems({
  facultades,
  propiasIds,
}: {
  facultades: UsuariosCatalogos['facultades']
  propiasIds: Set<string>
}) {
  return (
    <>
      {facultades.map((facultad) => (
        <SelectItem
          key={facultad.id}
          value={facultad.id}
          textValue={formatFacultadNombre(facultad)}
        >
          <span className="flex items-center gap-2">
            <FacultadIconPill facultad={facultad} />
            <span>{formatFacultadNombre(facultad)}</span>
            {propiasIds.has(facultad.id) && (
              <Badge
                variant="secondary"
                className="ml-auto rounded-sm px-1 py-0 text-[10px]"
              >
                Tu ámbito
              </Badge>
            )}
          </span>
        </SelectItem>
      ))}
    </>
  )
}

function CarreraSelectItems({
  carrerasPorNivel,
  propiasIds,
}: {
  carrerasPorNivel: ReturnType<typeof agruparCarrerasPorNivel>
  propiasIds: Set<string>
}) {
  return (
    <>
      {carrerasPorNivel.map((grupo) => (
        <SelectGroup key={grupo.nivel}>
          <SelectLabel>{grupo.nivel}</SelectLabel>
          {grupo.carreras.map((carrera) => (
            <SelectItem
              key={carrera.id}
              value={carrera.id}
              textValue={carrera.nombre}
            >
              <span className="flex items-center gap-2">
                <span>{carrera.nombre}</span>
                {propiasIds.has(carrera.id) && (
                  <Badge
                    variant="secondary"
                    className="ml-auto rounded-sm px-1 py-0 text-[10px]"
                  >
                    Tu ámbito
                  </Badge>
                )}
              </span>
            </SelectItem>
          ))}
        </SelectGroup>
      ))}
    </>
  )
}

function NuevoUsuarioDialog({
  canManageUsers,
  canManageRoles,
  onClose,
}: {
  canManageUsers: boolean
  canManageRoles: boolean
  onClose: () => void
}) {
  const createMutation = useCreateUsuario()
  const createDirectoMutation = useCreateUsuarioDirecto()
  const assignRoleMutation = useAssignUsuarioRole()
  const {
    catalogos,
    rolesAsignables,
    facultadesGestionables,
    carrerasGestionables,
    facultadesPropiasIds,
    carrerasPropiasIds,
  } = useGestionCatalogos()

  // Builder transitorio de roles a asignar tras crear el usuario: estado
  // efímero del diálogo (se descarta al desmontarse al cerrar).
  const [pendingRoles, setPendingRoles] = useState<Array<DraftRol>>([])
  const [draftRol, setDraftRol] = useState<DraftRol>(DRAFT_ROL_INITIAL)

  const form = useAppForm({
    defaultValues: {
      tipo: 'internal' as TipoUsuario,
      nombre_completo: '',
      email: '',
      clave: '',
    },
    onSubmit: async ({ value }) => {
      if (!canManageUsers) {
        notify.error('No tienes permisos para crear usuarios.')
        return
      }

      const nombre_completo = value.nombre_completo.trim()
      const email = value.email.trim()

      try {
        if (value.tipo === 'internal') {
          const created = await createDirectoMutation.mutateAsync({
            type: 'internal',
            nombre_completo,
            email,
            clave: value.clave.trim().toLowerCase(),
          })

          let rolesFallidos = 0
          for (const pending of pendingRoles) {
            const rol = catalogos?.roles.find((r) => r.id === pending.rolId)
            try {
              await assignRoleMutation.mutateAsync({
                usuarioId: created.id,
                rol_id: pending.rolId,
                facultad_id: requiresFacultad(rol) ? pending.facultadId : null,
                carrera_id: requiresCarrera(rol) ? pending.carreraId : null,
              })
            } catch {
              rolesFallidos += 1
            }
          }

          if (rolesFallidos > 0) {
            notify.error(
              `Usuario creado, pero ${rolesFallidos} rol(es) no se pudieron asignar.`,
            )
          } else if (pendingRoles.length > 0) {
            notify.success('Usuario interno creado con sus roles.')
          } else {
            notify.success('Usuario interno creado.')
          }
        } else {
          await createMutation.mutateAsync({ nombre_completo, email })
          notify.success('Invitación enviada al correo del usuario.')
        }
        onClose()
      } catch {
        // El toast global (meta.errorMessage del hook) ya avisó; el diálogo
        // queda abierto para corregir o reintentar.
      }
    },
  })

  const tipo = useStore(form.store, (state) => state.values.tipo)
  const isInternal = tipo === 'internal'

  const draftSelectedRol = catalogos?.roles.find(
    (rol) => rol.id === draftRol.rolId,
  )
  const draftCarrerasFiltradas = useMemo(() => {
    if (!draftRol.facultadId) return carrerasGestionables
    return carrerasGestionables.filter(
      (carrera) => carrera.facultad_id === draftRol.facultadId,
    )
  }, [carrerasGestionables, draftRol.facultadId])
  const draftCarrerasPorNivel = useMemo(
    () => agruparCarrerasPorNivel(draftCarrerasFiltradas),
    [draftCarrerasFiltradas],
  )

  const handleAddPendingRole = () => {
    if (!draftSelectedRol) {
      notify.error('Selecciona un rol.')
      return
    }
    if (requiresFacultad(draftSelectedRol) && !draftRol.facultadId) {
      notify.error('Selecciona una facultad para ese rol.')
      return
    }
    if (requiresCarrera(draftSelectedRol) && !draftRol.carreraId) {
      notify.error('Selecciona una carrera para ese rol.')
      return
    }

    const normalized: DraftRol = {
      rolId: draftRol.rolId,
      facultadId: requiresFacultad(draftSelectedRol) ? draftRol.facultadId : '',
      carreraId: requiresCarrera(draftSelectedRol) ? draftRol.carreraId : '',
    }

    const exists = pendingRoles.some(
      (r) =>
        r.rolId === normalized.rolId &&
        r.facultadId === normalized.facultadId &&
        r.carreraId === normalized.carreraId,
    )
    if (exists) {
      notify.error('Ese rol con ese alcance ya está en la lista.')
      return
    }

    setPendingRoles((prev) => [...prev, normalized])
    setDraftRol(DRAFT_ROL_INITIAL)
  }

  const handleRemovePendingRole = (index: number) => {
    setPendingRoles((prev) => prev.filter((_, i) => i !== index))
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Nuevo usuario</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            void form.handleSubmit()
          }}
          className="space-y-4 pt-2"
        >
          <form.AppField name="tipo">
            {(field) => (
              <div className="space-y-2">
                <Label>Tipo de usuario</Label>
                <Tabs
                  value={field.state.value}
                  onValueChange={(value) =>
                    field.handleChange(value as TipoUsuario)
                  }
                >
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="internal">Interno</TabsTrigger>
                    <TabsTrigger value="external">Externo</TabsTrigger>
                  </TabsList>
                </Tabs>
                <p className="text-muted-foreground text-xs leading-5">
                  {field.state.value === 'internal'
                    ? 'Acceso con Clave La Salle. No se envía invitación por correo.'
                    : 'Se enviará una invitación al correo para que defina su contraseña.'}
                </p>
              </div>
            )}
          </form.AppField>

          <form.AppField
            name="nombre_completo"
            validators={{ onChange: nombreCompletoSchema }}
          >
            {(field) => <field.TextField label="Nombre completo" />}
          </form.AppField>

          <form.AppField
            name="email"
            validators={{
              // Ligado a `tipo`: los internos exigen correo institucional.
              onChangeListenTo: ['tipo'],
              onChange: ({ value, fieldApi }) => {
                const base = emailBaseSchema.safeParse(value)
                if (!base.success) return base.error.issues[0]?.message
                if (
                  fieldApi.form.getFieldValue('tipo') === 'internal' &&
                  !INTERNAL_EMAIL_REGEX.test(value.trim())
                ) {
                  return 'Los usuarios internos deben usar un correo @lasalle.mx o @lasallistas.org.mx.'
                }
                return undefined
              },
            }}
          >
            {(field) => (
              <field.TextField
                label="Correo electrónico"
                type="email"
                placeholder={isInternal ? 'usuario@lasalle.mx' : undefined}
              />
            )}
          </form.AppField>

          {isInternal && (
            <form.AppField
              name="clave"
              validators={{
                onChange: ({ value }) => {
                  if (!CLAVE_REGEX.test(value.trim().toLowerCase())) {
                    return 'Formato de clave inválido. Debe ser ad o do seguido de 6 dígitos.'
                  }
                  return undefined
                },
              }}
            >
              {(field) => (
                <field.TextField
                  label="Clave La Salle"
                  placeholder="ad123456"
                  autoCapitalize="none"
                  autoComplete="off"
                  description="Ejemplo: ad123456 o do123456."
                />
              )}
            </form.AppField>
          )}

          {isInternal && canManageRoles && (
            <div className="space-y-3 rounded-lg border p-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm">Roles (opcional)</Label>
                {pendingRoles.length > 0 && (
                  <span className="text-muted-foreground text-xs">
                    {pendingRoles.length} agregado
                    {pendingRoles.length === 1 ? '' : 's'}
                  </span>
                )}
              </div>

              {pendingRoles.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {pendingRoles.map((pending, index) => (
                    <Badge
                      key={`${pending.rolId}-${pending.facultadId}-${pending.carreraId}`}
                      variant="secondary"
                      className="max-w-full rounded-md pr-1"
                    >
                      <ShieldCheck className="h-3 w-3" />
                      <span className="truncate">
                        {getDraftRolNombre(pending, catalogos)}
                      </span>
                      <span className="text-muted-foreground">
                        {getDraftScopeLabel(pending, catalogos)}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        className="ml-1"
                        onClick={() => handleRemovePendingRole(index)}
                      >
                        <Trash2 className="h-3 w-3" />
                        <span className="sr-only">Quitar rol</span>
                      </Button>
                    </Badge>
                  ))}
                </div>
              )}

              <div className="space-y-2">
                <Select
                  value={draftRol.rolId || undefined}
                  onValueChange={(rolId) =>
                    setDraftRol({ rolId, facultadId: '', carreraId: '' })
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Seleccionar rol" />
                  </SelectTrigger>
                  <SelectContent>
                    {rolesAsignables.map((rol) => (
                      <SelectItem key={rol.id} value={rol.id}>
                        {rol.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {draftSelectedRol && requiresFacultad(draftSelectedRol) && (
                  <Select
                    value={draftRol.facultadId || undefined}
                    onValueChange={(facultadId) =>
                      setDraftRol((current) => ({
                        ...current,
                        facultadId,
                        carreraId: '',
                      }))
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Seleccionar facultad" />
                    </SelectTrigger>
                    <SelectContent>
                      <FacultadSelectItems
                        facultades={facultadesGestionables}
                        propiasIds={facultadesPropiasIds}
                      />
                    </SelectContent>
                  </Select>
                )}

                {draftSelectedRol && requiresCarrera(draftSelectedRol) && (
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Select
                      value={draftRol.facultadId || undefined}
                      onValueChange={(facultadId) =>
                        setDraftRol((current) => ({
                          ...current,
                          facultadId,
                          carreraId: '',
                        }))
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Facultad" />
                      </SelectTrigger>
                      <SelectContent>
                        <FacultadSelectItems
                          facultades={facultadesGestionables}
                          propiasIds={facultadesPropiasIds}
                        />
                      </SelectContent>
                    </Select>
                    <Select
                      value={draftRol.carreraId || undefined}
                      onValueChange={(carreraId) =>
                        setDraftRol((current) => ({
                          ...current,
                          carreraId,
                        }))
                      }
                    >
                      <SelectTrigger
                        className="w-full"
                        disabled={draftCarrerasFiltradas.length === 0}
                      >
                        <SelectValue
                          placeholder={
                            draftCarrerasFiltradas.length === 0
                              ? 'Sin carreras'
                              : 'Carrera'
                          }
                        />
                      </SelectTrigger>
                      <SelectContent>
                        <CarreraSelectItems
                          carrerasPorNivel={draftCarrerasPorNivel}
                          propiasIds={carrerasPropiasIds}
                        />
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full"
                  disabled={!draftRol.rolId}
                  onClick={handleAddPendingRole}
                >
                  <ShieldPlus className="h-4 w-4" />
                  Agregar rol
                </Button>
              </div>
            </div>
          )}

          <DialogFooter>
            <form.AppForm>
              <form.SubmitButton>
                {isInternal ? 'Crear usuario' : 'Enviar invitación'}
              </form.SubmitButton>
            </form.AppForm>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function AsignarRolDialog({
  usuario,
  assignPending,
  onClose,
  onSubmit,
}: {
  usuario: Usuario
  assignPending: boolean
  onClose: () => void
  onSubmit: (values: RoleFormValues) => Promise<void>
}) {
  const {
    catalogos,
    isLoading: catalogosLoading,
    rolesAsignables,
    facultadesGestionables,
    carrerasGestionables,
    facultadesPropiasIds,
    carrerasPropiasIds,
  } = useGestionCatalogos()

  const findRol = (rolId: string) =>
    catalogos?.roles.find((rol) => rol.id === rolId)

  const form = useAppForm({
    defaultValues: { rolId: '', facultadId: '', carreraId: '' },
    // El cierre en éxito y el flujo de nombramiento los decide la página
    // (puede abrir la confirmación de nombramiento sin cerrar este diálogo).
    onSubmit: async ({ value }) => onSubmit(value),
  })

  const [rolIdValue, facultadIdValue] = useStore(form.store, (state) => [
    state.values.rolId,
    state.values.facultadId,
  ])
  const selectedRol = findRol(rolIdValue)

  const carrerasFiltradas = useMemo(() => {
    if (!facultadIdValue) return carrerasGestionables
    return carrerasGestionables.filter(
      (carrera) => carrera.facultad_id === facultadIdValue,
    )
  }, [carrerasGestionables, facultadIdValue])
  const carrerasPorNivel = useMemo(
    () => agruparCarrerasPorNivel(carrerasFiltradas),
    [carrerasFiltradas],
  )

  const selectShellProps = (field: {
    name: string
    state: {
      meta: { isTouched: boolean; isValid: boolean; errors: Array<unknown> }
    }
  }) => {
    const invalid = field.state.meta.isTouched && !field.state.meta.isValid
    const error = field.state.meta.errors
      .map((e) =>
        typeof e === 'string' ? e : ((e as { message?: string }).message ?? ''),
      )
      .filter(Boolean)
      .join(', ')
    return { invalid, error }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Asignar rol</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            void form.handleSubmit()
          }}
          className="space-y-4 pt-2"
        >
          <div className="rounded-lg border p-3">
            <p className="text-foreground text-sm font-medium">
              {usuario.nombre_completo ?? 'Usuario'}
            </p>
            <p className="text-muted-foreground text-xs">
              {usuario.email ?? 'Sin correo'}
            </p>
          </div>

          <form.AppField
            name="rolId"
            validators={{
              onChange: ({ value }) =>
                value ? undefined : 'Selecciona un rol.',
            }}
            listeners={{
              // Cambiar de rol invalida el alcance elegido para el anterior.
              onChange: () => {
                form.setFieldValue('facultadId', '')
                form.setFieldValue('carreraId', '')
              },
            }}
          >
            {(field) => {
              const { invalid, error } = selectShellProps(field)
              return (
                <div className="space-y-2">
                  <Label htmlFor={field.name}>Rol</Label>
                  <Select
                    value={field.state.value || undefined}
                    onValueChange={(rolId) => {
                      field.handleChange(rolId)
                      field.handleBlur()
                    }}
                  >
                    <SelectTrigger
                      id={field.name}
                      className="w-full"
                      aria-invalid={invalid}
                      aria-describedby={
                        invalid ? `${field.name}-error` : undefined
                      }
                    >
                      <SelectValue placeholder="Seleccionar rol" />
                    </SelectTrigger>
                    <SelectContent>
                      {rolesAsignables.map((rol) => (
                        <SelectItem key={rol.id} value={rol.id}>
                          {rol.nombre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {invalid && (
                    <p
                      id={`${field.name}-error`}
                      className="text-destructive text-sm"
                    >
                      {error}
                    </p>
                  )}
                </div>
              )
            }}
          </form.AppField>

          {selectedRol && requiresFacultad(selectedRol) && (
            <form.AppField
              name="facultadId"
              validators={{
                onChangeListenTo: ['rolId'],
                onChange: ({ value, fieldApi }) => {
                  const rol = findRol(fieldApi.form.getFieldValue('rolId'))
                  return requiresFacultad(rol) && !value
                    ? 'Selecciona una facultad para ese rol.'
                    : undefined
                },
              }}
              listeners={{
                onChange: () => form.setFieldValue('carreraId', ''),
              }}
            >
              {(field) => {
                const { invalid, error } = selectShellProps(field)
                return (
                  <div className="space-y-2">
                    <Label htmlFor={field.name}>Facultad</Label>
                    <Select
                      value={field.state.value || undefined}
                      onValueChange={(facultadId) => {
                        field.handleChange(facultadId)
                        field.handleBlur()
                      }}
                    >
                      <SelectTrigger
                        id={field.name}
                        className="w-full"
                        aria-invalid={invalid}
                        aria-describedby={
                          invalid ? `${field.name}-error` : undefined
                        }
                      >
                        <SelectValue placeholder="Seleccionar facultad" />
                      </SelectTrigger>
                      <SelectContent>
                        <FacultadSelectItems
                          facultades={facultadesGestionables}
                          propiasIds={facultadesPropiasIds}
                        />
                      </SelectContent>
                    </Select>
                    {invalid && (
                      <p
                        id={`${field.name}-error`}
                        className="text-destructive text-sm"
                      >
                        {error}
                      </p>
                    )}
                  </div>
                )
              }}
            </form.AppField>
          )}

          {selectedRol && requiresCarrera(selectedRol) && (
            <div className="grid gap-4 sm:grid-cols-2">
              <form.AppField
                name="facultadId"
                listeners={{
                  onChange: () => form.setFieldValue('carreraId', ''),
                }}
              >
                {(field) => (
                  <div className="space-y-2">
                    <Label htmlFor={`${field.name}-filtro`}>Facultad</Label>
                    <Select
                      value={field.state.value || undefined}
                      onValueChange={(facultadId) => {
                        field.handleChange(facultadId)
                        field.handleBlur()
                      }}
                    >
                      <SelectTrigger
                        id={`${field.name}-filtro`}
                        className="w-full"
                      >
                        <SelectValue placeholder="Todas" />
                      </SelectTrigger>
                      <SelectContent>
                        <FacultadSelectItems
                          facultades={facultadesGestionables}
                          propiasIds={facultadesPropiasIds}
                        />
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </form.AppField>
              <form.AppField
                name="carreraId"
                validators={{
                  onChangeListenTo: ['rolId'],
                  onChange: ({ value, fieldApi }) => {
                    const rol = findRol(fieldApi.form.getFieldValue('rolId'))
                    return requiresCarrera(rol) && !value
                      ? 'Selecciona una carrera para ese rol.'
                      : undefined
                  },
                }}
              >
                {(field) => {
                  const { invalid, error } = selectShellProps(field)
                  return (
                    <div className="space-y-2">
                      <Label htmlFor={field.name}>Carrera</Label>
                      <Select
                        value={field.state.value || undefined}
                        onValueChange={(carreraId) => {
                          field.handleChange(carreraId)
                          field.handleBlur()
                        }}
                      >
                        <SelectTrigger
                          id={field.name}
                          className="w-full"
                          disabled={carrerasFiltradas.length === 0}
                          aria-invalid={invalid}
                          aria-describedby={
                            invalid ? `${field.name}-error` : undefined
                          }
                        >
                          <SelectValue
                            placeholder={
                              carrerasFiltradas.length === 0
                                ? 'Esta facultad no tiene carreras'
                                : 'Seleccionar carrera'
                            }
                          />
                        </SelectTrigger>
                        <SelectContent>
                          <CarreraSelectItems
                            carrerasPorNivel={carrerasPorNivel}
                            propiasIds={carrerasPropiasIds}
                          />
                        </SelectContent>
                      </Select>
                      {invalid && (
                        <p
                          id={`${field.name}-error`}
                          className="text-destructive text-sm"
                        >
                          {error}
                        </p>
                      )}
                    </div>
                  )
                }}
              </form.AppField>
            </div>
          )}

          {selectedRol &&
            !requiresFacultad(selectedRol) &&
            !requiresCarrera(selectedRol) && (
              <div className="bg-muted/50 rounded-lg border p-3">
                <p className="text-muted-foreground text-sm">
                  Este rol no requiere seleccionar facultad o carrera.
                </p>
              </div>
            )}

          <DialogFooter>
            <form.AppForm>
              <form.SubmitButton disabled={assignPending || catalogosLoading}>
                Asignar rol
              </form.SubmitButton>
            </form.AppForm>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function ReasignarDialog({
  usuario,
  candidatos,
  canBootstrap,
  onClose,
}: {
  usuario: Usuario
  candidatos: Array<Usuario>
  canBootstrap: boolean
  onClose: () => void
}) {
  const reasignarMutation = useReasignarResponsabilidades()

  const form = useAppForm({
    defaultValues: { destinoId: '' },
    onSubmit: async ({ value }) => {
      if (!canBootstrap && !usuario.gestion.puede_reasignar) {
        notify.error('No tienes permisos para reasignar.')
        return
      }
      try {
        await reasignarMutation.mutateAsync({
          origenId: usuario.id,
          destinoId: value.destinoId,
        })
        notify.success(
          'Responsabilidades reasignadas. El origen quedó dado de baja.',
        )
        onClose()
      } catch {
        // El toast global (meta.errorMessage del hook) ya avisó; el diálogo
        // queda abierto para reintentar.
      }
    },
  })

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Reasignar responsabilidades</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            void form.handleSubmit()
          }}
          className="space-y-4 pt-2"
        >
          <div className="rounded-lg border p-3">
            <p className="text-muted-foreground text-xs">Origen</p>
            <p className="text-foreground text-sm font-medium">
              {usuario.nombre_completo ?? 'Usuario'}
            </p>
            <p className="text-muted-foreground text-xs">
              {usuario.email ?? 'Sin correo'}
            </p>
          </div>

          <form.AppField
            name="destinoId"
            validators={{
              onChange: ({ value }) =>
                value ? undefined : 'Selecciona un usuario destino.',
            }}
          >
            {(field) => (
              <field.SelectField
                label="Destino"
                placeholder={
                  candidatos.length === 0
                    ? 'No hay usuarios activos disponibles'
                    : 'Seleccionar usuario destino'
                }
                options={candidatos.map((u) => ({
                  value: u.id,
                  label: u.nombre_completo ?? u.email ?? 'Usuario sin nombre',
                }))}
              />
            )}
          </form.AppField>

          <div className="border-destructive/40 bg-destructive/5 text-destructive rounded-lg border p-3 text-xs leading-5">
            El destino <strong>perderá sus roles y tareas actuales</strong> y
            recibirá los del origen. El origen quedará{' '}
            <strong>dado de baja</strong> y sin responsabilidades. Esta acción
            queda registrada en el histórico.
          </div>

          <DialogFooter>
            <form.AppForm>
              <form.SubmitButton variant="destructive">
                Reasignar
              </form.SubmitButton>
            </form.AppForm>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
