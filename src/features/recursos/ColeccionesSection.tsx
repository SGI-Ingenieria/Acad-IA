import { Download, FileDown, Loader2, Presentation } from 'lucide-react'
import { useMemo, useState } from 'react'

import type { PaqueteTipo } from '@/data/api/paquetes.api'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { RECURSO_TIPO_SINGULAR_LABEL } from '@/data/api/recursos.api'
import {
  puedeExportarComoPptx,
  useExportarContenido,
} from '@/data/hooks/usePaquetes'
import { useAsignaturaRecursos } from '@/data/hooks/useRecursos'
import { TIPO_ICON } from '@/features/recursos/RecursoItem'

export function ColeccionesSection({ asignaturaId }: { asignaturaId: string }) {
  const { data: recursos = [], isLoading } = useAsignaturaRecursos(asignaturaId)
  const exportar = useExportarContenido(asignaturaId)
  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set())

  const recursosConContenido = useMemo(
    () =>
      recursos.filter((r) => {
        const payload = r.contenido_json as Record<string, unknown> | null
        const datos = payload?.[r.tipo]
        return datos != null && typeof datos === 'object'
      }),
    [recursos],
  )

  const ids = useMemo(
    () => recursosConContenido.map((r) => r.id),
    [recursosConContenido],
  )

  const todosSeleccionados =
    ids.length > 0 && ids.every((id) => seleccionados.has(id))

  const toggleTodo = () => {
    setSeleccionados(todosSeleccionados ? new Set() : new Set(ids))
  }

  const toggleUno = (id: string) => {
    setSeleccionados((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const seleccionArray = Array.from(seleccionados)
  const pptxDisponible = puedeExportarComoPptx(
    seleccionArray,
    new Map(recursosConContenido.map((r) => [r.id, { tipo: r.tipo }])),
  )

  const handleExportar = (tipo: PaqueteTipo) => {
    if (seleccionArray.length === 0) return
    exportar.mutate({ tipo, objectIds: seleccionArray })
  }

  if (isLoading) {
    return (
      <p className="text-muted-foreground text-sm">
        Cargando contenidos generados…
      </p>
    )
  }

  if (recursosConContenido.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        Aún no hay contenidos generados para armar una colección.
      </p>
    )
  }

  return (
    <div className="space-y-control min-w-0">
      <div className="gap-relacionado flex flex-wrap items-center justify-between">
        <div className="gap-relacionado flex items-center">
          <Checkbox
            id="coleccion-todo"
            checked={todosSeleccionados}
            onCheckedChange={toggleTodo}
          />
          <Label htmlFor="coleccion-todo" className="text-xs font-normal">
            {todosSeleccionados ? 'Desmarcar todo' : 'Seleccionar todo'}
          </Label>
          <span className="text-muted-foreground text-xs">
            · {seleccionArray.length} seleccionados
          </span>
        </div>
        <div className="gap-relacionado flex items-center">
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleExportar('html_bundle')}
            disabled={seleccionArray.length === 0 || exportar.isPending}
          >
            {exportar.isPending && exportar.variables.tipo === 'html_bundle' ? (
              <Loader2 className="mr-relacionado h-3.5 w-3.5 animate-spin" />
            ) : (
              <FileDown className="mr-relacionado h-3.5 w-3.5" />
            )}
            Web
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleExportar('scorm_1_2')}
            disabled={seleccionArray.length === 0 || exportar.isPending}
          >
            {exportar.isPending && exportar.variables.tipo === 'scorm_1_2' ? (
              <Loader2 className="mr-relacionado h-3.5 w-3.5 animate-spin" />
            ) : (
              <Download className="mr-relacionado h-3.5 w-3.5" />
            )}
            SCORM
          </Button>
          {pptxDisponible && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleExportar('pptx_bundle')}
              disabled={exportar.isPending}
            >
              {exportar.isPending &&
              exportar.variables.tipo === 'pptx_bundle' ? (
                <Loader2 className="mr-relacionado h-3.5 w-3.5 animate-spin" />
              ) : (
                <Presentation className="mr-relacionado h-3.5 w-3.5" />
              )}
              PPTX
            </Button>
          )}
        </div>
      </div>

      <div className="space-y-relacionado pr-micro max-h-[55vh] overflow-y-auto">
        {recursosConContenido.map((recurso) => {
          const Icon = TIPO_ICON[recurso.tipo]
          return (
            <label
              key={recurso.id}
              htmlFor={`coleccion-${recurso.id}`}
              className="hover:bg-accent gap-control px-control py-relacionado flex cursor-pointer items-center rounded-md border transition-colors"
            >
              <Checkbox
                id={`coleccion-${recurso.id}`}
                checked={seleccionados.has(recurso.id)}
                onCheckedChange={() => toggleUno(recurso.id)}
              />
              <Icon className="text-muted-foreground h-4 w-4 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm">{recurso.titulo}</p>
                <p className="text-muted-foreground text-xs">
                  {RECURSO_TIPO_SINGULAR_LABEL[recurso.tipo]}
                </p>
              </div>
            </label>
          )
        })}
      </div>
    </div>
  )
}
