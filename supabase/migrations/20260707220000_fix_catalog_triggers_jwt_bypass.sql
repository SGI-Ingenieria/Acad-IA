-- Los triggers de guard en facultades y carreras llamaban a authz_has_permission
-- que lee auth.jwt(). Cuando el seed/migrations corren via psql sin sesión JWT,
-- auth.jwt() devuelve null → sin permiso → RAISE. Fix: bypass si no hay JWT.

create or replace function public.facultades_guard_scoped_catalog_update()
returns trigger
language plpgsql
security definer
set search_path to public, private, auth, extensions, pg_temp
as $$
begin
  -- Sin sesión JWT (migrations, seeds, scripts de mantenimiento) → permitir siempre.
  if auth.jwt() is null then
    return new;
  end if;

  if (
    public.authz_simulacion_activa()
    and private.authz_claim_has_permission('catalogos.gestionar')
  ) or (
    not public.authz_simulacion_activa()
    and public.authz_has_permission('catalogos.gestionar'::text)
  ) then
    return new;
  end if;

  if public.authz_can_manage_facultad_catalog(old.id)
    and new.id = old.id
    and new.activa is not distinct from old.activa
    and new.creado_en is not distinct from old.creado_en
    and new.creado_por is not distinct from old.creado_por
  then
    return new;
  end if;

  raise exception 'No tienes permisos para cambiar el alcance o estado de esta facultad.'
    using errcode = '42501';
end;
$$;

create or replace function public.carreras_guard_scoped_catalog_update()
returns trigger
language plpgsql
security definer
set search_path to public, private, auth, extensions, pg_temp
as $$
begin
  -- Sin sesión JWT (migrations, seeds, scripts de mantenimiento) → permitir siempre.
  if auth.jwt() is null then
    return new;
  end if;

  if public.authz_can_create_carrera_catalog(new.facultad_id, new.nivel::text) then
    return new;
  end if;

  if public.authz_can_manage_carrera_catalog(old.id)
    and new.id = old.id
    and new.facultad_id is not distinct from old.facultad_id
    and new.nivel is not distinct from old.nivel
    and new.activa is not distinct from old.activa
    and new.creado_en is not distinct from old.creado_en
    and new.creado_por is not distinct from old.creado_por
  then
    return new;
  end if;

  raise exception 'No tienes permisos para cambiar el alcance, nivel o estado de esta carrera.'
    using errcode = '42501';
end;
$$;
