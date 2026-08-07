import { X } from 'lucide-react'

import { StepWithTooltip } from './StepWithTooltip'

import { CircularProgress } from '@/components/CircularProgress'
import { DialogHeader, DialogTitle } from '@/components/ui/dialog'

export function WizardHeader({
  currentIndex,
  totalSteps,
  currentTitle,
  currentDescription,
  nextTitle,
  onClose,
  Wizard,
}: {
  currentIndex: number
  totalSteps: number
  currentTitle: string
  currentDescription: string
  nextTitle?: string
  onClose: () => void
  Wizard: any
}) {
  return (
    <div className="z-10 flex-none border-b bg-white">
      <div className="p-seccion pb-grupo flex items-center justify-between">
        <DialogHeader className="p-0">
          <DialogTitle>Nuevo plan de estudios</DialogTitle>
        </DialogHeader>
        <button
          onClick={onClose}
          className="ring-offset-background focus:ring-ring data-[state=open]:bg-accent data-[state=open]:text-muted-foreground rounded-sm opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-none disabled:pointer-events-none"
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Cerrar</span>
        </button>
      </div>
      <div className="px-seccion pb-seccion">
        <div className="block sm:hidden">
          <div className="gap-seccion flex items-center">
            <CircularProgress current={currentIndex} total={totalSteps} />
            <div className="flex flex-col justify-center">
              <h2 className="text-lg font-bold text-slate-900">
                <StepWithTooltip
                  title={currentTitle}
                  desc={currentDescription}
                />
              </h2>
              {nextTitle ? (
                <p className="text-sm text-slate-400">Siguiente: {nextTitle}</p>
              ) : (
                <p className="text-sm font-medium text-green-500">
                  ¡Último paso!
                </p>
              )}
            </div>
          </div>
        </div>
        <div className="hidden sm:block">
          <Wizard.Stepper.Navigation className="border-border/60 p-relacionado rounded-xl border bg-slate-50">
            {Wizard.steps.map((step: any) => (
              <Wizard.Stepper.Step
                key={step.id}
                of={step.id}
                className="whitespace-nowrap"
              >
                <Wizard.Stepper.Title>
                  <StepWithTooltip title={step.title} desc={step.description} />
                </Wizard.Stepper.Title>
              </Wizard.Stepper.Step>
            ))}
          </Wizard.Stepper.Navigation>
        </div>
      </div>
    </div>
  )
}
