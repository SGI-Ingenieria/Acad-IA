import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

function scoreVariant(score: number | null | undefined): string {
  if (score === null || score === undefined)
    return 'bg-muted text-muted-foreground'
  if (score >= 80)
    return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
  if (score >= 50)
    return 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
  return 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300'
}

function scoreEmoji(score: number | null | undefined): string {
  if (score === null || score === undefined) return '⚪'
  if (score >= 80) return '🟢'
  if (score >= 50) return '🟡'
  return '🔴'
}

export function ScoreBadge({
  score,
  label,
  className,
}: {
  score: number | null | undefined
  label?: string
  className?: string
}) {
  return (
    <Badge
      variant="outline"
      className={cn(
        'gap-relacionado items-center border-transparent font-semibold',
        scoreVariant(score),
        className,
      )}
    >
      <span>{scoreEmoji(score)}</span>
      <span>
        {label ? `${label}: ` : ''}
        {score ?? 0}/100
      </span>
    </Badge>
  )
}
