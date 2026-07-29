import { useStore } from '@tanstack/react-form'
import { useMutation } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { BookOpen } from 'lucide-react'
import { useState } from 'react'

import { generarCitasCSL } from './citas'
import { anclaBibliotecaSugerencia } from './lib'
import { BibliotecaStep } from './pasos/BibliotecaStep'
import { BusquedaReferenciasStep } from './pasos/BusquedaReferenciasStep'
import { DatosBasicosManualStep } from './pasos/DatosBasicosManualStep'
import { FormatoYCitasStep } from './pasos/FormatoYCitasStep'
import { MetodoStep } from './pasos/MetodoStep'
import { ResumenStep } from './pasos/ResumenStep'
import {
  puedeContinuarDesdePaso2,
  puedeContinuarDesdePaso3,
  sugerenciaBibliotecaResuelta,
  valoresInicialesNuevaBibliografia,
} from './schema'

import type { BibliografiaRef, FormatoCita } from './types'

import { useAppForm } from '@/components/form'
import { defineStepper } from '@/components/stepper'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { WizardLayout } from '@/components/wizard/WizardLayout'
import { WizardResponsiveHeader } from '@/components/wizard/WizardResponsiveHeader'
import {
  requestAdminOverrideReason,
  useAsignaturaCapabilities,
} from '@/data/auth/planCapabilities'
import { usePlan } from '@/data/hooks/usePlans'
import { useCreateBibliografia } from '@/data/hooks/useSubjects'

export type { FormatoCita } from './types'

const Wizard = defineStepper(
  { id: 'metodo', title: 'Método', description: 'Manual o Buscar en línea' },
  {
    id: 'paso2',
    title: 'Datos básicos',
    description: 'Seleccionar o capturar',
  },
  {
    id: 'biblioteca',
    title: 'Biblioteca',
    description: 'Comparar con alternativas de la biblioteca',
  },
  { id: 'paso3', title: 'Detalles', description: 'Formato y citas' },
  { id: 'resumen', title: 'Resumen', description: 'Confirmar' },
)

export function NuevaBibliografiaModalContainer({
  planId,
  asignaturaId,
}: {
  planId: string
  asignaturaId: string
}) {
  const navigate = useNavigate()
  const createBibliografia = useCreateBibliografia()
  const { data: plan, isLoading: isPlanLoading } = usePlan(planId)
  const capabilities = useAsignaturaCapabilities(plan, asignaturaId)
  const canCreateBibliografia = capabilities.canEditAsignaturas

  // Error global del wizard (antes `wizard.errorMessage`): presentación
  // efímera; cualquier edición del form lo descarta (listener de abajo).
  const [serverError, setServerError] = useState<string | null>(null)

  // Referencias cuya cita CSL se está generando (antes `wizard.generatingIds`).
  const [generatingIds, setGeneratingIds] = useState<ReadonlySet<string>>(
    () => new Set<string>(),
  )

  // Estado del acordeón del paso Biblioteca, elevado para que la validación
  // por paso pueda abrir la comparación pendiente al pulsar "Siguiente".
  const [openBibliotecaIds, setOpenBibliotecaIds] = useState<Array<string>>([])

  // Form global del wizard: única fuente de verdad de los valores del
  // dominio. La validación es por paso (handleNext) y el submit final lo
  // orquesta la mutación `guardar`.
  const form = useAppForm({
    defaultValues: valoresInicialesNuevaBibliografia(),
    listeners: {
      onChange: () => setServerError(null),
    },
  })

  const metodo = useStore(form.store, (s) => s.values.metodo)
  const canContinueDesdePaso2 = useStore(form.store, (s) =>
    puedeContinuarDesdePaso2(s.values),
  )
  const canContinueDesdePaso3 = useStore(form.store, (s) =>
    puedeContinuarDesdePaso3(s.values),
  )
  const hasOnlineSelected = useStore(form.store, (s) =>
    s.values.ia.sugerencias.some((item) => item.selected),
  )

  const titleOverrides: Record<string, string> =
    metodo === 'BUSCAR'
      ? {
          paso2: 'Referencias',
          biblioteca: 'Verificar disponibilidad',
          paso3: 'Citas',
        }
      : { paso2: 'Captura', paso3: 'Citas' }

  const handleClose = () => {
    void navigate({
      to: '/planes/$planId/asignaturas/$asignaturaId/bibliografia',
      params: { planId, asignaturaId },
      resetScroll: false,
    })
  }

  /**
   * Genera las citas CSL y las fusiona en `citaEdits` (con `force` se
   * sobreescriben las existentes). Reacciona a acciones del usuario: elegir
   * formato, regenerar y avanzar al paso Detalles (antes, un useEffect).
   */
  const generateCitas = async (
    formato: FormatoCita,
    refs: Array<BibliografiaRef>,
    options?: { force?: boolean },
  ) => {
    const force = Boolean(options?.force)
    setGeneratingIds((prev) => {
      const next = new Set(prev)
      refs.forEach((r) => next.add(r.id))
      return next
    })

    try {
      const citations = await generarCitasCSL(formato, refs)

      const edits = form.state.values.citaEdits
      const merged: Record<string, string> = { ...edits[formato] }
      for (const id of Object.keys(citations)) {
        merged[id] =
          force || !merged[id] || merged[id].trim().length === 0
            ? (citations[id] ?? '')
            : merged[id]
      }
      form.setFieldValue('citaEdits', { ...edits, [formato]: merged })
    } catch (e: unknown) {
      setServerError(e instanceof Error ? e.message : 'Error al generar citas')
    } finally {
      setGeneratingIds((prev) => {
        const next = new Set(prev)
        refs.forEach((r) => next.delete(r.id))
        return next
      })
    }
  }

  /** Al entrar al paso Detalles, completa las citas que falten. */
  const ensureCitasDetalles = () => {
    const { formato, refs, citaEdits } = form.state.values
    if (!formato || refs.length === 0) return
    const map = citaEdits[formato]
    const missing = refs.some(
      (r) => !map[r.id] || map[r.id].trim().length === 0,
    )
    if (!missing) return
    if (generatingIds.size > 0) return
    void generateCitas(formato, refs)
  }

  // La creación es una operación remota multi-paso: TanStack Query aporta el
  // estado pendiente (sustituye a `wizard.isSaving`) y evita el doble envío.
  const guardar = useMutation({
    mutationFn: async (): Promise<'creado' | 'cancelado'> => {
      const values = form.state.values

      const adminOverrideReason = capabilities.requiresAdminOverrideForEdit
        ? await requestAdminOverrideReason(
            'agregar bibliografia fuera de su etapa normal',
          )
        : null
      if (capabilities.requiresAdminOverrideForEdit && !adminOverrideReason) {
        return 'cancelado'
      }

      const formato = values.formato
      if (!formato) throw new Error('Selecciona un formato')
      const map = values.citaEdits[formato]
      if (values.refs.length === 0) throw new Error('No hay referencias')

      await Promise.all(
        values.refs.map((r) =>
          createBibliografia.mutateAsync({
            asignatura_id: asignaturaId,
            tipo: r.tipo,
            cita: map[r.id] ?? '',
            titulo: r.subtitle ? `${r.title}: ${r.subtitle}` : r.title,
            autores: r.authors,
            editorial: r.publisher ?? null,
            anio: r.year ?? null,
            isbn: r.isbn ?? null,
            formato,
            referencia_en_linea: r.referenciaEnLinea ?? null,
            referencia_biblioteca: r.referenciaBiblioteca ?? null,
            adminOverrideReason,
          }),
        ),
      )
      return 'creado'
    },
    onMutate: () => setServerError(null),
    onSuccess: (resultado) => {
      if (resultado === 'creado') handleClose()
    },
    onError: (e: unknown) => {
      setServerError(
        e instanceof Error ? e.message : 'Error al guardar bibliografía',
      )
    },
  })

  const handleCreate = () => {
    if (!canCreateBibliografia || guardar.isPending) return
    guardar.mutate()
  }

  const isSaving = guardar.isPending

  if (isPlanLoading) {
    return (
      <WizardLayout title="Agregar Bibliografía" onClose={handleClose}>
        <div className="text-muted-foreground p-8 text-center text-sm">
          Cargando permisos...
        </div>
      </WizardLayout>
    )
  }

  if (!canCreateBibliografia) {
    return (
      <WizardLayout title="Agregar Bibliografía" onClose={handleClose}>
        <div className="mx-auto max-w-md p-8 text-center">
          <BookOpen className="text-muted-foreground mx-auto mb-3 h-10 w-10 opacity-50" />
          <h2 className="text-lg font-semibold">Modo solo lectura</h2>
          <p className="text-muted-foreground mt-2 text-sm">
            La bibliografía de esta asignatura no se puede modificar en la etapa
            actual del plan de estudios.
          </p>
          <Button className="mt-5" variant="secondary" onClick={handleClose}>
            Volver a bibliografía
          </Button>
        </div>
      </WizardLayout>
    )
  }

  return (
    <Wizard.Stepper.Provider
      initialStep={Wizard.utils.getFirst().id}
      className="flex h-full flex-col"
    >
      {({ methods }) => {
        const currentId = methods.current.id
        const isLast = currentId === 'resumen'

        const handlePrev = () => {
          if (currentId === 'paso2') {
            methods.goTo('metodo')
            return
          }
          if (currentId === 'biblioteca') {
            methods.goTo('paso2')
            return
          }
          if (currentId === 'paso3') {
            methods.goTo(
              metodo === 'BUSCAR' && hasOnlineSelected ? 'biblioteca' : 'paso2',
            )
            return
          }
          if (currentId === 'resumen') {
            methods.goTo('paso3')
          }
        }

        /**
         * Validación por paso al avanzar (sustituye a los antiguos
         * `validateBeforeNext()` imperativos por ref).
         */
        const handleNext = async () => {
          const values = form.state.values

          if (currentId === 'paso2') {
            if (!puedeContinuarDesdePaso2(values)) return
            methods.goTo(
              values.metodo === 'BUSCAR' &&
                values.ia.sugerencias.some((item) => item.selected)
                ? 'biblioteca'
                : 'paso3',
            )
            ensureCitasDetalles()
            return
          }

          if (currentId === 'biblioteca') {
            const pendiente = values.ia.sugerencias
              .filter((s) => s.selected)
              .find((s) => !sugerenciaBibliotecaResuelta(s))

            if (pendiente) {
              // Sin mensaje de error (misma UX): abrir y enfocar la
              // comparación pendiente.
              setOpenBibliotecaIds((prev) =>
                prev.includes(pendiente.id) ? prev : [...prev, pendiente.id],
              )
              requestAnimationFrame(() => {
                document
                  .getElementById(anclaBibliotecaSugerencia(pendiente.id))
                  ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
              })
              return
            }

            methods.goTo('paso3')
            ensureCitasDetalles()
            return
          }

          if (currentId === 'paso3') {
            // Títulos: normalizar, marcar tocados y validar con causa
            // 'submit' para que el error por campo sea visible.
            let firstInvalid: string | null = null
            for (let i = 0; i < values.refs.length; i++) {
              const name = `refs[${i}].title` as const
              const trimmed = values.refs[i].title.trim()
              if (trimmed !== values.refs[i].title) {
                form.setFieldValue(name, trimmed)
              }
              form.setFieldMeta(name, (meta) => ({ ...meta, isTouched: true }))
              const errores = await form.validateField(name, 'submit')
              if (errores.length > 0 && !firstInvalid) firstInvalid = name
            }

            if (firstInvalid) {
              const el = document.getElementById(firstInvalid)
              el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
              el?.focus()
              return
            }

            if (values.metodo === 'BUSCAR' && values.formato) {
              void generateCitas(values.formato, form.state.values.refs, {
                force: true,
              })
            }
            methods.goTo('resumen')
            return
          }
        }

        const canContinue =
          currentId === 'paso2'
            ? canContinueDesdePaso2
            : currentId === 'paso3'
              ? canContinueDesdePaso3
              : true
        const motivoBloqueo =
          currentId === 'paso2' && !canContinueDesdePaso2
            ? metodo === 'BUSCAR'
              ? 'Selecciona al menos una referencia para continuar.'
              : 'Agrega al menos una referencia para continuar.'
            : currentId === 'paso3' && !canContinueDesdePaso3
              ? 'Selecciona un formato y revisa las citas para continuar.'
              : null

        return (
          <WizardLayout
            title="Agregar Bibliografía"
            onClose={handleClose}
            contentKey={currentId}
            headerSlot={
              currentId === 'metodo' ? undefined : (
                <WizardResponsiveHeader
                  wizard={Wizard}
                  methods={methods}
                  titleOverrides={titleOverrides}
                  hiddenStepIds={[
                    'metodo',
                    ...(metodo === 'BUSCAR' && hasOnlineSelected
                      ? []
                      : ['biblioteca']),
                  ]}
                />
              )
            }
            footerSlot={
              currentId === 'metodo' ? undefined : (
                <Wizard.Stepper.Controls>
                  <div className="flex grow items-center justify-between gap-4">
                    <Button
                      variant="secondary"
                      onClick={handlePrev}
                      disabled={isSaving}
                    >
                      Anterior
                    </Button>
                    <div className="flex-1 text-right">
                      {motivoBloqueo ? (
                        <span
                          className="text-muted-foreground text-sm"
                          aria-live="polite"
                        >
                          {motivoBloqueo}
                        </span>
                      ) : null}
                    </div>
                    {isLast ? (
                      <Button onClick={handleCreate} disabled={isSaving}>
                        {isSaving ? 'Agregando...' : 'Agregar bibliografía'}
                      </Button>
                    ) : canContinue ? (
                      <Button
                        onClick={() => void handleNext()}
                        disabled={isSaving}
                      >
                        Siguiente
                      </Button>
                    ) : null}
                  </div>
                </Wizard.Stepper.Controls>
              )
            }
          >
            <div className="mx-auto w-full max-w-3xl">
              {serverError ? (
                <Card className="border-destructive/40 mb-4">
                  <CardHeader>
                    <CardTitle className="text-destructive">
                      {serverError}
                    </CardTitle>
                  </CardHeader>
                </Card>
              ) : null}

              {currentId === 'metodo' && (
                <Wizard.Stepper.Panel className="py-2">
                  <MetodoStep
                    form={form}
                    onSelect={() => methods.goTo('paso2')}
                  />
                </Wizard.Stepper.Panel>
              )}

              {currentId === 'paso2' && (
                <Wizard.Stepper.Panel className="py-2">
                  {metodo === 'BUSCAR' ? (
                    <BusquedaReferenciasStep form={form} />
                  ) : (
                    <DatosBasicosManualStep form={form} />
                  )}
                </Wizard.Stepper.Panel>
              )}

              {currentId === 'biblioteca' &&
                metodo === 'BUSCAR' &&
                hasOnlineSelected && (
                  <Wizard.Stepper.Panel>
                    <BibliotecaStep
                      form={form}
                      openIds={openBibliotecaIds}
                      onOpenIdsChange={setOpenBibliotecaIds}
                    />
                  </Wizard.Stepper.Panel>
                )}

              {currentId === 'paso3' && (
                <Wizard.Stepper.Panel>
                  <FormatoYCitasStep
                    form={form}
                    generatingIds={generatingIds}
                    onFormatoChange={(formato) => {
                      setServerError(null)
                      void generateCitas(formato, form.state.values.refs)
                    }}
                    onRegenerate={() => {
                      const { formato, refs } = form.state.values
                      if (!formato) return
                      void generateCitas(formato, refs, { force: true })
                    }}
                  />
                </Wizard.Stepper.Panel>
              )}

              {currentId === 'resumen' && (
                <Wizard.Stepper.Panel>
                  <ResumenStep form={form} />
                </Wizard.Stepper.Panel>
              )}
            </div>
          </WizardLayout>
        )
      }}
    </Wizard.Stepper.Provider>
  )
}
