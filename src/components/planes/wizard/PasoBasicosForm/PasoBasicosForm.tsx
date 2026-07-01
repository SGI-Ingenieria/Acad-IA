import { useEffect, useMemo } from 'react'

import type {
  CarreraRow,
  EstructuraPlanRow,
  FacultadRow,
  TipoCiclo,
} from '@/data/types/domain'
import type { NewPlanWizardState } from '@/features/planes/nuevo/types'

import { FacultadIconPill } from '@/components/shared/FacultadIconPill'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  NumberField,
  NumberFieldDecrement,
  NumberFieldGroup,
  NumberFieldIncrement,
  NumberFieldInput,
} from '@/components/ui/number-field'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  resolveAcademicScope,
  useAcademicScope,
} from '@/data/auth/academicScope'
import { useCatalogosPlanes } from '@/data/hooks/usePlans'
import { NIVELES, TIPOS_CICLO } from '@/features/planes/nuevo/catalogs'
import { formatFacultadNombre } from '@/lib/facultad-utils'
import { cn } from '@/lib/utils'

function getDefaultsForNivel(nivel: string): {
  tipoCiclo?: TipoCiclo
  numCiclos?: number | null
} {
  if (nivel === 'Maestría' || nivel === 'Especialidad') {
    return { tipoCiclo: 'Cuatrimestre', numCiclos: 6 }
  }
  if (nivel === 'Licenciatura') {
    return { tipoCiclo: 'Semestre', numCiclos: 9 }
  }
  if (nivel === 'Doctorado') {
    return { tipoCiclo: 'Semestre', numCiclos: 8 }
  }
  return {}
}

function getDefaultPlanName(carrera: CarreraRow | undefined) {
  return carrera ? `${carrera.nombre} (${new Date().getFullYear()})` : ''
}

export function PasoBasicosForm({
  wizard,
  onChange,
}: {
  wizard: NewPlanWizardState
  onChange: React.Dispatch<React.SetStateAction<NewPlanWizardState>>
}) {
  const { data: catalogos } = useCatalogosPlanes()
  const academicScope = useAcademicScope()
  // const nivelNombre = wizard.datosBasicos.nivel.trim()
  // const nivelDisplayPrefix =
  //   nivelNombre && nivelNombre.toLowerCase() !== 'otro'
  //     ? `${nivelNombre} en`
  //     : ''

  // Preferir los catálogos remotos si están disponibles; si no, usar los locales
  const facultadesList = useMemo(
    () => catalogos?.facultades ?? [],
    [catalogos?.facultades],
  )
  const rawCarreras = useMemo(
    () => catalogos?.carreras ?? [],
    [catalogos?.carreras],
  )
  const estructurasPlanList = useMemo(
    () => catalogos?.estructurasPlan ?? [],
    [catalogos?.estructurasPlan],
  )

  const scope = useMemo(
    () => resolveAcademicScope(academicScope, facultadesList, rawCarreras),
    [academicScope, facultadesList, rawCarreras],
  )

  useEffect(() => {
    if (!catalogos) return

    const latestEstructuraId = estructurasPlanList[0]?.id ?? null
    const forcedCarrera = scope.forcedCarreraId
      ? rawCarreras.find((c) => c.id === scope.forcedCarreraId)
      : undefined
    const forcedFacultadId =
      forcedCarrera?.facultad_id ?? scope.forcedFacultadId ?? null
    const forcedFacultad = forcedFacultadId
      ? facultadesList.find((f) => f.id === forcedFacultadId)
      : undefined

    if (!latestEstructuraId && !forcedFacultad && !forcedCarrera) return

    onChange((w): NewPlanWizardState => {
      const current = w.datosBasicos
      const next = { ...current }
      let changed = false

      if (!next.estructuraPlanId && latestEstructuraId) {
        next.estructuraPlanId = latestEstructuraId
        changed = true
      }

      if (forcedFacultad && current.facultad.id !== forcedFacultad.id) {
        next.facultad = {
          id: forcedFacultad.id,
          nombre: forcedFacultad.nombre,
        }
        changed = true
      }

      if (forcedCarrera && current.carrera.id !== forcedCarrera.id) {
        const defaults = getDefaultsForNivel(String(forcedCarrera.nivel))
        next.carrera = {
          id: forcedCarrera.id,
          nombre: forcedCarrera.nombre,
        }
        if (!next.nombrePlan)
          next.nombrePlan = getDefaultPlanName(forcedCarrera)
        next.tipoCiclo = next.tipoCiclo || defaults.tipoCiclo || ''
        next.numCiclos = next.numCiclos ?? defaults.numCiclos ?? null
        changed = true
      }

      return changed ? { ...w, datosBasicos: next } : w
    })
  }, [
    catalogos,
    estructurasPlanList,
    facultadesList,
    onChange,
    rawCarreras,
    scope.forcedCarreraId,
    scope.forcedFacultadId,
  ])

  const carrerasFiltradas = scope.visibleCarreras.filter((c: any) => {
    const facId = wizard.datosBasicos.facultad.id
    if (!facId) return true
    // soportar ambos shapes: `facultad_id` (BD) o `facultadId` (local)
    return c.facultad_id ? c.facultad_id === facId : c.facultadId === facId
  })
  if (wizard.tipoOrigen === 'CLONADO_TRADICIONAL') {
    return (
      <div className="flex flex-col gap-2">
        <div className="grid gap-1">
          <Label htmlFor="estructuraPlan">Estructura de plan de estudios</Label>
          <Select
            value={wizard.datosBasicos.estructuraPlanId ?? ''}
            onValueChange={(value: string) =>
              onChange(
                (w): NewPlanWizardState => ({
                  ...w,
                  datosBasicos: {
                    ...w.datosBasicos,
                    estructuraPlanId: value,
                  },
                }),
              )
            }
          >
            <SelectTrigger
              id="estructuraPlan"
              className={cn(
                'w-full min-w-0 [&>span]:block! [&>span]:truncate!',
                !wizard.datosBasicos.estructuraPlanId
                  ? 'text-muted-foreground font-normal italic opacity-70'
                  : 'font-medium not-italic',
              )}
            >
              <SelectValue placeholder="Ej. Plan base SEP/ULSA (2026)" />
            </SelectTrigger>
            <SelectContent>
              {estructurasPlanList.map((t: EstructuraPlanRow) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    )
  }

  const carrerasPorNivel = carrerasFiltradas.reduce<Record<string, Array<any>>>(
    (acc, carrera: any) => {
      const nivel = String(carrera.nivel ?? '').trim() || 'Otro'
      acc[nivel] = acc[nivel] ?? []
      acc[nivel].push(carrera)
      return acc
    },
    {},
  )

  const nivelesCarreras = [
    ...NIVELES.filter((nivel) => (carrerasPorNivel[nivel] ?? []).length > 0),
    ...Object.keys(carrerasPorNivel).filter(
      (nivel) => !NIVELES.includes(nivel as (typeof NIVELES)[number]),
    ),
  ]

  const carreraSeleccionada = rawCarreras.find(
    (c: any) => c.id === wizard.datosBasicos.carrera.id,
  )
  const nivelNombre = String(carreraSeleccionada?.nivel ?? '').trim()
  const nivelDisplayPrefix =
    nivelNombre && nivelNombre.toLowerCase() !== 'otro'
      ? `${nivelNombre} en`
      : ''

  const hasFacultad = Boolean(wizard.datosBasicos.facultad.id)
  const hasCarreras = carrerasFiltradas.length > 0
  const isCarreraDisabled = !hasFacultad || !hasCarreras
  const carreraPlaceholder = !hasFacultad
    ? 'Selecciona primero una facultad'
    : !hasCarreras
      ? 'Esta facultad no tiene carreras'
      : 'Ej. Ingeniería en Cibernética y Sistemas Computacionales'

  return (
    <div className="flex flex-col gap-2">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-1">
          <Label htmlFor="facultad">Facultad</Label>
          <Select
            value={wizard.datosBasicos.facultad.id}
            onValueChange={(value) =>
              onChange(
                (w): NewPlanWizardState => ({
                  ...w,
                  datosBasicos: {
                    ...w.datosBasicos,
                    facultad: {
                      id: value,
                      nombre:
                        facultadesList.find((f) => f.id === value)?.nombre ||
                        '',
                    },
                    carrera: { id: '', nombre: '' },
                  },
                }),
              )
            }
            disabled={!scope.canChooseFacultad}
          >
            <SelectTrigger
              id="facultad"
              className={cn(
                'w-full min-w-0 [&>span]:block! [&>span]:truncate!',
                !wizard.datosBasicos.facultad.id
                  ? 'text-muted-foreground font-normal italic opacity-70'
                  : 'font-medium not-italic',
              )}
            >
              <SelectValue placeholder="Ej. Ingeniería" />
            </SelectTrigger>
            <SelectContent>
              {scope.visibleFacultades.map((f: FacultadRow) => (
                <SelectItem
                  key={f.id}
                  value={f.id}
                  textValue={formatFacultadNombre(f)}
                >
                  <span className="flex items-center gap-2">
                    <FacultadIconPill facultad={f} />
                    {formatFacultadNombre(f)}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-1">
          <Label htmlFor="carrera">Carrera</Label>
          <Select
            value={wizard.datosBasicos.carrera.id}
            onValueChange={(value) => {
              const selected = carrerasFiltradas.find(
                (c: any) => c.id === value,
              )
              const nivel = String(selected?.nivel ?? '').trim()

              const defaults = getDefaultsForNivel(nivel)
              const defaultNombre = getDefaultPlanName(selected)

              onChange(
                (w): NewPlanWizardState => ({
                  ...w,
                  datosBasicos: {
                    ...w.datosBasicos,
                    carrera: {
                      id: value,
                      nombre: selected?.nombre || '',
                    },
                    nombrePlan: defaultNombre,
                    tipoCiclo: defaults.tipoCiclo || '',
                    numCiclos: defaults.numCiclos ?? null,
                  },
                }),
              )
            }}
            disabled={isCarreraDisabled || !scope.canChooseCarrera}
          >
            <SelectTrigger
              id="carrera"
              className={cn(
                'w-full min-w-0 [&>span]:block! [&>span]:truncate!',
                !wizard.datosBasicos.carrera.id
                  ? 'text-muted-foreground font-normal italic opacity-70'
                  : 'font-medium not-italic',
              )}
            >
              <SelectValue placeholder={carreraPlaceholder} />
            </SelectTrigger>
            <SelectContent>
              {nivelesCarreras.map((nivel, index) => (
                <SelectGroup key={nivel}>
                  <SelectLabel>{nivel}</SelectLabel>
                  {(carrerasPorNivel[nivel] ?? []).map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nombre}
                    </SelectItem>
                  ))}
                  {index < nivelesCarreras.length - 1 ? (
                    <SelectSeparator />
                  ) : null}
                </SelectGroup>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-1 sm:col-span-2">
          <Label htmlFor="nombrePlan">
            Nombre del plan {/* <span className="text-destructive">*</span> */}
          </Label>
          {nivelDisplayPrefix ? (
            <div className="flex w-full min-w-0 items-stretch">
              <div className="border-input bg-muted text-muted-foreground inline-flex shrink-0 items-center rounded-l-md border px-3 text-sm font-medium select-none">
                {nivelDisplayPrefix}
              </div>
              <Input
                id="nombrePlan"
                placeholder="Ej. Ingeniería en Sistemas (2026)"
                value={wizard.datosBasicos.nombrePlan}
                maxLength={200}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  onChange(
                    (w): NewPlanWizardState => ({
                      ...w,
                      datosBasicos: {
                        ...w.datosBasicos,
                        nombrePlan: e.target.value,
                      },
                    }),
                  )
                }
                className="placeholder:text-muted-foreground/70 min-w-0 rounded-l-none font-medium not-italic placeholder:font-normal placeholder:italic"
              />
            </div>
          ) : (
            <Input
              id="nombrePlan"
              placeholder="Ej. Ingeniería en Sistemas (2026)"
              value={wizard.datosBasicos.nombrePlan}
              disabled={!wizard.datosBasicos.carrera.id}
              maxLength={200}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                onChange(
                  (w): NewPlanWizardState => ({
                    ...w,
                    datosBasicos: {
                      ...w.datosBasicos,
                      nombrePlan: e.target.value,
                    },
                  }),
                )
              }
              className="placeholder:text-muted-foreground/70 font-medium not-italic placeholder:font-normal placeholder:italic"
            />
          )}
        </div>

        <div className="grid gap-1">
          <Label htmlFor="tipoCiclo">Tipo de ciclo</Label>
          <Select
            value={wizard.datosBasicos.tipoCiclo}
            onValueChange={(value: TipoCiclo) =>
              onChange(
                (w): NewPlanWizardState => ({
                  ...w,
                  datosBasicos: {
                    ...w.datosBasicos,
                    tipoCiclo: value,
                  },
                }),
              )
            }
          >
            <SelectTrigger
              id="tipoCiclo"
              className={cn(
                'w-full min-w-0 [&>span]:block! [&>span]:truncate!',
                !wizard.datosBasicos.tipoCiclo
                  ? 'text-muted-foreground font-normal italic opacity-70' // Es Placeholder
                  : 'font-medium not-italic', // Tiene Valor (Medium)
              )}
            >
              <SelectValue placeholder="Ej. Semestre" />
            </SelectTrigger>
            <SelectContent>
              {TIPOS_CICLO.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-1">
          <Label htmlFor="numCiclos">Número de ciclos</Label>
          <NumberField
            value={wizard.datosBasicos.numCiclos}
            min={1}
            max={99}
            step={1}
            onValueChange={(value) =>
              onChange(
                (w): NewPlanWizardState => ({
                  ...w,
                  datosBasicos: {
                    ...w.datosBasicos,
                    numCiclos: value,
                  },
                }),
              )
            }
          >
            <NumberFieldGroup>
              <NumberFieldDecrement />
              <NumberFieldInput
                id="numCiclos"
                placeholder="Ej. 8"
                className="placeholder:text-muted-foreground/70 font-medium not-italic placeholder:font-normal placeholder:italic"
              />
              <NumberFieldIncrement />
            </NumberFieldGroup>
          </NumberField>
        </div>

        <div className="grid gap-1">
          <Label htmlFor="estructuraPlan">Estructura de plan de estudios</Label>
          <Select
            value={wizard.datosBasicos.estructuraPlanId ?? ''}
            onValueChange={(value: string) =>
              onChange(
                (w): NewPlanWizardState => ({
                  ...w,
                  datosBasicos: {
                    ...w.datosBasicos,
                    estructuraPlanId: value,
                  },
                }),
              )
            }
          >
            <SelectTrigger
              id="tipoCiclo"
              className={cn(
                'w-full min-w-0 [&>span]:block! [&>span]:truncate!',
                !wizard.datosBasicos.estructuraPlanId
                  ? 'text-muted-foreground font-normal italic opacity-70' // Es Placeholder
                  : 'font-medium not-italic', // Tiene Valor (Medium)
              )}
            >
              <SelectValue placeholder="Ej. Plan base SEP/ULSA (2026)" />
            </SelectTrigger>
            <SelectContent>
              {estructurasPlanList.map((t: EstructuraPlanRow) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      {/* <Separator className="my-3" />
      <div className="grid gap-4 sm:grid-cols-2">
        <TemplateSelectorCard
          cardTitle="Plantilla de plan de estudios"
          cardDescription="Selecciona el Word para tu nuevo plan."
          templatesData={PLANTILLAS_ANEXO_1}
          selectedTemplateId={wizard.datosBasicos.plantillaPlanId || ''}
          selectedVersion={wizard.datosBasicos.plantillaPlanVersion || ''}
          onChange={({ templateId, version }) =>
            onChange((w) => ({
              ...w,
              datosBasicos: {
                ...w.datosBasicos,
                plantillaPlanId: templateId,
                plantillaPlanVersion: version,
              },
            }))
          }
        />
        <TemplateSelectorCard
          cardTitle="Plantilla de mapa curricular"
          cardDescription="Selecciona el Excel para tu mapa curricular."
          templatesData={PLANTILLAS_ANEXO_2}
          selectedTemplateId={wizard.datosBasicos.plantillaMapaId || ''}
          selectedVersion={wizard.datosBasicos.plantillaMapaVersion || ''}
          onChange={({ templateId, version }) =>
            onChange((w) => ({
              ...w,
              datosBasicos: {
                ...w.datosBasicos,
                plantillaMapaId: templateId,
                plantillaMapaVersion: version,
              },
            }))
          }
        />
      </div> */}
    </div>
  )
}
