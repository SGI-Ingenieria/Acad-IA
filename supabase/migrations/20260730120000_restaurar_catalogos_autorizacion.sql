-- Restaura los datos base de autorización que se perdieron al consolidar las
-- migraciones históricas. La operación es aditiva para no sobrescribir
-- personalizaciones realizadas desde Administración > Roles y permisos.

insert into public.roles (
  clave,
  nombre,
  descripcion,
  nivel_jerarquico,
  alcance_default
)
values
  ('ADMIN', 'Administrador', 'Acceso total al sistema', 0, 'global'),
  (
    'VICERRECTOR_ACADEMICO',
    'Vicerrector Académico',
    'Supervisa todas las facultades y direcciones académicas',
    10,
    'global'
  ),
  (
    'DIRECTOR_FACULTAD',
    'Director de Facultad',
    'Gestiona planes y usuarios de una facultad',
    20,
    'facultad'
  ),
  (
    'SECRETARIO_ACADEMICO',
    'Secretario Académico',
    'Revisa, valida y da seguimiento académico a planes',
    30,
    'facultad'
  ),
  (
    'PLANEACION_CURRICULAR',
    'Planeación Curricular',
    'Acompaña y valida la redacción curricular; enlace con la SEP',
    35,
    'global'
  ),
  (
    'JEFE_CARRERA',
    'Jefe de Carrera',
    'Gestiona planes de estudio de una carrera',
    40,
    'carrera'
  ),
  (
    'JEFE_POSGRADO',
    'Jefe de Posgrado',
    'Gestiona planes, asignaturas y profesorado de posgrado dentro de una facultad',
    40,
    'facultad'
  ),
  (
    'COORD_DHP',
    'Coordinación de Desarrollo Humano Profesional',
    'Gestiona materias de desarrollo humano profesional propagadas a los planes',
    45,
    'facultad'
  ),
  (
    'PROFESOR',
    'Profesor',
    'Responsable o coautor de asignaturas',
    50,
    'asignatura'
  ),
  (
    'EVALUADOR_EXTERNO',
    'Evaluador Externo',
    'Consulta planes asignados y registra retroalimentación externa',
    60,
    'externo'
  )
on conflict (clave) do nothing;

insert into public.permisos (
  clave,
  nombre,
  descripcion,
  grupo,
  orden
)
values
  (
    'archivos.ver',
    'Ver archivos',
    'Consultar repositorios y archivos de referencia propios o compartidos',
    'archivos',
    10
  ),
  (
    'archivos.gestionar',
    'Gestionar archivos',
    'Crear, actualizar y retirar repositorios y archivos de referencia',
    'archivos',
    20
  ),
  (
    'asignaturas.ver',
    'Ver asignaturas',
    'Consultar asignaturas dentro del alcance',
    'asignaturas',
    10
  ),
  (
    'asignaturas.editar',
    'Editar asignaturas',
    'Crear o modificar asignaturas y contenido académico',
    'asignaturas',
    20
  ),
  (
    'asignaturas.recursos.generar',
    'Generar recursos de aprendizaje',
    'Generar objetos de aprendizaje asociados a unidades y temas',
    'asignaturas',
    25
  ),
  (
    'asignaturas.recursos.gestionar',
    'Gestionar recursos de aprendizaje',
    'Editar, revisar, publicar y archivar recursos generados',
    'asignaturas',
    26
  ),
  (
    'asignaturas.responsables.gestionar',
    'Gestionar responsables de asignatura',
    'Asignar profesores responsables, coautores y revisores',
    'asignaturas',
    30
  ),
  (
    'asignaturas.aprobar',
    'Aprobar asignaturas',
    'Aprobar o devolver asignaturas en revisión',
    'asignaturas',
    40
  ),
  (
    'auditoria.ver',
    'Ver trazabilidad',
    'Consultar historial de cambios y autoría',
    'auditoria',
    10
  ),
  (
    'catalogos.gestionar',
    'Gestionar catálogos',
    'Administrar facultades, carreras, estructuras y estados',
    'catalogos',
    10
  ),
  (
    'ia.usar',
    'Usar IA',
    'Generar o mejorar contenido académico con IA',
    'ia',
    10
  ),
  (
    'planes.ver',
    'Ver planes',
    'Consultar planes de estudio dentro del alcance',
    'planes',
    10
  ),
  (
    'planes.crear',
    'Crear planes',
    'Crear planes de estudio dentro del alcance',
    'planes',
    20
  ),
  (
    'planes.editar',
    'Editar planes',
    'Modificar datos generales, mapas y estructura del plan',
    'planes',
    30
  ),
  (
    'planes.enviar_revision',
    'Enviar a revisión',
    'Enviar planes a revisión académica',
    'planes',
    40
  ),
  (
    'planes.aprobar',
    'Aprobar planes',
    'Aprobar, rechazar o transicionar estados de revisión',
    'planes',
    50
  ),
  (
    'planes.campos_restringidos.editar',
    'Editar campos restringidos',
    'Llenar campos estructurales restringidos por estado del plan',
    'planes',
    60
  ),
  (
    'comentarios.externos.crear',
    'Comentar como externo',
    'Registrar observaciones y retroalimentación externa',
    'revision',
    10
  ),
  (
    'comentarios.crear',
    'Comentar planes y materias',
    'Registrar observaciones internas por fase del flujo',
    'revision',
    20
  ),
  (
    'expertos.gestionar',
    'Gestionar expertos y sedes',
    'Registrar expertos/sedes e invitarlos a participar en un plan',
    'revision',
    30
  ),
  (
    'usuarios.ver',
    'Ver usuarios',
    'Consultar perfiles, estados y alcances de usuarios',
    'usuarios',
    10
  ),
  (
    'usuarios.gestionar',
    'Gestionar usuarios',
    'Crear, reactivar, dar de baja e invitar usuarios',
    'usuarios',
    20
  ),
  (
    'usuarios.roles.gestionar',
    'Gestionar roles',
    'Asignar y retirar roles y alcances institucionales',
    'usuarios',
    30
  )
on conflict (clave) do nothing;

with matriz(rol_clave, permisos) as (
  values
    (
      'ADMIN',
      array[
        'archivos.gestionar',
        'archivos.ver',
        'asignaturas.aprobar',
        'asignaturas.editar',
        'asignaturas.recursos.generar',
        'asignaturas.recursos.gestionar',
        'asignaturas.responsables.gestionar',
        'asignaturas.ver',
        'auditoria.ver',
        'catalogos.gestionar',
        'comentarios.crear',
        'comentarios.externos.crear',
        'expertos.gestionar',
        'ia.usar',
        'planes.aprobar',
        'planes.crear',
        'planes.editar',
        'planes.enviar_revision',
        'planes.ver',
        'usuarios.gestionar',
        'usuarios.roles.gestionar',
        'usuarios.ver'
      ]::text[]
    ),
    (
      'VICERRECTOR_ACADEMICO',
      array[
        'asignaturas.recursos.generar',
        'asignaturas.recursos.gestionar',
        'asignaturas.ver',
        'auditoria.ver',
        'catalogos.gestionar',
        'comentarios.crear',
        'planes.aprobar',
        'planes.ver',
        'usuarios.gestionar',
        'usuarios.roles.gestionar',
        'usuarios.ver'
      ]::text[]
    ),
    (
      'DIRECTOR_FACULTAD',
      array[
        'archivos.gestionar',
        'archivos.ver',
        'asignaturas.aprobar',
        'asignaturas.recursos.generar',
        'asignaturas.recursos.gestionar',
        'asignaturas.ver',
        'auditoria.ver',
        'catalogos.gestionar',
        'comentarios.crear',
        'expertos.gestionar',
        'ia.usar',
        'planes.aprobar',
        'planes.crear',
        'planes.enviar_revision',
        'planes.ver',
        'usuarios.gestionar',
        'usuarios.roles.gestionar',
        'usuarios.ver'
      ]::text[]
    ),
    (
      'SECRETARIO_ACADEMICO',
      array[
        'archivos.gestionar',
        'archivos.ver',
        'asignaturas.aprobar',
        'asignaturas.editar',
        'asignaturas.recursos.generar',
        'asignaturas.recursos.gestionar',
        'asignaturas.ver',
        'auditoria.ver',
        'catalogos.gestionar',
        'comentarios.crear',
        'expertos.gestionar',
        'ia.usar',
        'planes.aprobar',
        'planes.editar',
        'planes.enviar_revision',
        'planes.ver',
        'usuarios.gestionar',
        'usuarios.roles.gestionar',
        'usuarios.ver'
      ]::text[]
    ),
    (
      'PLANEACION_CURRICULAR',
      array[
        'asignaturas.recursos.generar',
        'asignaturas.recursos.gestionar',
        'asignaturas.ver',
        'auditoria.ver',
        'comentarios.crear',
        'comentarios.externos.crear',
        'planes.aprobar',
        'planes.ver'
      ]::text[]
    ),
    (
      'JEFE_CARRERA',
      array[
        'archivos.gestionar',
        'archivos.ver',
        'asignaturas.aprobar',
        'asignaturas.editar',
        'asignaturas.recursos.generar',
        'asignaturas.recursos.gestionar',
        'asignaturas.responsables.gestionar',
        'asignaturas.ver',
        'auditoria.ver',
        'catalogos.gestionar',
        'comentarios.crear',
        'expertos.gestionar',
        'ia.usar',
        'planes.aprobar',
        'planes.crear',
        'planes.editar',
        'planes.enviar_revision',
        'planes.ver',
        'usuarios.gestionar',
        'usuarios.ver'
      ]::text[]
    ),
    (
      'JEFE_POSGRADO',
      array[
        'archivos.gestionar',
        'archivos.ver',
        'asignaturas.aprobar',
        'asignaturas.editar',
        'asignaturas.recursos.generar',
        'asignaturas.recursos.gestionar',
        'asignaturas.responsables.gestionar',
        'asignaturas.ver',
        'auditoria.ver',
        'catalogos.gestionar',
        'comentarios.crear',
        'expertos.gestionar',
        'ia.usar',
        'planes.aprobar',
        'planes.crear',
        'planes.editar',
        'planes.enviar_revision',
        'planes.ver',
        'usuarios.gestionar',
        'usuarios.ver'
      ]::text[]
    ),
    (
      'COORD_DHP',
      array[
        'asignaturas.aprobar',
        'asignaturas.recursos.generar',
        'asignaturas.recursos.gestionar',
        'asignaturas.responsables.gestionar',
        'asignaturas.ver',
        'auditoria.ver',
        'comentarios.crear',
        'planes.ver'
      ]::text[]
    ),
    (
      'PROFESOR',
      array[
        'archivos.gestionar',
        'archivos.ver',
        'asignaturas.recursos.generar',
        'asignaturas.recursos.gestionar',
        'asignaturas.ver',
        'auditoria.ver',
        'comentarios.crear',
        'planes.ver'
      ]::text[]
    ),
    (
      'EVALUADOR_EXTERNO',
      array[
        'asignaturas.ver',
        'comentarios.externos.crear',
        'planes.ver'
      ]::text[]
    )
),
relaciones as (
  select m.rol_clave, unnest(m.permisos) as permiso_clave
  from matriz m
)
insert into public.roles_permisos (rol_id, permiso_id)
select r.id, p.id
from relaciones rel
join public.roles r on r.clave = rel.rol_clave
join public.permisos p on p.clave = rel.permiso_clave
on conflict (rol_id, permiso_id) do nothing;
