begin;

select plan(12);

select has_column(
  'public',
  'planes_estudio',
  'search_vector',
  'planes_estudio mantiene un vector de búsqueda de texto completo'
);

select col_type_is(
  'public',
  'planes_estudio',
  'search_vector',
  'tsvector',
  'el vector de planes usa el tipo tsvector'
);

select has_index(
  'public',
  'planes_estudio',
  'planes_estudio_search_vector_gin_idx',
  'el vector de planes tiene un índice GIN'
);

select has_function(
  'public',
  'construir_tsquery_prefijos',
  array['text'],
  'la construcción de consultas FTS por prefijos se comparte entre catálogos'
);

select is(
  public.construir_tsquery_prefijos('Pedagogía infantil')::text,
  '''pedagogia'':* & ''infantil'':*',
  'la consulta de prefijos conserva palabras y elimina acentos'
);

select is(
  public.build_asignaturas_prefix_tsquery('Pedagogía infantil')::text,
  public.construir_tsquery_prefijos('Pedagogía infantil')::text,
  'asignaturas conserva la semántica de búsqueda tras centralizar el helper'
);

select ok(
  position(
    'pe.search_vector @@ n.search_query'
    in pg_get_functiondef(
      'public.planes_catalogo_buscar(text,uuid,uuid,uuid,text,boolean,text,integer,integer,public.tipo_estructura_plan)'::regprocedure
    )
  ) > 0,
  'el catálogo de planes filtra con Full-text search'
);

select ok(
  position(
    'pe.search_vector @@ n.search_query'
    in pg_get_functiondef(
      'public.planes_catalogo_buscar_versiones(text,uuid,uuid,uuid,text,boolean,text,integer,integer,public.tipo_estructura_plan,text)'::regprocedure
    )
  ) > 0,
  'el catálogo de planes por versión filtra con Full-text search'
);

select has_function(
  'public',
  'buscar_asignaturas_simulacion',
  array['text', 'integer'],
  'el selector de simulación tiene un RPC FTS dedicado'
);

select ok(
  position(
    'a.search_vector @@ n.search_query'
    in pg_get_functiondef(
      'public.buscar_asignaturas_simulacion(text,integer)'::regprocedure
    )
  ) > 0,
  'el RPC de simulación consulta el vector FTS de asignaturas'
);

select ok(
  has_function_privilege(
    'service_role',
    'public.buscar_asignaturas_simulacion(text,integer)',
    'EXECUTE'
  ),
  'el RPC de simulación queda disponible para el cliente de servicio'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'public.buscar_asignaturas_simulacion(text,integer)',
    'EXECUTE'
  ),
  'el RPC de simulación no queda expuesto al cliente autenticado'
);

select * from finish();

rollback;
