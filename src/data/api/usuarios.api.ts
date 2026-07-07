import { invokeEdge } from '../supabase/invokeEdge'

export type Usuario = {
  id: string
  nombre_completo: string | null
  email: string | null
  externo: boolean
  email_confirmed: boolean
  creado_en: string
  actualizado_en: string
  dado_de_baja_en: string | null
  roles: Array<UsuarioRol>
  materias: Array<UsuarioMateria>
  gestion: UsuarioGestion
}

export type UsuarioGestion = {
  puede_dar_baja: boolean
  puede_reactivar: boolean
  puede_reenviar_invitacion: boolean
  puede_asignar_roles: boolean
  puede_reasignar: boolean
  puede_gestionar_materias: boolean
}

export type UsuarioMateria = {
  responsable_id: string
  rol: string
  asignatura_id: string | null
  asignatura_nombre: string | null
  plan_estudio_id: string | null
  carrera_id: string | null
  carrera_nombre: string | null
  facultad_id: string | null
}

export type Rol = {
  id: string
  clave: string
  nombre: string
  descripcion: string | null
  nivel_jerarquico: number
  alcance_default: 'global' | 'facultad' | 'carrera' | 'asignatura' | 'externo'
}

export type Permiso = {
  id: string
  clave: string
  nombre: string
  descripcion: string | null
  grupo: string
  orden: number
}

export type UsuarioRol = {
  id: string
  usuario_id: string
  rol_id: string
  facultad_id: string | null
  carrera_id: string | null
  creado_en: string
  asignado_por: string | null
  roles: Rol | null
  facultades: {
    id: string
    nombre: string
    nombre_corto: string | null
    prefijo: string | null
  } | null
  carreras: {
    id: string
    nombre: string
    nombre_corto: string | null
    facultad_id: string
    nivel: string
  } | null
}

export type UsuariosCatalogos = {
  roles: Array<Rol>
  permisos: Array<Permiso>
  facultades: Array<{
    id: string
    nombre: string
    nombre_corto: string | null
    prefijo: string | null
    color: string | null
    icono: string | null
    activa: boolean
  }>
  carreras: Array<{
    id: string
    facultad_id: string
    nombre: string
    nombre_corto: string | null
    nivel: string
    activa: boolean
  }>
  gestion: UsuariosCatalogosGestion
}

export type UsuariosCatalogosGestion = {
  roles_asignables: Array<string>
  facultades_gestionables: Array<string>
  carreras_gestionables: Array<string>
  carreras_posgrado_gestionables: Array<string>
  facultades_propias: Array<string>
  carreras_propias: Array<string>
  puede_crear_usuarios: boolean
  puede_gestionar_roles: boolean
}

export type ResponsableRolSimulado =
  | 'PROFESOR_RESPONSABLE'
  | 'COAUTOR'
  | 'REVISOR'

export type RolSimulacionActiva = {
  activa: true
  rol_id: string
  rol_clave: string
  rol_nombre: string
  alcance_default: Rol['alcance_default']
  facultad_id?: string | null
  facultad_nombre?: string | null
  carrera_id?: string | null
  carrera_nombre?: string | null
  plan_estudio_id?: string | null
  plan_nombre?: string | null
  asignatura_id?: string | null
  asignatura_nombre?: string | null
  responsable_rol?: ResponsableRolSimulado
  activada_en?: string
}

export type RolSimulacionInactiva = {
  activa: false
}

export type RolSimulacion = RolSimulacionActiva | RolSimulacionInactiva

export type ActivarRolSimulacionInput = {
  rol_id: string
  facultad_id?: string | null
  carrera_id?: string | null
  plan_estudio_id?: string | null
  asignatura_id?: string | null
  responsable_rol?: ResponsableRolSimulado
}

export type SimulacionAsignaturaOption = {
  id: string
  nombre: string | null
  codigo: string | null
  plan_estudio_id: string | null
  plan_nombre: string | null
  carrera_id: string | null
  carrera_nombre: string | null
  facultad_id: string | null
  facultad_nombre: string | null
}

export type CreateUsuarioInput = {
  nombre_completo: string
  email: string
}

function arrayOrEmpty<T>(value: Array<T> | null | undefined): Array<T> {
  return Array.isArray(value) ? value : []
}

const EMPTY_GESTION_USUARIO: UsuarioGestion = {
  puede_dar_baja: false,
  puede_reactivar: false,
  puede_reenviar_invitacion: false,
  puede_asignar_roles: false,
  puede_reasignar: false,
  puede_gestionar_materias: false,
}

const EMPTY_CATALOGOS_GESTION: UsuariosCatalogosGestion = {
  roles_asignables: [],
  facultades_gestionables: [],
  carreras_gestionables: [],
  carreras_posgrado_gestionables: [],
  facultades_propias: [],
  carreras_propias: [],
  puede_crear_usuarios: false,
  puede_gestionar_roles: false,
}

type UsuarioResponse = Omit<Usuario, 'gestion'> & {
  gestion?: UsuarioGestion | null
}

type UsuariosCatalogosResponse = Omit<UsuariosCatalogos, 'gestion'> & {
  gestion?: UsuariosCatalogosGestion | null
}

function normalizeUsuario(usuario: UsuarioResponse): Usuario {
  return {
    ...usuario,
    roles: arrayOrEmpty(usuario.roles),
    materias: arrayOrEmpty(usuario.materias),
    gestion: usuario.gestion ?? EMPTY_GESTION_USUARIO,
  }
}

function normalizeCatalogos(
  catalogos: UsuariosCatalogosResponse,
): UsuariosCatalogos {
  return {
    ...catalogos,
    roles: arrayOrEmpty(catalogos.roles),
    permisos: arrayOrEmpty(catalogos.permisos),
    facultades: arrayOrEmpty(catalogos.facultades),
    carreras: arrayOrEmpty(catalogos.carreras),
    gestion: {
      ...EMPTY_CATALOGOS_GESTION,
      ...(catalogos.gestion ?? {}),
      roles_asignables: arrayOrEmpty(catalogos.gestion?.roles_asignables),
      facultades_gestionables: arrayOrEmpty(
        catalogos.gestion?.facultades_gestionables,
      ),
      carreras_gestionables: arrayOrEmpty(
        catalogos.gestion?.carreras_gestionables,
      ),
      carreras_posgrado_gestionables: arrayOrEmpty(
        catalogos.gestion?.carreras_posgrado_gestionables,
      ),
      facultades_propias: arrayOrEmpty(catalogos.gestion?.facultades_propias),
      carreras_propias: arrayOrEmpty(catalogos.gestion?.carreras_propias),
    },
  }
}

function normalizeUsuarioRelaciones(
  relaciones: UsuarioRelaciones,
): UsuarioRelaciones {
  return {
    ...relaciones,
    planes: arrayOrEmpty(relaciones.planes),
    materias: arrayOrEmpty(relaciones.materias),
    invitados: arrayOrEmpty(relaciones.invitados),
  }
}

export function listUsuarios(): Promise<Array<Usuario>> {
  return invokeEdge<Array<UsuarioResponse>>('usuarios', undefined, {
    method: 'GET',
  }).then((usuarios) => arrayOrEmpty(usuarios).map(normalizeUsuario))
}

export function getUsuariosCatalogos(): Promise<UsuariosCatalogos> {
  return invokeEdge<UsuariosCatalogosResponse>(
    'usuarios/catalogos',
    undefined,
    {
      method: 'GET',
    },
  ).then(normalizeCatalogos)
}

export function getRoleSimulationCatalogos(): Promise<UsuariosCatalogos> {
  return invokeEdge<UsuariosCatalogosResponse>(
    'usuarios/simulacion/catalogos',
    undefined,
    {
      method: 'GET',
    },
  ).then(normalizeCatalogos)
}

export function buscarAsignaturasParaSimulacion(params: {
  q?: string
  limit?: number
}): Promise<Array<SimulacionAsignaturaOption>> {
  const search = new URLSearchParams()
  if (params.q?.trim()) search.set('q', params.q.trim())
  if (params.limit) search.set('limit', String(params.limit))

  const suffix = search.toString() ? `?${search.toString()}` : ''
  return invokeEdge<Array<SimulacionAsignaturaOption>>(
    `usuarios/simulacion/asignaturas${suffix}`,
    undefined,
    { method: 'GET' },
  )
}

export function activarRolSimulacion(
  input: ActivarRolSimulacionInput,
): Promise<RolSimulacionActiva> {
  return invokeEdge<RolSimulacionActiva>('usuarios/simulacion', input, {
    method: 'POST',
  })
}

export function desactivarRolSimulacion(): Promise<RolSimulacionInactiva> {
  return invokeEdge<RolSimulacionInactiva>('usuarios/simulacion', undefined, {
    method: 'DELETE',
  })
}

export function createUsuario(input: CreateUsuarioInput): Promise<Usuario> {
  return invokeEdge<UsuarioResponse>('usuarios', input, {
    method: 'POST',
  }).then(normalizeUsuario)
}

export function darDeBajaUsuario(id: string): Promise<Usuario> {
  return invokeEdge<UsuarioResponse>(`usuarios/${id}/dar-de-baja`, undefined, {
    method: 'PATCH',
  }).then(normalizeUsuario)
}

export function reactivarUsuario(id: string): Promise<Usuario> {
  return invokeEdge<UsuarioResponse>(`usuarios/${id}/reactivar`, undefined, {
    method: 'PATCH',
  }).then(normalizeUsuario)
}

export function reenviarInvitacion(id: string): Promise<{ message: string }> {
  return invokeEdge<{ message: string }>(
    `usuarios/${id}/reenviar-invitacion`,
    undefined,
    { method: 'POST' },
  )
}

export type AssignUsuarioRoleInput = {
  usuarioId: string
  rol_id: string
  facultad_id?: string | null
  carrera_id?: string | null
  // Ejecuta el "proceso de nombramiento": retira al titular previo del mismo
  // rol+alcance y asigna a este usuario de forma atómica.
  reemplazar?: boolean
}

export function assignUsuarioRole(
  input: AssignUsuarioRoleInput,
): Promise<UsuarioRol> {
  const { usuarioId, ...body } = input
  return invokeEdge<UsuarioRol>(`usuarios/${usuarioId}/roles`, body, {
    method: 'POST',
  })
}

export function removeUsuarioRole(input: {
  usuarioId: string
  asignacionId: string
}): Promise<{ id: string }> {
  return invokeEdge<{ id: string }>(
    `usuarios/${input.usuarioId}/roles/${input.asignacionId}`,
    undefined,
    { method: 'DELETE' },
  )
}

export type CreateUsuarioDirectoInput =
  | {
      type: 'internal'
      nombre_completo: string
      email: string
      clave: string
      // Solo requerida en el registro público (/registro); las llamadas
      // autenticadas (/usuarios) se autorizan por su sesión.
      masterPassword?: string
      password?: never
    }
  | {
      type: 'external'
      nombre_completo: string
      email: string
      password: string
      masterPassword?: string
      clave?: never
    }

export type CreateUsuarioDirectoResult = {
  id: string
  nombre_completo: string | null
}

export function createUsuarioDirecto(
  input: CreateUsuarioDirectoInput,
): Promise<CreateUsuarioDirectoResult> {
  return invokeEdge<CreateUsuarioDirectoResult>(
    'usuarios-alta-directa',
    input,
    { method: 'POST' },
  )
}

export type UsuarioPlanParticipacion = {
  plan_estudio_id: string
  plan_nombre: string | null
  carrera_nombre: string | null
  origen: 'dueño' | 'revision'
  estatus: string | null
  tarea_id: string | null
  fecha_limite: string | null
  creado_en: string | null
}

export type UsuarioMateriaResponsable = {
  responsable_id: string
  asignatura_id: string | null
  asignatura_nombre: string | null
  plan_estudio_id: string | null
  plan_nombre: string | null
  rol: string
  creado_en: string
}

export type UsuarioInvitado = {
  id: string
  nombre_completo: string | null
  dado_de_baja_en: string | null
  creado_en: string
}

export type UsuarioRelaciones = {
  planes: Array<UsuarioPlanParticipacion>
  materias: Array<UsuarioMateriaResponsable>
  invitados: Array<UsuarioInvitado>
}

export function getUsuarioRelaciones(id: string): Promise<UsuarioRelaciones> {
  return invokeEdge<UsuarioRelaciones>(`usuarios/${id}/relaciones`, undefined, {
    method: 'GET',
  }).then(normalizeUsuarioRelaciones)
}

export type ReasignarInput = {
  origenId: string
  destinoId: string
}

export type ReasignarResult = {
  origen: string
  destino: string
  reasignado_por: string
  detalle: Record<string, unknown>
}

export function reasignarResponsabilidades(
  input: ReasignarInput,
): Promise<ReasignarResult> {
  return invokeEdge<ReasignarResult>(
    `usuarios/${input.origenId}/reasignar`,
    { destino_id: input.destinoId },
    { method: 'POST' },
  )
}
