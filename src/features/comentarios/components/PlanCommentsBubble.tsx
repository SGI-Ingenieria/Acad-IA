import { MessageSquare } from 'lucide-react'

import type { UUID } from '@/data/types/domain'

import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useSession } from '@/data/hooks/useAuth'
import { useComentariosPlan } from '@/data/hooks/useWorkflow'
import {
  countUnread,
  useCommentsRead,
} from '@/features/comentarios/hooks/useCommentsRead'
import { usePlanComments } from '@/features/comentarios/PlanCommentsContext'
import { cn } from '@/lib/utils'

export function PlanCommentsBubble({
  planId,
  asignaturaId,
}: {
  planId: UUID
  asignaturaId?: UUID | null
}) {
  const { isOpen, toggle } = usePlanComments()
  const { data: comentarios } = useComentariosPlan(planId, asignaturaId)
  const { data: session } = useSession()
  const { lastSeen } = useCommentsRead(planId, asignaturaId)
  const unread = countUnread(
    comentarios ?? [],
    lastSeen,
    session?.user.id ?? null,
  )

  if (isOpen) return null

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          size="icon"
          className={cn(
            'fixed right-5 bottom-5 z-40 h-14 w-14 rounded-full shadow-xl',
            'transition-transform hover:scale-105 active:scale-95',
          )}
          onClick={toggle}
          aria-label="Abrir comentarios"
        >
          <MessageSquare className="h-6 w-6" />
          {unread > 0 && (
            <span className="bg-destructive absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-bold text-white">
              {unread > 99 ? '99+' : unread}
            </span>
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="left">Comentarios</TooltipContent>
    </Tooltip>
  )
}
