-- Restore the production migration that synchronized Auth users with the
-- application profile and its default document tenant.

begin;

set local search_path = public, extensions;

insert into public.tenants (id, nombre, slug)
values (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'Default Tenant',
  'default'
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
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid,
  ua.id,
  true,
  now()
from public.usuarios_app ua
where not exists (
  select 1
  from public.tenant_memberships tm
  where tm.user_id = ua.id and tm.is_default = true
)
on conflict (tenant_id, user_id) do update
set is_default = excluded.is_default;

commit;
