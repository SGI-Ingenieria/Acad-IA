-- Corrige funciones ya aplicadas sin duplicar el cuerpo completo de la RPC.
-- Se normaliza el tipo del estado de las tareas antes del UNION.
DO $$
DECLARE
  v_definition text;
BEGIN
  SELECT pg_get_functiondef(
    'public.inicio_workspace(text,uuid,uuid)'::regprocedure
  )
  INTO v_definition;

  v_definition := replace(
    v_definition,
    'x.actualizado_en',
    'x."actualizadoEn"'
  );
  v_definition := replace(
    v_definition,
    'tr.estatus AS estado',
    'tr.estatus::text AS estado'
  );

  EXECUTE v_definition;
END;
$$;

