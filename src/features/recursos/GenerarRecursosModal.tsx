import { Check, Info, Loader2, Sparkles } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import type { RecursoTipo } from '@/data/api/recursos.api'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { RECURSOS_TIPOS_OPCIONES } from '@/data/api/recursos.api'
import { TIPO_ICON } from '@/features/recursos/RecursoItem'
import { cn } from '@/lib/utils'

const TIPOS_FEMENINOS = new Set<RecursoTipo>([
  'outline_presentacion',
  'actividad',
  'rubrica',
  'recursos_externos',
])

function formatConteo(tipo: RecursoTipo, count: number): string {
  if (tipo === 'recursos_externos') {
    return count === 1 ? '1 encontrada' : `${count} encontradas`
  }
  if (count === 1) {
    return TIPOS_FEMENINOS.has(tipo) ? '1 generada' : '1 generado'
  }
  return TIPOS_FEMENINOS.has(tipo) ? `${count} generadas` : `${count} generados`
}

export function GenerarRecursosModal({
  open,
  onOpenChange,
  onGenerar,
  isPending,
  recursosExistentes = [],
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onGenerar: (tipos: Array<RecursoTipo>) => void
  isPending: boolean
  recursosExistentes?: Array<{ tipo: RecursoTipo }>
}) {
  const [seleccionados, setSeleccionados] = useState<Set<RecursoTipo>>(
    () => new Set(),
  )

  const conteos = useMemo(() => {
    const next = Object.fromEntries(
      RECURSOS_TIPOS_OPCIONES.map((opcion) => [opcion.value, 0]),
    ) as Record<RecursoTipo, number>

    for (const recurso of recursosExistentes) {
      next[recurso.tipo] = next[recurso.tipo] + 1
    }

    return next
  }, [recursosExistentes])

  useEffect(() => {
    if (open) setSeleccionados(new Set())
  }, [open])

  const toggle = (value: RecursoTipo) => {
    setSeleccionados((prev) => {
      const next = new Set(prev)
      if (next.has(value)) {
        next.delete(value)
        if (
          value === 'actividad' &&
          conteos.actividad === 0 &&
          next.has('rubrica')
        ) {
          next.delete('rubrica')
        }
      } else {
        next.add(value)
        if (value === 'rubrica' && conteos.actividad === 0) {
          next.add('actividad')
        }
      }
      return next
    })
  }

  const handleGenerar = () => {
    if (seleccionados.size === 0) return
    const tipos = new Set(seleccionados)
    if (tipos.has('rubrica') && conteos.actividad === 0) {
      tipos.add('actividad')
    }
    onGenerar(Array.from(tipos))
  }

  const totalSeleccionados = seleccionados.size

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <span className="bg-primary/10 text-primary flex size-10 shrink-0 items-center justify-center rounded-xl">
              <Sparkles className="size-5" />
            </span>
            <div className="space-y-1">
              <DialogTitle>Generar contenidos</DialogTitle>
              <DialogDescription>
                Selecciona qué contenidos quieres crear para este tema. Puedes
                generar varias piezas y después editarlas, exportarlas o
                volverlas a generar.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="grid gap-3 py-2 sm:grid-cols-2">
          {RECURSOS_TIPOS_OPCIONES.map((opcion) => {
            const checked = seleccionados.has(opcion.value)
            const rubricaSinActividad =
              opcion.value === 'rubrica' && conteos.actividad === 0
            const conteo = conteos[opcion.value]
            const Icon = TIPO_ICON[opcion.value]

            return (
              <label
                key={opcion.value}
                className={cn(
                  'organic-interactive group relative flex min-h-28 cursor-pointer flex-col gap-3 rounded-xl border p-4',
                  'focus-within:ring-ring/60 focus-within:ring-2 focus-within:ring-offset-0',
                  checked
                    ? 'border-primary bg-primary/5 shadow-xs'
                    : 'border-border bg-card hover:border-primary/40 hover:shadow-sm',
                )}
              >
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={checked}
                  onChange={() => toggle(opcion.value)}
                />

                {/* Indicador de selección */}
                <span
                  aria-hidden
                  className={cn(
                    'absolute top-3 right-3 flex size-5 items-center justify-center rounded-full border transition-colors',
                    checked
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border bg-background group-hover:border-primary/40 text-transparent',
                  )}
                >
                  <Check className="size-3" strokeWidth={3} />
                </span>

                <div className="flex items-center gap-3 pr-7">
                  <span
                    className={cn(
                      'flex size-10 shrink-0 items-center justify-center rounded-lg border transition-colors',
                      checked
                        ? 'border-primary/30 bg-primary/10 text-primary'
                        : 'border-border bg-muted text-muted-foreground',
                    )}
                  >
                    <Icon className="size-5" />
                  </span>
                  <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="text-sm font-medium">{opcion.label}</span>
                    {conteo > 0 && (
                      <span className="bg-muted text-muted-foreground rounded-full px-1.5 py-0.5 text-[11px] leading-none">
                        {formatConteo(opcion.value, conteo)}
                      </span>
                    )}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <p className="text-muted-foreground text-sm">
                    {opcion.description}
                  </p>
                  {opcion.hint && (
                    <p className="text-muted-foreground/80 text-xs">
                      {opcion.hint}
                    </p>
                  )}
                  {rubricaSinActividad && (
                    <p className="text-primary/90 flex items-start gap-1.5 text-xs">
                      <Info className="mt-0.5 size-3.5 shrink-0" />
                      <span>
                        Si no hay actividad, se generará una actividad junto con
                        la rúbrica.
                      </span>
                    </p>
                  )}
                </div>
              </label>
            )
          })}
        </div>

        <DialogFooter className="sm:items-center">
          {totalSeleccionados > 0 && (
            <span className="text-muted-foreground mr-auto text-sm">
              {totalSeleccionados}{' '}
              {totalSeleccionados === 1
                ? 'contenido seleccionado'
                : 'contenidos seleccionados'}
            </span>
          )}
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleGenerar}
            disabled={totalSeleccionados === 0 || isPending}
          >
            {isPending ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Generando…
              </>
            ) : (
              <>
                <Sparkles className="size-4" />
                Generar seleccionados
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
