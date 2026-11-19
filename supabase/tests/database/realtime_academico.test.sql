begin;
select plan(4);

create temporary table tablas_academicas (nombre text primary key);
insert into tablas_academicas values
('facultades'), ('carreras'), ('estructuras_plan'), ('estructuras_asignatura'),
('lineas_plan'), ('bibliografia_asignatura'), ('comentarios_plan'),
('comentarios_asignatura'), ('cambios_plan'), ('cambios_asignatura'),
('conversaciones_plan'), ('conversaciones_asignatura'), ('notificaciones'),
('registros_oficiales_plan'), ('tareas_revision'), ('responsables_asignatura');

select is((select count(*)::int from pg_publication_tables p join tablas_academicas t
  on p.tablename = t.nombre where p.pubname = 'supabase_realtime' and p.schemaname = 'public'),
  16, 'las relaciones académicas observadas están publicadas');
select ok((select bool_and(c.relrowsecurity) from pg_class c join pg_namespace n on n.oid = c.relnamespace
  join tablas_academicas t on t.nombre = c.relname where n.nspname = 'public'),
  'las tablas conservan seguridad por fila');
select is((select count(distinct p.tablename)::int from pg_policies p join tablas_academicas t
  on p.tablename = t.nombre where p.schemaname = 'public' and p.cmd in ('SELECT', 'ALL')),
  16, 'cada tabla publicada tiene una política de lectura');
select is((select count(*)::int from pg_publication_tables where pubname = 'supabase_realtime'
  and schemaname = 'public' and tablename = 'trabajos_generacion_ia'),
  0, 'los trabajos internos de IA no se publican a clientes');
select * from finish();
rollback;
