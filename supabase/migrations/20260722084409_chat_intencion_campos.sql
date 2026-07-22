-- Fase 1/2 del chat inteligente:
-- - intencion: 'consultar' | 'editar' | null
-- - trigger para no perder la respuesta conversacional rapida cuando el
--   finalizador de propuestas actualiza solo `propuesta`.

alter table public.plan_mensajes_ia
  add column if not exists intencion text;

alter table public.asignatura_mensajes_ia
  add column if not exists intencion text;

create or replace function private.preserve_chat_respuesta_on_null()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if NEW.respuesta is null and OLD.respuesta is not null then
    NEW.respuesta := OLD.respuesta;
  end if;
  return NEW;
end;
$$;

drop trigger if exists plan_mensajes_ia_preserve_respuesta on public.plan_mensajes_ia;
create trigger plan_mensajes_ia_preserve_respuesta
  before update on public.plan_mensajes_ia
  for each row
  execute function private.preserve_chat_respuesta_on_null();

drop trigger if exists asignatura_mensajes_ia_preserve_respuesta on public.asignatura_mensajes_ia;
create trigger asignatura_mensajes_ia_preserve_respuesta
  before update on public.asignatura_mensajes_ia
  for each row
  execute function private.preserve_chat_respuesta_on_null();

comment on column public.plan_mensajes_ia.intencion is
  'Intencion detectada por la IA: consultar o editar.';
comment on column public.asignatura_mensajes_ia.intencion is
  'Intencion detectada por la IA: consultar o editar.';
