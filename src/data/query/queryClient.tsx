import {
  MutationCache,
  QueryCache,
  QueryClient,
  QueryClientProvider,
  hashKey,
} from '@tanstack/react-query'

import { notify } from '@/lib/toast'

declare module '@tanstack/react-query' {
  interface Register {
    mutationMeta: {
      /**
       * Mensaje en español para el toast global de error.
       * `false` = el hook gestiona su propio aviso (p. ej. mapea códigos de
       * `EdgeFunctionError` a mensajes específicos) y la red global calla.
       */
      errorMessage?: string | false
      /**
       * Ofrecer la acción "Reintentar" en el toast de error. Solo para
       * mutaciones seguras de repetir (idempotentes o protegidas contra
       * duplicados). Default `true` para mutaciones clasificadas (con meta).
       */
      retryable?: boolean
    }
    queryMeta: {
      /** Mensaje si la carga inicial falla sin caché utilizable. `false` = silencio. */
      errorMessage?: string | false
    }
  }
}

export function getContext() {
  const mutationCache = new MutationCache({
    onError: (error, variables, _onMutateResult, mutation) => {
      const meta = mutation.meta
      if (meta?.errorMessage === false) return
      // Red de seguridad para mutaciones legadas: si el hook ya define su
      // propio onError (toast propio) y no ha declarado meta, no duplicamos.
      if (meta?.errorMessage === undefined && mutation.options.onError) return

      // "Reintentar" solo en mutaciones clasificadas (declaran meta): repetir
      // a ciegas una mutación legada no idempotente podría duplicar efectos.
      const retryable = meta !== undefined && meta.retryable !== false
      const options = mutation.options

      notify.error(error, {
        description:
          typeof meta?.errorMessage === 'string'
            ? meta.errorMessage
            : undefined,
        // Un slot por mutationKey: fallos repetidos no apilan toasts.
        id: options.mutationKey
          ? `mutation-error:${hashKey(options.mutationKey)}`
          : undefined,
        duration: retryable ? 10_000 : undefined,
        action: retryable
          ? {
              label: 'Reintentar',
              onClick: () => {
                // Reconstruye la mutación desde sus options capturadas: corre
                // el ciclo completo (onMutate/onError/onSettled) y sobrevive
                // al desmontaje del componente que la originó. `queryClient`
                // ya existe cuando el usuario puede pulsar la acción.
                const fresh = mutationCache.build(queryClient, options)
                // Un nuevo fallo re-entra por este mismo onError global.
                void fresh.execute(variables).catch(() => undefined)
              },
            }
          : undefined,
      })
    },
  })

  const queryCache = new QueryCache({
    onError: (error, query) => {
      if (query.meta?.errorMessage === false) return
      // Con caché utilizable el fallo es de un refetch en background: la UI
      // sigue mostrando datos válidos y no interrumpimos con un toast.
      if (query.state.data !== undefined) return
      notify.error(error, {
        description:
          typeof query.meta?.errorMessage === 'string'
            ? query.meta.errorMessage
            : undefined,
        id: `query-error:${query.queryHash}`,
      })
    },
  })

  const queryClient: QueryClient = new QueryClient({
    mutationCache,
    queryCache,
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        refetchOnWindowFocus: false,
        retry: (failureCount) => failureCount < 2,
      },
      mutations: {
        retry: 0,
      },
    },
  })
  return {
    queryClient,
  }
}

export function Provider({
  children,
  queryClient,
}: {
  children: React.ReactNode
  queryClient: QueryClient
}) {
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}
