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
  subjects_bibliografia_list,
  subjects_clone_from_existing,
  subjects_create_manual,
  subjects_archived_list,
  subjects_generate_document,
  subjects_get,
  subjects_get_document,
  subjects_get_structure_catalog,
  subjects_history,
  subjects_import_from_file,
  subjects_persist_from_ai,
  subjects_update_bibliografia,
  subjects_update_contenido,
  subjects_update_fields,
} from '../api/subjects.api'
import { qk } from '../query/keys'

import type {
  BibliografiaUpsertInput,
  ContenidoApi,
  SubjectsUpdateFieldsPatch,
} from '../api/subjects.api'
import type { UUID } from '../types/domain'
import type { TablesInsert } from '@/types/supabase'

export function useSubject(subjectId: UUID | null | undefined) {
  return useQuery({
    queryKey: subjectId
      ? qk.asignatura(subjectId)
      : ['asignaturas', 'detail', null],
    queryFn: () => subjects_get(subjectId as UUID),
    enabled: Boolean(subjectId),
  })
}

export function useSubjectBibliografia(subjectId: UUID | null | undefined) {
  return useQuery({
    queryKey: subjectId
      ? qk.asignaturaBibliografia(subjectId)
      : ['asignaturas', 'bibliografia', null],
    queryFn: () => subjects_bibliografia_list(subjectId as UUID),
    enabled: Boolean(subjectId),
  })
}

export function useSubjectHistorial(subjectId: UUID | null | undefined) {
  return useQuery({
    queryKey: subjectId
      ? qk.asignaturaHistorial(subjectId)
      : ['asignaturas', 'historial', null],
    queryFn: () => subjects_history(subjectId as UUID),
    enabled: Boolean(subjectId),
  })
}

export function useSubjectDocumento(subjectId: UUID | null | undefined) {
  return useQuery({
    queryKey: subjectId
      ? qk.asignaturaDocumento(subjectId)
      : ['asignaturas', 'documento', null],
    queryFn: () => subjects_get_document(subjectId as UUID),
    enabled: Boolean(subjectId),
    staleTime: 30_000,
  })
}

export function useSubjectEstructuras() {
  return useQuery({
    queryKey: qk.estructurasAsignatura(),
    queryFn: () => subjects_get_structure_catalog(),
  })
}

export function useArchivedSubjects(planId: UUID | null | undefined) {
  return useQuery({
    queryKey: planId
      ? qk.asignaturasArchivadas(planId)
      : ['asignaturas', 'archivadas', null],
    queryFn: () => subjects_archived_list(planId as UUID),
    enabled: Boolean(planId),
  })
}

/* ------------------ Mutations ------------------ */

export function useCreateSubjectManual() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: (payload: TablesInsert<'asignaturas'>) =>
      subjects_create_manual(payload),
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
  })
}

export function usePersistSubjectFromAI() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: (payload: { planId: UUID; jsonAsignatura: any }) =>
      subjects_persist_from_ai(payload),
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
    mutationFn: (vars: { subjectId: UUID; patch: SubjectsUpdateFieldsPatch }) =>
      subjects_update_fields(vars.subjectId, vars.patch),
    onSuccess: (updated) => {
      qc.setQueryData(qk.asignatura(updated.id), (prev) =>
        prev ? { ...(prev as any), ...(updated as any) } : updated,
      )
      qc.invalidateQueries({
        queryKey: qk.planAsignaturas(updated.plan_estudio_id),
      })
      qc.invalidateQueries({ queryKey: qk.asignaturaHistorial(updated.id) })
    },
  })
}

export function useUpdateSubjectContenido() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: (vars: { subjectId: UUID; unidades: Array<ContenidoApi> }) =>
      subjects_update_contenido(vars.subjectId, vars.unidades),
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
    onSuccess: (_doc, subjectId) => {
      qc.invalidateQueries({ queryKey: qk.asignaturaDocumento(subjectId) })
      qc.invalidateQueries({ queryKey: qk.asignaturaHistorial(subjectId) })
    },
  })
}

export function useUpdateAsignatura() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: (vars: { asignaturaId: UUID; patch: any }) =>
      asignaturas_update(vars.asignaturaId, vars.patch),

    onSuccess: (updated) => {
      // FORZAR actualización de la caché con spread operator para asegurar nueva referencia
      qc.setQueryData(qk.asignatura(updated.id), (prev: any) => ({
        ...prev,
        ...updated,
      }))

      // Invalidar para asegurar sincronización con DB
      qc.invalidateQueries({ queryKey: qk.asignatura(updated.id) })
      qc.invalidateQueries({
        queryKey: qk.planAsignaturas(updated.plan_estudio_id),
      })
    },
  })
}

export function useCreateLinea() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: lineas_insert,
    onSuccess: (nuevaLinea) => {
      qc.invalidateQueries({
        queryKey: ['plan_lineas', nuevaLinea.plan_estudio_id],
      })
    },
  })
}

export function useUpdateLinea() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (vars: { lineaId: string; patch: any }) =>
      lineas_update(vars.lineaId, vars.patch),
    onSuccess: (updated) => {
      qc.invalidateQueries({
        queryKey: ['plan_lineas', updated.plan_estudio_id],
      })
    },
  })
}

export function useCreateBibliografia() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: bibliografia_insert,
    onSuccess: (data) => {
      // USAR LA MISMA LLAVE QUE EL HOOK DE LECTURA
      queryClient.invalidateQueries({
        queryKey: qk.asignaturaBibliografia(data.asignatura_id),
      })
    },
  })
}

export function useUpdateBibliografia(asignaturaId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: any }) =>
      bibliografia_update(id, updates),
    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: qk.asignaturaBibliografia(asignaturaId),
      })
    },
  })
}

export function useDeleteBibliografia(asignaturaId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => bibliografia_delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: qk.asignaturaBibliografia(asignaturaId),
      })
    },
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
        return confirm(mensaje) // Puedes usar un Modal de Shadcn aquí en lugar de confirm
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
