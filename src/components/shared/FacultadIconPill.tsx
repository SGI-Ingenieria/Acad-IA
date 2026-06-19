import { DynamicIcon } from '@/features/planes/utils/icon-utils'
import { cn } from '@/lib/utils'

/**
 * Pill visual de una facultad: el icono de Lucide de la facultad dentro de un
 * cuadro redondeado tintado con su color. Se usa de forma consistente en todos
 * los selectores de facultad y cabeceras para identificarlas de un vistazo.
 */
export function FacultadIconPill({
  facultad,
}: {
  facultad: { color: string | null; icono: string | null } | undefined | null
}) {
  if (!facultad) return null
  return (
    <span
      className="flex h-5 w-5 shrink-0 items-center justify-center rounded"
      style={{
        backgroundColor: facultad.color ? `${facultad.color}1a` : undefined,
        color: facultad.color ?? undefined,
      }}
    >
      <DynamicIcon
        name={facultad.icono ?? ''}
        className={cn('h-3.5 w-3.5')}
        style={facultad.color ? { color: facultad.color } : undefined}
      />
    </span>
  )
}
