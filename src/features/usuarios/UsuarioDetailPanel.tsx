import {
  BookOpen,
  Check,
  History,
  Mail,
  Pencil,
  Power,
  Replace,
  RotateCcw,
  ShieldCheck,
  ShieldPlus,
  X,
} from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useMemo, useRef, useState } from 'react'

import type { Usuario } from '@/data/api/usuarios.api'

import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { ROLES_RESPONSABLE } from '@/data/api/responsables.api'
import {
  useDarDeBajaUsuario,
  useReactivarUsuario,
  useReenviarInvitacion,
  useUpdateUsuarioClave,
} from '@/data/hooks/useUsuarios'
import {
  formatDate,
  getRoleName,
  getScopeFullLabel,
  getScopeLabel,
  getUsuarioRoles,
} from '@/features/usuarios/usuario-ui'
import {
  getScopeStyles,
  getUsuarioStatus,
} from '@/features/usuarios/usuario-visuals'
import { getInitials } from '@/lib/initials'
import { notify } from '@/lib/toast'
import { cn } from '@/lib/utils'

interface UsuarioDetailPanelProps {
  /** Usuario seleccionado (vivo: refleja cambios tras mutaciones). */
  usuario: Usuario | null
  canManageUsers: boolean
  canManageRoles: boolean
  canReasignar: boolean
  canManageResponsables: boolean
  removingRole: boolean
  onClose: () => void
  onAssignRole: (usuario: Usuario) => void
  onReasignar: (usuario: Usuario) => void
  onGestionarMaterias: (usuario: Usuario) => void
  onRemoveRole: (usuarioId: string, asignacionId: string) => void
}

const EXPRESSIVE = [0.16, 1, 0.3, 1] as const

type AuditTone = 'alta' | 'rol' | 'baja'
interface AuditEvent {
  id: string
  date: string
  label: string
  tone: AuditTone
}

const TONE_DOT: Record<AuditTone, string> = {
  alta: 'bg-primary',
  rol: 'bg-chart-4',
  baja: 'bg-destructive',
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-muted-foreground mb-3 text-xs font-bold tracking-wider uppercase">
      {children}
    </h3>
  )
}

/** Campo de solo lectura con estética "dato legal". */
function ReadField({
  label,
  value,
}: {
  label: string
  value: React.ReactNode
}) {
  return (
    <div className="border-border/60 bg-muted/30 rounded-lg border-b px-3 py-2">
      <p className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
        {label}
      </p>
      <p className="text-foreground mt-0.5 truncate text-sm">{value}</p>
    </div>
  )
}

const CLAVE_REGEX = /^(ad|do)\d{6}$/

/** Clave La Salle: solo lectura, con edición inline cuando hay permisos. */
function ClaveField({
  usuarioId,
  clave,
  canEdit,
}: {
  usuarioId: string
  clave: string | null
  canEdit: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(clave ?? '')
  const inputRef = useRef<HTMLInputElement>(null)
  const updateClave = useUpdateUsuarioClave()

  useEffect(() => {
    setValue(clave ?? '')
    setEditing(false)
  }, [clave, usuarioId])

  useEffect(() => {
    if (editing) inputRef.current?.focus()
  }, [editing])

  const cancel = () => {
    setValue(clave ?? '')
    setEditing(false)
  }

  const save = async () => {
    const next = value.trim().toLowerCase()
    if (next === (clave ?? '')) {
      setEditing(false)
      return
    }
    if (!CLAVE_REGEX.test(next)) {
      notify.error(
        'Formato de clave inválido. Debe ser ad o do seguido de 6 dígitos.',
      )
      return
    }
    try {
      await updateClave.mutateAsync({ id: usuarioId, clave: next })
      notify.success('Clave La Salle actualizada.')
      setEditing(false)
    } catch (err: unknown) {
      notify.error(
        err instanceof Error ? err.message : 'Error al actualizar la clave.',
      )
    }
  }

  if (!canEdit) {
    return <ReadField label="Clave La Salle" value={clave ?? 'Sin clave'} />
  }

  return (
    <div className="border-border/60 bg-muted/30 rounded-lg border-b px-3 py-2">
      <p className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
        Clave La Salle
      </p>
      {editing ? (
        <div className="mt-1 flex items-center gap-1.5">
          <Input
            ref={inputRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                void save()
              }
              if (e.key === 'Escape') cancel()
            }}
            placeholder="ad123456"
            autoCapitalize="none"
            autoComplete="off"
            disabled={updateClave.isPending}
            className="h-8"
          />
          <Button
            size="icon-sm"
            className="shrink-0"
            onClick={() => void save()}
            disabled={updateClave.isPending}
            aria-label="Guardar clave"
          >
            <Check className="size-4" />
          </Button>
          <Button
            size="icon-sm"
            variant="ghost"
            className="shrink-0"
            onClick={cancel}
            disabled={updateClave.isPending}
            aria-label="Cancelar edición"
          >
            <X className="size-4" />
          </Button>
        </div>
      ) : (
        <div className="mt-0.5 flex items-center justify-between gap-2">
          <p className="text-foreground truncate text-sm">
            {clave ?? 'Sin clave'}
          </p>
          <Button
            size="icon-sm"
            variant="ghost"
            className="text-muted-foreground hover:text-foreground -my-1 shrink-0"
            onClick={() => setEditing(true)}
            aria-label="Editar Clave La Salle"
          >
            <Pencil className="size-3.5" />
          </Button>
        </div>
      )}
    </div>
  )
}

export function UsuarioDetailPanel({
  usuario,
  canManageUsers,
  canManageRoles,
  canReasignar,
  canManageResponsables,
  removingRole,
  onClose,
  onAssignRole,
  onReasignar,
  onGestionarMaterias,
  onRemoveRole,
}: UsuarioDetailPanelProps) {
  // Conservamos el último usuario no nulo para poder animar la salida cuando
  // el padre limpia la selección (usuario === null).
  const [snapshot, setSnapshot] = useState<Usuario | null>(usuario)
  useEffect(() => {
    if (usuario) setSnapshot(usuario)
  }, [usuario])

  const open = usuario !== null
  const data = usuario ?? snapshot

  const darDeBaja = useDarDeBajaUsuario()
  const reactivar = useReactivarUsuario()
  const reenviar = useReenviarInvitacion()

  // Cierre con Escape + bloqueo del scroll de fondo mientras está abierto.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [open, onClose])

  const roles = data ? getUsuarioRoles(data) : []
  const materias = data?.materias ?? []
  const status = data ? getUsuarioStatus(data) : null

  const auditEvents = useMemo<Array<AuditEvent>>(() => {
    if (!data) return []
    const events: Array<AuditEvent> = [
      {
        id: 'alta',
        date: data.creado_en,
        label: 'Alta de usuario',
        tone: 'alta',
      },
    ]
    for (const rol of getUsuarioRoles(data)) {
      events.push({
        id: `rol-${rol.id}`,
        date: rol.creado_en,
        label: `Rol asignado · ${getRoleName(rol)} (${getScopeLabel(rol)})`,
        tone: 'rol',
      })
    }
    if (data.dado_de_baja_en) {
      events.push({
        id: 'baja',
        date: data.dado_de_baja_en,
        label: 'Usuario dado de baja',
        tone: 'baja',
      })
    }
    return events.sort((a, b) => (a.date < b.date ? 1 : -1))
  }, [data])

  const handleDarDeBaja = async () => {
    if (!data) return
    if (!data.gestion.puede_dar_baja) {
      notify.error('No tienes permisos para dar de baja usuarios.')
      return
    }
    try {
      await darDeBaja.mutateAsync(data.id)
      notify.success('Usuario dado de baja.')
    } catch (err: unknown) {
      notify.error(err instanceof Error ? err.message : 'Error al dar de baja.')
    }
  }

  const handleReactivar = async () => {
    if (!data) return
    if (!data.gestion.puede_reactivar) {
      notify.error('No tienes permisos para reactivar usuarios.')
      return
    }
    try {
      await reactivar.mutateAsync(data.id)
      notify.success('Usuario reactivado.')
    } catch (err: unknown) {
      notify.error(
        err instanceof Error ? err.message : 'Error al reactivar usuario.',
      )
    }
  }

  const handleReenviar = async () => {
    if (!data) return
    if (!data.gestion.puede_reenviar_invitacion) {
      notify.error('No tienes permisos para reenviar invitaciones.')
      return
    }
    try {
      const result = await reenviar.mutateAsync(data.id)
      notify.success(result.message)
    } catch (err: unknown) {
      notify.error(
        err instanceof Error ? err.message : 'Error al reenviar invitación.',
      )
    }
  }

  // Variantes para el stagger interno de las secciones.
  const sectionMotion = (i: number) => ({
    initial: { opacity: 0, y: 12 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.35, delay: 0.1 + i * 0.05, ease: EXPRESSIVE },
  })

  return (
    <AnimatePresence>
      {open && data && status && (
        <div className="fixed inset-0 z-50">
          {/* Overlay */}
          <motion.button
            type="button"
            aria-label="Cerrar panel"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            onClick={onClose}
            className="absolute inset-0 cursor-default bg-[oklch(0.12_0.03_263/0.45)] backdrop-blur-sm"
          />

          {/* Panel */}
          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-label={`Detalle de ${data.nombre_completo ?? 'usuario'}`}
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ duration: 0.4, ease: EXPRESSIVE }}
            className="bg-popover organic-dialog absolute top-0 right-0 flex h-full w-full flex-col border-l shadow-2xl sm:w-120"
          >
            {/* Header fijo */}
            <div className="relative z-10 shrink-0 border-b p-5">
              <div className="flex items-start gap-4">
                <div className="relative shrink-0">
                  <Avatar
                    className={cn(
                      'size-16',
                      status.key === 'baja' && 'grayscale',
                    )}
                  >
                    <AvatarFallback className="bg-primary/10 text-primary text-xl font-bold">
                      {getInitials(data.nombre_completo)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="ring-popover absolute -right-0.5 -bottom-0.5 flex size-4 items-center justify-center rounded-full ring-2">
                    <span
                      className={cn(
                        'size-2.5 rounded-full',
                        status.dotClass,
                        status.pulse && 'status-pulse',
                      )}
                    />
                  </span>
                </div>

                <div className="min-w-0 flex-1 pt-1">
                  <h2 className="text-foreground font-serif text-xl leading-tight font-bold">
                    {data.nombre_completo ?? 'Sin nombre'}
                  </h2>
                  <p className="text-muted-foreground mt-0.5 truncate text-sm">
                    {data.email ?? 'Sin correo'}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium',
                        status.badgeClass,
                      )}
                    >
                      <span
                        className={cn('size-1.5 rounded-full', status.dotClass)}
                      />
                      {status.label}
                    </span>
                    <Badge variant={data.externo ? 'outline' : 'secondary'}>
                      {data.externo ? 'Externo' : 'Interno'}
                    </Badge>
                  </div>
                </div>

                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={onClose}
                  className="shrink-0"
                >
                  <X className="size-4" />
                  <span className="sr-only">Cerrar</span>
                </Button>
              </div>
            </div>

            <ScrollArea className="relative z-10 flex-1">
              <div className="space-y-6 p-5">
                {/* Identidad */}
                <motion.section {...sectionMotion(0)}>
                  <SectionTitle>Identidad</SectionTitle>
                  <div className="space-y-2">
                    <ReadField
                      label="Correo"
                      value={data.email ?? 'Sin correo'}
                    />
                    <ReadField
                      label="Tipo de cuenta"
                      value={data.externo ? 'Externo' : 'Interno (La Salle)'}
                    />
                    {!data.externo && (
                      <ClaveField
                        usuarioId={data.id}
                        clave={data.clave}
                        canEdit={canManageUsers}
                      />
                    )}
                    <ReadField
                      label="Registro"
                      value={formatDate(data.creado_en)}
                    />
                  </div>
                </motion.section>

                {/* Roles asignados */}
                <motion.section {...sectionMotion(1)}>
                  <div className="mb-3 flex items-center justify-between">
                    <SectionTitle>Roles asignados</SectionTitle>
                    {canManageRoles &&
                      data.gestion.puede_asignar_roles &&
                      !data.dado_de_baja_en && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-primary -mt-2"
                          onClick={() => onAssignRole(data)}
                        >
                          <ShieldPlus className="size-4" />
                          Añadir
                        </Button>
                      )}
                  </div>
                  {roles.length === 0 ? (
                    <p className="text-muted-foreground text-sm">
                      Sin roles asignados.
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {roles.map((asignacion) => (
                        <span
                          key={asignacion.id}
                          className={cn(
                            'inline-flex max-w-full items-center gap-1 rounded-full border py-0.5 pr-1 pl-2 text-xs font-medium',
                            getScopeStyles(asignacion.roles?.alcance_default),
                          )}
                        >
                          <ShieldCheck className="size-3 shrink-0" />
                          <span className="truncate">
                            {getRoleName(asignacion)}
                          </span>
                          {getScopeFullLabel(asignacion) ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="cursor-help opacity-70">
                                  · {getScopeLabel(asignacion)}
                                </span>
                              </TooltipTrigger>
                              <TooltipContent>
                                {getScopeFullLabel(asignacion)}
                              </TooltipContent>
                            </Tooltip>
                          ) : (
                            <span className="opacity-70">
                              · {getScopeLabel(asignacion)}
                            </span>
                          )}
                          {canManageRoles &&
                            data.gestion.puede_asignar_roles && (
                              <button
                                type="button"
                                disabled={removingRole}
                                onClick={() =>
                                  onRemoveRole(data.id, asignacion.id)
                                }
                                className="hover:bg-foreground/10 ml-0.5 inline-flex size-4 items-center justify-center rounded-full transition-colors disabled:opacity-50"
                              >
                                <X className="size-3" />
                                <span className="sr-only">Quitar rol</span>
                              </button>
                            )}
                        </span>
                      ))}
                    </div>
                  )}
                </motion.section>

                {/* Materias asignadas */}
                <motion.section {...sectionMotion(2)}>
                  <div className="mb-3 flex items-center justify-between">
                    <SectionTitle>Materias</SectionTitle>
                    {canManageResponsables &&
                      data.gestion.puede_gestionar_materias &&
                      !data.dado_de_baja_en && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-primary -mt-2"
                          onClick={() => onGestionarMaterias(data)}
                        >
                          <BookOpen className="size-4" />
                          Gestionar
                        </Button>
                      )}
                  </div>
                  {materias.length === 0 ? (
                    <p className="text-muted-foreground text-sm">
                      Sin materias asignadas.
                    </p>
                  ) : (
                    <div className="space-y-1.5">
                      {materias.map((materia) => (
                        <div
                          key={materia.responsable_id}
                          className="border-border/60 bg-muted/20 rounded-lg border px-3 py-2"
                        >
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
                      ))}
                    </div>
                  )}
                </motion.section>

                {/* Auditoría */}
                <motion.section {...sectionMotion(3)}>
                  <SectionTitle>
                    <span className="inline-flex items-center gap-1.5">
                      <History className="size-3.5" />
                      Auditoría
                    </span>
                  </SectionTitle>
                  <ol className="relative space-y-4 pl-5">
                    <span className="bg-border absolute top-1 bottom-1 left-1.25 w-px" />
                    {auditEvents.map((event) => (
                      <li key={event.id} className="relative">
                        <span
                          className={cn(
                            'ring-popover absolute top-0.5 -left-5 size-2.5 rounded-full ring-4',
                            TONE_DOT[event.tone],
                          )}
                        />
                        <p className="text-foreground text-sm leading-snug">
                          {event.label}
                        </p>
                        <p className="text-muted-foreground text-xs">
                          {formatDate(event.date)}
                        </p>
                      </li>
                    ))}
                  </ol>
                </motion.section>
              </div>
            </ScrollArea>

            {/* Footer de acciones */}
            {(canManageRoles || canManageUsers || canReasignar) && (
              <div className="bg-popover/80 relative z-10 flex shrink-0 flex-wrap items-center gap-2 border-t p-4">
                {canReasignar &&
                  data.gestion.puede_reasignar &&
                  !data.dado_de_baja_en && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onReasignar(data)}
                    >
                      <Replace className="size-4" />
                      Reasignar
                    </Button>
                  )}
                {canManageUsers &&
                  data.gestion.puede_reenviar_invitacion &&
                  data.externo &&
                  !data.dado_de_baja_en && (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={reenviar.isPending}
                      onClick={handleReenviar}
                    >
                      <Mail className="size-4" />
                      {data.email_confirmed
                        ? 'Restablecer contraseña'
                        : 'Reenviar invitación'}
                    </Button>
                  )}
                {canManageUsers &&
                  (data.dado_de_baja_en ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="ml-auto"
                      disabled={
                        reactivar.isPending || !data.gestion.puede_reactivar
                      }
                      onClick={handleReactivar}
                    >
                      <RotateCcw className="size-4" />
                      Reactivar
                    </Button>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive hover:bg-destructive/10 ml-auto"
                      disabled={
                        darDeBaja.isPending || !data.gestion.puede_dar_baja
                      }
                      onClick={handleDarDeBaja}
                    >
                      <Power className="size-4" />
                      Dar de baja
                    </Button>
                  ))}
              </div>
            )}
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  )
}
