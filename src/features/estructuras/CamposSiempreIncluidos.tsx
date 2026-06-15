import { Sparkles } from 'lucide-react'

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'

type Modo = 'plan' | 'asignatura'

/**
 * Campos que SIEMPRE se inyectan como datos al generar el documento SEP,
 * independientemente de lo que declare la estructura. El armado real vive en
 * la edge function `carbone-io-wrapper`; aquí solo lo comunicamos al usuario.
 */
const CAMPOS_INYECTADOS: Record<
  Modo,
  Array<{ label: string; hint?: string; key: string }>
> = {
  plan: [
    { label: 'Nombre del plan', key: 'nombre' },
    { label: 'Nivel', hint: 'de la carrera', key: 'nivel' },
    { label: 'Carrera', key: 'carrera' },
    { label: 'Número de ciclos', key: 'numero_ciclos' },
    { label: 'Tipo de ciclo', key: 'tipo_ciclo' },
  ],
  asignatura: [
    { label: 'Nombre', key: 'nombre' },
    { label: 'Clave', key: 'clave' },
    { label: 'Créditos', key: 'creditos' },
    { label: 'Horas (HD/HI)', key: 'horas' },
    { label: 'Ciclo', key: 'ciclo' },
    { label: 'Contenido temático', key: 'contenido_tematico' },
    { label: 'Sistema de evaluación', key: 'sistema_evaluacion' },
    {
      label: 'Bibliografía',
      hint: 'básica y complementaria',
      key: 'bibliografia',
    },
    { label: 'Nivel', hint: 'de la carrera', key: 'nivel' },
  ],
}

export function CamposSiempreIncluidos({ modo }: { modo: Modo }) {
  const items = CAMPOS_INYECTADOS[modo]

  return (
    <div className="border-primary/20 bg-primary/5 rounded-xl border p-4">
      <div className="flex items-start gap-3">
        <div className="bg-primary/10 text-primary mt-0.5 shrink-0 rounded-lg p-1.5">
          <Sparkles className="h-4 w-4" />
        </div>
        <div className="min-w-0 space-y-2">
          <div>
            <p className="text-foreground text-sm font-semibold">
              Campos siempre incluidos
            </p>
            <p className="text-muted-foreground text-xs">
              Estos datos se inyectan automáticamente al generar el documento,
              aunque no los declares en la estructura. No hace falta crearlos
              como campos.
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {items.map((item) => (
              <Tooltip key={item.label}>
                <TooltipContent>
                  <p className="text-foreground text-sm font-medium">
                    {item.key}
                  </p>
                </TooltipContent>
                <TooltipTrigger>
                  <span className="border-primary/20 bg-background text-foreground inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs">
                    {item.label}{' '}
                    {item.hint && (
                      <span className="text-muted-foreground">
                        ({item.hint})
                      </span>
                    )}
                  </span>
                </TooltipTrigger>
              </Tooltip>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
