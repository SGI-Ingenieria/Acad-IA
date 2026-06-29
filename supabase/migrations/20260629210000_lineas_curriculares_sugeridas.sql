-- Catálogo de líneas curriculares sugeridas por facultad.
-- Cada facultad tiene líneas que le son propias (p. ej. "Programación" en Ingeniería).
-- Alimenta el diálogo "Agregar línea curricular" del mapa, filtrando por facultad y nivel.
-- La regla "solo Licenciatura" y el tratamiento de "Área Común" como sugerencia global se
-- aplican en el frontend; esta tabla es estrictamente por facultad.

create table if not exists public.lineas_curriculares_sugeridas (
  id              uuid primary key default gen_random_uuid(),
  facultad_id     uuid not null references public.facultades(id) on delete cascade,
  nombre          text not null,
  area            text,
  color           text,
  orden           integer not null default 0,
  activa          boolean not null default true,
  creado_en       timestamptz not null default now(),
  actualizado_en  timestamptz not null default now(),
  creado_por      uuid references public.usuarios_app(id) on delete set null,
  actualizado_por uuid references public.usuarios_app(id) on delete set null
);

comment on table public.lineas_curriculares_sugeridas is
  'Líneas curriculares sugeridas por facultad para asistir la creación de líneas de plan.';

-- Nombre único por facultad, sin distinguir mayúsculas/acentos básicos (lower).
create unique index if not exists lineas_curriculares_sugeridas_facultad_nombre_uq
  on public.lineas_curriculares_sugeridas (facultad_id, lower(nombre));
create index if not exists lineas_curriculares_sugeridas_facultad_idx
  on public.lineas_curriculares_sugeridas (facultad_id, orden);

create or replace trigger trg_lineas_curriculares_sugeridas_actualizado_en
  before update on public.lineas_curriculares_sugeridas
  for each row execute function public.set_actualizado_en();

-- RLS de catálogo: lectura autenticada; administración por permiso de catálogos.
alter table public.lineas_curriculares_sugeridas enable row level security;

revoke all on table public.lineas_curriculares_sugeridas from anon;
grant select, insert, update, delete on table public.lineas_curriculares_sugeridas to authenticated;
grant all on table public.lineas_curriculares_sugeridas to service_role;

drop policy if exists lineas_curriculares_sugeridas_select_authenticated
  on public.lineas_curriculares_sugeridas;
create policy lineas_curriculares_sugeridas_select_authenticated
  on public.lineas_curriculares_sugeridas
  for select to authenticated using (true);

drop policy if exists lineas_curriculares_sugeridas_manage_by_catalogos
  on public.lineas_curriculares_sugeridas;
create policy lineas_curriculares_sugeridas_manage_by_catalogos
  on public.lineas_curriculares_sugeridas
  for all to authenticated
  using (public.authz_has_permission('catalogos.gestionar'))
  with check (public.authz_has_permission('catalogos.gestionar'));
