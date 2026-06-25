do $$
begin
  if not exists (
    select 1
    from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    where t.typnamespace = 'public'::regnamespace
      and t.typname = 'estado_mensaje_ia'
      and e.enumlabel = 'CANCELADO'
  ) then
    alter type public.estado_mensaje_ia add value 'CANCELADO';
  end if;
end $$;

alter table public.plan_mensajes_ia
  add column if not exists openai_response_id text;

alter table public.asignatura_mensajes_ia
  add column if not exists openai_response_id text;

create index if not exists idx_plan_mensajes_ia_openai_response_id
  on public.plan_mensajes_ia(openai_response_id);

create index if not exists idx_asignatura_mensajes_ia_openai_response_id
  on public.asignatura_mensajes_ia(openai_response_id);
