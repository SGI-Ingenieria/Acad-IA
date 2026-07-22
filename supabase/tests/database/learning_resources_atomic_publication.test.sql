begin;

select plan(25);

select ok(
  to_regprocedure(
    'public.publicar_generacion_recursos_ia(uuid,uuid,text,public.learning_generation_estado,text,timestamptz,jsonb,text,text,jsonb)'
  ) is not null,
  'existe la RPC atómica de publicación de recursos'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.publicar_generacion_recursos_ia(uuid,uuid,text,public.learning_generation_estado,text,timestamptz,jsonb,text,text,jsonb)',
    'execute'
  ),
  'authenticated no puede publicar generaciones de recursos'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.publicar_generacion_recursos_ia(uuid,uuid,text,public.learning_generation_estado,text,timestamptz,jsonb,text,text,jsonb)',
    'execute'
  ),
  'anon no puede publicar generaciones de recursos'
);
select ok(
  not has_function_privilege(
    'service_role',
    'public.publicar_generacion_recursos_ia(uuid,uuid,text,public.learning_generation_estado,text,timestamptz,jsonb,text,text,jsonb)',
    'execute'
  ),
  'service_role no puede llamar la primitiva interna de publicación'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.consultar_publicacion_generacion_recursos_ia(uuid,text,text,text,jsonb)',
    'execute'
  ),
  'authenticated no puede inspeccionar la publicación interna'
);
select ok(
  not has_function_privilege(
    'service_role',
    'public.consultar_publicacion_generacion_recursos_ia(uuid,text,text,text,jsonb)',
    'execute'
  ),
  'service_role tampoco puede inspeccionar la primitiva de verificación'
);
select ok(
  has_function_privilege(
    'service_role',
    'public.publicar_intento_recursos_ia(uuid,uuid,uuid,uuid,text,public.learning_generation_estado,text,timestamptz,jsonb)',
    'execute'
  ),
  'service_role publica a través de la RPC del outbox'
);

-- La primitiva ya no es invocable por service_role: los workers entran por
-- publicar_intento_recursos_ia. Aquí se ejercita su lógica atómica como
-- superusuario (dueño de la función), sin cambiar de rol.

create temporary table learning_publication_fixture as
select
  a.id as asignatura_id,
  tm.user_id,
  tm.tenant_id
from public.asignaturas a
cross join lateral (
  select membership.user_id, membership.tenant_id
  from public.tenant_memberships membership
  join public.usuarios_app usuario on usuario.id = membership.user_id
  where membership.is_default
  order by membership.created_at
  limit 1
) tm
limit 1;

select ok(
  (
    select asignatura_id is not null and user_id is not null and tenant_id is not null
    from learning_publication_fixture
  ),
  'existen asignatura, usuario y tenant para la publicación'
);

insert into public.file_blobs (
  id, tenant_id, sha256, size_bytes, detected_mime, storage_path,
  processing_status
)
select
  '7a200000-0000-4000-8000-000000000001',
  tenant_id,
  repeat('7', 64),
  32,
  'text/plain',
  'content/' || tenant_id::text || '/77/' || repeat('7', 64),
  'ready'
from learning_publication_fixture;

insert into public.files (
  id, tenant_id, display_name, created_by, status
)
select
  '7a300000-0000-4000-8000-000000000001',
  tenant_id,
  'Referencia de publicación atómica',
  user_id,
  'ready'
from learning_publication_fixture;

insert into public.file_versions (
  id, tenant_id, file_id, blob_id, version_number, original_filename,
  uploaded_by
)
select
  '7a400000-0000-4000-8000-000000000001',
  tenant_id,
  '7a300000-0000-4000-8000-000000000001',
  '7a200000-0000-4000-8000-000000000001',
  1,
  'referencia.txt',
  user_id
from learning_publication_fixture;

update public.files
set current_version_id = '7a400000-0000-4000-8000-000000000001'
where id = '7a300000-0000-4000-8000-000000000001';

insert into public.learning_generation_jobs (
  id, asignatura_id, scope, estado, requested_types, creado_por
)
select
  '7a100000-0000-4000-8000-000000000001',
  asignatura_id,
  'asignatura',
  'running',
  array['apunte']::public.learning_object_tipo[],
  user_id
from learning_publication_fixture;

select throws_ok(
  $$ select public.registrar_trabajo_generacion_ia(
       'recursos_aprendizaje',
       '7a100000-0000-4000-8000-000000000001',
       'resp_learning_too_early',
       'queued'
     ) $$,
  '55000',
  'la respuesta de recursos todavía no fue publicada',
  'un webhook temprano no puede hacer visible el trabajo'
);
select is(
  (
    select count(*)::integer
    from public.trabajos_generacion_ia
    where openai_response_id = 'resp_learning_too_early'
  ),
  0,
  'el intento temprano no deja bitácora reclamable'
);

select is(
  (
    public.publicar_generacion_recursos_ia(
      '7a100000-0000-4000-8000-000000000001',
      (select user_id from learning_publication_fixture),
      'resp_learning_publicada',
      'running',
      'queued',
      now(),
      '{"source":"pgtap"}'::jsonb,
      'direct',
      '',
      '[{"fileId":"7a300000-0000-4000-8000-000000000001","fileVersionId":"7a400000-0000-4000-8000-000000000001","chunkIds":[],"scores":{}}]'::jsonb
    ) ->> 'resolution'
  ),
  'published',
  'publica job, trabajo y snapshot en una sola llamada'
);
select is(
  (
    select openai_response_id
    from public.learning_generation_jobs
    where id = '7a100000-0000-4000-8000-000000000001'
  ),
  'resp_learning_publicada',
  'el response_id local queda vigente después del commit'
);
select is(
  (
    select count(*)::integer
    from public.trabajos_generacion_ia
    where tipo_entidad = 'recursos_aprendizaje'
      and entidad_id = '7a100000-0000-4000-8000-000000000001'
      and openai_response_id = 'resp_learning_publicada'
  ),
  1,
  'la bitácora global contiene exactamente el trabajo publicado'
);
select is(
  (
    select count(*)::integer
    from public.ai_request_references
    where request_id = 'resp_learning_publicada'
      and file_version_id = '7a400000-0000-4000-8000-000000000001'
  ),
  1,
  'el snapshot conserva la versión documental exacta'
);
select is(
  (
    public.consultar_publicacion_generacion_recursos_ia(
      '7a100000-0000-4000-8000-000000000001',
      'resp_learning_publicada',
      'direct',
      '',
      '[{"fileId":"7a300000-0000-4000-8000-000000000001","fileVersionId":"7a400000-0000-4000-8000-000000000001","chunkIds":[],"scores":{}}]'::jsonb
    ) ->> 'resolution'
  ),
  'published',
  'el verificador confirma un commit cuyo transporte pudo ser ambiguo'
);
select is(
  (
    public.publicar_generacion_recursos_ia(
      '7a100000-0000-4000-8000-000000000001',
      (select user_id from learning_publication_fixture),
      'resp_learning_publicada',
      'running',
      'queued',
      now(),
      '{"retry":true}'::jsonb,
      'direct',
      '',
      '[{"fileId":"7a300000-0000-4000-8000-000000000001","fileVersionId":"7a400000-0000-4000-8000-000000000001","chunkIds":[],"scores":{}}]'::jsonb
    ) ->> 'resolution'
  ),
  'published',
  'repetir la publicación exacta es idempotente'
);
select is(
  (
    select count(*)::integer
    from public.trabajos_generacion_ia
    where entidad_id = '7a100000-0000-4000-8000-000000000001'
      and estado in ('pendiente', 'reclamado')
  ),
  1,
  'el reintento no duplica el trabajo activo'
);

select throws_ok(
  $$ select public.publicar_generacion_recursos_ia(
       '7a100000-0000-4000-8000-000000000001',
       (select user_id from learning_publication_fixture),
       'resp_learning_perdedora',
       'running', 'queued', now(), '{}'::jsonb, 'none', '', '[]'::jsonb
     ) $$,
  '55000',
  'el job de recursos ya apunta a otra respuesta de OpenAI',
  'dos publicadores serializados producen un único ganador'
);
select is(
  (
    select openai_response_id
    from public.learning_generation_jobs
    where id = '7a100000-0000-4000-8000-000000000001'
  ),
  'resp_learning_publicada',
  'la respuesta perdedora no sustituye a la vigente'
);
select is(
  (
    public.consultar_publicacion_generacion_recursos_ia(
      '7a100000-0000-4000-8000-000000000001',
      'resp_learning_perdedora',
      'none', '', '[]'::jsonb
    ) ->> 'resolution'
  ),
  'claimed_elsewhere',
  'el verificador identifica de forma explícita a la respuesta perdedora'
);

insert into public.learning_generation_jobs (
  id, asignatura_id, scope, estado, requested_types, creado_por
)
select
  '7a100000-0000-4000-8000-000000000002',
  asignatura_id,
  'asignatura',
  'running',
  array['apunte']::public.learning_object_tipo[],
  user_id
from learning_publication_fixture;

create or replace function pg_temp.forzar_rollback_publicacion_recursos()
returns trigger language plpgsql as $$
begin
  if new.request_id = 'resp_learning_publication_rollback' then
    raise exception using errcode = 'P0001', message = 'forced resource publication rollback';
  end if;
  return new;
end;
$$;
create trigger trg_forzar_rollback_publicacion_recursos
before insert on public.ai_request_references
for each row execute function pg_temp.forzar_rollback_publicacion_recursos();

select throws_ok(
  $$ select public.publicar_generacion_recursos_ia(
       '7a100000-0000-4000-8000-000000000002',
       (select user_id from learning_publication_fixture),
       'resp_learning_publication_rollback',
       'running', 'queued', now(), '{}'::jsonb, 'direct', '',
       '[{"fileId":"7a300000-0000-4000-8000-000000000001","fileVersionId":"7a400000-0000-4000-8000-000000000001","chunkIds":[],"scores":{}}]'::jsonb
     ) $$,
  'P0001',
  'forced resource publication rollback',
  'un fallo al congelar referencias revierte toda la publicación'
);
select is(
  (
    select openai_response_id
    from public.learning_generation_jobs
    where id = '7a100000-0000-4000-8000-000000000002'
  ),
  null::text,
  'el rollback no expone response_id en el job local'
);
select is(
  (
    select count(*)::integer
    from public.trabajos_generacion_ia
    where openai_response_id = 'resp_learning_publication_rollback'
  ),
  0,
  'el rollback no deja trabajo global reclamable'
);
select is(
  (
    select count(*)::integer
    from public.ai_request_references
    where request_id = 'resp_learning_publication_rollback'
  ),
  0,
  'el rollback tampoco deja un snapshot documental parcial'
);

select ok(
  (
    select metadata @> jsonb_build_object(
      'publishedAtomically', true,
      'initiatedBy', (select user_id from learning_publication_fixture)
    )
    from public.trabajos_generacion_ia
    where openai_response_id = 'resp_learning_publicada'
  ),
  'la bitácora conserva iniciador y marca de publicación atómica'
);

select * from finish();
rollback;
