-- Fecha en la que el plan entra en vigor / primera generación.
alter table public.planes_estudio
add column if not exists fecha_inicio_vigencia date;

comment on column public.planes_estudio.fecha_inicio_vigencia is
  'Fecha en la que el plan entra en vigor / primera generación.';

-- Genera el nombre inmutable para planes con estructura CURRICULAR.
create or replace function public.fn_generar_nombre_plan_curricular(
  p_carrera_id uuid,
  p_fecha_inicio_vigencia date
) returns text
  language plpgsql
  security definer
  set search_path = 'public', 'pg_temp'
  immutable
as $$
declare
  v_carrera record;
  v_nivel text;
  v_nombre_carrera text;
  v_meses text[] := array[
    'Enero','Febrero','Marzo','Abril','Mayo','Junio',
    'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'
  ];
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

  if p_fecha_inicio_vigencia is null then
    raise exception 'La fecha de inicio de vigencia es requerida para generar el nombre del plan.'
      using errcode = 'P0001';
  end if;

  v_mes := v_meses[extract(month from p_fecha_inicio_vigencia)::int];
  v_anio := extract(year from p_fecha_inicio_vigencia)::int;

  if lower(v_nivel) = 'otro' or v_nivel = '' then
    return format('%s - Plan %s %s', v_nombre_carrera, v_mes, v_anio);
  end if;

  return format('%s en %s - Plan %s %s', v_nivel, v_nombre_carrera, v_mes, v_anio);
end;
$$;

-- Valida (y, en alta, impone) el nombre de planes CURRICULARES.
create or replace function public.fn_validar_nombre_plan_curricular()
returns trigger
  language plpgsql
  security definer
  set search_path = 'public', 'pg_temp'
as $$
declare
  v_estructura_tipo public.tipo_estructura_plan;
begin
  select tipo into v_estructura_tipo
  from public.estructuras_plan
  where id = NEW.estructura_id;

  if v_estructura_tipo = 'CURRICULAR' then
    if TG_OP = 'INSERT' then
      if NEW.fecha_inicio_vigencia is null then
        raise exception 'Los planes con estructura CURRICULAR requieren fecha_inicio_vigencia.'
          using errcode = 'P0001';
      end if;

      NEW.nombre := public.fn_generar_nombre_plan_curricular(
        NEW.carrera_id,
        NEW.fecha_inicio_vigencia
      );
    elsif TG_OP = 'UPDATE' then
      if NEW.nombre is distinct from OLD.nombre then
        raise exception 'El nombre de un plan CURRICULAR no se puede modificar.'
          using errcode = 'P0001';
      end if;

      if NEW.fecha_inicio_vigencia is distinct from OLD.fecha_inicio_vigencia then
        raise exception 'La fecha de inicio de vigencia de un plan CURRICULAR no se puede modificar.'
          using errcode = 'P0001';
      end if;
    end if;
  end if;

  return NEW;
end;
$$;

-- Asegura que el trigger se aplique una sola vez.
drop trigger if exists trg_validar_nombre_plan_curricular on public.planes_estudio;

create trigger trg_validar_nombre_plan_curricular
before insert or update on public.planes_estudio
for each row
execute function public.fn_validar_nombre_plan_curricular();
