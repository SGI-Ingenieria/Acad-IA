import {
  BookMarked,
  Clock3,
  LayoutGrid,
  ListOrdered,
  Timer,
  Waypoints,
} from 'lucide-react'

import type { AlcanceGeneracionPlan } from '@/data/api/plans.api'
import type { LucideIcon } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
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
    titulo: 'Acomodarlas en el mapa',
    consecuencia: 'Asigna a cada asignatura su línea curricular y su ciclo.',
    peso: 1,
  },
  {
    clave: 'ordenarAsignaturas',
    icono: ListOrdered,
    titulo: 'Ordenarlas dentro de cada celda',
    consecuencia: 'Fija la secuencia en que conviene cursarlas.',
    peso: 1,
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
    <li className="flex items-start gap-3 py-2">
      <Checkbox
        id={id}
        checked={checked}
        disabled={disabled}
        aria-describedby={`${id}-detalle`}
        onCheckedChange={(valor) => onChange?.(valor === true)}
        className="mt-0.5"
      />
      <label
        htmlFor={id}
        className={cn(
          'min-w-0 flex-1 cursor-pointer',
          disabled && 'cursor-default opacity-55',
        )}
      >
        <span className="flex items-center gap-2 text-sm font-medium">
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
          className="text-muted-foreground mt-0.5 block text-xs leading-snug"
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
 * Las opciones no son independientes ni equivalentes: acomodar, ordenar, poner
 * horas y proponer bibliografía son operaciones *sobre las asignaturas*, así
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
    // Misma normalización que el servidor: sin asignaturas no hay nada que
    // acomodar, y sin acomodo no hay celda dentro de la cual ordenar.
    if (!siguiente.asignaturas) {
      siguiente.acomodarAsignaturas = false
      siguiente.ordenarAsignaturas = false
      siguiente.horasAsignaturas = false
      siguiente.bibliografia = false
    } else if (!siguiente.acomodarAsignaturas) {
      siguiente.ordenarAsignaturas = false
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
        opcion.clave !== 'contenidoTematico' &&
        valor[opcion.clave]
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
    <section aria-labelledby="alcance-generacion-titulo" className="mt-2">
      <h3 id="alcance-generacion-titulo" className="text-sm font-semibold">
        Qué debe construir la IA
      </h3>
      <p className="text-muted-foreground mt-1 text-xs">
        El plan y sus datos generales se generan siempre. Lo demás es opcional y
        se puede completar después a mano o con el modo agente.
      </p>

      <ul className="mt-3">
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

      <ul className="border-border mt-1 ml-2 border-l pl-5">
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

          const requiereAcomodo = opcion.clave === 'ordenarAsignaturas'
          const deshabilitada =
            !valor.asignaturas ||
            (requiereAcomodo && !valor.acomodarAsignaturas)

          return (
            <FilaAlcance
              key={opcion.clave}
              opcion={opcion}
              checked={valor[opcion.clave]}
              disabled={deshabilitada}
              motivoDeshabilitado={
                !valor.asignaturas
                  ? 'Requiere generar las asignaturas.'
                  : requiereAcomodo && !valor.acomodarAsignaturas
                    ? 'Requiere acomodarlas antes en el mapa.'
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

      <p className="text-muted-foreground mt-3 flex items-start gap-2 text-xs">
        <Timer className="mt-px size-3.5 shrink-0" aria-hidden />
        {espera}
      </p>
    </section>
  )
}
