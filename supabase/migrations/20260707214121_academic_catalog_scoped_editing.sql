create or replace function private.authz_claim_has_facultad_scope(
  p_facultad_id uuid
)
returns boolean
language sql
stable
security invoker
set search_path to public, private, auth, extensions, pg_temp
as $$
  select p_facultad_id is not null
    and exists (
      select 1
      from jsonb_array_elements_text(
        coalesce(auth.jwt() #> '{app_metadata,alcances,facultades}', '[]'::jsonb)
      ) as alcance(value)
      where alcance.value = p_facultad_id::text
    );
$$;

create or replace function private.authz_claim_has_carrera_scope(
  p_carrera_id uuid
)
returns boolean
language sql
stable
security invoker
set search_path to public, private, auth, extensions, pg_temp
as $$
  select p_carrera_id is not null
    and exists (
      select 1
      from jsonb_array_elements_text(
        coalesce(auth.jwt() #> '{app_metadata,alcances,carreras}', '[]'::jsonb)
      ) as alcance(value)
      where alcance.value = p_carrera_id::text
    );
$$;

create or replace function public.authz_can_manage_facultad_catalog(
  p_facultad_id uuid
)
returns boolean
language sql
stable
security definer
set search_path to public, private, auth, extensions, pg_temp
as $$
  select p_facultad_id is not null
    and (
      (
        public.authz_simulacion_activa()
        and private.authz_claim_has_permission('catalogos.gestionar')
      )
      or (
        not public.authz_simulacion_activa()
        and public.authz_has_permission('catalogos.gestionar'::text)
      )
      or (
        public.authz_simulacion_activa()
        and (
          private.authz_claim_has_global_scope()
          or (
            private.authz_claim_has_role('DIRECTOR_FACULTAD')
            and private.authz_claim_has_facultad_scope(p_facultad_id)
          )
        )
      )
      or (
        not public.authz_simulacion_activa()
        and exists (
          select 1
          from public.usuarios_app ua
          where ua.id = auth.uid()
            and ua.dado_de_baja_en is null
        )
        and (
          private.usuario_tiene_rol_activo(auth.uid(), 'ADMIN')
          or private.usuario_tiene_rol_activo(
            auth.uid(),
            'VICERRECTOR_ACADEMICO'
          )
          or exists (
            select 1
            from public.usuarios_roles ur
            join public.roles r on r.id = ur.rol_id
            where ur.usuario_id = auth.uid()
              and ur.facultad_id = p_facultad_id
              and r.clave = 'DIRECTOR_FACULTAD'
          )
        )
      )
    );
$$;

create or replace function public.authz_can_create_carrera_catalog(
  p_facultad_id uuid,
  p_nivel text
)
returns boolean
language sql
stable
security definer
set search_path to public, private, auth, extensions, pg_temp
as $$
  select p_facultad_id is not null
    and (
      (
        public.authz_simulacion_activa()
        and private.authz_claim_has_permission('catalogos.gestionar')
      )
      or (
        not public.authz_simulacion_activa()
        and public.authz_has_permission('catalogos.gestionar'::text)
      )
      or (
        public.authz_simulacion_activa()
        and (
          private.authz_claim_has_global_scope()
          or (
            (
              private.authz_claim_has_role('DIRECTOR_FACULTAD')
              or private.authz_claim_has_role('SECRETARIO_ACADEMICO')
            )
            and private.authz_claim_has_facultad_scope(p_facultad_id)
          )
          or (
            private.authz_claim_has_role('JEFE_POSGRADO')
            and private.authz_claim_has_facultad_scope(p_facultad_id)
            and public.nivel_es_posgrado(p_nivel)
          )
        )
      )
      or (
        not public.authz_simulacion_activa()
        and exists (
          select 1
          from public.usuarios_app ua
          where ua.id = auth.uid()
            and ua.dado_de_baja_en is null
        )
        and (
          private.usuario_tiene_rol_activo(auth.uid(), 'ADMIN')
          or private.usuario_tiene_rol_activo(
            auth.uid(),
            'VICERRECTOR_ACADEMICO'
          )
          or exists (
            select 1
            from public.usuarios_roles ur
            join public.roles r on r.id = ur.rol_id
            where ur.usuario_id = auth.uid()
              and ur.facultad_id = p_facultad_id
              and r.clave in ('DIRECTOR_FACULTAD', 'SECRETARIO_ACADEMICO')
          )
          or (
            public.nivel_es_posgrado(p_nivel)
            and exists (
              select 1
              from public.usuarios_roles ur
              join public.roles r on r.id = ur.rol_id
              where ur.usuario_id = auth.uid()
                and ur.facultad_id = p_facultad_id
                and r.clave = 'JEFE_POSGRADO'
            )
          )
        )
      )
    );
$$;

create or replace function public.authz_can_manage_carrera_catalog(
  p_carrera_id uuid
)
returns boolean
language sql
stable
security definer
set search_path to public, private, auth, extensions, pg_temp
as $$
  select p_carrera_id is not null
    and exists (
      select 1
      from public.carreras c
      where c.id = p_carrera_id
        and (
          public.authz_can_create_carrera_catalog(
            c.facultad_id,
            c.nivel::text
          )
          or (
            public.authz_simulacion_activa()
            and private.authz_claim_has_role('JEFE_CARRERA')
            and private.authz_claim_has_carrera_scope(c.id)
          )
          or (
            not public.authz_simulacion_activa()
            and exists (
              select 1
              from public.usuarios_app ua
              where ua.id = auth.uid()
                and ua.dado_de_baja_en is null
            )
            and exists (
              select 1
              from public.usuarios_roles ur
              join public.roles r on r.id = ur.rol_id
              where ur.usuario_id = auth.uid()
                and ur.carrera_id = c.id
                and r.clave = 'JEFE_CARRERA'
            )
          )
        )
    );
$$;

create or replace function public.authz_can_list_plan_catalog_for_facultad(
  p_facultad_id uuid
)
returns boolean
language sql
stable
security definer
set search_path to public, private, auth, extensions, pg_temp
as $$
  select p_facultad_id is not null
    and (
      (
        public.authz_simulacion_activa()
        and private.authz_claim_has_permission('planes.ver')
        and (
          private.authz_claim_has_global_scope()
          or private.authz_claim_has_facultad_scope(p_facultad_id)
          or exists (
            select 1
            from jsonb_array_elements_text(
              coalesce(auth.jwt() #> '{app_metadata,alcances,carreras}', '[]'::jsonb)
            ) as alcance(value)
            join public.carreras c on c.id::text = alcance.value
            where c.facultad_id = p_facultad_id
          )
        )
      )
      or (
        not public.authz_simulacion_activa()
        and public.authz_has_permission('planes.ver'::text)
        and exists (
          select 1
          from public.usuarios_roles ur
          join public.roles r on r.id = ur.rol_id
          join public.usuarios_app ua on ua.id = ur.usuario_id
          left join public.carreras c_scope on c_scope.id = ur.carrera_id
          where ur.usuario_id = auth.uid()
            and ua.dado_de_baja_en is null
            and (
              r.clave = 'ADMIN'
              or (
                ur.facultad_id is null
                and ur.carrera_id is null
                and r.alcance_default = 'global'
              )
              or ur.facultad_id = p_facultad_id
              or c_scope.facultad_id = p_facultad_id
            )
        )
      )
    );
$$;

drop function if exists public.planes_catalogo_buscar(
  text,
  uuid,
  uuid,
  uuid,
  text,
  boolean,
  integer,
  integer
);

create function public.planes_catalogo_buscar(
  p_search text default null,
  p_facultad_id uuid default null,
  p_carrera_id uuid default null,
  p_estado_id uuid default null,
  p_nivel text default null,
  p_activo boolean default null,
  p_limit integer default 50,
  p_offset integer default 0
)
returns table (
  plan jsonb,
  carrera jsonb,
  facultad jsonb,
  estructura_plan jsonb,
  estado_plan jsonb,
  puede_abrir_detalle boolean,
  total_count bigint
)
language sql
stable
security definer
set search_path to public, private, auth, extensions, pg_temp
as $$
  with normalized as (
    select
      lower(public.unaccent_immutable(btrim(coalesce(p_search, '')))) as search_term,
      nullif(btrim(coalesce(p_nivel, '')), '') as nivel_term,
      greatest(0, least(coalesce(p_limit, 50), 100)) as safe_limit,
      greatest(0, coalesce(p_offset, 0)) as safe_offset
  ),
  filtered as (
    select
      pe,
      c,
      f,
      eplan,
      ep,
      (
        case
          when public.authz_simulacion_activa()
            then private.authz_claim_has_permission('planes.ver')
          else public.authz_has_permission('planes.ver'::text)
        end
        and public.authz_can_access_plan(pe.id)
      ) as puede_abrir_detalle
    from public.planes_estudio pe
    join public.carreras c on c.id = pe.carrera_id
    join public.facultades f on f.id = c.facultad_id
    left join public.estructuras_plan eplan on eplan.id = pe.estructura_id
    left join public.estados_plan ep on ep.id = pe.estado_actual_id
    cross join normalized n
    where public.authz_can_list_plan_catalog_for_facultad(c.facultad_id)
      and (n.search_term = '' or pe.nombre_search ilike '%' || n.search_term || '%')
      and (p_facultad_id is null or c.facultad_id = p_facultad_id)
      and (p_carrera_id is null or pe.carrera_id = p_carrera_id)
      and (p_estado_id is null or pe.estado_actual_id = p_estado_id)
      and (p_activo is null or pe.activo = p_activo)
      and (
        n.nivel_term is null
        or lower(public.unaccent_immutable(c.nivel::text)) = lower(public.unaccent_immutable(n.nivel_term))
      )
  )
  select
    to_jsonb(filtered.pe) as plan,
    to_jsonb(filtered.c) as carrera,
    to_jsonb(filtered.f) as facultad,
    to_jsonb(filtered.eplan) as estructura_plan,
    to_jsonb(filtered.ep) as estado_plan,
    filtered.puede_abrir_detalle,
    count(*) over () as total_count
  from filtered
  cross join normalized n
  order by (filtered.pe).creado_en desc
  limit (select safe_limit from normalized)
  offset (select safe_offset from normalized);
$$;

create or replace function public.facultades_guard_scoped_catalog_update()
returns trigger
language plpgsql
security definer
set search_path to public, private, auth, extensions, pg_temp
as $$
begin
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

drop trigger if exists facultades_guard_scoped_catalog_update
on public.facultades;

create trigger facultades_guard_scoped_catalog_update
before update on public.facultades
for each row
execute function public.facultades_guard_scoped_catalog_update();

create or replace function public.carreras_guard_scoped_catalog_update()
returns trigger
language plpgsql
security definer
set search_path to public, private, auth, extensions, pg_temp
as $$
begin
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

drop trigger if exists carreras_guard_scoped_catalog_update
on public.carreras;

create trigger carreras_guard_scoped_catalog_update
before update on public.carreras
for each row
execute function public.carreras_guard_scoped_catalog_update();

drop policy if exists carreras_insert_by_catalogos on public.carreras;
drop policy if exists carreras_update_by_catalogos_or_plan_scope on public.carreras;

create policy carreras_insert_by_academic_catalog_scope
on public.carreras
for insert
to authenticated
with check (
  public.authz_can_create_carrera_catalog(facultad_id, nivel::text)
);

create policy carreras_update_by_academic_catalog_scope
on public.carreras
for update
to authenticated
using (public.authz_can_manage_carrera_catalog(id))
with check (public.authz_can_manage_carrera_catalog(id));

drop policy if exists facultades_update_by_catalogos on public.facultades;

create policy facultades_update_by_academic_catalog_scope
on public.facultades
for update
to authenticated
using (public.authz_can_manage_facultad_catalog(id))
with check (public.authz_can_manage_facultad_catalog(id));

revoke all on function private.authz_claim_has_facultad_scope(uuid)
from public, anon;
revoke all on function private.authz_claim_has_carrera_scope(uuid)
from public, anon;

revoke all on function public.authz_can_manage_facultad_catalog(uuid)
from public, anon;
revoke all on function public.authz_can_create_carrera_catalog(uuid, text)
from public, anon;
revoke all on function public.authz_can_manage_carrera_catalog(uuid)
from public, anon;
revoke all on function public.authz_can_list_plan_catalog_for_facultad(uuid)
from public, anon;
revoke all on function public.planes_catalogo_buscar(
  text,
  uuid,
  uuid,
  uuid,
  text,
  boolean,
  integer,
  integer
)
from public, anon;
revoke all on function public.facultades_guard_scoped_catalog_update()
from public, anon;
revoke all on function public.carreras_guard_scoped_catalog_update()
from public, anon;

grant execute on function public.authz_can_manage_facultad_catalog(uuid)
to authenticated, service_role;
grant execute on function public.authz_can_create_carrera_catalog(uuid, text)
to authenticated, service_role;
grant execute on function public.authz_can_manage_carrera_catalog(uuid)
to authenticated, service_role;
grant execute on function public.authz_can_list_plan_catalog_for_facultad(uuid)
to authenticated, service_role;
grant execute on function public.planes_catalogo_buscar(
  text,
  uuid,
  uuid,
  uuid,
  text,
  boolean,
  integer,
  integer
)
to authenticated, service_role;
grant execute on function public.facultades_guard_scoped_catalog_update()
to authenticated, service_role;
grant execute on function public.carreras_guard_scoped_catalog_update()
to authenticated, service_role;
