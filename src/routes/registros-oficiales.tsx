import { createFileRoute, Link } from '@tanstack/react-router'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  CalendarDays,
  ExternalLink,
  FileCheck2,
  FileText,
  Hash,
  Loader2,
  Search,
  ShieldCheck,
} from 'lucide-react'
import { useMemo, useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { officialPlanDocument_get_signed_url } from '@/data/api/files.api'
import { requireAnyPermission } from '@/data/auth/routeGuards'
import { useRegistrosOficiales } from '@/data/hooks/usePlans'
import { notify } from '@/lib/toast'

export const Route = createFileRoute('/registros-oficiales')({
  beforeLoad: ({ context }) =>
    requireAnyPermission(context.queryClient, ['planes.ver']),
  component: RouteComponent,
})

function formatDate(value: string | null | undefined) {
  if (!value) return 'Sin fecha'
  return format(parseISO(value), 'dd MMM yyyy', { locale: es })
}

function normalizeText(value: unknown) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

function RouteComponent() {
  const { data, isLoading } = useRegistrosOficiales()
  const [search, setSearch] = useState('')
  const [openingId, setOpeningId] = useState<string | null>(null)

  const filtered = useMemo(() => {
    const q = normalizeText(search.trim())
    if (!q) return data ?? []

    return (data ?? []).filter((item) => {
      const haystack = normalizeText(
        [
          item.plan_nombre,
          item.plan_nombre_propuesto,
          item.plan_nombre_legacy,
          item.clave_sep,
          item.numero_acuerdo,
          item.carrera_nombre,
          item.carrera_nombre_corto,
          item.facultad_nombre,
          item.facultad_nombre_corto,
        ].join(' '),
      )
      return haystack.includes(q)
    })
  }, [data, search])

  const openDocumento = async (
    item: NonNullable<(typeof filtered)[number]>,
  ) => {
    setOpeningId(item.id)
    try {
      if (item.documento_path) {
        const { finalUrl } = await officialPlanDocument_get_signed_url({
          bucket: item.documento_bucket || 'documentos-oficiales',
          path: item.documento_path,
          preview: true,
          expiresIn: 3600,
        })
        window.open(finalUrl, '_blank', 'noopener,noreferrer')
        return
      }

      if (item.documento_url) {
        window.open(item.documento_url, '_blank', 'noopener,noreferrer')
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'No se pudo abrir el documento oficial.'
      notify.error(message)
    } finally {
      setOpeningId(null)
    }
  }

  return (
    <div className="bg-background min-h-screen">
      <div className="mx-auto w-full max-w-7xl space-y-6 px-4 py-8 md:px-6 lg:px-8">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Registros SEP</h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Planes con ficha oficial, vigencia y documento de aprobación.
            </p>
          </div>

          <div className="relative w-full lg:max-w-sm">
            <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="pl-9"
              placeholder="Buscar registro"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="flex h-48 items-center justify-center">
            <Loader2 className="text-primary h-8 w-8 animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="border-border bg-muted/30 flex min-h-56 flex-col items-center justify-center rounded-lg border text-center">
            <FileCheck2 className="text-muted-foreground/50 h-10 w-10" />
            <p className="mt-3 text-sm font-semibold">
              No hay registros oficiales
            </p>
            <p className="text-muted-foreground mt-1 text-sm">
              Los planes aparecerán aquí cuando se cierre su aprobación SEP.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {filtered.map((item) => {
              const itemPlanId = item.plan_estudio_id
              if (!itemPlanId) return null

              const planName =
                item.plan_nombre ||
                item.plan_nombre_propuesto ||
                item.plan_nombre_legacy ||
                'Plan de estudios'

              return (
                <article
                  key={item.id}
                  className="border-border/70 bg-card rounded-lg border p-4 shadow-sm"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="secondary">
                          {item.autoridad || 'SEP'}
                        </Badge>
                        <Badge variant="outline">
                          {item.carrera_nivel || 'Nivel'}
                        </Badge>
                        <span className="text-muted-foreground text-xs">
                          {item.facultad_nombre_corto ||
                            item.facultad_nombre ||
                            'Facultad'}
                        </span>
                      </div>

                      <h2 className="text-lg font-semibold break-words">
                        {planName}
                      </h2>
                      <p className="text-muted-foreground text-sm">
                        {item.carrera_nombre_corto ||
                          item.carrera_nombre ||
                          'Carrera'}
                      </p>
                    </div>

                    <div className="flex shrink-0 flex-wrap gap-2">
                      {(item.documento_path || item.documento_url) && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => void openDocumento(item)}
                          disabled={openingId === item.id}
                        >
                          {openingId === item.id ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <ExternalLink className="mr-2 h-4 w-4" />
                          )}
                          Documento
                        </Button>
                      )}
                      <Button variant="default" size="sm" asChild>
                        <Link
                          to="/planes/$planId/registro-oficial"
                          params={{ planId: itemPlanId }}
                        >
                          <FileText className="mr-2 h-4 w-4" />
                          Ficha
                        </Link>
                      </Button>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
                    <MiniFact
                      icon={<Hash className="h-4 w-4" />}
                      label="Clave"
                      value={item.clave_sep}
                    />
                    <MiniFact
                      icon={<ShieldCheck className="h-4 w-4" />}
                      label="Dictamen"
                      value={item.numero_acuerdo}
                    />
                    <MiniFact
                      icon={<CalendarDays className="h-4 w-4" />}
                      label="Vigencia"
                      value={`${formatDate(item.vigencia_inicio)} - ${
                        item.vigencia_fin
                          ? formatDate(item.vigencia_fin)
                          : 'sin fin'
                      }`}
                    />
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function MiniFact({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: string | null
}) {
  return (
    <div className="bg-muted/30 flex min-h-18 items-start gap-3 rounded-lg border p-3">
      <div className="text-muted-foreground mt-0.5 shrink-0">{icon}</div>
      <div className="min-w-0">
        <p className="text-muted-foreground text-[10px] font-bold tracking-wider uppercase">
          {label}
        </p>
        <p className="text-foreground mt-1 text-sm font-semibold break-words">
          {value || 'Pendiente'}
        </p>
      </div>
    </div>
  )
}
