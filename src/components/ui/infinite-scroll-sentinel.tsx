import { LoaderCircle } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { Button } from './button'

export function InfiniteScrollSentinel({
  hasNextPage,
  isFetching,
  isFetchingNextPage,
  onLoadMore,
  loaded,
  total,
}: {
  hasNextPage: boolean
  isFetching: boolean
  isFetchingNextPage: boolean
  onLoadMore: () => void
  loaded: number
  total: number
}) {
  const sentinelRef = useRef<HTMLDivElement | null>(null)
  const [supportsObserver, setSupportsObserver] = useState(true)

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') {
      setSupportsObserver(false)
      return
    }
    if (!hasNextPage) return

    const node = sentinelRef.current
    if (!node) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        // Una InfiniteQuery comparte una sola petición entre todas sus páginas:
        // no iniciamos otra mientras hay un refetch o una página en vuelo.
        if (entry.isIntersecting && !isFetching) onLoadMore()
      },
      { rootMargin: '480px 0px' },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [hasNextPage, isFetching, onLoadMore])

  return (
    <div
      ref={sentinelRef}
      className="py-relacionado flex min-h-12 items-center justify-center"
      aria-live="polite"
    >
      {isFetchingNextPage ? (
        <span className="text-muted-foreground gap-relacionado inline-flex items-center text-sm">
          <LoaderCircle className="size-4 animate-spin" aria-hidden />
          Cargando más resultados…
        </span>
      ) : hasNextPage && !supportsObserver ? (
        <Button type="button" variant="outline" onClick={onLoadMore}>
          Cargar más resultados
        </Button>
      ) : !hasNextPage && loaded > 0 ? (
        <span className="text-muted-foreground text-xs">
          {loaded} de {total} resultados
        </span>
      ) : null}
    </div>
  )
}
