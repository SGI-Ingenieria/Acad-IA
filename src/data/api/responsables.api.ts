import {
  supabaseBrowser,
  supabaseBrowserParaEscritura,
} from '../supabase/client'

import { getUserIdOrThrow, requireData, throwIfError } from './_helpers'

import type { Enums } from '@/types/supabase'

export type RolResponsable = Enums<'rol_responsable_asignatura'>

export const ROLES_RESPONSABLE: ReadonlyArray<{
  value: RolResponsable
  label: string
}> = [
  { value: 'PROFESOR_RESPONSABLE', label: 'Profesor responsable' },
  { value: 'COAUTOR', label: 'Coautor' },
  { value: 'REVISOR', label: 'Revisor' },
]

export type ResponsableAsignatura = {
  id: string
  usuario_id: string
  rol: RolResponsable
  creado_en: string
}

export type AsignaturaAsignable = {
  id: string
  nombre: string
  codigo: string | null
  plan_estudio_id: string
  plan_nombre: string | null
  carrera_nombre: string | null
}

// Nombres NO se traen por join (la RLS de usuarios_app podría ocultarlos): se
// resuelven en el front con useUsuarios().
export async function responsables_list(
  asignaturaId: string,
): Promise<Array<ResponsableAsignatura>> {
  const supabase = supabaseBrowser()
  const { data, error } = await supabase
    .from('responsables_asignatura')
    .select('id, usuario_id, rol, creado_en')
    .eq('asignatura_id', asignaturaId)
    .order('creado_en', { ascending: true })

  throwIfError(error)
  return data ?? []
}

export async function responsable_add(input: {
  asignaturaId: string
  usuarioId: string
  rol: RolResponsable
  adminOverrideReason?: string | null
}): Promise<ResponsableAsignatura> {
  const supabase = supabaseBrowserParaEscritura(input.adminOverrideReason)
  const userId = await getUserIdOrThrow(supabase)
  const { data, error } = await supabase
    .from('responsables_asignatura')
    .insert({
      asignatura_id: input.asignaturaId,
      usuario_id: input.usuarioId,
      rol: input.rol,
      asignado_por: userId,
    })
    .select('id, usuario_id, rol, creado_en')
    .single()

  if (error?.code === '23505') {
    throw new Error('El usuario ya es responsable de esta materia con ese rol.')
  }
  throwIfError(error)
  return requireData(data, 'No se pudo asignar el responsable.')
}

export async function responsable_remove(
  id: string,
  adminOverrideReason?: string | null,
): Promise<{ id: string }> {
  const supabase = supabaseBrowserParaEscritura(adminOverrideReason)
  const { error } = await supabase
    .from('responsables_asignatura')
    .delete()
    .eq('id', id)

  throwIfError(error)
  return { id }
}

// La RLS limita el SELECT a las asignaturas del ámbito del actor.
export async function asignaturas_asignables_list(): Promise<
  Array<AsignaturaAsignable>
> {
  const supabase = supabaseBrowser()
  const { data, error } = await supabase
    .from('asignaturas')
    .select(
      'id, nombre, codigo, plan_estudio_id, planes_estudio(nombre, nombre_propuesto, nombre_display, carreras(nombre_corto, nombre))',
    )
    .neq('estado', 'archivada')
    .order('nombre', { ascending: true })

  throwIfError(error)

  return (data ?? []).map((row) => {
    const plan = (
      Array.isArray(row.planes_estudio)
        ? row.planes_estudio[0]
        : row.planes_estudio
    ) as {
      nombre: string | null
      nombre_propuesto: string | null
      nombre_display: string | null
      carreras:
        | { nombre_corto: string | null; nombre: string | null }
        | Array<{ nombre_corto: string | null; nombre: string | null }>
        | null
    } | null
    const carrerasEmbed = plan?.carreras
    const carrera = (
      Array.isArray(carrerasEmbed) ? carrerasEmbed[0] : carrerasEmbed
    ) as { nombre_corto: string | null; nombre: string | null } | null
    return {
      id: row.id,
      nombre: row.nombre,
      codigo: row.codigo ?? null,
      plan_estudio_id: row.plan_estudio_id,
      plan_nombre:
        plan?.nombre_display ?? plan?.nombre_propuesto ?? plan?.nombre ?? null,
      carrera_nombre: carrera?.nombre_corto ?? carrera?.nombre ?? null,
    }
  })
}
