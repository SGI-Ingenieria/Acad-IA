-- El nombre visible del plan institucional y de su línea usuaria es estable.
do $$
declare
  d text;
begin
  select pg_get_functiondef('public.fn_planes_set_nombre_display()'::regprocedure)
    into d;
  d := replace(d, 'Área curricular común básica', '2. Área curricular común');
  execute d;

  select pg_get_functiondef('public.area_comun_incorporar(uuid,jsonb,uuid)'::regprocedure)
    into d;
  d := replace(d, 'Área curricular común básica', '2. Área curricular común');
  execute d;
end;
$$;

-- El cambio es una migración de catálogo, no una edición hecha por una cuenta.
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
insert into private.area_comun_operaciones(transaccion, backend)
values (txid_current(), pg_backend_pid())
on conflict do nothing;

update public.planes_estudio
set nombre = '2. Área curricular común',
    nombre_propuesto = '2. Área curricular común'
where categoria = 'AREA_COMUN';

update public.lineas_plan
set nombre = '2. Área curricular común'
where nombre = 'Área curricular común básica';

delete from private.area_comun_operaciones
where transaccion = txid_current() and backend = pg_backend_pid();
select set_config('request.jwt.claims', '', true);
