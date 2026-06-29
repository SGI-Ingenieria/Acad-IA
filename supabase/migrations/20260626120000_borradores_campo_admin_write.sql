-- Fix: los administradores no podían guardar/borrar borradores de campo en
-- planes/asignaturas "congelados" (fuera de su etapa normal de edición).
--
-- La UI habilita la edición para un ADMIN vía el "override administrativo"
-- (planCapabilities.canEditWithOverride), por lo que el editor abre y
-- autoguarda un borrador al cerrarse. Sin embargo, las políticas de escritura
-- de borradores_campo usaban authz_plan_write_allowed(), que exige el header
-- x-admin-override-reason. El cliente de borradores (drafts.api.ts) no envía
-- ese header, así que el INSERT/UPDATE/DELETE fallaba con 42501.
--
-- Un borrador es espacio de trabajo temporal, no el dato oficial: la escritura
-- auditada (con motivo de override) sigue siendo el paso "Aplicar" sobre la
-- entidad real. Por eso aquí basta con permitir al ADMIN que puede ACCEDER a la
-- entidad, sin exigir el header de motivo (que provocaría un prompt en cada
-- autoguardado). El caso 'asignatura' además no tenía ninguna ruta de admin.

DROP POLICY IF EXISTS borradores_campo_insert_by_scope ON public.borradores_campo;
CREATE POLICY borradores_campo_insert_by_scope ON public.borradores_campo
  FOR INSERT TO authenticated
  WITH CHECK (
    CASE entidad
      WHEN 'plan' THEN
        public.usuario_puede_editar_plan(auth.uid(), entidad_id)
        OR (public.authz_is_admin() AND public.authz_can_access_plan(entidad_id))
      WHEN 'asignatura' THEN
        public.usuario_puede_editar_asignatura(auth.uid(), entidad_id)
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
        public.usuario_puede_editar_plan(auth.uid(), entidad_id)
        OR (public.authz_is_admin() AND public.authz_can_access_plan(entidad_id))
      WHEN 'asignatura' THEN
        public.usuario_puede_editar_asignatura(auth.uid(), entidad_id)
        OR (public.authz_is_admin() AND public.authz_can_access_asignatura(entidad_id))
      ELSE false
    END
  )
  WITH CHECK (
    CASE entidad
      WHEN 'plan' THEN
        public.usuario_puede_editar_plan(auth.uid(), entidad_id)
        OR (public.authz_is_admin() AND public.authz_can_access_plan(entidad_id))
      WHEN 'asignatura' THEN
        public.usuario_puede_editar_asignatura(auth.uid(), entidad_id)
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
        public.usuario_puede_editar_plan(auth.uid(), entidad_id)
        OR (public.authz_is_admin() AND public.authz_can_access_plan(entidad_id))
      WHEN 'asignatura' THEN
        public.usuario_puede_editar_asignatura(auth.uid(), entidad_id)
        OR (public.authz_is_admin() AND public.authz_can_access_asignatura(entidad_id))
      ELSE false
    END
  );
