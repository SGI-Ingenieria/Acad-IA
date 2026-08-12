-- El retiro automático es el único punto de escritura autorizado; conservar
-- las operaciones separadas permitiría omitir la protección del último vigente.

drop function if exists public.archivar_paquete_curricular(uuid);
drop function if exists public.eliminar_paquete_curricular(uuid);
