alter table public.facultades
  add column if not exists prefijo text;

comment on column public.facultades.prefijo is
  'Prefijo institucional opcional. Ej: "Mexicana" genera "Facultad Mexicana de <nombre>"';
