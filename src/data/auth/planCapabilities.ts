import { useMemo } from 'react'

import type { AppPermission } from './permissions'
import type { PlanEstudio, UUID } from '@/data/types/domain'

import { showAppPrompt } from '@/components/ui/app-alert-dialog'
import { usePermissions } from '@/data/hooks/usePermissions'

const IA_HIDDEN_STATES = new Set([
  'REV_PLANEACION',
  'CONSULTA_EXPERTOS',
  'REV_SEDES',
  'CONSEJO_FACULTAD',
  'CONSEJO_UNIVERSITARIO',
  'JUNTA_GOBIERNO',
  'ENVIADO_SEP',
  'APROBADO',
  'RECHAZADO',
])

const WRITE_NORMAL_STATES = new Set(['BORRADOR', 'REVISION'])

export type PlanCapabilities = {
  estadoClave: string | null
  isFrozenForEditing: boolean
  canEditPlan: boolean
  canEditAsignaturas: boolean
  canComment: boolean
  canUseIA: boolean
  showIATabs: boolean
  requiresAdminOverrideForEdit: boolean
  readOnlyReason: string | null
}

type BuildPlanCapabilitiesInput = {
  plan: PlanEstudio | null | undefined
  roleKeys: Set<string>
  isAdmin: boolean
  has: (permission: AppPermission) => boolean
}

function hasAny(roleKeys: Set<string>, roles: Array<string>) {
  return roles.some((role) => roleKeys.has(role))
}

export function buildPlanCapabilities({
  plan,
  roleKeys,
  isAdmin,
  has,
}: BuildPlanCapabilitiesInput): PlanCapabilities {
  const estadoClave = plan?.estados_plan?.clave ?? null

  const jefeCanEdit = estadoClave === 'BORRADOR' && roleKeys.has('JEFE_CARRERA')
  const secretarioCanEdit =
    WRITE_NORMAL_STATES.has(estadoClave ?? '') &&
    roleKeys.has('SECRETARIO_ACADEMICO')
  const adminNormalEdit = isAdmin && WRITE_NORMAL_STATES.has(estadoClave ?? '')
  const normalEdit = jefeCanEdit || secretarioCanEdit || adminNormalEdit

  const canEditWithOverride = isAdmin && Boolean(estadoClave) && !normalEdit
  const canEdit = Boolean(normalEdit || canEditWithOverride)
  const showIATabs = estadoClave ? !IA_HIDDEN_STATES.has(estadoClave) : false
  const canUseIA = showIATabs && normalEdit && has('ia.usar')
  const canComment =
    isAdmin ||
    hasAny(roleKeys, [
      'JEFE_CARRERA',
      'SECRETARIO_ACADEMICO',
      'DIRECTOR_FACULTAD',
      'PLANEACION_CURRICULAR',
      'VICERRECTOR_ACADEMICO',
      'EVALUADOR_EXTERNO',
    ])

  const isFrozenForEditing = !normalEdit

  return {
    estadoClave,
    isFrozenForEditing,
    canEditPlan: canEdit,
    canEditAsignaturas: canEdit,
    canComment,
    canUseIA,
    showIATabs,
    requiresAdminOverrideForEdit: canEditWithOverride,
    readOnlyReason: isFrozenForEditing
      ? 'Este plan esta en modo solo lectura para tu rol y etapa actual.'
      : null,
  }
}

export function usePlanCapabilities(plan: PlanEstudio | null | undefined) {
  const { roleKeys, isAdmin, has } = usePermissions()

  return useMemo(
    () =>
      buildPlanCapabilities({
        plan,
        roleKeys,
        isAdmin,
        has,
      }),
    [plan, roleKeys, isAdmin, has],
  )
}

export function requestAdminOverrideReason(
  actionLabel = 'editar este plan fuera de su etapa normal',
): Promise<string | null> {
  const warning =
    `Estas a punto de ${actionLabel}. ` +
    'El cambio se registrara como override administrativo y quedara en el historial.'

  return showAppPrompt({
    title: 'Confirmar override administrativo',
    description: warning,
    label: 'Motivo del override',
    placeholder:
      'Describe por qué se realiza este cambio fuera de la etapa normal.',
    confirmLabel: 'Confirmar override',
    required: true,
  })
}

export function adminOverrideHeaders(reason?: string | null) {
  const trimmed = reason?.trim()
  return trimmed ? { 'x-admin-override-reason': trimmed } : undefined
}

export type PlanCapabilitySubjectContext = {
  planId: UUID
  reason?: string | null
}
