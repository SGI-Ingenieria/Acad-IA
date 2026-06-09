-- Remove CHAT value from tipo_interaccion_ia enum.
-- PostgreSQL requires recreating the type since DROP VALUE is not supported.

-- Migrate any existing CHAT rows to OTRA before changing the type
UPDATE public.interacciones_ia SET tipo = 'OTRA' WHERE tipo = 'MEJORAR_SECCION';

-- Swap enum: rename old, create new without CHAT, migrate column, drop old
ALTER TYPE public.tipo_interaccion_ia RENAME TO tipo_interaccion_ia_old;

CREATE TYPE public.tipo_interaccion_ia AS ENUM (
    'GENERAR',
    'MEJORAR_SECCION',
    'OTRA'
);

ALTER TABLE public.interacciones_ia
    ALTER COLUMN tipo TYPE public.tipo_interaccion_ia
    USING tipo::text::public.tipo_interaccion_ia;

DROP TYPE public.tipo_interaccion_ia_old;
