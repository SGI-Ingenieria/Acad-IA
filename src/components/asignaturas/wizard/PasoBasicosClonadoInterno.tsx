import { useStore } from '@tanstack/react-form'
import { AlertTriangle } from 'lucide-react'

import { PasoBasicosForm } from '@/components/asignaturas/wizard/PasoBasicosForm/PasoBasicosForm'
import { withForm } from '@/components/form'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useSubject } from '@/data'
import { nuevaAsignaturaFormOpts } from '@/features/asignaturas/nueva/schema'

/**
 * Paso "Datos básicos" del flujo CLONADO_INTERNO.
 *
 * Los datos de la fuente ya se copiaron al form en el handler de selección de
 * `PasoFuenteClonadoInterno` (acción explícita, sin useEffect de resiembra);
 * aquí solo se consulta la fuente para los estados de carga/error.
 */
export const PasoBasicosClonadoInterno = withForm({
  ...nuevaAsignaturaFormOpts,
  render: function Render({ form }) {
    const sourceId = useStore(
      form.store,
      (s) => s.values.clonInterno.asignaturaOrigenId,
    )
    const { data: source, isLoading, isError } = useSubject(sourceId)

    if (!sourceId) {
      return (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Datos básicos</CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground text-sm">
            Selecciona una asignatura fuente para continuar.
          </CardContent>
        </Card>
      )
    }

    if (isLoading) {
      return (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Datos básicos</CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground text-sm">
            Cargando información de la asignatura fuente…
          </CardContent>
        </Card>
      )
    }

    if (isError || !source) {
      return (
        <Card className="border-destructive/40">
          <CardHeader>
            <CardTitle className="text-destructive gap-relacionado flex items-center text-base">
              <AlertTriangle className="h-5 w-5" />
              No se pudo cargar la fuente
            </CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground text-sm">
            Intenta seleccionar otra asignatura.
          </CardContent>
        </Card>
      )
    }

    return <PasoBasicosForm form={form} />
  },
})
