-- Corrige la violación de "asignaturas_orden_celda_unico" (23505) al mover una
-- asignatura de celda del mapa (por ejemplo, al editar el semestre/ciclo desde
-- el encabezado de la asignatura o desde el mapa).
--
-- El índice único parcial garantiza que dentro de una celda del mapa
-- (plan_estudio_id, linea_plan_id, numero_ciclo) no haya dos asignaturas con el
-- mismo orden_celda. Cuando una asignatura cambia de celda pero conserva su
-- orden_celda original, colisiona con la asignatura que ya ocupa esa posición en
-- la celda destino.
--
-- Este disparador BEFORE reubica automáticamente la asignatura al final de la
-- celda destino cuando su posición ya está ocupada, de forma centralizada para
-- TODAS las rutas de escritura (encabezado, mapa, edge functions), sin depender
-- de que el llamador calcule un orden_celda libre.
--
-- Convive con fn_ajustar_seriacion_por_cambio_ciclo (mismo patrón: BEFORE sobre
-- cambios de celda que ajusta estado derivado en NEW). No toca reordenamientos
-- dentro de la MISMA celda: en ese caso el orden_celda lo controla el llamador.

CREATE OR REPLACE FUNCTION public.fn_reubicar_orden_celda_por_cambio_celda()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path TO 'public', 'private', 'auth', 'extensions', 'pg_temp'
AS $function$
DECLARE
  hay_conflicto boolean;
  siguiente integer;
BEGIN
  -- Solo participan del índice único las filas ubicadas en una celda completa.
  IF NEW.linea_plan_id IS NULL
     OR NEW.numero_ciclo IS NULL
     OR NEW.orden_celda IS NULL THEN
    RETURN NEW;
  END IF;

  -- En un UPDATE que NO cambia la celda destino (mismo plan, línea y ciclo) se
  -- trata de un reordenamiento explícito dentro de la celda: el llamador es el
  -- dueño del orden_celda y no debemos reubicar.
  IF TG_OP = 'UPDATE'
     AND NEW.plan_estudio_id IS NOT DISTINCT FROM OLD.plan_estudio_id
     AND NEW.linea_plan_id   IS NOT DISTINCT FROM OLD.linea_plan_id
     AND NEW.numero_ciclo    IS NOT DISTINCT FROM OLD.numero_ciclo THEN
    RETURN NEW;
  END IF;

  -- ¿La posición destino ya está ocupada por OTRA asignatura?
  SELECT EXISTS (
    SELECT 1
    FROM public.asignaturas a
    WHERE a.plan_estudio_id = NEW.plan_estudio_id
      AND a.linea_plan_id   = NEW.linea_plan_id
      AND a.numero_ciclo    = NEW.numero_ciclo
      AND a.orden_celda     = NEW.orden_celda
      AND a.id <> NEW.id
  ) INTO hay_conflicto;

  IF hay_conflicto THEN
    -- Reubica al final de la celda destino, en la primera posición libre.
    SELECT COALESCE(MAX(a.orden_celda), -1) + 1
    INTO siguiente
    FROM public.asignaturas a
    WHERE a.plan_estudio_id = NEW.plan_estudio_id
      AND a.linea_plan_id   = NEW.linea_plan_id
      AND a.numero_ciclo    = NEW.numero_ciclo
      AND a.id <> NEW.id;

    NEW.orden_celda := siguiente;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_asignaturas_reubicar_orden_celda ON public.asignaturas;

CREATE TRIGGER trg_asignaturas_reubicar_orden_celda
  BEFORE INSERT OR UPDATE OF plan_estudio_id, linea_plan_id, numero_ciclo, orden_celda
  ON public.asignaturas
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_reubicar_orden_celda_por_cambio_celda();

COMMENT ON FUNCTION public.fn_reubicar_orden_celda_por_cambio_celda() IS
  'Reubica orden_celda al final de la celda destino cuando una asignatura cambia de celda y su posición ya está ocupada, evitando violar asignaturas_orden_celda_unico. No interviene en reordenamientos dentro de la misma celda.';
