-- Corrige instalaciones que ya aplicaron el núcleo inicial: tanto un fallo
-- terminal como una expiración deben reentregarse hasta que el adaptador de la
-- entidad confirme, con el token vigente, que aplicó el estado terminal.

create or replace function public.expirar_intentos_generacion_ia(
  p_handler text,
  p_limite integer default 100
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_resultado jsonb;
begin
  if nullif(btrim(coalesce(p_handler, '')), '') is null then
    raise exception using errcode = '22023', message = 'handler es requerido';
  end if;

  with candidatas as (
    select i.id
    from private.intentos_generacion_ia i
    where i.handler = p_handler
      and i.terminal_aplicado_en is null
      and (
        (
          i.estado in ('preparado', 'reclamado', 'respuesta_vinculada')
          and i.fecha_limite <= now()
        )
        or (
          i.estado in ('fallido', 'expirado')
          and (i.reclamado_hasta is null or i.reclamado_hasta <= now())
        )
      )
    order by i.fecha_limite, i.creado_en
    for update skip locked
    limit greatest(1, least(coalesce(p_limite, 100), 500))
  ), terminales as (
    update private.intentos_generacion_ia i
    set estado = case
          when i.estado = 'fallido' then 'fallido'
          else 'expirado'
        end,
        token_reclamacion = gen_random_uuid(),
        reclamado_por = 'terminal:' || p_handler,
        reclamado_hasta = now() + interval '2 minutes',
        ultimo_error = case
          when i.estado = 'fallido' then i.ultimo_error
          else jsonb_build_object(
            'code', 'GENERATION_ATTEMPT_TIMEOUT',
            'message', 'El intento excedió el límite de 60 minutos.'
          )
        end,
        actualizado_en = now()
    from candidatas c
    where i.id = c.id
    returning to_jsonb(i) as value
  )
  select coalesce(jsonb_agg(value), '[]'::jsonb)
  into v_resultado
  from terminales;

  return v_resultado;
end;
$$;

comment on function public.expirar_intentos_generacion_ia(text, integer) is
  'Reclama intentos vencidos y reentrega fallos o expiraciones no confirmados hasta que el adaptador aplique el terminal con CAS.';

revoke all on function public.expirar_intentos_generacion_ia(text, integer)
  from public, anon, authenticated;
grant execute on function public.expirar_intentos_generacion_ia(text, integer)
  to service_role;
