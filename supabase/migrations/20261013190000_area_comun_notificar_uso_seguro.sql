-- pg_safeupdate rechaza actualizaciones globales aunque la tabla hoy solo tenga
-- una fila. Al incorporar o retirar, actualiza la configuración institucional,
-- que es la que publica el contador de planes vinculados.
create or replace function private.notificar_uso_area_comun() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.area_comun_configuracion
  set actualizado_en = clock_timestamp()
  where plan_id = (
    select id from public.planes_estudio
    where categoria = 'AREA_COMUN'
    order by id limit 1
  );

  if tg_op = 'DELETE' then return old; else return new; end if;
end $$;
revoke all on function private.notificar_uso_area_comun()
from public, anon, authenticated, service_role;
