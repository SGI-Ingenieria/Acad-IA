-- Incorporar/retirar también actualiza el contador institucional. Tomar el bloqueo
-- exclusivo desde el principio evita upgrades SHARE -> UPDATE entre dos sesiones.
do $$ declare n text; d text; begin
  foreach n in array array['area_comun_incorporar','area_comun_retirar','crear_version_redisenio'] loop
    select pg_get_functiondef(oid) into d from pg_proc where pronamespace='public'::regnamespace and proname=n;
    execute replace(d,'for share;','for update;');
  end loop;
end $$;
