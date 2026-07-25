import { Plus } from 'lucide-react'

import { useAgenteOpcional } from '../AgenteContext'

import { PostItSugerencia } from './PostItSugerencia'

import type { SugerenciaSlot } from '@/data'

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  usePlan,
  usePlanAsignaturas,
  usePlanLineas,
  useLanzarGeneracionAsignatura,
  useSubjectEstructuras,
  useSugerenciasAgente,
} from '@/data'
import {
  requestAdminOverrideReason,
  usePlanCapabilities,
} from '@/data/auth/planCapabilities'
import {
  Flip,
  getOrganicMotion,
  gsap,
  organicDuration,
  organicEase,
} from '@/lib/animations'
import { makeTempId } from '@/lib/optimistic'
import { notify } from '@/lib/toast'
import { cn } from '@/lib/utils'

/** Fotogramas que se espera a que React pinte la fila optimista antes de rendirse. */
const INTENTOS_FILA = 40

/**
 * Copia visual del post-it, despegada del flujo, para poder animarla hacia la
 * tabla después de que el original haya desaparecido de la tira.
 */
function clonarParaVuelo(nodo: HTMLElement): HTMLElement {
  const rect = nodo.getBoundingClientRect()
  const clon = nodo.cloneNode(true) as HTMLElement

  clon.setAttribute('aria-hidden', 'true')
  clon.removeAttribute('aria-label')
  Object.assign(clon.style, {
    position: 'fixed',
    margin: '0',
    left: `${rect.left}px`,
    top: `${rect.top}px`,
    width: `${rect.width}px`,
    height: `${rect.height}px`,
    pointerEvents: 'none',
    // Por debajo del dock (z-90) para no taparlo durante el vuelo.
    zIndex: '80',
  })
  document.body.appendChild(clon)
  return clon
}

/**
 * Lleva el clon hasta la fila recién insertada. La fila no existe todavía cuando
 * arranca la mutación —React aún no ha pintado la escritura optimista—, así que
 * se espera por fotogramas en vez de asumir que está en el DOM.
 *
 * Si nunca aparece (un filtro activo la deja fuera de la tabla, u otra pestaña),
 * el clon se desvanece donde está: el usuario ve que su acción salió de la tira
 * aunque no pueda ver el destino.
 */
function volarHaciaFila(clon: HTMLElement, tempId: string) {
  const quitar = () => clon.remove()

  const buscar = (intentos: number) => {
    const fila = document.querySelector<HTMLElement>(
      `[data-asignatura-id="${tempId}"]`,
    )

    if (!fila) {
      if (intentos <= 0) {
        gsap.to(clon, {
          autoAlpha: 0,
          duration: organicDuration.base,
          ease: organicEase,
          onComplete: quitar,
        })
        return
      }
      requestAnimationFrame(() => buscar(intentos - 1))
      return
    }

    Flip.fit(clon, fila, {
      duration: organicDuration.slow,
      ease: organicEase,
      scale: true,
    })
    gsap.to(clon, {
      autoAlpha: 0,
      duration: organicDuration.slow,
      ease: 'power2.in',
      onComplete: quitar,
    })
  }

  buscar(INTENTOS_FILA)
}

/**
 * Tira de propuestas de asignatura del modo agente, entre la barra de filtros y
 * la tabla.
 *
 * Alto fijo y desplazamiento horizontal: la tira es un margen de trabajo, no el
 * contenido de la página. Diez propuestas no pueden empujar la tabla fuera de la
 * pantalla.
 */
export function TiraPostIts({ planId }: { planId: string }) {
  const agente = useAgenteOpcional()
  const { data: plan } = usePlan(planId)
  const capabilities = usePlanCapabilities(plan)
  const { data: lineas } = usePlanLineas(planId)
  const { data: asignaturas } = usePlanAsignaturas(planId)
  const { data: estructuras } = useSubjectEstructuras(plan?.estructura_id)
  const { sugerencias, pedir, reintentar, descartar } =
    useSugerenciasAgente(planId)
  const lanzar = useLanzarGeneracionAsignatura()

  const enEstePlan =
    agente?.activo === true &&
    agente.ambito?.tipo === 'plan' &&
    agente.ambito.planId === planId

  if (!agente || !enEstePlan || !capabilities.canEditAsignaturas) return null

  const contexto = agente.contexto

  const colores = (lineas ?? [])
    .map((linea) => linea.color)
    .filter((color): color is string => Boolean(color))

  /**
   * Estructura con la que nace la asignatura: la más usada en el plan, porque es
   * casi siempre la que el usuario elegiría a mano. Si el plan todavía está
   * vacío, la primera del catálogo permitido.
   */
  const estructuraPorDefecto = (() => {
    const conteo = new Map<string, number>()
    for (const asignatura of asignaturas ?? []) {
      const id = asignatura.estructura_id
      if (id) conteo.set(id, (conteo.get(id) ?? 0) + 1)
    }
    const permitidas = new Set((estructuras ?? []).map((e) => e.id))
    const masUsada = [...conteo.entries()]
      .filter(([id]) => permitidas.size === 0 || permitidas.has(id))
      .sort((a, b) => b[1] - a[1])
      .at(0)?.[0]

    return masUsada ?? estructuras?.at(0)?.id ?? null
  })()

  const lanzarSugerencia = async (slot: SugerenciaSlot, nodo: HTMLElement) => {
    if (!slot.sugerencia) return

    if (!estructuraPorDefecto) {
      notify.error(
        'Este plan no tiene ninguna estructura de asignatura disponible.',
      )
      return
    }

    const adminOverrideReason = capabilities.requiresAdminOverrideForEdit
      ? await requestAdminOverrideReason(
          'crear una asignatura fuera de la etapa normal del plan',
        )
      : null
    if (capabilities.requiresAdminOverrideForEdit && !adminOverrideReason)
      return

    const { sugerencia } = slot
    const tempId = makeTempId()
    // El clon se toma antes de descartar: después, el original ya no está.
    const clon = getOrganicMotion() ? clonarParaVuelo(nodo) : null

    descartar(slot.id)
    lanzar.mutate({
      tempId,
      placeholder: {
        plan_estudio_id: planId,
        estructura_id: estructuraPorDefecto,
        nombre: sugerencia.nombre,
        codigo: sugerencia.codigo ?? null,
        tipo: sugerencia.tipo ?? undefined,
        // Los créditos que propuso la IA no se envían: la columna es generada
        // y Postgres la recalcula desde las horas. Mandarla —aunque fuera
        // `null`— hacía fallar el play con 428C9.
        horas_academicas: sugerencia.horasAcademicas ?? null,
        horas_independientes: sugerencia.horasIndependientes ?? null,
        tipo_origen: 'IA',
      },
      ia: {
        descripcionEnfoqueAcademico: sugerencia.descripcion,
        instruccionesAdicionalesIA: slot.enfoque || undefined,
      },
      adminOverrideReason,
    })

    if (clon) volarHaciaFila(clon, tempId)
  }

  const vacia = sugerencias.length === 0

  return (
    <section
      aria-label="Propuestas de asignatura del agente"
      className="group/tira border-border/60 flex items-center gap-3 overflow-x-auto border-b px-6 py-4"
    >
      {sugerencias.map((slot) => (
        <PostItSugerencia
          key={slot.id}
          slot={slot}
          colores={colores}
          puedeLanzar={Boolean(estructuraPorDefecto)}
          onDescartar={() => descartar(slot.id)}
          onReintentar={() => reintentar(slot.id)}
          onLanzar={(nodo) => void lanzarSugerencia(slot, nodo)}
        />
      ))}

      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label="Pedir a la IA otra asignatura"
            onClick={() => pedir(contexto)}
            className={cn(
              'border-border/70 text-muted-foreground flex h-32 w-56 shrink-0 flex-col items-center justify-center gap-2 rounded-xl border border-dashed transition-opacity',
              'hover:text-foreground hover:border-border focus-visible:ring-ring/40 focus-visible:ring-2 focus-visible:outline-none',
              // Discreto mientras hay propuestas que leer; imprescindible —y por
              // tanto visible— cuando la tira está vacía y es lo único que hay.
              vacia
                ? 'opacity-100'
                : 'opacity-0 group-hover/tira:opacity-40 hover:opacity-100 focus-visible:opacity-100',
            )}
          >
            <Plus className="h-5 w-5" />
            {vacia && (
              <span className="max-w-44 text-center text-xs leading-snug">
                Pide a la IA una asignatura nueva para este plan.
              </span>
            )}
          </button>
        </TooltipTrigger>
        <TooltipContent>
          {contexto
            ? `Proponer una asignatura · «${contexto}»`
            : 'Proponer una asignatura'}
        </TooltipContent>
      </Tooltip>
    </section>
  )
}
