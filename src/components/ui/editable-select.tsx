import { Check, ChevronsUpDown } from 'lucide-react'
import * as React from 'react'

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { cn } from '@/lib/utils'

type EditableSelectProps = {
  value: string
  options: Array<string>
  onSave: (value: string) => void
  editable?: boolean
  placeholder?: string
  ariaLabel?: string
  className?: string
  /**
   * Subrayado en vez de caja: iguala el selector a `EditableNumber underline`
   * cuando ambos forman parte de la misma frase editable y hay que señalar,
   * con la misma marca, qué trozos de la frase se pueden cambiar.
   */
  underline?: boolean
  /** A partir de cuántas opciones se muestra el buscador del comando. */
  searchThreshold?: number
}

/**
 * Selección editable en línea, hermana de `EditableText`/`EditableNumber`.
 *
 * El valor se muestra grande y centrado y ES el disparador: un clic abre un
 * combobox (Popover + Command) para elegir, sin botón de edición aparte. Se usa
 * Popover en vez del `Select` de Radix a propósito, porque el `Select` alinea el
 * menú sobre el ítem activo y "mueve" el selector al abrirse; el combobox se
 * ancla al disparador sin ese salto.
 */
function EditableSelect({
  value,
  options,
  onSave,
  editable = true,
  placeholder = 'Selecciona una opción',
  ariaLabel,
  className,
  underline = false,
  searchThreshold = 8,
}: EditableSelectProps) {
  const [open, setOpen] = React.useState(false)
  const triggerRef = React.useRef<HTMLButtonElement>(null)

  if (!editable) {
    return (
      <div
        className={cn(
          'text-foreground text-center text-lg font-medium',
          !value && 'text-muted-foreground/70 italic',
          className,
        )}
      >
        {value || placeholder}
      </div>
    )
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          ref={triggerRef}
          type="button"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-label={ariaLabel}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
              event.preventDefault()
              setOpen(true)
            }
          }}
          className={cn(
            'group flex w-full items-center justify-center gap-2 text-center transition-all outline-none',
            underline
              ? 'border-border/60 hover:border-primary/60 focus-visible:border-primary rounded-none border-b-2 px-2 py-1'
              : 'rounded-xl px-4 py-3',
            'hover:bg-accent/40 focus-visible:bg-accent/40',
            open &&
              (underline
                ? 'border-primary bg-accent/40'
                : 'bg-accent/40 ring-primary/30 ring-2'),
            className,
          )}
        >
          <span
            className={cn(
              'text-foreground text-lg font-medium',
              !value && 'text-muted-foreground/70 italic',
            )}
          >
            {value || placeholder}
          </span>
          <ChevronsUpDown
            className={cn(
              'text-muted-foreground/60 size-4 shrink-0 transition-opacity',
              open
                ? 'opacity-100'
                : 'opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100',
            )}
          />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="center"
        className="w-[var(--radix-popover-trigger-width)] min-w-52 p-0 shadow-xl"
        onCloseAutoFocus={(event) => {
          // Radix enfoca otra vez el disparador al cerrar. Eso es adecuado en
          // un formulario normal, pero aquí el foco mantiene abierta la
          // etiqueta y atenúa el resto de la frase. La elección ya terminó:
          // evitamos esa restauración y cerramos explícitamente el estado.
          event.preventDefault()
          triggerRef.current?.blur()
        }}
      >
        <Command>
          {options.length > searchThreshold && (
            <CommandInput placeholder="Buscar…" className="h-9" />
          )}
          <CommandList>
            <CommandEmpty>Sin resultados.</CommandEmpty>
            <CommandGroup>
              {options.map((op) => (
                <CommandItem
                  key={op}
                  value={op}
                  onSelect={() => {
                    onSave(op)
                    setOpen(false)
                  }}
                >
                  {op}
                  <Check
                    className={cn(
                      'ml-auto',
                      value === op ? 'opacity-100' : 'opacity-0',
                    )}
                  />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

export { EditableSelect }
export type { EditableSelectProps }
