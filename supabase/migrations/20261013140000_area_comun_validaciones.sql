-- Desambiguar aliases JSON respecto a las variables de bucle de PL/pgSQL.
do $$ declare d text; begin
  select pg_get_functiondef(oid) into d from pg_proc where pronamespace='public'::regnamespace and proname='area_comun_publicar';
  execute replace(d,'declare c public.area_comun_configuracion;',E'#variable_conflict use_column\ndeclare c public.area_comun_configuracion;');
end $$;
