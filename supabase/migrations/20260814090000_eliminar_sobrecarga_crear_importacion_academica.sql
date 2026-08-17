-- PostgREST resuelve RPCs por los nombres de argumentos recibidos. La firma
-- histórica de tres parámetros compite con la actual de cuatro parámetros
-- (todos opcionales después de p_tipo), por lo que una solicitud de expediente
-- no puede resolverse de forma determinista.
drop function if exists public.crear_importacion_academica(
  public.tipo_importacion_academica,
  uuid,
  uuid
);
