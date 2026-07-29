import { ArrowRight, CalendarRange, GraduationCap, Loader2 } from 'lucide-react'

import type { LucideProps } from 'lucide-react'
import type { ComponentType, CSSProperties } from 'react'

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

interface PlanEstudiosCardProps {
  Icono: ComponentType<LucideProps>
  nombrePrograma: string
  ciclos: string | number
  facultad: string
  prefijo?: string
  /**
   * Sólo tiene sentido en planes no curriculares: en uno curricular el nombre
   * del plan **es** el de la carrera, así que repetirlo no aporta nada.
   */
  carrera?: string
  nivel?: string
  estado: string
  colorEstadoHex?: string
  colorFacultad: string
  disabled?: boolean
  interactive?: boolean
}

/**
 * Ficha de resumen de un plan de estudios para la rejilla del catálogo.
 *
 * Es una **sola superficie**: nada de carpetas, lomos ni bandas diagonales. La
 * jerarquía la llevan la tipografía y el espacio, y el color de la facultad se
 * limita al icono y al sello de estado, que es donde significa algo. El alto lo
 * fija el contenido —tres bloques: procedencia, identidad y ficha técnica—, no
 * una proporción decidida de antemano.
 */
export default function PlanEstudiosCard({
  Icono,
  nombrePrograma,
  ciclos,
  facultad,
  prefijo,
  carrera,
  nivel,
  estado,
  colorEstadoHex,
  colorFacultad,
  disabled = false,
  interactive = true,
}: PlanEstudiosCardProps) {
  const isInteractive = interactive && !disabled
  const rotuloFacultad = `Facultad${prefijo ? ` ${prefijo} de` : ' de'}`

  // El sello de estado se pinta con `.tinta-superficie`: conserva el tono del
  // color del catálogo pero el tema fija su luminosidad, así que el contraste
  // no depende de si el color capturado en la base de datos era claro u oscuro.
  // Ver el comentario de la utilidad en `styles.css`.
  const tintaEstado = colorEstadoHex
    ? ({ '--tinta': colorEstadoHex } as CSSProperties)
    : undefined

  return (
    <article
      className={cn(
        'group border-border/80 dark:border-border/70 bg-card flex h-full w-full flex-col gap-4 rounded-lg border p-5 shadow-xs transition-[background-color,border-color,box-shadow] duration-200 dark:shadow-none',
        disabled
          ? 'cursor-not-allowed opacity-60'
          : isInteractive
            ? 'hover:border-primary/25 dark:hover:border-border cursor-pointer hover:bg-(--tinte-facultad) hover:shadow-md dark:hover:shadow-none'
            : 'cursor-default',
      )}
      style={
        {
          // Un velo del color de la facultad al pasar el ratón, en vez de una
          // sombra: mantiene la superficie plana y sigue señalando el foco.
          '--tinte-facultad': `color-mix(in srgb, ${colorFacultad} 5%, transparent)`,
        } as CSSProperties
      }
    >
      {/* Procedencia. Escrito, el nombre de la facultad se recortaba —«Facultad
          de Humanid…»— y competía con el del plan, que es lo que la tarjeta
          responde. El icono ya la identifica y el globo la dice entera, con su
          icono al lado: donde aparece el nombre de una facultad aparece
          también su icono. */}
      <div className="flex items-start justify-between gap-3">
        <Tooltip>
          <TooltipTrigger asChild>
            {/* El globo es la ayuda visual; el nombre completo va además en
                `aria-label`, para que no dependa del hover. */}
            <span
              role="img"
              aria-label={`${rotuloFacultad} ${facultad}`}
              className="inline-flex shrink-0"
            >
              <Icono size={18} style={{ color: colorFacultad }} aria-hidden />
            </span>
          </TooltipTrigger>
          <TooltipContent className="flex items-center gap-2">
            <Icono size={14} style={{ color: colorFacultad }} aria-hidden />
            {rotuloFacultad} {facultad}
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <span
              className={cn(
                'shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold tracking-[0.06em] uppercase',
                colorEstadoHex
                  ? 'tinta-superficie'
                  : // Sin color de catálogo, el sello se apoya en los tokens
                    // en vez de improvisar un gris.
                    'bg-secondary text-secondary-foreground',
              )}
              style={tintaEstado}
            >
              {estado}
            </span>
          </TooltipTrigger>
          <TooltipContent>Estado del plan: {estado}</TooltipContent>
        </Tooltip>
      </div>

      {/* Identidad */}
      <div className="min-w-0">
        <h3 className="font-display text-foreground line-clamp-3 text-lg leading-snug font-bold tracking-tight text-balance">
          {nombrePrograma}
        </h3>
        {carrera && (
          <p className="text-muted-foreground mt-1.5 line-clamp-2 text-xs">
            {carrera}
          </p>
        )}
      </div>

      {/* Ficha técnica. `mt-auto` la deja al pie aunque el título ocupe una
          línea o tres, para que el renglón de tarjetas lea en horizontal. */}
      <div className="border-border/60 text-muted-foreground mt-auto flex items-center gap-4 border-t pt-3 text-xs">
        {nivel && (
          <span className="flex min-w-0 items-center gap-1.5">
            <GraduationCap className="size-3.5 shrink-0" aria-hidden />
            <span className="truncate">{nivel}</span>
          </span>
        )}
        <span className="flex shrink-0 items-center gap-1.5">
          <CalendarRange className="size-3.5" aria-hidden />
          {ciclos}
        </span>
        <span className="ml-auto flex shrink-0 items-center">
          {disabled ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <ArrowRight
              className={cn(
                'size-4 transition-transform duration-200',
                isInteractive && 'group-hover:translate-x-0.5',
              )}
              style={{ color: colorFacultad }}
              aria-hidden
            />
          )}
        </span>
      </div>
    </article>
  )
}
