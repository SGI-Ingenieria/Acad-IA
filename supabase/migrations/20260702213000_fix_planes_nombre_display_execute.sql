-- Corrige el 403 "permission denied for function fn_generar_nombre_plan_curricular"
-- al insertar/actualizar planes.
--
-- Causa: la migración 20260702205046 revocó EXECUTE sobre las funciones de
-- nombre a `authenticated`. El trigger `fn_planes_set_nombre_display` era
-- SECURITY INVOKER, por lo que su llamada anidada a
-- `fn_generar_nombre_plan_curricular` se evaluaba con los privilegios del
-- usuario autenticado (sin EXECUTE) y fallaba.
--
-- Solución: los triggers de nombre pasan a SECURITY DEFINER. Los triggers se
-- disparan sin verificar EXECUTE, y al ejecutarse como el propietario la
-- llamada anidada sí tiene permiso. Las funciones siguen sin poder invocarse
-- directamente desde la API (REST/RPC), que es la intención de los revokes.

alter function public.fn_planes_set_nombre_display() security definer;

alter function public.fn_carreras_refresh_planes_nombre_display() security definer;

-- Reafirmamos los revokes para dejar constancia del estado deseado.
revoke execute on function public.fn_generar_nombre_plan_curricular(uuid, date) from public, anon, authenticated;
revoke execute on function public.fn_planes_set_nombre_display() from public, anon, authenticated;
revoke execute on function public.fn_carreras_refresh_planes_nombre_display() from public, anon, authenticated;
