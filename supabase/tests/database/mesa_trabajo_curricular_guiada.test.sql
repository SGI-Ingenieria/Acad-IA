BEGIN;

SELECT plan(9);

SELECT has_column(
  'public',
  'estructuras_plan',
  'estado_publicacion',
  'las estructuras tienen estado de publicación'
);

SELECT has_column(
  'public',
  'planes_estudio',
  'fase_diseno',
  'los planes conservan una fase curricular durable'
);

SELECT has_column(
  'public',
  'lineas_plan',
  'aporte_perfil_egreso',
  'bloques y líneas comparten metadatos conceptuales'
);

SELECT has_table(
  'public',
  'borradores_diseno_plan',
  'existen borradores previos a la creación del plan'
);

SELECT has_table(
  'public',
  'guias_usuario',
  'el progreso de recorridos se conserva por usuario'
);

SELECT has_function(
  'public',
  'inicio_mesa_trabajo',
  ARRAY['text', 'uuid', 'uuid'],
  'la portada usa una RPC agregada'
);

CREATE TEMP TABLE versiones_prueba (
  anterior uuid,
  vigente uuid
);

WITH anterior AS (
  INSERT INTO public.estructuras_plan (
    nombre,
    tipo,
    definicion,
    autoridad_normativa,
    etiqueta_version,
    aplicable_desde,
    aplicable_hasta,
    estado_publicacion
  ) VALUES (
    'Prueba normativa anterior',
    'CURRICULAR',
    '{"type":"object","properties":{"ingreso":{"x-acad-ia.semantic-key":"perfil_ingreso"},"egreso":{"x-acad-ia.semantic-key":"perfil_egreso"},"fines":{"x-acad-ia.semantic-key":"fines_aprendizaje"}}}'::jsonb,
    'Autoridad de prueba',
    'Anterior',
    DATE '2020-01-01',
    DATE '2023-12-31',
    'PUBLICADA'
  )
  RETURNING id
), vigente AS (
  INSERT INTO public.estructuras_plan (
    nombre,
    tipo,
    definicion,
    autoridad_normativa,
    etiqueta_version,
    aplicable_desde,
    aplicable_hasta,
    estado_publicacion
  ) VALUES (
    'Prueba normativa vigente',
    'CURRICULAR',
    '{"type":"object","properties":{"ingreso":{"x-acad-ia.semantic-key":"perfil_ingreso"},"egreso":{"x-acad-ia.semantic-key":"perfil_egreso"},"fines":{"x-acad-ia.semantic-key":"fines_aprendizaje"}}}'::jsonb,
    'Autoridad de prueba',
    'Vigente',
    DATE '2024-01-01',
    NULL,
    'PUBLICADA'
  )
  RETURNING id
)
INSERT INTO versiones_prueba
SELECT anterior.id, vigente.id FROM anterior, vigente;

SELECT is(
  public.recomendar_estructura_plan('CURRICULAR', DATE '2023-12-31'),
  (SELECT anterior FROM versiones_prueba),
  'la recomendación incluye el último día de vigencia'
);

SELECT is(
  public.recomendar_estructura_plan('CURRICULAR', DATE '2024-01-01'),
  (SELECT vigente FROM versiones_prueba),
  'la recomendación cambia en el primer día de la nueva vigencia'
);

SELECT throws_ok(
  $$
    INSERT INTO public.estructuras_plan (
      nombre,
      tipo,
      definicion,
      autoridad_normativa,
      etiqueta_version,
      estado_publicacion
    ) VALUES (
      'Publicación inválida',
      'CURRICULAR',
      '{"type":"object","properties":{}}'::jsonb,
      'Autoridad de prueba',
      'Inválida',
      'PUBLICADA'
    )
  $$,
  '23514',
  'Una estructura curricular publicada debe mapear perfil de ingreso, perfil de egreso y fines de aprendizaje.',
  'no se publica una estructura curricular sin los tres fundamentos'
);

SELECT * FROM finish();
ROLLBACK;
