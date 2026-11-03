-- Los créditos se generan a partir de la suma HD + HI (una hora = 1/16 CR).
-- En BEFORE no se consulta NEW.creditos, que es una columna generada.
-- Se exige la misma carga total, permitiendo diferentes distribuciones HD/HI.
create or replace function private.validar_alternativa_grupo_plan() returns trigger
language plpgsql security definer set search_path='' as $$
declare g public.grupos_electivos_plan;
begin
  if tg_op='UPDATE' and new.grupo_electivo_id is distinct from old.grupo_electivo_id
    and not private.grupos_electivos_operacion()
    and exists(select 1 from public.planes_estudio where id=new.plan_estudio_id) then
    raise exception 'Cambia la pertenencia desde el bloque electivo' using errcode='42501'; end if;
  if tg_op='INSERT' and new.grupo_electivo_id is not null and not private.grupos_electivos_operacion() then
    raise exception 'Incorpora la asignatura desde el bloque electivo' using errcode='42501'; end if;
  if new.grupo_electivo_id is not null then
    select * into g from public.grupos_electivos_plan where id=new.grupo_electivo_id for update;
    if g.plan_estudio_id<>new.plan_estudio_id or new.area_comun_origen_id is not null
      or new.numero_ciclo is distinct from g.numero_ciclo or new.linea_plan_id is distinct from g.linea_plan_id
      or new.prerrequisito_asignatura_id is not null or new.estado='archivada' then
      raise exception 'La alternativa debe conservar la ubicación del bloque y no tener seriación individual; retírala antes de archivarla' using errcode='23514'; end if;
    if exists(select 1 from public.asignaturas a where a.grupo_electivo_id=g.id and a.id<>new.id
      and ((coalesce(a.horas_academicas,0) + coalesce(a.horas_independientes,0)) <> (coalesce(new.horas_academicas,0) + coalesce(new.horas_independientes,0)))) then
      raise exception 'Las alternativas deben tener los mismos créditos y horas totales; el reparto entre horas docentes e independientes puede variar' using errcode='23514'; end if;
    if exists(select 1 from public.asignaturas where prerrequisito_asignatura_id=new.id) then
      raise exception 'Retira las seriaciones individuales antes de incorporar la alternativa' using errcode='23514'; end if;
  end if;
  if new.prerrequisito_asignatura_id is not null and exists(select 1 from public.asignaturas
    where id=new.prerrequisito_asignatura_id and grupo_electivo_id is not null) then
    raise exception 'Las alternativas electivas se serian mediante sus bloques' using errcode='23514'; end if;
  return new;
end $$;
