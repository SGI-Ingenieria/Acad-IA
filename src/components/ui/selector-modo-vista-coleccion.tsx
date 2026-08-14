import { LayoutGrid, List } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { ButtonGroup } from '@/components/ui/button-group'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useModoVistaColeccion } from '@/features/preferencias/ModoVistaColeccionContext'
import { cn } from '@/lib/utils'

const modoActivoClass =
  'border-border bg-muted/80 text-muted-foreground hover:bg-muted dark:border-border dark:bg-muted/80 dark:text-muted-foreground dark:hover:bg-muted'

export function SelectorModoVistaColeccion({
  className,
}: {
  className?: string
}) {
  const { modoVistaColeccion, establecerModoVistaColeccion } =
    useModoVistaColeccion()

  return (
    <ButtonGroup
      aria-label="Modo de visualización"
      className={cn('shrink-0', className)}
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Ver como cuadrícula"
            aria-pressed={modoVistaColeccion === 'cuadricula'}
            className={cn(
              modoVistaColeccion === 'cuadricula' && modoActivoClass,
            )}
            onClick={() => establecerModoVistaColeccion('cuadricula')}
          >
            <LayoutGrid className="size-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Ver como cuadrícula</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Ver como lista"
            aria-pressed={modoVistaColeccion === 'lista'}
            className={cn(
              '!border-l-border !border-l',
              modoVistaColeccion === 'lista' && modoActivoClass,
            )}
            onClick={() => establecerModoVistaColeccion('lista')}
          >
            <List className="size-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Ver como lista</TooltipContent>
      </Tooltip>
    </ButtonGroup>
  )
}
