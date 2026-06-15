-- Converts `asignaturas.creditos` to a generated stored column.
-- Formula (Acuerdo 17/11/17, Art. 11 + Anexo 2):
--   cada hora efectiva vale 0.0625 créditos (1/16)
--   el resultado se expresa a centésimas, SIN redondear (truncar)
--
-- creditos = trunc((horas_academicas + horas_independientes) / 16, 2)

alter table public.asignaturas drop column creditos;

alter table public.asignaturas
  add column creditos numeric generated always as (
    floor(
      (coalesce(horas_academicas, 0) + coalesce(horas_independientes, 0))::numeric
      / 16 * 100
    ) / 100
  ) stored;

comment on column public.asignaturas.creditos is
  'Calculado automáticamente: trunc((horas_academicas + horas_independientes) / 16, 2). No editable.';
