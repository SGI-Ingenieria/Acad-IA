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
}: {
  value?: ReasoningEffortOption
  onChange: (value: ReasoningEffortOption) => void
}) {
  return (
    <div className="grid gap-1.5">
      <Label className="flex items-center gap-2">
        <Brain className="text-muted-foreground h-4 w-4" />
        Razonamiento
      </Label>
      <Select value={value ?? 'auto'} onValueChange={onChange}>
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
