import * as Icons from 'lucide-react'
import { useEffect, useState } from 'react'

import PasoSugerenciasForm from './PasoSugerenciasForm'

import type { NewSubjectWizardState } from '@/features/asignaturas/nueva/types'
import type { Database } from '@/types/supabase'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useSubjectEstructuras } from '@/data'
import { TIPOS_MATERIA } from '@/features/asignaturas/nueva/catalogs'
import { cn } from '@/lib/utils'

export function PasoBasicosForm({
  wizard,
  onChange,
  estructuraFuenteId,
}: {
  wizard: NewSubjectWizardState
  onChange: React.Dispatch<React.SetStateAction<NewSubjectWizardState>>
  estructuraFuenteId?: string | null
}) {
  const { data: estructuras } = useSubjectEstructuras()

  const [creditosInput, setCreditosInput] = useState<string>(() => {
    const c = Number(wizard.datosBasicos.creditos ?? 0)
    let newC = c
    console.log('antes', newC)

    if (Number.isFinite(c) && c > 999) {
      newC = 999
    }
    console.log('desp', newC)
    return newC > 0 ? newC.toFixed(2) : ''
  })
  const [creditosFocused, setCreditosFocused] = useState(false)

  useEffect(() => {
    if (creditosFocused) return
    const c = Number(wizard.datosBasicos.creditos ?? 0)
    let newC = c
    if (Number.isFinite(c) && c > 999) {
      newC = 999
    }
    setCreditosInput(newC > 0 ? newC.toFixed(2) : '')
  }, [wizard.datosBasicos.creditos, creditosFocused])

  if (wizard.tipoOrigen === 'CLONADO_TRADICIONAL') {
    return (
      <div className="grid gap-4">
        <div className="grid gap-1">
          <Label htmlFor="estructura">Estructura de la asignatura</Label>
          <Select
            value={wizard.datosBasicos.estructuraId ?? ''}
            onValueChange={(val) =>
              onChange(
                (w): NewSubjectWizardState => ({
                  ...w,
                  datosBasicos: { ...w.datosBasicos, estructuraId: val },
                }),
              )
            }
          >
            <SelectTrigger
              id="estructura"
              className={cn(
                'w-full min-w-0 [&>span]:block! [&>span]:truncate!',
                !wizard.datosBasicos.estructuraId
                  ? 'text-muted-foreground font-normal italic opacity-70'
                  : 'font-medium not-italic',
              )}
            >
              <SelectValue placeholder="Selecciona plantilla..." />
            </SelectTrigger>
            <SelectContent>
              {estructuras?.map(
                (
                  e: Database['public']['Tables']['estructuras_asignatura']['Row'],
                ) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.nombre}
                  </SelectItem>
                ),
              )}
            </SelectContent>
          </Select>
        </div>
      </div>
    )
  }

  if (wizard.tipoOrigen !== 'IA_MULTIPLE') {
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-1 sm:col-span-2">
          <Label htmlFor="nombre">Nombre de la asignatura</Label>
          <Input
            id="nombre"
            placeholder="Ej. Matemáticas Discretas"
            maxLength={200}
            value={wizard.datosBasicos.nombre}
            onChange={(e) =>
              onChange(
                (w): NewSubjectWizardState => ({
                  ...w,
                  datosBasicos: { ...w.datosBasicos, nombre: e.target.value },
                }),
              )
            }
            className="placeholder:text-muted-foreground/70 font-medium not-italic placeholder:font-normal placeholder:italic"
          />
        </div>

        <div className="grid gap-1">
          <Label htmlFor="codigo">
            Código
            <span className="text-xs font-normal text-gray-500 dark:text-gray-400">
              (Opcional)
            </span>
          </Label>
          <Input
            id="codigo"
            placeholder="Ej. MAT-101"
            maxLength={200}
            value={wizard.datosBasicos.codigo || ''}
            onChange={(e) =>
              onChange(
                (w): NewSubjectWizardState => ({
                  ...w,
                  datosBasicos: { ...w.datosBasicos, codigo: e.target.value },
                }),
              )
            }
            className="placeholder:text-muted-foreground/70 placeholder:italicplaceholder:text-muted-foreground/70 font-medium not-italic placeholder:font-normal placeholder:italic"
          />
        </div>

        <div className="grid gap-1">
          <Label htmlFor="tipo">Tipo</Label>
          <Select
            value={(wizard.datosBasicos.tipo ?? '') as string}
            onValueChange={(value: string) =>
              onChange(
                (w): NewSubjectWizardState => ({
                  ...w,
                  datosBasicos: {
                    ...w.datosBasicos,
                    tipo: value as NewSubjectWizardState['datosBasicos']['tipo'],
                  },
                }),
              )
            }
          >
            <SelectTrigger
              id="tipo"
              className={cn(
                'w-full min-w-0 [&>span]:block! [&>span]:truncate!',
                !wizard.datosBasicos.tipo
                  ? 'text-muted-foreground font-normal italic opacity-70'
                  : 'font-medium not-italic',
              )}
            >
              <SelectValue placeholder="Ej. Obligatoria" />
            </SelectTrigger>
            <SelectContent>
              {TIPOS_MATERIA.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-1">
          <Label htmlFor="creditos">Créditos</Label>
          <Input
            id="creditos"
            type="text"
            inputMode="decimal"
            maxLength={6}
            pattern="^\\d*(?:[.,]\\d{0,2})?$"
            value={creditosInput}
            onKeyDown={(e) => {
              if (['-', 'e', 'E', '+'].includes(e.key)) {
                e.preventDefault()
              }
            }}
            onFocus={() => setCreditosFocused(true)}
            onBlur={() => {
              setCreditosFocused(false)

              const raw = creditosInput.trim()
              if (!raw) {
                onChange((w) => ({
                  ...w,
                  datosBasicos: { ...w.datosBasicos, creditos: 0 },
                }))
                return
              }

              const normalized = raw.replace(',', '.')
              let asNumber = Number.parseFloat(normalized)
              if (!Number.isFinite(asNumber) || asNumber <= 0) {
                setCreditosInput('')
                onChange((w) => ({
                  ...w,
                  datosBasicos: { ...w.datosBasicos, creditos: 0 },
                }))
                return
              }

              // Cap to 999
              if (asNumber > 999) asNumber = 999

              const fixed = asNumber.toFixed(2)
              setCreditosInput(fixed)
              onChange((w) => ({
                ...w,
                datosBasicos: { ...w.datosBasicos, creditos: Number(fixed) },
              }))
            }}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
              const nextRaw = e.target.value
              if (nextRaw === '') {
                setCreditosInput('')
                onChange((w) => ({
                  ...w,
                  datosBasicos: { ...w.datosBasicos, creditos: 0 },
                }))
                return
              }

              if (!/^\d*(?:[.,]\d{0,2})?$/.test(nextRaw)) return

              // If typed number exceeds 999, cap it immediately (prevents entering >999)
              const asNumberRaw = Number.parseFloat(nextRaw.replace(',', '.'))
              if (Number.isFinite(asNumberRaw) && asNumberRaw > 999) {
                // show capped value to the user
                const cappedStr = '999.00'
                setCreditosInput(cappedStr)
                onChange((w) => ({
                  ...w,
                  datosBasicos: {
                    ...w.datosBasicos,
                    creditos: 999,
                  },
                }))
                return
              }

              setCreditosInput(nextRaw)

              const asNumber = Number.parseFloat(nextRaw.replace(',', '.'))
              onChange((w) => ({
                ...w,
                datosBasicos: {
                  ...w.datosBasicos,
                  creditos:
                    Number.isFinite(asNumber) && asNumber > 0 ? asNumber : 0,
                },
              }))
            }}
            className="placeholder:text-muted-foreground/70 font-medium not-italic placeholder:font-normal placeholder:italic"
            placeholder="Ej. 4.50"
          />
        </div>

        <div className="grid gap-1">
          <Label htmlFor="estructura">Estructura de la asignatura</Label>
          <Select
            value={wizard.datosBasicos.estructuraId as string}
            onValueChange={(val) =>
              onChange(
                (w): NewSubjectWizardState => ({
                  ...w,
                  datosBasicos: { ...w.datosBasicos, estructuraId: val },
                }),
              )
            }
          >
            <SelectTrigger
              id="estructura"
              className="w-full min-w-0 [&>span]:block! [&>span]:truncate!"
            >
              <SelectValue placeholder="Selecciona plantilla..." />
            </SelectTrigger>
            <SelectContent>
              {estructuras?.map(
                (
                  e: Database['public']['Tables']['estructuras_asignatura']['Row'],
                ) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.nombre}
                  </SelectItem>
                ),
              )}
            </SelectContent>
          </Select>
          {estructuraFuenteId &&
          wizard.datosBasicos.estructuraId &&
          wizard.datosBasicos.estructuraId !== estructuraFuenteId ? (
            <div className="border-destructive/40 bg-destructive/5 text-destructive flex items-start gap-2 rounded-md border p-2 text-xs">
              <Icons.AlertTriangle className="mt-0.5 h-4 w-4 flex-none" />
              <span>
                Es posible que se pierdan datos generales al seleccionar otra
                estructura.
              </span>
            </div>
          ) : null}
          <p className="text-muted-foreground text-xs">
            Define los campos requeridos (ej. Objetivos, Temario, Evaluación).
          </p>
        </div>

        <div className="grid gap-1">
          <Label htmlFor="horasAcademicas">
            Horas Académicas
            <span className="text-xs font-normal text-gray-500 dark:text-gray-400">
              (Opcional)
            </span>
          </Label>
          <Input
            id="horasAcademicas"
            type="number"
            min={1}
            max={999}
            step={1}
            inputMode="numeric"
            pattern="[0-9]*"
            value={wizard.datosBasicos.horasAcademicas ?? ''}
            onKeyDown={(e) => {
              if (['.', ',', '-', 'e', 'E', '+'].includes(e.key)) {
                e.preventDefault()
              }
            }}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              onChange(
                (w): NewSubjectWizardState => ({
                  ...w,
                  datosBasicos: {
                    ...w.datosBasicos,
                    horasAcademicas: (() => {
                      const raw = e.target.value
                      if (raw === '') return null
                      const asNumber = Number(raw)
                      if (Number.isNaN(asNumber)) return null
                      // Coerce to positive integer (natural numbers without zero)
                      const n = Math.floor(Math.abs(asNumber))
                      const capped = Math.min(n >= 1 ? n : 1, 999)
                      return capped
                    })(),
                  },
                }),
              )
            }
            className="placeholder:text-muted-foreground/70 font-medium not-italic placeholder:font-normal placeholder:italic"
            placeholder="Ej. 48"
          />
        </div>

        <div className="grid gap-1">
          <Label htmlFor="horasIndependientes">
            Horas Independientes
            <span className="text-xs font-normal text-gray-500 dark:text-gray-400">
              (Opcional)
            </span>
          </Label>
          <Input
            id="horasIndependientes"
            type="number"
            min={1}
            max={999}
            step={1}
            inputMode="numeric"
            pattern="[0-9]*"
            value={wizard.datosBasicos.horasIndependientes ?? ''}
            onKeyDown={(e) => {
              if (['.', ',', '-', 'e', 'E', '+'].includes(e.key)) {
                e.preventDefault()
              }
            }}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              onChange(
                (w): NewSubjectWizardState => ({
                  ...w,
                  datosBasicos: {
                    ...w.datosBasicos,
                    horasIndependientes: (() => {
                      const raw = e.target.value
                      if (raw === '') return null
                      const asNumber = Number(raw)
                      if (Number.isNaN(asNumber)) return null
                      // Coerce to positive integer (natural numbers without zero)
                      const n = Math.floor(Math.abs(asNumber))
                      const capped = Math.min(n >= 1 ? n : 1, 999)
                      return capped
                    })(),
                  },
                }),
              )
            }
            className="placeholder:text-muted-foreground/70 font-medium not-italic placeholder:font-normal placeholder:italic"
            placeholder="Ej. 24"
          />
        </div>
      </div>
    )
  }

  return <PasoSugerenciasForm wizard={wizard} onChange={onChange} />
}
