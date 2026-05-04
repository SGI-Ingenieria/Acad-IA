-- 1. Crear la función encargada del borrado
CREATE OR REPLACE FUNCTION public.borrar_planes_fallidos()
RETURNS void AS $$
BEGIN
  DELETE FROM public.planes_estudio
  WHERE creado_en < NOW() - INTERVAL '2 minutes'
    AND estado_actual_id = (
      SELECT id FROM public.estados_plan WHERE clave = 'FALLIDO' LIMIT 1
    );
END;
$$ LANGUAGE plpgsql;

-- 2. Programar el cron job (revisa cada minuto)
SELECT cron.schedule(
  'limpieza-planes-fallidos-2m',
  '* * * * *',
  'SELECT public.borrar_planes_fallidos();'
);