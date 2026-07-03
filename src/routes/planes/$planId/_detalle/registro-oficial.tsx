import { createFileRoute } from '@tanstack/react-router'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  CalendarDays,
  ExternalLink,
  FileCheck2,
  FileText,
  Hash,
  Loader2,
  Save,
  ShieldCheck,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import type { PlanRegistroOficialInput } from '@/data/api/plans.api'

import { OfficialDocumentUpload } from '@/components/planes/OfficialDocumentUpload'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DatePicker } from '@/components/ui/date-picker'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { officialPlanDocument_get_signed_url } from '@/data/api/files.api'
import { usePermissions } from '@/data/hooks/usePermissions'
import {
  usePlan,
  usePlanRegistroOficial,
  useUpsertPlanRegistroOficial,
} from '@/data/hooks/usePlans'
import { getPlanDisplayName } from '@/lib/plan-display'
import { notify } from '@/lib/toast'

export const Route = createFileRoute(
  '/planes/$planId/_detalle/registro-oficial',
)({
  component: RouteComponent,
})

type RegistroForm = PlanRegistroOficialInput

function todayDateInput() {
  return format(new Date(), 'yyyy-MM-dd')
}

function formatDate(value: string | null | undefined) {
  if (!value) return 'Sin fecha'
  return format(parseISO(value), "d 'de' MMMM 'de' yyyy", { locale: es })
}

function emptyForm(): RegistroForm {
  return {
    claveSep: '',
    numeroAcuerdo: '',
    autoridad: 'SEP',
    fechaAprobacion: todayDateInput(),
    vigenciaInicio: '',
    vigenciaFin: '',
    documentoArchivoId: null,
    documentoBucket: 'documentos-oficiales',
    documentoPath: null,
    documentoNombre: null,
    documentoMime: null,
    documentoSize: null,
    documentoUrl: null,
    observaciones: '',
  }
}

function validateRegistro(form: RegistroForm) {
  if (!form.claveSep.trim()) return 'La clave SEP/RVOE es requerida.'
  if (!form.numeroAcuerdo.trim()) return 'El dictamen o acuerdo es requerido.'
  if (!form.autoridad?.trim()) return 'La autoridad es requerida.'
  if (!form.fechaAprobacion) return 'La fecha de aprobación es requerida.'
  if (!form.vigenciaInicio) return 'El inicio de vigencia es requerido.'
  if (!form.documentoArchivoId || !form.documentoPath?.trim()) {
    return 'Sube el documento oficial.'
  }
  if (form.vigenciaFin && form.vigenciaFin < form.vigenciaInicio) {
    return 'El fin de vigencia no puede ser anterior al inicio.'
  }
  return null
}

function RouteComponent() {
  const { planId } = Route.useParams()
  const { has } = usePermissions()
  const { data: plan, isLoading: planLoading } = usePlan(planId)
  const { data: registro, isLoading: registroLoading } =
    usePlanRegistroOficial(planId)
  const guardarRegistro = useUpsertPlanRegistroOficial()

  const canEdit = has('planes.aprobar')
  const [form, setForm] = useState<RegistroForm>(() => emptyForm())
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)

  useEffect(() => {
    if (registro) {
      setForm({
        claveSep: registro.clave_sep,
        numeroAcuerdo: registro.numero_acuerdo,
        autoridad: registro.autoridad,
        fechaAprobacion: registro.fecha_aprobacion,
        vigenciaInicio: registro.vigencia_inicio,
        vigenciaFin: registro.vigencia_fin ?? '',
        documentoArchivoId: registro.documento_archivo_id ?? null,
        documentoBucket: registro.documento_bucket,
        documentoPath: registro.documento_path ?? null,
        documentoNombre: registro.documento_nombre ?? null,
        documentoMime: registro.documento_mime ?? null,
        documentoSize: registro.documento_size ?? null,
        documentoUrl: registro.documento_url ?? '',
        observaciones: registro.observaciones ?? '',
      })
      return
    }

    if (plan && !registroLoading) {
      const datos = (plan.datos ?? {}) as Record<string, unknown>
      setForm((current) => ({
        ...current,
        claveSep:
          current.claveSep ||
          String(datos.clave_del_plan_de_estudios ?? '') ||
          plan.carreras?.clave_sep ||
          '',
      }))
    }
  }, [plan, registro, registroLoading])

  useEffect(() => {
    let cancelled = false
    const path = form.documentoPath?.trim()

    if (!path) {
      setPreviewUrl(form.documentoUrl?.trim() || null)
      return
    }

    setPreviewLoading(true)
    void officialPlanDocument_get_signed_url({
      bucket: form.documentoBucket || 'documentos-oficiales',
      path,
      preview: true,
      expiresIn: 3600,
    })
      .then(({ finalUrl }) => {
        if (!cancelled) setPreviewUrl(finalUrl)
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          console.warn('[registro-oficial] signed url error:', error)
          setPreviewUrl(null)
        }
      })
      .finally(() => {
        if (!cancelled) setPreviewLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [form.documentoBucket, form.documentoPath, form.documentoUrl])

  const validationMessage = useMemo(() => validateRegistro(form), [form])
  const isApproved = plan?.estados_plan?.clave === 'APROBADO'

  const updateForm = (patch: Partial<RegistroForm>) => {
    setForm((current) => ({ ...current, ...patch }))
  }

  const handleSave = () => {
    const error = validateRegistro(form)
    if (error) {
      notify.error(error)
      return
    }

    guardarRegistro.mutate(
      {
        planId,
        registro: {
          ...form,
          claveSep: form.claveSep.trim(),
          numeroAcuerdo: form.numeroAcuerdo.trim(),
          autoridad: form.autoridad?.trim() || 'SEP',
          vigenciaFin: form.vigenciaFin || null,
          documentoBucket: form.documentoBucket || 'documentos-oficiales',
          documentoPath: form.documentoPath?.trim() || null,
          documentoNombre: form.documentoNombre?.trim() || null,
          documentoMime: form.documentoMime?.trim() || null,
          documentoSize: form.documentoSize ?? null,
          documentoUrl: null,
          observaciones: form.observaciones?.trim() || null,
        },
      },
      {
        onSuccess: () => notify.success('Registro oficial guardado.'),
      },
    )
  }

  if (planLoading || registroLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-28 w-full rounded-xl" />
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div>
          <h1 className="text-2xl font-bold">Registro Oficial</h1>
          <p className="text-muted-foreground text-sm">
            {plan ? getPlanDisplayName(plan) : 'Plan de estudios'}
          </p>
        </div>
        <Badge variant={isApproved ? 'default' : 'secondary'}>
          {isApproved ? 'Aprobado por SEP' : 'Sin aprobación final'}
        </Badge>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <SummaryCard
          icon={<Hash className="h-4 w-4" />}
          label="Clave SEP/RVOE"
          value={registro?.clave_sep ?? 'Pendiente'}
        />
        <SummaryCard
          icon={<ShieldCheck className="h-4 w-4" />}
          label="Dictamen"
          value={registro?.numero_acuerdo ?? 'Pendiente'}
        />
        <SummaryCard
          icon={<CalendarDays className="h-4 w-4" />}
          label="Vigencia"
          value={
            registro
              ? `${formatDate(registro.vigencia_inicio)} - ${
                  registro.vigencia_fin
                    ? formatDate(registro.vigencia_fin)
                    : 'sin fin'
                }`
              : 'Pendiente'
          }
        />
      </div>

      {!registro && (
        <div className="border-border bg-muted/30 rounded-lg border px-4 py-3 text-sm">
          Este plan todavía no tiene ficha oficial registrada.
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <FileCheck2 className="h-4 w-4" />
              Ficha SEP
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="registro-clave">Clave SEP/RVOE</Label>
              <Input
                id="registro-clave"
                value={form.claveSep}
                disabled={!canEdit}
                onChange={(event) =>
                  updateForm({ claveSep: event.target.value })
                }
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="registro-dictamen">Dictamen o acuerdo</Label>
              <Input
                id="registro-dictamen"
                value={form.numeroAcuerdo}
                disabled={!canEdit}
                onChange={(event) =>
                  updateForm({ numeroAcuerdo: event.target.value })
                }
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="registro-autoridad">Autoridad</Label>
              <Input
                id="registro-autoridad"
                value={form.autoridad ?? ''}
                disabled={!canEdit}
                onChange={(event) =>
                  updateForm({ autoridad: event.target.value })
                }
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="registro-fecha">Aprobación</Label>
                <DatePicker
                  id="registro-fecha"
                  value={form.fechaAprobacion}
                  disabled={!canEdit}
                  onChange={(value) => updateForm({ fechaAprobacion: value })}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="registro-inicio">Inicio vigencia</Label>
                <DatePicker
                  id="registro-inicio"
                  value={form.vigenciaInicio}
                  disabled={!canEdit}
                  onChange={(value) => updateForm({ vigenciaInicio: value })}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="registro-fin">Fin vigencia</Label>
              <DatePicker
                id="registro-fin"
                value={form.vigenciaFin ?? ''}
                disabled={!canEdit}
                onChange={(value) => updateForm({ vigenciaFin: value || null })}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Documento oficial</Label>
              <OfficialDocumentUpload
                planId={planId}
                value={form}
                disabled={!canEdit}
                onChange={updateForm}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="registro-notas">Observaciones</Label>
              <Textarea
                id="registro-notas"
                value={form.observaciones ?? ''}
                disabled={!canEdit}
                onChange={(event) =>
                  updateForm({ observaciones: event.target.value })
                }
                className="min-h-24"
              />
            </div>

            {canEdit && (
              <div className="flex flex-col gap-2 border-t pt-4">
                {validationMessage && (
                  <p className="text-muted-foreground text-xs">
                    {validationMessage}
                  </p>
                )}
                <Button
                  onClick={handleSave}
                  disabled={guardarRegistro.isPending || !!validationMessage}
                >
                  {guardarRegistro.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="mr-2 h-4 w-4" />
                  )}
                  Guardar registro
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <FileText className="h-4 w-4" />
              Documento oficial
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {previewLoading ? (
              <div className="text-muted-foreground bg-muted/30 flex h-[420px] items-center justify-center gap-2 rounded-lg border text-sm">
                <Loader2 className="h-4 w-4 animate-spin" />
                Preparando vista previa.
              </div>
            ) : previewUrl ? (
              <>
                <div className="flex justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(previewUrl, '_blank')}
                  >
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Abrir
                  </Button>
                </div>
                <iframe
                  src={previewUrl}
                  title="Documento oficial SEP"
                  className="bg-muted h-[620px] w-full rounded-lg border"
                />
              </>
            ) : (
              <div className="text-muted-foreground bg-muted/30 flex h-[420px] items-center justify-center rounded-lg border text-sm">
                Sin documento registrado.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function SummaryCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: string
}) {
  return (
    <div className="border-border/60 bg-muted/30 flex min-h-24 items-start gap-3 rounded-lg border p-4">
      <div className="bg-background text-muted-foreground flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-muted-foreground text-[10px] font-bold tracking-wider uppercase">
          {label}
        </p>
        <p className="text-foreground mt-1 text-sm font-semibold break-words">
          {value}
        </p>
      </div>
    </div>
  )
}
