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
import { mk, qk } from '../query/keys'

import { isTempId, makeTempId, optimisticMutation } from '@/lib/optimistic'

export function useFilesList(filters?: { search?: string; limit?: number }) {
  return useQuery({
    queryKey: qk.archivos(filters ?? {}),
    queryFn: () => files_list(filters),
    staleTime: 15_000,
  })
}

export function useUploadOpenAIFile() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: openai_files_upload,
    // Subida a OpenAI/Storage: pending visible, sin optimismo ni reintento.
    meta: { errorMessage: 'No se pudo subir el archivo.', retryable: false },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.archivosRoot() })
    },
  })
}

export function useUploadFile() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: uploadSingleFile,
    // Subida a Storage: pending visible, sin optimismo ni reintento.
    meta: { errorMessage: 'No se pudo subir el archivo.', retryable: false },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.archivosRoot() })
    },
  })
}

export function useDeleteOpenAIFile() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: openai_files_delete,
    ...optimisticMutation<
      { ok: true },
      { archivoId: string; repositorioId: string }
    >({
      queryClient: qc,
      mutationKey: mk.archivoDelete(),
      scope: (vars) => vars.archivoId,
      writes: (vars) => [
        {
          // Prefijo: el archivo desaparece de todas las variantes filtradas.
          key: qk.archivosRoot(),
          updater: (current: unknown, v) =>
            Array.isArray(current)
              ? current.filter((row: any) => row?.id !== v.archivoId)
              : current,
        },
        {
          key: qk.repositorioFiles(vars.repositorioId),
          exact: true,
          // Las filas de repositorio anidan el archivo bajo `archivos`.
          updater: (current: unknown, v) =>
            Array.isArray(current)
              ? current.filter(
                  (row: any) => (row?.archivos?.id ?? row?.id) !== v.archivoId,
                )
              : current,
        },
      ],
      errorMessage: 'No se pudo eliminar el archivo.',
    }),
  })
}

export function useFileSignedUrl() {
  return useMutation({
    mutationFn: files_get_signed_url,
    // Lectura idempotente: segura de reintentar.
    meta: { errorMessage: 'No se pudo abrir el archivo.' },
  })
}

export function useFileDownload() {
  return useMutation({
    mutationFn: files_download,
    // Lectura idempotente: segura de reintentar.
    meta: { errorMessage: 'No se pudo descargar el archivo.' },
  })
}

export function useCreateRepositorio() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: createRepositorio,
    ...optimisticMutation<any, { nombre: string }>({
      queryClient: qc,
      mutationKey: mk.repositorioCreate(),
      writes: (_vars) => [
        {
          key: qk.repositorios(),
          exact: true,
          updater: (current: unknown, v) =>
            Array.isArray(current)
              ? [
                  {
                    id: makeTempId(),
                    nombre: v.nombre,
                    archivos_repositorios: [{ count: 0 }],
                    openai_vector_store_id: null,
                    created_at: new Date().toISOString(),
                    // RepositoryGrid lo pinta como pendiente mientras exista.
                    __optimistic: true,
                  },
                  ...current,
                ]
              : current,
        },
      ],
      // El edge devuelve `{ repositorio, vectorStore }`: sustituye la fila
      // temporal por el registro real antes del refetch de onSettled.
      reconcile: (data, _vars, client) => {
        const repositorio = data?.repositorio
        if (!repositorio?.id) return
        client.setQueryData(qk.repositorios(), (current: unknown) =>
          Array.isArray(current)
            ? current.map((row: any) =>
                isTempId(row?.id)
                  ? {
                      ...repositorio,
                      archivos_repositorios: [{ count: 0 }],
                    }
                  : row,
              )
            : current,
        )
      },
      // Crea un vector store en OpenAI: sin "Reintentar" automático.
      errorMessage: 'No se pudo crear el repositorio.',
      retryable: false,
    }),
  })
}

export function useVectorStoreFiles(vectorStoreId?: string) {
  return useQuery({
    queryKey: qk.vectorStoreFiles(vectorStoreId!),
    queryFn: () => listVectorStoreFiles(vectorStoreId!),
    enabled: !!vectorStoreId,
  })
}

export function useAttachFileToVectorStore() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: attachFileToVectorStore,
    // Estado remoto en OpenAI (vector store): pending visible, sin optimismo
    // ni reintento automático.
    meta: {
      errorMessage: 'No se pudo agregar el archivo al repositorio.',
      retryable: false,
    },
    onSuccess: async (_, variables) => {
      await Promise.all([
        qc.refetchQueries({
          queryKey: qk.repositorioFiles(variables.repositorioId),
        }),
        qc.refetchQueries({
          queryKey: qk.vectorStoreFiles(variables.vectorStoreId),
        }),
        qc.refetchQueries({ queryKey: qk.archivosRoot() }),
      ])
    },
  })
}

export function useVectorStores() {
  return useQuery({
    queryKey: qk.vectorStores(),
    queryFn: listVectorStores,
  })
}

export function useRepositorios() {
  return useQuery({
    queryKey: qk.repositorios(),
    queryFn: async () => {
      const [repositorios, vectorStores] = await Promise.all([
        listRepositorios(),
        listVectorStores().catch(() => []),
      ])
      const vsArray: Array<{ id: string; status: string }> = Array.isArray(
        vectorStores,
      )
        ? vectorStores
        : ((vectorStores as any)?.data ?? [])
      const vsMap = new Map(vsArray.map((vs) => [vs.id, vs.status]))
      return repositorios.map((repo) => ({
        ...repo,
        status: vsMap.get(repo.openai_vector_store_id ?? '') ?? undefined,
      }))
    },
  })
}

export function useInteraccionesRecientes(limit = 12) {
  return useQuery({
    queryKey: qk.interaccionesRecientes(limit),
    queryFn: () => listInteraccionesRecientes(limit),
    staleTime: 30_000,
  })
}

export function useRepositorioFiles(repositorioId?: string) {
  return useQuery({
    queryKey: qk.repositorioFiles(repositorioId!),
    queryFn: () => listRepositorioFiles(repositorioId!),
    enabled: !!repositorioId,
  })
}
