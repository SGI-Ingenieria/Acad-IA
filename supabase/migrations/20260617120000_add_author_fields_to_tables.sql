-- Add creado_por / actualizado_por / asignado_por to tables that previously had no author tracking.
-- All columns are nullable: existing rows have no author, and background AI processes run without user context.

ALTER TABLE public.lineas_plan
  ADD COLUMN IF NOT EXISTS creado_por     UUID REFERENCES public.usuarios_app(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS actualizado_por UUID REFERENCES public.usuarios_app(id) ON DELETE SET NULL;

ALTER TABLE public.estructuras_plan
  ADD COLUMN IF NOT EXISTS creado_por     UUID REFERENCES public.usuarios_app(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS actualizado_por UUID REFERENCES public.usuarios_app(id) ON DELETE SET NULL;

ALTER TABLE public.estructuras_asignatura
  ADD COLUMN IF NOT EXISTS creado_por     UUID REFERENCES public.usuarios_app(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS actualizado_por UUID REFERENCES public.usuarios_app(id) ON DELETE SET NULL;

ALTER TABLE public.carreras
  ADD COLUMN IF NOT EXISTS creado_por     UUID REFERENCES public.usuarios_app(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS actualizado_por UUID REFERENCES public.usuarios_app(id) ON DELETE SET NULL;

ALTER TABLE public.facultades
  ADD COLUMN IF NOT EXISTS creado_por     UUID REFERENCES public.usuarios_app(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS actualizado_por UUID REFERENCES public.usuarios_app(id) ON DELETE SET NULL;

-- Semantic name: who assigned the responsibility
ALTER TABLE public.responsables_asignatura
  ADD COLUMN IF NOT EXISTS asignado_por UUID REFERENCES public.usuarios_app(id) ON DELETE SET NULL;

ALTER TABLE public.tareas_revision
  ADD COLUMN IF NOT EXISTS creado_por UUID REFERENCES public.usuarios_app(id) ON DELETE SET NULL;

-- Semantic name: who assigned the role
ALTER TABLE public.usuarios_roles
  ADD COLUMN IF NOT EXISTS asignado_por UUID REFERENCES public.usuarios_app(id) ON DELETE SET NULL;

ALTER TABLE public.archivos
  ADD COLUMN IF NOT EXISTS creado_por UUID REFERENCES public.usuarios_app(id) ON DELETE SET NULL;
