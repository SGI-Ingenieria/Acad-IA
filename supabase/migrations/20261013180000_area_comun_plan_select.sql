-- El rol Área común puede leer el plan institucional que administra.
-- El catálogo de asignaturas y el RPC de contexto ya autorizan ese acceso;
-- esta política completa la lectura de la fila del plan sin abrirla a receptores.
create policy planes_estudio_area_comun_select
on public.planes_estudio
for select
to authenticated
using (
  categoria = 'AREA_COMUN'
  and private.area_comun_gestor(auth.uid())
);
