import { useNavigate } from '@tanstack/react-router'
import { ShieldAlert } from 'lucide-react'

import { useNuevoPlanWizard } from './hooks/useNuevoPlanWizard'

// import type { NewPlanWizardState } from './types'

import { PasoBasicosForm } from '@/components/planes/wizard/PasoBasicosForm/PasoBasicosForm'
import { PasoDetallesPanel } from '@/components/planes/wizard/PasoDetallesPanel/PasoDetallesPanel'
import { PasoModoCardGroup } from '@/components/planes/wizard/PasoModoCardGroup'
import { PasoResumenCard } from '@/components/planes/wizard/PasoResumenCard'
import { WizardControls } from '@/components/planes/wizard/WizardControls'
import { defineStepper } from '@/components/stepper'
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
import { defaultPlanesSearch } from '@/types/search'
// import { useGeneratePlanAI } from '@/data/hooks/usePlans'

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
  // const generatePlanAI = useGeneratePlanAI()

  const {
    wizard,
    setWizard,
    canContinueDesdeModo,
    canContinueDesdeBasicos,
    canContinueDesdeDetalles,
  } = useNuevoPlanWizard()

  const handleClose = () => {
    navigate({
      to: '/planes',
      search: () => defaultPlanesSearch,
      resetScroll: false,
    })
  }

  // Crear plan: ahora la lógica vive en WizardControls

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
            <button
              className="ring-offset-background focus:ring-ring data-[state=open]:bg-accent data-[state=open]:text-muted-foreground rounded-md border px-3 py-2 text-sm opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-none"
              onClick={handleClose}
            >
              Volver
            </button>
          </CardContent>
        </Card>
      </WizardLayout>
    )
  }

  return (
    <Wizard.Stepper.Provider
      initialStep={Wizard.utils.getFirst().id}
      className="flex h-full flex-col"
    >
      {({ methods }) => {
        const idx = Wizard.utils.getIndex(methods.current.id)

        return (
          <WizardLayout
            title="Nuevo plan de estudios"
            onClose={handleClose}
            headerSlot={
              <WizardResponsiveHeader wizard={Wizard} methods={methods} />
            }
            footerSlot={
              <Wizard.Stepper.Controls>
                <WizardControls
                  errorMessage={wizard.errorMessage}
                  onPrev={() => methods.prev()}
                  onNext={() => methods.next()}
                  disablePrev={idx === 0 || wizard.isLoading}
                  disableNext={
                    wizard.isLoading ||
                    (idx === 0 && !canContinueDesdeModo) ||
                    (idx === 1 && !canContinueDesdeBasicos) ||
                    (idx === 2 && !canContinueDesdeDetalles)
                  }
                  disableCreate={wizard.isLoading}
                  isLastStep={idx >= Wizard.steps.length - 1}
                  wizard={wizard}
                  setWizard={setWizard}
                />
              </Wizard.Stepper.Controls>
            }
          >
            <div className="mx-auto max-w-3xl">
              {idx === 0 && (
                <Wizard.Stepper.Panel>
                  <PasoModoCardGroup wizard={wizard} onChange={setWizard} />
                </Wizard.Stepper.Panel>
              )}
              {idx === 1 && (
                <Wizard.Stepper.Panel>
                  <PasoBasicosForm wizard={wizard} onChange={setWizard} />
                </Wizard.Stepper.Panel>
              )}
              {idx === 2 && (
                <Wizard.Stepper.Panel>
                  <PasoDetallesPanel
                    wizard={wizard}
                    onChange={setWizard}
                    isLoading={wizard.isLoading}
                  />
                </Wizard.Stepper.Panel>
              )}
              {idx === 3 && (
                <Wizard.Stepper.Panel>
                  <PasoResumenCard wizard={wizard} />
                </Wizard.Stepper.Panel>
              )}
            </div>
          </WizardLayout>
        )
      }}
    </Wizard.Stepper.Provider>
  )
}
