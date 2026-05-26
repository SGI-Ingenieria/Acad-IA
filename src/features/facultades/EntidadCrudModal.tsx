import { useNavigate } from '@tanstack/react-router'
import { Archive, Building2, Layers3 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import type { Tables } from '@/types/supabase'
import type { FormEvent } from 'react'

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
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  useCarreras,
  useCarrerasCrud,
  useFacultades,
  useFacultadesCrud,
} from '@/data/hooks/useMeta'
import { cn } from '@/lib/utils'

export type FacultadEntityType = 'facultad' | 'carrera'
export type FacultadModalMode = 'nuevo' | 'editar' | 'archivar'

type Props = {
  entityType: FacultadEntityType
  mode: FacultadModalMode
  entityId?: string
  prefillFacultadId?: string | null
}

type FacultadFormState = {
  nombre: string
  nombre_corto: string
  color: string
  icono: string
}

type CarreraFormState = {
  facultad_id: string
  nombre: string
  nombre_corto: string
  clave_sep: string
  nivel: Tables<'carreras'>['nivel']
}

const NIVEL_OPTIONS: Array<Tables<'carreras'>['nivel']> = [
  'Licenciatura',
  'Maestría',
  'Especialidad',
  'Doctorado',
  'Otro',
]

const FACULTAD_DEFAULT: FacultadFormState = {
  nombre: '',
  nombre_corto: '',
  color: '#2563eb',
  icono: 'Building2',
}

const CARRERA_DEFAULT: CarreraFormState = {
  facultad_id: '',
  nombre: '',
  nombre_corto: '',
  clave_sep: '',
  nivel: 'Otro',
}

const FACULTAD_NAME_ID = 'facultad-nombre'
const FACULTAD_SHORT_ID = 'facultad-nombre-corto'
const FACULTAD_COLOR_ID = 'facultad-color'
const FACULTAD_ICON_ID = 'facultad-icono'
const CARRERA_FACULTAD_ID = 'carrera-facultad'
const CARRERA_NIVEL_ID = 'carrera-nivel'
const CARRERA_NAME_ID = 'carrera-nombre'
const CARRERA_SHORT_ID = 'carrera-nombre-corto'
const CARRERA_KEY_ID = 'carrera-clave-sep'

export default function EntidadCrudModal({
  entityType,
  mode,
  entityId,
  prefillFacultadId,
}: Props) {
  const navigate = useNavigate()
  const { data: facultades = [] } = useFacultades()
  const { data: carreras = [] } = useCarreras()
  const { createFacultad, updateFacultad, archiveFacultad } =
    useFacultadesCrud()
  const { createCarrera, updateCarrera, archiveCarrera } = useCarrerasCrud()

  const [facultadForm, setFacultadForm] =
    useState<FacultadFormState>(FACULTAD_DEFAULT)
  const [carreraForm, setCarreraForm] =
    useState<CarreraFormState>(CARRERA_DEFAULT)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

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

  const currentFacultyId =
    prefillFacultadId || currentCarrera?.facultad_id || facultades[0]?.id || ''

  useEffect(() => {
    if (isFaculty) {
      setFacultadForm({
        nombre: currentFacultad?.nombre ?? '',
        nombre_corto: currentFacultad?.nombre_corto ?? '',
        color: currentFacultad?.color ?? '#2563eb',
        icono: currentFacultad?.icono ?? 'Building2',
      })
      return
    }

    setCarreraForm({
      facultad_id: currentCarrera?.facultad_id || currentFacultyId,
      nombre: currentCarrera?.nombre ?? '',
      nombre_corto: currentCarrera?.nombre_corto ?? '',
      clave_sep: currentCarrera?.clave_sep ?? '',
      nivel: currentCarrera?.nivel ?? 'Otro',
    })
  }, [
    currentCarrera,
    currentFacultyId,
    currentFacultad,
    entityType,
    isFaculty,
    mode,
  ])

  const close = () => {
    navigate({ to: '/facultades', resetScroll: false })
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

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setErrorMessage(null)

    try {
      if (isFaculty) {
        if (mode === 'archivar') {
          await archiveFacultad.mutateAsync(entityId as string)
        } else if (mode === 'nuevo') {
          await createFacultad.mutateAsync({
            nombre: facultadForm.nombre,
            nombre_corto: facultadForm.nombre_corto || null,
            color: facultadForm.color || null,
            icono: facultadForm.icono || null,
          })
        } else {
          await updateFacultad.mutateAsync({
            facultadId: entityId as string,
            input: {
              nombre: facultadForm.nombre,
              nombre_corto: facultadForm.nombre_corto || null,
              color: facultadForm.color || null,
              icono: facultadForm.icono || null,
            },
          })
        }
      } else if (mode === 'archivar') {
        await archiveCarrera.mutateAsync(entityId as string)
      } else if (mode === 'nuevo') {
        await createCarrera.mutateAsync({
          facultad_id: carreraForm.facultad_id,
          nombre: carreraForm.nombre,
          nombre_corto: carreraForm.nombre_corto || null,
          clave_sep: carreraForm.clave_sep || null,
          nivel: carreraForm.nivel,
        })
      } else {
        await updateCarrera.mutateAsync({
          carreraId: entityId as string,
          input: {
            facultad_id: carreraForm.facultad_id,
            nombre: carreraForm.nombre,
            nombre_corto: carreraForm.nombre_corto || null,
            clave_sep: carreraForm.clave_sep || null,
            nivel: carreraForm.nivel,
          },
        })
      }

      close()
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'No fue posible completar la operación.',
      )
    }
  }

  const isLoading =
    createFacultad.isPending ||
    updateFacultad.isPending ||
    archiveFacultad.isPending ||
    createCarrera.isPending ||
    updateCarrera.isPending ||
    archiveCarrera.isPending

  const archiveTargetName = isFaculty
    ? (currentFacultad?.nombre ?? 'la facultad')
    : (currentCarrera?.nombre ?? 'la carrera')

  return (
    <Dialog open onOpenChange={(open) => !open && close()}>
      <DialogContent className="bg-background text-foreground sm:max-w-2xl">
        <form onSubmit={onSubmit} className="space-y-6">
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

          {errorMessage && (
            <div className="border-destructive/30 bg-destructive/10 text-destructive rounded-2xl border px-4 py-3 text-sm">
              {errorMessage}
            </div>
          )}

          {isArchiveMode ? (
            <div className="bg-muted/30 rounded-3xl border p-5">
              <p className="text-sm leading-6">
                Vas a archivar <strong>{archiveTargetName}</strong>.
              </p>
              <p className="text-muted-foreground mt-2 text-sm leading-6">
                Esta acción no elimina el registro. Solo lo marca como inactivo
                para que deje de aparecer como activo en el catálogo.
              </p>
            </div>
          ) : isFaculty ? (
            <div className="grid gap-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-2 text-sm font-medium">
                  <span>Nombre</span>
                  <Input
                    id={FACULTAD_NAME_ID}
                    value={facultadForm.nombre}
                    onChange={(event) =>
                      setFacultadForm((prev) => ({
                        ...prev,
                        nombre: event.target.value,
                      }))
                    }
                    placeholder="Facultad de Ingeniería"
                    required
                  />
                </div>
                <div className="grid gap-2 text-sm font-medium">
                  <span>Nombre corto</span>
                  <Input
                    id={FACULTAD_SHORT_ID}
                    value={facultadForm.nombre_corto}
                    onChange={(event) =>
                      setFacultadForm((prev) => ({
                        ...prev,
                        nombre_corto: event.target.value,
                      }))
                    }
                    placeholder="Ingeniería"
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-[1fr_1fr_auto]">
                <div className="grid gap-2 text-sm font-medium">
                  <span>Color</span>
                  <Input
                    id={FACULTAD_COLOR_ID}
                    type="text"
                    value={facultadForm.color}
                    onChange={(event) =>
                      setFacultadForm((prev) => ({
                        ...prev,
                        color: event.target.value,
                      }))
                    }
                    placeholder="#2563eb"
                  />
                </div>
                <div className="grid gap-2 text-sm font-medium">
                  <span>Icono</span>
                  <Input
                    id={FACULTAD_ICON_ID}
                    value={facultadForm.icono}
                    onChange={(event) =>
                      setFacultadForm((prev) => ({
                        ...prev,
                        icono: event.target.value,
                      }))
                    }
                    placeholder="Building2"
                  />
                </div>
                <div className="flex items-end">
                  <Badge variant="outline" className="rounded-full px-3 py-2">
                    Icono de Lucide
                  </Badge>
                </div>
              </div>
            </div>
          ) : (
            <div className="grid gap-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-2 text-sm font-medium">
                  <span>Facultad</span>
                  <Select
                    value={carreraForm.facultad_id}
                    onValueChange={(value: string) =>
                      setCarreraForm((prev) => ({
                        ...prev,
                        facultad_id: value,
                      }))
                    }
                  >
                    <SelectTrigger id={CARRERA_FACULTAD_ID}>
                      <SelectValue placeholder="Selecciona una facultad" />
                    </SelectTrigger>
                    <SelectContent>
                      {facultades.map((facultad) => (
                        <SelectItem key={facultad.id} value={facultad.id}>
                          {facultad.nombre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-2 text-sm font-medium">
                  <span>Nivel</span>
                  <Select
                    value={carreraForm.nivel}
                    onValueChange={(value: Tables<'carreras'>['nivel']) =>
                      setCarreraForm((prev) => ({
                        ...prev,
                        nivel: value,
                      }))
                    }
                  >
                    <SelectTrigger id={CARRERA_NIVEL_ID}>
                      <SelectValue placeholder="Selecciona un nivel" />
                    </SelectTrigger>
                    <SelectContent>
                      {NIVEL_OPTIONS.map((nivel) => (
                        <SelectItem key={nivel} value={nivel}>
                          {nivel}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-2 text-sm font-medium md:col-span-2">
                  <span>Nombre</span>
                  <Input
                    id={CARRERA_NAME_ID}
                    value={carreraForm.nombre}
                    onChange={(event) =>
                      setCarreraForm((prev) => ({
                        ...prev,
                        nombre: event.target.value,
                      }))
                    }
                    placeholder="Ingeniería en Sistemas Computacionales"
                    required
                  />
                </div>

                <div className="grid gap-2 text-sm font-medium">
                  <span>Nombre corto</span>
                  <Input
                    id={CARRERA_SHORT_ID}
                    value={carreraForm.nombre_corto}
                    onChange={(event) =>
                      setCarreraForm((prev) => ({
                        ...prev,
                        nombre_corto: event.target.value,
                      }))
                    }
                    placeholder="Sistemas"
                  />
                </div>

                <div className="grid gap-2 text-sm font-medium">
                  <span>Clave SEP</span>
                  <Input
                    id={CARRERA_KEY_ID}
                    value={carreraForm.clave_sep}
                    onChange={(event) =>
                      setCarreraForm((prev) => ({
                        ...prev,
                        clave_sep: event.target.value,
                      }))
                    }
                    placeholder="ISC-01"
                  />
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:justify-between">
            <Button type="button" variant="ghost" onClick={close}>
              Cancelar
            </Button>
            <Button
              type="submit"
              variant={isArchiveMode ? 'destructive' : 'default'}
              disabled={isLoading}
              className={cn('min-w-28', isArchiveMode && 'shadow-sm')}
            >
              {isLoading
                ? 'Guardando...'
                : isArchiveMode
                  ? 'Archivar'
                  : mode === 'nuevo'
                    ? 'Crear'
                    : 'Guardar cambios'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
