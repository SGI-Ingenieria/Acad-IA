import { AlertTriangle, WifiOff } from 'lucide-react'

import { usePublicConnectivityStatus } from '@/data/hooks/useObservability'

export function ConnectivityBanner() {
  const statusQuery = usePublicConnectivityStatus()
  const status = statusQuery.data?.status
  const show =
    status === 'error' ||
    Boolean(statusQuery.error) ||
    (!statusQuery.isLoading && statusQuery.data?.ok === false)

  if (!show) return null

  const hasEdgeErrors =
    (statusQuery.data?.edgeFunctions.error ?? 0) > 0 ||
    Boolean(statusQuery.error)
  const StatusIcon = hasEdgeErrors ? WifiOff : AlertTriangle

  return (
    <div
      role="alert"
      className="border-destructive/30 bg-destructive/10 text-destructive px-grupo py-control border-b"
    >
      <div className="gap-control mx-auto flex w-full max-w-7xl items-center text-sm">
        <span className="border-destructive/20 bg-background/70 flex size-7 shrink-0 items-center justify-center rounded-full border">
          <StatusIcon className="size-3.5" aria-hidden="true" />
        </span>
        <p className="min-w-0 leading-snug font-medium">
          La plataforma está teniendo problemas de conectividad.
        </p>
      </div>
    </div>
  )
}
