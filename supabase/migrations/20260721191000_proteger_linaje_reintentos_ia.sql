alter table public.plan_mensajes_ia
  drop constraint plan_mensajes_ia_retry_of_message_id_fkey,
  add constraint plan_mensajes_ia_retry_identity_key
    unique (id, conversacion_plan_id, enviado_por),
  add constraint plan_mensajes_ia_retry_source_fkey
    foreign key (retry_of_message_id, conversacion_plan_id, enviado_por)
    references public.plan_mensajes_ia (id, conversacion_plan_id, enviado_por)
    deferrable initially immediate;

alter table public.asignatura_mensajes_ia
  drop constraint asignatura_mensajes_ia_retry_of_message_id_fkey,
  add constraint asignatura_mensajes_ia_retry_identity_key
    unique (id, conversacion_asignatura_id, enviado_por),
  add constraint asignatura_mensajes_ia_retry_source_fkey
    foreign key (retry_of_message_id, conversacion_asignatura_id, enviado_por)
    references public.asignatura_mensajes_ia (
      id, conversacion_asignatura_id, enviado_por
    )
    deferrable initially immediate;
