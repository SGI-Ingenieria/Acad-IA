export const qk = {
  auth: ['auth'] as const,
  session: () => ['auth', 'session'] as const,
  meProfile: () => ['auth', 'meProfile'] as const,
  effectiveAuthz: () => ['auth', 'effectiveAuthz'] as const,

  facultades: () => ['meta', 'facultades'] as const,
  carreras: (facultadId?: string | null) =>
    ['meta', 'carreras', { facultadId: facultadId ?? null }] as const,
  lineasSugeridas: (facultadId: string) =>
    ['meta', 'lineasSugeridas', facultadId] as const,
  estructurasPlan: (nivel?: string | null) =>
    ['meta', 'estructurasPlan', { nivel: nivel ?? null }] as const,
  estructurasPlanList: (nivel?: string | null) =>
    ['meta', 'estructurasPlanList', { nivel: nivel ?? null }] as const,
  estructurasAsignatura: (estructuraPlanId?: string | null) =>
    [
      'meta',
      'estructurasAsignatura',
      { estructuraPlanId: estructuraPlanId ?? null },
    ] as const,
  estadosPlan: () => ['meta', 'estadosPlan'] as const,

  planesList: (filters: unknown) => ['planes', 'list', filters] as const,
  planesEstadosDisponibles: (filters: unknown) =>
    ['planes', 'estadosDisponibles', filters] as const,
  plan: (planId: string) => ['planes', 'detail', planId] as const,
  planMaybe: (planId: string) => ['planes', 'detail-maybe', planId] as const,
  planLineas: (planId: string) => ['planes', planId, 'lineas'] as const,
  planAsignaturas: (planId: string) =>
    ['planes', planId, 'asignaturas'] as const,
  planHistorial: (planId: string) => ['planes', planId, 'historial'] as const,
  planDocumento: (planId: string) => ['planes', planId, 'documento'] as const,
  borradoresCampo: (entidad: 'plan' | 'asignatura', id: string) =>
    ['borradoresCampo', entidad, id] as const,

  catalogoAsignaturas: (filters: unknown) =>
    ['asignaturas', 'catalogo', filters] as const,
  sugerenciasAsignaturas: () => ['asignaturas', 'sugerencias'] as const,
  asignatura: (asignaturaId: string) =>
    ['asignaturas', 'detail', asignaturaId] as const,
  asignaturaMaybe: (asignaturaId: string) =>
    ['asignaturas', 'detail-maybe', asignaturaId] as const,
  asignaturasArchivadas: (planId: string) =>
    ['asignaturas', 'archivadas', planId] as const,
  asignaturaBibliografia: (asignaturaId: string) =>
    ['asignaturas', asignaturaId, 'bibliografia'] as const,
  asignaturaHistorial: (asignaturaId: string) =>
    ['asignaturas', asignaturaId, 'historial'] as const,
  asignaturaDocumento: (asignaturaId: string) =>
    ['asignaturas', asignaturaId, 'documento'] as const,

  usuarios: () => ['usuarios', 'list'] as const,
  usuariosCatalogos: () => ['usuarios', 'catalogos'] as const,
  usuarioRelaciones: (id: string) => ['usuarios', 'relaciones', id] as const,
  // Versión (timestamp) del avatar de un usuario. La foto vive en Storage en una
  // ruta determinista por id; este slot solo fuerza el cache-busting al subir.
  usuarioAvatar: (id: string) => ['usuarios', 'avatar', id] as const,

  responsablesAsignatura: (asignaturaId: string) =>
    ['asignaturas', asignaturaId, 'responsables'] as const,
  asignaturasAsignables: () => ['asignaturas', 'asignables'] as const,

  tareas: () => ['tareas', 'mias'] as const,
  notificaciones: () => ['notificaciones', 'mias'] as const,

  // Flujo y estados
  roles: () => ['admin', 'roles'] as const,
  permisos: () => ['admin', 'permisos'] as const,
  rolesPermisos: () => ['admin', 'rolesPermisos'] as const,
  transiciones: () => ['flujo', 'transiciones'] as const,
  transicionesPermitidas: (planId: string) =>
    ['flujo', 'transicionesPermitidas', planId] as const,
  comentariosPlan: (planId: string) =>
    ['planes', planId, 'comentarios'] as const,
  comentariosAsignatura: (asignaturaId: string) =>
    ['asignaturas', asignaturaId, 'comentarios'] as const,
  expertos: () => ['expertos', 'list'] as const,
  planExpertos: (planId: string) => ['planes', planId, 'expertos'] as const,
}
