select
  p.id as plan_estudio_id,
  p.nombre as plan_nombre,
  c.id as carrera_id,
  c.nombre as carrera_nombre,
  c.nivel
from public.planes_estudio p
join public.carreras c
  on c.id = p.carrera_id
where c.nivel ilike 'maestría'
   or c.nivel ilike 'maestria';