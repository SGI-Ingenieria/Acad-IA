import { Brain } from 'lucide-react'

import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

export type ReasoningEffortOption = 'auto' | 'none' | 'low' | 'medium' | 'high'

/**
 * «Bajo», «Medio» y «Alto» describen un parámetro del modelo, no una decisión
 * que el usuario pueda tomar: nada en esas etiquetas dice qué se gana ni qué se
 * paga por subir un escalón. Cada opción lleva ahora el nombre de lo que hace,
 * una frase de lo que implica y una señal explícita de espera y consumo, porque
 * es el único eje real de la elección: más razonamiento es mejor resultado,
 * más tiempo y más costo.
 */
export const REASONING_EFFORT_OPTIONS: Array<{
  value: ReasoningEffortOption
  label: string
  descripcion: string
  tiempo: string
  /** Peldaños encendidos en el medidor, de 0 a 4. `null` = variable. */
  intensidad: number | null
}> = [
  {
    value: 'auto',
    label: 'Automático',
    descripcion: 'Ajusta el esfuerzo a lo que pidas.',
    tiempo: 'Tiempo y costo variables',
    intensidad: null,
  },
  {
    value: 'none',
    label: 'Inmediato',
    descripcion: 'Responde sin deliberar.',
    tiempo: 'Segundos · costo mínimo',
    intensidad: 0,
  },
  {
    value: 'low',
    label: 'Breve',
    descripcion: 'Piensa lo justo antes de responder.',
    tiempo: 'Menos de un minuto · costo bajo',
    intensidad: 1,
  },
  {
    value: 'medium',
    label: 'Cuidadoso',
    descripcion: 'Contrasta alternativas antes de decidir.',
    tiempo: 'Un par de minutos · costo medio',
    intensidad: 2,
  },
  {
    value: 'high',
    label: 'Exhaustivo',
    descripcion: 'Revisa a fondo y justifica cada elección.',
    tiempo: 'Varios minutos · costo alto',
    intensidad: 4,
  },
]

const PELDANOS = [0, 1, 2, 3]

/**
 * Medidor de esfuerzo. No comunica el estado por color solo: la altura de los
 * peldaños crece con la intensidad, y el texto de tiempo y costo va siempre al
 * lado, así que la señal sobrevive al daltonismo y al lector de pantalla.
 */
function MedidorEsfuerzo({
  intensidad,
  className,
}: {
  intensidad: number | null
  className?: string
}) {
  return (
    <span
      aria-hidden
      className={cn('gap-micro flex h-3.5 items-end', className)}
    >
      {PELDANOS.map((peldano) => (
        <span
          key={peldano}
          className={cn(
            'w-0.75 rounded-full transition-colors',
            intensidad === null
              ? 'bg-muted-foreground/40'
              : peldano < intensidad
                ? 'bg-primary'
                : 'bg-muted-foreground/25',
          )}
          style={{ height: `${5 + peldano * 3}px` }}
        />
      ))}
    </span>
  )
}

function opcionDe(value: ReasoningEffortOption | undefined) {
  return (
    REASONING_EFFORT_OPTIONS.find((option) => option.value === value) ??
    REASONING_EFFORT_OPTIONS[0]
  )
}

function OpcionesRazonamiento() {
  return (
    <SelectContent className="max-w-84">
      {REASONING_EFFORT_OPTIONS.map((option) => (
        <SelectItem key={option.value} value={option.value}>
          <span className="gap-control flex min-w-0 items-center">
            <MedidorEsfuerzo intensidad={option.intensidad} />
            <span className="min-w-0">
              <span className="block font-medium">{option.label}</span>
              <span className="text-muted-foreground block text-xs leading-snug whitespace-normal">
                {option.descripcion} {option.tiempo}.
              </span>
            </span>
          </span>
        </SelectItem>
      ))}
    </SelectContent>
  )
}

export function ReasoningEffortSelect({
  value,
  onChange,
  compact = false,
  disabled = false,
  className,
}: {
  value?: ReasoningEffortOption
  onChange: (value: ReasoningEffortOption) => void
  compact?: boolean
  disabled?: boolean
  className?: string
}) {
  const seleccionada = opcionDe(value)

  if (compact) {
    return (
      <Select
        value={value ?? 'auto'}
        onValueChange={onChange}
        disabled={disabled}
      >
        <SelectTrigger
          aria-label={`Razonamiento: ${seleccionada.label}. ${seleccionada.tiempo}`}
          className={cn(
            'border-border/70 bg-background/70 text-muted-foreground hover:bg-accent hover:text-accent-foreground gap-relacionado px-control h-9 w-auto rounded-full text-[11px] font-semibold shadow-sm',
            className,
          )}
        >
          <MedidorEsfuerzo intensidad={seleccionada.intensidad} />
          <SelectValue placeholder="Automático">
            {seleccionada.label}
          </SelectValue>
        </SelectTrigger>
        <OpcionesRazonamiento />
      </Select>
    )
  }

  return (
    <div className="gap-relacionado grid">
      <Label className="gap-relacionado flex items-center">
        <Brain className="text-muted-foreground h-4 w-4" />
        Razonamiento
      </Label>
      <Select
        value={value ?? 'auto'}
        onValueChange={onChange}
        disabled={disabled}
      >
        <SelectTrigger
          aria-label={`Razonamiento: ${seleccionada.label}. ${seleccionada.tiempo}`}
        >
          <SelectValue placeholder="Automático">
            <span className="gap-control flex min-w-0 items-center">
              <MedidorEsfuerzo intensidad={seleccionada.intensidad} />
              <span className="truncate">{seleccionada.label}</span>
            </span>
          </SelectValue>
        </SelectTrigger>
        <OpcionesRazonamiento />
      </Select>
      <p className="text-muted-foreground text-xs">{seleccionada.tiempo}.</p>
    </div>
  )
}
