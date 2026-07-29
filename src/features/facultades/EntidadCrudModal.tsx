import { useStore } from '@tanstack/react-form'
import { useNavigate } from '@tanstack/react-router'
import { Archive, Building2, Layers3 } from 'lucide-react'
import { useMemo } from 'react'
import { z } from 'zod'

import type { TipoCiclo } from '@/data/types/domain'
import type { Tables } from '@/types/supabase'

import { useAppForm } from '@/components/form'
import { FacultadIconPill } from '@/components/shared/FacultadIconPill'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  canCreateCatalogCarrera,
  canManageCatalogCarrera,
  canManageCatalogFacultad,
  canManageCatalogos,
  getAllowedCareerCreateLevels,
} from '@/data/auth/catalogManagement'
import {
  useCarreras,
  useCarrerasCrud,
  useFacultades,
  useFacultadesCrud,
} from '@/data/hooks/useMeta'
import { usePermissions } from '@/data/hooks/usePermissions'
import { TIPOS_CICLO } from '@/features/planes/nuevo/catalogs'
import {
  pluralizarTipoCiclo,
  proponerEstructuraCiclos,
} from '@/lib/ciclo-utils'
import { cn } from '@/lib/utils'

export type FacultadEntityType = 'facultad' | 'carrera'
export type FacultadModalMode = 'nuevo' | 'editar' | 'archivar'

type Props = {
  entityType: FacultadEntityType
  mode: FacultadModalMode
  entityId?: string
  prefillFacultadId?: string | null
}

type Permissions = ReturnType<typeof usePermissions>

const NIVEL_OPTIONS: Array<Tables<'carreras'>['nivel']> = [
  'Licenciatura',
  'Maestría',
  'Especialidad',
  'Doctorado',
  'Otro',
]

const NIVEL_OPTIONS_POSGRADO: Array<Tables<'carreras'>['nivel']> = [
  'Maestría',
  'Especialidad',
  'Doctorado',
]

const nombreSchema = z.string().trim().min(1, 'El nombre es requerido.')

/** Valor del selector cuando la carrera no declara tipo y hereda la
 *  convención del nivel. Radix no admite `''` como valor de opción. */
const HEREDA_NIVEL = 'HEREDA_NIVEL'

const enteroOpcional = (max: number, mensaje: string) =>
  z
    .string()
    .trim()
    .refine(
      (valor) =>
        valor === '' ||
        (/^\d+$/.test(valor) && Number(valor) >= 1 && Number(valor) <= max),
      mensaje,
    )

/** `''` en el formulario significa «sin declarar»; en la base, nulo. */
const aEntero = (valor: string): number | null => {
  const limpio = valor.trim()
  return limpio === '' ? null : Number(limpio)
}

function PermisoDenegadoBanner() {
  return (
    <div className="border-destructive/30 bg-destructive/10 text-destructive rounded-2xl border px-4 py-3 text-sm">
      No tienes permisos para editar este registro con el rol actual.
    </div>
  )
}

export default function EntidadCrudModal({
  entityType,
  mode,
  entityId,
  prefillFacultadId,
}: Props) {
  const navigate = useNavigate()
  const permissions = usePermissions()
  const { data: facultades = [] } = useFacultades()
  const { data: carreras = [] } = useCarreras()

  const isArchiveMode = mode === 'archivar'
  const isFaculty = entityType === 'facultad'

  const currentFacultad = useMemo(
    () => facultades.find((item) => item.id === entityId) ?? null,
    [entityId, facultades],
  )
  const currentCarrera = useMemo(
    () => carreras.find((item) => item.id === entityId) ?? null,
    [carreras, entityId],
  )

  const close = () => {
    navigate({ to: '/administracion/facultades', resetScroll: false })
  }

  const title = (() => {
    if (isFaculty) {
      if (mode === 'nuevo') return 'Nueva facultad'
      if (mode === 'editar') return 'Editar facultad'
      return 'Archivar facultad'
    }

    if (mode === 'nuevo') return 'Nueva carrera'
    if (mode === 'editar') return 'Editar carrera'
    return 'Archivar carrera'
  })()

  const subtitle = (() => {
    if (isFaculty) {
      if (mode === 'archivar') {
        return 'La facultad quedará inactiva y también se desactivarán sus carreras.'
      }
      return 'Captura los datos básicos de la facultad.'
    }

    if (mode === 'archivar') {
      return 'La carrera quedará inactiva sin eliminarse de la base.'
    }
    return 'Captura los datos básicos de la carrera.'
  })()

  return (
    <Dialog open onOpenChange={(open) => !open && close()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader className="space-y-2 text-left">
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 text-primary flex h-11 w-11 items-center justify-center rounded-2xl">
              {isArchiveMode ? (
                <Archive className="h-5 w-5" />
              ) : isFaculty ? (
                <Building2 className="h-5 w-5" />
              ) : (
                <Layers3 className="h-5 w-5" />
              )}
            </div>
            <div>
              <DialogTitle className="text-xl font-bold tracking-tight">
                {title}
              </DialogTitle>
              <DialogDescription className="text-muted-foreground mt-1 text-sm">
                {subtitle}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {isArchiveMode ? (
          <ArchiveSection
            entityType={entityType}
            entityId={entityId}
            permissions={permissions}
            currentFacultad={currentFacultad}
            currentCarrera={currentCarrera}
            onDone={close}
          />
        ) : isFaculty ? (
          // Remontar por entidad: los defaultValues se derivan de la query y el
          // form nace ya sembrado (sin useEffect de resiembra).
          <FacultadForm
            key={currentFacultad?.id ?? 'nueva'}
            mode={mode}
            entityId={entityId}
            permissions={permissions}
            currentFacultad={currentFacultad}
            onDone={close}
          />
        ) : (
          <CarreraForm
            key={currentCarrera?.id ?? 'nueva'}
            mode={mode}
            entityId={entityId}
            prefillFacultadId={prefillFacultadId}
            permissions={permissions}
            facultades={facultades}
            currentCarrera={currentCarrera}
            onDone={close}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function ArchiveSection({
  entityType,
  entityId,
  permissions,
  currentFacultad,
  currentCarrera,
  onDone,
}: {
  entityType: FacultadEntityType
  entityId?: string
  permissions: Permissions
  currentFacultad: Tables<'facultades'> | null
  currentCarrera: Tables<'carreras'> | null
  onDone: () => void
}) {
  const { archiveFacultad } = useFacultadesCrud()
  const { archiveCarrera } = useCarrerasCrud()

  const isFaculty = entityType === 'facultad'
  const operationAllowed = canManageCatalogos(permissions)
  const archiveTargetName = isFaculty
    ? (currentFacultad?.nombre ?? 'la facultad')
    : (currentCarrera?.nombre ?? 'la carrera')

  // Mutación optimista: se cierra al instante; el toast global avisa y revierte
  // en caso de error.
  const handleArchive = () => {
    if (!entityId) return
    if (isFaculty) archiveFacultad.mutate(entityId)
    else archiveCarrera.mutate(entityId)
    onDone()
  }

  return (
    <div className="space-y-6">
      {!operationAllowed && <PermisoDenegadoBanner />}

      <div className="bg-muted/30 rounded-3xl border p-5">
        <p className="text-sm leading-6">
          Vas a archivar <strong>{archiveTargetName}</strong>.
        </p>
        <p className="text-muted-foreground mt-2 text-sm leading-6">
          Esta acción no elimina el registro. Solo lo marca como inactivo para
          que deje de aparecer como activo en el catálogo.
        </p>
      </div>

      <DialogFooter className="gap-2 sm:justify-end">
        <Button
          type="button"
          variant="destructive"
          disabled={!operationAllowed}
          className={cn('min-w-28', 'shadow-sm')}
          onClick={handleArchive}
        >
          Archivar
        </Button>
      </DialogFooter>
    </div>
  )
}

function FacultadForm({
  mode,
  entityId,
  permissions,
  currentFacultad,
  onDone,
}: {
  mode: Exclude<FacultadModalMode, 'archivar'>
  entityId?: string
  permissions: Permissions
  currentFacultad: Tables<'facultades'> | null
  onDone: () => void
}) {
  const { createFacultad, updateFacultad } = useFacultadesCrud()

  const canManageCatalogosGlobal = canManageCatalogos(permissions)
  const canEditFacultadName = mode === 'nuevo' || canManageCatalogosGlobal
  const operationAllowed =
    mode === 'nuevo'
      ? canManageCatalogosGlobal
      : canManageCatalogFacultad(permissions, currentFacultad)

  const form = useAppForm({
    defaultValues: {
      nombre: currentFacultad?.nombre ?? '',
      nombre_corto: currentFacultad?.nombre_corto ?? '',
      prefijo: currentFacultad?.prefijo ?? '',
      color: currentFacultad?.color ?? '#2563eb',
      icono: currentFacultad?.icono ?? 'Building2',
    },
    onSubmit: ({ value }) => {
      const input = {
        nombre: value.nombre,
        nombre_corto: value.nombre_corto || null,
        prefijo: value.prefijo || null,
        color: value.color || null,
        icono: value.icono || null,
      }
      // Mutaciones optimistas: cierre inmediato; el toast global avisa y la
      // caché se revierte si el servidor rechaza.
      if (mode === 'nuevo') {
        createFacultad.mutate(input)
      } else {
        updateFacultad.mutate({ facultadId: entityId as string, input })
      }
      onDone()
    },
  })

  return (
    <form
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault()
        void form.handleSubmit()
      }}
    >
      {!operationAllowed && <PermisoDenegadoBanner />}

      <div className="grid gap-4">
        <div className="grid gap-4 md:grid-cols-2">
          <form.AppField name="nombre" validators={{ onChange: nombreSchema }}>
            {(field) => (
              <field.TextField
                label="Nombre"
                placeholder="Facultad de Ingeniería"
                disabled={!canEditFacultadName}
              />
            )}
          </form.AppField>
          <form.AppField name="nombre_corto">
            {(field) => (
              <field.TextField
                label="Nombre corto"
                placeholder="Ingeniería"
                disabled={!canEditFacultadName}
              />
            )}
          </form.AppField>
        </div>

        <div className="grid gap-2">
          <form.AppField name="prefijo">
            {(field) => (
              <field.TextField
                label="Prefijo (opcional)"
                placeholder="Mexicana, Internacional…"
              />
            )}
          </form.AppField>
          <form.Subscribe
            selector={(state) =>
              [state.values.prefijo, state.values.nombre] as const
            }
          >
            {([prefijo, nombre]) => (
              <p className="text-muted-foreground text-xs">
                Con prefijo:{' '}
                <em>
                  Facultad {prefijo.trim() || 'Prefijo'} de{' '}
                  {nombre.trim() || 'Nombre'}
                </em>
              </p>
            )}
          </form.Subscribe>
        </div>

        <div className="grid gap-4 md:grid-cols-[1fr_1fr_auto]">
          <form.AppField name="color">
            {(field) => (
              <field.TextField
                label="Color"
                type="text"
                placeholder="#2563eb"
              />
            )}
          </form.AppField>
          <form.AppField name="icono">
            {(field) => (
              <field.TextField label="Icono" placeholder="Building2" />
            )}
          </form.AppField>
          <div className="flex items-end">
            <Badge variant="outline" className="rounded-full px-3 py-2">
              Icono de Lucide
            </Badge>
          </div>
        </div>
      </div>

      <DialogFooter className="gap-2 sm:justify-end">
        <form.AppForm>
          <form.SubmitButton disabled={!operationAllowed} className="min-w-28">
            {mode === 'nuevo' ? 'Crear' : 'Guardar cambios'}
          </form.SubmitButton>
        </form.AppForm>
      </DialogFooter>
    </form>
  )
}

function CarreraForm({
  mode,
  entityId,
  prefillFacultadId,
  permissions,
  facultades,
  currentCarrera,
  onDone,
}: {
  mode: Exclude<FacultadModalMode, 'archivar'>
  entityId?: string
  prefillFacultadId?: string | null
  permissions: Permissions
  facultades: Array<Tables<'facultades'>>
  currentCarrera: Tables<'carreras'> | null
  onDone: () => void
}) {
  const { createCarrera, updateCarrera } = useCarrerasCrud()

  const careerCreateFacultades = useMemo(
    () =>
      facultades.filter((facultad) =>
        canCreateCatalogCarrera(permissions, facultad.id),
      ),
    [facultades, permissions],
  )

  const currentFacultyId =
    prefillFacultadId ||
    currentCarrera?.facultad_id ||
    careerCreateFacultades[0]?.id ||
    facultades[0]?.id ||
    ''

  const careerFacultyOptions = useMemo(() => {
    if (mode === 'nuevo') return careerCreateFacultades
    if (!currentCarrera) return careerCreateFacultades

    const allowed = new Map(
      careerCreateFacultades.map((item) => [item.id, item]),
    )
    const current = facultades.find(
      (facultad) => facultad.id === currentCarrera.facultad_id,
    )
    if (current) allowed.set(current.id, current)
    return Array.from(allowed.values())
  }, [careerCreateFacultades, currentCarrera, facultades, mode])

  // Niveles permitidos según la facultad elegida (dependencia entre campos).
  const levelOptionsFor = (facultadId: string) => {
    const levels = getAllowedCareerCreateLevels(
      permissions,
      facultadId || currentFacultyId,
    )
    const allowed =
      levels.length > 0
        ? levels
        : mode === 'editar' && currentCarrera?.nivel
          ? [currentCarrera.nivel]
          : levels
    return NIVEL_OPTIONS.filter((nivel) => allowed.includes(nivel))
  }

  const initialFacultadId = currentCarrera?.facultad_id || currentFacultyId
  const initialLevelOptions = levelOptionsFor(initialFacultadId)
  const isJefePosgrado =
    initialLevelOptions.length > 0 &&
    initialLevelOptions.every((nivel) => NIVEL_OPTIONS_POSGRADO.includes(nivel))
  const initialNivel =
    currentCarrera?.nivel ?? (isJefePosgrado ? 'Maestría' : 'Otro')

  const form = useAppForm({
    defaultValues: {
      facultad_id: initialFacultadId,
      nombre: currentCarrera?.nombre ?? '',
      nombre_corto: currentCarrera?.nombre_corto ?? '',
      clave_sep: currentCarrera?.clave_sep ?? '',
      nivel: initialLevelOptions.includes(initialNivel)
        ? initialNivel
        : (initialLevelOptions[0] ?? initialNivel),
      tipo_ciclo_default: currentCarrera?.tipo_ciclo_default ?? HEREDA_NIVEL,
      ciclos_default: currentCarrera?.ciclos_default?.toString() ?? '',
      semanas_por_ciclo_default:
        currentCarrera?.semanas_por_ciclo_default?.toString() ?? '',
    },
    onSubmit: ({ value }) => {
      const tipoCiclo =
        value.tipo_ciclo_default === HEREDA_NIVEL
          ? null
          : (value.tipo_ciclo_default as TipoCiclo)
      const input = {
        facultad_id: value.facultad_id,
        nombre: value.nombre,
        nombre_corto: value.nombre_corto || null,
        clave_sep: value.clave_sep || null,
        nivel: value.nivel,
        tipo_ciclo_default: tipoCiclo,
        ciclos_default: aEntero(value.ciclos_default),
        semanas_por_ciclo_default: aEntero(value.semanas_por_ciclo_default),
      }
      // Mutaciones optimistas: cierre inmediato; el toast global avisa y la
      // caché se revierte si el servidor rechaza.
      if (mode === 'nuevo') {
        createCarrera.mutate(input)
      } else {
        updateCarrera.mutate({ carreraId: entityId as string, input })
      }
      onDone()
    },
  })

  // Valores reactivos del form (facultad elegida) para permisos y opciones.
  const facultadIdValue = useStore(
    form.store,
    (state) => state.values.facultad_id,
  )
  const careerLevelOptions = levelOptionsFor(facultadIdValue)
  const canChangeCareerScope = canCreateCatalogCarrera(
    permissions,
    facultadIdValue || currentFacultyId,
  )
  const operationAllowed =
    mode === 'nuevo'
      ? canCreateCatalogCarrera(
          permissions,
          facultadIdValue || currentFacultyId,
        )
      : canManageCatalogCarrera(permissions, currentCarrera)

  return (
    <form
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault()
        void form.handleSubmit()
      }}
    >
      {!operationAllowed && <PermisoDenegadoBanner />}

      <div className="grid gap-4">
        <div className="grid gap-4 md:grid-cols-2">
          <form.AppField
            name="facultad_id"
            validators={{
              onChange: ({ value }) =>
                value ? undefined : 'Selecciona una facultad.',
            }}
            listeners={{
              // Si la facultad restringe los niveles permitidos, ajusta el
              // nivel a una opción válida.
              onChange: ({ value }) => {
                const levels = levelOptionsFor(value)
                if (
                  levels.length > 0 &&
                  !levels.includes(form.getFieldValue('nivel'))
                ) {
                  form.setFieldValue('nivel', levels[0])
                }
              },
            }}
          >
            {(field) => {
              const invalid =
                field.state.meta.isTouched && !field.state.meta.isValid
              return (
                <div className="grid gap-2">
                  <Label htmlFor={field.name}>Facultad</Label>
                  <Select
                    value={field.state.value}
                    onValueChange={(value) => {
                      field.handleChange(value)
                      field.handleBlur()
                    }}
                    disabled={
                      !canChangeCareerScope || careerFacultyOptions.length <= 1
                    }
                  >
                    <SelectTrigger
                      id={field.name}
                      aria-invalid={invalid}
                      aria-describedby={
                        invalid ? `${field.name}-error` : undefined
                      }
                    >
                      <SelectValue placeholder="Selecciona una facultad" />
                    </SelectTrigger>
                    <SelectContent>
                      {careerFacultyOptions.map((facultad) => (
                        <SelectItem
                          key={facultad.id}
                          value={facultad.id}
                          textValue={facultad.nombre}
                        >
                          <span className="flex items-center gap-2">
                            <FacultadIconPill facultad={facultad} />
                            {facultad.nombre}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {invalid && (
                    <p
                      id={`${field.name}-error`}
                      className="text-destructive text-sm"
                    >
                      Selecciona una facultad.
                    </p>
                  )}
                </div>
              )
            }}
          </form.AppField>

          <form.AppField name="nivel">
            {(field) => (
              <field.SelectField
                label="Nivel"
                placeholder="Selecciona un nivel"
                options={careerLevelOptions.map((nivel) => ({
                  value: nivel,
                  label: nivel,
                }))}
                disabled={
                  !canChangeCareerScope || careerLevelOptions.length <= 1
                }
              />
            )}
          </form.AppField>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <form.AppField
              name="nombre"
              validators={{ onChange: nombreSchema }}
            >
              {(field) => (
                <field.TextField
                  label="Nombre"
                  placeholder="Ingeniería en Sistemas Computacionales"
                />
              )}
            </form.AppField>
          </div>

          <form.AppField name="nombre_corto">
            {(field) => (
              <field.TextField label="Nombre corto" placeholder="Sistemas" />
            )}
          </form.AppField>

          <form.AppField name="clave_sep">
            {(field) => (
              <field.TextField label="Clave SEP" placeholder="ISC-01" />
            )}
          </form.AppField>
        </div>

        {/* La estructura de ciclos se declara aquí, no en cada plan: es una
            propiedad de la carrera que se repite en todas sus generaciones.
            Sin declararla, el asistente cae a la convención del nivel, que es
            una aproximación —hay licenciaturas de ocho semestres y de diez—. */}
        <section className="border-border/70 grid gap-4 border-t pt-4">
          <h3 className="text-sm font-semibold">Estructura de ciclos</h3>

          <div className="grid gap-4 md:grid-cols-3">
            <form.AppField name="tipo_ciclo_default">
              {(field) => (
                <field.SelectField
                  label="Tipo de ciclo"
                  options={[
                    { value: HEREDA_NIVEL, label: 'Según el nivel' },
                    ...TIPOS_CICLO.map((tipo) => ({
                      value: tipo,
                      label: tipo,
                    })),
                  ]}
                />
              )}
            </form.AppField>

            <form.AppField
              name="ciclos_default"
              validators={{
                onChange: enteroOpcional(99, 'Escribe un número entre 1 y 99.'),
              }}
            >
              {(field) => (
                <field.TextField
                  label="Cuántos"
                  type="number"
                  min={1}
                  max={99}
                  inputMode="numeric"
                  placeholder="Según el nivel"
                />
              )}
            </form.AppField>

            {/* Sólo con ciclos «Otro»: un semestre o un cuatrimestre ya
                declaran su duración en el nombre. */}
            <form.Subscribe
              selector={(state) => state.values.tipo_ciclo_default}
            >
              {(tipo) =>
                tipo === 'Otro' ? (
                  <form.AppField
                    name="semanas_por_ciclo_default"
                    validators={{
                      onChange: enteroOpcional(
                        104,
                        'Escribe un número de semanas entre 1 y 104.',
                      ),
                    }}
                  >
                    {(field) => (
                      <field.TextField
                        label="Semanas por ciclo"
                        type="number"
                        min={1}
                        max={104}
                        inputMode="numeric"
                        placeholder="16"
                      />
                    )}
                  </form.AppField>
                ) : null
              }
            </form.Subscribe>
          </div>

          <form.Subscribe
            selector={(state) =>
              [
                state.values.nivel,
                state.values.tipo_ciclo_default,
                state.values.ciclos_default,
                state.values.semanas_por_ciclo_default,
              ] as const
            }
          >
            {([nivel, tipo, ciclos, semanas]) => {
              const propuesta = proponerEstructuraCiclos({
                nivel,
                tipo_ciclo_default:
                  tipo === HEREDA_NIVEL ? null : (tipo as TipoCiclo),
                ciclos_default: aEntero(ciclos),
                semanas_por_ciclo_default: aEntero(semanas),
              })
              return (
                <p className="text-muted-foreground text-xs">
                  {propuesta.tipoCiclo && propuesta.numCiclos ? (
                    <>
                      Un plan nuevo de esta carrera empezará con{' '}
                      <strong className="text-foreground">
                        {propuesta.numCiclos}{' '}
                        {pluralizarTipoCiclo(
                          propuesta.tipoCiclo,
                          propuesta.numCiclos,
                        )}
                      </strong>
                      {propuesta.semanasPorCiclo
                        ? ` de ${propuesta.semanasPorCiclo} semanas`
                        : ''}
                      {propuesta.origen === 'nivel'
                        ? ', tomado de la convención del nivel.'
                        : '.'}{' '}
                      Quien lo cree podrá cambiarlo.
                    </>
                  ) : (
                    'Sin declarar, el asistente pedirá tipo y número al crear cada plan.'
                  )}
                </p>
              )
            }}
          </form.Subscribe>
        </section>
      </div>

      <DialogFooter className="gap-2 sm:justify-end">
        <form.AppForm>
          <form.SubmitButton disabled={!operationAllowed} className="min-w-28">
            {mode === 'nuevo' ? 'Crear' : 'Guardar cambios'}
          </form.SubmitButton>
        </form.AppForm>
      </DialogFooter>
    </form>
  )
}
