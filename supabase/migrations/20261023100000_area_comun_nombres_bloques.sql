-- Normaliza la nomenclatura visible de los bloques sin cambiar sus claves.
update public.area_comun_bloques
set nombre = case clave
  when 'HUMANISMO_SOCIEDAD' then 'Humanismo y Sociedad'
  when 'EMPRENDIMIENTO_SUSTENTABILIDAD' then 'Emprendimiento y Sostenibilidad'
  else nombre
end
where clave in ('HUMANISMO_SOCIEDAD', 'EMPRENDIMIENTO_SUSTENTABILIDAD');

create or replace function private.area_comun_bloque_clave(p_bloque text)
returns text language sql immutable set search_path = '' as $$
  select case p_bloque
    when 'Pensamiento y Comunicación' then 'PENSAMIENTO_COMUNICACION'
    when 'Humanismo y Sociedad' then 'HUMANISMO_SOCIEDAD'
    when 'Humanismo Sociedad' then 'HUMANISMO_SOCIEDAD'
    when 'Lengua Extranjera' then 'LENGUA_EXTRANJERA'
    when 'Emprendimiento y Sostenibilidad' then 'EMPRENDIMIENTO_SUSTENTABILIDAD'
    when 'Emprendimiento Sustentabilidad' then 'EMPRENDIMIENTO_SUSTENTABILIDAD'
    when 'Emprendimiento Sostenibilidad' then 'EMPRENDIMIENTO_SUSTENTABILIDAD'
    else null
  end;
$$;

grant execute on function private.area_comun_bloque_clave(text) to authenticated;
