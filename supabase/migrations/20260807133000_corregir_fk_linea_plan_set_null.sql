-- Al eliminar una línea curricular, la asignatura debe conservar su plan.
-- La FK compuesta no debe establecer plan_estudio_id en NULL.
ALTER TABLE public.asignaturas
  DROP CONSTRAINT IF EXISTS asignaturas_linea_plan_fk_compuesta;

ALTER TABLE public.asignaturas
  ADD CONSTRAINT asignaturas_linea_plan_fk_compuesta
  FOREIGN KEY (linea_plan_id, plan_estudio_id)
  REFERENCES public.lineas_plan (id, plan_estudio_id)
  ON DELETE SET NULL (linea_plan_id);
