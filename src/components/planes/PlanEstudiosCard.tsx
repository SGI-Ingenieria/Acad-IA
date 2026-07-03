import { ArrowRight, Loader2 } from 'lucide-react'
import { useRef } from 'react'

import { EstadoBadge } from './EstadoBadge'

import type { LucideProps } from 'lucide-react'
import type { ComponentType, CSSProperties } from 'react'

import { Card, CardFooter, CardHeader } from '@/components/ui/card'
import { getOrganicMotion, gsap } from '@/lib/animations'
import { cn } from '@/lib/utils'

interface PlanEstudiosCardProps {
  Icono: ComponentType<LucideProps>
  nombrePrograma: string
  ciclos: string | number
  facultad: string
  prefijo?: string
  estado: string
  claseColorEstado?: string
  colorEstadoHex?: string
  colorFacultad: string
  onClick?: () => void
  disabled?: boolean
}

export default function PlanEstudiosCard({
  Icono,
  nombrePrograma,
  facultad,
  prefijo,
  estado,
  claseColorEstado = '',
  colorEstadoHex,
  colorFacultad,
  onClick,
  disabled = false,
}: PlanEstudiosCardProps) {
  const auraRef = useRef<HTMLDivElement | null>(null)

  const colorFacultadOscuro = `color-mix(in srgb, ${colorFacultad} 84%, #111 10%)`
  const colorFacultadClaro = `color-mix(in srgb, ${colorFacultad} 68%, white 32%)`

  const colorFacultadBorde = `color-mix(in srgb, ${colorFacultad} 42%, transparent)`
  const colorFacultadFondo = `color-mix(in srgb, ${colorFacultad} 14%, transparent)`
  const colorFacultadAura = `color-mix(in srgb, ${colorFacultad} 30%, transparent)`

  return (
    <Card
      onClick={onClick}
      onMouseEnter={() => {
        if (!auraRef.current || !getOrganicMotion()) return
        gsap.to(auraRef.current, { opacity: 0.45, duration: 0.3 })
      }}
      onMouseLeave={() => {
        if (!auraRef.current || !getOrganicMotion()) return
        gsap.to(auraRef.current, { opacity: 0, duration: 0.3 })
      }}
      style={{ background: 'var(--organic-surface-bg)' }}
      className={cn(
        'organic-surface gradient-border group relative flex h-full flex-col justify-between overflow-hidden rounded-[var(--radius)] border-transparent shadow-sm transition-all duration-300 hover:shadow-xl active:scale-[0.985]',
        disabled
          ? 'cursor-not-allowed opacity-60 hover:translate-y-0 hover:shadow-sm active:scale-100'
          : 'cursor-pointer hover:-translate-y-0.5',
      )}
    >
      <div
        ref={auraRef}
        className="breathing-aura opacity-0 transition-opacity duration-300 group-hover:opacity-[0.35]"
        style={{
          background: `radial-gradient(circle at 24% 40%, ${colorFacultadAura}, transparent 42%), radial-gradient(circle at 78% 58%, var(--organic-glow-cool), transparent 40%)`,
        }}
      />
      {disabled && (
        <Loader2 className="text-muted-foreground absolute top-4 right-4 h-4 w-4 animate-spin" />
      )}
      <div className="flex grow flex-col">
        <CardHeader className="pb-2">
          {/* Grupo integrado de facultad */}
          <div className="mb-3 flex items-center gap-3">
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
              <p className="text-muted-foreground text-[11px] leading-none tracking-wide uppercase">
                Facultad{prefijo ? ` ${prefijo} de` : ' de'}
              </p>
              <p
                className="text-sm leading-tight font-semibold wrap-break-word whitespace-normal text-(--color-facultad) dark:text-(--color-facultad-claro)"
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

          {/* Título del Programa */}
          <h4 className="line-clamp-2 text-lg leading-tight font-bold tracking-tight">
            {nombrePrograma}
          </h4>
        </CardHeader>
      </div>

      <CardFooter className="flex items-center justify-between gap-2">
        <EstadoBadge
          etiqueta={estado}
          colorHex={colorEstadoHex}
          claseColor={claseColorEstado}
        />

        {/* Flecha animada */}
        <div
          className={cn(
            'shrink-0 rounded-full p-1.5 text-(--color-facultad) transition-transform duration-300 dark:text-(--color-facultad-claro)',
            !disabled && 'group-hover:translate-x-1',
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
      </CardFooter>
    </Card>
  )
}
