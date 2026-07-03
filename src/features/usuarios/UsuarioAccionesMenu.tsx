import { BookOpen, MoreHorizontal, Replace, ShieldPlus } from 'lucide-react'

import type { Usuario } from '@/data/api/usuarios.api'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  useDarDeBajaUsuario,
  useReactivarUsuario,
  useReenviarInvitacion,
} from '@/data/hooks/useUsuarios'
import { notify } from '@/lib/toast'

type UsuarioAccionesMenuProps = {
  usuario: Usuario
  canManageUsers: boolean
  canManageRoles: boolean
  canReasignar?: boolean
  canManageResponsables?: boolean
  onAssignRole: (usuario: Usuario) => void
  onReasignar?: (usuario: Usuario) => void
  onGestionarMaterias?: (usuario: Usuario) => void
}

export function UsuarioAccionesMenu({
  usuario,
  canManageUsers,
  canManageRoles,
  canReasignar,
  canManageResponsables,
  onAssignRole,
  onReasignar,
  onGestionarMaterias,
}: UsuarioAccionesMenuProps) {
  const darDeBajaMutation = useDarDeBajaUsuario()
  const reactivarMutation = useReactivarUsuario()
  const reenviarMutation = useReenviarInvitacion()

  const handleDarDeBaja = async () => {
    if (!usuario.gestion.puede_dar_baja) {
      notify.error('No tienes permisos para dar de baja usuarios.')
      return
    }
    try {
      await darDeBajaMutation.mutateAsync(usuario.id)
      notify.success('Usuario dado de baja.')
    } catch (err: unknown) {
      notify.error(err instanceof Error ? err.message : 'Error al dar de baja.')
    }
  }

  const handleReactivar = async () => {
    if (!usuario.gestion.puede_reactivar) {
      notify.error('No tienes permisos para reactivar usuarios.')
      return
    }
    try {
      await reactivarMutation.mutateAsync(usuario.id)
      notify.success('Usuario reactivado.')
    } catch (err: unknown) {
      notify.error(
        err instanceof Error ? err.message : 'Error al reactivar usuario.',
      )
    }
  }

  const handleReenviarInvitacion = async () => {
    if (!usuario.gestion.puede_reenviar_invitacion) {
      notify.error('No tienes permisos para reenviar invitaciones.')
      return
    }
    try {
      const result = await reenviarMutation.mutateAsync(usuario.id)
      notify.success(result.message)
    } catch (err: unknown) {
      notify.error(
        err instanceof Error ? err.message : 'Error al reenviar invitación.',
      )
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          size="icon-sm"
          variant="ghost"
          onClick={(e) => e.stopPropagation()}
        >
          <MoreHorizontal className="h-4 w-4" />
          <span className="sr-only">Acciones</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {canManageRoles && (
          <DropdownMenuItem
            onClick={() => onAssignRole(usuario)}
            disabled={!!usuario.dado_de_baja_en}
          >
            <ShieldPlus className="h-4 w-4" />
            Asignar rol
          </DropdownMenuItem>
        )}
        {canManageResponsables && onGestionarMaterias && (
          <DropdownMenuItem
            onClick={() => onGestionarMaterias(usuario)}
            disabled={!!usuario.dado_de_baja_en}
          >
            <BookOpen className="h-4 w-4" />
            Materias (profesor)
          </DropdownMenuItem>
        )}
        {canReasignar && onReasignar && (
          <DropdownMenuItem
            onClick={() => onReasignar(usuario)}
            disabled={!!usuario.dado_de_baja_en}
          >
            <Replace className="h-4 w-4" />
            Reasignar
          </DropdownMenuItem>
        )}
        {canManageUsers && usuario.gestion.puede_reenviar_invitacion && (
          <DropdownMenuItem
            onClick={handleReenviarInvitacion}
            disabled={reenviarMutation.isPending}
          >
            {usuario.email_confirmed
              ? 'Restablecer contraseña'
              : 'Reenviar invitación'}
          </DropdownMenuItem>
        )}
        {(usuario.gestion.puede_dar_baja ||
          usuario.gestion.puede_reactivar) && (
          <>
            {(canManageRoles ||
              canManageResponsables ||
              canReasignar ||
              usuario.gestion.puede_reenviar_invitacion) && (
              <DropdownMenuSeparator />
            )}
            {usuario.dado_de_baja_en ? (
              <DropdownMenuItem
                onClick={handleReactivar}
                disabled={
                  reactivarMutation.isPending ||
                  !usuario.gestion.puede_reactivar
                }
              >
                Reactivar
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={handleDarDeBaja}
                disabled={
                  darDeBajaMutation.isPending || !usuario.gestion.puede_dar_baja
                }
              >
                Dar de baja
              </DropdownMenuItem>
            )}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
