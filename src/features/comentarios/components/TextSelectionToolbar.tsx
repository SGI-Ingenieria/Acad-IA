import { MessageSquarePlus } from 'lucide-react'

import type { TextSelectionCapture } from '../hooks/useTextSelection'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export function TextSelectionToolbar({
  selection,
  onComment,
  viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 0,
}: {
  selection: TextSelectionCapture
  onComment: () => void
  viewportWidth?: number
}) {
  const rect = selection.rect
  const width = 160
  let left = rect.left + rect.width / 2 - width / 2
  left = Math.max(12, Math.min(left, viewportWidth - width - 12))
  const top = rect.top - 44

  return (
    <div
      className={cn(
        'bg-popover text-popover-foreground gap-micro z-50 flex items-center',
        'px-relacionado py-micro rounded-lg border shadow-lg',
      )}
      style={{
        position: 'fixed',
        top: Math.max(12, top),
        left,
        width,
      }}
      role="toolbar"
      aria-label="Acciones de selección"
    >
      <Button
        variant="ghost"
        size="sm"
        className="gap-relacionado h-8 w-full justify-start text-xs"
        onClick={onComment}
      >
        <MessageSquarePlus className="h-4 w-4" />
        Comentar
      </Button>
    </div>
  )
}
