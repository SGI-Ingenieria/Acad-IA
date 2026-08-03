-- Cascada de OpenAI como caché del acervo documental: refcount de blobs,
-- caché de vector stores por selección, warm-up y GC.

begin;

\ir _fixtures_usuarios.inc

select plan(23);

-- Estructura --------------------------------------------------------------

select has_column('public', 'file_blobs', 'openai_file_id', 'los blobs cachean su File de OpenAI');
select has_column('public', 'file_blobs', 'refcount', 'los blobs cuentan referencias lógicas');
select has_column('public', 'files', 'last_used_at', 'los archivos registran su último uso');
select has_column('public', 'files', 'source', 'los archivos declaran su procedencia');
select has_table('public', 'vector_store_selecciones', 'existe la caché de vector stores por selección');

select ok(
  (select relrowsecurity from pg_class where oid = 'public.vector_store_selecciones'::regclass),
  'la caché de selecciones tiene RLS habilitado'
);
select ok(
  not has_table_privilege('authenticated', 'public.vector_store_selecciones', 'select'),
  'un cliente no lee la caché de vector stores'
);
select ok(
  not has_function_privilege(
    'authenticated', 'public.solicitar_warmup_seleccion(uuid,uuid,uuid[],uuid[])', 'execute'
  ),
  'el warm-up sólo se solicita a través del backend'
);
select ok(
  not has_function_privilege('authenticated', 'public.ejecutar_higiene_documental(integer)', 'execute'),
  'un cliente no ejecuta la higiene documental'
);
select ok(
  exists (
    select 1 from pg_indexes
    where schemaname = 'public'
      and tablename = 'file_blobs'
      and indexname = 'file_blobs_vivos_por_contenido_idx'
  ),
  'la unicidad de contenido es parcial sobre blobs vivos (permite re-subir tras GC)'
);
select ok(
  exists (select 1 from cron.job where jobname = 'higiene-documental-diaria'),
  'la higiene documental está agendada'
);

-- Fixtures ----------------------------------------------------------------

set local role service_role;

insert into public.tenants (id, slug, nombre)
values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'test-cascada', 'Tenant cascada');

insert into public.tenant_memberships (tenant_id, user_id, is_default)
select 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', id, false
from public.usuarios_app order by id limit 1;

insert into public.file_blobs (id, tenant_id, sha256, size_bytes, detected_mime, storage_path, processing_status)
values (
  'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  repeat('a', 64), 6, 'text/plain',
  'content/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/aa/' || repeat('a', 64),
  'ready'
);

insert into public.files (id, tenant_id, display_name, created_by, status)
select 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
       'Documento cascada', id, 'ready'
from public.usuarios_app order by id limit 1;

-- Refcount ----------------------------------------------------------------

select is(
  (select refcount from public.file_blobs where id = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'),
  0,
  'un blob sin versiones tiene refcount 0'
);

insert into public.file_versions (id, tenant_id, file_id, blob_id, version_number, original_filename, uploaded_by)
select 'ffffffff-ffff-4fff-8fff-ffffffffffff', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
       'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
       1, 'cascada.txt', id
from public.usuarios_app order by id limit 1;

update public.files set current_version_id = 'ffffffff-ffff-4fff-8fff-ffffffffffff'
where id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';

select is(
  (select refcount from public.file_blobs where id = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'),
  1,
  'insertar una versión incrementa el refcount'
);
select ok(
  (select refcount_cero_desde is null from public.file_blobs where id = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'),
  'un blob referenciado no es candidato a GC'
);

update public.files
set deleted_at = now(), status = 'deleted'
where id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';

select is(
  (select refcount from public.file_blobs where id = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'),
  0,
  'el soft-delete del archivo decrementa el refcount'
);
select ok(
  (select refcount_cero_desde is not null from public.file_blobs where id = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'),
  'al llegar a 0 el blob marca el inicio de su periodo de gracia'
);

update public.files
set deleted_at = null, status = 'ready'
where id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';

select is(
  (select refcount from public.file_blobs where id = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'),
  1,
  'restaurar el archivo recupera el refcount'
);

-- Warm-up de selección ----------------------------------------------------

select is(
  (
    select count(*)::integer
    from public.solicitar_warmup_seleccion(
      (select id from public.usuarios_app order by id limit 1),
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      array['eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee']::uuid[],
      '{}'::uuid[]
    )
    where warmup_encolado
  ),
  1,
  'el warm-up de una selección nueva encola trabajo'
);
select is(
  (select count(*)::integer from public.vector_store_selecciones
   where tenant_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  1,
  'el warm-up registra la selección en la caché'
);
select is(
  (
    select count(*)::integer
    from public.solicitar_warmup_seleccion(
      (select id from public.usuarios_app order by id limit 1),
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      array['eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee']::uuid[],
      '{}'::uuid[]
    )
    where warmup_encolado
  ),
  0,
  'repetir el warm-up de una selección en construcción no duplica trabajo'
);
select ok(
  (select last_used_at is not null from public.files
   where id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'),
  'seleccionar un archivo alimenta Recientes'
);

-- GC ----------------------------------------------------------------------

update public.files
set deleted_at = now(), status = 'deleted'
where id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';

select is(
  (select count(*)::integer from public.preparar_blob_gc('dddddddd-dddd-4ddd-8ddd-dddddddddddd')),
  1,
  'un blob sin referencias puede prepararse para GC'
);
select ok(
  public.finalizar_blob_gc('dddddddd-dddd-4ddd-8ddd-dddddddddddd'),
  'el GC elimina el blob confirmado'
);

select * from finish();
rollback;
