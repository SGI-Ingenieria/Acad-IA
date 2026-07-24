-- El frontend (estructuras_plan_update en meta.api.ts) llama a
-- supabase.rpc('actualizar_estructura_plan_definicion', ...), que PostgREST
-- resuelve en el esquema public. La implementación vive en
-- private.actualizar_estructura_plan_definicion (SECURITY DEFINER, con su propia
-- verificación de auth.uid() y del permiso 'catalogos.gestionar'), pero faltaba
-- el envoltorio público que la expone. Sin él, guardar la definición de una
-- estructura falla con:
--   "Could not find the function
--    public.actualizar_estructura_plan_definicion(...) in the schema cache".
--
-- Se sigue la convención del repo (envoltorio public -> implementación private,
-- p. ej. authz_has_permission, consultar_intento_generacion_ia). El envoltorio
-- es SECURITY DEFINER para poder invocar la función private (reservada a
-- postgres/service_role) sin exponerla; la autorización real la sigue haciendo
-- la implementación private mediante auth.uid() y authz_has_permission, que leen
-- los claims del JWT y no dependen del rol SQL efectivo.

CREATE OR REPLACE FUNCTION public.actualizar_estructura_plan_definicion(
  p_id uuid,
  p_definicion jsonb,
  p_operaciones jsonb DEFAULT '{}'::jsonb
) RETURNS public.estructuras_plan
  LANGUAGE sql
  SECURITY DEFINER
  SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT private.actualizar_estructura_plan_definicion(p_id, p_definicion, p_operaciones);
$$;

ALTER FUNCTION public.actualizar_estructura_plan_definicion(uuid, jsonb, jsonb)
  OWNER TO postgres;

REVOKE ALL ON FUNCTION public.actualizar_estructura_plan_definicion(uuid, jsonb, jsonb)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.actualizar_estructura_plan_definicion(uuid, jsonb, jsonb)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.actualizar_estructura_plan_definicion(uuid, jsonb, jsonb)
  TO service_role;

COMMENT ON FUNCTION public.actualizar_estructura_plan_definicion(uuid, jsonb, jsonb) IS
  'Envoltorio público de private.actualizar_estructura_plan_definicion: actualiza la definición de una estructura de plan y propaga cambios a los planes dependientes. La autorización (permiso catalogos.gestionar) la realiza la implementación private.';
