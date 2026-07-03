-- Bucket privado y metadata de archivo para documentos oficiales SEP/RVOE.

insert into storage.buckets (id, name, public)
values ('documentos-oficiales', 'documentos-oficiales', false)
on conflict (id) do update set
  name = excluded.name,
  public = excluded.public;

alter table public.registros_oficiales_plan
  add column if not exists documento_bucket text not null default 'documentos-oficiales',
  add column if not exists documento_path text,
  add column if not exists documento_nombre text,
  add column if not exists documento_mime text,
  add column if not exists documento_size bigint;

alter table public.registros_oficiales_plan
  drop constraint if exists registros_oficiales_plan_documento_chk;

alter table public.registros_oficiales_plan
  add constraint registros_oficiales_plan_documento_chk
  check (
    documento_archivo_id is not null
    or nullif(btrim(coalesce(documento_path, '')), '') is not null
    or nullif(btrim(coalesce(documento_url, '')), '') is not null
  );

alter table public.registros_oficiales_plan
  drop constraint if exists registros_oficiales_plan_documento_size_chk;

alter table public.registros_oficiales_plan
  add constraint registros_oficiales_plan_documento_size_chk
  check (documento_size is null or documento_size >= 0);

comment on column public.registros_oficiales_plan.documento_bucket is
  'Bucket privado de Supabase Storage donde vive el documento oficial.';
comment on column public.registros_oficiales_plan.documento_path is
  'Path del documento oficial dentro del bucket de Storage.';
comment on column public.registros_oficiales_plan.documento_nombre is
  'Nombre original del archivo oficial cargado por el usuario.';
comment on column public.registros_oficiales_plan.documento_mime is
  'MIME type reportado por el navegador para el documento oficial.';
comment on column public.registros_oficiales_plan.documento_size is
  'Tamaño en bytes del documento oficial.';

create index if not exists registros_oficiales_plan_documento_storage_idx
  on public.registros_oficiales_plan(documento_bucket, documento_path);

drop policy if exists official_plan_documents_select on storage.objects;
create policy official_plan_documents_select
on storage.objects
for select
to authenticated
using (
  bucket_id = 'documentos-oficiales'
  and public.authz_has_permission('planes.ver'::text)
  and case
    when name ~* '^planes/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/.+$'
      then public.authz_can_access_plan(split_part(name, '/', 2)::uuid)
    else false
  end
);

drop policy if exists official_plan_documents_insert on storage.objects;
create policy official_plan_documents_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'documentos-oficiales'
  and public.authz_has_permission('planes.aprobar'::text)
  and case
    when name ~* '^planes/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/.+$'
      then public.authz_can_access_plan(split_part(name, '/', 2)::uuid)
    else false
  end
);

drop policy if exists official_plan_documents_update on storage.objects;
create policy official_plan_documents_update
on storage.objects
for update
to authenticated
using (
  bucket_id = 'documentos-oficiales'
  and public.authz_has_permission('planes.aprobar'::text)
  and case
    when name ~* '^planes/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/.+$'
      then public.authz_can_access_plan(split_part(name, '/', 2)::uuid)
    else false
  end
)
with check (
  bucket_id = 'documentos-oficiales'
  and public.authz_has_permission('planes.aprobar'::text)
  and case
    when name ~* '^planes/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/.+$'
      then public.authz_can_access_plan(split_part(name, '/', 2)::uuid)
    else false
  end
);

drop policy if exists official_plan_documents_delete on storage.objects;
create policy official_plan_documents_delete
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'documentos-oficiales'
  and public.authz_has_permission('planes.aprobar'::text)
  and case
    when name ~* '^planes/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/.+$'
      then public.authz_can_access_plan(split_part(name, '/', 2)::uuid)
    else false
  end
);

drop view if exists public.registros_oficiales_plan_detalle;

create view public.registros_oficiales_plan_detalle
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
  rop.documento_bucket,
  rop.documento_path,
  rop.documento_nombre,
  rop.documento_mime,
  rop.documento_size,
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
