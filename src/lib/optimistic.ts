import type { QueryClient, QueryKey } from '@tanstack/react-query'

type Updater<TData, TVariables> = (
  current: TData | undefined,
  variables: TVariables,
) => TData | undefined

export type OptimisticContext<TData> = {
  previous: TData | undefined
  key: QueryKey
}

type Options<TData, TVariables> = {
  queryClient: QueryClient
  queryKey: QueryKey | ((variables: TVariables) => QueryKey)
  updater: Updater<TData, TVariables>
  /** Extra queryKeys to invalidate on settle (e.g., list + historial). */
  invalidateOnSettle?:
    | Array<QueryKey>
    | ((variables: TVariables) => Array<QueryKey>)
}

/**
 * Returns a `{ onMutate, onError, onSettled }` bundle implementing the standard
 * optimistic-update pattern: cancel in-flight queries, snapshot, apply updater,
 * roll back on error, invalidate on settle.
 *
 * Usage:
 *   useMutation({
 *     mutationFn: doThing,
 *     ...optimisticMutation<Plan, Vars>({
 *       queryClient: qc,
 *       queryKey: (v) => qk.plan(v.id),
 *       updater: (curr, v) => curr ? { ...curr, ...v.patch } : curr,
 *       invalidateOnSettle: (v) => [qk.plan(v.id), ['planes', 'list']],
 *     }),
 *   })
 */
export function optimisticMutation<TData, TVariables>({
  queryClient,
  queryKey,
  updater,
  invalidateOnSettle,
}: Options<TData, TVariables>) {
  const resolveKey = (variables: TVariables): QueryKey =>
    typeof queryKey === 'function' ? queryKey(variables) : queryKey

  const resolveInvalidations = (variables: TVariables): Array<QueryKey> => {
    if (!invalidateOnSettle) return []
    return typeof invalidateOnSettle === 'function'
      ? invalidateOnSettle(variables)
      : invalidateOnSettle
  }

  return {
    onMutate: async (
      variables: TVariables,
    ): Promise<OptimisticContext<TData>> => {
      const key = resolveKey(variables)
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<TData>(key)
      queryClient.setQueryData<TData>(key, (current) =>
        updater(current, variables),
      )
      return { previous, key }
    },

    onError: (
      _error: unknown,
      _variables: TVariables,
      context: OptimisticContext<TData> | undefined,
    ) => {
      if (context && context.previous !== undefined) {
        queryClient.setQueryData(context.key, context.previous)
      }
    },

    onSettled: (
      _data: unknown,
      _error: unknown,
      variables: TVariables,
      context: OptimisticContext<TData> | undefined,
    ) => {
      const keysToInvalidate = [
        context?.key,
        ...resolveInvalidations(variables),
      ].filter((k): k is QueryKey => Array.isArray(k))
      for (const key of keysToInvalidate) {
        queryClient.invalidateQueries({ queryKey: key })
      }
    },
  }
}
