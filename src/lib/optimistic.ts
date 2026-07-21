import type {
  MutationKey,
  QueryClient,
  QueryKey,
  UseMutationOptions,
} from '@tanstack/react-query'

/** Id temporal para inserciones optimistas, reconciliado en `onSuccess`. */
export const makeTempId = () => `temp:${crypto.randomUUID()}`

export const isTempId = (id: string | null | undefined): boolean =>
  typeof id === 'string' && id.startsWith('temp:')

type Snapshot = {
  key: QueryKey
  previous: unknown
  existed: boolean
}

export type OptimisticContext = {
  snapshots: Array<Snapshot>
}

type CacheWrite<TVariables> = {
  key: QueryKey
  /**
   * `false` (default) aplica el updater a todas las queries bajo el prefijo
   * `key` (`setQueriesData`), p. ej. listas con filtros variables.
   * `true` opera solo sobre la entrada exacta.
   */
  exact?: boolean
  updater: (current: unknown, variables: TVariables) => unknown
}

type Options<TData, TVariables> = {
  queryClient: QueryClient
  /**
   * Identifica la mutación para: dedupe del toast global, "Reintentar" desde
   * el MutationCache y guards `isMutating` (p. ej. Realtime vs optimista).
   */
  mutationKey?: MutationKey
  /**
   * Identidad de la entidad afectada (p. ej. `(v) => v.planId`). Con varias
   * mutaciones hermanas en vuelo, solo se consideran concurrentes las del
   * mismo scope: dos ediciones del MISMO plan difieren la invalidación a la
   * última; ediciones de planes distintos invalidan de forma independiente.
   */
  scope?: (variables: TVariables) => string | number | null | undefined
  /** Escrituras optimistas de caché; cada una se cancela, snapshotea y aplica. */
  writes: (variables: TVariables) => Array<CacheWrite<TVariables>>
  /** Keys adicionales a invalidar al asentarse (listas, historiales, contadores). */
  invalidateOnSettle?: (variables: TVariables, data?: TData) => Array<QueryKey>
  /**
   * Sustituye entidades temporales (`makeTempId`) por la entidad real del
   * servidor antes de invalidar, para que la UI no "parpadee" al refetch.
   */
  reconcile?: (data: TData, variables: TVariables, qc: QueryClient) => void
  /** Mensaje en español para el toast global de error (con "Reintentar"). */
  errorMessage: string
  /** `false` si repetir la mutación no es seguro (no idempotente). */
  retryable?: boolean
}

/**
 * Bundle `{ mutationKey, meta, onMutate, onError, onSuccess, onSettled }` con
 * el patrón optimista completo del proyecto:
 *
 * 1. `onMutate`: cancela queries en vuelo por cada write, snapshotea (con
 *    marca de existencia) y aplica el updater.
 * 2. `onError`: restaura snapshots en orden inverso; las entradas que no
 *    existían se eliminan (`removeQueries`). El toast lo pone el
 *    MutationCache global leyendo `meta.errorMessage` — aquí no se notifica.
 * 3. `onSuccess`: `reconcile` de temp-ids con la entidad real.
 * 4. `onSettled`: invalida writes + `invalidateOnSettle`, solo cuando esta es
 *    la última mutación en vuelo con la misma `mutationKey` (evita que el
 *    refetch pise el update optimista de una mutación concurrente).
 */
export function optimisticMutation<TData, TVariables>({
  queryClient: qc,
  mutationKey,
  scope,
  writes,
  invalidateOnSettle,
  reconcile,
  errorMessage,
  retryable,
}: Options<TData, TVariables>): Pick<
  UseMutationOptions<TData, Error, TVariables, OptimisticContext>,
  'mutationKey' | 'meta' | 'onMutate' | 'onError' | 'onSuccess' | 'onSettled'
> {
  return {
    ...(mutationKey ? { mutationKey } : {}),
    meta: { errorMessage, ...(retryable === false ? { retryable } : {}) },

    onMutate: async (variables) => {
      const resolved = writes(variables)
      const snapshots: Array<Snapshot> = []

      for (const write of resolved) {
        const exact = write.exact ?? false
        await qc.cancelQueries({ queryKey: write.key, exact })

        if (exact) {
          const previous = qc.getQueryData(write.key)
          snapshots.push({
            key: write.key,
            previous,
            existed: qc.getQueryState(write.key) !== undefined,
          })
          qc.setQueryData(write.key, (current: unknown) =>
            write.updater(current, variables),
          )
        } else {
          for (const [key, previous] of qc.getQueriesData({
            queryKey: write.key,
          })) {
            snapshots.push({ key, previous, existed: true })
            qc.setQueryData(key, (current: unknown) =>
              write.updater(current, variables),
            )
          }
        }
      }

      return { snapshots }
    },

    onError: (_error, _variables, context) => {
      if (!context) return
      for (const snapshot of [...context.snapshots].reverse()) {
        if (snapshot.existed) {
          qc.setQueryData(snapshot.key, snapshot.previous)
        } else {
          // setQueryData(key, undefined) es un no-op: la entrada creada por el
          // updater optimista se elimina explícitamente.
          qc.removeQueries({ queryKey: snapshot.key, exact: true })
        }
      }
    },

    onSuccess: (data, variables) => {
      reconcile?.(data, variables, qc)
    },

    onSettled: (data, _error, variables, context) => {
      // Con otra mutación hermana (mismo scope) aún en vuelo, invalidar ahora
      // provocaría un refetch que pisa su escritura optimista; difiere la
      // invalidación a la última en asentarse.
      if (mutationKey) {
        const pending = qc
          .getMutationCache()
          .findAll({ mutationKey, status: 'pending' })
        const mine = scope?.(variables)
        const siblings = scope
          ? pending.filter(
              (m) => scope(m.state.variables as TVariables) === mine,
            )
          : pending
        if (siblings.length > 1) return
      }

      const keys = new Map<string, QueryKey>()
      for (const snapshot of context?.snapshots ?? []) {
        keys.set(JSON.stringify(snapshot.key), snapshot.key)
      }
      for (const key of invalidateOnSettle?.(variables, data) ?? []) {
        keys.set(JSON.stringify(key), key)
      }
      for (const key of keys.values()) {
        void qc.invalidateQueries({ queryKey: key })
      }
    },
  }
}
