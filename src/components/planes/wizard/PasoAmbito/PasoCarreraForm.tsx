import { useStore } from '@tanstack/react-form'

import type { OpcionAmbito } from '@/components/planes/wizard/PasoAmbito/SelectorAmbito'

import { withForm } from '@/components/form'
import { FieldErrorText, fieldInvalid } from '@/components/form/field-error'
import { AvisoSinCarreras } from '@/components/planes/wizard/PasoAmbito/AvisoSinCarreras'
import { SelectorAmbito } from '@/components/planes/wizard/PasoAmbito/SelectorAmbito'
import { NIVELES } from '@/features/planes/nuevo/catalogs'
import { useAmbitoPlan } from '@/features/planes/nuevo/hooks/useAmbitoPlan'
import {
  nombrePlanCurricularDerivado,
  nombrePlanPorOmision,
} from '@/features/planes/nuevo/nombre-plan'
import {
  carreraSeleccionadaSchema,
  nuevoPlanFormOpts,
  primerError,
} from '@/features/planes/nuevo/schema'
import {
  completarEstructuraCiclos,
  proponerEstructuraCiclos,
} from '@/lib/ciclo-utils'

// Anotación explícita (no `as`): tipa las props extra que acepta withForm.
const pasoCarreraProps: {
  /** Elegir carrera resuelve el paso: el asistente puede avanzar solo. */
  onSeleccionado?: () => void
} = {}

/**
 * Carrera del plan, como vista dedicada dentro de Datos básicos.
 *
 * Es la pregunta de la que más cuelga: de ella salen el nombre del plan, el
 * tipo de ciclo y cuántos hay, así que se responde antes que los datos
 * básicos y no junto a ellos. Las opciones se agrupan por nivel académico
 * porque es el corte con el que se piensa un catálogo de carreras.
 */
export const PasoCarreraForm = withForm({
  ...nuevoPlanFormOpts,
  props: pasoCarreraProps,
  render: function Render({ form, onSeleccionado }) {
    const ambito = useAmbitoPlan()
    const facultadId = useStore(
      form.store,
      (s) => s.values.datosBasicos.facultad.id,
    )
    const tipoEstructura = useStore(
      form.store,
      (s) => s.values.datosBasicos.tipoEstructura,
    )
    const fechaInicioImparticion = useStore(
      form.store,
      (s) => s.values.datosBasicos.fechaInicioImparticion,
    )

    const carreras = ambito.carrerasDeFacultad(facultadId || null)
    // El orden de los niveles es el del catálogo —licenciatura antes que
    // posgrado—, no el alfabético que saldría de agrupar sin más.
    const niveles = [
      ...NIVELES.filter((nivel) =>
        carreras.some((carrera) => carrera.nivel === nivel),
      ),
      ...[
        ...new Set(
          carreras
            .map((carrera) => carrera.nivel.trim() || 'Otro')
            .filter(
              (nivel) => !NIVELES.includes(nivel as (typeof NIVELES)[number]),
            ),
        ),
      ],
    ]
    const opciones: Array<OpcionAmbito> = niveles.flatMap((nivel) =>
      carreras
        .filter((carrera) => (carrera.nivel.trim() || 'Otro') === nivel)
        .map((carrera) => ({
          id: carrera.id,
          nombre: carrera.nombre,
          grupo: nivel,
        })),
    )

    return (
      <section className="grid gap-5" data-guia="ambito-academico">
        <header className="grid gap-1">
          <h3 className="text-xl font-semibold">¿Para qué carrera?</h3>
        </header>

        <form.AppField
          name="datosBasicos.carrera"
          validators={{
            onSubmit: ({ value }) =>
              primerError(carreraSeleccionadaSchema, value),
          }}
        >
          {(field) => (
            <div className="grid gap-2">
              <SelectorAmbito
                opciones={opciones}
                valorId={field.state.value.id}
                etiqueta="Carreras"
                placeholderBusqueda="Buscar carrera…"
                etiquetaGrupo="nivel académico"
                invalido={fieldInvalid(field.state.meta)}
                idError="carrera-error"
                vacio={
                  ambito.sinCarreras ? (
                    <AvisoSinCarreras
                      puedeGestionarCarreras={ambito.puedeGestionarCarreras}
                    />
                  ) : (
                    <p className="text-muted-foreground text-sm">
                      Esta facultad todavía no tiene carreras en las que puedas
                      crear planes.
                    </p>
                  )
                }
                onSeleccionar={(opcion) => {
                  const seleccionada = carreras.find((c) => c.id === opcion.id)
                  const propuesta = completarEstructuraCiclos(
                    proponerEstructuraCiclos(seleccionada),
                  )

                  field.handleChange({
                    id: opcion.id,
                    nombre: seleccionada?.nombre ?? '',
                  })
                  form.setFieldValue(
                    'datosBasicos.nombrePlan',
                    nombrePlanCurricularDerivado(
                      seleccionada,
                      fechaInicioImparticion,
                      tipoEstructura,
                    ) ??
                      (tipoEstructura === 'CURRICULAR'
                        ? ''
                        : nombrePlanPorOmision(seleccionada)),
                  )
                  // Cambiar de carrera reemplaza la estructura propuesta en
                  // bloque: mezclar el tipo de una carrera con el número de
                  // semanas de otra daría una duración falsa.
                  form.setFieldValue(
                    'datosBasicos.tipoCiclo',
                    propuesta.tipoCiclo,
                  )
                  form.setFieldValue(
                    'datosBasicos.numCiclos',
                    propuesta.numCiclos,
                  )
                  form.setFieldValue(
                    'datosBasicos.semanasPorCiclo',
                    propuesta.semanasPorCiclo,
                  )
                  onSeleccionado?.()
                }}
              />
              <FieldErrorText meta={field.state.meta} id="carrera-error" />
            </div>
          )}
        </form.AppField>
      </section>
    )
  },
})
