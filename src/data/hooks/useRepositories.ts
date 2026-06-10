import { useMutation, useQueryClient } from '@tanstack/react-query'

import {
  buscarBibliografia,
  repos_add_files,
  repos_create,
  repos_delete,
  repos_remove_files,
} from '../api/repositories.api'

import { notify } from '@/lib/toast'

export function useCreateRepository() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: repos_create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['repos'] })
    },
    onError: (err) => {
      notify.error(err, { description: 'No se pudo crear el repositorio.' })
    },
  })
}

export function useDeleteRepository() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: repos_delete,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['repos'] })
    },
    onError: (err) => {
      notify.error(err, { description: 'No se pudo eliminar el repositorio.' })
    },
  })
}

export function useRepoAddFiles() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: repos_add_files,
    onSuccess: (_ok, vars) => {
      qc.invalidateQueries({ queryKey: ['repos', vars.repoId] })
    },
    onError: (err) => {
      notify.error(err, {
        description: 'No se pudieron agregar los archivos al repositorio.',
      })
    },
  })
}

export function useRepoRemoveFiles() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: repos_remove_files,
    onSuccess: (_ok, vars) => {
      qc.invalidateQueries({ queryKey: ['repos', vars.repoId] })
    },
    onError: (err) => {
      notify.error(err, {
        description: 'No se pudieron quitar los archivos del repositorio.',
      })
    },
  })
}

export function useBuscarBibliografia() {
  return useMutation({
    mutationFn: buscarBibliografia,
    onError: (err) => {
      notify.error(err, { description: 'No se pudo buscar la bibliografía.' })
    },
  })
}
