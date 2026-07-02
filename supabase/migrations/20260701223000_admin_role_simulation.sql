-- Admin role simulation:
-- - The auth hook can mint simulated role/permisos/alcances claims for real admins.
-- - Authz helpers avoid falling back to the admin's real DB assignments while
--   simulation is active, so RLS and RPC checks behave like the simulated role.

set client_min_messages = warning;

create schema if not exists private;

grant usage on schema private to authenticated, service_role;

create or replace function public.authz_simulacion_activa()
returns boolean
language sql
stable
security invoker
set search_path to public, private, auth, extensions, pg_temp
as $$
  select lower(coalesce(auth.jwt() #>> '{app_metadata,authz_simulacion,activa}', 'false')) = 'true';
$$;

create or replace function private.authz_claim_has_role(p_rol text)
returns boolean
language sql
stable
security invoker
set search_path to public, private, auth, extensions, pg_temp
as $$
  select coalesce((auth.jwt() -> 'app_metadata' -> 'roles_claves') ? p_rol, false);
$$;

create or replace function private.authz_claim_has_permission(p_permiso text)
returns boolean
language sql
stable
security invoker
set search_path to public, private, auth, extensions, pg_temp
as $$
  select coalesce((auth.jwt() -> 'app_metadata' -> 'permisos') ? p_permiso, false);
$$;

create or replace function private.authz_claim_has_global_scope()
returns boolean
language sql
stable
security invoker
set search_path to public, private, auth, extensions, pg_temp
as $$
  select private.authz_claim_has_role('ADMIN')
    or exists (
      select 1
      from jsonb_array_elements_text(
        coalesce(auth.jwt() #> '{app_metadata,alcances,global}', '[]'::jsonb)
      ) as alcance(value)
      where nullif(alcance.value, '') is not null
    )
    or exists (
      select 1
      from jsonb_array_elements(
        coalesce(auth.jwt() #> '{app_metadata,roles}', '[]'::jsonb)
      ) as rol(value)
      where rol.value ->> 'facultad_id' is null
        and rol.value ->> 'carrera_id' is null
        and rol.value ->> 'alcance_default' = 'global'
    );
$$;

create or replace function private.authz_claim_can_access_plan(p_plan_id uuid)
returns boolean
language sql
stable
security invoker
set search_path to public, private, auth, extensions, pg_temp
as $$
  select exists (
    select 1
    from public.planes_estudio pe
    join public.carreras c on c.id = pe.carrera_id
    where pe.id = p_plan_id
      and (
        private.authz_claim_has_global_scope()
        or nullif(auth.jwt() #>> '{app_metadata,authz_simulacion,plan_estudio_id}', '')::uuid = pe.id
        or exists (
          select 1
          from jsonb_array_elements_text(
            coalesce(auth.jwt() #> '{app_metadata,alcances,carreras}', '[]'::jsonb)
          ) as alcance(value)
          where alcance.value = pe.carrera_id::text
        )
        or exists (
          select 1
          from jsonb_array_elements_text(
            coalesce(auth.jwt() #> '{app_metadata,alcances,facultades}', '[]'::jsonb)
          ) as alcance(value)
          where alcance.value = c.facultad_id::text
        )
        or exists (
          select 1
          from public.asignaturas a
          where a.id = nullif(auth.jwt() #>> '{app_metadata,authz_simulacion,asignatura_id}', '')::uuid
            and a.plan_estudio_id = pe.id
        )
      )
  );
$$;

create or replace function private.authz_is_simulated_self(p_usuario_id uuid)
returns boolean
language sql
stable
security invoker
set search_path to public, private, auth, extensions, pg_temp
as $$
  select public.authz_simulacion_activa()
    and p_usuario_id is not null
    and p_usuario_id = auth.uid();
$$;

create or replace function public.authz_has_global_scope()
returns boolean
language sql
stable
security invoker
set search_path to public, private, auth, extensions, pg_temp
as $$
  select case
    when public.authz_simulacion_activa()
      then private.authz_claim_has_global_scope()
    else private.authz_user_has_global_scope(auth.uid())
      or private.authz_claim_has_global_scope()
  end;
$$;

create or replace function public.authz_has_role(p_rol text)
returns boolean
language sql
stable
security invoker
set search_path to public, private, auth, extensions, pg_temp
as $$
  select case
    when public.authz_simulacion_activa()
      then private.authz_claim_has_role(p_rol)
    else private.authz_claim_has_role(p_rol)
      or private.authz_user_has_role(auth.uid(), p_rol)
  end;
$$;

create or replace function public.authz_is_admin()
returns boolean
language sql
stable
security invoker
set search_path to public, private, auth, extensions, pg_temp
as $$
  select public.authz_has_role('ADMIN');
$$;

create or replace function public.authz_has_permission(p_permiso text)
returns boolean
language sql
stable
security invoker
set search_path to public, private, auth, extensions, pg_temp
as $$
  select case
    when public.authz_simulacion_activa()
      then private.authz_claim_has_role('ADMIN')
        or private.authz_claim_has_permission(p_permiso)
    else public.authz_is_admin()
      or private.authz_claim_has_permission(p_permiso)
      or private.authz_user_has_permission(auth.uid(), p_permiso)
  end;
$$;

create or replace function public.usuario_tiene_permiso(p_usuario_id uuid, p_permiso text)
returns boolean
language sql
stable
security invoker
set search_path to public, private, auth, extensions, pg_temp
as $$
  select case
    when private.authz_is_simulated_self(p_usuario_id)
      then public.authz_has_permission(p_permiso)
    else private.authz_user_has_permission(p_usuario_id, p_permiso)
  end;
$$;

create or replace function private.authz_is_responsable_asignatura(p_asignatura_id uuid)
returns boolean
language sql
stable
security definer
set search_path to public, private, auth, extensions, pg_temp
as $$
  select (
      public.authz_simulacion_activa()
      and private.authz_claim_has_role('PROFESOR')
      and p_asignatura_id = nullif(auth.jwt() #>> '{app_metadata,authz_simulacion,asignatura_id}', '')::uuid
    )
    or exists (
      select 1
      from public.responsables_asignatura ra
      where ra.asignatura_id = p_asignatura_id
        and ra.usuario_id = auth.uid()
    );
$$;

create or replace function private.authz_is_responsable_de_plan(p_plan_id uuid)
returns boolean
language sql
stable
security definer
set search_path to public, private, auth, extensions, pg_temp
as $$
  select exists (
      select 1
      from public.asignaturas a
      where public.authz_simulacion_activa()
        and private.authz_claim_has_role('PROFESOR')
        and a.id = nullif(auth.jwt() #>> '{app_metadata,authz_simulacion,asignatura_id}', '')::uuid
        and a.plan_estudio_id = p_plan_id
    )
    or exists (
      select 1
      from public.responsables_asignatura ra
      join public.asignaturas a on a.id = ra.asignatura_id
      where a.plan_estudio_id = p_plan_id
        and ra.usuario_id = auth.uid()
    );
$$;

create or replace function private.usuario_puede_acceder_plan(p_usuario_id uuid, p_plan_id uuid)
returns boolean
language sql
stable
security definer
set search_path to public, private, auth, extensions, pg_temp
as $$
  select p_usuario_id is not null
    and (
      (
        private.authz_is_simulated_self(p_usuario_id)
        and private.authz_claim_can_access_plan(p_plan_id)
      )
      or (
        not private.authz_is_simulated_self(p_usuario_id)
        and (
          exists (
            select 1
            from public.planes_estudio pe
            join public.carreras c on c.id = pe.carrera_id
            join public.usuarios_roles ur on ur.usuario_id = p_usuario_id
            join public.roles r on r.id = ur.rol_id
            join public.usuarios_app ua on ua.id = ur.usuario_id
            where pe.id = p_plan_id
              and ua.dado_de_baja_en is null
              and (
                r.clave = 'ADMIN'
                or (ur.facultad_id is null and ur.carrera_id is null and r.alcance_default = 'global')
                or ur.carrera_id = pe.carrera_id
                or ur.facultad_id = c.facultad_id
              )
          )
          or exists (
            select 1
            from public.plan_expertos px
            join public.expertos e on e.id = px.experto_id
            where px.plan_estudio_id = p_plan_id
              and e.usuario_id = p_usuario_id
          )
        )
      )
    );
$$;

create or replace function private.usuario_es_jefe_encargado_plan(p_usuario_id uuid, p_plan_id uuid)
returns boolean
language sql
stable
security definer
set search_path to public, private, auth, extensions, pg_temp
as $$
  select p_usuario_id is not null
    and (
      (
        private.authz_is_simulated_self(p_usuario_id)
        and private.authz_claim_has_role('JEFE_CARRERA')
        and private.authz_claim_can_access_plan(p_plan_id)
      )
      or (
        not private.authz_is_simulated_self(p_usuario_id)
        and exists (
          select 1
          from public.planes_estudio pe
          join public.usuarios_roles ur on ur.carrera_id = pe.carrera_id
          join public.roles r on r.id = ur.rol_id
          join public.usuarios_app ua on ua.id = ur.usuario_id
          where pe.id = p_plan_id
            and ur.usuario_id = p_usuario_id
            and ua.dado_de_baja_en is null
            and r.clave = 'JEFE_CARRERA'
        )
      )
    );
$$;

create or replace function private.usuario_es_externo_asignado_plan(p_usuario_id uuid, p_plan_id uuid)
returns boolean
language sql
stable
security definer
set search_path to public, private, auth, extensions, pg_temp
as $$
  select p_usuario_id is not null
    and (
      (
        private.authz_is_simulated_self(p_usuario_id)
        and private.authz_claim_has_role('EVALUADOR_EXTERNO')
        and private.authz_claim_can_access_plan(p_plan_id)
      )
      or (
        not private.authz_is_simulated_self(p_usuario_id)
        and public.usuario_tiene_rol_en_plan(p_usuario_id, p_plan_id, 'EVALUADOR_EXTERNO')
        and exists (
          select 1
          from public.plan_expertos px
          join public.expertos e on e.id = px.experto_id
          where px.plan_estudio_id = p_plan_id
            and e.usuario_id = p_usuario_id
        )
      )
    );
$$;

create or replace function private.usuario_tiene_rol_en_plan(
  p_usuario_id uuid,
  p_plan_id uuid,
  p_rol text
)
returns boolean
language sql
stable
security definer
set search_path to public, private, auth, extensions, pg_temp
as $$
  select p_usuario_id is not null
    and (
      (
        private.authz_is_simulated_self(p_usuario_id)
        and private.authz_claim_has_role(p_rol)
        and private.authz_claim_can_access_plan(p_plan_id)
      )
      or (
        not private.authz_is_simulated_self(p_usuario_id)
        and exists (
          select 1
          from public.planes_estudio pe
          join public.carreras c on c.id = pe.carrera_id
          join public.usuarios_roles ur on ur.usuario_id = p_usuario_id
          join public.roles r on r.id = ur.rol_id
          join public.usuarios_app ua on ua.id = ur.usuario_id
          where pe.id = p_plan_id
            and ua.dado_de_baja_en is null
            and r.clave = p_rol
            and (
              r.clave = 'ADMIN'
              or (ur.facultad_id is null and ur.carrera_id is null and r.alcance_default = 'global')
              or ur.carrera_id = pe.carrera_id
              or ur.facultad_id = c.facultad_id
            )
        )
      )
    );
$$;

create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
set search_path to public, auth, extensions, pg_temp
as $$
declare
  original_claims jsonb;
  new_claims jsonb;
  app_meta jsonb;
  claim text;
  user_id uuid;
  roles_json jsonb := '[]'::jsonb;
  roles_claves_json jsonb := '[]'::jsonb;
  permisos_json jsonb := '[]'::jsonb;
  alcances_json jsonb := '{"global": [], "facultades": [], "carreras": []}'::jsonb;
  is_bootstrap boolean := false;
  is_real_admin boolean := false;
  simulation jsonb;
  simulation_active boolean := false;
  simulation_role record;
  simulation_role_found boolean := false;
  sim_role_id uuid;
  sim_facultad_id uuid;
  sim_carrera_id uuid;
  sim_plan_id uuid;
  sim_asignatura_id uuid;
begin
  original_claims := event->'claims';
  new_claims := '{}'::jsonb;
  app_meta := coalesce(original_claims->'app_metadata', '{}'::jsonb);

  select not exists (select 1 from public.usuarios_roles)
  into is_bootstrap;

  if original_claims ? 'sub' then
    user_id := (original_claims->>'sub')::uuid;

    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', ur.id,
          'rol_id', r.id,
          'clave', r.clave,
          'nombre', r.nombre,
          'nivel_jerarquico', r.nivel_jerarquico,
          'alcance_default', r.alcance_default,
          'facultad_id', ur.facultad_id,
          'carrera_id', ur.carrera_id
        )
        order by r.nivel_jerarquico, r.clave
      ),
      '[]'::jsonb
    )
    into roles_json
    from public.usuarios_roles ur
    join public.roles r on r.id = ur.rol_id
    join public.usuarios_app ua on ua.id = ur.usuario_id
    where ur.usuario_id = user_id
      and ua.dado_de_baja_en is null;

    select coalesce(jsonb_agg(clave order by clave), '[]'::jsonb)
    into roles_claves_json
    from (
      select distinct r.clave
      from public.usuarios_roles ur
      join public.roles r on r.id = ur.rol_id
      join public.usuarios_app ua on ua.id = ur.usuario_id
      where ur.usuario_id = user_id
        and ua.dado_de_baja_en is null
    ) s;

    is_real_admin := roles_claves_json ? 'ADMIN';

    select coalesce(jsonb_agg(clave order by clave), '[]'::jsonb)
    into permisos_json
    from (
      select distinct p.clave
      from public.usuarios_roles ur
      join public.roles_permisos rp on rp.rol_id = ur.rol_id
      join public.permisos p on p.id = rp.permiso_id
      join public.usuarios_app ua on ua.id = ur.usuario_id
      where ur.usuario_id = user_id
        and ua.dado_de_baja_en is null
    ) s;

    select jsonb_build_object(
      'global', coalesce(jsonb_agg(distinct r.clave) filter (where ur.facultad_id is null and ur.carrera_id is null), '[]'::jsonb),
      'facultades', coalesce(jsonb_agg(distinct ur.facultad_id) filter (where ur.facultad_id is not null), '[]'::jsonb),
      'carreras', coalesce(jsonb_agg(distinct ur.carrera_id) filter (where ur.carrera_id is not null), '[]'::jsonb)
    )
    into alcances_json
    from public.usuarios_roles ur
    join public.roles r on r.id = ur.rol_id
    join public.usuarios_app ua on ua.id = ur.usuario_id
    where ur.usuario_id = user_id
      and ua.dado_de_baja_en is null;

    simulation := coalesce(app_meta->'authz_simulacion', '{}'::jsonb);
    simulation_active := lower(coalesce(simulation->>'activa', 'false')) = 'true';

    if simulation_active and is_real_admin then
      sim_role_id := nullif(simulation->>'rol_id', '')::uuid;

      select r.id, r.clave, r.nombre, r.descripcion, r.nivel_jerarquico, r.alcance_default
      into simulation_role
      from public.roles r
      where (sim_role_id is not null and r.id = sim_role_id)
         or (sim_role_id is null and r.clave = nullif(simulation->>'rol_clave', ''))
      order by r.nivel_jerarquico, r.clave
      limit 1;

      simulation_role_found := found;

      if simulation_role_found then
        sim_facultad_id := nullif(simulation->>'facultad_id', '')::uuid;
        sim_carrera_id := nullif(simulation->>'carrera_id', '')::uuid;
        sim_plan_id := nullif(simulation->>'plan_estudio_id', '')::uuid;
        sim_asignatura_id := nullif(simulation->>'asignatura_id', '')::uuid;

        if sim_asignatura_id is not null then
          select
            coalesce(sim_plan_id, a.plan_estudio_id),
            coalesce(sim_carrera_id, pe.carrera_id),
            coalesce(sim_facultad_id, c.facultad_id)
          into sim_plan_id, sim_carrera_id, sim_facultad_id
          from public.asignaturas a
          join public.planes_estudio pe on pe.id = a.plan_estudio_id
          join public.carreras c on c.id = pe.carrera_id
          where a.id = sim_asignatura_id;
        elsif sim_plan_id is not null then
          select
            coalesce(sim_carrera_id, pe.carrera_id),
            coalesce(sim_facultad_id, c.facultad_id)
          into sim_carrera_id, sim_facultad_id
          from public.planes_estudio pe
          join public.carreras c on c.id = pe.carrera_id
          where pe.id = sim_plan_id;
        elsif sim_carrera_id is not null then
          select coalesce(sim_facultad_id, c.facultad_id)
          into sim_facultad_id
          from public.carreras c
          where c.id = sim_carrera_id;
        end if;

        roles_json := jsonb_build_array(
          jsonb_strip_nulls(jsonb_build_object(
            'id', 'simulacion',
            'rol_id', simulation_role.id,
            'clave', simulation_role.clave,
            'nombre', simulation_role.nombre,
            'nivel_jerarquico', simulation_role.nivel_jerarquico,
            'alcance_default', simulation_role.alcance_default,
            'facultad_id', case when simulation_role.alcance_default = 'facultad' then sim_facultad_id else null end,
            'carrera_id', case when simulation_role.alcance_default = 'carrera' then sim_carrera_id else null end,
            'simulada', true
          ))
        );

        roles_claves_json := jsonb_build_array(simulation_role.clave);

        select coalesce(jsonb_agg(clave order by clave), '[]'::jsonb)
        into permisos_json
        from (
          select distinct p.clave
          from public.roles_permisos rp
          join public.permisos p on p.id = rp.permiso_id
          where rp.rol_id = simulation_role.id
        ) s;

        alcances_json := jsonb_build_object(
          'global',
            case when simulation_role.alcance_default = 'global'
              then jsonb_build_array(simulation_role.clave)
              else '[]'::jsonb
            end,
          'facultades',
            case when simulation_role.alcance_default = 'facultad' and sim_facultad_id is not null
              then jsonb_build_array(sim_facultad_id)
              else '[]'::jsonb
            end,
          'carreras',
            case when simulation_role.alcance_default = 'carrera' and sim_carrera_id is not null
              then jsonb_build_array(sim_carrera_id)
              else '[]'::jsonb
            end
        );

        simulation := jsonb_strip_nulls(simulation || jsonb_build_object(
          'activa', true,
          'rol_id', simulation_role.id,
          'rol_clave', simulation_role.clave,
          'rol_nombre', simulation_role.nombre,
          'alcance_default', simulation_role.alcance_default,
          'facultad_id', sim_facultad_id,
          'carrera_id', sim_carrera_id,
          'plan_estudio_id', sim_plan_id,
          'asignatura_id', sim_asignatura_id,
          'admin_real', true
        ));
        app_meta := app_meta || jsonb_build_object('authz_simulacion', simulation);
      else
        app_meta := app_meta - 'authz_simulacion';
      end if;
    elsif simulation_active then
      app_meta := app_meta - 'authz_simulacion';
    end if;
  end if;

  app_meta := app_meta || jsonb_build_object(
    'roles', roles_json,
    'roles_claves', roles_claves_json,
    'permisos', permisos_json,
    'alcances', coalesce(alcances_json, '{"global": [], "facultades": [], "carreras": []}'::jsonb),
    'authz_bootstrap', is_bootstrap
  );

  foreach claim in array array[
    'iss',
    'aud',
    'exp',
    'iat',
    'sub',
    'role',
    'aal',
    'session_id',
    'email',
    'phone',
    'is_anonymous'
  ] loop
    if original_claims ? claim then
      new_claims := jsonb_set(new_claims, array[claim], original_claims->claim);
    end if;
  end loop;

  new_claims := jsonb_set(new_claims, array['app_metadata'], app_meta);

  return jsonb_build_object('claims', new_claims);
end
$$;

revoke all on function public.authz_simulacion_activa() from public, anon;
grant execute on function public.authz_simulacion_activa() to authenticated, service_role;

revoke all on function private.authz_claim_has_role(text) from public, anon;
revoke all on function private.authz_claim_has_permission(text) from public, anon;
revoke all on function private.authz_claim_has_global_scope() from public, anon;
revoke all on function private.authz_claim_can_access_plan(uuid) from public, anon;
revoke all on function private.authz_is_simulated_self(uuid) from public, anon;
grant execute on function private.authz_claim_has_role(text) to authenticated, service_role;
grant execute on function private.authz_claim_has_permission(text) to authenticated, service_role;
grant execute on function private.authz_claim_has_global_scope() to authenticated, service_role;
grant execute on function private.authz_claim_can_access_plan(uuid) to authenticated, service_role;
grant execute on function private.authz_is_simulated_self(uuid) to authenticated, service_role;

revoke all on function public.authz_has_global_scope() from public, anon;
revoke all on function public.authz_has_role(text) from public, anon;
revoke all on function public.authz_is_admin() from public, anon;
revoke all on function public.authz_has_permission(text) from public, anon;
revoke all on function public.usuario_tiene_permiso(uuid, text) from public, anon;
grant execute on function public.authz_has_global_scope() to authenticated, service_role;
grant execute on function public.authz_has_role(text) to authenticated, service_role;
grant execute on function public.authz_is_admin() to authenticated, service_role;
grant execute on function public.authz_has_permission(text) to authenticated, service_role;
grant execute on function public.usuario_tiene_permiso(uuid, text) to authenticated, service_role;

revoke all on function private.authz_is_responsable_asignatura(uuid) from public, anon;
revoke all on function private.authz_is_responsable_de_plan(uuid) from public, anon;
revoke all on function private.usuario_puede_acceder_plan(uuid, uuid) from public, anon;
revoke all on function private.usuario_es_jefe_encargado_plan(uuid, uuid) from public, anon;
revoke all on function private.usuario_es_externo_asignado_plan(uuid, uuid) from public, anon;
revoke all on function private.usuario_tiene_rol_en_plan(uuid, uuid, text) from public, anon;
grant execute on function private.authz_is_responsable_asignatura(uuid) to authenticated, service_role;
grant execute on function private.authz_is_responsable_de_plan(uuid) to authenticated, service_role;
grant execute on function private.usuario_puede_acceder_plan(uuid, uuid) to authenticated, service_role;
grant execute on function private.usuario_es_jefe_encargado_plan(uuid, uuid) to authenticated, service_role;
grant execute on function private.usuario_es_externo_asignado_plan(uuid, uuid) to authenticated, service_role;
grant execute on function private.usuario_tiene_rol_en_plan(uuid, uuid, text) to authenticated, service_role;

revoke all on function public.custom_access_token_hook(jsonb) from public, anon, authenticated;
grant execute on function public.custom_access_token_hook(jsonb) to service_role, supabase_auth_admin;
