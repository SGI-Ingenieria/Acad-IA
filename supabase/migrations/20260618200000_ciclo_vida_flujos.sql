-- Ciclo de vida del plan de estudios y flujo de trabajo (Sección 3 de requerimientos).
-- Siembra el ciclo SEP completo de estados, las transiciones por rol, comentarios
-- por fase (plan) y a nivel materia (estilo PR), expertos/sedes hermanas, permisos,
-- RLS y notificaciones. Idempotente: usa ON CONFLICT y CREATE ... IF NOT EXISTS.
--
-- Esta migración es la fuente de verdad de estados_plan/transiciones_estado_plan;
-- por eso se removieron esos bloques de seed.sql (evita conflicto de PK/UNIQUE al
-- correr seed después de migraciones en `supabase db reset`).

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ 1. Roles faltantes para el flujo (Planeación Curricular, Coord. DHP)       ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
INSERT INTO public.roles (clave, nombre, descripcion, nivel_jerarquico, alcance_default)
VALUES
  ('PLANEACION_CURRICULAR', 'Planeación Curricular', 'Acompaña y valida la redacción curricular; enlace con la SEP', 35, 'global'),
  ('COORD_DHP', 'Coordinación de Desarrollo Humano Profesional', 'Gestiona materias de desarrollo humano profesional propagadas a los planes', 45, 'facultad')
ON CONFLICT (clave) DO UPDATE SET
  nombre = EXCLUDED.nombre,
  descripcion = EXCLUDED.descripcion,
  nivel_jerarquico = EXCLUDED.nivel_jerarquico,
  alcance_default = EXCLUDED.alcance_default;

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ 2. Permisos nuevos + matriz roles_permisos                                 ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
INSERT INTO public.permisos (clave, nombre, descripcion, grupo, orden)
VALUES
  ('comentarios.crear', 'Comentar planes y materias', 'Registrar observaciones internas por fase del flujo', 'revision', 20),
  ('asignaturas.aprobar', 'Aprobar asignaturas', 'Aprobar o devolver asignaturas en revisión', 'asignaturas', 40),
  ('expertos.gestionar', 'Gestionar expertos y sedes', 'Registrar expertos/sedes e invitarlos a participar en un plan', 'revision', 30)
ON CONFLICT (clave) DO UPDATE SET
  nombre = EXCLUDED.nombre,
  descripcion = EXCLUDED.descripcion,
  grupo = EXCLUDED.grupo,
  orden = EXCLUDED.orden;

WITH matriz(rol_clave, permiso_clave) AS (
  VALUES
    -- comentarios.crear (internos): todos los roles internos
    ('ADMIN', 'comentarios.crear'),
    ('VICERRECTOR_ACADEMICO', 'comentarios.crear'),
    ('DIRECTOR_FACULTAD', 'comentarios.crear'),
    ('SECRETARIO_ACADEMICO', 'comentarios.crear'),
    ('JEFE_CARRERA', 'comentarios.crear'),
    ('PROFESOR', 'comentarios.crear'),
    ('PLANEACION_CURRICULAR', 'comentarios.crear'),
    ('COORD_DHP', 'comentarios.crear'),
    -- asignaturas.aprobar: quien revisa materias
    ('ADMIN', 'asignaturas.aprobar'),
    ('DIRECTOR_FACULTAD', 'asignaturas.aprobar'),
    ('SECRETARIO_ACADEMICO', 'asignaturas.aprobar'),
    ('JEFE_CARRERA', 'asignaturas.aprobar'),
    -- expertos.gestionar: quien invita expertos/sedes
    ('ADMIN', 'expertos.gestionar'),
    ('DIRECTOR_FACULTAD', 'expertos.gestionar'),
    ('SECRETARIO_ACADEMICO', 'expertos.gestionar'),
    ('JEFE_CARRERA', 'expertos.gestionar'),
    -- Planeación Curricular: revisa su fase y comenta como externo a la facultad
    ('PLANEACION_CURRICULAR', 'planes.ver'),
    ('PLANEACION_CURRICULAR', 'planes.editar'),
    ('PLANEACION_CURRICULAR', 'planes.aprobar'),
    ('PLANEACION_CURRICULAR', 'asignaturas.ver'),
    ('PLANEACION_CURRICULAR', 'auditoria.ver'),
    ('PLANEACION_CURRICULAR', 'comentarios.externos.crear'),
    -- Coordinación DHP: gestiona sus materias propias
    ('COORD_DHP', 'planes.ver'),
    ('COORD_DHP', 'planes.editar'),
    ('COORD_DHP', 'asignaturas.ver'),
    ('COORD_DHP', 'asignaturas.editar'),
    ('COORD_DHP', 'asignaturas.responsables.gestionar'),
    ('COORD_DHP', 'asignaturas.aprobar'),
    ('COORD_DHP', 'auditoria.ver')
)
INSERT INTO public.roles_permisos (rol_id, permiso_id)
SELECT r.id, p.id
FROM matriz m
JOIN public.roles r ON r.clave = m.rol_clave
JOIN public.permisos p ON p.clave = m.permiso_clave
ON CONFLICT DO NOTHING;

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ 3. Estados del ciclo de vida (Req 3.3) — ciclo SEP completo                ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
-- Convenciones de `orden`:
--   pipeline lineal: 10..110 (se renderiza como timeline)
--   fuera de banda (generación IA): GENERANDO=0, FALLIDO=-10 (excluidos del timeline)
-- Se conservan los UUID de los 4 estados ya existentes (BORRADOR/REVISION/APROBADO/
-- GENERANDO) para no romper FKs de datos sembrados. El front depende de los prefijos
-- de clave 'BORRADOR%', 'GENERANDO%', 'FALLIDO%' (ver plans.api.ts / watchAIGeneration).
INSERT INTO public.estados_plan (id, clave, etiqueta, orden, es_final, color)
VALUES
  ('18f49b67-8077-4371-be6e-2019a3be3562', 'BORRADOR', 'Borrador del jefe de carrera', 10, false, '#94a3b8'),
  ('40b640aa-3ec3-430c-9eb6-90f5ceffbbf7', 'REVISION', 'En revisión de secretario académico', 20, false, '#f59e0b'),
  (gen_random_uuid(), 'REV_PLANEACION', 'En revisión de Planeación Curricular', 30, false, '#eab308'),
  (gen_random_uuid(), 'CONSULTA_EXPERTOS', 'En consulta con expertos externos', 40, false, '#a855f7'),
  (gen_random_uuid(), 'REV_SEDES', 'En revisión de otras sedes', 50, false, '#8b5cf6'),
  (gen_random_uuid(), 'CONSEJO_FACULTAD', 'En Consejo Académico de Facultad', 60, false, '#3b82f6'),
  (gen_random_uuid(), 'CONSEJO_UNIVERSITARIO', 'En Consejo Universitario', 70, false, '#2563eb'),
  (gen_random_uuid(), 'JUNTA_GOBIERNO', 'En Junta de Gobierno', 80, false, '#1d4ed8'),
  (gen_random_uuid(), 'ENVIADO_SEP', 'Enviado a SEP', 90, false, '#0ea5e9'),
  ('f01c06c2-1166-46db-9e49-5d74b4190a0e', 'APROBADO', 'Aprobado SEP', 100, true, '#22c55e'),
  (gen_random_uuid(), 'RECHAZADO', 'Rechazado', 110, true, '#ef4444'),
  ('f2abc804-1d7e-40d5-81bd-02f3a8e48f6f', 'GENERANDO', 'Generando con IA', 0, false, '#fb923c'),
  (gen_random_uuid(), 'FALLIDO', 'Generación fallida', -10, false, '#f87171')
ON CONFLICT (clave) DO UPDATE SET
  etiqueta = EXCLUDED.etiqueta,
  orden = EXCLUDED.orden,
  es_final = EXCLUDED.es_final,
  color = EXCLUDED.color;

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ 4. Transiciones del state machine (Req 3.4) — sembradas por clave          ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
-- Idempotencia: índice único por (desde, hacia, rol).
ALTER TABLE public.transiciones_estado_plan
  DROP CONSTRAINT IF EXISTS transiciones_unica;
ALTER TABLE public.transiciones_estado_plan
  ADD CONSTRAINT transiciones_unica UNIQUE (desde_estado_id, hacia_estado_id, rol_permitido_id);

-- Limpieza del atajo heredado del seed antiguo (REVISION→APROBADO por secretario),
-- que bajo la nueva semántica (REVISION = "rev. secretario", APROBADO = "Aprobado SEP")
-- saltaría todo el flujo. Las otras 2 transiciones heredadas coinciden con el
-- conjunto canónico y se conservan vía ON CONFLICT.
DELETE FROM public.transiciones_estado_plan t
USING public.estados_plan d, public.estados_plan h, public.roles r
WHERE t.desde_estado_id = d.id
  AND t.hacia_estado_id = h.id
  AND t.rol_permitido_id = r.id
  AND d.clave = 'REVISION'
  AND h.clave = 'APROBADO'
  AND r.clave = 'SECRETARIO_ACADEMICO';

-- ADMIN no requiere filas: el Edge Function permite cualquier transición a admins.
WITH flujo(desde, hacia, rol) AS (
  VALUES
    -- ── Avances ──────────────────────────────────────────────────────────────
    ('BORRADOR', 'REVISION', 'JEFE_CARRERA'),
    ('REVISION', 'REV_PLANEACION', 'SECRETARIO_ACADEMICO'),
    ('REV_PLANEACION', 'CONSULTA_EXPERTOS', 'PLANEACION_CURRICULAR'),
    ('CONSULTA_EXPERTOS', 'REV_SEDES', 'JEFE_CARRERA'),
    ('REV_SEDES', 'CONSEJO_FACULTAD', 'JEFE_CARRERA'),
    ('CONSEJO_FACULTAD', 'CONSEJO_UNIVERSITARIO', 'DIRECTOR_FACULTAD'),
    ('CONSEJO_UNIVERSITARIO', 'JUNTA_GOBIERNO', 'VICERRECTOR_ACADEMICO'),
    ('JUNTA_GOBIERNO', 'ENVIADO_SEP', 'VICERRECTOR_ACADEMICO'),
    ('ENVIADO_SEP', 'APROBADO', 'VICERRECTOR_ACADEMICO'),
    -- ── Devoluciones al borrador del jefe (revisor de la fase) ────────────────
    ('REVISION', 'BORRADOR', 'SECRETARIO_ACADEMICO'),
    ('REV_PLANEACION', 'BORRADOR', 'PLANEACION_CURRICULAR'),
    ('CONSULTA_EXPERTOS', 'BORRADOR', 'JEFE_CARRERA'),
    ('REV_SEDES', 'BORRADOR', 'JEFE_CARRERA'),
    ('CONSEJO_FACULTAD', 'BORRADOR', 'DIRECTOR_FACULTAD'),
    ('CONSEJO_UNIVERSITARIO', 'BORRADOR', 'VICERRECTOR_ACADEMICO'),
    ('JUNTA_GOBIERNO', 'BORRADOR', 'VICERRECTOR_ACADEMICO'),
    -- ── Rechazos definitivos ──────────────────────────────────────────────────
    ('CONSEJO_FACULTAD', 'RECHAZADO', 'DIRECTOR_FACULTAD'),
    ('CONSEJO_UNIVERSITARIO', 'RECHAZADO', 'VICERRECTOR_ACADEMICO'),
    ('JUNTA_GOBIERNO', 'RECHAZADO', 'VICERRECTOR_ACADEMICO'),
    ('ENVIADO_SEP', 'RECHAZADO', 'VICERRECTOR_ACADEMICO')
)
INSERT INTO public.transiciones_estado_plan (desde_estado_id, hacia_estado_id, rol_permitido_id)
SELECT d.id, h.id, r.id
FROM flujo f
JOIN public.estados_plan d ON d.clave = f.desde
JOIN public.estados_plan h ON h.clave = f.hacia
JOIN public.roles r ON r.clave = f.rol
ON CONFLICT (desde_estado_id, hacia_estado_id, rol_permitido_id) DO NOTHING;

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ 5. Comentarios por fase (plan) y a nivel materia (Req 3.5 / flujo PR)       ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
CREATE TABLE IF NOT EXISTS public.comentarios_plan (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_estudio_id uuid NOT NULL REFERENCES public.planes_estudio(id) ON DELETE CASCADE,
  estado_id uuid REFERENCES public.estados_plan(id),
  comentario_padre_id uuid REFERENCES public.comentarios_plan(id) ON DELETE CASCADE,
  autor_id uuid REFERENCES public.usuarios_app(id),
  categoria text NOT NULL DEFAULT 'INTERNO',
  cuerpo text NOT NULL,
  resuelto boolean NOT NULL DEFAULT false,
  creado_en timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT comentarios_plan_categoria_chk CHECK (categoria IN ('INTERNO', 'EXPERTO', 'SEDE'))
);
CREATE INDEX IF NOT EXISTS comentarios_plan_plan_idx
  ON public.comentarios_plan (plan_estudio_id, creado_en DESC);

CREATE TABLE IF NOT EXISTS public.comentarios_asignatura (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asignatura_id uuid NOT NULL REFERENCES public.asignaturas(id) ON DELETE CASCADE,
  comentario_padre_id uuid REFERENCES public.comentarios_asignatura(id) ON DELETE CASCADE,
  autor_id uuid REFERENCES public.usuarios_app(id),
  categoria text NOT NULL DEFAULT 'INTERNO',
  cuerpo text NOT NULL,
  resuelto boolean NOT NULL DEFAULT false,
  creado_en timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT comentarios_asignatura_categoria_chk CHECK (categoria IN ('INTERNO', 'EXPERTO', 'SEDE'))
);
CREATE INDEX IF NOT EXISTS comentarios_asignatura_asig_idx
  ON public.comentarios_asignatura (asignatura_id, creado_en DESC);

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ 6. Expertos externos y sedes hermanas (Req 3.6 / 3.7)                       ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
CREATE TABLE IF NOT EXISTS public.expertos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid REFERENCES public.usuarios_app(id) ON DELETE SET NULL,
  nombre text NOT NULL,
  institucion text,
  contacto text,
  tipo text NOT NULL DEFAULT 'EXPERTO',
  creado_por uuid REFERENCES public.usuarios_app(id),
  creado_en timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT expertos_tipo_chk CHECK (tipo IN ('EXPERTO', 'SEDE_HERMANA'))
);

CREATE TABLE IF NOT EXISTS public.plan_expertos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_estudio_id uuid NOT NULL REFERENCES public.planes_estudio(id) ON DELETE CASCADE,
  experto_id uuid NOT NULL REFERENCES public.expertos(id) ON DELETE CASCADE,
  creado_en timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT plan_expertos_unico UNIQUE (plan_estudio_id, experto_id)
);

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ 7. RLS de las tablas nuevas (sigue el patrón authz_* por permiso/alcance)  ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
ALTER TABLE public.comentarios_plan ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comentarios_asignatura ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expertos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plan_expertos ENABLE ROW LEVEL SECURITY;

-- comentarios_plan: lectura por alcance del plan; alta por permiso (interno o
-- externo); edición/baja solo del autor o admin.
CREATE POLICY comentarios_plan_select_by_scope ON public.comentarios_plan
  FOR SELECT TO authenticated
  USING (
    autor_id = auth.uid()
    OR (public.authz_has_permission('planes.ver') AND public.authz_can_access_plan(plan_estudio_id))
  );
CREATE POLICY comentarios_plan_insert_by_scope ON public.comentarios_plan
  FOR INSERT TO authenticated
  WITH CHECK (
    autor_id = auth.uid()
    AND public.authz_can_access_plan(plan_estudio_id)
    AND (
      public.authz_has_permission('comentarios.crear')
      OR public.authz_has_permission('comentarios.externos.crear')
    )
  );
CREATE POLICY comentarios_plan_update_own ON public.comentarios_plan
  FOR UPDATE TO authenticated
  USING (autor_id = auth.uid() OR public.authz_is_admin())
  WITH CHECK (autor_id = auth.uid() OR public.authz_is_admin());
CREATE POLICY comentarios_plan_delete_own ON public.comentarios_plan
  FOR DELETE TO authenticated
  USING (autor_id = auth.uid() OR public.authz_is_admin());

-- comentarios_asignatura: análogo con alcance por asignatura (incluye responsable).
CREATE POLICY comentarios_asignatura_select_by_scope ON public.comentarios_asignatura
  FOR SELECT TO authenticated
  USING (
    autor_id = auth.uid()
    OR (public.authz_has_permission('asignaturas.ver') AND public.authz_can_access_asignatura(asignatura_id))
  );
CREATE POLICY comentarios_asignatura_insert_by_scope ON public.comentarios_asignatura
  FOR INSERT TO authenticated
  WITH CHECK (
    autor_id = auth.uid()
    AND public.authz_can_access_asignatura(asignatura_id)
    AND (
      public.authz_has_permission('comentarios.crear')
      OR public.authz_has_permission('comentarios.externos.crear')
    )
  );
CREATE POLICY comentarios_asignatura_update_own ON public.comentarios_asignatura
  FOR UPDATE TO authenticated
  USING (autor_id = auth.uid() OR public.authz_is_admin())
  WITH CHECK (autor_id = auth.uid() OR public.authz_is_admin());
CREATE POLICY comentarios_asignatura_delete_own ON public.comentarios_asignatura
  FOR DELETE TO authenticated
  USING (autor_id = auth.uid() OR public.authz_is_admin());

-- expertos: visible para quien los gestiona, el propio experto, o un revisor con
-- acceso a un plan donde participa. Administración por permiso expertos.gestionar.
CREATE POLICY expertos_select_by_scope ON public.expertos
  FOR SELECT TO authenticated
  USING (
    usuario_id = auth.uid()
    OR public.authz_has_permission('expertos.gestionar')
    OR EXISTS (
      SELECT 1 FROM public.plan_expertos pe
      WHERE pe.experto_id = expertos.id
        AND public.authz_has_permission('planes.ver')
        AND public.authz_can_access_plan(pe.plan_estudio_id)
    )
  );
CREATE POLICY expertos_manage_by_permission ON public.expertos
  FOR ALL TO authenticated
  USING (public.authz_has_permission('expertos.gestionar'))
  WITH CHECK (public.authz_has_permission('expertos.gestionar'));

-- plan_expertos: lectura por alcance del plan; administración por expertos.gestionar.
CREATE POLICY plan_expertos_select_by_scope ON public.plan_expertos
  FOR SELECT TO authenticated
  USING (public.authz_has_permission('planes.ver') AND public.authz_can_access_plan(plan_estudio_id));
CREATE POLICY plan_expertos_manage_by_scope ON public.plan_expertos
  FOR ALL TO authenticated
  USING (public.authz_has_permission('expertos.gestionar') AND public.authz_can_access_plan(plan_estudio_id))
  WITH CHECK (public.authz_has_permission('expertos.gestionar') AND public.authz_can_access_plan(plan_estudio_id));

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'comentarios_plan',
    'comentarios_asignatura',
    'expertos',
    'plan_expertos'
  ] LOOP
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.%I TO authenticated', t);
  END LOOP;
END $$;

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ 8. Notificaciones (Req 7) — triggers SECURITY DEFINER                       ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
-- Cambio de estado del plan → notifica a los asignados (excepto al actor).
CREATE OR REPLACE FUNCTION public.fn_notificar_cambio_estado_plan()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF NEW.estado_actual_id IS DISTINCT FROM OLD.estado_actual_id THEN
    INSERT INTO public.notificaciones (usuario_id, tipo, payload)
    SELECT DISTINCT t.asignado_a, 'ESTADO_CAMBIADO'::public.tipo_notificacion,
      jsonb_build_object('plan_estudio_id', NEW.id, 'estado_id', NEW.estado_actual_id)
    FROM public.tareas_revision t
    WHERE t.plan_estudio_id = NEW.id
      AND t.asignado_a IS NOT NULL
      AND t.asignado_a <> COALESCE(NEW.actualizado_por, '00000000-0000-0000-0000-000000000000'::uuid);
  END IF;
  RETURN NEW;
END;
$function$;
DROP TRIGGER IF EXISTS trg_planes_notificar_estado ON public.planes_estudio;
CREATE TRIGGER trg_planes_notificar_estado
  AFTER UPDATE ON public.planes_estudio
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_notificar_cambio_estado_plan();

-- Nuevo comentario en el plan → notifica a los asignados (excepto al autor).
CREATE OR REPLACE FUNCTION public.fn_notificar_comentario_plan()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  INSERT INTO public.notificaciones (usuario_id, tipo, payload)
  SELECT DISTINCT t.asignado_a, 'COMENTARIO'::public.tipo_notificacion,
    jsonb_build_object('plan_estudio_id', NEW.plan_estudio_id, 'comentario_id', NEW.id)
  FROM public.tareas_revision t
  WHERE t.plan_estudio_id = NEW.plan_estudio_id
    AND t.asignado_a IS NOT NULL
    AND t.asignado_a <> COALESCE(NEW.autor_id, '00000000-0000-0000-0000-000000000000'::uuid);
  RETURN NEW;
END;
$function$;
DROP TRIGGER IF EXISTS trg_comentarios_plan_notificar ON public.comentarios_plan;
CREATE TRIGGER trg_comentarios_plan_notificar
  AFTER INSERT ON public.comentarios_plan
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_notificar_comentario_plan();

-- Nuevo comentario en materia → notifica a los responsables (excepto al autor).
CREATE OR REPLACE FUNCTION public.fn_notificar_comentario_asignatura()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  INSERT INTO public.notificaciones (usuario_id, tipo, payload)
  SELECT DISTINCT ra.usuario_id, 'COMENTARIO'::public.tipo_notificacion,
    jsonb_build_object('asignatura_id', NEW.asignatura_id, 'comentario_id', NEW.id)
  FROM public.responsables_asignatura ra
  WHERE ra.asignatura_id = NEW.asignatura_id
    AND ra.usuario_id IS NOT NULL
    AND ra.usuario_id <> COALESCE(NEW.autor_id, '00000000-0000-0000-0000-000000000000'::uuid);
  RETURN NEW;
END;
$function$;
DROP TRIGGER IF EXISTS trg_comentarios_asignatura_notificar ON public.comentarios_asignatura;
CREATE TRIGGER trg_comentarios_asignatura_notificar
  AFTER INSERT ON public.comentarios_asignatura
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_notificar_comentario_asignatura();

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ 9. Helpers de autorización del flujo (transiciones)                         ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
-- Alcance por usuario (sin depender de claims del JWT): para validar en el Edge
-- Function de transición, que resuelve el actor con el service role.
CREATE OR REPLACE FUNCTION public.usuario_puede_acceder_plan(p_usuario_id uuid, p_plan_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.planes_estudio pe
    JOIN public.carreras c ON c.id = pe.carrera_id
    WHERE pe.id = p_plan_id
      AND EXISTS (
        SELECT 1
        FROM public.usuarios_roles ur
        JOIN public.roles r ON r.id = ur.rol_id
        WHERE ur.usuario_id = p_usuario_id
          AND (
            (ur.facultad_id IS NULL AND ur.carrera_id IS NULL AND r.alcance_default = 'global')
            OR ur.carrera_id = pe.carrera_id
            OR ur.facultad_id = c.facultad_id
          )
      )
  );
$$;

-- ¿El usuario puede transicionar el plan a `p_hacia_estado_id`? (permiso + alcance +
-- transición válida para alguno de sus roles, o ADMIN). Usado por el Edge Function.
CREATE OR REPLACE FUNCTION public.usuario_puede_transicionar_plan(
  p_usuario_id uuid,
  p_plan_id uuid,
  p_hacia_estado_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.usuario_tiene_permiso(p_usuario_id, 'planes.aprobar')
    AND public.usuario_puede_acceder_plan(p_usuario_id, p_plan_id)
    AND (
      EXISTS (
        SELECT 1 FROM public.usuarios_roles ur
        JOIN public.roles r ON r.id = ur.rol_id
        WHERE ur.usuario_id = p_usuario_id AND r.clave = 'ADMIN'
      )
      OR EXISTS (
        SELECT 1
        FROM public.transiciones_estado_plan t
        JOIN public.planes_estudio pe ON pe.id = p_plan_id
        JOIN public.usuarios_roles ur ON ur.rol_id = t.rol_permitido_id AND ur.usuario_id = p_usuario_id
        WHERE t.desde_estado_id = pe.estado_actual_id
          AND t.hacia_estado_id = p_hacia_estado_id
      )
    );
$$;

-- Estados destino permitidos para el usuario ACTUAL (claims del JWT) desde el
-- estado actual del plan. Usado por el frontend para poblar el panel de transición.
CREATE OR REPLACE FUNCTION public.transiciones_permitidas_plan(p_plan_id uuid)
RETURNS SETOF public.estados_plan
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT e.*
  FROM public.planes_estudio pe
  JOIN public.transiciones_estado_plan t ON t.desde_estado_id = pe.estado_actual_id
  JOIN public.estados_plan e ON e.id = t.hacia_estado_id
  JOIN public.roles r ON r.id = t.rol_permitido_id
  WHERE pe.id = p_plan_id
    AND public.authz_has_permission('planes.aprobar')
    AND public.authz_can_access_plan(p_plan_id)
    AND (public.authz_is_admin() OR public.authz_has_role(r.clave))
  ORDER BY e.orden;
$$;

REVOKE ALL ON FUNCTION public.usuario_puede_acceder_plan(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.usuario_puede_transicionar_plan(uuid, uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.transiciones_permitidas_plan(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.usuario_puede_acceder_plan(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.usuario_puede_transicionar_plan(uuid, uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.transiciones_permitidas_plan(uuid) TO authenticated, service_role;

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ 10. Flujo de revisión de la materia (estilo PR): validación de transición   ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
-- asignaturas.estado es un enum fijo. Transiciones permitidas:
--   borrador  → revisada  : el profesor responsable la envía a revisión, o un
--                           revisor con asignaturas.aprobar dentro de alcance.
--   revisada  → aprobada  : un revisor (asignaturas.aprobar) la aprueba (merge).
--   revisada  → borrador  : un revisor pide cambios (reabre).
--   aprobada  → borrador  : un revisor reabre una materia aprobada.
CREATE OR REPLACE FUNCTION public.usuario_puede_transicionar_asignatura(
  p_usuario_id uuid,
  p_asignatura_id uuid,
  p_nuevo_estado public.estado_asignatura
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH a AS (
    SELECT estado, plan_estudio_id FROM public.asignaturas WHERE id = p_asignatura_id
  )
  SELECT CASE
    WHEN p_nuevo_estado = 'revisada' THEN
      (SELECT estado FROM a) = 'borrador'
      AND (
        EXISTS (
          SELECT 1 FROM public.responsables_asignatura ra
          WHERE ra.asignatura_id = p_asignatura_id AND ra.usuario_id = p_usuario_id
        )
        OR (
          public.usuario_tiene_permiso(p_usuario_id, 'asignaturas.aprobar')
          AND public.usuario_puede_acceder_plan(
            p_usuario_id, (SELECT plan_estudio_id FROM a)
          )
        )
      )
    WHEN p_nuevo_estado = 'aprobada' THEN
      (SELECT estado FROM a) = 'revisada'
      AND public.usuario_tiene_permiso(p_usuario_id, 'asignaturas.aprobar')
      AND public.usuario_puede_acceder_plan(p_usuario_id, (SELECT plan_estudio_id FROM a))
    WHEN p_nuevo_estado = 'borrador' THEN
      (SELECT estado FROM a) IN ('revisada', 'aprobada')
      AND public.usuario_tiene_permiso(p_usuario_id, 'asignaturas.aprobar')
      AND public.usuario_puede_acceder_plan(p_usuario_id, (SELECT plan_estudio_id FROM a))
    ELSE false
  END;
$$;

REVOKE ALL ON FUNCTION public.usuario_puede_transicionar_asignatura(uuid, uuid, public.estado_asignatura) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.usuario_puede_transicionar_asignatura(uuid, uuid, public.estado_asignatura) TO authenticated, service_role;
