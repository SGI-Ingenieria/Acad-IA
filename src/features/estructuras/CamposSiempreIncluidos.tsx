import { ChevronDown, ListChecks } from 'lucide-react'

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'

type Modo = 'plan' | 'asignatura'

/**
 * Campos que SIEMPRE se inyectan como datos al generar el documento SEP,
 * independientemente de lo que declare la estructura. El armado real vive en
 * la edge function `carbone-io-wrapper`; aquí solo lo comunicamos al usuario.
 */
const CAMPOS_INYECTADOS: Record<
  Modo,
  Array<{ label: string; hint?: string; key: string; descripcion: string }>
> = {
  plan: [
    {
      label: 'Nombre del plan',
      key: 'nombre',
      descripcion: 'Nombre oficial del plan de estudios.',
    },
    {
      label: 'Nivel',
      hint: 'de la carrera',
      key: 'nivel',
      descripcion: 'Nivel académico de la carrera (p. ej. licenciatura).',
    },
    {
      label: 'Carrera',
      key: 'carrera',
      descripcion: 'Carrera a la que pertenece el plan.',
    },
    {
      label: 'Número de ciclos',
      key: 'numero_ciclos',
      descripcion: 'Cantidad total de ciclos que dura el plan.',
    },
    {
      label: 'Tipo de ciclo',
      key: 'tipo_ciclo',
      descripcion: 'Periodicidad de los ciclos (semestral, cuatrimestral…).',
    },
    {
      label: 'Clave SEP',
      hint: 'de la carrera',
      key: 'clave_sep',
      descripcion: 'Clave de registro de la carrera ante la SEP.',
    },
  ],
  asignatura: [
    {
      label: 'Nombre',
      key: 'nombre',
      descripcion: 'Nombre de la asignatura.',
    },
    {
      label: 'Clave',
      key: 'codigo',
      descripcion: 'Código identificador de la asignatura.',
    },
    {
      label: 'Créditos',
      key: 'creditos',
      descripcion: 'Créditos académicos que otorga la asignatura.',
    },
    {
      label: 'Tipo',
      key: 'tipo',
      descripcion: 'Clasificación de la asignatura (obligatoria, optativa…).',
    },
    {
      label: 'Ciclo',
      key: 'numero_ciclo',
      descripcion: 'Ciclo del plan en el que se imparte.',
    },
    {
      label: 'Horas académicas',
      key: 'horas_academicas',
      descripcion: 'Horas de trabajo con docente.',
    },
    {
      label: 'Horas independientes',
      key: 'horas_independientes',
      descripcion: 'Horas de trabajo autónomo del estudiante.',
    },
    {
      label: 'Contenido temático',
      key: 'contenido_tematico',
      descripcion: 'Temario y subtemas que cubre la asignatura.',
    },
    {
      label: 'Sistema de evaluación',
      key: 'criterios_de_evaluacion',
      descripcion: 'Criterios y ponderaciones para calificar.',
    },
    {
      label: 'Bibliografía básica',
      key: 'bibliografia_basica',
      descripcion: 'Fuentes obligatorias de consulta.',
    },
    {
      label: 'Bibliografía complementaria',
      key: 'bibliografia_complementaria',
      descripcion: 'Fuentes adicionales de apoyo.',
    },
    {
      label: 'Nivel',
      hint: 'de la carrera',
      key: 'nivel',
      descripcion: 'Nivel académico de la carrera (p. ej. licenciatura).',
    },
    {
      label: 'Carrera',
      key: 'carrera',
      descripcion: 'Carrera a la que pertenece la asignatura.',
    },
    {
      label: 'Clave SEP',
      hint: 'de la carrera',
      key: 'clave_sep',
      descripcion: 'Clave de registro de la carrera ante la SEP.',
    },
    {
      label: 'Nombre del plan',
      key: 'nombre_plan',
      descripcion: 'Plan de estudios al que pertenece la asignatura.',
    },
    {
      label: 'Número de ciclos',
      key: 'numero_ciclos',
      descripcion: 'Cantidad total de ciclos del plan.',
    },
    {
      label: 'Tipo de ciclo',
      key: 'tipo_ciclo',
      descripcion: 'Periodicidad de los ciclos (semestral, cuatrimestral…).',
    },
  ],
}

/**
 * Llaves reservadas por modo: ya viajan como "campos siempre incluidos", así que
 * NO pueden declararse como campo de estructura (colisionarían con el valor
 * canónico). El editor las bloquea. Mantener en sincronía con
 * `CAMPOS_SIEMPRE_*` de `supabase/functions/_shared/camposDocumento.ts`.
 */
export const RESERVED_KEYS: Record<Modo, ReadonlySet<string>> = {
  plan: new Set(CAMPOS_INYECTADOS.plan.map((c) => c.key)),
  asignatura: new Set(CAMPOS_INYECTADOS.asignatura.map((c) => c.key)),
}

export function esLlaveReservada(modo: Modo, key: string): boolean {
  return RESERVED_KEYS[modo].has(key.trim())
}

export function CamposSiempreIncluidos({ modo }: { modo: Modo }) {
  const items = CAMPOS_INYECTADOS[modo]

  return (
    <Collapsible className="gradient-border organic-surface group/cards rounded-xl shadow-sm">
      <CollapsibleTrigger className="flex w-full items-center gap-3 rounded-xl p-4 text-left">
        <div className="text-muted-foreground bg-muted mt-0.5 shrink-0 rounded-lg p-1.5">
          <ListChecks className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-center gap-2">
            <p className="text-foreground text-sm font-semibold">
              Campos siempre incluidos
            </p>
            <span className="text-muted-foreground bg-muted inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-semibold tabular-nums">
              {items.length}
            </span>
          </div>
          <p className="text-muted-foreground text-xs leading-relaxed">
            Estos datos se inyectan automáticamente al generar el documento,
            aunque no los declares en la estructura. No hace falta crearlos como
            campos.
          </p>
        </div>
        <ChevronDown className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0 transition-transform duration-200 group-data-[state=open]/cards:rotate-180" />
      </CollapsibleTrigger>

      <CollapsibleContent className="data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down overflow-hidden">
        <ul className="border-border/60 divide-border/60 mx-4 mb-2 divide-y border-t">
          {items.map((item) => (
            <li key={item.key} className="flex items-start gap-4 py-2.5">
              <div className="min-w-0 flex-1 space-y-0.5">
                <span className="text-foreground text-sm font-medium">
                  {item.label}
                  {item.hint && (
                    <span className="text-muted-foreground ml-1 text-xs font-normal">
                      ({item.hint})
                    </span>
                  )}
                </span>
                <p className="text-muted-foreground text-xs leading-relaxed">
                  {item.descripcion}
                </p>
              </div>
              <code className="text-muted-foreground bg-muted mt-0.5 shrink-0 rounded px-1.5 py-0.5 font-mono text-[11px]">
                {item.key}
              </code>
            </li>
          ))}
        </ul>
      </CollapsibleContent>
    </Collapsible>
  )
}
