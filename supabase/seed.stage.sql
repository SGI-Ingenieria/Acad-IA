-- Acad-IA stage seed
-- Datos base idempotentes para Dokploy. Esta es la fuente canónica de los
-- catálogos operativos y de los catálogos académicos que deben sobrevivir a
-- cualquier migration squash.
--
-- Facultades, carreras y estructuras se recuperan tal cual del Supabase
-- productivo (proyecto exdkssurzmjnnhgtiama). Se usa ON CONFLICT DO NOTHING
-- para que re-ejecutar la semilla sea idempotente sin disparar triggers de
-- actualización (guards de catálogo) que requieren sesión JWT.

BEGIN;

SET LOCAL search_path = public, extensions;

-- Reseed administrativo: el upsert de carreras puede cambiar nombre/nivel y
-- disparar el refresh de planes_estudio.nombre_display, que la validación
-- fn_validar_datos_plan sólo permite en contexto service_role. Declaramos ese
-- contexto (scoped a la transacción) para que la semilla realinee catálogos.
SET LOCAL "request.jwt.claims" = '{"role":"service_role"}';

-- ---------------------------------------------------------------------------
-- Catálogos e infraestructura operativa
-- ---------------------------------------------------------------------------
-- migration squash usa un volcado de esquema y omite estas filas. Por eso su
-- fuente canónica está en esta semilla de stage y todas las operaciones son
-- idempotentes.

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

-- Restaura los estados y transiciones base que se perdieron al consolidar las
-- migraciones históricas. No modifica estados ni transiciones ya existentes.

insert into public.estados_plan (
  clave,
  etiqueta,
  orden,
  es_final,
  es_campo_editable,
  color
)
values
  ('FALLIDO', 'Generación fallida', -10, false, false, '#f87171'),
  ('GENERANDO', 'Generando con IA', 0, false, false, '#fb923c'),
  (
    'BORRADOR',
    'Borrador del jefe de carrera',
    10,
    false,
    true,
    '#94a3b8'
  ),
  (
    'REVISION',
    'En revisión de secretario académico',
    20,
    false,
    true,
    '#f59e0b'
  ),
  (
    'REV_PLANEACION',
    'En revisión de Planeación Curricular',
    30,
    false,
    true,
    '#eab308'
  ),
  (
    'REV_VICERRECTORIA',
    'En revisión de Vicerrectoría Académica',
    35,
    false,
    true,
    '#8b5cf6'
  ),
  (
    'CONSULTA_EXPERTOS',
    'En consulta con expertos externos',
    40,
    false,
    true,
    '#a855f7'
  ),
  (
    'REV_SEDES',
    'En revisión de otras sedes',
    50,
    false,
    true,
    '#8b5cf6'
  ),
  (
    'CONSEJO_FACULTAD',
    'En Consejo Académico de Facultad',
    60,
    false,
    true,
    '#3b82f6'
  ),
  (
    'CONSEJO_UNIVERSITARIO',
    'En Consejo Universitario',
    70,
    false,
    true,
    '#2563eb'
  ),
  (
    'JUNTA_GOBIERNO',
    'En Junta de Gobierno',
    80,
    false,
    true,
    '#1d4ed8'
  ),
  (
    'ENVIADO_SEP',
    'En dialogo por ACERT',
    90,
    false,
    true,
    '#0ea5e9'
  ),
  ('APROBADO', 'Aprobado por SEP', 100, true, false, '#22c55e'),
  ('RECHAZADO', 'Rechazado', 110, true, false, '#ef4444')
on conflict (clave) do nothing;

with flujo(tipo, desde, hacia, rol) as (
  values
    (
      'CURRICULAR'::public.tipo_estructura_plan,
      'BORRADOR',
      'REVISION',
      'JEFE_CARRERA'
    ),
    (
      'CURRICULAR'::public.tipo_estructura_plan,
      'REVISION',
      'BORRADOR',
      'SECRETARIO_ACADEMICO'
    ),
    (
      'CURRICULAR'::public.tipo_estructura_plan,
      'REVISION',
      'REV_PLANEACION',
      'SECRETARIO_ACADEMICO'
    ),
    (
      'CURRICULAR'::public.tipo_estructura_plan,
      'REV_PLANEACION',
      'BORRADOR',
      'PLANEACION_CURRICULAR'
    ),
    (
      'CURRICULAR'::public.tipo_estructura_plan,
      'REV_PLANEACION',
      'CONSULTA_EXPERTOS',
      'PLANEACION_CURRICULAR'
    ),
    (
      'CURRICULAR'::public.tipo_estructura_plan,
      'CONSULTA_EXPERTOS',
      'BORRADOR',
      'DIRECTOR_FACULTAD'
    ),
    (
      'CURRICULAR'::public.tipo_estructura_plan,
      'CONSULTA_EXPERTOS',
      'BORRADOR',
      'SECRETARIO_ACADEMICO'
    ),
    (
      'CURRICULAR'::public.tipo_estructura_plan,
      'CONSULTA_EXPERTOS',
      'REV_SEDES',
      'DIRECTOR_FACULTAD'
    ),
    (
      'CURRICULAR'::public.tipo_estructura_plan,
      'CONSULTA_EXPERTOS',
      'REV_SEDES',
      'SECRETARIO_ACADEMICO'
    ),
    (
      'CURRICULAR'::public.tipo_estructura_plan,
      'REV_SEDES',
      'BORRADOR',
      'DIRECTOR_FACULTAD'
    ),
    (
      'CURRICULAR'::public.tipo_estructura_plan,
      'REV_SEDES',
      'BORRADOR',
      'SECRETARIO_ACADEMICO'
    ),
    (
      'CURRICULAR'::public.tipo_estructura_plan,
      'REV_SEDES',
      'CONSEJO_FACULTAD',
      'DIRECTOR_FACULTAD'
    ),
    (
      'CURRICULAR'::public.tipo_estructura_plan,
      'REV_SEDES',
      'CONSEJO_FACULTAD',
      'SECRETARIO_ACADEMICO'
    ),
    (
      'CURRICULAR'::public.tipo_estructura_plan,
      'CONSEJO_FACULTAD',
      'BORRADOR',
      'DIRECTOR_FACULTAD'
    ),
    (
      'CURRICULAR'::public.tipo_estructura_plan,
      'CONSEJO_FACULTAD',
      'CONSEJO_UNIVERSITARIO',
      'DIRECTOR_FACULTAD'
    ),
    (
      'CURRICULAR'::public.tipo_estructura_plan,
      'CONSEJO_FACULTAD',
      'RECHAZADO',
      'DIRECTOR_FACULTAD'
    ),
    (
      'CURRICULAR'::public.tipo_estructura_plan,
      'CONSEJO_UNIVERSITARIO',
      'BORRADOR',
      'VICERRECTOR_ACADEMICO'
    ),
    (
      'CURRICULAR'::public.tipo_estructura_plan,
      'CONSEJO_UNIVERSITARIO',
      'JUNTA_GOBIERNO',
      'VICERRECTOR_ACADEMICO'
    ),
    (
      'CURRICULAR'::public.tipo_estructura_plan,
      'CONSEJO_UNIVERSITARIO',
      'RECHAZADO',
      'VICERRECTOR_ACADEMICO'
    ),
    (
      'CURRICULAR'::public.tipo_estructura_plan,
      'JUNTA_GOBIERNO',
      'BORRADOR',
      'VICERRECTOR_ACADEMICO'
    ),
    (
      'CURRICULAR'::public.tipo_estructura_plan,
      'JUNTA_GOBIERNO',
      'ENVIADO_SEP',
      'VICERRECTOR_ACADEMICO'
    ),
    (
      'CURRICULAR'::public.tipo_estructura_plan,
      'JUNTA_GOBIERNO',
      'RECHAZADO',
      'VICERRECTOR_ACADEMICO'
    ),
    (
      'CURRICULAR'::public.tipo_estructura_plan,
      'ENVIADO_SEP',
      'APROBADO',
      'PLANEACION_CURRICULAR'
    ),
    (
      'CURRICULAR'::public.tipo_estructura_plan,
      'ENVIADO_SEP',
      'BORRADOR',
      'PLANEACION_CURRICULAR'
    ),
    (
      'CURRICULAR'::public.tipo_estructura_plan,
      'ENVIADO_SEP',
      'RECHAZADO',
      'PLANEACION_CURRICULAR'
    ),
    (
      'NO_CURRICULAR'::public.tipo_estructura_plan,
      'BORRADOR',
      'REV_PLANEACION',
      'JEFE_CARRERA'
    ),
    (
      'NO_CURRICULAR'::public.tipo_estructura_plan,
      'REV_PLANEACION',
      'BORRADOR',
      'PLANEACION_CURRICULAR'
    ),
    (
      'NO_CURRICULAR'::public.tipo_estructura_plan,
      'REV_PLANEACION',
      'RECHAZADO',
      'PLANEACION_CURRICULAR'
    ),
    (
      'NO_CURRICULAR'::public.tipo_estructura_plan,
      'REV_PLANEACION',
      'REV_VICERRECTORIA',
      'PLANEACION_CURRICULAR'
    ),
    (
      'NO_CURRICULAR'::public.tipo_estructura_plan,
      'REV_VICERRECTORIA',
      'APROBADO',
      'VICERRECTOR_ACADEMICO'
    ),
    (
      'NO_CURRICULAR'::public.tipo_estructura_plan,
      'REV_VICERRECTORIA',
      'BORRADOR',
      'VICERRECTOR_ACADEMICO'
    ),
    (
      'NO_CURRICULAR'::public.tipo_estructura_plan,
      'REV_VICERRECTORIA',
      'RECHAZADO',
      'VICERRECTOR_ACADEMICO'
    )
)
insert into public.transiciones_estado_plan (
  desde_estado_id,
  hacia_estado_id,
  rol_permitido_id,
  tipo_estructura
)
select
  estado_desde.id,
  estado_hacia.id,
  rol.id,
  flujo.tipo
from flujo
join public.estados_plan estado_desde on estado_desde.clave = flujo.desde
join public.estados_plan estado_hacia on estado_hacia.clave = flujo.hacia
join public.roles rol on rol.clave = flujo.rol
on conflict (
  desde_estado_id,
  hacia_estado_id,
  rol_permitido_id,
  tipo_estructura
) do nothing;

-- Tenant documental canónico. El conflicto por slug conserva el id existente
-- en producción y sólo normaliza el nombre.
insert into public.tenants (id, slug, nombre)
values (
  '2499eb75-2416-4aa5-acb3-9f18dd379c62',
  'acad-ia',
  'Acad-IA'
)
on conflict (slug) do update
set nombre = excluded.nombre;

-- Repara usuarios históricos que todavía no tienen un tenant predeterminado.
insert into public.tenant_memberships (tenant_id, user_id, is_default)
select tenant.id, usuario.id, true
from public.tenants tenant
cross join public.usuarios_app usuario
where tenant.slug = 'acad-ia'
  and not exists (
    select 1
    from public.tenant_memberships membership
    where membership.user_id = usuario.id
      and membership.is_default
  )
on conflict (tenant_id, user_id) do update
set is_default = excluded.is_default;

-- Las filas de storage.buckets son datos y pg_dump --schema-only no las
-- conserva al hacer squash. Los COALESCE respetan restricciones más estrictas
-- ya configuradas en un entorno existente.
insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values
  ('avatars', 'avatars', true, null, null),
  (
    'comentarios-adjuntos',
    'comentarios-adjuntos',
    false,
    25 * 1024 * 1024,
    null
  ),
  (
    'documentos-academicos',
    'documentos-academicos',
    false,
    20 * 1024 * 1024,
    array[
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain',
      'text/markdown',
      'text/csv',
      'application/json',
      'image/png',
      'image/jpeg',
      'image/webp'
    ]::text[]
  ),
  ('documentos-oficiales', 'documentos-oficiales', false, null, null),
  ('learning-packages', 'learning-packages', false, null, null),
  -- Imágenes didácticas consumidas fuera de la sesión en paquetes SCORM.
  ('learning-media', 'learning-media', true, null, null)
on conflict (id) do update
set
  name = excluded.name,
  public = excluded.public,
  file_size_limit = coalesce(
    storage.buckets.file_size_limit,
    excluded.file_size_limit
  ),
  allowed_mime_types = coalesce(
    storage.buckets.allowed_mime_types,
    excluded.allowed_mime_types
  );

-- PGMQ y pg_cron guardan su configuración como datos administrados. El bloque
-- DO no crea funciones persistentes: sólo materializa esas filas al sembrar.
do $bootstrap$
declare
  v_queue text;
  v_job_id bigint;
begin
  foreach v_queue in array array[
    'file-cleanup',
    'file-hashing',
    'openai-sync',
    'vs-warmup'
  ] loop
    if not exists (
      select 1
      from pgmq.list_queues()
      where queue_name = v_queue
    ) then
      perform pgmq.create(v_queue);
    end if;
  end loop;

  perform cron.schedule(
    'purgar-generaciones-ia-90d',
    '0 3 * * *',
    $cron$select public.purgar_trabajos_generacion_ia();$cron$
  );
  perform cron.schedule(
    'higiene-documental-diaria',
    '23 3 * * *',
    $cron$select public.ejecutar_higiene_documental();$cron$
  );
  perform cron.schedule(
    'retencion-operativa-diaria',
    '17 4 * * *',
    $cron$select private.ejecutar_retencion_operativa();$cron$
  );

  v_job_id := cron.schedule(
    'limpiar-paquetes-aprendizaje-diaria',
    '37 4 * * *',
    $cron$select private.invocar_limpieza_paquetes_aprendizaje_si_necesaria();$cron$
  );
  perform cron.alter_job(
    v_job_id,
    active => (
      select count(*) = 3
      from vault.decrypted_secrets
      where name in (
        'AI_RECOVERY_CRON_URL',
        'AI_RECOVERY_CRON_PUBLISHABLE_KEY',
        'AI_RECOVERY_CRON_SECRET'
      )
    )
  );

  v_job_id := cron.schedule(
    'recuperar-generaciones-ia-5m',
    '*/5 * * * *',
    $cron$select private.invocar_recuperacion_ia_si_necesaria();$cron$
  );
  perform cron.alter_job(
    v_job_id,
    active => (
      select count(*) = 3
      from vault.decrypted_secrets
      where name in (
        'AI_RECOVERY_CRON_URL',
        'AI_RECOVERY_CRON_PUBLISHABLE_KEY',
        'AI_RECOVERY_CRON_SECRET'
      )
    )
  );
end;
$bootstrap$;


INSERT INTO public.facultades (
  id,
  nombre,
  nombre_corto,
  prefijo,
  color,
  icono,
  activa
) VALUES
  ('0d711469-4668-4910-b08e-88406ad30c9a', 'Arquitectura, Diseño y Comunicación', 'FAMADYC', NULL, '#EC4899', 'DraftingCompass', true),
  ('cd9409f5-bbcd-466d-82eb-b206cea51b8b', 'Centro de Idiomas', 'CI', NULL, '#2DD4BF', 'Languages', true),
  ('d17b19c6-b7ab-4bdc-8bb9-ddf6f9e0358e', 'Ciencias Químicas', 'FCQ', NULL, '#84CC16', 'FlaskConical', true),
  ('21561e2c-22be-40ec-b0ad-520b5253f846', 'Coordinación de Desarrollo Humano Profesional', 'CDHP', NULL, '#F472B6', 'HeartHandshake', true),
  ('7a162523-1120-4fb9-b291-dfb606c8f1d4', 'Derecho', 'DER', NULL, '#64748B', 'Scale', true),
  ('ab73dbce-e750-4070-82b1-4e71347cd273', 'Escuela de Altos Estudios en Salud', 'EAES', NULL, '#F43F5E', 'Stethoscope', true),
  ('45a15339-dd80-4ef7-ab8a-63c5d844e692', 'Escuela de Ciencias de la Educación', 'EDU', NULL, '#FB7185', 'GraduationCap', true),
  ('d8e1f958-6a3d-4a19-afa8-597755ea7873', 'Escuela de Ciencias Religiosas', 'ECR', NULL, '#0EA5E9', 'BookHeart', true),
  ('a977a640-709d-47d7-a306-9acbe4a867a9', 'Humanidades y Ciencias Sociales', 'HUM', NULL, '#6366F1', 'Users', true),
  ('155b5fe7-9e09-420f-8d9d-ddd8219f193d', 'Ingeniería', 'ING', NULL, '#EF4444', 'Hammer', true),
  ('7884f606-71b0-4f67-92da-bf22e0601480', 'Medicina', 'MED', NULL, '#10B981', 'HeartPulse', true),
  ('45a6da79-1e2d-4854-9953-6229f46c8e82', 'Negocios', 'NEG', NULL, '#2980B9', 'Briefcase', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.carreras (
  id,
  facultad_id,
  nombre,
  nombre_corto,
  clave_sep,
  activa,
  nivel
) VALUES
  ('73f639f2-71a7-4313-ac21-23420eb6f738', '0d711469-4668-4910-b08e-88406ad30c9a', 'Arquitectura', 'ARQ', NULL, true, 'Licenciatura'),
  ('cafa9b44-f894-48c8-8aa5-ac3dab3a384f', '0d711469-4668-4910-b08e-88406ad30c9a', 'Ciencias de la Comunicación', 'LCC', NULL, true, 'Licenciatura'),
  ('0f3366b5-9b05-4104-b87d-46931bd96f22', '0d711469-4668-4910-b08e-88406ad30c9a', 'Comunicación', 'LCOM', NULL, true, 'Licenciatura'),
  ('be807290-075d-40a5-85bf-966ae111e743', '0d711469-4668-4910-b08e-88406ad30c9a', 'Dirección de Proyectos', 'EDP', NULL, true, 'Especialidad'),
  ('624a2927-3f47-4b23-b80d-fe1a7f809b7f', '0d711469-4668-4910-b08e-88406ad30c9a', 'Dirección Estratégica de Comunicación', 'MDEC', NULL, true, 'Maestría'),
  ('88ed9818-552e-4637-a8d6-d6f361451cac', '0d711469-4668-4910-b08e-88406ad30c9a', 'Diseño de Ambientes Interiores y Exteriores', 'LDAI', NULL, true, 'Licenciatura'),
  ('0f3ed17e-38b7-4c4b-b1af-29096cb0215e', '0d711469-4668-4910-b08e-88406ad30c9a', 'Diseño de Productos', 'LDP', NULL, true, 'Licenciatura'),
  ('4d52027e-ce61-4758-b643-448d09d6a1d9', '0d711469-4668-4910-b08e-88406ad30c9a', 'Diseño Gráfico y Digital', 'LDGD', NULL, true, 'Licenciatura'),
  ('ad86cdab-cd81-457a-bbf5-afffec0a28cc', '0d711469-4668-4910-b08e-88406ad30c9a', 'Estrategia e Innovación en Marcas', 'MEIM', NULL, true, 'Maestría'),
  ('b1ffa2d6-1237-4a8a-a01a-5dfbc70f3d90', '0d711469-4668-4910-b08e-88406ad30c9a', 'Gestión y Administración de Proyectos', 'EGAP', NULL, true, 'Especialidad'),
  ('83fcc355-b79b-4650-a757-0c935127e161', '155b5fe7-9e09-420f-8d9d-ddd8219f193d', 'Ciberseguridad', 'MCIB', NULL, true, 'Maestría'),
  ('81278d11-5487-41b3-b8bd-708cdd147ed4', '155b5fe7-9e09-420f-8d9d-ddd8219f193d', 'Dirección Industrial', 'MDI', NULL, true, 'Maestría'),
  ('d8089840-c7ba-4e64-b073-d8d93092424f', '155b5fe7-9e09-420f-8d9d-ddd8219f193d', 'Dirección Industrial', 'EDI', NULL, true, 'Especialidad'),
  ('c8f8c573-ec33-446d-886d-338def5d55af', '155b5fe7-9e09-420f-8d9d-ddd8219f193d', 'Energías Renovables', 'EER', NULL, true, 'Especialidad'),
  ('01552f83-5625-4532-a8ae-723cc864494c', '155b5fe7-9e09-420f-8d9d-ddd8219f193d', 'Gerencia de Proyectos Inmobiliarios', 'MGPI', NULL, true, 'Maestría'),
  ('fbae0d9a-282c-4eb0-bc48-02bb11015d57', '155b5fe7-9e09-420f-8d9d-ddd8219f193d', 'Gestión de Proyectos y de Empresas Constructoras', 'MGPC', NULL, true, 'Maestría'),
  ('76224caa-1203-4b18-b9df-758f1f9a97fb', '155b5fe7-9e09-420f-8d9d-ddd8219f193d', 'Ingeniería Biomédica', 'LIB', NULL, true, 'Licenciatura'),
  ('8f1ce751-949b-45dd-8e38-e10c64b077fd', '155b5fe7-9e09-420f-8d9d-ddd8219f193d', 'Ingeniería Cibernética y Sistemas Computacionales', 'LICS', NULL, true, 'Licenciatura'),
  ('6dcde533-b35b-4c53-b803-e2ccc275a04f', '155b5fe7-9e09-420f-8d9d-ddd8219f193d', 'Ingeniería Civil', 'LIC', NULL, true, 'Licenciatura'),
  ('00f6f9a0-56bc-43e6-a0e7-5ac2c00fbc2a', '155b5fe7-9e09-420f-8d9d-ddd8219f193d', 'Ingeniería Electrónica', 'LIE', NULL, true, 'Licenciatura'),
  ('a607a966-d454-4f08-950e-d8e6ec1e1545', '155b5fe7-9e09-420f-8d9d-ddd8219f193d', 'Ingeniería Electrónica para Sistemas Inteligentes', 'LIES', NULL, true, 'Licenciatura'),
  ('c0fb8394-656f-4709-a92e-351daf477c60', '155b5fe7-9e09-420f-8d9d-ddd8219f193d', 'Ingeniería Industrial', 'LII', NULL, true, 'Licenciatura'),
  ('48220a64-7bd5-4dea-bb95-31f1af9dbcbd', '155b5fe7-9e09-420f-8d9d-ddd8219f193d', 'Ingeniería Mecánica y en Sistemas Energéticos', 'LIME', NULL, true, 'Licenciatura'),
  ('089cdeda-d557-4a57-b49f-eb44921dfa3a', '155b5fe7-9e09-420f-8d9d-ddd8219f193d', 'Ingeniería Mecatrónica', 'MTR', 'MTR_ULSA', true, 'Licenciatura'),
  ('a75b6da6-ad46-43d8-a069-31a203a9d340', '155b5fe7-9e09-420f-8d9d-ddd8219f193d', 'Ingeniería Mecatrónica', 'LIM', NULL, true, 'Licenciatura'),
  ('6a9ae3f4-91ae-4e56-8806-9d9f4692d796', '155b5fe7-9e09-420f-8d9d-ddd8219f193d', 'Inteligencia de Datos', 'EID', NULL, true, 'Especialidad'),
  ('33c850f2-160c-472c-bf14-b39031e8e47e', '21561e2c-22be-40ec-b0ad-520b5253f846', 'Área Curricular Común 2013', 'ACC', NULL, true, 'Otro'),
  ('d65ca933-c6b4-4eb0-98fb-4a61acc49dec', '21561e2c-22be-40ec-b0ad-520b5253f846', 'Área Curricular Común 2021', 'ACC', NULL, true, 'Otro'),
  ('cc757121-41aa-4532-9050-81e8adc7fbb8', '45a6da79-1e2d-4854-9953-6229f46c8e82', 'Actuaría', 'LACT', NULL, true, 'Licenciatura'),
  ('98ac0686-c6cf-4b89-bb7c-616c7d23dc38', '45a6da79-1e2d-4854-9953-6229f46c8e82', 'Administración', 'LADM', NULL, true, 'Licenciatura'),
  ('324f1f4a-8bcc-4b60-b1f5-86364ee00cbb', '45a6da79-1e2d-4854-9953-6229f46c8e82', 'Administración', 'MADM', NULL, true, 'Maestría'),
  ('cf97a7fc-e769-4597-b470-72fad0d37d26', '45a6da79-1e2d-4854-9953-6229f46c8e82', 'Administración', 'DADM', NULL, true, 'Doctorado'),
  ('6e3056f7-1147-41df-8f9b-d39e72c20ea5', '45a6da79-1e2d-4854-9953-6229f46c8e82', 'Administración de Negocios Internacionales', 'MANI', NULL, true, 'Maestría'),
  ('2769395d-08bc-4903-89a6-04530dc7e1c7', '45a6da79-1e2d-4854-9953-6229f46c8e82', 'Administración de Negocios Internacionales (MIEX)', 'MIEX', NULL, true, 'Maestría'),
  ('18ce85d7-4bea-4909-bad4-e0b30aa8f0d8', '45a6da79-1e2d-4854-9953-6229f46c8e82', 'Administración de Organizaciones de la Salud', 'MAOS', NULL, true, 'Maestría'),
  ('6d78b05e-9838-4256-90d3-28d270439e81', '45a6da79-1e2d-4854-9953-6229f46c8e82', 'Administración de Organizaciones de la Salud', 'EAOS', NULL, true, 'Especialidad'),
  ('ddb222ae-2bd1-4e0b-a389-deb6f24e74fd', '45a6da79-1e2d-4854-9953-6229f46c8e82', 'Administración e Innovación de Negocios', 'LAIN', NULL, true, 'Licenciatura'),
  ('ece2d1f2-4f70-47fe-92aa-7b56dadf78ca', '45a6da79-1e2d-4854-9953-6229f46c8e82', 'Ciencias Actuariales', 'MCA', NULL, true, 'Maestría'),
  ('90cad868-c0db-4b8b-a346-2272655141c8', '45a6da79-1e2d-4854-9953-6229f46c8e82', 'Comercio y Negocios Internacionales', 'LCNI', NULL, true, 'Licenciatura'),
  ('334763cf-973e-4610-9ee3-6475e861b783', '45a6da79-1e2d-4854-9953-6229f46c8e82', 'Contaduría y Finanzas', 'LCF', NULL, true, 'Licenciatura'),
  ('d2c59b24-0483-49d0-b9c3-cff6b7af5847', '45a6da79-1e2d-4854-9953-6229f46c8e82', 'Dirección de Organizaciones de la Salud', 'MDOS', NULL, true, 'Maestría'),
  ('545a7ee2-506c-4a15-970f-8bd9c9267b9e', '45a6da79-1e2d-4854-9953-6229f46c8e82', 'Finanzas Corporativas y Bursátiles', 'EFCB', NULL, true, 'Especialidad'),
  ('5f3c379b-a064-4658-96de-f4301b8f9cef', '45a6da79-1e2d-4854-9953-6229f46c8e82', 'Gestión Estratégica del Capital Humano', 'MGEC', NULL, true, 'Maestría'),
  ('b0c5b5fe-ef94-4a34-a29a-80e3b9d28552', '45a6da79-1e2d-4854-9953-6229f46c8e82', 'Ingeniería Económica y Financiera', 'MIEF', NULL, true, 'Maestría'),
  ('b56eb209-245d-4258-a6a7-9dcb1d231cb4', '45a6da79-1e2d-4854-9953-6229f46c8e82', 'Ingeniería Económica y Financiera', 'ING_FIN', NULL, true, 'Licenciatura'),
  ('e733243f-9791-48f0-8dd8-bd54e119a7f0', '45a6da79-1e2d-4854-9953-6229f46c8e82', 'Ingeniería Económica y Financiera', 'LIEF', NULL, true, 'Licenciatura'),
  ('c33b8931-6648-4916-96bd-177cdaf75002', '45a6da79-1e2d-4854-9953-6229f46c8e82', 'Logística y Cadena de Suministro', 'ELCS', NULL, true, 'Especialidad'),
  ('7075d507-6404-4b18-a5cb-e07a187bae55', '45a6da79-1e2d-4854-9953-6229f46c8e82', 'Mercadotecnia', 'LMER', NULL, true, 'Licenciatura'),
  ('c4f371bb-9132-4dbc-b4c3-def5d6abe627', '45a6da79-1e2d-4854-9953-6229f46c8e82', 'Mercadotecnia y Publicidad', 'EMP', NULL, true, 'Especialidad'),
  ('c296f7b6-351b-44dc-a08c-2a676aa6786c', '45a6da79-1e2d-4854-9953-6229f46c8e82', 'Tecnologías de Información', 'LTI', NULL, true, 'Licenciatura'),
  ('1e8360a6-a86a-4a66-9b9e-68cbde3b3b1e', '45a6da79-1e2d-4854-9953-6229f46c8e82', 'Tecnologías de Información en la Dirección de Negocios', 'MTID', NULL, true, 'Maestría'),
  ('b8e1d826-8ea8-4b64-8c57-a544d82e52b6', '45a6da79-1e2d-4854-9953-6229f46c8e82', 'Transformación Digital para los Negocios', 'LTDN', NULL, true, 'Licenciatura'),
  ('ade7dcff-d65b-4d95-919b-d2e09788253f', '7884f606-71b0-4f67-92da-bf22e0601480', 'Médico Cirujano', 'LMC', NULL, true, 'Licenciatura'),
  ('c4e4c745-5963-4bbd-84d8-7fbbf857c499', '7a162523-1120-4fb9-b291-dfb606c8f1d4', 'Ciencias Jurídicas', 'DCJ', NULL, true, 'Doctorado'),
  ('20593041-d605-4174-8404-4b152041eece', '7a162523-1120-4fb9-b291-dfb606c8f1d4', 'Derecho', 'LDER', NULL, true, 'Licenciatura'),
  ('43adfd53-06bc-422d-b5ac-0545aff30d65', '7a162523-1120-4fb9-b291-dfb606c8f1d4', 'Derecho Civil', 'MDC', NULL, true, 'Maestría'),
  ('7176dfbd-4b30-410e-b58c-51d03c261240', '7a162523-1120-4fb9-b291-dfb606c8f1d4', 'Derecho de Empresa', 'EDE', NULL, true, 'Especialidad'),
  ('86a8d3ba-99fb-4e67-a03b-ce2c02d36db9', '7a162523-1120-4fb9-b291-dfb606c8f1d4', 'Derecho de Empresa', 'MDE', NULL, true, 'Maestría'),
  ('170f14c6-1b9f-49a7-92f0-ccf79c41d750', '7a162523-1120-4fb9-b291-dfb606c8f1d4', 'Derecho Financiero', 'MDF', NULL, true, 'Maestría'),
  ('33e0ef2a-9144-4a00-b6a4-850f20a16843', '7a162523-1120-4fb9-b291-dfb606c8f1d4', 'Gobernanza y Estrategia Internacional', 'MGEI', NULL, true, 'Maestría'),
  ('0cab0fb0-7399-4696-a89b-f4d41fba8ae6', '7a162523-1120-4fb9-b291-dfb606c8f1d4', 'Justicia Penal', 'MJP', NULL, true, 'Maestría'),
  ('431eaf1c-42a3-4a37-a7a2-79c350bbe1ae', '7a162523-1120-4fb9-b291-dfb606c8f1d4', 'Relaciones Internacionales', 'LRI', NULL, true, 'Licenciatura'),
  ('d644f8df-9329-4afa-a0e3-0d4572bbed5e', 'a977a640-709d-47d7-a306-9acbe4a867a9', 'Área de Gestión Educativa', 'AGE', NULL, true, 'Otro'),
  ('649f86d4-b41e-4255-9519-086f603920b4', 'a977a640-709d-47d7-a306-9acbe4a867a9', 'Área de Intervención Docente', 'AID', NULL, true, 'Otro'),
  ('e7b89d58-6b55-4993-a96f-bb4eb8c2eb88', 'a977a640-709d-47d7-a306-9acbe4a867a9', 'Ciencias de la Educación', 'LCE', NULL, true, 'Licenciatura'),
  ('2937ed73-e56d-4995-91a3-198215b741bc', 'a977a640-709d-47d7-a306-9acbe4a867a9', 'Ciencias Religiosas', 'LCR', NULL, true, 'Licenciatura'),
  ('8f98cef0-a585-4da2-bcda-4f871ccf80c4', 'a977a640-709d-47d7-a306-9acbe4a867a9', 'Educación', 'DOCE', NULL, true, 'Doctorado'),
  ('5c1b2052-6045-444f-a333-4f4234edb03f', 'a977a640-709d-47d7-a306-9acbe4a867a9', 'Educación Preescolar', 'LEP', NULL, true, 'Licenciatura'),
  ('6d086d1b-aaea-4b76-9b16-fa8f3e29d9fa', 'a977a640-709d-47d7-a306-9acbe4a867a9', 'Educación Primaria', 'LEPR', NULL, true, 'Licenciatura'),
  ('55dd719d-1545-421f-93c6-adc082c87e50', 'a977a640-709d-47d7-a306-9acbe4a867a9', 'Filosofía', 'LFIL', NULL, true, 'Licenciatura'),
  ('82408bb8-eb5b-4a16-97eb-be20494a88c8', 'a977a640-709d-47d7-a306-9acbe4a867a9', 'Filosofía Social', 'MFS', NULL, true, 'Maestría'),
  ('747efb86-3955-4176-ba3c-9a906bbecde2', 'a977a640-709d-47d7-a306-9acbe4a867a9', 'Gestión de los Aprendizajes', 'EGA', NULL, true, 'Especialidad'),
  ('b4e0ad06-84b0-40fc-8228-a75b0c9cbd9b', 'a977a640-709d-47d7-a306-9acbe4a867a9', 'Pedagogía', 'LPED', NULL, true, 'Licenciatura'),
  ('c8a8cd55-e124-4393-9775-b2da161297dd', 'a977a640-709d-47d7-a306-9acbe4a867a9', 'Psicología', 'LPS', NULL, true, 'Licenciatura'),
  ('41298122-2ffb-49cb-91c8-2decce409d81', 'a977a640-709d-47d7-a306-9acbe4a867a9', 'Teología', 'LTEO', NULL, true, 'Licenciatura'),
  ('4cd28b20-f419-410c-8224-7e24c060280a', 'ab73dbce-e750-4070-82b1-4e71347cd273', 'Ciencias en el Deporte', 'LCD', NULL, true, 'Licenciatura'),
  ('21ce004a-2c89-422b-ae7d-675ffcb17365', 'ab73dbce-e750-4070-82b1-4e71347cd273', 'Enfermería', 'LENF', NULL, true, 'Licenciatura'),
  ('6f14401a-1080-4546-9a68-d9a13373bac0', 'ab73dbce-e750-4070-82b1-4e71347cd273', 'Fisioterapia', 'LFIS', NULL, true, 'Licenciatura'),
  ('196f80c0-0194-4eb2-b7c2-bd5fb70fb719', 'ab73dbce-e750-4070-82b1-4e71347cd273', 'Fisioterapia y Promoción para la Salud', 'LFPS', NULL, true, 'Licenciatura'),
  ('6d3ea686-e38b-4baf-8fbe-5760bae33314', 'ab73dbce-e750-4070-82b1-4e71347cd273', 'Medicina Dental', 'LMD', NULL, true, 'Licenciatura'),
  ('28627757-007a-4a57-b26d-1eb778b7d2fc', 'ab73dbce-e750-4070-82b1-4e71347cd273', 'Nutrición Clínica', 'MNC', NULL, true, 'Maestría'),
  ('66c6dbda-c2a4-4891-bd80-b09d01cf7532', 'cd9409f5-bbcd-466d-82eb-b206cea51b8b', 'Área Curricular Común (Centro de Idiomas) 2013', 'ACCI', NULL, true, 'Otro'),
  ('def2d29e-dec6-42c5-b36a-5ea58873b661', 'cd9409f5-bbcd-466d-82eb-b206cea51b8b', 'Área Curricular Común (Centro de Idiomas) 2021', 'ACCI', NULL, true, 'Otro'),
  ('8b25bb3f-dbb9-46be-8423-761964bd65f9', 'd17b19c6-b7ab-4bdc-8bb9-ddf6f9e0358e', 'Calidad y Estadística Aplicada', 'MCEA', NULL, true, 'Maestría'),
  ('eee00014-3877-4572-a8af-cdd36ca04802', 'd17b19c6-b7ab-4bdc-8bb9-ddf6f9e0358e', 'Ciencia de los Alimentos y Nutrición Humana', 'MCAN', NULL, true, 'Maestría'),
  ('2e4ac125-101e-4897-80a2-e4e9a313d43f', 'd17b19c6-b7ab-4bdc-8bb9-ddf6f9e0358e', 'Farmacología Clínica', 'MFC', NULL, true, 'Maestría'),
  ('7bb3c955-fee8-42af-bc5b-6f96fdbcedcd', 'd17b19c6-b7ab-4bdc-8bb9-ddf6f9e0358e', 'Ingeniería Ambiental', 'LIA', NULL, true, 'Licenciatura'),
  ('b425282f-9e08-47da-b755-ede93d198eed', 'd17b19c6-b7ab-4bdc-8bb9-ddf6f9e0358e', 'Ingeniería de Proyectos', 'MIP', NULL, true, 'Maestría'),
  ('ab3bb83e-fcd9-4838-92f1-b6c4fb98ed2e', 'd17b19c6-b7ab-4bdc-8bb9-ddf6f9e0358e', 'Ingeniería Química', 'LIQ', NULL, true, 'Licenciatura'),
  ('2017ce3d-89ea-48c0-b36f-fe05f1e364cc', 'd17b19c6-b7ab-4bdc-8bb9-ddf6f9e0358e', 'Química de Alimentos', 'LQA', NULL, true, 'Licenciatura'),
  ('991edcde-b77e-4d22-b76b-3bf6ec3d3555', 'd17b19c6-b7ab-4bdc-8bb9-ddf6f9e0358e', 'Químico Farmacéutico Biólogo', 'QFB', NULL, true, 'Licenciatura')
ON CONFLICT (id) DO NOTHING;

-- La estructura canónica se publica al final de esta misma transacción. Si ya
-- existía publicada, retirarla temporalmente permite que sus parches y la
-- estructura de asignatura vuelvan a converger sin desactivar los guards de
-- inmutabilidad. Un fallo revierte también esta transición.
UPDATE public.estructuras_plan
SET estado_publicacion = 'ARCHIVADA'
WHERE id = '69fb2b77-5a95-47e0-bf1f-389d384200e4'
  AND estado_publicacion = 'PUBLICADA';

INSERT INTO public.estructuras_plan (
  id,
  nombre,
  tipo,
  template_id,
  excel_template_id,
  autoridad_normativa,
  etiqueta_version,
  aplicable_desde,
  estado_publicacion,
  referencia_normativa,
  manifest_plantillas,
  definicion
) VALUES (
  '69fb2b77-5a95-47e0-bf1f-389d384200e4',
  'SEP/DGAIR vigente',
  'CURRICULAR',
  '1444158337225248527',
  '1402917575045089616',
  'SEP/DGAIR',
  'Acuerdo 17/11/17 y reformas vigentes',
  DATE '2017-11-13',
  'BORRADOR',
  'https://www.dof.gob.mx/nota_detalle.php?codigo=5504348&fecha=13/11/2017',
  $manifest$
  {
    "plan_word": {
      "sha256": "c6b103b8c6be65a971e734ab28de52c5c02e8d8454741fc85ae70c08b91724a1",
      "placeholders_validos": true
    },
    "mapa_xlsx": {
      "sha256": "094e09070aedb93328a16f4763198ad750225b44b39a9763c6581a9cc141a41b",
      "placeholders_validos": true
    },
    "asignatura_word": {
      "sha256": "3fab7316b8537d55d7c8c526bbb6ddb5f04d88475cba2d77f6eae053cd66dc16",
      "placeholders_validos": true
    }
  }
  $manifest$::jsonb,
  $json$
  {
    "type": "object",
    "required": [
      "vigencia",
      "area_de_estudio",
      "perfil_de_egreso",
      "diseno_curricular",
      "perfil_de_ingreso",
      "curso_propedeutico",
      "modalidad_educativa",
      "antecedente_academico",
      "carga_horaria_a_la_semana",
      "programa_de_investigacion",
      "clave_del_plan_de_estudios",
      "duracion_del_ciclo_escolar",
      "fines_de_aprendizaje_o_formacion",
      "nivel_y_nombre_del_plan_de_estudios",
      "nombre_autorizado_de_la_institucion",
      "total_de_ciclos_del_plan_de_estudios",
      "sustento_teorico_del_modelo_curricular",
      "justificacion_de_la_propuesta_curricular",
      "administracion_y_operatividad_del_plan_de_estudios",
      "propuesta_de_evaluacion_periodica_del_plan_de_estudios",
      "nombre_y_cargo_de_la_persona_facultada_para_autorizar_el_plan_de_estudios"
    ],
    "properties": {
      "vigencia": {
        "type": "string",
        "title": "Vigencia",
        "examples": ["2024-2029"],
        "description": "(Espacio para uso exclusivo de la autoridad educativa)",
        "referencia_normativa": "Dato administrativo del Anexo 1."
      },
      "area_de_estudio": {
        "type": "string",
        "title": "Área de estudio",
        "examples": ["Ingeniería, industria y construcción", "Ciencias sociales y derecho"],
        "description": "Señalar el “campo amplio” al que pertenece el plan de estudios. Para ello, considerar la Clasificación Mexicana de Planes de Estudio por Campos de Formación Académica (CMPE 2016), publicado por INEGI.",
        "referencia_normativa": "Deberá vincularse con el fin de aprendizaje y perfil de egreso del plan de estudios."
      },
      "perfil_de_egreso": {
        "type": "string",
        "title": "Perfil de egreso",
        "examples": ["El egresado será capaz de diseñar estrategias legales..."],
        "description": "Describir los atributos que habrán desarrollado los estudiantes al concluir el plan de estudios, acordes al nivel educativo y denominación propuesta. De preferencia, dividirlo en conocimientos, habilidades y actitudes.",
        "referencia_normativa": "Corresponde al requisito 'Perfil de egreso' del Artículo 8, fracción VI del Acuerdo 17/11/17."
      },
      "diseno_curricular": {
        "enum": ["Rígido", "Flexible"],
        "type": "string",
        "title": "Diseño curricular",
        "description": "Indicar si es “Rígido” o “Flexible”.",
        "referencia_normativa": "Define la estructura para el requisito 'Mapa curricular' del Artículo 8, fracción VII del Acuerdo 17/11/17."
      },
      "perfil_de_ingreso": {
        "type": "string",
        "title": "Perfil de ingreso",
        "examples": ["Conocimientos básicos de matemáticas, capacidad de análisis y redacción."],
        "description": "Indicar las condiciones académicas ideales (conocimientos, habilidades y aptitudes), para incorporarse al plan de estudios. Deberá vincularse con el nivel educativo y campo de estudio.",
        "referencia_normativa": "Corresponde al requisito 'Perfil de ingreso' (condiciones mínimas requeridas) del Artículo 8, fracción V del Acuerdo 17/11/17."
      },
      "curso_propedeutico": {
        "type": ["string", "null"],
        "title": "Curso propedéutico",
        "examples": ["Curso de nivelación de 40 horas obligatorio para aspirantes de áreas ajenas."],
        "description": "Señalar las situaciones en las que aplicará el curso propedéutico, la población a la que estará dirigido, su duración, la relación con el plan de estudios, así como la información que considere relevante.",
        "referencia_normativa": "Elemento opcional mencionado en las guías de llenado del Anexo 1."
      },
      "modalidad_educativa": {
        "enum": ["Escolar", "No escolarizada", "Mixta"],
        "type": "string",
        "title": "Modalidad educativa",
        "description": "Señalar la modalidad educativa en la que se impartirá el plan de estudios: escolar, no escolarizada o mixta.",
        "referencia_normativa": "Corresponde al requisito de 'Modalidad educativa' del Artículo 8, fracción II del Acuerdo 17/11/17."
      },
      "antecedente_academico": {
        "type": "string",
        "title": "Antecedente académico",
        "examples": ["Bachillerato concluido o equivalente.", "Título de Licenciatura en áreas afines a la salud."],
        "description": "Señalar el nivel educativo requerido para ingresar al plan de estudios. Para posgrados, además del nivel educativo; indicar la(s) disciplina(s) o área(s) afín(es) al plan de estudios.",
        "referencia_normativa": "Corresponde al requisito 'Perfil de ingreso' (antecedente académico necesario) del Artículo 8, fracción V del Acuerdo 17/11/17."
      },
      "carga_horaria_a_la_semana": {
        "type": "number",
        "title": "Carga horaria a la semana",
        "description": "Indicar la máxima carga horaria impartida a la semana; no mayor a 50 horas bajo la conducción de un académico.",
        "referencia_normativa": "Corresponde a la restricción 'sin exceder una carga máxima de 50 horas efectivas por semana' del Artículo 8, fracción III del Acuerdo 17/11/17."
      },
      "programa_de_investigacion": {
        "type": ["string", "null"],
        "title": "Programa de investigación",
        "examples": ["Línea 1: Innovación Educativa. Objetivo: Analizar el impacto de..."],
        "description": "(Obligatorio para el nivel de Doctorado y para aquéllas Maestrías orientadas a la investigación). Presentar el programa de investigación que describa los objetivos del programa y líneas de investigación con sus respectivos objetivos. Asimismo, detallar la vinculación con las asignaturas que conforman el plan de estudios, la metodología y presentación de las investigaciones, así como el perfil de los docentes que guiarán su desarrollo.",
        "referencia_normativa": "Requisito obligatorio solo para Doctorados o Maestrías con orientación a investigación según el Artículo 10, fracción III incisos b) y c) del Acuerdo 17/11/17."
      },
      "clave_del_plan_de_estudios": {
        "type": "string",
        "title": "Clave / Año del plan",
        "examples": ["2024"],
        "description": "Señalar el año en el que solicita el trámite.",
        "referencia_normativa": "Dato administrativo del Anexo 1."
      },
      "duracion_del_ciclo_escolar": {
        "type": "string",
        "title": "Duración mínima en semanas de cada ciclo escolar",
        "examples": ["16 semanas"],
        "description": "Señalar el número mínimo de semanas efectivas de clase que integran el tipo de ciclo en el que se imparte el plan de estudios.",
        "referencia_normativa": "Corresponde exactamente al requisito 'Duración mínima en semanas' del Artículo 8, fracción III del Acuerdo 17/11/17."
      },
      "fines_de_aprendizaje_o_formacion": {
        "type": "string",
        "title": "Fin de aprendizaje o formación",
        "examples": ["El estudiante analizará los principios fundamentales del derecho penal..."],
        "description": "Describir los aprendizajes que lograrán los estudiantes al concluir el plan de estudios. Deberá corresponder con el nivel educativo y la denominación del plan de estudios.",
        "referencia_normativa": "Corresponde al requisito 'Descripción de los fines del aprendizaje o formación' del Artículo 8, fracción IV del Acuerdo 17/11/17."
      },
      "nivel_y_nombre_del_plan_de_estudios": {
        "type": "string",
        "title": "Nivel y nombre del plan de estudios",
        "examples": ["Licenciatura en Derecho", "Maestría en Ciencias de la Computación"],
        "description": "Indicar el nivel educativo y denominación del plan de estudios.",
        "referencia_normativa": "Corresponde al requisito 'Nivel y denominación del plan de estudios' del Artículo 8, fracción I del Acuerdo 17/11/17."
      },
      "nombre_autorizado_de_la_institucion": {
        "type": "string",
        "title": "Nombre autorizado de la institución",
        "examples": ["Universidad La Salle A.C."],
        "description": "Proporcionar el nombre de la institución autorizado por SEP.",
        "referencia_normativa": "Dato administrativo del Anexo 1."
      },
      "total_de_ciclos_del_plan_de_estudios": {
        "type": "string",
        "title": "Número de ciclos escolares que integrarán el plan de estudio",
        "examples": ["9 cuatrimestres", "8 semestres"],
        "description": "En diseño flexible especificar mínimo y máximo de ciclos. En diseño rígido especificar el total de ciclos.",
        "referencia_normativa": "Corresponde a 'señalando el número de ciclos en que se impartirá' del Artículo 8, fracción III del Acuerdo 17/11/17."
      },
      "sustento_teorico_del_modelo_curricular": {
        "type": ["string", "null"],
        "title": "Sustento teórico del modelo curricular",
        "examples": ["Modelo por competencias profesionales fundamentado en el constructivismo..."],
        "description": "Presentar de forma concreta el marco conceptual en el que se justifica y fundamenta el diseño y organización curricular del plan de estudios.",
        "referencia_normativa": "Corresponde al 'sustento teórico del modelo curricular' que el particular puede incluir según el Artículo 8 (párrafo tercero) del Acuerdo 17/11/17."
      },
      "justificacion_de_la_propuesta_curricular": {
        "type": ["string", "null"],
        "title": "Justificación de la propuesta curricular en la modalidad no escolarizada o mixta",
        "examples": ["Se utilizará una plataforma LMS asincrónica complementada con sesiones síncronas..."],
        "description": "(Exclusivo para modalidades no escolarizada y mixta). Describir cómo se impartirá el plan de estudios en la modalidad educativa elegida, los recursos tecnológicos y/o didácticos que emplearán para su desarrollo y su vinculación con las asignaturas y actividades de aprendizaje.",
        "referencia_normativa": "Corresponde a lo solicitado en el Artículo 14 (justificación de modalidad) y Artículo 15 (especificaciones de plataforma/modelo) del Acuerdo 17/11/17."
      },
      "administracion_y_operatividad_del_plan_de_estudios": {
        "type": ["string", "null"],
        "title": "Administración y operatividad del plan de estudios",
        "examples": ["El estudiante podrá inscribir un mínimo de 3 y un máximo de 6 asignaturas por ciclo..."],
        "description": "Describir la administración del plan de estudios, así como su operatividad; considerando el tipo de diseño curricular empleado. Si es flexible; incorporar el número mínimo y máximo de asignaturas que se cursarán por ciclo.",
        "referencia_normativa": "Corresponde a la 'descripción detallada de la(s) forma(s) de administración y operatividad' permitida en el Artículo 8 (párrafo tercero) del Acuerdo 17/11/17."
      },
      "propuesta_de_evaluacion_periodica_del_plan_de_estudios": {
        "type": ["string", "null"],
        "title": "Propuesta de evaluación periódica del plan de estudios",
        "examples": ["Revisión quinquenal mediante encuestas a empleadores, egresados y análisis de tendencias del mercado."],
        "description": "Describir de manera detallada la metodología que emplearán para la evaluación del plan de estudios, incluyendo los instrumentos y periodicidad en la que se llevará a cabo; con la finalidad de mantenerlo actualizado y acorde a las necesidades educativas y disciplinares.",
        "referencia_normativa": "Corresponde al requisito 'Propuesta de evaluación periódica del Plan de estudio' del Artículo 8, fracción VIII del Acuerdo 17/11/17."
      },
      "nombre_y_cargo_de_la_persona_facultada_para_autorizar_el_plan_de_estudios": {
        "type": "string",
        "title": "Nombre y cargo de la persona facultada para autorizar el plan de estudios",
        "examples": ["Dr. Juan Pérez Gómez, Rector de la Universidad XYZ"],
        "description": "Indicar el nombre y cargo de la persona facultada para autorizar el plan de estudios.",
        "referencia_normativa": "Dato administrativo del Anexo 1."
      }
    },
    "additionalProperties": false
  }
  $json$::jsonb
)
ON CONFLICT (id) DO NOTHING;

-- Las columnas canónicas sustituyen aliases históricos del JSON dinámico.
UPDATE public.estructuras_plan ep
SET definicion = jsonb_set(
  jsonb_set(
    ep.definicion,
    '{properties}',
    coalesce(ep.definicion->'properties', '{}'::jsonb)
      - 'vigencia'::text
      - 'clave_del_plan_de_estudios'::text
      - 'duracion_del_ciclo_escolar'::text
      - 'nivel_y_nombre_del_plan_de_estudios'::text
      - 'total_de_ciclos_del_plan_de_estudios'::text,
    true
  ),
  '{required}',
  (
    SELECT coalesce(jsonb_agg(value), '[]'::jsonb)
    FROM jsonb_array_elements_text(ep.definicion->'required') item(value)
    WHERE value NOT IN (
      'vigencia',
      'clave_del_plan_de_estudios',
      'duracion_del_ciclo_escolar',
      'nivel_y_nombre_del_plan_de_estudios',
      'total_de_ciclos_del_plan_de_estudios',
      'curso_propedeutico',
      'programa_de_investigacion',
      'justificacion_de_la_propuesta_curricular'
    )
  ),
  true
)
WHERE ep.id = '69fb2b77-5a95-47e0-bf1f-389d384200e4';

UPDATE public.estructuras_plan ep
SET definicion = jsonb_set(
  jsonb_set(
    jsonb_set(
      ep.definicion,
      '{properties,perfil_de_ingreso,x-acad-ia.semantic-key}',
      '"perfil_ingreso"'::jsonb,
      true
    ),
    '{properties,perfil_de_egreso,x-acad-ia.semantic-key}',
    '"perfil_egreso"'::jsonb,
    true
  ),
  '{properties,fines_de_aprendizaje_o_formacion,x-acad-ia.semantic-key}',
  '"fines_aprendizaje"'::jsonb,
  true
)
WHERE ep.id = '69fb2b77-5a95-47e0-bf1f-389d384200e4';

-- Condiciones académicas: no todos los contenidos aplican a todos los planes.
UPDATE public.estructuras_plan ep
SET definicion = jsonb_set(
  jsonb_set(
    ep.definicion,
    '{properties,programa_de_investigacion,x-acad-ia,requiredWhen}',
    '{"nivel":["Doctorado"],"orientacion":["Investigación"]}'::jsonb,
    true
  ),
  '{properties,justificacion_de_la_propuesta_curricular,x-acad-ia,requiredWhen}',
  '{"modalidad_educativa":["No escolarizada","Mixta"]}'::jsonb,
  true
)
WHERE ep.id = '69fb2b77-5a95-47e0-bf1f-389d384200e4';

INSERT INTO public.estructuras_asignatura (
  id,
  estructura_plan_id,
  nombre,
  definicion,
  template_id,
  tipo
) VALUES (
  '7856e9cc-9ac1-4a31-b93a-0624d4c5e1de',
  '69fb2b77-5a95-47e0-bf1f-389d384200e4',
  'Asignatura SEP/ULSA (semilla)',
  $json$
  {
    "type": "object",
    "required": [
      "denominacion_de_la_asignatura_o_unidad_de_aprendizaje",
      "ciclo",
      "clave_de_la_asignatura",
      "fines_de_aprendizaje_o_formacion",
      "actividades_de_aprendizaje_bajo_conduccion_de_un_academico",
      "actividades_de_aprendizaje_independientes",
      "modalidades_tecnologicas_e_informaticas"
    ],
    "properties": {
      "ciclo": {
        "type": "string",
        "title": "Ciclo",
        "examples": ["Primer semestre"],
        "description": "Indicar el ciclo en el que se impartirá la asignatura en el orden establecido en el mapa curricular. En caso de ser flexible; indicar el área o módulo al que pertenece. Para currículum rígido que contemple asignaturas optativas; indicar “Optativa”, y en caso de que se curse en un ciclo determinado, señalar el ciclo acompañado de la leyenda “Optativa”."
      },
      "clave_de_la_asignatura": {
        "type": "string",
        "title": "Clave de la asignatura",
        "examples": ["MAT-101"],
        "description": "Anotar la clave que identifica a la asignatura o unidad de aprendizaje; la cual debe coincidir con la señalada en el mapa curricular."
      },
      "fines_de_aprendizaje_o_formacion": {
        "type": "string",
        "title": "Fines de aprendizaje o formación",
        "description": "Describir los aprendizajes y fines que alcanzará el estudiante al concluir la asignatura. Deberá sustentar la denominación de la asignatura, vincularse con los contenidos temáticos y coadyuvar al logro del fin de aprendizaje y perfil de egreso del plan de estudios."
      },
      "modalidades_tecnologicas_e_informaticas": {
        "type": "string",
        "title": "Modalidades tecnológicas e informáticas",
        "description": "Describir los recursos tecnológicos y de comunicación que se emplearán para el desarrollo del proceso de enseñanza-aprendizaje de la asignatura. Para las modalidades no escolarizada y mixta, este elemento es obligatorio."
      },
      "actividades_de_aprendizaje_independientes": {
        "type": "string",
        "title": "Actividades de aprendizaje independientes",
        "description": "Señalar las actividades de aprendizaje que desarrollará el estudiante de manera independiente. Éstas deberán ser acordes con la naturaleza de la asignatura y la modalidad educativa."
      },
      "denominacion_de_la_asignatura_o_unidad_de_aprendizaje": {
        "type": "string",
        "title": "Denominación de la asignatura o unidad de aprendizaje",
        "examples": ["Matemáticas I"],
        "description": "Señalar el nombre de la asignatura o unidad de aprendizaje de igual manera que en el mapa curricular."
      },
      "actividades_de_aprendizaje_bajo_conduccion_de_un_academico": {
        "type": "string",
        "title": "Actividades de aprendizaje bajo conducción de un académico",
        "description": "Señalar las actividades de aprendizaje que desarrollará el estudiante en las horas-clase. Éstas deberán ser acordes con la naturaleza de la asignatura, modalidad educativa e instalaciones empleadas, además de contribuir al logro de los fines de aprendizaje."
      }
    },
    "additionalProperties": false
  }
  $json$::jsonb,
  '1373944894291796699',
  'CURRICULAR'
)
ON CONFLICT (id) DO NOTHING;

UPDATE public.estructuras_asignatura ea
SET definicion = jsonb_set(
  jsonb_set(
    ea.definicion,
    '{properties}',
    coalesce(ea.definicion->'properties', '{}'::jsonb)
      - 'denominacion_de_la_asignatura_o_unidad_de_aprendizaje'::text
      - 'clave_de_la_asignatura'::text
      - 'ciclo'::text,
    true
  ),
  '{required}',
  (
    SELECT coalesce(jsonb_agg(value), '[]'::jsonb)
    FROM jsonb_array_elements_text(ea.definicion->'required') item(value)
    WHERE value NOT IN (
      'denominacion_de_la_asignatura_o_unidad_de_aprendizaje',
      'clave_de_la_asignatura',
      'ciclo',
      'modalidades_tecnologicas_e_informaticas'
    )
  ),
  true
)
WHERE ea.id = '7856e9cc-9ac1-4a31-b93a-0624d4c5e1de';

UPDATE public.estructuras_asignatura ea
SET definicion = jsonb_set(
  ea.definicion,
  '{properties,modalidades_tecnologicas_e_informaticas,x-acad-ia,requiredWhen}',
  '{"modalidad_educativa":["No escolarizada","Mixta"]}'::jsonb,
  true
)
WHERE ea.id = '7856e9cc-9ac1-4a31-b93a-0624d4c5e1de';

UPDATE public.estructuras_plan
SET estado_publicacion = 'PUBLICADA'
WHERE id = '69fb2b77-5a95-47e0-bf1f-389d384200e4';

-- Acuerdo 279: se conserva únicamente para reconocer e interpretar antecedentes.
INSERT INTO public.estructuras_plan (
  id, nombre, tipo, template_id, excel_template_id, definicion,
  autoridad_normativa, etiqueta_version, aplicable_desde, aplicable_hasta,
  estado_publicacion, referencia_normativa, manifest_plantillas
)
SELECT
  '27900000-0000-4000-8000-000000000001'::uuid,
  'SEP Acuerdo 279/2000',
  tipo,
  NULL,
  NULL,
  definicion,
  'SEP',
  'Acuerdo 279/2000',
  DATE '2000-07-10',
  DATE '2017-11-12',
  'ARCHIVADA',
  'https://www.dof.gob.mx/nota_detalle.php?codigo=2059926&fecha=10/07/2000',
  '{}'::jsonb
FROM public.estructuras_plan
WHERE id = '69fb2b77-5a95-47e0-bf1f-389d384200e4'
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.estructuras_asignatura (
  id, estructura_plan_id, nombre, definicion, template_id, tipo
)
SELECT
  '27900000-0000-4000-8000-000000000002'::uuid,
  '27900000-0000-4000-8000-000000000001'::uuid,
  'Programa de asignatura · Acuerdo 279/2000',
  definicion,
  NULL,
  tipo
FROM public.estructuras_asignatura
WHERE id = '7856e9cc-9ac1-4a31-b93a-0624d4c5e1de'
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.lineas_curriculares_sugeridas (
  id,
  facultad_id,
  nombre,
  area,
  color,
  orden
) VALUES
  ('b0000001-0000-4000-8000-000000000001', '155b5fe7-9e09-420f-8d9d-ddd8219f193d', 'Área común de ingeniería', 'Básica', '#64748b', 10),
  ('b0000001-0000-4000-8000-000000000002', '155b5fe7-9e09-420f-8d9d-ddd8219f193d', 'Matemáticas y ciencias básicas', 'Básica', '#2563eb', 20),
  ('b0000001-0000-4000-8000-000000000003', '155b5fe7-9e09-420f-8d9d-ddd8219f193d', 'Programación y sistemas', 'Profesional', '#16a34a', 30),
  ('b0000001-0000-4000-8000-000000000004', '155b5fe7-9e09-420f-8d9d-ddd8219f193d', 'Ciberseguridad', 'Profesional', '#dc2626', 40),
  ('b0000001-0000-4000-8000-000000000005', '155b5fe7-9e09-420f-8d9d-ddd8219f193d', 'Integración profesional', 'Integración', '#7c3aed', 50),
  ('b0000002-0000-4000-8000-000000000001', '0d711469-4668-4910-b08e-88406ad30c9a', 'Fundamentos de diseño', 'Básica', '#ec4899', 10),
  ('b0000002-0000-4000-8000-000000000002', '0d711469-4668-4910-b08e-88406ad30c9a', 'Comunicación y medios', 'Profesional', '#f97316', 20),
  ('b0000002-0000-4000-8000-000000000003', '0d711469-4668-4910-b08e-88406ad30c9a', 'Proyecto integrador', 'Integración', '#0f766e', 30)
ON CONFLICT DO NOTHING;

COMMIT;
