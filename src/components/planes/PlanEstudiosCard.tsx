import { ArrowRight } from 'lucide-react'

import type { LucideProps } from 'lucide-react'
import type { ComponentType, CSSProperties } from 'react'

import { Badge } from '@/components/ui/badge'
import { Card, CardFooter, CardHeader } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface PlanEstudiosCardProps {
  Icono: ComponentType<LucideProps>
  nombrePrograma: string
  nivel: string
  ciclos: string | number
  facultad: string
  prefijo?: string
  estado: string
  claseColorEstado?: string
  colorEstadoHex?: string
  colorFacultad: string
  onClick?: () => void
}

export default function PlanEstudiosCard({
  Icono,
  nombrePrograma,
  nivel,
  facultad,
  prefijo,
  estado,
  claseColorEstado = '',
  colorEstadoHex,
  colorFacultad,
  onClick,
}: PlanEstudiosCardProps) {
  const colorFacultadOscuro = `color-mix(in srgb, ${colorFacultad} 84%, #111 10%)`
  const colorFacultadClaro = `color-mix(in srgb, ${colorFacultad} 68%, white 32%)`

  const colorFacultadBorde = `color-mix(in srgb, ${colorFacultad} 42%, transparent)`
  const colorFacultadFondo = `color-mix(in srgb, ${colorFacultad} 14%, transparent)`

  const badgeStyle = colorEstadoHex
    ? ({
        backgroundColor: colorEstadoHex,
        borderColor: colorEstadoHex,
      } as const)
    : undefined

  return (
    <Card
      onClick={onClick}
      className={cn(
        'group relative flex h-full cursor-pointer flex-col justify-between overflow-hidden transition-all hover:shadow-lg',
      )}
    >
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
            {nivel === 'Otro' ? '' : `${nivel} en `}
            {nombrePrograma}
          </h4>
        </CardHeader>

        {/*         <CardContent className="text-muted-foreground text-sm">
          <p className="text-foreground font-medium">{ciclos}</p>
        </CardContent> */}
      </div>

      <CardFooter className="flex items-center justify-between">
        <Badge
          style={badgeStyle}
          className={cn(
            'text-sm font-semibold',
            !colorEstadoHex && claseColorEstado,
          )}
        >
          <span className="text-white [text-shadow:1px_1px_0_#000,-1px_-1px_0_#000,1px_-1px_0_#000,-1px_1px_0_#000,0_1px_0_#000,0_-1px_0_#000,1px_0_0_#000,-1px_0_0_#000]">
            {estado}
          </span>
        </Badge>

        {/* Flecha animada */}
        <div
          className="rounded-full p-1.5 text-(--color-facultad) transition-transform duration-300 group-hover:translate-x-1 dark:text-(--color-facultad-claro)"
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
