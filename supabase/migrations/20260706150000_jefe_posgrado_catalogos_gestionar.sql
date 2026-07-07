-- Permite al Jefe de Posgrado crear y gestionar carreras de posgrado.
-- Sin este permiso, un usuario recién asignado al rol no puede crear carreras
-- y queda bloqueado sin poder hacer nada en la plataforma.

insert into public.roles_permisos (rol_id, permiso_id)
select r.id, p.id
from public.roles r
join public.permisos p on p.clave = 'catalogos.gestionar'
where r.clave = 'JEFE_POSGRADO'
on conflict do nothing;
