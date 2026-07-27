import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { useState } from 'react'

import {
  ai_generate_subject,
  asignaturas_update,
  bibliografia_delete,
  bibliografia_insert,
  bibliografia_update,
  checkPrerrequisitoConflicts,
  generate_subject_suggestions,
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
import {
  serializeGenerationDraft,
  watchSubjectGeneration,
} from '../realtime/watchAIGeneration'

import type {
  AISubjectUnifiedInput,
  AsignaturaDetail,
  BibliografiaUpsertInput,
  CatalogoAsignaturasFilters,
  ContenidoApi,
  SubjectsRestoreHistoryValueInput,
  SubjectsUpdateFieldsPatch,
  SugerenciaAsignatura,
} from '../api/subjects.api'
import type {
  Asignatura,
  CatalogoAsignaturaRow,
  Paged,
  PlanEstudio,
  UUID,
} from '../types/domain'
import type { TablesInsert } from '@/types/supabase'

import { showAppConfirm } from '@/components/ui/app-alert-dialog'
import { calcularCreditos } from '@/lib/creditos-utils'
import { isTempId, makeTempId, optimisticMutation } from '@/lib/optimistic'

/**
 * Recupera una vista previa de la asignatura desde cualquiera de las listas que
 * ya la mostró. Es deliberadamente `placeholderData`: la fila parcial no se
 * persiste como detalle canónico y `subjects_get` sigue actualizándola en
 * segundo plano.
 */
function subjectDeAlgunaLista(
  qc: ReturnType<typeof useQueryClient>,
  subjectId: UUID | null | undefined,
): AsignaturaDetail | undefined {
  if (!subjectId) return undefined

  const planQueries = qc.getQueryCache().findAll({
    predicate: ({ queryKey }) =>
      queryKey.length >= 3 &&
      queryKey[0] === 'planes' &&
      queryKey[2] === 'asignaturas',
  })

  for (const query of planQueries) {
    const asignatura = (
      query.state.data as Array<Asignatura> | undefined
    )?.find((item) => item.id === subjectId)
    if (!asignatura) continue

    const planId = asignatura.plan_estudio_id
    const plan = qc.getQueryData<PlanEstudio>(qk.plan(planId))
    const preview = {
      ...asignatura,
      contenido_tematico: asignatura.contenido_tematico as
        | AsignaturaDetail['contenido_tematico']
        | null,
      planes_estudio: plan ?? null,
      estructuras_asignatura: null,
    }

    return preview
  }

  for (const [, page] of qc.getQueriesData<Paged<CatalogoAsignaturaRow>>({
    queryKey: qk.catalogoAsignaturasRoot(),
  })) {
    const row = page?.data.find((item) => item.asignatura_id === subjectId)
    if (!row) continue

    // El RPC del catálogo contiene todos los datos visibles del encabezado,
    // aunque no el documento completo. Los campos restantes solo sostienen el
    // layout durante la petición real y nunca llegan a la caché del detalle.
    const preview = {
      id: row.asignatura_id,
      plan_estudio_id: row.plan_estudio_id,
      estructura_id: null,
      codigo: row.codigo,
      nombre: row.nombre,
      tipo: row.tipo,
      creditos: row.creditos,
      numero_ciclo: row.numero_ciclo,
      linea_plan_id: null,
      orden_celda: null,
      estado: row.estado,
      datos: null,
      contenido_tematico: null,
      horas_academicas: 0,
      horas_independientes: 0,
      asignatura_hash: null,
      tipo_origen: null,
      meta_origen: null,
      creado_por: null,
      actualizado_por: null,
      creado_en: '',
      actualizado_en: '',
      criterios_de_evaluacion: null,
      prerrequisito_asignatura_id: null,
      planes_estudio: {
        id: row.plan_estudio_id,
        carrera_id: row.carrera_id,
        estructura_id: null,
        nombre: row.plan_nombre,
        nombre_display: row.plan_nombre,
        tipo_ciclo: row.plan_tipo_ciclo,
        numero_ciclos: null,
        datos: null,
        estado_actual_id: null,
        activo: true,
        tipo_origen: null,
        meta_origen: null,
        creado_por: null,
        actualizado_por: null,
        creado_en: '',
        actualizado_en: '',
        carreras: {
          id: row.carrera_id,
          facultad_id: row.facultad_id,
          nombre: row.carrera_nombre,
          nombre_corto: null,
          clave_sep: null,
          activa: true,
          nivel: row.carrera_nivel,
          facultades: {
            id: row.facultad_id,
            nombre: row.facultad_nombre,
            nombre_corto: row.facultad_nombre_corto,
            color: row.facultad_color,
            icono: row.facultad_icono,
          },
        },
      },
      estructuras_asignatura: null,
    }

    return preview as unknown as AsignaturaDetail
  }

  return undefined
}

export function useSubject(subjectId: UUID | null | undefined) {
  const qc = useQueryClient()

  return useQuery({
    ...subjectOptions(subjectId as UUID),
    enabled: Boolean(subjectId),
    placeholderData: () => subjectDeAlgunaLista(qc, subjectId),
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

/**
 * Plantilla de asignatura que corresponde a una plantilla de plan.
 *
 * La relación es 1:1 en base de datos (`uq_estructuras_asignatura_estructura_plan`),
 * así que el catálogo devuelve como mucho una fila: la UI no necesita pedirle al
 * usuario que elija plantilla al crear una asignatura.
 */
export function useSubjectEstructuraDelPlan(estructuraPlanId?: UUID | null) {
  const { data, isLoading, isError } = useQuery({
    queryKey: qk.estructurasAsignatura(estructuraPlanId ?? null),
    queryFn: () => subjects_get_structure_catalog({ estructuraPlanId }),
    enabled: Boolean(estructuraPlanId),
  })
  return {
    estructura: data?.[0] ?? null,
    isLoading,
    isError,
  }
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

export type LanzarGeneracionAsignaturaInput = {
  /**
   * Id temporal con el que la fila aparece en la tabla antes de existir en el
   * servidor. Lo genera el llamador (`makeTempId()`) porque también lo necesita
   * para animar el origen —post-it o tarjeta— hacia su fila.
   */
  tempId: string
  /** Fila mínima que se inserta antes de llamar al modelo. `estado` se fuerza a `generando`. */
  placeholder: TablesInsert<'asignaturas'>
  ia?: AISubjectUnifiedInput['iaConfig']
  /** Instantánea del wizard, para poder repoblarlo si el usuario cancela. */
  draft?: unknown
  adminOverrideReason?: string | null
}

/**
 * Lanza una generación de asignatura por IA de principio a fin: fila optimista,
 * inserción en `generando`, llamada al modelo y enganche del watcher de
 * Realtime.
 *
 * Vive en la capa de datos porque tres superficies lo necesitan —el wizard, la
 * tira de post-its del modo agente y el reintento— y porque el flujo tiene un
 * paso que no se puede olvidar sin dejar basura: si la petición al modelo falla
 * después de insertar, la fila se queda en `generando` para siempre, ya que
 * nadie va a completarla.
 *
 * El optimismo se resuelve a mano y no con `optimisticMutation` porque aquí
 * pueden correr varias inserciones a la vez sobre la misma lista (diez post-its
 * lanzados seguidos): restaurar la instantánea completa en el `onError` de una
 * borraría las filas de las otras. Con el id temporal, cada una toca sólo la
 * suya.
 */
export function useLanzarGeneracionAsignatura() {
  const qc = useQueryClient()
  const navigate = useNavigate()

  const escribirLista = (
    planId: UUID,
    fn: (filas: Array<Asignatura>) => Array<Asignatura>,
  ) =>
    qc.setQueryData(qk.planAsignaturas(planId), (previo: unknown) =>
      Array.isArray(previo) ? fn(previo as Array<Asignatura>) : previo,
    )

  return useMutation({
    mutationKey: mk.asignaturaGenerar(),
    mutationFn: async (input: LanzarGeneracionAsignaturaInput) => {
      const asignatura = await subjects_create_manual(
        { ...input.placeholder, estado: 'generando' },
        input.adminOverrideReason,
      )

      try {
        const respuesta = await ai_generate_subject({
          datosUpdate: {
            id: asignatura.id,
            plan_estudio_id: asignatura.plan_estudio_id,
            estructura_id: asignatura.estructura_id,
            nombre: asignatura.nombre,
            codigo: asignatura.codigo,
            tipo: asignatura.tipo,
            horas_academicas: asignatura.horas_academicas,
            horas_independientes: asignatura.horas_independientes,
            numero_ciclo: asignatura.numero_ciclo,
            linea_plan_id: asignatura.linea_plan_id,
            orden_celda: asignatura.orden_celda,
          },
          iaConfig: input.ia,
        })

        const responseId = respuesta?.openai?.responseId
          ? String(respuesta.openai.responseId)
          : undefined

        watchSubjectGeneration({
          subjectId: asignatura.id,
          planId: asignatura.plan_estudio_id,
          subjectName: asignatura.nombre,
          responseId,
          draft:
            input.draft === undefined
              ? undefined
              : { wizard: serializeGenerationDraft(input.draft) },
          queryClient: qc,
          navigate: (path, opts) =>
            navigate({ to: path, state: { showConfetti: opts?.showConfetti } }),
        })

        return { asignatura, responseId }
      } catch (error) {
        // La fila ya existe. Si no se marca, se queda «generando» eternamente:
        // `fallida` es un estado real del enum y la tabla ya sabe pintarlo, así
        // que el usuario ve qué pasó y puede borrarla o reintentar.
        await asignaturas_update(asignatura.id, { estado: 'fallida' }).catch(
          () => {
            /* manda el error original; el estado se corregirá al refrescar */
          },
        )
        throw error
      }
    },
    meta: {
      errorMessage: 'No se pudo iniciar la generación de la asignatura.',
      // Reintentar volvería a insertar otra fila: no es idempotente.
      retryable: false,
    },
    onMutate: (input) => {
      escribirLista(input.placeholder.plan_estudio_id, (filas) => [
        ...filas,
        {
          ...(input.placeholder as unknown as Asignatura),
          id: input.tempId,
          estado: 'generando',
          // La tabla indexa su configuración por `tipo`, que en la fila real
          // nunca es nulo porque la columna tiene default.
          tipo: input.placeholder.tipo ?? 'OBLIGATORIA',
          // `creditos` es una columna generada: el placeholder no la manda (lo
          // prohíbe Postgres), así que aquí se reproduce la misma fórmula para
          // que la fila optimista no muestre un hueco que se rellena solo al
          // reconciliar.
          creditos: calcularCreditos(
            input.placeholder.horas_academicas,
            input.placeholder.horas_independientes,
          ),
        },
      ])
    },
    onError: (_error, input) => {
      escribirLista(input.placeholder.plan_estudio_id, (filas) =>
        filas.filter((fila) => fila.id !== input.tempId),
      )
    },
    onSuccess: ({ asignatura }, input) => {
      qc.setQueryData(qk.asignatura(asignatura.id), asignatura)
      escribirLista(input.placeholder.plan_estudio_id, (filas) =>
        filas.map((fila) => (fila.id === input.tempId ? asignatura : fila)),
      )
    },
    onSettled: (_data, _error, input) => {
      const planId = input.placeholder.plan_estudio_id
      // Con varias generaciones en vuelo, invalidar en cada una tumbaría las
      // filas optimistas de las hermanas al llegar el refetch.
      if (qc.isMutating({ mutationKey: mk.asignaturaGenerar() }) > 1) return
      qc.invalidateQueries({ queryKey: qk.planAsignaturas(planId) })
      qc.invalidateQueries({ queryKey: qk.planHistorial(planId) })
    },
  })
}

/**
 * Una propuesta de asignatura del modo agente desde que se pide hasta que se
 * descarta. Es un *hueco*, no sólo una sugerencia: existe en la lista mientras
 * el modelo todavía está pensando, porque el usuario pulsa el `+` diez veces
 * seguidas y cada pulsación tiene que dejar rastro inmediato aunque su
 * respuesta tarde diez segundos.
 */
export type SugerenciaSlot = {
  id: string
  estado: 'pidiendo' | 'listo' | 'error'
  /** Enfoque con el que se pidió; permite reintentar sin volver a escribirlo. */
  enfoque: string
  sugerencia: SugerenciaAsignatura | null
  error?: string
}

const SIN_SUGERENCIA =
  'La IA no encontró ninguna asignatura nueva que proponer.'

const normalizarNombre = (nombre: string) =>
  nombre
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

/**
 * Propuestas sueltas de asignatura para la tira de post-its del modo agente.
 *
 * La lista vive en la caché de queries y no en `useState` a propósito: es el
 * resultado acumulado de N peticiones independientes que el usuario todavía no
 * ha decidido, y navegar al mapa y volver no debe borrar lo que la IA ya
 * propuso. No hay servidor detrás —`queryFn` devuelve la lista vacía inicial y
 * `staleTime: Infinity` impide que un refetch la vacíe—; las escrituras las
 * hace la mutación.
 *
 * Cada `pedir()` es una petición independiente de **una** sugerencia, no un
 * lote: así diez clics seguidos producen diez post-its que resuelven por su
 * cuenta, y el que falla no arrastra a los demás.
 */
export function useSugerenciasAgente(planId: UUID) {
  const qc = useQueryClient()
  const clave = qk.sugerenciasAsignaturas(planId)

  const { data: sugerencias = [] } = useQuery({
    queryKey: clave,
    queryFn: () => [] as Array<SugerenciaSlot>,
    staleTime: Infinity,
    gcTime: Infinity,
  })

  const escribir = (
    fn: (previas: Array<SugerenciaSlot>) => Array<SugerenciaSlot>,
  ) =>
    qc.setQueryData<Array<SugerenciaSlot>>(clave, (previas) =>
      fn(previas ?? []),
    )

  /**
   * Lo que la nueva propuesta no debe repetir. La Edge Function ya excluye por
   * su cuenta las asignaturas que existen en el plan, así que aquí sólo hacen
   * falta las hermanas que siguen en la tira.
   */
  const conservadas = (exceptoId: string) =>
    (qc.getQueryData<Array<SugerenciaSlot>>(clave) ?? []).flatMap((slot) =>
      slot.id !== exceptoId && slot.sugerencia
        ? [
            {
              nombre: slot.sugerencia.nombre,
              descripcion: slot.sugerencia.descripcion,
            },
          ]
        : [],
    )

  const mutacion = useMutation({
    mutationKey: mk.asignaturaSugerir(),
    mutationFn: async ({ id, enfoque }: { id: string; enfoque: string }) => {
      const pedirUna = async (): Promise<SugerenciaAsignatura | null> => {
        const propuestas = await generate_subject_suggestions({
          plan_estudio_id: planId,
          enfoque: enfoque.trim() || undefined,
          cantidad_de_sugerencias: 1,
          sugerencias_conservadas: conservadas(id),
        })
        return propuestas.at(0) ?? null
      }

      const primera = await pedirUna()
      if (!primera) return null

      const yaEsta = (candidata: SugerenciaAsignatura) =>
        conservadas(id).some(
          (otra) =>
            normalizarNombre(otra.nombre) ===
            normalizarNombre(candidata.nombre),
        )
      if (!yaEsta(primera)) return primera

      // Diez peticiones simultáneas no pueden verse entre sí: cada una salió
      // con la lista de ese instante, así que dos pueden volver con el mismo
      // nombre. Un segundo intento —ya con las hermanas que llegaron mientras
      // tanto— deshace el choque. No se reintenta más: encadenar peticiones
      // hasta lograr un nombre único puede no terminar nunca.
      const segunda = await pedirUna()
      if (!segunda || yaEsta(segunda)) return null
      return segunda
    },
    // El fallo se pinta en el propio post-it, con su botón de reintentar; un
    // toast global además sería ruido duplicado.
    meta: { errorMessage: false },
    onMutate: ({ id, enfoque }) => {
      escribir((previas) => {
        const enCurso: SugerenciaSlot = {
          id,
          estado: 'pidiendo',
          enfoque,
          sugerencia: null,
        }
        // `pedir` crea el hueco; `reintentar` reutiliza el que ya está pintado.
        return previas.some((slot) => slot.id === id)
          ? previas.map((slot) => (slot.id === id ? enCurso : slot))
          : [...previas, enCurso]
      })
    },
    onSuccess: (propuesta, { id }) => {
      escribir((previas) =>
        previas.map((slot) =>
          slot.id !== id
            ? slot
            : propuesta
              ? { ...slot, estado: 'listo', sugerencia: propuesta }
              : { ...slot, estado: 'error', error: SIN_SUGERENCIA },
        ),
      )
    },
    onError: (error, { id }) => {
      const motivo =
        error instanceof Error && error.message
          ? error.message
          : 'No se pudo proponer una asignatura.'
      escribir((previas) =>
        previas.map((slot) =>
          slot.id === id ? { ...slot, estado: 'error', error: motivo } : slot,
        ),
      )
    },
  })

  return {
    sugerencias,
    /** Añade un post-it vacío al instante y pide su contenido a la IA. */
    pedir: (enfoque: string) =>
      mutacion.mutate({ id: makeTempId(), enfoque: enfoque.trim() }),
    reintentar: (id: string) => {
      const slot = sugerencias.find((s) => s.id === id)
      if (!slot) return
      mutacion.mutate({ id, enfoque: slot.enfoque })
    },
    descartar: (id: string) =>
      escribir((previas) => previas.filter((slot) => slot.id !== id)),
  }
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
