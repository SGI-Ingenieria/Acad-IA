import type { EffectiveAuthz } from './permissions'

export type CatalogCarreraScope = {
  id: string
  facultad_id: string
  nivel?: string | null
}

export type CatalogFacultadScope = {
  id: string
}

const POSTGRADUATE_LEVELS = new Set(['maestria', 'doctorado', 'especialidad'])

const ALL_CAREER_LEVELS = [
  'Licenciatura',
  'Maestría',
  'Especialidad',
  'Doctorado',
  'Otro',
] as const

const POSTGRADUATE_CAREER_LEVELS = [
  'Maestría',
  'Especialidad',
  'Doctorado',
] as const

export type CarreraNivel = (typeof ALL_CAREER_LEVELS)[number]

function normalizeScopeText(value?: string | null) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

export function isPostgraduateLevel(value?: string | null) {
  return POSTGRADUATE_LEVELS.has(normalizeScopeText(value))
}

export function canManageCatalogos(
  authz: Pick<EffectiveAuthz, 'isAdmin' | 'permissions'>,
) {
  return authz.isAdmin || authz.permissions.has('catalogos.gestionar')
}

function hasGlobalAcademicScope(
  authz: Pick<EffectiveAuthz, 'isAdmin' | 'roleKeys' | 'roleAssignments'>,
) {
  return (
    authz.isAdmin ||
    authz.roleKeys.has('VICERRECTOR_ACADEMICO') ||
    authz.roleAssignments.some(
      (assignment) =>
        assignment.clave === 'VICERRECTOR_ACADEMICO' ||
        assignment.alcance_default === 'global',
    )
  )
}

function hasFacultyRole(
  authz: Pick<EffectiveAuthz, 'roleAssignments'>,
  facultyId: string | null | undefined,
  roles: Array<string>,
) {
  if (!facultyId) return false
  return authz.roleAssignments.some(
    (assignment) =>
      roles.includes(assignment.clave) && assignment.facultad_id === facultyId,
  )
}

function hasCareerRole(
  authz: Pick<EffectiveAuthz, 'roleAssignments'>,
  careerId: string | null | undefined,
  roles: Array<string>,
) {
  if (!careerId) return false
  return authz.roleAssignments.some(
    (assignment) =>
      roles.includes(assignment.clave) && assignment.carrera_id === careerId,
  )
}

export function canManageCatalogFacultad(
  authz: Pick<
    EffectiveAuthz,
    'isAdmin' | 'permissions' | 'roleKeys' | 'roleAssignments'
  >,
  facultad: CatalogFacultadScope | string | null | undefined,
) {
  const facultadId = typeof facultad === 'string' ? facultad : facultad?.id
  return (
    canManageCatalogos(authz) ||
    hasGlobalAcademicScope(authz) ||
    hasFacultyRole(authz, facultadId, ['DIRECTOR_FACULTAD'])
  )
}

export function getAllowedCareerCreateLevels(
  authz: Pick<
    EffectiveAuthz,
    'isAdmin' | 'permissions' | 'roleKeys' | 'roleAssignments'
  >,
  facultadId: string | null | undefined,
): Array<CarreraNivel> {
  if (!facultadId) return []
  if (
    canManageCatalogos(authz) ||
    hasGlobalAcademicScope(authz) ||
    hasFacultyRole(authz, facultadId, [
      'DIRECTOR_FACULTAD',
      'SECRETARIO_ACADEMICO',
    ])
  ) {
    return [...ALL_CAREER_LEVELS]
  }

  if (hasFacultyRole(authz, facultadId, ['JEFE_POSGRADO'])) {
    return [...POSTGRADUATE_CAREER_LEVELS]
  }

  return []
}

export function canCreateCatalogCarrera(
  authz: Pick<
    EffectiveAuthz,
    'isAdmin' | 'permissions' | 'roleKeys' | 'roleAssignments'
  >,
  facultadId: string | null | undefined,
) {
  return getAllowedCareerCreateLevels(authz, facultadId).length > 0
}

export function canManageCatalogCarrera(
  authz: Pick<
    EffectiveAuthz,
    'isAdmin' | 'permissions' | 'roleKeys' | 'roleAssignments'
  >,
  carrera: CatalogCarreraScope | null | undefined,
) {
  if (!carrera) return false
  if (
    getAllowedCareerCreateLevels(authz, carrera.facultad_id).includes(
      carrera.nivel as CarreraNivel,
    )
  ) {
    return true
  }

  return hasCareerRole(authz, carrera.id, ['JEFE_CARRERA'])
}
