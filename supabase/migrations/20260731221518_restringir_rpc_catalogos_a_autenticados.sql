-- Los RPC del catálogo son SECURITY DEFINER y sólo forman parte de la API
-- autenticada. Algunos entornos conservan un grant explícito a anon aunque se
-- revoque PUBLIC, por lo que ambas concesiones se eliminan expresamente.
revoke all on function public.catalogo_asignaturas_buscar(
  text, uuid, uuid, uuid, public.tipo_asignatura,
  public.estado_asignatura, boolean, text, integer, integer
) from public, anon;
grant execute on function public.catalogo_asignaturas_buscar(
  text, uuid, uuid, uuid, public.tipo_asignatura,
  public.estado_asignatura, boolean, text, integer, integer
) to authenticated, service_role;

revoke all on function public.planes_catalogo_estados_disponibles(
  uuid, uuid, text, boolean, public.tipo_estructura_plan
) from public, anon;
grant execute on function public.planes_catalogo_estados_disponibles(
  uuid, uuid, text, boolean, public.tipo_estructura_plan
) to authenticated, service_role;

notify pgrst, 'reload schema';
