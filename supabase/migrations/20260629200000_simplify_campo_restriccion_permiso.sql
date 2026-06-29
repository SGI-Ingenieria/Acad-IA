-- Simplificar permisos de campos restringidos.
-- El permiso para editar un campo restringido ahora hereda el permiso de edicion
-- del plan en ese estado, sin necesidad de un permiso especial separado.

-- 1. Columna que controla que estados aparecen en el selector de campos restringidos
ALTER TABLE public.estados_plan
  ADD COLUMN IF NOT EXISTS es_campo_editable boolean NOT NULL DEFAULT true;

-- 2. Marcar estados terminales y de generacion IA: no deben aparecer como opciones
UPDATE public.estados_plan SET es_campo_editable = false WHERE es_final = true;
UPDATE public.estados_plan SET es_campo_editable = false
  WHERE clave ILIKE '%GENERAN%'
     OR clave ILIKE '%GENERAT%'
     OR clave ILIKE '%FALLID%'
     OR clave ILIKE '%ARCHIV%';

-- 3. Eliminar el permiso especial de los roles (ya no se necesita)
DELETE FROM public.roles_permisos
  WHERE permiso_id = (
    SELECT id FROM public.permisos WHERE clave = 'planes.campos_restringidos.editar'
  )
  AND rol_id IN (
    SELECT id FROM public.roles WHERE clave IN ('ADMIN', 'PLANEACION_CURRICULAR')
  );

-- 4. usuario_puede_editar_campo_plan: heredar permiso estandar del plan en ese estado
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

  v_estados := public.propiedad_restriccion_estados(v_prop);

  RETURN public.usuario_puede_editar_plan(p_usuario_id, p_plan_id)
    AND COALESCE(v_estado = ANY(v_estados), false);
END;
$$;

-- 5. usuario_puede_editar_campo_asignatura: igual para asignaturas
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
  v_estados := public.propiedad_restriccion_estados(v_prop);

  RETURN public.usuario_puede_editar_plan(p_usuario_id, v_plan_id)
    AND COALESCE(v_estado = ANY(v_estados), false);
END;
$$;

-- 6. authz_plan_restricted_field_write_allowed: usar authz_plan_write_allowed
CREATE OR REPLACE FUNCTION public.authz_plan_restricted_field_write_allowed(p_plan_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT public.authz_plan_write_allowed(p_plan_id)
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
        AND public.plan_estado_clave(p_plan_id) = ANY(
          public.propiedad_restriccion_estados(prop.value)
        )
    );
$$;

-- 7. authz_asignatura_restricted_field_write_allowed: usar authz_asignatura_write_allowed
CREATE OR REPLACE FUNCTION public.authz_asignatura_restricted_field_write_allowed(p_asignatura_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.asignaturas a
    WHERE a.id = p_asignatura_id
      AND public.authz_asignatura_write_allowed(p_asignatura_id)
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
          AND public.plan_estado_clave(a.plan_estudio_id) = ANY(
            public.propiedad_restriccion_estados(prop.value)
          )
      )
  );
$$;

COMMENT ON COLUMN public.estados_plan.es_campo_editable
  IS 'Indica si este estado puede aparecer como opcion en el selector de estados editables de campos restringidos.';
