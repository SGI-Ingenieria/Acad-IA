-- El subsistema documental es institucional: todos los usuarios de Acad-IA
-- deben pertenecer al tenant canónico que ya espera el trigger de alta.
insert into public.tenants (slug, nombre)
values ('acad-ia', 'Acad-IA')
on conflict (slug) do nothing;

-- Repara cuentas creadas antes de que existiera el tenant. Si una cuenta ya
-- eligió otro tenant predeterminado, se conserva esa decisión.
insert into public.tenant_memberships (tenant_id, user_id, is_default)
select tenant.id, usuario.id, true
from public.tenants tenant
cross join public.usuarios_app usuario
where tenant.slug = 'acad-ia'
  and not exists (
    select 1
    from public.tenant_memberships membership
    where membership.user_id = usuario.id
      and membership.is_default
  )
on conflict (tenant_id, user_id) do update
set is_default = excluded.is_default;

-- La implementación anterior usaba INSERT ... SELECT y aceptaba cero filas;
-- una instalación sin el tenant canónico dejaba crear usuarios inutilizables.
create or replace function private.asignar_tenant_predeterminado_a_usuario()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tenant_id uuid;
begin
  select tenant.id
  into v_tenant_id
  from public.tenants tenant
  where tenant.slug = 'acad-ia';

  if v_tenant_id is null then
    raise exception using
      errcode = 'P0002',
      message = 'tenant documental predeterminado "acad-ia" no configurado';
  end if;

  insert into public.tenant_memberships (tenant_id, user_id, is_default)
  values (v_tenant_id, new.id, true)
  on conflict (tenant_id, user_id) do update
  set is_default = excluded.is_default;

  return new;
end;
$$;

revoke all on function private.asignar_tenant_predeterminado_a_usuario()
from public, anon, authenticated, service_role;
