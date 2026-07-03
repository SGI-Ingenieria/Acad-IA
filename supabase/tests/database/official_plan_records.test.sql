BEGIN;

SELECT plan(17);

SELECT has_table(
  'public',
  'registros_oficiales_plan',
  'registros_oficiales_plan table exists'
);

SELECT has_column(
  'public',
  'registros_oficiales_plan',
  'clave_sep',
  'official record stores SEP/RVOE key'
);

SELECT has_column(
  'public',
  'registros_oficiales_plan',
  'numero_acuerdo',
  'official record stores agreement/dictamen number'
);

SELECT has_column(
  'public',
  'registros_oficiales_plan',
  'vigencia_inicio',
  'official record stores validity start'
);

SELECT has_column(
  'public',
  'registros_oficiales_plan',
  'documento_bucket',
  'official record stores document storage bucket'
);

SELECT has_column(
  'public',
  'registros_oficiales_plan',
  'documento_path',
  'official record stores document storage path'
);

SELECT has_column(
  'public',
  'registros_oficiales_plan',
  'documento_nombre',
  'official record stores original document filename'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM storage.buckets
    WHERE id = 'documentos-oficiales'
      AND public = false
  ),
  'official documents bucket exists and is private'
);

SELECT has_trigger(
  'public',
  'planes_estudio',
  'trg_planes_exige_registro_oficial_aprobado',
  'APROBADO transition is guarded by official record trigger'
);

SELECT is(
  (SELECT etiqueta FROM public.estados_plan WHERE clave = 'APROBADO'),
  'Aprobado por SEP',
  'final APROBADO state is labelled as SEP approval'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.registros_oficiales_plan'::regclass
      AND conname = 'registros_oficiales_plan_plan_unique'
      AND contype = 'u'
  ),
  'official record is unique per plan'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.registros_oficiales_plan'::regclass
      AND conname = 'registros_oficiales_plan_documento_chk'
      AND contype = 'c'
  ),
  'official record requires a document reference'
);

CREATE TEMP TABLE _official_test_plan AS
WITH ids AS (
  SELECT
    (SELECT id FROM public.carreras LIMIT 1) AS carrera_id,
    (
      SELECT id
      FROM public.estructuras_plan
      ORDER BY CASE WHEN tipo <> 'CURRICULAR' THEN 0 ELSE 1 END
      LIMIT 1
    ) AS estructura_id,
    (SELECT id FROM public.estados_plan WHERE clave = 'ENVIADO_SEP') AS enviado_id
),
inserted AS (
  INSERT INTO public.planes_estudio (
    carrera_id,
    estructura_id,
    nombre_propuesto,
    fecha_inicio_imparticion,
    tipo_ciclo,
    numero_ciclos,
    estado_actual_id,
    activo,
    tipo_origen,
    datos
  )
  SELECT
    carrera_id,
    estructura_id,
    'Plan oficial pgTAP',
    '2026-08-01'::date,
    'Semestre',
    8,
    enviado_id,
    true,
    'MANUAL',
    '{}'::jsonb
  FROM ids
  RETURNING id
)
SELECT id FROM inserted;

SELECT set_config(
  'request.jwt.claims',
  '{"role":"service_role"}',
  true
);

SELECT throws_ok(
  $$ UPDATE public.planes_estudio
        SET estado_actual_id = (
          SELECT id FROM public.estados_plan WHERE clave = 'APROBADO'
        )
      WHERE id = (SELECT id FROM _official_test_plan) $$,
  '23514',
  NULL,
  'plan cannot move to APROBADO without official record'
);

INSERT INTO public.registros_oficiales_plan (
  plan_estudio_id,
  clave_sep,
  numero_acuerdo,
  autoridad,
  fecha_aprobacion,
  vigencia_inicio,
  vigencia_fin,
  documento_bucket,
  documento_path,
  documento_nombre,
  documento_mime,
  documento_size
)
VALUES (
  (SELECT id FROM _official_test_plan),
  'SEP-PGTAP-2026',
  'DICTAMEN-PGTAP-2026',
  'SEP',
  '2026-07-03'::date,
  '2026-08-01'::date,
  NULL,
  'documentos-oficiales',
  'planes/00000000-0000-0000-0000-000000000000/dictamen-pgtap.pdf',
  'dictamen-pgtap.pdf',
  'application/pdf',
  12345
);

SELECT lives_ok(
  $$ UPDATE public.planes_estudio
        SET estado_actual_id = (
          SELECT id FROM public.estados_plan WHERE clave = 'APROBADO'
        )
      WHERE id = (SELECT id FROM _official_test_plan) $$,
  'plan can move to APROBADO after official record exists'
);

SELECT is(
  (
    SELECT count(*)::integer
    FROM public.registros_oficiales_plan_detalle
    WHERE plan_estudio_id = (SELECT id FROM _official_test_plan)
      AND estado_clave = 'APROBADO'
      AND clave_sep = 'SEP-PGTAP-2026'
      AND documento_path = 'planes/00000000-0000-0000-0000-000000000000/dictamen-pgtap.pdf'
  ),
  1,
  'official records detail view exposes approved plan ficha'
);

SELECT is(
  (
    SELECT count(*)::integer
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'registros_oficiales_plan'
      AND policyname IN (
        'registros_oficiales_plan_select_by_scope',
        'registros_oficiales_plan_insert_by_approval_scope',
        'registros_oficiales_plan_update_by_approval_scope',
        'registros_oficiales_plan_delete_admin'
      )
  ),
  4,
  'official records have scoped RLS policies'
);

SELECT is(
  (
    SELECT count(*)::integer
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname IN (
        'official_plan_documents_select',
        'official_plan_documents_insert',
        'official_plan_documents_update',
        'official_plan_documents_delete'
      )
  ),
  4,
  'official documents bucket has scoped storage policies'
);

SELECT * FROM finish();

ROLLBACK;
