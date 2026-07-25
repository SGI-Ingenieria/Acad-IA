-- Auditoría del modo agente de IA.
--
-- El modo agente aplica muchos cambios pequeños seguidos con las mismas dos o
-- tres palabras de contexto ("mejorar gramática", "más al principio"). En el
-- historial eso no debe leerse como veinte filas sueltas, sino como un bloque
-- "Cambios hechos por el agente de IA · «<contexto>»". Para poder agruparlas
-- hace falta que cada fila de auditoría recuerde a qué sesión de agente
-- pertenece y con qué contexto se pidió.
--
-- Cómo llega esa información a la base de datos
-- ---------------------------------------------
-- Por cabeceras HTTP, igual que ya se hace con `x-admin-override-reason`: el
-- frontend adjunta `x-agente-sesion-id`, `x-agente-contexto-b64` y
-- `x-agente-interaccion-id` (ver `src/data/supabase/agenteHeaders.ts`) y
-- PostgREST las expone en el GUC `request.headers`. Los helpers de abajo son un
-- calco de `public.authz_admin_override_reason()`. El contexto va en base64
-- porque PostgREST rechaza toda la petición si una cabecera no es UTF-8 válido
-- —y el contexto es español con tildes—; ver el comentario de
-- `public.agente_ia_contexto()`.
--
-- Por qué DEFAULT y no reescribir los triggers
-- --------------------------------------------
-- `cambios_plan` y `cambios_asignatura` las escriben CUATRO trigger functions
-- distintas (`fn_log_cambios_planes_estudio`, `fn_log_lineas_plan_cambios`,
-- `fn_track_cambios_asignatura`, `fn_log_bibliografia_asignatura_cambios`), con
-- dieciocho INSERT en total. Añadir dos columnas a cada INSERT obligaría a
-- copiar ~400 líneas de cuerpo intacto para cambiar una lista de columnas, con
-- el riesgo de que cualquier corrección futura en esos triggers vuelva a
-- perder las columnas nuevas.
--
-- Un DEFAULT sobre la columna resuelve lo mismo sin tocar ningún trigger: se
-- evalúa en cada INSERT que no mencione la columna, o sea en los dieciocho, y
-- también en cualquier escritor que se añada después. Las columnas se crean sin
-- DEFAULT y se les asigna después con SET DEFAULT para que las filas ya
-- existentes queden en NULL y no haya reescritura de tabla.

-- ---------------------------------------------------------------------------
-- 1. Helpers de lectura de cabeceras
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.agente_ia_encabezado(p_nombre text)
  RETURNS text
  LANGUAGE plpgsql
  STABLE
  SET search_path TO 'public', 'private', 'auth', 'extensions', 'pg_temp'
AS $$
DECLARE
  v_headers jsonb;
  v_valor text;
BEGIN
  -- `request.headers` no existe fuera de una petición de PostgREST (psql,
  -- cron, triggers internos); el bloque de excepción evita que la auditoría
  -- falle en esos contextos.
  BEGIN
    v_headers := NULLIF(current_setting('request.headers', true), '')::jsonb;
  EXCEPTION WHEN others THEN
    v_headers := '{}'::jsonb;
  END;

  -- PostgREST normaliza a minúsculas, pero se aceptan las tres formas por la
  -- misma razón que en authz_admin_override_reason(): proxies y clientes que
  -- reescriben cabeceras.
  v_valor := COALESCE(
    v_headers ->> lower(p_nombre),
    v_headers ->> p_nombre,
    v_headers ->> replace(lower(p_nombre), '-', '_')
  );

  RETURN NULLIF(btrim(COALESCE(v_valor, '')), '');
END;
$$;

ALTER FUNCTION public.agente_ia_encabezado(text) OWNER TO postgres;

REVOKE ALL ON FUNCTION public.agente_ia_encabezado(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.agente_ia_encabezado(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.agente_ia_encabezado(text) TO service_role;

COMMENT ON FUNCTION public.agente_ia_encabezado(text) IS
  'Lee una cabecera de la petición actual desde request.headers. Devuelve NULL fuera de una petición PostgREST. Calcado de authz_admin_override_reason().';


CREATE OR REPLACE FUNCTION public.agente_ia_sesion_id()
  RETURNS uuid
  LANGUAGE plpgsql
  STABLE
  SET search_path TO 'public', 'private', 'auth', 'extensions', 'pg_temp'
AS $$
DECLARE
  v_valor text := public.agente_ia_encabezado('x-agente-sesion-id');
BEGIN
  -- Un uuid mal formado en una cabecera no debe tumbar la escritura que se
  -- está auditando: se descarta y la fila queda sin agrupar.
  BEGIN
    RETURN v_valor::uuid;
  EXCEPTION WHEN others THEN
    RETURN NULL;
  END;
END;
$$;

ALTER FUNCTION public.agente_ia_sesion_id() OWNER TO postgres;

REVOKE ALL ON FUNCTION public.agente_ia_sesion_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.agente_ia_sesion_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.agente_ia_sesion_id() TO service_role;

COMMENT ON FUNCTION public.agente_ia_sesion_id() IS
  'Identificador de la sesión de modo agente activa (cabecera x-agente-sesion-id). Agrupa en el historial todos los cambios de una misma sesión.';


-- El contexto viaja en base64 (`x-agente-contexto-b64`) y no en claro. Razón:
-- el contexto es español y casi siempre lleva tildes; el navegador manda un
-- valor de cabecera no-ASCII como bytes crudos Latin-1 y PostgREST decodifica
-- las cabeceras como UTF-8 al construir `request.headers`, así que un simple
-- «ó» (0xF3) abortaba la petición entera con «Cannot decode byte '\xf3'» y
-- tumbaba TODAS las escrituras del modo agente, no sólo su auditoría.
-- Se sigue aceptando la cabecera en claro por si algún cliente sólo puede
-- mandar ASCII sin codificar.
CREATE OR REPLACE FUNCTION public.agente_ia_contexto()
  RETURNS text
  LANGUAGE plpgsql
  STABLE
  SET search_path TO 'public', 'private', 'auth', 'extensions', 'pg_temp'
AS $$
DECLARE
  v_b64 text := public.agente_ia_encabezado('x-agente-contexto-b64');
  v_valor text;
BEGIN
  IF v_b64 IS NOT NULL THEN
    -- Una cabecera corrupta no debe tumbar la escritura que se está auditando.
    BEGIN
      v_valor := convert_from(decode(v_b64, 'base64'), 'utf8');
    EXCEPTION WHEN others THEN
      v_valor := NULL;
    END;
  END IF;

  RETURN left(
    COALESCE(
      NULLIF(btrim(COALESCE(v_valor, '')), ''),
      public.agente_ia_encabezado('x-agente-contexto')
    ),
    200
  );
END;
$$;

ALTER FUNCTION public.agente_ia_contexto() OWNER TO postgres;

REVOKE ALL ON FUNCTION public.agente_ia_contexto() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.agente_ia_contexto() TO authenticated;
GRANT EXECUTE ON FUNCTION public.agente_ia_contexto() TO service_role;

COMMENT ON FUNCTION public.agente_ia_contexto() IS
  'Palabras de contexto del modo agente (cabecera x-agente-contexto), recortadas a 200 caracteres. Se esperan 2-5 palabras; el recorte es defensa contra una cabecera abusiva.';


CREATE OR REPLACE FUNCTION public.agente_ia_interaccion_id()
  RETURNS uuid
  LANGUAGE plpgsql
  STABLE
  SET search_path TO 'public', 'private', 'auth', 'extensions', 'pg_temp'
AS $$
DECLARE
  v_valor text := public.agente_ia_encabezado('x-agente-interaccion-id');
BEGIN
  BEGIN
    RETURN v_valor::uuid;
  EXCEPTION WHEN others THEN
    RETURN NULL;
  END;
END;
$$;

ALTER FUNCTION public.agente_ia_interaccion_id() OWNER TO postgres;

REVOKE ALL ON FUNCTION public.agente_ia_interaccion_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.agente_ia_interaccion_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.agente_ia_interaccion_id() TO service_role;

COMMENT ON FUNCTION public.agente_ia_interaccion_id() IS
  'Interacción de IA (interacciones_ia.id) que originó la escritura en curso, según la cabecera x-agente-interaccion-id devuelta por ai-agente-accion.';

-- ---------------------------------------------------------------------------
-- 2. Columnas nuevas
-- ---------------------------------------------------------------------------

ALTER TABLE public.cambios_plan
  ADD COLUMN IF NOT EXISTS agente_sesion_id uuid,
  ADD COLUMN IF NOT EXISTS agente_contexto text,
  ADD COLUMN IF NOT EXISTS fuente public.fuente_cambio,
  ADD COLUMN IF NOT EXISTS interaccion_ia_id uuid;

ALTER TABLE public.cambios_asignatura
  ADD COLUMN IF NOT EXISTS agente_sesion_id uuid,
  ADD COLUMN IF NOT EXISTS agente_contexto text;

-- Los DEFAULT se asignan aparte para no reescribir la tabla ni rellenar el
-- histórico con el valor evaluado en el momento de la migración.
ALTER TABLE public.cambios_plan
  ALTER COLUMN agente_sesion_id SET DEFAULT public.agente_ia_sesion_id(),
  ALTER COLUMN agente_contexto SET DEFAULT public.agente_ia_contexto(),
  ALTER COLUMN interaccion_ia_id SET DEFAULT public.agente_ia_interaccion_id();

ALTER TABLE public.cambios_asignatura
  ALTER COLUMN agente_sesion_id SET DEFAULT public.agente_ia_sesion_id(),
  ALTER COLUMN agente_contexto SET DEFAULT public.agente_ia_contexto();

COMMENT ON COLUMN public.cambios_plan.agente_sesion_id IS
  'Sesión del modo agente de IA que produjo el cambio; NULL si se hizo fuera del modo agente. Se rellena por DEFAULT desde la cabecera x-agente-sesion-id.';
COMMENT ON COLUMN public.cambios_plan.agente_contexto IS
  'Palabras de contexto con las que el usuario pidió el cambio en modo agente.';
COMMENT ON COLUMN public.cambios_plan.fuente IS
  'HUMANO o IA, con la misma semántica que cambios_asignatura.fuente. Lo rellena el trigger trg_cambios_plan_fuente. NULL en las filas anteriores a esta migración.';
COMMENT ON COLUMN public.cambios_plan.interaccion_ia_id IS
  'Interacción de IA que originó el cambio, cuando la hubo. Se rellena por DEFAULT desde la cabecera x-agente-interaccion-id.';

COMMENT ON COLUMN public.cambios_asignatura.agente_sesion_id IS
  'Sesión del modo agente de IA que produjo el cambio; NULL si se hizo fuera del modo agente. Se rellena por DEFAULT desde la cabecera x-agente-sesion-id.';
COMMENT ON COLUMN public.cambios_asignatura.agente_contexto IS
  'Palabras de contexto con las que el usuario pidió el cambio en modo agente.';

-- ---------------------------------------------------------------------------
-- 3. fuente en cambios_plan
-- ---------------------------------------------------------------------------
-- `fuente` no puede ser un DEFAULT como las demás porque depende de columnas de
-- la propia fila (`response_id`, `interaccion_ia_id`), y una columna generada
-- no serviría: `agente_sesion_id` viene de una cabecera, no de la fila. Un
-- BEFORE INSERT sobre la tabla de auditoría cubre a los cuatro triggers
-- escritores con quince líneas, en vez de reescribirlos.
--
-- La regla replica la de fn_track_cambios_asignatura (línea 6907 de la
-- migración 20260721203000): hay interacción de IA -> 'IA', si no -> 'HUMANO'.

CREATE OR REPLACE FUNCTION public.fn_cambios_plan_fuente()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path TO 'public', 'private', 'auth', 'extensions', 'pg_temp'
AS $$
BEGIN
  IF new.fuente IS NULL THEN
    new.fuente := CASE
      WHEN new.interaccion_ia_id IS NOT NULL
        OR new.agente_sesion_id IS NOT NULL
        OR new.response_id IS NOT NULL
      THEN 'IA'::public.fuente_cambio
      ELSE 'HUMANO'::public.fuente_cambio
    END;
  END IF;

  RETURN new;
END;
$$;

ALTER FUNCTION public.fn_cambios_plan_fuente() OWNER TO postgres;

REVOKE ALL ON FUNCTION public.fn_cambios_plan_fuente() FROM PUBLIC, anon, authenticated;
GRANT ALL ON FUNCTION public.fn_cambios_plan_fuente() TO service_role;

COMMENT ON FUNCTION public.fn_cambios_plan_fuente() IS
  'Deriva cambios_plan.fuente de la procedencia de la fila (interacción de IA, sesión de agente o response_id). Evita duplicar la lógica en las cuatro trigger functions que escriben la auditoría.';

DROP TRIGGER IF EXISTS trg_cambios_plan_fuente ON public.cambios_plan;
CREATE TRIGGER trg_cambios_plan_fuente
  BEFORE INSERT ON public.cambios_plan
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_cambios_plan_fuente();

-- ---------------------------------------------------------------------------
-- 4. Índices para el agrupado del historial
-- ---------------------------------------------------------------------------
-- Parciales: la inmensa mayoría de las filas se escriben fuera del modo agente
-- y no tiene sentido indexarlas. El orden por `cambiado_en` es el que usa la
-- vista de historial dentro de cada grupo.

CREATE INDEX IF NOT EXISTS idx_cambios_plan_agente_sesion
  ON public.cambios_plan (agente_sesion_id, cambiado_en DESC)
  WHERE agente_sesion_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_cambios_asignatura_agente_sesion
  ON public.cambios_asignatura (agente_sesion_id, cambiado_en DESC)
  WHERE agente_sesion_id IS NOT NULL;
