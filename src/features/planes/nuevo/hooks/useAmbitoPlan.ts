import { useMemo } from 'react'

import type {
  CarreraRow,
  EstructuraPlanRow,
  FacultadRow,
} from '@/data/types/domain'

import {
  resolveAcademicScope,
  useAcademicScope,
} from '@/data/auth/academicScope'
import { isPostgradoNivel } from '@/data/auth/planCapabilities'
import { usePermissions } from '@/data/hooks/usePermissions'
import { useCatalogosPlanes } from '@/data/hooks/usePlans'

type RoleAssignments = ReturnType<typeof usePermissions>['roleAssignments']

const GLOBAL_PLAN_ROLES = new Set(['ADMIN', 'VICERRECTOR_ACADEMICO'])
const FACULTY_PLAN_ROLES = new Set([
  'DIRECTOR_FACULTAD',
  'SECRETARIO_ACADEMICO',
])
/** Roles que pueden dar de alta carreras, y por tanto salir del vacío. */
const ROLES_QUE_GESTIONAN_CARRERAS = [
  'JEFE_POSGRADO',
  'DIRECTOR_FACULTAD',
  'SECRETARIO_ACADEMICO',
]

function puedeCrearPlanEn(
  carrera: CarreraRow,
  roleAssignments: RoleAssignments,
  isAdmin: boolean,
) {
  if (isAdmin) return true
  if (roleAssignments.length === 0) return true

  return roleAssignments.some((assignment) => {
    if (GLOBAL_PLAN_ROLES.has(assignment.clave)) return true
    if (FACULTY_PLAN_ROLES.has(assignment.clave)) {
      return assignment.facultad_id === carrera.facultad_id
    }
    if (assignment.clave === 'JEFE_CARRERA') {
      return assignment.carrera_id === carrera.id
    }
    if (assignment.clave === 'JEFE_POSGRADO') {
      return (
        assignment.facultad_id === carrera.facultad_id &&
        isPostgradoNivel(carrera.nivel)
      )
    }
    return false
  })
}

export type AmbitoPlan = {
  /** Los catálogos todavía no han llegado: nada de lo demás es concluyente. */
  cargando: boolean
  /** Catálogos completos, para resolver un id que quedó fuera del ámbito. */
  todasFacultades: Array<FacultadRow>
  todasCarreras: Array<CarreraRow>
  estructurasPlan: Array<EstructuraPlanRow>
  /** Facultades y carreras en las que este usuario puede crear planes. */
  facultades: Array<FacultadRow>
  carreras: Array<CarreraRow>
  /** Ámbito que el rol impone y que por tanto no se pregunta. */
  forcedFacultadId: string | null
  forcedCarreraId: string | null
  /** El rol fija el ámbito: ni se pregunta ni se muestra en el rastro. */
  ocultarFacultad: boolean
  ocultarCarrera: boolean
  /** Hay una decisión real que tomar, así que merece una vista propia. */
  puedeElegirFacultad: boolean
  puedeElegirCarrera: boolean
  /** El rastro del paso de datos básicos permite volver a la pregunta. */
  puedeCambiarFacultad: boolean
  puedeCambiarCarrera: boolean
  sinCarreras: boolean
  /** Quien puede dar de alta carreras ve una salida en el estado vacío. */
  puedeGestionarCarreras: boolean
  carrerasDeFacultad: (facultadId: string | null) => Array<CarreraRow>
}

/**
 * Ámbito académico en el que este usuario puede crear un plan.
 *
 * Resuelve en un solo lugar tres cosas que antes se recalculaban dentro del
 * formulario de datos básicos: qué facultades y carreras son visibles, cuáles
 * vienen impuestas por el rol y, sobre todo, si queda alguna decisión que
 * tomar. Lo último es lo que decide si el asistente muestra el paso de
 * facultad o el de carrera: preguntar algo que sólo admite una respuesta es
 * hacer perder un clic.
 *
 * `resolveAcademicScope` acota por ámbito; aquí se acota además por permiso de
 * creación, porque ver una carrera y poder crearle un plan no son lo mismo.
 */
export function useAmbitoPlan(): AmbitoPlan {
  const { data: catalogos } = useCatalogosPlanes()
  const academicScope = useAcademicScope()
  const { roleAssignments, isAdmin } = usePermissions()

  const todasFacultades = useMemo(
    () => catalogos?.facultades ?? [],
    [catalogos?.facultades],
  )
  const todasCarreras = useMemo(
    () => catalogos?.carreras ?? [],
    [catalogos?.carreras],
  )
  const estructurasPlan = useMemo(
    () => (catalogos?.estructurasPlan ?? []) as Array<EstructuraPlanRow>,
    [catalogos?.estructurasPlan],
  )

  const baseScope = useMemo(
    () => resolveAcademicScope(academicScope, todasFacultades, todasCarreras),
    [academicScope, todasCarreras, todasFacultades],
  )

  return useMemo(() => {
    const carreras = baseScope.visibleCarreras.filter((carrera) =>
      puedeCrearPlanEn(carrera, roleAssignments, isAdmin),
    )
    const carreraIds = new Set(carreras.map((carrera) => carrera.id))
    const facultadIds = new Set(carreras.map((carrera) => carrera.facultad_id))
    const facultades = baseScope.visibleFacultades.filter((facultad) =>
      facultadIds.has(facultad.id),
    )

    const forcedCarreraId =
      baseScope.forcedCarreraId && carreraIds.has(baseScope.forcedCarreraId)
        ? baseScope.forcedCarreraId
        : carreras.length === 1
          ? carreras[0].id
          : null
    const forcedFacultadId =
      baseScope.forcedFacultadId && facultadIds.has(baseScope.forcedFacultadId)
        ? baseScope.forcedFacultadId
        : facultades.length === 1
          ? facultades[0].id
          : null

    const tieneRolDeFacultad = roleAssignments.some((assignment) =>
      ROLES_QUE_GESTIONAN_CARRERAS.includes(assignment.clave),
    )
    const ocultarFacultad =
      !isAdmin && (tieneRolDeFacultad || Boolean(forcedFacultadId))
    const tieneRolDeCarrera = roleAssignments.some(
      (assignment) => assignment.clave === 'JEFE_CARRERA',
    )
    const ocultarCarrera =
      !isAdmin && tieneRolDeCarrera && Boolean(forcedCarreraId)

    return {
      cargando: !catalogos,
      todasFacultades,
      todasCarreras,
      estructurasPlan,
      facultades,
      carreras,
      forcedFacultadId,
      forcedCarreraId,
      ocultarFacultad,
      ocultarCarrera,
      puedeElegirFacultad:
        !ocultarFacultad && !forcedFacultadId && facultades.length > 1,
      puedeElegirCarrera:
        !ocultarCarrera && !forcedCarreraId && carreras.length > 1,
      puedeCambiarFacultad:
        baseScope.canChooseFacultad && facultades.length > 1,
      puedeCambiarCarrera: baseScope.canChooseCarrera && carreras.length > 1,
      sinCarreras: Boolean(catalogos) && carreras.length === 0,
      puedeGestionarCarreras:
        isAdmin ||
        roleAssignments.some((assignment) =>
          ROLES_QUE_GESTIONAN_CARRERAS.includes(assignment.clave),
        ),
      carrerasDeFacultad: (facultadId: string | null) =>
        facultadId
          ? carreras.filter((carrera) => carrera.facultad_id === facultadId)
          : carreras,
    }
  }, [
    baseScope,
    catalogos,
    estructurasPlan,
    isAdmin,
    roleAssignments,
    todasCarreras,
    todasFacultades,
  ])
}
