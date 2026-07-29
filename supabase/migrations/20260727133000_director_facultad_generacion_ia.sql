-- La Dirección de Facultad puede crear planes dentro de su facultad. La
-- generación asistida es uno de los métodos de esa creación, no una capacidad
-- administrativa global; el alcance continúa resolviéndose por las reglas de
-- facultad existentes.
insert into public.roles_permisos (rol_id, permiso_id)
select r.id, p.id
from public.roles r
cross join public.permisos p
where r.clave = 'DIRECTOR_FACULTAD'
  and p.clave = 'ia.usar'
on conflict (rol_id, permiso_id) do nothing;
