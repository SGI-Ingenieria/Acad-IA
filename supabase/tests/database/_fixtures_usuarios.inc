-- Usuarios efímeros compartidos por pruebas que necesitan identidad y tenant.
-- Cada archivo de pgTAP incluye este script dentro de su propia transacción,
-- por lo que las filas se eliminan con el ROLLBACK final.
insert into auth.users
(id, email, raw_user_meta_data) values ( '90000000-0000-4000-8000-000000000001',
'admin-test@acad-ia.invalid', '{"full_name":"Administración de prueba"}'::jsonb
), ( '90000000-0000-4000-8000-000000000002', 'usuario-a-test@acad-ia.invalid',
'{"full_name":"Usuario A de prueba"}'::jsonb ), (
'90000000-0000-4000-8000-000000000003', 'usuario-b-test@acad-ia.invalid',
'{"full_name":"Usuario B de prueba"}'::jsonb ) on conflict (id) do nothing;
insert into public.usuarios_app (id, nombre_completo) values
('90000000-0000-4000-8000-000000000001', 'Administración de prueba'),
('90000000-0000-4000-8000-000000000002', 'Usuario A de prueba'),
('90000000-0000-4000-8000-000000000003', 'Usuario B de prueba') on conflict (id)
do nothing; insert into public.usuarios_roles (usuario_id, rol_id) select
'90000000-0000-4000-8000-000000000001', rol.id from public.roles rol where
rol.clave = 'ADMIN' on conflict do nothing;
