import { useMemo } from 'react'

import { getSessionAuthzSimulation } from './permissions'

import type { AppPermission, RoleAssignmentClaim } from './permissions'
import type { PlanEstudio, UUID } from '@/data/types/domain'

import { showAppPrompt } from '@/components/ui/app-alert-dialog'
import { usePermissions } from '@/data/hooks/usePermissions'
import { useResponsablesAsignatura } from '@/data/hooks/useResponsables'

// Roles de responsabilidad que SÍ pueden editar el contenido de la asignatura.
// REVISOR queda fuera: solo comenta / revisa (coincide con la BD).
const RESPONSABLE_EDITOR_ROLES = new Set(['PROFESOR_RESPONSABLE', 'COAUTOR'])

const IA_HIDDEN_STATES = new Set([
  'REV_PLANEACION',
  'REV_VICERRECTORIA',
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
  isAntecedente: boolean
  isFrozenForEditing: boolean
  canEditPlan: boolean
  canEditAsignaturas: boolean
  // Capacidad de editar campos RESTRINGIDOS (x-acad-ia.restriccion). Normalmente
  // igual a la edición base, pero un responsable de asignatura sí edita el
  // contenido general y NO los campos restringidos de gobernanza del plan.
  canEditRestrictedFields: boolean
  canComment: boolean
  canUseIA: boolean
  showIATabs: boolean
  requiresAdminOverrideForEdit: boolean
  readOnlyReason: string | null
}

type BuildPlanCapabilitiesInput = {
  plan: PlanEstudio | null | undefined
  roleKeys: Set<string>
  roleAssignments?: Array<RoleAssignmentClaim>
  isAdmin: boolean
  has: (permission: AppPermission) => boolean
}

function hasAny(roleKeys: Set<string>, roles: Array<string>) {
  return roles.some((role) => roleKeys.has(role))
}

export function isPostgradoNivel(nivel: string | null | undefined) {
  const normalized = (nivel ?? '')
    .trim()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
  return (
    normalized === 'maestria' ||
    normalized === 'doctorado' ||
    normalized === 'especialidad'
  )
}

function assignmentMatchesPlan(
  assignment: RoleAssignmentClaim,
  plan: PlanEstudio | null | undefined,
) {
  if (!plan) return false
  if (assignment.clave === 'ADMIN') return true
  if (assignment.alcance_default === 'global') return true
  if (assignment.carrera_id) return assignment.carrera_id === plan.carrera_id
  if (assignment.facultad_id) {
    return assignment.facultad_id === plan.carreras?.facultad_id
  }
  return false
}

function hasScopedRole(
  roleAssignments: Array<RoleAssignmentClaim>,
  plan: PlanEstudio | null | undefined,
  role: string,
) {
  return roleAssignments.some(
    (assignment) =>
      assignment.clave === role && assignmentMatchesPlan(assignment, plan),
  )
}

export function buildPlanCapabilities({
  plan,
  roleKeys,
  roleAssignments = [],
  isAdmin,
  has,
}: BuildPlanCapabilitiesInput): PlanCapabilities {
  const estadoClave = plan?.estados_plan?.clave ?? null
  const isAntecedente = plan?.rol_version_plan === 'ANTECEDENTE'

  if (isAntecedente) {
    return {
      estadoClave,
      isAntecedente: true,
      isFrozenForEditing: true,
      canEditPlan: false,
      canEditAsignaturas: false,
      canEditRestrictedFields: false,
      canComment: false,
      canUseIA: false,
      showIATabs: false,
      requiresAdminOverrideForEdit: false,
      readOnlyReason: 'Antecedente de solo lectura.',
    }
  }

  const jefeCarreraCanEdit =
    estadoClave === 'BORRADOR' &&
    (hasScopedRole(roleAssignments, plan, 'JEFE_CARRERA') ||
      (roleAssignments.length === 0 && roleKeys.has('JEFE_CARRERA')))
  const jefePosgradoCanEdit =
    estadoClave === 'BORRADOR' &&
    isPostgradoNivel(plan?.carreras?.nivel) &&
    hasScopedRole(roleAssignments, plan, 'JEFE_POSGRADO')
  const jefeCanEdit = jefeCarreraCanEdit || jefePosgradoCanEdit
  const secretarioCanEdit =
    WRITE_NORMAL_STATES.has(estadoClave ?? '') &&
    (hasScopedRole(roleAssignments, plan, 'SECRETARIO_ACADEMICO') ||
      (roleAssignments.length === 0 && roleKeys.has('SECRETARIO_ACADEMICO')))
  const adminNormalEdit = isAdmin && WRITE_NORMAL_STATES.has(estadoClave ?? '')
  const normalEdit = jefeCanEdit || secretarioCanEdit || adminNormalEdit

  const canEditWithOverride = isAdmin && Boolean(estadoClave) && !normalEdit
  const canEdit = Boolean(normalEdit || canEditWithOverride)
  const showIATabs = estadoClave ? !IA_HIDDEN_STATES.has(estadoClave) : false
  const canUseIA = showIATabs && normalEdit && has('ia.usar')
  const canComment =
    isAdmin ||
    (roleAssignments.length > 0
      ? [
          'JEFE_CARRERA',
          'JEFE_POSGRADO',
          'SECRETARIO_ACADEMICO',
          'DIRECTOR_FACULTAD',
          'PLANEACION_CURRICULAR',
          'VICERRECTOR_ACADEMICO',
          'EVALUADOR_EXTERNO',
        ].some((role) => hasScopedRole(roleAssignments, plan, role)) ||
        roleKeys.has('EVALUADOR_EXTERNO')
      : hasAny(roleKeys, [
          'JEFE_CARRERA',
          'JEFE_POSGRADO',
          'SECRETARIO_ACADEMICO',
          'DIRECTOR_FACULTAD',
          'PLANEACION_CURRICULAR',
          'VICERRECTOR_ACADEMICO',
          'EVALUADOR_EXTERNO',
        ]))

  const isFrozenForEditing = !normalEdit

  return {
    estadoClave,
    isAntecedente: false,
    isFrozenForEditing,
    canEditPlan: canEdit,
    canEditAsignaturas: canEdit,
    canEditRestrictedFields: canEdit,
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
  const { roleKeys, roleAssignments, isAdmin, has } = usePermissions()

  return useMemo(
    () =>
      buildPlanCapabilities({
        plan,
        roleKeys,
        roleAssignments,
        isAdmin,
        has,
      }),
    [plan, roleKeys, roleAssignments, isAdmin, has],
  )
}

/**
 * Capacidades para una asignatura concreta. Parte de `usePlanCapabilities` y,
 * si el usuario es un responsable EDITOR de esta asignatura (profesor
 * responsable o coautor, real o simulado) y el plan está en una etapa de
 * escritura normal, habilita la edición de su contenido — sin concederle
 * edición del plan ni de los campos restringidos. Debe usarse en las vistas de
 * detalle de asignatura en lugar de `usePlanCapabilities`.
 */
export function useAsignaturaCapabilities(
  plan: PlanEstudio | null | undefined,
  asignaturaId: string | null | undefined,
): PlanCapabilities {
  const base = usePlanCapabilities(plan)
  const { session, has } = usePermissions()
  const { data: responsables } = useResponsablesAsignatura(asignaturaId ?? null)

  return useMemo(() => {
    // Ya puede editar por rol de plan (o admin override): nada que ampliar.
    if (base.canEditAsignaturas || !asignaturaId) return base
    // La edición del responsable solo aplica en etapas de escritura normal.
    if (!WRITE_NORMAL_STATES.has(base.estadoClave ?? '')) return base

    const userId = session?.user.id ?? null
    const simulation = getSessionAuthzSimulation(session)

    const simulatedEditor =
      !!simulation &&
      simulation.rol_clave === 'PROFESOR' &&
      !!simulation.asignatura_id &&
      simulation.asignatura_id === asignaturaId &&
      RESPONSABLE_EDITOR_ROLES.has(
        simulation.responsable_rol ?? 'PROFESOR_RESPONSABLE',
      )

    const realEditor =
      !!userId &&
      (responsables ?? []).some(
        (r) => r.usuario_id === userId && RESPONSABLE_EDITOR_ROLES.has(r.rol),
      )

    if (!simulatedEditor && !realEditor) return base

    return {
      ...base,
      canEditAsignaturas: true,
      isFrozenForEditing: false,
      // El responsable NO edita campos restringidos: la BD también lo impide.
      canEditRestrictedFields: false,
      canUseIA: base.showIATabs && has('ia.usar'),
      requiresAdminOverrideForEdit: false,
      readOnlyReason: null,
    }
  }, [base, asignaturaId, session, responsables, has])
}

export function requestAdminOverrideReason(
  actionLabel = 'editar este plan fuera de su etapa normal',
): Promise<string | null> {
  const warning =
    `Estas a punto de ${actionLabel}. ` +
    'El cambio se registrara como sobreescritura administrativa y quedara en el historial.'

  return showAppPrompt({
    title: 'Confirmar sobreescritura administrativa',
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
