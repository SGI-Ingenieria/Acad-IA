alter table private.intentos_generacion_ia
  add column terminal_aplicado_en timestamptz,
  add constraint intentos_generacion_ia_sin_file_data_check
    check (not jsonb_path_exists(solicitud, '$.**.file_data')),
  add constraint intentos_generacion_ia_sin_image_data_url_check
    check (
      not jsonb_path_exists(
        solicitud,
        '$.**.image_url ? (@ starts with "data:")'
      )
    );

create index intentos_generacion_ia_terminal_pendiente_idx
  on private.intentos_generacion_ia (handler, actualizado_en)
  where estado in ('fallido', 'expirado')
    and terminal_aplicado_en is null;

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
  ), expiradas as (
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
  from expiradas;

  return v_resultado;
end;
$$;

create or replace function public.confirmar_terminal_intento_generacion_ia(
  p_intento_id uuid,
  p_token_reclamacion uuid
) returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actualizado integer;
begin
  update private.intentos_generacion_ia i
  set terminal_aplicado_en = coalesce(i.terminal_aplicado_en, now()),
      token_reclamacion = null,
      reclamado_por = null,
      reclamado_hasta = null,
      actualizado_en = now()
  where i.id = p_intento_id
    and i.estado in ('fallido', 'expirado')
    and i.terminal_aplicado_en is null
    and i.token_reclamacion = p_token_reclamacion
    and i.reclamado_hasta > now();
  get diagnostics v_actualizado = row_count;
  return v_actualizado = 1;
end;
$$;

comment on function public.expirar_intentos_generacion_ia(text, integer) is
  'Reclama intentos vencidos por handler; reentrega terminales hasta que el adaptador confirme su aplicación con CAS.';
comment on function public.confirmar_terminal_intento_generacion_ia(uuid, uuid) is
  'Confirma dentro de la transición del handler que el fallo terminal ya se aplicó a la entidad vigente.';

revoke all on function public.expirar_intentos_generacion_ia(text, integer)
  from public, anon, authenticated;
revoke all on function public.confirmar_terminal_intento_generacion_ia(uuid, uuid)
  from public, anon, authenticated;

grant execute on function public.expirar_intentos_generacion_ia(text, integer)
  to service_role;
grant execute on function public.confirmar_terminal_intento_generacion_ia(uuid, uuid)
  to service_role;
