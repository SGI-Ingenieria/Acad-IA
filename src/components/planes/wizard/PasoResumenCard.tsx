import { useStore } from '@tanstack/react-form'

import { withForm } from '@/components/form'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { useCatalogosPlanes } from '@/data/hooks/usePlans'
import { nuevoPlanFormOpts } from '@/features/planes/nuevo/schema'
import { formatCarreraNombre, formatFacultadNombre } from '@/lib/facultad-utils'
import { formatMesAnioEs } from '@/lib/plan-curricular'

export const PasoResumenCard = withForm({
  ...nuevoPlanFormOpts,
  render: function Render({ form }) {
    const values = useStore(form.store, (s) => s.values)

    const { data: catalogos } = useCatalogosPlanes()
    const facultadSel = catalogos?.facultades.find(
      (f) => f.id === values.datosBasicos.facultad.id,
    )
    const carreraSel = catalogos?.carreras.find(
      (c) => c.id === values.datosBasicos.carrera.id,
    )
    const facultadLabel = facultadSel
      ? formatFacultadNombre(facultadSel)
      : values.datosBasicos.facultad.nombre || '—'
    const carreraLabel = values.datosBasicos.carrera.nombre
      ? formatCarreraNombre({
          nombre: values.datosBasicos.carrera.nombre,
          nivel: carreraSel?.nivel,
        })
      : '—'

    const archivosRef = values.iaConfig.archivosReferencia
    const coleccionesRef = values.iaConfig.coleccionesReferencia
    const adjuntos = values.iaConfig.archivosAdjuntos
    const totalReferencias =
      archivosRef.length + coleccionesRef.length + adjuntos.length

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
            <div>
              <span className="text-muted-foreground">Nombre: </span>
              <span className="font-medium">
                {values.datosBasicos.nombrePlan || '—'}
              </span>
            </div>
            {values.datosBasicos.fechaInicioImparticion && (
              <div>
                <span className="text-muted-foreground">
                  Inicio de impartición:{' '}
                </span>
                <span className="font-medium">
                  {formatMesAnioEs(values.datosBasicos.fechaInicioImparticion)}
                </span>
              </div>
            )}
            <div>
              <span className="text-muted-foreground">Facultad/Carrera: </span>
              <span className="font-medium">
                {facultadLabel} / {carreraLabel}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">Ciclos: </span>
              <span className="font-medium">
                {values.datosBasicos.numCiclos} ({values.datosBasicos.tipoCiclo}
                )
              </span>
            </div>
            <div className="mt-2">
              <span className="text-muted-foreground">Modo: </span>
              <span className="font-medium">
                {values.tipoOrigen === 'MANUAL' && 'Manual'}
                {values.tipoOrigen === 'IA' && 'Generado con IA'}
                {values.tipoOrigen === 'CLONADO_INTERNO' &&
                  'Clonado desde plan del sistema'}
                {values.tipoOrigen === 'CLONADO_TRADICIONAL' &&
                  'Importado desde documentos tradicionales'}
              </span>
            </div>
            {values.tipoOrigen === 'CLONADO_INTERNO' && (
              <div className="mt-2">
                <span className="text-muted-foreground">Plan origen: </span>
                <span className="font-medium">
                  {values.clonInterno.planOrigenNombre || 'Plan seleccionado'}
                </span>
              </div>
            )}
            {values.tipoOrigen === 'CLONADO_TRADICIONAL' && (
              <div className="mt-2">
                <div className="font-medium">Documento adjunto</div>
                <div className="text-muted-foreground text-xs">
                  {values.clonTradicional.archivoPlanId?.file.name || '—'}
                </div>
              </div>
            )}
            {values.tipoOrigen === 'IA' && (
              <div className="bg-muted/50 mt-2 rounded-md p-3">
                <div>
                  <span className="text-muted-foreground">Solicitud: </span>
                  <span className="font-medium">
                    {values.iaConfig.descripcionEnfoqueAcademico || '—'}
                  </span>
                </div>
                <div className="mt-2">
                  <span className="text-muted-foreground">Referencias:</span>
                  <span className="font-medium">
                    {totalReferencias
                      ? `${totalReferencias} seleccionada${totalReferencias === 1 ? '' : 's'}`
                      : 'Sin referencias'}
                  </span>
                </div>
              </div>
            )}
            {values.tipoOrigen === 'IA' && (
              <div className="bg-muted/50 mt-2 rounded-md p-3">
                <div className="font-medium">Líneas curriculares</div>
                <p className="text-muted-foreground text-sm">
                  La IA las generará automáticamente al crear el plan.
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    )
  },
})
