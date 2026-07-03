BEGIN;

SELECT plan(20);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_extension e
    JOIN pg_namespace n ON n.oid = e.extnamespace
    WHERE e.extname = 'pg_jsonschema'
      AND n.nspname = 'extensions'
  ),
  'pg_jsonschema extension is enabled in extensions schema'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM public.permisos
    WHERE clave = 'planes.campos_restringidos.editar'
  ),
  'restricted field edit permission exists'
);

SELECT has_column(
  'public',
  'estados_plan',
  'es_campo_editable',
  'estados_plan has es_campo_editable column'
);

SELECT ok(
  NOT EXISTS (
    SELECT 1
    FROM public.estados_plan
    WHERE es_final = true AND es_campo_editable = true
  ),
  'estados finales no son editables como campo restringido'
);

SELECT has_column(
  'public',
  'estructuras_asignatura',
  'estructura_plan_id',
  'subject structures point to a plan structure'
);

SELECT ok(
  (
    SELECT attnotnull
    FROM pg_attribute
    WHERE attrelid = 'public.estructuras_asignatura'::regclass
      AND attname = 'estructura_plan_id'
  ),
  'estructuras_asignatura.estructura_plan_id is required'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.estructuras_asignatura'::regclass
      AND conname = 'estructuras_asignatura_estructura_plan_id_fkey'
      AND contype = 'f'
  ),
  'estructuras_asignatura has FK to estructuras_plan'
);

SELECT ok(
  (
    SELECT attnotnull
    FROM pg_attribute
    WHERE attrelid = 'public.asignaturas'::regclass
      AND attname = 'estructura_id'
  ),
  'asignaturas.estructura_id is required'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgrelid = 'public.asignaturas'::regclass
      AND tgname = 'aa_validar_asignatura_estructura_plan'
      AND NOT tgisinternal
  ),
  'asignatura child structure trigger exists'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgrelid = 'public.planes_estudio'::regclass
      AND tgname = 'aa_validar_datos_plan'
      AND NOT tgisinternal
  ),
  'plan datos validation trigger exists'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgrelid = 'public.asignaturas'::regclass
      AND tgname = 'aa_validar_datos_asignatura'
      AND NOT tgisinternal
  ),
  'subject datos validation trigger exists'
);

SELECT is(
  (
    SELECT count(*)::integer
    FROM unnest(ARRAY[
      'datos_validos_con_definicion',
      'json_schema_parcial_definicion',
      'normalizar_datos_por_definicion',
      'usuario_puede_editar_campo_plan',
      'usuario_puede_editar_campo_asignatura',
      'authz_campo_plan_write_allowed',
      'authz_campo_asignatura_write_allowed'
    ]) AS fn(proname)
    WHERE EXISTS (
      SELECT 1
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND p.proname = fn.proname
    )
  ),
  7,
  'restricted field helper functions exist'
);

SELECT ok(
  pg_get_functiondef('public.datos_validos_con_definicion(jsonb,jsonb)'::regprocedure)
    LIKE '%jsonb_matches_schema%',
  'datos validator uses pg_jsonschema'
);

SELECT ok(
  public.datos_validos_con_definicion(
    '{"type":"object","required":["a"],"properties":{"a":{"type":"integer"}},"additionalProperties":false}'::jsonb,
    '{}'::jsonb
  ),
  'partial schema allows missing required field'
);

SELECT ok(
  NOT public.datos_validos_con_definicion(
    '{"type":"object","properties":{"a":{"type":"integer"}},"additionalProperties":false}'::jsonb,
    '{"b":1}'::jsonb
  ),
  'partial schema rejects unknown keys'
);

SELECT is(
  jsonb_typeof(
    public.normalizar_datos_por_definicion(
      '{"a":"42"}'::jsonb,
      '{"type":"object","properties":{"a":{"type":"integer"}}}'::jsonb,
      false
    )->'a'
  ),
  'number',
  'numeric strings are normalized to JSON numbers'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'planes_estudio'
      AND policyname = 'planes_estudio_update_by_scope'
      AND coalesce(with_check, '') LIKE '%authz_plan_restricted_field_write_allowed%'
  ),
  'plans have restricted field update policy'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'asignaturas'
      AND policyname = 'asignaturas_update_by_scope'
      AND coalesce(with_check, '') LIKE '%authz_asignatura_restricted_field_write_allowed%'
  ),
  'subjects have restricted field update policy'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'borradores_campo'
      AND policyname = 'borradores_campo_update_by_scope'
      AND coalesce(with_check, '') LIKE '%authz_campo_plan_write_allowed%'
      AND coalesce(with_check, '') LIKE '%authz_campo_asignatura_write_allowed%'
  ),
  'field drafts use field-level write helpers'
);

SELECT ok(
  pg_get_functiondef('public.fn_validar_asignatura_estructura_plan()'::regprocedure)
    LIKE '%estructura_plan_id = pe.estructura_id%',
  'subject trigger validates child structure ownership'
);

SELECT * FROM finish();

ROLLBACK;
