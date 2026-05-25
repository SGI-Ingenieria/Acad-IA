alter table public.facultades
  add column if not exists activa boolean not null default true;

update public.facultades
set activa = true
where activa is null;

comment on column public.facultades.activa is 'Logical delete flag for faculties.';
