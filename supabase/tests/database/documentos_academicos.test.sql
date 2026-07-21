begin;

select plan(39);

select has_table('public', 'tenants', 'existe la frontera institucional documental');
select has_table('public', 'upload_sessions', 'existen sesiones de carga');
select has_table('public', 'file_blobs', 'existen blobs físicos inmutables');
select has_table('public', 'files', 'existen archivos lógicos');
select has_table('public', 'file_versions', 'existen versiones inmutables');
select has_table('public', 'document_chunks', 'existen chunks recuperables');
select has_table('public', 'ingestion_jobs', 'existen trabajos durables');

select ok(
  (select relrowsecurity from pg_class where oid = 'public.file_blobs'::regclass),
  'los blobs tienen RLS habilitado'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.document_chunks'::regclass),
  'los chunks tienen RLS habilitado'
);
select ok(
  not has_table_privilege('authenticated', 'public.file_blobs', 'select'),
  'un cliente no lee blobs directamente'
);
select ok(
  not has_table_privilege('authenticated', 'public.document_chunks', 'select'),
  'un cliente no lee chunks directamente'
);
select ok(
  not has_table_privilege('authenticated', 'public.upload_sessions', 'select'),
  'un cliente no lee la bitácora de sesiones de carga'
);
select ok(
  has_function_privilege(
    'authenticated',
    'public.puede_usar_carga_documental_temporal(text,boolean)',
    'execute'
  ),
  'Storage puede comprobar una sesión sin abrir la bitácora al cliente'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.search_authorized_chunks(uuid,uuid,uuid[],uuid[],uuid,text,extensions.vector,integer)',
    'execute'
  ),
  'un cliente no invoca la búsqueda privilegiada directamente'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.finalizar_extraccion_openai_documental(text,text,jsonb,jsonb)',
    'execute'
  ),
  'un cliente no puede finalizar extracciones de OpenAI'
);
select ok(
  has_function_privilege(
    'service_role',
    'public.registrar_webhook_documental(text,text,text,jsonb)',
    'execute'
  ),
  'sólo el worker puede registrar entregas de webhook'
);
select ok(
  has_function_privilege(
    'service_role',
    'public.listar_biblioteca_documental(uuid,uuid,text,text,integer,integer)',
    'execute'
  ),
  'service_role puede listar la biblioteca en una operación paginada'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.listar_biblioteca_documental(uuid,uuid,text,text,integer,integer)',
    'execute'
  ),
  'el cliente no puede elegir usuario o tenant al listar la biblioteca'
);
select ok(
  has_function_privilege(
    'service_role',
    'public.listar_archivos_conversacion_documental(uuid,uuid,public.tipo_conversacion_documental,uuid)',
    'execute'
  ),
  'service_role puede resolver archivos e historial del chat en una operación'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.listar_archivos_conversacion_documental(uuid,uuid,public.tipo_conversacion_documental,uuid)',
    'execute'
  ),
  'el cliente no puede invocar el listado privilegiado de archivos del chat'
);
select ok(
  has_function_privilege(
    'service_role',
    'public.finalizar_indexacion_documental(uuid)',
    'execute'
  ),
  'service_role puede cerrar la indexación transaccionalmente'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.finalizar_indexacion_documental(uuid)',
    'execute'
  ),
  'el cliente no puede marcar un archivo como indexado'
);
select ok(
  exists (
    select 1 from pg_indexes
    where schemaname = 'public'
      and tablename = 'document_chunks'
      and indexname = 'document_chunks_embedding_hnsw_idx'
  ),
  'los embeddings tienen índice HNSW'
);
select is(
  (select count(*)::integer from pgmq.list_queues() where queue_name like 'file-%'),
  5,
  'las cinco colas documentales son durables'
);
select ok(
  exists (
    select 1 from storage.buckets
    where id = 'documentos-academicos'
      and public = false
      and file_size_limit = 20971520
  ),
  'el bucket documental es privado y limita los archivos a 20 MiB'
);

set local role service_role;
insert into public.tenants (id, slug, nombre)
values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'test-documentos', 'Tenant de pruebas');

insert into public.tenant_memberships (tenant_id, user_id, is_default)
select 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', id, false
from public.usuarios_app
order by id
limit 1;

insert into public.file_blobs (
  id, tenant_id, sha256, size_bytes, detected_mime, storage_path,
  processing_status
)
values (
  'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  repeat('a', 64),
  6,
  'text/plain',
  'content/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/aa/' || repeat('a', 64),
  'ready'
);

insert into public.files (
  id, tenant_id, display_name, created_by, status
)
select
  'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'Documento trazable',
  id,
  'ready'
from public.usuarios_app
order by id
limit 1;

insert into public.file_versions (
  id, tenant_id, file_id, blob_id, version_number, original_filename,
  uploaded_by
)
select
  'ffffffff-ffff-4fff-8fff-ffffffffffff',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
  'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  1,
  'documento.txt',
  id
from public.usuarios_app
order by id
limit 1;

update public.files
set current_version_id = 'ffffffff-ffff-4fff-8fff-ffffffffffff'
where id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';

select is(
  (
    select count(*)::integer
    from public.listar_biblioteca_documental(
      (select id from public.usuarios_app order by id limit 1),
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      'trazable',
      'name_asc',
      25,
      0
    )
    where id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'
  ),
  1,
  'la biblioteca filtra y autoriza archivos de forma set-based'
);

insert into public.file_user_state (tenant_id, user_id, file_id, archived_at)
select
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  id,
  'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
  now()
from public.usuarios_app
order by id
limit 1;

select is(
  (
    select count(*)::integer
    from public.listar_biblioteca_documental(
      (select id from public.usuarios_app order by id limit 1),
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      null,
      'updated_desc',
      25,
      0
    )
  ),
  0,
  'la biblioteca omite los archivos archivados por el usuario'
);

update public.file_user_state
set archived_at = null
where tenant_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
  and file_id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';

insert into public.conversation_files (
  tenant_id, conversation_type, conversation_id, file_id, added_by
)
select
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'plan',
  '11111111-1111-4111-8111-111111111111',
  'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
  id
from public.usuarios_app
order by id
limit 1;

insert into public.ai_request_references (
  tenant_id, request_id, conversation_type, conversation_id,
  file_id, file_version_id, mode
)
values (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'resp_test_documento',
  'plan',
  '11111111-1111-4111-8111-111111111111',
  'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
  'ffffffff-ffff-4fff-8fff-ffffffffffff',
  'direct'
);

select ok(
  coalesce(
    (
      select used and not can_remove
      from public.listar_archivos_conversacion_documental(
        (select id from public.usuarios_app order by id limit 1),
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        'plan',
        '11111111-1111-4111-8111-111111111111'
      )
      where file_id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'
    ),
    false
  ),
  'el listado del chat marca una referencia usada como inmutable'
);

select throws_ok(
  $$ update public.conversation_files
     set removed_at = now()
     where conversation_type = 'plan'
       and conversation_id = '11111111-1111-4111-8111-111111111111'
       and file_id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee' $$,
  '55000',
  'la referencia ya fue utilizada por una petición de IA',
  'una referencia usada no puede retirarse del chat'
);

insert into public.conversation_files (
  tenant_id, conversation_type, conversation_id, file_id, added_by
)
select
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'plan',
  '22222222-2222-4222-8222-222222222222',
  'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
  id
from public.usuarios_app
order by id
limit 1;

select lives_ok(
  $$ update public.conversation_files
     set removed_at = now()
     where conversation_type = 'plan'
       and conversation_id = '22222222-2222-4222-8222-222222222222'
       and file_id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee' $$,
  'una asociación todavía no usada sí puede retirarse'
);

select throws_ok(
  $$ update public.files
     set deleted_at = now(), status = 'deleted'
     where id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee' $$,
  '55000',
  'el archivo ya fue utilizado y debe conservarse para trazabilidad',
  'un archivo usado no puede borrarse lógicamente'
);

insert into public.upload_sessions (
  id, tenant_id, user_id, temporary_path, original_filename,
  declared_mime, declared_size
)
select
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  id,
  'tmp/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb/cccccccc-cccc-cccc-cccc-cccccccccccc',
  'prueba.txt',
  'text/plain',
  6
from public.usuarios_app
order by id
limit 1;

select set_config(
  'request.jwt.claim.sub',
  (select user_id::text from public.upload_sessions where id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'),
  true
);
set local role authenticated;
select ok(
  public.puede_usar_carga_documental_temporal(
    'tmp/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb/cccccccc-cccc-cccc-cccc-cccccccccccc',
    false
  ),
  'la política reconoce la sesión temporal del usuario autenticado'
);
set local role service_role;

update public.upload_sessions
set result_file_id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
    status = 'embedding'
where id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
update public.files
set status = 'processing'
where id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
update public.file_blobs
set processing_status = 'processing'
where id = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
insert into public.document_chunks (
  tenant_id, file_version_id, chunk_index, text, token_count, text_sha256,
  chunker_version, embedding, embedding_model, embedding_version
) values (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'ffffffff-ffff-4fff-8fff-ffffffffffff',
  0,
  'Contenido ya indexado.',
  4,
  repeat('b', 64),
  'v1',
  array_fill(0::real, array[1536])::extensions.vector,
  'text-embedding-3-small',
  'v1'
);

select ok(
  public.finalizar_indexacion_documental(
    'ffffffff-ffff-4fff-8fff-ffffffffffff'
  ),
  'el reintento sin chunks pendientes finaliza la indexación'
);
select is(
  (select status::text from public.files
   where id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'),
  'ready',
  'el archivo deja de permanecer en processing'
);
select is(
  (select processing_status::text from public.file_blobs
   where id = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'),
  'ready',
  'el blob queda listo en la misma transacción'
);
select is(
  (select status::text from public.upload_sessions
   where id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'),
  'ready',
  'la sesión de carga refleja la finalización'
);
select ok(
  public.finalizar_indexacion_documental(
    'ffffffff-ffff-4fff-8fff-ffffffffffff'
  ),
  'finalizar de nuevo es idempotente'
);

select lives_ok(
  $$ select public.encolar_trabajo_ingesta_documental(
       'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
       null, null, 'cleanup', 'cleanup:test-documentos', '{}'::jsonb
     ) $$,
  'service_role puede encolar un trabajo idempotente'
);
select is(
  (select count(*)::integer from public.ingestion_jobs where idempotency_key = 'cleanup:test-documentos'),
  1,
  'la misma clave de idempotencia no duplica trabajos'
);

select * from finish();
rollback;
