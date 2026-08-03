begin;

\ir _fixtures_usuarios.inc

select plan(24);

select ok(
  to_regprocedure(
    'public.publicar_solicitud_chat_ia(public.tipo_conversacion_documental,uuid,uuid,uuid,text,text,timestamptz,jsonb,text,text,jsonb)'
  ) is not null,
  'existe la RPC atómica de publicación de chats'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.publicar_solicitud_chat_ia(public.tipo_conversacion_documental,uuid,uuid,uuid,text,text,timestamptz,jsonb,text,text,jsonb)',
    'execute'
  ),
  'authenticated no puede publicar una respuesta de chat'
);
select ok(
  has_function_privilege(
    'service_role',
    'public.publicar_solicitud_chat_ia(public.tipo_conversacion_documental,uuid,uuid,uuid,text,text,timestamptz,jsonb,text,text,jsonb)',
    'execute'
  ),
  'service_role puede ejecutar la publicación atómica'
);

set local role service_role;

create temporary table chat_publicacion_fixture as
select
  (select id from public.planes_estudio order by creado_en limit 1) as plan_id,
  (select id from public.asignaturas order by creado_en limit 1) as asignatura_id,
  (select id from public.usuarios_app order by creado_en limit 1) as usuario_id,
  (select id from public.usuarios_app order by creado_en offset 1 limit 1) as otro_usuario_id;

alter table chat_publicacion_fixture add column tenant_id uuid;
update chat_publicacion_fixture f
set tenant_id = (
  select tm.tenant_id
  from public.tenant_memberships tm
  where tm.user_id = f.usuario_id and tm.is_default
  limit 1
);

select ok(
  (
    select plan_id is not null
      and asignatura_id is not null
      and usuario_id is not null
      and otro_usuario_id is not null
      and tenant_id is not null
    from chat_publicacion_fixture
  ),
  'existen entidades base, dos usuarios y tenant documental'
);

insert into public.conversaciones_plan (
  id, plan_estudio_id, openai_conversation_id, creado_por, nombre
)
select
  'cb100000-0000-4000-8000-000000000001',
  plan_id,
  'conv_chat_publicacion_plan',
  usuario_id,
  'Publicación atómica de plan'
from chat_publicacion_fixture;

insert into public.conversaciones_asignatura (
  id, asignatura_id, openai_conversation_id, creado_por, nombre
)
select
  'cb100000-0000-4000-8000-000000000002',
  asignatura_id,
  'conv_chat_publicacion_asignatura',
  usuario_id,
  'Publicación atómica de asignatura'
from chat_publicacion_fixture;

insert into public.plan_mensajes_ia (
  id, enviado_por, mensaje, conversacion_plan_id, estado
)
select
  'cb200000-0000-4000-8000-000000000001',
  usuario_id,
  'Solicitud original para reintentar.',
  'cb100000-0000-4000-8000-000000000001',
  'ERROR'
from chat_publicacion_fixture;

insert into public.plan_mensajes_ia (
  id, enviado_por, mensaje, conversacion_plan_id, retry_of_message_id
)
select
  'cb200000-0000-4000-8000-000000000002',
  usuario_id,
  'Reintento que debe conservar un snapshot vacío.',
  'cb100000-0000-4000-8000-000000000001',
  'cb200000-0000-4000-8000-000000000001'
from chat_publicacion_fixture;

select throws_ok(
  $$ select public.registrar_trabajo_generacion_ia(
       'chat_plan',
       'cb200000-0000-4000-8000-000000000002',
       'resp_chat_antes_commit',
       'completed'
     ) $$,
  '55000',
  'la respuesta de chat todavía no fue publicada',
  'un webhook temprano no puede adoptar antes de publicar response_id'
);
select is(
  (
    select count(*)::integer
    from public.trabajos_generacion_ia
    where openai_response_id = 'resp_chat_antes_commit'
  ),
  0,
  'el intento temprano no deja un trabajo reclamable'
);

select is(
  (
    public.publicar_solicitud_chat_ia(
      'plan',
      'cb100000-0000-4000-8000-000000000001',
      'cb200000-0000-4000-8000-000000000002',
      (select usuario_id from chat_publicacion_fixture),
      'resp_chat_plan_atomico',
      'queued',
      now(),
      '{"source":"pgtap"}'::jsonb,
      'none',
      'Reintento sin referencias.',
      '[]'::jsonb
    )
  ).estado::text,
  'pendiente',
  'un reintento sin referencias publica el trabajo'
);
select is(
  (
    select openai_response_id
    from public.plan_mensajes_ia
    where id = 'cb200000-0000-4000-8000-000000000002'
  ),
  'resp_chat_plan_atomico',
  'el mensaje publica el response_id en la misma operación'
);
select is(
  (
    select count(*)::integer
    from public.trabajos_generacion_ia
    where openai_response_id = 'resp_chat_plan_atomico'
      and tipo_entidad = 'chat_plan'
  ),
  1,
  'la bitácora adopta exactamente el trabajo de plan publicado'
);
select is(
  (
    select count(*)::integer
    from public.ai_request_references
    where request_id = 'resp_chat_plan_atomico'
  ),
  0,
  'cero referencias sigue siendo un snapshot atómico válido'
);

insert into public.file_blobs (
  id, tenant_id, sha256, size_bytes, detected_mime, storage_path,
  processing_status
)
select
  'cb300000-0000-4000-8000-000000000001',
  tenant_id,
  repeat('c', 64),
  24,
  'text/plain',
  'content/' || tenant_id::text || '/cc/' || repeat('c', 64),
  'ready'
from chat_publicacion_fixture;

insert into public.files (
  id, tenant_id, display_name, created_by, status
)
select
  'cb400000-0000-4000-8000-000000000001',
  tenant_id,
  'Referencia transaccional',
  usuario_id,
  'ready'
from chat_publicacion_fixture;

insert into public.file_versions (
  id, tenant_id, file_id, blob_id, version_number, original_filename,
  uploaded_by
)
select
  'cb500000-0000-4000-8000-000000000001',
  tenant_id,
  'cb400000-0000-4000-8000-000000000001',
  'cb300000-0000-4000-8000-000000000001',
  1,
  'referencia.txt',
  usuario_id
from chat_publicacion_fixture;

update public.files
set current_version_id = 'cb500000-0000-4000-8000-000000000001'
where id = 'cb400000-0000-4000-8000-000000000001';

insert into public.document_chunks (
  id, tenant_id, file_version_id, chunk_index, text, token_count,
  text_sha256, chunker_version
)
select
  'cb600000-0000-4000-8000-000000000001',
  tenant_id,
  'cb500000-0000-4000-8000-000000000001',
  0,
  'Evidencia curricular trazable.',
  5,
  repeat('d', 64),
  'pgtap-v1'
from chat_publicacion_fixture;

insert into public.asignatura_mensajes_ia (
  id, enviado_por, mensaje, conversacion_asignatura_id
)
select
  'cb200000-0000-4000-8000-000000000003',
  usuario_id,
  'Analiza la evidencia de la asignatura.',
  'cb100000-0000-4000-8000-000000000002'
from chat_publicacion_fixture;

select is(
  (
    public.publicar_solicitud_chat_ia(
      'asignatura',
      'cb100000-0000-4000-8000-000000000002',
      'cb200000-0000-4000-8000-000000000003',
      (select usuario_id from chat_publicacion_fixture),
      'resp_chat_asignatura_atomico',
      'queued',
      now(),
      '{"source":"pgtap"}'::jsonb,
      'retrieval',
      'Analiza la evidencia de la asignatura.',
      jsonb_build_array(jsonb_build_object(
        'fileId', 'cb400000-0000-4000-8000-000000000001',
        'fileVersionId', 'cb500000-0000-4000-8000-000000000001',
        'chunkIds', jsonb_build_array('cb600000-0000-4000-8000-000000000001'),
        'scores', jsonb_build_object(
          'cb600000-0000-4000-8000-000000000001', 0.91
        )
      ))
    )
  ).estado::text,
  'pendiente',
  'la asignatura publica response, trabajo y referencia recuperada'
);
select is(
  (
    select openai_response_id
    from public.asignatura_mensajes_ia
    where id = 'cb200000-0000-4000-8000-000000000003'
  ),
  'resp_chat_asignatura_atomico',
  'el response_id de asignatura queda vigente'
);
select is(
  (
    select count(*)::integer
    from public.trabajos_generacion_ia
    where openai_response_id = 'resp_chat_asignatura_atomico'
      and tipo_entidad = 'chat_asignatura'
  ),
  1,
  'existe un único trabajo de asignatura'
);
select is(
  (
    select count(*)::integer
    from public.ai_request_references
    where request_id = 'resp_chat_asignatura_atomico'
      and message_id = 'cb200000-0000-4000-8000-000000000003'
      and file_version_id = 'cb500000-0000-4000-8000-000000000001'
  ),
  1,
  'la referencia queda ligada al mensaje y versión exactos'
);
select is(
  (
    select chunk_ids
    from public.ai_request_references
    where request_id = 'resp_chat_asignatura_atomico'
  ),
  array['cb600000-0000-4000-8000-000000000001'::uuid],
  'el snapshot conserva los chunks recuperados'
);
select is(
  (
    select count(*)::integer
    from public.conversation_files
    where conversation_type = 'asignatura'
      and conversation_id = 'cb100000-0000-4000-8000-000000000002'
      and file_id = 'cb400000-0000-4000-8000-000000000001'
      and removed_at is null
  ),
  1,
  'el archivo aparece en el chat en la misma transacción'
);

insert into public.plan_mensajes_ia (
  id, enviado_por, mensaje, conversacion_plan_id
)
select
  'cb200000-0000-4000-8000-000000000004',
  usuario_id,
  'Esta publicación debe revertirse.',
  'cb100000-0000-4000-8000-000000000001'
from chat_publicacion_fixture;

select throws_ok(
  $$ select public.publicar_solicitud_chat_ia(
       'plan',
       'cb100000-0000-4000-8000-000000000001',
       'cb200000-0000-4000-8000-000000000004',
       (select usuario_id from chat_publicacion_fixture),
       'resp_chat_rollback',
       'queued',
       now(),
       '{}'::jsonb,
       'direct',
       '',
       '[{"fileId":"cb400000-0000-4000-8000-000000000001","fileVersionId":"cb500000-0000-4000-8000-000000000099","chunkIds":[],"scores":{}}]'::jsonb
     ) $$,
  '23503',
  'la versión documental no pertenece al archivo y tenant indicados',
  'una referencia inválida aborta toda la publicación'
);
select is(
  (
    select openai_response_id
    from public.plan_mensajes_ia
    where id = 'cb200000-0000-4000-8000-000000000004'
  ),
  null::text,
  'el rollback no hace visible el response_id'
);
select is(
  (
    select count(*)::integer
    from public.trabajos_generacion_ia
    where openai_response_id = 'resp_chat_rollback'
  ),
  0,
  'el rollback tampoco deja trabajo adoptable'
);

select throws_ok(
  $$ select public.publicar_solicitud_chat_ia(
       'plan',
       'cb100000-0000-4000-8000-000000000001',
       'cb200000-0000-4000-8000-000000000004',
       (select otro_usuario_id from chat_publicacion_fixture),
       'resp_chat_otro_autor',
       'queued', now(), '{}'::jsonb, 'none', '', '[]'::jsonb
     ) $$,
  '42501',
  'el usuario no es autor del mensaje',
  'la RPC rechaza publicar a nombre de otro autor'
);
select is(
  (
    select openai_response_id
    from public.plan_mensajes_ia
    where id = 'cb200000-0000-4000-8000-000000000004'
  ),
  null::text,
  'el rechazo de autor no modifica el mensaje'
);

select throws_ok(
  $$ select public.publicar_solicitud_chat_ia(
       'plan',
       'cb100000-0000-4000-8000-000000000001',
       'cb200000-0000-4000-8000-000000000002',
       (select usuario_id from chat_publicacion_fixture),
       'resp_chat_plan_obsoleta',
       'queued', now(), '{}'::jsonb, 'none', '', '[]'::jsonb
     ) $$,
  '55000',
  'el mensaje ya apunta a otra respuesta de OpenAI',
  'una respuesta atrasada no reemplaza la vigente'
);
select is(
  (
    select openai_response_id
    from public.plan_mensajes_ia
    where id = 'cb200000-0000-4000-8000-000000000002'
  ),
  'resp_chat_plan_atomico',
  'la respuesta vigente permanece intacta'
);

select ok(
  (
    select metadata @> jsonb_build_object(
      'initiatedBy', (select usuario_id from chat_publicacion_fixture),
      'publishedAtomically', true
    )
    from public.trabajos_generacion_ia
    where openai_response_id = 'resp_chat_plan_atomico'
  ),
  'la bitácora conserva iniciador y marca de publicación atómica'
);

select * from finish();
rollback;
