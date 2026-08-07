-- Desvincular una asignatura de una línea curricular no cambia su plan ni su
-- estructura de asignatura. La validación de pertenencia debe reservarse para
-- cambios de esos dos campos; de lo contrario, una asignatura histórica con
-- estructura inconsistente impide borrar la línea y dejarla sin clasificación.
CREATE OR REPLACE FUNCTION public.fn_validar_asignatura_estructura_plan()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, auth, extensions, pg_temp
AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND NEW.plan_estudio_id IS NOT DISTINCT FROM OLD.plan_estudio_id
     AND NEW.estructura_id IS NOT DISTINCT FROM OLD.estructura_id
  THEN
    RETURN NEW;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.planes_estudio pe
    JOIN public.estructuras_asignatura ea ON ea.id = NEW.estructura_id
    WHERE pe.id = NEW.plan_estudio_id
      AND ea.estructura_plan_id = pe.estructura_id
  ) THEN
    RAISE EXCEPTION 'La estructura de asignatura no pertenece a la estructura del plan'
      USING ERRCODE = 'foreign_key_violation';
  END IF;

  RETURN NEW;
END;
$$;

-- Asegura que una actualización automática de linea_plan_id por ON DELETE SET
-- NULL no active esta validación en instalaciones cuyo trigger quedó más amplio.
DROP TRIGGER IF EXISTS aa_validar_asignatura_estructura_plan
  ON public.asignaturas;

CREATE TRIGGER aa_validar_asignatura_estructura_plan
BEFORE INSERT OR UPDATE OF plan_estudio_id, estructura_id
ON public.asignaturas
FOR EACH ROW
EXECUTE FUNCTION public.fn_validar_asignatura_estructura_plan();
