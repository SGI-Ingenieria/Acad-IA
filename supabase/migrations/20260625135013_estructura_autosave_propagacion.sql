CREATE OR REPLACE FUNCTION public.aplicar_operaciones_estructura_datos(
  p_datos jsonb,
  p_operaciones jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_next jsonb := COALESCE(p_datos, '{}'::jsonb);
  v_operaciones jsonb := COALESCE(p_operaciones, '{}'::jsonb);
  v_item jsonb;
  v_from text;
  v_to text;
  v_key text;
BEGIN
  IF jsonb_typeof(v_next) IS DISTINCT FROM 'object' THEN
    v_next := '{}'::jsonb;
  END IF;

  FOR v_item IN
    SELECT value
    FROM jsonb_array_elements(
      CASE
        WHEN jsonb_typeof(v_operaciones->'renames') = 'array'
          THEN v_operaciones->'renames'
        ELSE '[]'::jsonb
      END
    )
  LOOP
    v_from := NULLIF(v_item->>'from', '');
    v_to := NULLIF(v_item->>'to', '');

    IF v_from IS NOT NULL
      AND v_to IS NOT NULL
      AND v_from <> v_to
      AND v_next ? v_from
    THEN
      v_next := (v_next - v_from) || jsonb_build_object(v_to, v_next->v_from);
    END IF;
  END LOOP;

  FOR v_key IN
    SELECT value
    FROM jsonb_array_elements_text(
      CASE
        WHEN jsonb_typeof(v_operaciones->'removed') = 'array'
          THEN v_operaciones->'removed'
        ELSE '[]'::jsonb
      END
    )
  LOOP
    IF NULLIF(v_key, '') IS NOT NULL THEN
      v_next := v_next - v_key;
    END IF;
  END LOOP;

  FOR v_key IN
    SELECT value
    FROM jsonb_array_elements_text(
      CASE
        WHEN jsonb_typeof(v_operaciones->'typeChanged') = 'array'
          THEN v_operaciones->'typeChanged'
        ELSE '[]'::jsonb
      END
    )
  LOOP
    IF NULLIF(v_key, '') IS NOT NULL AND v_next ? v_key THEN
      v_next := jsonb_set(v_next, ARRAY[v_key], 'null'::jsonb, true);
    END IF;
  END LOOP;

  RETURN v_next;
END;
$$;

CREATE OR REPLACE FUNCTION public.actualizar_estructura_plan_definicion(
  p_id uuid,
  p_definicion jsonb,
  p_operaciones jsonb DEFAULT '{}'::jsonb
)
RETURNS public.estructuras_plan
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_row public.estructuras_plan;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Usuario no autenticado' USING ERRCODE = '28000';
  END IF;

  IF NOT public.authz_has_permission('catalogos.gestionar') THEN
    RAISE EXCEPTION 'No tienes permiso para gestionar estructuras'
      USING ERRCODE = '42501';
  END IF;

  UPDATE public.estructuras_plan
  SET
    definicion = COALESCE(p_definicion, '{}'::jsonb),
    actualizado_por = v_user
  WHERE id = p_id
  RETURNING * INTO v_row;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Estructura de plan no encontrada' USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.planes_estudio AS p
  SET
    datos = public.aplicar_operaciones_estructura_datos(p.datos, p_operaciones),
    actualizado_por = v_user
  WHERE p.estructura_id = p_id
    AND public.aplicar_operaciones_estructura_datos(p.datos, p_operaciones)
      IS DISTINCT FROM p.datos;

  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.actualizar_estructura_asignatura_definicion(
  p_id uuid,
  p_definicion jsonb,
  p_operaciones jsonb DEFAULT '{}'::jsonb
)
RETURNS public.estructuras_asignatura
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_row public.estructuras_asignatura;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Usuario no autenticado' USING ERRCODE = '28000';
  END IF;

  IF NOT public.authz_has_permission('catalogos.gestionar') THEN
    RAISE EXCEPTION 'No tienes permiso para gestionar estructuras'
      USING ERRCODE = '42501';
  END IF;

  UPDATE public.estructuras_asignatura
  SET
    definicion = COALESCE(p_definicion, '{}'::jsonb),
    actualizado_por = v_user
  WHERE id = p_id
  RETURNING * INTO v_row;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Estructura de asignatura no encontrada'
      USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.asignaturas AS a
  SET
    datos = public.aplicar_operaciones_estructura_datos(a.datos, p_operaciones),
    actualizado_por = v_user
  WHERE a.estructura_id = p_id
    AND public.aplicar_operaciones_estructura_datos(a.datos, p_operaciones)
      IS DISTINCT FROM a.datos;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.aplicar_operaciones_estructura_datos(jsonb, jsonb)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.actualizar_estructura_plan_definicion(uuid, jsonb, jsonb)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.actualizar_estructura_asignatura_definicion(uuid, jsonb, jsonb)
  FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.actualizar_estructura_plan_definicion(uuid, jsonb, jsonb)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.actualizar_estructura_asignatura_definicion(uuid, jsonb, jsonb)
  TO authenticated;

COMMENT ON FUNCTION public.actualizar_estructura_plan_definicion(uuid, jsonb, jsonb)
  IS 'Actualiza una estructura de plan y propaga renombres, eliminaciones y cambios de tipo a planes dependientes.';
COMMENT ON FUNCTION public.actualizar_estructura_asignatura_definicion(uuid, jsonb, jsonb)
  IS 'Actualiza una estructura de asignatura y propaga renombres, eliminaciones y cambios de tipo a asignaturas dependientes.';
