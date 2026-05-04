import type {
  EstructuraPlanRow,
  FacultadRow,
  TipoCiclo,
} from '@/data/types/domain'
import type { NewPlanWizardState } from '@/features/planes/nuevo/types'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
import { useCatalogosPlanes } from '@/data/hooks/usePlans'
import { NIVELES, TIPOS_CICLO } from '@/features/planes/nuevo/catalogs'
import { cn } from '@/lib/utils'

export function PasoBasicosForm({
  wizard,
  onChange,
}: {
  wizard: NewPlanWizardState
  onChange: React.Dispatch<React.SetStateAction<NewPlanWizardState>>
}) {
  const { data: catalogos } = useCatalogosPlanes()
  // const nivelNombre = wizard.datosBasicos.nivel.trim()
  // const nivelDisplayPrefix =
  //   nivelNombre && nivelNombre.toLowerCase() !== 'otro'
  //     ? `${nivelNombre} en`
  //     : ''

  // Preferir los catálogos remotos si están disponibles; si no, usar los locales
  const facultadesList = catalogos?.facultades ?? []
  const rawCarreras = catalogos?.carreras ?? []
  const estructurasPlanList = catalogos?.estructurasPlan ?? []

  const carrerasFiltradas = rawCarreras.filter((c: any) => {
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
          >
            <SelectTrigger
              id="facultad"
              className={cn(
                'w-full min-w-0 [&>span]:block! [&>span]:truncate!',
                !wizard.datosBasicos.facultad.id
                  ? 'text-muted-foreground font-normal italic opacity-70' // Es Placeholder
                  : 'font-medium not-italic', // Tiene Valor (Medium)
              )}
            >
              <SelectValue placeholder="Ej. Facultad de Ingeniería" />
            </SelectTrigger>
            <SelectContent>
              {facultadesList.map((f: FacultadRow) => (
                <SelectItem key={f.id} value={f.id}>
                  {f.nombre}
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

              // Defaults based on nivel
              const defaults: {
                tipoCiclo?: TipoCiclo
                numCiclos?: number | null
              } = {}
              if (nivel === 'Maestría' || nivel === 'Especialidad') {
                defaults.tipoCiclo = 'Cuatrimestre' as any
                defaults.numCiclos = 6
              } else if (nivel === 'Licenciatura') {
                defaults.tipoCiclo = 'Semestre' as any
                defaults.numCiclos = 9
              } else if (nivel === 'Doctorado') {
                defaults.tipoCiclo = 'Semestre' as any
                defaults.numCiclos = 8
              }

              const defaultNombre = selected
                ? `${selected.nombre} (${new Date().getFullYear()})`
                : ''

              onChange(
                (w): NewPlanWizardState => ({
                  ...w,
                  datosBasicos: {
                    ...w.datosBasicos,
                    carrera: {
                      id: value,
                      nombre: selected?.nombre || '',
                    },
                    // Always reset to defaults whenever carrera changes
                    nombrePlan: defaultNombre,
                    tipoCiclo: (defaults.tipoCiclo || '') as any,
                    numCiclos: defaults.numCiclos ?? null,
                  },
                }),
              )
            }}
            disabled={!wizard.datosBasicos.facultad.id}
          >
            <SelectTrigger
              id="carrera"
              className={cn(
                'w-full min-w-0 [&>span]:block! [&>span]:truncate!',
                !wizard.datosBasicos.carrera.id
                  ? 'text-muted-foreground font-normal italic opacity-70' // Es Placeholder
                  : 'font-medium not-italic', // Tiene Valor (Medium)
              )}
            >
              <SelectValue placeholder="Ej. Ingeniería en Cibernética y Sistemas Computacionales" />
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
                    tipoCiclo: value as any,
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
          <Input
            id="numCiclos"
            type="number"
            min={1}
            max={99}
            step={1}
            inputMode="numeric"
            pattern="[0-9]*"
            value={wizard.datosBasicos.numCiclos ?? ''}
            onKeyDown={(e) => {
              if (['.', ',', '-', 'e', 'E', '+'].includes(e.key)) {
                e.preventDefault()
              }
            }}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              onChange(
                (w): NewPlanWizardState => ({
                  ...w,
                  datosBasicos: {
                    ...w.datosBasicos,
                    // Keep undefined when the input is empty so the field stays optional
                    numCiclos: (() => {
                      const raw = e.target.value
                      if (raw === '') return null
                      const asNumber = Number(raw)
                      if (Number.isNaN(asNumber)) return null
                      // Coerce to positive integer (natural numbers without zero)
                      const n = Math.floor(Math.abs(asNumber))
                      const capped = Math.min(n >= 1 ? n : 1, 99)
                      return capped
                    })(),
                  },
                }),
              )
            }
            className="placeholder:text-muted-foreground/70 font-medium not-italic placeholder:font-normal placeholder:italic"
            placeholder="Ej. 8"
          />
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
