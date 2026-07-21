import { useStore } from '@tanstack/react-form'
import { useMutation } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { BookOpen } from 'lucide-react'
import { useState } from 'react'

import { generarCitasCSL } from './citas'
import {
  anclaBibliotecaSugerencia,
  computeRefsParaDetalle,
  getEndpointResultId,
  iaSugerenciaToEndpointResult,
  sortResultsByMostRecent,
} from './lib'
import { BibliotecaBusquedaStep } from './pasos/BibliotecaBusquedaStep'
import { BibliotecaStep } from './pasos/BibliotecaStep'
import { DatosBasicosManualStep } from './pasos/DatosBasicosManualStep'
import { FormatoYCitasStep } from './pasos/FormatoYCitasStep'
import { MetodoStep } from './pasos/MetodoStep'
import { ResumenStep } from './pasos/ResumenStep'
import { SugerenciasStep } from './pasos/SugerenciasStep'
import {
  puedeContinuarDesdeMetodo,
  puedeContinuarDesdePaso2,
  puedeContinuarDesdePaso3,
  sugerenciaBibliotecaResuelta,
  valoresInicialesNuevaBibliografia,
} from './schema'
import { IDIOMA_TO_GOOGLE, IDIOMA_TO_OPEN_LIBRARY } from './types'

import type { BibliografiaRef, FormatoCita } from './types'
import type { BuscarBibliografiaRequest } from '@/data'

import { useAppForm } from '@/components/form'
import { defineStepper } from '@/components/stepper'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { WizardLayout } from '@/components/wizard/WizardLayout'
import { WizardResponsiveHeader } from '@/components/wizard/WizardResponsiveHeader'
import { buscar_bibliografia } from '@/data'
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

  // Tooltip informativo tras la primera búsqueda con resultados.
  const [showConservacionTooltip, setShowConservacionTooltip] = useState(false)

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
  const canContinueDesdeMetodo = useStore(form.store, (s) =>
    puedeContinuarDesdeMetodo(s.values),
  )
  const canContinueDesdePaso2 = useStore(form.store, (s) =>
    puedeContinuarDesdePaso2(s.values),
  )
  const canContinueDesdePaso3 = useStore(form.store, (s) =>
    puedeContinuarDesdePaso3(s.values),
  )

  const titleOverrides: Record<string, string> =
    metodo === 'EN_LINEA'
      ? { paso2: 'Sugerencias', biblioteca: 'Biblioteca', paso3: 'Estructura' }
      : metodo === 'BIBLIOTECA'
        ? { paso2: 'Biblioteca', paso3: 'Detalles' }
        : { paso2: 'Datos básicos', paso3: 'Detalles' }

  const handleClose = () => {
    void navigate({
      to: '/planes/$planId/asignaturas/$asignaturaId/bibliografia',
      params: { planId, asignaturaId },
      resetScroll: false,
    })
  }

  // Búsqueda en línea (Google Books + Open Library). La mutación aporta el
  // estado pendiente/error (antes `ia.isLoading` / `ia.errorMessage`).
  const buscarSugerencias = useMutation({
    mutationFn: (req: BuscarBibliografiaRequest) => buscar_bibliografia(req),
  })

  const handleBuscarSugerencias = () => {
    if (buscarSugerencias.isPending) return

    const { ia } = form.state.values
    const hadNoSugerenciasBefore = ia.sugerencias.length === 0
    const seleccionadas = ia.sugerencias.filter((s) => s.selected)

    if (seleccionadas.length >= 20) return

    const q = ia.q.trim()
    if (!q) return

    // Conservar únicamente las sugerencias seleccionadas antes de buscar más.
    form.setFieldValue('ia.sugerencias', seleccionadas)
    setShowConservacionTooltip(false)
    setServerError(null)

    const idioma = ia.idioma
    const googleLangRestrict = IDIOMA_TO_GOOGLE[idioma]
    const openLibraryLanguage = IDIOMA_TO_OPEN_LIBRARY[idioma]

    const google: BuscarBibliografiaRequest['google'] = {
      orderBy: 'newest',
      startIndex: 0,
    }
    if (googleLangRestrict) google.langRestrict = googleLangRestrict

    const openLibrary: BuscarBibliografiaRequest['openLibrary'] = {
      sort: 'new',
      page: 1,
    }
    if (openLibraryLanguage) openLibrary.language = openLibraryLanguage

    buscarSugerencias.mutate(
      { searchTerms: { q }, google, openLibrary },
      {
        onSuccess: (items) => {
          const ordered = items.slice().sort(sortResultsByMostRecent)
          const actuales = form.state.values.ia.sugerencias
          const existingById = new Map(actuales.map((s) => [s.id, s]))

          const newOnes = ordered
            .map((r) => ({
              id: getEndpointResultId(r),
              selected: false,
              endpoint: r.endpoint,
              item: r.item,
            }))
            .filter((it) => !existingById.has(it.id))

          const merged = [...actuales, ...newOnes]
          merged.sort(
            (a, b) =>
              sortResultsByMostRecent(
                iaSugerenciaToEndpointResult(a),
                iaSugerenciaToEndpointResult(b),
              ) || a.id.localeCompare(b.id),
          )

          form.setFieldValue('ia.sugerencias', merged)
          form.setFieldValue('refs', computeRefsParaDetalle(form.state.values))
          setShowConservacionTooltip(
            hadNoSugerenciasBefore && newOnes.length > 0,
          )
        },
      },
    )
  }

  const searchError = buscarSugerencias.error
    ? buscarSugerencias.error instanceof Error
      ? buscarSugerencias.error.message
      : 'Error al buscar bibliografía'
    : null

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
  const isSearching = buscarSugerencias.isPending

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
        const idx = Wizard.utils.getIndex(methods.current.id)
        const isLast = idx >= Wizard.steps.length - 1
        const currentId = methods.current.id

        const handlePrev = () => {
          if (
            (metodo === 'MANUAL' || metodo === 'BIBLIOTECA') &&
            currentId === 'paso3'
          ) {
            methods.goTo('paso2')
            return
          }
          methods.prev()
        }

        /**
         * Validación por paso al avanzar (sustituye a los antiguos
         * `validateBeforeNext()` imperativos por ref).
         */
        const handleNext = async () => {
          const values = form.state.values

          // MANUAL/BIBLIOTECA saltan el paso de comparación con biblioteca.
          if (
            (values.metodo === 'MANUAL' || values.metodo === 'BIBLIOTECA') &&
            currentId === 'paso2'
          ) {
            methods.goTo('paso3')
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

            methods.next()
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

            if (values.metodo === 'EN_LINEA' && values.formato) {
              void generateCitas(values.formato, form.state.values.refs, {
                force: true,
              })
            }
            methods.next()
            return
          }

          methods.next()
        }

        return (
          <WizardLayout
            title="Agregar Bibliografía"
            onClose={handleClose}
            headerSlot={
              <WizardResponsiveHeader
                wizard={Wizard}
                methods={methods}
                titleOverrides={titleOverrides}
                hiddenStepIds={
                  metodo === 'EN_LINEA' ? undefined : ['biblioteca']
                }
              />
            }
            footerSlot={
              <Wizard.Stepper.Controls>
                <div className="flex grow items-center justify-between">
                  <Button
                    variant="secondary"
                    onClick={handlePrev}
                    disabled={idx === 0 || isSearching || isSaving}
                  >
                    Anterior
                  </Button>
                  {isLast ? (
                    <Button onClick={handleCreate} disabled={isSaving}>
                      {isSaving ? 'Agregando...' : 'Agregar Bibliografía'}
                    </Button>
                  ) : (
                    <Button
                      onClick={() => void handleNext()}
                      disabled={
                        isSearching ||
                        isSaving ||
                        (currentId === 'metodo' && !canContinueDesdeMetodo) ||
                        (currentId === 'paso2' && !canContinueDesdePaso2) ||
                        (currentId === 'paso3' && !canContinueDesdePaso3)
                      }
                    >
                      Siguiente
                    </Button>
                  )}
                </div>
              </Wizard.Stepper.Controls>
            }
          >
            <div className="mx-auto max-w-3xl">
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
                <Wizard.Stepper.Panel>
                  <MetodoStep form={form} />
                </Wizard.Stepper.Panel>
              )}

              {currentId === 'paso2' && (
                <Wizard.Stepper.Panel>
                  {metodo === 'BIBLIOTECA' ? (
                    <BibliotecaBusquedaStep form={form} />
                  ) : metodo === 'EN_LINEA' ? (
                    <SugerenciasStep
                      form={form}
                      isSearching={isSearching}
                      searchError={searchError}
                      showConservacionTooltip={showConservacionTooltip}
                      onDismissConservacionTooltip={() =>
                        setShowConservacionTooltip(false)
                      }
                      onGenerate={handleBuscarSugerencias}
                    />
                  ) : (
                    <DatosBasicosManualStep form={form} />
                  )}
                </Wizard.Stepper.Panel>
              )}

              {currentId === 'biblioteca' && metodo === 'EN_LINEA' && (
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
