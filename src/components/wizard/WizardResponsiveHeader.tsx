import { CircularProgress } from '@/components/CircularProgress'
import { StepWithTooltip } from '@/components/wizard/StepWithTooltip'

export function WizardResponsiveHeader({
  wizard,
  methods,
  titleOverrides,
  hiddenStepIds,
  visibleStepIds,
}: {
  wizard: any
  methods: any
  titleOverrides?: Record<string, string>
  hiddenStepIds?: Array<string>
  /** Orden explícito para recorridos que no siguen el orden base del stepper. */
  visibleStepIds?: Array<string>
}) {
  const hidden = new Set(hiddenStepIds ?? [])
  const allSteps = (wizard.steps as Array<any>).filter(Boolean)
  const visibleSteps = visibleStepIds
    ? visibleStepIds
        .map((id) => allSteps.find((step) => step.id === id))
        .filter(Boolean)
    : allSteps.filter((step) => !hidden.has(step.id))

  const idx = visibleSteps.findIndex((s) => s.id === methods.current.id)
  const safeIdx = idx >= 0 ? idx : 0
  const totalSteps = visibleSteps.length
  const currentIndex = Math.min(safeIdx + 1, totalSteps)
  const hasNextStep = safeIdx < totalSteps - 1
  const nextStep = visibleSteps[safeIdx + 1]

  const resolveTitle = (step: any) => titleOverrides?.[step?.id] ?? step?.title

  return (
    <>
      <div className="block sm:hidden">
        <div className="flex items-center gap-5">
          <CircularProgress current={currentIndex} total={totalSteps} />
          <div className="flex flex-col justify-center">
            <h2 className="text-foreground text-lg font-bold">
              <StepWithTooltip
                title={resolveTitle(methods.current)}
                desc={methods.current.description}
              />
            </h2>
            {hasNextStep && nextStep ? (
              <p className="text-muted-foreground text-sm">
                Siguiente: {resolveTitle(nextStep)}
              </p>
            ) : (
              <p className="text-primary text-sm font-medium">¡Último paso!</p>
            )}
          </div>
        </div>
      </div>

      <div className="hidden sm:block">
        {visibleStepIds ? (
          <nav
            aria-label="Progreso del asistente"
            className="border-border/60 bg-muted/30 max-w-full overflow-x-auto rounded-xl border p-2"
          >
            <ol className="flex items-center justify-between gap-2">
              {visibleSteps.map((step: any, visibleIdx: number) => {
                const active = step.id === methods.current.id
                const completed = visibleIdx < safeIdx
                return (
                  <li
                    key={step.id}
                    className="flex min-w-0 flex-1 items-center gap-2 last:flex-none"
                  >
                    <span
                      aria-current={active ? 'step' : undefined}
                      className={
                        active || completed
                          ? 'bg-primary text-primary-foreground flex size-10 shrink-0 items-center justify-center rounded-full font-medium'
                          : 'bg-secondary text-secondary-foreground flex size-10 shrink-0 items-center justify-center rounded-full font-medium'
                      }
                    >
                      {visibleIdx + 1}
                    </span>
                    <span className="min-w-0 truncate font-medium whitespace-nowrap">
                      <StepWithTooltip
                        title={resolveTitle(step)}
                        desc={step.description}
                      />
                    </span>
                    {visibleIdx < visibleSteps.length - 1 ? (
                      <span
                        aria-hidden
                        className={
                          completed
                            ? 'bg-primary h-0.5 min-w-8 flex-1'
                            : 'bg-muted h-0.5 min-w-8 flex-1'
                        }
                      />
                    ) : null}
                  </li>
                )
              })}
            </ol>
          </nav>
        ) : (
          <wizard.Stepper.Navigation className="border-border/60 bg-muted/30 max-w-full overflow-x-auto rounded-xl border p-2">
            {visibleSteps.map((step: any, visibleIdx: number) => (
              <wizard.Stepper.Step
                key={step.id}
                of={step.id}
                icon={visibleIdx + 1}
                className="whitespace-nowrap"
              >
                <wizard.Stepper.Title>
                  <StepWithTooltip
                    title={resolveTitle(step)}
                    desc={step.description}
                  />
                </wizard.Stepper.Title>
              </wizard.Stepper.Step>
            ))}
          </wizard.Stepper.Navigation>
        )}
      </div>
    </>
  )
}
