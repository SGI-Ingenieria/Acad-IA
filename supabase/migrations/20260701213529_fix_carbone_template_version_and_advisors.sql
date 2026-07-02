-- Keep the catalog search callable from the public API without exposing a
-- SECURITY DEFINER function directly through /rest/v1/rpc.

-- El esquema ya existe (creado en la migración base v2.0); silenciamos el
-- NOTICE 42P06 "schema already exists, skipping" que emite create ... if not exists.
set client_min_messages = warning;

create schema if not exists private;

grant usage on schema private to authenticated, service_role;

create or replace function private.catalogo_asignaturas_buscar(
  p_q text default null,
  p_facultad_id uuid default null,
  p_carrera_id uuid default null,
  p_plan_estudio_id uuid default null,
  p_tipo public.tipo_asignatura default null,
  p_estado public.estado_asignatura default null,
  p_incluir_archivadas boolean default false,
  p_limit int default 20,
  p_offset int default 0
) returns table (
  asignatura_id uuid,
  plan_estudio_id uuid,
  codigo text,
  nombre text,
  tipo public.tipo_asignatura,
  estado public.estado_asignatura,
  creditos numeric,
  numero_ciclo int,
  plan_nombre text,
  carrera_id uuid,
  carrera_nombre text,
  facultad_id uuid,
  facultad_nombre text,
  responsables jsonb,
  motivos_acceso jsonb,
  rank real,
  total_count bigint
)
  language plpgsql
  stable
  security definer
  set search_path to public, private, auth, extensions, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_is_global boolean := public.authz_has_global_scope();
  v_facultades uuid[];
  v_carreras uuid[];
  v_tsq tsquery := public.build_asignaturas_prefix_tsquery(p_q);
  v_limit int := greatest(1, least(coalesce(p_limit, 20), 100));
  v_offset int := greatest(0, coalesce(p_offset, 0));
begin
  if v_uid is null then
    return;
  end if;

  if not (
    public.authz_has_permission('asignaturas.ver')
    or public.authz_has_permission('planes.ver')
  ) then
    return;
  end if;

  select coalesce(array_agg((value)::uuid), '{}')
  into v_facultades
  from jsonb_array_elements_text(
    coalesce(auth.jwt() #> '{app_metadata,alcances,facultades}', '[]'::jsonb)
  ) as t(value);

  select coalesce(array_agg((value)::uuid), '{}')
  into v_carreras
  from jsonb_array_elements_text(
    coalesce(auth.jwt() #> '{app_metadata,alcances,carreras}', '[]'::jsonb)
  ) as t(value);

  return query
  with visibles as (
    select
      a.id,
      a.plan_estudio_id,
      a.codigo,
      a.nombre,
      a.tipo,
      a.estado,
      a.creditos,
      a.numero_ciclo,
      pe.nombre as plan_nombre,
      c.id as carrera_id,
      c.nombre as carrera_nombre,
      f.id as facultad_id,
      f.nombre as facultad_nombre,
      coalesce(ts_rank(a.search_vector, v_tsq), 0)::real as rank
    from public.asignaturas a
    join public.planes_estudio pe on pe.id = a.plan_estudio_id
    join public.carreras c on c.id = pe.carrera_id
    join public.facultades f on f.id = c.facultad_id
    where
      (
        public.authz_can_access_plan(a.plan_estudio_id)
        or public.authz_is_responsable_asignatura(a.id)
      )
      and (v_tsq is null or a.search_vector @@ v_tsq)
      and (p_facultad_id is null or c.facultad_id = p_facultad_id)
      and (p_carrera_id is null or pe.carrera_id = p_carrera_id)
      and (p_plan_estudio_id is null or a.plan_estudio_id = p_plan_estudio_id)
      and (p_tipo is null or a.tipo = p_tipo)
      and (p_estado is null or a.estado = p_estado)
      and (
        p_incluir_archivadas
        or p_estado is not null
        or a.estado <> 'archivada'
      )
  )
  select
    v.id,
    v.plan_estudio_id,
    v.codigo,
    v.nombre,
    v.tipo,
    v.estado,
    v.creditos,
    v.numero_ciclo,
    v.plan_nombre,
    v.carrera_id,
    v.carrera_nombre,
    v.facultad_id,
    v.facultad_nombre,
    coalesce(resp.responsables, '[]'::jsonb) as responsables,
    coalesce(mot.motivos, '[]'::jsonb) as motivos_acceso,
    v.rank,
    count(*) over () as total_count
  from visibles v
  left join lateral (
    select jsonb_agg(
             jsonb_build_object(
               'usuario_id', ra.usuario_id,
               'rol', ra.rol,
               'nombre', ua.nombre_completo
             )
             order by ra.rol, ua.nombre_completo
           ) as responsables
    from public.responsables_asignatura ra
    left join public.usuarios_app ua on ua.id = ra.usuario_id
    where ra.asignatura_id = v.id
  ) resp on true
  left join lateral (
    select jsonb_agg(m.motivo order by m.orden) as motivos
    from (
      select 0 as orden,
             jsonb_build_object('tipo', 'global', 'label', 'Visible globalmente') as motivo
      where v_is_global
      union all
      select 1,
             jsonb_build_object('tipo', 'facultad', 'label', 'Visible por facultad')
      where not v_is_global and v.facultad_id = any (v_facultades)
      union all
      select 2,
             jsonb_build_object('tipo', 'carrera', 'label', 'Visible por carrera')
      where not v_is_global and v.carrera_id = any (v_carreras)
      union all
      select 3,
             jsonb_build_object('tipo', 'experto', 'label', 'Visible como experto invitado')
      where not v_is_global
        and exists (
          select 1
          from public.plan_expertos px
          join public.expertos e on e.id = px.experto_id
          where px.plan_estudio_id = v.plan_estudio_id
            and e.usuario_id = v_uid
        )
      union all
      select 4,
             jsonb_build_object(
               'tipo', 'responsable_asignatura',
               'rol', ra.rol,
               'label',
               case ra.rol
                 when 'PROFESOR_RESPONSABLE' then 'Asignada como Profesor responsable'
                 when 'COAUTOR' then 'Asignada como Coautor'
                 when 'REVISOR' then 'Asignada como Revisor'
                 else 'Asignada'
               end
             )
      from public.responsables_asignatura ra
      where ra.asignatura_id = v.id
        and ra.usuario_id = v_uid
    ) m
  ) mot on true
  order by
    (case when v_tsq is not null then v.rank else 0 end) desc,
    v.nombre asc
  limit v_limit
  offset v_offset;
end;
$$;

alter function private.catalogo_asignaturas_buscar(
  text, uuid, uuid, uuid,
  public.tipo_asignatura, public.estado_asignatura,
  boolean, int, int
) owner to postgres;

revoke all on function private.catalogo_asignaturas_buscar(
  text, uuid, uuid, uuid,
  public.tipo_asignatura, public.estado_asignatura,
  boolean, int, int
) from public, anon;

grant execute on function private.catalogo_asignaturas_buscar(
  text, uuid, uuid, uuid,
  public.tipo_asignatura, public.estado_asignatura,
  boolean, int, int
) to authenticated, service_role;

create or replace function public.catalogo_asignaturas_buscar(
  p_q text default null,
  p_facultad_id uuid default null,
  p_carrera_id uuid default null,
  p_plan_estudio_id uuid default null,
  p_tipo public.tipo_asignatura default null,
  p_estado public.estado_asignatura default null,
  p_incluir_archivadas boolean default false,
  p_limit int default 20,
  p_offset int default 0
) returns table (
  asignatura_id uuid,
  plan_estudio_id uuid,
  codigo text,
  nombre text,
  tipo public.tipo_asignatura,
  estado public.estado_asignatura,
  creditos numeric,
  numero_ciclo int,
  plan_nombre text,
  carrera_id uuid,
  carrera_nombre text,
  facultad_id uuid,
  facultad_nombre text,
  responsables jsonb,
  motivos_acceso jsonb,
  rank real,
  total_count bigint
)
  language sql
  stable
  security invoker
  set search_path to public, private, auth, extensions, pg_temp
as $$
  select *
  from private.catalogo_asignaturas_buscar(
    p_q,
    p_facultad_id,
    p_carrera_id,
    p_plan_estudio_id,
    p_tipo,
    p_estado,
    p_incluir_archivadas,
    p_limit,
    p_offset
  );
$$;

alter function public.catalogo_asignaturas_buscar(
  text, uuid, uuid, uuid,
  public.tipo_asignatura, public.estado_asignatura,
  boolean, int, int
) owner to postgres;

revoke all on function public.catalogo_asignaturas_buscar(
  text, uuid, uuid, uuid,
  public.tipo_asignatura, public.estado_asignatura,
  boolean, int, int
) from public, anon;

grant execute on function public.catalogo_asignaturas_buscar(
  text, uuid, uuid, uuid,
  public.tipo_asignatura, public.estado_asignatura,
  boolean, int, int
) to authenticated, service_role;
