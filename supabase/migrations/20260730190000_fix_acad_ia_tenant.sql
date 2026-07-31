-- Restore the production migration that moved application users to the
-- canonical document tenant expected by the account trigger.

begin;

set local search_path = public, extensions;

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

commit;
