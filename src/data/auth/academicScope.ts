import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'

import {
  getSessionAppMetadata,
  isRoleSimulationActive,
  resolveEffectiveAuthz,
} from './permissions'

import type { CarreraRow, FacultadRow, UUID } from '@/data/types/domain'
import type { Session } from '@supabase/supabase-js'

import { useSession } from '@/data/hooks/useAuth'
import { qk } from '@/data/query/keys'
import { supabaseBrowser } from '@/data/supabase/client'

type JsonRecord = Record<string, unknown>

export type AcademicScope = {
  isGlobal: boolean
  facultadIds: Array<UUID>
  carreraIds: Array<UUID>
}

export type AcademicScopeResolution = AcademicScope & {
  forcedFacultadId: UUID | null
  forcedCarreraId: UUID | null
  visibleFacultades: Array<FacultadRow>
  visibleCarreras: Array<CarreraRow>
  canChooseFacultad: boolean
  canChooseCarrera: boolean
}

const EMPTY_SCOPE: AcademicScope = {
  isGlobal: false,
  facultadIds: [],
  carreraIds: [],
}

function isRecord(value: unknown): value is JsonRecord {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function readStringArray(value: unknown): Array<string> {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : []
}

function unique(items: Array<string>) {
  return Array.from(new Set(items.filter(Boolean)))
}

export function getSessionAcademicScope(
  session: Session | null | undefined,
): AcademicScope {
  const appMetadata = getSessionAppMetadata(session)
  const roleKeys = new Set(readStringArray(appMetadata.roles_claves))
  const alcances = isRecord(appMetadata.alcances) ? appMetadata.alcances : {}

  const globalScopes = readStringArray(alcances.global)
  const facultadIds = readStringArray(alcances.facultades)
  const carreraIds = readStringArray(alcances.carreras)

  return {
    isGlobal:
      roleKeys.has('ADMIN') ||
      roleKeys.has('VICERRECTOR_ACADEMICO') ||
      globalScopes.length > 0,
    facultadIds: unique(facultadIds),
    carreraIds: unique(carreraIds),
  }
}

export function resolveAcademicScope(
  scope: AcademicScope,
  facultades: Array<FacultadRow>,
  carreras: Array<CarreraRow>,
): AcademicScopeResolution {
  if (scope.isGlobal) {
    return {
      ...scope,
      forcedFacultadId: null,
      forcedCarreraId: null,
      visibleFacultades: facultades,
      visibleCarreras: carreras,
      canChooseFacultad: true,
      canChooseCarrera: true,
    }
  }

  const scopedFacultadIds = new Set(scope.facultadIds)
  const scopedCarreraIds = new Set(scope.carreraIds)

  for (const carrera of carreras) {
    if (scopedCarreraIds.has(carrera.id)) {
      scopedFacultadIds.add(carrera.facultad_id)
    }
  }

  const visibleFacultades = facultades.filter((facultad) =>
    scopedFacultadIds.has(facultad.id),
  )

  const visibleCarreras = carreras.filter((carrera) => {
    if (scopedCarreraIds.size > 0) return scopedCarreraIds.has(carrera.id)
    return scopedFacultadIds.has(carrera.facultad_id)
  })

  const forcedCarreraId =
    scopedCarreraIds.size === 1 ? Array.from(scopedCarreraIds)[0] : null
  const forcedFacultadId =
    scopedFacultadIds.size === 1 ? Array.from(scopedFacultadIds)[0] : null

  return {
    ...scope,
    facultadIds: Array.from(scopedFacultadIds),
    forcedFacultadId,
    forcedCarreraId,
    visibleFacultades,
    visibleCarreras,
    canChooseFacultad: scopedFacultadIds.size !== 1,
    canChooseCarrera: scopedCarreraIds.size !== 1,
  }
}

export function useAcademicScope() {
  const sessionQuery = useSession()
  const session = sessionQuery.data ?? null

  // Mismo query (y queryKey) que usePermissions, así que se deduplica en caché.
  // Nos da el `isAdmin` resuelto contra la BD cuando el JWT no trae claims.
  const effectiveAuthzQuery = useQuery({
    queryKey: [...qk.effectiveAuthz(), session?.access_token ?? null],
    queryFn: () => resolveEffectiveAuthz(supabaseBrowser(), session),
    enabled: !!session,
    staleTime: 5 * 60_000,
  })
  const isAdminFromDb = effectiveAuthzQuery.data?.isAdmin ?? false
  const isSimulating = isRoleSimulationActive(session)

  return useMemo(() => {
    const scope = getSessionAcademicScope(session)
    // Red de seguridad: si la BD confirma admin pero el JWT aún no tiene los
    // claims (hook recién activado o token desincronizado), tratar el scope
    // como global. Mantiene la simetría con resolveEffectiveAuthz, que también
    // cae a la BD cuando faltan claims.
    if (isAdminFromDb && !isSimulating && !scope.isGlobal) {
      return { ...scope, isGlobal: true }
    }
    return scope
  }, [session, isAdminFromDb, isSimulating])
}

export { EMPTY_SCOPE }
