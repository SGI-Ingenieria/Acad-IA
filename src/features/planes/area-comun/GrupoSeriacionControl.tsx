import { Loader2 } from 'lucide-react'

import type {
  ContextoAreaComun,
  DistribucionAreaComun,
} from '@/data/types/areaComun'

import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useAccionesAreaComun } from '@/data/hooks/useAreaComun'
import { usePermissions } from '@/data/hooks/usePermissions'

export function GrupoSeriacionControl({
  contexto,
  distribucion,
  grupoClave,
  editable,
}: {
  contexto: ContextoAreaComun | undefined
  distribucion: DistribucionAreaComun | null
  grupoClave: string
  editable: boolean
}) {
  const { guardar } = useAccionesAreaComun()
  const { permissions } = usePermissions()
  const grupo = distribucion?.espacios.find((e) => e.clave === grupoClave)
  if (!grupo || !contexto || !distribucion) return null
  const previo = distribucion.espacios.find(
    (e) => e.clave === grupo.prerrequisito_grupo_clave,
  )
  const puedeEditar =
    editable &&
    permissions.has('area_comun.gestionar') &&
    Boolean(contexto.borrador)
  return (
    <div className="space-y-control">
      <Label htmlFor="seriacion-grupo-electivo">Grupo antecedente</Label>
      {puedeEditar ? (
        <div className="gap-control flex items-center">
          <Select
            value={grupo.prerrequisito_grupo_clave ?? 'ninguno'}
            disabled={guardar.isPending}
            onValueChange={(clave) => {
              guardar.mutate({
                planId: contexto.plan_area_id,
                revision: contexto.revision,
                distribuciones: contexto.borrador!.map((d) =>
                  d.clave !== distribucion.clave
                    ? d
                    : {
                        ...d,
                        espacios: d.espacios.map((e) => {
                          if (e.clave !== grupoClave) return e
                          const {
                            prerrequisito_grupo_clave: _previo,
                            ...base
                          } = e
                          return clave === 'ninguno'
                            ? base
                            : { ...base, prerrequisito_grupo_clave: clave }
                        }),
                      },
                ),
              })
            }}
          >
            <SelectTrigger
              id="seriacion-grupo-electivo"
              aria-label="Grupo antecedente"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ninguno">Sin seriación</SelectItem>
              {distribucion.espacios
                .filter(
                  (e) =>
                    e.opciones &&
                    e.clave !== grupoClave &&
                    e.numero_ciclo < grupo.numero_ciclo,
                )
                .map((e) => (
                  <SelectItem key={e.clave} value={e.clave}>
                    {e.nombre ?? e.clave}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
          {guardar.isPending && (
            <Loader2
              className="size-4 animate-spin"
              aria-label="Guardando seriación"
            />
          )}
        </div>
      ) : (
        <p className="text-sm">
          {previo?.nombre ?? previo?.clave ?? 'Sin seriación'}
        </p>
      )}
      {guardar.isError && (
        <p role="alert" className="text-destructive text-sm">
          {guardar.error.message}
        </p>
      )}
    </div>
  )
}
