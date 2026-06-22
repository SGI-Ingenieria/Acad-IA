import { Brain } from 'lucide-react'

import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export type ReasoningEffortOption = 'auto' | 'none' | 'low' | 'medium' | 'high'

const OPTIONS: Array<{ value: ReasoningEffortOption; label: string }> = [
  { value: 'auto', label: 'Auto' },
  { value: 'none', label: 'Ninguno' },
  { value: 'low', label: 'Bajo' },
  { value: 'medium', label: 'Medio' },
  { value: 'high', label: 'Alto' },
]

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
  if (compact) {
    return (
      <Select
        value={value ?? 'auto'}
        onValueChange={onChange}
        disabled={disabled}
      >
        <SelectTrigger
          aria-label="Seleccionar razonamiento"
          className={`border-border/70 bg-background/70 text-muted-foreground hover:bg-accent hover:text-accent-foreground h-9 w-auto gap-1.5 rounded-full px-2.5 text-[11px] font-semibold shadow-sm ${className ?? ''}`}
        >
          <Brain className="h-3.5 w-3.5" />
          <SelectValue placeholder="Auto" />
        </SelectTrigger>
        <SelectContent>
          {OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    )
  }

  return (
    <div className="grid gap-1.5">
      <Label className="flex items-center gap-2">
        <Brain className="text-muted-foreground h-4 w-4" />
        Razonamiento
      </Label>
      <Select
        value={value ?? 'auto'}
        onValueChange={onChange}
        disabled={disabled}
      >
        <SelectTrigger>
          <SelectValue placeholder="Auto" />
        </SelectTrigger>
        <SelectContent>
          {OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
