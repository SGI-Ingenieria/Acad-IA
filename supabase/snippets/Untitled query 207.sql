UPDATE public.carreras
SET nivel = cd.nivel
FROM public.carreras_duplicate cd
WHERE carreras.nombre_corto = cd.nombre_corto;