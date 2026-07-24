import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useRef } from 'react'

import {
  documentos_actualizar_coleccion,
  documentos_adjuntar_a_conversacion,
  documentos_agregar_a_coleccion,
  documentos_archivos_conversacion,
  documentos_archivar_coleccion,
  documentos_biblioteca,
  documentos_crear_coleccion,
  documentos_crear_nota,
  documentos_eliminar,
  documentos_listar,
  documentos_quitar_de_coleccion,
  documentos_quitar_de_conversacion,
  documentos_renombrar,
  documentos_subir,
  documentos_warmup_seleccion,
} from '../api/documentos.api'
import { qk } from '../query/keys'

import type {
  BibliotecaReferencias,
  DocumentoArchivo,
  DocumentoReferenciaConversacion,
  FiltrosBiblioteca,
  ProgresoCargaDocumento,
  TipoConversacionDocumental,
} from '../api/documentos.api'

import { notify } from '@/lib/toast'

const optimisticUploadId = (file: File) =>
  `upload:${file.name}:${file.size}:${file.lastModified}`

function updateLibraries(
  queryClient: ReturnType<typeof useQueryClient>,
  updater: (library: BibliotecaReferencias) => BibliotecaReferencias,
) {
  queryClient.setQueriesData<unknown>(
    { queryKey: qk.documentosRoot() },
    (library: unknown) =>
      library &&
      typeof library === 'object' &&
      'files' in library &&
      Array.isArray(library.files) &&
      'collections' in library &&
      Array.isArray(library.collections)
        ? updater(library as BibliotecaReferencias)
        : library,
  )
}

function snapshotLibraries(queryClient: ReturnType<typeof useQueryClient>) {
  return queryClient.getQueriesData({ queryKey: qk.documentosRoot() })
}

function restoreLibraries(
  queryClient: ReturnType<typeof useQueryClient>,
  snapshots: ReturnType<typeof snapshotLibraries> | undefined,
) {
  snapshots?.forEach(([queryKey, value]) =>
    queryClient.setQueryData(queryKey, value),
  )
}

export function useDocumentos() {
  return useQuery({
    queryKey: qk.documentos(),
    queryFn: documentos_listar,
    staleTime: 10_000,
  })
}

export function useSubirDocumento(
  options: {
    onProgress?: (file: File, progress: ProgresoCargaDocumento) => void
  } = {},
) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (file: File) =>
      documentos_subir(file, {
        onProgress: (progress) => {
          options.onProgress?.(file, progress)
          const id = optimisticUploadId(file)
          updateLibraries(queryClient, (library) => ({
            ...library,
            files: library.files.map((item) =>
              item.id === id
                ? { ...item, uploadProgress: progress.percentage }
                : item,
            ),
          }))
        },
      }),
    onMutate: async (file) => {
      await queryClient.cancelQueries({ queryKey: qk.documentosRoot() })
      const id = optimisticUploadId(file)
      const optimistic: DocumentoArchivo = {
        id,
        display_name: file.name,
        description: null,
        status: 'uploading',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        current_version_id: null,
        uploadProgress: 0,
        localFile: file,
      }
      updateLibraries(queryClient, (library) => ({
        ...library,
        files: [optimistic, ...library.files.filter((item) => item.id !== id)],
      }))
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qk.documentosRoot() })
    },
    onError: (error, file) => {
      const id = optimisticUploadId(file)
      updateLibraries(queryClient, (library) => ({
        ...library,
        files: library.files.map((item) =>
          item.id === id
            ? {
                ...item,
                status: 'failed',
                uploadError:
                  error instanceof Error ? error.message : 'No se pudo subir.',
              }
            : item,
        ),
      }))
      notify.error(error, { description: 'No se pudo subir el documento.' })
    },
  })
}

export function useBibliotecaReferencias(filters: FiltrosBiblioteca = {}) {
  return useQuery({
    queryKey: qk.bibliotecaReferencias(filters),
    queryFn: () => documentos_biblioteca(filters),
    staleTime: 10_000,
  })
}

export function useCrearColeccion() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: documentos_crear_coleccion,
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: qk.documentosRoot() })
      const snapshots = snapshotLibraries(queryClient)
      const now = new Date().toISOString()
      updateLibraries(queryClient, (library) => ({
        ...library,
        collections: [
          {
            id: `pending:${crypto.randomUUID()}`,
            name: input.name,
            description: input.description ?? null,
            kind: input.kind ?? 'collection',
            status: 'active',
            created_by: 'pending',
            created_at: now,
            updated_at: now,
            canManage: true,
            fileIds: [],
          },
          ...library.collections,
        ],
      }))
      return { snapshots }
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: qk.documentosRoot() }),
    onError: (error, _input, context) => {
      restoreLibraries(queryClient, context?.snapshots)
      notify.error(error, { description: 'No se pudo crear la colección.' })
    },
  })
}

export function useActualizarColeccion() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: documentos_actualizar_coleccion,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: qk.documentosRoot() }),
    onError: (error) =>
      notify.error(error, {
        description: 'No se pudo actualizar la colección.',
      }),
  })
}

export function useArchivarColeccion() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: documentos_archivar_coleccion,
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: qk.documentosRoot() })
      const snapshots = snapshotLibraries(queryClient)
      updateLibraries(queryClient, (library) => ({
        ...library,
        collections: library.collections.filter(
          (collection) => collection.id !== id,
        ),
      }))
      return { snapshots }
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: qk.documentosRoot() }),
    onError: (error, _id, context) => {
      restoreLibraries(queryClient, context?.snapshots)
      notify.error(error, { description: 'No se pudo archivar la colección.' })
    },
  })
}

export function useAgregarDocumentoAColeccion() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: documentos_agregar_a_coleccion,
    onMutate: async ({ collectionId, fileId }) => {
      await queryClient.cancelQueries({ queryKey: qk.documentosRoot() })
      const snapshots = snapshotLibraries(queryClient)
      updateLibraries(queryClient, (library) => ({
        ...library,
        collections: library.collections.map((collection) =>
          collection.id === collectionId
            ? {
                ...collection,
                fileIds: Array.from(new Set([...collection.fileIds, fileId])),
              }
            : collection,
        ),
      }))
      return { snapshots }
    },
    onError: (error, _input, context) => {
      restoreLibraries(queryClient, context?.snapshots)
      notify.error(error, { description: 'No se pudo mover el documento.' })
    },
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: qk.documentosRoot() }),
  })
}

export function useQuitarDocumentoDeColeccion() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: documentos_quitar_de_coleccion,
    onMutate: async ({ collectionId, fileId }) => {
      await queryClient.cancelQueries({ queryKey: qk.documentosRoot() })
      const snapshots = snapshotLibraries(queryClient)
      updateLibraries(queryClient, (library) => ({
        ...library,
        collections: library.collections.map((collection) =>
          collection.id === collectionId
            ? {
                ...collection,
                fileIds: collection.fileIds.filter((id) => id !== fileId),
              }
            : collection,
        ),
      }))
      return { snapshots }
    },
    onError: (error, _input, context) => {
      restoreLibraries(queryClient, context?.snapshots)
      notify.error(error, { description: 'No se pudo retirar el documento.' })
    },
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: qk.documentosRoot() }),
  })
}

export function useCrearNota() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { titulo: string; contenido: string }) =>
      documentos_crear_nota(input),
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: qk.documentosRoot() })
      const snapshots = snapshotLibraries(queryClient)
      const now = new Date().toISOString()
      const optimistic: DocumentoArchivo = {
        id: `pending:${crypto.randomUUID()}`,
        display_name: `${input.titulo.trim() || 'Nota'}.md`,
        description: null,
        status: 'uploading',
        source: 'note',
        detected_mime: 'text/markdown',
        size_bytes: input.contenido.length,
        created_at: now,
        updated_at: now,
        current_version_id: null,
      }
      updateLibraries(queryClient, (library) => ({
        ...library,
        files: [optimistic, ...library.files],
      }))
      return { snapshots }
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: qk.documentosRoot() }),
    onError: (error, _input, context) => {
      restoreLibraries(queryClient, context?.snapshots)
      notify.error(error, { description: 'No se pudo guardar la nota.' })
    },
  })
}

export function useRenombrarDocumento() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: documentos_renombrar,
    onMutate: async ({ fileId, displayName }) => {
      await queryClient.cancelQueries({ queryKey: qk.documentosRoot() })
      const snapshots = snapshotLibraries(queryClient)
      updateLibraries(queryClient, (library) => ({
        ...library,
        files: library.files.map((item) =>
          item.id === fileId ? { ...item, display_name: displayName } : item,
        ),
      }))
      return { snapshots }
    },
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: qk.documentosRoot() }),
    onError: (error, _input, context) => {
      restoreLibraries(queryClient, context?.snapshots)
      notify.error(error, { description: 'No se pudo renombrar el archivo.' })
    },
  })
}

/**
 * Pre-calentamiento silencioso de la selección de referencias del picker.
 * Seleccionar archivos es una señal de intención: cuando el usuario confirme
 * la generación, lo normal es que sus referencias ya estén preparadas.
 * Fire-and-forget: sin toasts, sin estados visibles, sin reintentos.
 */
export function useWarmupReferencias(seleccion: {
  fileIds: Array<string>
  collectionIds: Array<string>
}) {
  const key = useMemo(
    () =>
      JSON.stringify([
        [...seleccion.fileIds].sort(),
        [...seleccion.collectionIds].sort(),
      ]),
    [seleccion.fileIds, seleccion.collectionIds],
  )
  const lastSent = useRef<string>('')

  useEffect(() => {
    if (!seleccion.fileIds.length && !seleccion.collectionIds.length) return
    if (lastSent.current === key) return
    const timeout = setTimeout(() => {
      lastSent.current = key
      void documentos_warmup_seleccion({
        fileIds: seleccion.fileIds,
        collectionIds: seleccion.collectionIds,
      }).catch(() => {
        // Mejor esfuerzo: la cascada de generación cubre cualquier fallo.
      })
    }, 800)
    return () => clearTimeout(timeout)
    // `key` captura el contenido de la selección de forma estable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
}

export function useEliminarDocumento() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: documentos_eliminar,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: qk.documentosRoot() }),
    onError: (error) =>
      notify.error(error, { description: 'No se pudo eliminar el documento.' }),
  })
}

export function useArchivosConversacion(
  conversationType: TipoConversacionDocumental,
  conversationId?: string,
) {
  return useQuery({
    queryKey: qk.archivosConversacion(conversationType, conversationId),
    queryFn: () =>
      documentos_archivos_conversacion({
        conversationType,
        conversationId: conversationId!,
      }),
    enabled: Boolean(conversationId),
    staleTime: 15_000,
  })
}

export function useAdjuntarArchivoConversacion() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: documentos_adjuntar_a_conversacion,
    onMutate: async (input) => {
      const queryKey = qk.archivosConversacion(
        input.conversationType,
        input.conversationId,
      )
      await queryClient.cancelQueries({ queryKey })
      const previous =
        queryClient.getQueryData<Array<DocumentoReferenciaConversacion>>(
          queryKey,
        )
      queryClient.setQueryData<Array<DocumentoReferenciaConversacion>>(
        queryKey,
        (current = []) =>
          current.some((reference) => reference.fileId === input.fileId)
            ? current
            : [
                ...current,
                {
                  fileId: input.fileId,
                  addedAt: new Date().toISOString(),
                  active: true,
                  used: false,
                  firstUsedAt: null,
                  canRemove: true,
                },
              ],
      )
      return { queryKey, previous }
    },
    onError: (error, _input, context) => {
      if (context) queryClient.setQueryData(context.queryKey, context.previous)
      notify.error(error, {
        description: 'No se pudo añadir el archivo al chat.',
      })
    },
    onSettled: (_data, _error, input) =>
      queryClient.invalidateQueries({
        queryKey: qk.archivosConversacion(
          input.conversationType,
          input.conversationId,
        ),
      }),
  })
}

export function useQuitarArchivoConversacion() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: documentos_quitar_de_conversacion,
    onMutate: async (input) => {
      const queryKey = qk.archivosConversacion(
        input.conversationType,
        input.conversationId,
      )
      await queryClient.cancelQueries({ queryKey })
      const previous =
        queryClient.getQueryData<Array<DocumentoReferenciaConversacion>>(
          queryKey,
        )
      queryClient.setQueryData<Array<DocumentoReferenciaConversacion>>(
        queryKey,
        (current = []) =>
          current.filter((reference) => reference.fileId !== input.fileId),
      )
      return { queryKey, previous }
    },
    onError: (error, _input, context) => {
      if (context) queryClient.setQueryData(context.queryKey, context.previous)
      notify.error(error, {
        description: 'No se pudo quitar el archivo del chat.',
      })
    },
    onSettled: (_data, _error, input) =>
      queryClient.invalidateQueries({
        queryKey: qk.archivosConversacion(
          input.conversationType,
          input.conversationId,
        ),
      }),
  })
}
