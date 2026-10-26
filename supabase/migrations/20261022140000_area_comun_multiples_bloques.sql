-- Un usuario puede recibir varias asignaciones del rol genérico, una por bloque.
-- La tabla de encargos conserva la unicidad por usuario y bloque.
do $$
declare
  v_rol_bloque uuid;
begin
  select id into v_rol_bloque from public.roles where clave='ENCARGADO_BLOQUE';
  if v_rol_bloque is null then
    raise exception 'No existe el rol ENCARGADO_BLOQUE';
  end if;

  drop index if exists public.usuarios_roles_unicos_idx;
  execute format(
    'create unique index usuarios_roles_unicos_idx on public.usuarios_roles '
    'using btree (usuario_id, rol_id, '
    'coalesce(facultad_id, %L::uuid), coalesce(carrera_id, %L::uuid)) '
    'where rol_id <> %L::uuid',
    '00000000-0000-0000-0000-000000000000',
    '00000000-0000-0000-0000-000000000000',
    v_rol_bloque
  );
end $$;
