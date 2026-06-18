import { NIVEL_ORDEN } from './usuario-ui'

import type {
  Usuario,
  UsuarioRol,
  UsuariosCatalogos,
} from '@/data/api/usuarios.api'

// Claves de rol que conforman la jerarquía académica (ver migración
// 20260618134955_roles_permisos_y_claims.sql). Los PROFESORES no se agrupan por
// rol/carrera: su pertenencia se deriva de las materias de las que son
// responsables (ver `profesores` en CarreraNodo).
export const ROLES_JERARQUIA = {
  global: ['ADMIN', 'VICERRECTOR_ACADEMICO'],
  facultad: ['DIRECTOR_FACULTAD', 'SECRETARIO_ACADEMICO'],
  carrera: ['JEFE_CARRERA'],
  externo: ['EVALUADOR_EXTERNO'],
} as const

export type MiembroJerarquia = {
  usuario: Usuario
  // Asignación de rol relevante para el nodo donde se muestra al usuario.
  asignacion: UsuarioRol
}

export type ProfesorCarrera = {
  usuario: Usuario
  // Número de materias que imparte dentro de esta carrera.
  materias: number
}

export type CarreraNodo = {
  id: string
  nombre: string
  nombreCorto: string | null
  nivel: string
  miembros: Array<MiembroJerarquia>
  profesores: Array<ProfesorCarrera>
}

export type FacultadNodo = {
  id: string
  nombre: string
  nombreCorto: string | null
  prefijo: string | null
  color: string | null
  icono: string | null
  miembros: Array<MiembroJerarquia>
  carreras: Array<CarreraNodo>
}

export type Jerarquia = {
  global: Array<MiembroJerarquia>
  facultades: Array<FacultadNodo>
  externos: Array<MiembroJerarquia>
  totalMiembros: number
}

function nivelIndex(nivel: string) {
  const idx = (NIVEL_ORDEN as ReadonlyArray<string>).indexOf(nivel)
  return idx === -1 ? NIVEL_ORDEN.length : idx
}

function ordenarPorJerarquia(a: MiembroJerarquia, b: MiembroJerarquia) {
  const nivelA = a.asignacion.roles?.nivel_jerarquico ?? 999
  const nivelB = b.asignacion.roles?.nivel_jerarquico ?? 999
  if (nivelA !== nivelB) return nivelA - nivelB
  return (a.usuario.nombre_completo ?? '').localeCompare(
    b.usuario.nombre_completo ?? '',
  )
}

function ordenarProfesores(a: ProfesorCarrera, b: ProfesorCarrera) {
  return (a.usuario.nombre_completo ?? '').localeCompare(
    b.usuario.nombre_completo ?? '',
  )
}

function arrayOrEmpty<T>(value: Array<T> | null | undefined): Array<T> {
  return Array.isArray(value) ? value : []
}

/**
 * Agrupa los usuarios (ya filtrados por búsqueda) en la estructura académica:
 * Global → Facultad (directores/secretarios) → Carrera (jefe + profesores) →
 * Expertos externos. Los profesores se ubican bajo cada carrera donde imparten
 * materias (derivado de `usuario.materias`), por lo que un profesor que cruza
 * carreras aparece en cada una. Un usuario con varias asignaciones puede
 * aparecer en varios nodos.
 */
export function construirJerarquia(
  usuarios: Array<Usuario>,
  catalogos: UsuariosCatalogos | undefined,
): Jerarquia {
  const facultadMap = new Map<string, FacultadNodo>()
  const carreraMap = new Map<string, CarreraNodo>()
  const carreraFacultad = new Map<string, string>()

  for (const facultad of catalogos?.facultades ?? []) {
    facultadMap.set(facultad.id, {
      id: facultad.id,
      nombre: facultad.nombre,
      nombreCorto: facultad.nombre_corto,
      prefijo: facultad.prefijo,
      color: facultad.color,
      icono: facultad.icono,
      miembros: [],
      carreras: [],
    })
  }

  for (const carrera of catalogos?.carreras ?? []) {
    carreraMap.set(carrera.id, {
      id: carrera.id,
      nombre: carrera.nombre,
      nombreCorto: carrera.nombre_corto,
      nivel: carrera.nivel,
      miembros: [],
      profesores: [],
    })
    carreraFacultad.set(carrera.id, carrera.facultad_id)
  }

  const global: Array<MiembroJerarquia> = []
  const externos: Array<MiembroJerarquia> = []

  for (const usuario of usuarios) {
    for (const asignacion of arrayOrEmpty(usuario.roles)) {
      const clave = asignacion.roles?.clave
      if (!clave) continue
      const miembro: MiembroJerarquia = { usuario, asignacion }

      if ((ROLES_JERARQUIA.global as ReadonlyArray<string>).includes(clave)) {
        global.push(miembro)
      } else if (
        (ROLES_JERARQUIA.facultad as ReadonlyArray<string>).includes(clave) &&
        asignacion.facultad_id
      ) {
        facultadMap.get(asignacion.facultad_id)?.miembros.push(miembro)
      } else if (
        (ROLES_JERARQUIA.carrera as ReadonlyArray<string>).includes(clave) &&
        asignacion.carrera_id
      ) {
        carreraMap.get(asignacion.carrera_id)?.miembros.push(miembro)
      } else if (
        (ROLES_JERARQUIA.externo as ReadonlyArray<string>).includes(clave)
      ) {
        externos.push(miembro)
      }
    }

    // Profesores: derivados de las materias (responsables_asignatura).
    const materiasPorCarrera = new Map<string, number>()
    for (const materia of arrayOrEmpty(usuario.materias)) {
      if (!materia.carrera_id) continue
      materiasPorCarrera.set(
        materia.carrera_id,
        (materiasPorCarrera.get(materia.carrera_id) ?? 0) + 1,
      )
    }
    for (const [carreraId, count] of materiasPorCarrera) {
      carreraMap.get(carreraId)?.profesores.push({ usuario, materias: count })
    }
  }

  // Anidar carreras (con miembros o profesores) bajo su facultad.
  for (const [carreraId, carrera] of carreraMap) {
    if (carrera.miembros.length === 0 && carrera.profesores.length === 0) {
      continue
    }
    carrera.miembros.sort(ordenarPorJerarquia)
    carrera.profesores.sort(ordenarProfesores)
    const facultadId = carreraFacultad.get(carreraId)
    const facultad = facultadId ? facultadMap.get(facultadId) : undefined
    if (facultad) facultad.carreras.push(carrera)
  }

  const facultades = Array.from(facultadMap.values())
    .filter((f) => f.miembros.length > 0 || f.carreras.length > 0)
    .map((f) => {
      f.miembros.sort(ordenarPorJerarquia)
      f.carreras.sort((a, b) => {
        const diff = nivelIndex(a.nivel) - nivelIndex(b.nivel)
        return diff !== 0 ? diff : a.nombre.localeCompare(b.nombre)
      })
      return f
    })
    .sort((a, b) => a.nombre.localeCompare(b.nombre))

  global.sort(ordenarPorJerarquia)
  externos.sort(ordenarPorJerarquia)

  const totalMiembros =
    global.length +
    externos.length +
    facultades.reduce(
      (acc, f) =>
        acc +
        f.miembros.length +
        f.carreras.reduce(
          (sum, c) => sum + c.miembros.length + c.profesores.length,
          0,
        ),
      0,
    )

  return { global, facultades, externos, totalMiembros }
}
