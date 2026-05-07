import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  files_get_signed_url,
  files_list,
  uploadSingleFile,
} from '../api/files.api'
import {
  createRepositorio,
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
  console.log("ando aqui");
  
  return useMutation({
    mutationFn: openai_files_delete,
    onSuccess: () => {
      console.log("aqui2");
      
      qc.invalidateQueries({ queryKey: ['files'] })
      console.log("aqui3");
    },
  })
}

export function useFileSignedUrl() {
  return useMutation({
    mutationFn: files_get_signed_url,
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

