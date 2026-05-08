create extension if not exists "pg_cron" with schema "pg_catalog";


ALTER TYPE "public"."estado_asignatura" ADD VALUE IF NOT EXISTS 'generando';
ALTER TYPE "public"."estado_asignatura" ADD VALUE IF NOT EXISTS 'fallida';



set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.borrar_asignaturas_fallidas()
 RETURNS void
 LANGUAGE plpgsql
AS $function$
BEGIN
  DELETE FROM public.asignaturas
  WHERE creado_en < NOW() - INTERVAL '10 minutes'
    AND estado = 'fallida';
END;
$function$
;

CREATE OR REPLACE FUNCTION public.borrar_planes_fallidos()
 RETURNS void
 LANGUAGE plpgsql
AS $function$
BEGIN
  DELETE FROM public.planes_estudio
  WHERE creado_en < NOW() - INTERVAL '10 minutes'
    AND estado_actual_id = (
      SELECT id FROM public.estados_plan WHERE clave = 'FALLIDO' LIMIT 1
    );
END;
$function$
;

SELECT cron.schedule(
  'limpieza-planes-fallidos-10m',
  '*/5 * * * *',
  'SELECT public.borrar_planes_fallidos();'
);

SELECT cron.schedule(
  'limpieza-asignaturas-fallidas-10m',
  '*/5 * * * *',
  'SELECT public.borrar_asignaturas_fallidas();'
);