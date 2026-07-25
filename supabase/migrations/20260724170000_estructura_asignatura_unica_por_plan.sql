-- Relación 1:1 entre plantilla de plan y plantilla de asignatura.
--
-- Regla de negocio: una `estructuras_plan` tiene exactamente una
-- `estructuras_asignatura`. Con eso, el wizard de asignaturas ya no pregunta la
-- plantilla: la deriva del plan. Además el `tipo` (CURRICULAR / NO_CURRICULAR)
-- deja de ser un dato independiente y se hereda de la plantilla del plan.

begin;

-- 1) El tipo se hereda: se normaliza lo existente antes de instalar el trigger.
update public.estructuras_asignatura ea
set tipo = ep.tipo
from public.estructuras_plan ep
where ep.id = ea.estructura_plan_id
  and ea.tipo is distinct from ep.tipo;

-- 2) Guarda de seguridad: no se consolidan duplicados automáticamente porque
--    fusionar dos plantillas implicaría reasignar asignaturas y descartar una
--    `definicion`. Si hay duplicados la migración falla con el detalle para
--    resolverlos a mano.
do $$
declare
  duplicados text;
begin
  select string_agg(
           format('%s (%s plantillas: %s)', d.estructura_plan_id, d.total, d.nombres),
           e'\n'
         )
    into duplicados
    from (
      select ea.estructura_plan_id,
             count(*) as total,
             string_agg(ea.nombre, ', ' order by ea.nombre) as nombres
        from public.estructuras_asignatura ea
       group by ea.estructura_plan_id
      having count(*) > 1
    ) d;

  if duplicados is not null then
    raise exception
      'No se puede aplicar la relación 1:1: hay estructuras de plan con más de una estructura de asignatura.%s%s',
      e'\n', duplicados
      using errcode = 'unique_violation';
  end if;
end;
$$;

-- 3) Unicidad: una sola plantilla de asignatura por plantilla de plan.
alter table public.estructuras_asignatura
  drop constraint if exists uq_estructuras_asignatura_estructura_plan;

alter table public.estructuras_asignatura
  add constraint uq_estructuras_asignatura_estructura_plan
  unique (estructura_plan_id);

-- El índice compuesto anterior queda cubierto por la restricción única.
drop index if exists public.idx_estructuras_asignatura_estructura_plan;

-- 4) Herencia del tipo desde la plantilla de plan.
create or replace function public.fn_heredar_tipo_estructura_asignatura()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tipo public.tipo_estructura_plan;
begin
  select ep.tipo into v_tipo
    from public.estructuras_plan ep
   where ep.id = new.estructura_plan_id;

  if v_tipo is null then
    raise exception 'La estructura de plan % no existe', new.estructura_plan_id
      using errcode = 'foreign_key_violation';
  end if;

  new.tipo := v_tipo;
  return new;
end;
$$;

comment on function public.fn_heredar_tipo_estructura_asignatura() is
  'La estructura de asignatura hereda CURRICULAR/NO_CURRICULAR de su estructura de plan (relación 1:1).';

drop trigger if exists trg_heredar_tipo_estructura_asignatura
  on public.estructuras_asignatura;

create trigger trg_heredar_tipo_estructura_asignatura
  before insert or update of estructura_plan_id, tipo
  on public.estructuras_asignatura
  for each row
  execute function public.fn_heredar_tipo_estructura_asignatura();

-- 5) Propagación: si cambia el tipo de la plantilla de plan, arrastra a la suya.
create or replace function public.fn_propagar_tipo_estructura_plan()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.estructuras_asignatura
     set tipo = new.tipo
   where estructura_plan_id = new.id
     and tipo is distinct from new.tipo;
  return new;
end;
$$;

comment on function public.fn_propagar_tipo_estructura_plan() is
  'Propaga el tipo de la estructura de plan a su estructura de asignatura (relación 1:1).';

drop trigger if exists trg_propagar_tipo_estructura_plan
  on public.estructuras_plan;

create trigger trg_propagar_tipo_estructura_plan
  after update of tipo
  on public.estructuras_plan
  for each row
  when (old.tipo is distinct from new.tipo)
  execute function public.fn_propagar_tipo_estructura_plan();

commit;
