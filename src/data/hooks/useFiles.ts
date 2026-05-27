import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  files_download,
  files_get_signed_url,
  files_list,
  uploadSingleFile,
} from '../api/files.api'
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
  })
}

export function useUploadFile() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: uploadSingleFile,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['files'] })
    },
  })
}

export function useDeleteOpenAIFile() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: openai_files_delete,

    onSuccess: (_, variables) => {
      qc.invalidateQueries({
        queryKey: ['files'],
      })

      qc.invalidateQueries({
        queryKey: ['repositorio-files', variables.repositorioId],
      })
    },
  })
}

export function useFileSignedUrl() {
  return useMutation({
    mutationFn: files_get_signed_url,
  })
}

export function useFileDownload() {
  return useMutation({
    mutationFn: files_download,
  })
}

export function useCreateRepositorio() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: createRepositorio,
    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: ['repositorios'],
      })
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
      await qc.refetchQueries({
        queryKey: ['repositorio-files', variables.repositorioId],
      })

      await qc.refetchQueries({
        queryKey: ['vector-store-files', variables.vectorStoreId],
      })

      await qc.refetchQueries({
        queryKey: ['files'],
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

export function useRepositorioFiles(repositorioId?: string) {
  return useQuery({
    queryKey: ['repositorio-files', repositorioId],
    queryFn: () => listRepositorioFiles(repositorioId!),
    enabled: !!repositorioId,
  })
}
