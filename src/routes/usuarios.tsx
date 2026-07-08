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
import { useMemo, useState } from 'react'

import type { RolResponsable } from '@/data/api/responsables.api'
import type {
  AssignUsuarioRoleInput,
  Rol,
  Usuario,
  UsuariosCatalogos,
} from '@/data/api/usuarios.api'
import type { UsuariosSearch } from '@/types/search'
import type { FormEvent } from 'react'

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
import {
  getUsuarioRoles,
  matchesSearch,
  NIVEL_ORDEN,
} from '@/features/usuarios/usuario-ui'
import { UsuarioDetailPanel } from '@/features/usuarios/UsuarioDetailPanel'
import { UsuarioRow } from '@/features/usuarios/UsuarioRow'
import { UsuariosJerarquia } from '@/features/usuarios/UsuariosJerarquia'
import { formatFacultadNombre } from '@/lib/facultad-utils'
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
  const [nombramiento, setNombramiento] = useState<{
    input: AssignUsuarioRoleInput
    titularNombre: string
    nuevoNombre: string
    rolNombre: string
    alcanceNombre: string
  } | null>(null)
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
  // Usuario abierto en el panel de detalle (slide-over). Se deriva en vivo de la
  // lista para reflejar mutaciones (p. ej. al retirar un rol) sin estado stale.
  const [detalleId, setDetalleId] = useState<string | null>(null)
  const detalleUsuario = detalleId
    ? (usuarios.find((u) => u.id === detalleId) ?? null)
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
  const isInternal = form.tipo === 'internal'
  const creating =
    createMutation.isPending ||
    createDirectoMutation.isPending ||
    assignRoleMutation.isPending
  const assigning = assignRoleMutation.isPending || catalogosLoading
  const selectedRol = catalogos?.roles.find((rol) => rol.id === roleForm.rolId)
  const selectedUsuario = usuarios.find((u) => u.id === roleForm.usuarioId)
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
  const carrerasFiltradas = useMemo(() => {
    const carreras = carrerasGestionables
    if (!roleForm.facultadId) return carreras
    return carreras.filter(
      (carrera) => carrera.facultad_id === roleForm.facultadId,
    )
  }, [carrerasGestionables, roleForm.facultadId])

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
    const carreras = carrerasGestionables
    if (!draftRol.facultadId) return carreras
    return carreras.filter(
      (carrera) => carrera.facultad_id === draftRol.facultadId,
    )
  }, [carrerasGestionables, draftRol.facultadId])

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
    if (!canBootstrap && !usuario.gestion.puede_asignar_roles) return
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
    if (!canBootstrap && !usuario.gestion.puede_reasignar) return
    setReasignarUsuario(usuario)
    setDestinoId('')
  }

  const closeReasignarDialog = () => {
    setReasignarUsuario(null)
    setDestinoId('')
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

  const handleReasignar = async () => {
    if (!canBootstrap && !reasignarUsuario?.gestion.puede_reasignar) {
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

  const submitAssign = async (input: AssignUsuarioRoleInput) => {
    try {
      await assignRoleMutation.mutateAsync(input)
      notify.success(
        input.reemplazar ? 'Nombramiento realizado.' : 'Rol asignado.',
      )
      closeRoleDialog()
      setNombramiento(null)
    } catch (err: unknown) {
      notify.error(err instanceof Error ? err.message : 'Error al asignar rol.')
    }
  }

  const handleAssignRole = async (e: FormEvent) => {
    e.preventDefault()

    if (!canBootstrap && !selectedUsuario?.gestion.puede_asignar_roles) {
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

    const facultadId = requiresFacultad(selectedRol)
      ? roleForm.facultadId
      : null
    const carreraId = requiresCarrera(selectedRol) ? roleForm.carreraId : null
    const input: AssignUsuarioRoleInput = {
      usuarioId: roleForm.usuarioId,
      rol_id: roleForm.rolId,
      facultad_id: facultadId,
      carrera_id: carreraId,
    }

    // Rol singleton con titular vigente → confirmar proceso de nombramiento.
    const titular = findCurrentHolder(
      usuarios,
      selectedRol,
      facultadId,
      carreraId,
      roleForm.usuarioId,
    )
    if (titular) {
      const nuevo = usuarios.find((u) => u.id === roleForm.usuarioId)
      setNombramiento({
        input,
        titularNombre: titular.nombre_completo ?? 'el titular actual',
        nuevoNombre: nuevo?.nombre_completo ?? 'el nuevo responsable',
        rolNombre: selectedRol.nombre,
        alcanceNombre: getDraftScopeLabel(
          {
            rolId: roleForm.rolId,
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

          <Card className="gap-0 overflow-clip rounded-lg py-0">
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
                usuarios={usuarios}
                catalogos={catalogos}
                isLoading={isLoading}
                canManageUsers={canManageUsers}
                canManageRoles={canManageRoles}
                canManageResponsables={canManageResponsables}
                searchTerm={search}
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
                        selected={detalleId === usuario.id}
                        canManageUsers={rowCanManageUsers}
                        canManageRoles={rowCanManageRoles}
                        canReasignar={rowCanReasignar}
                        canManageResponsables={rowCanManageResponsables}
                        canUseActions={rowCanUseActions}
                        onOpen={(u) => setDetalleId(u.id)}
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

          <Dialog
            open={canManageUsers && dialogOpen}
            onOpenChange={(open) =>
              open ? setDialogOpen(true) : closeDialog()
            }
          >
            <DialogContent className="sm:max-w-2xl">
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
                      setForm((f) => ({
                        ...f,
                        nombre_completo: e.target.value,
                      }))
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

                      {draftSelectedRol &&
                        requiresFacultad(draftSelectedRol) && (
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
                              {facultadesGestionables.map((facultad) => (
                                <SelectItem
                                  key={facultad.id}
                                  value={facultad.id}
                                  textValue={formatFacultadNombre(facultad)}
                                >
                                  <span className="flex items-center gap-2">
                                    <FacultadIconPill facultad={facultad} />
                                    <span>
                                      {formatFacultadNombre(facultad)}
                                    </span>
                                    {facultadesPropiasIds.has(facultad.id) && (
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
                            </SelectContent>
                          </Select>
                        )}

                      {draftSelectedRol &&
                        requiresCarrera(draftSelectedRol) && (
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
                                {facultadesGestionables.map((facultad) => (
                                  <SelectItem
                                    key={facultad.id}
                                    value={facultad.id}
                                    textValue={formatFacultadNombre(facultad)}
                                  >
                                    <span className="flex items-center gap-2">
                                      <FacultadIconPill facultad={facultad} />
                                      <span>
                                        {formatFacultadNombre(facultad)}
                                      </span>
                                      {facultadesPropiasIds.has(
                                        facultad.id,
                                      ) && (
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
                                        <span className="flex items-center gap-2">
                                          <span>{carrera.nombre}</span>
                                          {carrerasPropiasIds.has(
                                            carrera.id,
                                          ) && (
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
            <DialogContent className="sm:max-w-2xl">
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
                        {facultadesGestionables.map((facultad) => (
                          <SelectItem
                            key={facultad.id}
                            value={facultad.id}
                            textValue={formatFacultadNombre(facultad)}
                          >
                            <span className="flex items-center gap-2">
                              <FacultadIconPill facultad={facultad} />
                              <span>{formatFacultadNombre(facultad)}</span>
                              {facultadesPropiasIds.has(facultad.id) && (
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
                          {facultadesGestionables.map((facultad) => (
                            <SelectItem
                              key={facultad.id}
                              value={facultad.id}
                              textValue={formatFacultadNombre(facultad)}
                            >
                              <span className="flex items-center gap-2">
                                <FacultadIconPill facultad={facultad} />
                                <span>{formatFacultadNombre(facultad)}</span>
                                {facultadesPropiasIds.has(facultad.id) && (
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
                                  <span className="flex items-center gap-2">
                                    <span>{carrera.nombre}</span>
                                    {carrerasPropiasIds.has(carrera.id) && (
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
                  <Button type="submit" disabled={assigning}>
                    Asignar rol
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>

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

          <Dialog
            open={
              !!reasignarUsuario &&
              (canBootstrap || !!reasignarUsuario.gestion.puede_reasignar)
            }
            onOpenChange={(open) => (open ? undefined : closeReasignarDialog())}
          >
            <DialogContent className="sm:max-w-2xl">
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
                  El destino{' '}
                  <strong>perderá sus roles y tareas actuales</strong> y
                  recibirá los del origen. El origen quedará{' '}
                  <strong>dado de baja</strong> y sin responsabilidades. Esta
                  acción queda registrada en el histórico.
                </div>

                <DialogFooter>
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={handleReasignar}
                    disabled={!destinoId || reasignarMutation.isPending}
                  >
                    {reasignarMutation.isPending
                      ? 'Reasignando...'
                      : 'Reasignar'}
                  </Button>
                </DialogFooter>
              </div>
            </DialogContent>
          </Dialog>

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
            onClose={() => setDetalleId(null)}
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
