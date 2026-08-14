import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'

import type { ReactNode } from 'react'

export type ModoVistaColeccion = 'cuadricula' | 'lista'

const CLAVE_MODO_VISTA_COLECCION = 'acad-ia:modo-vista-coleccion'
const MODO_VISTA_COLECCION_POR_DEFECTO: ModoVistaColeccion = 'cuadricula'

type ContextoModoVistaColeccion = {
  modoVistaColeccion: ModoVistaColeccion
  establecerModoVistaColeccion: (modo: ModoVistaColeccion) => void
}

const ModoVistaColeccionContext =
  createContext<ContextoModoVistaColeccion | null>(null)

function esModoVistaColeccion(valor: unknown): valor is ModoVistaColeccion {
  return valor === 'cuadricula' || valor === 'lista'
}

function leerModoVistaColeccionGuardado(): ModoVistaColeccion {
  if (typeof window === 'undefined') return MODO_VISTA_COLECCION_POR_DEFECTO

  try {
    const valorGuardado = window.localStorage.getItem(
      CLAVE_MODO_VISTA_COLECCION,
    )

    return esModoVistaColeccion(valorGuardado)
      ? valorGuardado
      : MODO_VISTA_COLECCION_POR_DEFECTO
  } catch {
    return MODO_VISTA_COLECCION_POR_DEFECTO
  }
}

export function PreferenciasVistaColeccionProvider({
  children,
}: {
  children: ReactNode
}) {
  const [modoVistaColeccion, setModoVistaColeccion] =
    useState<ModoVistaColeccion>(leerModoVistaColeccionGuardado)

  useEffect(() => {
    const sincronizarModoVista = (event: StorageEvent) => {
      if (event.key !== CLAVE_MODO_VISTA_COLECCION) return

      setModoVistaColeccion(
        esModoVistaColeccion(event.newValue)
          ? event.newValue
          : MODO_VISTA_COLECCION_POR_DEFECTO,
      )
    }

    window.addEventListener('storage', sincronizarModoVista)
    return () => window.removeEventListener('storage', sincronizarModoVista)
  }, [])

  const establecerModoVistaColeccion = useCallback(
    (modo: ModoVistaColeccion) => {
      setModoVistaColeccion(modo)

      try {
        window.localStorage.setItem(CLAVE_MODO_VISTA_COLECCION, modo)
      } catch {
        // La vista sigue funcionando si el navegador bloquea el almacenamiento.
      }
    },
    [],
  )

  const value = useMemo(
    () => ({ modoVistaColeccion, establecerModoVistaColeccion }),
    [modoVistaColeccion, establecerModoVistaColeccion],
  )

  return (
    <ModoVistaColeccionContext value={value}>
      {children}
    </ModoVistaColeccionContext>
  )
}

export function useModoVistaColeccion() {
  const contexto = useContext(ModoVistaColeccionContext)

  if (!contexto) {
    throw new Error(
      'useModoVistaColeccion debe usarse dentro de PreferenciasVistaColeccionProvider.',
    )
  }

  return contexto
}
