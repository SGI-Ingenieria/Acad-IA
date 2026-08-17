import { AlertTriangle, File, LoaderCircle } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import type { ImportacionAcademicaDetalle, RolArchivoImportacion } from '@/data'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useCatalogosPlanes } from '@/data/hooks/usePlans'

const ROLES: ReadonlyArray<{
  value: RolArchivoImportacion
  label: string
}> = [
  { value: 'PLAN', label: 'Plan' },
  { value: 'MAPA', label: 'Mapa' },
  { value: 'PROGRAMA', label: 'Programa' },
  { value: 'RESOLUCION', label: 'Resolución' },
  { value: 'OTRO', label: 'Otro' },
]

type JsonObject = Record<string, unknown>

function object(value: unknown): JsonObject {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as JsonObject)
    : {}
}

function array(value: unknown): Array<JsonObject> {
  return Array.isArray(value) ? value.map(object) : []
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function fileName(
  file: ImportacionAcademicaDetalle['importacion_archivos'][number],
) {
  return (
    file.file_versions?.files?.display_name ||
    file.file_versions?.original_filename ||
    'Archivo académico'
  )
}

export function ImportacionExpedienteReviewDialog({
  importacion,
  open,
  pendingAction,
  onOpenChange,
  onReanalyze,
  onApply,
}: {
  importacion: ImportacionAcademicaDetalle | null
  open: boolean
  pendingAction: 'analizar' | 'aplicar' | 'cancelar' | null
  onOpenChange: (open: boolean) => void
  onReanalyze: (
    changes: Array<{
      importacionArchivoId: string
      rol: RolArchivoImportacion
    }>,
  ) => Promise<void>
  onApply: () => Promise<void>
}) {
  const { data: catalogos } = useCatalogosPlanes()
  const [roles, setRoles] = useState<Record<string, RolArchivoImportacion>>({})

  useEffect(() => {
    setRoles(
      Object.fromEntries(
        (importacion?.importacion_archivos ?? []).map((file) => [
          file.id,
          file.rol,
        ]),
      ),
    )
  }, [importacion])

  const result = object(importacion?.resultado_normalizado)
  const plan = object(result.plan)
  const subjects = array(result.asignaturas)
  const issues = array(importacion?.incidencias)
  const structure = catalogos?.estructurasPlan.find(
    (item) => item.id === importacion?.estructura_destino_id,
  )
  const changes = useMemo(
    () =>
      (importacion?.importacion_archivos ?? []).flatMap((file) => {
        const role = roles[file.id]
        return role !== file.rol
          ? [{ importacionArchivoId: file.id, rol: role }]
          : []
      }),
    [importacion, roles],
  )
  const dirty = changes.length > 0
  const confidence = importacion?.confianza_estructura
  const isPending = pendingAction !== null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        spacing="flush"
        className="grid h-[min(88vh,760px)] grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden"
      >
        <DialogHeader className="border-border px-seccion py-seccion border-b">
          <DialogTitle>Revisar expediente</DialogTitle>
          <div className="text-muted-foreground gap-relacionado flex flex-wrap items-center text-sm">
            <span>{structure?.nombre ?? 'Estructura por confirmar'}</span>
            {typeof confidence === 'number' ? (
              <>
                <span aria-hidden>·</span>
                <span>{Math.round(confidence * 100)}% de coincidencia</span>
              </>
            ) : null}
          </div>
        </DialogHeader>

        <div className="space-y-seccion px-seccion py-seccion min-h-0 overflow-y-auto">
          <section>
            <div className="gap-grupo flex items-start justify-between">
              <div className="min-w-0">
                <h3 className="truncate text-lg font-semibold">
                  {text(plan.nombre_display) ?? 'Plan importado'}
                </h3>
                <p className="text-muted-foreground mt-micro text-sm">
                  {[text(plan.etiqueta_version), text(plan.tipo_ciclo)]
                    .filter(Boolean)
                    .join(' · ') || 'Versión por confirmar'}
                </p>
              </div>
              <Badge variant="outline">
                {subjects.length} asignatura{subjects.length === 1 ? '' : 's'}
              </Badge>
            </div>
          </section>

          <section className="border-border pt-seccion border-t">
            <h3 className="mb-control text-sm font-semibold">Archivos</h3>
            <ul className="divide-border divide-y">
              {(importacion?.importacion_archivos ?? []).map((item) => (
                <li
                  key={item.id}
                  className="gap-control py-control flex items-center"
                >
                  <File className="text-muted-foreground size-4 shrink-0" />
                  <span className="min-w-0 flex-1 truncate text-sm">
                    {fileName(item)}
                  </span>
                  <Select
                    value={roles[item.id] ?? item.rol}
                    onValueChange={(value) =>
                      setRoles((current) => ({
                        ...current,
                        [item.id]: value as RolArchivoImportacion,
                      }))
                    }
                    disabled={isPending}
                  >
                    <SelectTrigger
                      className="w-32"
                      aria-label={`Función de ${fileName(item)}`}
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ROLES.map((role) => (
                        <SelectItem key={role.value} value={role.value}>
                          {role.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </li>
              ))}
            </ul>
          </section>

          {subjects.length ? (
            <section className="border-border pt-seccion border-t">
              <h3 className="mb-control text-sm font-semibold">Asignaturas</h3>
              <ul className="divide-border divide-y">
                {subjects.slice(0, 8).map((subject, index) => (
                  <li
                    key={`${text(subject.codigo) ?? 'asignatura'}-${index}`}
                    className="gap-control py-relacionado flex items-center text-sm"
                  >
                    <span className="text-muted-foreground w-20 shrink-0 truncate font-mono text-xs">
                      {text(subject.codigo) ?? '—'}
                    </span>
                    <span className="min-w-0 flex-1 truncate">
                      {text(subject.nombre) ?? 'Asignatura por revisar'}
                    </span>
                    <span className="text-muted-foreground text-xs">
                      {typeof subject.numero_ciclo === 'number'
                        ? `Ciclo ${subject.numero_ciclo}`
                        : 'Sin ciclo'}
                    </span>
                  </li>
                ))}
              </ul>
              {subjects.length > 8 ? (
                <p className="text-muted-foreground mt-control text-xs">
                  +{subjects.length - 8} asignaturas
                </p>
              ) : null}
            </section>
          ) : null}

          {issues.length ? (
            <section className="border-border pt-seccion border-t">
              <h3 className="mb-control gap-relacionado flex items-center text-sm font-semibold">
                <AlertTriangle className="text-warning size-4" />
                Incidencias
              </h3>
              <ul className="space-y-relacionado">
                {issues.map((issue, index) => (
                  <li key={`${text(issue.codigo) ?? 'incidencia'}-${index}`}>
                    <Badge variant="outline">
                      {text(issue.detalle) ??
                        text(issue.codigo)?.replaceAll('_', ' ') ??
                        'Revisión pendiente'}
                    </Badge>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>

        <DialogFooter className="border-border px-seccion py-grupo border-t">
          {dirty ? (
            <Button
              onClick={() => void onReanalyze(changes)}
              disabled={isPending}
            >
              {pendingAction === 'analizar' ? (
                <LoaderCircle className="animate-spin" />
              ) : null}
              Actualizar análisis
            </Button>
          ) : (
            <Button onClick={() => void onApply()} disabled={isPending}>
              {pendingAction === 'aplicar' ? (
                <LoaderCircle className="animate-spin" />
              ) : null}
              Crear antecedente y rediseño
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
