import { useRouterState } from '@tanstack/react-router'
import {
  createContext,
  use,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

import type { Esquina } from '@/lib/agent-position'
import type { ReactNode } from 'react'

import { setSesionAgente } from '@/data/supabase/agenteHeaders'
import { ESQUINAS } from '@/lib/agent-position'

export type AmbitoAgente =
  | { tipo: 'plan'; planId: string }
  | { tipo: 'asignatura'; asignaturaId: string; planId: string }

/** Clave de ámbito: filtra la pila de deshacer para no mezclar plan y asignatura. */
export function ambitoKey(ambito: AmbitoAgente): string {
  return ambito.tipo === 'plan'
    ? `plan:${ambito.planId}`
    : `asignatura:${ambito.asignaturaId}`
}

/**
 * Una acción ya ejecutada y resuelta: `rehacer` vuelve a aplicar el MISMO
 * resultado de IA (no vuelve a preguntar al modelo) y `deshacer` restaura el
 * snapshot tomado justo antes de aplicarlo.
 */
export type EntradaPila = {
  etiqueta: string
  ambito: string
  rehacer: () => Promise<void>
  deshacer: () => Promise<void>
}

/**
 * `abierto` (dock montado) y `activo` (acciones armadas, aurora encendida) van
 * siempre juntos: entrar al modo lo enciende todo y detenerlo lo apaga todo.
 *
 * Se conservan como dos campos porque los consumidores preguntan cosas
 * distintas —el menú contextual quiere saber si el dock ocupa la pantalla, las
 * superficies si sus controles están agentificados— y porque un estado
 * persistido de una versión anterior podía traerlos desparejados.
 *
 * Un modo agente "en pausa" no existe a propósito: mientras el dock está
 * puesto, el FAB del menú contextual se retira (ver `ContextualActionsMenu`),
 * así que una pausa dejaría al usuario sin ninguno de los dos repertorios de
 * acciones.
 */
type EstadoPersistido = {
  abierto: boolean
  activo: boolean
  contexto: string
  sesionId: string | null
  /** Plan al que pertenece la sesión; cruzar ese límite la detiene. */
  planIdSesion: string | null
  esquina: Esquina
}

const CLAVE_ALMACEN = 'acadia.agente.v1'
const LIMITE_PILA = 50

const ESTADO_INICIAL: EstadoPersistido = {
  abierto: false,
  activo: false,
  contexto: '',
  sesionId: null,
  planIdSesion: null,
  esquina: 'inferior-derecha',
}

function leerEstado(): EstadoPersistido {
  if (typeof window === 'undefined') return ESTADO_INICIAL
  try {
    const crudo = window.sessionStorage.getItem(CLAVE_ALMACEN)
    if (!crudo) return ESTADO_INICIAL
    const parsed = JSON.parse(crudo) as Partial<EstadoPersistido>
    const abierto = Boolean(parsed.abierto)
    return {
      abierto,
      // Van siempre juntos; un estado desparejado guardado por una versión
      // anterior dejaría un dock inerte o un modo activo sin forma de pararlo.
      activo: abierto,
      contexto: typeof parsed.contexto === 'string' ? parsed.contexto : '',
      sesionId: typeof parsed.sesionId === 'string' ? parsed.sesionId : null,
      planIdSesion:
        typeof parsed.planIdSesion === 'string' ? parsed.planIdSesion : null,
      esquina:
        parsed.esquina && ESQUINAS.includes(parsed.esquina)
          ? parsed.esquina
          : 'inferior-derecha',
    }
  } catch {
    return ESTADO_INICIAL
  }
}

function escribirEstado(estado: EstadoPersistido) {
  try {
    window.sessionStorage.setItem(CLAVE_ALMACEN, JSON.stringify(estado))
  } catch {
    /* noop — almacenamiento lleno o deshabilitado */
  }
}

export type AgenteContextValue = {
  /** El dock está montado. */
  abierto: boolean
  /** Las acciones están armadas y la aurora encendida. */
  activo: boolean
  ambito: AmbitoAgente | null
  contexto: string
  sesionId: string | null
  esquina: Esquina
  /** Ids de elementos con una acción en vuelo ahora mismo. */
  enCurso: ReadonlySet<string>
  /** Alterna el dock desde el menú contextual. Abrirlo ya arranca el modo. */
  alternarDock: () => void
  iniciar: () => void
  detener: () => void
  setContexto: (valor: string) => void
  setEsquina: (esquina: Esquina) => void
  marcarEnCurso: (id: string, activo: boolean) => void
  registrar: (entrada: EntradaPila) => void
  puedeDeshacer: boolean
  puedeRehacer: boolean
  deshacer: () => Promise<void>
  rehacer: () => Promise<void>
}

const AgenteContext = createContext<AgenteContextValue | null>(null)

/**
 * Deriva el ámbito de la ruta actual. La URL sigue siendo la fuente de verdad;
 * el estado persistido guarda únicamente el plan que limita la sesión, no una
 * copia del ámbito actual.
 */
function useAmbitoDeRuta(): AmbitoAgente | null {
  return useRouterState({
    select: (state) => {
      const params = state.matches.reduce<Record<string, string>>(
        (acc, match) => Object.assign(acc, match.params),
        {},
      )
      const planId = params.planId
      if (!planId) return null
      if (params.asignaturaId) {
        return {
          tipo: 'asignatura' as const,
          asignaturaId: params.asignaturaId,
          planId,
        }
      }
      return { tipo: 'plan' as const, planId }
    },
  })
}

export function AgenteProvider({ children }: { children: ReactNode }) {
  const [estado, setEstado] = useState<EstadoPersistido>(leerEstado)
  const ambito = useAmbitoDeRuta()
  const planIdActual = ambito?.planId ?? null
  const sesionEnPlanActual = Boolean(
    planIdActual &&
    (!estado.planIdSesion || estado.planIdSesion === planIdActual),
  )

  // La pila guarda closures, así que vive en memoria y no se persiste. Un ref
  // evita re-render por cada push; los contadores expuestos abajo son los que
  // disparan el re-pintado del dock.
  const hechasRef = useRef<Array<EntradaPila>>([])
  const deshechasRef = useRef<Array<EntradaPila>>([])
  const [version, setVersion] = useState(0)
  const [enCurso, setEnCurso] = useState<ReadonlySet<string>>(() => new Set())

  // Sincroniza la sesión con la capa de datos, que es un sistema externo a
  // React: `plans.api.ts` y compañía son funciones asíncronas planas y no pueden
  // leer este contexto, pero sí necesitan adjuntar las cabeceras `x-agente-*`
  // para que la auditoría agrupe los cambios (ver `agenteHeaders.ts`). Éste es
  // el caso de uso legítimo de `useEffect`: sincronización con algo de fuera.
  useEffect(() => {
    setSesionAgente(
      estado.activo && sesionEnPlanActual && estado.sesionId
        ? { sesionId: estado.sesionId, contexto: estado.contexto }
        : null,
    )
  }, [estado.activo, estado.sesionId, estado.contexto, sesionEnPlanActual])

  // Desmontar el provider (logout, remonte del root) no debe dejar cabeceras
  // colgando en el módulo.
  useEffect(() => () => setSesionAgente(null), [])

  const actualizar = useCallback((parcial: Partial<EstadoPersistido>) => {
    setEstado((previo) => {
      const siguiente = { ...previo, ...parcial }
      escribirEstado(siguiente)
      return siguiente
    })
  }, [])

  const vaciarPila = useCallback(() => {
    hechasRef.current = []
    deshechasRef.current = []
    setVersion((v) => v + 1)
  }, [])

  const iniciar = useCallback(() => {
    if (!planIdActual) return
    vaciarPila()
    setEnCurso(new Set())
    actualizar({
      abierto: true,
      activo: true,
      sesionId: crypto.randomUUID(),
      planIdSesion: planIdActual,
    })
  }, [actualizar, planIdActual, vaciarPila])

  /**
   * Detener sale del modo por completo: desmonta el dock y devuelve el FAB del
   * menú contextual, que es la única forma de volver a entrar.
   *
   * También vacía la pila: los comandos inversos guardan closures sobre el
   * estado de la sesión, y ofrecer "deshacer" de una sesión ya cerrada
   * prometería una reversión que puede haber quedado obsoleta.
   */
  const detener = useCallback(() => {
    vaciarPila()
    setEnCurso(new Set())
    actualizar({
      abierto: false,
      activo: false,
      sesionId: null,
      planIdSesion: null,
      contexto: '',
    })
  }, [actualizar, vaciarPila])

  const alternarDock = useCallback(() => {
    if (estado.abierto) detener()
    else iniciar()
  }, [estado.abierto, detener, iniciar])

  // La sesión sólo atraviesa rutas del mismo plan (tabs y asignaturas). Salir
  // al listado, administración o autenticación —o abrir otro plan— equivale a
  // pulsar "Detener": limpia dock, cabeceras, contexto y pila de deshacer.
  useEffect(() => {
    if (!estado.activo) return

    if (
      !planIdActual ||
      (estado.planIdSesion && estado.planIdSesion !== planIdActual)
    ) {
      detener()
      return
    }

    // Migra una sesión guardada por la versión anterior sin dejarla escapar
    // del plan en el que se restauró.
    if (!estado.planIdSesion) actualizar({ planIdSesion: planIdActual })
  }, [actualizar, detener, estado.activo, estado.planIdSesion, planIdActual])

  const setContexto = useCallback(
    (valor: string) => actualizar({ contexto: valor }),
    [actualizar],
  )

  const setEsquina = useCallback(
    (esquina: Esquina) => actualizar({ esquina }),
    [actualizar],
  )

  const marcarEnCurso = useCallback((id: string, corriendo: boolean) => {
    setEnCurso((previo) => {
      if (corriendo === previo.has(id)) return previo
      const siguiente = new Set(previo)
      if (corriendo) siguiente.add(id)
      else siguiente.delete(id)
      return siguiente
    })
  }, [])

  const registrar = useCallback((entrada: EntradaPila) => {
    hechasRef.current = [...hechasRef.current, entrada].slice(-LIMITE_PILA)
    // Una acción nueva invalida la rama de rehacer: es el modelo mental
    // universal de deshacer/rehacer y evita reaplicar resultados sobre un
    // estado que ya divergió.
    deshechasRef.current = []
    setVersion((v) => v + 1)
  }, [])

  const clave = ambito ? ambitoKey(ambito) : null

  /** Última entrada de la pila que pertenece al ámbito actual, o -1. */
  function ultimaDelAmbito(pila: Array<EntradaPila>, ambitoActual: string) {
    for (let i = pila.length - 1; i >= 0; i -= 1) {
      if (pila[i].ambito === ambitoActual) return i
    }
    return -1
  }

  const deshacer = useCallback(async () => {
    if (!clave) return
    const indice = ultimaDelAmbito(hechasRef.current, clave)
    if (indice < 0) return
    const entrada = hechasRef.current[indice]
    hechasRef.current = hechasRef.current.filter((_, i) => i !== indice)
    setVersion((v) => v + 1)
    await entrada.deshacer()
    deshechasRef.current = [...deshechasRef.current, entrada]
    setVersion((v) => v + 1)
  }, [clave])

  const rehacer = useCallback(async () => {
    if (!clave) return
    const indice = ultimaDelAmbito(deshechasRef.current, clave)
    if (indice < 0) return
    const entrada = deshechasRef.current[indice]
    deshechasRef.current = deshechasRef.current.filter((_, i) => i !== indice)
    setVersion((v) => v + 1)
    await entrada.rehacer()
    hechasRef.current = [...hechasRef.current, entrada]
    setVersion((v) => v + 1)
  }, [clave])

  const value = useMemo<AgenteContextValue>(() => {
    void version // recalcula los contadores cuando la pila cambia
    return {
      // La limpieza persistida ocurre en un efecto; estos guards hacen que la
      // UI y las cabeceras se apaguen desde el primer render fuera del plan.
      abierto: estado.abierto && sesionEnPlanActual,
      activo: estado.activo && sesionEnPlanActual,
      ambito,
      contexto: estado.contexto,
      sesionId: estado.sesionId,
      esquina: estado.esquina,
      enCurso,
      alternarDock,
      iniciar,
      detener,
      setContexto,
      setEsquina,
      marcarEnCurso,
      registrar,
      puedeDeshacer: clave
        ? hechasRef.current.some((e) => e.ambito === clave)
        : false,
      puedeRehacer: clave
        ? deshechasRef.current.some((e) => e.ambito === clave)
        : false,
      deshacer,
      rehacer,
    }
  }, [
    estado,
    ambito,
    clave,
    sesionEnPlanActual,
    enCurso,
    version,
    alternarDock,
    iniciar,
    detener,
    setContexto,
    setEsquina,
    marcarEnCurso,
    registrar,
    deshacer,
    rehacer,
  ])

  return <AgenteContext value={value}>{children}</AgenteContext>
}

export function useAgente(): AgenteContextValue {
  const ctx = use(AgenteContext)
  if (!ctx) {
    throw new Error('useAgente debe usarse dentro de <AgenteProvider>.')
  }
  return ctx
}

/**
 * Variante segura para componentes que también se montan fuera del provider
 * (p. ej. primitivas compartidas con rutas públicas).
 */
export function useAgenteOpcional(): AgenteContextValue | null {
  return use(AgenteContext)
}
