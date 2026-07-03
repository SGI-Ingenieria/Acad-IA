set client_min_messages = warning;

create schema if not exists private;

grant usage on schema private to authenticated, service_role;

insert into public.roles (
  clave,
  nombre,
  descripcion,
  nivel_jerarquico,
  alcance_default
)
values (
  'JEFE_POSGRADO',
  'Jefe de Posgrado',
  'Gestiona planes, asignaturas y profesorado de posgrado dentro de una facultad',
  40,
  'facultad'
)
on conflict (clave) do update
set nombre = excluded.nombre,
    descripcion = excluded.descripcion,
    nivel_jerarquico = excluded.nivel_jerarquico,
    alcance_default = excluded.alcance_default;

insert into public.roles_permisos (rol_id, permiso_id)
select r.id, p.id
from public.roles r
join public.permisos p on p.clave = 'usuarios.gestionar'
where r.clave in (
  'VICERRECTOR_ACADEMICO',
  'DIRECTOR_FACULTAD',
  'SECRETARIO_ACADEMICO',
  'JEFE_CARRERA',
  'JEFE_POSGRADO'
)
on conflict do nothing;

insert into public.roles_permisos (rol_id, permiso_id)
select r.id, p.id
from public.roles r
join public.permisos p on p.clave = 'usuarios.roles.gestionar'
where r.clave in (
  'VICERRECTOR_ACADEMICO',
  'DIRECTOR_FACULTAD',
  'SECRETARIO_ACADEMICO'
)
on conflict do nothing;

insert into public.roles_permisos (rol_id, permiso_id)
select jefe_posgrado.id, rp.permiso_id
from public.roles jefe_posgrado
join public.roles jefe_carrera on jefe_carrera.clave = 'JEFE_CARRERA'
join public.roles_permisos rp on rp.rol_id = jefe_carrera.id
join public.permisos p on p.id = rp.permiso_id
where jefe_posgrado.clave = 'JEFE_POSGRADO'
  and p.clave <> 'usuarios.roles.gestionar'
on conflict do nothing;

create or replace function public.nivel_es_posgrado(p_nivel text)
returns boolean
language sql
immutable
set search_path to public, extensions, pg_temp
as $$
  select lower(public.unaccent_immutable(btrim(coalesce(p_nivel, '')))) in (
    'maestria',
    'doctorado',
    'especialidad'
  );
$$;

create or replace function private.usuario_tiene_rol_activo(
  p_usuario_id uuid,
  p_rol text
)
returns boolean
language sql
stable
security definer
set search_path to public, private, auth, extensions, pg_temp
as $$
  select p_usuario_id is not null
    and exists (
      select 1
      from public.usuarios_roles ur
      join public.roles r on r.id = ur.rol_id
      join public.usuarios_app ua on ua.id = ur.usuario_id
      where ur.usuario_id = p_usuario_id
        and ua.dado_de_baja_en is null
        and r.clave = p_rol
    );
$$;

create or replace function private.usuario_cubre_carrera_para_gestion(
  p_actor uuid,
  p_carrera_id uuid,
  p_incluir_secretaria boolean default false
)
returns boolean
language sql
stable
security definer
set search_path to public, private, auth, extensions, pg_temp
as $$
  select p_actor is not null
    and p_carrera_id is not null
    and exists (
      select 1
      from public.usuarios_app ua
      where ua.id = p_actor
        and ua.dado_de_baja_en is null
    )
    and exists (
      select 1
      from public.carreras c
      where c.id = p_carrera_id
        and (
          private.usuario_tiene_rol_activo(p_actor, 'ADMIN')
          or private.usuario_tiene_rol_activo(p_actor, 'VICERRECTOR_ACADEMICO')
          or exists (
            select 1
            from public.usuarios_roles ur
            join public.roles r on r.id = ur.rol_id
            where ur.usuario_id = p_actor
              and ur.facultad_id = c.facultad_id
              and r.clave = 'DIRECTOR_FACULTAD'
          )
          or (
            p_incluir_secretaria
            and exists (
              select 1
              from public.usuarios_roles ur
              join public.roles r on r.id = ur.rol_id
              where ur.usuario_id = p_actor
                and ur.facultad_id = c.facultad_id
                and r.clave = 'SECRETARIO_ACADEMICO'
            )
          )
          or exists (
            select 1
            from public.usuarios_roles ur
            join public.roles r on r.id = ur.rol_id
            where ur.usuario_id = p_actor
              and ur.carrera_id = c.id
              and r.clave = 'JEFE_CARRERA'
          )
          or exists (
            select 1
            from public.usuarios_roles ur
            join public.roles r on r.id = ur.rol_id
            where ur.usuario_id = p_actor
              and ur.facultad_id = c.facultad_id
              and r.clave = 'JEFE_POSGRADO'
              and public.nivel_es_posgrado(c.nivel::text)
          )
        )
    );
$$;

create or replace function private.usuario_es_jefe_posgrado_encargado_plan(
  p_usuario_id uuid,
  p_plan_id uuid
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
        and private.authz_claim_has_role('JEFE_POSGRADO')
        and private.authz_claim_can_access_plan(p_plan_id)
        and exists (
          select 1
          from public.planes_estudio pe
          join public.carreras c on c.id = pe.carrera_id
          where pe.id = p_plan_id
            and public.nivel_es_posgrado(c.nivel::text)
        )
      )
      or (
        not private.authz_is_simulated_self(p_usuario_id)
        and exists (
          select 1
          from public.planes_estudio pe
          join public.carreras c on c.id = pe.carrera_id
          join public.usuarios_roles ur on ur.facultad_id = c.facultad_id
          join public.roles r on r.id = ur.rol_id
          join public.usuarios_app ua on ua.id = ur.usuario_id
          where pe.id = p_plan_id
            and ur.usuario_id = p_usuario_id
            and ua.dado_de_baja_en is null
            and r.clave = 'JEFE_POSGRADO'
            and public.nivel_es_posgrado(c.nivel::text)
        )
      )
    );
$$;

create or replace function private.usuario_es_jefe_encargado_plan(
  p_usuario_id uuid,
  p_plan_id uuid
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
      or private.usuario_es_jefe_posgrado_encargado_plan(
        p_usuario_id,
        p_plan_id
      )
    );
$$;

create or replace function public.usuario_es_jefe_posgrado_encargado_plan(
  p_usuario_id uuid,
  p_plan_id uuid
)
returns boolean
language sql
stable
security definer
set search_path to public, private, auth, extensions, pg_temp
as $$
  select private.usuario_es_jefe_posgrado_encargado_plan(
    p_usuario_id,
    p_plan_id
  );
$$;

create or replace function public.usuario_es_jefe_encargado_plan(
  p_usuario_id uuid,
  p_plan_id uuid
)
returns boolean
language sql
stable
security definer
set search_path to public, private, auth, extensions, pg_temp
as $$
  select private.usuario_es_jefe_encargado_plan(p_usuario_id, p_plan_id);
$$;

create or replace function public.usuario_tiene_rol_contextual_plan(
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
  select case
    when p_rol = 'JEFE_CARRERA' then
      private.usuario_es_jefe_encargado_plan(p_usuario_id, p_plan_id)
    when p_rol = 'JEFE_POSGRADO' then
      private.usuario_es_jefe_posgrado_encargado_plan(p_usuario_id, p_plan_id)
    else
      private.usuario_tiene_rol_en_plan(p_usuario_id, p_plan_id, p_rol)
  end;
$$;

create or replace function private.usuario_puede_acceder_plan(
  p_usuario_id uuid,
  p_plan_id uuid
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
        and case
          when private.authz_claim_has_role('JEFE_POSGRADO') then
            private.usuario_es_jefe_posgrado_encargado_plan(
              p_usuario_id,
              p_plan_id
            )
          else private.authz_claim_can_access_plan(p_plan_id)
        end
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
                or (
                  ur.facultad_id is null
                  and ur.carrera_id is null
                  and r.alcance_default = 'global'
                )
                or ur.carrera_id = pe.carrera_id
                or (
                  ur.facultad_id = c.facultad_id
                  and (
                    r.clave <> 'JEFE_POSGRADO'
                    or public.nivel_es_posgrado(c.nivel::text)
                  )
                )
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

create or replace function public.usuario_puede_acceder_plan(
  p_usuario_id uuid,
  p_plan_id uuid
)
returns boolean
language sql
stable
security definer
set search_path to public, private, auth, extensions, pg_temp
as $$
  select private.usuario_puede_acceder_plan(p_usuario_id, p_plan_id);
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
        and case
          when p_rol = 'JEFE_POSGRADO' then
            private.usuario_es_jefe_posgrado_encargado_plan(
              p_usuario_id,
              p_plan_id
            )
          else private.authz_claim_can_access_plan(p_plan_id)
        end
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
              or (
                ur.facultad_id is null
                and ur.carrera_id is null
                and r.alcance_default = 'global'
              )
              or ur.carrera_id = pe.carrera_id
              or (
                ur.facultad_id = c.facultad_id
                and (
                  r.clave <> 'JEFE_POSGRADO'
                  or public.nivel_es_posgrado(c.nivel::text)
                )
              )
            )
        )
      )
    );
$$;

create or replace function public.usuario_tiene_rol_en_plan(
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
  select private.usuario_tiene_rol_en_plan(p_usuario_id, p_plan_id, p_rol);
$$;

create or replace function private.usuario_puede_gestionar_rol(
  p_actor uuid,
  p_rol uuid,
  p_facultad uuid default null,
  p_carrera uuid default null
)
returns boolean
language plpgsql
stable
security definer
set search_path to public, private, auth, extensions, pg_temp
as $$
declare
  v_rol record;
  v_carrera_facultad uuid;
begin
  if p_actor is null or p_rol is null then
    return false;
  end if;

  if not exists (
    select 1
    from public.usuarios_app ua
    where ua.id = p_actor
      and ua.dado_de_baja_en is null
  ) then
    return false;
  end if;

  select r.id, r.clave, r.nivel_jerarquico, r.alcance_default
  into v_rol
  from public.roles r
  where r.id = p_rol;

  if not found then
    return false;
  end if;

  if p_facultad is not null and p_carrera is not null then
    return false;
  end if;

  if v_rol.alcance_default = 'global'
    and (p_facultad is not null or p_carrera is not null) then
    return false;
  end if;

  if v_rol.alcance_default = 'facultad'
    and (p_facultad is null or p_carrera is not null) then
    return false;
  end if;

  if v_rol.alcance_default = 'carrera'
    and (p_carrera is null or p_facultad is not null) then
    return false;
  end if;

  if v_rol.alcance_default in ('asignatura', 'externo') then
    return false;
  end if;

  if private.usuario_tiene_rol_activo(p_actor, 'ADMIN') then
    return true;
  end if;

  if v_rol.clave = 'ADMIN' then
    return false;
  end if;

  if private.usuario_tiene_rol_activo(p_actor, 'VICERRECTOR_ACADEMICO') then
    return v_rol.nivel_jerarquico > 10;
  end if;

  if p_carrera is not null then
    select c.facultad_id
    into v_carrera_facultad
    from public.carreras c
    where c.id = p_carrera;

    if v_carrera_facultad is null then
      return false;
    end if;
  end if;

  if v_rol.alcance_default = 'facultad' then
    if exists (
      select 1
      from public.usuarios_roles ur
      join public.roles r on r.id = ur.rol_id
      where ur.usuario_id = p_actor
        and ur.facultad_id = p_facultad
        and r.clave = 'DIRECTOR_FACULTAD'
        and v_rol.nivel_jerarquico > 20
    ) then
      return true;
    end if;

    return exists (
      select 1
      from public.usuarios_roles ur
      join public.roles r on r.id = ur.rol_id
      where ur.usuario_id = p_actor
        and ur.facultad_id = p_facultad
        and r.clave = 'SECRETARIO_ACADEMICO'
        and v_rol.clave in ('JEFE_CARRERA', 'JEFE_POSGRADO')
    );
  end if;

  if v_rol.alcance_default = 'carrera' then
    if exists (
      select 1
      from public.usuarios_roles ur
      join public.roles r on r.id = ur.rol_id
      where ur.usuario_id = p_actor
        and ur.facultad_id = v_carrera_facultad
        and r.clave = 'DIRECTOR_FACULTAD'
        and v_rol.nivel_jerarquico > 20
    ) then
      return true;
    end if;

    return exists (
      select 1
      from public.usuarios_roles ur
      join public.roles r on r.id = ur.rol_id
      where ur.usuario_id = p_actor
        and ur.facultad_id = v_carrera_facultad
        and r.clave = 'SECRETARIO_ACADEMICO'
        and v_rol.clave = 'JEFE_CARRERA'
    );
  end if;

  return false;
end;
$$;

create or replace function public.usuario_puede_gestionar_rol(
  p_actor uuid,
  p_rol uuid,
  p_facultad uuid default null,
  p_carrera uuid default null
)
returns boolean
language sql
stable
security definer
set search_path to public, private, auth, extensions, pg_temp
as $$
  select private.usuario_puede_gestionar_rol(
    p_actor,
    p_rol,
    p_facultad,
    p_carrera
  );
$$;

create or replace function private.usuario_puede_gestionar_usuario(
  p_actor uuid,
  p_usuario uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path to public, private, auth, extensions, pg_temp
as $$
declare
  v_target record;
  v_formal_roles int := 0;
  v_unmanageable_roles boolean := false;
  v_has_responsabilidades boolean := false;
  v_uncovered_responsabilidades boolean := false;
begin
  if p_actor is null or p_usuario is null or p_actor = p_usuario then
    return false;
  end if;

  if not exists (
    select 1
    from public.usuarios_app ua
    where ua.id = p_actor
      and ua.dado_de_baja_en is null
  ) then
    return false;
  end if;

  select ua.id, ua.invitado_por
  into v_target
  from public.usuarios_app ua
  where ua.id = p_usuario;

  if not found then
    return false;
  end if;

  if private.usuario_tiene_rol_activo(p_actor, 'ADMIN') then
    return true;
  end if;

  if exists (
    select 1
    from public.usuarios_roles ur
    join public.roles r on r.id = ur.rol_id
    where ur.usuario_id = p_usuario
      and r.clave = 'ADMIN'
  ) then
    return false;
  end if;

  if private.usuario_tiene_rol_activo(p_actor, 'VICERRECTOR_ACADEMICO') then
    return true;
  end if;

  select
    count(*),
    coalesce(
      bool_or(
        not private.usuario_puede_gestionar_rol(
          p_actor,
          ur.rol_id,
          ur.facultad_id,
          ur.carrera_id
        )
      ),
      false
    )
  into v_formal_roles, v_unmanageable_roles
  from public.usuarios_roles ur
  join public.roles r on r.id = ur.rol_id
  where ur.usuario_id = p_usuario
    and r.alcance_default in ('global', 'facultad', 'carrera');

  if v_formal_roles > 0 then
    if v_unmanageable_roles then
      return false;
    end if;

    select coalesce(
      bool_or(
        not private.usuario_cubre_carrera_para_gestion(
          p_actor,
          pe.carrera_id,
          true
        )
      ),
      false
    )
    into v_uncovered_responsabilidades
    from public.responsables_asignatura ra
    join public.asignaturas a on a.id = ra.asignatura_id
    join public.planes_estudio pe on pe.id = a.plan_estudio_id
    where ra.usuario_id = p_usuario;

    return not v_uncovered_responsabilidades;
  end if;

  if v_target.invitado_por = p_actor then
    return true;
  end if;

  select exists (
    select 1
    from public.responsables_asignatura ra
    where ra.usuario_id = p_usuario
  )
  into v_has_responsabilidades;

  if v_has_responsabilidades then
    select coalesce(
      bool_or(
        not private.usuario_cubre_carrera_para_gestion(
          p_actor,
          pe.carrera_id,
          false
        )
      ),
      false
    )
    into v_uncovered_responsabilidades
    from public.responsables_asignatura ra
    join public.asignaturas a on a.id = ra.asignatura_id
    join public.planes_estudio pe on pe.id = a.plan_estudio_id
    where ra.usuario_id = p_usuario;

    return not v_uncovered_responsabilidades;
  end if;

  return false;
end;
$$;

create or replace function public.usuario_puede_gestionar_usuario(
  p_actor uuid,
  p_usuario uuid
)
returns boolean
language sql
stable
security definer
set search_path to public, private, auth, extensions, pg_temp
as $$
  select private.usuario_puede_gestionar_usuario(p_actor, p_usuario);
$$;

create or replace function public.nombrar_responsable(
  p_usuario uuid,
  p_rol uuid,
  p_facultad uuid,
  p_carrera uuid,
  p_actor uuid
)
returns jsonb
language plpgsql
security definer
set search_path to public, private, auth, extensions, pg_temp
as $$
declare
  v_alcance text;
  v_reemplazados jsonb;
  v_nueva public.usuarios_roles;
begin
  select alcance_default into v_alcance from public.roles where id = p_rol;
  if not found then
    raise exception 'Rol no encontrado.' using errcode = 'P0404';
  end if;

  if p_facultad is not null and p_carrera is not null then
    raise exception 'El alcance debe ser por facultad o por carrera, no ambos.'
      using errcode = 'P0409';
  end if;
  if v_alcance = 'facultad' and p_facultad is null then
    raise exception 'Este rol requiere una facultad.' using errcode = 'P0409';
  end if;
  if v_alcance = 'carrera' and p_carrera is null then
    raise exception 'Este rol requiere una carrera.' using errcode = 'P0409';
  end if;

  if not public.usuario_puede_gestionar_usuario(p_actor, p_usuario) then
    raise exception 'No tienes permisos para gestionar a este usuario.'
      using errcode = 'P0403';
  end if;

  if not public.usuario_puede_gestionar_rol(
    p_actor,
    p_rol,
    p_facultad,
    p_carrera
  ) then
    raise exception 'No tienes permisos para nombrar ese rol en ese alcance.'
      using errcode = 'P0403';
  end if;

  if exists (
    select 1
    from public.usuarios_roles ur
    where ur.rol_id = p_rol
      and ur.usuario_id <> p_usuario
      and (
        (p_facultad is not null and ur.facultad_id = p_facultad)
        or (p_carrera is not null and ur.carrera_id = p_carrera)
      )
      and not public.usuario_puede_gestionar_usuario(p_actor, ur.usuario_id)
  ) then
    raise exception 'No tienes permisos para reemplazar al titular actual.'
      using errcode = 'P0403';
  end if;

  with removed as (
    delete from public.usuarios_roles ur
    where ur.rol_id = p_rol
      and ur.usuario_id <> p_usuario
      and (
        (p_facultad is not null and ur.facultad_id = p_facultad)
        or (p_carrera is not null and ur.carrera_id = p_carrera)
      )
    returning ur.usuario_id, ur.id as asignacion_id
  )
  select coalesce(jsonb_agg(to_jsonb(removed)), '[]'::jsonb)
  into v_reemplazados
  from removed;

  insert into public.usuarios_roles (
    usuario_id,
    rol_id,
    facultad_id,
    carrera_id,
    asignado_por
  )
  values (p_usuario, p_rol, p_facultad, p_carrera, p_actor)
  on conflict do nothing
  returning * into v_nueva;

  if v_nueva.id is null then
    select * into v_nueva
    from public.usuarios_roles
    where usuario_id = p_usuario
      and rol_id = p_rol
      and coalesce(facultad_id, '00000000-0000-0000-0000-000000000000'::uuid)
          = coalesce(p_facultad, '00000000-0000-0000-0000-000000000000'::uuid)
      and coalesce(carrera_id, '00000000-0000-0000-0000-000000000000'::uuid)
          = coalesce(p_carrera, '00000000-0000-0000-0000-000000000000'::uuid);
  end if;

  return jsonb_build_object(
    'asignacion_id', v_nueva.id,
    'usuario_id', p_usuario,
    'reemplazados', v_reemplazados
  );
end;
$$;

create or replace function public.reasignar_responsabilidades(
  p_origen uuid,
  p_destino uuid,
  p_actor uuid
)
returns jsonb
language plpgsql
security definer
set search_path to public, private, auth, extensions, pg_temp
as $$
declare
  v_destino_baja timestamptz;
  v_detalle jsonb;
begin
  if p_origen = p_destino then
    raise exception 'El origen y el destino no pueden ser el mismo usuario.'
      using errcode = 'P0409';
  end if;

  if not exists (select 1 from public.usuarios_app where id = p_origen) then
    raise exception 'Usuario origen no encontrado.' using errcode = 'P0404';
  end if;

  select dado_de_baja_en
  into v_destino_baja
  from public.usuarios_app
  where id = p_destino;

  if not found then
    raise exception 'Usuario destino no encontrado.' using errcode = 'P0404';
  end if;

  if v_destino_baja is not null then
    raise exception 'El usuario destino esta dado de baja.'
      using errcode = 'P0409';
  end if;

  if not public.usuario_puede_gestionar_usuario(p_actor, p_origen) then
    raise exception 'No tienes permisos para reasignar a este usuario.'
      using errcode = 'P0403';
  end if;

  if not public.usuario_puede_gestionar_usuario(p_actor, p_destino) then
    raise exception 'No tienes permisos para reemplazar responsabilidades del usuario destino.'
      using errcode = 'P0403';
  end if;

  v_detalle := jsonb_build_object(
    'origen_roles',
      (select coalesce(jsonb_agg(to_jsonb(ur)), '[]'::jsonb)
       from public.usuarios_roles ur
       where ur.usuario_id = p_origen),
    'origen_tareas',
      (select coalesce(jsonb_agg(t.id), '[]'::jsonb)
       from public.tareas_revision t
       where t.asignado_a = p_origen),
    'origen_responsables',
      (select coalesce(jsonb_agg(ra.id), '[]'::jsonb)
       from public.responsables_asignatura ra
       where ra.usuario_id = p_origen),
    'destino_roles_previos',
      (select coalesce(jsonb_agg(to_jsonb(ur)), '[]'::jsonb)
       from public.usuarios_roles ur
       where ur.usuario_id = p_destino),
    'destino_tareas_previas',
      (select coalesce(jsonb_agg(t.id), '[]'::jsonb)
       from public.tareas_revision t
       where t.asignado_a = p_destino),
    'destino_responsables_previos',
      (select coalesce(jsonb_agg(ra.id), '[]'::jsonb)
       from public.responsables_asignatura ra
       where ra.usuario_id = p_destino)
  );

  delete from public.usuarios_roles where usuario_id = p_destino;
  delete from public.tareas_revision where asignado_a = p_destino;
  delete from public.responsables_asignatura where usuario_id = p_destino;

  update public.usuarios_roles
  set usuario_id = p_destino,
      asignado_por = p_actor
  where usuario_id = p_origen;

  update public.tareas_revision
  set asignado_a = p_destino
  where asignado_a = p_origen;

  update public.responsables_asignatura
  set usuario_id = p_destino
  where usuario_id = p_origen;

  update public.usuarios_app
  set dado_de_baja_en = now()
  where id = p_origen;

  insert into public.reasignaciones (
    reasignado_por,
    usuario_origen,
    usuario_destino,
    detalle
  )
  values (p_actor, p_origen, p_destino, v_detalle);

  return jsonb_build_object(
    'origen', p_origen,
    'destino', p_destino,
    'reasignado_por', p_actor,
    'detalle', v_detalle
  );
end;
$$;

drop policy if exists "roles_manage_by_permission" on public.roles;
drop policy if exists "roles_insert_by_permission" on public.roles;
drop policy if exists "roles_update_by_permission" on public.roles;
drop policy if exists "roles_delete_by_permission" on public.roles;
create policy "roles_insert_by_catalogos"
on public.roles
for insert
to authenticated
with check (public.authz_has_permission('catalogos.gestionar'));
create policy "roles_update_by_catalogos"
on public.roles
for update
to authenticated
using (public.authz_has_permission('catalogos.gestionar'))
with check (public.authz_has_permission('catalogos.gestionar'));
create policy "roles_delete_by_catalogos"
on public.roles
for delete
to authenticated
using (public.authz_has_permission('catalogos.gestionar'));

drop policy if exists "roles_permisos_manage_by_permission" on public.roles_permisos;
drop policy if exists "roles_permisos_insert_by_permission" on public.roles_permisos;
drop policy if exists "roles_permisos_update_by_permission" on public.roles_permisos;
drop policy if exists "roles_permisos_delete_by_permission" on public.roles_permisos;
create policy "roles_permisos_insert_by_catalogos"
on public.roles_permisos
for insert
to authenticated
with check (public.authz_has_permission('catalogos.gestionar'));
create policy "roles_permisos_update_by_catalogos"
on public.roles_permisos
for update
to authenticated
using (public.authz_has_permission('catalogos.gestionar'))
with check (public.authz_has_permission('catalogos.gestionar'));
create policy "roles_permisos_delete_by_catalogos"
on public.roles_permisos
for delete
to authenticated
using (public.authz_has_permission('catalogos.gestionar'));

drop policy if exists "usuarios_app_update_own_or_manage" on public.usuarios_app;
create policy "usuarios_app_update_own_or_manage"
on public.usuarios_app
for update
to authenticated
using (
  id = (select auth.uid())
  or public.usuario_puede_gestionar_usuario((select auth.uid()), id)
)
with check (
  id = (select auth.uid())
  or public.usuario_puede_gestionar_usuario((select auth.uid()), id)
);

drop policy if exists "usuarios_roles_insert_by_permission" on public.usuarios_roles;
create policy "usuarios_roles_insert_by_hierarchy"
on public.usuarios_roles
for insert
to authenticated
with check (
  public.usuario_puede_gestionar_usuario((select auth.uid()), usuario_id)
  and public.usuario_puede_gestionar_rol(
    (select auth.uid()),
    rol_id,
    facultad_id,
    carrera_id
  )
);

drop policy if exists "usuarios_roles_update_by_permission" on public.usuarios_roles;
create policy "usuarios_roles_update_by_hierarchy"
on public.usuarios_roles
for update
to authenticated
using (
  public.usuario_puede_gestionar_usuario((select auth.uid()), usuario_id)
  and public.usuario_puede_gestionar_rol(
    (select auth.uid()),
    rol_id,
    facultad_id,
    carrera_id
  )
)
with check (
  public.usuario_puede_gestionar_usuario((select auth.uid()), usuario_id)
  and public.usuario_puede_gestionar_rol(
    (select auth.uid()),
    rol_id,
    facultad_id,
    carrera_id
  )
);

drop policy if exists "usuarios_roles_delete_by_permission" on public.usuarios_roles;
create policy "usuarios_roles_delete_by_hierarchy"
on public.usuarios_roles
for delete
to authenticated
using (
  public.usuario_puede_gestionar_usuario((select auth.uid()), usuario_id)
  and public.usuario_puede_gestionar_rol(
    (select auth.uid()),
    rol_id,
    facultad_id,
    carrera_id
  )
);

revoke all on function public.nivel_es_posgrado(text) from public, anon;
grant execute on function public.nivel_es_posgrado(text) to authenticated, service_role;

revoke all on function private.usuario_tiene_rol_activo(uuid, text) from public, anon;
revoke all on function private.usuario_cubre_carrera_para_gestion(uuid, uuid, boolean) from public, anon;
revoke all on function private.usuario_es_jefe_posgrado_encargado_plan(uuid, uuid) from public, anon;
revoke all on function private.usuario_es_jefe_encargado_plan(uuid, uuid) from public, anon;
revoke all on function private.usuario_puede_acceder_plan(uuid, uuid) from public, anon;
revoke all on function private.usuario_tiene_rol_en_plan(uuid, uuid, text) from public, anon;
revoke all on function private.usuario_puede_gestionar_rol(uuid, uuid, uuid, uuid) from public, anon;
revoke all on function private.usuario_puede_gestionar_usuario(uuid, uuid) from public, anon;
grant execute on function private.usuario_tiene_rol_activo(uuid, text) to authenticated, service_role;
grant execute on function private.usuario_cubre_carrera_para_gestion(uuid, uuid, boolean) to authenticated, service_role;
grant execute on function private.usuario_es_jefe_posgrado_encargado_plan(uuid, uuid) to authenticated, service_role;
grant execute on function private.usuario_es_jefe_encargado_plan(uuid, uuid) to authenticated, service_role;
grant execute on function private.usuario_puede_acceder_plan(uuid, uuid) to authenticated, service_role;
grant execute on function private.usuario_tiene_rol_en_plan(uuid, uuid, text) to authenticated, service_role;
grant execute on function private.usuario_puede_gestionar_rol(uuid, uuid, uuid, uuid) to authenticated, service_role;
grant execute on function private.usuario_puede_gestionar_usuario(uuid, uuid) to authenticated, service_role;

revoke all on function public.usuario_es_jefe_posgrado_encargado_plan(uuid, uuid) from public, anon;
revoke all on function public.usuario_es_jefe_encargado_plan(uuid, uuid) from public, anon;
revoke all on function public.usuario_puede_acceder_plan(uuid, uuid) from public, anon;
revoke all on function public.usuario_tiene_rol_en_plan(uuid, uuid, text) from public, anon;
revoke all on function public.usuario_tiene_rol_contextual_plan(uuid, uuid, text) from public, anon;
revoke all on function public.usuario_puede_gestionar_rol(uuid, uuid, uuid, uuid) from public, anon;
revoke all on function public.usuario_puede_gestionar_usuario(uuid, uuid) from public, anon;
grant execute on function public.usuario_es_jefe_posgrado_encargado_plan(uuid, uuid) to authenticated, service_role;
grant execute on function public.usuario_es_jefe_encargado_plan(uuid, uuid) to authenticated, service_role;
grant execute on function public.usuario_puede_acceder_plan(uuid, uuid) to authenticated, service_role;
grant execute on function public.usuario_tiene_rol_en_plan(uuid, uuid, text) to authenticated, service_role;
grant execute on function public.usuario_tiene_rol_contextual_plan(uuid, uuid, text) to authenticated, service_role;
grant execute on function public.usuario_puede_gestionar_rol(uuid, uuid, uuid, uuid) to authenticated, service_role;
grant execute on function public.usuario_puede_gestionar_usuario(uuid, uuid) to authenticated, service_role;

revoke all on function public.nombrar_responsable(uuid, uuid, uuid, uuid, uuid) from public, anon;
revoke all on function public.reasignar_responsabilidades(uuid, uuid, uuid) from public, anon;
grant execute on function public.nombrar_responsable(uuid, uuid, uuid, uuid, uuid) to authenticated, service_role;
grant execute on function public.reasignar_responsabilidades(uuid, uuid, uuid) to authenticated, service_role;
