-- Performance Advisor remediation:
--   * unindexed_foreign_keys (INFO)  -> add covering indexes for every FK
--   * auth_rls_initplan (WARN)       -> wrap auth.<fn>() calls in (select ...) so
--                                       they are evaluated once per query, not per row
--   * multiple_permissive_policies (WARN)
--                                    -> a single FOR ALL policy that overlaps a
--                                       dedicated SELECT policy is split into
--                                       INSERT/UPDATE/DELETE; the ALL policy's read
--                                       branch is folded into the SELECT policy with
--                                       OR so read access is byte-for-byte identical.
--                                       Duplicate UPDATE policies are merged with OR.
--
-- Semantics are preserved exactly: permissive policies are OR-combined, so folding a
-- FOR ALL USING clause into the SELECT policy reproduces the previous read behaviour,
-- and the split INSERT/UPDATE/DELETE policies reuse the original USING/CHECK verbatim.

-- ---------------------------------------------------------------------------
-- Part A: covering indexes for unindexed foreign keys
-- ---------------------------------------------------------------------------
create index if not exists archivos_creado_por_idx on public.archivos (creado_por);
create index if not exists archivos_repositorios_repositorio_id_idx on public.archivos_repositorios (repositorio_id);
create index if not exists asignatura_mensajes_ia_conversacion_asignatura_id_idx on public.asignatura_mensajes_ia (conversacion_asignatura_id);
create index if not exists asignaturas_actualizado_por_idx on public.asignaturas (actualizado_por);
create index if not exists asignaturas_creado_por_idx on public.asignaturas (creado_por);
create index if not exists asignaturas_estructura_id_idx on public.asignaturas (estructura_id);
create index if not exists asignaturas_linea_plan_id_plan_estudio_id_idx on public.asignaturas (linea_plan_id, plan_estudio_id);
create index if not exists bibliografia_asignatura_creado_por_idx on public.bibliografia_asignatura (creado_por);
create index if not exists borradores_campo_actualizado_por_idx on public.borradores_campo (actualizado_por);
create index if not exists borradores_campo_creado_por_idx on public.borradores_campo (creado_por);
create index if not exists cambios_asignatura_asignatura_id_idx on public.cambios_asignatura (asignatura_id);
create index if not exists cambios_asignatura_cambiado_por_idx on public.cambios_asignatura (cambiado_por);
create index if not exists cambios_plan_cambiado_por_idx on public.cambios_plan (cambiado_por);
create index if not exists carreras_actualizado_por_idx on public.carreras (actualizado_por);
create index if not exists carreras_creado_por_idx on public.carreras (creado_por);
create index if not exists carreras_facultad_id_idx on public.carreras (facultad_id);
create index if not exists comentarios_asignatura_autor_id_idx on public.comentarios_asignatura (autor_id);
create index if not exists comentarios_asignatura_comentario_padre_id_idx on public.comentarios_asignatura (comentario_padre_id);
create index if not exists comentarios_plan_autor_id_idx on public.comentarios_plan (autor_id);
create index if not exists comentarios_plan_comentario_padre_id_idx on public.comentarios_plan (comentario_padre_id);
create index if not exists comentarios_plan_estado_id_idx on public.comentarios_plan (estado_id);
create index if not exists conversaciones_asignatura_archivado_por_idx on public.conversaciones_asignatura (archivado_por);
create index if not exists conversaciones_asignatura_creado_por_idx on public.conversaciones_asignatura (creado_por);
create index if not exists conversaciones_plan_archivado_por_idx on public.conversaciones_plan (archivado_por);
create index if not exists conversaciones_plan_creado_por_idx on public.conversaciones_plan (creado_por);
create index if not exists crash_reports_resuelto_por_idx on public.crash_reports (resuelto_por);
create index if not exists estructuras_asignatura_actualizado_por_idx on public.estructuras_asignatura (actualizado_por);
create index if not exists estructuras_asignatura_creado_por_idx on public.estructuras_asignatura (creado_por);
create index if not exists estructuras_plan_actualizado_por_idx on public.estructuras_plan (actualizado_por);
create index if not exists estructuras_plan_creado_por_idx on public.estructuras_plan (creado_por);
create index if not exists expertos_creado_por_idx on public.expertos (creado_por);
create index if not exists expertos_usuario_id_idx on public.expertos (usuario_id);
create index if not exists facultades_actualizado_por_idx on public.facultades (actualizado_por);
create index if not exists facultades_creado_por_idx on public.facultades (creado_por);
create index if not exists interacciones_ia_asignatura_id_idx on public.interacciones_ia (asignatura_id);
create index if not exists interacciones_ia_plan_estudio_id_idx on public.interacciones_ia (plan_estudio_id);
create index if not exists interacciones_ia_usuario_id_idx on public.interacciones_ia (usuario_id);
create index if not exists lineas_curriculares_sugeridas_actualizado_por_idx on public.lineas_curriculares_sugeridas (actualizado_por);
create index if not exists lineas_curriculares_sugeridas_creado_por_idx on public.lineas_curriculares_sugeridas (creado_por);
create index if not exists lineas_plan_actualizado_por_idx on public.lineas_plan (actualizado_por);
create index if not exists lineas_plan_creado_por_idx on public.lineas_plan (creado_por);
create index if not exists notificaciones_usuario_id_idx on public.notificaciones (usuario_id);
create index if not exists plan_expertos_experto_id_idx on public.plan_expertos (experto_id);
create index if not exists plan_mensajes_ia_conversacion_plan_id_idx on public.plan_mensajes_ia (conversacion_plan_id);
create index if not exists planes_estudio_actualizado_por_idx on public.planes_estudio (actualizado_por);
create index if not exists planes_estudio_carrera_id_idx on public.planes_estudio (carrera_id);
create index if not exists planes_estudio_creado_por_idx on public.planes_estudio (creado_por);
create index if not exists planes_estudio_estado_actual_id_idx on public.planes_estudio (estado_actual_id);
create index if not exists planes_estudio_estructura_id_idx on public.planes_estudio (estructura_id);
create index if not exists reasignaciones_reasignado_por_idx on public.reasignaciones (reasignado_por);
create index if not exists reasignaciones_usuario_destino_idx on public.reasignaciones (usuario_destino);
create index if not exists reasignaciones_usuario_origen_idx on public.reasignaciones (usuario_origen);
create index if not exists responsables_asignatura_asignado_por_idx on public.responsables_asignatura (asignado_por);
create index if not exists responsables_asignatura_usuario_id_idx on public.responsables_asignatura (usuario_id);
create index if not exists roles_permisos_permiso_id_idx on public.roles_permisos (permiso_id);
create index if not exists tareas_revision_asignado_a_idx on public.tareas_revision (asignado_a);
create index if not exists tareas_revision_creado_por_idx on public.tareas_revision (creado_por);
create index if not exists tareas_revision_estado_id_idx on public.tareas_revision (estado_id);
create index if not exists tareas_revision_plan_estudio_id_idx on public.tareas_revision (plan_estudio_id);
create index if not exists tareas_revision_rol_id_idx on public.tareas_revision (rol_id);
create index if not exists transiciones_estado_plan_hacia_estado_id_idx on public.transiciones_estado_plan (hacia_estado_id);
create index if not exists transiciones_estado_plan_rol_permitido_id_idx on public.transiciones_estado_plan (rol_permitido_id);
create index if not exists usuarios_roles_asignado_por_idx on public.usuarios_roles (asignado_por);
create index if not exists usuarios_roles_carrera_id_idx on public.usuarios_roles (carrera_id);
create index if not exists usuarios_roles_facultad_id_idx on public.usuarios_roles (facultad_id);

-- ---------------------------------------------------------------------------
-- Part B: auth-only rewrites (wrap auth.<fn>() in (select ...))
-- These tables have no overlapping-policy warning; only the per-row auth call.
-- ---------------------------------------------------------------------------

-- carreras: only the UPDATE policy references auth.jwt()
drop policy if exists carreras_update_by_catalogos_or_plan_scope on public.carreras;
create policy carreras_update_by_catalogos_or_plan_scope on public.carreras
  as permissive for update to authenticated
  using (
    authz_has_permission('catalogos.gestionar'::text)
    or (
      authz_has_permission('planes.editar'::text)
      and (
        authz_has_global_scope()
        or (exists (
          select 1
          from jsonb_array_elements_text(
            coalesce(((select auth.jwt()) #> '{app_metadata,alcances,carreras}'::text[]), '[]'::jsonb)
          ) alcance(value)
          where alcance.value = (carreras.id)::text
        ))
        or authz_can_access_facultad(facultad_id)
      )
    )
  )
  with check (
    authz_has_permission('catalogos.gestionar'::text)
    or (
      authz_has_permission('planes.editar'::text)
      and (
        authz_has_global_scope()
        or (exists (
          select 1
          from jsonb_array_elements_text(
            coalesce(((select auth.jwt()) #> '{app_metadata,alcances,carreras}'::text[]), '[]'::jsonb)
          ) alcance(value)
          where alcance.value = (carreras.id)::text
        ))
        or authz_can_access_facultad(facultad_id)
      )
    )
  );

-- comentarios_asignatura
drop policy if exists comentarios_asignatura_delete_own on public.comentarios_asignatura;
create policy comentarios_asignatura_delete_own on public.comentarios_asignatura
  as permissive for delete to authenticated
  using ((autor_id = (select auth.uid())) or authz_is_admin());

drop policy if exists comentarios_asignatura_insert_by_scope on public.comentarios_asignatura;
create policy comentarios_asignatura_insert_by_scope on public.comentarios_asignatura
  as permissive for insert to authenticated
  with check (
    (autor_id = (select auth.uid()))
    and private.usuario_puede_comentar_asignatura((select auth.uid()), asignatura_id)
  );

drop policy if exists comentarios_asignatura_select_by_scope on public.comentarios_asignatura;
create policy comentarios_asignatura_select_by_scope on public.comentarios_asignatura
  as permissive for select to authenticated
  using (
    (autor_id = (select auth.uid()))
    or (authz_has_permission('asignaturas.ver'::text) and authz_can_access_asignatura(asignatura_id))
  );

drop policy if exists comentarios_asignatura_update_own on public.comentarios_asignatura;
create policy comentarios_asignatura_update_own on public.comentarios_asignatura
  as permissive for update to authenticated
  using ((autor_id = (select auth.uid())) or authz_is_admin())
  with check ((autor_id = (select auth.uid())) or authz_is_admin());

-- comentarios_plan
drop policy if exists comentarios_plan_delete_own on public.comentarios_plan;
create policy comentarios_plan_delete_own on public.comentarios_plan
  as permissive for delete to authenticated
  using ((autor_id = (select auth.uid())) or authz_is_admin());

drop policy if exists comentarios_plan_insert_by_scope on public.comentarios_plan;
create policy comentarios_plan_insert_by_scope on public.comentarios_plan
  as permissive for insert to authenticated
  with check (
    (autor_id = (select auth.uid()))
    and private.usuario_puede_comentar_plan((select auth.uid()), plan_estudio_id)
  );

drop policy if exists comentarios_plan_select_by_scope on public.comentarios_plan;
create policy comentarios_plan_select_by_scope on public.comentarios_plan
  as permissive for select to authenticated
  using (
    (autor_id = (select auth.uid()))
    or (authz_has_permission('planes.ver'::text) and authz_can_access_plan(plan_estudio_id))
  );

drop policy if exists comentarios_plan_update_own on public.comentarios_plan;
create policy comentarios_plan_update_own on public.comentarios_plan
  as permissive for update to authenticated
  using ((autor_id = (select auth.uid())) or authz_is_admin())
  with check ((autor_id = (select auth.uid())) or authz_is_admin());

-- crash_reports (anon + authenticated insert)
drop policy if exists crash_reports_insert_frontend on public.crash_reports;
create policy crash_reports_insert_frontend on public.crash_reports
  as permissive for insert to authenticated, anon
  with check (
    (origen = 'frontend'::text)
    and (severidad = any (array['info'::text, 'warning'::text, 'error'::text, 'fatal'::text]))
    and ((usuario_id is null) or (usuario_id = (select auth.uid())))
    and (resuelto_en is null)
    and (resuelto_por is null)
    and (notas is null)
  );

-- notificaciones
drop policy if exists notificaciones_select_own on public.notificaciones;
create policy notificaciones_select_own on public.notificaciones
  as permissive for select to authenticated
  using (usuario_id = (select auth.uid()));

drop policy if exists notificaciones_update_own on public.notificaciones;
create policy notificaciones_update_own on public.notificaciones
  as permissive for update to authenticated
  using (usuario_id = (select auth.uid()))
  with check (usuario_id = (select auth.uid()));

-- tareas_revision
drop policy if exists tareas_revision_select_by_scope on public.tareas_revision;
create policy tareas_revision_select_by_scope on public.tareas_revision
  as permissive for select to authenticated
  using (
    (asignado_a = (select auth.uid()))
    or (authz_has_permission('planes.aprobar'::text) and authz_can_access_plan(plan_estudio_id))
  );

drop policy if exists tareas_revision_update_by_scope on public.tareas_revision;
create policy tareas_revision_update_by_scope on public.tareas_revision
  as permissive for update to authenticated
  using (
    (asignado_a = (select auth.uid()))
    or (authz_has_permission('planes.aprobar'::text) and authz_can_access_plan(plan_estudio_id))
  )
  with check (
    (asignado_a = (select auth.uid()))
    or (authz_has_permission('planes.aprobar'::text) and authz_can_access_plan(plan_estudio_id))
  );

-- usuarios_app
drop policy if exists usuarios_app_select_own_or_manage on public.usuarios_app;
create policy usuarios_app_select_own_or_manage on public.usuarios_app
  as permissive for select to authenticated
  using (
    (id = (select auth.uid()))
    or authz_has_permission('usuarios.ver'::text)
    or authz_has_permission('usuarios.gestionar'::text)
  );

drop policy if exists usuarios_app_update_own_or_manage on public.usuarios_app;
create policy usuarios_app_update_own_or_manage on public.usuarios_app
  as permissive for update to authenticated
  using ((id = (select auth.uid())) or authz_has_permission('usuarios.gestionar'::text))
  with check ((id = (select auth.uid())) or authz_has_permission('usuarios.gestionar'::text));

-- usuarios_roles (only the authenticated SELECT policy references auth.uid())
drop policy if exists usuarios_roles_select_own_or_manage on public.usuarios_roles;
create policy usuarios_roles_select_own_or_manage on public.usuarios_roles
  as permissive for select to authenticated
  using (
    (usuario_id = (select auth.uid()))
    or authz_has_permission('usuarios.ver'::text)
    or authz_has_permission('usuarios.roles.gestionar'::text)
  );

-- ---------------------------------------------------------------------------
-- Part C: split FOR ALL policies that overlap a dedicated SELECT policy.
-- The ALL policy's read branch is folded into SELECT (OR) to keep reads
-- identical; writes are reproduced as separate INSERT/UPDATE/DELETE policies.
-- auth.<fn>() calls are wrapped in (select ...) at the same time.
-- ---------------------------------------------------------------------------

-- archivos
drop policy if exists archivos_manage_by_owner_or_permission on public.archivos;
drop policy if exists archivos_select_by_owner_or_permission on public.archivos;
create policy archivos_select_by_owner_or_permission on public.archivos
  as permissive for select to authenticated
  using (
    (creado_por = (select auth.uid()))
    or authz_has_permission('archivos.ver'::text)
    or authz_has_permission('archivos.gestionar'::text)
  );
create policy archivos_insert_by_owner_or_permission on public.archivos
  as permissive for insert to authenticated
  with check ((creado_por = (select auth.uid())) or authz_has_permission('archivos.gestionar'::text));
create policy archivos_update_by_owner_or_permission on public.archivos
  as permissive for update to authenticated
  using ((creado_por = (select auth.uid())) or authz_has_permission('archivos.gestionar'::text))
  with check ((creado_por = (select auth.uid())) or authz_has_permission('archivos.gestionar'::text));
create policy archivos_delete_by_owner_or_permission on public.archivos
  as permissive for delete to authenticated
  using ((creado_por = (select auth.uid())) or authz_has_permission('archivos.gestionar'::text));

-- archivos_repositorios
drop policy if exists archivos_repositorios_manage_by_owner_or_permission on public.archivos_repositorios;
drop policy if exists archivos_repositorios_select_by_owner_or_permission on public.archivos_repositorios;
create policy archivos_repositorios_select_by_owner_or_permission on public.archivos_repositorios
  as permissive for select to authenticated
  using (
    authz_has_permission('archivos.ver'::text)
    or authz_has_permission('archivos.gestionar'::text)
    or (exists (select 1 from archivos a where ((a.id = archivos_repositorios.archivo_id) and (a.creado_por = (select auth.uid())))))
    or (exists (select 1 from repositorios r where ((r.id = archivos_repositorios.repositorio_id) and (r.enviado_por = (select auth.uid())))))
  );
create policy archivos_repositorios_insert_by_owner_or_permission on public.archivos_repositorios
  as permissive for insert to authenticated
  with check (
    authz_has_permission('archivos.gestionar'::text)
    or (exists (select 1 from archivos a where ((a.id = archivos_repositorios.archivo_id) and (a.creado_por = (select auth.uid())))))
    or (exists (select 1 from repositorios r where ((r.id = archivos_repositorios.repositorio_id) and (r.enviado_por = (select auth.uid())))))
  );
create policy archivos_repositorios_update_by_owner_or_permission on public.archivos_repositorios
  as permissive for update to authenticated
  using (
    authz_has_permission('archivos.gestionar'::text)
    or (exists (select 1 from archivos a where ((a.id = archivos_repositorios.archivo_id) and (a.creado_por = (select auth.uid())))))
    or (exists (select 1 from repositorios r where ((r.id = archivos_repositorios.repositorio_id) and (r.enviado_por = (select auth.uid())))))
  )
  with check (
    authz_has_permission('archivos.gestionar'::text)
    or (exists (select 1 from archivos a where ((a.id = archivos_repositorios.archivo_id) and (a.creado_por = (select auth.uid())))))
    or (exists (select 1 from repositorios r where ((r.id = archivos_repositorios.repositorio_id) and (r.enviado_por = (select auth.uid())))))
  );
create policy archivos_repositorios_delete_by_owner_or_permission on public.archivos_repositorios
  as permissive for delete to authenticated
  using (
    authz_has_permission('archivos.gestionar'::text)
    or (exists (select 1 from archivos a where ((a.id = archivos_repositorios.archivo_id) and (a.creado_por = (select auth.uid())))))
    or (exists (select 1 from repositorios r where ((r.id = archivos_repositorios.repositorio_id) and (r.enviado_por = (select auth.uid())))))
  );

-- asignatura_mensajes_ia
drop policy if exists asignatura_mensajes_ia_manage_by_scope on public.asignatura_mensajes_ia;
drop policy if exists asignatura_mensajes_ia_select_by_scope on public.asignatura_mensajes_ia;
create policy asignatura_mensajes_ia_select_by_scope on public.asignatura_mensajes_ia
  as permissive for select to authenticated
  using (
    (exists (
      select 1 from conversaciones_asignatura c
      where ((c.id = asignatura_mensajes_ia.conversacion_asignatura_id)
        and ((c.creado_por = (select auth.uid()))
          or (authz_has_permission('asignaturas.ver'::text) and authz_can_access_asignatura(c.asignatura_id))))
    ))
    or (exists (
      select 1 from conversaciones_asignatura c
      where ((c.id = asignatura_mensajes_ia.conversacion_asignatura_id) and authz_asignatura_ia_allowed(c.asignatura_id))
    ))
  );
create policy asignatura_mensajes_ia_insert_by_scope on public.asignatura_mensajes_ia
  as permissive for insert to authenticated
  with check (exists (
    select 1 from conversaciones_asignatura c
    where ((c.id = asignatura_mensajes_ia.conversacion_asignatura_id) and authz_asignatura_ia_allowed(c.asignatura_id))
  ));
create policy asignatura_mensajes_ia_update_by_scope on public.asignatura_mensajes_ia
  as permissive for update to authenticated
  using (exists (
    select 1 from conversaciones_asignatura c
    where ((c.id = asignatura_mensajes_ia.conversacion_asignatura_id) and authz_asignatura_ia_allowed(c.asignatura_id))
  ))
  with check (exists (
    select 1 from conversaciones_asignatura c
    where ((c.id = asignatura_mensajes_ia.conversacion_asignatura_id) and authz_asignatura_ia_allowed(c.asignatura_id))
  ));
create policy asignatura_mensajes_ia_delete_by_scope on public.asignatura_mensajes_ia
  as permissive for delete to authenticated
  using (exists (
    select 1 from conversaciones_asignatura c
    where ((c.id = asignatura_mensajes_ia.conversacion_asignatura_id) and authz_asignatura_ia_allowed(c.asignatura_id))
  ));

-- asignaturas (overlaps on SELECT and UPDATE)
drop policy if exists asignaturas_manage_by_scope on public.asignaturas;
drop policy if exists asignaturas_select_by_scope on public.asignaturas;
drop policy if exists asignaturas_restricted_update_by_scope on public.asignaturas;
create policy asignaturas_select_by_scope on public.asignaturas
  as permissive for select to authenticated
  using (
    (
      (authz_has_permission('asignaturas.ver'::text) or authz_has_permission('planes.ver'::text))
      and (authz_can_access_plan(plan_estudio_id) or private.authz_is_responsable_asignatura(id))
    )
    or authz_plan_write_allowed(plan_estudio_id)
    or authz_asignatura_write_allowed(id)
  );
create policy asignaturas_insert_by_scope on public.asignaturas
  as permissive for insert to authenticated
  with check (authz_plan_write_allowed(plan_estudio_id) or authz_asignatura_write_allowed(id));
create policy asignaturas_update_by_scope on public.asignaturas
  as permissive for update to authenticated
  using (
    authz_plan_write_allowed(plan_estudio_id)
    or authz_asignatura_write_allowed(id)
    or authz_asignatura_restricted_field_write_allowed(id)
  )
  with check (
    authz_plan_write_allowed(plan_estudio_id)
    or authz_asignatura_write_allowed(id)
    or authz_asignatura_restricted_field_write_allowed(id)
  );
create policy asignaturas_delete_by_scope on public.asignaturas
  as permissive for delete to authenticated
  using (authz_plan_write_allowed(plan_estudio_id) or authz_asignatura_write_allowed(id));

-- bibliografia_asignatura
drop policy if exists bibliografia_asignatura_manage_by_scope on public.bibliografia_asignatura;
drop policy if exists bibliografia_asignatura_select_by_scope on public.bibliografia_asignatura;
create policy bibliografia_asignatura_select_by_scope on public.bibliografia_asignatura
  as permissive for select to authenticated
  using (
    (authz_has_permission('asignaturas.ver'::text) and authz_can_access_asignatura(asignatura_id))
    or authz_asignatura_write_allowed(asignatura_id)
  );
create policy bibliografia_asignatura_insert_by_scope on public.bibliografia_asignatura
  as permissive for insert to authenticated
  with check (authz_asignatura_write_allowed(asignatura_id));
create policy bibliografia_asignatura_update_by_scope on public.bibliografia_asignatura
  as permissive for update to authenticated
  using (authz_asignatura_write_allowed(asignatura_id))
  with check (authz_asignatura_write_allowed(asignatura_id));
create policy bibliografia_asignatura_delete_by_scope on public.bibliografia_asignatura
  as permissive for delete to authenticated
  using (authz_asignatura_write_allowed(asignatura_id));

-- conversaciones_asignatura
drop policy if exists conversaciones_asignatura_manage_by_scope on public.conversaciones_asignatura;
drop policy if exists conversaciones_asignatura_select_by_scope on public.conversaciones_asignatura;
create policy conversaciones_asignatura_select_by_scope on public.conversaciones_asignatura
  as permissive for select to authenticated
  using (
    (creado_por = (select auth.uid()))
    or (authz_has_permission('asignaturas.ver'::text) and authz_can_access_asignatura(asignatura_id))
    or authz_asignatura_ia_allowed(asignatura_id)
  );
create policy conversaciones_asignatura_insert_by_scope on public.conversaciones_asignatura
  as permissive for insert to authenticated
  with check (authz_asignatura_ia_allowed(asignatura_id));
create policy conversaciones_asignatura_update_by_scope on public.conversaciones_asignatura
  as permissive for update to authenticated
  using (authz_asignatura_ia_allowed(asignatura_id))
  with check (authz_asignatura_ia_allowed(asignatura_id));
create policy conversaciones_asignatura_delete_by_scope on public.conversaciones_asignatura
  as permissive for delete to authenticated
  using (authz_asignatura_ia_allowed(asignatura_id));

-- conversaciones_plan
drop policy if exists conversaciones_plan_manage_by_scope on public.conversaciones_plan;
drop policy if exists conversaciones_plan_select_by_scope on public.conversaciones_plan;
create policy conversaciones_plan_select_by_scope on public.conversaciones_plan
  as permissive for select to authenticated
  using (
    (creado_por = (select auth.uid()))
    or (authz_has_permission('planes.ver'::text) and authz_can_access_plan(plan_estudio_id))
    or authz_plan_ia_allowed(plan_estudio_id)
  );
create policy conversaciones_plan_insert_by_scope on public.conversaciones_plan
  as permissive for insert to authenticated
  with check (authz_plan_ia_allowed(plan_estudio_id));
create policy conversaciones_plan_update_by_scope on public.conversaciones_plan
  as permissive for update to authenticated
  using (authz_plan_ia_allowed(plan_estudio_id))
  with check (authz_plan_ia_allowed(plan_estudio_id));
create policy conversaciones_plan_delete_by_scope on public.conversaciones_plan
  as permissive for delete to authenticated
  using (authz_plan_ia_allowed(plan_estudio_id));

-- expertos
drop policy if exists expertos_manage_by_permission on public.expertos;
drop policy if exists expertos_select_by_scope on public.expertos;
create policy expertos_select_by_scope on public.expertos
  as permissive for select to authenticated
  using (
    (usuario_id = (select auth.uid()))
    or authz_has_permission('expertos.gestionar'::text)
    or (exists (
      select 1 from plan_expertos pe
      where ((pe.experto_id = expertos.id) and authz_has_permission('planes.ver'::text) and authz_can_access_plan(pe.plan_estudio_id))
    ))
  );
create policy expertos_insert_by_permission on public.expertos
  as permissive for insert to authenticated
  with check (authz_has_permission('expertos.gestionar'::text));
create policy expertos_update_by_permission on public.expertos
  as permissive for update to authenticated
  using (authz_has_permission('expertos.gestionar'::text))
  with check (authz_has_permission('expertos.gestionar'::text));
create policy expertos_delete_by_permission on public.expertos
  as permissive for delete to authenticated
  using (authz_has_permission('expertos.gestionar'::text));

-- interacciones_ia
drop policy if exists interacciones_ia_manage_own on public.interacciones_ia;
drop policy if exists interacciones_ia_select_by_scope on public.interacciones_ia;
create policy interacciones_ia_select_by_scope on public.interacciones_ia
  as permissive for select to authenticated
  using (
    (usuario_id = (select auth.uid()))
    or ((plan_estudio_id is not null) and authz_has_permission('auditoria.ver'::text) and authz_can_access_plan(plan_estudio_id))
    or ((asignatura_id is not null) and authz_has_permission('auditoria.ver'::text) and authz_can_access_asignatura(asignatura_id))
    or (
      (usuario_id = (select auth.uid()))
      and ((plan_estudio_id is null) or authz_plan_ia_allowed(plan_estudio_id))
      and ((asignatura_id is null) or authz_asignatura_ia_allowed(asignatura_id))
    )
  );
create policy interacciones_ia_insert_own on public.interacciones_ia
  as permissive for insert to authenticated
  with check (
    (usuario_id = (select auth.uid()))
    and ((plan_estudio_id is null) or authz_plan_ia_allowed(plan_estudio_id))
    and ((asignatura_id is null) or authz_asignatura_ia_allowed(asignatura_id))
  );
create policy interacciones_ia_update_own on public.interacciones_ia
  as permissive for update to authenticated
  using (
    (usuario_id = (select auth.uid()))
    and ((plan_estudio_id is null) or authz_plan_ia_allowed(plan_estudio_id))
    and ((asignatura_id is null) or authz_asignatura_ia_allowed(asignatura_id))
  )
  with check (
    (usuario_id = (select auth.uid()))
    and ((plan_estudio_id is null) or authz_plan_ia_allowed(plan_estudio_id))
    and ((asignatura_id is null) or authz_asignatura_ia_allowed(asignatura_id))
  );
create policy interacciones_ia_delete_own on public.interacciones_ia
  as permissive for delete to authenticated
  using (
    (usuario_id = (select auth.uid()))
    and ((plan_estudio_id is null) or authz_plan_ia_allowed(plan_estudio_id))
    and ((asignatura_id is null) or authz_asignatura_ia_allowed(asignatura_id))
  );

-- lineas_plan
drop policy if exists lineas_plan_manage_by_scope on public.lineas_plan;
drop policy if exists lineas_plan_select_by_scope on public.lineas_plan;
create policy lineas_plan_select_by_scope on public.lineas_plan
  as permissive for select to authenticated
  using (
    (authz_has_permission('planes.ver'::text) and authz_can_access_plan(plan_estudio_id))
    or authz_plan_write_allowed(plan_estudio_id)
  );
create policy lineas_plan_insert_by_scope on public.lineas_plan
  as permissive for insert to authenticated
  with check (authz_plan_write_allowed(plan_estudio_id));
create policy lineas_plan_update_by_scope on public.lineas_plan
  as permissive for update to authenticated
  using (authz_plan_write_allowed(plan_estudio_id))
  with check (authz_plan_write_allowed(plan_estudio_id));
create policy lineas_plan_delete_by_scope on public.lineas_plan
  as permissive for delete to authenticated
  using (authz_plan_write_allowed(plan_estudio_id));

-- plan_expertos
drop policy if exists plan_expertos_manage_by_scope on public.plan_expertos;
drop policy if exists plan_expertos_select_by_scope on public.plan_expertos;
create policy plan_expertos_select_by_scope on public.plan_expertos
  as permissive for select to authenticated
  using (
    (authz_has_permission('planes.ver'::text) and authz_can_access_plan(plan_estudio_id))
    or (
      authz_has_permission('expertos.gestionar'::text)
      and authz_can_access_plan(plan_estudio_id)
      and (private.plan_estado_clave(plan_estudio_id) = any (array['CONSULTA_EXPERTOS'::text, 'REV_SEDES'::text]))
    )
  );
create policy plan_expertos_insert_by_scope on public.plan_expertos
  as permissive for insert to authenticated
  with check (
    authz_has_permission('expertos.gestionar'::text)
    and authz_can_access_plan(plan_estudio_id)
    and (private.plan_estado_clave(plan_estudio_id) = any (array['CONSULTA_EXPERTOS'::text, 'REV_SEDES'::text]))
  );
create policy plan_expertos_update_by_scope on public.plan_expertos
  as permissive for update to authenticated
  using (
    authz_has_permission('expertos.gestionar'::text)
    and authz_can_access_plan(plan_estudio_id)
    and (private.plan_estado_clave(plan_estudio_id) = any (array['CONSULTA_EXPERTOS'::text, 'REV_SEDES'::text]))
  )
  with check (
    authz_has_permission('expertos.gestionar'::text)
    and authz_can_access_plan(plan_estudio_id)
    and (private.plan_estado_clave(plan_estudio_id) = any (array['CONSULTA_EXPERTOS'::text, 'REV_SEDES'::text]))
  );
create policy plan_expertos_delete_by_scope on public.plan_expertos
  as permissive for delete to authenticated
  using (
    authz_has_permission('expertos.gestionar'::text)
    and authz_can_access_plan(plan_estudio_id)
    and (private.plan_estado_clave(plan_estudio_id) = any (array['CONSULTA_EXPERTOS'::text, 'REV_SEDES'::text]))
  );

-- plan_mensajes_ia
drop policy if exists plan_mensajes_ia_manage_by_scope on public.plan_mensajes_ia;
drop policy if exists plan_mensajes_ia_select_by_scope on public.plan_mensajes_ia;
create policy plan_mensajes_ia_select_by_scope on public.plan_mensajes_ia
  as permissive for select to authenticated
  using (
    (exists (
      select 1 from conversaciones_plan c
      where ((c.id = plan_mensajes_ia.conversacion_plan_id)
        and ((c.creado_por = (select auth.uid()))
          or (authz_has_permission('planes.ver'::text) and authz_can_access_plan(c.plan_estudio_id))))
    ))
    or (exists (
      select 1 from conversaciones_plan c
      where ((c.id = plan_mensajes_ia.conversacion_plan_id) and authz_plan_ia_allowed(c.plan_estudio_id))
    ))
  );
create policy plan_mensajes_ia_insert_by_scope on public.plan_mensajes_ia
  as permissive for insert to authenticated
  with check (exists (
    select 1 from conversaciones_plan c
    where ((c.id = plan_mensajes_ia.conversacion_plan_id) and authz_plan_ia_allowed(c.plan_estudio_id))
  ));
create policy plan_mensajes_ia_update_by_scope on public.plan_mensajes_ia
  as permissive for update to authenticated
  using (exists (
    select 1 from conversaciones_plan c
    where ((c.id = plan_mensajes_ia.conversacion_plan_id) and authz_plan_ia_allowed(c.plan_estudio_id))
  ))
  with check (exists (
    select 1 from conversaciones_plan c
    where ((c.id = plan_mensajes_ia.conversacion_plan_id) and authz_plan_ia_allowed(c.plan_estudio_id))
  ));
create policy plan_mensajes_ia_delete_by_scope on public.plan_mensajes_ia
  as permissive for delete to authenticated
  using (exists (
    select 1 from conversaciones_plan c
    where ((c.id = plan_mensajes_ia.conversacion_plan_id) and authz_plan_ia_allowed(c.plan_estudio_id))
  ));

-- repositorios
drop policy if exists repositorios_manage_by_owner_or_permission on public.repositorios;
drop policy if exists repositorios_select_by_owner_or_permission on public.repositorios;
create policy repositorios_select_by_owner_or_permission on public.repositorios
  as permissive for select to authenticated
  using (
    (enviado_por = (select auth.uid()))
    or authz_has_permission('archivos.ver'::text)
    or authz_has_permission('archivos.gestionar'::text)
  );
create policy repositorios_insert_by_owner_or_permission on public.repositorios
  as permissive for insert to authenticated
  with check ((enviado_por = (select auth.uid())) or authz_has_permission('archivos.gestionar'::text));
create policy repositorios_update_by_owner_or_permission on public.repositorios
  as permissive for update to authenticated
  using ((enviado_por = (select auth.uid())) or authz_has_permission('archivos.gestionar'::text))
  with check ((enviado_por = (select auth.uid())) or authz_has_permission('archivos.gestionar'::text));
create policy repositorios_delete_by_owner_or_permission on public.repositorios
  as permissive for delete to authenticated
  using ((enviado_por = (select auth.uid())) or authz_has_permission('archivos.gestionar'::text));

-- responsables_asignatura
drop policy if exists responsables_asignatura_manage_by_scope on public.responsables_asignatura;
drop policy if exists responsables_asignatura_select_by_scope on public.responsables_asignatura;
create policy responsables_asignatura_select_by_scope on public.responsables_asignatura
  as permissive for select to authenticated
  using (
    (usuario_id = (select auth.uid()))
    or (authz_has_permission('asignaturas.ver'::text) and authz_can_access_asignatura(asignatura_id))
    or authz_asignatura_write_allowed(asignatura_id)
  );
create policy responsables_asignatura_insert_by_scope on public.responsables_asignatura
  as permissive for insert to authenticated
  with check (authz_asignatura_write_allowed(asignatura_id));
create policy responsables_asignatura_update_by_scope on public.responsables_asignatura
  as permissive for update to authenticated
  using (authz_asignatura_write_allowed(asignatura_id))
  with check (authz_asignatura_write_allowed(asignatura_id));
create policy responsables_asignatura_delete_by_scope on public.responsables_asignatura
  as permissive for delete to authenticated
  using (authz_asignatura_write_allowed(asignatura_id));

-- ---------------------------------------------------------------------------
-- Part D: catalog-style tables — FOR ALL(manage) + SELECT(true).
-- SELECT stays `true`, so we simply split the manage policy into I/U/D.
-- ---------------------------------------------------------------------------

-- estados_plan
drop policy if exists estados_plan_manage_by_catalogos on public.estados_plan;
create policy estados_plan_insert_by_catalogos on public.estados_plan
  as permissive for insert to authenticated
  with check (authz_has_permission('catalogos.gestionar'::text));
create policy estados_plan_update_by_catalogos on public.estados_plan
  as permissive for update to authenticated
  using (authz_has_permission('catalogos.gestionar'::text))
  with check (authz_has_permission('catalogos.gestionar'::text));
create policy estados_plan_delete_by_catalogos on public.estados_plan
  as permissive for delete to authenticated
  using (authz_has_permission('catalogos.gestionar'::text));

-- estructuras_asignatura
drop policy if exists estructuras_asignatura_manage_by_catalogos on public.estructuras_asignatura;
create policy estructuras_asignatura_insert_by_catalogos on public.estructuras_asignatura
  as permissive for insert to authenticated
  with check (authz_has_permission('catalogos.gestionar'::text));
create policy estructuras_asignatura_update_by_catalogos on public.estructuras_asignatura
  as permissive for update to authenticated
  using (authz_has_permission('catalogos.gestionar'::text))
  with check (authz_has_permission('catalogos.gestionar'::text));
create policy estructuras_asignatura_delete_by_catalogos on public.estructuras_asignatura
  as permissive for delete to authenticated
  using (authz_has_permission('catalogos.gestionar'::text));

-- estructuras_plan
drop policy if exists estructuras_plan_manage_by_catalogos on public.estructuras_plan;
create policy estructuras_plan_insert_by_catalogos on public.estructuras_plan
  as permissive for insert to authenticated
  with check (authz_has_permission('catalogos.gestionar'::text));
create policy estructuras_plan_update_by_catalogos on public.estructuras_plan
  as permissive for update to authenticated
  using (authz_has_permission('catalogos.gestionar'::text))
  with check (authz_has_permission('catalogos.gestionar'::text));
create policy estructuras_plan_delete_by_catalogos on public.estructuras_plan
  as permissive for delete to authenticated
  using (authz_has_permission('catalogos.gestionar'::text));

-- facultades
drop policy if exists facultades_manage_by_catalogos on public.facultades;
create policy facultades_insert_by_catalogos on public.facultades
  as permissive for insert to authenticated
  with check (authz_has_permission('catalogos.gestionar'::text));
create policy facultades_update_by_catalogos on public.facultades
  as permissive for update to authenticated
  using (authz_has_permission('catalogos.gestionar'::text))
  with check (authz_has_permission('catalogos.gestionar'::text));
create policy facultades_delete_by_catalogos on public.facultades
  as permissive for delete to authenticated
  using (authz_has_permission('catalogos.gestionar'::text));

-- lineas_curriculares_sugeridas
drop policy if exists lineas_curriculares_sugeridas_manage_by_catalogos on public.lineas_curriculares_sugeridas;
create policy lineas_curriculares_sugeridas_insert_by_catalogos on public.lineas_curriculares_sugeridas
  as permissive for insert to authenticated
  with check (authz_has_permission('catalogos.gestionar'::text));
create policy lineas_curriculares_sugeridas_update_by_catalogos on public.lineas_curriculares_sugeridas
  as permissive for update to authenticated
  using (authz_has_permission('catalogos.gestionar'::text))
  with check (authz_has_permission('catalogos.gestionar'::text));
create policy lineas_curriculares_sugeridas_delete_by_catalogos on public.lineas_curriculares_sugeridas
  as permissive for delete to authenticated
  using (authz_has_permission('catalogos.gestionar'::text));

-- transiciones_estado_plan
drop policy if exists transiciones_estado_plan_manage_by_catalogos on public.transiciones_estado_plan;
create policy transiciones_estado_plan_insert_by_catalogos on public.transiciones_estado_plan
  as permissive for insert to authenticated
  with check (authz_has_permission('catalogos.gestionar'::text));
create policy transiciones_estado_plan_update_by_catalogos on public.transiciones_estado_plan
  as permissive for update to authenticated
  using (authz_has_permission('catalogos.gestionar'::text))
  with check (authz_has_permission('catalogos.gestionar'::text));
create policy transiciones_estado_plan_delete_by_catalogos on public.transiciones_estado_plan
  as permissive for delete to authenticated
  using (authz_has_permission('catalogos.gestionar'::text));

-- roles (manage_by_permission ALL overlaps select_authenticated on authenticated;
-- the supabase_auth_admin SELECT policy is a different role and is left untouched)
drop policy if exists roles_manage_by_permission on public.roles;
create policy roles_insert_by_permission on public.roles
  as permissive for insert to authenticated
  with check (authz_has_permission('usuarios.roles.gestionar'::text));
create policy roles_update_by_permission on public.roles
  as permissive for update to authenticated
  using (authz_has_permission('usuarios.roles.gestionar'::text))
  with check (authz_has_permission('usuarios.roles.gestionar'::text));
create policy roles_delete_by_permission on public.roles
  as permissive for delete to authenticated
  using (authz_has_permission('usuarios.roles.gestionar'::text));

-- roles_permisos
drop policy if exists roles_permisos_manage_by_permission on public.roles_permisos;
create policy roles_permisos_insert_by_permission on public.roles_permisos
  as permissive for insert to authenticated
  with check (authz_has_permission('usuarios.roles.gestionar'::text));
create policy roles_permisos_update_by_permission on public.roles_permisos
  as permissive for update to authenticated
  using (authz_has_permission('usuarios.roles.gestionar'::text))
  with check (authz_has_permission('usuarios.roles.gestionar'::text));
create policy roles_permisos_delete_by_permission on public.roles_permisos
  as permissive for delete to authenticated
  using (authz_has_permission('usuarios.roles.gestionar'::text));

-- ---------------------------------------------------------------------------
-- Part E: planes_estudio — merge the two overlapping UPDATE policies into one.
-- ---------------------------------------------------------------------------
drop policy if exists planes_estudio_update_by_scope on public.planes_estudio;
drop policy if exists planes_estudio_restricted_update_by_scope on public.planes_estudio;
create policy planes_estudio_update_by_scope on public.planes_estudio
  as permissive for update to authenticated
  using (authz_plan_write_allowed(id) or authz_plan_restricted_field_write_allowed(id))
  with check (authz_plan_write_allowed(id) or authz_plan_restricted_field_write_allowed(id));
