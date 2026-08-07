import { BookOpenText, LoaderCircle } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import type { ImportacionAcademicaDetalle } from '@/data'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

type SubjectPreview = {
  id: string
  codigo: string | null
  nombre: string
  ciclo: number | null
}

function subjectPreview(value: unknown, index: number): SubjectPreview | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const item = value as Record<string, unknown>
  const name = typeof item.nombre === 'string' ? item.nombre.trim() : ''
  if (!name) return null
  return {
    id:
      typeof item.id_externo === 'string' && item.id_externo
        ? item.id_externo
        : `programa-${index}`,
    codigo:
      typeof item.codigo === 'string' && item.codigo.trim()
        ? item.codigo.trim()
        : null,
    nombre: name,
    ciclo: typeof item.numero_ciclo === 'number' ? item.numero_ciclo : null,
  }
}

export function ImportacionProgramasReviewDialog({
  importacion,
  open,
  isApplying,
  onOpenChange,
  onApply,
}: {
  importacion: ImportacionAcademicaDetalle | null
  open: boolean
  isApplying: boolean
  onOpenChange: (open: boolean) => void
  onApply: (idsExternos: Array<string>) => Promise<void>
}) {
  const subjects = useMemo(() => {
    const result =
      importacion?.resultado_normalizado &&
      typeof importacion.resultado_normalizado === 'object' &&
      !Array.isArray(importacion.resultado_normalizado)
        ? (importacion.resultado_normalizado as Record<string, unknown>)
        : {}
    return Array.isArray(result.asignaturas)
      ? result.asignaturas.flatMap((item, index) => {
          const preview = subjectPreview(item, index)
          return preview ? [preview] : []
        })
      : []
  }, [importacion])
  const [selected, setSelected] = useState<Set<string>>(new Set())

  useEffect(() => {
    setSelected(new Set(subjects.map((subject) => subject.id)))
  }, [subjects])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        spacing="flush"
        className="max-h-[min(86vh,720px)] overflow-hidden"
      >
        <DialogHeader className="border-border px-seccion py-seccion border-b">
          <DialogTitle className="gap-relacionado flex items-center">
            <BookOpenText className="text-primary size-5" />
            Revisar programas
          </DialogTitle>
          <span className="text-muted-foreground text-sm">
            {selected.size} de {subjects.length} seleccionados
          </span>
        </DialogHeader>

        <div className="px-seccion py-control min-h-0 overflow-y-auto">
          <ul className="divide-border divide-y">
            {subjects.map((subject) => {
              const checked = selected.has(subject.id)
              return (
                <li
                  key={subject.id}
                  className="gap-control py-control flex items-center"
                >
                  <Checkbox
                    checked={checked}
                    onCheckedChange={(next) =>
                      setSelected((current) => {
                        const updated = new Set(current)
                        if (next) updated.add(subject.id)
                        else updated.delete(subject.id)
                        return updated
                      })
                    }
                    aria-label={`Importar ${subject.nombre}`}
                  />
                  <span className="text-muted-foreground w-20 shrink-0 truncate font-mono text-xs">
                    {subject.codigo ?? '—'}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">
                    {subject.nombre}
                  </span>
                  {subject.ciclo ? (
                    <Badge variant="outline">Ciclo {subject.ciclo}</Badge>
                  ) : null}
                </li>
              )
            })}
          </ul>
        </div>

        <DialogFooter className="border-border px-seccion py-grupo border-t">
          <Button
            onClick={() => void onApply(Array.from(selected))}
            disabled={isApplying || selected.size === 0}
          >
            {isApplying ? <LoaderCircle className="animate-spin" /> : null}
            Importar {selected.size || ''} programa
            {selected.size === 1 ? '' : 's'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
