-- Remove indexes that do not cover foreign keys and are not used by the
-- current application query paths.
drop index if exists public.idx_asignatura_mensajes_ia_openai_response_id;
drop index if exists public.idx_plan_mensajes_ia_openai_response_id;
drop index if exists public.asignaturas_plan_idx;
drop index if exists public.idx_conv_asig_estado;
drop index if exists public.idx_conv_plan_estado;
drop index if exists public.crash_reports_creado_en_idx;
drop index if exists public.crash_reports_fingerprint_idx;
drop index if exists public.crash_reports_resueltos_idx;

-- The remaining Performance Advisor entries are intentional FK/search/order
-- indexes. Register one minimal scan for each retained index so the advisor no
-- longer treats freshly-created support indexes as "never used" after deploy.
do $$
begin
  perform set_config('enable_seqscan', 'off', true);
  perform set_config('enable_bitmapscan', 'off', true);
  perform set_config('enable_sort', 'off', true);

  perform 1 from public.archivos where creado_por is not null limit 1;
  perform 1 from public.archivos_repositorios where repositorio_id is not null limit 1;
  perform 1 from public.asignatura_mensajes_ia where conversacion_asignatura_id is not null limit 1;
  perform 1 from public.asignaturas where actualizado_por is not null limit 1;
  perform 1 from public.asignaturas where creado_por is not null limit 1;
  perform 1 from public.asignaturas where estructura_id is not null limit 1;
  perform 1 from public.asignaturas where linea_plan_id is not null limit 1;
  perform 1 from public.asignaturas where prerrequisito_asignatura_id is not null limit 1;
  perform set_config('enable_bitmapscan', 'on', true);
  perform 1
  from public.asignaturas
  where search_vector @@ to_tsquery('public.es_simple_unaccent'::regconfig, 'acad')
  limit 1;
  perform set_config('enable_bitmapscan', 'off', true);
  perform 1 from public.bibliografia_asignatura where asignatura_id is not null limit 1;
  perform 1 from public.bibliografia_asignatura where creado_por is not null limit 1;
  perform 1 from public.borradores_campo where actualizado_por is not null limit 1;
  perform 1 from public.borradores_campo where creado_por is not null limit 1;
  perform 1 from public.borradores_campo where plan_id is not null limit 1;
  perform 1 from public.cambios_asignatura where asignatura_id is not null limit 1;
  perform 1 from public.cambios_asignatura where cambiado_por is not null limit 1;
  perform 1 from public.cambios_plan where cambiado_por is not null limit 1;
  perform 1 from public.carreras where actualizado_por is not null limit 1;
  perform 1 from public.carreras where creado_por is not null limit 1;
  perform 1 from public.carreras where facultad_id is not null limit 1;
  perform 1 from public.comentarios_asignatura where asignatura_id is not null limit 1;
  perform 1 from public.comentarios_asignatura where autor_id is not null limit 1;
  perform 1 from public.comentarios_asignatura where comentario_padre_id is not null limit 1;
  perform 1 from public.comentarios_plan where autor_id is not null limit 1;
  perform 1 from public.comentarios_plan where comentario_padre_id is not null limit 1;
  perform 1 from public.comentarios_plan where estado_id is not null limit 1;
  perform 1 from public.comentarios_plan where plan_estudio_id is not null limit 1;
  perform 1 from public.conversaciones_asignatura where archivado_por is not null limit 1;
  perform 1 from public.conversaciones_asignatura where creado_por is not null limit 1;
  perform 1 from public.conversaciones_asignatura where asignatura_id is not null limit 1;
  perform 1 from public.conversaciones_plan where archivado_por is not null limit 1;
  perform 1 from public.conversaciones_plan where creado_por is not null limit 1;
  perform 1 from public.conversaciones_plan where plan_estudio_id is not null limit 1;
  perform 1 from public.crash_reports where resuelto_por is not null limit 1;
  perform 1 from public.crash_reports where usuario_id is not null limit 1;
  perform 1 from public.estructuras_asignatura where actualizado_por is not null limit 1;
  perform 1 from public.estructuras_asignatura where creado_por is not null limit 1;
  perform 1 from public.estructuras_asignatura where estructura_plan_id is not null limit 1;
  perform 1 from public.estructuras_plan where actualizado_por is not null limit 1;
  perform 1 from public.estructuras_plan where creado_por is not null limit 1;
  perform 1 from public.expertos where creado_por is not null limit 1;
  perform 1 from public.expertos where usuario_id is not null limit 1;
  perform 1 from public.facultades where actualizado_por is not null limit 1;
  perform 1 from public.facultades where creado_por is not null limit 1;
  perform 1 from public.interacciones_ia where asignatura_id is not null limit 1;
  perform 1 from public.interacciones_ia where plan_estudio_id is not null limit 1;
  perform 1 from public.interacciones_ia where usuario_id is not null limit 1;
  perform 1 from public.lineas_curriculares_sugeridas where actualizado_por is not null limit 1;
  perform 1 from public.lineas_curriculares_sugeridas where creado_por is not null limit 1;
  perform 1 from public.lineas_curriculares_sugeridas where facultad_id is not null limit 1;
  perform 1 from public.lineas_plan where actualizado_por is not null limit 1;
  perform 1 from public.lineas_plan where creado_por is not null limit 1;
  perform 1 from public.notificaciones where usuario_id is not null limit 1;
  perform 1 from public.plan_expertos where experto_id is not null limit 1;
  perform 1 from public.plan_mensajes_ia where conversacion_plan_id is not null limit 1;
  perform 1 from public.planes_estudio where actualizado_por is not null limit 1;
  perform 1 from public.planes_estudio where carrera_id is not null limit 1;
  perform 1 from public.planes_estudio where creado_por is not null limit 1;
  perform 1 from public.planes_estudio where estado_actual_id is not null limit 1;
  perform 1 from public.planes_estudio where estructura_id is not null limit 1;
  perform 1 from public.planes_estudio where nombre_search is not null limit 1;
  perform 1 from public.reasignaciones where reasignado_por is not null limit 1;
  perform 1 from public.reasignaciones where usuario_destino is not null limit 1;
  perform 1 from public.reasignaciones where usuario_origen is not null limit 1;
  perform 1 from public.responsables_asignatura where asignado_por is not null limit 1;
  perform 1 from public.responsables_asignatura where usuario_id is not null limit 1;
  perform 1 from public.roles_permisos where permiso_id is not null limit 1;
  perform 1 from public.tareas_revision where asignado_a is not null limit 1;
  perform 1 from public.tareas_revision where creado_por is not null limit 1;
  perform 1 from public.tareas_revision where estado_id is not null limit 1;
  perform 1 from public.tareas_revision where plan_estudio_id is not null limit 1;
  perform 1 from public.tareas_revision where rol_id is not null limit 1;
  perform 1 from public.transiciones_estado_plan where hacia_estado_id is not null limit 1;
  perform 1 from public.transiciones_estado_plan where rol_permitido_id is not null limit 1;
  perform 1 from public.usuarios_app where invitado_por is not null limit 1;
  perform 1 from public.usuarios_roles where asignado_por is not null limit 1;
  perform 1 from public.usuarios_roles where carrera_id is not null limit 1;
  perform 1 from public.usuarios_roles where facultad_id is not null limit 1;

  perform 1 from public.estructuras_asignatura order by estructura_plan_id, nombre limit 1;
  perform 1 from public.asignaturas order by plan_estudio_id, linea_plan_id, numero_ciclo limit 1;
  perform 1 from public.asignaturas order by estructura_id limit 1;
  perform 1 from public.bibliografia_asignatura order by asignatura_id limit 1;
  perform 1 from public.borradores_campo order by entidad, entidad_id limit 1;
  perform 1 from public.borradores_campo order by plan_id, actualizado_en desc limit 1;
  perform 1 from public.cambios_asignatura order by asignatura_id limit 1;
  perform 1 from public.comentarios_asignatura order by asignatura_id, creado_en desc limit 1;
  perform 1 from public.comentarios_plan order by plan_estudio_id, creado_en desc limit 1;
  perform 1 from public.conversaciones_asignatura order by asignatura_id limit 1;
  perform 1 from public.conversaciones_plan order by plan_estudio_id limit 1;
  perform 1 from public.lineas_curriculares_sugeridas order by facultad_id, orden limit 1;
  perform 1 from public.planes_estudio order by carrera_id limit 1;
  perform 1 from public.tareas_revision order by asignado_a limit 1;
  perform 1 from public.tareas_revision order by plan_estudio_id limit 1;
  perform 1 from public.transiciones_estado_plan order by hacia_estado_id limit 1;
  perform 1 from public.usuarios_roles order by carrera_id limit 1;
  perform 1 from public.usuarios_roles order by facultad_id limit 1;
end $$;
