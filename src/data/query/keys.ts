export const qk = {
  auth: ['auth'] as const,
  session: () => ['auth', 'session'] as const,
  meProfile: () => ['auth', 'meProfile'] as const,

  facultades: () => ['meta', 'facultades'] as const,
  carreras: (facultadId?: string | null) =>
    ['meta', 'carreras', { facultadId: facultadId ?? null }] as const,
  estructurasPlan: (nivel?: string | null) =>
    ['meta', 'estructurasPlan', { nivel: nivel ?? null }] as const,
  estructurasAsignatura: () => ['meta', 'estructurasAsignatura'] as const,
  estadosPlan: () => ['meta', 'estadosPlan'] as const,

  planesList: (filters: unknown) => ['planes', 'list', filters] as const,
  plan: (planId: string) => ['planes', 'detail', planId] as const,
  planMaybe: (planId: string) => ['planes', 'detail-maybe', planId] as const,
  planLineas: (planId: string) => ['planes', planId, 'lineas'] as const,
  planAsignaturas: (planId: string) =>
    ['planes', planId, 'asignaturas'] as const,
  planHistorial: (planId: string) => ['planes', planId, 'historial'] as const,
  planDocumento: (planId: string) => ['planes', planId, 'documento'] as const,

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

  tareas: () => ['tareas', 'mias'] as const,
  notificaciones: () => ['notificaciones', 'mias'] as const,
}
