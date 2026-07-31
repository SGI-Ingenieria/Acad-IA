-- Restore the comprehensive production repair for application profiles,
-- document-tenant membership and the default application role.

begin;

set local search_path = public, extensions;

insert into public.tenants (id, nombre, slug)
values (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'Acad-IA',
  'acad-ia'
)
on conflict (id) do nothing;

insert into public.usuarios_app (id, nombre_completo, creado_en, actualizado_en)
select
  au.id,
  coalesce(
    au.raw_user_meta_data->>'full_name',
    au.raw_user_meta_data->>'name',
    au.email,
    'Usuario'
  ),
  au.created_at,
  au.updated_at
from auth.users au
where not exists (
  select 1 from public.usuarios_app ua where ua.id = au.id
)
on conflict (id) do update
set
  nombre_completo = excluded.nombre_completo,
  actualizado_en = excluded.actualizado_en;

insert into public.tenant_memberships (
  tenant_id,
  user_id,
  is_default,
  created_at
)
select
  t.id,
  ua.id,
  true,
  now()
from public.usuarios_app ua
cross join public.tenants t
where t.slug = 'acad-ia'
  and not exists (
    select 1
    from public.tenant_memberships tm
    where tm.user_id = ua.id and tm.tenant_id = t.id
  )
on conflict (tenant_id, user_id) do update
set is_default = excluded.is_default;

do $$
declare
  v_default_role_id uuid;
begin
  select id
  into v_default_role_id
  from public.roles
  where clave = 'default'
  limit 1;

  if v_default_role_id is not null then
    insert into public.usuarios_roles (usuario_id, rol_id, creado_en)
    select
      ua.id,
      v_default_role_id,
      now()
    from public.usuarios_app ua
    where not exists (
      select 1
      from public.usuarios_roles ur
      where ur.usuario_id = ua.id
    )
    on conflict (usuario_id, rol_id) do nothing;
  end if;
end
$$;

commit;
