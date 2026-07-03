-- Registro oficial SEP/RVOE asociado al cierre del flujo de aprobación.
-- El estado APROBADO deja de ser sólo una etiqueta: para alcanzarlo debe existir
-- una ficha con clave/dictamen, vigencia y referencia al documento oficial.

create table if not exists public.registros_oficiales_plan (
  id uuid primary key default gen_random_uuid(),
  plan_estudio_id uuid not null references public.planes_estudio(id) on delete cascade,
  clave_sep text not null,
  numero_acuerdo text not null,
  autoridad text not null default 'SEP',
  fecha_aprobacion date not null,
  vigencia_inicio date not null,
  vigencia_fin date,
  documento_archivo_id uuid references public.archivos(id) on delete set null,
  documento_url text,
  observaciones text,
  registrado_por uuid references public.usuarios_app(id) on delete set null,
  actualizado_por uuid references public.usuarios_app(id) on delete set null,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  constraint registros_oficiales_plan_plan_unique unique (plan_estudio_id),
  constraint registros_oficiales_plan_clave_sep_unique unique (clave_sep),
  constraint registros_oficiales_plan_clave_sep_not_blank
    check (btrim(clave_sep) <> ''),
  constraint registros_oficiales_plan_numero_acuerdo_not_blank
    check (btrim(numero_acuerdo) <> ''),
  constraint registros_oficiales_plan_autoridad_not_blank
    check (btrim(autoridad) <> ''),
  constraint registros_oficiales_plan_vigencia_chk
    check (vigencia_fin is null or vigencia_fin >= vigencia_inicio),
  constraint registros_oficiales_plan_documento_chk
    check (
      documento_archivo_id is not null
      or nullif(btrim(coalesce(documento_url, '')), '') is not null
    )
);

comment on table public.registros_oficiales_plan is
  'Ficha oficial SEP/RVOE que respalda el cierre APROBADO de un plan de estudios.';
comment on column public.registros_oficiales_plan.clave_sep is
  'Clave oficial asignada por SEP/RVOE al plan aprobado.';
comment on column public.registros_oficiales_plan.numero_acuerdo is
  'Número de acuerdo, dictamen, folio o documento oficial de aprobación.';
comment on column public.registros_oficiales_plan.documento_archivo_id is
  'Archivo subido a Storage/OpenAI que contiene el dictamen o documento oficial.';
comment on column public.registros_oficiales_plan.documento_url is
  'URL externa del documento oficial cuando no se adjunta archivo interno.';

create index if not exists registros_oficiales_plan_plan_idx
  on public.registros_oficiales_plan(plan_estudio_id);
create index if not exists registros_oficiales_plan_vigencia_inicio_idx
  on public.registros_oficiales_plan(vigencia_inicio);
create index if not exists registros_oficiales_plan_vigencia_fin_idx
  on public.registros_oficiales_plan(vigencia_fin);
create index if not exists registros_oficiales_plan_documento_archivo_idx
  on public.registros_oficiales_plan(documento_archivo_id);

drop trigger if exists trg_registros_oficiales_plan_actualizado_en
  on public.registros_oficiales_plan;
create trigger trg_registros_oficiales_plan_actualizado_en
before update on public.registros_oficiales_plan
for each row execute function public.set_actualizado_en();

alter table public.registros_oficiales_plan enable row level security;

drop policy if exists registros_oficiales_plan_select_by_scope
  on public.registros_oficiales_plan;
create policy registros_oficiales_plan_select_by_scope
on public.registros_oficiales_plan
for select
to authenticated
using (
  public.authz_has_permission('planes.ver'::text)
  and public.authz_can_access_plan(plan_estudio_id)
);

drop policy if exists registros_oficiales_plan_insert_by_approval_scope
  on public.registros_oficiales_plan;
create policy registros_oficiales_plan_insert_by_approval_scope
on public.registros_oficiales_plan
for insert
to authenticated
with check (
  public.authz_has_permission('planes.aprobar'::text)
  and public.authz_can_access_plan(plan_estudio_id)
);

drop policy if exists registros_oficiales_plan_update_by_approval_scope
  on public.registros_oficiales_plan;
create policy registros_oficiales_plan_update_by_approval_scope
on public.registros_oficiales_plan
for update
to authenticated
using (
  public.authz_has_permission('planes.aprobar'::text)
  and public.authz_can_access_plan(plan_estudio_id)
)
with check (
  public.authz_has_permission('planes.aprobar'::text)
  and public.authz_can_access_plan(plan_estudio_id)
);

drop policy if exists registros_oficiales_plan_delete_admin
  on public.registros_oficiales_plan;
create policy registros_oficiales_plan_delete_admin
on public.registros_oficiales_plan
for delete
to authenticated
using (public.authz_is_admin());

grant select, insert, update, delete on table public.registros_oficiales_plan
  to authenticated;
grant all on table public.registros_oficiales_plan to service_role;

create or replace view public.registros_oficiales_plan_detalle
with (security_invoker = true)
as
select
  rop.id,
  rop.plan_estudio_id,
  rop.clave_sep,
  rop.numero_acuerdo,
  rop.autoridad,
  rop.fecha_aprobacion,
  rop.vigencia_inicio,
  rop.vigencia_fin,
  rop.documento_archivo_id,
  a.path as documento_archivo_path,
  rop.documento_url,
  rop.observaciones,
  rop.registrado_por,
  rop.actualizado_por,
  rop.creado_en,
  rop.actualizado_en,
  pe.nombre_display as plan_nombre,
  pe.nombre as plan_nombre_legacy,
  pe.nombre_propuesto as plan_nombre_propuesto,
  pe.fecha_inicio_imparticion,
  e.clave as estado_clave,
  e.etiqueta as estado_etiqueta,
  e.color as estado_color,
  c.id as carrera_id,
  c.nombre as carrera_nombre,
  c.nombre_corto as carrera_nombre_corto,
  c.nivel as carrera_nivel,
  f.id as facultad_id,
  f.nombre as facultad_nombre,
  f.nombre_corto as facultad_nombre_corto,
  f.prefijo as facultad_prefijo,
  ua.nombre_completo as registrado_por_nombre
from public.registros_oficiales_plan rop
join public.planes_estudio pe on pe.id = rop.plan_estudio_id
left join public.estados_plan e on e.id = pe.estado_actual_id
left join public.carreras c on c.id = pe.carrera_id
left join public.facultades f on f.id = c.facultad_id
left join public.archivos a on a.id = rop.documento_archivo_id
left join public.usuarios_app ua on ua.id = rop.registrado_por;

grant select on public.registros_oficiales_plan_detalle to authenticated;
grant select on public.registros_oficiales_plan_detalle to service_role;

create or replace function public.fn_planes_exige_registro_oficial_aprobado()
returns trigger
language plpgsql
security definer
set search_path to public, private, auth, extensions, pg_temp
as $$
declare
  v_estado_destino text;
begin
  if tg_op not in ('INSERT', 'UPDATE') then
    return new;
  end if;

  if new.estado_actual_id is null then
    return new;
  end if;

  select clave
  into v_estado_destino
  from public.estados_plan
  where id = new.estado_actual_id;

  if v_estado_destino = 'APROBADO'
     and not exists (
       select 1
       from public.registros_oficiales_plan rop
       where rop.plan_estudio_id = new.id
     ) then
    raise exception
      'Para aprobar oficialmente el plan debes registrar clave SEP/RVOE, dictamen, vigencia y documento.'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_planes_exige_registro_oficial_aprobado
  on public.planes_estudio;
create trigger trg_planes_exige_registro_oficial_aprobado
before insert or update of estado_actual_id on public.planes_estudio
for each row execute function public.fn_planes_exige_registro_oficial_aprobado();

revoke all on function public.fn_planes_exige_registro_oficial_aprobado()
  from public, anon;
grant execute on function public.fn_planes_exige_registro_oficial_aprobado()
  to authenticated, service_role;

update public.estados_plan
set etiqueta = 'Aprobado por SEP'
where clave = 'APROBADO'
  and etiqueta = 'Aprobado por ACERT';
