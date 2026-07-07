-- Extiende el permiso catalogos.gestionar a los roles que gestionan
-- facultades y carreras según su alcance jerárquico.
-- Las restricciones de alcance (facultad propia, carrera propia, solo posgrado)
-- se aplican en el frontend; el permiso DB es el mismo para todos.

insert into public.roles_permisos (rol_id, permiso_id)
select r.id, p.id
from public.roles r
join public.permisos p on p.clave = 'catalogos.gestionar'
where r.clave in (
  'VICERRECTOR_ACADEMICO',
  'DIRECTOR_FACULTAD',
  'SECRETARIO_ACADEMICO',
  'JEFE_CARRERA'
)
on conflict do nothing;
