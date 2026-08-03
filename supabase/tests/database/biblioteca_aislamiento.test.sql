begin;

\ir _fixtures_usuarios.inc

select plan(29);

select has_function(
  'public',
  'listar_colecciones_documentales',
  array['uuid', 'uuid'],
  'existe el listado autorizado de colecciones'
);
select ok(
  has_function_privilege(
    'service_role',
    'public.listar_colecciones_documentales(uuid,uuid)',
    'execute'
  ),
  'files-api puede invocar el listado autorizado'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.listar_colecciones_documentales(uuid,uuid)',
    'execute'
  ),
  'el cliente no puede elegir otro usuario o tenant al listar colecciones'
);
select ok(
  has_function_privilege(
    'authenticated',
    'public.authz_plan_ia_allowed(uuid)',
    'execute'
  ),
  'el JWT autenticado puede comprobar la capacidad IA de un plan'
);
select ok(
  has_function_privilege(
    'authenticated',
    'public.authz_asignatura_ia_allowed(uuid)',
    'execute'
  ),
  'el JWT autenticado puede comprobar la capacidad IA de una asignatura'
);
select ok(
  not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.collections'::regclass
      and conname = 'collections_tenant_id_name_key'
  ),
  'la unicidad anterior ya no mezcla colecciones personales de todo el tenant'
);
select has_index(
  'public',
  'collections',
  'collections_personal_nombre_unique_idx',
  'las colecciones personales son únicas por creador'
);
select has_index(
  'public',
  'collections',
  'collections_repositorio_nombre_unique_idx',
  'los repositorios conservan unicidad institucional'
);

create temporary table biblioteca_test_users (
  etiqueta text primary key,
  user_id uuid not null unique
) on commit drop;

insert into biblioteca_test_users (etiqueta, user_id)
select 'admin', ur.usuario_id
from public.usuarios_roles ur
join public.roles r on r.id = ur.rol_id
where r.clave = 'ADMIN'
order by ur.usuario_id
limit 1;

insert into biblioteca_test_users (etiqueta, user_id)
select 'creator', ua.id
from public.usuarios_app ua
where not exists (
  select 1 from biblioteca_test_users u where u.user_id = ua.id
)
order by ua.id
limit 1;

insert into biblioteca_test_users (etiqueta, user_id)
select 'stranger', ua.id
from public.usuarios_app ua
where not exists (
  select 1 from biblioteca_test_users u where u.user_id = ua.id
)
order by ua.id
limit 1;

select is(
  (select count(*)::integer from biblioteca_test_users),
  3,
  'las fixtures ofrecen creador, colaborador administrador y usuario ajeno'
);

insert into public.tenants (id, slug, nombre)
values (
  'a1000000-0000-4000-8000-000000000001',
  'biblioteca-aislamiento-test',
  'Tenant de aislamiento documental'
);

insert into public.tenant_memberships (tenant_id, user_id, is_default)
select
  'a1000000-0000-4000-8000-000000000001',
  user_id,
  false
from biblioteca_test_users;

insert into public.files (id, tenant_id, display_name, created_by, status)
select
  archivo.id,
  'a1000000-0000-4000-8000-000000000001',
  archivo.nombre,
  (select user_id from biblioteca_test_users where etiqueta = 'creator'),
  'ready'
from (
  values
    ('f1000000-0000-4000-8000-000000000001'::uuid, 'Marco curricular'),
    ('f1000000-0000-4000-8000-000000000002'::uuid, 'Evidencia reservada')
) as archivo(id, nombre);

select lives_ok(
  $$
    insert into public.collections (
      id, tenant_id, name, created_by, kind
    ) values
      (
        'c1000000-0000-4000-8000-000000000001',
        'a1000000-0000-4000-8000-000000000001',
        'Apuntes personales',
        (select user_id from biblioteca_test_users where etiqueta = 'creator'),
        'collection'
      ),
      (
        'c1000000-0000-4000-8000-000000000002',
        'a1000000-0000-4000-8000-000000000001',
        'Apuntes personales',
        (select user_id from biblioteca_test_users where etiqueta = 'admin'),
        'collection'
      )
  $$,
  'dos usuarios pueden usar el mismo nombre para su colección personal'
);

select throws_ok(
  $$
    insert into public.collections (
      id, tenant_id, name, created_by, kind
    ) values (
      'c1000000-0000-4000-8000-000000000004',
      'a1000000-0000-4000-8000-000000000001',
      'aPuNtEs PeRsOnAlEs',
      (select user_id from biblioteca_test_users where etiqueta = 'creator'),
      'collection'
    )
  $$,
  '23505',
  null,
  'un creador no duplica semánticamente el nombre de su propia colección'
);

insert into public.collections (
  id, tenant_id, name, created_by, kind
) values (
  'c1000000-0000-4000-8000-000000000003',
  'a1000000-0000-4000-8000-000000000001',
  'Repositorio curricular común',
  (select user_id from biblioteca_test_users where etiqueta = 'creator'),
  'curriculum_repository'
);

select throws_ok(
  $$
    insert into public.collections (
      id, tenant_id, name, created_by, kind
    ) values (
      'c1000000-0000-4000-8000-000000000005',
      'a1000000-0000-4000-8000-000000000001',
      'repositorio CURRICULAR común',
      (select user_id from biblioteca_test_users where etiqueta = 'admin'),
      'curriculum_repository'
    )
  $$,
  '23505',
  null,
  'el nombre normalizado de un repositorio sigue siendo único dentro del tenant'
);

insert into public.collection_files (
  tenant_id, collection_id, file_id, added_by, added_at
)
select
  'a1000000-0000-4000-8000-000000000001',
  'c1000000-0000-4000-8000-000000000003',
  archivo.id,
  (select user_id from biblioteca_test_users where etiqueta = 'creator'),
  archivo.agregado_en
from (
  values
    (
      'f1000000-0000-4000-8000-000000000001'::uuid,
      '2026-07-21T10:00:00Z'::timestamptz
    ),
    (
      'f1000000-0000-4000-8000-000000000002'::uuid,
      '2026-07-21T11:00:00Z'::timestamptz
    )
) as archivo(id, agregado_en);

select is(
  (
    select count(*)::integer
    from public.listar_colecciones_documentales(
      (select user_id from biblioteca_test_users where etiqueta = 'creator'),
      'a1000000-0000-4000-8000-000000000001'
    )
    where kind = 'collection'
  ),
  1,
  'el creador sólo lista su colección personal'
);
select is(
  (
    select count(*)::integer
    from public.listar_colecciones_documentales(
      (select user_id from biblioteca_test_users where etiqueta = 'admin'),
      'a1000000-0000-4000-8000-000000000001'
    )
    where kind = 'collection'
  ),
  1,
  'otro usuario sólo lista su propia colección personal'
);
select is(
  (
    select count(*)::integer
    from public.listar_colecciones_documentales(
      (select user_id from biblioteca_test_users where etiqueta = 'creator'),
      'a1000000-0000-4000-8000-000000000001'
    )
    where id = 'c1000000-0000-4000-8000-000000000003'
  ),
  1,
  'el propietario conserva acceso a su repositorio curricular'
);
select is(
  (
    select count(*)::integer
    from public.listar_colecciones_documentales(
      (select user_id from biblioteca_test_users where etiqueta = 'admin'),
      'a1000000-0000-4000-8000-000000000001'
    )
    where id = 'c1000000-0000-4000-8000-000000000003'
  ),
  0,
  'un repositorio no se comparte sin alcance documental'
);
select is(
  (
    select count(*)::integer
    from public.listar_colecciones_documentales(
      (select user_id from biblioteca_test_users where etiqueta = 'stranger'),
      'a1000000-0000-4000-8000-000000000001'
    )
  ),
  0,
  'un usuario ajeno no conoce colecciones ni repositorios del tenant'
);

insert into public.file_grants (
  tenant_id, file_id, subject_type, subject_id, permission, granted_by
) values (
  'a1000000-0000-4000-8000-000000000001',
  'f1000000-0000-4000-8000-000000000001',
  'user',
  (select user_id from biblioteca_test_users where etiqueta = 'admin'),
  'view',
  (select user_id from biblioteca_test_users where etiqueta = 'creator')
);

select is(
  (
    select count(*)::integer
    from public.listar_colecciones_documentales(
      (select user_id from biblioteca_test_users where etiqueta = 'admin'),
      'a1000000-0000-4000-8000-000000000001'
    )
    where id = 'c1000000-0000-4000-8000-000000000003'
  ),
  1,
  'el repositorio aparece al obtener alcance sobre uno de sus archivos'
);
select ok(
  (
    select file_ids = array[
      'f1000000-0000-4000-8000-000000000001'::uuid
    ]
    from public.listar_colecciones_documentales(
      (select user_id from biblioteca_test_users where etiqueta = 'admin'),
      'a1000000-0000-4000-8000-000000000001'
    )
    where id = 'c1000000-0000-4000-8000-000000000003'
  ),
  'el repositorio sólo expone los archivos autorizados para ese usuario'
);
select is(
  (
    select cardinality(file_ids)
    from public.listar_colecciones_documentales(
      (select user_id from biblioteca_test_users where etiqueta = 'creator'),
      'a1000000-0000-4000-8000-000000000001'
    )
    where id = 'c1000000-0000-4000-8000-000000000003'
  ),
  2,
  'el propietario ve los dos archivos de su repositorio'
);
select is(
  (
    select count(*)::integer
    from public.listar_colecciones_documentales(
      (select user_id from biblioteca_test_users where etiqueta = 'stranger'),
      'a1000000-0000-4000-8000-000000000001'
    )
    where id = 'c1000000-0000-4000-8000-000000000003'
  ),
  0,
  'el alcance concedido a un usuario no abre el repositorio a terceros'
);

select lives_ok(
  $$
    update public.collections
    set status = 'archived'
    where id = 'c1000000-0000-4000-8000-000000000001';

    insert into public.collections (
      id, tenant_id, name, created_by, kind
    ) values (
      'c1000000-0000-4000-8000-000000000006',
      'a1000000-0000-4000-8000-000000000001',
      'APUNTES PERSONALES',
      (select user_id from biblioteca_test_users where etiqueta = 'creator'),
      'collection'
    )
  $$,
  'un creador puede reutilizar un nombre personal después de archivarlo'
);

select lives_ok(
  $$
    update public.collections
    set status = 'archived'
    where id = 'c1000000-0000-4000-8000-000000000003';

    insert into public.collections (
      id, tenant_id, name, created_by, kind
    ) values (
      'c1000000-0000-4000-8000-000000000007',
      'a1000000-0000-4000-8000-000000000001',
      'REPOSITORIO CURRICULAR COMÚN',
      (select user_id from biblioteca_test_users where etiqueta = 'admin'),
      'curriculum_repository'
    )
  $$,
  'el tenant puede reutilizar el nombre de un repositorio archivado'
);

insert into public.conversaciones_plan (
  id, plan_estudio_id, openai_conversation_id, creado_por, nombre
)
select
  'b1000000-0000-4000-8000-000000000001',
  (select id from public.planes_estudio order by id limit 1),
  'conv_biblioteca_plan_rls',
  (select user_id from biblioteca_test_users where etiqueta = 'creator'),
  'Conversación colaborativa de plan';

insert into public.conversaciones_asignatura (
  id, asignatura_id, openai_conversation_id, creado_por, nombre
)
select
  'b1000000-0000-4000-8000-000000000002',
  (select id from public.asignaturas order by id limit 1),
  'conv_biblioteca_asignatura_rls',
  (select user_id from biblioteca_test_users where etiqueta = 'creator'),
  'Conversación colaborativa de asignatura';

select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', (select user_id from biblioteca_test_users where etiqueta = 'creator'),
    'role', 'authenticated',
    'app_metadata', jsonb_build_object('permisos', jsonb_build_array())
  )::text,
  true
);
set local role authenticated;
select is(
  (select count(*)::integer from public.conversaciones_plan
   where id = 'b1000000-0000-4000-8000-000000000001'),
  1,
  'el creador puede leer la conversación de plan'
);
reset role;

select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', (select user_id from biblioteca_test_users where etiqueta = 'admin'),
    'role', 'authenticated',
    'app_metadata', jsonb_build_object('permisos', jsonb_build_array())
  )::text,
  true
);
set local role authenticated;
select is(
  (select count(*)::integer from public.conversaciones_plan
   where id = 'b1000000-0000-4000-8000-000000000001'),
  1,
  'un colaborador con acceso al plan puede leer su conversación'
);
reset role;

select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', (select user_id from biblioteca_test_users where etiqueta = 'stranger'),
    'role', 'authenticated',
    'app_metadata', jsonb_build_object('permisos', jsonb_build_array())
  )::text,
  true
);
set local role authenticated;
select is(
  (select count(*)::integer from public.conversaciones_plan
   where id = 'b1000000-0000-4000-8000-000000000001'),
  0,
  'un usuario sin acceso al plan no puede leer su conversación'
);
reset role;

select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', (select user_id from biblioteca_test_users where etiqueta = 'creator'),
    'role', 'authenticated',
    'app_metadata', jsonb_build_object('permisos', jsonb_build_array())
  )::text,
  true
);
set local role authenticated;
select is(
  (select count(*)::integer from public.conversaciones_asignatura
   where id = 'b1000000-0000-4000-8000-000000000002'),
  1,
  'el creador puede leer la conversación de asignatura'
);
reset role;

select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', (select user_id from biblioteca_test_users where etiqueta = 'admin'),
    'role', 'authenticated',
    'app_metadata', jsonb_build_object('permisos', jsonb_build_array())
  )::text,
  true
);
set local role authenticated;
select is(
  (select count(*)::integer from public.conversaciones_asignatura
   where id = 'b1000000-0000-4000-8000-000000000002'),
  1,
  'un colaborador con acceso a la asignatura puede leer su conversación'
);
reset role;

select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', (select user_id from biblioteca_test_users where etiqueta = 'stranger'),
    'role', 'authenticated',
    'app_metadata', jsonb_build_object('permisos', jsonb_build_array())
  )::text,
  true
);
set local role authenticated;
select is(
  (select count(*)::integer from public.conversaciones_asignatura
   where id = 'b1000000-0000-4000-8000-000000000002'),
  0,
  'un usuario sin acceso a la asignatura no puede leer su conversación'
);
reset role;

select * from finish();
rollback;
