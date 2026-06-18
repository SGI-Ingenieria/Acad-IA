-- Add clave (institutional key, e.g. "ad123456") to usuarios_app
ALTER TABLE public.usuarios_app
  ADD COLUMN IF NOT EXISTS clave TEXT,
  ADD CONSTRAINT usuarios_app_clave_unique UNIQUE (clave),
  ADD CONSTRAINT usuarios_app_clave_format
    CHECK (clave IS NULL OR clave ~ '^(ad|do)\d{6}$');

-- Drop email — auth.users.email is the canonical source
ALTER TABLE public.usuarios_app DROP CONSTRAINT IF EXISTS usuarios_app_email_unico;
ALTER TABLE public.usuarios_app DROP COLUMN IF EXISTS email;

-- Replace writable externo with a generated column: NULL clave = external user
ALTER TABLE public.usuarios_app DROP COLUMN IF EXISTS externo;
ALTER TABLE public.usuarios_app
  ADD COLUMN externo BOOLEAN GENERATED ALWAYS AS (clave IS NULL) STORED;
