-- Adjuntos de comentarios: bucket privado + tabla de metadata + RLS.
-- Permite adjuntar imágenes y documentos (PDF/Office) a un comentario de plan.

-- 1. Bucket privado
insert into storage.buckets (id, name, public)
values ('comentarios-adjuntos', 'comentarios-adjuntos', false)
on conflict (id) do update set
  name = excluded.name,
  public = excluded.public;

-- 2. Tabla de metadata
create table if not exists public.comentarios_adjuntos (
  id uuid primary key default gen_random_uuid(),
  comentario_id uuid not null references public.comentarios_plan(id) on delete cascade,
  plan_estudio_id uuid not null references public.planes_estudio(id) on delete cascade,
  bucket text not null default 'comentarios-adjuntos',
  path text not null,
  nombre text,
  mime text,
  size bigint,
  creado_por uuid references public.usuarios_app(id),
  creado_en timestamptz not null default now(),
  constraint comentarios_adjuntos_size_chk check (size is null or size >= 0)
);

comment on table public.comentarios_adjuntos is
  'Archivos adjuntos (imágenes/documentos) de un comentario de plan, almacenados en el bucket privado comentarios-adjuntos.';

create index if not exists comentarios_adjuntos_comentario_idx
  on public.comentarios_adjuntos(comentario_id);
create index if not exists comentarios_adjuntos_plan_idx
  on public.comentarios_adjuntos(plan_estudio_id);
create index if not exists comentarios_adjuntos_storage_idx
  on public.comentarios_adjuntos(bucket, path);

alter table public.comentarios_adjuntos enable row level security;

-- SELECT: visible si el comentario padre es visible para el usuario
-- (la subconsulta respeta el RLS de comentarios_plan).
drop policy if exists comentarios_adjuntos_select on public.comentarios_adjuntos;
create policy comentarios_adjuntos_select on public.comentarios_adjuntos
  as permissive for select to authenticated
  using (
    exists (
      select 1 from public.comentarios_plan cp
      where cp.id = comentario_id
    )
  );

-- INSERT: el autor puede adjuntar si puede comentar el plan.
drop policy if exists comentarios_adjuntos_insert on public.comentarios_adjuntos;
create policy comentarios_adjuntos_insert on public.comentarios_adjuntos
  as permissive for insert to authenticated
  with check (
    creado_por = (select auth.uid())
    and private.usuario_puede_comentar_plan((select auth.uid()), plan_estudio_id)
  );

drop policy if exists comentarios_adjuntos_delete on public.comentarios_adjuntos;
create policy comentarios_adjuntos_delete on public.comentarios_adjuntos
  as permissive for delete to authenticated
  using ((creado_por = (select auth.uid())) or authz_is_admin());

grant select, insert, delete on public.comentarios_adjuntos to authenticated;
grant all on public.comentarios_adjuntos to service_role;

-- 3. RLS de storage.objects para el bucket comentarios-adjuntos.
-- Ruta esperada: comentarios/<planId>/<uuid>-<nombre>
drop policy if exists comment_attachments_select on storage.objects;
create policy comment_attachments_select
on storage.objects
for select
to authenticated
using (
  bucket_id = 'comentarios-adjuntos'
  and case
    when name ~* '^comentarios/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/.+$'
      then public.authz_can_access_plan(split_part(name, '/', 2)::uuid)
    else false
  end
);

drop policy if exists comment_attachments_insert on storage.objects;
create policy comment_attachments_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'comentarios-adjuntos'
  and case
    when name ~* '^comentarios/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/.+$'
      then private.usuario_puede_comentar_plan((select auth.uid()), split_part(name, '/', 2)::uuid)
    else false
  end
);

drop policy if exists comment_attachments_delete on storage.objects;
create policy comment_attachments_delete
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'comentarios-adjuntos'
  and case
    when name ~* '^comentarios/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/.+$'
      then private.usuario_puede_comentar_plan((select auth.uid()), split_part(name, '/', 2)::uuid)
    else false
  end
);
