-- Endurece RLS del núcleo académico: lectura/escritura por permisos y alcance.
-- La jerarquía se resuelve desde claims de app_metadata generados por el hook.

INSERT INTO public.permisos (clave, nombre, descripcion, grupo, orden)
VALUES
  ('archivos.ver', 'Ver archivos', 'Consultar repositorios y archivos de referencia propios o compartidos', 'archivos', 10),
  ('archivos.gestionar', 'Gestionar archivos', 'Crear, actualizar y retirar repositorios y archivos de referencia', 'archivos', 20)
ON CONFLICT (clave) DO UPDATE SET
  nombre = EXCLUDED.nombre,
  descripcion = EXCLUDED.descripcion,
  grupo = EXCLUDED.grupo,
  orden = EXCLUDED.orden;

WITH matriz(rol_clave, permiso_clave) AS (
  VALUES
    ('ADMIN', 'archivos.ver'),
    ('ADMIN', 'archivos.gestionar'),
    ('DIRECTOR_FACULTAD', 'archivos.ver'),
    ('DIRECTOR_FACULTAD', 'archivos.gestionar'),
    ('SECRETARIO_ACADEMICO', 'archivos.ver'),
    ('SECRETARIO_ACADEMICO', 'archivos.gestionar'),
    ('JEFE_CARRERA', 'archivos.ver'),
    ('JEFE_CARRERA', 'archivos.gestionar'),
    ('PROFESOR', 'archivos.ver'),
    ('PROFESOR', 'archivos.gestionar')
)
INSERT INTO public.roles_permisos (rol_id, permiso_id)
SELECT r.id, p.id
FROM matriz m
JOIN public.roles r ON r.clave = m.rol_clave
JOIN public.permisos p ON p.clave = m.permiso_clave
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.authz_has_bootstrap_access()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE((auth.jwt() -> 'app_metadata' ->> 'authz_bootstrap')::boolean, false);
$$;

CREATE OR REPLACE FUNCTION public.authz_has_global_scope()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM jsonb_array_elements(COALESCE(auth.jwt() #> '{app_metadata,roles}', '[]'::jsonb)) AS rol(value)
    WHERE rol.value ->> 'facultad_id' IS NULL
      AND rol.value ->> 'carrera_id' IS NULL
      AND rol.value ->> 'alcance_default' = 'global'
  );
$$;

CREATE OR REPLACE FUNCTION public.authz_can_access_facultad(p_facultad_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT public.authz_has_global_scope()
    OR EXISTS (
      SELECT 1
      FROM jsonb_array_elements_text(
        COALESCE(auth.jwt() #> '{app_metadata,alcances,facultades}', '[]'::jsonb)
      ) AS alcance(value)
      WHERE alcance.value = p_facultad_id::text
    );
$$;

CREATE OR REPLACE FUNCTION public.authz_can_access_carrera(p_carrera_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT public.authz_has_global_scope()
    OR EXISTS (
      SELECT 1
      FROM jsonb_array_elements_text(
        COALESCE(auth.jwt() #> '{app_metadata,alcances,carreras}', '[]'::jsonb)
      ) AS alcance(value)
      WHERE alcance.value = p_carrera_id::text
    )
    OR EXISTS (
      SELECT 1
      FROM public.carreras c
      WHERE c.id = p_carrera_id
        AND public.authz_can_access_facultad(c.facultad_id)
    );
$$;

CREATE OR REPLACE FUNCTION public.authz_can_access_plan(p_plan_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.planes_estudio p
    WHERE p.id = p_plan_id
      AND public.authz_can_access_carrera(p.carrera_id)
  );
$$;

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
  );
$$;

REVOKE EXECUTE ON FUNCTION public.authz_has_bootstrap_access() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.authz_has_global_scope() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.authz_can_access_facultad(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.authz_can_access_carrera(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.authz_can_access_plan(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.authz_can_access_asignatura(uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.authz_has_bootstrap_access() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.authz_has_global_scope() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.authz_can_access_facultad(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.authz_can_access_carrera(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.authz_can_access_plan(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.authz_can_access_asignatura(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
AS $function$
DECLARE
  original_claims jsonb;
  new_claims jsonb;
  app_meta jsonb;
  claim text;
  user_id uuid;
  roles_json jsonb := '[]'::jsonb;
  roles_claves_json jsonb := '[]'::jsonb;
  permisos_json jsonb := '[]'::jsonb;
  alcances_json jsonb := '{"global": [], "facultades": [], "carreras": []}'::jsonb;
  is_bootstrap boolean := false;
BEGIN
  original_claims = event->'claims';
  new_claims = '{}'::jsonb;
  app_meta = COALESCE(original_claims->'app_metadata', '{}'::jsonb);

  SELECT NOT EXISTS (SELECT 1 FROM public.usuarios_roles)
  INTO is_bootstrap;

  IF original_claims ? 'sub' THEN
    user_id = (original_claims->>'sub')::uuid;

    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'id', ur.id,
          'rol_id', r.id,
          'clave', r.clave,
          'nombre', r.nombre,
          'nivel_jerarquico', r.nivel_jerarquico,
          'alcance_default', r.alcance_default,
          'facultad_id', ur.facultad_id,
          'carrera_id', ur.carrera_id
        )
        ORDER BY r.nivel_jerarquico, r.clave
      ),
      '[]'::jsonb
    )
    INTO roles_json
    FROM public.usuarios_roles ur
    JOIN public.roles r ON r.id = ur.rol_id
    JOIN public.usuarios_app ua ON ua.id = ur.usuario_id
    WHERE ur.usuario_id = user_id
      AND ua.dado_de_baja_en IS NULL;

    SELECT COALESCE(jsonb_agg(clave ORDER BY clave), '[]'::jsonb)
    INTO roles_claves_json
    FROM (
      SELECT DISTINCT r.clave
      FROM public.usuarios_roles ur
      JOIN public.roles r ON r.id = ur.rol_id
      JOIN public.usuarios_app ua ON ua.id = ur.usuario_id
      WHERE ur.usuario_id = user_id
        AND ua.dado_de_baja_en IS NULL
    ) s;

    SELECT COALESCE(jsonb_agg(clave ORDER BY clave), '[]'::jsonb)
    INTO permisos_json
    FROM (
      SELECT DISTINCT p.clave
      FROM public.usuarios_roles ur
      JOIN public.roles_permisos rp ON rp.rol_id = ur.rol_id
      JOIN public.permisos p ON p.id = rp.permiso_id
      JOIN public.usuarios_app ua ON ua.id = ur.usuario_id
      WHERE ur.usuario_id = user_id
        AND ua.dado_de_baja_en IS NULL
    ) s;

    SELECT jsonb_build_object(
      'global', COALESCE(jsonb_agg(DISTINCT r.clave) FILTER (WHERE ur.facultad_id IS NULL AND ur.carrera_id IS NULL), '[]'::jsonb),
      'facultades', COALESCE(jsonb_agg(DISTINCT ur.facultad_id) FILTER (WHERE ur.facultad_id IS NOT NULL), '[]'::jsonb),
      'carreras', COALESCE(jsonb_agg(DISTINCT ur.carrera_id) FILTER (WHERE ur.carrera_id IS NOT NULL), '[]'::jsonb)
    )
    INTO alcances_json
    FROM public.usuarios_roles ur
    JOIN public.roles r ON r.id = ur.rol_id
    JOIN public.usuarios_app ua ON ua.id = ur.usuario_id
    WHERE ur.usuario_id = user_id
      AND ua.dado_de_baja_en IS NULL;
  END IF;

  app_meta = app_meta || jsonb_build_object(
    'roles', roles_json,
    'roles_claves', roles_claves_json,
    'permisos', permisos_json,
    'alcances', COALESCE(alcances_json, '{"global": [], "facultades": [], "carreras": []}'::jsonb),
    'authz_bootstrap', is_bootstrap
  );

  FOREACH claim IN ARRAY ARRAY[
    'iss',
    'aud',
    'exp',
    'iat',
    'sub',
    'role',
    'aal',
    'session_id',
    'email',
    'phone',
    'is_anonymous'
  ] LOOP
    IF original_claims ? claim THEN
      new_claims = jsonb_set(new_claims, ARRAY[claim], original_claims->claim);
    END IF;
  END LOOP;

  new_claims = jsonb_set(new_claims, ARRAY['app_metadata'], app_meta);

  RETURN jsonb_build_object('claims', new_claims);
END
$function$;

REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook(jsonb) TO supabase_auth_admin;

DO $$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'archivos',
    'archivos_repositorios',
    'asignatura_mensajes_ia',
    'asignaturas',
    'bibliografia_asignatura',
    'cambios_asignatura',
    'cambios_plan',
    'carreras',
    'conversaciones_asignatura',
    'conversaciones_plan',
    'estados_plan',
    'estructuras_asignatura',
    'estructuras_plan',
    'facultades',
    'interacciones_ia',
    'lineas_plan',
    'notificaciones',
    'plan_mensajes_ia',
    'planes_estudio',
    'repositorios',
    'responsables_asignatura',
    'tareas_revision',
    'transiciones_estado_plan'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS "policy_name" ON public.%I', table_name);
  END LOOP;
END $$;

DROP POLICY IF EXISTS "Enable read access for all users" ON public.planes_estudio;

-- Catálogos: lectura autenticada; administración por permiso de catálogos.
CREATE POLICY facultades_select_authenticated ON public.facultades
  FOR SELECT TO authenticated USING (true);
CREATE POLICY facultades_manage_by_catalogos ON public.facultades
  FOR ALL TO authenticated
  USING (public.authz_has_permission('catalogos.gestionar'))
  WITH CHECK (public.authz_has_permission('catalogos.gestionar'));

CREATE POLICY carreras_select_authenticated ON public.carreras
  FOR SELECT TO authenticated USING (true);
CREATE POLICY carreras_insert_by_catalogos ON public.carreras
  FOR INSERT TO authenticated
  WITH CHECK (public.authz_has_permission('catalogos.gestionar'));
CREATE POLICY carreras_update_by_catalogos_or_plan_scope ON public.carreras
  FOR UPDATE TO authenticated
  USING (
    public.authz_has_permission('catalogos.gestionar')
    OR (
      public.authz_has_permission('planes.editar')
      AND (
        public.authz_has_global_scope()
        OR EXISTS (
          SELECT 1
          FROM jsonb_array_elements_text(
            COALESCE(auth.jwt() #> '{app_metadata,alcances,carreras}', '[]'::jsonb)
          ) AS alcance(value)
          WHERE alcance.value = id::text
        )
        OR public.authz_can_access_facultad(facultad_id)
      )
    )
  )
  WITH CHECK (
    public.authz_has_permission('catalogos.gestionar')
    OR (
      public.authz_has_permission('planes.editar')
      AND (
        public.authz_has_global_scope()
        OR EXISTS (
          SELECT 1
          FROM jsonb_array_elements_text(
            COALESCE(auth.jwt() #> '{app_metadata,alcances,carreras}', '[]'::jsonb)
          ) AS alcance(value)
          WHERE alcance.value = id::text
        )
        OR public.authz_can_access_facultad(facultad_id)
      )
    )
  );
CREATE POLICY carreras_delete_by_catalogos ON public.carreras
  FOR DELETE TO authenticated
  USING (public.authz_has_permission('catalogos.gestionar'));

CREATE POLICY estados_plan_select_authenticated ON public.estados_plan
  FOR SELECT TO authenticated USING (true);
CREATE POLICY estados_plan_manage_by_catalogos ON public.estados_plan
  FOR ALL TO authenticated
  USING (public.authz_has_permission('catalogos.gestionar'))
  WITH CHECK (public.authz_has_permission('catalogos.gestionar'));

CREATE POLICY estructuras_plan_select_authenticated ON public.estructuras_plan
  FOR SELECT TO authenticated USING (true);
CREATE POLICY estructuras_plan_manage_by_catalogos ON public.estructuras_plan
  FOR ALL TO authenticated
  USING (public.authz_has_permission('catalogos.gestionar'))
  WITH CHECK (public.authz_has_permission('catalogos.gestionar'));

CREATE POLICY estructuras_asignatura_select_authenticated ON public.estructuras_asignatura
  FOR SELECT TO authenticated USING (true);
CREATE POLICY estructuras_asignatura_manage_by_catalogos ON public.estructuras_asignatura
  FOR ALL TO authenticated
  USING (public.authz_has_permission('catalogos.gestionar'))
  WITH CHECK (public.authz_has_permission('catalogos.gestionar'));

CREATE POLICY transiciones_estado_plan_select_authenticated ON public.transiciones_estado_plan
  FOR SELECT TO authenticated USING (true);
CREATE POLICY transiciones_estado_plan_manage_by_catalogos ON public.transiciones_estado_plan
  FOR ALL TO authenticated
  USING (public.authz_has_permission('catalogos.gestionar'))
  WITH CHECK (public.authz_has_permission('catalogos.gestionar'));

-- Planes, líneas y asignaturas: permisos + alcance institucional.
CREATE POLICY planes_estudio_select_by_scope ON public.planes_estudio
  FOR SELECT TO authenticated
  USING (public.authz_has_permission('planes.ver') AND public.authz_can_access_carrera(carrera_id));
CREATE POLICY planes_estudio_insert_by_scope ON public.planes_estudio
  FOR INSERT TO authenticated
  WITH CHECK (public.authz_has_permission('planes.crear') AND public.authz_can_access_carrera(carrera_id));
CREATE POLICY planes_estudio_update_by_scope ON public.planes_estudio
  FOR UPDATE TO authenticated
  USING (
    (public.authz_has_permission('planes.editar') OR public.authz_has_permission('planes.aprobar'))
    AND public.authz_can_access_carrera(carrera_id)
  )
  WITH CHECK (
    (public.authz_has_permission('planes.editar') OR public.authz_has_permission('planes.aprobar'))
    AND public.authz_can_access_carrera(carrera_id)
  );
CREATE POLICY planes_estudio_delete_by_scope ON public.planes_estudio
  FOR DELETE TO authenticated
  USING (public.authz_has_permission('planes.editar') AND public.authz_can_access_carrera(carrera_id));

CREATE POLICY lineas_plan_select_by_scope ON public.lineas_plan
  FOR SELECT TO authenticated
  USING (public.authz_has_permission('planes.ver') AND public.authz_can_access_plan(plan_estudio_id));
CREATE POLICY lineas_plan_manage_by_scope ON public.lineas_plan
  FOR ALL TO authenticated
  USING (public.authz_has_permission('planes.editar') AND public.authz_can_access_plan(plan_estudio_id))
  WITH CHECK (public.authz_has_permission('planes.editar') AND public.authz_can_access_plan(plan_estudio_id));

CREATE POLICY asignaturas_select_by_scope ON public.asignaturas
  FOR SELECT TO authenticated
  USING (
    (public.authz_has_permission('asignaturas.ver') OR public.authz_has_permission('planes.ver'))
    AND public.authz_can_access_plan(plan_estudio_id)
  );
CREATE POLICY asignaturas_manage_by_scope ON public.asignaturas
  FOR ALL TO authenticated
  USING (public.authz_has_permission('asignaturas.editar') AND public.authz_can_access_plan(plan_estudio_id))
  WITH CHECK (public.authz_has_permission('asignaturas.editar') AND public.authz_can_access_plan(plan_estudio_id));

CREATE POLICY responsables_asignatura_select_by_scope ON public.responsables_asignatura
  FOR SELECT TO authenticated
  USING (
    usuario_id = auth.uid()
    OR (
      public.authz_has_permission('asignaturas.ver')
      AND public.authz_can_access_asignatura(asignatura_id)
    )
  );
CREATE POLICY responsables_asignatura_manage_by_scope ON public.responsables_asignatura
  FOR ALL TO authenticated
  USING (
    public.authz_has_permission('asignaturas.responsables.gestionar')
    AND public.authz_can_access_asignatura(asignatura_id)
  )
  WITH CHECK (
    public.authz_has_permission('asignaturas.responsables.gestionar')
    AND public.authz_can_access_asignatura(asignatura_id)
  );

CREATE POLICY bibliografia_asignatura_select_by_scope ON public.bibliografia_asignatura
  FOR SELECT TO authenticated
  USING (public.authz_has_permission('asignaturas.ver') AND public.authz_can_access_asignatura(asignatura_id));
CREATE POLICY bibliografia_asignatura_manage_by_scope ON public.bibliografia_asignatura
  FOR ALL TO authenticated
  USING (public.authz_has_permission('asignaturas.editar') AND public.authz_can_access_asignatura(asignatura_id))
  WITH CHECK (public.authz_has_permission('asignaturas.editar') AND public.authz_can_access_asignatura(asignatura_id));

-- Historial: solo lectura por permiso de auditoría y alcance.
CREATE POLICY cambios_plan_select_by_scope ON public.cambios_plan
  FOR SELECT TO authenticated
  USING (
    (public.authz_has_permission('auditoria.ver') OR public.authz_has_permission('planes.ver'))
    AND public.authz_can_access_plan(plan_estudio_id)
  );
CREATE POLICY cambios_asignatura_select_by_scope ON public.cambios_asignatura
  FOR SELECT TO authenticated
  USING (
    (public.authz_has_permission('auditoria.ver') OR public.authz_has_permission('asignaturas.ver'))
    AND public.authz_can_access_asignatura(asignatura_id)
  );

-- Conversaciones e IA: autor o permiso dentro del alcance.
CREATE POLICY conversaciones_plan_select_by_scope ON public.conversaciones_plan
  FOR SELECT TO authenticated
  USING (
    creado_por = auth.uid()
    OR (public.authz_has_permission('planes.ver') AND public.authz_can_access_plan(plan_estudio_id))
  );
CREATE POLICY conversaciones_plan_manage_by_scope ON public.conversaciones_plan
  FOR ALL TO authenticated
  USING (
    creado_por = auth.uid()
    OR (public.authz_has_permission('planes.editar') AND public.authz_can_access_plan(plan_estudio_id))
  )
  WITH CHECK (
    creado_por = auth.uid()
    OR (public.authz_has_permission('planes.editar') AND public.authz_can_access_plan(plan_estudio_id))
  );

CREATE POLICY conversaciones_asignatura_select_by_scope ON public.conversaciones_asignatura
  FOR SELECT TO authenticated
  USING (
    creado_por = auth.uid()
    OR (public.authz_has_permission('asignaturas.ver') AND public.authz_can_access_asignatura(asignatura_id))
  );
CREATE POLICY conversaciones_asignatura_manage_by_scope ON public.conversaciones_asignatura
  FOR ALL TO authenticated
  USING (
    creado_por = auth.uid()
    OR (public.authz_has_permission('asignaturas.editar') AND public.authz_can_access_asignatura(asignatura_id))
  )
  WITH CHECK (
    creado_por = auth.uid()
    OR (public.authz_has_permission('asignaturas.editar') AND public.authz_can_access_asignatura(asignatura_id))
  );

CREATE POLICY plan_mensajes_ia_select_by_scope ON public.plan_mensajes_ia
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.conversaciones_plan c
      WHERE c.id = conversacion_plan_id
        AND (
          c.creado_por = auth.uid()
          OR (public.authz_has_permission('planes.ver') AND public.authz_can_access_plan(c.plan_estudio_id))
        )
    )
  );
CREATE POLICY plan_mensajes_ia_manage_by_scope ON public.plan_mensajes_ia
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.conversaciones_plan c
      WHERE c.id = conversacion_plan_id
        AND (
          c.creado_por = auth.uid()
          OR (public.authz_has_permission('planes.editar') AND public.authz_can_access_plan(c.plan_estudio_id))
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.conversaciones_plan c
      WHERE c.id = conversacion_plan_id
        AND (
          c.creado_por = auth.uid()
          OR (public.authz_has_permission('planes.editar') AND public.authz_can_access_plan(c.plan_estudio_id))
        )
    )
  );

CREATE POLICY asignatura_mensajes_ia_select_by_scope ON public.asignatura_mensajes_ia
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.conversaciones_asignatura c
      WHERE c.id = conversacion_asignatura_id
        AND (
          c.creado_por = auth.uid()
          OR (public.authz_has_permission('asignaturas.ver') AND public.authz_can_access_asignatura(c.asignatura_id))
        )
    )
  );
CREATE POLICY asignatura_mensajes_ia_manage_by_scope ON public.asignatura_mensajes_ia
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.conversaciones_asignatura c
      WHERE c.id = conversacion_asignatura_id
        AND (
          c.creado_por = auth.uid()
          OR (public.authz_has_permission('asignaturas.editar') AND public.authz_can_access_asignatura(c.asignatura_id))
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.conversaciones_asignatura c
      WHERE c.id = conversacion_asignatura_id
        AND (
          c.creado_por = auth.uid()
          OR (public.authz_has_permission('asignaturas.editar') AND public.authz_can_access_asignatura(c.asignatura_id))
        )
    )
  );

CREATE POLICY interacciones_ia_select_by_scope ON public.interacciones_ia
  FOR SELECT TO authenticated
  USING (
    usuario_id = auth.uid()
    OR (plan_estudio_id IS NOT NULL AND public.authz_has_permission('auditoria.ver') AND public.authz_can_access_plan(plan_estudio_id))
    OR (asignatura_id IS NOT NULL AND public.authz_has_permission('auditoria.ver') AND public.authz_can_access_asignatura(asignatura_id))
  );
CREATE POLICY interacciones_ia_manage_own ON public.interacciones_ia
  FOR ALL TO authenticated
  USING (usuario_id = auth.uid())
  WITH CHECK (usuario_id = auth.uid());

-- Tareas y notificaciones personales.
CREATE POLICY tareas_revision_select_by_scope ON public.tareas_revision
  FOR SELECT TO authenticated
  USING (
    asignado_a = auth.uid()
    OR (public.authz_has_permission('planes.aprobar') AND public.authz_can_access_plan(plan_estudio_id))
  );
CREATE POLICY tareas_revision_insert_by_scope ON public.tareas_revision
  FOR INSERT TO authenticated
  WITH CHECK (public.authz_has_permission('planes.aprobar') AND public.authz_can_access_plan(plan_estudio_id));
CREATE POLICY tareas_revision_update_by_scope ON public.tareas_revision
  FOR UPDATE TO authenticated
  USING (
    asignado_a = auth.uid()
    OR (public.authz_has_permission('planes.aprobar') AND public.authz_can_access_plan(plan_estudio_id))
  )
  WITH CHECK (
    asignado_a = auth.uid()
    OR (public.authz_has_permission('planes.aprobar') AND public.authz_can_access_plan(plan_estudio_id))
  );
CREATE POLICY tareas_revision_delete_by_scope ON public.tareas_revision
  FOR DELETE TO authenticated
  USING (public.authz_has_permission('planes.aprobar') AND public.authz_can_access_plan(plan_estudio_id));

CREATE POLICY notificaciones_select_own ON public.notificaciones
  FOR SELECT TO authenticated USING (usuario_id = auth.uid());
CREATE POLICY notificaciones_update_own ON public.notificaciones
  FOR UPDATE TO authenticated USING (usuario_id = auth.uid()) WITH CHECK (usuario_id = auth.uid());

-- Repositorios y archivos: propietarios o permiso de gestión de archivos.
CREATE POLICY archivos_select_by_owner_or_permission ON public.archivos
  FOR SELECT TO authenticated
  USING (creado_por = auth.uid() OR public.authz_has_permission('archivos.ver'));
CREATE POLICY archivos_manage_by_owner_or_permission ON public.archivos
  FOR ALL TO authenticated
  USING (creado_por = auth.uid() OR public.authz_has_permission('archivos.gestionar'))
  WITH CHECK (creado_por = auth.uid() OR public.authz_has_permission('archivos.gestionar'));

CREATE POLICY repositorios_select_by_owner_or_permission ON public.repositorios
  FOR SELECT TO authenticated
  USING (enviado_por = auth.uid() OR public.authz_has_permission('archivos.ver'));
CREATE POLICY repositorios_manage_by_owner_or_permission ON public.repositorios
  FOR ALL TO authenticated
  USING (enviado_por = auth.uid() OR public.authz_has_permission('archivos.gestionar'))
  WITH CHECK (enviado_por = auth.uid() OR public.authz_has_permission('archivos.gestionar'));

CREATE POLICY archivos_repositorios_select_by_owner_or_permission ON public.archivos_repositorios
  FOR SELECT TO authenticated
  USING (
    public.authz_has_permission('archivos.ver')
    OR EXISTS (
      SELECT 1
      FROM public.archivos a
      WHERE a.id = archivo_id
        AND a.creado_por = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM public.repositorios r
      WHERE r.id = repositorio_id
        AND r.enviado_por = auth.uid()
    )
  );
CREATE POLICY archivos_repositorios_manage_by_owner_or_permission ON public.archivos_repositorios
  FOR ALL TO authenticated
  USING (
    public.authz_has_permission('archivos.gestionar')
    OR EXISTS (
      SELECT 1
      FROM public.archivos a
      WHERE a.id = archivo_id
        AND a.creado_por = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM public.repositorios r
      WHERE r.id = repositorio_id
        AND r.enviado_por = auth.uid()
    )
  )
  WITH CHECK (
    public.authz_has_permission('archivos.gestionar')
    OR EXISTS (
      SELECT 1
      FROM public.archivos a
      WHERE a.id = archivo_id
        AND a.creado_por = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM public.repositorios r
      WHERE r.id = repositorio_id
        AND r.enviado_por = auth.uid()
    )
  );

DO $$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'archivos',
    'archivos_repositorios',
    'asignatura_mensajes_ia',
    'asignaturas',
    'bibliografia_asignatura',
    'cambios_asignatura',
    'cambios_plan',
    'carreras',
    'conversaciones_asignatura',
    'conversaciones_plan',
    'estados_plan',
    'estructuras_asignatura',
    'estructuras_plan',
    'facultades',
    'interacciones_ia',
    'lineas_plan',
    'notificaciones',
    'plan_mensajes_ia',
    'planes_estudio',
    'repositorios',
    'responsables_asignatura',
    'tareas_revision',
    'transiciones_estado_plan'
  ] LOOP
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon', table_name);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.%I TO authenticated', table_name);
  END LOOP;
END $$;
