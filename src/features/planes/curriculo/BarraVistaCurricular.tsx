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
        'gap-x-grupo gap-y-control flex min-h-9 flex-wrap items-center',
        className,
      )}
      style={{ viewTransitionName: 'barra-vista-curricular' }}
      data-vista-curricular-toolbar
    >
      {contexto}
      <div className="gap-relacionado ml-auto flex min-h-9 flex-wrap items-center">
        {children}
      </div>
    </div>
  )
}
