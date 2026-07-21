import { useMutation, useQueryClient } from '@tanstack/react-query'

import {
  buscarBibliografia,
  repos_add_files,
  repos_create,
  repos_delete,
  repos_remove_files,
} from '../api/repositories.api'
import { qk } from '../query/keys'

import { optimisticMutation } from '@/lib/optimistic'

export function useCreateRepository() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: repos_create,
    // Crea un vector store en OpenAI: pending visible, sin optimismo ni
    // reintento automático.
    meta: {
      errorMessage: 'No se pudo crear el repositorio.',
      retryable: false,
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.repositoriosRoot() })
    },
  })
}

export function useDeleteRepository() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: repos_delete,
    ...optimisticMutation<{ ok: true }, { repoId: string }>({
      queryClient: qc,
      scope: (vars) => vars.repoId,
      writes: (_vars) => [
        {
          key: qk.repositorios(),
          exact: true,
          updater: (current: unknown, v) =>
            Array.isArray(current)
              ? current.filter((repo: any) => repo?.id !== v.repoId)
              : current,
        },
      ],
      reconcile: (_ok, vars, client) => {
        client.removeQueries({ queryKey: qk.repositorioFiles(vars.repoId) })
      },
      errorMessage: 'No se pudo eliminar el repositorio.',
    }),
  })
}

export function useRepoAddFiles() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: repos_add_files,
    // Adjunta archivos al vector store de OpenAI: el resultado (estado de
    // indexado) lo produce el proveedor — sin optimismo.
    meta: {
      errorMessage: 'No se pudieron agregar los archivos al repositorio.',
    },
    onSuccess: (_ok, vars) => {
      qc.invalidateQueries({ queryKey: qk.repositorioFiles(vars.repoId) })
      // El conteo de archivos se muestra en la lista de repositorios.
      qc.invalidateQueries({ queryKey: qk.repositorios() })
    },
  })
}

export function useRepoRemoveFiles() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: repos_remove_files,
    ...optimisticMutation<
      { ok: true },
      { repoId: string; openaiFileIds: Array<string> }
    >({
      queryClient: qc,
      scope: (vars) => vars.repoId,
      writes: (vars) => {
        const ids = new Set(vars.openaiFileIds)
        return [
          {
            key: qk.repositorioFiles(vars.repoId),
            exact: true,
            // Las filas anidan el archivo bajo `archivos`.
            updater: (current: unknown) =>
              Array.isArray(current)
                ? current.filter(
                    (row: any) => !ids.has(row?.archivos?.openai_file_id),
                  )
                : current,
          },
        ]
      },
      // El conteo de archivos se muestra en la lista de repositorios.
      invalidateOnSettle: () => [qk.repositorios()],
      errorMessage: 'No se pudieron quitar los archivos del repositorio.',
    }),
  })
}

export function useBuscarBibliografia() {
  return useMutation({
    mutationFn: buscarBibliografia,
    // Búsqueda idempotente: segura de reintentar.
    meta: { errorMessage: 'No se pudo buscar la bibliografía.' },
  })
}
