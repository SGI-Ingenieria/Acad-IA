import { BookOpen, Replace, ShieldCheck, ShieldPlus } from 'lucide-react'
import { motion } from 'motion/react'

import type { Usuario, UsuarioRol } from '@/data/api/usuarios.api'

import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  getRoleName,
  getScopeFullLabel,
  getScopeLabel,
  getUsuarioRoles,
} from '@/features/usuarios/usuario-ui'
import {
  getScopeStyles,
  getUsuarioStatus,
} from '@/features/usuarios/usuario-visuals'
import { UsuarioAccionesMenu } from '@/features/usuarios/UsuarioAccionesMenu'
import { getInitials } from '@/lib/initials'
import { cn } from '@/lib/utils'

interface UsuarioRowProps {
  usuario: Usuario
  index: number
  selected: boolean
  canManageUsers: boolean
  canManageRoles: boolean
  canReasignar: boolean
  canManageResponsables: boolean
  canUseActions: boolean
  onOpen: (usuario: Usuario) => void
  onAssignRole: (usuario: Usuario) => void
  onReasignar: (usuario: Usuario) => void
  onGestionarMaterias: (usuario: Usuario) => void
}

/** Curva expresiva (easeOutExpo): rápida al inicio, suave al final. */
const EXPRESSIVE = [0.16, 1, 0.3, 1] as const

function RoleChip({ asignacion }: { asignacion: UsuarioRol }) {
  const scopeFull = getScopeFullLabel(asignacion)
  return (
    <span
      className={cn(
        'gap-micro px-relacionado py-micro inline-flex max-w-full items-center rounded-full border text-xs font-medium',
        getScopeStyles(asignacion.roles?.alcance_default),
      )}
    >
      <ShieldCheck className="size-3 shrink-0" />
      <span className="truncate">{getRoleName(asignacion)}</span>
      {scopeFull ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="cursor-help opacity-70">
              · {getScopeLabel(asignacion)}
            </span>
          </TooltipTrigger>
          <TooltipContent>{scopeFull}</TooltipContent>
        </Tooltip>
      ) : (
        <span className="opacity-70">· {getScopeLabel(asignacion)}</span>
      )}
    </span>
  )
}

export function UsuarioRow({
  usuario,
  index,
  selected,
  canManageUsers,
  canManageRoles,
  canReasignar,
  canManageResponsables,
  canUseActions,
  onOpen,
  onAssignRole,
  onReasignar,
  onGestionarMaterias,
}: UsuarioRowProps) {
  const roles = getUsuarioRoles(usuario)
  const status = getUsuarioStatus(usuario)
  const isBaja = status.key === 'baja'
  const nombre = usuario.nombre_completo ?? 'Sin nombre'

  // Las acciones rápidas no deben abrir el panel de detalle: detenemos la
  // propagación al contenedor (que tiene el onClick de "abrir detalle").
  const action = (fn: () => void) => (e: React.MouseEvent) => {
    e.stopPropagation()
    fn()
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20, scale: 0.985 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.985, transition: { duration: 0.4 } }}
      transition={{
        duration: 0.35,
        delay: Math.min(index, 10) * 0.04,
        ease: EXPRESSIVE,
      }}
      whileHover={{ y: -2 }}
      role="button"
      tabIndex={0}
      aria-label={`Ver detalle de ${nombre}`}
      onClick={() => onOpen(usuario)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onOpen(usuario)
        }
      }}
      className={cn(
        'group/row organic-surface gradient-border relative cursor-pointer rounded-2xl outline-none',
        'focus-visible:ring-ring/60 focus-visible:ring-2',
        selected && 'ring-primary/50 bg-primary/[0.06] ring-2',
        isBaja && 'opacity-60',
      )}
    >
      {/* Halo difuso que se enciende en hover / selección */}
      <span
        className={cn(
          'breathing-aura opacity-0 transition-opacity duration-300 group-hover/row:opacity-100',
          selected && 'opacity-100',
        )}
      />

      <div className="gap-control p-control sm:gap-grupo sm:p-grupo relative flex items-center">
        {/* Avatar + indicador de estado */}
        <div className="relative shrink-0">
          <Avatar size="lg" className={cn(isBaja && 'grayscale')}>
            <AvatarFallback className="bg-primary/10 text-primary text-sm font-bold">
              {getInitials(usuario.nombre_completo)}
            </AvatarFallback>
          </Avatar>
          <span className="ring-card absolute -right-0.5 -bottom-0.5 flex size-3.5 items-center justify-center rounded-full ring-2">
            <span
              className={cn(
                'relative block size-2.5 rounded-full',
                status.dotClass,
                status.pulse && 'status-pulse',
              )}
            />
            {status.pulse && (
              <span className="absolute inline-flex size-2.5 animate-ping rounded-full bg-emerald-500/60" />
            )}
          </span>
        </div>

        {/* Identidad */}
        <div className="min-w-0 flex-1">
          <p className="text-foreground truncate font-bold">{nombre}</p>
          <p className="text-muted-foreground truncate text-sm">
            {usuario.email ?? 'Sin correo'}
          </p>
        </div>

        {/* Roles / alcance (lg+) */}
        <div className="gap-relacionado hidden max-w-[18rem] flex-wrap items-center justify-end lg:flex">
          {roles.length === 0 ? (
            <span className="text-muted-foreground text-xs">Sin rol</span>
          ) : (
            <>
              {roles.slice(0, 2).map((asignacion) => (
                <RoleChip key={asignacion.id} asignacion={asignacion} />
              ))}
              {roles.length > 2 && (
                <span className="text-muted-foreground text-xs font-medium">
                  +{roles.length - 2}
                </span>
              )}
            </>
          )}
        </div>

        {/* Tipo + estado (md+) */}
        <div className="gap-relacionado hidden shrink-0 items-center md:flex">
          <Badge variant={usuario.externo ? 'outline' : 'secondary'}>
            {usuario.externo ? 'Externo' : 'Interno'}
          </Badge>
          <span
            className={cn(
              'gap-relacionado px-relacionado py-micro inline-flex items-center rounded-full border text-xs font-medium',
              status.badgeClass,
            )}
          >
            <span className={cn('size-1.5 rounded-full', status.dotClass)} />
            {status.label}
          </span>
        </div>

        {/* Acciones */}
        <div className="ml-micro gap-micro flex shrink-0 items-center">
          {!isBaja && (
            <div className="gap-micro hidden items-center opacity-0 transition-opacity duration-150 group-focus-within/row:opacity-100 group-hover/row:opacity-100 sm:flex">
              {canReasignar && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={action(() => onAssignRole(usuario))}
                    >
                      <ShieldPlus className="size-4" />
                      <span className="sr-only">Asignar rol</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Asignar rol</TooltipContent>
                </Tooltip>
              )}
              {canManageResponsables && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={action(() => onGestionarMaterias(usuario))}
                    >
                      <BookOpen className="size-4" />
                      <span className="sr-only">Materias</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Materias</TooltipContent>
                </Tooltip>
              )}
              {canManageRoles && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={action(() => onReasignar(usuario))}
                    >
                      <Replace className="size-4" />
                      <span className="sr-only">Reasignar</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Reasignar</TooltipContent>
                </Tooltip>
              )}
            </div>
          )}
          {canUseActions && (
            <UsuarioAccionesMenu
              usuario={usuario}
              canManageUsers={canManageUsers}
              canManageRoles={canManageRoles}
              canReasignar={canReasignar}
              canManageResponsables={canManageResponsables}
              onAssignRole={onAssignRole}
              onReasignar={onReasignar}
              onGestionarMaterias={onGestionarMaterias}
            />
          )}
        </div>
      </div>
    </motion.div>
  )
}
