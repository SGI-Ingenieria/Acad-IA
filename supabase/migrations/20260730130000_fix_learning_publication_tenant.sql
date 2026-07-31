-- Fix for LEARNING_PUBLICATION_FAILED error
-- Ensure users have default tenant memberships for learning resource publication

begin;

set local search_path = public, extensions;

insert into public.tenants (id, nombre, slug)
values (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'Default Tenant',
  'default'
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
