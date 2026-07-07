import { useState } from 'react'

import type { RecursoTipo } from '@/data/api/recursos.api'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { RECURSOS_TIPOS_OPCIONES } from '@/data/api/recursos.api'

export function GenerarRecursosModal({
  open,
  onOpenChange,
  onGenerar,
  isPending,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onGenerar: (tipos: Array<RecursoTipo>) => void
  isPending: boolean
}) {
  const [seleccionados, setSeleccionados] = useState<Set<RecursoTipo>>(
    () => new Set(RECURSOS_TIPOS_OPCIONES.map((o) => o.value)),
  )

  const toggle = (value: RecursoTipo) => {
    setSeleccionados((prev) => {
      const next = new Set(prev)
      if (next.has(value)) next.delete(value)
      else next.add(value)
      return next
    })
  }

  const handleGenerar = () => {
    if (seleccionados.size === 0) return
    onGenerar(Array.from(seleccionados))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Generar recursos</DialogTitle>
          <DialogDescription>
            Selecciona los objetos de aprendizaje que quieres crear para este
            tema. La IA generará contenido estructurado con fuentes, score y
            recomendaciones.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 py-4">
          {RECURSOS_TIPOS_OPCIONES.map((opcion) => (
            <label
              key={opcion.value}
              className="hover:bg-accent flex cursor-pointer items-center gap-3 rounded-md border p-3 transition-colors"
            >
              <Checkbox
                checked={seleccionados.has(opcion.value)}
                onCheckedChange={() => toggle(opcion.value)}
              />
              <span className="text-sm font-medium">{opcion.label}</span>
            </label>
          ))}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleGenerar}
            disabled={seleccionados.size === 0 || isPending}
          >
            {isPending ? 'Generando...' : 'Generar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
