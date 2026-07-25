import { useMemo } from 'react'

import type { Asignatura } from '@/types/plan'
import type { ReactNode } from 'react'

import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

interface Props {
  asignatura: Asignatura | null
  todasLasAsignaturas: Array<Asignatura>
  lineas: Array<{ id: string; color: string }>
  isOpen: boolean
  onClose: () => void
}

/** Nodo del árbol de seriación: una asignatura y las que dependen de ella. */
type NodoSeriacion = {
  asignatura: Asignatura
  hijas: Array<NodoSeriacion>
}

/**
 * Cadena de antecedentes de una asignatura, de la más lejana a la inmediata.
 *
 * `prerrequisito_asignatura_id` es una sola columna, así que la cadena hacia
 * arriba es lineal por construcción. El conjunto visitado no es defensa
 * teórica: un ciclo A→B→A metido a mano en la base colgaría el navegador.
 */
function cadenaDeAntecedentes(
  desde: Asignatura,
  porId: Map<string, Asignatura>,
): Array<Asignatura> {
  const cadena: Array<Asignatura> = []
  const vistas = new Set<string>([desde.id])

  let actual = desde
  while (actual.prerrequisito_asignatura_id) {
    const padre = porId.get(actual.prerrequisito_asignatura_id)
    if (!padre || vistas.has(padre.id)) break
    vistas.add(padre.id)
    cadena.unshift(padre)
    actual = padre
  }

  return cadena
}

/** Descendientes de una asignatura: las que la tienen como prerrequisito. */
function construirDescendientes(
  raiz: Asignatura,
  hijasPorPadre: Map<string, Array<Asignatura>>,
  vistas: Set<string>,
): NodoSeriacion {
  vistas.add(raiz.id)
  const hijas = (hijasPorPadre.get(raiz.id) ?? [])
    .filter((hija) => !vistas.has(hija.id))
    .map((hija) => construirDescendientes(hija, hijasPorPadre, vistas))

  return { asignatura: raiz, hijas }
}

function FilaAsignatura({
  asignatura,
  color,
  activa,
  rol,
}: {
  asignatura: Asignatura
  color: string | null
  activa: boolean
  /** Posición en la cadena, para que el orden no dependa sólo del sangrado. */
  rol: 'antecedente' | 'actual' | 'consecuente'
}) {
  return (
    <div
      className={cn(
        'flex min-w-0 items-center gap-3 rounded-lg py-2 pr-3 pl-2',
        activa && 'bg-primary/8 ring-primary/25 ring-1',
      )}
      aria-current={activa ? 'true' : undefined}
    >
      <span
        aria-hidden
        className="size-2.5 shrink-0 rounded-full"
        style={{ background: color ?? 'var(--muted-foreground)' }}
      />
      <span className="min-w-0 flex-1">
        <span
          className={cn(
            'block truncate text-sm',
            activa ? 'font-semibold' : 'font-medium',
          )}
        >
          {asignatura.nombre}
        </span>
        <span className="text-muted-foreground block truncate text-xs">
          {[
            asignatura.clave,
            asignatura.ciclo ? `Ciclo ${asignatura.ciclo}` : null,
          ]
            .filter(Boolean)
            .join(' · ')}
        </span>
      </span>
      {rol !== 'actual' && (
        <Badge variant="outline" className="shrink-0 font-normal">
          {rol === 'antecedente' ? 'Antes' : 'Después'}
        </Badge>
      )}
    </div>
  )
}

/**
 * Árbol de seriación de una asignatura.
 *
 * Antes esto era un lienzo de React Flow con `dagre`: dos dependencias, un
 * layout automático y un canvas con zoom para dibujar lo que en realidad es
 * una lista con sangrado —cada asignatura tiene **un** prerrequisito, así que
 * hacia arriba la cadena es lineal y hacia abajo es un árbol—. El riel de
 * `.tree-child` ya dibuja esa estructura con tokens del tema, hereda el modo
 * oscuro sin observar el `class` del `html` y se lee con lector de pantalla,
 * cosa que el canvas no hacía.
 */
export function VisualizadorSeriacionModal({
  asignatura,
  todasLasAsignaturas,
  isOpen,
  lineas,
  onClose,
}: Props) {
  const colorPorLinea = useMemo(
    () => new Map(lineas.map((linea) => [linea.id, linea.color])),
    [lineas],
  )

  const { antecedentes, arbol } = useMemo(() => {
    if (!asignatura) return { antecedentes: [], arbol: null }

    const porId = new Map(todasLasAsignaturas.map((a) => [a.id, a]))
    const hijasPorPadre = new Map<string, Array<Asignatura>>()
    for (const candidata of todasLasAsignaturas) {
      const padreId = candidata.prerrequisito_asignatura_id
      if (!padreId) continue
      const hermanas = hijasPorPadre.get(padreId) ?? []
      hermanas.push(candidata)
      hijasPorPadre.set(padreId, hermanas)
    }
    for (const hermanas of hijasPorPadre.values()) {
      hermanas.sort(
        (a, b) =>
          (a.ciclo ?? 0) - (b.ciclo ?? 0) || a.nombre.localeCompare(b.nombre),
      )
    }

    const cadena = cadenaDeAntecedentes(asignatura, porId)
    return {
      antecedentes: cadena,
      arbol: construirDescendientes(
        asignatura,
        hijasPorPadre,
        new Set(cadena.map((a) => a.id)),
      ),
    }
  }, [asignatura, todasLasAsignaturas])

  if (!asignatura) return null

  const colorDe = (a: Asignatura) =>
    a.lineaCurricularId
      ? (colorPorLinea.get(a.lineaCurricularId) ?? null)
      : null

  const renderNodo = (nodo: NodoSeriacion, esRaiz: boolean): ReactNode => (
    <li key={nodo.asignatura.id} className={cn(!esRaiz && 'tree-child')}>
      <FilaAsignatura
        asignatura={nodo.asignatura}
        color={colorDe(nodo.asignatura)}
        activa={esRaiz}
        rol={esRaiz ? 'actual' : 'consecuente'}
      />
      {nodo.hijas.length > 0 && (
        <ul>{nodo.hijas.map((hija) => renderNodo(hija, false))}</ul>
      )}
    </li>
  )

  const sinRelaciones =
    antecedentes.length === 0 && (arbol?.hijas.length ?? 0) === 0

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      {/* Más ancha que la estándar: los nombres de asignatura son largos y el
          sangrado del árbol come ancho en cada nivel. */}
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Seriación de {asignatura.nombre}</DialogTitle>
          <DialogDescription>
            {sinRelaciones
              ? 'Esta asignatura no tiene prerrequisito ni es prerrequisito de ninguna otra: puede cursarse sin depender del resto del mapa.'
              : 'Cadena completa de dependencias: arriba lo que debe cursarse antes, abajo lo que se abre al aprobarla.'}
          </DialogDescription>
        </DialogHeader>

        {!sinRelaciones && (
          <div className="grid gap-1">
            {antecedentes.length > 0 && (
              <ol className="grid gap-1">
                {antecedentes.map((antecedente) => (
                  <li key={antecedente.id}>
                    <FilaAsignatura
                      asignatura={antecedente}
                      color={colorDe(antecedente)}
                      activa={false}
                      rol="antecedente"
                    />
                  </li>
                ))}
              </ol>
            )}

            {arbol && <ul>{renderNodo(arbol, true)}</ul>}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
