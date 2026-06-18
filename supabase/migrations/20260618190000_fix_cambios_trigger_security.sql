-- Las funciones trigger de auditoría necesitan SECURITY DEFINER para poder
-- insertar en cambios_plan / cambios_asignatura cuando RLS está habilitado.
-- Sin esto, el INSERT falla con 42501 porque no hay política INSERT en esas
-- tablas y la función corre con los privilegios del usuario que disparó el
-- cambio (no del owner postgres).

ALTER FUNCTION public.fn_log_cambios_planes_estudio()
  SECURITY DEFINER SET search_path = public;

ALTER FUNCTION public.fn_track_cambios_asignatura()
  SECURITY DEFINER SET search_path = public;
