import { useStore } from '@tanstack/react-form'
import { useNavigate } from '@tanstack/react-router'
import { ShieldAlert } from 'lucide-react'

import { useNuevoPlanWizardDefaults } from './hooks/useNuevoPlanWizard'
import { camposPorPaso } from './schema'

import { useAppForm } from '@/components/form'
import { PasoBasicosForm } from '@/components/planes/wizard/PasoBasicosForm/PasoBasicosForm'
import { PasoDetallesPanel } from '@/components/planes/wizard/PasoDetallesPanel/PasoDetallesPanel'
import { PasoFuenteClonadoInterno } from '@/components/planes/wizard/PasoFuenteClonadoInterno'
import { PasoModoCardGroup } from '@/components/planes/wizard/PasoModoCardGroup'
import { PasoResumenCard } from '@/components/planes/wizard/PasoResumenCard'
import { WizardControls } from '@/components/planes/wizard/WizardControls'
import { defineStepper } from '@/components/stepper'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { WizardLayout } from '@/components/wizard/WizardLayout'
import { WizardResponsiveHeader } from '@/components/wizard/WizardResponsiveHeader'
import { usePermissions } from '@/data/hooks/usePermissions'
import { useCatalogosPlanes } from '@/data/hooks/usePlans'
import { defaultPlanesSearch } from '@/types/search'

const Wizard = defineStepper(
  {
    id: 'modo',
    title: 'Método',
    description: 'Selecciona cómo crearás el plan',
  },
  {
    id: 'basicos',
    title: 'Datos básicos',
    description: 'Nombre, carrera, nivel y ciclos',
  },
  { id: 'detalles', title: 'Detalles', description: 'IA, clonado o archivos' },
  { id: 'resumen', title: 'Resumen', description: 'Confirma y crea el plan' },
)

export default function NuevoPlanModalContainer() {
  const navigate = useNavigate()
  const { has, isLoading: permissionsLoading } = usePermissions()
  const canCreatePlan = has('planes.crear')

  const { defaultValues, initialStep } = useNuevoPlanWizardDefaults()

  // Form global del wizard: única fuente de verdad de los valores. La
  // validación es por paso (camposPorPaso + validadores de campo) y el
  // submit final lo orquesta WizardControls con el schema del modo elegido.
  const form = useAppForm({ defaultValues })

  const tipoOrigen = useStore(form.store, (s) => s.values.tipoOrigen)
  const estructuraPlanId = useStore(
    form.store,
    (s) => s.values.datosBasicos.estructuraPlanId,
  )
  const { data: catalogos } = useCatalogosPlanes()
  const esCurricular =
    catalogos?.estructurasPlan.find((e) => e.id === estructuraPlanId)?.tipo ===
    'CURRICULAR'
  const hasPendingDedupe = useStore(
    form.store,
    (s) => s.values.archivosAdjuntosDedupePending > 0,
  )
  const hasPendingUploads = useStore(form.store, (s) => {
    if (s.values.tipoOrigen === 'IA') {
      return s.values.iaConfig.archivosAdjuntos.some(
        (f) => f.uploadStatus !== 'exito',
      )
    }
    if (s.values.tipoOrigen === 'CLONADO_TRADICIONAL') {
      const archivo = s.values.clonTradicional.archivoPlanId
      return Boolean(archivo) && archivo?.uploadStatus !== 'exito'
    }
    return false
  })

  const titleOverrides =
    tipoOrigen === 'CLONADO_INTERNO'
      ? {
          basicos: 'Fuente',
          detalles: 'Datos básicos',
        }
      : undefined

  const handleClose = () => {
    void navigate({
      to: '/planes',
      search: () => defaultPlanesSearch,
      resetScroll: false,
    })
  }

  if (permissionsLoading) {
    return (
      <WizardLayout title="Nuevo plan de estudios" onClose={handleClose}>
        <Card>
          <CardHeader>
            <CardTitle>Validando permisos</CardTitle>
            <CardDescription>Un momento, por favor.</CardDescription>
          </CardHeader>
        </Card>
      </WizardLayout>
    )
  }

  if (!canCreatePlan) {
    return (
      <WizardLayout title="Nuevo plan de estudios" onClose={handleClose}>
        <Card className="border-destructive/40">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldAlert className="text-destructive h-5 w-5" />
              Sin permisos
            </CardTitle>
            <CardDescription>
              No tienes permisos para crear planes de estudio.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-end">
            <Button variant="secondary" onClick={handleClose}>
              Volver
            </Button>
          </CardContent>
        </Card>
      </WizardLayout>
    )
  }

  return (
    <Wizard.Stepper.Provider
      key={initialStep}
      initialStep={initialStep}
      className="flex h-full flex-col"
    >
      {({ methods }) => {
        const idx = Wizard.utils.getIndex(methods.current.id)
        const stepId = methods.current.id

        /**
         * Valida SOLO los campos del paso actual (según el modo elegido)
         * antes de avanzar: marca cada campo como tocado para que los
         * errores por campo sean visibles y ejecuta sus validadores con
         * causa 'submit'.
         */
        const handleNext = async () => {
          const campos = camposPorPaso(
            stepId,
            form.state.values.tipoOrigen,
            esCurricular,
          )
          let pasoValido = true
          for (const name of campos) {
            form.setFieldMeta(name, (meta) => ({ ...meta, isTouched: true }))
            const errores = await form.validateField(name, 'submit')
            if (errores.length > 0) pasoValido = false
          }
          if (pasoValido) methods.next()
        }

        const disableNext = hasPendingDedupe || hasPendingUploads

        return (
          <WizardLayout
            title="Nuevo plan de estudios"
            onClose={handleClose}
            headerSlot={
              <WizardResponsiveHeader
                wizard={Wizard}
                methods={methods}
                titleOverrides={titleOverrides}
              />
            }
            footerSlot={
              <Wizard.Stepper.Controls>
                <WizardControls
                  form={form}
                  onPrev={() => methods.prev()}
                  onNext={() => void handleNext()}
                  disablePrev={
                    idx === 0 || hasPendingDedupe || hasPendingUploads
                  }
                  disableNext={disableNext}
                  disableCreate={hasPendingDedupe || hasPendingUploads}
                  isLastStep={idx >= Wizard.steps.length - 1}
                />
              </Wizard.Stepper.Controls>
            }
          >
            <div className="mx-auto max-w-3xl">
              {idx === 0 && (
                <Wizard.Stepper.Panel>
                  <PasoModoCardGroup form={form} />
                </Wizard.Stepper.Panel>
              )}
              {idx === 1 && (
                <Wizard.Stepper.Panel>
                  {tipoOrigen === 'CLONADO_INTERNO' ? (
                    <PasoFuenteClonadoInterno form={form} />
                  ) : (
                    <PasoBasicosForm form={form} />
                  )}
                </Wizard.Stepper.Panel>
              )}
              {idx === 2 && (
                <Wizard.Stepper.Panel>
                  {tipoOrigen === 'CLONADO_INTERNO' ? (
                    <PasoBasicosForm form={form} />
                  ) : (
                    <PasoDetallesPanel form={form} />
                  )}
                </Wizard.Stepper.Panel>
              )}
              {idx === 3 && (
                <Wizard.Stepper.Panel>
                  <PasoResumenCard form={form} />
                </Wizard.Stepper.Panel>
              )}
            </div>
          </WizardLayout>
        )
      }}
    </Wizard.Stepper.Provider>
  )
}
