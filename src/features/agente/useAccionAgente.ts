import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'

import { ambitoKey, useAgenteOpcional } from './AgenteContext'
import { CLASE_HALO, estiloHaloAgente } from './AgenteHalo'

import type { VarianteHalo } from './AgenteHalo'
import type {
  AgenteAccionTipo,
  AgenteReasoningEffort,
} from '@/data/api/agente.api'
import type {
  CSSProperties,
  KeyboardEvent,
  PointerEvent,
  MouseEvent,
} from 'react'

import { esRechazo } from '@/data/api/agente.api'
import { mensajeErrorAgente, useAgenteAccion } from '@/data/hooks/useAgente'
import { conInteraccionAgente } from '@/data/supabase/agenteHeaders'
import { notify } from '@/lib/toast'

/**
 * Cómo se acopla la acción al elemento existente:
 *
 * - `'captura'` — el elemento conserva su aspecto y su rol, pero en modo agente
 *   el clic lo intercepta la IA en fase de captura: no se abre el editor
 *   inline, se ejecuta el ajuste. Es lo que aplica a selects, números, nombres
 *   de asignatura, unidades, temas, criterios, porcentajes, créditos y horas.
 * - `'boton'` — el elemento original no se toca y la acción vive en un
 *   disparador aparte. Es lo que aplica a los campos de texto enriquecido, cuyo
 *   cuerpo debe seguir siendo editable a mano.
 */
export type ModoAcoplamiento = 'captura' | 'boton'

/**
 * Identidad estable de la acción de un campo. Se comparte para que un
 * componente que no llama a `useAccionAgente` —la tarjeta que envuelve al
 * editor, por ejemplo— pueda leer del contexto si ese campo está en curso, en
 * vez de duplicar el estado hacia arriba.
 */
export function idCampoAgente(
  entidad: string,
  entidadId: string,
  clave: string,
): string {
  return `campo:${entidad}:${entidadId}:${clave}`
}

export type OpcionesAccionAgente<TResultado, TSnapshot> = {
  /** Identidad estable del elemento; distingue qué está en curso ahora mismo. */
  id?: string
  accion: AgenteAccionTipo
  /** Texto que verá el usuario en el dock al deshacer ("Reasignar Cálculo I"). */
  etiqueta: string
  /** Datos que la acción necesita en el backend. Se evalúa al ejecutar. */
  payload: () => Record<string, unknown>
  /**
   * Estado previo, capturado justo antes de aplicar el resultado. Recibe el
   * resultado porque hay acciones cuyo "antes" sólo se sabe una vez que el
   * modelo dijo sobre qué actúa: en `proponer_para_celda` la asignatura que hay
   * que recordar es la que la IA acaba de elegir.
   */
  snapshot: (resultado: TResultado) => TSnapshot
  /**
   * Aplica el resultado de la IA con los hooks optimistas del dominio. Recibe
   * también el snapshot para poder anotarle lo que sólo se conoce al aplicar
   * —los ids de las líneas que hubo que crear, por ejemplo— y que `restaurar`
   * pueda deshacerlo.
   */
  aplicar: (resultado: TResultado, snapshot: TSnapshot) => Promise<void> | void
  /** Devuelve el estado al snapshot. Debe usar los mismos hooks que `aplicar`. */
  restaurar: (snapshot: TSnapshot) => Promise<void> | void
  modo?: ModoAcoplamiento
  /** Qué anunciará el lector de pantalla en modo agente. */
  ariaLabel?: string
  /** Desactiva la agentificación sin desmontar el hook (permisos, estado, …). */
  disabled?: boolean
  /** Paleta de líneas curriculares para el halo, si la superficie la conoce. */
  colores?: Array<string> | null
  /** Marco completo (por defecto) o sólo el subrayado encendido. */
  varianteHalo?: VarianteHalo
  reasoningEffort?: AgenteReasoningEffort
}

type PropsCaptura = {
  onPointerDownCapture: (event: PointerEvent<HTMLElement>) => void
  onClickCapture: (event: MouseEvent<HTMLElement>) => void
  onKeyDownCapture: (event: KeyboardEvent<HTMLElement>) => void
  'data-agente': string
  'aria-busy': boolean
  'aria-label'?: string
}

type PropsBoton = {
  onClick: () => void
  disabled: boolean
  'data-agente': string
  'aria-busy': boolean
  'aria-label'?: string
}

export type ResultadoAccionAgente = {
  /** El modo está activo y este elemento participa. */
  enModoAgente: boolean
  /** Hay una petición de este elemento en vuelo. */
  ejecutando: boolean
  /** Motivo del último rechazo razonado; se autodescarta a los 5 s. */
  rechazo: string | null
  descartarRechazo: () => void
  ejecutar: () => Promise<void>
  /**
   * Props de interceptación. En `'captura'` se ponen en el propio control o en
   * un envoltorio que lo contenga; en `'boton'`, en el disparador aparte.
   * Fuera del modo agente el objeto va vacío, así que el control se comporta
   * exactamente como antes.
   */
  props: PropsCaptura | PropsBoton | Record<string, never>
  /** Clase y variables del borde arcoíris mientras la IA procesa. */
  halo: { className?: string; style?: CSSProperties }
}

const DURACION_RECHAZO_MS = 5000

/**
 * Convierte cualquier elemento de la interfaz en un disparador del modo agente.
 *
 * La pieza clave del modo: en vez de replicar la lógica de IA en cada una de
 * las superficies (datos generales, mapa, contenido temático, evaluación,
 * bibliografía, seriación), cada una declara *qué* pide, *cómo* se aplica y
 * *cómo* se revierte, y este hook se encarga del resto — contexto, sesión,
 * rechazos, errores en español, halo y registro en la pila de deshacer.
 *
 * Fuera del modo agente es inerte: devuelve `props` vacías, así que el control
 * original conserva su comportamiento normal sin ramas en el consumidor.
 */
export function useAccionAgente<TResultado = unknown, TSnapshot = unknown>(
  opciones: OpcionesAccionAgente<TResultado, TSnapshot>,
): ResultadoAccionAgente {
  const {
    accion,
    etiqueta,
    payload,
    snapshot,
    aplicar,
    restaurar,
    modo = 'captura',
    ariaLabel,
    disabled = false,
    colores,
    varianteHalo = 'borde',
    reasoningEffort,
  } = opciones

  const agente = useAgenteOpcional()
  const idAuto = useId()
  const id = opciones.id ?? idAuto
  const mutacion = useAgenteAccion()

  const [rechazo, setRechazo] = useState<string | null>(null)
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null)

  // El temporizador del rechazo es un recurso externo: se cancela al desmontar
  // para no llamar a `setState` sobre un componente que ya no existe.
  useEffect(
    () => () => {
      if (temporizador.current) clearTimeout(temporizador.current)
    },
    [],
  )

  const descartarRechazo = useCallback(() => {
    if (temporizador.current) clearTimeout(temporizador.current)
    setRechazo(null)
  }, [])

  const activo = Boolean(agente?.activo)
  const ambito = agente?.ambito ?? null
  const enModoAgente = activo && ambito !== null && !disabled
  const ejecutando = Boolean(agente?.enCurso.has(id))

  // Los callbacks del consumidor cambian en cada render (son closures sobre sus
  // props). Un ref evita que `ejecutar` se reconstruya —y con él las props del
  // control— en cada pintado, sin renunciar a leer siempre la versión actual.
  const refs = useRef({ payload, snapshot, aplicar, restaurar, etiqueta })
  refs.current = { payload, snapshot, aplicar, restaurar, etiqueta }

  const ejecutar = useCallback(async () => {
    // `enModoAgente` ya implica `ambito !== null`; TypeScript lo estrecha solo.
    if (!agente || !enModoAgente || ejecutando) return

    if (!agente.sesionId) return

    // El contexto es opcional a propósito: señalar un elemento ya es una
    // intención completa, y el backend decide con el criterio académico general
    // cuando no hay palabras que lo acoten.
    const contexto = agente.contexto.trim()

    descartarRechazo()
    agente.marcarEnCurso(id, true)

    try {
      const salida = await mutacion.mutateAsync({
        accion,
        ambito,
        contexto,
        sesion_id: agente.sesionId,
        payload: refs.current.payload(),
        ...(reasoningEffort ? { reasoning_effort: reasoningEffort } : {}),
      })

      // Un rechazo razonado no es un fallo: la IA concluyó que no hay nada que
      // cambiar. Se muestra como información y no entra en la pila de deshacer,
      // porque no hubo cambio que deshacer.
      if (esRechazo(salida)) {
        setRechazo(salida.rechazo.motivo)
        notify.info(salida.rechazo.motivo)
        temporizador.current = setTimeout(
          () => setRechazo(null),
          DURACION_RECHAZO_MS,
        )
        return
      }

      const resultado = salida.resultado as TResultado
      const previo = refs.current.snapshot(resultado)
      const interaccionId = salida.interaccion_id ?? null

      // `conInteraccionAgente` marca las escrituras que hace `aplicar` con la
      // interacción de IA que las originó: las cabeceras las recoge la capa de
      // datos y acaban en `cambios_plan` / `cambios_asignatura`.
      await conInteraccionAgente(interaccionId, () =>
        refs.current.aplicar(resultado, previo),
      )

      const claveAmbito = ambitoKey(ambito)
      const etiquetaEntrada = refs.current.etiqueta
      const restaurarActual = refs.current.restaurar
      const aplicarActual = refs.current.aplicar

      agente.registrar({
        etiqueta: etiquetaEntrada,
        ambito: claveAmbito,
        // Rehacer reaplica el MISMO resultado: nunca vuelve a consultar al
        // modelo, así que deshacer/rehacer es determinista y gratis.
        rehacer: async () => {
          await conInteraccionAgente(interaccionId, () =>
            aplicarActual(resultado, previo),
          )
        },
        deshacer: async () => {
          await conInteraccionAgente(interaccionId, () =>
            restaurarActual(previo),
          )
        },
      })
    } catch (error) {
      notify.error(mensajeErrorAgente(error))
    } finally {
      agente.marcarEnCurso(id, false)
    }
  }, [
    agente,
    enModoAgente,
    ambito,
    ejecutando,
    id,
    accion,
    mutacion,
    reasoningEffort,
    descartarRechazo,
  ])

  const props = useMemo<
    PropsCaptura | PropsBoton | Record<string, never>
  >(() => {
    if (!enModoAgente) return {}

    if (modo === 'boton') {
      return {
        onClick: () => {
          void ejecutar()
        },
        disabled: ejecutando,
        'data-agente': accion,
        'aria-busy': ejecutando,
        ...(ariaLabel ? { 'aria-label': ariaLabel } : {}),
      } satisfies PropsBoton
    }

    const interceptar = (event: {
      preventDefault: () => void
      stopPropagation: () => void
    }) => {
      event.preventDefault()
      event.stopPropagation()
    }

    return {
      // Radix (Select, DropdownMenu, Popover) abre en `pointerdown`, no en
      // `click`: sin interceptar aquí el menú se abriría igualmente y la acción
      // de IA quedaría por detrás de un panel abierto.
      onPointerDownCapture: (event: PointerEvent<HTMLElement>) => {
        interceptar(event)
      },
      onClickCapture: (event: MouseEvent<HTMLElement>) => {
        interceptar(event)
        void ejecutar()
      },
      onKeyDownCapture: (event: KeyboardEvent<HTMLElement>) => {
        if (event.key !== 'Enter' && event.key !== ' ') return
        interceptar(event)
        void ejecutar()
      },
      'data-agente': accion,
      'aria-busy': ejecutando,
      ...(ariaLabel ? { 'aria-label': ariaLabel } : {}),
    } satisfies PropsCaptura
  }, [enModoAgente, modo, ejecutar, ejecutando, accion, ariaLabel])

  const halo = useMemo(
    () =>
      ejecutando
        ? {
            className: CLASE_HALO[varianteHalo],
            style: estiloHaloAgente(colores),
          }
        : {},
    [ejecutando, colores, varianteHalo],
  )

  return {
    enModoAgente,
    ejecutando,
    rechazo,
    descartarRechazo,
    ejecutar,
    props,
    halo,
  }
}
