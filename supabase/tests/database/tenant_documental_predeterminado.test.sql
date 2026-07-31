begin;

select plan(8);

select is(
  (
    select count(*)::integer
    from public.tenants
    where slug = 'acad-ia'
      and btrim(nombre) <> ''
  ),
  1,
  'existe un único tenant documental canónico'
);

select ok(
  not exists (
    select 1
    from public.usuarios_app usuario
    where not exists (
      select 1
      from public.tenant_memberships membership
      where membership.user_id = usuario.id
        and membership.is_default
    )
  ),
  'todos los usuarios existentes tienen tenant documental predeterminado'
);

select ok(
  (
    select funcion.prosecdef
      and 'search_path=""' = any(coalesce(funcion.proconfig, array[]::text[]))
    from pg_proc funcion
    join pg_namespace esquema on esquema.oid = funcion.pronamespace
    where esquema.nspname = 'private'
      and funcion.proname = 'asignar_tenant_predeterminado_a_usuario'
  ),
  'el trigger fija un search_path seguro al usar SECURITY DEFINER'
);

select ok(
  not has_function_privilege(
    'anon',
    'private.asignar_tenant_predeterminado_a_usuario()',
    'execute'
  ),
  'anon no puede invocar directamente el trigger privilegiado'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'private.asignar_tenant_predeterminado_a_usuario()',
    'execute'
  ),
  'authenticated no puede invocar directamente el trigger privilegiado'
);

insert into auth.users (id, email, raw_user_meta_data)
values (
  '7e000000-0000-4000-8000-000000000001',
  'tenant-trigger-test@acad-ia.invalid',
  '{}'::jsonb
);

set local role service_role;

insert into public.usuarios_app (id, nombre_completo)
values (
  '7e000000-0000-4000-8000-000000000001',
  'Prueba tenant documental'
);

reset role;

select is(
  (
    select count(*)::integer
    from public.tenant_memberships membership
    join public.tenants tenant on tenant.id = membership.tenant_id
    where membership.user_id = '7e000000-0000-4000-8000-000000000001'
      and membership.is_default
      and tenant.slug = 'acad-ia'
  ),
  1,
  'un usuario nuevo recibe el tenant documental canónico'
);

update public.tenants
set slug = 'acad-ia-prueba-configuracion-ausente'
where slug = 'acad-ia';

insert into auth.users (id, email, raw_user_meta_data)
values (
  '7e000000-0000-4000-8000-000000000002',
  'tenant-missing-test@acad-ia.invalid',
  '{}'::jsonb
);

set local role service_role;

select throws_ok(
  $$
    insert into public.usuarios_app (id, nombre_completo)
    values (
      '7e000000-0000-4000-8000-000000000002',
      'Prueba tenant ausente'
    )
  $$,
  'P0002',
  'tenant documental predeterminado "acad-ia" no configurado',
  'una configuración ausente aborta el alta en vez de fallar silenciosamente'
);

reset role;

select is(
  (
    select count(*)::integer
    from public.usuarios_app
    where id = '7e000000-0000-4000-8000-000000000002'
  ),
  0,
  'el alta sin tenant no deja un perfil de aplicación inconsistente'
);

select * from finish();
rollback;
