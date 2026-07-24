import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'

import {
  ai_generate_subject,
  asignaturas_update,
  bibliografia_delete,
  bibliografia_insert,
  bibliografia_update,
  checkPrerrequisitoConflicts,
  lineas_insert,
  lineas_update,
  subjects_clone_from_existing,
  subjects_create_manual,
  subjects_generate_document,
  subjects_get_structure_catalog,
  subjects_import_from_file,
  subjects_persist_from_ai,
  subjects_restore_history_value,
  subjects_update_bibliografia,
  subjects_update_contenido,
  subjects_update_fields,
} from '../api/subjects.api'
import { mk, qk } from '../query/keys'
import {
  catalogoAsignaturasOptions,
  subjectBibliografiaOptions,
  subjectDocumentoOptions,
  subjectHistorialOptions,
  subjectOptions,
} from '../query/queryOptions'

import type {
  BibliografiaUpsertInput,
  CatalogoAsignaturasFilters,
  ContenidoApi,
  SubjectsRestoreHistoryValueInput,
  SubjectsUpdateFieldsPatch,
} from '../api/subjects.api'
import type { UUID } from '../types/domain'
import type { TablesInsert } from '@/types/supabase'

import { showAppConfirm } from '@/components/ui/app-alert-dialog'
import { isTempId, makeTempId, optimisticMutation } from '@/lib/optimistic'

export function useSubject(subjectId: UUID | null | undefined) {
  return useQuery({
    ...subjectOptions(subjectId as UUID),
    enabled: Boolean(subjectId),
  })
}

export function useCatalogoAsignaturas(filters: CatalogoAsignaturasFilters) {
  return useQuery(catalogoAsignaturasOptions(filters))
}

export function useSubjectBibliografia(subjectId: UUID | null | undefined) {
  return useQuery({
    ...subjectBibliografiaOptions(subjectId as UUID),
    enabled: Boolean(subjectId),
  })
}

export function useSubjectHistorial(subjectId: UUID | null | undefined) {
  return useQuery({
    ...subjectHistorialOptions(subjectId as UUID),
    enabled: Boolean(subjectId),
  })
}

export function useSubjectDocumento(subjectId: UUID | null | undefined) {
  return useQuery({
    ...subjectDocumentoOptions(subjectId as UUID),
    enabled: Boolean(subjectId),
  })
}

export function useSubjectEstructuras(estructuraPlanId?: UUID | null) {
  return useQuery({
    queryKey: qk.estructurasAsignatura(estructuraPlanId ?? null),
    queryFn: () => subjects_get_structure_catalog({ estructuraPlanId }),
  })
}

/* ------------------ Mutations ------------------ */

export function useCreateSubjectManual() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: (
      payload: TablesInsert<'asignaturas'> & {
        adminOverrideReason?: string | null
      },
    ) => {
      const { adminOverrideReason, ...subjectPayload } = payload
      return subjects_create_manual(subjectPayload, adminOverrideReason)
    },
    // El wizard notifica éxito/fracaso con sus propios toasts.
    meta: { errorMessage: false },
    onSuccess: (subject) => {
      qc.setQueryData(qk.asignatura(subject.id), subject)
      qc.invalidateQueries({
        queryKey: qk.planAsignaturas(subject.plan_estudio_id),
      })
      qc.invalidateQueries({
        queryKey: qk.planHistorial(subject.plan_estudio_id),
      })
    },
  })
}

export function useGenerateSubjectAI() {
  return useMutation({
    mutationFn: ai_generate_subject,
    // Flujo durable de IA: el wizard y el watcher gestionan los avisos.
    meta: { errorMessage: false },
  })
}

export function usePersistSubjectFromAI() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: (payload: { planId: UUID; jsonAsignatura: any }) =>
      subjects_persist_from_ai(payload),
    meta: {
      errorMessage: 'No se pudo guardar la asignatura generada por IA.',
      retryable: false,
    },
    onSuccess: (subject) => {
      qc.setQueryData(qk.asignatura(subject.id), subject)
      qc.invalidateQueries({
        queryKey: qk.planAsignaturas(subject.plan_estudio_id),
      })
      qc.invalidateQueries({
        queryKey: qk.planHistorial(subject.plan_estudio_id),
      })
    },
  })
}

export function useCloneSubject() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: subjects_clone_from_existing,
    // El wizard notifica éxito/fracaso con sus propios toasts.
    meta: { errorMessage: false },
    onSuccess: (subject) => {
      qc.setQueryData(qk.asignatura(subject.id), subject)
      qc.invalidateQueries({
        queryKey: qk.planAsignaturas(subject.plan_estudio_id),
      })
      qc.invalidateQueries({
        queryKey: qk.planHistorial(subject.plan_estudio_id),
      })
    },
  })
}

export function useImportSubjectFromFile() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: subjects_import_from_file,
    // El wizard notifica éxito/fracaso con sus propios toasts.
    meta: { errorMessage: false },
    onSuccess: (subject) => {
      qc.setQueryData(qk.asignatura(subject.id), subject)
      qc.invalidateQueries({
        queryKey: qk.planAsignaturas(subject.plan_estudio_id),
      })
      qc.invalidateQueries({
        queryKey: qk.planHistorial(subject.plan_estudio_id),
      })
    },
  })
}

export function useUpdateSubjectFields() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: (vars: {
      subjectId: UUID
      patch: SubjectsUpdateFieldsPatch
      adminOverrideReason?: string | null
    }) =>
      subjects_update_fields(
        vars.subjectId,
        vars.patch,
        vars.adminOverrideReason,
      ),
    ...optimisticMutation<
      Awaited<ReturnType<typeof subjects_update_fields>>,
      {
        subjectId: UUID
        patch: SubjectsUpdateFieldsPatch
        adminOverrideReason?: string | null
      }
    >({
      queryClient: qc,
      mutationKey: mk.subjectFields(),
      scope: (vars) => vars.subjectId,
      writes: (vars) => [
        {
          key: qk.asignatura(vars.subjectId),
          exact: true,
          updater: (current: any, v) => {
            if (!current) return current
            const patch = v.patch as any
            return {
              ...current,
              ...patch,
              datos: patch.datos
                ? { ...(current.datos ?? {}), ...patch.datos }
                : current.datos,
            }
          },
        },
      ],
      reconcile: (updated, _vars, client) => {
        client.setQueryData(qk.asignatura(updated.id), (prev) =>
          prev ? { ...(prev as any), ...(updated as any) } : updated,
        )
      },
      invalidateOnSettle: (vars, updated) => [
        qk.asignaturaHistorial(vars.subjectId),
        ...(updated
          ? [
              qk.planAsignaturas(updated.plan_estudio_id),
              qk.planHistorial(updated.plan_estudio_id),
            ]
          : []),
      ],
      errorMessage: 'No se pudieron guardar los cambios de la asignatura.',
    }),
  })
}

export function useRestoreSubjectHistoryValue() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: (input: SubjectsRestoreHistoryValueInput) =>
      subjects_restore_history_value(input),
    // El resultado lo computa el servidor a partir del historial: sin optimismo.
    meta: {
      errorMessage: 'No se pudo restaurar esa versión de la asignatura.',
    },
    onSuccess: (updated) => {
      qc.setQueryData(qk.asignatura(updated.id), (prev) =>
        prev ? { ...(prev as any), ...(updated as any) } : updated,
      )
      qc.invalidateQueries({ queryKey: qk.asignaturaHistorial(updated.id) })
      qc.invalidateQueries({
        queryKey: qk.planAsignaturas(updated.plan_estudio_id),
      })
      qc.invalidateQueries({
        queryKey: qk.planHistorial(updated.plan_estudio_id),
      })
    },
  })
}

export function useUpdateSubjectContenido() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: (vars: {
      subjectId: UUID
      unidades: Array<ContenidoApi>
      adminOverrideReason?: string | null
    }) =>
      subjects_update_contenido(
        vars.subjectId,
        vars.unidades,
        vars.adminOverrideReason,
      ),
    // El servidor normaliza y renumera las unidades: el editor mantiene su
    // propio estado mientras tanto, así que aquí basta el write-through.
    meta: { errorMessage: 'No se pudo guardar el contenido temático.' },
    onSuccess: (updated) => {
      qc.setQueryData(qk.asignatura(updated.id), (prev) =>
        prev ? { ...(prev as any), ...(updated as any) } : updated,
      )

      qc.invalidateQueries({
        queryKey: qk.planAsignaturas(updated.plan_estudio_id),
      })
      qc.invalidateQueries({
        queryKey: qk.planHistorial(updated.plan_estudio_id),
      })
      qc.invalidateQueries({ queryKey: qk.asignaturaHistorial(updated.id) })
    },
  })
}

export function useUpdateSubjectBibliografia() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: (vars: { subjectId: UUID; entries: BibliografiaUpsertInput }) =>
      subjects_update_bibliografia(vars.subjectId, vars.entries),
    // Upsert masivo cuyo resultado transforma el servidor: sin optimismo.
    meta: { errorMessage: 'No se pudo guardar la bibliografía.' },
    onSuccess: (_ok, vars) => {
      qc.invalidateQueries({
        queryKey: qk.asignaturaBibliografia(vars.subjectId),
      })
      qc.invalidateQueries({ queryKey: qk.asignaturaHistorial(vars.subjectId) })
    },
  })
}

export function useGenerateSubjectDocumento() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: (subjectId: UUID) => subjects_generate_document(subjectId),
    // El documento lo produce el servidor: pending visible, sin optimismo.
    meta: { errorMessage: 'No se pudo generar el documento.' },
    onSuccess: (_doc, subjectId) => {
      qc.invalidateQueries({ queryKey: qk.asignaturaDocumento(subjectId) })
      qc.invalidateQueries({ queryKey: qk.asignaturaHistorial(subjectId) })
    },
  })
}

type UpdateAsignaturaVars = {
  asignaturaId: UUID
  patch: any
  adminOverrideReason?: string | null
}

export function useUpdateAsignatura() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: (vars: UpdateAsignaturaVars) =>
      asignaturas_update(
        vars.asignaturaId,
        vars.patch,
        vars.adminOverrideReason,
      ),
    ...optimisticMutation<
      Awaited<ReturnType<typeof asignaturas_update>>,
      UpdateAsignaturaVars
    >({
      queryClient: qc,
      mutationKey: mk.asignaturaUpdate(),
      scope: (vars) => vars.asignaturaId,
      writes: (vars) => {
        const detail: any = qc.getQueryData(qk.asignatura(vars.asignaturaId))
        const planId: string | undefined =
          vars.patch?.plan_estudio_id ?? detail?.plan_estudio_id
        return [
          {
            key: qk.asignatura(vars.asignaturaId),
            exact: true,
            updater: (current: any, v) =>
              current ? { ...current, ...v.patch } : current,
          },
          // El mapa y la tabla del plan leen planAsignaturas: mover/archivar
          // también debe reflejarse ahí al instante.
          ...(planId
            ? [
                {
                  key: qk.planAsignaturas(planId),
                  exact: true,
                  updater: (current: any, v: UpdateAsignaturaVars) => {
                    if (!Array.isArray(current)) return current
                    const archivada = v.patch?.estado === 'archivada'
                    if (archivada) {
                      return current.filter((a: any) => a.id !== v.asignaturaId)
                    }
                    return current.map((a: any) =>
                      a.id === v.asignaturaId ? { ...a, ...v.patch } : a,
                    )
                  },
                },
              ]
            : []),
        ]
      },
      reconcile: (updated, _vars, client) => {
        client.setQueryData(qk.asignatura(updated.id), (prev: any) => ({
          ...prev,
          ...updated,
        }))
      },
      invalidateOnSettle: (vars, updated) => [
        qk.asignatura(vars.asignaturaId),
        ...(updated
          ? [
              qk.planAsignaturas(updated.plan_estudio_id),
              qk.planHistorial(updated.plan_estudio_id),
            ]
          : []),
      ],
      errorMessage: 'No se pudo actualizar la asignatura.',
    }),
  })
}

export function useCreateLinea() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: lineas_insert,
    ...optimisticMutation<
      Awaited<ReturnType<typeof lineas_insert>>,
      Parameters<typeof lineas_insert>[0]
    >({
      queryClient: qc,
      mutationKey: mk.lineaCreate(),
      scope: (vars) => vars.plan_estudio_id,
      writes: (vars) => [
        {
          key: qk.planLineas(vars.plan_estudio_id),
          exact: true,
          updater: (current: any, v) =>
            Array.isArray(current)
              ? [...current, { ...v, id: makeTempId() }]
              : current,
        },
      ],
      reconcile: (nuevaLinea, vars, client) => {
        client.setQueryData(
          qk.planLineas(vars.plan_estudio_id),
          (current: any) =>
            Array.isArray(current)
              ? current.map((l: any) => (isTempId(l.id) ? nuevaLinea : l))
              : current,
        )
      },
      errorMessage: 'No se pudo crear la línea.',
    }),
  })
}

export function useUpdateLinea() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (vars: { lineaId: string; patch: any }) =>
      lineas_update(vars.lineaId, vars.patch),
    // El planId no viaja en las variables: el mapa ya refleja el cambio en su
    // estado local y aquí basta invalidar con la respuesta del servidor.
    meta: { errorMessage: 'No se pudo actualizar la línea.' },
    onSuccess: (updated) => {
      qc.invalidateQueries({
        queryKey: qk.planLineas(updated.plan_estudio_id),
      })
    },
  })
}

export function useCreateBibliografia() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (
      entry: TablesInsert<'bibliografia_asignatura'> & {
        adminOverrideReason?: string | null
      },
    ) => {
      const { adminOverrideReason, ...bibliografiaEntry } = entry
      return bibliografia_insert(bibliografiaEntry, adminOverrideReason)
    },
    ...optimisticMutation<
      Awaited<ReturnType<typeof bibliografia_insert>>,
      TablesInsert<'bibliografia_asignatura'> & {
        adminOverrideReason?: string | null
      }
    >({
      queryClient: qc,
      mutationKey: mk.bibliografiaCreate(),
      scope: (entry) => entry.asignatura_id,
      writes: (entry) => [
        {
          key: qk.asignaturaBibliografia(entry.asignatura_id),
          exact: true,
          updater: (current: any, e) => {
            if (!Array.isArray(current)) return current
            const { adminOverrideReason: _omit, ...row } = e
            return [...current, { ...row, id: makeTempId() }]
          },
        },
      ],
      reconcile: (data, entry, client) => {
        client.setQueryData(
          qk.asignaturaBibliografia(entry.asignatura_id),
          (current: any) =>
            Array.isArray(current)
              ? current.map((row: any) => (isTempId(row.id) ? data : row))
              : current,
        )
      },
      invalidateOnSettle: (entry) => [
        qk.asignaturaHistorial(entry.asignatura_id),
      ],
      errorMessage: 'No se pudo agregar la entrada bibliográfica.',
    }),
  })
}

export function useUpdateBibliografia(asignaturaId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      updates,
      adminOverrideReason,
    }: {
      id: string
      updates: any
      adminOverrideReason?: string | null
    }) => bibliografia_update(id, updates, adminOverrideReason),
    ...optimisticMutation<
      unknown,
      { id: string; updates: any; adminOverrideReason?: string | null }
    >({
      queryClient: qc,
      mutationKey: mk.bibliografiaUpdate(),
      scope: (vars) => vars.id,
      writes: () => [
        {
          key: qk.asignaturaBibliografia(asignaturaId),
          exact: true,
          updater: (current: any, v) =>
            Array.isArray(current)
              ? current.map((row: any) =>
                  row.id === v.id ? { ...row, ...v.updates } : row,
                )
              : current,
        },
      ],
      errorMessage: 'No se pudo actualizar la bibliografía.',
    }),
  })
}

export function useDeleteBibliografia(asignaturaId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (
      vars:
        | string
        | {
            id: string
            adminOverrideReason?: string | null
          },
    ) =>
      bibliografia_delete(
        typeof vars === 'string' ? vars : vars.id,
        typeof vars === 'string' ? null : vars.adminOverrideReason,
      ),
    ...optimisticMutation<
      unknown,
      string | { id: string; adminOverrideReason?: string | null }
    >({
      queryClient: qc,
      mutationKey: mk.bibliografiaDelete(),
      scope: (vars) => (typeof vars === 'string' ? vars : vars.id),
      writes: () => [
        {
          key: qk.asignaturaBibliografia(asignaturaId),
          exact: true,
          updater: (current: any, v) => {
            const entryId = typeof v === 'string' ? v : v.id
            return Array.isArray(current)
              ? current.filter((entry: any) => entry.id !== entryId)
              : current
          },
        },
      ],
      errorMessage: 'No se pudo eliminar la entrada bibliográfica.',
    }),
  })
}

export function useAsignaturaConflictos() {
  const [isValidating, setIsValidating] = useState(false)

  const validarCambioCiclo = async (
    asignaturaId: string,
    nuevoCiclo: number,
  ) => {
    setIsValidating(true)
    try {
      const nombresConflictivos = await checkPrerrequisitoConflicts(
        asignaturaId,
        nuevoCiclo,
      )

      if (nombresConflictivos.length > 0) {
        const mensaje = `Si mueves esta materia al ciclo ${nuevoCiclo}, se perderá la seriación con:\n\n• ${nombresConflictivos.join('\n• ')}\n\n¿Deseas continuar?`
        return showAppConfirm({
          title: 'Confirmar cambio de ciclo',
          description: mensaje,
          confirmLabel: 'Continuar',
          variant: 'destructive',
        })
      }

      return true // Sin conflictos
    } catch (error) {
      console.error(error)
      return false
    } finally {
      setIsValidating(false)
    }
  }

  return { validarCambioCiclo, isValidating }
}
