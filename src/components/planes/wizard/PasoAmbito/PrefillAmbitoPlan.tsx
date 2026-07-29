import { useStore } from '@tanstack/react-form'
import { useEffect } from 'react'

import { withForm } from '@/components/form'
import { useAmbitoPlan } from '@/features/planes/nuevo/hooks/useAmbitoPlan'
import { nombrePlanCurricularDerivado } from '@/features/planes/nuevo/nombre-plan'
import { nuevoPlanFormOpts } from '@/features/planes/nuevo/schema'
import {
  completarEstructuraCiclos,
  proponerEstructuraCiclos,
} from '@/lib/ciclo-utils'

/**
 * Precarga del ámbito y de la versión normativa. No pinta nada.
 *
 * Es sincronización con dos sistemas externos al formulario —los catálogos
 * remotos y el ámbito que concede el rol—, no estado derivado: por eso vive en
 * un efecto y no en un valor calculado al leer. Sólo escribe campos vacíos, así
 * que nunca pisa una elección del usuario ni un borrador restaurado.
 *
 * Se monta en el contenedor del asistente y no dentro de un paso porque los
 * pasos de facultad y carrera se **ocultan** precisamente cuando el rol los
 * fija: si el precargado viviera en ellos, no llegaría a ejecutarse nunca en
 * el caso para el que existe.
 */
export const PrefillAmbitoPlan = withForm({
  ...nuevoPlanFormOpts,
  render: function Render({ form }) {
    const {
      cargando,
      estructurasPlan,
      forcedCarreraId,
      forcedFacultadId,
      todasCarreras,
      todasFacultades,
    } = useAmbitoPlan()

    const estructuraPlanIdActual = useStore(
      form.store,
      (s) => s.values.datosBasicos.estructuraPlanId,
    )
    const tipoEstructuraActual = useStore(
      form.store,
      (s) => s.values.datosBasicos.tipoEstructura,
    )

    useEffect(() => {
      if (cargando) return

      const current = form.getFieldValue('datosBasicos')
      const estructuraActual = estructurasPlan.find(
        (estructura) => estructura.id === current.estructuraPlanId,
      )
      const tipoEfectivo = current.tipoEstructura ?? estructuraActual?.tipo
      const latestEstructuraId =
        estructurasPlan.find((estructura) => estructura.tipo === tipoEfectivo)
          ?.id ?? null
      const forcedCarrera = forcedCarreraId
        ? todasCarreras.find((carrera) => carrera.id === forcedCarreraId)
        : undefined
      const facultadForzadaId =
        forcedCarrera?.facultad_id ?? forcedFacultadId ?? null
      const forcedFacultad = facultadForzadaId
        ? todasFacultades.find((facultad) => facultad.id === facultadForzadaId)
        : undefined

      if (
        !latestEstructuraId &&
        !estructuraActual &&
        !forcedFacultad &&
        !forcedCarrera
      ) {
        return
      }

      const next = { ...current }
      let changed = false

      if (!next.tipoEstructura && estructuraActual?.tipo) {
        next.tipoEstructura = estructuraActual.tipo
        changed = true
      }

      if (
        latestEstructuraId &&
        (!next.estructuraPlanId ||
          (tipoEfectivo && estructuraActual?.tipo !== tipoEfectivo))
      ) {
        next.estructuraPlanId = latestEstructuraId
        changed = true
      }

      if (forcedFacultad && current.facultad.id !== forcedFacultad.id) {
        next.facultad = { id: forcedFacultad.id, nombre: forcedFacultad.nombre }
        changed = true
      }

      if (forcedCarrera && current.carrera.id !== forcedCarrera.id) {
        const propuesta = completarEstructuraCiclos(
          proponerEstructuraCiclos(forcedCarrera),
        )
        next.carrera = { id: forcedCarrera.id, nombre: forcedCarrera.nombre }
        if (!next.nombrePlan) {
          // Con la carrera fijada por rol nadie pasa por el paso de carrera,
          // que es donde se deriva el nombre: hay que derivarlo aquí o el plan
          // se crearía con un nombre distinto del que muestra el título.
          next.nombrePlan =
            nombrePlanCurricularDerivado(
              forcedCarrera,
              next.fechaInicioImparticion,
              tipoEfectivo ?? null,
            ) ?? `${forcedCarrera.nombre} (${new Date().getFullYear()})`
        }
        next.tipoCiclo = propuesta.tipoCiclo
        next.numCiclos = propuesta.numCiclos
        next.semanasPorCiclo = propuesta.semanasPorCiclo
        changed = true
      }

      if (changed) form.setFieldValue('datosBasicos', next)
    }, [
      cargando,
      estructuraPlanIdActual,
      estructurasPlan,
      forcedCarreraId,
      forcedFacultadId,
      form,
      tipoEstructuraActual,
      todasCarreras,
      todasFacultades,
    ])

    return null
  },
})
