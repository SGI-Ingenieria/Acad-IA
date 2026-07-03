BEGIN;

SELECT plan(16);

-- ---------------------------------------------------------------------------
-- Estructura
-- ---------------------------------------------------------------------------
SELECT has_table(
  'public', 'lineas_curriculares_sugeridas',
  'lineas_curriculares_sugeridas table exists'
);
SELECT has_column(
  'public', 'lineas_curriculares_sugeridas', 'facultad_id',
  'lineas_curriculares_sugeridas.facultad_id exists'
);
SELECT has_column(
  'public', 'lineas_curriculares_sugeridas', 'nombre',
  'lineas_curriculares_sugeridas.nombre exists'
);
SELECT has_column(
  'public', 'lineas_curriculares_sugeridas', 'area',
  'lineas_curriculares_sugeridas.area exists'
);
SELECT has_column(
  'public', 'lineas_curriculares_sugeridas', 'orden',
  'lineas_curriculares_sugeridas.orden exists'
);
SELECT has_column(
  'public', 'lineas_curriculares_sugeridas', 'activa',
  'lineas_curriculares_sugeridas.activa exists'
);

SELECT ok(
  (SELECT relrowsecurity
     FROM pg_class
    WHERE oid = 'public.lineas_curriculares_sugeridas'::regclass),
  'lineas_curriculares_sugeridas has RLS enabled'
);

-- Índice único insensible a mayúsculas/acentos por facultad.
SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'lineas_curriculares_sugeridas'
      AND indexdef LIKE '%UNIQUE%'
      AND indexdef LIKE '%facultad_id%'
      AND indexdef LIKE '%lower(nombre)%'
  ),
  'unique index on (facultad_id, lower(nombre)) exists'
);

-- FK a facultades con borrado en cascada.
SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.lineas_curriculares_sugeridas'::regclass
      AND confrelid = 'public.facultades'::regclass
      AND contype = 'f'
      AND confdeltype = 'c'
  ),
  'facultad_id FK cascades on facultad delete'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgrelid = 'public.lineas_curriculares_sugeridas'::regclass
      AND tgname = 'trg_lineas_curriculares_sugeridas_actualizado_en'
  ),
  'actualizado_en is maintained by trigger'
);

-- ---------------------------------------------------------------------------
-- Políticas RLS (declarativas)
-- ---------------------------------------------------------------------------
SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'lineas_curriculares_sugeridas'
      AND policyname = 'lineas_curriculares_sugeridas_select_authenticated'
      AND cmd = 'SELECT'
  ),
  'authenticated read policy exists'
);
SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'lineas_curriculares_sugeridas'
      AND policyname IN (
        'lineas_curriculares_sugeridas_insert_by_catalogos',
        'lineas_curriculares_sugeridas_update_by_catalogos',
        'lineas_curriculares_sugeridas_delete_by_catalogos'
      )
      AND coalesce(with_check, '') LIKE '%catalogos.gestionar%'
  ),
  'management policy is gated by catalogos.gestionar'
);

-- ---------------------------------------------------------------------------
-- RLS funcional: una facultad de prueba y un usuario authenticated.
-- ---------------------------------------------------------------------------
INSERT INTO public.facultades (id, nombre)
VALUES ('11111111-1111-1111-1111-111111111111', 'Facultad de prueba pgTAP');

-- Usuario authenticated SIN el permiso de catálogos.
SET LOCAL role authenticated;
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000aa","app_metadata":{"permisos":[]}}',
  true
);

SELECT lives_ok(
  $$ SELECT 1 FROM public.lineas_curriculares_sugeridas $$,
  'authenticated can read suggestions'
);
SELECT throws_ok(
  $$ INSERT INTO public.lineas_curriculares_sugeridas (facultad_id, nombre)
     VALUES ('11111111-1111-1111-1111-111111111111', 'Sin permiso') $$,
  '42501',
  NULL,
  'insert is denied without catalogos.gestionar'
);

-- Mismo usuario, ahora CON el permiso de catálogos.
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000aa","app_metadata":{"permisos":["catalogos.gestionar"]}}',
  true
);

SELECT lives_ok(
  $$ INSERT INTO public.lineas_curriculares_sugeridas (facultad_id, nombre, area)
     VALUES ('11111111-1111-1111-1111-111111111111', 'Programación', 'Cómputo') $$,
  'insert succeeds with catalogos.gestionar'
);
SELECT throws_ok(
  $$ INSERT INTO public.lineas_curriculares_sugeridas (facultad_id, nombre)
     VALUES ('11111111-1111-1111-1111-111111111111', 'programación') $$,
  '23505',
  NULL,
  'case-insensitive duplicate name is rejected per facultad'
);

RESET ROLE;

SELECT * FROM finish();

ROLLBACK;
