import { withForm } from '@/components/form'
import { FieldErrorText, fieldInvalid } from '@/components/form/field-error'
import { AvisoSinCarreras } from '@/components/planes/wizard/PasoAmbito/AvisoSinCarreras'
import { SelectorAmbito } from '@/components/planes/wizard/PasoAmbito/SelectorAmbito'
import { FacultadIconPill } from '@/components/shared/FacultadIconPill'
import { useAmbitoPlan } from '@/features/planes/nuevo/hooks/useAmbitoPlan'
import {
  facultadSeleccionadaSchema,
  nuevoPlanFormOpts,
  primerError,
} from '@/features/planes/nuevo/schema'
import { formatFacultadNombre } from '@/lib/facultad-utils'

// Anotación explícita (no `as`): tipa las props extra que acepta withForm.
const pasoFacultadProps: {
  /** Elegir facultad resuelve el paso: el asistente puede avanzar solo. */
  onSeleccionado?: () => void
} = {}

/**
 * Facultad en la que vivirá el plan, como vista dedicada dentro de Datos básicos.
 *
 * Sólo se muestra cuando hay más de una posible: cuando el rol la fija, el
 * asistente la precarga y salta directamente a la siguiente pregunta.
 */
export const PasoFacultadForm = withForm({
  ...nuevoPlanFormOpts,
  props: pasoFacultadProps,
  render: function Render({ form, onSeleccionado }) {
    const ambito = useAmbitoPlan()

    const opciones = ambito.facultades.map((facultad) => {
      return {
        id: facultad.id,
        nombre: formatFacultadNombre(facultad),
        icono: <FacultadIconPill facultad={facultad} />,
      }
    })

    return (
      <section className="gap-seccion grid" data-guia="ambito-academico">
        <header className="gap-micro grid">
          <h3 className="text-xl font-semibold">
            ¿En qué facultad vive este plan?
          </h3>
        </header>

        <form.AppField
          name="datosBasicos.facultad"
          validators={{
            onSubmit: ({ value }) =>
              primerError(facultadSeleccionadaSchema, value),
          }}
        >
          {(field) => (
            <div className="gap-relacionado grid">
              <SelectorAmbito
                opciones={opciones}
                valorId={field.state.value.id}
                etiqueta="Facultades"
                placeholderBusqueda="Buscar facultad…"
                invalido={fieldInvalid(field.state.meta)}
                idError="facultad-error"
                vacio={
                  <AvisoSinCarreras
                    puedeGestionarCarreras={ambito.puedeGestionarCarreras}
                  />
                }
                onSeleccionar={(opcion) => {
                  field.handleChange({
                    id: opcion.id,
                    nombre:
                      ambito.facultades.find((f) => f.id === opcion.id)
                        ?.nombre ?? '',
                  })
                  // Cambiar de facultad invalida la carrera: se vacía para que
                  // la siguiente pregunta vuelva a plantearse desde cero.
                  form.setFieldValue('datosBasicos.carrera', {
                    id: '',
                    nombre: '',
                  })
                  onSeleccionado?.()
                }}
              />
              <FieldErrorText meta={field.state.meta} id="facultad-error" />
            </div>
          )}
        </form.AppField>
      </section>
    )
  },
})
