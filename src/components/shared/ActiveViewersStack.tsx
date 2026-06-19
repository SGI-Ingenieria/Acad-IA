import type { PresenceUser } from '@/data/hooks/useRealtimePresence'

import {
  Avatar,
  AvatarFallback,
  AvatarBadge,
  AvatarGroup,
  AvatarGroupCount,
  AvatarImage,
} from '@/components/ui/avatar'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

interface ActiveViewersStackProps {
  users: Array<PresenceUser>
  maxVisible?: number
  size?: 'sm' | 'default'
  /** Si se pasa, el tooltip muestra la asignatura en la que está el usuario */
  showSubjectInfo?: boolean
  className?: string
}

export function ActiveViewersStack({
  users,
  maxVisible = 3,
  size = 'sm',
  showSubjectInfo = true,
  className,
}: ActiveViewersStackProps) {
  if (users.length === 0) return null

  const visible = users.slice(0, maxVisible)
  const remaining = users.length - maxVisible

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <TooltipProvider delayDuration={200}>
        <AvatarGroup>
          {visible.map((user) => (
            <Tooltip key={user.user_id}>
              <TooltipTrigger asChild>
                <Avatar size={size} className="cursor-default">
                  <AvatarImage src={undefined} alt={user.nombre_completo} />
                  <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
                    {user.iniciales}
                  </AvatarFallback>
                  <AvatarBadge className="bg-emerald-500 ring-background" />
                </Avatar>
              </TooltipTrigger>
              <TooltipContent
                side="bottom"
                sideOffset={6}
                className="max-w-xs"
              >
                <div className="space-y-0.5">
                  <p className="font-semibold">{user.nombre_completo}</p>
                  {showSubjectInfo && user.asignatura_activa && (
                    <p className="text-muted-foreground text-xs">
                      {user.asignatura_activa.clave}{' '}
                      {user.asignatura_activa.nombre}
                    </p>
                  )}
                </div>
              </TooltipContent>
            </Tooltip>
          ))}
          {remaining > 0 && (
            <Tooltip>
              <TooltipTrigger asChild>
                <AvatarGroupCount className="bg-muted text-muted-foreground text-xs">
                  +{remaining}
                </AvatarGroupCount>
              </TooltipTrigger>
              <TooltipContent side="bottom" sideOffset={6}>
                <div className="max-w-xs space-y-1">
                  {users.slice(maxVisible).map((u) => (
                    <p key={u.user_id} className="text-sm">
                      {u.nombre_completo}
                      {showSubjectInfo && u.asignatura_activa && (
                        <span className="text-muted-foreground block text-xs">
                          {u.asignatura_activa.clave} {u.asignatura_activa.nombre}
                        </span>
                      )}
                    </p>
                  ))}
                </div>
              </TooltipContent>
            </Tooltip>
          )}
        </AvatarGroup>
      </TooltipProvider>

      <span className="text-muted-foreground hidden text-xs font-medium sm:inline-block">
        {users.length === 1
          ? '1 conectado'
          : `${users.length} conectados`}
      </span>
    </div>
  )
}
