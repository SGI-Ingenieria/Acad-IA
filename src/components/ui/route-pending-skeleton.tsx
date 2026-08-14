import type { ModoDisposicion } from '@/components/ui/masonry-grid'

import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { PageContainer } from '@/components/ui/layout'
import { MasonryGrid } from '@/components/ui/masonry-grid'
import { Skeleton } from '@/components/ui/skeleton'

/** Respuesta inmediata mientras se descarga el componente de una ruta modal. */
export function RoutePendingDialog({ title }: { title: string }) {
  return (
    <Dialog open>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>Cargando formulario…</DialogDescription>
        </DialogHeader>
        <DialogBody aria-hidden>
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="ml-auto h-10 w-32" />
        </DialogBody>
      </DialogContent>
    </Dialog>
  )
}

/**
 * Route pending skeletons.
 *
 * In TanStack Router a route's `pendingComponent` renders **inside its parent's
 * `<Outlet/>`**, replacing only that route's own `component`. So each skeleton
 * should mirror *only the slice of the page that route owns* — never the whole
 * page chrome. Drawing full chrome at every level is what makes nested pending
 * states look like a page stacked recursively inside itself.
 *
 * Pick the variant that matches the route's layout:
 *  - `GenericPageSkeleton`  — neutral full-page fallback (router default).
 *  - `DetailShellSkeleton`  — a detail layout: header + info cards + tabs + body
 *                             (use on layout routes like `_detalle`).
 *  - `TabPanelSkeleton`     — content only, for leaf routes that render into a
 *                             layout's `<Outlet/>` (the tab panels).
 *  - `MasterDetailSkeleton` — two-pane master/detail (facultades, estructuras).
 */

/** Neutral, responsive page-level fallback. The router default. */
export function GenericPageSkeleton() {
  return (
    <div className="animate-in fade-in bg-background w-full duration-150">
      <PageContainer className="space-y-seccion">
        <div className="space-y-control">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-8 w-full max-w-xl" />
          <Skeleton className="h-4 w-full max-w-sm" />
        </div>
        <div className="space-y-control p-grupo rounded-lg border">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-11/12" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      </PageContainer>
    </div>
  )
}

/** Full detail-layout shell: back bar, header, info cards, tab strip, body. */
export function DetailShellSkeleton() {
  return (
    <div className="animate-in fade-in bg-background min-h-screen duration-150">
      {/* Back bar */}
      <div className="bg-background/80 sticky top-0 z-20 border-b shadow-sm backdrop-blur-sm">
        <div className="px-grupo py-relacionado md:px-seccion lg:px-region">
          <Skeleton className="h-3 w-28" />
        </div>
      </div>

      <PageContainer className="space-y-region">
        {/* Header */}
        <div className="gap-grupo flex flex-col items-start justify-between md:flex-row">
          <div className="space-y-relacionado w-full md:max-w-xl">
            <Skeleton className="h-8 w-full max-w-md" />
            <Skeleton className="h-5 w-2/3" />
          </div>
          <Skeleton className="h-6 w-28 rounded-full" />
        </div>

        {/* Info cards */}
        <div className="gap-grupo grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="border-border/60 bg-muted/30 gap-grupo p-grupo flex h-18 w-full items-center rounded-xl border shadow-sm"
            >
              <Skeleton className="h-10 w-10 shrink-0 rounded-lg" />
              <div className="space-y-relacionado min-w-0 flex-1">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-4 w-28" />
              </div>
            </div>
          ))}
        </div>

        {/* Tabs — responsive: scrolls instead of overflowing on small screens */}
        <div className="scrollbar-hide overflow-x-auto border-b">
          <div className="gap-seccion pb-control sm:gap-region flex min-w-max">
            {Array.from({ length: 7 }).map((_, index) => (
              <Skeleton key={index} className="h-4 w-24 shrink-0" />
            ))}
          </div>
        </div>

        {/* Body */}
        <TabPanelSkeleton />
      </PageContainer>
    </div>
  )
}

/** Renglones de cada tarjeta hueca, para que no todas midan lo mismo. */
const RENGLONES_CAMPO = [4, 2, 5, 3] as const

/**
 * Content-only skeleton for leaf routes that render into a parent layout's
 * `<Outlet/>`. Draws no chrome — the layout already provides it.
 *
 * Usa la misma `.masonry-grid` que las tarjetas de campo reales (datos
 * generales del plan y de la asignatura): antes dibujaba dos columnas
 * asimétricas que no correspondían a ninguna pantalla, así que el contenido
 * saltaba de sitio al terminar de cargar.
 */
export function TabPanelSkeleton() {
  return (
    <div className="animate-in fade-in masonry-grid duration-150">
      {RENGLONES_CAMPO.map((renglones, i) => (
        <div key={i} className="space-y-control p-grupo rounded-2xl border">
          <Skeleton className="h-5 w-40" />
          {Array.from({ length: renglones }).map((_, j) => (
            <Skeleton
              key={j}
              className={j % 2 ? 'h-4 w-11/12' : 'h-4 w-full'}
            />
          ))}
        </div>
      ))}
    </div>
  )
}

/**
 * Curriculum-map skeleton: a horizontal row of cycle columns, each holding a
 * stack of subject-card placeholders. Mirrors the `mapa` tab layout.
 */
export function MapTabSkeleton() {
  return (
    <div className="animate-in fade-in space-y-grupo duration-150">
      {/* Toolbar */}
      <div className="gap-control flex flex-wrap items-center justify-between">
        <Skeleton className="h-9 w-44" />
        <div className="gap-relacionado flex">
          <Skeleton className="h-9 w-28" />
          <Skeleton className="h-9 w-28" />
        </div>
      </div>

      {/* Cycle columns */}
      <div className="gap-grupo pb-relacionado flex overflow-x-auto">
        {Array.from({ length: 5 }).map((_col, col) => (
          <div key={col} className="space-y-control w-56 shrink-0">
            <div className="bg-muted/40 px-control py-relacionado flex items-center justify-between rounded-lg border">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-6" />
            </div>
            {Array.from({ length: 3 + (col % 2) }).map((_card, card) => (
              <div
                key={card}
                className="border-border/60 bg-card space-y-relacionado p-control rounded-lg border shadow-sm"
              >
                <Skeleton className="h-3 w-12" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

/**
 * Chat-workspace skeleton: conversation rail + message thread + composer.
 * Mirrors the `iaplan` / `iaasignatura` chat tabs.
 */
export function ChatTabSkeleton() {
  return (
    <div className="animate-in fade-in gap-grupo flex h-[70vh] duration-150">
      {/* Conversation rail */}
      <div className="gap-control p-control hidden w-64 shrink-0 flex-col rounded-lg border md:flex">
        <Skeleton className="h-9 w-full" />
        {Array.from({ length: 6 }).map((_, index) => (
          <div
            key={index}
            className="space-y-relacionado p-relacionado rounded-md"
          >
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        ))}
      </div>

      {/* Thread + composer */}
      <div className="gap-grupo p-grupo flex min-w-0 flex-1 flex-col rounded-lg border">
        <div className="space-y-grupo flex-1 overflow-hidden">
          {Array.from({ length: 3 }).map((_, index) => (
            <div
              key={index}
              className={
                index % 2 === 0
                  ? 'space-y-relacionado ml-auto w-2/3'
                  : 'space-y-relacionado mr-auto w-3/4'
              }
            >
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
              {index % 2 !== 0 && <Skeleton className="h-4 w-3/4" />}
            </div>
          ))}
        </div>
        <Skeleton className="h-20 w-full rounded-xl" />
      </div>
    </div>
  )
}

/** Two-pane master/detail shell (facultades, estructuras). */
export function MasterDetailSkeleton() {
  return (
    <div className="animate-in fade-in bg-background min-h-screen w-full duration-150">
      <PageContainer className="gap-seccion flex flex-col">
        {/* Hero / toolbar */}
        <div className="border-border space-y-grupo pb-seccion border-b">
          <div className="gap-control flex items-center">
            <Skeleton className="h-10 w-10 shrink-0 rounded-xl" />
            <div className="space-y-relacionado">
              <Skeleton className="h-7 w-56" />
              <Skeleton className="h-4 w-72 max-w-full" />
            </div>
          </div>
          <div className="pt-seccion border-t">
            <Skeleton className="h-10 w-full max-w-xl" />
          </div>
        </div>

        {/* Master + detail columns */}
        <div className="border-border grid overflow-hidden border-y xl:grid-cols-[380px_minmax(0,1fr)]">
          <div className="space-y-control p-grupo border-b xl:border-r xl:border-b-0">
            {Array.from({ length: 6 }).map((_, index) => (
              <div
                key={index}
                className="gap-control p-relacionado flex items-center"
              >
                <Skeleton className="h-11 w-11 shrink-0 rounded-2xl" />
                <div className="space-y-relacionado flex-1">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
          <div className="space-y-grupo p-seccion">
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={index}
                className="border-border/60 space-y-relacionado p-grupo rounded-lg border"
              >
                <Skeleton className="h-5 w-1/2" />
                <Skeleton className="h-3 w-1/3" />
              </div>
            ))}
          </div>
        </div>
      </PageContainer>
    </div>
  )
}

/**
 * Content skeletons — meant to be rendered *inside* a page's real shell (not as
 * a route `pendingComponent`). Use these for the data-bound regions of a page
 * while its queries resolve, so chrome (headers, filters, tabs) stays visible.
 */

/**
 * A grid of plan-card placeholders. Mirrors `PlanEstudiosCard`: hoja tamaño
 * carta con la pestaña de carpeta encima, para que al llegar los datos no salte
 * la retícula.
 */
export function PlanCardGridSkeleton({
  count = 6,
  className,
  modo = 'cuadricula',
}: {
  count?: number
  className?: string
  modo?: ModoDisposicion
}) {
  return (
    <MasonryGrid className={className} modo={modo}>
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          className="border-border/70 bg-card gap-grupo p-seccion flex flex-col rounded-lg border"
        >
          <div className="gap-control flex items-center justify-between">
            <div className="gap-control flex min-w-0 items-center">
              <Skeleton className="size-4 shrink-0 rounded" />
              <Skeleton className="h-3 w-32" />
            </div>
            <Skeleton className="h-5 w-20 rounded-full" />
          </div>
          <div className="space-y-relacionado">
            <Skeleton className="h-5 w-11/12" />
            <Skeleton className="h-5 w-2/3" />
          </div>
          <div className="border-border/60 gap-grupo pt-control flex items-center border-t">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-3 w-20" />
            <Skeleton className="ml-auto size-4 rounded" />
          </div>
        </div>
      ))}
    </MasonryGrid>
  )
}

/** A vertical list of avatar+two-line rows. For master panes / row lists. */
export function ListRowsSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="space-y-control">
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          className="gap-control p-relacionado flex items-center"
        >
          <Skeleton className="h-11 w-11 shrink-0 rounded-2xl" />
          <div className="space-y-relacionado flex-1">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  )
}

/**
 * @deprecated Prefer the scoped variants above. Kept so existing imports keep
 * working; aliases the neutral page-level fallback.
 */
export const RoutePendingSkeleton = GenericPageSkeleton
