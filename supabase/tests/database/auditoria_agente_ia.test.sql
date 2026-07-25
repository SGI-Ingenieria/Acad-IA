-- Contrato de la auditoría del modo agente de IA.
--
-- Lo que se protege aquí: las columnas nuevas de `cambios_plan` y
-- `cambios_asignatura` se rellenan SOLAS, por DEFAULT, a partir de las
-- cabeceras `x-agente-*`. Ningún trigger de auditoría las menciona — son cuatro
-- funciones distintas con dieciocho INSERT — así que si alguien quitara el
-- DEFAULT nada fallaría en tiempo de compilación y el historial dejaría de
-- poder agrupar los cambios del agente en silencio.

BEGIN;

SELECT plan(20);

-- ---------------------------------------------------------------------------
-- Forma
-- ---------------------------------------------------------------------------

SELECT has_column('public', 'cambios_plan', 'agente_sesion_id', 'cambios_plan.agente_sesion_id existe');
SELECT has_column('public', 'cambios_plan', 'agente_contexto', 'cambios_plan.agente_contexto existe');
SELECT has_column('public', 'cambios_plan', 'fuente', 'cambios_plan.fuente existe');
SELECT has_column('public', 'cambios_plan', 'interaccion_ia_id', 'cambios_plan.interaccion_ia_id existe');
SELECT has_column('public', 'cambios_asignatura', 'agente_sesion_id', 'cambios_asignatura.agente_sesion_id existe');
SELECT has_column('public', 'cambios_asignatura', 'agente_contexto', 'cambios_asignatura.agente_contexto existe');

SELECT has_function('public', 'agente_ia_sesion_id', 'public.agente_ia_sesion_id() existe');
SELECT has_function('public', 'agente_ia_contexto', 'public.agente_ia_contexto() existe');

-- ---------------------------------------------------------------------------
-- Sin cabeceras (fuera de una petición de PostgREST)
-- ---------------------------------------------------------------------------

SELECT is(public.agente_ia_sesion_id(), NULL::uuid, 'sin request.headers no hay sesión de agente');
SELECT is(public.agente_ia_contexto(), NULL::text, 'sin request.headers no hay contexto de agente');

-- ---------------------------------------------------------------------------
-- Con cabeceras
-- ---------------------------------------------------------------------------

-- El contexto llega en base64 porque PostgREST rechaza la petición completa si
-- una cabecera no es UTF-8 válido, y el contexto es español: «gramática» con
-- tilde llegaba como byte Latin-1 0xF3 y tumbaba la escritura entera. El valor
-- de abajo es encode(convert_to('  mejorar gramática  ','utf8'),'base64').
SET LOCAL "request.headers" = '{"x-agente-sesion-id":"11111111-2222-3333-4444-555555555555","x-agente-contexto-b64":"ICBtZWpvcmFyIGdyYW3DoXRpY2EgIA=="}';

SELECT is(
  public.agente_ia_sesion_id(),
  '11111111-2222-3333-4444-555555555555'::uuid,
  'la sesión se lee de x-agente-sesion-id'
);
SELECT is(
  public.agente_ia_contexto(),
  'mejorar gramática',
  'el contexto se decodifica de base64 conservando las tildes y va recortado'
);

-- El DEFAULT es lo que hace que los cuatro triggers de auditoría rellenen las
-- columnas sin conocerlas: se simula un INSERT con la misma lista de columnas
-- que usa fn_track_cambios_asignatura.
INSERT INTO public.cambios_asignatura (
  asignatura_id, cambiado_por, tipo, campo, valor_anterior, valor_nuevo, fuente,
  admin_override, admin_override_motivo, admin_override_estado_clave
)
VALUES (
  gen_random_uuid(), NULL, 'ACTUALIZACION'::public.tipo_cambio, 'nombre',
  '"antes"'::jsonb, '"despues"'::jsonb, 'IA'::public.fuente_cambio,
  false, NULL, NULL
);

SELECT is(
  (SELECT agente_sesion_id FROM public.cambios_asignatura WHERE campo = 'nombre' AND valor_nuevo = '"despues"'::jsonb),
  '11111111-2222-3333-4444-555555555555'::uuid,
  'cambios_asignatura.agente_sesion_id se rellena por DEFAULT'
);
SELECT is(
  (SELECT agente_contexto FROM public.cambios_asignatura WHERE campo = 'nombre' AND valor_nuevo = '"despues"'::jsonb),
  'mejorar gramática',
  'cambios_asignatura.agente_contexto se rellena por DEFAULT'
);

-- ---------------------------------------------------------------------------
-- fuente derivada en cambios_plan
-- ---------------------------------------------------------------------------
-- Lo hace trg_cambios_plan_fuente, no un DEFAULT, porque depende de columnas de
-- la propia fila.

INSERT INTO public.cambios_plan (plan_estudio_id, cambiado_por, tipo, campo, valor_nuevo)
VALUES (gen_random_uuid(), NULL, 'ACTUALIZACION'::public.tipo_cambio, 'con-agente', '"x"'::jsonb);

SELECT is(
  (SELECT fuente FROM public.cambios_plan WHERE campo = 'con-agente'),
  'IA'::public.fuente_cambio,
  'un cambio de plan hecho en modo agente queda marcado como IA'
);

RESET "request.headers";

INSERT INTO public.cambios_plan (plan_estudio_id, cambiado_por, tipo, campo, valor_nuevo)
VALUES (gen_random_uuid(), NULL, 'ACTUALIZACION'::public.tipo_cambio, 'sin-agente', '"x"'::jsonb);

SELECT is(
  (SELECT fuente FROM public.cambios_plan WHERE campo = 'sin-agente'),
  'HUMANO'::public.fuente_cambio,
  'un cambio de plan fuera del modo agente queda marcado como HUMANO'
);
SELECT is(
  (SELECT agente_sesion_id FROM public.cambios_plan WHERE campo = 'sin-agente'),
  NULL::uuid,
  'fuera del modo agente no se inventa una sesión'
);

-- ---------------------------------------------------------------------------
-- Cabecera corrupta
-- ---------------------------------------------------------------------------
-- Una cabecera manipulada no puede tumbar la escritura que se está auditando.

SET LOCAL "request.headers" = '{"x-agente-sesion-id":"no-es-un-uuid","x-agente-contexto-b64":"no-es-base64!!"}';

INSERT INTO public.cambios_plan (plan_estudio_id, cambiado_por, tipo, campo, valor_nuevo)
VALUES (gen_random_uuid(), NULL, 'ACTUALIZACION'::public.tipo_cambio, 'uuid-basura', '"x"'::jsonb);

SELECT is(
  (SELECT agente_sesion_id FROM public.cambios_plan WHERE campo = 'uuid-basura'),
  NULL::uuid,
  'un uuid inválido en la cabecera se descarta sin romper el INSERT'
);
SELECT is(
  (SELECT agente_contexto FROM public.cambios_plan WHERE campo = 'uuid-basura'),
  NULL::text,
  'un base64 corrupto se descarta sin romper el INSERT'
);

-- ---------------------------------------------------------------------------
-- Compatibilidad con la cabecera en claro
-- ---------------------------------------------------------------------------
-- Un cliente que sólo pueda mandar ASCII sin codificar sigue siendo auditable.

SET LOCAL "request.headers" = '{"x-agente-contexto":"  sin tildes  "}';

SELECT is(
  public.agente_ia_contexto(),
  'sin tildes',
  'x-agente-contexto en claro sigue funcionando como respaldo'
);

SELECT * FROM finish();

ROLLBACK;
