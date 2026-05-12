CREATE OR REPLACE FUNCTION public.borrar_asignaturas_fallidas()
 RETURNS void
 LANGUAGE plpgsql
AS $function$
BEGIN
  DELETE FROM public.asignaturas
  WHERE creado_en < NOW() - INTERVAL '10 minutes'
    AND estado IN ('fallida', 'generando');
END;
$function$;

CREATE OR REPLACE FUNCTION public.borrar_planes_fallidos()
 RETURNS void
 LANGUAGE plpgsql
AS $function$
BEGIN
  DELETE FROM public.planes_estudio
  WHERE creado_en < NOW() - INTERVAL '10 minutes'
    AND estado_actual_id IN (
      SELECT id FROM public.estados_plan WHERE clave IN ('FALLIDO', 'GENERANDO')
    );
END;
$function$;