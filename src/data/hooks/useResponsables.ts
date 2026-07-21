import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { responsable_add, responsable_remove } from '../api/responsables.api'
import { mk, qk } from '../query/keys'
import {
  asignaturasAsignablesOptions,
  responsablesAsignaturaOptions,
} from '../query/queryOptions'

import type {
  ResponsableAsignatura,
  RolResponsable,
} from '../api/responsables.api'

import { isTempId, makeTempId, optimisticMutation } from '@/lib/optimistic'

export function useResponsablesAsignatura(asignaturaId: string | null) {
  return useQuery({
    ...responsablesAsignaturaOptions(asignaturaId ?? ''),
    enabled: !!asignaturaId,
  })
}

export function useAsignaturasAsignables(enabled = true) {
  return useQuery({ ...asignaturasAsignablesOptions(), enabled })
}

type AddResponsableInput = {
  asignaturaId: string
  usuarioId: string
  rol: RolResponsable
  adminOverrideReason?: string | null
}

export function useAddResponsable() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: (input: AddResponsableInput) => responsable_add(input),
    ...optimisticMutation<ResponsableAsignatura, AddResponsableInput>({
      queryClient: qc,
      mutationKey: mk.responsableAdd(),
      scope: (input) => input.asignaturaId,
      writes: (input) => [
        {
          key: qk.responsablesAsignatura(input.asignaturaId),
          exact: true,
          // La fila del listado solo lleva usuario_id (los nombres se
          // resuelven en el front con useUsuarios): es componible en local.
          updater: (current: any, i) =>
            Array.isArray(current)
              ? [
                  ...current,
                  {
                    id: makeTempId(),
                    usuario_id: i.usuarioId,
                    rol: i.rol,
                    creado_en: new Date().toISOString(),
                  } satisfies ResponsableAsignatura,
                ]
              : current,
        },
      ],
      reconcile: (row, input, client) => {
        client.setQueryData(
          qk.responsablesAsignatura(input.asignaturaId),
          (current: any) =>
            Array.isArray(current)
              ? current.map((r: any) => (isTempId(r.id) ? row : r))
              : current,
        )
      },
      // El auto-grant del rol PROFESOR cambia roles/materias del usuario.
      invalidateOnSettle: () => [qk.usuarios(), qk.usuarioRelacionesRoot()],
      errorMessage: 'No se pudo asignar el responsable.',
    }),
    // Las pantallas de responsables capturan el error y notifican con el
    // mensaje específico (p. ej. duplicado 23505): la red global calla.
    meta: { errorMessage: false },
  })
}

export function useRemoveResponsable() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: (input: {
      id: string
      asignaturaId: string
      adminOverrideReason?: string | null
    }) => responsable_remove(input.id, input.adminOverrideReason),
    ...optimisticMutation<
      Awaited<ReturnType<typeof responsable_remove>>,
      { id: string; asignaturaId: string; adminOverrideReason?: string | null }
    >({
      queryClient: qc,
      mutationKey: mk.responsableRemove(),
      scope: (input) => input.asignaturaId,
      writes: (input) => [
        {
          key: qk.responsablesAsignatura(input.asignaturaId),
          exact: true,
          updater: (current: any, i) =>
            Array.isArray(current)
              ? current.filter((r: any) => r.id !== i.id)
              : current,
        },
      ],
      // El auto-grant del rol PROFESOR cambia roles/materias del usuario.
      invalidateOnSettle: () => [qk.usuarios(), qk.usuarioRelacionesRoot()],
      errorMessage: 'No se pudo retirar el responsable.',
    }),
    // Las pantallas de responsables capturan el error y notifican con el
    // mensaje específico: la red global calla (el rollback sí corre aquí).
    meta: { errorMessage: false },
  })
}
