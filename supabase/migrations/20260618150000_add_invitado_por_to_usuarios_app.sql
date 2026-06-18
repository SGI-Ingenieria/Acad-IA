-- Auditoría de invitaciones: registra qué usuario (interno) creó/invitó a cada
-- cuenta. Permite mostrar en el panel de un jefe de carrera los expertos
-- externos que invitó. Se llena al alta de usuarios; NULL para registros
-- previos o altas públicas (registro con contraseña maestra).
ALTER TABLE public.usuarios_app
  ADD COLUMN IF NOT EXISTS invitado_por uuid
    REFERENCES public.usuarios_app(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS usuarios_app_invitado_por_idx
  ON public.usuarios_app (invitado_por);

COMMENT ON COLUMN public.usuarios_app.invitado_por IS
  'Usuario interno que creó/invitó esta cuenta. Se llena al alta (sobre todo de externos); NULL para registros previos o altas públicas.';
