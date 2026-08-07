import { useStore } from '@tanstack/react-form'
import { useNavigate } from '@tanstack/react-router'
import { CircleHelp, ShieldAlert } from 'lucide-react'
import { useState } from 'react'

import { encuadreVigente, entradaEncuadre, firmaEncuadre } from './encuadre'
import { useNuevoPlanWizardDefaults } from './hooks/useNuevoPlanWizard'
import { camposPorPaso, errorPasoActual } from './schema'

import type { CatalogosEncuadre } from './encuadre'
import type { PasoWizardId } from './schema'

import { useAppForm } from '@/components/form'
import { PasoAclaracionesIA } from '@/components/planes/wizard/PasoAclaracionesIA'
import { PasoCarreraForm } from '@/components/planes/wizard/PasoAmbito/PasoCarreraForm'
import { PasoFacultadForm } from '@/components/planes/wizard/PasoAmbito/PasoFacultadForm'
import { PasoTipoPlanForm } from '@/components/planes/wizard/PasoAmbito/PasoTipoPlanForm'
import { PrefillAmbitoPlan } from '@/components/planes/wizard/PasoAmbito/PrefillAmbitoPlan'
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { WizardLayout } from '@/components/wizard/WizardLayout'
import { WizardResponsiveHeader } from '@/components/wizard/WizardResponsiveHeader'
import { useAnalizarEncuadrePlan } from '@/data/hooks/useAIBrief'
import { usePermissions } from '@/data/hooks/usePermissions'
import { useCatalogosPlanes } from '@/data/hooks/usePlans'
import { INICIAR_GUIA_EVENT } from '@/features/guias/GuiasProvider'
import { useAmbitoPlan } from '@/features/planes/nuevo/hooks/useAmbitoPlan'
import { requiereSemanasPorCiclo } from '@/lib/ciclo-utils'
import { notify } from '@/lib/toast'
import { cn } from '@/lib/utils'
import { defaultPlanesSearch } from '@/types/search'

const Wizard = defineStepper(
  {
    id: 'modo',
    title: 'Método',
    description: 'Crear nuevo o clonar',
  },
  {
    id: 'basicos',
    title: 'Datos básicos',
    description: 'Tipo, ámbito, calendario y ciclos',
  },
  { id: 'detalles', title: 'Detalles', description: 'IA o fuente de clonado' },
  {
    id: 'aclaraciones',
    title: 'Optimización',
    description: 'Decisiones curriculares',
  },
  { id: 'resumen', title: 'Resumen', description: 'Confirma y crea el plan' },
)

type SubpasoBasicos = 'tipo' | 'facultad' | 'carrera' | 'captura'

export default function NuevoPlanModalContainer() {
  const navigate = useNavigate()
  const { has, isLoading: permissionsLoading } = usePermissions()
  const canCreatePlan = has('planes.crear')
  const canUseAI = has('ia.usar')
  const analizarEncuadre = useAnalizarEncuadrePlan()
  const ambito = useAmbitoPlan()

  const { defaultValues, initialStep } = useNuevoPlanWizardDefaults()
  const [subpasoBasicos, setSubpasoBasicos] = useState<SubpasoBasicos>('tipo')

  // Form global del wizard: única fuente de verdad de los valores. La
  // validación es por paso (camposPorPaso + validadores de campo) y el
  // submit final lo orquesta WizardControls con el schema del modo elegido.
  const form = useAppForm({ defaultValues })

  const tipoOrigen = useStore(form.store, (s) => s.values.tipoOrigen)
  const tipoEstructura = useStore(
    form.store,
    (s) => s.values.datosBasicos.tipoEstructura,
  )
  const esCurricular = tipoEstructura === 'CURRICULAR'
  const motivoSubpasoBasicos = useStore(form.store, (state) =>
    subpasoBasicos === 'captura'
      ? null
      : errorPasoActual(
          subpasoBasicos,
          state.values,
          state.values.datosBasicos.tipoEstructura === 'CURRICULAR',
        ),
  )
  // Aplicar una versión normativa distinta de la recomendada exige justificarla;
  // el campo solo existe —y solo se valida— en ese caso.
  const requiereMotivoEstructura = useStore(form.store, (s) => {
    const { estructuraPlanId, estructuraRecomendadaId } = s.values.datosBasicos
    return (
      Boolean(estructuraRecomendadaId) &&
      estructuraPlanId !== estructuraRecomendadaId
    )
  })
  // Toda periodicidad necesita una duración efectiva de calendario.
  const requiereSemanas = useStore(form.store, (s) =>
    requiereSemanasPorCiclo(s.values.datosBasicos.tipoCiclo),
  )
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
      return s.values.clonTradicional.archivos.some(
        (archivo) => archivo.uploadStatus !== 'exito',
      )
    }
    return false
  })
  const { data: catalogos } = useCatalogosPlanes()
  const carreraId = useStore(
    form.store,
    (s) => s.values.datosBasicos.carrera.id,
  )
  const estructuraPlanId = useStore(
    form.store,
    (s) => s.values.datosBasicos.estructuraPlanId,
  )
  // El nivel académico y la versión normativa viven en los catálogos, no en el
  // form. Sin ellos el encuadre gastaba sus preguntas en pedir datos que el
  // usuario ya había elegido en el paso anterior.
  const catalogosEncuadre: CatalogosEncuadre = {
    nivelCarrera:
      catalogos?.carreras.find((item) => item.id === carreraId)?.nivel ?? null,
    estructuraNombre:
      catalogos?.estructurasPlan.find((item) => item.id === estructuraPlanId)
        ?.nombre ?? null,
  }

  const titleOverrides =
    tipoOrigen === 'CLONADO_INTERNO'
      ? { basicos: 'Fuente', detalles: 'Datos básicos' }
      : tipoOrigen === 'CLONADO_TRADICIONAL'
        ? { detalles: 'Fuente', basicos: 'Ajustes' }
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
            <CardTitle className="gap-relacionado flex items-center">
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
        const stepId = methods.current.id
        const hiddenStepIds: Array<PasoWizardId> = [
          'modo',
          ...(tipoOrigen === 'MANUAL'
            ? (['detalles', 'aclaraciones'] as const)
            : tipoOrigen !== 'IA'
              ? (['aclaraciones'] as const)
              : []),
        ]
        const hiddenSteps = new Set<PasoWizardId>(hiddenStepIds)
        const ordenVisible = Wizard.steps
          .map((step) => step.id)
          .filter((id) => !hiddenSteps.has(id))
        const posicionActual = ordenVisible.indexOf(stepId)
        const requiereAmbito = tipoOrigen !== 'CLONADO_TRADICIONAL'
        const subpasosBasicos: Array<SubpasoBasicos> =
          tipoOrigen === 'CLONADO_INTERNO'
            ? ['captura']
            : [
                'tipo',
                ...(requiereAmbito && ambito.puedeElegirFacultad
                  ? (['facultad'] as const)
                  : []),
                ...(requiereAmbito && ambito.puedeElegirCarrera
                  ? (['carrera'] as const)
                  : []),
                'captura',
              ]
        const posicionSubpaso = subpasosBasicos.indexOf(subpasoBasicos)
        const avanzarSubpasoBasicos = () => {
          if (
            posicionSubpaso >= 0 &&
            posicionSubpaso + 1 < subpasosBasicos.length
          ) {
            setSubpasoBasicos(subpasosBasicos[posicionSubpaso + 1])
          }
        }
        const retrocederSubpasoBasicos = () => {
          if (posicionSubpaso > 0) {
            setSubpasoBasicos(subpasosBasicos[posicionSubpaso - 1])
            return
          }
          methods.goTo(
            tipoOrigen === 'CLONADO_TRADICIONAL' ? 'detalles' : 'modo',
          )
        }
        const irRelativo = (desplazamiento: -1 | 1) => {
          const destinoIndex = posicionActual + desplazamiento
          if (destinoIndex < 0 || destinoIndex >= ordenVisible.length) return
          methods.goTo(ordenVisible[destinoIndex])
        }

        /**
         * Valida SOLO los campos del paso actual (según el modo elegido)
         * antes de avanzar: marca cada campo como tocado para que los
         * errores por campo sean visibles y ejecuta sus validadores con
         * causa 'submit'.
         */
        const validateStep = async (targetStep: PasoWizardId = stepId) => {
          const campos = camposPorPaso(
            targetStep,
            form.state.values.tipoOrigen,
            esCurricular,
            { requiereMotivoEstructura, requiereSemanas },
          )
          let pasoValido = true
          for (const name of campos) {
            form.setFieldMeta(name, (meta) => ({ ...meta, isTouched: true }))
            const errores = await form.validateField(name, 'submit')
            if (errores.length > 0) pasoValido = false
          }
          return pasoValido
        }
        /**
         * Ejecuta una ronda de encuadre y vuelca el resultado en el form.
         * Las respuestas no viajan de vuelta desde el servidor: se conservan
         * aquí salvo en la ronda 0, donde el encuadre se rehace desde cero y
         * las de la solicitud anterior ya no corresponden a nada.
         */
        const analizar = async (ronda: number) => {
          const values = form.state.values
          const respuestas = ronda === 0 ? {} : values.iaBrief.respuestas
          const entrada = entradaEncuadre(
            values,
            catalogosEncuadre,
            ronda,
            respuestas,
          )
          const resultado = await analizarEncuadre.mutateAsync(entrada)
          form.setFieldValue('iaBrief', {
            ...values.iaBrief,
            ...resultado,
            firma: firmaEncuadre(entrada),
            respuestas,
          })
          return resultado
        }

        const handleNext = async () => {
          const bloqueo = errorPasoActual(
            stepId,
            form.state.values,
            esCurricular,
          )
          // La validación por campo marca lo que falta; el bloqueo por paso
          // cubre además reglas que ningún control expone por sí solo.
          const camposValidos = await validateStep()
          if (bloqueo) {
            if (camposValidos) notify.error(bloqueo)
            return
          }

          if (stepId === 'detalles' && tipoOrigen === 'IA') {
            if (!canUseAI) {
              notify.error(
                'No tienes permiso para usar la generación asistida.',
              )
              return
            }
            // Volver atrás y reentrar no vuelve a analizar: mientras la
            // solicitud, el contexto y las referencias no cambien, el
            // encuadre ya pagado sigue siendo válido.
            const firmaActual = firmaEncuadre(
              entradaEncuadre(form.state.values, catalogosEncuadre, 0, {}),
            )
            if (encuadreVigente(form.state.values, firmaActual)) {
              irRelativo(1)
              return
            }
            try {
              await analizar(0)
              irRelativo(1)
            } catch (error) {
              notify.error(error, {
                description: 'No se pudo analizar el encuadre curricular.',
              })
            }
            return
          }

          if (stepId === 'aclaraciones' && tipoOrigen === 'IA') {
            if (!canUseAI) {
              notify.error(
                'No tienes permiso para usar la generación asistida.',
              )
              return
            }
            const values = form.state.values
            if (
              values.iaBrief.estado === 'LISTO' ||
              values.iaBrief.ronda >= 1
            ) {
              irRelativo(1)
              return
            }
            try {
              const resultado = await analizar(values.iaBrief.ronda + 1)
              if (resultado.estado === 'LISTO') irRelativo(1)
            } catch (error) {
              notify.error(error, {
                description: 'No se pudieron analizar tus respuestas.',
              })
            }
            return
          }

          if (stepId === 'detalles' && tipoOrigen !== 'IA') {
            if (tipoOrigen === 'CLONADO_TRADICIONAL') {
              setSubpasoBasicos('tipo')
              methods.goTo('basicos')
              return
            }
            irRelativo(1)
            return
          }

          if (stepId === 'basicos') {
            methods.goTo(
              tipoOrigen === 'MANUAL' || tipoOrigen === 'CLONADO_TRADICIONAL'
                ? 'resumen'
                : 'detalles',
            )
            return
          }

          irRelativo(1)
        }
        /** Vuelve a analizar el encuadre a petición explícita del usuario. */
        const handleReanalizar = async () => {
          if (!canUseAI) {
            notify.error('No tienes permiso para usar la generación asistida.')
            return
          }
          try {
            await analizar(0)
          } catch (error) {
            notify.error(error, {
              description: 'No se pudo rehacer el encuadre curricular.',
            })
          }
        }
        const handlePrev = () => {
          if (stepId === 'basicos') {
            retrocederSubpasoBasicos()
            return
          }
          if (stepId === 'detalles' && tipoOrigen === 'CLONADO_TRADICIONAL') {
            methods.goTo('modo')
            return
          }
          if (stepId === 'resumen' && tipoOrigen === 'CLONADO_TRADICIONAL') {
            setSubpasoBasicos('captura')
            methods.goTo('basicos')
            return
          }
          irRelativo(-1)
        }
        const handleMethodSelected = (selected: typeof tipoOrigen) => {
          if (selected === 'CLONADO_TRADICIONAL') {
            methods.goTo('detalles')
            return
          }
          setSubpasoBasicos(selected === 'CLONADO_INTERNO' ? 'captura' : 'tipo')
          methods.goTo('basicos')
        }

        const disableNext =
          hasPendingDedupe || hasPendingUploads || analizarEncuadre.isPending
        const motivoPendiente = hasPendingDedupe
          ? 'Verificando los archivos adjuntos…'
          : hasPendingUploads
            ? 'Espera a que terminen de subirse los archivos adjuntos.'
            : null
        const nextPendingLabel =
          stepId === 'aclaraciones'
            ? 'Analizando respuestas…'
            : 'Analizando encuadre…'

        return (
          <WizardLayout
            title="Nuevo plan de estudios"
            onClose={handleClose}
            contentKey={`${stepId}:${subpasoBasicos}`}
            headerActions={
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Abrir guía de creación del plan"
                    onClick={() =>
                      window.dispatchEvent(new Event(INICIAR_GUIA_EVENT))
                    }
                  >
                    <CircleHelp className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Guía de creación</TooltipContent>
              </Tooltip>
            }
            headerSlot={
              stepId === 'modo' ? undefined : (
                <WizardResponsiveHeader
                  wizard={Wizard}
                  methods={methods}
                  titleOverrides={titleOverrides}
                  hiddenStepIds={hiddenStepIds}
                  visibleStepIds={
                    tipoOrigen === 'CLONADO_TRADICIONAL'
                      ? ['detalles', 'basicos', 'resumen']
                      : undefined
                  }
                />
              )
            }
            footerSlot={
              stepId === 'modo' ? undefined : (
                <Wizard.Stepper.Controls>
                  {stepId === 'basicos' && subpasoBasicos !== 'captura' ? (
                    <div className="gap-grupo flex grow items-center justify-between">
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={handlePrev}
                      >
                        Anterior
                      </Button>
                      {motivoSubpasoBasicos && (
                        <span
                          className="text-muted-foreground text-right text-sm"
                          aria-live="polite"
                        >
                          {motivoSubpasoBasicos}
                        </span>
                      )}
                    </div>
                  ) : (
                    <WizardControls
                      form={form}
                      stepId={stepId}
                      esCurricular={esCurricular}
                      onPrev={handlePrev}
                      onNext={() => void handleNext()}
                      disablePrev={
                        hasPendingDedupe ||
                        hasPendingUploads ||
                        analizarEncuadre.isPending
                      }
                      disableNext={disableNext}
                      disableCreate={hasPendingDedupe || hasPendingUploads}
                      motivoPendiente={motivoPendiente}
                      isLastStep={posicionActual >= ordenVisible.length - 1}
                      isNextPending={analizarEncuadre.isPending}
                      nextPendingLabel={nextPendingLabel}
                    />
                  )}
                </Wizard.Stepper.Controls>
              )
            }
          >
            <PrefillAmbitoPlan form={form} />
            <div
              className={cn(
                'mx-auto w-full',
                stepId === 'basicos' && subpasoBasicos !== 'captura'
                  ? 'max-w-none'
                  : 'max-w-3xl',
                (stepId === 'basicos' || stepId === 'detalles') &&
                  'flex min-h-full flex-col',
              )}
            >
              {stepId === 'modo' && (
                <Wizard.Stepper.Panel className="py-relacionado w-full">
                  <PasoModoCardGroup
                    form={form}
                    canUseAI={canUseAI}
                    onSelect={handleMethodSelected}
                  />
                </Wizard.Stepper.Panel>
              )}
              {stepId === 'basicos' && subpasoBasicos === 'tipo' && (
                <Wizard.Stepper.Panel className="w-full">
                  <PasoTipoPlanForm
                    form={form}
                    onSeleccionado={avanzarSubpasoBasicos}
                  />
                </Wizard.Stepper.Panel>
              )}
              {stepId === 'basicos' && subpasoBasicos === 'facultad' && (
                <Wizard.Stepper.Panel className="w-full">
                  <PasoFacultadForm
                    form={form}
                    onSeleccionado={avanzarSubpasoBasicos}
                  />
                </Wizard.Stepper.Panel>
              )}
              {stepId === 'basicos' && subpasoBasicos === 'carrera' && (
                <Wizard.Stepper.Panel className="w-full">
                  <PasoCarreraForm
                    form={form}
                    onSeleccionado={avanzarSubpasoBasicos}
                  />
                </Wizard.Stepper.Panel>
              )}
              {stepId === 'basicos' && subpasoBasicos === 'captura' && (
                <Wizard.Stepper.Panel className="min-h-full w-full">
                  {tipoOrigen === 'CLONADO_INTERNO' ? (
                    <PasoFuenteClonadoInterno form={form} />
                  ) : (
                    <PasoBasicosForm
                      form={form}
                      onCambiarAmbito={setSubpasoBasicos}
                    />
                  )}
                </Wizard.Stepper.Panel>
              )}
              {stepId === 'detalles' && (
                <Wizard.Stepper.Panel className="flex min-h-full w-full flex-col">
                  {tipoOrigen === 'CLONADO_INTERNO' ? (
                    <PasoBasicosForm
                      form={form}
                      onCambiarAmbito={(destino) => {
                        setSubpasoBasicos(destino)
                        methods.goTo('basicos')
                      }}
                    />
                  ) : (
                    <PasoDetallesPanel form={form} />
                  )}
                </Wizard.Stepper.Panel>
              )}
              {stepId === 'aclaraciones' && tipoOrigen === 'IA' && (
                <Wizard.Stepper.Panel>
                  <PasoAclaracionesIA
                    form={form}
                    onReanalizar={() => void handleReanalizar()}
                    isReanalizando={analizarEncuadre.isPending}
                    puedeReanalizar={canUseAI}
                  />
                </Wizard.Stepper.Panel>
              )}
              {stepId === 'resumen' && (
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
