create or replace function private.titulo_conversacion_ia_desde_prompt(
  p_prompt text
)
returns text
language plpgsql
immutable
strict
set search_path = pg_catalog
as $function$
declare
  v_source text;
  v_title text;
begin
  v_source := btrim(regexp_replace(p_prompt, '[[:space:]]+', ' ', 'g'));
  if v_source = '' then
    return null;
  end if;

  v_title := regexp_replace(
    v_source,
    '^[/"''`*_#>[[:space:]-]+',
    ''
  );
  v_title := regexp_replace(
    v_title,
    '^(por favor[[:space:]]+)?(ay[uú]dame a|puedes|podr[ií]as|quiero|necesito|mejora|mejorar|redacta|genera|crea|analiza|revisa|califica)[[:space:]]+',
    '',
    'i'
  );
  v_title := regexp_replace(v_title, '[.?!].*$', '');
  v_title := btrim(regexp_replace(v_title, '[[:space:]:;,.]+$', ''));

  if v_title = '' then
    v_title := v_source;
  end if;

  if char_length(v_title) > 72 then
    v_title := btrim(left(v_title, 72));
    v_title := btrim(regexp_replace(v_title, '[[:space:]]+[^[:space:]]*$', ''));
    if v_title = '' then
      v_title := left(v_source, 72);
    end if;
  end if;

  return nullif(v_title, '');
end;
$function$;

comment on function private.titulo_conversacion_ia_desde_prompt(text) is
  'Deriva sin red un título provisional y acotado a partir del primer prompt.';

create or replace function private.reparar_titulos_conversaciones_ia_legacy()
returns table (
  planes_actualizados integer,
  asignaturas_actualizadas integer
)
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $function$
begin
  with primeros_mensajes as (
    select distinct on (m.conversacion_plan_id)
      m.conversacion_plan_id as conversacion_id,
      private.titulo_conversacion_ia_desde_prompt(m.mensaje) as titulo
    from public.plan_mensajes_ia m
    where nullif(btrim(m.mensaje), '') is not null
    order by m.conversacion_plan_id, m.fecha_creacion, m.id
  )
  update public.conversaciones_plan c
  set nombre = p.titulo
  from primeros_mensajes p
  where c.id = p.conversacion_id
    and p.titulo is not null
    and c.nombre is distinct from p.titulo
    and (
      nullif(btrim(c.nombre), '') is null
      or translate(lower(btrim(c.nombre)), 'áéíóúüñ', 'aeiouun') in (
        'consulta academica',
        'mejora de campos'
      )
      or c.nombre ~* '^Chat[[:space:]]+[0-9]{4}-[0-9]{2}-[0-9]{2}'
    );
  get diagnostics planes_actualizados = row_count;

  with primeros_mensajes as (
    select distinct on (m.conversacion_asignatura_id)
      m.conversacion_asignatura_id as conversacion_id,
      private.titulo_conversacion_ia_desde_prompt(m.mensaje) as titulo
    from public.asignatura_mensajes_ia m
    where nullif(btrim(m.mensaje), '') is not null
    order by m.conversacion_asignatura_id, m.fecha_creacion, m.id
  )
  update public.conversaciones_asignatura c
  set nombre = p.titulo
  from primeros_mensajes p
  where c.id = p.conversacion_id
    and p.titulo is not null
    and c.nombre is distinct from p.titulo
    and (
      nullif(btrim(c.nombre), '') is null
      or translate(lower(btrim(c.nombre)), 'áéíóúüñ', 'aeiouun') in (
        'consulta academica',
        'mejora de campos'
      )
      or c.nombre ~* '^Chat[[:space:]]+[0-9]{4}-[0-9]{2}-[0-9]{2}'
    );
  get diagnostics asignaturas_actualizadas = row_count;

  return next;
end;
$function$;

comment on function private.reparar_titulos_conversaciones_ia_legacy() is
  'Repara sólo títulos genéricos heredados usando el primer prompt de cada chat.';

revoke all on function private.titulo_conversacion_ia_desde_prompt(text)
  from public, anon, authenticated;
revoke all on function private.reparar_titulos_conversaciones_ia_legacy()
  from public, anon, authenticated;
grant execute on function private.titulo_conversacion_ia_desde_prompt(text)
  to service_role;
grant execute on function private.reparar_titulos_conversaciones_ia_legacy()
  to service_role;

select * from private.reparar_titulos_conversaciones_ia_legacy();
