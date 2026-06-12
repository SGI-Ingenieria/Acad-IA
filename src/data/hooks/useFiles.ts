import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  files_download,
  files_get_signed_url,
  files_list,
  uploadSingleFile,
} from '../api/files.api'
import { listInteraccionesRecientes } from '../api/interaccionesIa.api'
import {
  attachFileToVectorStore,
  createRepositorio,
  listRepositorioFiles,
  listRepositorios,
  listVectorStoreFiles,
  listVectorStores,
  openai_files_delete,
  openai_files_upload,
} from '../api/openaiFiles.api'

import { notify } from '@/lib/toast'

const qkFiles = {
  list: (filters: any) => ['files', 'list', filters] as const,
}

export function useFilesList(filters?: { search?: string; limit?: number }) {
  return useQuery({
    queryKey: qkFiles.list(filters ?? {}),
    queryFn: () => files_list(filters),
    staleTime: 15_000,
  })
}

export function useUploadOpenAIFile() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: openai_files_upload,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['files'] })
    },
    onError: (err) => {
      notify.error(err, { description: 'No se pudo subir el archivo.' })
    },
  })
}

export function useUploadFile() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: uploadSingleFile,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['files'] })
    },
    onError: (err) => {
      notify.error(err, { description: 'No se pudo subir el archivo.' })
    },
  })
}

export function useDeleteOpenAIFile() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: openai_files_delete,
    onMutate: async (vars) => {
      const repoFilesKey = ['repositorio-files', vars.repositorioId]
      await Promise.all([
        qc.cancelQueries({ queryKey: ['files'] }),
        qc.cancelQueries({ queryKey: repoFilesKey }),
      ])

      const prevRepoFiles = qc.getQueryData<Array<any>>(repoFilesKey)
      const prevFiles = qc.getQueriesData<Array<any>>({ queryKey: ['files'] })

      if ((prevRepoFiles?.length ?? 0) > 0) {
        qc.setQueryData<Array<any>>(
          repoFilesKey,
          prevRepoFiles.filter((row: any) => {
            const id = row?.archivos?.id ?? row?.id
            return id !== vars.archivoId
          }),
        )
      }

      for (const [key, data] of prevFiles) {
        if (!Array.isArray(data)) continue
        qc.setQueryData<Array<any>>(
          key,
          data.filter((row: any) => row?.id !== vars.archivoId),
        )
      }

      return { prevRepoFiles, prevFiles, repoFilesKey }
    },
    onError: (err, _vars, context) => {
      const prevRepoFiles = context?.prevRepoFiles ?? []
      const prevFiles = context?.prevFiles ?? []
      const repoFilesKey = context?.repoFilesKey

      if (prevRepoFiles.length > 0) {
        qc.setQueryData(repoFilesKey, prevRepoFiles)
      }
      if (prevFiles.length > 0) {
        for (const [key, data] of prevFiles) {
          qc.setQueryData(key, data)
        }
      }
      notify.error(err, { description: 'No se pudo eliminar el archivo.' })
    },
    onSettled: (_data, _err, vars) => {
      qc.invalidateQueries({ queryKey: ['files'] })
      qc.invalidateQueries({
        queryKey: ['repositorio-files', vars.repositorioId],
      })
    },
  })
}

export function useFileSignedUrl() {
  return useMutation({
    mutationFn: files_get_signed_url,
    onError: (err) => {
      notify.error(err, { description: 'No se pudo abrir el archivo.' })
    },
  })
}

export function useFileDownload() {
  return useMutation({
    mutationFn: files_download,
    onError: (err) => {
      notify.error(err, { description: 'No se pudo descargar el archivo.' })
    },
  })
}

export function useCreateRepositorio() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: createRepositorio,
    onMutate: async (vars) => {
      await qc.cancelQueries({ queryKey: ['repositorios'] })
      const previous = qc.getQueryData<Array<any>>(['repositorios'])
      const tempId = `temp-${Date.now()}`

      if (previous) {
        qc.setQueryData<Array<any>>(
          ['repositorios'],
          [
            {
              id: tempId,
              nombre: vars.nombre,
              archivos_repositorios: [{ count: 0 }],
              openai_vector_store_id: null,
              created_at: new Date().toISOString(),
              __optimistic: true,
            },
            ...previous,
          ],
        )
      }

      return { previous }
    },
    onError: (err, _vars, context) => {
      if (context?.previous) {
        qc.setQueryData(['repositorios'], context.previous)
      }
      notify.error(err, { description: 'No se pudo crear el repositorio.' })
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['repositorios'] })
    },
  })
}

export function useVectorStoreFiles(vectorStoreId?: string) {
  return useQuery({
    queryKey: ['vector-store-files', vectorStoreId],
    queryFn: () => listVectorStoreFiles(vectorStoreId!),
    enabled: !!vectorStoreId,
  })
}

export function useAttachFileToVectorStore() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: attachFileToVectorStore,
    onSuccess: async (_, variables) => {
      await Promise.all([
        qc.refetchQueries({
          queryKey: ['repositorio-files', variables.repositorioId],
        }),
        qc.refetchQueries({
          queryKey: ['vector-store-files', variables.vectorStoreId],
        }),
        qc.refetchQueries({ queryKey: ['files'] }),
      ])
    },
    onError: (err) => {
      notify.error(err, {
        description: 'No se pudo agregar el archivo al repositorio.',
      })
    },
  })
}

export function useVectorStores() {
  return useQuery({
    queryKey: ['vector-stores'],
    queryFn: listVectorStores,
  })
}

export function useRepositorios() {
  return useQuery({
    queryKey: ['repositorios'],
    queryFn: listRepositorios,
  })
}

export function useInteraccionesRecientes(limit = 12) {
  return useQuery({
    queryKey: ['interacciones-recientes', limit],
    queryFn: () => listInteraccionesRecientes(limit),
    staleTime: 30_000,
  })
}

export function useRepositorioFiles(repositorioId?: string) {
  return useQuery({
    queryKey: ['repositorio-files', repositorioId],
    queryFn: () => listRepositorioFiles(repositorioId!),
    enabled: !!repositorioId,
  })
}
