-- La secretaría académica puede iniciar planes dentro de la facultad asignada.
-- El alcance se conserva en la política de inserción de planes mediante
-- authz_can_access_carrera; este cambio no le concede un alcance global.
INSERT INTO public.roles_permisos (rol_id, permiso_id)
SELECT r.id, p.id
FROM public.roles r
JOIN public.permisos p ON p.clave = 'planes.crear'
WHERE r.clave = 'SECRETARIO_ACADEMICO'
ON CONFLICT (rol_id, permiso_id) DO NOTHING;

-- catalogos.gestionar no tiene alcance por carrera: permite insertar una
-- facultad. La jefatura conserva la edición de su carrera por medio de
-- authz_can_manage_carrera_catalog, sin poder crear facultades.
DELETE FROM public.roles_permisos rp
USING public.roles r, public.permisos p
WHERE rp.rol_id = r.id
  AND rp.permiso_id = p.id
  AND r.clave = 'JEFE_CARRERA'
  AND p.clave = 'catalogos.gestionar';

-- La secretaría puede administrar carreras de su facultad mediante las
-- políticas con alcance académico, pero no el catálogo global de facultades.
DELETE FROM public.roles_permisos rp
USING public.roles r, public.permisos p
WHERE rp.rol_id = r.id
  AND rp.permiso_id = p.id
  AND r.clave = 'SECRETARIO_ACADEMICO'
  AND p.clave = 'catalogos.gestionar';
