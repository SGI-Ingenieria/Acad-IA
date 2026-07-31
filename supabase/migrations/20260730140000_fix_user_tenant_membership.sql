-- Restore the production migration that repaired the affected user's profile
-- and ensured every application user had a default tenant.

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
    'Usuario'
  ),
  au.created_at,
  au.updated_at
from auth.users au
where au.id = '26436f00-f451-4eb7-a97f-163b764887f4'
  and not exists (
    select 1 from public.usuarios_app ua where ua.id = au.id
  )
on conflict (id) do nothing;

with users_without_default as (
  select u.id as user_id
  from public.usuarios_app u
  left join public.tenant_memberships tm
    on tm.user_id = u.id and tm.is_default = true
  where tm.user_id is null
)
insert into public.tenant_memberships (tenant_id, user_id, is_default)
select
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid,
  uwd.user_id,
  true
from users_without_default uwd
on conflict (tenant_id, user_id) do update
set is_default = excluded.is_default;

commit;
