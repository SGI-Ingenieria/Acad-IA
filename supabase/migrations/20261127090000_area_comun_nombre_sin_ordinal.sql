-- El nombre visible del área curricular común no debe incluir un ordinal.
-- Se corrigen tanto los datos existentes como los valores usados por los
-- triggers y RPCs que crean o actualizan planes e incorporaciones.
do $$
declare
  d text;
begin
  select pg_get_functiondef('public.fn_planes_set_nombre_display()'::regprocedure)
    into d;
  d := replace(d, '2. Área curricular común', 'Área curricular común');
  d := replace(d, 'Área curricular común básica', 'Área curricular común');
  execute d;

  select pg_get_functiondef('public.area_comun_incorporar(uuid,jsonb,uuid)'::regprocedure)
    into d;
  d := replace(d, '2. Área curricular común', 'Área curricular común');
  d := replace(d, 'Área curricular común básica', 'Área curricular común');
  execute d;
end;
$$;

select set_config('request.jwt.claims', '{"role":"service_role"}', true);
insert into private.area_comun_operaciones(transaccion, backend)
values (txid_current(), pg_backend_pid())
on conflict do nothing;

update public.planes_estudio
set nombre = 'Área curricular común',
    nombre_propuesto = 'Área curricular común',
    nombre_display = 'Área curricular común'
where categoria = 'AREA_COMUN';

update public.lineas_plan
set nombre = 'Área curricular común'
where nombre in ('2. Área curricular común', 'Área curricular común básica');

delete from private.area_comun_operaciones
where transaccion = txid_current() and backend = pg_backend_pid();
select set_config('request.jwt.claims', '', true);
