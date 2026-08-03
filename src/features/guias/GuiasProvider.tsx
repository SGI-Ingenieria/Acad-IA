import { useRouterState } from '@tanstack/react-router'
import { driver } from 'driver.js'
import 'driver.js/dist/driver.css'
import { useEffect, useMemo, useRef } from 'react'

import type { DriveStep } from 'driver.js'

import { useGuardarProgresoGuia, useProgresoGuia } from '@/data/hooks/useGuias'

const GUIA_VERSION = 1
export const INICIAR_GUIA_EVENT = 'acad-ia:iniciar-guia'
const GUIA_ACTIVA_GLOBAL = '__acadIaGuiaActiva'

type RecorridoActivo = ReturnType<typeof driver>
type WindowConGuia = Window & {
  [GUIA_ACTIVA_GLOBAL]?: RecorridoActivo
}

function guiaActivaGlobal() {
  return (window as WindowConGuia)[GUIA_ACTIVA_GLOBAL]
}

function registrarGuiaActiva(recorrido?: RecorridoActivo) {
  const ventana = window as WindowConGuia
  if (recorrido) {
    ventana[GUIA_ACTIVA_GLOBAL] = recorrido
  } else {
    delete ventana[GUIA_ACTIVA_GLOBAL]
  }
}

type Guia = {
  clave: string
  pasos: Array<DriveStep>
}

/** `/planes/<id>` sin subruta, con o sin barra final: los datos generales. */
const RUTA_PLAN_INDICE = /^\/planes\/[^/]+\/?$/

function guiaParaRuta(pathname: string): Guia | null {
  if (pathname === '/') {
    return {
      clave: 'portada',
      pasos: [
        {
          element: '[data-guia="inicio-mesa-trabajo"]',
          popover: {
            title: 'Tu mesa de trabajo',
            description:
              'Aquí encuentras decisiones y actividades concretas de acuerdo con tu responsabilidad actual.',
          },
        },
        {
          element: '[data-guia="selector-contexto"]',
          popover: {
            title: 'Cambia de perspectiva',
            description:
              'Si tienes más de un rol o ámbito, puedes cambiarlo sin alterar tus permisos reales.',
          },
        },
        {
          element: '[data-guia="requiere-atencion"]',
          popover: {
            title: 'Empieza por lo importante',
            description:
              'Esta bandeja reúne revisiones, bloqueos y decisiones que necesitan tu participación.',
          },
        },
        {
          element: '[data-guia="continuar-trabajo"]',
          popover: {
            title: 'Retoma donde lo dejaste',
            description:
              'Los planes recientes conservan su fase curricular recomendada.',
          },
        },
      ],
    }
  }

  if (pathname === '/planes') {
    return {
      clave: 'lista-planes',
      pasos: [
        {
          element: '[data-guia="planes-encabezado"]',
          popover: {
            title: 'Planes de estudio',
            description:
              'Esta vista reúne los planes disponibles según tu rol y ámbito académico.',
          },
        },
        {
          element: '[data-guia="planes-busqueda-filtros"]',
          popover: {
            title: 'Encuentra el plan correcto',
            description:
              'Busca por nombre, cambia el orden o limita los resultados con filtros académicos.',
          },
        },
        {
          element: '[data-guia="planes-resultados"]',
          popover: {
            title: 'Abre un plan',
            description:
              'Cada ficha muestra procedencia, etapa y duración. Selecciónala para continuar en su fase curricular vigente.',
          },
        },
        {
          element: '[data-guia="planes-crear"]',
          popover: {
            title: 'Crea un plan de estudios',
            description:
              'Si tu rol lo permite, puedes comenzar un plan vacío, asistido por IA o a partir de otra fuente.',
          },
        },
      ],
    }
  }

  if (pathname === '/planes/nuevo') {
    return {
      clave: 'creacion-plan',
      pasos: [
        {
          element: '[data-guia="metodo-creacion-plan"]',
          popover: {
            title: 'Elige cómo comenzar',
            description:
              'Puedes crear un plan vacío, construirlo con IA o partir de una fuente existente.',
          },
        },
        {
          element: '[data-guia="tipo-plan"]',
          skipMissingElement: true,
          waitForElement: 800,
          popover: {
            title: 'Define la naturaleza del plan',
            description:
              'El tipo decide la plantilla normativa, cómo se construye el nombre y qué datos pedirá el resto del asistente.',
          },
        },
        {
          element: '[data-guia="ambito-academico"]',
          skipMissingElement: true,
          waitForElement: 800,
          popover: {
            title: 'Dónde vive el plan',
            description:
              'Primero la facultad y después la carrera. De la carrera salen el nombre del plan, el tipo de ciclo y cuántos hay, así que se pregunta antes que nada.',
          },
        },
        {
          element: '[data-guia="nombre-plan-construido"]',
          skipMissingElement: true,
          waitForElement: 800,
          popover: {
            title: 'Así se construye el nombre',
            description:
              'El nombre combina el nivel académico, la carrera y el inicio de impartición. Si la carrera no tiene nivel, usa sólo la carrera y la fecha.',
          },
        },
        {
          element: '[data-guia="inicio-imparticion"]',
          skipMissingElement: true,
          waitForElement: 800,
          popover: {
            title: 'Cambia el inicio de impartición',
            description:
              'Sólo este tramo es editable: indica el mes y el año en que inicia la primera generación. Haz clic para cambiarlo; la versión normativa recomendada se recalcula con la nueva fecha.',
          },
        },
        {
          element: '[data-guia="version-normativa"]',
          skipMissingElement: true,
          waitForElement: 800,
          popover: {
            title: 'Versión normativa trazable',
            description:
              'La recomendación depende del inicio de impartición. Puedes cambiarla con una justificación.',
          },
        },
        {
          element: '[data-guia="aclaraciones-ia"]',
          skipMissingElement: true,
          waitForElement: 800,
          popover: {
            title: 'Aclara antes de generar',
            description:
              'Las preguntas convierten tu intención en un brief curricular verificable.',
          },
        },
        {
          element: '[data-guia="resumen-plan"]',
          skipMissingElement: true,
          waitForElement: 800,
          popover: {
            title: 'Confirma la decisión completa',
            description:
              'Revisa identidad, calendario, versión, método, fuentes y alcance antes de crear.',
          },
        },
      ],
    }
  }

  // Datos generales es la ruta índice del plan: `/planes/<id>` sin subruta.
  if (RUTA_PLAN_INDICE.test(pathname)) {
    return {
      clave: 'datos-generales',
      pasos: [
        {
          element: '[data-guia="fundamentos"]',
          skipMissingElement: true,
          popover: {
            title: 'De aquí parte todo el plan',
            description:
              'El perfil de ingreso dice de dónde viene el estudiante; el de egreso, en quién se transforma; los fines de aprendizaje articulan el recorrido entre ambos. El resto del plan —bloques, ciclos, asignaturas— se deriva de estos tres.',
          },
        },
        {
          element: '[data-guia="enfocar-fundamentos"]',
          skipMissingElement: true,
          popover: {
            title: 'Léelos juntos',
            description:
              'Enfoca los tres para compararlos juntos. Al desenfocarlos vuelven a integrarse a la rejilla de campos.',
          },
        },
        {
          element: '[data-guia="campos-plan"]',
          skipMissingElement: true,
          popover: {
            title: 'El resto de la estructura',
            description:
              'Cada tarjeta es un campo de la estructura normativa. Se guardan solos al salir del campo y puedes pedirle cambios a la IA desde el lápiz.',
          },
        },
      ],
    }
  }

  if (pathname.endsWith('/mapa')) {
    return {
      clave: 'mapa-curricular',
      pasos: [
        {
          element: '[data-guia="fase-mapa"]',
          popover: {
            title: 'Mapa curricular',
            description:
              'Ahora puedes colocar cada asignatura en el ciclo y la línea curricular que le corresponden.',
          },
        },
        {
          element: '[data-guia="mapa-curricular"]',
          skipMissingElement: true,
          waitForElement: 800,
          popover: {
            title: 'Del conocimiento al recorrido',
            description:
              'Las filas conservan los bloques que definiste; las columnas representan los ciclos. Coloca aquí las asignaturas pendientes.',
          },
        },
        {
          element: '[data-guia="alternar-vista-curricular"]',
          skipMissingElement: true,
          popover: {
            title: 'Vuelve a la estructura conceptual',
            description:
              'Este control alterna la misma vista curricular. Úsalo para volver a los bloques sin añadir otra pestaña al plan.',
          },
        },
      ],
    }
  }

  if (pathname.endsWith('/bloques')) {
    return {
      clave: 'bloques-conocimiento',
      pasos: [
        {
          element: '[data-guia="fase-bloques"]',
          popover: {
            title: 'Bloques de conocimiento',
            description:
              'Convierte el perfil de egreso y los fines formativos en cuerpos de conocimiento concretos, ordenados de lo básico a lo especializado.',
          },
        },
        {
          element: '[data-guia="bloques-conocimiento"]',
          skipMissingElement: true,
          waitForElement: 800,
          popover: {
            title: 'Explica la razón de cada bloque',
            description:
              'Un nombre claro, una breve justificación y un orden coherente bastan para comunicar la arquitectura académica.',
          },
        },
        {
          element: '[data-guia="agregar-bloque"]',
          skipMissingElement: true,
          popover: {
            title: 'Empieza desde tus fundamentos',
            description:
              'Puedes crear libremente o usar una sugerencia institucional como punto de partida. Las sugerencias nunca restringen el diseño.',
          },
        },
        {
          element: '[data-guia="alternar-vista-curricular"]',
          skipMissingElement: true,
          popover: {
            title: 'Cuando la estructura esté lista',
            description:
              'Cambia al mapa curricular para colocar las asignaturas en su bloque y ciclo adecuados.',
          },
        },
      ],
    }
  }

  if (pathname.endsWith('/asignaturas')) {
    return {
      clave: 'tabla-asignaturas',
      pasos: [
        {
          element: '[data-guia="fase-asignaturas"]',
          popover: {
            title: 'Asignaturas del plan',
            description:
              'Consulta, crea y revisa las asignaturas manteniendo su relación con ciclo y línea.',
          },
        },
      ],
    }
  }

  return null
}

export function hayGuiaParaRuta(pathname: string) {
  return guiaParaRuta(pathname) !== null
}

export function GuiasProvider() {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })
  const guia = useMemo(() => guiaParaRuta(pathname), [pathname])
  const progreso = useProgresoGuia(
    guia?.clave ?? 'sin-guia',
    GUIA_VERSION,
    Boolean(guia),
  )
  const guardar = useGuardarProgresoGuia()
  const iniciada = useRef<string | null>(null)
  const recorridoActivo = useRef<RecorridoActivo | null>(null)

  useEffect(() => {
    if (!guia || progreso.isLoading) return

    const destruirRecorrido = () => {
      const recorrido =
        recorridoActivo.current ??
        (guiaActivaGlobal()?.isActive() ? guiaActivaGlobal() : undefined)

      recorrido?.destroy()
      recorridoActivo.current = null

      if (!guiaActivaGlobal()?.isActive()) {
        registrarGuiaActiva()
      }
    }

    // La instancia se conserva también en `window` para que una actualización
    // en caliente pueda destruir un recorrido creado por el módulo anterior.
    // Sin esta limpieza Driver.js deja `driver-active` en el body y bloquea
    // todos los eventos aunque su popover ya no exista.
    destruirRecorrido()

    const iniciar = (forzar = false) => {
      if (!forzar && (progreso.data?.completada || progreso.data?.descartada)) {
        return
      }
      const pasos = guia.pasos.filter(
        (paso) =>
          typeof paso.element !== 'string' ||
          Boolean(document.querySelector(paso.element)),
      )
      if (pasos.length === 0) return

      destruirRecorrido()
      let completada = false
      const recorrido = driver({
        steps: pasos,
        animate: !window.matchMedia('(prefers-reduced-motion: reduce)').matches,
        allowKeyboardControl: true,
        showProgress: true,
        progressText: '{{current}} de {{total}}',
        nextBtnText: 'Siguiente',
        prevBtnText: 'Anterior',
        doneBtnText: 'Terminar',
        popoverClass: 'acad-ia-guia',
        onDoneClick: () => {
          completada = true
          guardar.mutate({
            clave: guia.clave,
            version: GUIA_VERSION,
            ultimoPaso: pasos.length - 1,
            completada: true,
            descartada: false,
          })
          recorrido.destroy()
        },
        onCloseClick: () => {
          guardar.mutate({
            clave: guia.clave,
            version: GUIA_VERSION,
            ultimoPaso: recorrido.getActiveIndex() ?? 0,
            completada: false,
            descartada: true,
          })
          recorrido.destroy()
        },
        onDestroyed: () => {
          if (recorridoActivo.current === recorrido) {
            recorridoActivo.current = null
          }
          if (guiaActivaGlobal() === recorrido) {
            registrarGuiaActiva()
          }
          if (completada) return
        },
      })
      recorridoActivo.current = recorrido
      registrarGuiaActiva(recorrido)
      recorrido.drive(forzar ? 0 : (progreso.data?.ultimoPaso ?? 0))
    }

    const listener = () => iniciar(true)
    window.addEventListener(INICIAR_GUIA_EVENT, listener)
    const key = `${guia.clave}:${GUIA_VERSION}`
    const timeout =
      iniciada.current === key
        ? undefined
        : window.setTimeout(() => {
            iniciada.current = key
            iniciar(false)
          }, 700)

    return () => {
      window.removeEventListener(INICIAR_GUIA_EVENT, listener)
      if (timeout) window.clearTimeout(timeout)
      destruirRecorrido()
    }
  }, [guardar, guia, progreso.data, progreso.isLoading])

  return null
}
