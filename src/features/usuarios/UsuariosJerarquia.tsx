import {
  BookOpen,
  Building2,
  ChevronRight,
  Clock,
  Crown,
  FileText,
  GraduationCap,
  Loader2,
  Mail,
  ShieldCheck,
  UserCircle,
  Users,
} from 'lucide-react'
import { useMemo, useState } from 'react'

import { construirJerarquia } from './buildJerarquia'
import {
  FacultadIconPill,
  formatDate,
  getRoleName,
  getScopeLabel,
  getUsuarioRoles,
} from './usuario-ui'
import { UsuarioAccionesMenu } from './UsuarioAccionesMenu'

import type { CarreraNodo, FacultadNodo } from './buildJerarquia'
import type { Usuario } from '@/data/api/usuarios.api'

import { Badge } from '@/components/ui/badge'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { Skeleton } from '@/components/ui/skeleton'
import { useUsuarioRelaciones } from '@/data/hooks/useUsuarios'
import { cn } from '@/lib/utils'

type UsuariosJerarquiaProps = {
  usuarios: Array<Usuario>
  catalogos: Parameters<typeof construirJerarquia>[1]
  isLoading: boolean
  canManageUsers: boolean
  canManageRoles: boolean
  canManageResponsables: boolean
  onAssignRole: (usuario: Usuario) => void
  onReasignar: (usuario: Usuario) => void
  onGestionarMaterias: (usuario: Usuario) => void
}

export function UsuariosJerarquia({
  usuarios,
  catalogos,
  isLoading,
  canManageUsers,
  canManageRoles,
  canManageResponsables,
  onAssignRole,
  onReasignar,
  onGestionarMaterias,
}: UsuariosJerarquiaProps) {
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)

  const jerarquia = useMemo(
    () => construirJerarquia(usuarios, catalogos),
    [usuarios, catalogos],
  )

  const selectedUsuario = usuarios.find((u) => u.id === selectedUserId) ?? null

  if (isLoading) {
    return (
      <div className="space-y-3 p-6">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="flex items-center gap-3">
            <Skeleton className="h-4 w-4" />
            <Skeleton className="h-4 w-48" />
            <Skeleton className="ml-auto h-5 w-20 rounded-full" />
          </div>
        ))}
      </div>
    )
  }

  if (jerarquia.totalMiembros === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-12">
        <Users className="text-muted-foreground h-10 w-10" />
        <div className="text-center">
          <h2 className="text-foreground text-lg font-semibold">
            Sin usuarios en la jerarquía
          </h2>
          <p className="text-muted-foreground text-sm">
            No se encontraron usuarios con roles asignados para estos filtros.
          </p>
        </div>
      </div>
    )
  }

  const memberProps = {
    selectedUserId,
    onSelect: setSelectedUserId,
    canManageUsers,
    canManageRoles,
    canManageResponsables,
    onAssignRole,
    onReasignar,
    onGestionarMaterias,
  }

  return (
    <div className="grid gap-4 p-4 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="min-w-0 space-y-2">
        {jerarquia.global.length > 0 && (
          <GrupoColapsable
            icon={<Crown className="text-primary h-4 w-4" />}
            titulo="Dirección general"
            count={jerarquia.global.length}
            defaultOpen
          >
            <div className="space-y-1 pl-6">
              {jerarquia.global.map((miembro) => (
                <MiembroRow
                  key={miembro.asignacion.id}
                  usuario={miembro.usuario}
                  roleLabel={getRoleName(miembro.asignacion)}
                  {...memberProps}
                />
              ))}
            </div>
          </GrupoColapsable>
        )}

        {jerarquia.facultades.map((facultad) => (
          <FacultadTree
            key={facultad.id}
            facultad={facultad}
            {...memberProps}
          />
        ))}

        {jerarquia.externos.length > 0 && (
          <GrupoColapsable
            icon={<UserCircle className="text-muted-foreground h-4 w-4" />}
            titulo="Expertos externos"
            count={jerarquia.externos.length}
          >
            <div className="space-y-1 pl-6">
              {jerarquia.externos.map((miembro) => (
                <MiembroRow
                  key={miembro.asignacion.id}
                  usuario={miembro.usuario}
                  roleLabel={getRoleName(miembro.asignacion)}
                  {...memberProps}
                />
              ))}
            </div>
          </GrupoColapsable>
        )}
      </div>

      <DetallePanel usuario={selectedUsuario} />
    </div>
  )
}

type MemberSharedProps = {
  selectedUserId: string | null
  onSelect: (id: string) => void
  canManageUsers: boolean
  canManageRoles: boolean
  canManageResponsables: boolean
  onAssignRole: (usuario: Usuario) => void
  onReasignar: (usuario: Usuario) => void
  onGestionarMaterias: (usuario: Usuario) => void
}

function GrupoColapsable({
  icon,
  titulo,
  count,
  defaultOpen,
  children,
}: {
  icon: React.ReactNode
  titulo: React.ReactNode
  count: number
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  return (
    <Collapsible defaultOpen={defaultOpen} className="rounded-lg border">
      <CollapsibleTrigger className="group hover:bg-muted/50 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left">
        <ChevronRight className="text-muted-foreground h-4 w-4 shrink-0 transition-transform group-data-[state=open]:rotate-90" />
        {icon}
        <span className="text-foreground truncate text-sm font-medium">
          {titulo}
        </span>
        <Badge variant="secondary" className="ml-auto rounded-full">
          {count}
        </Badge>
      </CollapsibleTrigger>
      <CollapsibleContent className="px-2 pb-2">{children}</CollapsibleContent>
    </Collapsible>
  )
}

function FacultadTree({
  facultad,
  ...shared
}: { facultad: FacultadNodo } & MemberSharedProps) {
  const total =
    facultad.miembros.length +
    facultad.carreras.reduce((sum, c) => sum + c.miembros.length, 0)

  return (
    <GrupoColapsable
      defaultOpen
      icon={
        <FacultadIconPill
          facultad={{ color: facultad.color, icono: facultad.icono }}
        />
      }
      titulo={facultad.prefijo ?? facultad.nombre}
      count={total}
    >
      <div className="space-y-1 pl-6">
        {facultad.miembros.map((miembro) => (
          <MiembroRow
            key={miembro.asignacion.id}
            usuario={miembro.usuario}
            roleLabel={getRoleName(miembro.asignacion)}
            {...shared}
          />
        ))}
        {facultad.carreras.map((carrera) => (
          <CarreraTree key={carrera.id} carrera={carrera} {...shared} />
        ))}
      </div>
    </GrupoColapsable>
  )
}

function CarreraTree({
  carrera,
  ...shared
}: { carrera: CarreraNodo } & MemberSharedProps) {
  return (
    <Collapsible defaultOpen className="rounded-md">
      <CollapsibleTrigger className="group hover:bg-muted/50 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left">
        <ChevronRight className="text-muted-foreground h-3.5 w-3.5 shrink-0 transition-transform group-data-[state=open]:rotate-90" />
        <GraduationCap className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
        <span className="text-foreground truncate text-sm">
          {carrera.nivel} en {carrera.nombre}
        </span>
        <Badge variant="outline" className="ml-auto rounded-full">
          {carrera.miembros.length + carrera.profesores.length}
        </Badge>
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-1 py-1 pl-6">
        {carrera.miembros.map((miembro) => (
          <MiembroRow
            key={miembro.asignacion.id}
            usuario={miembro.usuario}
            roleLabel={getRoleName(miembro.asignacion)}
            {...shared}
          />
        ))}
        {carrera.profesores.map((profesor) => (
          <MiembroRow
            key={`prof-${profesor.usuario.id}`}
            usuario={profesor.usuario}
            roleLabel={`Profesor · ${profesor.materias} ${
              profesor.materias === 1 ? 'materia' : 'materias'
            }`}
            {...shared}
          />
        ))}
      </CollapsibleContent>
    </Collapsible>
  )
}

function MiembroRow({
  usuario,
  roleLabel,
  selectedUserId,
  onSelect,
  canManageUsers,
  canManageRoles,
  canManageResponsables,
  onAssignRole,
  onReasignar,
  onGestionarMaterias,
}: {
  usuario: Usuario
  roleLabel: React.ReactNode
} & MemberSharedProps) {
  const selected = usuario.id === selectedUserId

  return (
    <div
      className={cn(
        'group/row flex items-center gap-2 rounded-md px-2 py-1.5',
        selected ? 'bg-primary/10' : 'hover:bg-muted/50',
        usuario.dado_de_baja_en && 'opacity-60',
      )}
    >
      <button
        type="button"
        onClick={() => onSelect(usuario.id)}
        className="flex min-w-0 flex-1 items-center gap-2 text-left"
      >
        <div className="min-w-0">
          <p className="text-foreground truncate text-sm font-medium">
            {usuario.nombre_completo ?? 'Sin nombre'}
          </p>
          <p className="text-muted-foreground truncate text-xs">
            {usuario.email ?? 'Sin correo'}
          </p>
        </div>
      </button>
      <Badge variant="secondary" className="hidden shrink-0 sm:inline-flex">
        <ShieldCheck className="h-3 w-3" />
        <span className="truncate">{roleLabel}</span>
      </Badge>
      {usuario.dado_de_baja_en && (
        <Badge variant="destructive" className="shrink-0">
          Inactivo
        </Badge>
      )}
      <UsuarioAccionesMenu
        usuario={usuario}
        canManageUsers={canManageUsers}
        canManageRoles={canManageRoles}
        canManageResponsables={canManageResponsables}
        onAssignRole={onAssignRole}
        onReasignar={onReasignar}
        onGestionarMaterias={onGestionarMaterias}
      />
    </div>
  )
}

const ROL_RESPONSABLE_LABEL: Partial<Record<string, string>> = {
  PROFESOR_RESPONSABLE: 'Responsable',
  COAUTOR: 'Coautor',
  REVISOR: 'Revisor',
}

function SeccionRelacion({
  icon,
  titulo,
  loading,
  isEmpty,
  emptyText,
  children,
}: {
  icon: React.ReactNode
  titulo: string
  loading: boolean
  isEmpty: boolean
  emptyText: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <p className="text-foreground flex items-center gap-1.5 text-sm font-medium">
        {icon}
        {titulo}
      </p>
      {loading ? (
        <div className="text-muted-foreground flex items-center gap-2 text-xs">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Cargando…
        </div>
      ) : isEmpty ? (
        <p className="text-muted-foreground text-xs">{emptyText}</p>
      ) : (
        <div className="space-y-1">{children}</div>
      )}
    </div>
  )
}

function DetallePanel({ usuario }: { usuario: Usuario | null }) {
  const { data: relaciones, isLoading: relacionesLoading } =
    useUsuarioRelaciones(usuario?.id ?? null)

  if (!usuario) {
    return (
      <div className="text-muted-foreground hidden h-full flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-6 text-center text-sm xl:flex">
        <UserCircle className="h-10 w-10" />
        <p>Selecciona un usuario del árbol para ver su detalle.</p>
      </div>
    )
  }

  const roles = getUsuarioRoles(usuario)
  const planes = Array.isArray(relaciones?.planes) ? relaciones.planes : []
  const materias = Array.isArray(relaciones?.materias)
    ? relaciones.materias
    : []
  const invitados = Array.isArray(relaciones?.invitados)
    ? relaciones.invitados
    : []

  return (
    <div className="bg-card space-y-4 rounded-lg border p-4">
      <div>
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-foreground text-base font-semibold">
            {usuario.nombre_completo ?? 'Sin nombre'}
          </h3>
          <Badge variant={usuario.externo ? 'outline' : 'secondary'}>
            {usuario.externo ? 'Externo' : 'Interno'}
          </Badge>
        </div>
        <p className="text-muted-foreground mt-1 flex items-center gap-1.5 text-sm">
          <Mail className="h-3.5 w-3.5" />
          {usuario.email ?? 'Sin correo'}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {usuario.dado_de_baja_en ? (
          <Badge variant="destructive">Inactivo</Badge>
        ) : (
          <Badge className="bg-green-600 hover:bg-green-700">Activo</Badge>
        )}
        <span className="text-muted-foreground flex items-center gap-1 text-xs">
          <Clock className="h-3 w-3" />
          Registro: {formatDate(usuario.creado_en)}
        </span>
      </div>

      <div className="space-y-2">
        <p className="text-foreground flex items-center gap-1.5 text-sm font-medium">
          <Building2 className="h-4 w-4" />
          Roles y alcances
        </p>
        {roles.length === 0 ? (
          <p className="text-muted-foreground text-sm">Sin rol asignado.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {roles.map((asignacion) => (
              <Badge
                key={asignacion.id}
                variant="secondary"
                className="rounded-md"
              >
                <ShieldCheck className="h-3 w-3" />
                <span className="truncate">{getRoleName(asignacion)}</span>
                <span className="text-muted-foreground">
                  {getScopeLabel(asignacion)}
                </span>
              </Badge>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-3 border-t pt-3">
        <SeccionRelacion
          icon={<FileText className="h-4 w-4" />}
          titulo="Planes en los que participa"
          loading={relacionesLoading}
          isEmpty={planes.length === 0}
          emptyText="Sin tareas de revisión asignadas."
        >
          {planes.map((plan) => (
            <div
              key={plan.plan_estudio_id}
              className="rounded-md border px-2.5 py-1.5"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-foreground truncate text-sm">
                  {plan.plan_nombre ?? 'Plan sin nombre'}
                </span>
                <Badge
                  variant={plan.origen === 'dueño' ? 'default' : 'outline'}
                  className="shrink-0 text-[10px]"
                >
                  {plan.origen === 'dueño' ? 'Dueño' : 'En revisión'}
                </Badge>
              </div>
              <p className="text-muted-foreground truncate text-xs">
                {[plan.carrera_nombre, plan.estatus]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            </div>
          ))}
        </SeccionRelacion>

        <SeccionRelacion
          icon={<BookOpen className="h-4 w-4" />}
          titulo="Materias donde es responsable"
          loading={relacionesLoading}
          isEmpty={materias.length === 0}
          emptyText="Sin materias asignadas."
        >
          {materias.map((materia) => (
            <div
              key={materia.responsable_id}
              className="rounded-md border px-2.5 py-1.5"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-foreground truncate text-sm">
                  {materia.asignatura_nombre ?? 'Materia sin nombre'}
                </span>
                <Badge variant="secondary" className="shrink-0 text-[10px]">
                  {ROL_RESPONSABLE_LABEL[materia.rol] ?? materia.rol}
                </Badge>
              </div>
              {materia.plan_nombre && (
                <p className="text-muted-foreground truncate text-xs">
                  {materia.plan_nombre}
                </p>
              )}
            </div>
          ))}
        </SeccionRelacion>

        <SeccionRelacion
          icon={<UserCircle className="h-4 w-4" />}
          titulo="Expertos invitados"
          loading={relacionesLoading}
          isEmpty={invitados.length === 0}
          emptyText="No ha invitado expertos externos."
        >
          {invitados.map((invitado) => (
            <div
              key={invitado.id}
              className="flex items-center justify-between gap-2 rounded-md border px-2.5 py-1.5"
            >
              <span className="text-foreground truncate text-sm">
                {invitado.nombre_completo ?? 'Sin nombre'}
              </span>
              {invitado.dado_de_baja_en ? (
                <Badge variant="destructive" className="shrink-0 text-[10px]">
                  Inactivo
                </Badge>
              ) : (
                <Badge className="shrink-0 bg-green-600 text-[10px] hover:bg-green-700">
                  Activo
                </Badge>
              )}
            </div>
          ))}
        </SeccionRelacion>
      </div>
    </div>
  )
}
