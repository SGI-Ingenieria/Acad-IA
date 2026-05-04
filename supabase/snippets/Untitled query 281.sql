UPDATE public.carreras
SET nombre = cd.nombre
FROM public.carreras_duplicate cd
WHERE carreras.nombre_corto = cd.nombre_corto;