-- Campos restringidos por estado/permiso y estructuras de asignatura hijas.

CREATE EXTENSION IF NOT EXISTS pg_jsonschema WITH SCHEMA extensions;

INSERT INTO public.permisos (clave, nombre, descripcion, grupo, orden)
VALUES (
  'planes.campos_restringidos.editar',
  'Editar campos restringidos',
  'Llenar campos estructurales restringidos por estado del plan',
  'planes',
  60
)
ON CONFLICT (clave) DO UPDATE SET
  nombre = EXCLUDED.nombre,
  descripcion = EXCLUDED.descripcion,
  grupo = EXCLUDED.grupo,
  orden = EXCLUDED.orden;

WITH matriz(rol_clave, permiso_clave) AS (
  VALUES
    ('ADMIN', 'planes.campos_restringidos.editar'),
    ('PLANEACION_CURRICULAR', 'planes.campos_restringidos.editar')
)
INSERT INTO public.roles_permisos (rol_id, permiso_id)
SELECT r.id, p.id
FROM matriz m
JOIN public.roles r ON r.clave = m.rol_clave
JOIN public.permisos p ON p.clave = m.permiso_clave
ON CONFLICT DO NOTHING;

ALTER TABLE public.estructuras_asignatura
  ADD COLUMN IF NOT EXISTS estructura_plan_id uuid;

ALTER TABLE public.planes_estudio DISABLE TRIGGER USER;
ALTER TABLE public.asignaturas DISABLE TRIGGER USER;

-- Backfill de estructuras de asignatura:
-- - si una estructura se usa con un solo plan, se vincula;
-- - si se usa con varios planes, se duplica por estructura de plan;
-- - si no se usa, se vincula a la estructura de plan mas antigua de su tipo.
WITH used_pairs AS (
  SELECT DISTINCT
    a.estructura_id AS estructura_asignatura_id,
    pe.estructura_id AS estructura_plan_id
  FROM public.asignaturas a
  JOIN public.planes_estudio pe ON pe.id = a.plan_estudio_id
  WHERE a.estructura_id IS NOT NULL
    AND pe.estructura_id IS NOT NULL
),
ranked AS (
  SELECT
    estructura_asignatura_id,
    estructura_plan_id,
    row_number() OVER (
      PARTITION BY estructura_asignatura_id
      ORDER BY estructura_plan_id::text
    ) AS rn
  FROM used_pairs
)
UPDATE public.estructuras_asignatura ea
SET estructura_plan_id = ranked.estructura_plan_id
FROM ranked
WHERE ranked.rn = 1
  AND ranked.estructura_asignatura_id = ea.id
  AND ea.estructura_plan_id IS NULL;

DO $$
DECLARE
  r record;
  v_new_id uuid;
  v_plan_nombre text;
BEGIN
  FOR r IN
    WITH used_pairs AS (
      SELECT DISTINCT
        a.estructura_id AS estructura_asignatura_id,
        pe.estructura_id AS estructura_plan_id
      FROM public.asignaturas a
      JOIN public.planes_estudio pe ON pe.id = a.plan_estudio_id
      WHERE a.estructura_id IS NOT NULL
        AND pe.estructura_id IS NOT NULL
    ),
    ranked AS (
      SELECT
        estructura_asignatura_id,
        estructura_plan_id,
        row_number() OVER (
          PARTITION BY estructura_asignatura_id
          ORDER BY estructura_plan_id::text
        ) AS rn
      FROM used_pairs
    )
    SELECT *
    FROM ranked
    WHERE rn > 1
  LOOP
    v_new_id := gen_random_uuid();

    SELECT nombre
    INTO v_plan_nombre
    FROM public.estructuras_plan
    WHERE id = r.estructura_plan_id;

    INSERT INTO public.estructuras_asignatura (
      id,
      nombre,
      definicion,
      creado_en,
      actualizado_en,
      template_id,
      tipo,
      creado_por,
      actualizado_por,
      estructura_plan_id
    )
    SELECT
      v_new_id,
      left(ea.nombre || ' - ' || COALESCE(v_plan_nombre, 'Plan'), 200),
      ea.definicion,
      ea.creado_en,
      now(),
      ea.template_id,
      ea.tipo,
      ea.creado_por,
      ea.actualizado_por,
      r.estructura_plan_id
    FROM public.estructuras_asignatura ea
    WHERE ea.id = r.estructura_asignatura_id;

    UPDATE public.asignaturas a
    SET estructura_id = v_new_id
    FROM public.planes_estudio pe
    WHERE pe.id = a.plan_estudio_id
      AND a.estructura_id = r.estructura_asignatura_id
      AND pe.estructura_id = r.estructura_plan_id;
  END LOOP;
END $$;

UPDATE public.estructuras_asignatura ea
SET estructura_plan_id = COALESCE(
  (
    SELECT ep.id
    FROM public.estructuras_plan ep
    WHERE ep.tipo = COALESCE(ea.tipo, 'CURRICULAR'::public.tipo_estructura_plan)
    ORDER BY ep.creado_en ASC, ep.id ASC
    LIMIT 1
  ),
  (
    SELECT ep.id
    FROM public.estructuras_plan ep
    ORDER BY ep.creado_en ASC, ep.id ASC
    LIMIT 1
  )
)
WHERE ea.estructura_plan_id IS NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.estructuras_asignatura
    WHERE estructura_plan_id IS NULL
  ) THEN
    RAISE EXCEPTION 'No se pudo vincular todas las estructuras de asignatura a una estructura de plan'
      USING ERRCODE = 'foreign_key_violation';
  END IF;
END $$;

UPDATE public.asignaturas a
SET estructura_id = child.id
FROM public.planes_estudio pe
JOIN LATERAL (
  SELECT ea.id
  FROM public.estructuras_asignatura ea
  WHERE ea.estructura_plan_id = pe.estructura_id
  ORDER BY ea.creado_en ASC, ea.id ASC
  LIMIT 1
) child ON true
WHERE pe.id = a.plan_estudio_id
  AND a.estructura_id IS NULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.asignaturas WHERE estructura_id IS NULL) THEN
    RAISE EXCEPTION 'No se pudo asignar estructura a todas las asignaturas'
      USING ERRCODE = 'not_null_violation';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.estructuras_asignatura'::regclass
      AND conname = 'estructuras_asignatura_estructura_plan_id_fkey'
  ) THEN
    ALTER TABLE public.estructuras_asignatura
      ADD CONSTRAINT estructuras_asignatura_estructura_plan_id_fkey
      FOREIGN KEY (estructura_plan_id)
      REFERENCES public.estructuras_plan(id)
      ON DELETE RESTRICT;
  END IF;
END $$;

ALTER TABLE public.estructuras_asignatura
  ALTER COLUMN estructura_plan_id SET NOT NULL;

ALTER TABLE public.asignaturas
  ALTER COLUMN estructura_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_estructuras_asignatura_estructura_plan
  ON public.estructuras_asignatura (estructura_plan_id, nombre);

CREATE OR REPLACE FUNCTION public.valor_jsonb_vacio(p_value jsonb)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT p_value IS NULL
    OR p_value = 'null'::jsonb
    OR (
      jsonb_typeof(p_value) = 'string'
      AND btrim(p_value #>> '{}') = ''
    )
    OR (
      jsonb_typeof(p_value) = 'array'
      AND jsonb_array_length(p_value) = 0
    )
    OR (
      jsonb_typeof(p_value) = 'object'
      AND p_value = '{}'::jsonb
    );
$$;

CREATE OR REPLACE FUNCTION public.propiedad_tiene_restriccion(p_prop jsonb)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT jsonb_typeof(p_prop #> ARRAY['x-acad-ia', 'restriccion']) = 'object';
$$;

CREATE OR REPLACE FUNCTION public.propiedad_restriccion_permiso(p_prop jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT COALESCE(
    NULLIF(btrim(p_prop #>> ARRAY['x-acad-ia', 'restriccion', 'permiso_edicion']), ''),
    'planes.campos_restringidos.editar'
  );
$$;

CREATE OR REPLACE FUNCTION public.propiedad_restriccion_estados(p_prop jsonb)
RETURNS text[]
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT COALESCE(
    ARRAY(
      SELECT value
      FROM jsonb_array_elements_text(
        CASE
          WHEN jsonb_typeof(p_prop #> ARRAY['x-acad-ia', 'restriccion', 'estados_editables']) = 'array'
            THEN p_prop #> ARRAY['x-acad-ia', 'restriccion', 'estados_editables']
          ELSE '[]'::jsonb
        END
      )
    ),
    ARRAY[]::text[]
  );
$$;

CREATE OR REPLACE FUNCTION public.tipo_propiedad_json_schema(p_prop jsonb)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_type jsonb;
  v_text text;
BEGIN
  IF jsonb_typeof(p_prop->'enum') = 'array' THEN
    RETURN 'string';
  END IF;

  v_type := p_prop->'type';

  IF jsonb_typeof(v_type) = 'string' THEN
    RETURN p_prop->>'type';
  END IF;

  IF jsonb_typeof(v_type) = 'array' THEN
    FOR v_text IN SELECT jsonb_array_elements_text(v_type)
    LOOP
      IF v_text IN ('integer', 'number', 'string', 'boolean', 'array', 'object') THEN
        RETURN v_text;
      END IF;
    END LOOP;
  END IF;

  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.normalizar_valor_por_propiedad(
  p_value jsonb,
  p_prop jsonb,
  p_null_invalid boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_type text := public.tipo_propiedad_json_schema(COALESCE(p_prop, '{}'::jsonb));
  v_text text;
  v_num numeric;
  v_enum jsonb;
BEGIN
  IF p_value IS NULL OR p_value = 'null'::jsonb THEN
    RETURN 'null'::jsonb;
  END IF;

  IF jsonb_typeof(p_value) = 'string' THEN
    v_text := btrim(p_value #>> '{}');
    IF v_text = '' THEN
      RETURN 'null'::jsonb;
    END IF;
  ELSE
    v_text := NULL;
  END IF;

  IF v_type = 'integer' THEN
    IF jsonb_typeof(p_value) = 'number' THEN
      RETURN to_jsonb(trunc((p_value #>> '{}')::numeric)::bigint);
    END IF;

    IF jsonb_typeof(p_value) = 'string'
      AND v_text ~ '^-?[0-9]+(\.0+)?$'
    THEN
      RETURN to_jsonb(trunc(v_text::numeric)::bigint);
    END IF;

    RETURN CASE WHEN p_null_invalid THEN 'null'::jsonb ELSE p_value END;
  END IF;

  IF v_type = 'number' THEN
    IF jsonb_typeof(p_value) = 'number' THEN
      RETURN p_value;
    END IF;

    IF jsonb_typeof(p_value) = 'string'
      AND v_text ~ '^-?([0-9]+(\.[0-9]+)?|\.[0-9]+)$'
    THEN
      v_num := v_text::numeric;
      RETURN to_jsonb(v_num);
    END IF;

    RETURN CASE WHEN p_null_invalid THEN 'null'::jsonb ELSE p_value END;
  END IF;

  IF v_type = 'string' THEN
    IF jsonb_typeof(p_value) <> 'string' THEN
      RETURN CASE WHEN p_null_invalid THEN 'null'::jsonb ELSE p_value END;
    END IF;

    v_enum := p_prop->'enum';
    IF jsonb_typeof(v_enum) = 'array'
      AND NOT EXISTS (
        SELECT 1
        FROM jsonb_array_elements_text(v_enum) item(value)
        WHERE item.value = (p_value #>> '{}')
      )
    THEN
      RETURN CASE WHEN p_null_invalid THEN 'null'::jsonb ELSE p_value END;
    END IF;
  END IF;

  RETURN p_value;
END;
$$;

CREATE OR REPLACE FUNCTION public.normalizar_datos_por_definicion(
  p_datos jsonb,
  p_definicion jsonb,
  p_null_invalid boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_datos jsonb := COALESCE(p_datos, '{}'::jsonb);
  v_properties jsonb := COALESCE(p_definicion->'properties', '{}'::jsonb);
  v_result jsonb := '{}'::jsonb;
  v_key text;
  v_prop jsonb;
BEGIN
  IF jsonb_typeof(v_datos) IS DISTINCT FROM 'object' THEN
    RETURN '{}'::jsonb;
  END IF;

  IF jsonb_typeof(v_properties) IS DISTINCT FROM 'object' THEN
    RETURN '{}'::jsonb;
  END IF;

  FOR v_key, v_prop IN SELECT key, value FROM jsonb_each(v_properties)
  LOOP
    IF v_datos ? v_key THEN
      v_result := v_result || jsonb_build_object(
        v_key,
        public.normalizar_valor_por_propiedad(v_datos->v_key, v_prop, p_null_invalid)
      );
    END IF;
  END LOOP;

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.json_schema_parcial_definicion(p_definicion jsonb)
RETURNS json
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT jsonb_build_object(
    '$schema', 'http://json-schema.org/draft-07/schema#',
    'type', 'object',
    'additionalProperties', false,
    'properties', COALESCE(
      (
        SELECT jsonb_object_agg(
          key,
          jsonb_build_object(
            'anyOf',
            jsonb_build_array(
              CASE
                WHEN jsonb_typeof(value) = 'object'
                  THEN value - 'x-acad-ia'
                ELSE '{}'::jsonb
              END,
              jsonb_build_object('type', 'null')
            )
          )
        )
        FROM jsonb_each(
          CASE
            WHEN jsonb_typeof(COALESCE(p_definicion, '{}'::jsonb)->'properties') = 'object'
              THEN COALESCE(p_definicion, '{}'::jsonb)->'properties'
            ELSE '{}'::jsonb
          END
        )
      ),
      '{}'::jsonb
    )
  )::json;
$$;

CREATE OR REPLACE FUNCTION public.datos_validos_con_definicion(
  p_definicion jsonb,
  p_datos jsonb
)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT extensions.jsonb_matches_schema(
    public.json_schema_parcial_definicion(COALESCE(p_definicion, '{}'::jsonb)),
    CASE
      WHEN jsonb_typeof(COALESCE(p_datos, '{}'::jsonb)) = 'object'
        THEN COALESCE(p_datos, '{}'::jsonb)
      ELSE '{}'::jsonb
    END
  );
$$;

CREATE OR REPLACE FUNCTION public.usuario_puede_editar_campo_plan(
  p_usuario_id uuid,
  p_plan_id uuid,
  p_clave text
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prop jsonb;
  v_estado text;
  v_permiso text;
  v_estados text[];
BEGIN
  SELECT ep.definicion->'properties'->p_clave, public.plan_estado_clave(pe.id)
  INTO v_prop, v_estado
  FROM public.planes_estudio pe
  JOIN public.estructuras_plan ep ON ep.id = pe.estructura_id
  WHERE pe.id = p_plan_id;

  IF v_prop IS NULL THEN
    RETURN false;
  END IF;

  IF NOT public.propiedad_tiene_restriccion(v_prop) THEN
    RETURN public.usuario_puede_editar_plan(p_usuario_id, p_plan_id);
  END IF;

  v_permiso := public.propiedad_restriccion_permiso(v_prop);
  v_estados := public.propiedad_restriccion_estados(v_prop);

  RETURN public.usuario_puede_acceder_plan(p_usuario_id, p_plan_id)
    AND public.usuario_tiene_permiso(p_usuario_id, v_permiso)
    AND COALESCE(v_estado = ANY(v_estados), false);
END;
$$;

CREATE OR REPLACE FUNCTION public.usuario_puede_editar_campo_asignatura(
  p_usuario_id uuid,
  p_asignatura_id uuid,
  p_clave text
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan_id uuid;
  v_prop jsonb;
  v_estado text;
  v_permiso text;
  v_estados text[];
BEGIN
  SELECT a.plan_estudio_id, ea.definicion->'properties'->p_clave
  INTO v_plan_id, v_prop
  FROM public.asignaturas a
  JOIN public.estructuras_asignatura ea ON ea.id = a.estructura_id
  WHERE a.id = p_asignatura_id;

  IF v_plan_id IS NULL OR v_prop IS NULL THEN
    RETURN false;
  END IF;

  IF NOT public.propiedad_tiene_restriccion(v_prop) THEN
    RETURN public.usuario_puede_editar_asignatura(p_usuario_id, p_asignatura_id);
  END IF;

  v_estado := public.plan_estado_clave(v_plan_id);
  v_permiso := public.propiedad_restriccion_permiso(v_prop);
  v_estados := public.propiedad_restriccion_estados(v_prop);

  RETURN public.usuario_puede_acceder_plan(p_usuario_id, v_plan_id)
    AND public.usuario_tiene_permiso(p_usuario_id, v_permiso)
    AND COALESCE(v_estado = ANY(v_estados), false);
END;
$$;

CREATE OR REPLACE FUNCTION public.authz_plan_restricted_field_write_allowed(p_plan_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT public.authz_can_access_plan(p_plan_id)
    AND EXISTS (
      SELECT 1
      FROM public.planes_estudio pe
      JOIN public.estructuras_plan ep ON ep.id = pe.estructura_id
      CROSS JOIN LATERAL jsonb_each(
        CASE
          WHEN jsonb_typeof(ep.definicion->'properties') = 'object'
            THEN ep.definicion->'properties'
          ELSE '{}'::jsonb
        END
      ) prop(key, value)
      WHERE pe.id = p_plan_id
        AND public.propiedad_tiene_restriccion(prop.value)
        AND public.authz_has_permission(public.propiedad_restriccion_permiso(prop.value))
        AND public.plan_estado_clave(p_plan_id) = ANY(public.propiedad_restriccion_estados(prop.value))
    );
$$;

CREATE OR REPLACE FUNCTION public.authz_asignatura_restricted_field_write_allowed(p_asignatura_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.asignaturas a
    WHERE a.id = p_asignatura_id
      AND public.authz_can_access_asignatura(p_asignatura_id)
      AND EXISTS (
        SELECT 1
        FROM public.estructuras_asignatura ea
        CROSS JOIN LATERAL jsonb_each(
          CASE
            WHEN jsonb_typeof(ea.definicion->'properties') = 'object'
              THEN ea.definicion->'properties'
            ELSE '{}'::jsonb
          END
        ) prop(key, value)
        WHERE ea.id = a.estructura_id
          AND public.propiedad_tiene_restriccion(prop.value)
          AND public.authz_has_permission(public.propiedad_restriccion_permiso(prop.value))
          AND public.plan_estado_clave(a.plan_estudio_id) = ANY(public.propiedad_restriccion_estados(prop.value))
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.authz_campo_plan_write_allowed(
  p_plan_id uuid,
  p_clave text
)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT public.authz_plan_write_allowed(p_plan_id)
    OR public.usuario_puede_editar_campo_plan(auth.uid(), p_plan_id, p_clave);
$$;

CREATE OR REPLACE FUNCTION public.authz_campo_asignatura_write_allowed(
  p_asignatura_id uuid,
  p_clave text
)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT public.authz_asignatura_write_allowed(p_asignatura_id)
    OR public.usuario_puede_editar_campo_asignatura(auth.uid(), p_asignatura_id, p_clave);
$$;

CREATE OR REPLACE FUNCTION public.fn_validar_asignatura_estructura_plan()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.planes_estudio pe
    JOIN public.estructuras_asignatura ea ON ea.id = NEW.estructura_id
    WHERE pe.id = NEW.plan_estudio_id
      AND ea.estructura_plan_id = pe.estructura_id
  ) THEN
    RAISE EXCEPTION 'La estructura de asignatura no pertenece a la estructura del plan'
      USING ERRCODE = 'foreign_key_violation';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_validar_datos_plan()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_def jsonb;
  v_props jsonb;
  v_old_datos jsonb := '{}'::jsonb;
  v_input_datos jsonb := '{}'::jsonb;
  v_actor uuid;
  v_key text;
  v_old_value jsonb;
  v_new_value jsonb;
  v_unknown text;
  v_has_full_write boolean;
BEGIN
  SELECT ep.definicion
  INTO v_def
  FROM public.estructuras_plan ep
  WHERE ep.id = NEW.estructura_id;

  IF v_def IS NULL THEN
    RAISE EXCEPTION 'Estructura de plan no encontrada'
      USING ERRCODE = 'foreign_key_violation';
  END IF;

  v_props := COALESCE(v_def->'properties', '{}'::jsonb);
  IF jsonb_typeof(v_props) IS DISTINCT FROM 'object' THEN
    v_props := '{}'::jsonb;
  END IF;

  v_input_datos := COALESCE(NEW.datos, '{}'::jsonb);
  IF jsonb_typeof(v_input_datos) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'Los datos del plan deben ser un objeto JSON'
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT string_agg(key, ', ' ORDER BY key)
  INTO v_unknown
  FROM jsonb_object_keys(v_input_datos) AS k(key)
  WHERE NOT (v_props ? key);

  IF v_unknown IS NOT NULL THEN
    RAISE EXCEPTION 'Los datos del plan contienen claves no definidas: %', v_unknown
      USING ERRCODE = 'check_violation';
  END IF;

  NEW.datos := public.normalizar_datos_por_definicion(v_input_datos, v_def, false);

  IF NOT public.datos_validos_con_definicion(v_def, NEW.datos) THEN
    RAISE EXCEPTION 'Los datos del plan no coinciden con su estructura'
      USING ERRCODE = 'check_violation';
  END IF;

  v_actor := COALESCE(NEW.actualizado_por, NEW.creado_por, auth.uid());

  IF TG_OP = 'UPDATE' THEN
    v_has_full_write := public.authz_plan_write_allowed(NEW.id)
      OR public.authz_is_service_role();

    IF NOT v_has_full_write
      AND (
        to_jsonb(NEW) - 'datos' - 'actualizado_en' - 'actualizado_por'
      ) IS DISTINCT FROM (
        to_jsonb(OLD) - 'datos' - 'actualizado_en' - 'actualizado_por'
      )
    THEN
      RAISE EXCEPTION 'Solo se pueden modificar datos restringidos en esta etapa'
        USING ERRCODE = '42501';
    END IF;

    v_old_datos := COALESCE(OLD.datos, '{}'::jsonb);
  END IF;

  IF TG_OP = 'INSERT' THEN
    FOR v_key IN SELECT jsonb_object_keys(NEW.datos)
    LOOP
      v_new_value := NEW.datos->v_key;
      IF public.propiedad_tiene_restriccion(v_props->v_key)
        AND NOT public.valor_jsonb_vacio(v_new_value)
        AND NOT public.usuario_puede_editar_campo_plan(v_actor, NEW.id, v_key)
      THEN
        RAISE EXCEPTION 'No tienes permiso para editar el campo restringido "%"', v_key
          USING ERRCODE = '42501';
      END IF;
    END LOOP;
  ELSIF NEW.datos IS DISTINCT FROM v_old_datos THEN
    FOR v_key IN
      SELECT DISTINCT key
      FROM (
        SELECT jsonb_object_keys(v_old_datos) AS key
        UNION ALL
        SELECT jsonb_object_keys(NEW.datos) AS key
      ) keys
    LOOP
      v_old_value := v_old_datos->v_key;
      v_new_value := NEW.datos->v_key;

      IF v_old_value IS DISTINCT FROM v_new_value
        AND public.propiedad_tiene_restriccion(v_props->v_key)
        AND NOT public.usuario_puede_editar_campo_plan(v_actor, NEW.id, v_key)
      THEN
        RAISE EXCEPTION 'No tienes permiso para editar el campo restringido "%"', v_key
          USING ERRCODE = '42501';
      END IF;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_validar_datos_asignatura()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_def jsonb;
  v_props jsonb;
  v_old_datos jsonb := '{}'::jsonb;
  v_input_datos jsonb := '{}'::jsonb;
  v_actor uuid;
  v_key text;
  v_old_value jsonb;
  v_new_value jsonb;
  v_unknown text;
  v_has_full_write boolean;
BEGIN
  SELECT ea.definicion
  INTO v_def
  FROM public.estructuras_asignatura ea
  WHERE ea.id = NEW.estructura_id;

  IF v_def IS NULL THEN
    RAISE EXCEPTION 'Estructura de asignatura no encontrada'
      USING ERRCODE = 'foreign_key_violation';
  END IF;

  v_props := COALESCE(v_def->'properties', '{}'::jsonb);
  IF jsonb_typeof(v_props) IS DISTINCT FROM 'object' THEN
    v_props := '{}'::jsonb;
  END IF;

  v_input_datos := COALESCE(NEW.datos, '{}'::jsonb);
  IF jsonb_typeof(v_input_datos) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'Los datos de la asignatura deben ser un objeto JSON'
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT string_agg(key, ', ' ORDER BY key)
  INTO v_unknown
  FROM jsonb_object_keys(v_input_datos) AS k(key)
  WHERE NOT (v_props ? key);

  IF v_unknown IS NOT NULL THEN
    RAISE EXCEPTION 'Los datos de la asignatura contienen claves no definidas: %', v_unknown
      USING ERRCODE = 'check_violation';
  END IF;

  NEW.datos := public.normalizar_datos_por_definicion(v_input_datos, v_def, false);

  IF NOT public.datos_validos_con_definicion(v_def, NEW.datos) THEN
    RAISE EXCEPTION 'Los datos de la asignatura no coinciden con su estructura'
      USING ERRCODE = 'check_violation';
  END IF;

  v_actor := COALESCE(NEW.actualizado_por, NEW.creado_por, auth.uid());

  IF TG_OP = 'UPDATE' THEN
    v_has_full_write := public.authz_asignatura_write_allowed(NEW.id)
      OR public.authz_is_service_role();

    IF NOT v_has_full_write
      AND (
        to_jsonb(NEW) - 'datos' - 'actualizado_en' - 'actualizado_por'
      ) IS DISTINCT FROM (
        to_jsonb(OLD) - 'datos' - 'actualizado_en' - 'actualizado_por'
      )
    THEN
      RAISE EXCEPTION 'Solo se pueden modificar datos restringidos en esta etapa'
        USING ERRCODE = '42501';
    END IF;

    v_old_datos := COALESCE(OLD.datos, '{}'::jsonb);
  END IF;

  IF TG_OP = 'INSERT' THEN
    FOR v_key IN SELECT jsonb_object_keys(NEW.datos)
    LOOP
      v_new_value := NEW.datos->v_key;
      IF public.propiedad_tiene_restriccion(v_props->v_key)
        AND NOT public.valor_jsonb_vacio(v_new_value)
        AND NOT public.usuario_puede_editar_campo_asignatura(v_actor, NEW.id, v_key)
      THEN
        RAISE EXCEPTION 'No tienes permiso para editar el campo restringido "%"', v_key
          USING ERRCODE = '42501';
      END IF;
    END LOOP;
  ELSIF NEW.datos IS DISTINCT FROM v_old_datos THEN
    FOR v_key IN
      SELECT DISTINCT key
      FROM (
        SELECT jsonb_object_keys(v_old_datos) AS key
        UNION ALL
        SELECT jsonb_object_keys(NEW.datos) AS key
      ) keys
    LOOP
      v_old_value := v_old_datos->v_key;
      v_new_value := NEW.datos->v_key;

      IF v_old_value IS DISTINCT FROM v_new_value
        AND public.propiedad_tiene_restriccion(v_props->v_key)
        AND NOT public.usuario_puede_editar_campo_asignatura(v_actor, NEW.id, v_key)
      THEN
        RAISE EXCEPTION 'No tienes permiso para editar el campo restringido "%"', v_key
          USING ERRCODE = '42501';
      END IF;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

-- Normaliza datos existentes antes de activar los triggers de validacion.
UPDATE public.planes_estudio p
SET datos = public.normalizar_datos_por_definicion(p.datos, ep.definicion, true)
FROM public.estructuras_plan ep
WHERE ep.id = p.estructura_id
  AND p.datos IS DISTINCT FROM public.normalizar_datos_por_definicion(p.datos, ep.definicion, true);

UPDATE public.asignaturas a
SET datos = public.normalizar_datos_por_definicion(a.datos, ea.definicion, true)
FROM public.estructuras_asignatura ea
WHERE ea.id = a.estructura_id
  AND a.datos IS DISTINCT FROM public.normalizar_datos_por_definicion(a.datos, ea.definicion, true);

ALTER TABLE public.planes_estudio ENABLE TRIGGER USER;
ALTER TABLE public.asignaturas ENABLE TRIGGER USER;

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
    datos = public.normalizar_datos_por_definicion(
      public.aplicar_operaciones_estructura_datos(p.datos, p_operaciones),
      COALESCE(p_definicion, '{}'::jsonb),
      true
    ),
    actualizado_por = v_user
  WHERE p.estructura_id = p_id
    AND public.normalizar_datos_por_definicion(
      public.aplicar_operaciones_estructura_datos(p.datos, p_operaciones),
      COALESCE(p_definicion, '{}'::jsonb),
      true
    ) IS DISTINCT FROM p.datos;

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
    datos = public.normalizar_datos_por_definicion(
      public.aplicar_operaciones_estructura_datos(a.datos, p_operaciones),
      COALESCE(p_definicion, '{}'::jsonb),
      true
    ),
    actualizado_por = v_user
  WHERE a.estructura_id = p_id
    AND public.normalizar_datos_por_definicion(
      public.aplicar_operaciones_estructura_datos(a.datos, p_operaciones),
      COALESCE(p_definicion, '{}'::jsonb),
      true
    ) IS DISTINCT FROM a.datos;

  RETURN v_row;
END;
$$;

DROP TRIGGER IF EXISTS aa_validar_datos_plan ON public.planes_estudio;
CREATE TRIGGER aa_validar_datos_plan
  BEFORE INSERT OR UPDATE OF datos, estructura_id, nombre, carrera_id, tipo_ciclo, numero_ciclos, activo, estado_actual_id
  ON public.planes_estudio
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_validar_datos_plan();

DROP TRIGGER IF EXISTS aa_validar_asignatura_estructura_plan ON public.asignaturas;
CREATE TRIGGER aa_validar_asignatura_estructura_plan
  BEFORE INSERT OR UPDATE OF plan_estudio_id, estructura_id
  ON public.asignaturas
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_validar_asignatura_estructura_plan();

DROP TRIGGER IF EXISTS aa_validar_datos_asignatura ON public.asignaturas;
CREATE TRIGGER aa_validar_datos_asignatura
  BEFORE INSERT OR UPDATE OF datos, plan_estudio_id, estructura_id, nombre, codigo, tipo, creditos, numero_ciclo, linea_plan_id, orden_celda, contenido_tematico, criterios_de_evaluacion, horas_academicas, horas_independientes, prerrequisito_asignatura_id, estado
  ON public.asignaturas
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_validar_datos_asignatura();

DROP POLICY IF EXISTS planes_estudio_restricted_update_by_scope ON public.planes_estudio;
CREATE POLICY planes_estudio_restricted_update_by_scope ON public.planes_estudio
  FOR UPDATE TO authenticated
  USING (public.authz_plan_restricted_field_write_allowed(id))
  WITH CHECK (public.authz_plan_restricted_field_write_allowed(id));

DROP POLICY IF EXISTS asignaturas_restricted_update_by_scope ON public.asignaturas;
CREATE POLICY asignaturas_restricted_update_by_scope ON public.asignaturas
  FOR UPDATE TO authenticated
  USING (public.authz_asignatura_restricted_field_write_allowed(id))
  WITH CHECK (public.authz_asignatura_restricted_field_write_allowed(id));

DROP POLICY IF EXISTS borradores_campo_insert_by_scope ON public.borradores_campo;
CREATE POLICY borradores_campo_insert_by_scope ON public.borradores_campo
  FOR INSERT TO authenticated
  WITH CHECK (
    CASE entidad
      WHEN 'plan' THEN
        public.authz_campo_plan_write_allowed(entidad_id, clave)
        OR (public.authz_is_admin() AND public.authz_can_access_plan(entidad_id))
      WHEN 'asignatura' THEN
        public.authz_campo_asignatura_write_allowed(entidad_id, clave)
        OR (public.authz_is_admin() AND public.authz_can_access_asignatura(entidad_id))
      ELSE false
    END
  );

DROP POLICY IF EXISTS borradores_campo_update_by_scope ON public.borradores_campo;
CREATE POLICY borradores_campo_update_by_scope ON public.borradores_campo
  FOR UPDATE TO authenticated
  USING (
    CASE entidad
      WHEN 'plan' THEN
        public.authz_campo_plan_write_allowed(entidad_id, clave)
        OR (public.authz_is_admin() AND public.authz_can_access_plan(entidad_id))
      WHEN 'asignatura' THEN
        public.authz_campo_asignatura_write_allowed(entidad_id, clave)
        OR (public.authz_is_admin() AND public.authz_can_access_asignatura(entidad_id))
      ELSE false
    END
  )
  WITH CHECK (
    CASE entidad
      WHEN 'plan' THEN
        public.authz_campo_plan_write_allowed(entidad_id, clave)
        OR (public.authz_is_admin() AND public.authz_can_access_plan(entidad_id))
      WHEN 'asignatura' THEN
        public.authz_campo_asignatura_write_allowed(entidad_id, clave)
        OR (public.authz_is_admin() AND public.authz_can_access_asignatura(entidad_id))
      ELSE false
    END
  );

DROP POLICY IF EXISTS borradores_campo_delete_by_scope ON public.borradores_campo;
CREATE POLICY borradores_campo_delete_by_scope ON public.borradores_campo
  FOR DELETE TO authenticated
  USING (
    CASE entidad
      WHEN 'plan' THEN
        public.authz_campo_plan_write_allowed(entidad_id, clave)
        OR (public.authz_is_admin() AND public.authz_can_access_plan(entidad_id))
      WHEN 'asignatura' THEN
        public.authz_campo_asignatura_write_allowed(entidad_id, clave)
        OR (public.authz_is_admin() AND public.authz_can_access_asignatura(entidad_id))
      ELSE false
    END
  );

REVOKE EXECUTE ON FUNCTION public.valor_jsonb_vacio(jsonb) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.propiedad_tiene_restriccion(jsonb) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.propiedad_restriccion_permiso(jsonb) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.propiedad_restriccion_estados(jsonb) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.tipo_propiedad_json_schema(jsonb) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.normalizar_valor_por_propiedad(jsonb, jsonb, boolean) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.normalizar_datos_por_definicion(jsonb, jsonb, boolean) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.json_schema_parcial_definicion(jsonb) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.datos_validos_con_definicion(jsonb, jsonb) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.usuario_puede_editar_campo_plan(uuid, uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.usuario_puede_editar_campo_asignatura(uuid, uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.authz_plan_restricted_field_write_allowed(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.authz_asignatura_restricted_field_write_allowed(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.authz_campo_plan_write_allowed(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.authz_campo_asignatura_write_allowed(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.fn_validar_asignatura_estructura_plan() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.fn_validar_datos_plan() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.fn_validar_datos_asignatura() FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.usuario_puede_editar_campo_plan(uuid, uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.usuario_puede_editar_campo_asignatura(uuid, uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.authz_plan_restricted_field_write_allowed(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.authz_asignatura_restricted_field_write_allowed(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.authz_campo_plan_write_allowed(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.authz_campo_asignatura_write_allowed(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.datos_validos_con_definicion(jsonb, jsonb) TO authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.actualizar_estructura_plan_definicion(uuid, jsonb, jsonb)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.actualizar_estructura_asignatura_definicion(uuid, jsonb, jsonb)
  TO authenticated;

COMMENT ON COLUMN public.estructuras_asignatura.estructura_plan_id
  IS 'Estructura de plan duena de esta estructura de asignatura.';
COMMENT ON FUNCTION public.json_schema_parcial_definicion(jsonb)
  IS 'Construye un JSON Schema parcial: sin required, con null permitido y additionalProperties=false.';
COMMENT ON FUNCTION public.datos_validos_con_definicion(jsonb, jsonb)
  IS 'Valida datos jsonb contra una definicion de estructura usando pg_jsonschema.';
