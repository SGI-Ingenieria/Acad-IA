alter table public.plan_mensajes_ia
  add column web_search_enabled boolean not null default false,
  add column reasoning_effort text not null default 'auto',
  add column retry_of_message_id uuid
    references public.plan_mensajes_ia(id) on delete set null,
  add constraint plan_mensajes_ia_reasoning_effort_check
    check (reasoning_effort in ('auto', 'none', 'low', 'medium', 'high'));

alter table public.asignatura_mensajes_ia
  add column web_search_enabled boolean not null default false,
  add column reasoning_effort text not null default 'auto',
  add column retry_of_message_id uuid
    references public.asignatura_mensajes_ia(id) on delete set null,
  add constraint asignatura_mensajes_ia_reasoning_effort_check
    check (reasoning_effort in ('auto', 'none', 'low', 'medium', 'high'));

create index plan_mensajes_ia_retry_of_message_id_idx
  on public.plan_mensajes_ia (retry_of_message_id)
  where retry_of_message_id is not null;

create index asignatura_mensajes_ia_retry_of_message_id_idx
  on public.asignatura_mensajes_ia (retry_of_message_id)
  where retry_of_message_id is not null;

comment on column public.plan_mensajes_ia.web_search_enabled is
  'Control de búsqueda web congelado para reproducir fielmente una solicitud IA.';
comment on column public.plan_mensajes_ia.reasoning_effort is
  'Esfuerzo de razonamiento congelado para reproducir fielmente una solicitud IA.';
comment on column public.plan_mensajes_ia.retry_of_message_id is
  'Mensaje original cuya solicitud congelada se reutilizó en este reintento.';

comment on column public.asignatura_mensajes_ia.web_search_enabled is
  'Control de búsqueda web congelado para reproducir fielmente una solicitud IA.';
comment on column public.asignatura_mensajes_ia.reasoning_effort is
  'Esfuerzo de razonamiento congelado para reproducir fielmente una solicitud IA.';
comment on column public.asignatura_mensajes_ia.retry_of_message_id is
  'Mensaje original cuya solicitud congelada se reutilizó en este reintento.';
