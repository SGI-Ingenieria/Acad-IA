-- El tipo de estructura forma parte del catálogo paginado para que el conteo
-- y la paginación sigan siendo autoritativos al filtrar la lista de planes.

drop function if exists public.planes_catalogo_buscar(
  text, uuid, uuid, uuid, text, boolean, text, integer, integer
);

create function public.planes_catalogo_buscar(
  p_search text default null,
  p_facultad_id uuid default null,
  p_carrera_id uuid default null,
  p_estado_id uuid default null,
  p_nivel text default null,
  p_activo boolean default null,
  p_sort text default 'creado_desc',
  p_limit integer default 50,
  p_offset integer default 0,
  p_tipo_estructura public.tipo_estructura_plan default null
) returns table(
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
set search_path to 'public', 'private', 'auth', 'extensions', 'pg_temp'
as $$
  with normalized as (
    select
      lower(public.unaccent_immutable(btrim(coalesce(p_search, '')))) as search_term,
      nullif(btrim(coalesce(p_nivel, '')), '') as nivel_term,
      case
        when p_sort in (
          'creado_desc',
          'actualizado_desc',
          'nombre_asc',
          'nombre_desc'
        ) then p_sort
        else 'creado_desc'
      end as sort_term,
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
      and (p_tipo_estructura is null or eplan.tipo = p_tipo_estructura)
      and (
        n.nivel_term is null
        or lower(public.unaccent_immutable(c.nivel::text))
          = lower(public.unaccent_immutable(n.nivel_term))
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
  order by
    case when n.sort_term = 'creado_desc'
      then (filtered.pe).creado_en end desc nulls last,
    case when n.sort_term = 'actualizado_desc'
      then (filtered.pe).actualizado_en end desc nulls last,
    case when n.sort_term = 'nombre_asc'
      then (filtered.pe).nombre_search end asc nulls last,
    case when n.sort_term = 'nombre_desc'
      then (filtered.pe).nombre_search end desc nulls last,
    (filtered.pe).id asc
  limit (select safe_limit from normalized)
  offset (select safe_offset from normalized);
$$;

alter function public.planes_catalogo_buscar(
  text, uuid, uuid, uuid, text, boolean, text, integer, integer,
  public.tipo_estructura_plan
) owner to postgres;
revoke all on function public.planes_catalogo_buscar(
  text, uuid, uuid, uuid, text, boolean, text, integer, integer,
  public.tipo_estructura_plan
) from public;
grant execute on function public.planes_catalogo_buscar(
  text, uuid, uuid, uuid, text, boolean, text, integer, integer,
  public.tipo_estructura_plan
) to authenticated, service_role;
