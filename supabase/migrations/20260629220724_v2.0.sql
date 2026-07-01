


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE EXTENSION IF NOT EXISTS "pg_cron" WITH SCHEMA "pg_catalog";






CREATE EXTENSION IF NOT EXISTS "pg_net" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgsodium";






CREATE SCHEMA IF NOT EXISTS "private";


ALTER SCHEMA "private" OWNER TO "postgres";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "http" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_jsonschema" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "unaccent" WITH SCHEMA "public";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."estado_asignatura" AS ENUM (
    'borrador',
    'revisada',
    'aprobada',
    'generando',
    'fallida',
    'archivada'
);


ALTER TYPE "public"."estado_asignatura" OWNER TO "postgres";


CREATE TYPE "public"."estado_conversacion" AS ENUM (
    'ACTIVA',
    'ARCHIVANDO',
    'ARCHIVADA',
    'ERROR'
);


ALTER TYPE "public"."estado_conversacion" OWNER TO "postgres";


CREATE TYPE "public"."estado_mensaje_ia" AS ENUM (
    'PROCESANDO',
    'COMPLETADO',
    'ERROR',
    'CANCELADO'
);


ALTER TYPE "public"."estado_mensaje_ia" OWNER TO "postgres";


CREATE TYPE "public"."estado_tarea_revision" AS ENUM (
    'PENDIENTE',
    'COMPLETADA',
    'OMITIDA'
);


ALTER TYPE "public"."estado_tarea_revision" OWNER TO "postgres";


CREATE TYPE "public"."fuente_cambio" AS ENUM (
    'HUMANO',
    'IA'
);


ALTER TYPE "public"."fuente_cambio" OWNER TO "postgres";


CREATE TYPE "public"."nivel_plan_estudio" AS ENUM (
    'Licenciatura',
    'Maestría',
    'Doctorado',
    'Especialidad',
    'Diplomado',
    'Otro'
);


ALTER TYPE "public"."nivel_plan_estudio" OWNER TO "postgres";


CREATE TYPE "public"."puesto_tipo" AS ENUM (
    'vicerrector',
    'director_facultad',
    'secretario_academico',
    'jefe_carrera',
    'profesor',
    'lci'
);


ALTER TYPE "public"."puesto_tipo" OWNER TO "postgres";


CREATE TYPE "public"."rol_responsable_asignatura" AS ENUM (
    'PROFESOR_RESPONSABLE',
    'COAUTOR',
    'REVISOR'
);


ALTER TYPE "public"."rol_responsable_asignatura" OWNER TO "postgres";


CREATE TYPE "public"."tipo_asignatura" AS ENUM (
    'OBLIGATORIA',
    'OPTATIVA',
    'TRONCAL',
    'OTRA'
);


ALTER TYPE "public"."tipo_asignatura" OWNER TO "postgres";


CREATE TYPE "public"."tipo_bibliografia" AS ENUM (
    'BASICA',
    'COMPLEMENTARIA'
);


ALTER TYPE "public"."tipo_bibliografia" OWNER TO "postgres";


CREATE TYPE "public"."tipo_cambio" AS ENUM (
    'ACTUALIZACION_CAMPO',
    'ACTUALIZACION_MAPA',
    'TRANSICION_ESTADO',
    'OTRO',
    'CREACION',
    'ACTUALIZACION'
);


ALTER TYPE "public"."tipo_cambio" OWNER TO "postgres";


CREATE TYPE "public"."tipo_ciclo" AS ENUM (
    'Semestre',
    'Cuatrimestre',
    'Trimestre',
    'Otro'
);


ALTER TYPE "public"."tipo_ciclo" OWNER TO "postgres";


CREATE TYPE "public"."tipo_estructura_plan" AS ENUM (
    'CURRICULAR',
    'NO_CURRICULAR'
);


ALTER TYPE "public"."tipo_estructura_plan" OWNER TO "postgres";


CREATE TYPE "public"."tipo_fuente_bibliografia" AS ENUM (
    'MANUAL',
    'BIBLIOTECA'
);


ALTER TYPE "public"."tipo_fuente_bibliografia" OWNER TO "postgres";


CREATE TYPE "public"."tipo_interaccion_ia" AS ENUM (
    'GENERAR',
    'MEJORAR_SECCION',
    'OTRA'
);


ALTER TYPE "public"."tipo_interaccion_ia" OWNER TO "postgres";


CREATE TYPE "public"."tipo_notificacion" AS ENUM (
    'PLAN_ASIGNADO',
    'ESTADO_CAMBIADO',
    'TAREA_ASIGNADA',
    'COMENTARIO',
    'OTRA'
);


ALTER TYPE "public"."tipo_notificacion" OWNER TO "postgres";


CREATE TYPE "public"."tipo_origen" AS ENUM (
    'MANUAL',
    'IA',
    'CLONADO_INTERNO',
    'CLONADO_TRADICIONAL',
    'OTRO'
);


ALTER TYPE "public"."tipo_origen" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."authz_user_has_global_scope"("p_usuario_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT p_usuario_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.usuarios_roles ur
      JOIN public.roles r ON r.id = ur.rol_id
      JOIN public.usuarios_app ua ON ua.id = ur.usuario_id
      WHERE ur.usuario_id = p_usuario_id
        AND ua.dado_de_baja_en IS NULL
        AND (
          r.clave = 'ADMIN'
          OR (
            r.alcance_default = 'global'
            AND ur.facultad_id IS NULL
            AND ur.carrera_id IS NULL
          )
        )
    );
$$;


ALTER FUNCTION "private"."authz_user_has_global_scope"("p_usuario_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."authz_user_has_permission"("p_usuario_id" "uuid", "p_permiso" "text") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT p_usuario_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.usuarios_roles ur
      JOIN public.roles r ON r.id = ur.rol_id
      JOIN public.usuarios_app ua ON ua.id = ur.usuario_id
      LEFT JOIN public.roles_permisos rp ON rp.rol_id = ur.rol_id
      LEFT JOIN public.permisos p ON p.id = rp.permiso_id
      WHERE ur.usuario_id = p_usuario_id
        AND ua.dado_de_baja_en IS NULL
        AND (
          r.clave = 'ADMIN'
          OR p.clave = p_permiso
        )
    );
$$;


ALTER FUNCTION "private"."authz_user_has_permission"("p_usuario_id" "uuid", "p_permiso" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."authz_user_has_role"("p_usuario_id" "uuid", "p_rol" "text") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT p_usuario_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.usuarios_roles ur
      JOIN public.roles r ON r.id = ur.rol_id
      JOIN public.usuarios_app ua ON ua.id = ur.usuario_id
      WHERE ur.usuario_id = p_usuario_id
        AND ua.dado_de_baja_en IS NULL
        AND r.clave = p_rol
    );
$$;


ALTER FUNCTION "private"."authz_user_has_role"("p_usuario_id" "uuid", "p_rol" "text") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."estructuras_asignatura" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "nombre" "text" NOT NULL,
    "definicion" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "creado_en" timestamp with time zone DEFAULT "now"() NOT NULL,
    "actualizado_en" timestamp with time zone DEFAULT "now"() NOT NULL,
    "template_id" "text",
    "tipo" "public"."tipo_estructura_plan",
    "creado_por" "uuid",
    "actualizado_por" "uuid",
    "estructura_plan_id" "uuid" NOT NULL
);


ALTER TABLE "public"."estructuras_asignatura" OWNER TO "postgres";


COMMENT ON COLUMN "public"."estructuras_asignatura"."estructura_plan_id" IS 'Estructura de plan duena de esta estructura de asignatura.';



CREATE OR REPLACE FUNCTION "public"."actualizar_estructura_asignatura_definicion"("p_id" "uuid", "p_definicion" "jsonb", "p_operaciones" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "public"."estructuras_asignatura"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_user uuid := auth.uid();
  v_row public.estructuras_asignatura;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Usuario no autenticado' USING ERRCODE = '28000';
  END IF;

  IF NOT public.authz_has_permission('catalogos.gestionar') THEN
    RAISE EXCEPTION 'No tienes permiso para gestionar estructuras'
      USING ERRCODE = '42501';
  END IF;

  UPDATE public.estructuras_asignatura
  SET
    definicion = COALESCE(p_definicion, '{}'::jsonb),
    actualizado_por = v_user
  WHERE id = p_id
  RETURNING * INTO v_row;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Estructura de asignatura no encontrada'
      USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.asignaturas AS a
  SET
    datos = public.normalizar_datos_por_definicion(
      public.aplicar_operaciones_estructura_datos(a.datos, p_operaciones),
      COALESCE(p_definicion, '{}'::jsonb),
      true
    ),
    actualizado_por = v_user
  WHERE a.estructura_id = p_id
    AND public.normalizar_datos_por_definicion(
      public.aplicar_operaciones_estructura_datos(a.datos, p_operaciones),
      COALESCE(p_definicion, '{}'::jsonb),
      true
    ) IS DISTINCT FROM a.datos;

  RETURN v_row;
END;
$$;


ALTER FUNCTION "public"."actualizar_estructura_asignatura_definicion"("p_id" "uuid", "p_definicion" "jsonb", "p_operaciones" "jsonb") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."actualizar_estructura_asignatura_definicion"("p_id" "uuid", "p_definicion" "jsonb", "p_operaciones" "jsonb") IS 'Actualiza una estructura de asignatura y propaga renombres, eliminaciones y cambios de tipo a asignaturas dependientes.';



CREATE TABLE IF NOT EXISTS "public"."estructuras_plan" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "nombre" "text" NOT NULL,
    "tipo" "public"."tipo_estructura_plan" NOT NULL,
    "template_id" "text",
    "definicion" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "creado_en" timestamp with time zone DEFAULT "now"() NOT NULL,
    "actualizado_en" timestamp with time zone DEFAULT "now"() NOT NULL,
    "creado_por" "uuid",
    "actualizado_por" "uuid",
    "excel_template_id" "text"
);


ALTER TABLE "public"."estructuras_plan" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."actualizar_estructura_plan_definicion"("p_id" "uuid", "p_definicion" "jsonb", "p_operaciones" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "public"."estructuras_plan"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_user uuid := auth.uid();
  v_row public.estructuras_plan;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Usuario no autenticado' USING ERRCODE = '28000';
  END IF;

  IF NOT public.authz_has_permission('catalogos.gestionar') THEN
    RAISE EXCEPTION 'No tienes permiso para gestionar estructuras'
      USING ERRCODE = '42501';
  END IF;

  UPDATE public.estructuras_plan
  SET
    definicion = COALESCE(p_definicion, '{}'::jsonb),
    actualizado_por = v_user
  WHERE id = p_id
  RETURNING * INTO v_row;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Estructura de plan no encontrada' USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.planes_estudio AS p
  SET
    datos = public.normalizar_datos_por_definicion(
      public.aplicar_operaciones_estructura_datos(p.datos, p_operaciones),
      COALESCE(p_definicion, '{}'::jsonb),
      true
    ),
    actualizado_por = v_user
  WHERE p.estructura_id = p_id
    AND public.normalizar_datos_por_definicion(
      public.aplicar_operaciones_estructura_datos(p.datos, p_operaciones),
      COALESCE(p_definicion, '{}'::jsonb),
      true
    ) IS DISTINCT FROM p.datos;

  RETURN v_row;
END;
$$;


ALTER FUNCTION "public"."actualizar_estructura_plan_definicion"("p_id" "uuid", "p_definicion" "jsonb", "p_operaciones" "jsonb") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."actualizar_estructura_plan_definicion"("p_id" "uuid", "p_definicion" "jsonb", "p_operaciones" "jsonb") IS 'Actualiza una estructura de plan y propaga renombres, eliminaciones y cambios de tipo a planes dependientes.';



CREATE OR REPLACE FUNCTION "public"."aplicar_operaciones_estructura_datos"("p_datos" "jsonb", "p_operaciones" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" IMMUTABLE
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_next jsonb := COALESCE(p_datos, '{}'::jsonb);
  v_operaciones jsonb := COALESCE(p_operaciones, '{}'::jsonb);
  v_item jsonb;
  v_from text;
  v_to text;
  v_key text;
BEGIN
  IF jsonb_typeof(v_next) IS DISTINCT FROM 'object' THEN
    v_next := '{}'::jsonb;
  END IF;

  FOR v_item IN
    SELECT value
    FROM jsonb_array_elements(
      CASE
        WHEN jsonb_typeof(v_operaciones->'renames') = 'array'
          THEN v_operaciones->'renames'
        ELSE '[]'::jsonb
      END
    )
  LOOP
    v_from := NULLIF(v_item->>'from', '');
    v_to := NULLIF(v_item->>'to', '');

    IF v_from IS NOT NULL
      AND v_to IS NOT NULL
      AND v_from <> v_to
      AND v_next ? v_from
    THEN
      v_next := (v_next - v_from) || jsonb_build_object(v_to, v_next->v_from);
    END IF;
  END LOOP;

  FOR v_key IN
    SELECT value
    FROM jsonb_array_elements_text(
      CASE
        WHEN jsonb_typeof(v_operaciones->'removed') = 'array'
          THEN v_operaciones->'removed'
        ELSE '[]'::jsonb
      END
    )
  LOOP
    IF NULLIF(v_key, '') IS NOT NULL THEN
      v_next := v_next - v_key;
    END IF;
  END LOOP;

  FOR v_key IN
    SELECT value
    FROM jsonb_array_elements_text(
      CASE
        WHEN jsonb_typeof(v_operaciones->'typeChanged') = 'array'
          THEN v_operaciones->'typeChanged'
        ELSE '[]'::jsonb
      END
    )
  LOOP
    IF NULLIF(v_key, '') IS NOT NULL AND v_next ? v_key THEN
      v_next := jsonb_set(v_next, ARRAY[v_key], 'null'::jsonb, true);
    END IF;
  END LOOP;

  RETURN v_next;
END;
$$;


ALTER FUNCTION "public"."aplicar_operaciones_estructura_datos"("p_datos" "jsonb", "p_operaciones" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."append_conversacion_asignatura"("p_id" "uuid", "p_append" "jsonb") RETURNS "void"
    LANGUAGE "sql"
    AS $$
  update conversaciones_asignatura
  set conversacion_json = coalesce(conversacion_json, '[]'::jsonb) || p_append
  where id = p_id;
$$;


ALTER FUNCTION "public"."append_conversacion_asignatura"("p_id" "uuid", "p_append" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."append_conversacion_plan"("p_id" "uuid", "p_append" "jsonb") RETURNS "void"
    LANGUAGE "sql"
    AS $$
  update conversaciones_plan
  set conversacion_json = coalesce(conversacion_json, '[]'::jsonb) || p_append
  where id = p_id;
$$;


ALTER FUNCTION "public"."append_conversacion_plan"("p_id" "uuid", "p_append" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."authz_admin_override_audit"("p_plan_id" "uuid") RETURNS TABLE("admin_override" boolean, "motivo" "text", "estado_clave" "text")
    LANGUAGE "sql" STABLE
    AS $$
  SELECT
    (public.authz_is_admin()
      AND public.authz_admin_override_reason() IS NOT NULL
      AND public.plan_estado_clave(p_plan_id) NOT IN ('BORRADOR', 'REVISION')) AS admin_override,
    public.authz_admin_override_reason() AS motivo,
    public.plan_estado_clave(p_plan_id) AS estado_clave;
$$;


ALTER FUNCTION "public"."authz_admin_override_audit"("p_plan_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."authz_admin_override_reason"() RETURNS "text"
    LANGUAGE "plpgsql" STABLE
    AS $$
DECLARE
  v_headers jsonb;
  v_reason text;
BEGIN
  BEGIN
    v_headers := NULLIF(current_setting('request.headers', true), '')::jsonb;
  EXCEPTION WHEN others THEN
    v_headers := '{}'::jsonb;
  END;

  v_reason := COALESCE(
    v_headers ->> 'x-admin-override-reason',
    v_headers ->> 'X-Admin-Override-Reason',
    v_headers ->> 'x_admin_override_reason'
  );

  RETURN NULLIF(btrim(COALESCE(v_reason, '')), '');
END;
$$;


ALTER FUNCTION "public"."authz_admin_override_reason"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."authz_asignatura_ia_allowed"("p_asignatura_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE
    AS $$
  SELECT public.usuario_puede_usar_ia_asignatura(auth.uid(), p_asignatura_id);
$$;


ALTER FUNCTION "public"."authz_asignatura_ia_allowed"("p_asignatura_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."authz_asignatura_restricted_field_write_allowed"("p_asignatura_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.asignaturas a
    WHERE a.id = p_asignatura_id
      AND public.authz_asignatura_write_allowed(p_asignatura_id)
      AND EXISTS (
        SELECT 1
        FROM public.estructuras_asignatura ea
        CROSS JOIN LATERAL jsonb_each(
          CASE
            WHEN jsonb_typeof(ea.definicion->'properties') = 'object'
              THEN ea.definicion->'properties'
            ELSE '{}'::jsonb
          END
        ) prop(key, value)
        WHERE ea.id = a.estructura_id
          AND public.propiedad_tiene_restriccion(prop.value)
          AND public.plan_estado_clave(a.plan_estudio_id) = ANY(
            public.propiedad_restriccion_estados(prop.value)
          )
      )
  );
$$;


ALTER FUNCTION "public"."authz_asignatura_restricted_field_write_allowed"("p_asignatura_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."authz_asignatura_write_allowed"("p_asignatura_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE
    AS $$
  SELECT public.usuario_puede_editar_asignatura(auth.uid(), p_asignatura_id)
    OR (
      public.authz_is_admin()
      AND public.authz_admin_override_reason() IS NOT NULL
      AND public.authz_can_access_asignatura(p_asignatura_id)
    );
$$;


ALTER FUNCTION "public"."authz_asignatura_write_allowed"("p_asignatura_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."authz_campo_asignatura_write_allowed"("p_asignatura_id" "uuid", "p_clave" "text") RETURNS boolean
    LANGUAGE "sql" STABLE
    AS $$
  SELECT public.authz_asignatura_write_allowed(p_asignatura_id)
    OR public.usuario_puede_editar_campo_asignatura(auth.uid(), p_asignatura_id, p_clave);
$$;


ALTER FUNCTION "public"."authz_campo_asignatura_write_allowed"("p_asignatura_id" "uuid", "p_clave" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."authz_campo_plan_write_allowed"("p_plan_id" "uuid", "p_clave" "text") RETURNS boolean
    LANGUAGE "sql" STABLE
    AS $$
  SELECT public.authz_plan_write_allowed(p_plan_id)
    OR public.usuario_puede_editar_campo_plan(auth.uid(), p_plan_id, p_clave);
$$;


ALTER FUNCTION "public"."authz_campo_plan_write_allowed"("p_plan_id" "uuid", "p_clave" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."authz_can_access_asignatura"("p_asignatura_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.asignaturas a
    WHERE a.id = p_asignatura_id
      AND (
        public.authz_can_access_plan(a.plan_estudio_id)
        OR EXISTS (
          SELECT 1
          FROM public.responsables_asignatura ra
          WHERE ra.asignatura_id = p_asignatura_id
            AND ra.usuario_id = auth.uid()
        )
      )
  );
$$;


ALTER FUNCTION "public"."authz_can_access_asignatura"("p_asignatura_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."authz_can_access_carrera"("p_carrera_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE
    AS $$
  SELECT public.authz_has_global_scope()
    OR EXISTS (
      SELECT 1
      FROM jsonb_array_elements_text(
        COALESCE(auth.jwt() #> '{app_metadata,alcances,carreras}', '[]'::jsonb)
      ) AS alcance(value)
      WHERE alcance.value = p_carrera_id::text
    )
    OR EXISTS (
      SELECT 1
      FROM public.carreras c
      WHERE c.id = p_carrera_id
        AND public.authz_can_access_facultad(c.facultad_id)
    );
$$;


ALTER FUNCTION "public"."authz_can_access_carrera"("p_carrera_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."authz_can_access_facultad"("p_facultad_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE
    AS $$
  SELECT public.authz_has_global_scope()
    OR EXISTS (
      SELECT 1
      FROM jsonb_array_elements_text(
        COALESCE(auth.jwt() #> '{app_metadata,alcances,facultades}', '[]'::jsonb)
      ) AS alcance(value)
      WHERE alcance.value = p_facultad_id::text
    );
$$;


ALTER FUNCTION "public"."authz_can_access_facultad"("p_facultad_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."authz_can_access_plan"("p_plan_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE
    AS $$
  SELECT public.usuario_puede_acceder_plan(auth.uid(), p_plan_id);
$$;


ALTER FUNCTION "public"."authz_can_access_plan"("p_plan_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."authz_has_bootstrap_access"() RETURNS boolean
    LANGUAGE "sql" STABLE
    AS $$
  SELECT COALESCE((auth.jwt() -> 'app_metadata' ->> 'authz_bootstrap')::boolean, false);
$$;


ALTER FUNCTION "public"."authz_has_bootstrap_access"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."authz_has_global_scope"() RETURNS boolean
    LANGUAGE "sql" STABLE
    AS $$
  SELECT private.authz_user_has_global_scope(auth.uid())
    OR EXISTS (
      SELECT 1
      FROM jsonb_array_elements(COALESCE(auth.jwt() #> '{app_metadata,roles}', '[]'::jsonb)) AS rol(value)
      WHERE rol.value ->> 'facultad_id' IS NULL
        AND rol.value ->> 'carrera_id' IS NULL
        AND rol.value ->> 'alcance_default' = 'global'
    );
$$;


ALTER FUNCTION "public"."authz_has_global_scope"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."authz_has_permission"("p_permiso" "text") RETURNS boolean
    LANGUAGE "sql" STABLE
    AS $$
  SELECT public.authz_is_admin()
    OR COALESCE((auth.jwt() -> 'app_metadata' -> 'permisos') ? p_permiso, false)
    OR private.authz_user_has_permission(auth.uid(), p_permiso);
$$;


ALTER FUNCTION "public"."authz_has_permission"("p_permiso" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."authz_has_role"("p_rol" "text") RETURNS boolean
    LANGUAGE "sql" STABLE
    AS $$
  SELECT COALESCE((auth.jwt() -> 'app_metadata' -> 'roles_claves') ? p_rol, false)
    OR private.authz_user_has_role(auth.uid(), p_rol);
$$;


ALTER FUNCTION "public"."authz_has_role"("p_rol" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."authz_is_admin"() RETURNS boolean
    LANGUAGE "sql" STABLE
    AS $$
  SELECT public.authz_has_role('ADMIN');
$$;


ALTER FUNCTION "public"."authz_is_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."authz_is_responsable_asignatura"("p_asignatura_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.responsables_asignatura ra
    WHERE ra.asignatura_id = p_asignatura_id AND ra.usuario_id = auth.uid()
  );
$$;


ALTER FUNCTION "public"."authz_is_responsable_asignatura"("p_asignatura_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."authz_is_responsable_de_plan"("p_plan_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.responsables_asignatura ra
    JOIN public.asignaturas a ON a.id = ra.asignatura_id
    WHERE a.plan_estudio_id = p_plan_id AND ra.usuario_id = auth.uid()
  );
$$;


ALTER FUNCTION "public"."authz_is_responsable_de_plan"("p_plan_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."authz_is_service_role"() RETURNS boolean
    LANGUAGE "plpgsql" STABLE
    AS $$
DECLARE
  v_claims jsonb;
BEGIN
  BEGIN
    v_claims := NULLIF(current_setting('request.jwt.claims', true), '')::jsonb;
  EXCEPTION WHEN others THEN
    v_claims := '{}'::jsonb;
  END;

  RETURN COALESCE(v_claims ->> 'role', '') = 'service_role';
END;
$$;


ALTER FUNCTION "public"."authz_is_service_role"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."authz_plan_ia_allowed"("p_plan_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE
    AS $$
  SELECT public.usuario_puede_editar_plan(auth.uid(), p_plan_id)
    AND public.authz_has_permission('ia.usar')
    AND public.plan_estado_clave(p_plan_id) IN ('BORRADOR', 'REVISION');
$$;


ALTER FUNCTION "public"."authz_plan_ia_allowed"("p_plan_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."authz_plan_restricted_field_write_allowed"("p_plan_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE
    AS $$
  SELECT public.authz_plan_write_allowed(p_plan_id)
    AND EXISTS (
      SELECT 1
      FROM public.planes_estudio pe
      JOIN public.estructuras_plan ep ON ep.id = pe.estructura_id
      CROSS JOIN LATERAL jsonb_each(
        CASE
          WHEN jsonb_typeof(ep.definicion->'properties') = 'object'
            THEN ep.definicion->'properties'
          ELSE '{}'::jsonb
        END
      ) prop(key, value)
      WHERE pe.id = p_plan_id
        AND public.propiedad_tiene_restriccion(prop.value)
        AND public.plan_estado_clave(p_plan_id) = ANY(
          public.propiedad_restriccion_estados(prop.value)
        )
    );
$$;


ALTER FUNCTION "public"."authz_plan_restricted_field_write_allowed"("p_plan_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."authz_plan_write_allowed"("p_plan_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE
    AS $$
  SELECT public.usuario_puede_editar_plan(auth.uid(), p_plan_id)
    OR (
      public.authz_is_admin()
      AND public.authz_admin_override_reason() IS NOT NULL
      AND public.authz_can_access_plan(p_plan_id)
    );
$$;


ALTER FUNCTION "public"."authz_plan_write_allowed"("p_plan_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."borrar_asignaturas_fallidas"() RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  DELETE FROM public.asignaturas
  WHERE creado_en < NOW() - INTERVAL '10 minutes'
    AND estado IN ('fallida', 'generando');
END;
$$;


ALTER FUNCTION "public"."borrar_asignaturas_fallidas"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."borrar_planes_fallidos"() RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  DELETE FROM public.planes_estudio
  WHERE creado_en < NOW() - INTERVAL '10 minutes'
    AND estado_actual_id IN (
      SELECT id FROM public.estados_plan WHERE clave IN ('FALLIDO', 'GENERANDO')
    );
END;
$$;


ALTER FUNCTION "public"."borrar_planes_fallidos"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."build_asignaturas_prefix_tsquery"("p_search" "text") RETURNS "tsquery"
    LANGUAGE "plpgsql" STABLE
    AS $$
declare
  cleaned text;
  tokens text[];
  query_text text;
begin
  cleaned := trim(coalesce(p_search, ''));

  if cleaned = '' then
    return null;
  end if;

  cleaned := lower(public.unaccent(cleaned));
  cleaned := regexp_replace(cleaned, '[^[:alnum:]\s]+', ' ', 'g');
  cleaned := regexp_replace(cleaned, '\s+', ' ', 'g');

  tokens := regexp_split_to_array(cleaned, '\s+');

  select string_agg(token || ':*', ' & ')
  into query_text
  from unnest(tokens) as token
  where token <> '';

  if query_text is null or query_text = '' then
    return null;
  end if;

  return to_tsquery('public.es_simple_unaccent', query_text);
end;
$$;


ALTER FUNCTION "public"."build_asignaturas_prefix_tsquery"("p_search" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."custom_access_token_hook"("event" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  original_claims jsonb;
  new_claims jsonb;
  app_meta jsonb;
  claim text;
  user_id uuid;
  roles_json jsonb := '[]'::jsonb;
  roles_claves_json jsonb := '[]'::jsonb;
  permisos_json jsonb := '[]'::jsonb;
  alcances_json jsonb := '{"global": [], "facultades": [], "carreras": []}'::jsonb;
  is_bootstrap boolean := false;
BEGIN
  original_claims = event->'claims';
  new_claims = '{}'::jsonb;
  app_meta = COALESCE(original_claims->'app_metadata', '{}'::jsonb);

  SELECT NOT EXISTS (SELECT 1 FROM public.usuarios_roles)
  INTO is_bootstrap;

  IF original_claims ? 'sub' THEN
    user_id = (original_claims->>'sub')::uuid;

    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'id', ur.id,
          'rol_id', r.id,
          'clave', r.clave,
          'nombre', r.nombre,
          'nivel_jerarquico', r.nivel_jerarquico,
          'alcance_default', r.alcance_default,
          'facultad_id', ur.facultad_id,
          'carrera_id', ur.carrera_id
        )
        ORDER BY r.nivel_jerarquico, r.clave
      ),
      '[]'::jsonb
    )
    INTO roles_json
    FROM public.usuarios_roles ur
    JOIN public.roles r ON r.id = ur.rol_id
    JOIN public.usuarios_app ua ON ua.id = ur.usuario_id
    WHERE ur.usuario_id = user_id
      AND ua.dado_de_baja_en IS NULL;

    SELECT COALESCE(jsonb_agg(clave ORDER BY clave), '[]'::jsonb)
    INTO roles_claves_json
    FROM (
      SELECT DISTINCT r.clave
      FROM public.usuarios_roles ur
      JOIN public.roles r ON r.id = ur.rol_id
      JOIN public.usuarios_app ua ON ua.id = ur.usuario_id
      WHERE ur.usuario_id = user_id
        AND ua.dado_de_baja_en IS NULL
    ) s;

    SELECT COALESCE(jsonb_agg(clave ORDER BY clave), '[]'::jsonb)
    INTO permisos_json
    FROM (
      SELECT DISTINCT p.clave
      FROM public.usuarios_roles ur
      JOIN public.roles_permisos rp ON rp.rol_id = ur.rol_id
      JOIN public.permisos p ON p.id = rp.permiso_id
      JOIN public.usuarios_app ua ON ua.id = ur.usuario_id
      WHERE ur.usuario_id = user_id
        AND ua.dado_de_baja_en IS NULL
    ) s;

    SELECT jsonb_build_object(
      'global', COALESCE(jsonb_agg(DISTINCT r.clave) FILTER (WHERE ur.facultad_id IS NULL AND ur.carrera_id IS NULL), '[]'::jsonb),
      'facultades', COALESCE(jsonb_agg(DISTINCT ur.facultad_id) FILTER (WHERE ur.facultad_id IS NOT NULL), '[]'::jsonb),
      'carreras', COALESCE(jsonb_agg(DISTINCT ur.carrera_id) FILTER (WHERE ur.carrera_id IS NOT NULL), '[]'::jsonb)
    )
    INTO alcances_json
    FROM public.usuarios_roles ur
    JOIN public.roles r ON r.id = ur.rol_id
    JOIN public.usuarios_app ua ON ua.id = ur.usuario_id
    WHERE ur.usuario_id = user_id
      AND ua.dado_de_baja_en IS NULL;
  END IF;

  app_meta = app_meta || jsonb_build_object(
    'roles', roles_json,
    'roles_claves', roles_claves_json,
    'permisos', permisos_json,
    'alcances', COALESCE(alcances_json, '{"global": [], "facultades": [], "carreras": []}'::jsonb),
    'authz_bootstrap', is_bootstrap
  );

  FOREACH claim IN ARRAY ARRAY[
    'iss',
    'aud',
    'exp',
    'iat',
    'sub',
    'role',
    'aal',
    'session_id',
    'email',
    'phone',
    'is_anonymous'
  ] LOOP
    IF original_claims ? claim THEN
      new_claims = jsonb_set(new_claims, ARRAY[claim], original_claims->claim);
    END IF;
  END LOOP;

  new_claims = jsonb_set(new_claims, ARRAY['app_metadata'], app_meta);

  RETURN jsonb_build_object('claims', new_claims);
END
$$;


ALTER FUNCTION "public"."custom_access_token_hook"("event" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."datos_validos_con_definicion"("p_definicion" "jsonb", "p_datos" "jsonb") RETURNS boolean
    LANGUAGE "sql" STABLE
    AS $$
  SELECT extensions.jsonb_matches_schema(
    public.json_schema_parcial_definicion(COALESCE(p_definicion, '{}'::jsonb)),
    CASE
      WHEN jsonb_typeof(COALESCE(p_datos, '{}'::jsonb)) = 'object'
        THEN COALESCE(p_datos, '{}'::jsonb)
      ELSE '{}'::jsonb
    END
  );
$$;


ALTER FUNCTION "public"."datos_validos_con_definicion"("p_definicion" "jsonb", "p_datos" "jsonb") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."datos_validos_con_definicion"("p_definicion" "jsonb", "p_datos" "jsonb") IS 'Valida datos jsonb contra una definicion de estructura usando pg_jsonschema.';



CREATE OR REPLACE FUNCTION "public"."fn_ajustar_seriacion_por_cambio_ciclo"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    -- 1. Validar materias que DEPENDEN de esta (Hijas)
    -- Si muevo 'Mate 1' al ciclo 3, y 'Cálculo' está en el ciclo 3,
    -- la relación se rompe porque el prerrequisito debe ser de un ciclo menor.
    UPDATE public.asignaturas
    SET prerrequisito_asignatura_id = NULL
    WHERE prerrequisito_asignatura_id = NEW.id
      AND numero_ciclo <= NEW.numero_ciclo;

    -- 2. Validar si la materia que estoy moviendo (la actual) 
    -- ahora rompe la regla con SU PROPIO prerrequisito (Padre)
    IF NEW.prerrequisito_asignatura_id IS NOT NULL THEN
        IF EXISTS (
            SELECT 1 FROM public.asignaturas 
            WHERE id = NEW.prerrequisito_asignatura_id 
            AND numero_ciclo >= NEW.numero_ciclo
        ) THEN
            NEW.prerrequisito_asignatura_id := NULL;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."fn_ajustar_seriacion_por_cambio_ciclo"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_asignar_jefe_al_crear_plan"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_rol_jefe uuid;
  v_jefe uuid;
BEGIN
  SELECT id INTO v_rol_jefe FROM roles WHERE clave = 'JEFE_CARRERA';
  IF v_rol_jefe IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT ur.usuario_id INTO v_jefe
  FROM usuarios_roles ur
  JOIN usuarios_app ua ON ua.id = ur.usuario_id
  WHERE ur.rol_id = v_rol_jefe
    AND ur.carrera_id = NEW.carrera_id
    AND ua.dado_de_baja_en IS NULL
  ORDER BY ur.creado_en ASC
  LIMIT 1;

  IF v_jefe IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO tareas_revision (
    plan_estudio_id, asignado_a, rol_id, estado_id, estatus
  )
  SELECT NEW.id, v_jefe, v_rol_jefe, NEW.estado_actual_id, 'PENDIENTE'
  WHERE NOT EXISTS (
    SELECT 1 FROM tareas_revision t
    WHERE t.plan_estudio_id = NEW.id AND t.asignado_a = v_jefe
  );

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."fn_asignar_jefe_al_crear_plan"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_asignaturas_update_search_vector"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.search_vector :=
      setweight(
        to_tsvector('public.es_simple_unaccent', coalesce(new.nombre, '')),
        'A'
      )
      ||
      setweight(
        to_tsvector('public.es_simple_unaccent', coalesce(new.codigo, '')),
        'A'
      )
      ||
      setweight(
        to_tsvector('public.es_simple_unaccent', coalesce(new.datos, '{}'::jsonb)::text),
        'B'
      )
      ||
      setweight(
        to_tsvector('public.es_simple_unaccent', coalesce(new.contenido_tematico, '[]'::jsonb)::text),
        'B'
      );

  return new;
end;
$$;


ALTER FUNCTION "public"."fn_asignaturas_update_search_vector"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_borradores_campo_set_plan_id"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NEW.entidad = 'plan' THEN
    NEW.plan_id := NEW.entidad_id;
  ELSIF NEW.entidad = 'asignatura' THEN
    SELECT a.plan_estudio_id
    INTO NEW.plan_id
    FROM public.asignaturas a
    WHERE a.id = NEW.entidad_id;

    IF NEW.plan_id IS NULL THEN
      RAISE EXCEPTION 'No se encontró la asignatura % para el borrador', NEW.entidad_id
        USING ERRCODE = 'foreign_key_violation';
    END IF;
  END IF;

  NEW.clave := btrim(NEW.clave);

  IF NEW.clave = '' THEN
    RAISE EXCEPTION 'La clave del borrador no puede estar vacía'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."fn_borradores_campo_set_plan_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_fill_author_from_auth_uid"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  current_user_id uuid := auth.uid();
BEGIN
  IF current_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.creado_por IS NULL THEN
      NEW.creado_por := current_user_id;
    END IF;

    IF NEW.actualizado_por IS NULL THEN
      NEW.actualizado_por := current_user_id;
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.actualizado_por IS NULL
      OR NEW.actualizado_por IS NOT DISTINCT FROM OLD.actualizado_por THEN
      NEW.actualizado_por := current_user_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."fn_fill_author_from_auth_uid"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_grant_profesor_on_responsable"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_rol_prof uuid;
BEGIN
  SELECT id INTO v_rol_prof FROM roles WHERE clave = 'PROFESOR';
  IF v_rol_prof IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO usuarios_roles (usuario_id, rol_id, facultad_id, carrera_id)
  SELECT NEW.usuario_id, v_rol_prof, NULL::uuid, NULL::uuid
  WHERE NOT EXISTS (
    SELECT 1 FROM usuarios_roles ur
    WHERE ur.usuario_id = NEW.usuario_id AND ur.rol_id = v_rol_prof
  );

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."fn_grant_profesor_on_responsable"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_log_bibliografia_asignatura_cambios"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_asignatura_id uuid;
  v_plan_id uuid;
  v_actor uuid;
  v_override boolean := false;
  v_motivo text := NULL;
  v_estado text := NULL;
BEGIN
  v_asignatura_id := CASE WHEN tg_op = 'DELETE' THEN old.asignatura_id ELSE new.asignatura_id END;
  SELECT plan_estudio_id INTO v_plan_id FROM public.asignaturas WHERE id = v_asignatura_id;
  v_actor := CASE
    WHEN tg_op = 'INSERT' THEN new.creado_por
    WHEN tg_op = 'DELETE' THEN old.creado_por
    ELSE auth.uid()
  END;

  SELECT a.admin_override, a.motivo, a.estado_clave
  INTO v_override, v_motivo, v_estado
  FROM public.authz_admin_override_audit(v_plan_id) a;

  INSERT INTO public.cambios_asignatura (
    asignatura_id, cambiado_por, tipo, campo, valor_anterior, valor_nuevo, fuente,
    admin_override, admin_override_motivo, admin_override_estado_clave
  )
  VALUES (
    v_asignatura_id,
    v_actor,
    CASE WHEN tg_op = 'INSERT' THEN 'CREACION'::public.tipo_cambio
         WHEN tg_op = 'DELETE' THEN 'OTRO'::public.tipo_cambio
         ELSE 'ACTUALIZACION'::public.tipo_cambio END,
    'bibliografia_asignatura',
    CASE WHEN tg_op = 'INSERT' THEN NULL ELSE to_jsonb(old) END,
    CASE WHEN tg_op = 'DELETE' THEN NULL ELSE to_jsonb(new) END,
    'HUMANO'::public.fuente_cambio,
    v_override,
    v_motivo,
    v_estado
  );

  RETURN CASE WHEN tg_op = 'DELETE' THEN old ELSE new END;
END;
$$;


ALTER FUNCTION "public"."fn_log_bibliografia_asignatura_cambios"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_log_cambios_planes_estudio"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  k text;
  old_val jsonb;
  new_val jsonb;
  v_response_id text := NULL;
  v_actor uuid;
  v_override boolean := false;
  v_motivo text := NULL;
  v_estado text := NULL;
BEGIN
  IF tg_op <> 'DELETE' THEN
    v_response_id := NULLIF(new.meta_origen->>'response_id', '');
  END IF;

  v_actor := CASE
    WHEN tg_op = 'INSERT' THEN new.creado_por
    WHEN tg_op = 'DELETE' THEN old.actualizado_por
    ELSE new.actualizado_por
  END;

  SELECT a.admin_override, a.motivo, a.estado_clave
  INTO v_override, v_motivo, v_estado
  FROM public.authz_admin_override_audit(CASE WHEN tg_op = 'DELETE' THEN old.id ELSE new.id END) a;

  IF tg_op = 'INSERT' THEN
    INSERT INTO public.cambios_plan (
      plan_estudio_id, cambiado_por, tipo, campo, valor_anterior, valor_nuevo,
      response_id, admin_override, admin_override_motivo, admin_override_estado_clave
    )
    VALUES (
      new.id, v_actor, 'CREACION'::public.tipo_cambio, NULL, NULL, to_jsonb(new),
      NULL, v_override, v_motivo, v_estado
    );
    RETURN new;
  END IF;

  IF tg_op = 'DELETE' THEN
    INSERT INTO public.cambios_plan (
      plan_estudio_id, cambiado_por, tipo, campo, valor_anterior, valor_nuevo,
      response_id, admin_override, admin_override_motivo, admin_override_estado_clave
    )
    VALUES (
      old.id, v_actor, 'OTRO'::public.tipo_cambio, 'DELETE', to_jsonb(old), NULL,
      NULL, v_override, v_motivo, v_estado
    );
    RETURN old;
  END IF;

  IF (new.estado_actual_id IS DISTINCT FROM old.estado_actual_id) THEN
    INSERT INTO public.cambios_plan (
      plan_estudio_id, cambiado_por, tipo, campo, valor_anterior, valor_nuevo,
      response_id, admin_override, admin_override_motivo, admin_override_estado_clave
    )
    VALUES (
      new.id, v_actor, 'TRANSICION_ESTADO'::public.tipo_cambio, 'estado_actual_id',
      to_jsonb(old.estado_actual_id), to_jsonb(new.estado_actual_id),
      NULL, v_override, v_motivo, v_estado
    );
  END IF;

  IF (new.datos IS DISTINCT FROM old.datos) THEN
    FOR k IN
      SELECT DISTINCT key
      FROM (
        SELECT jsonb_object_keys(coalesce(old.datos, '{}'::jsonb)) AS key
        UNION ALL
        SELECT jsonb_object_keys(coalesce(new.datos, '{}'::jsonb)) AS key
      ) t
    LOOP
      old_val := coalesce(old.datos, '{}'::jsonb) -> k;
      new_val := coalesce(new.datos, '{}'::jsonb) -> k;

      IF (old_val IS DISTINCT FROM new_val) THEN
        INSERT INTO public.cambios_plan (
          plan_estudio_id, cambiado_por, tipo, campo, valor_anterior, valor_nuevo,
          response_id, admin_override, admin_override_motivo, admin_override_estado_clave
        )
        VALUES (
          new.id, v_actor, 'ACTUALIZACION_CAMPO'::public.tipo_cambio, k,
          old_val, new_val, v_response_id, v_override, v_motivo, v_estado
        );
      END IF;
    END LOOP;
  END IF;

  IF (new.nombre IS DISTINCT FROM old.nombre) THEN
    INSERT INTO public.cambios_plan (plan_estudio_id, cambiado_por, tipo, campo, valor_anterior, valor_nuevo, response_id, admin_override, admin_override_motivo, admin_override_estado_clave)
    VALUES (new.id, v_actor, 'ACTUALIZACION'::public.tipo_cambio, 'nombre', to_jsonb(old.nombre), to_jsonb(new.nombre), NULL, v_override, v_motivo, v_estado);
  END IF;

  IF (new.tipo_ciclo IS DISTINCT FROM old.tipo_ciclo) THEN
    INSERT INTO public.cambios_plan (plan_estudio_id, cambiado_por, tipo, campo, valor_anterior, valor_nuevo, response_id, admin_override, admin_override_motivo, admin_override_estado_clave)
    VALUES (new.id, v_actor, 'ACTUALIZACION'::public.tipo_cambio, 'tipo_ciclo', to_jsonb(old.tipo_ciclo), to_jsonb(new.tipo_ciclo), NULL, v_override, v_motivo, v_estado);
  END IF;

  IF (new.numero_ciclos IS DISTINCT FROM old.numero_ciclos) THEN
    INSERT INTO public.cambios_plan (plan_estudio_id, cambiado_por, tipo, campo, valor_anterior, valor_nuevo, response_id, admin_override, admin_override_motivo, admin_override_estado_clave)
    VALUES (new.id, v_actor, 'ACTUALIZACION'::public.tipo_cambio, 'numero_ciclos', to_jsonb(old.numero_ciclos), to_jsonb(new.numero_ciclos), NULL, v_override, v_motivo, v_estado);
  END IF;

  IF (new.activo IS DISTINCT FROM old.activo) THEN
    INSERT INTO public.cambios_plan (plan_estudio_id, cambiado_por, tipo, campo, valor_anterior, valor_nuevo, response_id, admin_override, admin_override_motivo, admin_override_estado_clave)
    VALUES (new.id, v_actor, 'ACTUALIZACION'::public.tipo_cambio, 'activo', to_jsonb(old.activo), to_jsonb(new.activo), NULL, v_override, v_motivo, v_estado);
  END IF;

  IF (new.carrera_id IS DISTINCT FROM old.carrera_id) THEN
    INSERT INTO public.cambios_plan (plan_estudio_id, cambiado_por, tipo, campo, valor_anterior, valor_nuevo, response_id, admin_override, admin_override_motivo, admin_override_estado_clave)
    VALUES (new.id, v_actor, 'ACTUALIZACION'::public.tipo_cambio, 'carrera_id', to_jsonb(old.carrera_id), to_jsonb(new.carrera_id), NULL, v_override, v_motivo, v_estado);
  END IF;

  IF (new.estructura_id IS DISTINCT FROM old.estructura_id) THEN
    INSERT INTO public.cambios_plan (plan_estudio_id, cambiado_por, tipo, campo, valor_anterior, valor_nuevo, response_id, admin_override, admin_override_motivo, admin_override_estado_clave)
    VALUES (new.id, v_actor, 'ACTUALIZACION'::public.tipo_cambio, 'estructura_id', to_jsonb(old.estructura_id), to_jsonb(new.estructura_id), NULL, v_override, v_motivo, v_estado);
  END IF;

  IF (new.tipo_origen IS DISTINCT FROM old.tipo_origen) THEN
    INSERT INTO public.cambios_plan (plan_estudio_id, cambiado_por, tipo, campo, valor_anterior, valor_nuevo, response_id, admin_override, admin_override_motivo, admin_override_estado_clave)
    VALUES (new.id, v_actor, 'ACTUALIZACION'::public.tipo_cambio, 'tipo_origen', to_jsonb(old.tipo_origen), to_jsonb(new.tipo_origen), NULL, v_override, v_motivo, v_estado);
  END IF;

  IF v_response_id IS NOT NULL THEN
    new.meta_origen := new.meta_origen - 'response_id';
  END IF;

  RETURN new;
END;
$$;


ALTER FUNCTION "public"."fn_log_cambios_planes_estudio"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_log_lineas_plan_cambios"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_plan_id uuid;
  v_actor uuid;
  v_override boolean := false;
  v_motivo text := NULL;
  v_estado text := NULL;
BEGIN
  v_plan_id := CASE WHEN tg_op = 'DELETE' THEN old.plan_estudio_id ELSE new.plan_estudio_id END;
  v_actor := CASE
    WHEN tg_op = 'INSERT' THEN new.creado_por
    WHEN tg_op = 'DELETE' THEN old.actualizado_por
    ELSE new.actualizado_por
  END;

  SELECT a.admin_override, a.motivo, a.estado_clave
  INTO v_override, v_motivo, v_estado
  FROM public.authz_admin_override_audit(v_plan_id) a;

  INSERT INTO public.cambios_plan (
    plan_estudio_id, cambiado_por, tipo, campo, valor_anterior, valor_nuevo,
    admin_override, admin_override_motivo, admin_override_estado_clave
  )
  VALUES (
    v_plan_id,
    v_actor,
    CASE WHEN tg_op = 'INSERT' THEN 'CREACION'::public.tipo_cambio
         WHEN tg_op = 'DELETE' THEN 'OTRO'::public.tipo_cambio
         ELSE 'ACTUALIZACION_MAPA'::public.tipo_cambio END,
    'lineas_plan',
    CASE WHEN tg_op = 'INSERT' THEN NULL ELSE to_jsonb(old) END,
    CASE WHEN tg_op = 'DELETE' THEN NULL ELSE to_jsonb(new) END,
    v_override,
    v_motivo,
    v_estado
  );

  RETURN CASE WHEN tg_op = 'DELETE' THEN old ELSE new END;
END;
$$;


ALTER FUNCTION "public"."fn_log_lineas_plan_cambios"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_notificar_cambio_estado_plan"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NEW.estado_actual_id IS DISTINCT FROM OLD.estado_actual_id THEN
    INSERT INTO public.notificaciones (usuario_id, tipo, payload)
    SELECT DISTINCT t.asignado_a, 'ESTADO_CAMBIADO'::public.tipo_notificacion,
      jsonb_build_object('plan_estudio_id', NEW.id, 'estado_id', NEW.estado_actual_id)
    FROM public.tareas_revision t
    WHERE t.plan_estudio_id = NEW.id
      AND t.asignado_a IS NOT NULL
      AND t.asignado_a <> COALESCE(NEW.actualizado_por, '00000000-0000-0000-0000-000000000000'::uuid);
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."fn_notificar_cambio_estado_plan"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_notificar_comentario_asignatura"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  INSERT INTO public.notificaciones (usuario_id, tipo, payload)
  SELECT DISTINCT ra.usuario_id, 'COMENTARIO'::public.tipo_notificacion,
    jsonb_build_object('asignatura_id', NEW.asignatura_id, 'comentario_id', NEW.id)
  FROM public.responsables_asignatura ra
  WHERE ra.asignatura_id = NEW.asignatura_id
    AND ra.usuario_id IS NOT NULL
    AND ra.usuario_id <> COALESCE(NEW.autor_id, '00000000-0000-0000-0000-000000000000'::uuid);
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."fn_notificar_comentario_asignatura"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_notificar_comentario_plan"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  INSERT INTO public.notificaciones (usuario_id, tipo, payload)
  SELECT DISTINCT t.asignado_a, 'COMENTARIO'::public.tipo_notificacion,
    jsonb_build_object('plan_estudio_id', NEW.plan_estudio_id, 'comentario_id', NEW.id)
  FROM public.tareas_revision t
  WHERE t.plan_estudio_id = NEW.plan_estudio_id
    AND t.asignado_a IS NOT NULL
    AND t.asignado_a <> COALESCE(NEW.autor_id, '00000000-0000-0000-0000-000000000000'::uuid);
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."fn_notificar_comentario_plan"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_track_cambios_asignatura"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  k text;
  old_val jsonb;
  new_val jsonb;
  v_interaccion_id uuid := NULL;
  v_usuario uuid;
  v_fuente public.fuente_cambio := 'HUMANO'::public.fuente_cambio;
  v_plan_id uuid;
  v_override boolean := false;
  v_motivo text := NULL;
  v_estado text := NULL;
BEGIN
  IF tg_op = 'DELETE' THEN
    v_usuario := old.actualizado_por;
    v_plan_id := old.plan_estudio_id;
  ELSE
    v_interaccion_id := nullif(new.meta_origen->>'interaccion_ia_id', '')::uuid;
    v_usuario := CASE WHEN tg_op = 'INSERT' THEN new.creado_por ELSE new.actualizado_por END;
    v_fuente := CASE WHEN v_interaccion_id IS NULL THEN 'HUMANO'::public.fuente_cambio ELSE 'IA'::public.fuente_cambio END;
    v_plan_id := new.plan_estudio_id;
  END IF;

  SELECT a.admin_override, a.motivo, a.estado_clave
  INTO v_override, v_motivo, v_estado
  FROM public.authz_admin_override_audit(v_plan_id) a;

  IF tg_op = 'INSERT' THEN
    INSERT INTO public.cambios_asignatura (
      asignatura_id, cambiado_por, tipo, valor_nuevo, fuente, interaccion_ia_id,
      admin_override, admin_override_motivo, admin_override_estado_clave
    )
    VALUES (
      new.id, v_usuario, 'CREACION'::public.tipo_cambio, to_jsonb(new), v_fuente, v_interaccion_id,
      v_override, v_motivo, v_estado
    );

    IF v_interaccion_id IS NOT NULL THEN
      new.meta_origen := new.meta_origen - 'interaccion_ia_id';
    END IF;

    RETURN new;
  END IF;

  IF tg_op = 'DELETE' THEN
    INSERT INTO public.cambios_asignatura (
      asignatura_id, cambiado_por, tipo, campo, valor_anterior, fuente,
      admin_override, admin_override_motivo, admin_override_estado_clave
    )
    VALUES (
      old.id, v_usuario, 'OTRO'::public.tipo_cambio, 'DELETE', to_jsonb(old), 'HUMANO'::public.fuente_cambio,
      v_override, v_motivo, v_estado
    );

    RETURN old;
  END IF;

  IF (new.plan_estudio_id IS DISTINCT FROM old.plan_estudio_id) THEN
    INSERT INTO public.cambios_asignatura (asignatura_id, cambiado_por, tipo, campo, valor_anterior, valor_nuevo, fuente, interaccion_ia_id, admin_override, admin_override_motivo, admin_override_estado_clave)
    VALUES (new.id, v_usuario, 'ACTUALIZACION_MAPA', 'plan_estudio_id', to_jsonb(old.plan_estudio_id), to_jsonb(new.plan_estudio_id), v_fuente, v_interaccion_id, v_override, v_motivo, v_estado);
  END IF;

  IF (new.numero_ciclo IS DISTINCT FROM old.numero_ciclo) THEN
    INSERT INTO public.cambios_asignatura (asignatura_id, cambiado_por, tipo, campo, valor_anterior, valor_nuevo, fuente, interaccion_ia_id, admin_override, admin_override_motivo, admin_override_estado_clave)
    VALUES (new.id, v_usuario, 'ACTUALIZACION_MAPA', 'numero_ciclo', to_jsonb(old.numero_ciclo), to_jsonb(new.numero_ciclo), v_fuente, v_interaccion_id, v_override, v_motivo, v_estado);
  END IF;

  IF (new.linea_plan_id IS DISTINCT FROM old.linea_plan_id) THEN
    INSERT INTO public.cambios_asignatura (asignatura_id, cambiado_por, tipo, campo, valor_anterior, valor_nuevo, fuente, interaccion_ia_id, admin_override, admin_override_motivo, admin_override_estado_clave)
    VALUES (new.id, v_usuario, 'ACTUALIZACION_MAPA', 'linea_plan_id', to_jsonb(old.linea_plan_id), to_jsonb(new.linea_plan_id), v_fuente, v_interaccion_id, v_override, v_motivo, v_estado);
  END IF;

  IF (new.orden_celda IS DISTINCT FROM old.orden_celda) THEN
    INSERT INTO public.cambios_asignatura (asignatura_id, cambiado_por, tipo, campo, valor_anterior, valor_nuevo, fuente, interaccion_ia_id, admin_override, admin_override_motivo, admin_override_estado_clave)
    VALUES (new.id, v_usuario, 'ACTUALIZACION_MAPA', 'orden_celda', to_jsonb(old.orden_celda), to_jsonb(new.orden_celda), v_fuente, v_interaccion_id, v_override, v_motivo, v_estado);
  END IF;

  IF (new.prerrequisito_asignatura_id IS DISTINCT FROM old.prerrequisito_asignatura_id) THEN
    INSERT INTO public.cambios_asignatura (asignatura_id, cambiado_por, tipo, campo, valor_anterior, valor_nuevo, fuente, interaccion_ia_id, admin_override, admin_override_motivo, admin_override_estado_clave)
    VALUES (new.id, v_usuario, 'ACTUALIZACION_MAPA', 'prerrequisito_asignatura_id', to_jsonb(old.prerrequisito_asignatura_id), to_jsonb(new.prerrequisito_asignatura_id), v_fuente, v_interaccion_id, v_override, v_motivo, v_estado);
  END IF;

  IF (new.nombre IS DISTINCT FROM old.nombre) THEN
    INSERT INTO public.cambios_asignatura (asignatura_id, cambiado_por, tipo, campo, valor_anterior, valor_nuevo, fuente, interaccion_ia_id, admin_override, admin_override_motivo, admin_override_estado_clave)
    VALUES (new.id, v_usuario, 'ACTUALIZACION', 'nombre', to_jsonb(old.nombre), to_jsonb(new.nombre), v_fuente, v_interaccion_id, v_override, v_motivo, v_estado);
  END IF;

  IF (new.codigo IS DISTINCT FROM old.codigo) THEN
    INSERT INTO public.cambios_asignatura (asignatura_id, cambiado_por, tipo, campo, valor_anterior, valor_nuevo, fuente, interaccion_ia_id, admin_override, admin_override_motivo, admin_override_estado_clave)
    VALUES (new.id, v_usuario, 'ACTUALIZACION', 'codigo', to_jsonb(old.codigo), to_jsonb(new.codigo), v_fuente, v_interaccion_id, v_override, v_motivo, v_estado);
  END IF;

  IF (new.tipo IS DISTINCT FROM old.tipo) THEN
    INSERT INTO public.cambios_asignatura (asignatura_id, cambiado_por, tipo, campo, valor_anterior, valor_nuevo, fuente, interaccion_ia_id, admin_override, admin_override_motivo, admin_override_estado_clave)
    VALUES (new.id, v_usuario, 'ACTUALIZACION', 'tipo', to_jsonb(old.tipo), to_jsonb(new.tipo), v_fuente, v_interaccion_id, v_override, v_motivo, v_estado);
  END IF;

  IF (new.estructura_id IS DISTINCT FROM old.estructura_id) THEN
    INSERT INTO public.cambios_asignatura (asignatura_id, cambiado_por, tipo, campo, valor_anterior, valor_nuevo, fuente, interaccion_ia_id, admin_override, admin_override_motivo, admin_override_estado_clave)
    VALUES (new.id, v_usuario, 'ACTUALIZACION', 'estructura_id', to_jsonb(old.estructura_id), to_jsonb(new.estructura_id), v_fuente, v_interaccion_id, v_override, v_motivo, v_estado);
  END IF;

  IF (new.creditos IS DISTINCT FROM old.creditos) THEN
    INSERT INTO public.cambios_asignatura (asignatura_id, cambiado_por, tipo, campo, valor_anterior, valor_nuevo, fuente, interaccion_ia_id, admin_override, admin_override_motivo, admin_override_estado_clave)
    VALUES (new.id, v_usuario, 'ACTUALIZACION', 'creditos', to_jsonb(old.creditos), to_jsonb(new.creditos), v_fuente, v_interaccion_id, v_override, v_motivo, v_estado);
  END IF;

  IF (new.horas_academicas IS DISTINCT FROM old.horas_academicas) THEN
    INSERT INTO public.cambios_asignatura (asignatura_id, cambiado_por, tipo, campo, valor_anterior, valor_nuevo, fuente, interaccion_ia_id, admin_override, admin_override_motivo, admin_override_estado_clave)
    VALUES (new.id, v_usuario, 'ACTUALIZACION', 'horas_academicas', to_jsonb(old.horas_academicas), to_jsonb(new.horas_academicas), v_fuente, v_interaccion_id, v_override, v_motivo, v_estado);
  END IF;

  IF (new.horas_independientes IS DISTINCT FROM old.horas_independientes) THEN
    INSERT INTO public.cambios_asignatura (asignatura_id, cambiado_por, tipo, campo, valor_anterior, valor_nuevo, fuente, interaccion_ia_id, admin_override, admin_override_motivo, admin_override_estado_clave)
    VALUES (new.id, v_usuario, 'ACTUALIZACION', 'horas_independientes', to_jsonb(old.horas_independientes), to_jsonb(new.horas_independientes), v_fuente, v_interaccion_id, v_override, v_motivo, v_estado);
  END IF;

  IF (new.datos IS DISTINCT FROM old.datos) THEN
    FOR k IN
      SELECT DISTINCT key FROM (
        SELECT jsonb_object_keys(coalesce(old.datos, '{}'::jsonb)) AS key
        UNION ALL
        SELECT jsonb_object_keys(coalesce(new.datos, '{}'::jsonb)) AS key
      ) t
    LOOP
      old_val := coalesce(old.datos, '{}'::jsonb) -> k;
      new_val := coalesce(new.datos, '{}'::jsonb) -> k;

      IF (old_val IS DISTINCT FROM new_val) THEN
        INSERT INTO public.cambios_asignatura (asignatura_id, cambiado_por, tipo, campo, valor_anterior, valor_nuevo, fuente, interaccion_ia_id, admin_override, admin_override_motivo, admin_override_estado_clave)
        VALUES (new.id, v_usuario, 'ACTUALIZACION_CAMPO', k, old_val, new_val, v_fuente, v_interaccion_id, v_override, v_motivo, v_estado);
      END IF;
    END LOOP;
  END IF;

  IF (new.criterios_de_evaluacion IS DISTINCT FROM old.criterios_de_evaluacion) THEN
    INSERT INTO public.cambios_asignatura (asignatura_id, cambiado_por, tipo, campo, valor_anterior, valor_nuevo, fuente, interaccion_ia_id, admin_override, admin_override_motivo, admin_override_estado_clave)
    VALUES (new.id, v_usuario, 'ACTUALIZACION', 'criterios_de_evaluacion', old.criterios_de_evaluacion, new.criterios_de_evaluacion, v_fuente, v_interaccion_id, v_override, v_motivo, v_estado);
  END IF;

  IF (new.contenido_tematico IS DISTINCT FROM old.contenido_tematico) THEN
    INSERT INTO public.cambios_asignatura (asignatura_id, cambiado_por, tipo, campo, valor_anterior, valor_nuevo, fuente, interaccion_ia_id, admin_override, admin_override_motivo, admin_override_estado_clave)
    VALUES (new.id, v_usuario, 'ACTUALIZACION', 'contenido_tematico', old.contenido_tematico, new.contenido_tematico, v_fuente, v_interaccion_id, v_override, v_motivo, v_estado);
  END IF;

  IF v_interaccion_id IS NOT NULL THEN
    new.meta_origen := new.meta_origen - 'interaccion_ia_id';
  END IF;

  RETURN new;
END;
$$;


ALTER FUNCTION "public"."fn_track_cambios_asignatura"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_validar_asignatura_estructura_plan"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.planes_estudio pe
    JOIN public.estructuras_asignatura ea ON ea.id = NEW.estructura_id
    WHERE pe.id = NEW.plan_estudio_id
      AND ea.estructura_plan_id = pe.estructura_id
  ) THEN
    RAISE EXCEPTION 'La estructura de asignatura no pertenece a la estructura del plan'
      USING ERRCODE = 'foreign_key_violation';
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."fn_validar_asignatura_estructura_plan"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_validar_datos_asignatura"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $$
DECLARE
  v_def jsonb;
  v_props jsonb;
  v_old_datos jsonb := '{}'::jsonb;
  v_input_datos jsonb := '{}'::jsonb;
  v_actor uuid;
  v_key text;
  v_old_value jsonb;
  v_new_value jsonb;
  v_unknown text;
  v_has_full_write boolean;
BEGIN
  SELECT ea.definicion
  INTO v_def
  FROM public.estructuras_asignatura ea
  WHERE ea.id = NEW.estructura_id;

  IF v_def IS NULL THEN
    RAISE EXCEPTION 'Estructura de asignatura no encontrada'
      USING ERRCODE = 'foreign_key_violation';
  END IF;

  v_props := COALESCE(v_def->'properties', '{}'::jsonb);
  IF jsonb_typeof(v_props) IS DISTINCT FROM 'object' THEN
    v_props := '{}'::jsonb;
  END IF;

  v_input_datos := COALESCE(NEW.datos, '{}'::jsonb);
  IF jsonb_typeof(v_input_datos) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'Los datos de la asignatura deben ser un objeto JSON'
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT string_agg(key, ', ' ORDER BY key)
  INTO v_unknown
  FROM jsonb_object_keys(v_input_datos) AS k(key)
  WHERE NOT (v_props ? key);

  IF v_unknown IS NOT NULL THEN
    RAISE EXCEPTION 'Los datos de la asignatura contienen claves no definidas: %', v_unknown
      USING ERRCODE = 'check_violation';
  END IF;

  NEW.datos := public.normalizar_datos_por_definicion(v_input_datos, v_def, false);

  IF NOT public.datos_validos_con_definicion(v_def, NEW.datos) THEN
    RAISE EXCEPTION 'Los datos de la asignatura no coinciden con su estructura'
      USING ERRCODE = 'check_violation';
  END IF;

  v_actor := COALESCE(NEW.actualizado_por, NEW.creado_por, auth.uid());

  IF TG_OP = 'UPDATE' THEN
    v_has_full_write := public.authz_asignatura_write_allowed(NEW.id)
      OR public.authz_is_service_role();

    IF NOT v_has_full_write
      AND (
        to_jsonb(NEW) - 'datos' - 'actualizado_en' - 'actualizado_por'
      ) IS DISTINCT FROM (
        to_jsonb(OLD) - 'datos' - 'actualizado_en' - 'actualizado_por'
      )
    THEN
      RAISE EXCEPTION 'Solo se pueden modificar datos restringidos en esta etapa'
        USING ERRCODE = '42501';
    END IF;

    v_old_datos := COALESCE(OLD.datos, '{}'::jsonb);
  END IF;

  IF TG_OP = 'INSERT' THEN
    FOR v_key IN SELECT jsonb_object_keys(NEW.datos)
    LOOP
      v_new_value := NEW.datos->v_key;
      IF public.propiedad_tiene_restriccion(v_props->v_key)
        AND NOT public.valor_jsonb_vacio(v_new_value)
        AND NOT public.usuario_puede_editar_campo_asignatura(v_actor, NEW.id, v_key)
      THEN
        RAISE EXCEPTION 'No tienes permiso para editar el campo restringido "%"', v_key
          USING ERRCODE = '42501';
      END IF;
    END LOOP;
  ELSIF NEW.datos IS DISTINCT FROM v_old_datos THEN
    FOR v_key IN
      SELECT DISTINCT key
      FROM (
        SELECT jsonb_object_keys(v_old_datos) AS key
        UNION ALL
        SELECT jsonb_object_keys(NEW.datos) AS key
      ) keys
    LOOP
      v_old_value := v_old_datos->v_key;
      v_new_value := NEW.datos->v_key;

      IF v_old_value IS DISTINCT FROM v_new_value
        AND public.propiedad_tiene_restriccion(v_props->v_key)
        AND NOT public.usuario_puede_editar_campo_asignatura(v_actor, NEW.id, v_key)
      THEN
        RAISE EXCEPTION 'No tienes permiso para editar el campo restringido "%"', v_key
          USING ERRCODE = '42501';
      END IF;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."fn_validar_datos_asignatura"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_validar_datos_plan"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $$
DECLARE
  v_def jsonb;
  v_props jsonb;
  v_old_datos jsonb := '{}'::jsonb;
  v_input_datos jsonb := '{}'::jsonb;
  v_actor uuid;
  v_key text;
  v_old_value jsonb;
  v_new_value jsonb;
  v_unknown text;
  v_has_full_write boolean;
BEGIN
  SELECT ep.definicion
  INTO v_def
  FROM public.estructuras_plan ep
  WHERE ep.id = NEW.estructura_id;

  IF v_def IS NULL THEN
    RAISE EXCEPTION 'Estructura de plan no encontrada'
      USING ERRCODE = 'foreign_key_violation';
  END IF;

  v_props := COALESCE(v_def->'properties', '{}'::jsonb);
  IF jsonb_typeof(v_props) IS DISTINCT FROM 'object' THEN
    v_props := '{}'::jsonb;
  END IF;

  v_input_datos := COALESCE(NEW.datos, '{}'::jsonb);
  IF jsonb_typeof(v_input_datos) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'Los datos del plan deben ser un objeto JSON'
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT string_agg(key, ', ' ORDER BY key)
  INTO v_unknown
  FROM jsonb_object_keys(v_input_datos) AS k(key)
  WHERE NOT (v_props ? key);

  IF v_unknown IS NOT NULL THEN
    RAISE EXCEPTION 'Los datos del plan contienen claves no definidas: %', v_unknown
      USING ERRCODE = 'check_violation';
  END IF;

  NEW.datos := public.normalizar_datos_por_definicion(v_input_datos, v_def, false);

  IF NOT public.datos_validos_con_definicion(v_def, NEW.datos) THEN
    RAISE EXCEPTION 'Los datos del plan no coinciden con su estructura'
      USING ERRCODE = 'check_violation';
  END IF;

  v_actor := COALESCE(NEW.actualizado_por, NEW.creado_por, auth.uid());

  IF TG_OP = 'UPDATE' THEN
    v_has_full_write := public.authz_plan_write_allowed(NEW.id)
      OR public.authz_is_service_role();

    IF NOT v_has_full_write
      AND (
        to_jsonb(NEW) - 'datos' - 'actualizado_en' - 'actualizado_por'
      ) IS DISTINCT FROM (
        to_jsonb(OLD) - 'datos' - 'actualizado_en' - 'actualizado_por'
      )
    THEN
      RAISE EXCEPTION 'Solo se pueden modificar datos restringidos en esta etapa'
        USING ERRCODE = '42501';
    END IF;

    v_old_datos := COALESCE(OLD.datos, '{}'::jsonb);
  END IF;

  IF TG_OP = 'INSERT' THEN
    FOR v_key IN SELECT jsonb_object_keys(NEW.datos)
    LOOP
      v_new_value := NEW.datos->v_key;
      IF public.propiedad_tiene_restriccion(v_props->v_key)
        AND NOT public.valor_jsonb_vacio(v_new_value)
        AND NOT public.usuario_puede_editar_campo_plan(v_actor, NEW.id, v_key)
      THEN
        RAISE EXCEPTION 'No tienes permiso para editar el campo restringido "%"', v_key
          USING ERRCODE = '42501';
      END IF;
    END LOOP;
  ELSIF NEW.datos IS DISTINCT FROM v_old_datos THEN
    FOR v_key IN
      SELECT DISTINCT key
      FROM (
        SELECT jsonb_object_keys(v_old_datos) AS key
        UNION ALL
        SELECT jsonb_object_keys(NEW.datos) AS key
      ) keys
    LOOP
      v_old_value := v_old_datos->v_key;
      v_new_value := NEW.datos->v_key;

      IF v_old_value IS DISTINCT FROM v_new_value
        AND public.propiedad_tiene_restriccion(v_props->v_key)
        AND NOT public.usuario_puede_editar_campo_plan(v_actor, NEW.id, v_key)
      THEN
        RAISE EXCEPTION 'No tienes permiso para editar el campo restringido "%"', v_key
          USING ERRCODE = '42501';
      END IF;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."fn_validar_datos_plan"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."json_schema_parcial_definicion"("p_definicion" "jsonb") RETURNS json
    LANGUAGE "sql" IMMUTABLE
    AS $_$
  SELECT jsonb_build_object(
    '$schema', 'http://json-schema.org/draft-07/schema#',
    'type', 'object',
    'additionalProperties', false,
    'properties', COALESCE(
      (
        SELECT jsonb_object_agg(
          key,
          jsonb_build_object(
            'anyOf',
            jsonb_build_array(
              CASE
                WHEN jsonb_typeof(value) = 'object'
                  THEN value - 'x-acad-ia'
                ELSE '{}'::jsonb
              END,
              jsonb_build_object('type', 'null')
            )
          )
        )
        FROM jsonb_each(
          CASE
            WHEN jsonb_typeof(COALESCE(p_definicion, '{}'::jsonb)->'properties') = 'object'
              THEN COALESCE(p_definicion, '{}'::jsonb)->'properties'
            ELSE '{}'::jsonb
          END
        )
      ),
      '{}'::jsonb
    )
  )::json;
$_$;


ALTER FUNCTION "public"."json_schema_parcial_definicion"("p_definicion" "jsonb") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."json_schema_parcial_definicion"("p_definicion" "jsonb") IS 'Construye un JSON Schema parcial: sin required, con null permitido y additionalProperties=false.';



CREATE OR REPLACE FUNCTION "public"."nombrar_responsable"("p_usuario" "uuid", "p_rol" "uuid", "p_facultad" "uuid", "p_carrera" "uuid", "p_actor" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_alcance text;
  v_reemplazados jsonb;
  v_nueva usuarios_roles;
BEGIN
  -- Permiso (defensa en profundidad; el edge function ya valida con el JWT).
  IF NOT public.usuario_tiene_permiso(p_actor, 'usuarios.roles.gestionar') THEN
    RAISE EXCEPTION 'No tienes permisos para nombrar responsables.'
      USING ERRCODE = 'P0403';
  END IF;

  SELECT alcance_default INTO v_alcance FROM roles WHERE id = p_rol;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Rol no encontrado.' USING ERRCODE = 'P0404';
  END IF;

  IF p_facultad IS NOT NULL AND p_carrera IS NOT NULL THEN
    RAISE EXCEPTION 'El alcance debe ser por facultad o por carrera, no ambos.'
      USING ERRCODE = 'P0409';
  END IF;
  IF v_alcance = 'facultad' AND p_facultad IS NULL THEN
    RAISE EXCEPTION 'Este rol requiere una facultad.' USING ERRCODE = 'P0409';
  END IF;
  IF v_alcance = 'carrera' AND p_carrera IS NULL THEN
    RAISE EXCEPTION 'Este rol requiere una carrera.' USING ERRCODE = 'P0409';
  END IF;

  -- Retirar al(los) titular(es) actual(es) del mismo rol+alcance (distinto usuario).
  WITH removed AS (
    DELETE FROM usuarios_roles ur
    WHERE ur.rol_id = p_rol
      AND ur.usuario_id <> p_usuario
      AND (
        (p_facultad IS NOT NULL AND ur.facultad_id = p_facultad) OR
        (p_carrera IS NOT NULL AND ur.carrera_id = p_carrera)
      )
    RETURNING ur.usuario_id, ur.id AS asignacion_id
  )
  SELECT coalesce(jsonb_agg(to_jsonb(removed)), '[]'::jsonb)
    INTO v_reemplazados FROM removed;

  -- Asignar al nuevo (idempotente con el índice de unicidad por usuario).
  INSERT INTO usuarios_roles (usuario_id, rol_id, facultad_id, carrera_id, asignado_por)
  VALUES (p_usuario, p_rol, p_facultad, p_carrera, p_actor)
  ON CONFLICT DO NOTHING
  RETURNING * INTO v_nueva;

  -- Si ya existía (mismo usuario+rol+alcance), recuperar la fila vigente.
  IF v_nueva.id IS NULL THEN
    SELECT * INTO v_nueva FROM usuarios_roles
    WHERE usuario_id = p_usuario AND rol_id = p_rol
      AND coalesce(facultad_id, '00000000-0000-0000-0000-000000000000'::uuid)
          = coalesce(p_facultad, '00000000-0000-0000-0000-000000000000'::uuid)
      AND coalesce(carrera_id, '00000000-0000-0000-0000-000000000000'::uuid)
          = coalesce(p_carrera, '00000000-0000-0000-0000-000000000000'::uuid);
  END IF;

  RETURN jsonb_build_object(
    'asignacion_id', v_nueva.id,
    'usuario_id', p_usuario,
    'reemplazados', v_reemplazados
  );
END;
$$;


ALTER FUNCTION "public"."nombrar_responsable"("p_usuario" "uuid", "p_rol" "uuid", "p_facultad" "uuid", "p_carrera" "uuid", "p_actor" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."normalizar_datos_por_definicion"("p_datos" "jsonb", "p_definicion" "jsonb", "p_null_invalid" boolean DEFAULT false) RETURNS "jsonb"
    LANGUAGE "plpgsql" IMMUTABLE
    AS $$
DECLARE
  v_datos jsonb := COALESCE(p_datos, '{}'::jsonb);
  v_properties jsonb := COALESCE(p_definicion->'properties', '{}'::jsonb);
  v_result jsonb := '{}'::jsonb;
  v_key text;
  v_prop jsonb;
BEGIN
  IF jsonb_typeof(v_datos) IS DISTINCT FROM 'object' THEN
    RETURN '{}'::jsonb;
  END IF;

  IF jsonb_typeof(v_properties) IS DISTINCT FROM 'object' THEN
    RETURN '{}'::jsonb;
  END IF;

  FOR v_key, v_prop IN SELECT key, value FROM jsonb_each(v_properties)
  LOOP
    IF v_datos ? v_key THEN
      v_result := v_result || jsonb_build_object(
        v_key,
        public.normalizar_valor_por_propiedad(v_datos->v_key, v_prop, p_null_invalid)
      );
    END IF;
  END LOOP;

  RETURN v_result;
END;
$$;


ALTER FUNCTION "public"."normalizar_datos_por_definicion"("p_datos" "jsonb", "p_definicion" "jsonb", "p_null_invalid" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."normalizar_valor_por_propiedad"("p_value" "jsonb", "p_prop" "jsonb", "p_null_invalid" boolean DEFAULT false) RETURNS "jsonb"
    LANGUAGE "plpgsql" IMMUTABLE
    AS $_$
DECLARE
  v_type text := public.tipo_propiedad_json_schema(COALESCE(p_prop, '{}'::jsonb));
  v_text text;
  v_num numeric;
  v_enum jsonb;
BEGIN
  IF p_value IS NULL OR p_value = 'null'::jsonb THEN
    RETURN 'null'::jsonb;
  END IF;

  IF jsonb_typeof(p_value) = 'string' THEN
    v_text := btrim(p_value #>> '{}');
    IF v_text = '' THEN
      RETURN 'null'::jsonb;
    END IF;
  ELSE
    v_text := NULL;
  END IF;

  IF v_type = 'integer' THEN
    IF jsonb_typeof(p_value) = 'number' THEN
      RETURN to_jsonb(trunc((p_value #>> '{}')::numeric)::bigint);
    END IF;

    IF jsonb_typeof(p_value) = 'string'
      AND v_text ~ '^-?[0-9]+(\.0+)?$'
    THEN
      RETURN to_jsonb(trunc(v_text::numeric)::bigint);
    END IF;

    RETURN CASE WHEN p_null_invalid THEN 'null'::jsonb ELSE p_value END;
  END IF;

  IF v_type = 'number' THEN
    IF jsonb_typeof(p_value) = 'number' THEN
      RETURN p_value;
    END IF;

    IF jsonb_typeof(p_value) = 'string'
      AND v_text ~ '^-?([0-9]+(\.[0-9]+)?|\.[0-9]+)$'
    THEN
      v_num := v_text::numeric;
      RETURN to_jsonb(v_num);
    END IF;

    RETURN CASE WHEN p_null_invalid THEN 'null'::jsonb ELSE p_value END;
  END IF;

  IF v_type = 'string' THEN
    IF jsonb_typeof(p_value) <> 'string' THEN
      RETURN CASE WHEN p_null_invalid THEN 'null'::jsonb ELSE p_value END;
    END IF;

    v_enum := p_prop->'enum';
    IF jsonb_typeof(v_enum) = 'array'
      AND NOT EXISTS (
        SELECT 1
        FROM jsonb_array_elements_text(v_enum) item(value)
        WHERE item.value = (p_value #>> '{}')
      )
    THEN
      RETURN CASE WHEN p_null_invalid THEN 'null'::jsonb ELSE p_value END;
    END IF;
  END IF;

  RETURN p_value;
END;
$_$;


ALTER FUNCTION "public"."normalizar_valor_por_propiedad"("p_value" "jsonb", "p_prop" "jsonb", "p_null_invalid" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."plan_estado_clave"("p_plan_id" "uuid") RETURNS "text"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT ep.clave
  FROM public.planes_estudio pe
  LEFT JOIN public.estados_plan ep ON ep.id = pe.estado_actual_id
  WHERE pe.id = p_plan_id;
$$;


ALTER FUNCTION "public"."plan_estado_clave"("p_plan_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."propiedad_restriccion_estados"("p_prop" "jsonb") RETURNS "text"[]
    LANGUAGE "sql" IMMUTABLE
    AS $$
  SELECT COALESCE(
    ARRAY(
      SELECT value
      FROM jsonb_array_elements_text(
        CASE
          WHEN jsonb_typeof(p_prop #> ARRAY['x-acad-ia', 'restriccion', 'estados_editables']) = 'array'
            THEN p_prop #> ARRAY['x-acad-ia', 'restriccion', 'estados_editables']
          ELSE '[]'::jsonb
        END
      )
    ),
    ARRAY[]::text[]
  );
$$;


ALTER FUNCTION "public"."propiedad_restriccion_estados"("p_prop" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."propiedad_restriccion_permiso"("p_prop" "jsonb") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE
    AS $$
  SELECT COALESCE(
    NULLIF(btrim(p_prop #>> ARRAY['x-acad-ia', 'restriccion', 'permiso_edicion']), ''),
    'planes.campos_restringidos.editar'
  );
$$;


ALTER FUNCTION "public"."propiedad_restriccion_permiso"("p_prop" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."propiedad_tiene_restriccion"("p_prop" "jsonb") RETURNS boolean
    LANGUAGE "sql" IMMUTABLE
    AS $$
  SELECT jsonb_typeof(p_prop #> ARRAY['x-acad-ia', 'restriccion']) = 'object';
$$;


ALTER FUNCTION "public"."propiedad_tiene_restriccion"("p_prop" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reasignar_responsabilidades"("p_origen" "uuid", "p_destino" "uuid", "p_actor" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_actor_nivel int;
  v_origen_nivel int;
  v_actor_global boolean;
  v_actor_facultades uuid[];
  v_actor_carreras uuid[];
  v_uncovered boolean;
  v_destino_baja timestamptz;
  v_detalle jsonb;
BEGIN
  IF p_origen = p_destino THEN
    RAISE EXCEPTION 'El origen y el destino no pueden ser el mismo usuario.'
      USING ERRCODE = 'P0409';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM usuarios_app WHERE id = p_origen) THEN
    RAISE EXCEPTION 'Usuario origen no encontrado.' USING ERRCODE = 'P0404';
  END IF;

  SELECT dado_de_baja_en INTO v_destino_baja
  FROM usuarios_app WHERE id = p_destino;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Usuario destino no encontrado.' USING ERRCODE = 'P0404';
  END IF;
  IF v_destino_baja IS NOT NULL THEN
    RAISE EXCEPTION 'El usuario destino está dado de baja.'
      USING ERRCODE = 'P0409';
  END IF;

  IF NOT public.usuario_tiene_permiso(p_actor, 'usuarios.roles.gestionar') THEN
    RAISE EXCEPTION 'No tienes permisos para reasignar.' USING ERRCODE = 'P0403';
  END IF;

  SELECT min(r.nivel_jerarquico) INTO v_actor_nivel
  FROM usuarios_roles ur JOIN roles r ON r.id = ur.rol_id
  WHERE ur.usuario_id = p_actor;

  SELECT min(r.nivel_jerarquico) INTO v_origen_nivel
  FROM usuarios_roles ur JOIN roles r ON r.id = ur.rol_id
  WHERE ur.usuario_id = p_origen;

  IF v_origen_nivel IS NULL THEN
    RAISE EXCEPTION 'El usuario origen no tiene roles que reasignar.'
      USING ERRCODE = 'P0409';
  END IF;
  IF v_actor_nivel IS NULL OR v_actor_nivel >= v_origen_nivel THEN
    RAISE EXCEPTION 'Solo un usuario de mayor jerarquía puede reasignar a este usuario.'
      USING ERRCODE = 'P0403';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM usuarios_roles ur JOIN roles r ON r.id = ur.rol_id
    WHERE ur.usuario_id = p_actor AND r.alcance_default = 'global'
  ) INTO v_actor_global;

  SELECT coalesce(array_agg(DISTINCT ur.facultad_id)
           FILTER (WHERE ur.facultad_id IS NOT NULL), '{}'::uuid[])
    INTO v_actor_facultades
  FROM usuarios_roles ur WHERE ur.usuario_id = p_actor;

  SELECT coalesce(array_agg(DISTINCT ur.carrera_id)
           FILTER (WHERE ur.carrera_id IS NOT NULL), '{}'::uuid[])
    INTO v_actor_carreras
  FROM usuarios_roles ur WHERE ur.usuario_id = p_actor;

  -- Cobertura de roles con ámbito facultad/carrera (ignora 'asignatura').
  SELECT EXISTS (
    SELECT 1
    FROM usuarios_roles ur
    JOIN roles r ON r.id = ur.rol_id
    LEFT JOIN carreras c ON c.id = ur.carrera_id
    WHERE ur.usuario_id = p_origen
      AND r.alcance_default <> 'asignatura'
      AND NOT (
        v_actor_global
        OR (ur.facultad_id IS NOT NULL AND ur.facultad_id = ANY (v_actor_facultades))
        OR (ur.carrera_id IS NOT NULL AND (
              ur.carrera_id = ANY (v_actor_carreras)
              OR c.facultad_id = ANY (v_actor_facultades)
        ))
      )
  ) INTO v_uncovered;

  -- Cobertura por materias (profesor): cada materia del origen debe estar en el
  -- ámbito del actor (carrera o facultad). Los actores globales cubren todo.
  IF NOT v_uncovered AND NOT v_actor_global THEN
    SELECT EXISTS (
      SELECT 1
      FROM responsables_asignatura ra
      JOIN asignaturas a ON a.id = ra.asignatura_id
      JOIN planes_estudio pe ON pe.id = a.plan_estudio_id
      LEFT JOIN carreras c ON c.id = pe.carrera_id
      WHERE ra.usuario_id = p_origen
        AND NOT (
          pe.carrera_id = ANY (v_actor_carreras)
          OR c.facultad_id = ANY (v_actor_facultades)
        )
    ) INTO v_uncovered;
  END IF;

  IF v_uncovered THEN
    RAISE EXCEPTION 'El origen tiene responsabilidades fuera de tu ámbito.'
      USING ERRCODE = 'P0403';
  END IF;

  v_detalle := jsonb_build_object(
    'origen_roles',
      (SELECT coalesce(jsonb_agg(to_jsonb(ur)), '[]'::jsonb)
         FROM usuarios_roles ur WHERE ur.usuario_id = p_origen),
    'origen_tareas',
      (SELECT coalesce(jsonb_agg(t.id), '[]'::jsonb)
         FROM tareas_revision t WHERE t.asignado_a = p_origen),
    'origen_responsables',
      (SELECT coalesce(jsonb_agg(ra.id), '[]'::jsonb)
         FROM responsables_asignatura ra WHERE ra.usuario_id = p_origen),
    'destino_roles_previos',
      (SELECT coalesce(jsonb_agg(to_jsonb(ur)), '[]'::jsonb)
         FROM usuarios_roles ur WHERE ur.usuario_id = p_destino),
    'destino_tareas_previas',
      (SELECT coalesce(jsonb_agg(t.id), '[]'::jsonb)
         FROM tareas_revision t WHERE t.asignado_a = p_destino),
    'destino_responsables_previos',
      (SELECT coalesce(jsonb_agg(ra.id), '[]'::jsonb)
         FROM responsables_asignatura ra WHERE ra.usuario_id = p_destino)
  );

  DELETE FROM usuarios_roles WHERE usuario_id = p_destino;
  DELETE FROM tareas_revision WHERE asignado_a = p_destino;
  DELETE FROM responsables_asignatura WHERE usuario_id = p_destino;

  UPDATE usuarios_roles
    SET usuario_id = p_destino, asignado_por = p_actor
    WHERE usuario_id = p_origen;
  UPDATE tareas_revision
    SET asignado_a = p_destino
    WHERE asignado_a = p_origen;
  UPDATE responsables_asignatura
    SET usuario_id = p_destino
    WHERE usuario_id = p_origen;

  UPDATE usuarios_app SET dado_de_baja_en = now() WHERE id = p_origen;

  INSERT INTO reasignaciones (reasignado_por, usuario_origen, usuario_destino, detalle)
  VALUES (p_actor, p_origen, p_destino, v_detalle);

  RETURN jsonb_build_object(
    'origen', p_origen,
    'destino', p_destino,
    'reasignado_por', p_actor,
    'detalle', v_detalle
  );
END;
$$;


ALTER FUNCTION "public"."reasignar_responsabilidades"("p_origen" "uuid", "p_destino" "uuid", "p_actor" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."recalcular_vectores_asignaturas"() RETURNS "void"
    LANGUAGE "sql"
    AS $$
  UPDATE public.asignaturas
  SET search_vector =
      setweight(to_tsvector('public.es_simple_unaccent', coalesce(nombre, '')), 'A') ||
      setweight(to_tsvector('public.es_simple_unaccent', coalesce(codigo, '')), 'A') ||
      setweight(to_tsvector('public.es_simple_unaccent', coalesce(datos, '{}'::jsonb)::text), 'B') ||
      setweight(to_tsvector('public.es_simple_unaccent', coalesce(contenido_tematico, '[]'::jsonb)::text), 'B')
  WHERE id IS NOT NULL;
$$;


ALTER FUNCTION "public"."recalcular_vectores_asignaturas"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."search_asignaturas"("p_search" "text" DEFAULT ''::"text", "p_facultad_id" "uuid" DEFAULT NULL::"uuid", "p_carrera_id" "uuid" DEFAULT NULL::"uuid", "p_plan_estudio_id" "uuid" DEFAULT NULL::"uuid", "p_limit" integer DEFAULT 20, "p_offset" integer DEFAULT 0) RETURNS TABLE("id" "uuid", "plan_estudio_id" "uuid", "codigo" "text", "nombre" "text", "tipo" "public"."tipo_asignatura", "creditos" numeric, "numero_ciclo" integer, "datos" "jsonb", "contenido_tematico" "jsonb", "estado" "public"."estado_asignatura", "rank" real, "total_count" bigint)
    LANGUAGE "plpgsql" STABLE
    AS $$
declare
  v_tsq tsquery;
begin
  -- 1. Construimos el query solo si hay texto
  v_tsq := public.build_asignaturas_prefix_tsquery(p_search);

  return query
  select
    a.id,
    a.plan_estudio_id,
    a.codigo,
    a.nombre,
    a.tipo,
    a.creditos,
    a.numero_ciclo,
    a.datos,
    a.contenido_tematico,
    a.estado,
    coalesce(ts_rank(a.search_vector, v_tsq), 0)::real as rank,
    count(*) OVER() as total_count -- 👈 Cuenta total ignorando el LIMIT
  from public.asignaturas a
  -- 2. JOINS para poder filtrar por la jerarquía superior
  left join public.planes_estudio p on a.plan_estudio_id = p.id
  left join public.carreras c on p.carrera_id = c.id
  where
    -- 3. Si no hay búsqueda, trae todo. Si hay búsqueda, usa el FTS
    (v_tsq is null or a.search_vector @@ v_tsq)
    -- 4. Filtros jerárquicos dinámicos
    and (p_plan_estudio_id is null or a.plan_estudio_id = p_plan_estudio_id)
    and (p_carrera_id is null or p.carrera_id = p_carrera_id)
    and (p_facultad_id is null or c.facultad_id = p_facultad_id)
  order by
    (case when v_tsq is not null then ts_rank(a.search_vector, v_tsq) else 0 end) desc,
    a.nombre asc
  limit p_limit
  offset p_offset;
end;
$$;


ALTER FUNCTION "public"."search_asignaturas"("p_search" "text", "p_facultad_id" "uuid", "p_carrera_id" "uuid", "p_plan_estudio_id" "uuid", "p_limit" integer, "p_offset" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_actualizado_en"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.actualizado_en = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."set_actualizado_en"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."suma_porcentajes"("jsonb") RETURNS numeric
    LANGUAGE "plpgsql" IMMUTABLE
    AS $_$
declare
    total numeric;
begin
    select coalesce(sum((elem->>'porcentaje')::numeric),0)
    into total
    from jsonb_array_elements($1) elem;

    return total;
end;
$_$;


ALTER FUNCTION "public"."suma_porcentajes"("jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."tipo_propiedad_json_schema"("p_prop" "jsonb") RETURNS "text"
    LANGUAGE "plpgsql" IMMUTABLE
    AS $$
DECLARE
  v_type jsonb;
  v_text text;
BEGIN
  IF jsonb_typeof(p_prop->'enum') = 'array' THEN
    RETURN 'string';
  END IF;

  v_type := p_prop->'type';

  IF jsonb_typeof(v_type) = 'string' THEN
    RETURN p_prop->>'type';
  END IF;

  IF jsonb_typeof(v_type) = 'array' THEN
    FOR v_text IN SELECT jsonb_array_elements_text(v_type)
    LOOP
      IF v_text IN ('integer', 'number', 'string', 'boolean', 'array', 'object') THEN
        RETURN v_text;
      END IF;
    END LOOP;
  END IF;

  RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."tipo_propiedad_json_schema"("p_prop" "jsonb") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."estados_plan" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "clave" "text" NOT NULL,
    "etiqueta" "text" NOT NULL,
    "orden" integer DEFAULT 0 NOT NULL,
    "es_final" boolean DEFAULT false NOT NULL,
    "color" "text",
    "es_campo_editable" boolean DEFAULT true NOT NULL
);


ALTER TABLE "public"."estados_plan" OWNER TO "postgres";


COMMENT ON COLUMN "public"."estados_plan"."es_campo_editable" IS 'Indica si este estado puede aparecer como opcion en el selector de estados editables de campos restringidos.';



CREATE OR REPLACE FUNCTION "public"."transiciones_permitidas_plan"("p_plan_id" "uuid") RETURNS SETOF "public"."estados_plan"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT DISTINCT e.*
  FROM public.planes_estudio pe
  JOIN public.transiciones_estado_plan t ON t.desde_estado_id = pe.estado_actual_id
  JOIN public.estados_plan e ON e.id = t.hacia_estado_id
  JOIN public.roles r ON r.id = t.rol_permitido_id
  WHERE pe.id = p_plan_id
    AND public.usuario_puede_acceder_plan(auth.uid(), p_plan_id)
    AND (
      public.authz_is_admin()
      OR public.usuario_tiene_rol_contextual_plan(auth.uid(), p_plan_id, r.clave)
    )
  ORDER BY e.orden;
$$;


ALTER FUNCTION "public"."transiciones_permitidas_plan"("p_plan_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."unaccent_immutable"("text") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE STRICT PARALLEL SAFE
    AS $_$
  SELECT public.unaccent('public.unaccent', $1);
$_$;


ALTER FUNCTION "public"."unaccent_immutable"("text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."usuario_es_externo_asignado_plan"("p_usuario_id" "uuid", "p_plan_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT p_usuario_id IS NOT NULL
    AND public.usuario_tiene_rol_en_plan(p_usuario_id, p_plan_id, 'EVALUADOR_EXTERNO')
    AND EXISTS (
      SELECT 1
      FROM public.plan_expertos px
      JOIN public.expertos e ON e.id = px.experto_id
      WHERE px.plan_estudio_id = p_plan_id
        AND e.usuario_id = p_usuario_id
    );
$$;


ALTER FUNCTION "public"."usuario_es_externo_asignado_plan"("p_usuario_id" "uuid", "p_plan_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."usuario_es_jefe_encargado_plan"("p_usuario_id" "uuid", "p_plan_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT p_usuario_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.planes_estudio pe
      JOIN public.usuarios_roles ur ON ur.carrera_id = pe.carrera_id
      JOIN public.roles r ON r.id = ur.rol_id
      JOIN public.usuarios_app ua ON ua.id = ur.usuario_id
      WHERE pe.id = p_plan_id
        AND ur.usuario_id = p_usuario_id
        AND ua.dado_de_baja_en IS NULL
        AND r.clave = 'JEFE_CARRERA'
    );
$$;


ALTER FUNCTION "public"."usuario_es_jefe_encargado_plan"("p_usuario_id" "uuid", "p_plan_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."usuario_puede_acceder_plan"("p_usuario_id" "uuid", "p_plan_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT p_usuario_id IS NOT NULL
    AND (
      EXISTS (
        SELECT 1
        FROM public.planes_estudio pe
        JOIN public.carreras c ON c.id = pe.carrera_id
        JOIN public.usuarios_roles ur ON ur.usuario_id = p_usuario_id
        JOIN public.roles r ON r.id = ur.rol_id
        JOIN public.usuarios_app ua ON ua.id = ur.usuario_id
        WHERE pe.id = p_plan_id
          AND ua.dado_de_baja_en IS NULL
          AND (
            r.clave = 'ADMIN'
            OR (ur.facultad_id IS NULL AND ur.carrera_id IS NULL AND r.alcance_default = 'global')
            OR ur.carrera_id = pe.carrera_id
            OR ur.facultad_id = c.facultad_id
          )
      )
      OR EXISTS (
        SELECT 1
        FROM public.plan_expertos px
        JOIN public.expertos e ON e.id = px.experto_id
        WHERE px.plan_estudio_id = p_plan_id
          AND e.usuario_id = p_usuario_id
      )
    );
$$;


ALTER FUNCTION "public"."usuario_puede_acceder_plan"("p_usuario_id" "uuid", "p_plan_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."usuario_puede_comentar_asignatura"("p_usuario_id" "uuid", "p_asignatura_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.asignaturas a
    WHERE a.id = p_asignatura_id
      AND public.usuario_puede_comentar_plan(p_usuario_id, a.plan_estudio_id)
  );
$$;


ALTER FUNCTION "public"."usuario_puede_comentar_asignatura"("p_usuario_id" "uuid", "p_asignatura_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."usuario_puede_comentar_plan"("p_usuario_id" "uuid", "p_plan_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  WITH estado AS (
    SELECT public.plan_estado_clave(p_plan_id) AS clave
  )
  SELECT public.usuario_puede_acceder_plan(p_usuario_id, p_plan_id)
    AND (
      public.usuario_tiene_rol_en_plan(p_usuario_id, p_plan_id, 'ADMIN')
      OR ((SELECT clave FROM estado) = 'BORRADOR'
        AND (
          public.usuario_es_jefe_encargado_plan(p_usuario_id, p_plan_id)
          OR public.usuario_tiene_rol_en_plan(p_usuario_id, p_plan_id, 'SECRETARIO_ACADEMICO')
        ))
      OR ((SELECT clave FROM estado) = 'REVISION'
        AND (
          public.usuario_es_jefe_encargado_plan(p_usuario_id, p_plan_id)
          OR public.usuario_tiene_rol_en_plan(p_usuario_id, p_plan_id, 'SECRETARIO_ACADEMICO')
          OR public.usuario_tiene_rol_en_plan(p_usuario_id, p_plan_id, 'DIRECTOR_FACULTAD')
        ))
      OR ((SELECT clave FROM estado) = 'REV_PLANEACION'
        AND public.usuario_tiene_rol_en_plan(p_usuario_id, p_plan_id, 'PLANEACION_CURRICULAR'))
      OR ((SELECT clave FROM estado) IN ('CONSULTA_EXPERTOS', 'REV_SEDES')
        AND (
          public.usuario_tiene_rol_en_plan(p_usuario_id, p_plan_id, 'DIRECTOR_FACULTAD')
          OR public.usuario_tiene_rol_en_plan(p_usuario_id, p_plan_id, 'SECRETARIO_ACADEMICO')
          OR public.usuario_es_externo_asignado_plan(p_usuario_id, p_plan_id)
        ))
      OR ((SELECT clave FROM estado) = 'CONSEJO_FACULTAD'
        AND (
          public.usuario_tiene_rol_en_plan(p_usuario_id, p_plan_id, 'DIRECTOR_FACULTAD')
          OR public.usuario_tiene_rol_en_plan(p_usuario_id, p_plan_id, 'SECRETARIO_ACADEMICO')
          OR public.usuario_tiene_rol_en_plan(p_usuario_id, p_plan_id, 'VICERRECTOR_ACADEMICO')
        ))
      OR ((SELECT clave FROM estado) IN ('CONSEJO_UNIVERSITARIO', 'JUNTA_GOBIERNO')
        AND (
          public.usuario_tiene_rol_en_plan(p_usuario_id, p_plan_id, 'VICERRECTOR_ACADEMICO')
          OR public.usuario_tiene_rol_en_plan(p_usuario_id, p_plan_id, 'DIRECTOR_FACULTAD')
          OR public.usuario_tiene_rol_en_plan(p_usuario_id, p_plan_id, 'SECRETARIO_ACADEMICO')
        ))
      OR ((SELECT clave FROM estado) IN ('ENVIADO_SEP', 'APROBADO', 'RECHAZADO')
        AND (
          public.usuario_tiene_rol_en_plan(p_usuario_id, p_plan_id, 'PLANEACION_CURRICULAR')
          OR public.usuario_tiene_rol_en_plan(p_usuario_id, p_plan_id, 'VICERRECTOR_ACADEMICO')
          OR public.usuario_tiene_rol_en_plan(p_usuario_id, p_plan_id, 'DIRECTOR_FACULTAD')
          OR public.usuario_tiene_rol_en_plan(p_usuario_id, p_plan_id, 'SECRETARIO_ACADEMICO')
        ))
    );
$$;


ALTER FUNCTION "public"."usuario_puede_comentar_plan"("p_usuario_id" "uuid", "p_plan_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."usuario_puede_editar_asignatura"("p_usuario_id" "uuid", "p_asignatura_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.asignaturas a
    WHERE a.id = p_asignatura_id
      AND public.usuario_puede_editar_plan(p_usuario_id, a.plan_estudio_id)
  );
$$;


ALTER FUNCTION "public"."usuario_puede_editar_asignatura"("p_usuario_id" "uuid", "p_asignatura_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."usuario_puede_editar_campo_asignatura"("p_usuario_id" "uuid", "p_asignatura_id" "uuid", "p_clave" "text") RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_plan_id uuid;
  v_prop jsonb;
  v_estado text;
  v_estados text[];
BEGIN
  SELECT a.plan_estudio_id, ea.definicion->'properties'->p_clave
  INTO v_plan_id, v_prop
  FROM public.asignaturas a
  JOIN public.estructuras_asignatura ea ON ea.id = a.estructura_id
  WHERE a.id = p_asignatura_id;

  IF v_plan_id IS NULL OR v_prop IS NULL THEN
    RETURN false;
  END IF;

  IF NOT public.propiedad_tiene_restriccion(v_prop) THEN
    RETURN public.usuario_puede_editar_asignatura(p_usuario_id, p_asignatura_id);
  END IF;

  v_estado := public.plan_estado_clave(v_plan_id);
  v_estados := public.propiedad_restriccion_estados(v_prop);

  RETURN public.usuario_puede_editar_plan(p_usuario_id, v_plan_id)
    AND COALESCE(v_estado = ANY(v_estados), false);
END;
$$;


ALTER FUNCTION "public"."usuario_puede_editar_campo_asignatura"("p_usuario_id" "uuid", "p_asignatura_id" "uuid", "p_clave" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."usuario_puede_editar_campo_plan"("p_usuario_id" "uuid", "p_plan_id" "uuid", "p_clave" "text") RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_prop jsonb;
  v_estado text;
  v_estados text[];
BEGIN
  SELECT ep.definicion->'properties'->p_clave, public.plan_estado_clave(pe.id)
  INTO v_prop, v_estado
  FROM public.planes_estudio pe
  JOIN public.estructuras_plan ep ON ep.id = pe.estructura_id
  WHERE pe.id = p_plan_id;

  IF v_prop IS NULL THEN
    RETURN false;
  END IF;

  IF NOT public.propiedad_tiene_restriccion(v_prop) THEN
    RETURN public.usuario_puede_editar_plan(p_usuario_id, p_plan_id);
  END IF;

  v_estados := public.propiedad_restriccion_estados(v_prop);

  RETURN public.usuario_puede_editar_plan(p_usuario_id, p_plan_id)
    AND COALESCE(v_estado = ANY(v_estados), false);
END;
$$;


ALTER FUNCTION "public"."usuario_puede_editar_campo_plan"("p_usuario_id" "uuid", "p_plan_id" "uuid", "p_clave" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."usuario_puede_editar_plan"("p_usuario_id" "uuid", "p_plan_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  WITH estado AS (
    SELECT public.plan_estado_clave(p_plan_id) AS clave
  )
  SELECT public.usuario_puede_acceder_plan(p_usuario_id, p_plan_id)
    AND (
      ((SELECT clave FROM estado) IN ('BORRADOR', 'REVISION')
        AND public.usuario_tiene_rol_en_plan(p_usuario_id, p_plan_id, 'ADMIN'))
      OR ((SELECT clave FROM estado) = 'BORRADOR'
        AND public.usuario_es_jefe_encargado_plan(p_usuario_id, p_plan_id))
      OR ((SELECT clave FROM estado) IN ('BORRADOR', 'REVISION')
        AND public.usuario_tiene_rol_en_plan(p_usuario_id, p_plan_id, 'SECRETARIO_ACADEMICO'))
    );
$$;


ALTER FUNCTION "public"."usuario_puede_editar_plan"("p_usuario_id" "uuid", "p_plan_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."usuario_puede_transicionar_asignatura"("p_usuario_id" "uuid", "p_asignatura_id" "uuid", "p_nuevo_estado" "public"."estado_asignatura") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  WITH a AS (
    SELECT estado FROM public.asignaturas WHERE id = p_asignatura_id
  )
  SELECT public.usuario_puede_editar_asignatura(p_usuario_id, p_asignatura_id)
    AND CASE
      WHEN p_nuevo_estado = 'revisada' THEN (SELECT estado FROM a) = 'borrador'
      WHEN p_nuevo_estado = 'aprobada' THEN (SELECT estado FROM a) = 'revisada'
      WHEN p_nuevo_estado = 'borrador' THEN (SELECT estado FROM a) IN ('revisada', 'aprobada')
      ELSE false
    END;
$$;


ALTER FUNCTION "public"."usuario_puede_transicionar_asignatura"("p_usuario_id" "uuid", "p_asignatura_id" "uuid", "p_nuevo_estado" "public"."estado_asignatura") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."usuario_puede_transicionar_plan"("p_usuario_id" "uuid", "p_plan_id" "uuid", "p_hacia_estado_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT public.usuario_puede_acceder_plan(p_usuario_id, p_plan_id)
    AND (
      public.usuario_tiene_rol_en_plan(p_usuario_id, p_plan_id, 'ADMIN')
      OR EXISTS (
        SELECT 1
        FROM public.transiciones_estado_plan t
        JOIN public.planes_estudio pe ON pe.id = p_plan_id
        JOIN public.roles r ON r.id = t.rol_permitido_id
        WHERE t.desde_estado_id = pe.estado_actual_id
          AND t.hacia_estado_id = p_hacia_estado_id
          AND public.usuario_tiene_rol_contextual_plan(p_usuario_id, p_plan_id, r.clave)
      )
    );
$$;


ALTER FUNCTION "public"."usuario_puede_transicionar_plan"("p_usuario_id" "uuid", "p_plan_id" "uuid", "p_hacia_estado_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."usuario_puede_usar_ia_asignatura"("p_usuario_id" "uuid", "p_asignatura_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.asignaturas a
    WHERE a.id = p_asignatura_id
      AND public.usuario_puede_usar_ia_plan(p_usuario_id, a.plan_estudio_id)
  );
$$;


ALTER FUNCTION "public"."usuario_puede_usar_ia_asignatura"("p_usuario_id" "uuid", "p_asignatura_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."usuario_puede_usar_ia_plan"("p_usuario_id" "uuid", "p_plan_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT public.usuario_puede_editar_plan(p_usuario_id, p_plan_id)
    AND public.usuario_tiene_permiso(p_usuario_id, 'ia.usar')
    AND public.plan_estado_clave(p_plan_id) IN ('BORRADOR', 'REVISION');
$$;


ALTER FUNCTION "public"."usuario_puede_usar_ia_plan"("p_usuario_id" "uuid", "p_plan_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."usuario_tiene_permiso"("p_usuario_id" "uuid", "p_permiso" "text") RETURNS boolean
    LANGUAGE "sql" STABLE
    AS $$
  SELECT private.authz_user_has_permission(p_usuario_id, p_permiso);
$$;


ALTER FUNCTION "public"."usuario_tiene_permiso"("p_usuario_id" "uuid", "p_permiso" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."usuario_tiene_rol_contextual_plan"("p_usuario_id" "uuid", "p_plan_id" "uuid", "p_rol" "text") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT CASE
    WHEN p_rol = 'JEFE_CARRERA' THEN public.usuario_es_jefe_encargado_plan(p_usuario_id, p_plan_id)
    ELSE public.usuario_tiene_rol_en_plan(p_usuario_id, p_plan_id, p_rol)
  END;
$$;


ALTER FUNCTION "public"."usuario_tiene_rol_contextual_plan"("p_usuario_id" "uuid", "p_plan_id" "uuid", "p_rol" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."usuario_tiene_rol_en_plan"("p_usuario_id" "uuid", "p_plan_id" "uuid", "p_rol" "text") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT p_usuario_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.planes_estudio pe
      JOIN public.carreras c ON c.id = pe.carrera_id
      JOIN public.usuarios_roles ur ON ur.usuario_id = p_usuario_id
      JOIN public.roles r ON r.id = ur.rol_id
      JOIN public.usuarios_app ua ON ua.id = ur.usuario_id
      WHERE pe.id = p_plan_id
        AND ua.dado_de_baja_en IS NULL
        AND r.clave = p_rol
        AND (
          r.clave = 'ADMIN'
          OR (ur.facultad_id IS NULL AND ur.carrera_id IS NULL AND r.alcance_default = 'global')
          OR ur.carrera_id = pe.carrera_id
          OR ur.facultad_id = c.facultad_id
        )
    );
$$;


ALTER FUNCTION "public"."usuario_tiene_rol_en_plan"("p_usuario_id" "uuid", "p_plan_id" "uuid", "p_rol" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validar_numero_ciclo_asignatura"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
declare
  v_numero_ciclos int;
begin
  if new.numero_ciclo is null then
    return new;
  end if;

  select pe.numero_ciclos into v_numero_ciclos
  from planes_estudio pe
  where pe.id = new.plan_estudio_id;

  if v_numero_ciclos is null then
    raise exception 'plan_estudio_id inválido %, plan no encontrado', new.plan_estudio_id;
  end if;

  if new.numero_ciclo < 1 then
    raise exception 'numero_ciclo debe ser >= 1 (recibido %)', new.numero_ciclo;
  end if;

  if new.numero_ciclo > v_numero_ciclos then
    raise exception 'numero_ciclo % excede planes_estudio.numero_ciclos % para plan_estudio_id %',
      new.numero_ciclo, v_numero_ciclos, new.plan_estudio_id;
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."validar_numero_ciclo_asignatura"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validar_prerrequisito_asignatura"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
declare
  v_plan uuid;
  v_ciclo integer;
begin

  if new.prerrequisito_asignatura_id is null then
    return new;
  end if;

  select
    plan_estudio_id,
    numero_ciclo
  into
    v_plan,
    v_ciclo
  from public.asignaturas
  where id = new.prerrequisito_asignatura_id;

  if not found then
    raise exception
      'La asignatura prerrequisito no existe';
  end if;

  if v_plan <> new.plan_estudio_id then
    raise exception
      'El prerrequisito debe pertenecer al mismo plan de estudio';
  end if;

  if new.numero_ciclo is null then
    raise exception
      'La asignatura debe tener numero_ciclo definido';
  end if;

  if v_ciclo is null then
    raise exception
      'El prerrequisito debe tener numero_ciclo definido';
  end if;

  if v_ciclo >= new.numero_ciclo then
    raise exception
      'El prerrequisito debe pertenecer a un ciclo menor';
  end if;

  return new;

end;
$$;


ALTER FUNCTION "public"."validar_prerrequisito_asignatura"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."valor_jsonb_vacio"("p_value" "jsonb") RETURNS boolean
    LANGUAGE "sql" IMMUTABLE
    AS $$
  SELECT p_value IS NULL
    OR p_value = 'null'::jsonb
    OR (
      jsonb_typeof(p_value) = 'string'
      AND btrim(p_value #>> '{}') = ''
    )
    OR (
      jsonb_typeof(p_value) = 'array'
      AND jsonb_array_length(p_value) = 0
    )
    OR (
      jsonb_typeof(p_value) = 'object'
      AND p_value = '{}'::jsonb
    );
$$;


ALTER FUNCTION "public"."valor_jsonb_vacio"("p_value" "jsonb") OWNER TO "postgres";


CREATE TEXT SEARCH CONFIGURATION "public"."es_simple_unaccent" (
    PARSER = "pg_catalog"."default" );

ALTER TEXT SEARCH CONFIGURATION "public"."es_simple_unaccent"
    ADD MAPPING FOR "asciiword" WITH "simple";

ALTER TEXT SEARCH CONFIGURATION "public"."es_simple_unaccent"
    ADD MAPPING FOR "word" WITH "public"."unaccent", "simple";

ALTER TEXT SEARCH CONFIGURATION "public"."es_simple_unaccent"
    ADD MAPPING FOR "numword" WITH "simple";

ALTER TEXT SEARCH CONFIGURATION "public"."es_simple_unaccent"
    ADD MAPPING FOR "email" WITH "simple";

ALTER TEXT SEARCH CONFIGURATION "public"."es_simple_unaccent"
    ADD MAPPING FOR "url" WITH "simple";

ALTER TEXT SEARCH CONFIGURATION "public"."es_simple_unaccent"
    ADD MAPPING FOR "host" WITH "simple";

ALTER TEXT SEARCH CONFIGURATION "public"."es_simple_unaccent"
    ADD MAPPING FOR "sfloat" WITH "simple";

ALTER TEXT SEARCH CONFIGURATION "public"."es_simple_unaccent"
    ADD MAPPING FOR "version" WITH "simple";

ALTER TEXT SEARCH CONFIGURATION "public"."es_simple_unaccent"
    ADD MAPPING FOR "hword_numpart" WITH "simple";

ALTER TEXT SEARCH CONFIGURATION "public"."es_simple_unaccent"
    ADD MAPPING FOR "hword_part" WITH "public"."unaccent", "simple";

ALTER TEXT SEARCH CONFIGURATION "public"."es_simple_unaccent"
    ADD MAPPING FOR "hword_asciipart" WITH "simple";

ALTER TEXT SEARCH CONFIGURATION "public"."es_simple_unaccent"
    ADD MAPPING FOR "numhword" WITH "simple";

ALTER TEXT SEARCH CONFIGURATION "public"."es_simple_unaccent"
    ADD MAPPING FOR "asciihword" WITH "simple";

ALTER TEXT SEARCH CONFIGURATION "public"."es_simple_unaccent"
    ADD MAPPING FOR "hword" WITH "public"."unaccent", "simple";

ALTER TEXT SEARCH CONFIGURATION "public"."es_simple_unaccent"
    ADD MAPPING FOR "url_path" WITH "simple";

ALTER TEXT SEARCH CONFIGURATION "public"."es_simple_unaccent"
    ADD MAPPING FOR "file" WITH "simple";

ALTER TEXT SEARCH CONFIGURATION "public"."es_simple_unaccent"
    ADD MAPPING FOR "float" WITH "simple";

ALTER TEXT SEARCH CONFIGURATION "public"."es_simple_unaccent"
    ADD MAPPING FOR "int" WITH "simple";

ALTER TEXT SEARCH CONFIGURATION "public"."es_simple_unaccent"
    ADD MAPPING FOR "uint" WITH "simple";


ALTER TEXT SEARCH CONFIGURATION "public"."es_simple_unaccent" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."archivos" (
    "id" "uuid" NOT NULL,
    "openai_file_id" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "hash" "text",
    "path" "text" NOT NULL,
    "size" integer,
    "creado_por" "uuid"
);


ALTER TABLE "public"."archivos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."archivos_repositorios" (
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "archivo_id" "uuid" NOT NULL,
    "repositorio_id" "uuid" NOT NULL
);


ALTER TABLE "public"."archivos_repositorios" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."asignatura_mensajes_ia" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "enviado_por" "uuid" DEFAULT "auth"."uid"() NOT NULL,
    "mensaje" "text" NOT NULL,
    "campos" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "respuesta" "text",
    "is_refusal" boolean DEFAULT false NOT NULL,
    "propuesta" "jsonb",
    "estado" "public"."estado_mensaje_ia" DEFAULT 'PROCESANDO'::"public"."estado_mensaje_ia" NOT NULL,
    "fecha_creacion" timestamp without time zone DEFAULT "now"() NOT NULL,
    "fecha_actualizacion" timestamp without time zone DEFAULT "now"() NOT NULL,
    "conversacion_asignatura_id" "uuid" NOT NULL,
    "openai_response_id" "text"
);


ALTER TABLE "public"."asignatura_mensajes_ia" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."asignaturas" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "plan_estudio_id" "uuid" NOT NULL,
    "estructura_id" "uuid" NOT NULL,
    "codigo" "text",
    "nombre" "text" NOT NULL,
    "tipo" "public"."tipo_asignatura" DEFAULT 'OBLIGATORIA'::"public"."tipo_asignatura" NOT NULL,
    "numero_ciclo" integer,
    "linea_plan_id" "uuid",
    "orden_celda" integer,
    "datos" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "contenido_tematico" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "tipo_origen" "public"."tipo_origen",
    "meta_origen" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "creado_por" "uuid",
    "actualizado_por" "uuid",
    "creado_en" timestamp with time zone DEFAULT "now"() NOT NULL,
    "actualizado_en" timestamp with time zone DEFAULT "now"() NOT NULL,
    "horas_academicas" integer,
    "horas_independientes" integer,
    "asignatura_hash" "text" GENERATED ALWAYS AS ("encode"(SUBSTRING("extensions"."digest"(("id")::"text", 'sha512'::"text") FROM 1 FOR 12), 'hex'::"text")) STORED,
    "estado" "public"."estado_asignatura" DEFAULT 'borrador'::"public"."estado_asignatura" NOT NULL,
    "criterios_de_evaluacion" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "prerrequisito_asignatura_id" "uuid",
    "search_vector" "tsvector",
    "creditos" numeric GENERATED ALWAYS AS (("floor"(((((COALESCE("horas_academicas", 0) + COALESCE("horas_independientes", 0)))::numeric / (16)::numeric) * (100)::numeric)) / (100)::numeric)) STORED,
    CONSTRAINT "asignaturas_ciclo_chk" CHECK ((("numero_ciclo" IS NULL) OR ("numero_ciclo" > 0))),
    CONSTRAINT "asignaturas_criterios_porcentaje_max_100" CHECK (("public"."suma_porcentajes"("criterios_de_evaluacion") <= (100)::numeric)),
    CONSTRAINT "asignaturas_horas_academicas_check" CHECK ((("horas_academicas" IS NULL) OR ("horas_academicas" >= 0))),
    CONSTRAINT "asignaturas_horas_independientes_check" CHECK ((("horas_independientes" IS NULL) OR ("horas_independientes" >= 0))),
    CONSTRAINT "asignaturas_orden_celda_chk" CHECK ((("orden_celda" IS NULL) OR ("orden_celda" >= 0))),
    CONSTRAINT "asignaturas_prerrequisito_self_check" CHECK ((("prerrequisito_asignatura_id" IS NULL) OR ("prerrequisito_asignatura_id" <> "id")))
);


ALTER TABLE "public"."asignaturas" OWNER TO "postgres";


COMMENT ON COLUMN "public"."asignaturas"."creditos" IS 'Calculado automáticamente: trunc((horas_academicas + horas_independientes) / 16, 2). No editable.';



CREATE TABLE IF NOT EXISTS "public"."bibliografia_asignatura" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "asignatura_id" "uuid" NOT NULL,
    "tipo" "public"."tipo_bibliografia" NOT NULL,
    "cita" "text" NOT NULL,
    "creado_por" "uuid",
    "creado_en" timestamp with time zone DEFAULT "now"() NOT NULL,
    "actualizado_en" timestamp with time zone DEFAULT "now"() NOT NULL,
    "referencia_biblioteca" "text",
    "referencia_en_linea" "text",
    "titulo" "text",
    "autores" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "editorial" "text",
    "anio" integer,
    "isbn" "text",
    "formato" "text"
);


ALTER TABLE "public"."bibliografia_asignatura" OWNER TO "postgres";


COMMENT ON COLUMN "public"."bibliografia_asignatura"."titulo" IS 'Título del libro/recurso (dato estructurado, fuente para regenerar la cita).';



COMMENT ON COLUMN "public"."bibliografia_asignatura"."autores" IS 'Arreglo JSON de autores, p. ej. ["Stewart, James"].';



COMMENT ON COLUMN "public"."bibliografia_asignatura"."editorial" IS 'Editorial del recurso.';



COMMENT ON COLUMN "public"."bibliografia_asignatura"."anio" IS 'Año de publicación.';



COMMENT ON COLUMN "public"."bibliografia_asignatura"."isbn" IS 'ISBN del recurso, si está disponible.';



COMMENT ON COLUMN "public"."bibliografia_asignatura"."formato" IS 'Formato usado para generar `cita` (apa, ieee, chicago, vancouver, manual).';



CREATE TABLE IF NOT EXISTS "public"."borradores_campo" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "entidad" "text" NOT NULL,
    "entidad_id" "uuid" NOT NULL,
    "plan_id" "uuid" NOT NULL,
    "clave" "text" NOT NULL,
    "contenido_html" "text" DEFAULT ''::"text" NOT NULL,
    "creado_por" "uuid",
    "actualizado_por" "uuid",
    "creado_en" timestamp with time zone DEFAULT "now"() NOT NULL,
    "actualizado_en" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "borradores_campo_entidad_check" CHECK (("entidad" = ANY (ARRAY['plan'::"text", 'asignatura'::"text"])))
);


ALTER TABLE "public"."borradores_campo" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."cambios_asignatura" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "asignatura_id" "uuid" NOT NULL,
    "cambiado_por" "uuid",
    "cambiado_en" timestamp with time zone DEFAULT "now"() NOT NULL,
    "tipo" "public"."tipo_cambio" NOT NULL,
    "campo" "text",
    "valor_anterior" "jsonb",
    "valor_nuevo" "jsonb",
    "fuente" "public"."fuente_cambio",
    "interaccion_ia_id" "uuid",
    "admin_override" boolean DEFAULT false NOT NULL,
    "admin_override_motivo" "text",
    "admin_override_estado_clave" "text"
);


ALTER TABLE "public"."cambios_asignatura" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."cambios_plan" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "plan_estudio_id" "uuid" NOT NULL,
    "cambiado_por" "uuid",
    "cambiado_en" timestamp with time zone DEFAULT "now"() NOT NULL,
    "tipo" "public"."tipo_cambio" NOT NULL,
    "campo" "text",
    "valor_anterior" "jsonb",
    "valor_nuevo" "jsonb",
    "response_id" "text",
    "admin_override" boolean DEFAULT false NOT NULL,
    "admin_override_motivo" "text",
    "admin_override_estado_clave" "text"
);


ALTER TABLE "public"."cambios_plan" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."carreras" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "facultad_id" "uuid" NOT NULL,
    "nombre" "text" NOT NULL,
    "nombre_corto" "text",
    "clave_sep" "text",
    "activa" boolean DEFAULT true NOT NULL,
    "creado_en" timestamp with time zone DEFAULT "now"() NOT NULL,
    "actualizado_en" timestamp with time zone DEFAULT "now"() NOT NULL,
    "nivel" "public"."nivel_plan_estudio" DEFAULT 'Otro'::"public"."nivel_plan_estudio" NOT NULL,
    "creado_por" "uuid",
    "actualizado_por" "uuid"
);


ALTER TABLE "public"."carreras" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."comentarios_asignatura" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "asignatura_id" "uuid" NOT NULL,
    "comentario_padre_id" "uuid",
    "autor_id" "uuid",
    "categoria" "text" DEFAULT 'INTERNO'::"text" NOT NULL,
    "cuerpo" "text" NOT NULL,
    "resuelto" boolean DEFAULT false NOT NULL,
    "creado_en" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "comentarios_asignatura_categoria_chk" CHECK (("categoria" = ANY (ARRAY['INTERNO'::"text", 'EXPERTO'::"text", 'SEDE'::"text"])))
);


ALTER TABLE "public"."comentarios_asignatura" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."comentarios_plan" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "plan_estudio_id" "uuid" NOT NULL,
    "estado_id" "uuid",
    "comentario_padre_id" "uuid",
    "autor_id" "uuid",
    "categoria" "text" DEFAULT 'INTERNO'::"text" NOT NULL,
    "cuerpo" "text" NOT NULL,
    "resuelto" boolean DEFAULT false NOT NULL,
    "creado_en" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "comentarios_plan_categoria_chk" CHECK (("categoria" = ANY (ARRAY['INTERNO'::"text", 'EXPERTO'::"text", 'SEDE'::"text"])))
);


ALTER TABLE "public"."comentarios_plan" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."conversaciones_asignatura" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "asignatura_id" "uuid" NOT NULL,
    "openai_conversation_id" "text" NOT NULL,
    "estado" "public"."estado_conversacion" DEFAULT 'ACTIVA'::"public"."estado_conversacion" NOT NULL,
    "conversacion_json" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "creado_por" "uuid",
    "creado_en" timestamp with time zone DEFAULT "now"() NOT NULL,
    "archivado_por" "uuid",
    "archivado_en" timestamp with time zone,
    "intento_archivado" integer DEFAULT 0 NOT NULL,
    "nombre" "text" DEFAULT ('Chat '::"text" || CURRENT_DATE)
);


ALTER TABLE "public"."conversaciones_asignatura" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."conversaciones_plan" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "plan_estudio_id" "uuid" NOT NULL,
    "openai_conversation_id" "text" NOT NULL,
    "estado" "public"."estado_conversacion" DEFAULT 'ACTIVA'::"public"."estado_conversacion" NOT NULL,
    "conversacion_json" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "creado_por" "uuid",
    "creado_en" timestamp with time zone DEFAULT "now"() NOT NULL,
    "archivado_por" "uuid",
    "archivado_en" timestamp with time zone,
    "intento_archivado" integer DEFAULT 0 NOT NULL,
    "nombre" "text" DEFAULT ('Chat '::"text" || CURRENT_DATE)
);


ALTER TABLE "public"."conversaciones_plan" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."crash_reports" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "usuario_id" "uuid",
    "nombre" "text",
    "mensaje" "text" NOT NULL,
    "stack" "text",
    "component_stack" "text",
    "origen" "text" DEFAULT 'frontend'::"text" NOT NULL,
    "severidad" "text" DEFAULT 'error'::"text" NOT NULL,
    "url" "text",
    "ruta" "text",
    "user_agent" "text",
    "app_version" "text",
    "build_id" "text",
    "fingerprint" "text",
    "contexto" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "creado_en" timestamp with time zone DEFAULT "now"() NOT NULL,
    "resuelto_en" timestamp with time zone,
    "resuelto_por" "uuid",
    "notas" "text",
    CONSTRAINT "crash_reports_contexto_objeto_chk" CHECK (("jsonb_typeof"("contexto") = 'object'::"text")),
    CONSTRAINT "crash_reports_mensaje_not_blank_chk" CHECK (("length"("btrim"("mensaje")) > 0)),
    CONSTRAINT "crash_reports_severidad_chk" CHECK (("severidad" = ANY (ARRAY['info'::"text", 'warning'::"text", 'error'::"text", 'fatal'::"text"])))
);


ALTER TABLE "public"."crash_reports" OWNER TO "postgres";


COMMENT ON TABLE "public"."crash_reports" IS 'Reportes de errores capturados en el frontend para diagnosticar fallas de UI, rutas y promesas no manejadas.';



COMMENT ON COLUMN "public"."crash_reports"."fingerprint" IS 'Huella calculada por el cliente para agrupar errores equivalentes sin depender del stack completo.';



CREATE TABLE IF NOT EXISTS "public"."expertos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "usuario_id" "uuid",
    "nombre" "text" NOT NULL,
    "institucion" "text",
    "contacto" "text",
    "tipo" "text" DEFAULT 'EXPERTO'::"text" NOT NULL,
    "creado_por" "uuid",
    "creado_en" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "expertos_tipo_chk" CHECK (("tipo" = ANY (ARRAY['EXPERTO'::"text", 'SEDE_HERMANA'::"text"])))
);


ALTER TABLE "public"."expertos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."facultades" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "nombre" "text" NOT NULL,
    "nombre_corto" "text",
    "color" "text",
    "icono" "text",
    "creado_en" timestamp with time zone DEFAULT "now"() NOT NULL,
    "actualizado_en" timestamp with time zone DEFAULT "now"() NOT NULL,
    "activa" boolean DEFAULT true NOT NULL,
    "prefijo" "text",
    "creado_por" "uuid",
    "actualizado_por" "uuid"
);


ALTER TABLE "public"."facultades" OWNER TO "postgres";


COMMENT ON COLUMN "public"."facultades"."activa" IS 'Logical delete flag for faculties.';



COMMENT ON COLUMN "public"."facultades"."prefijo" IS 'Prefijo institucional opcional. Ej: "Mexicana" genera "Facultad Mexicana de <nombre>"';



CREATE TABLE IF NOT EXISTS "public"."interacciones_ia" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "usuario_id" "uuid",
    "plan_estudio_id" "uuid",
    "asignatura_id" "uuid",
    "tipo" "public"."tipo_interaccion_ia" NOT NULL,
    "modelo" "text",
    "temperatura" numeric,
    "prompt" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "respuesta" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "aceptada" boolean DEFAULT false NOT NULL,
    "conversacion_id" "text",
    "ids_archivos" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "ids_vector_store" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "creado_en" timestamp with time zone DEFAULT "now"() NOT NULL,
    "rutas_storage" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL
);


ALTER TABLE "public"."interacciones_ia" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."lineas_curriculares_sugeridas" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "facultad_id" "uuid" NOT NULL,
    "nombre" "text" NOT NULL,
    "area" "text",
    "color" "text",
    "orden" integer DEFAULT 0 NOT NULL,
    "activa" boolean DEFAULT true NOT NULL,
    "creado_en" timestamp with time zone DEFAULT "now"() NOT NULL,
    "actualizado_en" timestamp with time zone DEFAULT "now"() NOT NULL,
    "creado_por" "uuid",
    "actualizado_por" "uuid"
);


ALTER TABLE "public"."lineas_curriculares_sugeridas" OWNER TO "postgres";


COMMENT ON TABLE "public"."lineas_curriculares_sugeridas" IS 'Líneas curriculares sugeridas por facultad para asistir la creación de líneas de plan.';



CREATE TABLE IF NOT EXISTS "public"."lineas_plan" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "plan_estudio_id" "uuid" NOT NULL,
    "nombre" "text" NOT NULL,
    "orden" integer DEFAULT 0 NOT NULL,
    "area" "text",
    "creado_en" timestamp with time zone DEFAULT "now"() NOT NULL,
    "actualizado_en" timestamp with time zone DEFAULT "now"() NOT NULL,
    "color" "text",
    "creado_por" "uuid",
    "actualizado_por" "uuid"
);


ALTER TABLE "public"."lineas_plan" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notificaciones" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "usuario_id" "uuid" NOT NULL,
    "tipo" "public"."tipo_notificacion" NOT NULL,
    "payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "leida" boolean DEFAULT false NOT NULL,
    "creado_en" timestamp with time zone DEFAULT "now"() NOT NULL,
    "leida_en" timestamp with time zone
);


ALTER TABLE "public"."notificaciones" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."permisos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "clave" "text" NOT NULL,
    "nombre" "text" NOT NULL,
    "descripcion" "text",
    "grupo" "text" DEFAULT 'general'::"text" NOT NULL,
    "orden" integer DEFAULT 100 NOT NULL,
    "creado_en" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."permisos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."plan_expertos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "plan_estudio_id" "uuid" NOT NULL,
    "experto_id" "uuid" NOT NULL,
    "creado_en" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."plan_expertos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."plan_mensajes_ia" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "enviado_por" "uuid" DEFAULT "auth"."uid"() NOT NULL,
    "mensaje" "text" NOT NULL,
    "campos" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "respuesta" "text",
    "is_refusal" boolean DEFAULT false NOT NULL,
    "propuesta" "jsonb",
    "estado" "public"."estado_mensaje_ia" DEFAULT 'PROCESANDO'::"public"."estado_mensaje_ia" NOT NULL,
    "fecha_creacion" timestamp without time zone DEFAULT "now"() NOT NULL,
    "fecha_actualizacion" timestamp without time zone DEFAULT "now"() NOT NULL,
    "conversacion_plan_id" "uuid" NOT NULL,
    "openai_response_id" "text"
);


ALTER TABLE "public"."plan_mensajes_ia" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."planes_estudio" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "carrera_id" "uuid" NOT NULL,
    "estructura_id" "uuid" NOT NULL,
    "nombre" "text" NOT NULL,
    "tipo_ciclo" "public"."tipo_ciclo" NOT NULL,
    "numero_ciclos" integer NOT NULL,
    "datos" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "estado_actual_id" "uuid",
    "activo" boolean DEFAULT true NOT NULL,
    "tipo_origen" "public"."tipo_origen",
    "meta_origen" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "creado_por" "uuid",
    "actualizado_por" "uuid",
    "creado_en" timestamp with time zone DEFAULT "now"() NOT NULL,
    "actualizado_en" timestamp with time zone DEFAULT "now"() NOT NULL,
    "nombre_search" "text" GENERATED ALWAYS AS ("lower"("public"."unaccent_immutable"("nombre"))) STORED,
    "plan_hash" "text" GENERATED ALWAYS AS ("encode"(SUBSTRING("extensions"."digest"(("id")::"text", 'sha512'::"text") FROM 1 FOR 12), 'hex'::"text")) STORED,
    CONSTRAINT "planes_estudio_numero_ciclos_check" CHECK (("numero_ciclos" > 0))
);


ALTER TABLE "public"."planes_estudio" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."plantilla_asignatura" AS
 SELECT "asignaturas"."id" AS "asignatura_id",
    "struct"."id" AS "estructura_id",
    "struct"."template_id"
   FROM ("public"."asignaturas"
     JOIN "public"."estructuras_asignatura" "struct" ON (("asignaturas"."estructura_id" = "struct"."id")));


ALTER VIEW "public"."plantilla_asignatura" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."plantilla_plan" AS
 SELECT "plan"."id" AS "plan_estudio_id",
    "struct"."id" AS "estructura_id",
    "struct"."template_id"
   FROM ("public"."planes_estudio" "plan"
     JOIN "public"."estructuras_plan" "struct" ON (("plan"."estructura_id" = "struct"."id")));


ALTER VIEW "public"."plantilla_plan" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."reasignaciones" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "reasignado_por" "uuid",
    "usuario_origen" "uuid",
    "usuario_destino" "uuid",
    "detalle" "jsonb" NOT NULL,
    "creado_en" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."reasignaciones" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."repositorios" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "openai_vector_store_id" "text",
    "nombre" "text",
    "enviado_por" "uuid"
);


ALTER TABLE "public"."repositorios" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."responsables_asignatura" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "asignatura_id" "uuid" NOT NULL,
    "usuario_id" "uuid" NOT NULL,
    "rol" "public"."rol_responsable_asignatura" DEFAULT 'PROFESOR_RESPONSABLE'::"public"."rol_responsable_asignatura" NOT NULL,
    "creado_en" timestamp with time zone DEFAULT "now"() NOT NULL,
    "asignado_por" "uuid"
);


ALTER TABLE "public"."responsables_asignatura" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."roles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "clave" "text" NOT NULL,
    "nombre" "text" NOT NULL,
    "descripcion" "text",
    "nivel_jerarquico" integer DEFAULT 100 NOT NULL,
    "alcance_default" "text" DEFAULT 'carrera'::"text" NOT NULL,
    CONSTRAINT "roles_alcance_default_chk" CHECK (("alcance_default" = ANY (ARRAY['global'::"text", 'facultad'::"text", 'carrera'::"text", 'asignatura'::"text", 'externo'::"text"])))
);


ALTER TABLE "public"."roles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."roles_permisos" (
    "rol_id" "uuid" NOT NULL,
    "permiso_id" "uuid" NOT NULL,
    "creado_en" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."roles_permisos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tareas_revision" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "plan_estudio_id" "uuid" NOT NULL,
    "asignado_a" "uuid" NOT NULL,
    "rol_id" "uuid",
    "estado_id" "uuid",
    "estatus" "public"."estado_tarea_revision" DEFAULT 'PENDIENTE'::"public"."estado_tarea_revision" NOT NULL,
    "fecha_limite" "date",
    "creado_en" timestamp with time zone DEFAULT "now"() NOT NULL,
    "completado_en" timestamp with time zone,
    "creado_por" "uuid"
);


ALTER TABLE "public"."tareas_revision" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."transiciones_estado_plan" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "desde_estado_id" "uuid" NOT NULL,
    "hacia_estado_id" "uuid" NOT NULL,
    "rol_permitido_id" "uuid" NOT NULL,
    "creado_en" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "transiciones_no_auto_chk" CHECK (("desde_estado_id" <> "hacia_estado_id"))
);


ALTER TABLE "public"."transiciones_estado_plan" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."usuarios_app" (
    "id" "uuid" NOT NULL,
    "nombre_completo" "text",
    "creado_en" timestamp with time zone DEFAULT "now"() NOT NULL,
    "actualizado_en" timestamp with time zone DEFAULT "now"() NOT NULL,
    "dado_de_baja_en" timestamp with time zone,
    "clave" "text",
    "externo" boolean GENERATED ALWAYS AS (("clave" IS NULL)) STORED,
    "invitado_por" "uuid",
    CONSTRAINT "usuarios_app_clave_format" CHECK ((("clave" IS NULL) OR ("clave" ~ '^(ad|do)\d{6}$'::"text")))
);


ALTER TABLE "public"."usuarios_app" OWNER TO "postgres";


COMMENT ON COLUMN "public"."usuarios_app"."invitado_por" IS 'Usuario interno que creó/invitó esta cuenta. Se llena al alta (sobre todo de externos); NULL para registros previos o altas públicas.';



CREATE TABLE IF NOT EXISTS "public"."usuarios_roles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "usuario_id" "uuid" NOT NULL,
    "rol_id" "uuid" NOT NULL,
    "facultad_id" "uuid",
    "carrera_id" "uuid",
    "creado_en" timestamp with time zone DEFAULT "now"() NOT NULL,
    "asignado_por" "uuid",
    CONSTRAINT "usuarios_roles_alcance_chk" CHECK ((NOT (("facultad_id" IS NOT NULL) AND ("carrera_id" IS NOT NULL))))
);


ALTER TABLE "public"."usuarios_roles" OWNER TO "postgres";


ALTER TABLE ONLY "public"."archivos_repositorios"
    ADD CONSTRAINT "archivos_repositorios_pkey" PRIMARY KEY ("archivo_id", "repositorio_id");



ALTER TABLE ONLY "public"."archivos"
    ADD CONSTRAINT "archivos_usuarios_hash_key" UNIQUE ("hash");



ALTER TABLE ONLY "public"."archivos"
    ADD CONSTRAINT "archivos_usuarios_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."asignatura_mensajes_ia"
    ADD CONSTRAINT "asignatura_mensajes_ia_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."asignaturas"
    ADD CONSTRAINT "asignaturas_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bibliografia_asignatura"
    ADD CONSTRAINT "bibliografia_asignatura_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."borradores_campo"
    ADD CONSTRAINT "borradores_campo_entidad_entidad_id_clave_key" UNIQUE ("entidad", "entidad_id", "clave");



ALTER TABLE ONLY "public"."borradores_campo"
    ADD CONSTRAINT "borradores_campo_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cambios_asignatura"
    ADD CONSTRAINT "cambios_asignatura_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cambios_plan"
    ADD CONSTRAINT "cambios_plan_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."carreras"
    ADD CONSTRAINT "carreras_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."comentarios_asignatura"
    ADD CONSTRAINT "comentarios_asignatura_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."comentarios_plan"
    ADD CONSTRAINT "comentarios_plan_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."conversaciones_asignatura"
    ADD CONSTRAINT "conversaciones_asignatura_openai_id_unico" UNIQUE ("openai_conversation_id");



ALTER TABLE ONLY "public"."conversaciones_asignatura"
    ADD CONSTRAINT "conversaciones_asignatura_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."conversaciones_plan"
    ADD CONSTRAINT "conversaciones_plan_openai_id_unico" UNIQUE ("openai_conversation_id");



ALTER TABLE ONLY "public"."conversaciones_plan"
    ADD CONSTRAINT "conversaciones_plan_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."crash_reports"
    ADD CONSTRAINT "crash_reports_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."estados_plan"
    ADD CONSTRAINT "estados_plan_clave_key" UNIQUE ("clave");



ALTER TABLE ONLY "public"."estados_plan"
    ADD CONSTRAINT "estados_plan_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."estructuras_asignatura"
    ADD CONSTRAINT "estructuras_asignatura_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."estructuras_plan"
    ADD CONSTRAINT "estructuras_plan_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."expertos"
    ADD CONSTRAINT "expertos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."facultades"
    ADD CONSTRAINT "facultades_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."interacciones_ia"
    ADD CONSTRAINT "interacciones_ia_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."lineas_curriculares_sugeridas"
    ADD CONSTRAINT "lineas_curriculares_sugeridas_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."lineas_plan"
    ADD CONSTRAINT "lineas_plan_id_plan_unico" UNIQUE ("id", "plan_estudio_id");



ALTER TABLE ONLY "public"."lineas_plan"
    ADD CONSTRAINT "lineas_plan_nombre_unico" UNIQUE ("plan_estudio_id", "nombre");



ALTER TABLE ONLY "public"."lineas_plan"
    ADD CONSTRAINT "lineas_plan_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notificaciones"
    ADD CONSTRAINT "notificaciones_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."permisos"
    ADD CONSTRAINT "permisos_clave_key" UNIQUE ("clave");



ALTER TABLE ONLY "public"."permisos"
    ADD CONSTRAINT "permisos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."plan_expertos"
    ADD CONSTRAINT "plan_expertos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."plan_expertos"
    ADD CONSTRAINT "plan_expertos_unico" UNIQUE ("plan_estudio_id", "experto_id");



ALTER TABLE ONLY "public"."plan_mensajes_ia"
    ADD CONSTRAINT "plan_mensajes_ia_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."planes_estudio"
    ADD CONSTRAINT "planes_estudio_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."reasignaciones"
    ADD CONSTRAINT "reasignaciones_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."repositorios"
    ADD CONSTRAINT "repositorios_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."responsables_asignatura"
    ADD CONSTRAINT "responsables_asignatura_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."responsables_asignatura"
    ADD CONSTRAINT "responsables_asignatura_unico" UNIQUE ("asignatura_id", "usuario_id", "rol");



ALTER TABLE ONLY "public"."roles"
    ADD CONSTRAINT "roles_clave_key" UNIQUE ("clave");



ALTER TABLE ONLY "public"."roles_permisos"
    ADD CONSTRAINT "roles_permisos_pkey" PRIMARY KEY ("rol_id", "permiso_id");



ALTER TABLE ONLY "public"."roles"
    ADD CONSTRAINT "roles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tareas_revision"
    ADD CONSTRAINT "tareas_revision_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."transiciones_estado_plan"
    ADD CONSTRAINT "transiciones_estado_plan_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."transiciones_estado_plan"
    ADD CONSTRAINT "transiciones_unica" UNIQUE ("desde_estado_id", "hacia_estado_id", "rol_permitido_id");



ALTER TABLE ONLY "public"."usuarios_app"
    ADD CONSTRAINT "usuarios_app_clave_unique" UNIQUE ("clave");



ALTER TABLE ONLY "public"."usuarios_app"
    ADD CONSTRAINT "usuarios_app_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."usuarios_roles"
    ADD CONSTRAINT "usuarios_roles_pkey" PRIMARY KEY ("id");



CREATE UNIQUE INDEX "asignaturas_orden_celda_unico" ON "public"."asignaturas" USING "btree" ("plan_estudio_id", "linea_plan_id", "numero_ciclo", "orden_celda") WHERE (("linea_plan_id" IS NOT NULL) AND ("numero_ciclo" IS NOT NULL) AND ("orden_celda" IS NOT NULL));



CREATE INDEX "asignaturas_plan_idx" ON "public"."asignaturas" USING "btree" ("plan_estudio_id");



CREATE INDEX "asignaturas_plan_linea_ciclo_idx" ON "public"."asignaturas" USING "btree" ("plan_estudio_id", "linea_plan_id", "numero_ciclo");



CREATE INDEX "asignaturas_prerrequisito_idx" ON "public"."asignaturas" USING "btree" ("prerrequisito_asignatura_id");



CREATE INDEX "asignaturas_search_vector_gin_idx" ON "public"."asignaturas" USING "gin" ("search_vector");



CREATE INDEX "bibliografia_asignatura_idx" ON "public"."bibliografia_asignatura" USING "btree" ("asignatura_id");



CREATE INDEX "comentarios_asignatura_asig_idx" ON "public"."comentarios_asignatura" USING "btree" ("asignatura_id", "creado_en" DESC);



CREATE INDEX "comentarios_plan_plan_idx" ON "public"."comentarios_plan" USING "btree" ("plan_estudio_id", "creado_en" DESC);



CREATE INDEX "crash_reports_creado_en_idx" ON "public"."crash_reports" USING "btree" ("creado_en" DESC);



CREATE INDEX "crash_reports_fingerprint_idx" ON "public"."crash_reports" USING "btree" ("fingerprint") WHERE ("fingerprint" IS NOT NULL);



CREATE INDEX "crash_reports_resueltos_idx" ON "public"."crash_reports" USING "btree" ("resuelto_en") WHERE ("resuelto_en" IS NULL);



CREATE INDEX "crash_reports_usuario_idx" ON "public"."crash_reports" USING "btree" ("usuario_id") WHERE ("usuario_id" IS NOT NULL);



CREATE INDEX "idx_asignatura_mensajes_ia_openai_response_id" ON "public"."asignatura_mensajes_ia" USING "btree" ("openai_response_id");



CREATE INDEX "idx_borradores_campo_entidad" ON "public"."borradores_campo" USING "btree" ("entidad", "entidad_id");



CREATE INDEX "idx_borradores_campo_plan" ON "public"."borradores_campo" USING "btree" ("plan_id", "actualizado_en" DESC);



CREATE INDEX "idx_conv_asig_asignatura" ON "public"."conversaciones_asignatura" USING "btree" ("asignatura_id");



CREATE INDEX "idx_conv_asig_estado" ON "public"."conversaciones_asignatura" USING "btree" ("estado");



CREATE INDEX "idx_conv_plan_estado" ON "public"."conversaciones_plan" USING "btree" ("estado");



CREATE INDEX "idx_conv_plan_plan_estudio" ON "public"."conversaciones_plan" USING "btree" ("plan_estudio_id");



CREATE INDEX "idx_estructuras_asignatura_estructura_plan" ON "public"."estructuras_asignatura" USING "btree" ("estructura_plan_id", "nombre");



CREATE INDEX "idx_plan_mensajes_ia_openai_response_id" ON "public"."plan_mensajes_ia" USING "btree" ("openai_response_id");



CREATE INDEX "idx_planes_nombre_search" ON "public"."planes_estudio" USING "btree" ("nombre_search");



CREATE INDEX "lineas_curriculares_sugeridas_facultad_idx" ON "public"."lineas_curriculares_sugeridas" USING "btree" ("facultad_id", "orden");



CREATE UNIQUE INDEX "lineas_curriculares_sugeridas_facultad_nombre_uq" ON "public"."lineas_curriculares_sugeridas" USING "btree" ("facultad_id", "lower"("nombre"));



CREATE INDEX "usuarios_app_invitado_por_idx" ON "public"."usuarios_app" USING "btree" ("invitado_por");



CREATE UNIQUE INDEX "usuarios_roles_unicos_idx" ON "public"."usuarios_roles" USING "btree" ("usuario_id", "rol_id", COALESCE("facultad_id", '00000000-0000-0000-0000-000000000000'::"uuid"), COALESCE("carrera_id", '00000000-0000-0000-0000-000000000000'::"uuid"));



CREATE UNIQUE INDEX "ux_usuarios_roles_carrera_singleton" ON "public"."usuarios_roles" USING "btree" ("rol_id", "carrera_id") WHERE ("carrera_id" IS NOT NULL);



CREATE UNIQUE INDEX "ux_usuarios_roles_facultad_singleton" ON "public"."usuarios_roles" USING "btree" ("rol_id", "facultad_id") WHERE ("facultad_id" IS NOT NULL);



CREATE OR REPLACE TRIGGER "aa_borradores_campo_set_plan_id" BEFORE INSERT OR UPDATE ON "public"."borradores_campo" FOR EACH ROW EXECUTE FUNCTION "public"."fn_borradores_campo_set_plan_id"();



CREATE OR REPLACE TRIGGER "aa_fill_author_asignaturas" BEFORE INSERT OR UPDATE ON "public"."asignaturas" FOR EACH ROW EXECUTE FUNCTION "public"."fn_fill_author_from_auth_uid"();



CREATE OR REPLACE TRIGGER "aa_fill_author_borradores_campo" BEFORE INSERT OR UPDATE ON "public"."borradores_campo" FOR EACH ROW EXECUTE FUNCTION "public"."fn_fill_author_from_auth_uid"();



CREATE OR REPLACE TRIGGER "aa_fill_author_planes_estudio" BEFORE INSERT OR UPDATE ON "public"."planes_estudio" FOR EACH ROW EXECUTE FUNCTION "public"."fn_fill_author_from_auth_uid"();



CREATE OR REPLACE TRIGGER "aa_validar_asignatura_estructura_plan" BEFORE INSERT OR UPDATE OF "plan_estudio_id", "estructura_id" ON "public"."asignaturas" FOR EACH ROW EXECUTE FUNCTION "public"."fn_validar_asignatura_estructura_plan"();



CREATE OR REPLACE TRIGGER "aa_validar_datos_asignatura" BEFORE INSERT OR UPDATE OF "datos", "plan_estudio_id", "estructura_id", "nombre", "codigo", "tipo", "creditos", "numero_ciclo", "linea_plan_id", "orden_celda", "contenido_tematico", "criterios_de_evaluacion", "horas_academicas", "horas_independientes", "prerrequisito_asignatura_id", "estado" ON "public"."asignaturas" FOR EACH ROW EXECUTE FUNCTION "public"."fn_validar_datos_asignatura"();



CREATE OR REPLACE TRIGGER "aa_validar_datos_plan" BEFORE INSERT OR UPDATE OF "datos", "estructura_id", "nombre", "carrera_id", "tipo_ciclo", "numero_ciclos", "activo", "estado_actual_id" ON "public"."planes_estudio" FOR EACH ROW EXECUTE FUNCTION "public"."fn_validar_datos_plan"();



CREATE OR REPLACE TRIGGER "trg_asignaturas_actualizado_en" BEFORE UPDATE ON "public"."asignaturas" FOR EACH ROW EXECUTE FUNCTION "public"."set_actualizado_en"();



CREATE OR REPLACE TRIGGER "trg_asignaturas_search_vector" BEFORE INSERT OR UPDATE OF "nombre", "codigo", "datos", "contenido_tematico" ON "public"."asignaturas" FOR EACH ROW EXECUTE FUNCTION "public"."fn_asignaturas_update_search_vector"();



CREATE OR REPLACE TRIGGER "trg_bibliografia_asignatura_actualizado_en" BEFORE UPDATE ON "public"."bibliografia_asignatura" FOR EACH ROW EXECUTE FUNCTION "public"."set_actualizado_en"();



CREATE OR REPLACE TRIGGER "trg_bibliografia_asignatura_log_cambios" AFTER INSERT OR DELETE OR UPDATE ON "public"."bibliografia_asignatura" FOR EACH ROW EXECUTE FUNCTION "public"."fn_log_bibliografia_asignatura_cambios"();



CREATE OR REPLACE TRIGGER "trg_borradores_campo_actualizado_en" BEFORE UPDATE ON "public"."borradores_campo" FOR EACH ROW EXECUTE FUNCTION "public"."set_actualizado_en"();



CREATE OR REPLACE TRIGGER "trg_carreras_actualizado_en" BEFORE UPDATE ON "public"."carreras" FOR EACH ROW EXECUTE FUNCTION "public"."set_actualizado_en"();



CREATE OR REPLACE TRIGGER "trg_comentarios_asignatura_notificar" AFTER INSERT ON "public"."comentarios_asignatura" FOR EACH ROW EXECUTE FUNCTION "public"."fn_notificar_comentario_asignatura"();



CREATE OR REPLACE TRIGGER "trg_comentarios_plan_notificar" AFTER INSERT ON "public"."comentarios_plan" FOR EACH ROW EXECUTE FUNCTION "public"."fn_notificar_comentario_plan"();



CREATE OR REPLACE TRIGGER "trg_estructuras_asignatura_actualizado_en" BEFORE UPDATE ON "public"."estructuras_asignatura" FOR EACH ROW EXECUTE FUNCTION "public"."set_actualizado_en"();



CREATE OR REPLACE TRIGGER "trg_estructuras_plan_actualizado_en" BEFORE UPDATE ON "public"."estructuras_plan" FOR EACH ROW EXECUTE FUNCTION "public"."set_actualizado_en"();



CREATE OR REPLACE TRIGGER "trg_facultades_actualizado_en" BEFORE UPDATE ON "public"."facultades" FOR EACH ROW EXECUTE FUNCTION "public"."set_actualizado_en"();



CREATE OR REPLACE TRIGGER "trg_limpiar_seriacion_conflictiva" BEFORE UPDATE OF "numero_ciclo" ON "public"."asignaturas" FOR EACH ROW EXECUTE FUNCTION "public"."fn_ajustar_seriacion_por_cambio_ciclo"();



CREATE OR REPLACE TRIGGER "trg_lineas_curriculares_sugeridas_actualizado_en" BEFORE UPDATE ON "public"."lineas_curriculares_sugeridas" FOR EACH ROW EXECUTE FUNCTION "public"."set_actualizado_en"();



CREATE OR REPLACE TRIGGER "trg_lineas_plan_actualizado_en" BEFORE UPDATE ON "public"."lineas_plan" FOR EACH ROW EXECUTE FUNCTION "public"."set_actualizado_en"();



CREATE OR REPLACE TRIGGER "trg_lineas_plan_log_cambios" AFTER INSERT OR DELETE OR UPDATE ON "public"."lineas_plan" FOR EACH ROW EXECUTE FUNCTION "public"."fn_log_lineas_plan_cambios"();



CREATE OR REPLACE TRIGGER "trg_planes_estudio_actualizado_en" BEFORE UPDATE ON "public"."planes_estudio" FOR EACH ROW EXECUTE FUNCTION "public"."set_actualizado_en"();



CREATE OR REPLACE TRIGGER "trg_planes_estudio_asignar_jefe" AFTER INSERT ON "public"."planes_estudio" FOR EACH ROW EXECUTE FUNCTION "public"."fn_asignar_jefe_al_crear_plan"();



CREATE OR REPLACE TRIGGER "trg_planes_estudio_log_cambios" AFTER INSERT OR DELETE OR UPDATE ON "public"."planes_estudio" FOR EACH ROW EXECUTE FUNCTION "public"."fn_log_cambios_planes_estudio"();



CREATE OR REPLACE TRIGGER "trg_planes_notificar_estado" AFTER UPDATE ON "public"."planes_estudio" FOR EACH ROW EXECUTE FUNCTION "public"."fn_notificar_cambio_estado_plan"();



CREATE OR REPLACE TRIGGER "trg_responsables_grant_profesor" AFTER INSERT ON "public"."responsables_asignatura" FOR EACH ROW EXECUTE FUNCTION "public"."fn_grant_profesor_on_responsable"();



CREATE OR REPLACE TRIGGER "trg_usuarios_app_actualizado_en" BEFORE UPDATE ON "public"."usuarios_app" FOR EACH ROW EXECUTE FUNCTION "public"."set_actualizado_en"();



CREATE OR REPLACE TRIGGER "trg_validar_numero_ciclo_asignatura" BEFORE INSERT OR UPDATE OF "numero_ciclo", "plan_estudio_id" ON "public"."asignaturas" FOR EACH ROW EXECUTE FUNCTION "public"."validar_numero_ciclo_asignatura"();



CREATE OR REPLACE TRIGGER "trg_validar_prerrequisito_asignatura" BEFORE INSERT OR UPDATE OF "prerrequisito_asignatura_id", "numero_ciclo", "plan_estudio_id" ON "public"."asignaturas" FOR EACH ROW EXECUTE FUNCTION "public"."validar_prerrequisito_asignatura"();



CREATE OR REPLACE TRIGGER "trigger_track_cambios_asignatura" BEFORE INSERT OR DELETE OR UPDATE ON "public"."asignaturas" FOR EACH ROW EXECUTE FUNCTION "public"."fn_track_cambios_asignatura"();



ALTER TABLE ONLY "public"."archivos"
    ADD CONSTRAINT "archivos_creado_por_fkey" FOREIGN KEY ("creado_por") REFERENCES "public"."usuarios_app"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."archivos_repositorios"
    ADD CONSTRAINT "archivos_repositorios_archivo_id_fkey" FOREIGN KEY ("archivo_id") REFERENCES "public"."archivos"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."archivos_repositorios"
    ADD CONSTRAINT "archivos_repositorios_repositorio_id_fkey" FOREIGN KEY ("repositorio_id") REFERENCES "public"."repositorios"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."archivos"
    ADD CONSTRAINT "archivos_usuarios_id_fkey" FOREIGN KEY ("id") REFERENCES "storage"."objects"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."asignatura_mensajes_ia"
    ADD CONSTRAINT "asignatura_mensajes_ia_conversacion_asignatura_id_fkey" FOREIGN KEY ("conversacion_asignatura_id") REFERENCES "public"."conversaciones_asignatura"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."asignaturas"
    ADD CONSTRAINT "asignaturas_actualizado_por_fkey" FOREIGN KEY ("actualizado_por") REFERENCES "public"."usuarios_app"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."asignaturas"
    ADD CONSTRAINT "asignaturas_creado_por_fkey" FOREIGN KEY ("creado_por") REFERENCES "public"."usuarios_app"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."asignaturas"
    ADD CONSTRAINT "asignaturas_estructura_id_fkey" FOREIGN KEY ("estructura_id") REFERENCES "public"."estructuras_asignatura"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."asignaturas"
    ADD CONSTRAINT "asignaturas_linea_plan_fk_compuesta" FOREIGN KEY ("linea_plan_id", "plan_estudio_id") REFERENCES "public"."lineas_plan"("id", "plan_estudio_id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."asignaturas"
    ADD CONSTRAINT "asignaturas_plan_estudio_id_fkey" FOREIGN KEY ("plan_estudio_id") REFERENCES "public"."planes_estudio"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."asignaturas"
    ADD CONSTRAINT "asignaturas_prerrequisito_asignatura_id_fkey" FOREIGN KEY ("prerrequisito_asignatura_id") REFERENCES "public"."asignaturas"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."bibliografia_asignatura"
    ADD CONSTRAINT "bibliografia_asignatura_asignatura_id_fkey" FOREIGN KEY ("asignatura_id") REFERENCES "public"."asignaturas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bibliografia_asignatura"
    ADD CONSTRAINT "bibliografia_asignatura_creado_por_fkey" FOREIGN KEY ("creado_por") REFERENCES "public"."usuarios_app"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."borradores_campo"
    ADD CONSTRAINT "borradores_campo_actualizado_por_fkey" FOREIGN KEY ("actualizado_por") REFERENCES "public"."usuarios_app"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."borradores_campo"
    ADD CONSTRAINT "borradores_campo_creado_por_fkey" FOREIGN KEY ("creado_por") REFERENCES "public"."usuarios_app"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."borradores_campo"
    ADD CONSTRAINT "borradores_campo_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "public"."planes_estudio"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."cambios_asignatura"
    ADD CONSTRAINT "cambios_asignatura_asignatura_id_fkey" FOREIGN KEY ("asignatura_id") REFERENCES "public"."asignaturas"("id") ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;



ALTER TABLE ONLY "public"."cambios_asignatura"
    ADD CONSTRAINT "cambios_asignatura_cambiado_por_fkey" FOREIGN KEY ("cambiado_por") REFERENCES "public"."usuarios_app"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."cambios_plan"
    ADD CONSTRAINT "cambios_plan_cambiado_por_fkey" FOREIGN KEY ("cambiado_por") REFERENCES "public"."usuarios_app"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."carreras"
    ADD CONSTRAINT "carreras_actualizado_por_fkey" FOREIGN KEY ("actualizado_por") REFERENCES "public"."usuarios_app"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."carreras"
    ADD CONSTRAINT "carreras_creado_por_fkey" FOREIGN KEY ("creado_por") REFERENCES "public"."usuarios_app"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."carreras"
    ADD CONSTRAINT "carreras_facultad_id_fkey" FOREIGN KEY ("facultad_id") REFERENCES "public"."facultades"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."comentarios_asignatura"
    ADD CONSTRAINT "comentarios_asignatura_asignatura_id_fkey" FOREIGN KEY ("asignatura_id") REFERENCES "public"."asignaturas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."comentarios_asignatura"
    ADD CONSTRAINT "comentarios_asignatura_autor_id_fkey" FOREIGN KEY ("autor_id") REFERENCES "public"."usuarios_app"("id");



ALTER TABLE ONLY "public"."comentarios_asignatura"
    ADD CONSTRAINT "comentarios_asignatura_comentario_padre_id_fkey" FOREIGN KEY ("comentario_padre_id") REFERENCES "public"."comentarios_asignatura"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."comentarios_plan"
    ADD CONSTRAINT "comentarios_plan_autor_id_fkey" FOREIGN KEY ("autor_id") REFERENCES "public"."usuarios_app"("id");



ALTER TABLE ONLY "public"."comentarios_plan"
    ADD CONSTRAINT "comentarios_plan_comentario_padre_id_fkey" FOREIGN KEY ("comentario_padre_id") REFERENCES "public"."comentarios_plan"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."comentarios_plan"
    ADD CONSTRAINT "comentarios_plan_estado_id_fkey" FOREIGN KEY ("estado_id") REFERENCES "public"."estados_plan"("id");



ALTER TABLE ONLY "public"."comentarios_plan"
    ADD CONSTRAINT "comentarios_plan_plan_estudio_id_fkey" FOREIGN KEY ("plan_estudio_id") REFERENCES "public"."planes_estudio"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."conversaciones_asignatura"
    ADD CONSTRAINT "conversaciones_asignatura_archivado_por_fkey" FOREIGN KEY ("archivado_por") REFERENCES "public"."usuarios_app"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."conversaciones_asignatura"
    ADD CONSTRAINT "conversaciones_asignatura_asignatura_id_fkey" FOREIGN KEY ("asignatura_id") REFERENCES "public"."asignaturas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."conversaciones_asignatura"
    ADD CONSTRAINT "conversaciones_asignatura_creado_por_fkey" FOREIGN KEY ("creado_por") REFERENCES "public"."usuarios_app"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."conversaciones_plan"
    ADD CONSTRAINT "conversaciones_plan_archivado_por_fkey" FOREIGN KEY ("archivado_por") REFERENCES "public"."usuarios_app"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."conversaciones_plan"
    ADD CONSTRAINT "conversaciones_plan_creado_por_fkey" FOREIGN KEY ("creado_por") REFERENCES "public"."usuarios_app"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."conversaciones_plan"
    ADD CONSTRAINT "conversaciones_plan_plan_estudio_id_fkey" FOREIGN KEY ("plan_estudio_id") REFERENCES "public"."planes_estudio"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."crash_reports"
    ADD CONSTRAINT "crash_reports_resuelto_por_fkey" FOREIGN KEY ("resuelto_por") REFERENCES "public"."usuarios_app"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."crash_reports"
    ADD CONSTRAINT "crash_reports_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios_app"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."estructuras_asignatura"
    ADD CONSTRAINT "estructuras_asignatura_actualizado_por_fkey" FOREIGN KEY ("actualizado_por") REFERENCES "public"."usuarios_app"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."estructuras_asignatura"
    ADD CONSTRAINT "estructuras_asignatura_creado_por_fkey" FOREIGN KEY ("creado_por") REFERENCES "public"."usuarios_app"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."estructuras_asignatura"
    ADD CONSTRAINT "estructuras_asignatura_estructura_plan_id_fkey" FOREIGN KEY ("estructura_plan_id") REFERENCES "public"."estructuras_plan"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."estructuras_plan"
    ADD CONSTRAINT "estructuras_plan_actualizado_por_fkey" FOREIGN KEY ("actualizado_por") REFERENCES "public"."usuarios_app"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."estructuras_plan"
    ADD CONSTRAINT "estructuras_plan_creado_por_fkey" FOREIGN KEY ("creado_por") REFERENCES "public"."usuarios_app"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."expertos"
    ADD CONSTRAINT "expertos_creado_por_fkey" FOREIGN KEY ("creado_por") REFERENCES "public"."usuarios_app"("id");



ALTER TABLE ONLY "public"."expertos"
    ADD CONSTRAINT "expertos_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios_app"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."facultades"
    ADD CONSTRAINT "facultades_actualizado_por_fkey" FOREIGN KEY ("actualizado_por") REFERENCES "public"."usuarios_app"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."facultades"
    ADD CONSTRAINT "facultades_creado_por_fkey" FOREIGN KEY ("creado_por") REFERENCES "public"."usuarios_app"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."interacciones_ia"
    ADD CONSTRAINT "interacciones_ia_asignatura_id_fkey" FOREIGN KEY ("asignatura_id") REFERENCES "public"."asignaturas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."interacciones_ia"
    ADD CONSTRAINT "interacciones_ia_plan_estudio_id_fkey" FOREIGN KEY ("plan_estudio_id") REFERENCES "public"."planes_estudio"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."interacciones_ia"
    ADD CONSTRAINT "interacciones_ia_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios_app"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."lineas_curriculares_sugeridas"
    ADD CONSTRAINT "lineas_curriculares_sugeridas_actualizado_por_fkey" FOREIGN KEY ("actualizado_por") REFERENCES "public"."usuarios_app"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."lineas_curriculares_sugeridas"
    ADD CONSTRAINT "lineas_curriculares_sugeridas_creado_por_fkey" FOREIGN KEY ("creado_por") REFERENCES "public"."usuarios_app"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."lineas_curriculares_sugeridas"
    ADD CONSTRAINT "lineas_curriculares_sugeridas_facultad_id_fkey" FOREIGN KEY ("facultad_id") REFERENCES "public"."facultades"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."lineas_plan"
    ADD CONSTRAINT "lineas_plan_actualizado_por_fkey" FOREIGN KEY ("actualizado_por") REFERENCES "public"."usuarios_app"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."lineas_plan"
    ADD CONSTRAINT "lineas_plan_creado_por_fkey" FOREIGN KEY ("creado_por") REFERENCES "public"."usuarios_app"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."lineas_plan"
    ADD CONSTRAINT "lineas_plan_plan_estudio_id_fkey" FOREIGN KEY ("plan_estudio_id") REFERENCES "public"."planes_estudio"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notificaciones"
    ADD CONSTRAINT "notificaciones_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios_app"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."plan_expertos"
    ADD CONSTRAINT "plan_expertos_experto_id_fkey" FOREIGN KEY ("experto_id") REFERENCES "public"."expertos"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."plan_expertos"
    ADD CONSTRAINT "plan_expertos_plan_estudio_id_fkey" FOREIGN KEY ("plan_estudio_id") REFERENCES "public"."planes_estudio"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."plan_mensajes_ia"
    ADD CONSTRAINT "plan_mensajes_ia_conversacion_plan_id_fkey" FOREIGN KEY ("conversacion_plan_id") REFERENCES "public"."conversaciones_plan"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."planes_estudio"
    ADD CONSTRAINT "planes_estudio_actualizado_por_fkey" FOREIGN KEY ("actualizado_por") REFERENCES "public"."usuarios_app"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."planes_estudio"
    ADD CONSTRAINT "planes_estudio_carrera_id_fkey" FOREIGN KEY ("carrera_id") REFERENCES "public"."carreras"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."planes_estudio"
    ADD CONSTRAINT "planes_estudio_creado_por_fkey" FOREIGN KEY ("creado_por") REFERENCES "public"."usuarios_app"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."planes_estudio"
    ADD CONSTRAINT "planes_estudio_estado_actual_id_fkey" FOREIGN KEY ("estado_actual_id") REFERENCES "public"."estados_plan"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."planes_estudio"
    ADD CONSTRAINT "planes_estudio_estructura_id_fkey" FOREIGN KEY ("estructura_id") REFERENCES "public"."estructuras_plan"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."reasignaciones"
    ADD CONSTRAINT "reasignaciones_reasignado_por_fkey" FOREIGN KEY ("reasignado_por") REFERENCES "public"."usuarios_app"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."reasignaciones"
    ADD CONSTRAINT "reasignaciones_usuario_destino_fkey" FOREIGN KEY ("usuario_destino") REFERENCES "public"."usuarios_app"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."reasignaciones"
    ADD CONSTRAINT "reasignaciones_usuario_origen_fkey" FOREIGN KEY ("usuario_origen") REFERENCES "public"."usuarios_app"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."responsables_asignatura"
    ADD CONSTRAINT "responsables_asignatura_asignado_por_fkey" FOREIGN KEY ("asignado_por") REFERENCES "public"."usuarios_app"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."responsables_asignatura"
    ADD CONSTRAINT "responsables_asignatura_asignatura_id_fkey" FOREIGN KEY ("asignatura_id") REFERENCES "public"."asignaturas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."responsables_asignatura"
    ADD CONSTRAINT "responsables_asignatura_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios_app"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."roles_permisos"
    ADD CONSTRAINT "roles_permisos_permiso_id_fkey" FOREIGN KEY ("permiso_id") REFERENCES "public"."permisos"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."roles_permisos"
    ADD CONSTRAINT "roles_permisos_rol_id_fkey" FOREIGN KEY ("rol_id") REFERENCES "public"."roles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tareas_revision"
    ADD CONSTRAINT "tareas_revision_asignado_a_fkey" FOREIGN KEY ("asignado_a") REFERENCES "public"."usuarios_app"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tareas_revision"
    ADD CONSTRAINT "tareas_revision_creado_por_fkey" FOREIGN KEY ("creado_por") REFERENCES "public"."usuarios_app"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tareas_revision"
    ADD CONSTRAINT "tareas_revision_estado_id_fkey" FOREIGN KEY ("estado_id") REFERENCES "public"."estados_plan"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tareas_revision"
    ADD CONSTRAINT "tareas_revision_plan_estudio_id_fkey" FOREIGN KEY ("plan_estudio_id") REFERENCES "public"."planes_estudio"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tareas_revision"
    ADD CONSTRAINT "tareas_revision_rol_id_fkey" FOREIGN KEY ("rol_id") REFERENCES "public"."roles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."transiciones_estado_plan"
    ADD CONSTRAINT "transiciones_estado_plan_desde_estado_id_fkey" FOREIGN KEY ("desde_estado_id") REFERENCES "public"."estados_plan"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."transiciones_estado_plan"
    ADD CONSTRAINT "transiciones_estado_plan_hacia_estado_id_fkey" FOREIGN KEY ("hacia_estado_id") REFERENCES "public"."estados_plan"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."transiciones_estado_plan"
    ADD CONSTRAINT "transiciones_estado_plan_rol_permitido_id_fkey" FOREIGN KEY ("rol_permitido_id") REFERENCES "public"."roles"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."usuarios_app"
    ADD CONSTRAINT "usuarios_app_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."usuarios_app"
    ADD CONSTRAINT "usuarios_app_invitado_por_fkey" FOREIGN KEY ("invitado_por") REFERENCES "public"."usuarios_app"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."usuarios_roles"
    ADD CONSTRAINT "usuarios_roles_asignado_por_fkey" FOREIGN KEY ("asignado_por") REFERENCES "public"."usuarios_app"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."usuarios_roles"
    ADD CONSTRAINT "usuarios_roles_carrera_id_fkey" FOREIGN KEY ("carrera_id") REFERENCES "public"."carreras"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."usuarios_roles"
    ADD CONSTRAINT "usuarios_roles_facultad_id_fkey" FOREIGN KEY ("facultad_id") REFERENCES "public"."facultades"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."usuarios_roles"
    ADD CONSTRAINT "usuarios_roles_rol_id_fkey" FOREIGN KEY ("rol_id") REFERENCES "public"."roles"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."usuarios_roles"
    ADD CONSTRAINT "usuarios_roles_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios_app"("id") ON DELETE CASCADE;



ALTER TABLE "public"."archivos" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "archivos_manage_by_owner_or_permission" ON "public"."archivos" TO "authenticated" USING ((("creado_por" = "auth"."uid"()) OR "public"."authz_has_permission"('archivos.gestionar'::"text"))) WITH CHECK ((("creado_por" = "auth"."uid"()) OR "public"."authz_has_permission"('archivos.gestionar'::"text")));



ALTER TABLE "public"."archivos_repositorios" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "archivos_repositorios_manage_by_owner_or_permission" ON "public"."archivos_repositorios" TO "authenticated" USING (("public"."authz_has_permission"('archivos.gestionar'::"text") OR (EXISTS ( SELECT 1
   FROM "public"."archivos" "a"
  WHERE (("a"."id" = "archivos_repositorios"."archivo_id") AND ("a"."creado_por" = "auth"."uid"())))) OR (EXISTS ( SELECT 1
   FROM "public"."repositorios" "r"
  WHERE (("r"."id" = "archivos_repositorios"."repositorio_id") AND ("r"."enviado_por" = "auth"."uid"())))))) WITH CHECK (("public"."authz_has_permission"('archivos.gestionar'::"text") OR (EXISTS ( SELECT 1
   FROM "public"."archivos" "a"
  WHERE (("a"."id" = "archivos_repositorios"."archivo_id") AND ("a"."creado_por" = "auth"."uid"())))) OR (EXISTS ( SELECT 1
   FROM "public"."repositorios" "r"
  WHERE (("r"."id" = "archivos_repositorios"."repositorio_id") AND ("r"."enviado_por" = "auth"."uid"()))))));



CREATE POLICY "archivos_repositorios_select_by_owner_or_permission" ON "public"."archivos_repositorios" FOR SELECT TO "authenticated" USING (("public"."authz_has_permission"('archivos.ver'::"text") OR (EXISTS ( SELECT 1
   FROM "public"."archivos" "a"
  WHERE (("a"."id" = "archivos_repositorios"."archivo_id") AND ("a"."creado_por" = "auth"."uid"())))) OR (EXISTS ( SELECT 1
   FROM "public"."repositorios" "r"
  WHERE (("r"."id" = "archivos_repositorios"."repositorio_id") AND ("r"."enviado_por" = "auth"."uid"()))))));



CREATE POLICY "archivos_select_by_owner_or_permission" ON "public"."archivos" FOR SELECT TO "authenticated" USING ((("creado_por" = "auth"."uid"()) OR "public"."authz_has_permission"('archivos.ver'::"text")));



ALTER TABLE "public"."asignatura_mensajes_ia" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "asignatura_mensajes_ia_manage_by_scope" ON "public"."asignatura_mensajes_ia" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."conversaciones_asignatura" "c"
  WHERE (("c"."id" = "asignatura_mensajes_ia"."conversacion_asignatura_id") AND "public"."authz_asignatura_ia_allowed"("c"."asignatura_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."conversaciones_asignatura" "c"
  WHERE (("c"."id" = "asignatura_mensajes_ia"."conversacion_asignatura_id") AND "public"."authz_asignatura_ia_allowed"("c"."asignatura_id")))));



CREATE POLICY "asignatura_mensajes_ia_select_by_scope" ON "public"."asignatura_mensajes_ia" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."conversaciones_asignatura" "c"
  WHERE (("c"."id" = "asignatura_mensajes_ia"."conversacion_asignatura_id") AND (("c"."creado_por" = "auth"."uid"()) OR ("public"."authz_has_permission"('asignaturas.ver'::"text") AND "public"."authz_can_access_asignatura"("c"."asignatura_id")))))));



ALTER TABLE "public"."asignaturas" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "asignaturas_manage_by_scope" ON "public"."asignaturas" TO "authenticated" USING (("public"."authz_plan_write_allowed"("plan_estudio_id") OR "public"."authz_asignatura_write_allowed"("id"))) WITH CHECK (("public"."authz_plan_write_allowed"("plan_estudio_id") OR "public"."authz_asignatura_write_allowed"("id")));



CREATE POLICY "asignaturas_restricted_update_by_scope" ON "public"."asignaturas" FOR UPDATE TO "authenticated" USING ("public"."authz_asignatura_restricted_field_write_allowed"("id")) WITH CHECK ("public"."authz_asignatura_restricted_field_write_allowed"("id"));



CREATE POLICY "asignaturas_select_by_scope" ON "public"."asignaturas" FOR SELECT TO "authenticated" USING ((("public"."authz_has_permission"('asignaturas.ver'::"text") OR "public"."authz_has_permission"('planes.ver'::"text")) AND ("public"."authz_can_access_plan"("plan_estudio_id") OR "public"."authz_is_responsable_asignatura"("id"))));



ALTER TABLE "public"."bibliografia_asignatura" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "bibliografia_asignatura_manage_by_scope" ON "public"."bibliografia_asignatura" TO "authenticated" USING ("public"."authz_asignatura_write_allowed"("asignatura_id")) WITH CHECK ("public"."authz_asignatura_write_allowed"("asignatura_id"));



CREATE POLICY "bibliografia_asignatura_select_by_scope" ON "public"."bibliografia_asignatura" FOR SELECT TO "authenticated" USING (("public"."authz_has_permission"('asignaturas.ver'::"text") AND "public"."authz_can_access_asignatura"("asignatura_id")));



ALTER TABLE "public"."borradores_campo" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "borradores_campo_delete_by_scope" ON "public"."borradores_campo" FOR DELETE TO "authenticated" USING (
CASE "entidad"
    WHEN 'plan'::"text" THEN ("public"."authz_campo_plan_write_allowed"("entidad_id", "clave") OR ("public"."authz_is_admin"() AND "public"."authz_can_access_plan"("entidad_id")))
    WHEN 'asignatura'::"text" THEN ("public"."authz_campo_asignatura_write_allowed"("entidad_id", "clave") OR ("public"."authz_is_admin"() AND "public"."authz_can_access_asignatura"("entidad_id")))
    ELSE false
END);



CREATE POLICY "borradores_campo_insert_by_scope" ON "public"."borradores_campo" FOR INSERT TO "authenticated" WITH CHECK (
CASE "entidad"
    WHEN 'plan'::"text" THEN ("public"."authz_campo_plan_write_allowed"("entidad_id", "clave") OR ("public"."authz_is_admin"() AND "public"."authz_can_access_plan"("entidad_id")))
    WHEN 'asignatura'::"text" THEN ("public"."authz_campo_asignatura_write_allowed"("entidad_id", "clave") OR ("public"."authz_is_admin"() AND "public"."authz_can_access_asignatura"("entidad_id")))
    ELSE false
END);



CREATE POLICY "borradores_campo_select_by_scope" ON "public"."borradores_campo" FOR SELECT TO "authenticated" USING (
CASE "entidad"
    WHEN 'plan'::"text" THEN "public"."authz_can_access_plan"("entidad_id")
    WHEN 'asignatura'::"text" THEN "public"."authz_can_access_asignatura"("entidad_id")
    ELSE false
END);



CREATE POLICY "borradores_campo_update_by_scope" ON "public"."borradores_campo" FOR UPDATE TO "authenticated" USING (
CASE "entidad"
    WHEN 'plan'::"text" THEN ("public"."authz_campo_plan_write_allowed"("entidad_id", "clave") OR ("public"."authz_is_admin"() AND "public"."authz_can_access_plan"("entidad_id")))
    WHEN 'asignatura'::"text" THEN ("public"."authz_campo_asignatura_write_allowed"("entidad_id", "clave") OR ("public"."authz_is_admin"() AND "public"."authz_can_access_asignatura"("entidad_id")))
    ELSE false
END) WITH CHECK (
CASE "entidad"
    WHEN 'plan'::"text" THEN ("public"."authz_campo_plan_write_allowed"("entidad_id", "clave") OR ("public"."authz_is_admin"() AND "public"."authz_can_access_plan"("entidad_id")))
    WHEN 'asignatura'::"text" THEN ("public"."authz_campo_asignatura_write_allowed"("entidad_id", "clave") OR ("public"."authz_is_admin"() AND "public"."authz_can_access_asignatura"("entidad_id")))
    ELSE false
END);



ALTER TABLE "public"."cambios_asignatura" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "cambios_asignatura_select_by_scope" ON "public"."cambios_asignatura" FOR SELECT TO "authenticated" USING ((("public"."authz_has_permission"('auditoria.ver'::"text") OR "public"."authz_has_permission"('asignaturas.ver'::"text")) AND "public"."authz_can_access_asignatura"("asignatura_id")));



ALTER TABLE "public"."cambios_plan" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "cambios_plan_select_by_scope" ON "public"."cambios_plan" FOR SELECT TO "authenticated" USING ((("public"."authz_has_permission"('auditoria.ver'::"text") OR "public"."authz_has_permission"('planes.ver'::"text")) AND "public"."authz_can_access_plan"("plan_estudio_id")));



ALTER TABLE "public"."carreras" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "carreras_delete_by_catalogos" ON "public"."carreras" FOR DELETE TO "authenticated" USING ("public"."authz_has_permission"('catalogos.gestionar'::"text"));



CREATE POLICY "carreras_insert_by_catalogos" ON "public"."carreras" FOR INSERT TO "authenticated" WITH CHECK ("public"."authz_has_permission"('catalogos.gestionar'::"text"));



CREATE POLICY "carreras_select_authenticated" ON "public"."carreras" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "carreras_update_by_catalogos_or_plan_scope" ON "public"."carreras" FOR UPDATE TO "authenticated" USING (("public"."authz_has_permission"('catalogos.gestionar'::"text") OR ("public"."authz_has_permission"('planes.editar'::"text") AND ("public"."authz_has_global_scope"() OR (EXISTS ( SELECT 1
   FROM "jsonb_array_elements_text"(COALESCE(("auth"."jwt"() #> '{app_metadata,alcances,carreras}'::"text"[]), '[]'::"jsonb")) "alcance"("value")
  WHERE ("alcance"."value" = ("carreras"."id")::"text"))) OR "public"."authz_can_access_facultad"("facultad_id"))))) WITH CHECK (("public"."authz_has_permission"('catalogos.gestionar'::"text") OR ("public"."authz_has_permission"('planes.editar'::"text") AND ("public"."authz_has_global_scope"() OR (EXISTS ( SELECT 1
   FROM "jsonb_array_elements_text"(COALESCE(("auth"."jwt"() #> '{app_metadata,alcances,carreras}'::"text"[]), '[]'::"jsonb")) "alcance"("value")
  WHERE ("alcance"."value" = ("carreras"."id")::"text"))) OR "public"."authz_can_access_facultad"("facultad_id")))));



ALTER TABLE "public"."comentarios_asignatura" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "comentarios_asignatura_delete_own" ON "public"."comentarios_asignatura" FOR DELETE TO "authenticated" USING ((("autor_id" = "auth"."uid"()) OR "public"."authz_is_admin"()));



CREATE POLICY "comentarios_asignatura_insert_by_scope" ON "public"."comentarios_asignatura" FOR INSERT TO "authenticated" WITH CHECK ((("autor_id" = "auth"."uid"()) AND "public"."usuario_puede_comentar_asignatura"("auth"."uid"(), "asignatura_id")));



CREATE POLICY "comentarios_asignatura_select_by_scope" ON "public"."comentarios_asignatura" FOR SELECT TO "authenticated" USING ((("autor_id" = "auth"."uid"()) OR ("public"."authz_has_permission"('asignaturas.ver'::"text") AND "public"."authz_can_access_asignatura"("asignatura_id"))));



CREATE POLICY "comentarios_asignatura_update_own" ON "public"."comentarios_asignatura" FOR UPDATE TO "authenticated" USING ((("autor_id" = "auth"."uid"()) OR "public"."authz_is_admin"())) WITH CHECK ((("autor_id" = "auth"."uid"()) OR "public"."authz_is_admin"()));



ALTER TABLE "public"."comentarios_plan" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "comentarios_plan_delete_own" ON "public"."comentarios_plan" FOR DELETE TO "authenticated" USING ((("autor_id" = "auth"."uid"()) OR "public"."authz_is_admin"()));



CREATE POLICY "comentarios_plan_insert_by_scope" ON "public"."comentarios_plan" FOR INSERT TO "authenticated" WITH CHECK ((("autor_id" = "auth"."uid"()) AND "public"."usuario_puede_comentar_plan"("auth"."uid"(), "plan_estudio_id")));



CREATE POLICY "comentarios_plan_select_by_scope" ON "public"."comentarios_plan" FOR SELECT TO "authenticated" USING ((("autor_id" = "auth"."uid"()) OR ("public"."authz_has_permission"('planes.ver'::"text") AND "public"."authz_can_access_plan"("plan_estudio_id"))));



CREATE POLICY "comentarios_plan_update_own" ON "public"."comentarios_plan" FOR UPDATE TO "authenticated" USING ((("autor_id" = "auth"."uid"()) OR "public"."authz_is_admin"())) WITH CHECK ((("autor_id" = "auth"."uid"()) OR "public"."authz_is_admin"()));



ALTER TABLE "public"."conversaciones_asignatura" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "conversaciones_asignatura_manage_by_scope" ON "public"."conversaciones_asignatura" TO "authenticated" USING ("public"."authz_asignatura_ia_allowed"("asignatura_id")) WITH CHECK ("public"."authz_asignatura_ia_allowed"("asignatura_id"));



CREATE POLICY "conversaciones_asignatura_select_by_scope" ON "public"."conversaciones_asignatura" FOR SELECT TO "authenticated" USING ((("creado_por" = "auth"."uid"()) OR ("public"."authz_has_permission"('asignaturas.ver'::"text") AND "public"."authz_can_access_asignatura"("asignatura_id"))));



ALTER TABLE "public"."conversaciones_plan" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "conversaciones_plan_manage_by_scope" ON "public"."conversaciones_plan" TO "authenticated" USING ("public"."authz_plan_ia_allowed"("plan_estudio_id")) WITH CHECK ("public"."authz_plan_ia_allowed"("plan_estudio_id"));



CREATE POLICY "conversaciones_plan_select_by_scope" ON "public"."conversaciones_plan" FOR SELECT TO "authenticated" USING ((("creado_por" = "auth"."uid"()) OR ("public"."authz_has_permission"('planes.ver'::"text") AND "public"."authz_can_access_plan"("plan_estudio_id"))));



ALTER TABLE "public"."crash_reports" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "crash_reports_delete_admin" ON "public"."crash_reports" FOR DELETE TO "authenticated" USING ("public"."authz_is_admin"());



CREATE POLICY "crash_reports_insert_frontend" ON "public"."crash_reports" FOR INSERT TO "authenticated", "anon" WITH CHECK ((("origen" = 'frontend'::"text") AND ("severidad" = ANY (ARRAY['info'::"text", 'warning'::"text", 'error'::"text", 'fatal'::"text"])) AND (("usuario_id" IS NULL) OR ("usuario_id" = "auth"."uid"())) AND ("resuelto_en" IS NULL) AND ("resuelto_por" IS NULL) AND ("notas" IS NULL)));



CREATE POLICY "crash_reports_select_auditoria" ON "public"."crash_reports" FOR SELECT TO "authenticated" USING ("public"."authz_has_permission"('auditoria.ver'::"text"));



CREATE POLICY "crash_reports_update_auditoria" ON "public"."crash_reports" FOR UPDATE TO "authenticated" USING ("public"."authz_has_permission"('auditoria.ver'::"text")) WITH CHECK (("public"."authz_has_permission"('auditoria.ver'::"text") AND ("origen" = 'frontend'::"text") AND ("severidad" = ANY (ARRAY['info'::"text", 'warning'::"text", 'error'::"text", 'fatal'::"text"]))));



ALTER TABLE "public"."estados_plan" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "estados_plan_manage_by_catalogos" ON "public"."estados_plan" TO "authenticated" USING ("public"."authz_has_permission"('catalogos.gestionar'::"text")) WITH CHECK ("public"."authz_has_permission"('catalogos.gestionar'::"text"));



CREATE POLICY "estados_plan_select_authenticated" ON "public"."estados_plan" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."estructuras_asignatura" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "estructuras_asignatura_manage_by_catalogos" ON "public"."estructuras_asignatura" TO "authenticated" USING ("public"."authz_has_permission"('catalogos.gestionar'::"text")) WITH CHECK ("public"."authz_has_permission"('catalogos.gestionar'::"text"));



CREATE POLICY "estructuras_asignatura_select_authenticated" ON "public"."estructuras_asignatura" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."estructuras_plan" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "estructuras_plan_manage_by_catalogos" ON "public"."estructuras_plan" TO "authenticated" USING ("public"."authz_has_permission"('catalogos.gestionar'::"text")) WITH CHECK ("public"."authz_has_permission"('catalogos.gestionar'::"text"));



CREATE POLICY "estructuras_plan_select_authenticated" ON "public"."estructuras_plan" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."expertos" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "expertos_manage_by_permission" ON "public"."expertos" TO "authenticated" USING ("public"."authz_has_permission"('expertos.gestionar'::"text")) WITH CHECK ("public"."authz_has_permission"('expertos.gestionar'::"text"));



CREATE POLICY "expertos_select_by_scope" ON "public"."expertos" FOR SELECT TO "authenticated" USING ((("usuario_id" = "auth"."uid"()) OR "public"."authz_has_permission"('expertos.gestionar'::"text") OR (EXISTS ( SELECT 1
   FROM "public"."plan_expertos" "pe"
  WHERE (("pe"."experto_id" = "expertos"."id") AND "public"."authz_has_permission"('planes.ver'::"text") AND "public"."authz_can_access_plan"("pe"."plan_estudio_id"))))));



ALTER TABLE "public"."facultades" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "facultades_manage_by_catalogos" ON "public"."facultades" TO "authenticated" USING ("public"."authz_has_permission"('catalogos.gestionar'::"text")) WITH CHECK ("public"."authz_has_permission"('catalogos.gestionar'::"text"));



CREATE POLICY "facultades_select_authenticated" ON "public"."facultades" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."interacciones_ia" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "interacciones_ia_manage_own" ON "public"."interacciones_ia" TO "authenticated" USING ((("usuario_id" = "auth"."uid"()) AND (("plan_estudio_id" IS NULL) OR "public"."authz_plan_ia_allowed"("plan_estudio_id")) AND (("asignatura_id" IS NULL) OR "public"."authz_asignatura_ia_allowed"("asignatura_id")))) WITH CHECK ((("usuario_id" = "auth"."uid"()) AND (("plan_estudio_id" IS NULL) OR "public"."authz_plan_ia_allowed"("plan_estudio_id")) AND (("asignatura_id" IS NULL) OR "public"."authz_asignatura_ia_allowed"("asignatura_id"))));



CREATE POLICY "interacciones_ia_select_by_scope" ON "public"."interacciones_ia" FOR SELECT TO "authenticated" USING ((("usuario_id" = "auth"."uid"()) OR (("plan_estudio_id" IS NOT NULL) AND "public"."authz_has_permission"('auditoria.ver'::"text") AND "public"."authz_can_access_plan"("plan_estudio_id")) OR (("asignatura_id" IS NOT NULL) AND "public"."authz_has_permission"('auditoria.ver'::"text") AND "public"."authz_can_access_asignatura"("asignatura_id"))));



ALTER TABLE "public"."lineas_curriculares_sugeridas" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "lineas_curriculares_sugeridas_manage_by_catalogos" ON "public"."lineas_curriculares_sugeridas" TO "authenticated" USING ("public"."authz_has_permission"('catalogos.gestionar'::"text")) WITH CHECK ("public"."authz_has_permission"('catalogos.gestionar'::"text"));



CREATE POLICY "lineas_curriculares_sugeridas_select_authenticated" ON "public"."lineas_curriculares_sugeridas" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."lineas_plan" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "lineas_plan_manage_by_scope" ON "public"."lineas_plan" TO "authenticated" USING ("public"."authz_plan_write_allowed"("plan_estudio_id")) WITH CHECK ("public"."authz_plan_write_allowed"("plan_estudio_id"));



CREATE POLICY "lineas_plan_select_by_scope" ON "public"."lineas_plan" FOR SELECT TO "authenticated" USING (("public"."authz_has_permission"('planes.ver'::"text") AND "public"."authz_can_access_plan"("plan_estudio_id")));



ALTER TABLE "public"."notificaciones" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "notificaciones_select_own" ON "public"."notificaciones" FOR SELECT TO "authenticated" USING (("usuario_id" = "auth"."uid"()));



CREATE POLICY "notificaciones_update_own" ON "public"."notificaciones" FOR UPDATE TO "authenticated" USING (("usuario_id" = "auth"."uid"())) WITH CHECK (("usuario_id" = "auth"."uid"()));



ALTER TABLE "public"."permisos" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "permisos_select_auth_admin" ON "public"."permisos" FOR SELECT TO "supabase_auth_admin" USING (true);



CREATE POLICY "permisos_select_authenticated" ON "public"."permisos" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."plan_expertos" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "plan_expertos_manage_by_scope" ON "public"."plan_expertos" TO "authenticated" USING (("public"."authz_has_permission"('expertos.gestionar'::"text") AND "public"."authz_can_access_plan"("plan_estudio_id") AND ("public"."plan_estado_clave"("plan_estudio_id") = ANY (ARRAY['CONSULTA_EXPERTOS'::"text", 'REV_SEDES'::"text"])))) WITH CHECK (("public"."authz_has_permission"('expertos.gestionar'::"text") AND "public"."authz_can_access_plan"("plan_estudio_id") AND ("public"."plan_estado_clave"("plan_estudio_id") = ANY (ARRAY['CONSULTA_EXPERTOS'::"text", 'REV_SEDES'::"text"]))));



CREATE POLICY "plan_expertos_select_by_scope" ON "public"."plan_expertos" FOR SELECT TO "authenticated" USING (("public"."authz_has_permission"('planes.ver'::"text") AND "public"."authz_can_access_plan"("plan_estudio_id")));



ALTER TABLE "public"."plan_mensajes_ia" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "plan_mensajes_ia_manage_by_scope" ON "public"."plan_mensajes_ia" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."conversaciones_plan" "c"
  WHERE (("c"."id" = "plan_mensajes_ia"."conversacion_plan_id") AND "public"."authz_plan_ia_allowed"("c"."plan_estudio_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."conversaciones_plan" "c"
  WHERE (("c"."id" = "plan_mensajes_ia"."conversacion_plan_id") AND "public"."authz_plan_ia_allowed"("c"."plan_estudio_id")))));



CREATE POLICY "plan_mensajes_ia_select_by_scope" ON "public"."plan_mensajes_ia" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."conversaciones_plan" "c"
  WHERE (("c"."id" = "plan_mensajes_ia"."conversacion_plan_id") AND (("c"."creado_por" = "auth"."uid"()) OR ("public"."authz_has_permission"('planes.ver'::"text") AND "public"."authz_can_access_plan"("c"."plan_estudio_id")))))));



ALTER TABLE "public"."planes_estudio" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "planes_estudio_delete_by_scope" ON "public"."planes_estudio" FOR DELETE TO "authenticated" USING ("public"."authz_plan_write_allowed"("id"));



CREATE POLICY "planes_estudio_insert_by_scope" ON "public"."planes_estudio" FOR INSERT TO "authenticated" WITH CHECK (("public"."authz_has_permission"('planes.crear'::"text") AND "public"."authz_can_access_carrera"("carrera_id")));



CREATE POLICY "planes_estudio_restricted_update_by_scope" ON "public"."planes_estudio" FOR UPDATE TO "authenticated" USING ("public"."authz_plan_restricted_field_write_allowed"("id")) WITH CHECK ("public"."authz_plan_restricted_field_write_allowed"("id"));



CREATE POLICY "planes_estudio_select_by_scope" ON "public"."planes_estudio" FOR SELECT TO "authenticated" USING (("public"."authz_has_permission"('planes.ver'::"text") AND ("public"."authz_can_access_carrera"("carrera_id") OR "public"."authz_is_responsable_de_plan"("id"))));



CREATE POLICY "planes_estudio_update_by_scope" ON "public"."planes_estudio" FOR UPDATE TO "authenticated" USING ("public"."authz_plan_write_allowed"("id")) WITH CHECK ("public"."authz_plan_write_allowed"("id"));



ALTER TABLE "public"."reasignaciones" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "reasignaciones_select_by_permission" ON "public"."reasignaciones" FOR SELECT TO "authenticated" USING (("public"."authz_has_permission"('auditoria.ver'::"text") OR "public"."authz_has_permission"('usuarios.roles.gestionar'::"text")));



ALTER TABLE "public"."repositorios" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "repositorios_manage_by_owner_or_permission" ON "public"."repositorios" TO "authenticated" USING ((("enviado_por" = "auth"."uid"()) OR "public"."authz_has_permission"('archivos.gestionar'::"text"))) WITH CHECK ((("enviado_por" = "auth"."uid"()) OR "public"."authz_has_permission"('archivos.gestionar'::"text")));



CREATE POLICY "repositorios_select_by_owner_or_permission" ON "public"."repositorios" FOR SELECT TO "authenticated" USING ((("enviado_por" = "auth"."uid"()) OR "public"."authz_has_permission"('archivos.ver'::"text")));



ALTER TABLE "public"."responsables_asignatura" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "responsables_asignatura_manage_by_scope" ON "public"."responsables_asignatura" TO "authenticated" USING ("public"."authz_asignatura_write_allowed"("asignatura_id")) WITH CHECK ("public"."authz_asignatura_write_allowed"("asignatura_id"));



CREATE POLICY "responsables_asignatura_select_by_scope" ON "public"."responsables_asignatura" FOR SELECT TO "authenticated" USING ((("usuario_id" = "auth"."uid"()) OR ("public"."authz_has_permission"('asignaturas.ver'::"text") AND "public"."authz_can_access_asignatura"("asignatura_id"))));



ALTER TABLE "public"."roles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "roles_manage_by_permission" ON "public"."roles" TO "authenticated" USING ("public"."authz_has_permission"('usuarios.roles.gestionar'::"text")) WITH CHECK ("public"."authz_has_permission"('usuarios.roles.gestionar'::"text"));



ALTER TABLE "public"."roles_permisos" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "roles_permisos_manage_by_permission" ON "public"."roles_permisos" TO "authenticated" USING ("public"."authz_has_permission"('usuarios.roles.gestionar'::"text")) WITH CHECK ("public"."authz_has_permission"('usuarios.roles.gestionar'::"text"));



CREATE POLICY "roles_permisos_select_auth_admin" ON "public"."roles_permisos" FOR SELECT TO "supabase_auth_admin" USING (true);



CREATE POLICY "roles_permisos_select_authenticated" ON "public"."roles_permisos" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "roles_select_auth_admin" ON "public"."roles" FOR SELECT TO "supabase_auth_admin" USING (true);



CREATE POLICY "roles_select_authenticated" ON "public"."roles" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."tareas_revision" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "tareas_revision_delete_by_scope" ON "public"."tareas_revision" FOR DELETE TO "authenticated" USING (("public"."authz_has_permission"('planes.aprobar'::"text") AND "public"."authz_can_access_plan"("plan_estudio_id")));



CREATE POLICY "tareas_revision_insert_by_scope" ON "public"."tareas_revision" FOR INSERT TO "authenticated" WITH CHECK (("public"."authz_has_permission"('planes.aprobar'::"text") AND "public"."authz_can_access_plan"("plan_estudio_id")));



CREATE POLICY "tareas_revision_select_by_scope" ON "public"."tareas_revision" FOR SELECT TO "authenticated" USING ((("asignado_a" = "auth"."uid"()) OR ("public"."authz_has_permission"('planes.aprobar'::"text") AND "public"."authz_can_access_plan"("plan_estudio_id"))));



CREATE POLICY "tareas_revision_update_by_scope" ON "public"."tareas_revision" FOR UPDATE TO "authenticated" USING ((("asignado_a" = "auth"."uid"()) OR ("public"."authz_has_permission"('planes.aprobar'::"text") AND "public"."authz_can_access_plan"("plan_estudio_id")))) WITH CHECK ((("asignado_a" = "auth"."uid"()) OR ("public"."authz_has_permission"('planes.aprobar'::"text") AND "public"."authz_can_access_plan"("plan_estudio_id"))));



ALTER TABLE "public"."transiciones_estado_plan" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "transiciones_estado_plan_manage_by_catalogos" ON "public"."transiciones_estado_plan" TO "authenticated" USING ("public"."authz_has_permission"('catalogos.gestionar'::"text")) WITH CHECK ("public"."authz_has_permission"('catalogos.gestionar'::"text"));



CREATE POLICY "transiciones_estado_plan_select_authenticated" ON "public"."transiciones_estado_plan" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."usuarios_app" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "usuarios_app_select_auth_admin" ON "public"."usuarios_app" FOR SELECT TO "supabase_auth_admin" USING (true);



CREATE POLICY "usuarios_app_select_own_or_manage" ON "public"."usuarios_app" FOR SELECT TO "authenticated" USING ((("id" = "auth"."uid"()) OR "public"."authz_has_permission"('usuarios.ver'::"text") OR "public"."authz_has_permission"('usuarios.gestionar'::"text")));



CREATE POLICY "usuarios_app_update_own_or_manage" ON "public"."usuarios_app" FOR UPDATE TO "authenticated" USING ((("id" = "auth"."uid"()) OR "public"."authz_has_permission"('usuarios.gestionar'::"text"))) WITH CHECK ((("id" = "auth"."uid"()) OR "public"."authz_has_permission"('usuarios.gestionar'::"text")));



ALTER TABLE "public"."usuarios_roles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "usuarios_roles_delete_by_permission" ON "public"."usuarios_roles" FOR DELETE TO "authenticated" USING ("public"."authz_has_permission"('usuarios.roles.gestionar'::"text"));



CREATE POLICY "usuarios_roles_insert_by_permission" ON "public"."usuarios_roles" FOR INSERT TO "authenticated" WITH CHECK ("public"."authz_has_permission"('usuarios.roles.gestionar'::"text"));



CREATE POLICY "usuarios_roles_select_auth_admin" ON "public"."usuarios_roles" FOR SELECT TO "supabase_auth_admin" USING (true);



CREATE POLICY "usuarios_roles_select_own_or_manage" ON "public"."usuarios_roles" FOR SELECT TO "authenticated" USING ((("usuario_id" = "auth"."uid"()) OR "public"."authz_has_permission"('usuarios.ver'::"text") OR "public"."authz_has_permission"('usuarios.roles.gestionar'::"text")));



CREATE POLICY "usuarios_roles_update_by_permission" ON "public"."usuarios_roles" FOR UPDATE TO "authenticated" USING ("public"."authz_has_permission"('usuarios.roles.gestionar'::"text")) WITH CHECK ("public"."authz_has_permission"('usuarios.roles.gestionar'::"text"));





ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."asignatura_mensajes_ia";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."asignaturas";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."plan_mensajes_ia";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."planes_estudio";









GRANT USAGE ON SCHEMA "private" TO "authenticated";
GRANT USAGE ON SCHEMA "private" TO "service_role";



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";
GRANT USAGE ON SCHEMA "public" TO "supabase_auth_admin";


































































































































































































































































REVOKE ALL ON FUNCTION "private"."authz_user_has_global_scope"("p_usuario_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "private"."authz_user_has_global_scope"("p_usuario_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "private"."authz_user_has_global_scope"("p_usuario_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "private"."authz_user_has_permission"("p_usuario_id" "uuid", "p_permiso" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "private"."authz_user_has_permission"("p_usuario_id" "uuid", "p_permiso" "text") TO "authenticated";
GRANT ALL ON FUNCTION "private"."authz_user_has_permission"("p_usuario_id" "uuid", "p_permiso" "text") TO "service_role";



REVOKE ALL ON FUNCTION "private"."authz_user_has_role"("p_usuario_id" "uuid", "p_rol" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "private"."authz_user_has_role"("p_usuario_id" "uuid", "p_rol" "text") TO "authenticated";
GRANT ALL ON FUNCTION "private"."authz_user_has_role"("p_usuario_id" "uuid", "p_rol" "text") TO "service_role";



GRANT ALL ON TABLE "public"."estructuras_asignatura" TO "authenticated";
GRANT ALL ON TABLE "public"."estructuras_asignatura" TO "service_role";



REVOKE ALL ON FUNCTION "public"."actualizar_estructura_asignatura_definicion"("p_id" "uuid", "p_definicion" "jsonb", "p_operaciones" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."actualizar_estructura_asignatura_definicion"("p_id" "uuid", "p_definicion" "jsonb", "p_operaciones" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."actualizar_estructura_asignatura_definicion"("p_id" "uuid", "p_definicion" "jsonb", "p_operaciones" "jsonb") TO "service_role";



GRANT ALL ON TABLE "public"."estructuras_plan" TO "authenticated";
GRANT ALL ON TABLE "public"."estructuras_plan" TO "service_role";



REVOKE ALL ON FUNCTION "public"."actualizar_estructura_plan_definicion"("p_id" "uuid", "p_definicion" "jsonb", "p_operaciones" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."actualizar_estructura_plan_definicion"("p_id" "uuid", "p_definicion" "jsonb", "p_operaciones" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."actualizar_estructura_plan_definicion"("p_id" "uuid", "p_definicion" "jsonb", "p_operaciones" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."aplicar_operaciones_estructura_datos"("p_datos" "jsonb", "p_operaciones" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."aplicar_operaciones_estructura_datos"("p_datos" "jsonb", "p_operaciones" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."append_conversacion_asignatura"("p_id" "uuid", "p_append" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."append_conversacion_asignatura"("p_id" "uuid", "p_append" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."append_conversacion_asignatura"("p_id" "uuid", "p_append" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."append_conversacion_plan"("p_id" "uuid", "p_append" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."append_conversacion_plan"("p_id" "uuid", "p_append" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."append_conversacion_plan"("p_id" "uuid", "p_append" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."authz_admin_override_audit"("p_plan_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."authz_admin_override_audit"("p_plan_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."authz_admin_override_audit"("p_plan_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."authz_admin_override_reason"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."authz_admin_override_reason"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."authz_admin_override_reason"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."authz_asignatura_ia_allowed"("p_asignatura_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."authz_asignatura_ia_allowed"("p_asignatura_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."authz_asignatura_ia_allowed"("p_asignatura_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."authz_asignatura_restricted_field_write_allowed"("p_asignatura_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."authz_asignatura_restricted_field_write_allowed"("p_asignatura_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."authz_asignatura_restricted_field_write_allowed"("p_asignatura_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."authz_asignatura_write_allowed"("p_asignatura_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."authz_asignatura_write_allowed"("p_asignatura_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."authz_asignatura_write_allowed"("p_asignatura_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."authz_campo_asignatura_write_allowed"("p_asignatura_id" "uuid", "p_clave" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."authz_campo_asignatura_write_allowed"("p_asignatura_id" "uuid", "p_clave" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."authz_campo_asignatura_write_allowed"("p_asignatura_id" "uuid", "p_clave" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."authz_campo_plan_write_allowed"("p_plan_id" "uuid", "p_clave" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."authz_campo_plan_write_allowed"("p_plan_id" "uuid", "p_clave" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."authz_campo_plan_write_allowed"("p_plan_id" "uuid", "p_clave" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."authz_can_access_asignatura"("p_asignatura_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."authz_can_access_asignatura"("p_asignatura_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."authz_can_access_asignatura"("p_asignatura_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."authz_can_access_carrera"("p_carrera_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."authz_can_access_carrera"("p_carrera_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."authz_can_access_carrera"("p_carrera_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."authz_can_access_facultad"("p_facultad_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."authz_can_access_facultad"("p_facultad_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."authz_can_access_facultad"("p_facultad_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."authz_can_access_plan"("p_plan_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."authz_can_access_plan"("p_plan_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."authz_can_access_plan"("p_plan_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."authz_has_bootstrap_access"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."authz_has_bootstrap_access"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."authz_has_bootstrap_access"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."authz_has_global_scope"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."authz_has_global_scope"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."authz_has_global_scope"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."authz_has_permission"("p_permiso" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."authz_has_permission"("p_permiso" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."authz_has_permission"("p_permiso" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."authz_has_role"("p_rol" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."authz_has_role"("p_rol" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."authz_has_role"("p_rol" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."authz_is_admin"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."authz_is_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."authz_is_admin"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."authz_is_responsable_asignatura"("p_asignatura_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."authz_is_responsable_asignatura"("p_asignatura_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."authz_is_responsable_asignatura"("p_asignatura_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."authz_is_responsable_de_plan"("p_plan_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."authz_is_responsable_de_plan"("p_plan_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."authz_is_responsable_de_plan"("p_plan_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."authz_is_service_role"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."authz_is_service_role"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."authz_is_service_role"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."authz_plan_ia_allowed"("p_plan_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."authz_plan_ia_allowed"("p_plan_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."authz_plan_ia_allowed"("p_plan_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."authz_plan_restricted_field_write_allowed"("p_plan_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."authz_plan_restricted_field_write_allowed"("p_plan_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."authz_plan_restricted_field_write_allowed"("p_plan_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."authz_plan_write_allowed"("p_plan_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."authz_plan_write_allowed"("p_plan_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."authz_plan_write_allowed"("p_plan_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."borrar_asignaturas_fallidas"() TO "anon";
GRANT ALL ON FUNCTION "public"."borrar_asignaturas_fallidas"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."borrar_asignaturas_fallidas"() TO "service_role";



GRANT ALL ON FUNCTION "public"."borrar_planes_fallidos"() TO "anon";
GRANT ALL ON FUNCTION "public"."borrar_planes_fallidos"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."borrar_planes_fallidos"() TO "service_role";



GRANT ALL ON FUNCTION "public"."build_asignaturas_prefix_tsquery"("p_search" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."build_asignaturas_prefix_tsquery"("p_search" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."build_asignaturas_prefix_tsquery"("p_search" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."custom_access_token_hook"("event" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."custom_access_token_hook"("event" "jsonb") TO "service_role";
GRANT ALL ON FUNCTION "public"."custom_access_token_hook"("event" "jsonb") TO "supabase_auth_admin";



REVOKE ALL ON FUNCTION "public"."datos_validos_con_definicion"("p_definicion" "jsonb", "p_datos" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."datos_validos_con_definicion"("p_definicion" "jsonb", "p_datos" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."datos_validos_con_definicion"("p_definicion" "jsonb", "p_datos" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_ajustar_seriacion_por_cambio_ciclo"() TO "anon";
GRANT ALL ON FUNCTION "public"."fn_ajustar_seriacion_por_cambio_ciclo"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_ajustar_seriacion_por_cambio_ciclo"() TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_asignar_jefe_al_crear_plan"() TO "anon";
GRANT ALL ON FUNCTION "public"."fn_asignar_jefe_al_crear_plan"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_asignar_jefe_al_crear_plan"() TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_asignaturas_update_search_vector"() TO "anon";
GRANT ALL ON FUNCTION "public"."fn_asignaturas_update_search_vector"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_asignaturas_update_search_vector"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."fn_borradores_campo_set_plan_id"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fn_borradores_campo_set_plan_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_borradores_campo_set_plan_id"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."fn_fill_author_from_auth_uid"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fn_fill_author_from_auth_uid"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_fill_author_from_auth_uid"() TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_grant_profesor_on_responsable"() TO "anon";
GRANT ALL ON FUNCTION "public"."fn_grant_profesor_on_responsable"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_grant_profesor_on_responsable"() TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_log_bibliografia_asignatura_cambios"() TO "anon";
GRANT ALL ON FUNCTION "public"."fn_log_bibliografia_asignatura_cambios"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_log_bibliografia_asignatura_cambios"() TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_log_cambios_planes_estudio"() TO "anon";
GRANT ALL ON FUNCTION "public"."fn_log_cambios_planes_estudio"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_log_cambios_planes_estudio"() TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_log_lineas_plan_cambios"() TO "anon";
GRANT ALL ON FUNCTION "public"."fn_log_lineas_plan_cambios"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_log_lineas_plan_cambios"() TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_notificar_cambio_estado_plan"() TO "anon";
GRANT ALL ON FUNCTION "public"."fn_notificar_cambio_estado_plan"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_notificar_cambio_estado_plan"() TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_notificar_comentario_asignatura"() TO "anon";
GRANT ALL ON FUNCTION "public"."fn_notificar_comentario_asignatura"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_notificar_comentario_asignatura"() TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_notificar_comentario_plan"() TO "anon";
GRANT ALL ON FUNCTION "public"."fn_notificar_comentario_plan"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_notificar_comentario_plan"() TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_track_cambios_asignatura"() TO "anon";
GRANT ALL ON FUNCTION "public"."fn_track_cambios_asignatura"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_track_cambios_asignatura"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."fn_validar_asignatura_estructura_plan"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fn_validar_asignatura_estructura_plan"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_validar_asignatura_estructura_plan"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."fn_validar_datos_asignatura"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fn_validar_datos_asignatura"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_validar_datos_asignatura"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."fn_validar_datos_plan"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fn_validar_datos_plan"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_validar_datos_plan"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."json_schema_parcial_definicion"("p_definicion" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."json_schema_parcial_definicion"("p_definicion" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."json_schema_parcial_definicion"("p_definicion" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."nombrar_responsable"("p_usuario" "uuid", "p_rol" "uuid", "p_facultad" "uuid", "p_carrera" "uuid", "p_actor" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."nombrar_responsable"("p_usuario" "uuid", "p_rol" "uuid", "p_facultad" "uuid", "p_carrera" "uuid", "p_actor" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."normalizar_datos_por_definicion"("p_datos" "jsonb", "p_definicion" "jsonb", "p_null_invalid" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."normalizar_datos_por_definicion"("p_datos" "jsonb", "p_definicion" "jsonb", "p_null_invalid" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."normalizar_datos_por_definicion"("p_datos" "jsonb", "p_definicion" "jsonb", "p_null_invalid" boolean) TO "service_role";



REVOKE ALL ON FUNCTION "public"."normalizar_valor_por_propiedad"("p_value" "jsonb", "p_prop" "jsonb", "p_null_invalid" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."normalizar_valor_por_propiedad"("p_value" "jsonb", "p_prop" "jsonb", "p_null_invalid" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."normalizar_valor_por_propiedad"("p_value" "jsonb", "p_prop" "jsonb", "p_null_invalid" boolean) TO "service_role";



REVOKE ALL ON FUNCTION "public"."plan_estado_clave"("p_plan_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."plan_estado_clave"("p_plan_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."plan_estado_clave"("p_plan_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."propiedad_restriccion_estados"("p_prop" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."propiedad_restriccion_estados"("p_prop" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."propiedad_restriccion_estados"("p_prop" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."propiedad_restriccion_permiso"("p_prop" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."propiedad_restriccion_permiso"("p_prop" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."propiedad_restriccion_permiso"("p_prop" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."propiedad_tiene_restriccion"("p_prop" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."propiedad_tiene_restriccion"("p_prop" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."propiedad_tiene_restriccion"("p_prop" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."reasignar_responsabilidades"("p_origen" "uuid", "p_destino" "uuid", "p_actor" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."reasignar_responsabilidades"("p_origen" "uuid", "p_destino" "uuid", "p_actor" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."reasignar_responsabilidades"("p_origen" "uuid", "p_destino" "uuid", "p_actor" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."reasignar_responsabilidades"("p_origen" "uuid", "p_destino" "uuid", "p_actor" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."recalcular_vectores_asignaturas"() TO "anon";
GRANT ALL ON FUNCTION "public"."recalcular_vectores_asignaturas"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."recalcular_vectores_asignaturas"() TO "service_role";



GRANT ALL ON FUNCTION "public"."search_asignaturas"("p_search" "text", "p_facultad_id" "uuid", "p_carrera_id" "uuid", "p_plan_estudio_id" "uuid", "p_limit" integer, "p_offset" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."search_asignaturas"("p_search" "text", "p_facultad_id" "uuid", "p_carrera_id" "uuid", "p_plan_estudio_id" "uuid", "p_limit" integer, "p_offset" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."search_asignaturas"("p_search" "text", "p_facultad_id" "uuid", "p_carrera_id" "uuid", "p_plan_estudio_id" "uuid", "p_limit" integer, "p_offset" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."set_actualizado_en"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_actualizado_en"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_actualizado_en"() TO "service_role";



GRANT ALL ON FUNCTION "public"."suma_porcentajes"("jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."suma_porcentajes"("jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."suma_porcentajes"("jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."tipo_propiedad_json_schema"("p_prop" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."tipo_propiedad_json_schema"("p_prop" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."tipo_propiedad_json_schema"("p_prop" "jsonb") TO "service_role";



GRANT ALL ON TABLE "public"."estados_plan" TO "authenticated";
GRANT ALL ON TABLE "public"."estados_plan" TO "service_role";



REVOKE ALL ON FUNCTION "public"."transiciones_permitidas_plan"("p_plan_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."transiciones_permitidas_plan"("p_plan_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."transiciones_permitidas_plan"("p_plan_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."unaccent_immutable"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."unaccent_immutable"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."unaccent_immutable"("text") TO "service_role";


REVOKE ALL ON FUNCTION "public"."usuario_es_externo_asignado_plan"("p_usuario_id" "uuid", "p_plan_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."usuario_es_externo_asignado_plan"("p_usuario_id" "uuid", "p_plan_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."usuario_es_externo_asignado_plan"("p_usuario_id" "uuid", "p_plan_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."usuario_es_jefe_encargado_plan"("p_usuario_id" "uuid", "p_plan_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."usuario_es_jefe_encargado_plan"("p_usuario_id" "uuid", "p_plan_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."usuario_es_jefe_encargado_plan"("p_usuario_id" "uuid", "p_plan_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."usuario_puede_acceder_plan"("p_usuario_id" "uuid", "p_plan_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."usuario_puede_acceder_plan"("p_usuario_id" "uuid", "p_plan_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."usuario_puede_acceder_plan"("p_usuario_id" "uuid", "p_plan_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."usuario_puede_comentar_asignatura"("p_usuario_id" "uuid", "p_asignatura_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."usuario_puede_comentar_asignatura"("p_usuario_id" "uuid", "p_asignatura_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."usuario_puede_comentar_asignatura"("p_usuario_id" "uuid", "p_asignatura_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."usuario_puede_comentar_plan"("p_usuario_id" "uuid", "p_plan_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."usuario_puede_comentar_plan"("p_usuario_id" "uuid", "p_plan_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."usuario_puede_comentar_plan"("p_usuario_id" "uuid", "p_plan_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."usuario_puede_editar_asignatura"("p_usuario_id" "uuid", "p_asignatura_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."usuario_puede_editar_asignatura"("p_usuario_id" "uuid", "p_asignatura_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."usuario_puede_editar_asignatura"("p_usuario_id" "uuid", "p_asignatura_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."usuario_puede_editar_campo_asignatura"("p_usuario_id" "uuid", "p_asignatura_id" "uuid", "p_clave" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."usuario_puede_editar_campo_asignatura"("p_usuario_id" "uuid", "p_asignatura_id" "uuid", "p_clave" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."usuario_puede_editar_campo_asignatura"("p_usuario_id" "uuid", "p_asignatura_id" "uuid", "p_clave" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."usuario_puede_editar_campo_plan"("p_usuario_id" "uuid", "p_plan_id" "uuid", "p_clave" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."usuario_puede_editar_campo_plan"("p_usuario_id" "uuid", "p_plan_id" "uuid", "p_clave" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."usuario_puede_editar_campo_plan"("p_usuario_id" "uuid", "p_plan_id" "uuid", "p_clave" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."usuario_puede_editar_plan"("p_usuario_id" "uuid", "p_plan_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."usuario_puede_editar_plan"("p_usuario_id" "uuid", "p_plan_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."usuario_puede_editar_plan"("p_usuario_id" "uuid", "p_plan_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."usuario_puede_transicionar_asignatura"("p_usuario_id" "uuid", "p_asignatura_id" "uuid", "p_nuevo_estado" "public"."estado_asignatura") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."usuario_puede_transicionar_asignatura"("p_usuario_id" "uuid", "p_asignatura_id" "uuid", "p_nuevo_estado" "public"."estado_asignatura") TO "authenticated";
GRANT ALL ON FUNCTION "public"."usuario_puede_transicionar_asignatura"("p_usuario_id" "uuid", "p_asignatura_id" "uuid", "p_nuevo_estado" "public"."estado_asignatura") TO "service_role";



REVOKE ALL ON FUNCTION "public"."usuario_puede_transicionar_plan"("p_usuario_id" "uuid", "p_plan_id" "uuid", "p_hacia_estado_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."usuario_puede_transicionar_plan"("p_usuario_id" "uuid", "p_plan_id" "uuid", "p_hacia_estado_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."usuario_puede_transicionar_plan"("p_usuario_id" "uuid", "p_plan_id" "uuid", "p_hacia_estado_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."usuario_puede_usar_ia_asignatura"("p_usuario_id" "uuid", "p_asignatura_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."usuario_puede_usar_ia_asignatura"("p_usuario_id" "uuid", "p_asignatura_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."usuario_puede_usar_ia_asignatura"("p_usuario_id" "uuid", "p_asignatura_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."usuario_puede_usar_ia_plan"("p_usuario_id" "uuid", "p_plan_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."usuario_puede_usar_ia_plan"("p_usuario_id" "uuid", "p_plan_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."usuario_puede_usar_ia_plan"("p_usuario_id" "uuid", "p_plan_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."usuario_tiene_permiso"("p_usuario_id" "uuid", "p_permiso" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."usuario_tiene_permiso"("p_usuario_id" "uuid", "p_permiso" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."usuario_tiene_permiso"("p_usuario_id" "uuid", "p_permiso" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."usuario_tiene_rol_contextual_plan"("p_usuario_id" "uuid", "p_plan_id" "uuid", "p_rol" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."usuario_tiene_rol_contextual_plan"("p_usuario_id" "uuid", "p_plan_id" "uuid", "p_rol" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."usuario_tiene_rol_contextual_plan"("p_usuario_id" "uuid", "p_plan_id" "uuid", "p_rol" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."usuario_tiene_rol_en_plan"("p_usuario_id" "uuid", "p_plan_id" "uuid", "p_rol" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."usuario_tiene_rol_en_plan"("p_usuario_id" "uuid", "p_plan_id" "uuid", "p_rol" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."usuario_tiene_rol_en_plan"("p_usuario_id" "uuid", "p_plan_id" "uuid", "p_rol" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."validar_numero_ciclo_asignatura"() TO "anon";
GRANT ALL ON FUNCTION "public"."validar_numero_ciclo_asignatura"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."validar_numero_ciclo_asignatura"() TO "service_role";



GRANT ALL ON FUNCTION "public"."validar_prerrequisito_asignatura"() TO "anon";
GRANT ALL ON FUNCTION "public"."validar_prerrequisito_asignatura"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."validar_prerrequisito_asignatura"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."valor_jsonb_vacio"("p_value" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."valor_jsonb_vacio"("p_value" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."valor_jsonb_vacio"("p_value" "jsonb") TO "service_role";

































GRANT ALL ON TABLE "public"."archivos" TO "authenticated";
GRANT ALL ON TABLE "public"."archivos" TO "service_role";



GRANT ALL ON TABLE "public"."archivos_repositorios" TO "authenticated";
GRANT ALL ON TABLE "public"."archivos_repositorios" TO "service_role";



GRANT ALL ON TABLE "public"."asignatura_mensajes_ia" TO "authenticated";
GRANT ALL ON TABLE "public"."asignatura_mensajes_ia" TO "service_role";



GRANT ALL ON TABLE "public"."asignaturas" TO "authenticated";
GRANT ALL ON TABLE "public"."asignaturas" TO "service_role";



GRANT ALL ON TABLE "public"."bibliografia_asignatura" TO "authenticated";
GRANT ALL ON TABLE "public"."bibliografia_asignatura" TO "service_role";



GRANT ALL ON TABLE "public"."borradores_campo" TO "anon";
GRANT ALL ON TABLE "public"."borradores_campo" TO "authenticated";
GRANT ALL ON TABLE "public"."borradores_campo" TO "service_role";



GRANT ALL ON TABLE "public"."cambios_asignatura" TO "authenticated";
GRANT ALL ON TABLE "public"."cambios_asignatura" TO "service_role";



GRANT ALL ON TABLE "public"."cambios_plan" TO "authenticated";
GRANT ALL ON TABLE "public"."cambios_plan" TO "service_role";



GRANT ALL ON TABLE "public"."carreras" TO "authenticated";
GRANT ALL ON TABLE "public"."carreras" TO "service_role";



GRANT ALL ON TABLE "public"."comentarios_asignatura" TO "authenticated";
GRANT ALL ON TABLE "public"."comentarios_asignatura" TO "service_role";



GRANT ALL ON TABLE "public"."comentarios_plan" TO "authenticated";
GRANT ALL ON TABLE "public"."comentarios_plan" TO "service_role";



GRANT ALL ON TABLE "public"."conversaciones_asignatura" TO "authenticated";
GRANT ALL ON TABLE "public"."conversaciones_asignatura" TO "service_role";



GRANT ALL ON TABLE "public"."conversaciones_plan" TO "authenticated";
GRANT ALL ON TABLE "public"."conversaciones_plan" TO "service_role";



GRANT ALL ON TABLE "public"."crash_reports" TO "service_role";
GRANT INSERT ON TABLE "public"."crash_reports" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."crash_reports" TO "authenticated";



GRANT ALL ON TABLE "public"."expertos" TO "authenticated";
GRANT ALL ON TABLE "public"."expertos" TO "service_role";



GRANT ALL ON TABLE "public"."facultades" TO "authenticated";
GRANT ALL ON TABLE "public"."facultades" TO "service_role";



GRANT ALL ON TABLE "public"."interacciones_ia" TO "authenticated";
GRANT ALL ON TABLE "public"."interacciones_ia" TO "service_role";



GRANT ALL ON TABLE "public"."lineas_curriculares_sugeridas" TO "authenticated";
GRANT ALL ON TABLE "public"."lineas_curriculares_sugeridas" TO "service_role";



GRANT ALL ON TABLE "public"."lineas_plan" TO "authenticated";
GRANT ALL ON TABLE "public"."lineas_plan" TO "service_role";



GRANT ALL ON TABLE "public"."notificaciones" TO "authenticated";
GRANT ALL ON TABLE "public"."notificaciones" TO "service_role";



GRANT ALL ON TABLE "public"."permisos" TO "authenticated";
GRANT ALL ON TABLE "public"."permisos" TO "service_role";
GRANT SELECT ON TABLE "public"."permisos" TO "supabase_auth_admin";



GRANT ALL ON TABLE "public"."plan_expertos" TO "authenticated";
GRANT ALL ON TABLE "public"."plan_expertos" TO "service_role";



GRANT ALL ON TABLE "public"."plan_mensajes_ia" TO "authenticated";
GRANT ALL ON TABLE "public"."plan_mensajes_ia" TO "service_role";



GRANT ALL ON TABLE "public"."planes_estudio" TO "authenticated";
GRANT ALL ON TABLE "public"."planes_estudio" TO "service_role";



GRANT ALL ON TABLE "public"."plantilla_asignatura" TO "anon";
GRANT ALL ON TABLE "public"."plantilla_asignatura" TO "authenticated";
GRANT ALL ON TABLE "public"."plantilla_asignatura" TO "service_role";



GRANT ALL ON TABLE "public"."plantilla_plan" TO "anon";
GRANT ALL ON TABLE "public"."plantilla_plan" TO "authenticated";
GRANT ALL ON TABLE "public"."plantilla_plan" TO "service_role";



GRANT ALL ON TABLE "public"."reasignaciones" TO "anon";
GRANT ALL ON TABLE "public"."reasignaciones" TO "authenticated";
GRANT ALL ON TABLE "public"."reasignaciones" TO "service_role";



GRANT ALL ON TABLE "public"."repositorios" TO "authenticated";
GRANT ALL ON TABLE "public"."repositorios" TO "service_role";



GRANT ALL ON TABLE "public"."responsables_asignatura" TO "authenticated";
GRANT ALL ON TABLE "public"."responsables_asignatura" TO "service_role";



GRANT ALL ON TABLE "public"."roles" TO "authenticated";
GRANT ALL ON TABLE "public"."roles" TO "service_role";
GRANT SELECT ON TABLE "public"."roles" TO "supabase_auth_admin";



GRANT ALL ON TABLE "public"."roles_permisos" TO "authenticated";
GRANT ALL ON TABLE "public"."roles_permisos" TO "service_role";
GRANT SELECT ON TABLE "public"."roles_permisos" TO "supabase_auth_admin";



GRANT ALL ON TABLE "public"."tareas_revision" TO "authenticated";
GRANT ALL ON TABLE "public"."tareas_revision" TO "service_role";



GRANT ALL ON TABLE "public"."transiciones_estado_plan" TO "authenticated";
GRANT ALL ON TABLE "public"."transiciones_estado_plan" TO "service_role";



GRANT ALL ON TABLE "public"."usuarios_app" TO "authenticated";
GRANT ALL ON TABLE "public"."usuarios_app" TO "service_role";
GRANT SELECT ON TABLE "public"."usuarios_app" TO "supabase_auth_admin";



GRANT ALL ON TABLE "public"."usuarios_roles" TO "authenticated";
GRANT ALL ON TABLE "public"."usuarios_roles" TO "service_role";
GRANT SELECT ON TABLE "public"."usuarios_roles" TO "supabase_auth_admin";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";
































--
-- Application-owned storage policies.
-- Auth/storage base constraints, RLS, and grants are managed by Supabase.
--


CREATE POLICY "acceso a todos en desarrollo dx3g7q_0" ON "storage"."objects" FOR SELECT USING (("bucket_id" = 'ai-storage'::"text"));



CREATE POLICY "acceso a todos en desarrollo dx3g7q_1" ON "storage"."objects" FOR INSERT WITH CHECK (("bucket_id" = 'ai-storage'::"text"));



CREATE POLICY "acceso a todos en desarrollo dx3g7q_2" ON "storage"."objects" FOR UPDATE USING (("bucket_id" = 'ai-storage'::"text"));



CREATE POLICY "acceso a todos en desarrollo dx3g7q_3" ON "storage"."objects" FOR DELETE USING (("bucket_id" = 'ai-storage'::"text"));



CREATE POLICY "avatars_authenticated_delete" ON "storage"."objects" FOR DELETE TO "authenticated" USING (("bucket_id" = 'avatars'::"text"));



CREATE POLICY "avatars_authenticated_insert" ON "storage"."objects" FOR INSERT TO "authenticated" WITH CHECK (("bucket_id" = 'avatars'::"text"));



CREATE POLICY "avatars_authenticated_update" ON "storage"."objects" FOR UPDATE TO "authenticated" USING (("bucket_id" = 'avatars'::"text")) WITH CHECK (("bucket_id" = 'avatars'::"text"));



CREATE POLICY "avatars_public_read" ON "storage"."objects" FOR SELECT USING (("bucket_id" = 'avatars'::"text"));



CREATE POLICY "todos los permisos dx3g7q_0" ON "storage"."objects" FOR INSERT WITH CHECK (("bucket_id" = 'ai-storage'::"text"));



CREATE POLICY "todos los permisos dx3g7q_1" ON "storage"."objects" FOR SELECT USING (("bucket_id" = 'ai-storage'::"text"));



CREATE POLICY "todos los permisos dx3g7q_2" ON "storage"."objects" FOR DELETE USING (("bucket_id" = 'ai-storage'::"text"));



CREATE POLICY "todos los permisos dx3g7q_3" ON "storage"."objects" FOR UPDATE USING (("bucket_id" = 'ai-storage'::"text"));













































































































































-- -----------------------------------------------------------------------------
-- Acad-IA v2.0 baseline data
-- Supabase migration squash dumps schema only; these rows are domain catalogs
-- and operational resources required by a fresh hosted/self-hosted install.
-- -----------------------------------------------------------------------------

INSERT INTO public.estados_plan VALUES ('18f49b67-8077-4371-be6e-2019a3be3562', 'BORRADOR', 'Borrador del jefe de carrera', 10, false, '#94a3b8', true) ON CONFLICT DO NOTHING;
INSERT INTO public.estados_plan VALUES ('40b640aa-3ec3-430c-9eb6-90f5ceffbbf7', 'REVISION', 'En revisión de secretario académico', 20, false, '#f59e0b', true) ON CONFLICT DO NOTHING;
INSERT INTO public.estados_plan VALUES ('5135e4bc-beed-4d53-be94-66b0748a98e6', 'REV_PLANEACION', 'En revisión de Planeación Curricular', 30, false, '#eab308', true) ON CONFLICT DO NOTHING;
INSERT INTO public.estados_plan VALUES ('b607605f-944c-47c0-8fa7-912759bb0fa8', 'CONSULTA_EXPERTOS', 'En consulta con expertos externos', 40, false, '#a855f7', true) ON CONFLICT DO NOTHING;
INSERT INTO public.estados_plan VALUES ('d1c2722e-8b1b-459b-a239-3d6048896f3f', 'REV_SEDES', 'En revisión de otras sedes', 50, false, '#8b5cf6', true) ON CONFLICT DO NOTHING;
INSERT INTO public.estados_plan VALUES ('5403e167-8e89-4c5e-8635-1e8fe16ae32b', 'CONSEJO_FACULTAD', 'En Consejo Académico de Facultad', 60, false, '#3b82f6', true) ON CONFLICT DO NOTHING;
INSERT INTO public.estados_plan VALUES ('c3e58264-3bbf-4519-a100-0a6448ca0870', 'CONSEJO_UNIVERSITARIO', 'En Consejo Universitario', 70, false, '#2563eb', true) ON CONFLICT DO NOTHING;
INSERT INTO public.estados_plan VALUES ('2d6e72e8-7d33-45ef-be1c-29eb3c05911c', 'JUNTA_GOBIERNO', 'En Junta de Gobierno', 80, false, '#1d4ed8', true) ON CONFLICT DO NOTHING;
INSERT INTO public.estados_plan VALUES ('458beda3-8c52-4a46-b303-6df5413365fb', 'ENVIADO_SEP', 'En diálogo por ACERT', 90, false, '#0ea5e9', true) ON CONFLICT DO NOTHING;
INSERT INTO public.estados_plan VALUES ('8c577fca-4b11-44fb-bb50-529f7a929aaf', 'RECHAZADO', 'Rechazado', 110, true, '#ef4444', false) ON CONFLICT DO NOTHING;
INSERT INTO public.estados_plan VALUES ('f01c06c2-1166-46db-9e49-5d74b4190a0e', 'APROBADO', 'Aprobado por ACERT', 100, true, '#22c55e', false) ON CONFLICT DO NOTHING;
INSERT INTO public.estados_plan VALUES ('f2abc804-1d7e-40d5-81bd-02f3a8e48f6f', 'GENERANDO', 'Generando con IA', 0, false, '#fb923c', false) ON CONFLICT DO NOTHING;
INSERT INTO public.estados_plan VALUES ('e3cd5cdc-1391-43ca-87a1-031b704e4a78', 'FALLIDO', 'Generación fallida', -10, false, '#f87171', false) ON CONFLICT DO NOTHING;
INSERT INTO public.permisos VALUES ('d38b6015-e577-4983-91f3-e4eca7a84232', 'usuarios.ver', 'Ver usuarios', 'Consultar perfiles, estados y alcances de usuarios', 'usuarios', 10, '2026-06-23 22:59:16.349981+00') ON CONFLICT DO NOTHING;
INSERT INTO public.permisos VALUES ('fccb8f58-d37f-476f-9b4b-770697111949', 'usuarios.gestionar', 'Gestionar usuarios', 'Crear, reactivar, dar de baja e invitar usuarios', 'usuarios', 20, '2026-06-23 22:59:16.349981+00') ON CONFLICT DO NOTHING;
INSERT INTO public.permisos VALUES ('67a7d9c5-5689-4a97-a009-5834866d46bc', 'usuarios.roles.gestionar', 'Gestionar roles', 'Asignar y retirar roles y alcances institucionales', 'usuarios', 30, '2026-06-23 22:59:16.349981+00') ON CONFLICT DO NOTHING;
INSERT INTO public.permisos VALUES ('ea4eab2a-2852-484d-a26f-9d47655c3114', 'planes.ver', 'Ver planes', 'Consultar planes de estudio dentro del alcance', 'planes', 10, '2026-06-23 22:59:16.349981+00') ON CONFLICT DO NOTHING;
INSERT INTO public.permisos VALUES ('974d5ee3-3995-439c-aeeb-7079ee23955a', 'planes.crear', 'Crear planes', 'Crear planes de estudio dentro del alcance', 'planes', 20, '2026-06-23 22:59:16.349981+00') ON CONFLICT DO NOTHING;
INSERT INTO public.permisos VALUES ('934b02b3-d211-4d68-88d4-e84e71fcf74c', 'planes.editar', 'Editar planes', 'Modificar datos generales, mapas y estructura del plan', 'planes', 30, '2026-06-23 22:59:16.349981+00') ON CONFLICT DO NOTHING;
INSERT INTO public.permisos VALUES ('b2509bb8-7b72-4648-ae41-3f771e6f9e00', 'planes.enviar_revision', 'Enviar a revisión', 'Enviar planes a revisión académica', 'planes', 40, '2026-06-23 22:59:16.349981+00') ON CONFLICT DO NOTHING;
INSERT INTO public.permisos VALUES ('252f5df0-8e7b-420b-91dd-6e762f77be87', 'planes.aprobar', 'Aprobar planes', 'Aprobar, rechazar o transicionar estados de revisión', 'planes', 50, '2026-06-23 22:59:16.349981+00') ON CONFLICT DO NOTHING;
INSERT INTO public.permisos VALUES ('11ac1f97-5b2e-42ff-9747-15dcbc665bda', 'asignaturas.ver', 'Ver asignaturas', 'Consultar asignaturas dentro del alcance', 'asignaturas', 10, '2026-06-23 22:59:16.349981+00') ON CONFLICT DO NOTHING;
INSERT INTO public.permisos VALUES ('8977a7af-0115-4af8-a506-19a506d513e2', 'asignaturas.editar', 'Editar asignaturas', 'Crear o modificar asignaturas y contenido académico', 'asignaturas', 20, '2026-06-23 22:59:16.349981+00') ON CONFLICT DO NOTHING;
INSERT INTO public.permisos VALUES ('f13446d3-92dc-4e0b-b72d-4c17dda11534', 'asignaturas.responsables.gestionar', 'Gestionar responsables de asignatura', 'Asignar profesores responsables, coautores y revisores', 'asignaturas', 30, '2026-06-23 22:59:16.349981+00') ON CONFLICT DO NOTHING;
INSERT INTO public.permisos VALUES ('283f82a5-966a-4027-bb7d-888433dc2a98', 'comentarios.externos.crear', 'Comentar como externo', 'Registrar observaciones y retroalimentación externa', 'revision', 10, '2026-06-23 22:59:16.349981+00') ON CONFLICT DO NOTHING;
INSERT INTO public.permisos VALUES ('df8292fc-a91c-4595-940f-f235efcca166', 'auditoria.ver', 'Ver trazabilidad', 'Consultar historial de cambios y autoría', 'auditoria', 10, '2026-06-23 22:59:16.349981+00') ON CONFLICT DO NOTHING;
INSERT INTO public.permisos VALUES ('ebf05eda-3928-42fe-99d1-ce99b66edfe2', 'catalogos.gestionar', 'Gestionar catálogos', 'Administrar facultades, carreras, estructuras y estados', 'catalogos', 10, '2026-06-23 22:59:16.349981+00') ON CONFLICT DO NOTHING;
INSERT INTO public.permisos VALUES ('7dc68ce2-ddda-4142-aa3e-eb33ebe4949c', 'archivos.ver', 'Ver archivos', 'Consultar repositorios y archivos de referencia propios o compartidos', 'archivos', 10, '2026-06-23 22:59:16.394005+00') ON CONFLICT DO NOTHING;
INSERT INTO public.permisos VALUES ('06dcb04d-b057-4019-8d01-05efd204449e', 'archivos.gestionar', 'Gestionar archivos', 'Crear, actualizar y retirar repositorios y archivos de referencia', 'archivos', 20, '2026-06-23 22:59:16.394005+00') ON CONFLICT DO NOTHING;
INSERT INTO public.permisos VALUES ('98ae7b9d-6af9-4e5c-a6f5-9c8c63eed68c', 'comentarios.crear', 'Comentar planes y materias', 'Registrar observaciones internas por fase del flujo', 'revision', 20, '2026-06-23 22:59:16.51558+00') ON CONFLICT DO NOTHING;
INSERT INTO public.permisos VALUES ('ca9e0a8f-eef3-4355-9833-76f72822e4a2', 'asignaturas.aprobar', 'Aprobar asignaturas', 'Aprobar o devolver asignaturas en revisión', 'asignaturas', 40, '2026-06-23 22:59:16.51558+00') ON CONFLICT DO NOTHING;
INSERT INTO public.permisos VALUES ('c091b335-3845-434a-94b6-d609e89da8a0', 'expertos.gestionar', 'Gestionar expertos y sedes', 'Registrar expertos/sedes e invitarlos a participar en un plan', 'revision', 30, '2026-06-23 22:59:16.51558+00') ON CONFLICT DO NOTHING;
INSERT INTO public.permisos VALUES ('8e03d5a7-ac6d-43cf-940f-964c72f118f4', 'ia.usar', 'Usar IA', 'Generar o mejorar contenido académico con IA', 'ia', 10, '2026-06-23 22:59:16.609924+00') ON CONFLICT DO NOTHING;
INSERT INTO public.permisos VALUES ('dacc599b-e892-4671-ad5e-f2bcff5a367f', 'planes.campos_restringidos.editar', 'Editar campos restringidos', 'Llenar campos estructurales restringidos por estado del plan', 'planes', 60, '2026-06-29 14:25:13.547209+00') ON CONFLICT DO NOTHING;
INSERT INTO public.roles VALUES ('10a15e96-2695-48f1-8f9b-f78e4c73261c', 'ADMIN', 'Administrador', 'Acceso total al sistema', 0, 'global') ON CONFLICT DO NOTHING;
INSERT INTO public.roles VALUES ('553664be-57f2-41f1-af18-aeda06d89187', 'VICERRECTOR_ACADEMICO', 'Vicerrector Académico', 'Supervisa todas las facultades y direcciones académicas', 10, 'global') ON CONFLICT DO NOTHING;
INSERT INTO public.roles VALUES ('dddd7e74-6b26-42f8-af39-40eb3501e1cb', 'DIRECTOR_FACULTAD', 'Director de Facultad', 'Gestiona planes y usuarios de una facultad', 20, 'facultad') ON CONFLICT DO NOTHING;
INSERT INTO public.roles VALUES ('0acb1b8b-c767-47c4-b89d-b5e7a80681a9', 'SECRETARIO_ACADEMICO', 'Secretario Académico', 'Revisa, valida y da seguimiento académico a planes', 30, 'facultad') ON CONFLICT DO NOTHING;
INSERT INTO public.roles VALUES ('2477d9a6-43e4-455f-8d67-a1388bdaff94', 'JEFE_CARRERA', 'Jefe de Carrera', 'Gestiona planes de estudio de una carrera', 40, 'carrera') ON CONFLICT DO NOTHING;
INSERT INTO public.roles VALUES ('59eea12f-63c9-4c62-a585-809d9cc55af8', 'EVALUADOR_EXTERNO', 'Evaluador Externo', 'Consulta planes asignados y registra retroalimentación externa', 60, 'externo') ON CONFLICT DO NOTHING;
INSERT INTO public.roles VALUES ('83de37ee-358b-45ab-bd15-982af0c6f8ef', 'PROFESOR', 'Profesor', 'Responsable o coautor de asignaturas', 50, 'asignatura') ON CONFLICT DO NOTHING;
INSERT INTO public.roles VALUES ('85eb3f8a-0583-417b-b689-c9420f0e79dd', 'PLANEACION_CURRICULAR', 'Planeación Curricular', 'Acompaña y valida la redacción curricular; enlace con la SEP', 35, 'global') ON CONFLICT DO NOTHING;
INSERT INTO public.roles VALUES ('1ab69ac9-b29b-42de-bb83-861a9af05e3f', 'COORD_DHP', 'Coordinación de Desarrollo Humano Profesional', 'Gestiona materias de desarrollo humano profesional propagadas a los planes', 45, 'facultad') ON CONFLICT DO NOTHING;
INSERT INTO public.roles_permisos VALUES ('10a15e96-2695-48f1-8f9b-f78e4c73261c', 'ebf05eda-3928-42fe-99d1-ce99b66edfe2', '2026-06-23 22:59:16.349981+00') ON CONFLICT DO NOTHING;
INSERT INTO public.roles_permisos VALUES ('10a15e96-2695-48f1-8f9b-f78e4c73261c', 'df8292fc-a91c-4595-940f-f235efcca166', '2026-06-23 22:59:16.349981+00') ON CONFLICT DO NOTHING;
INSERT INTO public.roles_permisos VALUES ('10a15e96-2695-48f1-8f9b-f78e4c73261c', '283f82a5-966a-4027-bb7d-888433dc2a98', '2026-06-23 22:59:16.349981+00') ON CONFLICT DO NOTHING;
INSERT INTO public.roles_permisos VALUES ('10a15e96-2695-48f1-8f9b-f78e4c73261c', 'f13446d3-92dc-4e0b-b72d-4c17dda11534', '2026-06-23 22:59:16.349981+00') ON CONFLICT DO NOTHING;
INSERT INTO public.roles_permisos VALUES ('10a15e96-2695-48f1-8f9b-f78e4c73261c', '8977a7af-0115-4af8-a506-19a506d513e2', '2026-06-23 22:59:16.349981+00') ON CONFLICT DO NOTHING;
INSERT INTO public.roles_permisos VALUES ('10a15e96-2695-48f1-8f9b-f78e4c73261c', '11ac1f97-5b2e-42ff-9747-15dcbc665bda', '2026-06-23 22:59:16.349981+00') ON CONFLICT DO NOTHING;
INSERT INTO public.roles_permisos VALUES ('10a15e96-2695-48f1-8f9b-f78e4c73261c', '252f5df0-8e7b-420b-91dd-6e762f77be87', '2026-06-23 22:59:16.349981+00') ON CONFLICT DO NOTHING;
INSERT INTO public.roles_permisos VALUES ('10a15e96-2695-48f1-8f9b-f78e4c73261c', 'b2509bb8-7b72-4648-ae41-3f771e6f9e00', '2026-06-23 22:59:16.349981+00') ON CONFLICT DO NOTHING;
INSERT INTO public.roles_permisos VALUES ('10a15e96-2695-48f1-8f9b-f78e4c73261c', '934b02b3-d211-4d68-88d4-e84e71fcf74c', '2026-06-23 22:59:16.349981+00') ON CONFLICT DO NOTHING;
INSERT INTO public.roles_permisos VALUES ('10a15e96-2695-48f1-8f9b-f78e4c73261c', '974d5ee3-3995-439c-aeeb-7079ee23955a', '2026-06-23 22:59:16.349981+00') ON CONFLICT DO NOTHING;
INSERT INTO public.roles_permisos VALUES ('10a15e96-2695-48f1-8f9b-f78e4c73261c', 'ea4eab2a-2852-484d-a26f-9d47655c3114', '2026-06-23 22:59:16.349981+00') ON CONFLICT DO NOTHING;
INSERT INTO public.roles_permisos VALUES ('10a15e96-2695-48f1-8f9b-f78e4c73261c', '67a7d9c5-5689-4a97-a009-5834866d46bc', '2026-06-23 22:59:16.349981+00') ON CONFLICT DO NOTHING;
INSERT INTO public.roles_permisos VALUES ('10a15e96-2695-48f1-8f9b-f78e4c73261c', 'fccb8f58-d37f-476f-9b4b-770697111949', '2026-06-23 22:59:16.349981+00') ON CONFLICT DO NOTHING;
INSERT INTO public.roles_permisos VALUES ('10a15e96-2695-48f1-8f9b-f78e4c73261c', 'd38b6015-e577-4983-91f3-e4eca7a84232', '2026-06-23 22:59:16.349981+00') ON CONFLICT DO NOTHING;
INSERT INTO public.roles_permisos VALUES ('553664be-57f2-41f1-af18-aeda06d89187', 'df8292fc-a91c-4595-940f-f235efcca166', '2026-06-23 22:59:16.349981+00') ON CONFLICT DO NOTHING;
INSERT INTO public.roles_permisos VALUES ('553664be-57f2-41f1-af18-aeda06d89187', '11ac1f97-5b2e-42ff-9747-15dcbc665bda', '2026-06-23 22:59:16.349981+00') ON CONFLICT DO NOTHING;
INSERT INTO public.roles_permisos VALUES ('553664be-57f2-41f1-af18-aeda06d89187', '252f5df0-8e7b-420b-91dd-6e762f77be87', '2026-06-23 22:59:16.349981+00') ON CONFLICT DO NOTHING;
INSERT INTO public.roles_permisos VALUES ('553664be-57f2-41f1-af18-aeda06d89187', 'ea4eab2a-2852-484d-a26f-9d47655c3114', '2026-06-23 22:59:16.349981+00') ON CONFLICT DO NOTHING;
INSERT INTO public.roles_permisos VALUES ('553664be-57f2-41f1-af18-aeda06d89187', 'd38b6015-e577-4983-91f3-e4eca7a84232', '2026-06-23 22:59:16.349981+00') ON CONFLICT DO NOTHING;
INSERT INTO public.roles_permisos VALUES ('dddd7e74-6b26-42f8-af39-40eb3501e1cb', 'df8292fc-a91c-4595-940f-f235efcca166', '2026-06-23 22:59:16.349981+00') ON CONFLICT DO NOTHING;
INSERT INTO public.roles_permisos VALUES ('dddd7e74-6b26-42f8-af39-40eb3501e1cb', '11ac1f97-5b2e-42ff-9747-15dcbc665bda', '2026-06-23 22:59:16.349981+00') ON CONFLICT DO NOTHING;
INSERT INTO public.roles_permisos VALUES ('dddd7e74-6b26-42f8-af39-40eb3501e1cb', '252f5df0-8e7b-420b-91dd-6e762f77be87', '2026-06-23 22:59:16.349981+00') ON CONFLICT DO NOTHING;
INSERT INTO public.roles_permisos VALUES ('dddd7e74-6b26-42f8-af39-40eb3501e1cb', 'b2509bb8-7b72-4648-ae41-3f771e6f9e00', '2026-06-23 22:59:16.349981+00') ON CONFLICT DO NOTHING;
INSERT INTO public.roles_permisos VALUES ('dddd7e74-6b26-42f8-af39-40eb3501e1cb', '974d5ee3-3995-439c-aeeb-7079ee23955a', '2026-06-23 22:59:16.349981+00') ON CONFLICT DO NOTHING;
INSERT INTO public.roles_permisos VALUES ('dddd7e74-6b26-42f8-af39-40eb3501e1cb', 'ea4eab2a-2852-484d-a26f-9d47655c3114', '2026-06-23 22:59:16.349981+00') ON CONFLICT DO NOTHING;
INSERT INTO public.roles_permisos VALUES ('dddd7e74-6b26-42f8-af39-40eb3501e1cb', 'd38b6015-e577-4983-91f3-e4eca7a84232', '2026-06-23 22:59:16.349981+00') ON CONFLICT DO NOTHING;
INSERT INTO public.roles_permisos VALUES ('0acb1b8b-c767-47c4-b89d-b5e7a80681a9', 'df8292fc-a91c-4595-940f-f235efcca166', '2026-06-23 22:59:16.349981+00') ON CONFLICT DO NOTHING;
INSERT INTO public.roles_permisos VALUES ('0acb1b8b-c767-47c4-b89d-b5e7a80681a9', '8977a7af-0115-4af8-a506-19a506d513e2', '2026-06-23 22:59:16.349981+00') ON CONFLICT DO NOTHING;
INSERT INTO public.roles_permisos VALUES ('0acb1b8b-c767-47c4-b89d-b5e7a80681a9', '11ac1f97-5b2e-42ff-9747-15dcbc665bda', '2026-06-23 22:59:16.349981+00') ON CONFLICT DO NOTHING;
INSERT INTO public.roles_permisos VALUES ('0acb1b8b-c767-47c4-b89d-b5e7a80681a9', '252f5df0-8e7b-420b-91dd-6e762f77be87', '2026-06-23 22:59:16.349981+00') ON CONFLICT DO NOTHING;
INSERT INTO public.roles_permisos VALUES ('0acb1b8b-c767-47c4-b89d-b5e7a80681a9', 'b2509bb8-7b72-4648-ae41-3f771e6f9e00', '2026-06-23 22:59:16.349981+00') ON CONFLICT DO NOTHING;
INSERT INTO public.roles_permisos VALUES ('0acb1b8b-c767-47c4-b89d-b5e7a80681a9', '934b02b3-d211-4d68-88d4-e84e71fcf74c', '2026-06-23 22:59:16.349981+00') ON CONFLICT DO NOTHING;
INSERT INTO public.roles_permisos VALUES ('0acb1b8b-c767-47c4-b89d-b5e7a80681a9', 'ea4eab2a-2852-484d-a26f-9d47655c3114', '2026-06-23 22:59:16.349981+00') ON CONFLICT DO NOTHING;
INSERT INTO public.roles_permisos VALUES ('0acb1b8b-c767-47c4-b89d-b5e7a80681a9', 'd38b6015-e577-4983-91f3-e4eca7a84232', '2026-06-23 22:59:16.349981+00') ON CONFLICT DO NOTHING;
INSERT INTO public.roles_permisos VALUES ('2477d9a6-43e4-455f-8d67-a1388bdaff94', 'df8292fc-a91c-4595-940f-f235efcca166', '2026-06-23 22:59:16.349981+00') ON CONFLICT DO NOTHING;
INSERT INTO public.roles_permisos VALUES ('2477d9a6-43e4-455f-8d67-a1388bdaff94', 'f13446d3-92dc-4e0b-b72d-4c17dda11534', '2026-06-23 22:59:16.349981+00') ON CONFLICT DO NOTHING;
INSERT INTO public.roles_permisos VALUES ('2477d9a6-43e4-455f-8d67-a1388bdaff94', '8977a7af-0115-4af8-a506-19a506d513e2', '2026-06-23 22:59:16.349981+00') ON CONFLICT DO NOTHING;
INSERT INTO public.roles_permisos VALUES ('2477d9a6-43e4-455f-8d67-a1388bdaff94', '11ac1f97-5b2e-42ff-9747-15dcbc665bda', '2026-06-23 22:59:16.349981+00') ON CONFLICT DO NOTHING;
INSERT INTO public.roles_permisos VALUES ('2477d9a6-43e4-455f-8d67-a1388bdaff94', 'b2509bb8-7b72-4648-ae41-3f771e6f9e00', '2026-06-23 22:59:16.349981+00') ON CONFLICT DO NOTHING;
INSERT INTO public.roles_permisos VALUES ('2477d9a6-43e4-455f-8d67-a1388bdaff94', '934b02b3-d211-4d68-88d4-e84e71fcf74c', '2026-06-23 22:59:16.349981+00') ON CONFLICT DO NOTHING;
INSERT INTO public.roles_permisos VALUES ('2477d9a6-43e4-455f-8d67-a1388bdaff94', '974d5ee3-3995-439c-aeeb-7079ee23955a', '2026-06-23 22:59:16.349981+00') ON CONFLICT DO NOTHING;
INSERT INTO public.roles_permisos VALUES ('2477d9a6-43e4-455f-8d67-a1388bdaff94', 'ea4eab2a-2852-484d-a26f-9d47655c3114', '2026-06-23 22:59:16.349981+00') ON CONFLICT DO NOTHING;
INSERT INTO public.roles_permisos VALUES ('2477d9a6-43e4-455f-8d67-a1388bdaff94', 'd38b6015-e577-4983-91f3-e4eca7a84232', '2026-06-23 22:59:16.349981+00') ON CONFLICT DO NOTHING;
INSERT INTO public.roles_permisos VALUES ('83de37ee-358b-45ab-bd15-982af0c6f8ef', 'df8292fc-a91c-4595-940f-f235efcca166', '2026-06-23 22:59:16.349981+00') ON CONFLICT DO NOTHING;
INSERT INTO public.roles_permisos VALUES ('83de37ee-358b-45ab-bd15-982af0c6f8ef', '11ac1f97-5b2e-42ff-9747-15dcbc665bda', '2026-06-23 22:59:16.349981+00') ON CONFLICT DO NOTHING;
INSERT INTO public.roles_permisos VALUES ('83de37ee-358b-45ab-bd15-982af0c6f8ef', 'ea4eab2a-2852-484d-a26f-9d47655c3114', '2026-06-23 22:59:16.349981+00') ON CONFLICT DO NOTHING;
INSERT INTO public.roles_permisos VALUES ('59eea12f-63c9-4c62-a585-809d9cc55af8', '283f82a5-966a-4027-bb7d-888433dc2a98', '2026-06-23 22:59:16.349981+00') ON CONFLICT DO NOTHING;
INSERT INTO public.roles_permisos VALUES ('59eea12f-63c9-4c62-a585-809d9cc55af8', '11ac1f97-5b2e-42ff-9747-15dcbc665bda', '2026-06-23 22:59:16.349981+00') ON CONFLICT DO NOTHING;
INSERT INTO public.roles_permisos VALUES ('59eea12f-63c9-4c62-a585-809d9cc55af8', 'ea4eab2a-2852-484d-a26f-9d47655c3114', '2026-06-23 22:59:16.349981+00') ON CONFLICT DO NOTHING;
INSERT INTO public.roles_permisos VALUES ('10a15e96-2695-48f1-8f9b-f78e4c73261c', '06dcb04d-b057-4019-8d01-05efd204449e', '2026-06-23 22:59:16.394005+00') ON CONFLICT DO NOTHING;
INSERT INTO public.roles_permisos VALUES ('10a15e96-2695-48f1-8f9b-f78e4c73261c', '7dc68ce2-ddda-4142-aa3e-eb33ebe4949c', '2026-06-23 22:59:16.394005+00') ON CONFLICT DO NOTHING;
INSERT INTO public.roles_permisos VALUES ('dddd7e74-6b26-42f8-af39-40eb3501e1cb', '06dcb04d-b057-4019-8d01-05efd204449e', '2026-06-23 22:59:16.394005+00') ON CONFLICT DO NOTHING;
INSERT INTO public.roles_permisos VALUES ('dddd7e74-6b26-42f8-af39-40eb3501e1cb', '7dc68ce2-ddda-4142-aa3e-eb33ebe4949c', '2026-06-23 22:59:16.394005+00') ON CONFLICT DO NOTHING;
INSERT INTO public.roles_permisos VALUES ('0acb1b8b-c767-47c4-b89d-b5e7a80681a9', '06dcb04d-b057-4019-8d01-05efd204449e', '2026-06-23 22:59:16.394005+00') ON CONFLICT DO NOTHING;
INSERT INTO public.roles_permisos VALUES ('0acb1b8b-c767-47c4-b89d-b5e7a80681a9', '7dc68ce2-ddda-4142-aa3e-eb33ebe4949c', '2026-06-23 22:59:16.394005+00') ON CONFLICT DO NOTHING;
INSERT INTO public.roles_permisos VALUES ('2477d9a6-43e4-455f-8d67-a1388bdaff94', '06dcb04d-b057-4019-8d01-05efd204449e', '2026-06-23 22:59:16.394005+00') ON CONFLICT DO NOTHING;
INSERT INTO public.roles_permisos VALUES ('2477d9a6-43e4-455f-8d67-a1388bdaff94', '7dc68ce2-ddda-4142-aa3e-eb33ebe4949c', '2026-06-23 22:59:16.394005+00') ON CONFLICT DO NOTHING;
INSERT INTO public.roles_permisos VALUES ('83de37ee-358b-45ab-bd15-982af0c6f8ef', '06dcb04d-b057-4019-8d01-05efd204449e', '2026-06-23 22:59:16.394005+00') ON CONFLICT DO NOTHING;
INSERT INTO public.roles_permisos VALUES ('83de37ee-358b-45ab-bd15-982af0c6f8ef', '7dc68ce2-ddda-4142-aa3e-eb33ebe4949c', '2026-06-23 22:59:16.394005+00') ON CONFLICT DO NOTHING;
INSERT INTO public.roles_permisos VALUES ('10a15e96-2695-48f1-8f9b-f78e4c73261c', 'c091b335-3845-434a-94b6-d609e89da8a0', '2026-06-23 22:59:16.51558+00') ON CONFLICT DO NOTHING;
INSERT INTO public.roles_permisos VALUES ('10a15e96-2695-48f1-8f9b-f78e4c73261c', 'ca9e0a8f-eef3-4355-9833-76f72822e4a2', '2026-06-23 22:59:16.51558+00') ON CONFLICT DO NOTHING;
INSERT INTO public.roles_permisos VALUES ('10a15e96-2695-48f1-8f9b-f78e4c73261c', '98ae7b9d-6af9-4e5c-a6f5-9c8c63eed68c', '2026-06-23 22:59:16.51558+00') ON CONFLICT DO NOTHING;
INSERT INTO public.roles_permisos VALUES ('553664be-57f2-41f1-af18-aeda06d89187', '98ae7b9d-6af9-4e5c-a6f5-9c8c63eed68c', '2026-06-23 22:59:16.51558+00') ON CONFLICT DO NOTHING;
INSERT INTO public.roles_permisos VALUES ('dddd7e74-6b26-42f8-af39-40eb3501e1cb', 'c091b335-3845-434a-94b6-d609e89da8a0', '2026-06-23 22:59:16.51558+00') ON CONFLICT DO NOTHING;
INSERT INTO public.roles_permisos VALUES ('dddd7e74-6b26-42f8-af39-40eb3501e1cb', 'ca9e0a8f-eef3-4355-9833-76f72822e4a2', '2026-06-23 22:59:16.51558+00') ON CONFLICT DO NOTHING;
INSERT INTO public.roles_permisos VALUES ('dddd7e74-6b26-42f8-af39-40eb3501e1cb', '98ae7b9d-6af9-4e5c-a6f5-9c8c63eed68c', '2026-06-23 22:59:16.51558+00') ON CONFLICT DO NOTHING;
INSERT INTO public.roles_permisos VALUES ('0acb1b8b-c767-47c4-b89d-b5e7a80681a9', 'c091b335-3845-434a-94b6-d609e89da8a0', '2026-06-23 22:59:16.51558+00') ON CONFLICT DO NOTHING;
INSERT INTO public.roles_permisos VALUES ('0acb1b8b-c767-47c4-b89d-b5e7a80681a9', 'ca9e0a8f-eef3-4355-9833-76f72822e4a2', '2026-06-23 22:59:16.51558+00') ON CONFLICT DO NOTHING;
INSERT INTO public.roles_permisos VALUES ('0acb1b8b-c767-47c4-b89d-b5e7a80681a9', '98ae7b9d-6af9-4e5c-a6f5-9c8c63eed68c', '2026-06-23 22:59:16.51558+00') ON CONFLICT DO NOTHING;
INSERT INTO public.roles_permisos VALUES ('2477d9a6-43e4-455f-8d67-a1388bdaff94', 'c091b335-3845-434a-94b6-d609e89da8a0', '2026-06-23 22:59:16.51558+00') ON CONFLICT DO NOTHING;
INSERT INTO public.roles_permisos VALUES ('2477d9a6-43e4-455f-8d67-a1388bdaff94', 'ca9e0a8f-eef3-4355-9833-76f72822e4a2', '2026-06-23 22:59:16.51558+00') ON CONFLICT DO NOTHING;
INSERT INTO public.roles_permisos VALUES ('2477d9a6-43e4-455f-8d67-a1388bdaff94', '98ae7b9d-6af9-4e5c-a6f5-9c8c63eed68c', '2026-06-23 22:59:16.51558+00') ON CONFLICT DO NOTHING;
INSERT INTO public.roles_permisos VALUES ('83de37ee-358b-45ab-bd15-982af0c6f8ef', '98ae7b9d-6af9-4e5c-a6f5-9c8c63eed68c', '2026-06-23 22:59:16.51558+00') ON CONFLICT DO NOTHING;
INSERT INTO public.roles_permisos VALUES ('85eb3f8a-0583-417b-b689-c9420f0e79dd', '98ae7b9d-6af9-4e5c-a6f5-9c8c63eed68c', '2026-06-23 22:59:16.51558+00') ON CONFLICT DO NOTHING;
INSERT INTO public.roles_permisos VALUES ('85eb3f8a-0583-417b-b689-c9420f0e79dd', 'df8292fc-a91c-4595-940f-f235efcca166', '2026-06-23 22:59:16.51558+00') ON CONFLICT DO NOTHING;
INSERT INTO public.roles_permisos VALUES ('85eb3f8a-0583-417b-b689-c9420f0e79dd', '283f82a5-966a-4027-bb7d-888433dc2a98', '2026-06-23 22:59:16.51558+00') ON CONFLICT DO NOTHING;
INSERT INTO public.roles_permisos VALUES ('85eb3f8a-0583-417b-b689-c9420f0e79dd', '11ac1f97-5b2e-42ff-9747-15dcbc665bda', '2026-06-23 22:59:16.51558+00') ON CONFLICT DO NOTHING;
INSERT INTO public.roles_permisos VALUES ('85eb3f8a-0583-417b-b689-c9420f0e79dd', '252f5df0-8e7b-420b-91dd-6e762f77be87', '2026-06-23 22:59:16.51558+00') ON CONFLICT DO NOTHING;
INSERT INTO public.roles_permisos VALUES ('85eb3f8a-0583-417b-b689-c9420f0e79dd', 'ea4eab2a-2852-484d-a26f-9d47655c3114', '2026-06-23 22:59:16.51558+00') ON CONFLICT DO NOTHING;
INSERT INTO public.roles_permisos VALUES ('1ab69ac9-b29b-42de-bb83-861a9af05e3f', 'ca9e0a8f-eef3-4355-9833-76f72822e4a2', '2026-06-23 22:59:16.51558+00') ON CONFLICT DO NOTHING;
INSERT INTO public.roles_permisos VALUES ('1ab69ac9-b29b-42de-bb83-861a9af05e3f', '98ae7b9d-6af9-4e5c-a6f5-9c8c63eed68c', '2026-06-23 22:59:16.51558+00') ON CONFLICT DO NOTHING;
INSERT INTO public.roles_permisos VALUES ('1ab69ac9-b29b-42de-bb83-861a9af05e3f', 'df8292fc-a91c-4595-940f-f235efcca166', '2026-06-23 22:59:16.51558+00') ON CONFLICT DO NOTHING;
INSERT INTO public.roles_permisos VALUES ('1ab69ac9-b29b-42de-bb83-861a9af05e3f', 'f13446d3-92dc-4e0b-b72d-4c17dda11534', '2026-06-23 22:59:16.51558+00') ON CONFLICT DO NOTHING;
INSERT INTO public.roles_permisos VALUES ('1ab69ac9-b29b-42de-bb83-861a9af05e3f', '11ac1f97-5b2e-42ff-9747-15dcbc665bda', '2026-06-23 22:59:16.51558+00') ON CONFLICT DO NOTHING;
INSERT INTO public.roles_permisos VALUES ('1ab69ac9-b29b-42de-bb83-861a9af05e3f', 'ea4eab2a-2852-484d-a26f-9d47655c3114', '2026-06-23 22:59:16.51558+00') ON CONFLICT DO NOTHING;
INSERT INTO public.roles_permisos VALUES ('10a15e96-2695-48f1-8f9b-f78e4c73261c', '8e03d5a7-ac6d-43cf-940f-964c72f118f4', '2026-06-23 22:59:16.609924+00') ON CONFLICT DO NOTHING;
INSERT INTO public.roles_permisos VALUES ('0acb1b8b-c767-47c4-b89d-b5e7a80681a9', '8e03d5a7-ac6d-43cf-940f-964c72f118f4', '2026-06-23 22:59:16.609924+00') ON CONFLICT DO NOTHING;
INSERT INTO public.roles_permisos VALUES ('2477d9a6-43e4-455f-8d67-a1388bdaff94', '8e03d5a7-ac6d-43cf-940f-964c72f118f4', '2026-06-23 22:59:16.609924+00') ON CONFLICT DO NOTHING;
INSERT INTO public.roles_permisos VALUES ('2477d9a6-43e4-455f-8d67-a1388bdaff94', '252f5df0-8e7b-420b-91dd-6e762f77be87', '2026-06-23 22:59:16.609924+00') ON CONFLICT DO NOTHING;
INSERT INTO public.transiciones_estado_plan VALUES ('4076ec60-19e4-4bf1-8e11-cb59963baa8e', '458beda3-8c52-4a46-b303-6df5413365fb', '18f49b67-8077-4371-be6e-2019a3be3562', '85eb3f8a-0583-417b-b689-c9420f0e79dd', '2026-06-23 22:59:16.609924+00') ON CONFLICT DO NOTHING;
INSERT INTO public.transiciones_estado_plan VALUES ('e252f73a-ebf7-4a62-af6d-fb6dc5003aed', '2d6e72e8-7d33-45ef-be1c-29eb3c05911c', '18f49b67-8077-4371-be6e-2019a3be3562', '553664be-57f2-41f1-af18-aeda06d89187', '2026-06-23 22:59:16.609924+00') ON CONFLICT DO NOTHING;
INSERT INTO public.transiciones_estado_plan VALUES ('e3ffc4a6-7163-47ab-b5f7-c00d3ea88bbb', 'c3e58264-3bbf-4519-a100-0a6448ca0870', '18f49b67-8077-4371-be6e-2019a3be3562', '553664be-57f2-41f1-af18-aeda06d89187', '2026-06-23 22:59:16.609924+00') ON CONFLICT DO NOTHING;
INSERT INTO public.transiciones_estado_plan VALUES ('751ae04e-38b8-4a56-8a50-a69d3c379c70', '5403e167-8e89-4c5e-8635-1e8fe16ae32b', '18f49b67-8077-4371-be6e-2019a3be3562', 'dddd7e74-6b26-42f8-af39-40eb3501e1cb', '2026-06-23 22:59:16.609924+00') ON CONFLICT DO NOTHING;
INSERT INTO public.transiciones_estado_plan VALUES ('6e09bed2-b2f1-48c7-97db-ba29a913807d', 'd1c2722e-8b1b-459b-a239-3d6048896f3f', '18f49b67-8077-4371-be6e-2019a3be3562', 'dddd7e74-6b26-42f8-af39-40eb3501e1cb', '2026-06-23 22:59:16.609924+00') ON CONFLICT DO NOTHING;
INSERT INTO public.transiciones_estado_plan VALUES ('99464218-3caf-45ee-b412-f3322d342059', 'd1c2722e-8b1b-459b-a239-3d6048896f3f', '18f49b67-8077-4371-be6e-2019a3be3562', '0acb1b8b-c767-47c4-b89d-b5e7a80681a9', '2026-06-23 22:59:16.609924+00') ON CONFLICT DO NOTHING;
INSERT INTO public.transiciones_estado_plan VALUES ('f2fd145b-5459-412c-8224-543269b837d9', 'b607605f-944c-47c0-8fa7-912759bb0fa8', '18f49b67-8077-4371-be6e-2019a3be3562', 'dddd7e74-6b26-42f8-af39-40eb3501e1cb', '2026-06-23 22:59:16.609924+00') ON CONFLICT DO NOTHING;
INSERT INTO public.transiciones_estado_plan VALUES ('67508ef3-0af7-49bf-941f-47a8a71270c3', 'b607605f-944c-47c0-8fa7-912759bb0fa8', '18f49b67-8077-4371-be6e-2019a3be3562', '0acb1b8b-c767-47c4-b89d-b5e7a80681a9', '2026-06-23 22:59:16.609924+00') ON CONFLICT DO NOTHING;
INSERT INTO public.transiciones_estado_plan VALUES ('103ea157-e100-4306-b01d-2caf7619d2fb', '5135e4bc-beed-4d53-be94-66b0748a98e6', '18f49b67-8077-4371-be6e-2019a3be3562', '85eb3f8a-0583-417b-b689-c9420f0e79dd', '2026-06-23 22:59:16.609924+00') ON CONFLICT DO NOTHING;
INSERT INTO public.transiciones_estado_plan VALUES ('df570480-407f-497e-ae51-e5ccbd973258', '40b640aa-3ec3-430c-9eb6-90f5ceffbbf7', '18f49b67-8077-4371-be6e-2019a3be3562', '0acb1b8b-c767-47c4-b89d-b5e7a80681a9', '2026-06-23 22:59:16.609924+00') ON CONFLICT DO NOTHING;
INSERT INTO public.transiciones_estado_plan VALUES ('d0b006a6-70a3-4955-8e82-7cf18916de07', '18f49b67-8077-4371-be6e-2019a3be3562', '40b640aa-3ec3-430c-9eb6-90f5ceffbbf7', '2477d9a6-43e4-455f-8d67-a1388bdaff94', '2026-06-23 22:59:16.609924+00') ON CONFLICT DO NOTHING;
INSERT INTO public.transiciones_estado_plan VALUES ('a562fecd-066f-4b35-9022-939eab4df0ea', '40b640aa-3ec3-430c-9eb6-90f5ceffbbf7', '5135e4bc-beed-4d53-be94-66b0748a98e6', '0acb1b8b-c767-47c4-b89d-b5e7a80681a9', '2026-06-23 22:59:16.609924+00') ON CONFLICT DO NOTHING;
INSERT INTO public.transiciones_estado_plan VALUES ('09732921-08bd-41fb-aaa7-efc866c51881', '5135e4bc-beed-4d53-be94-66b0748a98e6', 'b607605f-944c-47c0-8fa7-912759bb0fa8', '85eb3f8a-0583-417b-b689-c9420f0e79dd', '2026-06-23 22:59:16.609924+00') ON CONFLICT DO NOTHING;
INSERT INTO public.transiciones_estado_plan VALUES ('067f3f07-9d37-46cf-9136-8fdcf356d64f', 'b607605f-944c-47c0-8fa7-912759bb0fa8', 'd1c2722e-8b1b-459b-a239-3d6048896f3f', 'dddd7e74-6b26-42f8-af39-40eb3501e1cb', '2026-06-23 22:59:16.609924+00') ON CONFLICT DO NOTHING;
INSERT INTO public.transiciones_estado_plan VALUES ('ec1d2b14-4ccc-4b78-afa6-6d9c96e0fcba', 'b607605f-944c-47c0-8fa7-912759bb0fa8', 'd1c2722e-8b1b-459b-a239-3d6048896f3f', '0acb1b8b-c767-47c4-b89d-b5e7a80681a9', '2026-06-23 22:59:16.609924+00') ON CONFLICT DO NOTHING;
INSERT INTO public.transiciones_estado_plan VALUES ('ea37a19f-d6e7-44cb-88dd-a566f20fb4ff', 'd1c2722e-8b1b-459b-a239-3d6048896f3f', '5403e167-8e89-4c5e-8635-1e8fe16ae32b', 'dddd7e74-6b26-42f8-af39-40eb3501e1cb', '2026-06-23 22:59:16.609924+00') ON CONFLICT DO NOTHING;
INSERT INTO public.transiciones_estado_plan VALUES ('ac52d7ee-4a04-4b93-bf43-f1588626dafb', 'd1c2722e-8b1b-459b-a239-3d6048896f3f', '5403e167-8e89-4c5e-8635-1e8fe16ae32b', '0acb1b8b-c767-47c4-b89d-b5e7a80681a9', '2026-06-23 22:59:16.609924+00') ON CONFLICT DO NOTHING;
INSERT INTO public.transiciones_estado_plan VALUES ('b3f5ae6f-307b-4e5a-bdf9-4d7943ff5771', '5403e167-8e89-4c5e-8635-1e8fe16ae32b', 'c3e58264-3bbf-4519-a100-0a6448ca0870', 'dddd7e74-6b26-42f8-af39-40eb3501e1cb', '2026-06-23 22:59:16.609924+00') ON CONFLICT DO NOTHING;
INSERT INTO public.transiciones_estado_plan VALUES ('c0455b80-974f-4fd7-b05f-8b4e68fa74c3', 'c3e58264-3bbf-4519-a100-0a6448ca0870', '2d6e72e8-7d33-45ef-be1c-29eb3c05911c', '553664be-57f2-41f1-af18-aeda06d89187', '2026-06-23 22:59:16.609924+00') ON CONFLICT DO NOTHING;
INSERT INTO public.transiciones_estado_plan VALUES ('c1c8de92-edc9-45b7-8e58-8018a5641178', '458beda3-8c52-4a46-b303-6df5413365fb', '8c577fca-4b11-44fb-bb50-529f7a929aaf', '85eb3f8a-0583-417b-b689-c9420f0e79dd', '2026-06-23 22:59:16.609924+00') ON CONFLICT DO NOTHING;
INSERT INTO public.transiciones_estado_plan VALUES ('b6cce192-e1c5-494c-9532-5927d5723185', '2d6e72e8-7d33-45ef-be1c-29eb3c05911c', '8c577fca-4b11-44fb-bb50-529f7a929aaf', '553664be-57f2-41f1-af18-aeda06d89187', '2026-06-23 22:59:16.609924+00') ON CONFLICT DO NOTHING;
INSERT INTO public.transiciones_estado_plan VALUES ('4b568c91-1f13-4639-97ae-80d896927d9e', 'c3e58264-3bbf-4519-a100-0a6448ca0870', '8c577fca-4b11-44fb-bb50-529f7a929aaf', '553664be-57f2-41f1-af18-aeda06d89187', '2026-06-23 22:59:16.609924+00') ON CONFLICT DO NOTHING;
INSERT INTO public.transiciones_estado_plan VALUES ('61528b20-c7b1-4200-96b1-ff40d3f5c5ee', '5403e167-8e89-4c5e-8635-1e8fe16ae32b', '8c577fca-4b11-44fb-bb50-529f7a929aaf', 'dddd7e74-6b26-42f8-af39-40eb3501e1cb', '2026-06-23 22:59:16.609924+00') ON CONFLICT DO NOTHING;
INSERT INTO public.transiciones_estado_plan VALUES ('d99022e9-a155-436d-8215-07f11e089c96', '2d6e72e8-7d33-45ef-be1c-29eb3c05911c', '458beda3-8c52-4a46-b303-6df5413365fb', '553664be-57f2-41f1-af18-aeda06d89187', '2026-06-23 22:59:16.609924+00') ON CONFLICT DO NOTHING;
INSERT INTO public.transiciones_estado_plan VALUES ('49ade773-7a96-4ab6-9039-045a886243e9', '458beda3-8c52-4a46-b303-6df5413365fb', 'f01c06c2-1166-46db-9e49-5d74b4190a0e', '85eb3f8a-0583-417b-b689-c9420f0e79dd', '2026-06-23 22:59:16.609924+00') ON CONFLICT DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES
  ('ai-storage', 'ai-storage', false),
  ('avatars', 'avatars', true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  public = EXCLUDED.public;

SELECT cron.unschedule('limpieza-planes-fallidos-10m')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'limpieza-planes-fallidos-10m');
SELECT cron.schedule(
  'limpieza-planes-fallidos-10m',
  '*/5 * * * *',
  'SELECT public.borrar_planes_fallidos();'
);

SELECT cron.unschedule('limpieza-asignaturas-fallidas-10m')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'limpieza-asignaturas-fallidas-10m');
SELECT cron.schedule(
  'limpieza-asignaturas-fallidas-10m',
  '*/5 * * * *',
  'SELECT public.borrar_asignaturas_fallidas();'
);
