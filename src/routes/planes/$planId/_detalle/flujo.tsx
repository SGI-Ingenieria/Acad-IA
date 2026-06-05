import { createFileRoute } from '@tanstack/react-router'
import { CheckCircle2, Clock } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { usePlanHistorial } from '@/data/hooks/usePlans'

export const Route = createFileRoute('/planes/$planId/_detalle/flujo')({
  component: RouteComponent,
})

function RouteComponent() {
  const { data: rawData } = usePlanHistorial(
    '0e0aea4d-b8b4-4e75-8279-6224c3ac769f',
    1,
  )
  console.log(rawData)

  return (
    <div className="flex flex-col gap-6">
      {/* Header Informativo (Opcional, si no viene del layout padre) */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold italic">Flujo de Aprobación</h1>
          <p className="text-muted-foreground text-sm">
            Gestiona el proceso de revisión y aprobación del plan
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* LADO IZQUIERDO: Timeline del Flujo */}
        <div className="space-y-4 lg:col-span-2">
          {/* Estado: Completado */}
          <div className="relative flex gap-4 pb-4">
            <div className="flex flex-col items-center">
              <div className="rounded-full bg-green-100 p-1 text-green-600">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <div className="mt-2 w-px flex-1 bg-green-200" />
            </div>
            <Card className="flex-1">
              <CardHeader className="flex flex-row items-center justify-between py-3">
                <div>
                  <CardTitle className="text-lg">Borrador</CardTitle>
                  <p className="text-muted-foreground text-xs">
                    14 de enero de 2024
                  </p>
                </div>
                <Badge
                  variant="secondary"
                  className="bg-green-100 text-green-700"
                >
                  Completado
                </Badge>
              </CardHeader>
              <CardContent className="border-t pt-3 text-sm">
                <p className="text-muted-foreground mb-2 font-semibold">
                  Comentarios
                </p>
                <ul className="text-muted-foreground list-inside list-disc space-y-1">
                  <li>Documento inicial creado</li>
                  <li>Estructura base definida</li>
                </ul>
              </CardContent>
            </Card>
          </div>

          {/* Estado: En Curso (Actual) */}
          <div className="relative flex gap-4 pb-4">
            <div className="flex flex-col items-center">
              <div className="rounded-full bg-blue-100 p-1 text-blue-600 ring-2 ring-blue-500 ring-offset-2">
                <Clock className="h-6 w-6" />
              </div>
              <div className="mt-2 w-px flex-1 bg-slate-200" />
            </div>
            {/* <Card className="flex-1 border-blue-500 bg-blue-50/10">
              <CardHeader className="flex flex-row items-center justify-between py-3">
                <div>
                  <CardTitle className="text-lg text-blue-700">
                    En Revisión
                  </CardTitle>
                  <p className="text-muted-foreground text-xs">
                    19 de febrero de 2024
                  </p>
                </div>
                <Badge variant="default" className="bg-blue-500">
                  En curso
                </Badge>
              </CardHeader>
              <CardContent className="border-t border-blue-100 pt-3 text-sm">
                <p className="text-muted-foreground mb-2 font-semibold">
                  Comentarios
                </p>
                <ul className="text-muted-foreground list-inside list-disc space-y-1">
                  <li>Revisión de objetivo general pendiente</li>
                  <li>Mapa curricular aprobado preliminarmente</li>
                </ul>
              </CardContent>
            </Card> */}
          </div>

          {/* Estado: Pendiente */}
          {/* <div className="relative flex gap-4 pb-4">
            <div className="flex flex-col items-center">
              <div className="rounded-full bg-slate-100 p-1 text-slate-400">
                <Circle className="h-6 w-6" />
              </div>
            </div>
            <Card className="flex-1 opacity-60 grayscale-[0.5]">
              <CardHeader className="flex flex-row items-center justify-between py-3">
                <CardTitle className="text-lg">Revisión Expertos</CardTitle>
                <Badge variant="outline">Pendiente</Badge>
              </CardHeader>
            </Card>
          </div> */}
        </div>

        {/* LADO DERECHO: Formulario de Transición */}
        <div className="lg:col-span-1">
          <Card className="sticky top-6">
            <CardHeader>
              <CardTitle className="text-lg">Transición de Estado</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="border-border bg-muted/20 flex items-center justify-between rounded-lg border p-3 text-sm">
                <div className="text-center">
                  <p className="text-muted-foreground text-xs">Estado actual</p>
                  <p className="text-foreground font-bold">En Revisión</p>
                </div>
                <div className="bg-border/30 mx-4 h-px flex-1" />
                <div className="text-center">
                  <p className="text-muted-foreground text-xs">Siguiente</p>
                  <p className="text-primary font-bold">Revisión Expertos</p>
                </div>
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="transition-comment"
                  className="text-sm font-medium"
                >
                  Comentario de transición
                </label>
                <Textarea
                  id="transition-comment"
                  placeholder="Agrega un comentario para la transición..."
                  className="min-h-30"
                />
              </div>

              <Button className="w-full" disabled>
                Avanzar a Revisión Expertos-
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
