import { useNavigate } from '@tanstack/react-router'
import * as Icons from 'lucide-react'

import { useNuevaAsignaturaWizard } from './hooks/useNuevaAsignaturaWizard'

import { PasoBasicosClonadoInterno } from '@/components/asignaturas/wizard/PasoBasicosClonadoInterno.tsx'
import { PasoBasicosForm } from '@/components/asignaturas/wizard/PasoBasicosForm/PasoBasicosForm'
import { PasoDetallesPanel } from '@/components/asignaturas/wizard/PasoDetallesPanel'
import { PasoFuenteClonadoInterno } from '@/components/asignaturas/wizard/PasoFuenteClonadoInterno.tsx'
import { PasoMetodoCardGroup } from '@/components/asignaturas/wizard/PasoMetodoCardGroup'
import { PasoResumenCard } from '@/components/asignaturas/wizard/PasoResumenCard'
import { WizardControls } from '@/components/asignaturas/wizard/WizardControls'
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

const auth_get_current_user_role = (): string => 'JEFE_CARRERA'

const Wizard = defineStepper(
  {
    id: 'metodo',
    title: 'Método',
    description: 'Manual, IA o Clonado',
  },
  {
    id: 'basicos',
    title: 'Datos básicos',
    description: 'Nombre y estructura',
  },
  {
    id: 'detalles',
    title: 'Detalles',
    description: 'Detalles según modo',
  },
  {
    id: 'resumen',
    title: 'Resumen',
    description: 'Confirmar creación',
  },
)

export function NuevaAsignaturaModalContainer({ planId }: { planId: string }) {
  const navigate = useNavigate()
  const role = auth_get_current_user_role()

  const {
    wizard,
    setWizard,
    canContinueDesdeMetodo,
    canContinueDesdeBasicos,
    canContinueDesdeDetalles,
  } = useNuevaAsignaturaWizard(planId)

  const titleOverrides =
    wizard.tipoOrigen === 'IA_MULTIPLE'
      ? {
          basicos: 'Sugerencias',
          detalles: 'Estructura',
        }
      : wizard.tipoOrigen === 'CLONADO_INTERNO'
        ? {
            basicos: 'Fuente',
            detalles: 'Datos básicos',
          }
        : undefined

  const handleClose = () => {
    navigate({ to: `/planes/${planId}/asignaturas`, resetScroll: false })
  }

  if (role !== 'JEFE_CARRERA') {
    return (
      <WizardLayout title="Nueva Asignatura" onClose={handleClose}>
        <Card className="border-destructive/40">
          <CardHeader>
            <CardTitle className="text-destructive flex items-center gap-2">
              <Icons.ShieldAlert className="h-5 w-5" />
              Sin permisos
            </CardTitle>
            <CardDescription>
              Solo el Jefe de Carrera puede crear asignaturas.
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
      initialStep={Wizard.utils.getFirst().id}
      className="flex h-full flex-col"
    >
      {({ methods }) => {
        const idx = Wizard.utils.getIndex(methods.current.id)
        const stepId = methods.current.id

        const hasPendingDedupe = (wizard.archivosAdjuntosDedupePending ?? 0) > 0

        const adjuntos =
          wizard.tipoOrigen === 'IA_SIMPLE'
            ? (wizard.iaConfig?.archivosAdjuntos ?? [])
            : wizard.tipoOrigen === 'CLONADO_TRADICIONAL'
              ? (wizard.clonTradicional?.archivosAdjuntos ?? [])
              : []

        const hasPendingUploads = adjuntos.some(
          (f) => f.uploadStatus !== 'exito',
        )

        const disableNext =
          wizard.isLoading ||
          hasPendingDedupe ||
          hasPendingUploads ||
          (stepId === 'metodo'
            ? !canContinueDesdeMetodo
            : stepId === 'basicos'
              ? wizard.tipoOrigen === 'CLONADO_INTERNO'
                ? !canContinueDesdeDetalles
                : !canContinueDesdeBasicos
              : stepId === 'detalles'
                ? wizard.tipoOrigen === 'CLONADO_INTERNO'
                  ? !canContinueDesdeBasicos
                  : !canContinueDesdeDetalles
                : false)

        return (
          <WizardLayout
            title="Nueva Asignatura"
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
                  errorMessage={wizard.errorMessage}
                  onPrev={() => methods.prev()}
                  onNext={() => methods.next()}
                  disablePrev={
                    idx === 0 ||
                    wizard.isLoading ||
                    hasPendingDedupe ||
                    hasPendingUploads
                  }
                  disableNext={disableNext}
                  disableCreate={
                    wizard.isLoading || hasPendingDedupe || hasPendingUploads
                  }
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
                  <PasoMetodoCardGroup wizard={wizard} onChange={setWizard} />
                </Wizard.Stepper.Panel>
              )}

              {idx === 1 && (
                <Wizard.Stepper.Panel>
                  {wizard.tipoOrigen === 'CLONADO_INTERNO' ? (
                    <PasoFuenteClonadoInterno
                      wizard={wizard}
                      onChange={setWizard}
                    />
                  ) : (
                    <PasoBasicosForm wizard={wizard} onChange={setWizard} />
                  )}
                </Wizard.Stepper.Panel>
              )}

              {idx === 2 && (
                <Wizard.Stepper.Panel>
                  {wizard.tipoOrigen === 'CLONADO_INTERNO' ? (
                    <PasoBasicosClonadoInterno
                      wizard={wizard}
                      onChange={setWizard}
                    />
                  ) : (
                    <PasoDetallesPanel wizard={wizard} onChange={setWizard} />
                  )}
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
