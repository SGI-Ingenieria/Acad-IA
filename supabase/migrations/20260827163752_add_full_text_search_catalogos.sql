-- Los catálogos se consultan como typeahead. Centralizamos la construcción de
-- prefijos para que planes y asignaturas compartan la misma normalización.
CREATE OR REPLACE FUNCTION public.construir_tsquery_prefijos(
  p_busqueda text
) RETURNS tsquery
    LANGUAGE plpgsql STABLE
    SET search_path TO 'public', 'private', 'auth', 'extensions', 'pg_temp'
    AS $$
declare
  cleaned text;
  tokens text[];
  query_text text;
begin
  cleaned := trim(coalesce(p_busqueda, ''));

  if cleaned = '' then
    return null;
  end if;

  cleaned := lower(extensions.unaccent(cleaned));
  cleaned := regexp_replace(cleaned, '[^[:alnum:][:space:]]+', ' ', 'g');
  cleaned := regexp_replace(cleaned, '[[:space:]]+', ' ', 'g');

  tokens := regexp_split_to_array(cleaned, '[[:space:]]+');

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

ALTER FUNCTION public.construir_tsquery_prefijos(text) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.construir_tsquery_prefijos(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.construir_tsquery_prefijos(text)
  TO anon, authenticated, service_role;

COMMENT ON FUNCTION public.construir_tsquery_prefijos(text) IS
  'Construye una tsquery por prefijos, insensible a acentos, para los catálogos académicos.';

CREATE OR REPLACE FUNCTION public.build_asignaturas_prefix_tsquery(
  p_search text
) RETURNS tsquery
    LANGUAGE sql STABLE
    SET search_path TO 'public', 'private', 'auth', 'extensions', 'pg_temp'
    AS $$
  select public.construir_tsquery_prefijos(p_search);
$$;

ALTER FUNCTION public.build_asignaturas_prefix_tsquery(text) OWNER TO postgres;

ALTER TABLE public.planes_estudio
  ADD COLUMN search_vector tsvector
  GENERATED ALWAYS AS (
    to_tsvector(
      'public.es_simple_unaccent',
      coalesce(nombre_display, '')
    )
  ) STORED;

CREATE INDEX planes_estudio_search_vector_gin_idx
  ON public.planes_estudio
  USING gin (search_vector);

CREATE OR REPLACE FUNCTION public.planes_catalogo_buscar(
  p_search text DEFAULT NULL::text,
  p_facultad_id uuid DEFAULT NULL::uuid,
  p_carrera_id uuid DEFAULT NULL::uuid,
  p_estado_id uuid DEFAULT NULL::uuid,
  p_nivel text DEFAULT NULL::text,
  p_activo boolean DEFAULT NULL::boolean,
  p_sort text DEFAULT 'creado_desc'::text,
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0,
  p_tipo_estructura public.tipo_estructura_plan DEFAULT NULL::public.tipo_estructura_plan
) RETURNS TABLE(
  plan jsonb,
  carrera jsonb,
  facultad jsonb,
  estructura_plan jsonb,
  estado_plan jsonb,
  puede_abrir_detalle boolean,
  total_count bigint
)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'private', 'auth', 'extensions', 'pg_temp'
    AS $$
  with normalized as (
    select
      public.construir_tsquery_prefijos(p_search) as search_query,
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
      and (n.search_query is null or pe.search_vector @@ n.search_query)
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

ALTER FUNCTION public.planes_catalogo_buscar(
  text, uuid, uuid, uuid, text, boolean, text, integer, integer,
  public.tipo_estructura_plan
) OWNER TO postgres;

CREATE OR REPLACE FUNCTION public.planes_catalogo_buscar_versiones(
  p_search text DEFAULT NULL::text,
  p_facultad_id uuid DEFAULT NULL::uuid,
  p_carrera_id uuid DEFAULT NULL::uuid,
  p_estado_id uuid DEFAULT NULL::uuid,
  p_nivel text DEFAULT NULL::text,
  p_activo boolean DEFAULT NULL::boolean,
  p_sort text DEFAULT 'creado_desc'::text,
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0,
  p_tipo_estructura public.tipo_estructura_plan DEFAULT NULL::public.tipo_estructura_plan,
  p_modo_version text DEFAULT 'actuales'::text
) RETURNS TABLE(
  plan jsonb,
  carrera jsonb,
  facultad jsonb,
  estructura_plan jsonb,
  estado_plan jsonb,
  puede_abrir_detalle boolean,
  total_count bigint
)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'private', 'auth', 'extensions', 'pg_temp'
    AS $$
  with normalized as (
    select
      public.construir_tsquery_prefijos(p_search) as search_query,
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
      greatest(0, coalesce(p_offset, 0)) as safe_offset,
      case
        when p_modo_version in ('actuales', 'antecedentes', 'todos')
          then p_modo_version
        else 'actuales'
      end as version_term
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
      and (n.search_query is null or pe.search_vector @@ n.search_query)
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
      and (
        n.version_term = 'todos'
        or (n.version_term = 'antecedentes'
          and pe.rol_version_plan = 'ANTECEDENTE')
        or (n.version_term = 'actuales'
          and pe.rol_version_plan <> 'ANTECEDENTE')
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

ALTER FUNCTION public.planes_catalogo_buscar_versiones(
  text, uuid, uuid, uuid, text, boolean, text, integer, integer,
  public.tipo_estructura_plan, text
) OWNER TO postgres;

CREATE OR REPLACE FUNCTION public.buscar_asignaturas_simulacion(
  p_search text DEFAULT NULL::text,
  p_limit integer DEFAULT 20
) RETURNS TABLE(
  id uuid,
  nombre text,
  codigo text,
  plan_estudio_id uuid,
  plan_nombre text,
  carrera_id uuid,
  carrera_nombre text,
  facultad_id uuid,
  facultad_nombre text
)
    LANGUAGE sql STABLE
    SET search_path TO 'public', 'private', 'auth', 'extensions', 'pg_temp'
    AS $$
  with normalized as (
    select
      public.construir_tsquery_prefijos(p_search) as search_query,
      greatest(1, least(coalesce(p_limit, 20), 50)) as safe_limit
  ),
  resultados as (
    select
      a.id,
      a.nombre,
      a.codigo,
      a.plan_estudio_id,
      pe.nombre_display as plan_nombre,
      c.id as carrera_id,
      c.nombre as carrera_nombre,
      f.id as facultad_id,
      f.nombre as facultad_nombre,
      coalesce(ts_rank(a.search_vector, n.search_query), 0)::real as rank
    from public.asignaturas a
    join public.planes_estudio pe on pe.id = a.plan_estudio_id
    join public.carreras c on c.id = pe.carrera_id
    join public.facultades f on f.id = c.facultad_id
    cross join normalized n
    where n.search_query is null or a.search_vector @@ n.search_query
  )
  select
    r.id,
    r.nombre,
    r.codigo,
    r.plan_estudio_id,
    r.plan_nombre,
    r.carrera_id,
    r.carrera_nombre,
    r.facultad_id,
    r.facultad_nombre
  from resultados r
  cross join normalized n
  order by
    case when n.search_query is not null then r.rank end desc nulls last,
    lower(r.nombre) asc,
    r.id asc
  limit (select safe_limit from normalized);
$$;

ALTER FUNCTION public.buscar_asignaturas_simulacion(text, integer) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.buscar_asignaturas_simulacion(text, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.buscar_asignaturas_simulacion(text, integer)
  FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.buscar_asignaturas_simulacion(text, integer)
  TO service_role;

COMMENT ON FUNCTION public.buscar_asignaturas_simulacion(text, integer) IS
  'Resuelve el typeahead administrativo de asignaturas usando el índice FTS canónico.';
