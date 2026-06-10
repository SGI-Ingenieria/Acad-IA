import { Skeleton } from '@/components/ui/skeleton'

export function RoutePendingSkeleton() {
  return (
    <div className="animate-in fade-in bg-background w-full duration-150">
      <div className="mx-auto w-full max-w-7xl space-y-6 px-4 py-6 md:px-6 lg:px-8">
        <div className="space-y-3">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-8 w-full max-w-xl" />
          <Skeleton className="h-4 w-full max-w-sm" />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
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

        <div className="flex gap-6 border-b pb-3">
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} className="h-4 w-24 shrink-0" />
          ))}
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
          <div className="space-y-3 rounded-lg border p-4">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-11/12" />
            <Skeleton className="h-4 w-3/4" />
          </div>
          <div className="space-y-3 rounded-lg border p-4">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        </div>
      </div>
    </div>
  )
}
