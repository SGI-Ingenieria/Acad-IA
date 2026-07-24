-- Sincroniza la RPC del catálogo de asignaturas con el orden elegido en la UI.
drop function if exists public.catalogo_asignaturas_buscar(
  text,
  uuid,
  uuid,
  uuid,
  public.tipo_asignatura,
  public.estado_asignatura,
  boolean,
  integer,
  integer
);

create function public.catalogo_asignaturas_buscar(
  p_q text default null,
  p_facultad_id uuid default null,
  p_carrera_id uuid default null,
  p_plan_estudio_id uuid default null,
  p_tipo public.tipo_asignatura default null,
  p_estado public.estado_asignatura default null,
  p_incluir_archivadas boolean default false,
  p_sort text default 'relevancia',
  p_limit integer default 20,
  p_offset integer default 0
)
returns table(
  asignatura_id uuid,
  plan_estudio_id uuid,
  codigo text,
  nombre text,
  tipo public.tipo_asignatura,
  estado public.estado_asignatura,
  creditos numeric,
  numero_ciclo integer,
  plan_nombre text,
  plan_tipo_estructura public.tipo_estructura_plan,
  carrera_id uuid,
  carrera_nombre text,
  carrera_nivel public.nivel_plan_estudio,
  facultad_id uuid,
  facultad_nombre text,
  facultad_nombre_corto text,
  facultad_prefijo text,
  facultad_color text,
  facultad_icono text,
  responsables jsonb,
  motivos_acceso jsonb,
  rank real,
  total_count bigint
)
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  v_uid uuid := auth.uid();
  v_is_global boolean := public.authz_has_global_scope();
  v_facultades uuid[];
  v_carreras uuid[];
  v_tsq tsquery := public.build_asignaturas_prefix_tsquery(p_q);
  v_sort text := case
    when p_sort in (
      'relevancia',
      'curricular',
      'nombre_asc',
      'nombre_desc',
      'ciclo_asc',
      'creditos_desc'
    ) then p_sort
    else 'relevancia'
  end;
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
      a.orden_celda,
      pe.nombre_display as plan_nombre,
      ep.tipo as plan_tipo_estructura,
      c.id as carrera_id,
      c.nombre as carrera_nombre,
      c.nivel as carrera_nivel,
      f.id as facultad_id,
      f.nombre as facultad_nombre,
      f.nombre_corto as facultad_nombre_corto,
      f.prefijo as facultad_prefijo,
      f.color as facultad_color,
      f.icono as facultad_icono,
      coalesce(ts_rank(a.search_vector, v_tsq), 0)::real as rank
    from public.asignaturas a
    join public.planes_estudio pe on pe.id = a.plan_estudio_id
    join public.estructuras_plan ep on ep.id = pe.estructura_id
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
    v.plan_tipo_estructura,
    v.carrera_id,
    v.carrera_nombre,
    v.carrera_nivel,
    v.facultad_id,
    v.facultad_nombre,
    v.facultad_nombre_corto,
    v.facultad_prefijo,
    v.facultad_color,
    v.facultad_icono,
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
      select
        0 as orden,
        jsonb_build_object(
          'tipo', 'global', 'label', 'Visible globalmente'
        ) as motivo
      where v_is_global
      union all
      select
        1,
        jsonb_build_object(
          'tipo', 'facultad', 'label', 'Visible por facultad'
        )
      where not v_is_global and v.facultad_id = any (v_facultades)
      union all
      select
        2,
        jsonb_build_object(
          'tipo', 'carrera', 'label', 'Visible por carrera'
        )
      where not v_is_global and v.carrera_id = any (v_carreras)
      union all
      select
        3,
        jsonb_build_object(
          'tipo', 'experto', 'label', 'Visible como experto invitado'
        )
      where not v_is_global
        and exists (
          select 1
          from public.plan_expertos px
          join public.expertos e on e.id = px.experto_id
          where px.plan_estudio_id = v.plan_estudio_id
            and e.usuario_id = v_uid
        )
      union all
      select
        4,
        jsonb_build_object(
          'tipo', 'responsable_asignatura',
          'rol', ra.rol,
          'label', case ra.rol
            when 'PROFESOR_RESPONSABLE'
              then 'Asignada como Profesor responsable'
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
    case
      when v_sort = 'relevancia' and v_tsq is not null then v.rank
    end desc nulls last,
    case
      when v_sort = 'curricular' then lower(v.plan_nombre)
    end asc nulls last,
    case
      when v_sort in ('curricular', 'ciclo_asc') then v.numero_ciclo
    end asc nulls last,
    case
      when v_sort = 'curricular' then v.orden_celda
    end asc nulls last,
    case
      when v_sort = 'nombre_asc' then lower(v.nombre)
    end asc nulls last,
    case
      when v_sort = 'nombre_desc' then lower(v.nombre)
    end desc nulls last,
    case
      when v_sort = 'creditos_desc' then v.creditos
    end desc nulls last,
    lower(v.nombre) asc,
    v.id
  limit v_limit
  offset v_offset;
end;
$$;

revoke all on function public.catalogo_asignaturas_buscar(
  text,
  uuid,
  uuid,
  uuid,
  public.tipo_asignatura,
  public.estado_asignatura,
  boolean,
  text,
  integer,
  integer
) from public;

grant all on function public.catalogo_asignaturas_buscar(
  text,
  uuid,
  uuid,
  uuid,
  public.tipo_asignatura,
  public.estado_asignatura,
  boolean,
  text,
  integer,
  integer
) to authenticated;

grant all on function public.catalogo_asignaturas_buscar(
  text,
  uuid,
  uuid,
  uuid,
  public.tipo_asignatura,
  public.estado_asignatura,
  boolean,
  text,
  integer,
  integer
) to service_role;
