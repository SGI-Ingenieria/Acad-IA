import { Skeleton } from '@/components/ui/skeleton'

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
      <div className="mx-auto w-full max-w-7xl space-y-6 px-4 py-6 md:px-6 lg:px-8">
        <div className="space-y-3">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-8 w-full max-w-xl" />
          <Skeleton className="h-4 w-full max-w-sm" />
        </div>
        <div className="space-y-3 rounded-lg border p-4">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-11/12" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      </div>
    </div>
  )
}

/** Full detail-layout shell: back bar, header, info cards, tab strip, body. */
export function DetailShellSkeleton() {
  return (
    <div className="animate-in fade-in bg-background min-h-screen duration-150">
      {/* Back bar */}
      <div className="bg-background/80 sticky top-0 z-20 border-b shadow-sm backdrop-blur-sm">
        <div className="px-4 py-2 md:px-6 lg:px-8">
          <Skeleton className="h-3 w-28" />
        </div>
      </div>

      <div className="mx-auto w-full max-w-7xl space-y-8 px-4 py-6 md:px-6 lg:px-8 lg:py-8">
        {/* Header */}
        <div className="flex flex-col items-start justify-between gap-4 md:flex-row">
          <div className="w-full space-y-2 md:max-w-xl">
            <Skeleton className="h-8 w-full max-w-md" />
            <Skeleton className="h-5 w-2/3" />
          </div>
          <Skeleton className="h-6 w-28 rounded-full" />
        </div>

        {/* Info cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="border-border/60 bg-muted/30 flex h-18 w-full items-center gap-4 rounded-xl border p-4 shadow-sm"
            >
              <Skeleton className="h-10 w-10 shrink-0 rounded-lg" />
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-4 w-28" />
              </div>
            </div>
          ))}
        </div>

        {/* Tabs — responsive: scrolls instead of overflowing on small screens */}
        <div className="scrollbar-hide overflow-x-auto border-b">
          <div className="flex min-w-max gap-6 pb-3 sm:gap-8">
            {Array.from({ length: 7 }).map((_, index) => (
              <Skeleton key={index} className="h-4 w-24 shrink-0" />
            ))}
          </div>
        </div>

        {/* Body */}
        <TabPanelSkeleton />
      </div>
    </div>
  )
}

/**
 * Content-only skeleton for leaf routes that render into a parent layout's
 * `<Outlet/>`. Draws no chrome — the layout already provides it.
 */
export function TabPanelSkeleton() {
  return (
    <div className="animate-in fade-in grid gap-4 duration-150 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
      <div className="space-y-3 rounded-lg border p-4">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-11/12" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-5/6" />
      </div>
      <div className="space-y-3 rounded-lg border p-4">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    </div>
  )
}

/**
 * Curriculum-map skeleton: a horizontal row of cycle columns, each holding a
 * stack of subject-card placeholders. Mirrors the `mapa` tab layout.
 */
export function MapTabSkeleton() {
  return (
    <div className="animate-in fade-in space-y-4 duration-150">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Skeleton className="h-9 w-44" />
        <div className="flex gap-2">
          <Skeleton className="h-9 w-28" />
          <Skeleton className="h-9 w-28" />
        </div>
      </div>

      {/* Cycle columns */}
      <div className="flex gap-4 overflow-x-auto pb-2">
        {Array.from({ length: 5 }).map((_col, col) => (
          <div key={col} className="w-56 shrink-0 space-y-3">
            <div className="bg-muted/40 flex items-center justify-between rounded-lg border px-3 py-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-6" />
            </div>
            {Array.from({ length: 3 + (col % 2) }).map((_card, card) => (
              <div
                key={card}
                className="border-border/60 bg-card space-y-2 rounded-lg border p-3 shadow-sm"
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
    <div className="animate-in fade-in flex h-[70vh] gap-4 duration-150">
      {/* Conversation rail */}
      <div className="hidden w-64 shrink-0 flex-col gap-3 rounded-lg border p-3 md:flex">
        <Skeleton className="h-9 w-full" />
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="space-y-1.5 rounded-md p-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        ))}
      </div>

      {/* Thread + composer */}
      <div className="flex min-w-0 flex-1 flex-col gap-4 rounded-lg border p-4">
        <div className="flex-1 space-y-4 overflow-hidden">
          {Array.from({ length: 3 }).map((_, index) => (
            <div
              key={index}
              className={
                index % 2 === 0
                  ? 'ml-auto w-2/3 space-y-2'
                  : 'mr-auto w-3/4 space-y-2'
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
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 md:px-6 lg:px-8 lg:py-8">
        {/* Hero / toolbar */}
        <div className="bg-card space-y-4 rounded-3xl border p-6 shadow-sm sm:p-8">
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 shrink-0 rounded-xl" />
            <div className="space-y-2">
              <Skeleton className="h-7 w-56" />
              <Skeleton className="h-4 w-72 max-w-full" />
            </div>
          </div>
          <div className="border-t pt-5">
            <Skeleton className="h-10 w-full max-w-xl" />
          </div>
        </div>

        {/* Master + detail columns */}
        <div className="bg-card/70 grid overflow-hidden rounded-3xl border shadow-sm xl:grid-cols-[380px_minmax(0,1fr)]">
          <div className="space-y-3 border-b p-4 xl:border-r xl:border-b-0">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="flex items-center gap-3 p-2">
                <Skeleton className="h-11 w-11 shrink-0 rounded-2xl" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
          <div className="space-y-4 p-6">
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={index}
                className="border-border/60 space-y-2 rounded-lg border p-4"
              >
                <Skeleton className="h-5 w-1/2" />
                <Skeleton className="h-3 w-1/3" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * Content skeletons — meant to be rendered *inside* a page's real shell (not as
 * a route `pendingComponent`). Use these for the data-bound regions of a page
 * while its queries resolve, so chrome (headers, filters, tabs) stays visible.
 */

/** A grid of plan-card placeholders. Mirrors `PlanEstudiosCard`'s footprint. */
export function PlanCardGridSkeleton({
  count = 8,
  className = 'grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4',
}: {
  count?: number
  className?: string
}) {
  return (
    <div className={className}>
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          className="border-border/60 bg-card flex h-64 w-full flex-col gap-4 rounded-xl border p-5 shadow-sm"
        >
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 shrink-0 rounded-lg" />
            <Skeleton className="h-4 w-24" />
          </div>
          <Skeleton className="h-5 w-4/5" />
          <Skeleton className="h-4 w-2/3" />
          <div className="mt-auto flex items-center justify-between">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-6 w-16 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  )
}

/** A vertical list of avatar+two-line rows. For master panes / row lists. */
export function ListRowsSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="flex items-center gap-3 p-2">
          <Skeleton className="h-11 w-11 shrink-0 rounded-2xl" />
          <div className="flex-1 space-y-2">
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
