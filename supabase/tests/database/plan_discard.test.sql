BEGIN;

SELECT plan(7);

SELECT has_column(
  'public', 'planes_estudio', 'descartado_en',
  'planes_estudio registra cuándo se descarta un plan'
);

SELECT has_column(
  'public', 'planes_estudio', 'descartado_por',
  'planes_estudio registra quién descartó el plan'
);

SELECT has_index(
  'public', 'planes_estudio', 'planes_estudio_descartado_en_idx',
  'los descartados tienen un índice de consulta'
);

SELECT ok(
  pg_get_functiondef('public.authz_plan_write_allowed(uuid)'::regprocedure)
    LIKE '%descartado_en IS NULL%',
  'la autorización de escritura bloquea los planes descartados'
);

SELECT ok(
  pg_get_functiondef('public.planes_catalogo_buscar_versiones(text,uuid,uuid,uuid,text,boolean,text,integer,integer,public.tipo_estructura_plan,text)'::regprocedure)
    LIKE '%descartados%',
  'el catálogo expone el filtro de descartados'
);

SELECT ok(
  pg_get_functiondef('private.transiciones_permitidas_plan(uuid)'::regprocedure)
    LIKE '%descartado_en IS NULL%',
  'un plan descartado no ofrece transiciones'
);

SELECT ok(
  pg_get_functiondef('private.usuario_puede_comentar_plan(uuid,uuid)'::regprocedure)
    LIKE '%descartado_en IS NULL%',
  'un plan descartado no admite comentarios nuevos'
);

SELECT * FROM finish();

ROLLBACK;
