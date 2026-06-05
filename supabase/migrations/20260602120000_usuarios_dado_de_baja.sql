ALTER TABLE public.usuarios_app
ADD COLUMN IF NOT EXISTS dado_de_baja_en timestamptz;
