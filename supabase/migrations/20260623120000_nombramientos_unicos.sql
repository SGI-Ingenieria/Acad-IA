-- Nombramientos únicos: garantiza un solo titular por alcance para los roles
-- singleton (DIRECTOR_FACULTAD / SECRETARIO_ACADEMICO por facultad, JEFE_CARRERA
-- por carrera) y expone un RPC atómico que retira al titular previo y asigna al
-- nuevo en una sola transacción ("proceso de nombramiento").
--
-- VICERRECTOR_ACADEMICO / ADMIN (alcance global) admiten varios titulares y no
-- se ven afectados por los índices parciales (filtran por facultad/carrera NOT NULL).

-- ── Unicidad por alcance ──────────────────────────────────────────────────────
-- Un único titular por (rol, facultad) para roles con alcance de facultad.
CREATE UNIQUE INDEX IF NOT EXISTS ux_usuarios_roles_facultad_singleton
  ON public.usuarios_roles (rol_id, facultad_id)
  WHERE facultad_id IS NOT NULL;

-- Un único titular por (rol, carrera) para roles con alcance de carrera.
CREATE UNIQUE INDEX IF NOT EXISTS ux_usuarios_roles_carrera_singleton
  ON public.usuarios_roles (rol_id, carrera_id)
  WHERE carrera_id IS NOT NULL;

-- ── Swap atómico ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.nombrar_responsable(
  p_usuario uuid,
  p_rol uuid,
  p_facultad uuid,
  p_carrera uuid,
  p_actor uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_alcance text;
  v_reemplazados jsonb;
  v_nueva usuarios_roles;
BEGIN
  -- Permiso (defensa en profundidad; el edge function ya valida con el JWT).
  IF NOT public.usuario_tiene_permiso(p_actor, 'usuarios.roles.gestionar') THEN
    RAISE EXCEPTION 'No tienes permisos para nombrar responsables.'
      USING ERRCODE = 'P0403';
  END IF;

  SELECT alcance_default INTO v_alcance FROM roles WHERE id = p_rol;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Rol no encontrado.' USING ERRCODE = 'P0404';
  END IF;

  IF p_facultad IS NOT NULL AND p_carrera IS NOT NULL THEN
    RAISE EXCEPTION 'El alcance debe ser por facultad o por carrera, no ambos.'
      USING ERRCODE = 'P0409';
  END IF;
  IF v_alcance = 'facultad' AND p_facultad IS NULL THEN
    RAISE EXCEPTION 'Este rol requiere una facultad.' USING ERRCODE = 'P0409';
  END IF;
  IF v_alcance = 'carrera' AND p_carrera IS NULL THEN
    RAISE EXCEPTION 'Este rol requiere una carrera.' USING ERRCODE = 'P0409';
  END IF;

  -- Retirar al(los) titular(es) actual(es) del mismo rol+alcance (distinto usuario).
  WITH removed AS (
    DELETE FROM usuarios_roles ur
    WHERE ur.rol_id = p_rol
      AND ur.usuario_id <> p_usuario
      AND (
        (p_facultad IS NOT NULL AND ur.facultad_id = p_facultad) OR
        (p_carrera IS NOT NULL AND ur.carrera_id = p_carrera)
      )
    RETURNING ur.usuario_id, ur.id AS asignacion_id
  )
  SELECT coalesce(jsonb_agg(to_jsonb(removed)), '[]'::jsonb)
    INTO v_reemplazados FROM removed;

  -- Asignar al nuevo (idempotente con el índice de unicidad por usuario).
  INSERT INTO usuarios_roles (usuario_id, rol_id, facultad_id, carrera_id, asignado_por)
  VALUES (p_usuario, p_rol, p_facultad, p_carrera, p_actor)
  ON CONFLICT DO NOTHING
  RETURNING * INTO v_nueva;

  -- Si ya existía (mismo usuario+rol+alcance), recuperar la fila vigente.
  IF v_nueva.id IS NULL THEN
    SELECT * INTO v_nueva FROM usuarios_roles
    WHERE usuario_id = p_usuario AND rol_id = p_rol
      AND coalesce(facultad_id, '00000000-0000-0000-0000-000000000000'::uuid)
          = coalesce(p_facultad, '00000000-0000-0000-0000-000000000000'::uuid)
      AND coalesce(carrera_id, '00000000-0000-0000-0000-000000000000'::uuid)
          = coalesce(p_carrera, '00000000-0000-0000-0000-000000000000'::uuid);
  END IF;

  RETURN jsonb_build_object(
    'asignacion_id', v_nueva.id,
    'usuario_id', p_usuario,
    'reemplazados', v_reemplazados
  );
END;
$function$;

ALTER FUNCTION public.nombrar_responsable(uuid, uuid, uuid, uuid, uuid)
  OWNER TO postgres;

-- El RPC se invoca solo desde la edge function con el service_role; ningún rol
-- público debe poder llamarlo vía REST (p_actor es controlado por quien llama).
REVOKE EXECUTE ON FUNCTION public.nombrar_responsable(uuid, uuid, uuid, uuid, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.nombrar_responsable(uuid, uuid, uuid, uuid, uuid)
  TO service_role;
