BEGIN;

SELECT plan(6);

SELECT has_function(
  'public',
  'inicio_workspace',
  ARRAY['text', 'uuid', 'uuid'],
  'el dashboard usa la RPC agregada del espacio de trabajo'
);

SELECT has_function(
  'public',
  'inicio_workspace_base',
  ARRAY['text', 'uuid', 'uuid'],
  'la ampliación preserva la agregación previa como base'
);

SELECT ok(
  pg_get_functiondef('public.inicio_workspace_dashboard_base(text,uuid,uuid)'::regprocedure)
    LIKE '%''progreso''%',
  'la RPC expone el progreso accionable'
);

SELECT ok(
  pg_get_functiondef('public.inicio_workspace_dashboard_base(text,uuid,uuid)'::regprocedure)
    LIKE '%La asignatura no tiene contenido temático.%'
    AND pg_get_functiondef('public.inicio_workspace_dashboard_base(text,uuid,uuid)'::regprocedure)
      LIKE '%La asignatura no tiene criterios de evaluación.%',
  'la RPC incluye hallazgos de contenido y evaluación'
);

SELECT ok(
  pg_get_functiondef('public.inicio_workspace_editable_base(text,uuid,uuid)'::regprocedure)
    LIKE '%planNombre%'
    AND pg_get_functiondef('public.inicio_workspace_editable_base(text,uuid,uuid)'::regprocedure)
      LIKE '%planes_estudio%',
  'el RPC enriquece los pendientes con el nombre de su plan'
);

SELECT ok(
  pg_get_functiondef('public.inicio_workspace(text,uuid,uuid)'::regprocedure)
    LIKE '%authz_plan_write_allowed%'
    AND pg_get_functiondef('public.inicio_workspace(text,uuid,uuid)'::regprocedure)
      LIKE '%descartado_en%'
    AND pg_get_functiondef('public.inicio_workspace(text,uuid,uuid)'::regprocedure)
      LIKE '%authz_asignatura_write_allowed%'
    AND pg_get_functiondef('public.inicio_workspace(text,uuid,uuid)'::regprocedure)
      LIKE '%authz_asignatura_content_write_allowed%',
  'el workspace limita planes editables y pendientes a los permisos vigentes'
);

SELECT * FROM finish();
ROLLBACK;
