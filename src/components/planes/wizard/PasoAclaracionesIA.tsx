import { useStore } from '@tanstack/react-form'
import { CheckCircle2, LoaderCircle, RefreshCw, Sparkles } from 'lucide-react'

import { withForm } from '@/components/form'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { nuevoPlanFormOpts } from '@/features/planes/nuevo/schema'

const LIMITE_IMPLICACION = 120

/**
 * Los resultados guardados antes de esta versión pueden traer la explicación
 * dentro de la etiqueta. Se presenta como detalle sin alterar el valor que se
 * persiste como respuesta.
 */
function presentarOpcion(etiqueta: string, implicacion: string) {
  const coincidencia = etiqueta.match(/^(.*?)\s*\(([^()]*)\)\s*$/)
  if (!coincidencia) return { titulo: etiqueta, detalle: implicacion }

  const [, titulo, parentesis] = coincidencia
  return {
    titulo: titulo.trim(),
    detalle: [parentesis.trim(), implicacion].filter(Boolean).join('. '),
  }
}

function DetalleOpcion({ texto }: { texto: string }) {
  const contenido = (
    <span className="text-muted-foreground line-clamp-2 text-sm text-pretty">
      {texto}
    </span>
  )

  if (texto.length <= LIMITE_IMPLICACION) return contenido

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="cursor-help">{contenido}</span>
      </TooltipTrigger>
      <TooltipContent className="max-w-sm">{texto}</TooltipContent>
    </Tooltip>
  )
}

export const PasoAclaracionesIA = withForm({
  ...nuevoPlanFormOpts,
  props: {} as {
    onReanalizar: () => void
    isReanalizando: boolean
    puedeReanalizar: boolean
  },
  render: function Render({
    form,
    onReanalizar,
    isReanalizando,
    puedeReanalizar,
  }) {
    const brief = useStore(form.store, (state) => state.values.iaBrief)

    return (
      <section className="space-y-6" data-guia="aclaraciones-ia">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-primary flex items-center gap-2 text-sm font-semibold">
              <Sparkles className="size-4" aria-hidden />
              Optimización curricular
            </div>
            <h2 className="mt-2 text-2xl font-bold tracking-tight">
              Completa las decisiones que faltan
            </h2>
            <p className="text-muted-foreground mt-1 max-w-2xl text-sm">
              Elige una respuesta por pregunta para ajustar la propuesta antes
              de generarla.
            </p>
          </div>
          {puedeReanalizar ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onReanalizar}
              disabled={isReanalizando}
              aria-busy={isReanalizando}
            >
              {isReanalizando ? (
                <LoaderCircle className="animate-spin" aria-hidden />
              ) : (
                <RefreshCw aria-hidden />
              )}
              Actualizar preguntas
            </Button>
          ) : null}
        </header>

        {brief.preguntas.map((pregunta, index) => {
          const respuesta = brief.respuestas[pregunta.id] ?? ''
          const etiquetas = pregunta.opciones.map((opcion) => opcion.etiqueta)
          const esRespuestaPropia =
            Boolean(respuesta) && !etiquetas.includes(respuesta)

          return (
            <fieldset key={pregunta.id} className="border-border border-t pt-5">
              <legend className="max-w-3xl pr-4 font-semibold">
                {index + 1}. {pregunta.pregunta}
              </legend>

              <RadioGroup
                className="mt-4 gap-4"
                value={esRespuestaPropia ? '' : respuesta}
                onValueChange={(valor) =>
                  form.setFieldValue(`iaBrief.respuestas.${pregunta.id}`, valor)
                }
              >
                {pregunta.opciones.map((opcion) => {
                  const id = `${pregunta.id}-${opcion.etiqueta}`
                  const presentacion = presentarOpcion(
                    opcion.etiqueta,
                    opcion.implicacion,
                  )
                  return (
                    <div key={opcion.etiqueta} className="flex gap-3">
                      <RadioGroupItem
                        value={opcion.etiqueta}
                        id={id}
                        className="mt-1"
                      />
                      <Label
                        htmlFor={id}
                        className="min-w-0 flex-col items-start gap-0.5 font-normal"
                      >
                        <span className="font-medium">
                          {presentacion.titulo}
                        </span>
                        <DetalleOpcion texto={presentacion.detalle} />
                      </Label>
                    </div>
                  )
                })}
              </RadioGroup>

              <Label
                htmlFor={`${pregunta.id}-libre`}
                className="text-muted-foreground mt-4 text-sm font-normal"
              >
                Otra respuesta
              </Label>
              <Input
                id={`${pregunta.id}-libre`}
                className="mt-1.5"
                value={esRespuestaPropia ? respuesta : ''}
                placeholder="Escribe una alternativa breve…"
                onChange={(event) =>
                  form.setFieldValue(
                    `iaBrief.respuestas.${pregunta.id}`,
                    event.target.value,
                  )
                }
              />
            </fieldset>
          )
        })}

        {brief.preguntas.length === 0 && brief.estado !== 'SIN_ANALIZAR' ? (
          <div className="border-primary/30 border-y py-8 text-center">
            <CheckCircle2 className="text-primary mx-auto size-8" aria-hidden />
            <p className="mt-3 font-semibold">La propuesta está lista</p>
            <p className="text-muted-foreground mt-1 text-sm">
              Continúa al resumen para revisar y crear el plan.
            </p>
          </div>
        ) : null}
      </section>
    )
  },
})
