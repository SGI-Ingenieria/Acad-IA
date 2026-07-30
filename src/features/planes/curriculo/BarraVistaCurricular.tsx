import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

/**
 * Mantiene el mismo eje y la misma altura al alternar entre Bloques y Mapa.
 * El contenido de la izquierda puede cambiar, pero las acciones siempre
 * terminan en el mismo borde derecho.
 */
export function BarraVistaCurricular({
  contexto,
  children,
  className,
}: {
  contexto?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex min-h-9 flex-wrap items-center gap-x-4 gap-y-3',
        className,
      )}
      style={{ viewTransitionName: 'barra-vista-curricular' }}
      data-vista-curricular-toolbar
    >
      {contexto}
      <div className="ml-auto flex min-h-9 flex-wrap items-center gap-2">
        {children}
      </div>
    </div>
  )
}
