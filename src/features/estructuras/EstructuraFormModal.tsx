import { useStore } from '@tanstack/react-form'
import { toast } from 'sonner'
import { z } from 'zod'

import { CamposEditor } from './CamposEditor'
import { esLlaveReservada } from './CamposSiempreIncluidos'
import { camposToDefinicion, parseCampos } from './types'

import type {
  EstructuraAsignatura,
  EstructuraPlan,
  TipoEstructura,
} from './types'

import { useAppForm } from '@/components/form'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import {
  useEstructurasAsignatura,
  useEstructurasAsignaturaCrud,
  useEstructurasPlan,
  useEstructurasPlanCrud,
  useEstadosPlan,
} from '@/data'

type Mode = 'plan' | 'asignatura'

type Props = {
  open: boolean
  mode: Mode
  editing?: EstructuraPlan | EstructuraAsignatura | null
  onClose: () => void
  defaultTipo?: TipoEstructura
}

const nombreSchema = z.string().trim().min(1, 'El nombre es requerido.')

export function EstructuraFormModal({
  open,
  mode,
  editing,
  onClose,
  defaultTipo,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        spacing="flush"
        className="flex max-h-[90vh] flex-col overflow-hidden sm:max-w-2xl"
      >
        {/* El contenido vive en un hijo que Radix desmonta al cerrar: cada
            apertura nace con defaultValues frescos (sin useEffect de reset) y
            el remount por entidad usa key. */}
        <EstructuraForm
          key={editing?.id ?? 'nueva'}
          mode={mode}
          editing={editing ?? null}
          defaultTipo={defaultTipo}
          onClose={onClose}
        />
      </DialogContent>
    </Dialog>
  )
}

function EstructuraForm({
  mode,
  editing,
  defaultTipo,
  onClose,
}: {
  mode: Mode
  editing: EstructuraPlan | EstructuraAsignatura | null
  defaultTipo?: TipoEstructura
  onClose: () => void
}) {
  const planCrud = useEstructurasPlanCrud()
  const asigCrud = useEstructurasAsignaturaCrud()
  const { data: estructurasPlan = [] } = useEstructurasPlan()
  const { data: estructurasAsignatura = [] } = useEstructurasAsignatura()
  const { data: estadosPlan = [] } = useEstadosPlan()

  const editingPlan =
    editing && mode === 'plan' ? (editing as EstructuraPlan) : null
  const editingAsig =
    editing && mode === 'asignatura' ? (editing as EstructuraAsignatura) : null

  // 1:1 — una plantilla de plan solo puede tener una plantilla de materia, así
  // que las que ya tienen la suya no se ofrecen (salvo la asignada actualmente).
  const planesDisponibles = estructurasPlan.filter(
    (ep) =>
      ep.id === editingAsig?.estructura_plan_id ||
      !estructurasAsignatura.some((ea) => ea.estructura_plan_id === ep.id),
  )

  // Tipo efectivo derivado de los valores del form (en modo asignatura lo
  // hereda de la estructura de plan elegida).
  const tipoEfectivo = (
    tipo: TipoEstructura | '',
    estructuraPlanId: string,
  ): TipoEstructura | null => {
    if (mode === 'plan') return tipo || null
    const parent = estructurasPlan.find((ep) => ep.id === estructuraPlanId)
    return parent?.tipo ?? editingAsig?.tipo ?? null
  }

  const tipoInicial: TipoEstructura | '' = editingPlan
    ? editingPlan.tipo
    : mode === 'plan'
      ? (defaultTipo ?? 'CURRICULAR')
      : ''

  const form = useAppForm({
    defaultValues: {
      nombre: editing?.nombre ?? '',
      tipo: tipoInicial,
      estructuraPlanId:
        editingAsig?.estructura_plan_id ?? planesDisponibles.at(0)?.id ?? '',
      campos: parseCampos(editing ? editing.definicion : undefined),
    },
    onSubmit: async ({ value }) => {
      const definicion = camposToDefinicion(value.campos)
      const tipoAsignatura = tipoEfectivo(value.tipo, value.estructuraPlanId)

      // El toast global de error (meta.errorMessage del hook) avisa si el
      // servidor rechaza; aquí solo se conserva el flujo de éxito y el modal
      // permanece abierto para reintentar en caso de fallo.
      try {
        if (editing) {
          if (mode === 'plan') {
            await planCrud.update.mutateAsync({
              id: editing.id,
              input: {
                nombre: value.nombre,
                tipo: value.tipo as TipoEstructura,
                definicion,
              },
            })
          } else {
            await asigCrud.update.mutateAsync({
              id: editing.id,
              input: {
                nombre: value.nombre,
                tipo: tipoAsignatura,
                definicion,
                estructura_plan_id: value.estructuraPlanId,
              },
            })
          }
          toast.success('Estructura actualizada')
        } else {
          if (mode === 'plan') {
            await planCrud.create.mutateAsync({
              nombre: value.nombre,
              tipo: value.tipo as TipoEstructura,
              definicion,
            })
          } else {
            await asigCrud.create.mutateAsync({
              nombre: value.nombre,
              tipo: tipoAsignatura,
              definicion,
              estructura_plan_id: value.estructuraPlanId,
            })
          }
          toast.success('Estructura creada')
        }
        onClose()
      } catch {
        // Notificado por el toast global (meta.errorMessage del hook).
      }
    },
  })

  // Valores reactivos para derivar el tipo efectivo de la estructura.
  const [tipoValue, estructuraPlanIdValue] = useStore(form.store, (state) => [
    state.values.tipo,
    state.values.estructuraPlanId,
  ])
  const effectiveTipoEstructura = tipoEfectivo(tipoValue, estructuraPlanIdValue)

  const title = editing
    ? `Editar ${mode === 'plan' ? 'plantilla de plan' : 'plantilla de materia'}`
    : `Nueva ${mode === 'plan' ? 'plantilla de plan' : 'plantilla de materia'}`

  return (
    <form
      className="flex min-h-0 flex-1 flex-col"
      onSubmit={(e) => {
        e.preventDefault()
        void form.handleSubmit()
      }}
    >
      <DialogHeader className="px-seccion pt-seccion">
        <DialogTitle>{title}</DialogTitle>
      </DialogHeader>

      <div className="space-y-seccion px-seccion pb-relacionado flex-1 overflow-y-auto">
        <div className="gap-grupo grid sm:grid-cols-2">
          <div className="gap-relacionado grid sm:col-span-2">
            <form.AppField
              name="nombre"
              validators={{ onChange: nombreSchema }}
            >
              {(field) => (
                <field.TextField
                  label="Nombre"
                  placeholder="Ej: Plan de Ingeniería en Sistemas"
                />
              )}
            </form.AppField>
          </div>

          {mode === 'plan' && (
            <form.AppField name="tipo">
              {(field) => (
                <field.SelectField
                  label="Tipo"
                  options={[
                    { value: 'CURRICULAR', label: 'Curricular' },
                    { value: 'NO_CURRICULAR', label: 'No Curricular' },
                  ]}
                />
              )}
            </form.AppField>
          )}

          {mode === 'asignatura' && (
            <div className="sm:col-span-2">
              <form.AppField
                name="estructuraPlanId"
                validators={{
                  onChange: ({ value }) =>
                    value ? undefined : 'Selecciona una estructura de plan.',
                }}
              >
                {(field) => (
                  <field.SelectField
                    label="Estructura de plan"
                    placeholder="Selecciona una estructura de plan"
                    options={planesDisponibles.map((estructura) => ({
                      value: estructura.id,
                      label: estructura.nombre,
                    }))}
                  />
                )}
              </form.AppField>
              {planesDisponibles.length === 0 && (
                <p className="text-muted-foreground mt-relacionado text-sm">
                  Todas las plantillas de plan ya tienen su plantilla de
                  materia. Crea primero una plantilla de plan o edita la
                  existente.
                </p>
              )}
            </div>
          )}
        </div>

        <Separator />

        <div className="space-y-control">
          <p className="text-sm font-semibold">Campos de la estructura</p>
          <form.AppField
            name="campos"
            validators={{
              // Se valida al enviar: las llaves reservadas dejan un mensaje
              // visible bajo el editor (antes era un toast).
              onSubmit: ({ value }) => {
                const reservada = value.find((c) =>
                  esLlaveReservada(mode, c.key),
                )
                return reservada
                  ? `La llave "${reservada.key}" ya es un campo siempre incluido. Quítala o renómbrala.`
                  : undefined
              },
            }}
          >
            {(field) => (
              <div className="space-y-relacionado">
                <CamposEditor
                  campos={field.state.value}
                  modo={mode}
                  onChange={(campos) => field.handleChange(campos)}
                  estadosPlan={estadosPlan}
                  tipoEstructura={effectiveTipoEstructura}
                />
                {!field.state.meta.isValid && (
                  <p className="text-destructive text-sm" role="alert">
                    {field.state.meta.errors
                      .map((error) =>
                        typeof error === 'string'
                          ? error
                          : ((error as { message?: string } | undefined)
                              ?.message ?? ''),
                      )
                      .filter(Boolean)
                      .join(', ')}
                  </p>
                )}
              </div>
            )}
          </form.AppField>
        </div>
      </div>

      <DialogFooter className="px-seccion py-grupo border-t">
        <form.AppForm>
          <form.SubmitButton>
            {editing ? 'Guardar cambios' : 'Crear'}
          </form.SubmitButton>
        </form.AppForm>
      </DialogFooter>
    </form>
  )
}
