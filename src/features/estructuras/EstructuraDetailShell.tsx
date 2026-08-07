import { useNavigate, useParams } from '@tanstack/react-router'
import {
  Archive,
  CheckCircle2,
  FileSpreadsheet,
  FileText,
  Layers,
  Loader2,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'

import { CamposSection } from './CamposSection'
import { PlantillasExcelTab } from './PlantillasExcelTab'
import { PlantillasTab } from './PlantillasTab'
import { formatFecha, parseCampos } from './types'

import type { EstructuraAsignatura, EstructuraPlan } from './types'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  useEstructurasAsignatura,
  useEstructurasAsignaturaCrud,
  useEstructuraPlanRetiro,
  useEstructurasPlan,
  useEstructurasPlanCrud,
  usePaquetesCurricularesCrud,
} from '@/data'

function EmptyDetail() {
  return (
    <div className="gap-control p-pagina flex h-full flex-col items-center justify-center">
      <Layers className="text-muted-foreground size-9" />
      <span className="text-sm font-medium">Selecciona un paquete</span>
    </div>
  )
}

function statusLabel(status: EstructuraPlan['estado_publicacion']) {
  if (status === 'PUBLICADA') return 'Publicada'
  if (status === 'ARCHIVADA') return 'Archivada'
  if (status === 'RETIRADA') return 'Retirada'
  return 'Borrador'
}

function FieldRows({
  estructura,
}: {
  estructura: EstructuraPlan | EstructuraAsignatura
}) {
  const fields = parseCampos(estructura.definicion)
  if (!fields.length) {
    return <span className="text-muted-foreground text-sm">Sin campos</span>
  }
  return (
    <ul className="divide-border divide-y">
      {fields.map((field) => (
        <li
          key={field.key}
          className="gap-control py-relacionado flex min-h-11 items-center"
        >
          <span className="min-w-0 flex-1 truncate text-sm font-medium">
            {field.titulo || field.key}
          </span>
          {field.requerido ? (
            <span className="text-primary text-xs">Requerido</span>
          ) : null}
          {field.descripcion ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className="text-muted-foreground hover:text-foreground grid size-8 place-items-center rounded-md"
                  aria-label={`Descripción de ${field.titulo || field.key}`}
                >
                  <FileText className="size-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                {field.descripcion}
              </TooltipContent>
            </Tooltip>
          ) : null}
        </li>
      ))}
    </ul>
  )
}

function TemplateStatus({
  active,
  label,
  icon: Icon,
}: {
  active: boolean
  label: string
  icon: typeof FileText
}) {
  return (
    <div className="gap-control py-relacionado flex items-center text-sm">
      <Icon className="text-muted-foreground size-4" />
      <span className="flex-1">{label}</span>
      <span className={active ? 'text-foreground' : 'text-muted-foreground'}>
        {active ? 'Activa' : 'Pendiente'}
      </span>
    </div>
  )
}

export function EstructuraDetailShell() {
  const params = useParams({ strict: false })
  const selectedId = params.id
  const navigate = useNavigate()
  const { data: packages = [], isLoading } = useEstructurasPlan()
  const selected = useMemo(
    () => packages.find((item) => item.id === selectedId) ?? null,
    [packages, selectedId],
  )
  const { data: subjectStructures = [] } = useEstructurasAsignatura({
    estructuraPlanId: selected?.id,
  })
  const subjectStructure = subjectStructures.at(0) ?? null
  const planCrud = useEstructurasPlanCrud()
  const subjectCrud = useEstructurasAsignaturaCrud()
  const packagesCrud = usePaquetesCurricularesCrud()
  const { data: retirementAction } = useEstructuraPlanRetiro(selectedId)
  const [editing, setEditing] = useState<'plan' | 'asignatura' | null>(null)
  const [versionOpen, setVersionOpen] = useState(false)
  const [nextVersion, setNextVersion] = useState('')

  if (!selectedId) return <EmptyDetail />
  if (isLoading && !selected) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="text-muted-foreground size-6 animate-spin" />
      </div>
    )
  }
  if (!selected) return <EmptyDetail />

  const mutable = selected.estado_publicacion === 'BORRADOR'
  const metadata = [
    selected.autoridad_normativa,
    selected.etiqueta_version,
    selected.aplicable_desde
      ? `Desde ${formatFecha(selected.aplicable_desde)}`
      : null,
  ].filter(Boolean)

  const updatePlanTemplate = async (templateId: string | null) => {
    await planCrud.update.mutateAsync({
      id: selected.id,
      input: { template_id: templateId },
    })
    toast.success('Plantilla del plan actualizada')
  }
  const updateMapTemplate = async (templateId: string | null) => {
    await planCrud.update.mutateAsync({
      id: selected.id,
      input: { excel_template_id: templateId },
    })
    toast.success('Plantilla del mapa actualizada')
  }
  const updateSubjectTemplate = async (templateId: string | null) => {
    if (!subjectStructure) return
    await subjectCrud.update.mutateAsync({
      id: subjectStructure.id,
      input: { template_id: templateId },
    })
    toast.success('Plantilla de asignaturas actualizada')
  }

  const publish = async () => {
    try {
      await packagesCrud.publish.mutateAsync(selected.id)
      toast.success('Paquete publicado')
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'No se pudo publicar',
      )
    }
  }

  const createVersion = async () => {
    const created = await packagesCrud.createVersion.mutateAsync({
      estructuraId: selected.id,
      etiquetaVersion: nextVersion.trim(),
    })
    setVersionOpen(false)
    setNextVersion('')
    void navigate({
      to: '/administracion/estructuras/$modo/{-$id}',
      params: { modo: 'paquetes', id: created.id },
      search: {},
      resetScroll: false,
    })
  }

  const retire = async () => {
    const action = await planCrud.retire.mutateAsync(selected.id)
    toast.success(
      action === 'ELIMINADO' ? 'Paquete eliminado' : 'Paquete archivado',
    )
    void navigate({
      to: '/administracion/estructuras/$modo/{-$id}',
      params: { modo: 'paquetes', id: undefined },
      search: {},
      resetScroll: false,
    })
  }

  return (
    <div className="px-seccion py-seccion sm:px-region mx-auto max-w-4xl">
      <header className="border-border gap-grupo pb-seccion flex flex-col border-b sm:flex-row sm:items-start">
        <div className="min-w-0 flex-1">
          <div className="gap-relacionado flex items-center">
            <h1 className="truncate text-xl font-bold tracking-tight">
              {selected.nombre}
            </h1>
            <Badge variant="outline">
              {statusLabel(selected.estado_publicacion)}
            </Badge>
          </div>
          <div className="text-muted-foreground mt-relacionado gap-x-relacionado flex flex-wrap text-sm">
            {metadata.map((item, index) => (
              <span key={item}>
                {index ? '· ' : ''}
                {item}
              </span>
            ))}
          </div>
        </div>
        <div className="gap-relacionado flex shrink-0 items-center">
          {mutable ? (
            <Button
              onClick={() => void publish()}
              disabled={packagesCrud.publish.isPending}
            >
              {packagesCrud.publish.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <CheckCircle2 className="size-4" />
              )}
              Publicar
            </Button>
          ) : (
            <Button variant="outline" onClick={() => setVersionOpen(true)}>
              <Plus className="size-4" />
              Nueva versión
            </Button>
          )}
          {retirementAction && retirementAction !== 'BLOQUEADO' ? (
            <AlertDialog>
              <Tooltip>
                <TooltipTrigger asChild>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={
                        retirementAction === 'ELIMINAR'
                          ? 'Eliminar paquete'
                          : 'Archivar paquete'
                      }
                      disabled={planCrud.retire.isPending}
                    >
                      {planCrud.retire.isPending ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : retirementAction === 'ELIMINAR' ? (
                        <Trash2 className="size-4" />
                      ) : (
                        <Archive className="size-4" />
                      )}
                    </Button>
                  </AlertDialogTrigger>
                </TooltipTrigger>
                <TooltipContent>
                  {retirementAction === 'ELIMINAR'
                    ? 'Eliminar paquete'
                    : 'Archivar paquete'}
                </TooltipContent>
              </Tooltip>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    {retirementAction === 'ELIMINAR'
                      ? 'Eliminar paquete'
                      : 'Archivar paquete'}
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    {retirementAction === 'ELIMINAR'
                      ? `Se eliminará ${selected.nombre}.`
                      : `Se archivará ${selected.nombre}.`}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive text-destructive-foreground"
                    onClick={() => void retire()}
                  >
                    {retirementAction === 'ELIMINAR' ? 'Eliminar' : 'Archivar'}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          ) : null}
        </div>
      </header>

      <section
        className="border-border py-region border-b"
        aria-labelledby="package-plan"
      >
        <div className="mb-grupo gap-control flex items-center">
          <FileText className="text-primary size-5" />
          <h2 id="package-plan" className="text-lg font-semibold">
            Plan
          </h2>
          {mutable ? (
            <Button
              variant="ghost"
              size="sm"
              className="ml-auto"
              onClick={() => setEditing(editing === 'plan' ? null : 'plan')}
            >
              <Pencil className="size-4" />
              {editing === 'plan' ? 'Cerrar edición' : 'Editar campos'}
            </Button>
          ) : null}
        </div>
        {editing === 'plan' ? (
          <CamposSection estructura={selected} modo="planes" />
        ) : (
          <FieldRows estructura={selected} />
        )}
        <div className="border-border mt-seccion pt-seccion border-t">
          {mutable ? (
            <PlantillasTab
              estructuraId={selected.id}
              templateId={selected.template_id}
              onTemplateSelect={updatePlanTemplate}
            />
          ) : (
            <TemplateStatus
              active={Boolean(selected.template_id)}
              label="Documento del plan"
              icon={FileText}
            />
          )}
        </div>
      </section>

      <section
        className="border-border py-region border-b"
        aria-labelledby="package-map"
      >
        <div className="mb-grupo gap-control flex items-center">
          <FileSpreadsheet className="text-primary size-5" />
          <h2 id="package-map" className="text-lg font-semibold">
            Mapa curricular
          </h2>
        </div>
        {mutable ? (
          <PlantillasExcelTab
            estructuraId={selected.id}
            templateId={selected.excel_template_id}
            onTemplateSelect={updateMapTemplate}
          />
        ) : (
          <TemplateStatus
            active={Boolean(selected.excel_template_id)}
            label="Libro del mapa curricular"
            icon={FileSpreadsheet}
          />
        )}
      </section>

      <section className="py-region" aria-labelledby="package-subjects">
        <div className="mb-grupo gap-control flex items-center">
          <Layers className="text-primary size-5" />
          <h2 id="package-subjects" className="text-lg font-semibold">
            Asignaturas
          </h2>
          {mutable && subjectStructure ? (
            <Button
              variant="ghost"
              size="sm"
              className="ml-auto"
              onClick={() =>
                setEditing(editing === 'asignatura' ? null : 'asignatura')
              }
            >
              <Pencil className="size-4" />
              {editing === 'asignatura' ? 'Cerrar edición' : 'Editar campos'}
            </Button>
          ) : null}
        </div>
        {subjectStructure ? (
          <>
            {editing === 'asignatura' ? (
              <CamposSection estructura={subjectStructure} modo="materias" />
            ) : (
              <FieldRows estructura={subjectStructure} />
            )}
            <div className="border-border mt-seccion pt-seccion border-t">
              {mutable ? (
                <PlantillasTab
                  estructuraId={subjectStructure.id}
                  templateId={subjectStructure.template_id}
                  onTemplateSelect={updateSubjectTemplate}
                />
              ) : (
                <TemplateStatus
                  active={Boolean(subjectStructure.template_id)}
                  label="Programa de asignatura"
                  icon={FileText}
                />
              )}
            </div>
          </>
        ) : (
          <span className="text-muted-foreground text-sm">Pendiente</span>
        )}
      </section>

      <Dialog open={versionOpen} onOpenChange={setVersionOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nueva versión</DialogTitle>
          </DialogHeader>
          <div className="space-y-relacionado py-relacionado">
            <Label htmlFor="new-package-version">Versión normativa</Label>
            <Input
              id="new-package-version"
              value={nextVersion}
              onChange={(event) => setNextVersion(event.target.value)}
            />
          </div>
          <DialogFooter>
            <Button
              onClick={() => void createVersion()}
              disabled={
                !nextVersion.trim() || packagesCrud.createVersion.isPending
              }
            >
              {packagesCrud.createVersion.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Plus className="size-4" />
              )}
              Crear versión
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
