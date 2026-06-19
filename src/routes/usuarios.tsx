import { createFileRoute, stripSearchParams } from '@tanstack/react-router'
import {
  Search,
  ShieldCheck,
  ShieldPlus,
  Trash2,
  UserPlus,
  Users,
} from 'lucide-react'
import { useMemo, useState } from 'react'

import type { RolResponsable } from '@/data/api/responsables.api'
import type { Rol, Usuario, UsuariosCatalogos } from '@/data/api/usuarios.api'
import type { UsuariosSearch } from '@/types/search'
import type { FormEvent } from 'react'

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
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
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
import {
  FacultadIconPill,
  formatDate,
  getUsuarioRoles,
  getRoleName,
  getScopeLabel,
  matchesSearch,
  NIVEL_ORDEN,
} from '@/features/usuarios/usuario-ui'
import { UsuarioAccionesMenu } from '@/features/usuarios/UsuarioAccionesMenu'
import { UsuariosJerarquia } from '@/features/usuarios/UsuariosJerarquia'
import { notify } from '@/lib/toast'
import { defaultUsuariosSearch } from '@/types/search'

const parseUsuariosSearch = (
  search: Record<string, unknown>,
): UsuariosSearch => ({
  vista: search.vista === 'jerarquia' ? 'jerarquia' : 'lista',
})

export const Route = createFileRoute('/usuarios')({
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
  preload: true,
  component: RouteComponent,
})

type TipoUsuario = 'internal' | 'external'
type FiltroUsuario = 'todos' | 'internos' | 'externos' | 'inactivos'

const FORM_INITIAL = {
  tipo: 'internal' as TipoUsuario,
  nombre_completo: '',
  email: '',
  clave: '',
}

const ROLE_FORM_INITIAL = {
  usuarioId: '',
  rolId: '',
  facultadId: '',
  carreraId: '',
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

function RouteComponent() {
  const permissions = usePermissions()
  const { data: usuarios = [], isLoading: usuariosLoading } = useUsuarios()
  const { data: catalogos, isLoading: catalogosLoading } =
    useUsuariosCatalogos()
  const createMutation = useCreateUsuario()
  const createDirectoMutation = useCreateUsuarioDirecto()
  const assignRoleMutation = useAssignUsuarioRole()
  const removeRoleMutation = useRemoveUsuarioRole()
  const reasignarMutation = useReasignarResponsabilidades()
  const addResponsableMutation = useAddResponsable()
  const removeResponsableMutation = useRemoveResponsable()

  const navigate = Route.useNavigate()
  const { vista } = Route.useSearch()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [roleDialogOpen, setRoleDialogOpen] = useState(false)
  const [form, setForm] = useState(FORM_INITIAL)
  const [roleForm, setRoleForm] = useState(ROLE_FORM_INITIAL)
  const [pendingRoles, setPendingRoles] = useState<Array<DraftRol>>([])
  const [draftRol, setDraftRol] = useState<DraftRol>(DRAFT_ROL_INITIAL)
  const [reasignarUsuario, setReasignarUsuario] = useState<Usuario | null>(null)
  const [destinoId, setDestinoId] = useState('')
  const [materiasUsuarioId, setMateriasUsuarioId] = useState<string | null>(
    null,
  )
  const [materiaToAdd, setMateriaToAdd] = useState('')
  const [materiaRol, setMateriaRol] = useState<RolResponsable>(
    'PROFESOR_RESPONSABLE',
  )
  const [search, setSearch] = useState('')
  const [filtro, setFiltro] = useState<FiltroUsuario>('todos')

  const canBootstrap = permissions.hasBootstrapAccess()
  const canManageUsers = canBootstrap || permissions.has('usuarios.gestionar')
  const canManageRoles =
    canBootstrap || permissions.has('usuarios.roles.gestionar')
  const canManageResponsables =
    canBootstrap || permissions.has('asignaturas.responsables.gestionar')
  const canUseActions =
    canManageUsers || canManageRoles || canManageResponsables

  const { data: asignaturasAsignables = [] } =
    useAsignaturasAsignables(!!materiasUsuarioId)
  const materiasUsuario = materiasUsuarioId
    ? (usuarios.find((u) => u.id === materiasUsuarioId) ?? null)
    : null
  const isInternal = form.tipo === 'internal'
  const creating =
    createMutation.isPending ||
    createDirectoMutation.isPending ||
    assignRoleMutation.isPending
  const assigning = assignRoleMutation.isPending || catalogosLoading
  const selectedRol = catalogos?.roles.find((rol) => rol.id === roleForm.rolId)
  const selectedUsuario = usuarios.find((u) => u.id === roleForm.usuarioId)
  // Los roles por materia (alcance 'asignatura', p. ej. PROFESOR) no se asignan
  // manualmente aquí: se obtienen al hacer al usuario responsable de una materia.
  const rolesAsignables = (catalogos?.roles ?? []).filter(
    (rol) => rol.alcance_default !== 'asignatura',
  )
  const carrerasFiltradas = useMemo(() => {
    const carreras = catalogos?.carreras ?? []
    if (!roleForm.facultadId) return carreras
    return carreras.filter(
      (carrera) => carrera.facultad_id === roleForm.facultadId,
    )
  }, [catalogos?.carreras, roleForm.facultadId])

  const carrerasPorNivel = useMemo(() => {
    return NIVEL_ORDEN.map((nivel) => ({
      nivel,
      carreras: carrerasFiltradas.filter((carrera) => carrera.nivel === nivel),
    })).filter((grupo) => grupo.carreras.length > 0)
  }, [carrerasFiltradas])

  const draftSelectedRol = catalogos?.roles.find(
    (rol) => rol.id === draftRol.rolId,
  )
  const draftCarrerasFiltradas = useMemo(() => {
    const carreras = catalogos?.carreras ?? []
    if (!draftRol.facultadId) return carreras
    return carreras.filter(
      (carrera) => carrera.facultad_id === draftRol.facultadId,
    )
  }, [catalogos?.carreras, draftRol.facultadId])

  const draftCarrerasPorNivel = useMemo(() => {
    return NIVEL_ORDEN.map((nivel) => ({
      nivel,
      carreras: draftCarrerasFiltradas.filter(
        (carrera) => carrera.nivel === nivel,
      ),
    })).filter((grupo) => grupo.carreras.length > 0)
  }, [draftCarrerasFiltradas])

  const filteredUsuarios = useMemo(() => {
    return usuarios.filter((usuario) => {
      if (filtro === 'internos' && usuario.externo) return false
      if (filtro === 'externos' && !usuario.externo) return false
      if (filtro === 'inactivos' && !usuario.dado_de_baja_en) return false
      if (filtro !== 'inactivos' && usuario.dado_de_baja_en) return false
      return matchesSearch(usuario, search)
    })
  }, [filtro, search, usuarios])

  // La vista jerárquica solo se acota por la búsqueda libre (las pestañas
  // internos/externos/inactivos son específicas de la lista).
  const searchedUsuarios = useMemo(
    () => usuarios.filter((usuario) => matchesSearch(usuario, search)),
    [search, usuarios],
  )

  const stats = useMemo(
    () => [
      {
        label: 'Activos',
        value: usuarios.filter((usuario) => !usuario.dado_de_baja_en).length,
      },
      {
        label: 'Internos',
        value: usuarios.filter(
          (usuario) => !usuario.externo && !usuario.dado_de_baja_en,
        ).length,
      },
      {
        label: 'Externos',
        value: usuarios.filter(
          (usuario) => usuario.externo && !usuario.dado_de_baja_en,
        ).length,
      },
      {
        label: 'Con rol',
        value: usuarios.filter((usuario) => getUsuarioRoles(usuario).length > 0)
          .length,
      },
    ],
    [usuarios],
  )

  const closeDialog = () => {
    setDialogOpen(false)
    setForm(FORM_INITIAL)
    setPendingRoles([])
    setDraftRol(DRAFT_ROL_INITIAL)
  }

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

  const openRoleDialog = (usuario: Usuario) => {
    setRoleForm({
      ...ROLE_FORM_INITIAL,
      usuarioId: usuario.id,
    })
    setRoleDialogOpen(true)
  }

  const closeRoleDialog = () => {
    setRoleDialogOpen(false)
    setRoleForm(ROLE_FORM_INITIAL)
  }

  const openReasignarDialog = (usuario: Usuario) => {
    setReasignarUsuario(usuario)
    setDestinoId('')
  }

  const closeReasignarDialog = () => {
    setReasignarUsuario(null)
    setDestinoId('')
  }

  const openMateriasDialog = (usuario: Usuario) => {
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
          !u.externo && !u.dado_de_baja_en && u.id !== reasignarUsuario?.id,
      ),
    [usuarios, reasignarUsuario?.id],
  )

  const handleReasignar = async () => {
    if (!canManageRoles) {
      notify.error('No tienes permisos para reasignar.')
      return
    }
    if (!reasignarUsuario || !destinoId) {
      notify.error('Selecciona un usuario destino.')
      return
    }

    try {
      await reasignarMutation.mutateAsync({
        origenId: reasignarUsuario.id,
        destinoId,
      })
      notify.success(
        'Responsabilidades reasignadas. El origen quedó dado de baja.',
      )
      closeReasignarDialog()
    } catch (err: unknown) {
      notify.error(err instanceof Error ? err.message : 'Error al reasignar.')
    }
  }

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault()

    if (!canManageUsers) {
      notify.error('No tienes permisos para crear usuarios.')
      return
    }

    const nombre_completo = form.nombre_completo.trim()
    const email = form.email.trim()

    try {
      if (isInternal) {
        const clave = form.clave.trim().toLowerCase()
        if (!CLAVE_REGEX.test(clave)) {
          notify.error(
            'Formato de clave inválido. Debe ser ad o do seguido de 6 dígitos.',
          )
          return
        }
        if (!INTERNAL_EMAIL_REGEX.test(email)) {
          notify.error(
            'Los usuarios internos deben usar un correo @lasalle.mx o @lasallistas.org.mx.',
          )
          return
        }

        const created = await createDirectoMutation.mutateAsync({
          type: 'internal',
          nombre_completo,
          email,
          clave,
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
      closeDialog()
    } catch (err: unknown) {
      notify.error(
        err instanceof Error ? err.message : 'Error al crear usuario.',
      )
    }
  }

  const handleAssignRole = async (e: FormEvent) => {
    e.preventDefault()

    if (!canManageRoles) {
      notify.error('No tienes permisos para asignar roles.')
      return
    }

    if (!roleForm.usuarioId || !selectedRol) {
      notify.error('Selecciona un rol.')
      return
    }
    if (requiresFacultad(selectedRol) && !roleForm.facultadId) {
      notify.error('Selecciona una facultad para ese rol.')
      return
    }
    if (requiresCarrera(selectedRol) && !roleForm.carreraId) {
      notify.error('Selecciona una carrera para ese rol.')
      return
    }

    try {
      await assignRoleMutation.mutateAsync({
        usuarioId: roleForm.usuarioId,
        rol_id: roleForm.rolId,
        facultad_id: requiresFacultad(selectedRol) ? roleForm.facultadId : null,
        carrera_id: requiresCarrera(selectedRol) ? roleForm.carreraId : null,
      })
      notify.success('Rol asignado.')
      closeRoleDialog()
    } catch (err: unknown) {
      notify.error(err instanceof Error ? err.message : 'Error al asignar rol.')
    }
  }

  const handleRemoveRole = async (usuarioId: string, asignacionId: string) => {
    if (!canManageRoles) {
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
    <main className="bg-background min-h-screen w-full">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 py-6 md:px-6 lg:px-8 lg:py-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="text-primary bg-primary/10 rounded-lg p-2">
              <Users className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-foreground text-2xl font-bold md:text-3xl">
                Usuarios
              </h1>
              <p className="text-muted-foreground text-sm">
                Perfiles, estado de cuenta y alcances institucionales
              </p>
            </div>
          </div>
          {canManageUsers && (
            <Button onClick={() => setDialogOpen(true)}>
              <UserPlus className="h-4 w-4" />
              Nuevo usuario
            </Button>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((item) => (
            <div
              key={item.label}
              className="bg-card rounded-lg border px-4 py-3 shadow-xs"
            >
              <p className="text-muted-foreground text-xs font-medium">
                {item.label}
              </p>
              <p className="text-foreground mt-1 text-2xl font-bold">
                {item.value}
              </p>
            </div>
          ))}
        </div>

        <Card className="gap-0 overflow-hidden rounded-lg py-0">
          <div className="flex flex-col gap-3 border-b p-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
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
                <TabsList className="grid w-full grid-cols-2 lg:w-auto">
                  <TabsTrigger value="lista">Lista</TabsTrigger>
                  <TabsTrigger value="jerarquia">Jerarquía</TabsTrigger>
                </TabsList>
              </Tabs>
              {vista === 'lista' && (
                <Tabs
                  value={filtro}
                  onValueChange={(value) => setFiltro(value as FiltroUsuario)}
                >
                  <TabsList className="grid w-full grid-cols-4 lg:w-auto">
                    <TabsTrigger value="todos">Todos</TabsTrigger>
                    <TabsTrigger value="internos">Internos</TabsTrigger>
                    <TabsTrigger value="externos">Externos</TabsTrigger>
                    <TabsTrigger value="inactivos">Inactivos</TabsTrigger>
                  </TabsList>
                </Tabs>
              )}
            </div>
            <div className="relative w-full lg:max-w-sm">
              <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
                placeholder="Buscar usuario, correo o rol"
              />
            </div>
          </div>

          {vista === 'jerarquia' ? (
            <UsuariosJerarquia
              usuarios={searchedUsuarios}
              catalogos={catalogos}
              isLoading={isLoading}
              canManageUsers={canManageUsers}
              canManageRoles={canManageRoles}
              canManageResponsables={canManageResponsables}
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
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuario</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Roles y alcances</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Registro</TableHead>
                  {canUseActions && (
                    <TableHead className="text-right">Acciones</TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsuarios.map((usuario) => {
                  const roles = getUsuarioRoles(usuario)

                  return (
                    <TableRow
                      key={usuario.id}
                      className={usuario.dado_de_baja_en ? 'opacity-60' : ''}
                    >
                      <TableCell>
                        <div className="min-w-0">
                          <p className="text-foreground truncate font-medium">
                            {usuario.nombre_completo ?? 'Sin nombre'}
                          </p>
                          <p className="text-muted-foreground truncate text-xs">
                            {usuario.email ?? 'Sin correo'}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={usuario.externo ? 'outline' : 'secondary'}
                        >
                          {usuario.externo ? 'Externo' : 'Interno'}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-md">
                        {roles.length === 0 ? (
                          <span className="text-muted-foreground text-sm">
                            Sin rol asignado
                          </span>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            {roles.map((asignacion) => (
                              <Badge
                                key={asignacion.id}
                                variant="secondary"
                                className="max-w-full rounded-md pr-1"
                              >
                                <ShieldCheck className="h-3 w-3" />
                                <span className="truncate">
                                  {getRoleName(asignacion)}
                                </span>
                                <span className="text-muted-foreground">
                                  {getScopeLabel(asignacion)}
                                </span>
                                {canManageRoles && (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon-xs"
                                        className="ml-1"
                                        disabled={removeRoleMutation.isPending}
                                        onClick={() =>
                                          handleRemoveRole(
                                            usuario.id,
                                            asignacion.id,
                                          )
                                        }
                                      >
                                        <Trash2 className="h-3 w-3" />
                                        <span className="sr-only">
                                          Retirar rol
                                        </span>
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Retirar rol</TooltipContent>
                                  </Tooltip>
                                )}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        {usuario.dado_de_baja_en ? (
                          <Badge variant="destructive">Inactivo</Badge>
                        ) : (
                          <Badge className="bg-green-600 hover:bg-green-700">
                            Activo
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>{formatDate(usuario.creado_en)}</TableCell>
                      {canUseActions && (
                        <TableCell className="text-right">
                          <UsuarioAccionesMenu
                            usuario={usuario}
                            canManageUsers={canManageUsers}
                            canManageRoles={canManageRoles}
                            canManageResponsables={canManageResponsables}
                            onAssignRole={openRoleDialog}
                            onReasignar={openReasignarDialog}
                            onGestionarMaterias={openMateriasDialog}
                          />
                        </TableCell>
                      )}
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </Card>

        <Dialog
          open={canManageUsers && dialogOpen}
          onOpenChange={(open) => (open ? setDialogOpen(true) : closeDialog())}
        >
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Nuevo usuario</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label>Tipo de usuario</Label>
                <Tabs
                  value={form.tipo}
                  onValueChange={(value) =>
                    setForm((f) => ({ ...f, tipo: value as TipoUsuario }))
                  }
                >
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="internal">Interno</TabsTrigger>
                    <TabsTrigger value="external">Externo</TabsTrigger>
                  </TabsList>
                </Tabs>
                <p className="text-muted-foreground text-xs leading-5">
                  {isInternal
                    ? 'Acceso con Clave La Salle. No se envía invitación por correo.'
                    : 'Se enviará una invitación al correo para que defina su contraseña.'}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="nombre_completo">Nombre completo</Label>
                <Input
                  id="nombre_completo"
                  value={form.nombre_completo}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, nombre_completo: e.target.value }))
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Correo electrónico</Label>
                <Input
                  id="email"
                  type="email"
                  value={form.email}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, email: e.target.value }))
                  }
                  placeholder={isInternal ? 'usuario@lasalle.mx' : undefined}
                  required
                />
              </div>

              {isInternal && (
                <div className="space-y-2">
                  <Label htmlFor="clave">Clave La Salle</Label>
                  <Input
                    id="clave"
                    value={form.clave}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, clave: e.target.value }))
                    }
                    placeholder="ad123456"
                    autoCapitalize="none"
                    autoComplete="off"
                    required
                  />
                  <p className="text-muted-foreground text-xs leading-5">
                    Ejemplo: ad123456 o do123456.
                  </p>
                </div>
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
                          {(catalogos?.facultades ?? []).map((facultad) => (
                            <SelectItem
                              key={facultad.id}
                              value={facultad.id}
                              textValue={facultad.nombre}
                            >
                              <span className="flex items-center gap-2">
                                <FacultadIconPill facultad={facultad} />
                                {facultad.nombre}
                              </span>
                            </SelectItem>
                          ))}
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
                            {(catalogos?.facultades ?? []).map((facultad) => (
                              <SelectItem
                                key={facultad.id}
                                value={facultad.id}
                                textValue={facultad.nombre}
                              >
                                <span className="flex items-center gap-2">
                                  <FacultadIconPill facultad={facultad} />
                                  {facultad.nombre}
                                </span>
                              </SelectItem>
                            ))}
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
                            {draftCarrerasPorNivel.map((grupo) => (
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
                <Button type="button" variant="outline" onClick={closeDialog}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={creating}>
                  {creating
                    ? isInternal
                      ? 'Creando...'
                      : 'Enviando...'
                    : isInternal
                      ? 'Crear usuario'
                      : 'Enviar invitación'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog
          open={canManageRoles && roleDialogOpen}
          onOpenChange={(open) =>
            open ? setRoleDialogOpen(true) : closeRoleDialog()
          }
        >
          <DialogContent className="sm:max-w-xl">
            <DialogHeader>
              <DialogTitle>Asignar rol</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleAssignRole} className="space-y-4 pt-2">
              <div className="rounded-lg border p-3">
                <p className="text-foreground text-sm font-medium">
                  {selectedUsuario?.nombre_completo ?? 'Usuario'}
                </p>
                <p className="text-muted-foreground text-xs">
                  {selectedUsuario?.email ?? 'Sin correo'}
                </p>
              </div>

              <div className="space-y-2">
                <Label>Rol</Label>
                <Select
                  value={roleForm.rolId || undefined}
                  onValueChange={(rolId) =>
                    setRoleForm((current) => ({
                      ...current,
                      rolId,
                      facultadId: '',
                      carreraId: '',
                    }))
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
              </div>

              {selectedRol && requiresFacultad(selectedRol) && (
                <div className="space-y-2">
                  <Label>Facultad</Label>
                  <Select
                    value={roleForm.facultadId || undefined}
                    onValueChange={(facultadId) =>
                      setRoleForm((current) => ({
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
                      {(catalogos?.facultades ?? []).map((facultad) => (
                        <SelectItem
                          key={facultad.id}
                          value={facultad.id}
                          textValue={facultad.nombre}
                        >
                          <span className="flex items-center gap-2">
                            <FacultadIconPill facultad={facultad} />
                            {facultad.nombre}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {selectedRol && requiresCarrera(selectedRol) && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Facultad</Label>
                    <Select
                      value={roleForm.facultadId || undefined}
                      onValueChange={(facultadId) =>
                        setRoleForm((current) => ({
                          ...current,
                          facultadId,
                          carreraId: '',
                        }))
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Todas" />
                      </SelectTrigger>
                      <SelectContent>
                        {(catalogos?.facultades ?? []).map((facultad) => (
                          <SelectItem
                            key={facultad.id}
                            value={facultad.id}
                            textValue={facultad.nombre}
                          >
                            <span className="flex items-center gap-2">
                              <FacultadIconPill facultad={facultad} />
                              {facultad.nombre}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Carrera</Label>
                    <Select
                      value={roleForm.carreraId || undefined}
                      onValueChange={(carreraId) =>
                        setRoleForm((current) => ({ ...current, carreraId }))
                      }
                    >
                      <SelectTrigger
                        className="w-full"
                        disabled={carrerasFiltradas.length === 0}
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
                <Button
                  type="button"
                  variant="outline"
                  onClick={closeRoleDialog}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={assigning}>
                  Asignar rol
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog
          open={canManageRoles && !!reasignarUsuario}
          onOpenChange={(open) => (open ? undefined : closeReasignarDialog())}
        >
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Reasignar responsabilidades</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="rounded-lg border p-3">
                <p className="text-muted-foreground text-xs">Origen</p>
                <p className="text-foreground text-sm font-medium">
                  {reasignarUsuario?.nombre_completo ?? 'Usuario'}
                </p>
                <p className="text-muted-foreground text-xs">
                  {reasignarUsuario?.email ?? 'Sin correo'}
                </p>
              </div>

              <div className="space-y-2">
                <Label>Destino</Label>
                <Select
                  value={destinoId || undefined}
                  onValueChange={setDestinoId}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue
                      placeholder={
                        candidatosDestino.length === 0
                          ? 'No hay usuarios activos disponibles'
                          : 'Seleccionar usuario destino'
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {candidatosDestino.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.nombre_completo ?? u.email ?? 'Usuario sin nombre'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="border-destructive/40 bg-destructive/5 text-destructive rounded-lg border p-3 text-xs leading-5">
                El destino <strong>perderá sus roles y tareas actuales</strong>{' '}
                y recibirá los del origen. El origen quedará{' '}
                <strong>dado de baja</strong> y sin responsabilidades. Esta
                acción queda registrada en el histórico.
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={closeReasignarDialog}
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  onClick={handleReasignar}
                  disabled={!destinoId || reasignarMutation.isPending}
                >
                  {reasignarMutation.isPending ? 'Reasignando...' : 'Reasignar'}
                </Button>
              </DialogFooter>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog
          open={canManageResponsables && !!materiasUsuario}
          onOpenChange={(open) => (open ? undefined : closeMateriasDialog())}
        >
          <DialogContent className="sm:max-w-lg">
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
                    disabled={!materiaToAdd || addResponsableMutation.isPending}
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
      </div>
    </main>
  )
}
