-- Profesor por materia: el acceso de un profesor a una asignatura deriva de
-- responsables_asignatura (no de un rol con carrera). Ajusta authz, políticas,
-- catálogo, datos, auto-grant del rol y la cobertura del RPC de reasignación.

-- ── Helpers: ¿es responsable? ────────────────────────────────────────────────
-- SECURITY DEFINER: estas funciones se usan dentro de políticas de
-- responsables_asignatura/asignaturas; deben leer sin RLS para no crear
-- recursión cíclica entre esas políticas.
CREATE OR REPLACE FUNCTION public.authz_is_responsable_asignatura(p_asignatura_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.responsables_asignatura ra
    WHERE ra.asignatura_id = p_asignatura_id AND ra.usuario_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.authz_is_responsable_de_plan(p_plan_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.responsables_asignatura ra
    JOIN public.asignaturas a ON a.id = ra.asignatura_id
    WHERE a.plan_estudio_id = p_plan_id AND ra.usuario_id = auth.uid()
  );
$$;

REVOKE EXECUTE ON FUNCTION public.authz_is_responsable_asignatura(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.authz_is_responsable_de_plan(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.authz_is_responsable_asignatura(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.authz_is_responsable_de_plan(uuid) TO authenticated, service_role;

-- authz_can_access_asignatura: además del alcance por carrera, permitir al
-- responsable de ESA asignatura (acceso por materia, sin filtrarse a hermanas).
CREATE OR REPLACE FUNCTION public.authz_can_access_asignatura(p_asignatura_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.asignaturas a
    WHERE a.id = p_asignatura_id
      AND public.authz_can_access_plan(a.plan_estudio_id)
  )
  OR public.authz_is_responsable_asignatura(p_asignatura_id);
$$;
-- Nota: authz_can_access_plan se mantiene SOLO por carrera (no se le agrega la
-- rama de responsable) para que el acceso del profesor no se propague a las
-- demás asignaturas/líneas del plan.

-- ── Políticas: asignaturas por-asignatura; plan legible por responsable ───────
-- Se evalúa por-asignatura con el ámbito por carrera del plan O ser responsable
-- de ESTA asignatura. Se usa la forma inline (no authz_can_access_asignatura)
-- para no consultar `asignaturas` dentro de su propia política (recursión).
DROP POLICY IF EXISTS asignaturas_select_by_scope ON public.asignaturas;
CREATE POLICY asignaturas_select_by_scope ON public.asignaturas
  FOR SELECT TO authenticated
  USING (
    (public.authz_has_permission('asignaturas.ver') OR public.authz_has_permission('planes.ver'))
    AND (
      public.authz_can_access_plan(plan_estudio_id)
      OR public.authz_is_responsable_asignatura(id)
    )
  );

DROP POLICY IF EXISTS asignaturas_manage_by_scope ON public.asignaturas;
CREATE POLICY asignaturas_manage_by_scope ON public.asignaturas
  FOR ALL TO authenticated
  USING (
    public.authz_has_permission('asignaturas.editar')
    AND (
      public.authz_can_access_plan(plan_estudio_id)
      OR public.authz_is_responsable_asignatura(id)
    )
  )
  WITH CHECK (
    public.authz_has_permission('asignaturas.editar')
    AND (
      public.authz_can_access_plan(plan_estudio_id)
      OR public.authz_is_responsable_asignatura(id)
    )
  );

DROP POLICY IF EXISTS planes_estudio_select_by_scope ON public.planes_estudio;
CREATE POLICY planes_estudio_select_by_scope ON public.planes_estudio
  FOR SELECT TO authenticated
  USING (
    public.authz_has_permission('planes.ver')
    AND (
      public.authz_can_access_carrera(carrera_id)
      OR public.authz_is_responsable_de_plan(id)
    )
  );

-- ── Catálogo + datos: PROFESOR ya no es por carrera ───────────────────────────
UPDATE public.roles SET alcance_default = 'asignatura' WHERE clave = 'PROFESOR';

-- Conservar una sola fila PROFESOR por usuario antes de anular la carrera
-- (evita colisión con el índice único usuario+rol+carrera+facultad al quedar
-- varias filas idénticas con carrera NULL).
DELETE FROM public.usuarios_roles ur
USING (
  SELECT id,
    row_number() OVER (PARTITION BY usuario_id ORDER BY creado_en) AS rn
  FROM public.usuarios_roles
  WHERE rol_id = (SELECT id FROM public.roles WHERE clave = 'PROFESOR')
) d
WHERE ur.id = d.id AND d.rn > 1;

UPDATE public.usuarios_roles
  SET carrera_id = NULL
  WHERE rol_id = (SELECT id FROM public.roles WHERE clave = 'PROFESOR');

-- ── Auto-grant: al hacer a alguien responsable de una materia, asegúrale el rol
-- PROFESOR (sin carrera) para que obtenga los permisos del rol. ───────────────
CREATE OR REPLACE FUNCTION public.fn_grant_profesor_on_responsable()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_rol_prof uuid;
BEGIN
  SELECT id INTO v_rol_prof FROM roles WHERE clave = 'PROFESOR';
  IF v_rol_prof IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO usuarios_roles (usuario_id, rol_id, facultad_id, carrera_id)
  SELECT NEW.usuario_id, v_rol_prof, NULL::uuid, NULL::uuid
  WHERE NOT EXISTS (
    SELECT 1 FROM usuarios_roles ur
    WHERE ur.usuario_id = NEW.usuario_id AND ur.rol_id = v_rol_prof
  );

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_responsables_grant_profesor ON public.responsables_asignatura;
CREATE TRIGGER trg_responsables_grant_profesor
  AFTER INSERT ON public.responsables_asignatura
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_grant_profesor_on_responsable();

-- Backfill: responsables existentes sin rol PROFESOR.
INSERT INTO public.usuarios_roles (usuario_id, rol_id, facultad_id, carrera_id)
SELECT DISTINCT ra.usuario_id, r.id, NULL::uuid, NULL::uuid
FROM public.responsables_asignatura ra
JOIN public.roles r ON r.clave = 'PROFESOR'
WHERE NOT EXISTS (
  SELECT 1 FROM public.usuarios_roles ur
  WHERE ur.usuario_id = ra.usuario_id AND ur.rol_id = r.id
);

-- ── RPC reasignación: cobertura de ámbito considerando materias del profesor ──
CREATE OR REPLACE FUNCTION public.reasignar_responsabilidades(
  p_origen uuid,
  p_destino uuid,
  p_actor uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_actor_nivel int;
  v_origen_nivel int;
  v_actor_global boolean;
  v_actor_facultades uuid[];
  v_actor_carreras uuid[];
  v_uncovered boolean;
  v_destino_baja timestamptz;
  v_detalle jsonb;
BEGIN
  IF p_origen = p_destino THEN
    RAISE EXCEPTION 'El origen y el destino no pueden ser el mismo usuario.'
      USING ERRCODE = 'P0409';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM usuarios_app WHERE id = p_origen) THEN
    RAISE EXCEPTION 'Usuario origen no encontrado.' USING ERRCODE = 'P0404';
  END IF;

  SELECT dado_de_baja_en INTO v_destino_baja
  FROM usuarios_app WHERE id = p_destino;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Usuario destino no encontrado.' USING ERRCODE = 'P0404';
  END IF;
  IF v_destino_baja IS NOT NULL THEN
    RAISE EXCEPTION 'El usuario destino está dado de baja.'
      USING ERRCODE = 'P0409';
  END IF;

  IF NOT public.usuario_tiene_permiso(p_actor, 'usuarios.roles.gestionar') THEN
    RAISE EXCEPTION 'No tienes permisos para reasignar.' USING ERRCODE = 'P0403';
  END IF;

  SELECT min(r.nivel_jerarquico) INTO v_actor_nivel
  FROM usuarios_roles ur JOIN roles r ON r.id = ur.rol_id
  WHERE ur.usuario_id = p_actor;

  SELECT min(r.nivel_jerarquico) INTO v_origen_nivel
  FROM usuarios_roles ur JOIN roles r ON r.id = ur.rol_id
  WHERE ur.usuario_id = p_origen;

  IF v_origen_nivel IS NULL THEN
    RAISE EXCEPTION 'El usuario origen no tiene roles que reasignar.'
      USING ERRCODE = 'P0409';
  END IF;
  IF v_actor_nivel IS NULL OR v_actor_nivel >= v_origen_nivel THEN
    RAISE EXCEPTION 'Solo un usuario de mayor jerarquía puede reasignar a este usuario.'
      USING ERRCODE = 'P0403';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM usuarios_roles ur JOIN roles r ON r.id = ur.rol_id
    WHERE ur.usuario_id = p_actor AND r.alcance_default = 'global'
  ) INTO v_actor_global;

  SELECT coalesce(array_agg(DISTINCT ur.facultad_id)
           FILTER (WHERE ur.facultad_id IS NOT NULL), '{}'::uuid[])
    INTO v_actor_facultades
  FROM usuarios_roles ur WHERE ur.usuario_id = p_actor;

  SELECT coalesce(array_agg(DISTINCT ur.carrera_id)
           FILTER (WHERE ur.carrera_id IS NOT NULL), '{}'::uuid[])
    INTO v_actor_carreras
  FROM usuarios_roles ur WHERE ur.usuario_id = p_actor;

  -- Cobertura de roles con ámbito facultad/carrera (ignora 'asignatura').
  SELECT EXISTS (
    SELECT 1
    FROM usuarios_roles ur
    JOIN roles r ON r.id = ur.rol_id
    LEFT JOIN carreras c ON c.id = ur.carrera_id
    WHERE ur.usuario_id = p_origen
      AND r.alcance_default <> 'asignatura'
      AND NOT (
        v_actor_global
        OR (ur.facultad_id IS NOT NULL AND ur.facultad_id = ANY (v_actor_facultades))
        OR (ur.carrera_id IS NOT NULL AND (
              ur.carrera_id = ANY (v_actor_carreras)
              OR c.facultad_id = ANY (v_actor_facultades)
        ))
      )
  ) INTO v_uncovered;

  -- Cobertura por materias (profesor): cada materia del origen debe estar en el
  -- ámbito del actor (carrera o facultad). Los actores globales cubren todo.
  IF NOT v_uncovered AND NOT v_actor_global THEN
    SELECT EXISTS (
      SELECT 1
      FROM responsables_asignatura ra
      JOIN asignaturas a ON a.id = ra.asignatura_id
      JOIN planes_estudio pe ON pe.id = a.plan_estudio_id
      LEFT JOIN carreras c ON c.id = pe.carrera_id
      WHERE ra.usuario_id = p_origen
        AND NOT (
          pe.carrera_id = ANY (v_actor_carreras)
          OR c.facultad_id = ANY (v_actor_facultades)
        )
    ) INTO v_uncovered;
  END IF;

  IF v_uncovered THEN
    RAISE EXCEPTION 'El origen tiene responsabilidades fuera de tu ámbito.'
      USING ERRCODE = 'P0403';
  END IF;

  v_detalle := jsonb_build_object(
    'origen_roles',
      (SELECT coalesce(jsonb_agg(to_jsonb(ur)), '[]'::jsonb)
         FROM usuarios_roles ur WHERE ur.usuario_id = p_origen),
    'origen_tareas',
      (SELECT coalesce(jsonb_agg(t.id), '[]'::jsonb)
         FROM tareas_revision t WHERE t.asignado_a = p_origen),
    'origen_responsables',
      (SELECT coalesce(jsonb_agg(ra.id), '[]'::jsonb)
         FROM responsables_asignatura ra WHERE ra.usuario_id = p_origen),
    'destino_roles_previos',
      (SELECT coalesce(jsonb_agg(to_jsonb(ur)), '[]'::jsonb)
         FROM usuarios_roles ur WHERE ur.usuario_id = p_destino),
    'destino_tareas_previas',
      (SELECT coalesce(jsonb_agg(t.id), '[]'::jsonb)
         FROM tareas_revision t WHERE t.asignado_a = p_destino),
    'destino_responsables_previos',
      (SELECT coalesce(jsonb_agg(ra.id), '[]'::jsonb)
         FROM responsables_asignatura ra WHERE ra.usuario_id = p_destino)
  );

  DELETE FROM usuarios_roles WHERE usuario_id = p_destino;
  DELETE FROM tareas_revision WHERE asignado_a = p_destino;
  DELETE FROM responsables_asignatura WHERE usuario_id = p_destino;

  UPDATE usuarios_roles
    SET usuario_id = p_destino, asignado_por = p_actor
    WHERE usuario_id = p_origen;
  UPDATE tareas_revision
    SET asignado_a = p_destino
    WHERE asignado_a = p_origen;
  UPDATE responsables_asignatura
    SET usuario_id = p_destino
    WHERE usuario_id = p_origen;

  UPDATE usuarios_app SET dado_de_baja_en = now() WHERE id = p_origen;

  INSERT INTO reasignaciones (reasignado_por, usuario_origen, usuario_destino, detalle)
  VALUES (p_actor, p_origen, p_destino, v_detalle);

  RETURN jsonb_build_object(
    'origen', p_origen,
    'destino', p_destino,
    'reasignado_por', p_actor,
    'detalle', v_detalle
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.reasignar_responsabilidades(uuid, uuid, uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.reasignar_responsabilidades(uuid, uuid, uuid)
  TO authenticated, service_role;
