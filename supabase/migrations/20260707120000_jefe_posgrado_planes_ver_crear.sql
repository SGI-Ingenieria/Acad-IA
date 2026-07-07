-- El Jefe de Posgrado no tenía planes.ver ni planes.crear porque la migración
-- 20260703 copió permisos de JEFE_CARRERA, pero la verificación de permisos
-- en el frontend retorna antes de consultar la BD cuando el JWT ya tiene algún
-- permiso (como catalogos.gestionar agregado en 20260706). Esto causaba que el
-- route guard de /planes redirigiera silenciosamente a / sin que el usuario
-- pudiera navegar.

insert into public.roles_permisos (rol_id, permiso_id)
select r.id, p.id
from public.roles r
join public.permisos p on p.clave in ('planes.ver', 'planes.crear', 'planes.editar')
where r.clave = 'JEFE_POSGRADO'
on conflict do nothing;
