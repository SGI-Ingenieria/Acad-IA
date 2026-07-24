-- Una asignatura sin ciclo no puede ser origen ni destino de una seriación.
-- Al retirarla del mapa se eliminan las relaciones que dejarían de ser válidas.
create or replace function public.fn_ajustar_seriacion_por_cambio_ciclo()
returns trigger
language plpgsql
set search_path to 'public', 'private', 'auth', 'extensions', 'pg_temp'
as $$
begin
  if new.numero_ciclo is null then
    update public.asignaturas
    set prerrequisito_asignatura_id = null
    where prerrequisito_asignatura_id = new.id;

    new.prerrequisito_asignatura_id := null;
    return new;
  end if;

  update public.asignaturas
  set prerrequisito_asignatura_id = null
  where prerrequisito_asignatura_id = new.id
    and numero_ciclo <= new.numero_ciclo;

  if new.prerrequisito_asignatura_id is not null then
    if exists (
      select 1
      from public.asignaturas
      where id = new.prerrequisito_asignatura_id
        and numero_ciclo >= new.numero_ciclo
    ) then
      new.prerrequisito_asignatura_id := null;
    end if;
  end if;

  return new;
end;
$$;
