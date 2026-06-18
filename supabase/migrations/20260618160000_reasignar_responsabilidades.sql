-- Reasignación de responsabilidades: mueve (sobrescribiendo) los roles y las
-- tareas/asignaciones de un usuario ORIGEN a un usuario DESTINO, da de baja al
-- ORIGEN y registra el histórico. Autorización por jerarquía + ámbito.

-- ── Histórico ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.reasignaciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reasignado_por uuid REFERENCES public.usuarios_app(id) ON DELETE SET NULL,
  usuario_origen uuid REFERENCES public.usuarios_app(id) ON DELETE SET NULL,
  usuario_destino uuid REFERENCES public.usuarios_app(id) ON DELETE SET NULL,
  detalle jsonb NOT NULL,
  creado_en timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.reasignaciones OWNER TO postgres;

GRANT SELECT ON TABLE public.reasignaciones TO authenticated;
GRANT ALL ON TABLE public.reasignaciones TO service_role;

ALTER TABLE public.reasignaciones ENABLE ROW LEVEL SECURITY;

-- Lectura para auditoría/gestión de roles. No hay política de INSERT: solo el
-- RPC SECURITY DEFINER (dueño postgres) escribe, omitiendo RLS.
DROP POLICY IF EXISTS reasignaciones_select_by_permission ON public.reasignaciones;
CREATE POLICY reasignaciones_select_by_permission
  ON public.reasignaciones
  FOR SELECT
  TO authenticated
  USING (
    public.authz_has_permission('auditoria.ver')
    OR public.authz_has_permission('usuarios.roles.gestionar')
  );

-- ── RPC transaccional ─────────────────────────────────────────────────────────
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
  -- 1) Validaciones básicas
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

  -- 2) Permiso base (ADMIN ya tiene todos los permisos)
  IF NOT public.usuario_tiene_permiso(p_actor, 'usuarios.roles.gestionar') THEN
    RAISE EXCEPTION 'No tienes permisos para reasignar.' USING ERRCODE = 'P0403';
  END IF;

  -- 3) Jerarquía: el actor debe ser estrictamente superior al origen
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

  -- 4) Ámbito: cada rol del origen debe estar cubierto por el actor
  SELECT EXISTS (
    SELECT 1 FROM usuarios_roles ur JOIN roles r ON r.id = ur.rol_id
    WHERE ur.usuario_id = p_actor AND r.alcance_default = 'global'
  ) INTO v_actor_global;

  SELECT coalesce(array_agg(DISTINCT ur.facultad_id)
           FILTER (WHERE ur.facultad_id IS NOT NULL), '{}')
    INTO v_actor_facultades
  FROM usuarios_roles ur WHERE ur.usuario_id = p_actor;

  SELECT coalesce(array_agg(DISTINCT ur.carrera_id)
           FILTER (WHERE ur.carrera_id IS NOT NULL), '{}')
    INTO v_actor_carreras
  FROM usuarios_roles ur WHERE ur.usuario_id = p_actor;

  SELECT EXISTS (
    SELECT 1
    FROM usuarios_roles ur
    LEFT JOIN carreras c ON c.id = ur.carrera_id
    WHERE ur.usuario_id = p_origen
      AND NOT (
        v_actor_global
        OR (ur.facultad_id IS NOT NULL AND ur.facultad_id = ANY (v_actor_facultades))
        OR (ur.carrera_id IS NOT NULL AND (
              ur.carrera_id = ANY (v_actor_carreras)
              OR c.facultad_id = ANY (v_actor_facultades)
        ))
      )
  ) INTO v_uncovered;

  IF v_uncovered THEN
    RAISE EXCEPTION 'El origen tiene roles fuera de tu ámbito (facultad/carrera).'
      USING ERRCODE = 'P0403';
  END IF;

  -- 5) Snapshot para histórico (antes de mover/borrar)
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

  -- 6) Sobrescribir DESTINO (pierde lo suyo)
  DELETE FROM usuarios_roles WHERE usuario_id = p_destino;
  DELETE FROM tareas_revision WHERE asignado_a = p_destino;
  DELETE FROM responsables_asignatura WHERE usuario_id = p_destino;

  -- 7) Mover ORIGEN → DESTINO
  UPDATE usuarios_roles
    SET usuario_id = p_destino, asignado_por = p_actor
    WHERE usuario_id = p_origen;
  UPDATE tareas_revision
    SET asignado_a = p_destino
    WHERE asignado_a = p_origen;
  UPDATE responsables_asignatura
    SET usuario_id = p_destino
    WHERE usuario_id = p_origen;

  -- 8) Dar de baja al ORIGEN
  UPDATE usuarios_app SET dado_de_baja_en = now() WHERE id = p_origen;

  -- 9) Histórico
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
