import { ArrowRight, Loader2 } from 'lucide-react'
import { useRef } from 'react'

import type { LucideProps } from 'lucide-react'
import type { ComponentType, CSSProperties } from 'react'

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { getOrganicMotion, gsap } from '@/lib/animations'
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
 * Un plan de estudios es un documento, no un registro de una tabla: por eso la
 * tarjeta se compone como una hoja tamaño carta (`aspect-17/22`) dentro de
 * una carpeta —la pestaña superior lleva el color de la facultad y hace de
 * separador visual, igual que en un archivero—. La proporción fija es lo que
 * da la lectura de documento: sin ella la retícula vuelve a parecer una lista
 * de fichas.
 *
 * La hoja es la **única** superficie con borde; todo lo de dentro se separa con
 * filetes y espacio, no con más cajas.
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
  const auraRef = useRef<HTMLDivElement | null>(null)
  const isInteractive = interactive && !disabled

  const colorFacultadOscuro = `color-mix(in srgb, ${colorFacultad} 84%, #111 10%)`
  const colorFacultadClaro = `color-mix(in srgb, ${colorFacultad} 68%, white 32%)`

  const colorFacultadBorde = `color-mix(in srgb, ${colorFacultad} 42%, transparent)`
  const colorFacultadFondo = `color-mix(in srgb, ${colorFacultad} 14%, transparent)`
  const colorFacultadAura = `color-mix(in srgb, ${colorFacultad} 30%, transparent)`

  // El sello y el lomo se pintan con `.tinta-superficie`: conservan el tono del
  // color del catálogo pero el tema fija su luminosidad, así que el contraste
  // ya no depende de si el color capturado en la base de datos era claro u
  // oscuro. Ver el comentario de la utilidad en `styles.css`.
  const tinta = (color: string) => ({ '--tinta': color }) as CSSProperties

  return (
    <article
      className={cn(
        'group relative flex h-full flex-col pt-3.5 transition-transform duration-300',
        disabled
          ? 'cursor-not-allowed opacity-60'
          : isInteractive
            ? 'cursor-pointer hover:-translate-y-1'
            : 'cursor-default',
      )}
    >
      {/* Pestaña de la carpeta. Queda detrás de la hoja: ésta se pinta después
          y tapa la costura inferior. */}
      <span
        aria-hidden
        className="absolute top-0 left-7 h-4 w-2/5 rounded-t-[7px] border border-b-0"
        style={{
          borderColor: colorFacultadBorde,
          backgroundColor: colorFacultadFondo,
        }}
      />

      {/* La hoja. El hover vive aquí y no en el `article`: un elemento
          semántico no interactivo no debe escuchar ratón. La navegación la
          aporta el `Link` que envuelve a la tarjeta desde la lista. */}
      <div
        onMouseEnter={() => {
          if (!auraRef.current || !getOrganicMotion()) return
          gsap.to(auraRef.current, { opacity: 0.4, duration: 0.3 })
        }}
        onMouseLeave={() => {
          if (!auraRef.current || !getOrganicMotion()) return
          gsap.to(auraRef.current, { opacity: 0, duration: 0.3 })
        }}
        className={cn(
          // La proporción se resuelve desde el **alto**: la hoja se queda con
          // el que le deja la ventana y de ahí sale su ancho. Al revés
          // —`w-full` con `aspect`— la altura la dictaba el ancho de la
          // columna y el renglón terminaba desbordando la pantalla.
          'border-border/70 bg-card relative flex aspect-17/22 min-h-0 w-auto flex-1 flex-col overflow-hidden rounded-[5px] border shadow-sm transition-shadow duration-300',
          isInteractive && 'group-hover:shadow-lg',
        )}
      >
        {/* Lomo: la franja por la que se reconoce la facultad al vuelo y, como
            en la costilla de un tomo archivado, dónde va rotulado el nivel
            académico. Sacarlo de la ficha libera el pie y lo vuelve legible en
            diagonal de un vistazo sobre toda la retícula. */}
        <div
          className="tinta-superficie absolute inset-y-0 left-0 flex w-6 items-center justify-center"
          style={tinta(colorFacultad)}
        >
          {nivel && (
            <span className="rotate-180 truncate text-[9px] font-semibold tracking-[0.22em] uppercase [writing-mode:vertical-rl]">
              {nivel}
            </span>
          )}
        </div>

        <div
          ref={auraRef}
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-0"
          style={{
            background: `radial-gradient(circle at 22% 12%, ${colorFacultadAura}, transparent 46%)`,
          }}
        />

        {/* Sello en banda: el estado se lee como el matasellos de un expediente,
            cruzando la esquina de la hoja.

            El recorte lo hace este cuadrado de 160 px, no la hoja: así la parte
            visible de la banda es una cuerda de ~185 px conocida, y el texto se
            dimensiona para caber en ella en un solo renglón. Recortar contra la
            esquina de la hoja dejaba una cuerda mucho más corta y las etiquetas
            largas —«Borrador del jefe de carrera»— salían cortadas. */}
        <span className="pointer-events-none absolute top-0 right-0 z-10 h-40 w-40 overflow-hidden">
          <Tooltip>
            <TooltipTrigger asChild>
              <span
                className={cn(
                  'pointer-events-auto absolute top-11.5 -right-9 w-55 rotate-45 py-1 text-center shadow-sm',
                  // Un filete tenue despega la banda de la hoja: en modo claro
                  // el sello es pálido y sin él se confundiría con el papel.
                  'ring-1 ring-black/5 dark:ring-white/10',
                  colorEstadoHex
                    ? 'tinta-superficie'
                    : // Sin color de catálogo, el sello se apoya en los tokens
                      // en vez de improvisar un gris.
                      'bg-secondary text-secondary-foreground',
                )}
                style={colorEstadoHex ? tinta(colorEstadoHex) : undefined}
              >
                <span className="block truncate px-3 text-[9px] leading-[1.4] font-semibold tracking-[0.08em] uppercase">
                  {estado}
                </span>
              </span>
            </TooltipTrigger>
            {/* Debajo y alineado a la esquina: en `top` el globo se iba muy por
                encima de la hoja, lejos de lo que describe. */}
            <TooltipContent side="bottom" align="end">
              {estado}
            </TooltipContent>
          </Tooltip>
        </span>

        <div className="relative flex h-full flex-col py-6 pr-6 pl-9">
          {/* Membrete */}
          <div className="flex items-center gap-3 pb-4">
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border"
              style={{
                borderColor: colorFacultadBorde,
                backgroundColor: colorFacultadFondo,
              }}
            >
              <Icono size={18} style={{ color: colorFacultad }} />
            </div>
            <div className="min-w-0">
              <p className="text-muted-foreground text-[10px] leading-none tracking-[0.14em] uppercase">
                Facultad{prefijo ? ` ${prefijo} de` : ' de'}
              </p>
              <p
                className="mt-1 text-sm leading-tight font-semibold wrap-break-word text-(--color-facultad) dark:text-(--color-facultad-claro)"
                style={
                  {
                    '--color-facultad': colorFacultadOscuro,
                    '--color-facultad-claro': colorFacultadClaro,
                  } as CSSProperties
                }
              >
                {facultad}
              </p>
            </div>
          </div>

          <div className="border-border/60 border-t" />

          {/* Cuerpo del documento */}
          <div className="pt-6">
            <h4 className="font-display line-clamp-4 text-xl leading-snug font-bold tracking-tight text-balance">
              {nombrePrograma}
            </h4>
            {carrera && (
              <p className="text-muted-foreground mt-2 line-clamp-2 text-xs">
                {carrera}
              </p>
            )}
          </div>

          {/* Ficha técnica, al pie de la hoja como en un documento impreso */}
          <dl className="mt-auto flex items-baseline gap-2 pt-6 text-xs">
            <dt className="text-muted-foreground tracking-wide">Duración</dt>
            <span
              aria-hidden
              className="border-border/50 min-w-0 flex-1 border-b border-dotted"
            />
            <dd className="text-foreground/80 truncate font-medium">
              {ciclos}
            </dd>
          </dl>

          <div className="border-border/60 mt-4 flex items-center justify-end gap-2 border-t pt-4">
            {disabled && (
              <Loader2 className="text-muted-foreground h-4 w-4 animate-spin" />
            )}
            <div
              className={cn(
                'shrink-0 text-(--color-facultad) transition-transform duration-300 dark:text-(--color-facultad-claro)',
                isInteractive && 'group-hover:translate-x-1',
              )}
              style={
                {
                  '--color-facultad': colorFacultadOscuro,
                  '--color-facultad-claro': colorFacultadClaro,
                } as CSSProperties
              }
            >
              <ArrowRight size={20} />
            </div>
          </div>
        </div>
      </div>
    </article>
  )
}
