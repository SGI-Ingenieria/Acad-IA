export const qk = {
  auth: ['auth'] as const,
  session: () => ['auth', 'session'] as const,
  meProfile: () => ['auth', 'meProfile'] as const,
  effectiveAuthz: () => ['auth', 'effectiveAuthz'] as const,

  // Roots por prefijo: para cancel/snapshot/invalidate de familias completas.
  planesRoot: () => ['planes'] as const,
  asignaturasRoot: () => ['asignaturas'] as const,
  usuariosRoot: () => ['usuarios'] as const,
  usuarioRelacionesRoot: () => ['usuarios', 'relaciones'] as const,
  carrerasRoot: () => ['meta', 'carreras'] as const,
  estructurasPlanListRoot: () => ['meta', 'estructurasPlanList'] as const,
  estructurasAsignaturaRoot: () => ['meta', 'estructurasAsignatura'] as const,
  transicionesPermitidasRoot: () =>
    ['flujo', 'transicionesPermitidas'] as const,

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

  planesListRoot: () => ['planes', 'list'] as const,
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
  planRegistroOficial: (planId: string) =>
    ['planes', planId, 'registroOficial'] as const,
  registrosOficiales: () => ['planes', 'registrosOficiales'] as const,
  // Bajo el prefijo 'planes': depende de los planes, no del catálogo de carreras.
  carreraTienePlanes: (carreraId: string) =>
    ['planes', 'carreraTienePlanes', carreraId] as const,
  borradoresCampo: (entidad: 'plan' | 'asignatura', id: string) =>
    ['borradoresCampo', entidad, id] as const,

  planChatHistory: (conversationId?: string | null) =>
    ['chats', 'plan', 'history', conversationId ?? null] as const,
  planConversationsRoot: () => ['chats', 'plan', 'conversations'] as const,
  planConversations: (planId?: string | null) =>
    ['chats', 'plan', 'conversations', planId ?? null] as const,
  planMessagesRoot: () => ['chats', 'plan', 'messages'] as const,
  planMessages: (conversationId?: string | null) =>
    ['chats', 'plan', 'messages', conversationId ?? null] as const,
  subjectConversationsRoot: () =>
    ['chats', 'subject', 'conversations'] as const,
  subjectConversations: (subjectId?: string | null) =>
    ['chats', 'subject', 'conversations', subjectId ?? null] as const,
  subjectMessagesRoot: () => ['chats', 'subject', 'messages'] as const,
  subjectMessages: (conversationId?: string | null) =>
    ['chats', 'subject', 'messages', conversationId ?? null] as const,

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
  asignaturaRecursos: (asignaturaId: string) =>
    ['asignaturas', asignaturaId, 'recursos'] as const,
  asignaturaLearningScores: (asignaturaId: string) =>
    ['asignaturas', asignaturaId, 'learning_scores'] as const,
  asignaturaLearningJobs: (asignaturaId: string) =>
    ['asignaturas', asignaturaId, 'learning_jobs'] as const,

  usuarios: () => ['usuarios', 'list'] as const,
  usuariosCatalogos: () => ['usuarios', 'catalogos'] as const,
  usuarioRelaciones: (id: string) => ['usuarios', 'relaciones', id] as const,
  rolSimulacionAsignaturas: (filters: unknown) =>
    ['usuarios', 'simulacion', 'asignaturas', filters] as const,
  // Versión (timestamp) del avatar de un usuario. La foto vive en Storage en una
  // ruta determinista por id; este slot solo fuerza el cache-busting al subir.
  usuarioAvatar: (id: string) => ['usuarios', 'avatar', id] as const,

  responsablesAsignatura: (asignaturaId: string) =>
    ['asignaturas', asignaturaId, 'responsables'] as const,
  asignaturasAsignables: () => ['asignaturas', 'asignables'] as const,

  tareas: () => ['tareas', 'mias'] as const,
  notificaciones: () => ['notificaciones', 'mias'] as const,

  observabilityPublic: () => ['observability', 'public'] as const,
  observabilitySnapshot: () => ['observability', 'snapshot'] as const,

  // Flujo y estados
  roles: () => ['admin', 'roles'] as const,
  permisos: () => ['admin', 'permisos'] as const,
  rolesPermisos: () => ['admin', 'rolesPermisos'] as const,
  transiciones: () => ['flujo', 'transiciones'] as const,
  transicionesPermitidas: (planId: string) =>
    ['flujo', 'transicionesPermitidas', planId] as const,
  comentariosPlan: (planId: string, asignaturaId?: string | null | undefined) =>
    [
      'planes',
      planId,
      'comentarios',
      { asignaturaId: asignaturaId ?? null },
    ] as const,
  comentariosAsignatura: (asignaturaId: string) =>
    ['asignaturas', asignaturaId, 'comentarios'] as const,
  expertos: () => ['expertos', 'list'] as const,
  planExpertos: (planId: string) => ['planes', planId, 'expertos'] as const,

  // Referencias: archivos IA, repositorios (vector stores) y plantillas
  archivosRoot: () => ['archivos'] as const,
  archivos: (filters: unknown) => ['archivos', 'list', filters] as const,
  repositoriosRoot: () => ['repositorios'] as const,
  repositorios: () => ['repositorios', 'list'] as const,
  repositorioFiles: (repositorioId: string) =>
    ['repositorios', repositorioId, 'archivos'] as const,
  vectorStores: () => ['vectorStores', 'list'] as const,
  vectorStoreFiles: (vectorStoreId: string) =>
    ['vectorStores', vectorStoreId, 'archivos'] as const,
  documentosRoot: () => ['documentos'] as const,
  documentos: () => ['documentos', 'list'] as const,
  bibliotecaReferencias: (filters: unknown) =>
    ['documentos', 'biblioteca', filters] as const,
  coleccionesDocumentales: () => ['documentos', 'colecciones'] as const,
  archivosConversacion: (
    conversationType: 'plan' | 'asignatura',
    conversationId?: string,
  ) =>
    [
      'documentos',
      'conversacion',
      conversationType,
      conversationId ?? null,
    ] as const,
  interaccionesRecientes: (limit: number) =>
    ['interaccionesIa', 'recientes', limit] as const,
  plantillas: (estructuraId: string, kind: string) =>
    ['plantillas', kind, estructuraId] as const,

  // Paquetes de contenidos: render de previsualización (action 'preview' del
  // edge learning-package-export, idempotente y sin efectos persistentes).
  paquetePreview: (asignaturaId: string, objectIds: Array<string>) =>
    ['paquetes', 'preview', asignaturaId, objectIds] as const,
}

/**
 * Mutation keys (`mk`): identifican familias de mutación para deduplicar
 * toasts de error, reintentar desde el MutationCache global y proteger la
 * caché de escrituras concurrentes (p. ej. saltar eventos Realtime mientras
 * hay una mutación optimista en vuelo vía `queryClient.isMutating`).
 * Son estáticas por hook; la entidad concreta se distingue con el `scope` de
 * `optimisticMutation`. Crece una entrada por mutación migrada.
 */
export const mk = {
  planFields: () => ['planes', 'updateFields'] as const,
  planMapa: () => ['planes', 'updateMapa'] as const,
  planDelete: () => ['planes', 'delete'] as const,
  lineaCreate: () => ['planes', 'lineas', 'create'] as const,
  lineaDelete: () => ['planes', 'lineas', 'delete'] as const,
  asignaturaUpdate: () => ['asignaturas', 'update'] as const,
  subjectFields: () => ['asignaturas', 'updateFields'] as const,
  subjectContenido: () => ['asignaturas', 'updateContenido'] as const,
  bibliografiaCreate: () => ['asignaturas', 'bibliografia', 'create'] as const,
  bibliografiaUpdate: () => ['asignaturas', 'bibliografia', 'update'] as const,
  bibliografiaDelete: () => ['asignaturas', 'bibliografia', 'delete'] as const,

  // Catálogos (useMeta)
  facultadSave: () => ['meta', 'facultades', 'save'] as const,
  facultadArchive: () => ['meta', 'facultades', 'archive'] as const,
  carreraSave: () => ['meta', 'carreras', 'save'] as const,
  carreraArchive: () => ['meta', 'carreras', 'archive'] as const,
  lineaSugeridaSave: () => ['meta', 'lineasSugeridas', 'save'] as const,
  lineaSugeridaArchive: () => ['meta', 'lineasSugeridas', 'archive'] as const,
  estructuraPlanSave: () => ['meta', 'estructurasPlan', 'save'] as const,
  estructuraAsignaturaSave: () =>
    ['meta', 'estructurasAsignatura', 'save'] as const,

  // Micro-acciones personales
  tareaCompletar: () => ['tareas', 'completar'] as const,
  notificacionLeer: () => ['notificaciones', 'leer'] as const,

  // Recursos, borradores, responsables, plantillas
  recursoUpdate: () => ['recursos', 'update'] as const,
  recursoDelete: () => ['recursos', 'delete'] as const,
  borradorUpsert: () => ['borradoresCampo', 'upsert'] as const,
  borradorDelete: () => ['borradoresCampo', 'delete'] as const,
  responsableAdd: () => ['responsables', 'add'] as const,
  responsableRemove: () => ['responsables', 'remove'] as const,
  plantillaUpload: () => ['plantillas', 'upload'] as const,
  plantillaDelete: () => ['plantillas', 'delete'] as const,

  // Referencias y chats IA
  archivoDelete: () => ['archivos', 'delete'] as const,
  repositorioCreate: () => ['repositorios', 'create'] as const,
  conversacionEstado: () => ['chats', 'conversacion', 'estado'] as const,
  conversacionTitulo: () => ['chats', 'conversacion', 'titulo'] as const,
  recomendacionAplicada: () => ['chats', 'recomendacion', 'aplicada'] as const,

  // Workflow: comentarios y expertos
  comentarioCrear: () => ['comentarios', 'crear'] as const,
  comentarioResuelto: () => ['comentarios', 'resuelto'] as const,
  expertoSave: () => ['expertos', 'save'] as const,
  planExpertoLink: () => ['planes', 'expertos', 'link'] as const,
}
