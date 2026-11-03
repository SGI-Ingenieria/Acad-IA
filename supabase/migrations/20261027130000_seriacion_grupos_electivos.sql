-- #296: dependencias entre espacios electivos, nunca entre sus alternativas.
-- El JSON completo ya viaja en publicaciones e incorporaciones; no se materializa
-- una dependencia de grupo como prerrequisito de una asignatura individual.
create function private.validar_seriaciones_grupos_electivos(p_distribuciones jsonb)
returns void language plpgsql immutable set search_path = '' as $$
declare d jsonb; g jsonb; previo jsonb;
begin
  if jsonb_typeof(p_distribuciones) is distinct from 'array' then
    raise exception 'Las distribuciones deben ser una lista' using errcode='23514';
  end if;
  for d in select value from jsonb_array_elements(p_distribuciones) loop
    if jsonb_typeof(d->'espacios') is distinct from 'array' then
      raise exception 'La distribución debe contener espacios' using errcode='23514';
    end if;
    if exists (select 1 from jsonb_array_elements(d->'espacios') e group by e->>'clave' having count(*)>1) then
      raise exception 'Hay espacios duplicados' using errcode='23514';
    end if;
    for g in select value from jsonb_array_elements(d->'espacios') loop
      if not (g ? 'prerrequisito_grupo_clave') then continue; end if;
      select value into previo from jsonb_array_elements(d->'espacios')
        where value->>'clave'=g->>'prerrequisito_grupo_clave';
      -- Ciclos estrictamente crecientes excluyen también dependencias circulares.
      if nullif(btrim(g->>'prerrequisito_grupo_clave'),'') is null
        or jsonb_typeof(g->'opciones') is distinct from 'array'
        or jsonb_array_length(g->'opciones')=0
        or previo is null or jsonb_typeof(previo->'opciones') is distinct from 'array'
        or jsonb_array_length(previo->'opciones')=0
        or previo->>'clave'=g->>'clave'
        or coalesce((previo->>'numero_ciclo')::integer,0)<1
        or coalesce((g->>'numero_ciclo')::integer,0)<1
        or (previo->>'numero_ciclo')::integer >= (g->>'numero_ciclo')::integer then
        raise exception 'La seriación debe enlazar grupos electivos de la misma distribución y de un ciclo anterior' using errcode='23514';
      end if;
    end loop;
  end loop;
end $$;
revoke all on function private.validar_seriaciones_grupos_electivos(jsonb) from public,anon,authenticated,service_role;

create function private.validar_configuracion_seriaciones_electivas()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_table_name='area_comun_configuracion' then
    perform private.validar_seriaciones_grupos_electivos(new.borrador);
  else
    perform private.validar_seriaciones_grupos_electivos(new.contenido->'distribuciones');
  end if;
  return new;
end $$;
revoke all on function private.validar_configuracion_seriaciones_electivas() from public,anon,authenticated,service_role;
create trigger validar_grupos_electivos_borrador before insert or update of borrador
on public.area_comun_configuracion for each row execute function private.validar_configuracion_seriaciones_electivas();
create trigger validar_grupos_electivos_publicacion before insert
on public.area_comun_publicaciones for each row execute function private.validar_configuracion_seriaciones_electivas();

create function private.validar_seriacion_individual_electiva()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_origen uuid; v_pre_origen uuid; v_distribuciones jsonb;
begin
  if new.prerrequisito_asignatura_id is null then return new; end if;
  -- Una relación histórica incompatible se conserva hasta que el usuario la quite.
  if tg_op='UPDATE' and new.prerrequisito_asignatura_id is not distinct from old.prerrequisito_asignatura_id then return new; end if;
  v_origen:=coalesce(new.area_comun_origen_id,new.id);
  select coalesce(a.area_comun_origen_id,a.id) into v_pre_origen
    from public.asignaturas a where a.id=new.prerrequisito_asignatura_id;
  select c.borrador into v_distribuciones from public.area_comun_configuracion c for share;
  if exists (
    select 1 from jsonb_array_elements(v_distribuciones) d
    cross join lateral jsonb_array_elements(d->'espacios') e
    where e->'opciones' ? v_origen::text or e->'opciones' ? v_pre_origen::text
  ) or exists (
    -- Los receptores usan la publicación incorporada, aunque cambie el borrador.
    select 1 from public.area_comun_incorporaciones i
    join public.area_comun_publicaciones p on p.id=i.publicacion_id
    cross join lateral jsonb_array_elements(p.contenido->'distribuciones') d
    cross join lateral jsonb_array_elements(d->'espacios') e
    where i.plan_id=new.plan_estudio_id
      and (e->'opciones' ? v_origen::text or e->'opciones' ? v_pre_origen::text)
  ) then
    raise exception 'Las alternativas electivas se serian mediante sus grupos; quita la relación individual y configura el grupo antecedente' using errcode='23514';
  end if;
  return new;
end $$;
revoke all on function private.validar_seriacion_individual_electiva() from public,anon,authenticated,service_role;
create trigger validar_seriacion_individual_electiva before insert or update of prerrequisito_asignatura_id
on public.asignaturas for each row execute function private.validar_seriacion_individual_electiva();
