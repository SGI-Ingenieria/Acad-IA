BEGIN;

SELECT plan(15);

-- ---------------------------------------------------------------------------
-- Estructura
-- ---------------------------------------------------------------------------
SELECT has_table('public', 'crash_reports', 'crash_reports table exists');
SELECT has_column('public', 'crash_reports', 'mensaje', 'mensaje exists');
SELECT has_column('public', 'crash_reports', 'contexto', 'contexto exists');
SELECT has_column('public', 'crash_reports', 'fingerprint', 'fingerprint exists');

SELECT ok(
  (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.crash_reports'::regclass),
  'crash_reports has RLS enabled'
);

-- ---------------------------------------------------------------------------
-- Políticas RLS declarativas
-- ---------------------------------------------------------------------------
SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'crash_reports'
      AND policyname = 'crash_reports_insert_frontend'
      AND cmd = 'INSERT'
      AND coalesce(with_check, '') LIKE '%origen = ''frontend''%'
  ),
  'frontend insert policy exists'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'crash_reports'
      AND policyname = 'crash_reports_select_auditoria'
      AND cmd = 'SELECT'
      AND coalesce(qual, '') LIKE '%auditoria.ver%'
  ),
  'select policy is gated by auditoria.ver'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'crash_reports'
      AND policyname = 'crash_reports_update_auditoria'
      AND cmd = 'UPDATE'
      AND coalesce(with_check, '') LIKE '%auditoria.ver%'
  ),
  'update policy is gated by auditoria.ver'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'crash_reports'
      AND policyname = 'crash_reports_delete_admin'
      AND cmd = 'DELETE'
      AND coalesce(qual, '') LIKE '%authz_is_admin%'
  ),
  'delete policy is admin-only'
);

SELECT throws_ok(
  $$ INSERT INTO public.crash_reports (mensaje)
     VALUES ('') $$,
  '23514',
  NULL,
  'blank messages are rejected'
);

-- ---------------------------------------------------------------------------
-- RLS funcional
-- ---------------------------------------------------------------------------
SET LOCAL role anon;
SELECT set_config(
  'request.jwt.claims',
  '{"sub":null,"app_metadata":{"permisos":[]}}',
  true
);

SELECT lives_ok(
  $$ INSERT INTO public.crash_reports (mensaje, contexto, fingerprint)
     VALUES ('anon frontend crash', '{"source":"test"}', 'anon-fingerprint') $$,
  'anon can insert a frontend crash report'
);

SELECT throws_ok(
  $$ SELECT count(*) FROM public.crash_reports $$,
  '42501',
  NULL,
  'anon cannot read crash reports'
);

SET LOCAL role authenticated;
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000bb","app_metadata":{"permisos":[]}}',
  true
);

SELECT lives_ok(
  $$ INSERT INTO public.crash_reports (mensaje, contexto, fingerprint)
     VALUES ('authenticated frontend crash', '{"source":"test"}', 'auth-fingerprint') $$,
  'authenticated users can insert frontend crash reports'
);

SELECT is(
  (SELECT count(*)::integer FROM public.crash_reports),
  0,
  'authenticated users without auditoria.ver cannot read crash reports'
);

SELECT set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000cc","app_metadata":{"permisos":["auditoria.ver"]}}',
  true
);

SELECT ok(
  (SELECT count(*)::integer FROM public.crash_reports) >= 2,
  'auditoria.ver can read crash reports'
);

RESET ROLE;

SELECT * FROM finish();

ROLLBACK;
