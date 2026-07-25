import { cn } from '@/lib/utils'

/**
 * Hueco de carga del modo agente.
 *
 * Existe aparte del `Skeleton` genérico porque aquél tiene un color fijo
 * (`bg-accent`) que no tiene por qué armonizar con el halo que lo rodea: en la
 * práctica se veía un esqueleto rojizo dentro de un borde verde, que se lee
 * como error y no como espera. Éste se pinta con el mismo degradado del halo
 * —hereda `--agente-c1..--agente-c4` del ancestro `.agente-borde-arcoiris`— y
 * lo barre lateralmente, así que hueco y marco son el mismo color y el
 * movimiento comunica progreso.
 */
export function EsqueletoAgente({
  className,
  ...props
}: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="esqueleto-agente"
      aria-hidden
      className={cn('agente-esqueleto', className)}
      {...props}
    />
  )
}
