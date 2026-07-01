-- Security Advisor hardening:
-- - make template views respect caller permissions/RLS
-- - remove unused GraphQL API introspection surface
-- - move SECURITY DEFINER helpers out of the exposed public API schema
-- - pin function search_path values
-- - keep extensions outside public
-- - remove broad public listing for the avatars bucket

create schema if not exists extensions;
create schema if not exists private;

grant usage on schema extensions to anon, authenticated, service_role;
grant usage on schema private to authenticated, service_role;

alter view if exists public.plantilla_asignatura set (security_invoker = true);
alter view if exists public.plantilla_plan set (security_invoker = true);

drop extension if exists pg_graphql;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'unaccent') then
    alter extension unaccent set schema extensions;
  end if;
end;
$$;

create or replace function public.build_asignaturas_prefix_tsquery(p_search text)
returns tsquery
language plpgsql
stable
set search_path = public, extensions, pg_temp
as $$
declare
  cleaned text;
  tokens text[];
  query_text text;
begin
  cleaned := trim(coalesce(p_search, ''));

  if cleaned = '' then
    return null;
  end if;

  cleaned := lower(extensions.unaccent(cleaned));
  cleaned := regexp_replace(cleaned, '[^[:alnum:]\s]+', ' ', 'g');
  cleaned := regexp_replace(cleaned, '\s+', ' ', 'g');

  tokens := regexp_split_to_array(cleaned, '\s+');

  select string_agg(token || ':*', ' & ')
  into query_text
  from unnest(tokens) as token
  where token <> '';

  if query_text is null or query_text = '' then
    return null;
  end if;

  return to_tsquery('public.es_simple_unaccent', query_text);
end;
$$;

create or replace function public.unaccent_immutable(text)
returns text
language sql
immutable
parallel safe
strict
set search_path = extensions, pg_temp
as $$
  select extensions.unaccent('extensions.unaccent', $1);
$$;

do $$
declare
  target record;
  fn_signature text;
begin
  for target in
    select *
    from (
      values
        ('actualizar_estructura_asignatura_definicion', 'p_id uuid, p_definicion jsonb, p_operaciones jsonb'),
        ('actualizar_estructura_plan_definicion', 'p_id uuid, p_definicion jsonb, p_operaciones jsonb'),
        ('authz_is_responsable_asignatura', 'p_asignatura_id uuid'),
        ('authz_is_responsable_de_plan', 'p_plan_id uuid'),
        ('nombrar_responsable', 'p_usuario uuid, p_rol uuid, p_facultad uuid, p_carrera uuid, p_actor uuid'),
        ('plan_estado_clave', 'p_plan_id uuid'),
        ('reasignar_responsabilidades', 'p_origen uuid, p_destino uuid, p_actor uuid'),
        ('transiciones_permitidas_plan', 'p_plan_id uuid'),
        ('usuario_es_externo_asignado_plan', 'p_usuario_id uuid, p_plan_id uuid'),
        ('usuario_es_jefe_encargado_plan', 'p_usuario_id uuid, p_plan_id uuid'),
        ('usuario_puede_acceder_plan', 'p_usuario_id uuid, p_plan_id uuid'),
        ('usuario_puede_comentar_asignatura', 'p_usuario_id uuid, p_asignatura_id uuid'),
        ('usuario_puede_comentar_plan', 'p_usuario_id uuid, p_plan_id uuid'),
        ('usuario_puede_editar_asignatura', 'p_usuario_id uuid, p_asignatura_id uuid'),
        ('usuario_puede_editar_campo_asignatura', 'p_usuario_id uuid, p_asignatura_id uuid, p_clave text'),
        ('usuario_puede_editar_campo_plan', 'p_usuario_id uuid, p_plan_id uuid, p_clave text'),
        ('usuario_puede_editar_plan', 'p_usuario_id uuid, p_plan_id uuid'),
        ('usuario_puede_transicionar_asignatura', 'p_usuario_id uuid, p_asignatura_id uuid, p_nuevo_estado public.estado_asignatura'),
        ('usuario_puede_transicionar_plan', 'p_usuario_id uuid, p_plan_id uuid, p_hacia_estado_id uuid'),
        ('usuario_puede_usar_ia_asignatura', 'p_usuario_id uuid, p_asignatura_id uuid'),
        ('usuario_tiene_rol_contextual_plan', 'p_usuario_id uuid, p_plan_id uuid, p_rol text'),
        ('usuario_tiene_rol_en_plan', 'p_usuario_id uuid, p_plan_id uuid, p_rol text')
    ) as v(name, args)
  loop
    select format('%I.%I(%s)', n.nspname, p.proname, pg_get_function_identity_arguments(p.oid))
    into fn_signature
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = target.name
      and replace(pg_get_function_identity_arguments(p.oid), 'public.', '') = replace(target.args, 'public.', '');

    if fn_signature is not null then
      execute format('alter function %s set schema private', fn_signature);
    end if;
  end loop;
end;
$$;

-- Public wrappers keep existing RLS policy/function calls stable while
-- the privileged implementations live outside PostgREST's exposed schema.
create or replace function public.authz_is_responsable_asignatura(p_asignatura_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = public, private, auth, extensions, pg_temp
as $$ select private.authz_is_responsable_asignatura(p_asignatura_id); $$;

create or replace function public.authz_is_responsable_de_plan(p_plan_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = public, private, auth, extensions, pg_temp
as $$ select private.authz_is_responsable_de_plan(p_plan_id); $$;

create or replace function public.plan_estado_clave(p_plan_id uuid)
returns text
language sql
stable
security invoker
set search_path = public, private, auth, extensions, pg_temp
as $$ select private.plan_estado_clave(p_plan_id); $$;

create or replace function public.transiciones_permitidas_plan(p_plan_id uuid)
returns setof public.estados_plan
language sql
stable
security invoker
set search_path = public, private, auth, extensions, pg_temp
as $$ select * from private.transiciones_permitidas_plan(p_plan_id); $$;

create or replace function public.usuario_es_externo_asignado_plan(p_usuario_id uuid, p_plan_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = public, private, auth, extensions, pg_temp
as $$ select private.usuario_es_externo_asignado_plan(p_usuario_id, p_plan_id); $$;

create or replace function public.usuario_es_jefe_encargado_plan(p_usuario_id uuid, p_plan_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = public, private, auth, extensions, pg_temp
as $$ select private.usuario_es_jefe_encargado_plan(p_usuario_id, p_plan_id); $$;

create or replace function public.usuario_puede_acceder_plan(p_usuario_id uuid, p_plan_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = public, private, auth, extensions, pg_temp
as $$ select private.usuario_puede_acceder_plan(p_usuario_id, p_plan_id); $$;

create or replace function public.usuario_puede_comentar_asignatura(p_usuario_id uuid, p_asignatura_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = public, private, auth, extensions, pg_temp
as $$ select private.usuario_puede_comentar_asignatura(p_usuario_id, p_asignatura_id); $$;

create or replace function public.usuario_puede_comentar_plan(p_usuario_id uuid, p_plan_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = public, private, auth, extensions, pg_temp
as $$ select private.usuario_puede_comentar_plan(p_usuario_id, p_plan_id); $$;

create or replace function public.usuario_puede_editar_asignatura(p_usuario_id uuid, p_asignatura_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = public, private, auth, extensions, pg_temp
as $$ select private.usuario_puede_editar_asignatura(p_usuario_id, p_asignatura_id); $$;

create or replace function public.usuario_puede_editar_campo_asignatura(p_usuario_id uuid, p_asignatura_id uuid, p_clave text)
returns boolean
language sql
stable
security invoker
set search_path = public, private, auth, extensions, pg_temp
as $$ select private.usuario_puede_editar_campo_asignatura(p_usuario_id, p_asignatura_id, p_clave); $$;

create or replace function public.usuario_puede_editar_campo_plan(p_usuario_id uuid, p_plan_id uuid, p_clave text)
returns boolean
language sql
stable
security invoker
set search_path = public, private, auth, extensions, pg_temp
as $$ select private.usuario_puede_editar_campo_plan(p_usuario_id, p_plan_id, p_clave); $$;

create or replace function public.usuario_puede_editar_plan(p_usuario_id uuid, p_plan_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = public, private, auth, extensions, pg_temp
as $$ select private.usuario_puede_editar_plan(p_usuario_id, p_plan_id); $$;

create or replace function public.usuario_puede_transicionar_plan(p_usuario_id uuid, p_plan_id uuid, p_hacia_estado_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = public, private, auth, extensions, pg_temp
as $$ select private.usuario_puede_transicionar_plan(p_usuario_id, p_plan_id, p_hacia_estado_id); $$;

create or replace function public.usuario_puede_usar_ia_asignatura(p_usuario_id uuid, p_asignatura_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = public, private, auth, extensions, pg_temp
as $$ select private.usuario_puede_usar_ia_asignatura(p_usuario_id, p_asignatura_id); $$;

create or replace function public.usuario_puede_usar_ia_plan(p_usuario_id uuid, p_plan_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = public, private, auth, extensions, pg_temp
as $$
  select public.usuario_puede_editar_plan(p_usuario_id, p_plan_id)
    and public.usuario_tiene_permiso(p_usuario_id, 'ia.usar')
    and public.plan_estado_clave(p_plan_id) IN ('BORRADOR', 'REVISION');
$$;

create or replace function public.usuario_tiene_rol_contextual_plan(p_usuario_id uuid, p_plan_id uuid, p_rol text)
returns boolean
language sql
stable
security invoker
set search_path = public, private, auth, extensions, pg_temp
as $$ select private.usuario_tiene_rol_contextual_plan(p_usuario_id, p_plan_id, p_rol); $$;

create or replace function public.usuario_tiene_rol_en_plan(p_usuario_id uuid, p_plan_id uuid, p_rol text)
returns boolean
language sql
stable
security invoker
set search_path = public, private, auth, extensions, pg_temp
as $$ select private.usuario_tiene_rol_en_plan(p_usuario_id, p_plan_id, p_rol); $$;

do $$
begin
  if exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'private'
      and p.proname = 'usuario_puede_transicionar_asignatura'
      and replace(pg_get_function_identity_arguments(p.oid), 'public.', '') =
        'p_usuario_id uuid, p_asignatura_id uuid, p_nuevo_estado estado_asignatura'
  ) then
    execute $fn$
      create or replace function public.usuario_puede_transicionar_asignatura(
        p_usuario_id uuid,
        p_asignatura_id uuid,
        p_nuevo_estado public.estado_asignatura
      )
      returns boolean
      language sql
      stable
      security invoker
      set search_path = public, private, auth, extensions, pg_temp
      as $body$
        select private.usuario_puede_transicionar_asignatura(
          p_usuario_id,
          p_asignatura_id,
          p_nuevo_estado
        );
      $body$;
    $fn$;
  end if;
end;
$$;

do $$
declare
  target record;
  fn_signature text;
begin
  for target in
    select *
    from (
      values
        ('fn_asignar_jefe_al_crear_plan', ''),
        ('fn_borradores_campo_set_plan_id', ''),
        ('fn_grant_profesor_on_responsable', ''),
        ('fn_log_bibliografia_asignatura_cambios', ''),
        ('fn_log_cambios_planes_estudio', ''),
        ('fn_log_lineas_plan_cambios', ''),
        ('fn_notificar_cambio_estado_plan', ''),
        ('fn_notificar_comentario_asignatura', ''),
        ('fn_notificar_comentario_plan', ''),
        ('fn_track_cambios_asignatura', ''),
        ('fn_validar_asignatura_estructura_plan', ''),
        ('fn_validar_datos_asignatura', ''),
        ('fn_validar_datos_plan', '')
    ) as v(name, args)
  loop
    select format('%I.%I(%s)', n.nspname, p.proname, pg_get_function_identity_arguments(p.oid))
    into fn_signature
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = target.name
      and replace(pg_get_function_identity_arguments(p.oid), 'public.', '') = replace(target.args, 'public.', '');

    if fn_signature is not null then
      execute format('revoke all on function %s from public, anon, authenticated', fn_signature);
      execute format('grant execute on function %s to service_role', fn_signature);
    end if;
  end loop;
end;
$$;

do $$
declare
  target record;
  fn_signature text;
begin
  for target in
    select *
    from (
      values
        ('actualizar_estructura_asignatura_definicion', 'p_id uuid, p_definicion jsonb, p_operaciones jsonb'),
        ('actualizar_estructura_plan_definicion', 'p_id uuid, p_definicion jsonb, p_operaciones jsonb'),
        ('authz_is_responsable_asignatura', 'p_asignatura_id uuid'),
        ('authz_is_responsable_de_plan', 'p_plan_id uuid'),
        ('fn_asignar_jefe_al_crear_plan', ''),
        ('fn_borradores_campo_set_plan_id', ''),
        ('fn_grant_profesor_on_responsable', ''),
        ('fn_log_bibliografia_asignatura_cambios', ''),
        ('fn_log_cambios_planes_estudio', ''),
        ('fn_log_lineas_plan_cambios', ''),
        ('fn_notificar_cambio_estado_plan', ''),
        ('fn_notificar_comentario_asignatura', ''),
        ('fn_notificar_comentario_plan', ''),
        ('fn_track_cambios_asignatura', ''),
        ('fn_validar_asignatura_estructura_plan', ''),
        ('fn_validar_datos_asignatura', ''),
        ('fn_validar_datos_plan', ''),
        ('nombrar_responsable', 'p_usuario uuid, p_rol uuid, p_facultad uuid, p_carrera uuid, p_actor uuid'),
        ('plan_estado_clave', 'p_plan_id uuid'),
        ('reasignar_responsabilidades', 'p_origen uuid, p_destino uuid, p_actor uuid'),
        ('transiciones_permitidas_plan', 'p_plan_id uuid'),
        ('usuario_es_externo_asignado_plan', 'p_usuario_id uuid, p_plan_id uuid'),
        ('usuario_es_jefe_encargado_plan', 'p_usuario_id uuid, p_plan_id uuid'),
        ('usuario_puede_acceder_plan', 'p_usuario_id uuid, p_plan_id uuid'),
        ('usuario_puede_comentar_asignatura', 'p_usuario_id uuid, p_asignatura_id uuid'),
        ('usuario_puede_comentar_plan', 'p_usuario_id uuid, p_plan_id uuid'),
        ('usuario_puede_editar_asignatura', 'p_usuario_id uuid, p_asignatura_id uuid'),
        ('usuario_puede_editar_campo_asignatura', 'p_usuario_id uuid, p_asignatura_id uuid, p_clave text'),
        ('usuario_puede_editar_campo_plan', 'p_usuario_id uuid, p_plan_id uuid, p_clave text'),
        ('usuario_puede_editar_plan', 'p_usuario_id uuid, p_plan_id uuid'),
        ('usuario_puede_transicionar_asignatura', 'p_usuario_id uuid, p_asignatura_id uuid, p_nuevo_estado public.estado_asignatura'),
        ('usuario_puede_transicionar_plan', 'p_usuario_id uuid, p_plan_id uuid, p_hacia_estado_id uuid'),
        ('usuario_puede_usar_ia_asignatura', 'p_usuario_id uuid, p_asignatura_id uuid'),
        ('usuario_puede_usar_ia_plan', 'p_usuario_id uuid, p_plan_id uuid'),
        ('usuario_tiene_rol_contextual_plan', 'p_usuario_id uuid, p_plan_id uuid, p_rol text'),
        ('usuario_tiene_rol_en_plan', 'p_usuario_id uuid, p_plan_id uuid, p_rol text')
    ) as v(name, args)
  loop
    select format('%I.%I(%s)', n.nspname, p.proname, pg_get_function_identity_arguments(p.oid))
    into fn_signature
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'private'
      and p.proname = target.name
      and replace(pg_get_function_identity_arguments(p.oid), 'public.', '') = replace(target.args, 'public.', '');

    if fn_signature is not null then
      execute format('revoke all on function %s from public, anon, authenticated', fn_signature);
      execute format('grant execute on function %s to service_role', fn_signature);
    end if;
  end loop;
end;
$$;

do $$
declare
  target record;
  private_signature text;
  public_signature text;
begin
  for target in
    select *
    from (
      values
        ('authz_is_responsable_asignatura', 'p_asignatura_id uuid'),
        ('authz_is_responsable_de_plan', 'p_plan_id uuid'),
        ('plan_estado_clave', 'p_plan_id uuid'),
        ('transiciones_permitidas_plan', 'p_plan_id uuid'),
        ('usuario_es_externo_asignado_plan', 'p_usuario_id uuid, p_plan_id uuid'),
        ('usuario_es_jefe_encargado_plan', 'p_usuario_id uuid, p_plan_id uuid'),
        ('usuario_puede_acceder_plan', 'p_usuario_id uuid, p_plan_id uuid'),
        ('usuario_puede_comentar_asignatura', 'p_usuario_id uuid, p_asignatura_id uuid'),
        ('usuario_puede_comentar_plan', 'p_usuario_id uuid, p_plan_id uuid'),
        ('usuario_puede_editar_asignatura', 'p_usuario_id uuid, p_asignatura_id uuid'),
        ('usuario_puede_editar_campo_asignatura', 'p_usuario_id uuid, p_asignatura_id uuid, p_clave text'),
        ('usuario_puede_editar_campo_plan', 'p_usuario_id uuid, p_plan_id uuid, p_clave text'),
        ('usuario_puede_editar_plan', 'p_usuario_id uuid, p_plan_id uuid'),
        ('usuario_puede_transicionar_asignatura', 'p_usuario_id uuid, p_asignatura_id uuid, p_nuevo_estado public.estado_asignatura'),
        ('usuario_puede_transicionar_plan', 'p_usuario_id uuid, p_plan_id uuid, p_hacia_estado_id uuid'),
        ('usuario_puede_usar_ia_asignatura', 'p_usuario_id uuid, p_asignatura_id uuid'),
        ('usuario_puede_usar_ia_plan', 'p_usuario_id uuid, p_plan_id uuid'),
        ('usuario_tiene_rol_contextual_plan', 'p_usuario_id uuid, p_plan_id uuid, p_rol text'),
        ('usuario_tiene_rol_en_plan', 'p_usuario_id uuid, p_plan_id uuid, p_rol text')
    ) as v(name, args)
  loop
    select format('%I.%I(%s)', n.nspname, p.proname, pg_get_function_identity_arguments(p.oid))
    into private_signature
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'private'
      and p.proname = target.name
      and replace(pg_get_function_identity_arguments(p.oid), 'public.', '') = replace(target.args, 'public.', '');

    if private_signature is not null then
      execute format('grant execute on function %s to authenticated', private_signature);
    end if;

    select format('%I.%I(%s)', n.nspname, p.proname, pg_get_function_identity_arguments(p.oid))
    into public_signature
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = target.name
      and replace(pg_get_function_identity_arguments(p.oid), 'public.', '') = replace(target.args, 'public.', '');

    if public_signature is not null then
      execute format('revoke all on function %s from public, anon', public_signature);
      execute format('grant execute on function %s to authenticated, service_role', public_signature);
    end if;
  end loop;
end;
$$;

do $$
declare
  fn record;
begin
  for fn in
    select n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) as args
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public', 'private')
      and p.proname = any(array[
        'append_conversacion_asignatura',
        'append_conversacion_plan',
        'authz_admin_override_audit',
        'authz_admin_override_reason',
        'authz_asignatura_ia_allowed',
        'authz_asignatura_restricted_field_write_allowed',
        'authz_asignatura_write_allowed',
        'authz_campo_asignatura_write_allowed',
        'authz_campo_plan_write_allowed',
        'authz_can_access_asignatura',
        'authz_can_access_carrera',
        'authz_can_access_facultad',
        'authz_can_access_plan',
        'authz_has_bootstrap_access',
        'authz_has_global_scope',
        'authz_has_permission',
        'authz_has_role',
        'authz_is_admin',
        'authz_is_responsable_asignatura',
        'authz_is_responsable_de_plan',
        'authz_is_service_role',
        'authz_plan_ia_allowed',
        'authz_plan_restricted_field_write_allowed',
        'authz_plan_write_allowed',
        'borrar_asignaturas_fallidas',
        'borrar_planes_fallidos',
        'build_asignaturas_prefix_tsquery',
        'custom_access_token_hook',
        'datos_validos_con_definicion',
        'fn_ajustar_seriacion_por_cambio_ciclo',
        'fn_asignar_jefe_al_crear_plan',
        'fn_asignaturas_update_search_vector',
        'fn_borradores_campo_set_plan_id',
        'fn_fill_author_from_auth_uid',
        'fn_grant_profesor_on_responsable',
        'fn_log_bibliografia_asignatura_cambios',
        'fn_log_cambios_planes_estudio',
        'fn_log_lineas_plan_cambios',
        'fn_notificar_cambio_estado_plan',
        'fn_notificar_comentario_asignatura',
        'fn_notificar_comentario_plan',
        'fn_track_cambios_asignatura',
        'fn_validar_asignatura_estructura_plan',
        'fn_validar_datos_asignatura',
        'fn_validar_datos_plan',
        'json_schema_parcial_definicion',
        'nombrar_responsable',
        'normalizar_datos_por_definicion',
        'normalizar_valor_por_propiedad',
        'plan_estado_clave',
        'propiedad_restriccion_estados',
        'propiedad_restriccion_permiso',
        'propiedad_tiene_restriccion',
        'reasignar_responsabilidades',
        'recalcular_vectores_asignaturas',
        'search_asignaturas',
        'set_actualizado_en',
        'suma_porcentajes',
        'tipo_propiedad_json_schema',
        'transiciones_permitidas_plan',
        'unaccent_immutable',
        'unaccent',
        'usuario_es_externo_asignado_plan',
        'usuario_es_jefe_encargado_plan',
        'usuario_puede_acceder_plan',
        'usuario_puede_comentar_asignatura',
        'usuario_puede_comentar_plan',
        'usuario_puede_editar_asignatura',
        'usuario_puede_editar_campo_asignatura',
        'usuario_puede_editar_campo_plan',
        'usuario_puede_editar_plan',
        'usuario_puede_transicionar_asignatura',
        'usuario_puede_transicionar_plan',
        'usuario_puede_usar_ia_asignatura',
        'usuario_puede_usar_ia_plan',
        'usuario_tiene_permiso',
        'usuario_tiene_rol_contextual_plan',
        'usuario_tiene_rol_en_plan',
        'validar_numero_ciclo_asignatura',
        'validar_prerrequisito_asignatura',
        'valor_jsonb_vacio'
      ]::text[])
  loop
    execute format(
      'alter function %I.%I(%s) set search_path = public, private, auth, extensions, pg_temp',
      fn.nspname,
      fn.proname,
      fn.args
    );
  end loop;
end;
$$;

drop policy if exists avatars_public_read on storage.objects;
