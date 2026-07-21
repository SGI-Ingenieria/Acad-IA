import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  borradores_delete,
  borradores_list_for_entity,
  borradores_upsert,
} from '../api/drafts.api'
import { mk, qk } from '../query/keys'

import type {
  BorradorCampo,
  BorradorCampoUpsertInput,
  DraftEntity,
} from '../api/drafts.api'

import { makeTempId, optimisticMutation } from '@/lib/optimistic'

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
    ...optimisticMutation<BorradorCampo, BorradorCampoUpsertInput>({
      queryClient: qc,
      mutationKey: mk.borradorUpsert(),
      // La caché es un Map por entidad (clave → borrador): upserts de claves
      // distintas de la misma entidad comparten entrada, así que difieren la
      // invalidación juntas.
      scope: (input) => `${input.entidad}:${input.entidadId}`,
      writes: (input) => [
        {
          key: qk.borradoresCampo(input.entidad, input.entidadId),
          exact: true,
          updater: (current: any, i) => {
            const now = new Date().toISOString()
            const next = new Map<string, BorradorCampo>(current ?? [])
            next.set(i.clave, {
              id: makeTempId(),
              entidad: i.entidad,
              entidad_id: i.entidadId,
              plan_id: i.entidadId,
              clave: i.clave,
              contenido_html: i.contenidoHtml,
              creado_por: null,
              actualizado_por: null,
              creado_en: now,
              actualizado_en: now,
            })
            return next
          },
        },
      ],
      // Write-through de la fila real (id y autores del servidor) para que la
      // invalidación posterior no haga parpadear el contenido.
      reconcile: (row, input, client) => {
        client.setQueryData<Map<string, BorradorCampo>>(
          qk.borradoresCampo(input.entidad, input.entidadId),
          (current) => {
            const next = new Map(current ?? [])
            next.set(row.clave, row)
            return next
          },
        )
      },
      errorMessage: 'No se pudo guardar el borrador.',
    }),
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
    ...optimisticMutation<
      Awaited<ReturnType<typeof borradores_delete>>,
      { entidad: DraftEntity; entidadId: string; clave: string }
    >({
      queryClient: qc,
      mutationKey: mk.borradorDelete(),
      scope: (input) => `${input.entidad}:${input.entidadId}`,
      writes: (input) => [
        {
          key: qk.borradoresCampo(input.entidad, input.entidadId),
          exact: true,
          updater: (current: any, i) => {
            const next = new Map<string, BorradorCampo>(current ?? [])
            next.delete(i.clave)
            return next
          },
        },
      ],
      errorMessage: 'No se pudo eliminar el borrador.',
    }),
  })
}
