import { Sparkles } from 'lucide-react'

type Modo = 'plan' | 'asignatura'

/**
 * Campos que SIEMPRE se inyectan como datos al generar el documento SEP,
 * independientemente de lo que declare la estructura. El armado real vive en
 * la edge function `carbone-io-wrapper`; aquí solo lo comunicamos al usuario.
 */
const CAMPOS_INYECTADOS: Record<Modo, Array<{ label: string; hint?: string }>> =
  {
    plan: [
      { label: 'Nombre del plan' },
      { label: 'Nivel', hint: 'de la carrera' },
      { label: 'Carrera' },
      { label: 'Número de ciclos' },
      { label: 'Tipo de ciclo' },
    ],
    asignatura: [
      { label: 'Nombre' },
      { label: 'Clave' },
      { label: 'Créditos' },
      { label: 'Horas (HD/HI)' },
      { label: 'Ciclo' },
      { label: 'Contenido temático' },
      { label: 'Sistema de evaluación' },
      { label: 'Bibliografía', hint: 'básica y complementaria' },
      { label: 'Nivel', hint: 'de la carrera' },
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
              <span
                key={item.label}
                className="border-primary/20 bg-background text-foreground inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs"
              >
                {item.label}
                {item.hint && (
                  <span className="text-muted-foreground">({item.hint})</span>
                )}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
