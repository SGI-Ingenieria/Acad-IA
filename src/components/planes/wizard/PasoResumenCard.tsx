import type { UploadedFile } from './PasoDetallesPanel/FileDropZone'
import type { NewPlanWizardState } from '@/features/planes/nuevo/types'

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  PLANES_EXISTENTES,
  ARCHIVOS,
  REPOSITORIOS,
} from '@/features/planes/nuevo/catalogs'
import { useCatalogosPlanes } from '@/data/hooks/usePlans'
import { formatFileSize } from '@/features/planes/utils/format-file-size'

export function PasoResumenCard({ wizard }: { wizard: NewPlanWizardState }) {
  const { data: catalogos } = useCatalogosPlanes()
  const nivelSeleccionado =
    catalogos?.carreras.find((c) => c.id === wizard.datosBasicos.carrera.id)
      ?.nivel ?? ''

  return (
    <Card>
      <CardHeader>
        <CardTitle>Resumen</CardTitle>
        <CardDescription>
          Verifica la información antes de crear.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-2 text-sm">
          {(() => {
            // Precompute common derived values to avoid unnecessary optional chaining warnings
            const archivosRef = wizard.iaConfig?.archivosReferencia ?? []
            const repositoriosRef =
              wizard.iaConfig?.repositoriosReferencia ?? []
            const adjuntos = wizard.iaConfig?.archivosAdjuntos ?? []
            const contenido = (
              <>
                <div>
                  <span className="text-muted-foreground">Nombre: </span>
                  <span className="font-medium">
                    {wizard.datosBasicos.nombrePlan || '—'}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">
                    Facultad/Carrera:{' '}
                  </span>
                  <span className="font-medium">
                    {wizard.datosBasicos.facultad.nombre || '—'} /{' '}
                    {wizard.datosBasicos.carrera.nombre || '—'}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Nivel: </span>
                  <span className="font-medium">
                    {nivelSeleccionado || '—'}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Ciclos: </span>
                  <span className="font-medium">
                    {wizard.datosBasicos.numCiclos} (
                    {wizard.datosBasicos.tipoCiclo})
                  </span>
                </div>
                <div className="mt-2">
                  <span className="text-muted-foreground">Modo: </span>
                  <span className="font-medium">
                    {wizard.tipoOrigen === 'MANUAL' && 'Manual'}
                    {wizard.tipoOrigen === 'IA' && 'Generado con IA'}
                    {wizard.tipoOrigen === 'CLONADO_INTERNO' &&
                      'Clonado desde plan del sistema'}
                    {wizard.tipoOrigen === 'CLONADO_TRADICIONAL' &&
                      'Importado desde documentos tradicionales'}
                  </span>
                </div>
                {wizard.tipoOrigen === 'CLONADO_INTERNO' && (
                  <div className="mt-2">
                    <span className="text-muted-foreground">Plan origen: </span>
                    <span className="font-medium">
                      {(() => {
                        const p = PLANES_EXISTENTES.find(
                          (x) => x.id === wizard.clonInterno?.planOrigenId,
                        )
                        return (
                          p?.nombre || wizard.clonInterno?.planOrigenId || '—'
                        )
                      })()}
                    </span>
                  </div>
                )}
                {wizard.tipoOrigen === 'CLONADO_TRADICIONAL' && (
                  <div className="mt-2">
                    <div className="font-medium">Documento adjunto</div>
                    <div className="text-muted-foreground text-xs">
                      {wizard.clonTradicional?.archivoPlanId?.file.name || '—'}
                    </div>
                  </div>
                )}
                {wizard.tipoOrigen === 'IA' && (
                  <div className="bg-muted/50 mt-2 rounded-md p-3">
                    <div>
                      <span className="text-muted-foreground">Enfoque: </span>
                      <span className="font-medium">
                        {wizard.iaConfig?.descripcionEnfoqueAcademico || '—'}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Notas: </span>
                      <span className="font-medium">
                        {wizard.iaConfig?.instruccionesAdicionalesIA || '—'}
                      </span>
                    </div>
                    {archivosRef.length > 0 && (
                      <div className="mt-2">
                        <div className="font-medium">Archivos existentes</div>
                        <ul className="text-muted-foreground list-disc pl-5 text-xs">
                          {archivosRef.map((id) => {
                            const a = ARCHIVOS.find((x) => x.id === id)
                            return (
                              <li key={id}>
                                <span className="text-foreground">
                                  {a?.nombre || id}
                                </span>{' '}
                                {a?.tamaño ? <span>· {a.tamaño}</span> : null}
                              </li>
                            )
                          })}
                        </ul>
                      </div>
                    )}
                    {repositoriosRef.length > 0 && (
                      <div className="mt-2">
                        <div className="font-medium">Repositorios</div>
                        <ul className="text-muted-foreground list-disc pl-5 text-xs">
                          {repositoriosRef.map((id) => {
                            const r = REPOSITORIOS.find((x) => x.id === id)
                            return (
                              <li key={id}>
                                <span className="text-foreground">
                                  {r?.nombre || id}
                                </span>{' '}
                                {r?.cantidadArchivos ? (
                                  <span>· {r.cantidadArchivos} archivos</span>
                                ) : null}
                              </li>
                            )
                          })}
                        </ul>
                      </div>
                    )}
                    {adjuntos.length > 0 && (
                      <div className="mt-2">
                        <div className="font-medium">Adjuntos</div>
                        <ul className="text-muted-foreground list-disc pl-5 text-xs">
                          {adjuntos.map((f: UploadedFile) => (
                            <li key={f.id}>
                              <span className="text-foreground">
                                {f.file.name}
                              </span>{' '}
                              <span>· {formatFileSize(f.file.size)}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
                {wizard.resumen.previewPlan && (
                  <div className="bg-muted mt-2 rounded-md p-3">
                    <div className="font-medium">Preview IA</div>
                    <div className="text-muted-foreground">
                      Asignaturas aprox.:{' '}
                      {wizard.resumen.previewPlan.numAsignaturasAprox}
                    </div>
                  </div>
                )}
              </>
            )
            return contenido
          })()}
        </div>
      </CardContent>
    </Card>
  )
}
