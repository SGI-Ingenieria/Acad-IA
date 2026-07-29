import { Check } from 'lucide-react'

import type { LucideIcon } from 'lucide-react'

import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { cn } from '@/lib/utils'

export type WizardMethodOption<TValue extends string> = {
  value: TValue
  title: string
  description: string
  icon: LucideIcon
}

export function WizardMethodPicker<TValue extends string>({
  title,
  description,
  value,
  options,
  onValueChange,
  columns = 3,
  className,
}: {
  title: string
  description: string
  value: TValue | null
  options: ReadonlyArray<WizardMethodOption<TValue>>
  onValueChange: (value: TValue) => void
  columns?: 2 | 3
  className?: string
}) {
  return (
    <section className={cn('w-full space-y-6', className)}>
      <header className="mx-auto max-w-2xl space-y-2 text-center">
        <h2 className="text-2xl font-bold tracking-tight text-balance">
          {title}
        </h2>
        <p className="text-muted-foreground text-sm text-balance">
          {description}
        </p>
      </header>

      <RadioGroup
        value={value ?? ''}
        onValueChange={(next) => onValueChange(next as TValue)}
        aria-label={title}
        className={cn(
          'grid gap-3',
          columns === 3 ? 'md:grid-cols-3' : 'sm:grid-cols-2',
        )}
      >
        {options.map((option) => {
          const Icon = option.icon
          const selected = value === option.value
          const id = `wizard-method-${option.value}`

          return (
            <div key={option.value} className="relative min-w-0">
              <RadioGroupItem
                id={id}
                value={option.value}
                onKeyDown={(event) => {
                  if (
                    selected &&
                    (event.key === 'Enter' || event.key === ' ')
                  ) {
                    event.preventDefault()
                    onValueChange(option.value)
                  }
                }}
                className="peer sr-only"
              />
              <Label
                htmlFor={id}
                onClick={() => {
                  if (selected) onValueChange(option.value)
                }}
                className={cn(
                  'bg-card hover:border-primary/45 hover:bg-accent/35 relative flex min-h-36 cursor-pointer flex-col items-start gap-4 rounded-xl border p-5 shadow-xs transition-[border-color,background-color,box-shadow,transform]',
                  'peer-focus-visible:ring-ring/50 peer-focus-visible:ring-3',
                  selected &&
                    'border-primary bg-primary/5 dark:bg-primary/10 shadow-sm',
                )}
              >
                <span
                  className={cn(
                    'bg-muted text-muted-foreground flex size-10 items-center justify-center rounded-lg border',
                    selected && 'border-primary/30 bg-primary/10 text-primary',
                  )}
                >
                  <Icon className="size-5" aria-hidden />
                </span>

                <span className="min-w-0 space-y-1.5">
                  <span className="text-foreground block font-semibold">
                    {option.title}
                  </span>
                  <span className="text-muted-foreground block text-sm leading-relaxed">
                    {option.description}
                  </span>
                </span>

                {selected ? (
                  <span className="bg-primary text-primary-foreground absolute top-4 right-4 flex size-5 items-center justify-center rounded-full">
                    <Check className="size-3.5" aria-hidden />
                    <span className="sr-only">Seleccionado</span>
                  </span>
                ) : null}
              </Label>
            </div>
          )
        })}
      </RadioGroup>
    </section>
  )
}
