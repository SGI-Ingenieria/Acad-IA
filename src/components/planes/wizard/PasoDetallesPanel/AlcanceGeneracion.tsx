import {
  BookMarked,
  ChevronDown,
  Clock3,
  LayoutGrid,
  ListOrdered,
  SlidersHorizontal,
  Timer,
  Waypoints,
} from 'lucide-react'

import type { AlcanceGeneracionPlan } from '@/data/api/plans.api'
import type { LucideIcon } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { cn } from '@/lib/utils'

type ClaveAlcance = keyof AlcanceGeneracionPlan

type Opcion = {
  clave: ClaveAlcance | 'contenidoTematico'
  icono: LucideIcon
  titulo: string
  /** Qué queda hecho al terminar. No repite el título en otras palabras. */
  consecuencia: string
  /** Peso relativo en la espera, para el aviso de duración. */
  peso: number
}

const PRINCIPALES: Array<Opcion> = [
  {
    clave: 'lineasCurriculares',
    icono: Waypoints,
    titulo: 'Líneas curriculares',
    consecuencia:
      'Propone los ejes formativos del plan, de lo básico a lo especializante.',
    peso: 1,
  },
  {
    clave: 'asignaturas',
    icono: LayoutGrid,
    titulo: 'Asignaturas',
    consecuencia:
      'Redacta el catálogo completo de asignaturas con nombre y clave.',
    peso: 3,
  },
]

const DERIVADAS: Array<Opcion> = [
  {
    clave: 'acomodarAsignaturas',
    icono: LayoutGrid,
    titulo: 'Organizarlas en el mapa',
    consecuencia:
      'Asigna a cada asignatura su línea curricular, ciclo y posición dentro de la celda.',
    peso: 2,
  },
  {
    clave: 'horasAsignaturas',
    icono: Clock3,
    titulo: 'Créditos y horas',
    consecuencia:
      'Calcula créditos, horas académicas e independientes según el Acuerdo 17/11/17.',
    peso: 1,
  },
  {
    clave: 'bibliografia',
    icono: BookMarked,
    titulo: 'Bibliografía',
    consecuencia:
      'Propone referencias básicas y complementarias para cada asignatura.',
    peso: 4,
  },
  {
    clave: 'contenidoTematico',
    icono: ListOrdered,
    titulo: 'Contenido temático',
    consecuencia: 'Desarrolla unidades y temas de cada asignatura.',
    peso: 0,
  },
]

function FilaAlcance({
  opcion,
  checked,
  disabled,
  motivoDeshabilitado,
  insignia,
  onChange,
}: {
  opcion: Opcion
  checked: boolean
  disabled?: boolean
  motivoDeshabilitado?: string
  insignia?: string
  onChange?: (valor: boolean) => void
}) {
  const Icono = opcion.icono
  const id = `alcance-${opcion.clave}`

  return (
    <li className="gap-control py-relacionado flex items-start">
      <Checkbox
        id={id}
        checked={checked}
        disabled={disabled}
        aria-describedby={`${id}-detalle`}
        onCheckedChange={(valor) => onChange?.(valor === true)}
        className="mt-micro"
      />
      <label
        htmlFor={id}
        className={cn(
          'min-w-0 flex-1 cursor-pointer',
          disabled && 'cursor-default opacity-55',
        )}
      >
        <span className="gap-relacionado flex items-center text-sm font-medium">
          <Icono
            className="text-muted-foreground size-4 shrink-0"
            aria-hidden
          />
          {opcion.titulo}
          {insignia ? (
            <Badge variant="secondary" className="font-normal">
              {insignia}
            </Badge>
          ) : null}
        </span>
        <span
          id={`${id}-detalle`}
          className="text-muted-foreground mt-micro block text-xs leading-snug"
        >
          {motivoDeshabilitado ?? opcion.consecuencia}
        </span>
      </label>
    </li>
  )
}

/**
 * Alcance de la generación del plan con IA.
 *
 * Las opciones no son independientes ni equivalentes: organizar, poner horas
 * y proponer bibliografía son operaciones *sobre las asignaturas*, así
 * que se muestran como una rama subordinada y se apagan solas cuando su padre
 * se apaga —la jerarquía de la interfaz es la misma que impone el servidor en
 * `ai-generate-plan/alcance.ts`—. Cada fila dice qué queda hecho, no sólo qué
 * se activa, y el pie traduce la selección a una espera concreta, porque el
 * costo real de marcar «bibliografía» son minutos de generación que el usuario
 * no puede ver de otro modo hasta que ya está esperando.
 */
export function AlcanceGeneracion({
  valor,
  onChange,
}: {
  valor: AlcanceGeneracionPlan
  onChange: (valor: AlcanceGeneracionPlan) => void
}) {
  const aplicar = (cambios: Partial<AlcanceGeneracionPlan>) => {
    const siguiente = { ...valor, ...cambios }
    // Misma normalización que el servidor: organizar en el mapa es una sola
    // decisión y requiere tanto asignaturas como líneas curriculares.
    if (!siguiente.asignaturas) {
      siguiente.acomodarAsignaturas = false
      siguiente.ordenarAsignaturas = false
      siguiente.horasAsignaturas = false
      siguiente.bibliografia = false
    } else if (!siguiente.lineasCurriculares) {
      siguiente.acomodarAsignaturas = false
      siguiente.ordenarAsignaturas = false
    } else {
      siguiente.ordenarAsignaturas = siguiente.acomodarAsignaturas
    }
    onChange(siguiente)
  }

  const peso =
    PRINCIPALES.reduce(
      (total, opcion) =>
        valor[opcion.clave as ClaveAlcance] ? total + opcion.peso : total,
      0,
    ) +
    DERIVADAS.reduce(
      (total, opcion) =>
        opcion.clave !== 'contenidoTematico' && valor[opcion.clave]
          ? total + opcion.peso
          : total,
      0,
    )

  const espera =
    peso <= 1
      ? 'La generación tarda unos minutos.'
      : peso <= 5
        ? 'La generación tarda varios minutos; puedes seguir trabajando mientras.'
        : 'La generación puede tardar bastante: las asignaturas y su bibliografía se van agregando al plan conforme se terminan.'

  return (
    <Collapsible className="group/configuracion mt-control">
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="organic-interactive text-muted-foreground hover:text-foreground gap-relacionado py-relacionado flex w-full items-center text-left text-sm font-medium"
        >
          <SlidersHorizontal className="size-4" aria-hidden />
          <span className="flex-1">Configuraciones adicionales</span>
          <ChevronDown
            className="size-4 transition-transform group-data-[state=open]/configuracion:rotate-180"
            aria-hidden
          />
        </button>
      </CollapsibleTrigger>

      <CollapsibleContent>
        <section
          aria-labelledby="alcance-generacion-titulo"
          className="border-border mt-relacionado pt-grupo border-t"
        >
          <h3 id="alcance-generacion-titulo" className="text-sm font-semibold">
            Alcance de la generación
          </h3>

          <ul className="mt-control">
            {PRINCIPALES.map((opcion) => (
              <FilaAlcance
                key={opcion.clave}
                opcion={opcion}
                checked={valor[opcion.clave as ClaveAlcance]}
                onChange={(marcado) =>
                  aplicar({
                    [opcion.clave]: marcado,
                  })
                }
              />
            ))}
          </ul>

          <ul className="border-border mt-micro ml-relacionado pl-seccion border-l">
            {DERIVADAS.map((opcion) => {
              if (opcion.clave === 'contenidoTematico') {
                return (
                  <FilaAlcance
                    key={opcion.clave}
                    opcion={opcion}
                    checked={false}
                    disabled
                    insignia="Disponible después"
                    motivoDeshabilitado="Todavía no se genera desde aquí: se crea asignatura por asignatura desde su detalle."
                  />
                )
              }

              const organizaMapa = opcion.clave === 'acomodarAsignaturas'
              const deshabilitada =
                !valor.asignaturas ||
                (organizaMapa && !valor.lineasCurriculares)

              return (
                <FilaAlcance
                  key={opcion.clave}
                  opcion={opcion}
                  checked={valor[opcion.clave]}
                  disabled={deshabilitada}
                  motivoDeshabilitado={
                    !valor.asignaturas
                      ? 'Requiere generar las asignaturas.'
                      : organizaMapa && !valor.lineasCurriculares
                        ? 'Requiere generar las líneas curriculares.'
                        : undefined
                  }
                  onChange={(marcado) =>
                    aplicar({
                      [opcion.clave]: marcado,
                    })
                  }
                />
              )
            })}
          </ul>

          <p className="text-muted-foreground mt-control gap-relacionado flex items-start text-xs">
            <Timer className="mt-px size-3.5 shrink-0" aria-hidden />
            {espera}
          </p>
        </section>
      </CollapsibleContent>
    </Collapsible>
  )
}
