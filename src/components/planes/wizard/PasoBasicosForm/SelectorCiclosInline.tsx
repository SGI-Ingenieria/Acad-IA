import { Check, ChevronDown } from 'lucide-react'
import * as React from 'react'

import type { TipoCiclo } from '@/data/types/domain'

import { InlineNumberEditor } from '@/components/ui/inline-number-editor'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { pluralizarTipoCiclo, requiereSemanasPorCiclo } from '@/lib/ciclo-utils'
import { cn } from '@/lib/utils'

type EditorCiclosActivo = 'cantidad' | 'tipo' | 'semanas' | null

type SelectorCiclosInlineProps = {
  cantidad: number
  tipo: TipoCiclo | ''
  semanasPorCiclo: number | null
  tiposDisponibles: ReadonlyArray<TipoCiclo>
  onCantidadChange: (cantidad: number) => void
  onTipoChange: (tipo: TipoCiclo) => void
  onSemanasChange: (semanas: number) => void
  errorCantidad?: React.ReactNode
  errorSemanas?: React.ReactNode
  className?: string
}

function Segmento({
  activo,
  editor,
  children,
  className,
}: {
  activo: EditorCiclosActivo
  editor?: Exclude<EditorCiclosActivo, null>
  children: React.ReactNode
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center transition-opacity duration-200',
        activo && activo !== editor && 'opacity-20',
        className,
      )}
    >
      {children}
    </span>
  )
}

function EditorTipo({
  cantidad,
  tipo,
  tiposDisponibles,
  activo,
  onActivoChange,
  onChange,
}: {
  cantidad: number
  tipo: TipoCiclo | ''
  tiposDisponibles: ReadonlyArray<TipoCiclo>
  activo: EditorCiclosActivo
  onActivoChange: (activo: EditorCiclosActivo) => void
  onChange: (tipo: TipoCiclo) => void
}) {
  const open = activo === 'tipo'
  const etiquetaVisible = pluralizarTipoCiclo(tipo, cantidad).toLocaleUpperCase(
    'es-MX',
  )

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => onActivoChange(nextOpen ? 'tipo' : null)}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Tipo de ciclo: ${etiquetaVisible}. Cambiar`}
          className={cn(
            'group/tipo border-border/60 hover:border-primary/70 focus-visible:border-primary gap-relacionado px-relacionado inline-flex h-8 items-center border-b-2 py-0 outline-none',
            'focus-visible:ring-primary/25 focus-visible:ring-offset-background focus-visible:ring-2 focus-visible:ring-offset-2',
            open && 'border-primary bg-primary/5',
          )}
        >
          <span className="text-sm leading-none font-semibold tracking-[0.08em]">
            {etiquetaVisible}
          </span>
          <ChevronDown
            className={cn(
              'text-muted-foreground size-3.5 transition-[opacity,transform]',
              open
                ? 'rotate-180 opacity-100'
                : 'opacity-0 group-hover/tipo:opacity-100 group-focus-visible/tipo:opacity-100',
            )}
          />
        </button>
      </PopoverTrigger>
      <PopoverContent align="center" className="p-relacionado w-60">
        <div
          className="gap-micro grid"
          role="listbox"
          aria-label="Tipo de ciclo"
        >
          <p className="text-muted-foreground px-relacionado py-micro text-xs font-medium">
            Tipo de ciclo
          </p>
          {tiposDisponibles.map((opcion) => {
            const seleccionada = opcion === tipo
            return (
              <button
                key={opcion}
                type="button"
                role="option"
                aria-selected={seleccionada}
                onClick={() => {
                  onChange(opcion)
                  onActivoChange(null)
                }}
                className={cn(
                  'organic-interactive px-control flex min-h-10 items-center rounded-md text-left text-sm outline-none',
                  'hover:bg-accent focus-visible:bg-accent focus-visible:ring-ring focus-visible:ring-2',
                  seleccionada && 'bg-primary/5 text-primary',
                )}
              >
                <span className="flex-1">{opcion}</span>
                {seleccionada ? <Check className="size-4" /> : null}
              </button>
            )
          })}
        </div>
      </PopoverContent>
    </Popover>
  )
}

/**
 * Presenta la estructura temporal como una frase y separa la edición en
 * popovers pequeños. El reposo no parece formulario; al abrir un editor, el
 * resto de la frase se atenúa por estado explícito, no por el foco del DOM.
 */
export function SelectorCiclosInline({
  cantidad,
  tipo,
  semanasPorCiclo,
  tiposDisponibles,
  onCantidadChange,
  onTipoChange,
  onSemanasChange,
  errorCantidad,
  errorSemanas,
  className,
}: SelectorCiclosInlineProps) {
  const [activo, setActivo] = React.useState<EditorCiclosActivo>(null)
  const muestraSemanas = requiereSemanasPorCiclo(tipo)
  const semanas = Math.max(1, semanasPorCiclo ?? 1)

  return (
    <div className={cn('gap-relacionado grid justify-items-center', className)}>
      <div className="gap-relacionado flex flex-wrap items-center justify-center">
        <Segmento activo={activo}>
          <span className="text-muted-foreground text-xs font-semibold tracking-[0.16em] uppercase">
            Tiene
          </span>
        </Segmento>
        <Segmento activo={activo} editor="cantidad">
          <InlineNumberEditor
            label="Número de ciclos"
            value={Math.max(1, cantidad)}
            min={1}
            max={99}
            open={activo === 'cantidad'}
            onOpenChange={(open) => setActivo(open ? 'cantidad' : null)}
            onValueChange={onCantidadChange}
          />
        </Segmento>
        <Segmento activo={activo} editor="tipo">
          <EditorTipo
            cantidad={Math.max(1, cantidad)}
            tipo={tipo}
            tiposDisponibles={tiposDisponibles}
            activo={activo}
            onActivoChange={setActivo}
            onChange={onTipoChange}
          />
        </Segmento>
        {muestraSemanas ? (
          <>
            <Segmento activo={activo}>
              <span className="text-muted-foreground text-xs font-semibold tracking-[0.16em] uppercase">
                de
              </span>
            </Segmento>
            <Segmento activo={activo} editor="semanas">
              <InlineNumberEditor
                label="Semanas por ciclo"
                value={semanas}
                min={1}
                max={104}
                open={activo === 'semanas'}
                onOpenChange={(open) => setActivo(open ? 'semanas' : null)}
                onValueChange={onSemanasChange}
              />
            </Segmento>
            <Segmento activo={activo}>
              <span className="text-muted-foreground text-xs font-semibold tracking-[0.16em] uppercase">
                {semanas === 1 ? 'semana por ciclo' : 'semanas por ciclo'}
              </span>
            </Segmento>
          </>
        ) : null}
      </div>
      {errorCantidad}
      {muestraSemanas ? errorSemanas : null}
    </div>
  )
}
