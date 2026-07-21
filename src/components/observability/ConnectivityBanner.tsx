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

  return (
    <div className="border-destructive/30 bg-destructive/10 text-destructive border-b px-4 py-3">
      <div className="mx-auto flex w-full max-w-7xl items-start gap-3 text-sm">
        <div className="bg-background/80 mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border">
          {hasEdgeErrors ? (
            <WifiOff className="h-4 w-4" />
          ) : (
            <AlertTriangle className="h-4 w-4" />
          )}
        </div>
        <div className="min-w-0">
          <p className="font-medium">
            La plataforma está teniendo problemas de conectividad.
          </p>
          <p className="text-destructive/80 mt-0.5 leading-5">
            Algunas funciones o la conexión con el servidor no están
            respondiendo correctamente.
          </p>
        </div>
      </div>
    </div>
  )
}
