import { ShieldCheck, Trash2, UserPlus, Users } from 'lucide-react'
import { useMemo, useState } from 'react'

import type { RolResponsable } from '@/data/api/responsables.api'

import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { ROLES_RESPONSABLE } from '@/data/api/responsables.api'
import {
  requestAdminOverrideReason,
  usePlanCapabilities,
} from '@/data/auth/planCapabilities'
import { usePermissions } from '@/data/hooks/usePermissions'
import { usePlan } from '@/data/hooks/usePlans'
import {
  useAddResponsable,
  useRemoveResponsable,
  useResponsablesAsignatura,
} from '@/data/hooks/useResponsables'
import { useUsuarios } from '@/data/hooks/useUsuarios'
import { notify } from '@/lib/toast'

function rolLabel(rol: string) {
  return ROLES_RESPONSABLE.find((r) => r.value === rol)?.label ?? rol
}

export function SubjectResponsablesPanel({
  planId,
  asignaturaId,
  conTitulo = true,
}: {
  planId: string
  asignaturaId: string
  /**
   * Como página el panel se encabeza a sí mismo; dentro del panel lateral el
   * título lo pone la cabecera del Sheet, en la misma fila que el cierre.
   */
  conTitulo?: boolean
}) {
  const permissions = usePermissions()
  const { data: plan } = usePlan(planId)
  const capabilities = usePlanCapabilities(plan)
  const canManage =
    capabilities.canEditAsignaturas &&
    (permissions.hasBootstrapAccess() ||
      permissions.has('asignaturas.responsables.gestionar'))

  const { data: responsables = [], isLoading } =
    useResponsablesAsignatura(asignaturaId)
  const { data: usuarios = [] } = useUsuarios()
  const addMutation = useAddResponsable()
  const removeMutation = useRemoveResponsable()

  const [usuarioId, setUsuarioId] = useState('')
  const [rol, setRol] = useState<RolResponsable>('PROFESOR_RESPONSABLE')

  const usuariosById = useMemo(
    () => new Map(usuarios.map((u) => [u.id, u])),
    [usuarios],
  )
  const candidatos = useMemo(
    () => usuarios.filter((u) => !u.externo && !u.dado_de_baja_en),
    [usuarios],
  )

  const handleAdd = async () => {
    if (!canManage) return
    if (!usuarioId) {
      notify.error('Selecciona un usuario.')
      return
    }
    const adminOverrideReason = capabilities.requiresAdminOverrideForEdit
      ? await requestAdminOverrideReason(
          'agregar responsable fuera de su etapa normal',
        )
      : null
    if (capabilities.requiresAdminOverrideForEdit && !adminOverrideReason)
      return
    try {
      await addMutation.mutateAsync({
        asignaturaId,
        usuarioId,
        rol,
        adminOverrideReason,
      })
      notify.success('Responsable agregado.')
      setUsuarioId('')
    } catch (err: unknown) {
      notify.error(
        err instanceof Error ? err.message : 'Error al agregar responsable.',
      )
    }
  }

  const handleRemove = async (id: string) => {
    if (!canManage) return
    const adminOverrideReason = capabilities.requiresAdminOverrideForEdit
      ? await requestAdminOverrideReason(
          'retirar responsable fuera de su etapa normal',
        )
      : null
    if (capabilities.requiresAdminOverrideForEdit && !adminOverrideReason)
      return
    try {
      await removeMutation.mutateAsync({
        id,
        asignaturaId,
        adminOverrideReason,
      })
      notify.success('Responsable retirado.')
    } catch (err: unknown) {
      notify.error(
        err instanceof Error ? err.message : 'Error al retirar responsable.',
      )
    }
  }

  return (
    <section className="mx-auto max-w-3xl">
      {conTitulo && (
        <div className="flex items-center gap-2 border-b p-4">
          <Users className="text-primary h-5 w-5" />
          <div>
            <h2 className="text-foreground text-base font-semibold">
              Responsables de la materia
            </h2>
            <p className="text-muted-foreground text-xs">
              Profesores, coautores y revisores asignados a esta asignatura.
            </p>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3 p-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : responsables.length === 0 ? (
        <p className="text-muted-foreground p-6 text-center text-sm">
          Aún no hay responsables asignados.
        </p>
      ) : (
        <ul className="divide-y">
          {responsables.map((r) => {
            const u = usuariosById.get(r.usuario_id)
            return (
              <li
                key={r.id}
                className="flex items-center justify-between gap-3 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="text-foreground truncate text-sm font-medium">
                    {u?.nombre_completo ?? 'Usuario'}
                  </p>
                  <p className="text-muted-foreground truncate text-xs">
                    {u?.email ?? 'Sin correo visible'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground flex items-center gap-1.5 text-xs">
                    <ShieldCheck className="h-3 w-3" />
                    {rolLabel(r.rol)}
                  </span>
                  {canManage && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          disabled={removeMutation.isPending}
                          onClick={() => handleRemove(r.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                          <span className="sr-only">Retirar</span>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Retirar responsable</TooltipContent>
                    </Tooltip>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {canManage && (
        <div className="flex flex-col gap-2 border-t px-0 py-4 sm:flex-row sm:items-center">
          <Select value={usuarioId || undefined} onValueChange={setUsuarioId}>
            <SelectTrigger className="w-full sm:flex-1">
              <SelectValue placeholder="Seleccionar usuario" />
            </SelectTrigger>
            <SelectContent>
              {candidatos.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.nombre_completo ?? u.email ?? 'Usuario sin nombre'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={rol}
            onValueChange={(v) => setRol(v as RolResponsable)}
          >
            <SelectTrigger className="w-full sm:w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ROLES_RESPONSABLE.map((r) => (
                <SelectItem key={r.value} value={r.value}>
                  {r.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type="button"
            onClick={handleAdd}
            disabled={!usuarioId || addMutation.isPending}
          >
            <UserPlus className="h-4 w-4" />
            Agregar
          </Button>
        </div>
      )}
    </section>
  )
}
