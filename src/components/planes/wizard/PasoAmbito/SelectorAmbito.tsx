import { Check, LayoutGrid, List, Search } from 'lucide-react'
import { useMemo, useState } from 'react'

import type { ReactNode } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ListSortMenu, ListToolbar } from '@/components/ui/list-controls'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

export type OpcionAmbito = {
  id: string
  nombre: string
  /** Encabezado bajo el que se agrupa la opción (el nivel, en carreras). */
  grupo?: string | null
  /** Distintivo visual de la opción (el icono de la facultad). */
  icono?: ReactNode
  /** Segunda línea: lo que distingue dos opciones de nombre parecido. */
  detalle?: string | null
}

type OrdenAmbito = 'grupo' | 'nombre_asc' | 'nombre_desc'
type VistaAmbito = 'grilla' | 'lista'

const colador = new Intl.Collator('es-MX', { sensitivity: 'base' })

/** Buscar «pedagogia» tiene que encontrar «Pedagogía». */
const normalizar = (texto: string) =>
  texto
    .toLocaleLowerCase('es-MX')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')

/**
 * Elección de un ámbito académico —facultad o carrera— como vista propia.
 *
 * No es un desplegable: en el asistente esta decisión no es un campo más de un
 * formulario, es la pregunta completa de su pantalla, y de ella dependen el
 * nombre del plan, la plantilla normativa y los ciclos por omisión. Un `select`
 * la escondía tras un clic, truncaba los nombres largos y obligaba a recorrer
 * la lista a ciegas.
 *
 * Las opciones se presentan como la lista que son, con los mismos controles
 * que el resto de listados del producto —búsqueda, orden y conmutador de
 * vista— para que quien administra ochenta carreras las trate igual aquí que
 * en el catálogo. La rejilla es la vista por omisión porque a este ancho deja
 * ver del orden de seis opciones sin desplazar; la lista compacta sirve para
 * repasar muchas de un vistazo.
 */
export function SelectorAmbito({
  opciones,
  valorId,
  onSeleccionar,
  etiqueta,
  placeholderBusqueda,
  etiquetaGrupo = 'grupo',
  vacio,
  invalido = false,
  idError,
}: {
  opciones: Array<OpcionAmbito>
  valorId: string
  onSeleccionar: (opcion: OpcionAmbito) => void
  /** Qué se está eligiendo, para lectores de pantalla. */
  etiqueta: string
  placeholderBusqueda: string
  /** Cómo se llama el criterio de agrupación en el menú de orden. */
  etiquetaGrupo?: string
  /** Qué mostrar cuando no hay ninguna opción disponible. */
  vacio: ReactNode
  invalido?: boolean
  idError?: string
}) {
  const [busqueda, setBusqueda] = useState('')
  const [vista, setVista] = useState<VistaAmbito>('grilla')
  // El orden elegido se guarda como «todavía sin tocar» hasta que el usuario
  // lo cambia: así el criterio por omisión puede depender de unos catálogos
  // que en el primer render aún no han llegado.
  const [ordenElegido, setOrdenElegido] = useState<OrdenAmbito | null>(null)

  const hayGrupos = opciones.some(
    (opcion) => (opcion.grupo ?? '').trim() !== '',
  )
  const ordenPorOmision: OrdenAmbito = hayGrupos ? 'grupo' : 'nombre_asc'
  const orden = ordenElegido ?? ordenPorOmision

  const secciones = useMemo(() => {
    const consulta = normalizar(busqueda.trim())
    const filtradas = consulta
      ? opciones.filter((opcion) =>
          normalizar(
            `${opcion.nombre} ${opcion.grupo ?? ''} ${opcion.detalle ?? ''}`,
          ).includes(consulta),
        )
      : opciones

    if (orden === 'grupo') {
      const mapa = new Map<string, Array<OpcionAmbito>>()
      for (const opcion of filtradas) {
        const clave = (opcion.grupo ?? '').trim()
        mapa.set(clave, [...(mapa.get(clave) ?? []), opcion])
      }
      return [...mapa.entries()].map(([grupo, items]) => ({
        grupo,
        items: [...items].sort((a, b) => colador.compare(a.nombre, b.nombre)),
      }))
    }

    const signo = orden === 'nombre_desc' ? -1 : 1
    return [
      {
        grupo: '',
        items: [...filtradas].sort(
          (a, b) => signo * colador.compare(a.nombre, b.nombre),
        ),
      },
    ]
  }, [busqueda, opciones, orden])

  const total = secciones.reduce(
    (suma, seccion) => suma + seccion.items.length,
    0,
  )

  if (opciones.length === 0) return <>{vacio}</>

  const opcionesOrden = [
    ...(hayGrupos
      ? [{ value: 'grupo' as const, label: `Por ${etiquetaGrupo}` }]
      : []),
    { value: 'nombre_asc' as const, label: 'Nombre (A–Z)' },
    { value: 'nombre_desc' as const, label: 'Nombre (Z–A)' },
  ]

  const vistaSiguiente: VistaAmbito = vista === 'grilla' ? 'lista' : 'grilla'
  const IconoVista = vista === 'grilla' ? List : LayoutGrid
  const tituloVista =
    vista === 'grilla'
      ? 'Cambiar a vista de lista'
      : 'Cambiar a vista de cuadrícula'
  const botonVista = (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={tituloVista}
          onClick={() => setVista(vistaSiguiente)}
        >
          <IconoVista className="size-4" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{tituloVista}</TooltipContent>
    </Tooltip>
  )

  return (
    <div className="gap-control pb-seccion grid">
      <ListToolbar
        search={
          <div className="relative w-full">
            <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
            <Input
              value={busqueda}
              onChange={(event) => setBusqueda(event.target.value)}
              placeholder={placeholderBusqueda}
              aria-label={placeholderBusqueda}
              className="pl-pagina"
            />
          </div>
        }
        actions={
          <ListSortMenu
            value={orden}
            defaultValue={ordenPorOmision}
            options={opcionesOrden}
            onValueChange={setOrdenElegido}
            label={`Ordenar ${etiqueta.toLocaleLowerCase('es-MX')}`}
          />
        }
        view={botonVista}
        viewClassName="hidden sm:flex"
      />

      {total === 0 ? (
        <div className="border-border/60 gap-relacionado px-seccion py-pagina grid justify-items-center rounded-xl border border-dashed text-center">
          <p className="text-sm font-medium">
            Ninguna coincide con «{busqueda.trim()}».
          </p>
          <p className="text-muted-foreground text-sm">
            Revisa la escritura o borra la búsqueda para volver a ver las{' '}
            {opciones.length} disponibles.
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setBusqueda('')}
          >
            Limpiar búsqueda
          </Button>
        </div>
      ) : (
        <div
          // `group` + `aria-pressed` y no `radiogroup`: cada tarjeta es un
          // botón que se tabula por separado, sin la navegación por flechas
          // que un grupo de radios promete.
          role="group"
          aria-label={etiqueta}
          aria-describedby={idError}
          data-invalid={invalido || undefined}
          className="gap-grupo grid"
        >
          {secciones.map((seccion) => (
            <section key={seccion.grupo} className="gap-relacionado grid">
              {seccion.grupo ? (
                <h4 className="text-muted-foreground text-xs font-semibold tracking-[0.14em] uppercase">
                  {seccion.grupo}
                </h4>
              ) : null}
              <div
                className={cn(
                  'grid',
                  vista === 'grilla'
                    ? 'gap-control sm:grid-cols-2 lg:grid-cols-3'
                    : 'gap-control sm:gap-micro',
                )}
              >
                {seccion.items.map((opcion) => {
                  const seleccionada = opcion.id === valorId
                  return (
                    <button
                      key={opcion.id}
                      type="button"
                      aria-pressed={seleccionada}
                      onClick={() => onSeleccionar(opcion)}
                      className={cn(
                        'organic-interactive bg-card focus-visible:ring-ring gap-relacionado p-grupo relative grid min-h-24 content-start rounded-xl border text-left shadow-xs outline-none focus-visible:ring-2 dark:bg-transparent dark:shadow-none',
                        vista === 'lista' &&
                          'sm:gap-control sm:px-control sm:py-relacionado sm:flex sm:min-h-11 sm:items-center sm:rounded-lg sm:shadow-none',
                        seleccionada
                          ? 'border-primary bg-primary/5'
                          : cn(
                              'border-border hover:border-primary/40 hover:bg-accent/30',
                              vista === 'lista' &&
                                'sm:border-transparent sm:bg-transparent',
                            ),
                      )}
                    >
                      {opcion.icono}
                      <span
                        className={cn(
                          'text-sm leading-snug font-medium text-balance',
                          seleccionada && 'pr-seccion',
                          vista === 'lista' &&
                            'sm:min-w-0 sm:flex-1 sm:truncate sm:pr-0',
                        )}
                      >
                        {opcion.nombre}
                      </span>
                      {opcion.detalle ? (
                        <span
                          className={cn(
                            'text-muted-foreground text-xs leading-snug',
                            vista === 'lista' && 'sm:shrink-0',
                          )}
                        >
                          {opcion.detalle}
                        </span>
                      ) : null}
                      {seleccionada ? (
                        <Check
                          className={cn(
                            'text-primary absolute top-4 right-4 size-4',
                            vista === 'lista' &&
                              'sm:static sm:ml-auto sm:shrink-0',
                          )}
                        />
                      ) : null}
                    </button>
                  )
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
