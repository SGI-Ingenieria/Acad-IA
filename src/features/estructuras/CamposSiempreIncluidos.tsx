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
  Array<{ label: string; hint?: string; key: string }>
> = {
  plan: [
    {
      label: 'Nombre del plan',
      key: 'nombre',
    },
    {
      label: 'Nivel',
      hint: 'de la carrera',
      key: 'nivel',
    },
    {
      label: 'Carrera',
      key: 'carrera',
    },
    {
      label: 'Número de ciclos',
      key: 'numero_ciclos',
    },
    {
      label: 'Tipo de ciclo',
      key: 'tipo_ciclo',
    },
    {
      label: 'Clave SEP',
      hint: 'de la carrera',
      key: 'clave_sep',
    },
  ],
  asignatura: [
    {
      label: 'Nombre',
      key: 'nombre',
    },
    {
      label: 'Clave',
      key: 'codigo',
    },
    {
      label: 'Créditos',
      key: 'creditos',
    },
    {
      label: 'Tipo',
      key: 'tipo',
    },
    {
      label: 'Ciclo',
      key: 'numero_ciclo',
    },
    {
      label: 'Horas académicas',
      key: 'horas_academicas',
    },
    {
      label: 'Horas independientes',
      key: 'horas_independientes',
    },
    {
      label: 'Contenido temático',
      key: 'contenido_tematico',
    },
    {
      label: 'Sistema de evaluación',
      key: 'criterios_de_evaluacion',
    },
    {
      label: 'Bibliografía básica',
      key: 'bibliografia_basica',
    },
    {
      label: 'Bibliografía complementaria',
      key: 'bibliografia_complementaria',
    },
    {
      label: 'Nivel',
      hint: 'de la carrera',
      key: 'nivel',
    },
    {
      label: 'Carrera',
      key: 'carrera',
    },
    {
      label: 'Clave SEP',
      hint: 'de la carrera',
      key: 'clave_sep',
    },
    {
      label: 'Nombre del plan',
      key: 'nombre_plan',
    },
    {
      label: 'Número de ciclos',
      key: 'numero_ciclos',
    },
    {
      label: 'Tipo de ciclo',
      key: 'tipo_ciclo',
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
      <CollapsibleTrigger className="gap-control p-grupo flex w-full items-center rounded-xl text-left">
        <div className="text-muted-foreground bg-muted mt-micro p-relacionado shrink-0 rounded-lg">
          <ListChecks className="h-4 w-4" />
        </div>
        <div className="space-y-micro min-w-0 flex-1">
          <div className="gap-relacionado flex items-center">
            <p className="text-foreground text-sm font-semibold">
              Campos siempre incluidos
            </p>
          </div>
        </div>
        <ChevronDown className="text-muted-foreground mt-micro h-4 w-4 shrink-0 transition-transform duration-200 group-data-[state=open]/cards:rotate-180" />
      </CollapsibleTrigger>

      <CollapsibleContent className="data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down overflow-hidden">
        <ul className="border-border/60 divide-border/60 mx-grupo mb-relacionado divide-y border-t">
          {items.map((item) => (
            <li
              key={item.key}
              className="gap-grupo py-control flex items-start"
            >
              <div className="space-y-micro min-w-0 flex-1">
                <span className="text-foreground text-sm font-medium">
                  {item.label}
                  {item.hint && (
                    <span className="text-muted-foreground ml-micro text-xs font-normal">
                      ({item.hint})
                    </span>
                  )}
                </span>
              </div>
              <code className="text-muted-foreground bg-muted mt-micro px-relacionado py-micro shrink-0 rounded font-mono text-[11px]">
                {item.key}
              </code>
            </li>
          ))}
        </ul>
      </CollapsibleContent>
    </Collapsible>
  )
}
