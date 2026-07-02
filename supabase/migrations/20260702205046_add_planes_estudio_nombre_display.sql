-- Nombre visible de planes y fecha de inicio de impartición.
-- Esta migración reemplaza el primer intento basado en fecha_inicio_vigencia.

alter table public.planes_estudio
  add column if not exists nombre_propuesto text,
  add column if not exists nombre_display text,
  add column if not exists fecha_inicio_imparticion date;

comment on column public.planes_estudio.nombre_propuesto is
  'Nombre capturado para planes no curriculares. En planes curriculares se mantiene nulo.';

comment on column public.planes_estudio.nombre_display is
  'Nombre final mostrado por la aplicación. Para planes curriculares se calcula desde nivel, carrera y fecha_inicio_imparticion.';

comment on column public.planes_estudio.fecha_inicio_imparticion is
  'Mes de primera generación / inicio de impartición. Se almacena como el primer día del mes.';

update public.planes_estudio
   set fecha_inicio_imparticion = coalesce(
     fecha_inicio_imparticion,
     fecha_inicio_vigencia
   );

alter table public.planes_estudio
  alter column nombre drop not null;

drop trigger if exists trg_validar_nombre_plan_curricular on public.planes_estudio;
drop function if exists public.fn_validar_nombre_plan_curricular();
drop function if exists public.fn_generar_nombre_plan_curricular(uuid, date);

drop index if exists public.idx_planes_nombre_search;

alter table public.planes_estudio
  drop column if exists nombre_search;

create or replace function public.fn_generar_nombre_plan_curricular(
  p_carrera_id uuid,
  p_fecha_inicio_imparticion date
) returns text
  language plpgsql
  stable
  security invoker
  set search_path = 'public', 'pg_temp'
as $$
declare
  v_carrera record;
  v_nivel text;
  v_nombre_carrera text;
  v_meses text[] := array[
    'Enero','Febrero','Marzo','Abril','Mayo','Junio',
    'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'
  ];
  v_fecha date;
  v_mes text;
  v_anio integer;
begin
  select nivel, nombre
    into v_carrera
    from public.carreras
   where id = p_carrera_id;

  if v_carrera is null then
    raise exception 'No se encontró la carrera para generar el nombre del plan.'
      using errcode = 'P0001';
  end if;

  v_nivel := coalesce(trim(v_carrera.nivel::text), '');
  v_nombre_carrera := coalesce(trim(v_carrera.nombre), '');

  if v_nombre_carrera = '' then
    raise exception 'La carrera no tiene nombre; no se puede generar el nombre del plan.'
      using errcode = 'P0001';
  end if;

  if p_fecha_inicio_imparticion is null then
    raise exception 'fecha_inicio_imparticion es requerida para planes CURRICULAR.'
      using errcode = 'P0001';
  end if;

  v_fecha := date_trunc('month', p_fecha_inicio_imparticion)::date;
  v_mes := v_meses[extract(month from v_fecha)::int];
  v_anio := extract(year from v_fecha)::int;

  if lower(v_nivel) = 'otro' or v_nivel = '' then
    return format('%s - Plan %s %s', v_nombre_carrera, v_mes, v_anio);
  end if;

  return format('%s en %s - Plan %s %s', v_nivel, v_nombre_carrera, v_mes, v_anio);
end;
$$;

create or replace function public.fn_planes_set_nombre_display()
returns trigger
  language plpgsql
  security invoker
  set search_path = 'public', 'pg_temp'
as $$
declare
  v_estructura_tipo public.tipo_estructura_plan;
  v_nombre_base text;
begin
  select tipo
    into v_estructura_tipo
    from public.estructuras_plan
   where id = NEW.estructura_id;

  if v_estructura_tipo is null then
    raise exception 'No se encontró la estructura del plan.'
      using errcode = 'P0001';
  end if;

  if NEW.fecha_inicio_imparticion is not null then
    NEW.fecha_inicio_imparticion := date_trunc(
      'month',
      NEW.fecha_inicio_imparticion
    )::date;
  end if;

  if v_estructura_tipo = 'CURRICULAR' then
    if NEW.fecha_inicio_imparticion is null then
      raise exception 'Los planes con estructura CURRICULAR requieren fecha_inicio_imparticion.'
        using errcode = 'P0001';
    end if;

    NEW.nombre := null;
    NEW.nombre_propuesto := null;
    NEW.nombre_display := public.fn_generar_nombre_plan_curricular(
      NEW.carrera_id,
      NEW.fecha_inicio_imparticion
    );
  else
    v_nombre_base := coalesce(
      nullif(trim(NEW.nombre_propuesto), ''),
      nullif(trim(NEW.nombre), ''),
      'Plan sin nombre'
    );

    NEW.nombre_propuesto := nullif(trim(coalesce(NEW.nombre_propuesto, v_nombre_base)), '');
    NEW.nombre := nullif(trim(coalesce(NEW.nombre, v_nombre_base)), '');
    NEW.nombre_display := v_nombre_base;
  end if;

  return NEW;
end;
$$;

drop trigger if exists trg_planes_set_nombre_display on public.planes_estudio;

alter table public.planes_estudio disable trigger aa_validar_datos_plan;

with planes as (
  select
    p.id,
    e.tipo,
    case
      when e.tipo = 'CURRICULAR'
        then date_trunc(
          'month',
          coalesce(p.fecha_inicio_imparticion, p.fecha_inicio_vigencia, p.creado_en::date, current_date)
        )::date
      else p.fecha_inicio_imparticion
    end as fecha_imparticion,
    coalesce(
      nullif(trim(p.nombre_propuesto), ''),
      nullif(trim(p.nombre), ''),
      'Plan sin nombre'
    ) as nombre_base
  from public.planes_estudio p
  join public.estructuras_plan e on e.id = p.estructura_id
)
update public.planes_estudio p
   set fecha_inicio_imparticion = planes.fecha_imparticion,
       nombre = case
         when planes.tipo = 'CURRICULAR' then null
         else planes.nombre_base
       end,
       nombre_propuesto = case
         when planes.tipo = 'CURRICULAR' then null
         else planes.nombre_base
       end,
       nombre_display = case
         when planes.tipo = 'CURRICULAR'
           then public.fn_generar_nombre_plan_curricular(p.carrera_id, planes.fecha_imparticion)
         else planes.nombre_base
       end
  from planes
 where p.id = planes.id;

alter table public.planes_estudio enable trigger aa_validar_datos_plan;

alter table public.planes_estudio
  alter column nombre_display set not null;

alter table public.planes_estudio
  add column nombre_search text generated always as (
    lower(public.unaccent_immutable(coalesce(nombre_display, '')))
  ) stored;

create index if not exists idx_planes_nombre_search
  on public.planes_estudio using btree (nombre_search);

alter table public.planes_estudio
  drop column if exists fecha_inicio_vigencia;

create trigger trg_planes_set_nombre_display
before insert or update of carrera_id, estructura_id, nombre, nombre_propuesto, fecha_inicio_imparticion
on public.planes_estudio
for each row
execute function public.fn_planes_set_nombre_display();

create or replace function public.fn_carreras_refresh_planes_nombre_display()
returns trigger
  language plpgsql
  security invoker
  set search_path = 'public', 'pg_temp'
as $$
begin
  update public.planes_estudio
     set nombre = nombre
   where carrera_id = NEW.id;

  return NEW;
end;
$$;

drop trigger if exists trg_carreras_refresh_planes_nombre_display on public.carreras;

create trigger trg_carreras_refresh_planes_nombre_display
after update of nombre, nivel on public.carreras
for each row
when (OLD.nombre is distinct from NEW.nombre or OLD.nivel is distinct from NEW.nivel)
execute function public.fn_carreras_refresh_planes_nombre_display();

revoke execute on function public.fn_generar_nombre_plan_curricular(uuid, date) from public, anon, authenticated;
revoke execute on function public.fn_planes_set_nombre_display() from public, anon, authenticated;
revoke execute on function public.fn_carreras_refresh_planes_nombre_display() from public, anon, authenticated;
