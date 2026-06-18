-- Verificación de "profesor por materia" (Fase 2).
-- Ejecutar DESPUÉS de `supabase db push`, como rol con privilegios (postgres):
--   supabase db execute --file supabase/verificacion_profesor_por_materia.sql
--   (o psql ... -f supabase/verificacion_profesor_por_materia.sql)
-- Es de SOLO LECTURA: todo corre dentro de una transacción que hace ROLLBACK.
-- Falla con EXCEPTION si algo no cumple; emite NOTICE con los resultados.

BEGIN;

-- ── Parte A: chequeos estructurales ──────────────────────────────────────────
DO $$
BEGIN
  -- 1) PROFESOR es por asignatura, no por carrera.
  IF NOT EXISTS (
    SELECT 1 FROM public.roles
    WHERE clave = 'PROFESOR' AND alcance_default = 'asignatura'
  ) THEN
    RAISE EXCEPTION 'A1 FALLO: el rol PROFESOR no tiene alcance_default = asignatura.';
  END IF;

  -- 2) Ninguna asignación PROFESOR conserva carrera_id.
  IF EXISTS (
    SELECT 1 FROM public.usuarios_roles ur
    JOIN public.roles r ON r.id = ur.rol_id
    WHERE r.clave = 'PROFESOR' AND ur.carrera_id IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'A2 FALLO: existen filas PROFESOR con carrera_id no nulo.';
  END IF;

  -- 3) Funciones esperadas.
  PERFORM 'public.authz_is_responsable_asignatura(uuid)'::regprocedure;
  PERFORM 'public.authz_is_responsable_de_plan(uuid)'::regprocedure;
  PERFORM 'public.fn_grant_profesor_on_responsable()'::regprocedure;
  PERFORM 'public.fn_asignar_jefe_al_crear_plan()'::regprocedure;
  PERFORM 'public.reasignar_responsabilidades(uuid,uuid,uuid)'::regprocedure;

  -- 4) Triggers esperados.
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_responsables_grant_profesor' AND NOT tgisinternal
  ) THEN
    RAISE EXCEPTION 'A4a FALLO: falta trigger trg_responsables_grant_profesor.';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_planes_estudio_asignar_jefe' AND NOT tgisinternal
  ) THEN
    RAISE EXCEPTION 'A4b FALLO: falta trigger trg_planes_estudio_asignar_jefe.';
  END IF;

  -- 5) Tabla de histórico de reasignaciones.
  PERFORM 'public.reasignaciones'::regclass;

  RAISE NOTICE 'Parte A OK: estructura de "profesor por materia" correcta.';
END $$;

-- ── Parte B: simulación RLS como un profesor real ────────────────────────────
-- Elige automáticamente un profesor SIN alcance de carrera/facultad/global que
-- sea responsable de una materia que tenga una "hermana" (misma plan) de la que
-- NO es responsable, y verifica que solo ve la suya.
DO $$
DECLARE
  v_prof uuid;
  v_propia uuid;
  v_ajena uuid;
  v_plan uuid;
  v_claims text;
  v_ve_propia int;
  v_ve_ajena int;
  v_ve_plan int;
BEGIN
  SELECT ra.usuario_id, ra.asignatura_id, a.plan_estudio_id
    INTO v_prof, v_propia, v_plan
  FROM public.responsables_asignatura ra
  JOIN public.asignaturas a ON a.id = ra.asignatura_id
  JOIN public.usuarios_app u
    ON u.id = ra.usuario_id AND u.dado_de_baja_en IS NULL
  WHERE EXISTS (
      SELECT 1 FROM public.asignaturas s
      WHERE s.plan_estudio_id = a.plan_estudio_id
        AND s.id <> ra.asignatura_id
        AND NOT EXISTS (
          SELECT 1 FROM public.responsables_asignatura r2
          WHERE r2.asignatura_id = s.id AND r2.usuario_id = ra.usuario_id
        )
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.usuarios_roles ur
      JOIN public.roles r ON r.id = ur.rol_id
      WHERE ur.usuario_id = ra.usuario_id
        AND (r.alcance_default = 'global'
             OR ur.carrera_id IS NOT NULL
             OR ur.facultad_id IS NOT NULL)
    )
  LIMIT 1;

  IF v_prof IS NULL THEN
    RAISE NOTICE 'Parte B OMITIDA: no hay un profesor sin alcance con materia+hermana para probar.';
    RETURN;
  END IF;

  SELECT s.id INTO v_ajena
  FROM public.asignaturas s
  WHERE s.plan_estudio_id = v_plan
    AND s.id <> v_propia
    AND NOT EXISTS (
      SELECT 1 FROM public.responsables_asignatura r2
      WHERE r2.asignatura_id = s.id AND r2.usuario_id = v_prof
    )
  LIMIT 1;

  -- Construye los claims tal como los lee la RLS (permisos, alcances, roles, sub).
  SELECT json_build_object(
    'sub', v_prof,
    'role', 'authenticated',
    'app_metadata', json_build_object(
      'permisos', COALESCE((
        SELECT json_agg(DISTINCT p.clave)
        FROM public.usuarios_roles ur
        JOIN public.roles_permisos rp ON rp.rol_id = ur.rol_id
        JOIN public.permisos p ON p.id = rp.permiso_id
        WHERE ur.usuario_id = v_prof
      ), '[]'::json),
      'alcances', json_build_object(
        'global', '[]'::json,
        'facultades', COALESCE((
          SELECT json_agg(DISTINCT ur.facultad_id)
          FROM public.usuarios_roles ur
          WHERE ur.usuario_id = v_prof AND ur.facultad_id IS NOT NULL
        ), '[]'::json),
        'carreras', COALESCE((
          SELECT json_agg(DISTINCT ur.carrera_id)
          FROM public.usuarios_roles ur
          WHERE ur.usuario_id = v_prof AND ur.carrera_id IS NOT NULL
        ), '[]'::json)
      ),
      'roles', COALESCE((
        SELECT json_agg(json_build_object(
          'alcance_default', r.alcance_default,
          'facultad_id', ur.facultad_id,
          'carrera_id', ur.carrera_id
        ))
        FROM public.usuarios_roles ur
        JOIN public.roles r ON r.id = ur.rol_id
        WHERE ur.usuario_id = v_prof
      ), '[]'::json),
      'authz_bootstrap', false
    )
  )::text INTO v_claims;

  PERFORM set_config('request.jwt.claims', v_claims, true);
  SET LOCAL ROLE authenticated;  -- RLS solo aplica a roles sin BYPASSRLS

  SELECT count(*) INTO v_ve_propia FROM public.asignaturas WHERE id = v_propia;
  SELECT count(*) INTO v_ve_ajena  FROM public.asignaturas WHERE id = v_ajena;
  SELECT count(*) INTO v_ve_plan   FROM public.planes_estudio WHERE id = v_plan;

  RESET ROLE;

  IF v_ve_propia <> 1 THEN
    RAISE EXCEPTION 'B FALLO: el profesor NO ve su propia materia (%).', v_propia;
  END IF;
  IF v_ajena IS NOT NULL AND v_ve_ajena <> 0 THEN
    RAISE EXCEPTION 'B FALLO: el profesor VE una materia ajena del mismo plan (%).', v_ajena;
  END IF;
  IF v_ve_plan <> 1 THEN
    RAISE EXCEPTION 'B FALLO: el profesor NO puede leer el plan de su materia (%).', v_plan;
  END IF;

  RAISE NOTICE 'Parte B OK: profesor % ve su materia, no ve la ajena, y lee su plan.', v_prof;
END $$;

ROLLBACK;
