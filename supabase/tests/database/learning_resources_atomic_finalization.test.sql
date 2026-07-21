begin;

select plan(30);

select ok(
  to_regprocedure(
    'public.finalizar_recursos_aprendizaje_ia(uuid,uuid,uuid,text,text,jsonb,jsonb,jsonb)'
  ) is not null,
  'existe la RPC atómica de recursos'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.finalizar_recursos_aprendizaje_ia(uuid,uuid,uuid,text,text,jsonb,jsonb,jsonb)',
    'execute'
  ),
  'authenticated no puede finalizar recursos directamente'
);
select ok(
  has_function_privilege(
    'service_role',
    'public.finalizar_recursos_aprendizaje_ia(uuid,uuid,uuid,text,text,jsonb,jsonb,jsonb)',
    'execute'
  ),
  'service_role puede ejecutar el finalizador atómico'
);

set local role service_role;

create temporary table test_resource_claims (
  nombre text primary key,
  trabajo_id uuid not null,
  token uuid not null
) on commit drop;

insert into public.learning_generation_jobs (
  id,
  asignatura_id,
  scope,
  estado,
  requested_types,
  openai_response_id
) values (
  '51000000-0000-0000-0000-000000000001',
  '22222222-2222-4222-8222-000000000001',
  'asignatura',
  'needs_review',
  array['apunte']::public.learning_object_tipo[],
  'resp_learning_atomic_1'
);

select public.registrar_trabajo_generacion_ia(
  'recursos_aprendizaje',
  '51000000-0000-0000-0000-000000000001',
  'resp_learning_atomic_1',
  'completed'
);
insert into test_resource_claims (nombre, trabajo_id, token)
select 'vigente_1', (claim).id, (claim).token_reclamacion
from (
  select public.reclamar_trabajo_generacion_ia(
    'resp_learning_atomic_1', 'worker-recursos-1'
  ) as claim
) claimed;

select is(
  (
    public.finalizar_recursos_aprendizaje_ia(
      (select trabajo_id from test_resource_claims where nombre = 'vigente_1'),
      (select token from test_resource_claims where nombre = 'vigente_1'),
      '51000000-0000-0000-0000-000000000001',
      'resp_learning_atomic_1',
      'completed',
      '{"resumen_generacion":"Resultado uno","resources":[],"quality_score":{}}'::jsonb,
      '[{"tipo":"apunte","titulo":"Apunte uno","descripcion":"Contenido","contenido_json":{"markdown":"# Uno"},"score":91,"source_refs":[],"metadata":{"generatedBy":"pgTAP"}}]'::jsonb,
      '{"score_total":91,"rubrica_json":{"claridad":91},"recomendaciones_json":[]}'::jsonb
    )
  ).estado::text,
  'completado',
  'el propietario vigente confirma la transición global'
);
select is(
  (
    select estado::text
    from public.learning_generation_jobs
    where id = '51000000-0000-0000-0000-000000000001'
  ),
  'completed',
  'el trabajo local se completa en la misma RPC'
);
select is(
  (
    select count(*)::integer
    from public.learning_objects
    where generation_job_id = '51000000-0000-0000-0000-000000000001'
  ),
  1,
  'los objetos se insertan una sola vez'
);
select is(
  (
    select count(*)::integer
    from public.learning_quality_scores
    where generation_job_id = '51000000-0000-0000-0000-000000000001'
  ),
  1,
  'el score queda asociado al mismo trabajo'
);
select is(
  (
    select (metadata ->> 'objetos_aplicados')::integer
    from public.trabajos_generacion_ia
    where openai_response_id = 'resp_learning_atomic_1'
  ),
  1,
  'la bitácora registra cuántos objetos se aplicaron'
);

insert into public.learning_generation_jobs (
  id,
  asignatura_id,
  scope,
  estado,
  requested_types,
  openai_response_id
) values (
  '52000000-0000-0000-0000-000000000002',
  '22222222-2222-4222-8222-000000000001',
  'asignatura',
  'needs_review',
  array['quiz']::public.learning_object_tipo[],
  'resp_learning_atomic_2'
);
select public.registrar_trabajo_generacion_ia(
  'recursos_aprendizaje',
  '52000000-0000-0000-0000-000000000002',
  'resp_learning_atomic_2',
  'completed'
);
insert into test_resource_claims (nombre, trabajo_id, token)
select 'vencida_2', (claim).id, (claim).token_reclamacion
from (
  select public.reclamar_trabajo_generacion_ia(
    'resp_learning_atomic_2', 'worker-recursos-viejo'
  ) as claim
) claimed;
update public.trabajos_generacion_ia
set reclamado_hasta = now() - interval '1 second'
where openai_response_id = 'resp_learning_atomic_2';
insert into test_resource_claims (nombre, trabajo_id, token)
select 'vigente_2', (claim).id, (claim).token_reclamacion
from (
  select public.reclamar_trabajo_generacion_ia(
    'resp_learning_atomic_2', 'worker-recursos-nuevo'
  ) as claim
) claimed;

select is(
  (
    public.finalizar_recursos_aprendizaje_ia(
      (select trabajo_id from test_resource_claims where nombre = 'vencida_2'),
      (select token from test_resource_claims where nombre = 'vencida_2'),
      '52000000-0000-0000-0000-000000000002',
      'resp_learning_atomic_2',
      'completed',
      '{"resumen_generacion":"Viejo"}'::jsonb,
      '[{"tipo":"quiz","titulo":"No debe persistir","descripcion":"Viejo","contenido_json":{},"score":10,"source_refs":[],"metadata":{}}]'::jsonb,
      '{"score_total":10,"rubrica_json":{},"recomendaciones_json":[]}'::jsonb
    )
  ).id,
  null::uuid,
  'el trabajador con token vencido no puede finalizar'
);
select is(
  (
    select count(*)::integer
    from public.learning_objects
    where generation_job_id = '52000000-0000-0000-0000-000000000002'
  ),
  0,
  'el trabajador viejo no deja objetos parciales'
);
select is(
  (
    public.finalizar_recursos_aprendizaje_ia(
      (select trabajo_id from test_resource_claims where nombre = 'vigente_2'),
      (select token from test_resource_claims where nombre = 'vigente_2'),
      '52000000-0000-0000-0000-000000000002',
      'resp_learning_atomic_2',
      'completed',
      '{"resumen_generacion":"Resultado dos"}'::jsonb,
      '[{"tipo":"quiz","titulo":"Quiz vigente","descripcion":"Nuevo","contenido_json":{"preguntas":[]},"score":88,"source_refs":[],"metadata":{}}]'::jsonb,
      '{"score_total":88,"rubrica_json":{"claridad":88},"recomendaciones_json":[]}'::jsonb
    )
  ).estado::text,
  'completado',
  'el trabajador con el token nuevo sí finaliza'
);
select is(
  (
    select count(*)::integer
    from public.learning_objects
    where generation_job_id = '52000000-0000-0000-0000-000000000002'
  ),
  1,
  'el resultado del trabajador vigente queda persistido'
);

insert into public.learning_generation_jobs (
  id,
  asignatura_id,
  scope,
  estado,
  requested_types,
  openai_response_id
) values (
  '53000000-0000-0000-0000-000000000003',
  '22222222-2222-4222-8222-000000000001',
  'asignatura',
  'needs_review',
  array['actividad']::public.learning_object_tipo[],
  'resp_learning_atomic_rollback'
);
select public.registrar_trabajo_generacion_ia(
  'recursos_aprendizaje',
  '53000000-0000-0000-0000-000000000003',
  'resp_learning_atomic_rollback',
  'completed'
);
insert into test_resource_claims (nombre, trabajo_id, token)
select 'rollback_3', (claim).id, (claim).token_reclamacion
from (
  select public.reclamar_trabajo_generacion_ia(
    'resp_learning_atomic_rollback', 'worker-recursos-rollback'
  ) as claim
) claimed;

reset role;
create function public.test_forzar_rollback_recursos_ia()
returns trigger
language plpgsql
as $$
begin
  if old.openai_response_id = 'resp_learning_atomic_rollback'
     and new.estado = 'completado' then
    raise exception using
      errcode = 'P0001',
      message = 'forced learning resources rollback';
  end if;
  return new;
end;
$$;
create trigger test_forzar_rollback_recursos_ia
before update on public.trabajos_generacion_ia
for each row execute function public.test_forzar_rollback_recursos_ia();

set local role service_role;
select throws_ok(
  $$ select public.finalizar_recursos_aprendizaje_ia(
       (select trabajo_id from test_resource_claims where nombre = 'rollback_3'),
       (select token from test_resource_claims where nombre = 'rollback_3'),
       '53000000-0000-0000-0000-000000000003',
       'resp_learning_atomic_rollback',
       'completed',
       '{"resumen_generacion":"Rollback"}'::jsonb,
       '[{"tipo":"actividad","titulo":"No persistir","descripcion":"Rollback","contenido_json":{},"score":70,"source_refs":[],"metadata":{}}]'::jsonb,
       '{"score_total":70,"rubrica_json":{},"recomendaciones_json":[]}'::jsonb
     ) $$,
  'P0001',
  'forced learning resources rollback',
  'un fallo al cerrar la bitácora revierte la RPC completa'
);
select is(
  (
    select count(*)::integer
    from public.learning_objects
    where generation_job_id = '53000000-0000-0000-0000-000000000003'
  ),
  0,
  'los objetos se revierten ante un fallo terminal'
);
select is(
  (
    select estado::text
    from public.learning_generation_jobs
    where id = '53000000-0000-0000-0000-000000000003'
  ),
  'needs_review',
  'el trabajo local conserva su estado tras el rollback'
);
select is(
  (
    select estado::text
    from public.trabajos_generacion_ia
    where openai_response_id = 'resp_learning_atomic_rollback'
  ),
  'reclamado',
  'el trabajo global conserva el lease tras el rollback'
);
select is(
  (
    select generation_job_id
    from public.learning_quality_scores
    where asignatura_id = '22222222-2222-4222-8222-000000000001'
      and unidad_id is null
      and tema_id is null
  ),
  '52000000-0000-0000-0000-000000000002'::uuid,
  'el score anterior también se restaura con el rollback'
);

insert into public.learning_generation_jobs (
  id,
  asignatura_id,
  scope,
  estado,
  requested_types,
  openai_response_id
) values (
  '54000000-0000-0000-0000-000000000004',
  '22222222-2222-4222-8222-000000000001',
  'asignatura',
  'needs_review',
  array['apunte']::public.learning_object_tipo[],
  'resp_learning_atomic_stale'
);
select public.registrar_trabajo_generacion_ia(
  'recursos_aprendizaje',
  '54000000-0000-0000-0000-000000000004',
  'resp_learning_atomic_stale',
  'completed'
);
insert into test_resource_claims (nombre, trabajo_id, token)
select 'obsoleta_4', (claim).id, (claim).token_reclamacion
from (
  select public.reclamar_trabajo_generacion_ia(
    'resp_learning_atomic_stale', 'worker-recursos-obsoleto'
  ) as claim
) claimed;
update public.learning_generation_jobs
set openai_response_id = 'resp_learning_atomic_nueva'
where id = '54000000-0000-0000-0000-000000000004';

select throws_ok(
  $$ select public.persistir_resultado_recursos_aprendizaje_ia(
       '54000000-0000-0000-0000-000000000004',
       'resp_learning_atomic_nueva',
       '{"resumen_generacion":"No omitir lease"}'::jsonb,
       '[{"tipo":"apunte","titulo":"No persistir","descripcion":"Sin lease","contenido_json":{},"score":75,"source_refs":[],"metadata":{}}]'::jsonb,
       '{"score_total":75,"rubrica_json":{},"recomendaciones_json":[]}'::jsonb
     ) $$,
  '55000',
  'La generacion asincrona requiere una reclamacion vigente',
  'la RPC síncrona no evade un trabajo global activo con otra respuesta'
);
select is(
  (
    public.finalizar_recursos_aprendizaje_ia(
      (select trabajo_id from test_resource_claims where nombre = 'obsoleta_4'),
      (select token from test_resource_claims where nombre = 'obsoleta_4'),
      '54000000-0000-0000-0000-000000000004',
      'resp_learning_atomic_stale',
      'completed',
      '{"resumen_generacion":"Obsoleto"}'::jsonb,
      '[{"tipo":"apunte","titulo":"No persistir","descripcion":"Obsoleto","contenido_json":{},"score":75,"source_refs":[],"metadata":{}}]'::jsonb,
      '{"score_total":75,"rubrica_json":{},"recomendaciones_json":[]}'::jsonb
    )
  ).id,
  null::uuid,
  'una respuesta obsoleta no se anuncia como aplicada'
);
select is(
  (
    select estado::text
    from public.trabajos_generacion_ia
    where openai_response_id = 'resp_learning_atomic_stale'
  ),
  'obsoleto',
  'la respuesta obsoleta sí cierra su trabajo global'
);
select is(
  (
    select count(*)::integer
    from public.learning_objects
    where generation_job_id = '54000000-0000-0000-0000-000000000004'
  ),
  0,
  'la respuesta obsoleta no deja objetos'
);
select is(
  (
    select estado::text
    from public.learning_generation_jobs
    where id = '54000000-0000-0000-0000-000000000004'
  ),
  'needs_review',
  'la respuesta obsoleta no altera el estado local'
);

insert into public.learning_generation_jobs (
  id,
  asignatura_id,
  scope,
  estado,
  requested_types,
  openai_response_id
) values (
  '55000000-0000-0000-0000-000000000005',
  '22222222-2222-4222-8222-000000000001',
  'asignatura',
  'needs_review',
  array['apunte']::public.learning_object_tipo[],
  'resp_learning_sync_success'
);
select is(
  (
    public.persistir_resultado_recursos_aprendizaje_ia(
      '55000000-0000-0000-0000-000000000005',
      'resp_learning_sync_success',
      '{"resumen_generacion":"Resultado síncrono"}'::jsonb,
      '[{"tipo":"apunte","titulo":"Apunte síncrono","descripcion":"Persistido por RPC","contenido_json":{"markdown":"# Síncrono"},"score":93,"source_refs":[],"metadata":{}}]'::jsonb,
      '{"score_total":93,"rubrica_json":{"claridad":93},"recomendaciones_json":[]}'::jsonb
    )
  ).estado::text,
  'completed',
  'la RPC síncrona completa el job local'
);
select is(
  (
    select count(*)::integer
    from public.learning_objects
    where generation_job_id = '55000000-0000-0000-0000-000000000005'
  ),
  1,
  'la RPC síncrona persiste sus objetos'
);
select is(
  (
    select generation_job_id
    from public.learning_quality_scores
    where asignatura_id = '22222222-2222-4222-8222-000000000001'
      and unidad_id is null
      and tema_id is null
  ),
  '55000000-0000-0000-0000-000000000005'::uuid,
  'la RPC síncrona reemplaza el score en la misma operación'
);
select is(
  (
    select resultado_json ->> 'resumen_generacion'
    from public.learning_generation_jobs
    where id = '55000000-0000-0000-0000-000000000005'
  ),
  'Resultado síncrono',
  'la RPC síncrona persiste el resultado del job'
);

insert into public.learning_generation_jobs (
  id,
  asignatura_id,
  scope,
  estado,
  requested_types,
  openai_response_id
) values (
  '56000000-0000-0000-0000-000000000006',
  '22222222-2222-4222-8222-000000000001',
  'asignatura',
  'needs_review',
  array['actividad']::public.learning_object_tipo[],
  'resp_learning_sync_rollback'
);

reset role;
create function public.test_forzar_rollback_recursos_local_ia()
returns trigger
language plpgsql
as $$
begin
  if old.openai_response_id = 'resp_learning_sync_rollback'
     and new.estado = 'completed' then
    raise exception using
      errcode = 'P0001',
      message = 'forced synchronous learning resources rollback';
  end if;
  return new;
end;
$$;
create trigger test_forzar_rollback_recursos_local_ia
before update on public.learning_generation_jobs
for each row execute function public.test_forzar_rollback_recursos_local_ia();

set local role service_role;
select throws_ok(
  $$ select public.persistir_resultado_recursos_aprendizaje_ia(
       '56000000-0000-0000-0000-000000000006',
       'resp_learning_sync_rollback',
       '{"resumen_generacion":"Rollback síncrono"}'::jsonb,
       '[{"tipo":"actividad","titulo":"No persistir","descripcion":"Rollback","contenido_json":{},"score":72,"source_refs":[],"metadata":{}}]'::jsonb,
       '{"score_total":72,"rubrica_json":{},"recomendaciones_json":[]}'::jsonb
     ) $$,
  'P0001',
  'forced synchronous learning resources rollback',
  'un fallo al cerrar el job local revierte la RPC síncrona completa'
);
select is(
  (
    select count(*)::integer
    from public.learning_objects
    where generation_job_id = '56000000-0000-0000-0000-000000000006'
  ),
  0,
  'el rollback síncrono revierte los objetos'
);
select is(
  (
    select estado::text
    from public.learning_generation_jobs
    where id = '56000000-0000-0000-0000-000000000006'
  ),
  'needs_review',
  'el rollback síncrono restaura el job local'
);
select is(
  (
    select generation_job_id
    from public.learning_quality_scores
    where asignatura_id = '22222222-2222-4222-8222-000000000001'
      and unidad_id is null
      and tema_id is null
  ),
  '55000000-0000-0000-0000-000000000005'::uuid,
  'el rollback síncrono también restaura el score anterior'
);

select * from finish();
rollback;
