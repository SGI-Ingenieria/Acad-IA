import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  borradores_delete,
  borradores_list_for_entity,
  borradores_upsert,
} from '../api/drafts.api'
import { qk } from '../query/keys'

import type {
  BorradorCampo,
  BorradorCampoUpsertInput,
  DraftEntity,
} from '../api/drafts.api'

type DraftsContext = {
  previous?: Array<BorradorCampo>
  key: ReturnType<typeof qk.borradoresCampo>
}

export function useFieldDrafts(
  entidad: DraftEntity,
  entidadId: string | null | undefined,
) {
  return useQuery({
    queryKey: qk.borradoresCampo(entidad, entidadId ?? ''),
    queryFn: async () => {
      const rows = await borradores_list_for_entity(entidad, entidadId!)
      return new Map(rows.map((row) => [row.clave, row]))
    },
    enabled: Boolean(entidadId),
  })
}

export function useUpsertFieldDraft() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: (input: BorradorCampoUpsertInput) => borradores_upsert(input),
    onMutate: async (input): Promise<DraftsContext> => {
      const key = qk.borradoresCampo(input.entidad, input.entidadId)
      await qc.cancelQueries({ queryKey: key })

      const previousMap = qc.getQueryData<Map<string, BorradorCampo>>(key)
      const previous = previousMap ? Array.from(previousMap.values()) : []
      const now = new Date().toISOString()

      const optimistic: BorradorCampo = {
        id: `optimistic-${input.entidad}-${input.entidadId}-${input.clave}`,
        entidad: input.entidad,
        entidad_id: input.entidadId,
        plan_id: input.entidadId,
        clave: input.clave,
        contenido_html: input.contenidoHtml,
        creado_por: null,
        actualizado_por: null,
        creado_en: now,
        actualizado_en: now,
      }

      const next = new Map(previousMap ?? [])
      next.set(input.clave, optimistic)
      qc.setQueryData(key, next)

      return { previous, key }
    },
    onError: (_err, _input, context) => {
      if (!context) return
      qc.setQueryData(
        context.key,
        new Map((context.previous ?? []).map((row) => [row.clave, row])),
      )
    },
    onSuccess: (row, input) => {
      const key = qk.borradoresCampo(input.entidad, input.entidadId)
      qc.setQueryData<Map<string, BorradorCampo>>(key, (current) => {
        const next = new Map(current ?? [])
        next.set(row.clave, row)
        return next
      })
    },
    onSettled: (_row, _err, input) => {
      qc.invalidateQueries({
        queryKey: qk.borradoresCampo(input.entidad, input.entidadId),
      })
    },
  })
}

export function useDeleteFieldDraft() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: (input: {
      entidad: DraftEntity
      entidadId: string
      clave: string
    }) => borradores_delete(input.entidad, input.entidadId, input.clave),
    onMutate: async (input): Promise<DraftsContext> => {
      const key = qk.borradoresCampo(input.entidad, input.entidadId)
      await qc.cancelQueries({ queryKey: key })

      const previousMap = qc.getQueryData<Map<string, BorradorCampo>>(key)
      const previous = previousMap ? Array.from(previousMap.values()) : []
      const next = new Map(previousMap ?? [])
      next.delete(input.clave)
      qc.setQueryData(key, next)

      return { previous, key }
    },
    onError: (_err, _input, context) => {
      if (!context) return
      qc.setQueryData(
        context.key,
        new Map((context.previous ?? []).map((row) => [row.clave, row])),
      )
    },
    onSettled: (_row, _err, input) => {
      qc.invalidateQueries({
        queryKey: qk.borradoresCampo(input.entidad, input.entidadId),
      })
    },
  })
}
