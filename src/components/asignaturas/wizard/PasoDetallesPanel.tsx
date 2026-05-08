import * as Icons from 'lucide-react'

import type { UploadedFile } from '@/components/planes/wizard/PasoDetallesPanel/FileDropZone'
import type { NewSubjectWizardState } from '@/features/asignaturas/nueva/types'

import { FileDropzone } from '@/components/planes/wizard/PasoDetallesPanel/FileDropZone'
import ReferenciasParaIA from '@/components/planes/wizard/PasoDetallesPanel/ReferenciasParaIA'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { usePlan, usePlanLineas, useSubjectEstructuras } from '@/data'
import {
  FACULTADES,
  MATERIAS_MOCK,
  PLANES_MOCK,
} from '@/features/asignaturas/nueva/catalogs'

export function PasoDetallesPanel({
  wizard,
  onChange,
}: {
  wizard: NewSubjectWizardState
  onChange: React.Dispatch<React.SetStateAction<NewSubjectWizardState>>
}) {
  const { data: estructurasAsignatura } = useSubjectEstructuras()
  const { data: plan } = usePlan(wizard.plan_estudio_id)
  const { data: lineasPlan } = usePlanLineas(wizard.plan_estudio_id)

  if (wizard.tipoOrigen === 'MANUAL') {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Configuración Manual</CardTitle>
          <CardDescription>
            La asignatura se creará vacía. Podrás editar el contenido detallado
            en la siguiente pantalla.
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  if (wizard.tipoOrigen === 'IA_SIMPLE') {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <Label>Descripción del enfoque académico</Label>
          <Textarea
            placeholder="Describe el enfoque, alcance y público objetivo. Ej.: Teórica-práctica enfocada en patrones de diseño, con proyectos semanales..."
            maxLength={7000}
            value={wizard.iaConfig?.descripcionEnfoqueAcademico}
            onChange={(e) =>
              onChange(
                (w): NewSubjectWizardState => ({
                  ...w,
                  iaConfig: {
                    ...w.iaConfig!,
                    descripcionEnfoqueAcademico: e.target.value,
                  },
                }),
              )
            }
            className="placeholder:text-muted-foreground/70 min-h-25 font-medium not-italic placeholder:font-normal placeholder:italic"
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label>
            Instrucciones adicionales para la IA
            <span className="text-xs font-normal text-gray-500 dark:text-gray-400">
              (Opcional)
            </span>
          </Label>
          <Textarea
            placeholder="Opcional: restricciones y preferencias. Ej.: incluye bibliografía en español, evita contenido avanzado, prioriza evaluación por proyectos..."
            maxLength={7000}
            value={wizard.iaConfig?.instruccionesAdicionalesIA}
            onChange={(e) =>
              onChange(
                (w): NewSubjectWizardState => ({
                  ...w,
                  iaConfig: {
                    ...w.iaConfig!,
                    instruccionesAdicionalesIA: e.target.value,
                  },
                }),
              )
            }
            className="placeholder:text-muted-foreground/70 font-medium not-italic placeholder:font-normal placeholder:italic"
          />
        </div>

        <ReferenciasParaIA
          selectedArchivoIds={wizard.iaConfig?.archivosReferencia || []}
          selectedRepositorioIds={wizard.iaConfig?.repositoriosReferencia || []}
          uploadedFiles={wizard.iaConfig?.archivosAdjuntos || []}
          enableSha256Dedupe={true}
          enableAutoUpload={true}
          autoScrollToDropzone={true}
          onDedupePendingChange={(pendingCount) =>
            onChange(
              (w): NewSubjectWizardState => ({
                ...w,
                archivosAdjuntosDedupePending: pendingCount,
              }),
            )
          }
          onToggleArchivo={(id, checked) =>
            onChange((w): NewSubjectWizardState => {
              const prev = w.iaConfig?.archivosReferencia || []
              const next = checked
                ? [...prev, id]
                : prev.filter((a) => a !== id)
              return {
                ...w,
                iaConfig: {
                  ...w.iaConfig!,
                  archivosReferencia: next,
                },
              }
            })
          }
          onToggleRepositorio={(id, checked) =>
            onChange((w): NewSubjectWizardState => {
              const prev = w.iaConfig?.repositoriosReferencia || []
              const next = checked
                ? [...prev, id]
                : prev.filter((r) => r !== id)
              return {
                ...w,
                iaConfig: {
                  ...w.iaConfig!,
                  repositoriosReferencia: next,
                },
              }
            })
          }
          onFilesChange={(files: Array<UploadedFile>) =>
            onChange(
              (w): NewSubjectWizardState => ({
                ...w,
                iaConfig: {
                  ...w.iaConfig!,
                  archivosAdjuntos: files,
                },
              }),
            )
          }
        />
      </div>
    )
  }

  if (wizard.tipoOrigen === 'IA_MULTIPLE') {
    const maxCiclos = Math.max(1, plan?.numero_ciclos ?? 1)
    const sugerenciasSeleccionadas = wizard.sugerencias.filter(
      (s) => s.selected,
    )

    const patchSugerencia = (
      id: string,
      patch: Partial<NewSubjectWizardState['sugerencias'][number]>,
    ) =>
      onChange((w) => ({
        ...w,
        sugerencias: w.sugerencias.map((s) =>
          s.id === id ? { ...s, ...patch } : s,
        ),
      }))

    return (
      <div className="flex flex-col gap-4">
        <div className="border-border/60 bg-muted/30 rounded-xl border p-4">
          <div className="grid gap-1">
            <Label className="text-muted-foreground text-xs">
              Estructura de la asignatura
            </Label>
            <Select
              value={wizard.datosBasicos.estructuraId ?? undefined}
              onValueChange={(val) =>
                onChange(
                  (w): NewSubjectWizardState => ({
                    ...w,
                    estructuraId: val,
                    datosBasicos: { ...w.datosBasicos, estructuraId: val },
                  }),
                )
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecciona una estructura" />
              </SelectTrigger>
              <SelectContent>
                {(estructurasAsignatura ?? []).map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="border-border/60 bg-muted/30 rounded-xl border p-4">
          <h3 className="text-foreground mx-3 mb-2 text-lg font-semibold">
            Materias seleccionadas
          </h3>
          {sugerenciasSeleccionadas.length === 0 ? (
            <div className="text-muted-foreground text-sm">
              Selecciona al menos una sugerencia para configurar su descripción,
              línea curricular y ciclo.
            </div>
          ) : (
            <Accordion type="multiple" className="w-full space-y-2">
              {sugerenciasSeleccionadas.map((asig) => (
                <AccordionItem
                  key={asig.id}
                  value={asig.id}
                  className="border-border/60 bg-background/40 rounded-lg border border-b-0 px-3"
                >
                  <AccordionTrigger className="hover:bg-accent/30 data-[state=open]:bg-accent/20 data-[state=open]:text-accent-foreground -mx-3 px-3">
                    {asig.nombre}
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground">
                    <div className="mx-1 grid gap-3 sm:grid-cols-2">
                      <div className="grid gap-1">
                        <Label className="text-muted-foreground text-xs">
                          Descripción
                        </Label>
                        <Textarea
                          value={asig.descripcion}
                          maxLength={7000}
                          rows={6}
                          onChange={(e) =>
                            patchSugerencia(asig.id, {
                              descripcion: e.target.value,
                            })
                          }
                        />
                      </div>

                      <div className="grid content-start gap-3">
                        <div className="grid gap-1">
                          <Label className="text-muted-foreground text-xs">
                            Ciclo (opcional)
                          </Label>
                          <Input
                            type="number"
                            min={1}
                            max={maxCiclos}
                            step={1}
                            inputMode="numeric"
                            placeholder={`1-${maxCiclos}`}
                            value={asig.numero_ciclo ?? ''}
                            onKeyDown={(e) => {
                              if (
                                ['.', ',', '-', 'e', 'E', '+'].includes(e.key)
                              ) {
                                e.preventDefault()
                              }
                            }}
                            onChange={(e) => {
                              const raw = e.target.value
                              if (raw === '') {
                                patchSugerencia(asig.id, { numero_ciclo: null })
                                return
                              }

                              const asNumber = Number(raw)
                              if (!Number.isFinite(asNumber)) return

                              const n = Math.floor(Math.abs(asNumber))
                              const capped = Math.min(
                                Math.max(n >= 1 ? n : 1, 1),
                                maxCiclos,
                              )

                              patchSugerencia(asig.id, { numero_ciclo: capped })
                            }}
                          />
                        </div>
                        <div className="grid gap-1">
                          <Label className="text-muted-foreground text-xs">
                            Línea curricular (opcional)
                          </Label>
                          <Select
                            value={asig.linea_plan_id ?? '__none__'}
                            onValueChange={(val) =>
                              patchSugerencia(asig.id, {
                                linea_plan_id: val === '__none__' ? null : val,
                              })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Sin línea" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__">Ninguna</SelectItem>
                              {(lineasPlan ?? []).map((l) => (
                                <SelectItem key={l.id} value={l.id}>
                                  {l.nombre}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}
        </div>
      </div>
    )
  }

  if (wizard.tipoOrigen === 'CLONADO_INTERNO') {
    return (
      <div className="grid gap-4">
        <div className="grid gap-2 sm:grid-cols-3">
          <div>
            <Label>Facultad</Label>
            <Select
              onValueChange={(val) =>
                onChange((w) => ({
                  ...w,
                  clonInterno: { ...w.clonInterno, facultadId: val },
                }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Todas" />
              </SelectTrigger>
              <SelectContent>
                {FACULTADES.map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Plan</Label>
            <Select
              onValueChange={(val) =>
                onChange((w) => ({
                  ...w,
                  clonInterno: { ...w.clonInterno, planOrigenId: val },
                }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                {PLANES_MOCK.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Buscar</Label>
            <Input placeholder="Nombre..." />
          </div>
        </div>

        <div className="grid max-h-75 gap-2 overflow-y-auto">
          {MATERIAS_MOCK.map((m) => (
            <div
              key={m.id}
              role="button"
              tabIndex={0}
              onClick={() =>
                onChange((w) => ({
                  ...w,
                  clonInterno: { ...w.clonInterno, asignaturaOrigenId: m.id },
                }))
              }
              onKeyDown={(e) => {
                if (e.key !== 'Enter' && e.key !== ' ') return
                e.preventDefault()
                onChange((w) => ({
                  ...w,
                  clonInterno: { ...w.clonInterno, asignaturaOrigenId: m.id },
                }))
              }}
              className={`hover:bg-accent flex cursor-pointer items-center justify-between rounded-md border p-3 ${
                wizard.clonInterno?.asignaturaOrigenId === m.id
                  ? 'border-primary bg-primary/5 ring-primary ring-1'
                  : ''
              }`}
            >
              <div>
                <div className="font-medium">{m.nombre}</div>
                <div className="text-muted-foreground text-xs">
                  {m.clave} • {m.creditos} créditos
                </div>
              </div>
              {wizard.clonInterno?.asignaturaOrigenId === m.id && (
                <Icons.CheckCircle2 className="text-primary h-5 w-5" />
              )}
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (wizard.tipoOrigen === 'CLONADO_TRADICIONAL') {
    return (
      <div className="flex flex-col gap-4">
        <FileDropzone
          title="Word o PDF de las asignaturas"
          acceptedTypes=".doc,.docx,.pdf"
          maxFiles={10}
          autoScrollToDropzone={true}
          enableSha256Dedupe={true}
          enableAutoUpload={true}
          persistentFiles={wizard.clonTradicional?.archivosAdjuntos ?? []}
          onDedupePendingChange={(pendingCount) =>
            onChange(
              (w): NewSubjectWizardState => ({
                ...w,
                archivosAdjuntosDedupePending: pendingCount,
              }),
            )
          }
          onFilesChange={(files: Array<UploadedFile>) =>
            onChange(
              (w): NewSubjectWizardState => ({
                ...w,
                clonTradicional: {
                  archivosAdjuntos: files,
                },
              }),
            )
          }
        />
      </div>
    )
  }

  return null
}
