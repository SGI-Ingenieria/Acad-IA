import {
  createFileRoute,
  Link,
  stripSearchParams,
} from '@tanstack/react-router'
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
import { useEffect, useMemo, useState } from 'react'

import type { RegistrosOficialesSearch } from '@/types/search'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PageContainer } from '@/components/ui/layout'
import { ListSortMenu, ListToolbar } from '@/components/ui/list-controls'
import { officialPlanDocument_get_signed_url } from '@/data/api/files.api'
import { requireAnyPermission } from '@/data/auth/routeGuards'
import { useRegistrosOficiales } from '@/data/hooks/usePlans'
import { notify } from '@/lib/toast'
import { defaultRegistrosOficialesSearch } from '@/types/search'

const parseRegistrosOficialesSearch = (
  search: Record<string, unknown>,
): RegistrosOficialesSearch => ({
  q:
    typeof search.q === 'string' ? search.q : defaultRegistrosOficialesSearch.q,
  orden:
    search.orden === 'aprobacion_asc' ||
    search.orden === 'nombre_asc' ||
    search.orden === 'nombre_desc'
      ? search.orden
      : defaultRegistrosOficialesSearch.orden,
})

export const Route = createFileRoute('/registros-oficiales')({
  beforeLoad: ({ context }) =>
    requireAnyPermission(context.queryClient, ['planes.ver']),
  validateSearch: parseRegistrosOficialesSearch,
  search: {
    middlewares: [stripSearchParams(defaultRegistrosOficialesSearch)],
  },
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
  const { q, orden } = Route.useSearch()
  const navigate = Route.useNavigate()
  const [openingId, setOpeningId] = useState<string | null>(null)

  // Búsqueda con debounce: el input es local y se vuelca a la URL tras una pausa.
  const [qInput, setQInput] = useState(q)
  useEffect(() => setQInput(q), [q])
  useEffect(() => {
    const trimmed = qInput.trim()
    if (trimmed === q) return
    const id = setTimeout(() => {
      void navigate({
        search: (prev) => ({ ...prev, q: trimmed }),
        resetScroll: false,
      })
    }, 350)
    return () => clearTimeout(id)
  }, [qInput, navigate, q])

  const filtered = useMemo(() => {
    const query = normalizeText(q.trim())
    return (data ?? [])
      .filter((item) => {
        if (!query) return true
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
        return haystack.includes(query)
      })
      .sort((left, right) => {
        const leftName = left.plan_nombre ?? left.plan_nombre_propuesto ?? ''
        const rightName = right.plan_nombre ?? right.plan_nombre_propuesto ?? ''
        if (orden === 'nombre_asc')
          return leftName.localeCompare(rightName, 'es')
        if (orden === 'nombre_desc')
          return rightName.localeCompare(leftName, 'es')
        const comparison = String(left.fecha_aprobacion ?? '').localeCompare(
          String(right.fecha_aprobacion ?? ''),
        )
        return orden === 'aprobacion_asc' ? comparison : -comparison
      })
  }, [data, orden, q])

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
      <PageContainer className="space-y-seccion">
        <div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Registros SEP</h1>
          </div>
        </div>
        <ListToolbar
          search={
            <div className="relative w-full">
              <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
              <Input
                value={qInput}
                onChange={(event) => setQInput(event.target.value)}
                className="pl-pagina"
                placeholder="Buscar registro"
                aria-label="Buscar registros SEP"
              />
            </div>
          }
          actions={
            <ListSortMenu
              value={orden}
              defaultValue={defaultRegistrosOficialesSearch.orden}
              options={[
                { value: 'aprobacion_desc', label: 'Aprobación reciente' },
                { value: 'aprobacion_asc', label: 'Aprobación antigua' },
                { value: 'nombre_asc', label: 'Nombre A–Z' },
                { value: 'nombre_desc', label: 'Nombre Z–A' },
              ]}
              onValueChange={(nextOrden) =>
                navigate({
                  search: (prev) => ({ ...prev, orden: nextOrden }),
                  resetScroll: false,
                })
              }
              label="Ordenar registros SEP"
            />
          }
        />

        {isLoading ? (
          <div className="flex h-48 items-center justify-center">
            <Loader2 className="text-primary h-8 w-8 animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="border-border bg-muted/30 flex min-h-56 flex-col items-center justify-center rounded-lg border text-center">
            <FileCheck2 className="text-muted-foreground/50 h-10 w-10" />
            <p className="mt-control text-sm font-semibold">
              No hay registros oficiales
            </p>
          </div>
        ) : (
          <div className="gap-grupo grid grid-cols-1">
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
                  className="border-border/70 bg-card p-grupo rounded-lg border shadow-sm"
                >
                  <div className="gap-grupo flex flex-col lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-relacionado min-w-0">
                      <div className="gap-relacionado flex flex-wrap items-center">
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

                    <div className="gap-relacionado flex shrink-0 flex-wrap">
                      {(item.documento_path || item.documento_url) && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => void openDocumento(item)}
                          disabled={openingId === item.id}
                        >
                          {openingId === item.id ? (
                            <Loader2 className="mr-relacionado h-4 w-4 animate-spin" />
                          ) : (
                            <ExternalLink className="mr-relacionado h-4 w-4" />
                          )}
                          Documento
                        </Button>
                      )}
                      <Button variant="default" size="sm" asChild>
                        <Link
                          to="/planes/$planId/registro-oficial"
                          params={{ planId: itemPlanId }}
                        >
                          <FileText className="mr-relacionado h-4 w-4" />
                          Ficha
                        </Link>
                      </Button>
                    </div>
                  </div>

                  <div className="mt-grupo gap-control grid grid-cols-1 md:grid-cols-4">
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
                      label="Solicitud RVOE"
                      value={item.anio_solicitud_rvoe?.toString() ?? null}
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
      </PageContainer>
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
    <div className="bg-muted/30 gap-control p-control flex min-h-18 items-start rounded-lg border">
      <div className="text-muted-foreground mt-micro shrink-0">{icon}</div>
      <div className="min-w-0">
        <p className="text-muted-foreground text-[10px] font-bold tracking-wider uppercase">
          {label}
        </p>
        <p className="text-foreground mt-micro text-sm font-semibold break-words">
          {value || 'Pendiente'}
        </p>
      </div>
    </div>
  )
}
