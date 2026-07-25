import { useStore } from '@tanstack/react-form'
import { useNavigate } from '@tanstack/react-router'
import { ShieldAlert } from 'lucide-react'

import { useNuevaAsignaturaWizardDefaults } from './hooks/useNuevaAsignaturaWizard'
import { camposPorPaso } from './schema'

import type { PasoWizardId } from './schema'

import { PasoBasicosClonadoInterno } from '@/components/asignaturas/wizard/PasoBasicosClonadoInterno.tsx'
import { PasoBasicosForm } from '@/components/asignaturas/wizard/PasoBasicosForm/PasoBasicosForm'
import { PasoDetallesPanel } from '@/components/asignaturas/wizard/PasoDetallesPanel'
import { PasoFuenteClonadoInterno } from '@/components/asignaturas/wizard/PasoFuenteClonadoInterno.tsx'
import { PasoMetodoCardGroup } from '@/components/asignaturas/wizard/PasoMetodoCardGroup'
import { PasoResumenCard } from '@/components/asignaturas/wizard/PasoResumenCard'
import { WizardControls } from '@/components/asignaturas/wizard/WizardControls'
import { useAppForm } from '@/components/form'
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
import { usePlan } from '@/data'
import { usePlanCapabilities } from '@/data/auth/planCapabilities'
import { defaultAsignaturasSearch } from '@/types/search'

const Wizard = defineStepper(
  {
    id: 'metodo',
    title: 'Método',
    description: 'Crear nueva o clonar',
  },
  {
    id: 'basicos',
    title: 'Datos básicos',
    description: 'Identidad y ubicación curricular',
  },
  {
    id: 'detalles',
    title: 'Detalles',
    description: 'IA o fuente de clonado',
  },
  {
    id: 'resumen',
    title: 'Resumen',
    description: 'Confirmar creación',
  },
)

export function NuevaAsignaturaModalContainer({ planId }: { planId: string }) {
  const navigate = useNavigate()
  const { data: plan, isLoading: planLoading } = usePlan(planId)
  const capabilities = usePlanCapabilities(plan)
  const canCreateAsignatura = capabilities.canEditAsignaturas

  const { defaultValues, initialStep } =
    useNuevaAsignaturaWizardDefaults(planId)

  // Form global del wizard: única fuente de verdad de los valores. La
  // validación es por paso (camposPorPaso + validadores de campo) y el
  // submit final lo orquesta WizardControls con el schema del modo elegido.
  const form = useAppForm({ defaultValues })

  const tipoOrigen = useStore(form.store, (s) => s.values.tipoOrigen)
  const hasPendingDedupe = useStore(
    form.store,
    (s) => s.values.archivosAdjuntosDedupePending > 0,
  )
  const hasPendingUploads = useStore(form.store, (s) => {
    const adjuntos =
      s.values.tipoOrigen === 'IA_SIMPLE'
        ? s.values.iaConfig.archivosAdjuntos
        : s.values.tipoOrigen === 'CLONADO_TRADICIONAL'
          ? s.values.clonTradicional.archivosAdjuntos
          : []
    return adjuntos.some((f) => f.uploadStatus !== 'exito')
  })
  const titleOverrides =
    tipoOrigen === 'CLONADO_INTERNO'
      ? { basicos: 'Fuente', detalles: 'Datos básicos' }
      : undefined

  const handleClose = () => {
    void navigate({
      to: '/planes/$planId/asignaturas',
      params: { planId },
      search: defaultAsignaturasSearch,
      resetScroll: false,
    })
  }

  if (planLoading) {
    return (
      <WizardLayout title="Nueva Asignatura" onClose={handleClose}>
        <Card>
          <CardHeader>
            <CardTitle>Validando permisos</CardTitle>
            <CardDescription>Un momento, por favor.</CardDescription>
          </CardHeader>
        </Card>
      </WizardLayout>
    )
  }

  if (!canCreateAsignatura) {
    return (
      <WizardLayout title="Nueva Asignatura" onClose={handleClose}>
        <Card className="border-destructive/40">
          <CardHeader>
            <CardTitle className="text-destructive flex items-center gap-2">
              <ShieldAlert className="h-5 w-5" />
              Sin permisos
            </CardTitle>
            <CardDescription>
              Este plan esta en modo solo lectura para tu rol y etapa actual.
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
        const validateStep = async (targetStep: PasoWizardId = stepId) => {
          const campos = camposPorPaso(targetStep, form.state.values.tipoOrigen)
          let pasoValido = true
          for (const name of campos) {
            form.setFieldMeta(name, (meta) => ({ ...meta, isTouched: true }))
            const errores = await form.validateField(name, 'submit')
            if (errores.length > 0) pasoValido = false
          }
          return pasoValido
        }
        const handleNext = async () => {
          if (!(await validateStep())) return
          // CLONADO_TRADICIONAL no tiene "Datos básicos": el nombre y los datos
          // salen de los archivos y la plantilla la hereda del plan.
          if (stepId === 'metodo' && tipoOrigen === 'CLONADO_TRADICIONAL') {
            methods.goTo('detalles')
            return
          }
          methods.next()
        }
        const handleCreateEmpty = async () => {
          if (!(await validateStep('basicos'))) return
          form.setFieldValue('tipoOrigen', 'MANUAL')
          methods.goTo('resumen')
        }
        const handleCreateWithAI = async () => {
          if (!(await validateStep('basicos'))) return
          form.setFieldValue('tipoOrigen', 'IA_SIMPLE')
          methods.goTo('detalles')
        }
        const handlePrev = () => {
          if (stepId === 'resumen' && tipoOrigen === 'MANUAL') {
            methods.goTo('basicos')
            return
          }
          if (stepId === 'detalles' && tipoOrigen === 'CLONADO_TRADICIONAL') {
            methods.goTo('metodo')
            return
          }
          methods.prev()
        }

        const disableNext = hasPendingDedupe || hasPendingUploads

        return (
          <WizardLayout
            title="Nueva Asignatura"
            onClose={handleClose}
            headerSlot={
              <WizardResponsiveHeader
                wizard={Wizard}
                methods={methods}
                titleOverrides={titleOverrides}
                hiddenStepIds={
                  tipoOrigen === 'MANUAL'
                    ? ['detalles']
                    : tipoOrigen === 'CLONADO_TRADICIONAL'
                      ? ['basicos']
                      : undefined
                }
              />
            }
            footerSlot={
              <Wizard.Stepper.Controls>
                <WizardControls
                  form={form}
                  onPrev={handlePrev}
                  onNext={() => void handleNext()}
                  disablePrev={
                    idx === 0 || hasPendingDedupe || hasPendingUploads
                  }
                  disableNext={disableNext}
                  disableCreate={hasPendingDedupe || hasPendingUploads}
                  isLastStep={idx >= Wizard.steps.length - 1}
                  adminOverrideRequired={
                    capabilities.requiresAdminOverrideForEdit
                  }
                  onCreateEmpty={
                    stepId === 'basicos' &&
                    (tipoOrigen === 'MANUAL' || tipoOrigen === 'IA_SIMPLE')
                      ? () => void handleCreateEmpty()
                      : undefined
                  }
                  onCreateWithAI={
                    stepId === 'basicos' &&
                    (tipoOrigen === 'MANUAL' || tipoOrigen === 'IA_SIMPLE')
                      ? () => void handleCreateWithAI()
                      : undefined
                  }
                />
              </Wizard.Stepper.Controls>
            }
          >
            <div className="mx-auto max-w-3xl">
              {idx === 0 && (
                <Wizard.Stepper.Panel>
                  <PasoMetodoCardGroup form={form} />
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
                    <PasoBasicosClonadoInterno form={form} />
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
