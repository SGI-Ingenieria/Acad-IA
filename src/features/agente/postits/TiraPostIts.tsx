import { useNavigate } from '@tanstack/react-router'
import { Plus, Settings2 } from 'lucide-react'
import { useState } from 'react'

import { useAgenteOpcional } from '../AgenteContext'

import { PostItSugerencia } from './PostItSugerencia'

import type { SugerenciaSlot } from '@/data'

import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  usePlan,
  usePlanLineas,
  usePermissions,
  useCreateLinea,
  useLanzarGeneracionAsignatura,
  useSubjectEstructuraDelPlan,
  useSugerenciasAgente,
} from '@/data'
import {
  requestAdminOverrideReason,
  usePlanCapabilities,
} from '@/data/auth/planCapabilities'
import {
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

/** La fila nace por separado: no debe deformar el post-it para parecer la tabla. */
function animarEntradaFila(tempId: string) {
  const buscar = (intentos: number) => {
    const fila = document.querySelector<HTMLElement>(
      `[data-asignatura-id="${tempId}"]`,
    )

    if (!fila) {
      if (intentos <= 0) return
      requestAnimationFrame(() => buscar(intentos - 1))
      return
    }

    gsap.fromTo(
      fila,
      { autoAlpha: 0, y: -8 },
      {
        autoAlpha: 1,
        y: 0,
        duration: organicDuration.quick,
        ease: organicEase,
        overwrite: 'auto',
      },
    )
  }

  buscar(INTENTOS_FILA)
}

function normalizarTexto(value: string) {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase('es-MX')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
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
  const navigate = useNavigate()
  const { data: plan } = usePlan(planId)
  const capabilities = usePlanCapabilities(plan)
  const permissions = usePermissions()
  const { data: lineas } = usePlanLineas(planId)
  const { estructura: estructuraDelPlan, isLoading: cargandoEstructura } =
    useSubjectEstructuraDelPlan(plan?.estructura_id)
  const { sugerencias, pedir, reintentar, descartar } =
    useSugerenciasAgente(planId)
  const lanzar = useLanzarGeneracionAsignatura()
  const crearLinea = useCreateLinea()
  const [slotEnLanzamiento, setSlotEnLanzamiento] = useState<string | null>(
    null,
  )

  const enEstePlan =
    agente?.activo === true &&
    agente.ambito?.tipo === 'plan' &&
    agente.ambito.planId === planId

  if (!agente || !enEstePlan || !capabilities.canEditAsignaturas) return null

  const contexto = agente.contexto

  const colores = (lineas ?? [])
    .map((linea) => linea.color)
    .filter((color): color is string => Boolean(color))

  // La relación entre plantilla del plan y de asignatura es 1:1. Consultarla
  // directamente evita que el botón Play dependa de un catálogo momentáneamente
  // vacío o de otra plantilla usada por una asignatura vieja.
  const estructuraPorDefecto = estructuraDelPlan?.id ?? null

  if (!cargandoEstructura && !estructuraPorDefecto) {
    const puedeConfigurar = permissions.has('catalogos.gestionar')
    return (
      <section
        aria-label="Configuración requerida para crear asignaturas"
        className="border-warning/30 bg-warning/5 border-b px-6 py-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-foreground text-sm font-semibold">
              Falta configurar la plantilla de asignaturas
            </p>
            <p className="text-muted-foreground mt-1 text-sm">
              Este plan necesita una plantilla de asignatura antes de crear o
              generar propuestas.
            </p>
          </div>
          {puedeConfigurar ? (
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                void navigate({
                  to: '/administracion/estructuras/$modo/{-$id}/plantillas',
                  params: {
                    modo: 'planes',
                    id: plan?.estructura_id ?? undefined,
                  },
                })
              }
            >
              <Settings2 className="size-4" />
              Configurar plantilla
            </Button>
          ) : null}
        </div>
      </section>
    )
  }

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

    const crear = async () => {
      const { sugerencia } = slot
      const nombreLineaSolicitada = sugerencia.lineaCurricular.trim() || null
      const nombreContexto = contexto.trim()
      const lineaExistente = (lineas ?? []).find((linea) => {
        const nombreNormalizado = normalizarTexto(linea.nombre)
        return (
          (nombreLineaSolicitada &&
            nombreNormalizado === normalizarTexto(nombreLineaSolicitada)) ||
          (!nombreLineaSolicitada &&
            nombreNormalizado.length > 2 &&
            normalizarTexto(nombreContexto).includes(nombreNormalizado))
        )
      })

      let lineaPlanId = lineaExistente?.id ?? null
      let nombreLinea = lineaExistente?.nombre ?? null

      if (!lineaPlanId && nombreLineaSolicitada) {
        const nuevaLinea = await crearLinea.mutateAsync({
          plan_estudio_id: planId,
          nombre: nombreLineaSolicitada,
          orden:
            Math.max(-1, ...(lineas ?? []).map((linea) => linea.orden)) + 1,
          color: null,
          adminOverrideReason,
        })
        lineaPlanId = nuevaLinea.id
        nombreLinea = nuevaLinea.nombre
        notify.success(`Se creó la línea curricular “${nuevaLinea.nombre}”.`)
      }

      const tempId = makeTempId()
      lanzar.mutate(
        {
          tempId,
          placeholder: {
            plan_estudio_id: planId,
            estructura_id: estructuraPorDefecto,
            nombre: sugerencia.nombre,
            codigo: sugerencia.codigo ?? null,
            tipo: sugerencia.tipo ?? undefined,
            numero_ciclo:
              sugerencia.numeroCiclo &&
              sugerencia.numeroCiclo <= (plan?.numero_ciclos ?? 0)
                ? sugerencia.numeroCiclo
                : null,
            linea_plan_id: lineaPlanId,
            // Los créditos que propuso la IA no se envían: la columna es generada
            // y Postgres la recalcula desde las horas.
            horas_academicas: sugerencia.horasAcademicas ?? null,
            horas_independientes: sugerencia.horasIndependientes ?? null,
            tipo_origen: 'IA',
          },
          ia: {
            descripcionEnfoqueAcademico: sugerencia.descripcion,
            instruccionesAdicionalesIA: slot.enfoque || undefined,
          },
          adminOverrideReason,
        },
        {
          onSuccess: ({ asignatura }) => {
            notify.success(`Se creó la asignatura “${asignatura.nombre}”.`, {
              description: nombreLinea
                ? `Se agregó a la línea curricular “${nombreLinea}”.`
                : 'Puedes ubicarla en el mapa curricular cuando lo necesites.',
            })
          },
        },
      )
      animarEntradaFila(tempId)
    }

    setSlotEnLanzamiento(slot.id)
    const terminar = () => {
      descartar(slot.id)
      void crear()
        .catch((error) => notify.error(error))
        .finally(() => setSlotEnLanzamiento(null))
    }

    if (getOrganicMotion()) {
      gsap.to(nodo, {
        autoAlpha: 0,
        y: -8,
        scale: 0.96,
        duration: organicDuration.quick,
        ease: organicEase,
        overwrite: 'auto',
        onComplete: terminar,
      })
    } else {
      terminar()
    }
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
          puedeLanzar={Boolean(estructuraPorDefecto) && !cargandoEstructura}
          lanzando={slotEnLanzamiento === slot.id}
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
