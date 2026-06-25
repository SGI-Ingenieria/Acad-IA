-- Completa la auditoría de asignaturas para que los cambios del mapa curricular
-- y de datos básicos de la materia aparezcan en el historial de asignatura y,
-- desde el frontend, también puedan agregarse al historial del plan.

UPDATE public.cambios_asignatura
SET fuente = CASE
  WHEN interaccion_ia_id IS NULL THEN 'HUMANO'::public.fuente_cambio
  ELSE 'IA'::public.fuente_cambio
END
WHERE fuente IS NULL;

CREATE OR REPLACE FUNCTION public.fn_track_cambios_asignatura()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  k text;
  old_val jsonb;
  new_val jsonb;
  v_interaccion_id uuid := NULL;
  v_usuario uuid;
  v_fuente public.fuente_cambio := 'HUMANO'::public.fuente_cambio;
BEGIN
  IF tg_op = 'DELETE' THEN
    v_usuario := old.actualizado_por;
  ELSE
    v_interaccion_id := nullif(new.meta_origen->>'interaccion_ia_id', '')::uuid;
    v_usuario := CASE
      WHEN tg_op = 'INSERT' THEN new.creado_por
      ELSE new.actualizado_por
    END;
    v_fuente := CASE
      WHEN v_interaccion_id IS NULL THEN 'HUMANO'::public.fuente_cambio
      ELSE 'IA'::public.fuente_cambio
    END;
  END IF;

  IF tg_op = 'INSERT' THEN
    INSERT INTO public.cambios_asignatura (
      asignatura_id, cambiado_por, tipo, valor_nuevo, fuente, interaccion_ia_id
    )
    VALUES (
      new.id, v_usuario, 'CREACION'::public.tipo_cambio, to_jsonb(new), v_fuente, v_interaccion_id
    );

    IF v_interaccion_id IS NOT NULL THEN
      new.meta_origen := new.meta_origen - 'interaccion_ia_id';
    END IF;

    RETURN new;
  END IF;

  IF tg_op = 'DELETE' THEN
    INSERT INTO public.cambios_asignatura (
      asignatura_id, cambiado_por, tipo, campo, valor_anterior, fuente
    )
    VALUES (
      old.id, v_usuario, 'OTRO'::public.tipo_cambio, 'DELETE', to_jsonb(old), 'HUMANO'::public.fuente_cambio
    );

    RETURN old;
  END IF;

  IF (new.plan_estudio_id IS DISTINCT FROM old.plan_estudio_id) THEN
    INSERT INTO public.cambios_asignatura (asignatura_id, cambiado_por, tipo, campo, valor_anterior, valor_nuevo, fuente, interaccion_ia_id)
    VALUES (new.id, v_usuario, 'ACTUALIZACION_MAPA', 'plan_estudio_id', to_jsonb(old.plan_estudio_id), to_jsonb(new.plan_estudio_id), v_fuente, v_interaccion_id);
  END IF;

  IF (new.numero_ciclo IS DISTINCT FROM old.numero_ciclo) THEN
    INSERT INTO public.cambios_asignatura (asignatura_id, cambiado_por, tipo, campo, valor_anterior, valor_nuevo, fuente, interaccion_ia_id)
    VALUES (new.id, v_usuario, 'ACTUALIZACION_MAPA', 'numero_ciclo', to_jsonb(old.numero_ciclo), to_jsonb(new.numero_ciclo), v_fuente, v_interaccion_id);
  END IF;

  IF (new.linea_plan_id IS DISTINCT FROM old.linea_plan_id) THEN
    INSERT INTO public.cambios_asignatura (asignatura_id, cambiado_por, tipo, campo, valor_anterior, valor_nuevo, fuente, interaccion_ia_id)
    VALUES (new.id, v_usuario, 'ACTUALIZACION_MAPA', 'linea_plan_id', to_jsonb(old.linea_plan_id), to_jsonb(new.linea_plan_id), v_fuente, v_interaccion_id);
  END IF;

  IF (new.orden_celda IS DISTINCT FROM old.orden_celda) THEN
    INSERT INTO public.cambios_asignatura (asignatura_id, cambiado_por, tipo, campo, valor_anterior, valor_nuevo, fuente, interaccion_ia_id)
    VALUES (new.id, v_usuario, 'ACTUALIZACION_MAPA', 'orden_celda', to_jsonb(old.orden_celda), to_jsonb(new.orden_celda), v_fuente, v_interaccion_id);
  END IF;

  IF (new.prerrequisito_asignatura_id IS DISTINCT FROM old.prerrequisito_asignatura_id) THEN
    INSERT INTO public.cambios_asignatura (asignatura_id, cambiado_por, tipo, campo, valor_anterior, valor_nuevo, fuente, interaccion_ia_id)
    VALUES (new.id, v_usuario, 'ACTUALIZACION_MAPA', 'prerrequisito_asignatura_id', to_jsonb(old.prerrequisito_asignatura_id), to_jsonb(new.prerrequisito_asignatura_id), v_fuente, v_interaccion_id);
  END IF;

  IF (new.nombre IS DISTINCT FROM old.nombre) THEN
    INSERT INTO public.cambios_asignatura (asignatura_id, cambiado_por, tipo, campo, valor_anterior, valor_nuevo, fuente, interaccion_ia_id)
    VALUES (new.id, v_usuario, 'ACTUALIZACION', 'nombre', to_jsonb(old.nombre), to_jsonb(new.nombre), v_fuente, v_interaccion_id);
  END IF;

  IF (new.codigo IS DISTINCT FROM old.codigo) THEN
    INSERT INTO public.cambios_asignatura (asignatura_id, cambiado_por, tipo, campo, valor_anterior, valor_nuevo, fuente, interaccion_ia_id)
    VALUES (new.id, v_usuario, 'ACTUALIZACION', 'codigo', to_jsonb(old.codigo), to_jsonb(new.codigo), v_fuente, v_interaccion_id);
  END IF;

  IF (new.tipo IS DISTINCT FROM old.tipo) THEN
    INSERT INTO public.cambios_asignatura (asignatura_id, cambiado_por, tipo, campo, valor_anterior, valor_nuevo, fuente, interaccion_ia_id)
    VALUES (new.id, v_usuario, 'ACTUALIZACION', 'tipo', to_jsonb(old.tipo), to_jsonb(new.tipo), v_fuente, v_interaccion_id);
  END IF;

  IF (new.estructura_id IS DISTINCT FROM old.estructura_id) THEN
    INSERT INTO public.cambios_asignatura (asignatura_id, cambiado_por, tipo, campo, valor_anterior, valor_nuevo, fuente, interaccion_ia_id)
    VALUES (new.id, v_usuario, 'ACTUALIZACION', 'estructura_id', to_jsonb(old.estructura_id), to_jsonb(new.estructura_id), v_fuente, v_interaccion_id);
  END IF;

  IF (new.creditos IS DISTINCT FROM old.creditos) THEN
    INSERT INTO public.cambios_asignatura (asignatura_id, cambiado_por, tipo, campo, valor_anterior, valor_nuevo, fuente, interaccion_ia_id)
    VALUES (new.id, v_usuario, 'ACTUALIZACION', 'creditos', to_jsonb(old.creditos), to_jsonb(new.creditos), v_fuente, v_interaccion_id);
  END IF;

  IF (new.horas_academicas IS DISTINCT FROM old.horas_academicas) THEN
    INSERT INTO public.cambios_asignatura (asignatura_id, cambiado_por, tipo, campo, valor_anterior, valor_nuevo, fuente, interaccion_ia_id)
    VALUES (new.id, v_usuario, 'ACTUALIZACION', 'horas_academicas', to_jsonb(old.horas_academicas), to_jsonb(new.horas_academicas), v_fuente, v_interaccion_id);
  END IF;

  IF (new.horas_independientes IS DISTINCT FROM old.horas_independientes) THEN
    INSERT INTO public.cambios_asignatura (asignatura_id, cambiado_por, tipo, campo, valor_anterior, valor_nuevo, fuente, interaccion_ia_id)
    VALUES (new.id, v_usuario, 'ACTUALIZACION', 'horas_independientes', to_jsonb(old.horas_independientes), to_jsonb(new.horas_independientes), v_fuente, v_interaccion_id);
  END IF;

  IF (new.datos IS DISTINCT FROM old.datos) THEN
    FOR k IN
      SELECT DISTINCT key FROM (
        SELECT jsonb_object_keys(coalesce(old.datos, '{}'::jsonb)) AS key
        UNION ALL
        SELECT jsonb_object_keys(coalesce(new.datos, '{}'::jsonb)) AS key
      ) t
    LOOP
      old_val := coalesce(old.datos, '{}'::jsonb) -> k;
      new_val := coalesce(new.datos, '{}'::jsonb) -> k;

      IF (old_val IS DISTINCT FROM new_val) THEN
        INSERT INTO public.cambios_asignatura (asignatura_id, cambiado_por, tipo, campo, valor_anterior, valor_nuevo, fuente, interaccion_ia_id)
        VALUES (new.id, v_usuario, 'ACTUALIZACION_CAMPO', k, old_val, new_val, v_fuente, v_interaccion_id);
      END IF;
    END LOOP;
  END IF;

  IF (new.criterios_de_evaluacion IS DISTINCT FROM old.criterios_de_evaluacion) THEN
    INSERT INTO public.cambios_asignatura (asignatura_id, cambiado_por, tipo, campo, valor_anterior, valor_nuevo, fuente, interaccion_ia_id)
    VALUES (new.id, v_usuario, 'ACTUALIZACION', 'criterios_de_evaluacion', old.criterios_de_evaluacion, new.criterios_de_evaluacion, v_fuente, v_interaccion_id);
  END IF;

  IF (new.contenido_tematico IS DISTINCT FROM old.contenido_tematico) THEN
    INSERT INTO public.cambios_asignatura (asignatura_id, cambiado_por, tipo, campo, valor_anterior, valor_nuevo, fuente, interaccion_ia_id)
    VALUES (new.id, v_usuario, 'ACTUALIZACION', 'contenido_tematico', old.contenido_tematico, new.contenido_tematico, v_fuente, v_interaccion_id);
  END IF;

  IF v_interaccion_id IS NOT NULL THEN
    new.meta_origen := new.meta_origen - 'interaccion_ia_id';
  END IF;

  RETURN new;
END;
$$;

-- Permite administrar la matriz rol-permiso desde la vista de administración.
-- Los permisos siguen siendo el catálogo estable; lo administrable es su
-- asignación a roles.
DROP POLICY IF EXISTS roles_permisos_manage_by_permission ON public.roles_permisos;
CREATE POLICY roles_permisos_manage_by_permission
  ON public.roles_permisos
  FOR ALL
  TO authenticated
  USING (public.authz_has_permission('usuarios.roles.gestionar'))
  WITH CHECK (public.authz_has_permission('usuarios.roles.gestionar'));

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.roles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.roles_permisos TO authenticated;
