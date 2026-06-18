-- Al crear un plan de estudios, el jefe de carrera de la carrera del plan queda
-- como responsable desde el inicio (se le crea una tarea de revisión en el
-- estado inicial del plan). SECURITY DEFINER para poder insertar en
-- tareas_revision (su RLS exige planes.aprobar, que el jefe puede no tener al
-- crear el plan).

CREATE OR REPLACE FUNCTION public.fn_asignar_jefe_al_crear_plan()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_rol_jefe uuid;
  v_jefe uuid;
BEGIN
  SELECT id INTO v_rol_jefe FROM roles WHERE clave = 'JEFE_CARRERA';
  IF v_rol_jefe IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT ur.usuario_id INTO v_jefe
  FROM usuarios_roles ur
  JOIN usuarios_app ua ON ua.id = ur.usuario_id
  WHERE ur.rol_id = v_rol_jefe
    AND ur.carrera_id = NEW.carrera_id
    AND ua.dado_de_baja_en IS NULL
  ORDER BY ur.creado_en ASC
  LIMIT 1;

  IF v_jefe IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO tareas_revision (
    plan_estudio_id, asignado_a, rol_id, estado_id, estatus
  )
  SELECT NEW.id, v_jefe, v_rol_jefe, NEW.estado_actual_id, 'PENDIENTE'
  WHERE NOT EXISTS (
    SELECT 1 FROM tareas_revision t
    WHERE t.plan_estudio_id = NEW.id AND t.asignado_a = v_jefe
  );

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_planes_estudio_asignar_jefe ON public.planes_estudio;
CREATE TRIGGER trg_planes_estudio_asignar_jefe
  AFTER INSERT ON public.planes_estudio
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_asignar_jefe_al_crear_plan();

-- Backfill: planes activos existentes sin tarea de su jefe.
INSERT INTO public.tareas_revision (
  plan_estudio_id, asignado_a, rol_id, estado_id, estatus
)
SELECT DISTINCT ON (pe.id)
  pe.id, ur.usuario_id, r.id, pe.estado_actual_id, 'PENDIENTE'
FROM public.planes_estudio pe
JOIN public.roles r ON r.clave = 'JEFE_CARRERA'
JOIN public.usuarios_roles ur
  ON ur.rol_id = r.id AND ur.carrera_id = pe.carrera_id
JOIN public.usuarios_app ua
  ON ua.id = ur.usuario_id AND ua.dado_de_baja_en IS NULL
WHERE pe.activo = true
  AND NOT EXISTS (
    SELECT 1 FROM public.tareas_revision t
    WHERE t.plan_estudio_id = pe.id AND t.asignado_a = ur.usuario_id
  )
ORDER BY pe.id, ur.creado_en ASC;
