


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






CREATE EXTENSION IF NOT EXISTS "pg_jsonschema" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgmq";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "unaccent" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "vector" WITH SCHEMA "extensions";






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


CREATE TYPE "public"."estado_procesamiento_documento" AS ENUM (
    'pending',
    'processing',
    'ready',
    'partial_error',
    'failed',
    'deleted'
);


ALTER TYPE "public"."estado_procesamiento_documento" OWNER TO "postgres";


CREATE TYPE "public"."estado_sesion_carga_documento" AS ENUM (
    'created',
    'uploading',
    'uploaded',
    'hashing',
    'deduplicating',
    'extracting',
    'waiting_provider',
    'chunking',
    'embedding',
    'ready',
    'failed',
    'expired'
);


ALTER TYPE "public"."estado_sesion_carga_documento" OWNER TO "postgres";


CREATE TYPE "public"."estado_tarea_revision" AS ENUM (
    'PENDIENTE',
    'COMPLETADA',
    'OMITIDA'
);


ALTER TYPE "public"."estado_tarea_revision" OWNER TO "postgres";


CREATE TYPE "public"."estado_trabajo_generacion_ia" AS ENUM (
    'pendiente',
    'reclamado',
    'completado',
    'fallido',
    'cancelado',
    'incompleto',
    'expirado',
    'obsoleto'
);


ALTER TYPE "public"."estado_trabajo_generacion_ia" OWNER TO "postgres";


CREATE TYPE "public"."estado_trabajo_ingesta_documental" AS ENUM (
    'pending',
    'processing',
    'completed',
    'retry',
    'dead_letter',
    'cancelled'
);


ALTER TYPE "public"."estado_trabajo_ingesta_documental" OWNER TO "postgres";


CREATE TYPE "public"."fuente_cambio" AS ENUM (
    'HUMANO',
    'IA'
);


ALTER TYPE "public"."fuente_cambio" OWNER TO "postgres";


CREATE TYPE "public"."learning_generation_estado" AS ENUM (
    'queued',
    'running',
    'needs_review',
    'completed',
    'failed'
);


ALTER TYPE "public"."learning_generation_estado" OWNER TO "postgres";


CREATE TYPE "public"."learning_generation_scope" AS ENUM (
    'tema',
    'unidad',
    'asignatura'
);


ALTER TYPE "public"."learning_generation_scope" OWNER TO "postgres";


CREATE TYPE "public"."learning_object_tipo" AS ENUM (
    'apunte',
    'quiz',
    'actividad',
    'ejercicios',
    'rubrica',
    'outline_presentacion',
    'recursos_externos'
);


ALTER TYPE "public"."learning_object_tipo" OWNER TO "postgres";


CREATE TYPE "public"."nivel_plan_estudio" AS ENUM (
    'Licenciatura',
    'Maestría',
    'Doctorado',
    'Especialidad',
    'Diplomado',
    'Otro'
);


ALTER TYPE "public"."nivel_plan_estudio" OWNER TO "postgres";


CREATE TYPE "public"."permiso_archivo_documental" AS ENUM (
    'view',
    'use',
    'manage'
);


ALTER TYPE "public"."permiso_archivo_documental" OWNER TO "postgres";


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


CREATE TYPE "public"."tipo_conversacion_documental" AS ENUM (
    'plan',
    'asignatura'
);


ALTER TYPE "public"."tipo_conversacion_documental" OWNER TO "postgres";


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


CREATE TYPE "public"."tipo_sujeto_archivo_documental" AS ENUM (
    'user',
    'role',
    'plan',
    'subject',
    'conversation',
    'tenant'
);


ALTER TYPE "public"."tipo_sujeto_archivo_documental" OWNER TO "postgres";


CREATE TYPE "public"."tipo_trabajo_generacion_ia" AS ENUM (
    'plan',
    'asignatura',
    'chat_plan',
    'chat_asignatura',
    'recursos_aprendizaje',
    'observabilidad'
);


ALTER TYPE "public"."tipo_trabajo_generacion_ia" OWNER TO "postgres";


CREATE TYPE "public"."tipo_trabajo_ingesta_documental" AS ENUM (
    'hash_file',
    'extract_local',
    'extract_openai',
    'chunk',
    'embed',
    'cleanup'
);


ALTER TYPE "public"."tipo_trabajo_ingesta_documental" OWNER TO "postgres";

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



CREATE OR REPLACE FUNCTION "private"."actualizar_estructura_asignatura_definicion"("p_id" "uuid", "p_definicion" "jsonb", "p_operaciones" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "public"."estructuras_asignatura"
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


ALTER FUNCTION "private"."actualizar_estructura_asignatura_definicion"("p_id" "uuid", "p_definicion" "jsonb", "p_operaciones" "jsonb") OWNER TO "postgres";


COMMENT ON FUNCTION "private"."actualizar_estructura_asignatura_definicion"("p_id" "uuid", "p_definicion" "jsonb", "p_operaciones" "jsonb") IS 'Actualiza una estructura de asignatura y propaga renombres, eliminaciones y cambios de tipo a asignaturas dependientes.';



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


CREATE OR REPLACE FUNCTION "private"."actualizar_estructura_plan_definicion"("p_id" "uuid", "p_definicion" "jsonb", "p_operaciones" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "public"."estructuras_plan"
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


ALTER FUNCTION "private"."actualizar_estructura_plan_definicion"("p_id" "uuid", "p_definicion" "jsonb", "p_operaciones" "jsonb") OWNER TO "postgres";


COMMENT ON FUNCTION "private"."actualizar_estructura_plan_definicion"("p_id" "uuid", "p_definicion" "jsonb", "p_operaciones" "jsonb") IS 'Actualiza una estructura de plan y propaga renombres, eliminaciones y cambios de tipo a planes dependientes.';



CREATE OR REPLACE FUNCTION "private"."asignar_tenant_predeterminado_a_usuario"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  insert into public.tenant_memberships (tenant_id, user_id, is_default)
  select id, new.id, true
  from public.tenants
  where slug = 'acad-ia'
  on conflict (tenant_id, user_id) do nothing;
  return new;
end;
$$;


ALTER FUNCTION "private"."asignar_tenant_predeterminado_a_usuario"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."authz_asignatura_responsable_editor"("p_asignatura_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'private', 'auth', 'extensions', 'pg_temp'
    AS $$
  select exists (
    select 1
    from public.asignaturas a
    where a.id = p_asignatura_id
      and public.plan_estado_clave(a.plan_estudio_id) in ('BORRADOR', 'REVISION')
      and (
        -- Simulacion: admin simulando ser PROFESOR responsable de esta asignatura.
        (
          public.authz_simulacion_activa()
          and private.authz_claim_has_role('PROFESOR')
          and p_asignatura_id = nullif(
                auth.jwt() #>> '{app_metadata,authz_simulacion,asignatura_id}', ''
              )::uuid
          and coalesce(
                nullif(
                  auth.jwt() #>> '{app_metadata,authz_simulacion,responsable_rol}', ''
                ),
                'PROFESOR_RESPONSABLE'
              ) in ('PROFESOR_RESPONSABLE', 'COAUTOR')
        )
        -- Responsabilidad real con rol de edicion.
        or exists (
          select 1
          from public.responsables_asignatura ra
          where ra.asignatura_id = p_asignatura_id
            and ra.usuario_id = auth.uid()
            and ra.rol in ('PROFESOR_RESPONSABLE', 'COAUTOR')
        )
      )
  );
$$;


ALTER FUNCTION "private"."authz_asignatura_responsable_editor"("p_asignatura_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."authz_claim_can_access_plan"("p_plan_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public', 'private', 'auth', 'extensions', 'pg_temp'
    AS $$
  select exists (
    select 1
    from public.planes_estudio pe
    join public.carreras c on c.id = pe.carrera_id
    where pe.id = p_plan_id
      and (
        private.authz_claim_has_global_scope()
        or (
          private.authz_claim_has_role('EVALUADOR_EXTERNO')
          and nullif(auth.jwt() #>> '{app_metadata,authz_simulacion,plan_estudio_id}', '')::uuid = pe.id
        )
        or exists (
          select 1
          from jsonb_array_elements_text(
            coalesce(auth.jwt() #> '{app_metadata,alcances,carreras}', '[]'::jsonb)
          ) as alcance(value)
          where alcance.value = pe.carrera_id::text
        )
        or exists (
          select 1
          from jsonb_array_elements_text(
            coalesce(auth.jwt() #> '{app_metadata,alcances,facultades}', '[]'::jsonb)
          ) as alcance(value)
          where alcance.value = c.facultad_id::text
        )
      )
  );
$$;


ALTER FUNCTION "private"."authz_claim_can_access_plan"("p_plan_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."authz_claim_has_carrera_scope"("p_carrera_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public', 'private', 'auth', 'extensions', 'pg_temp'
    AS $$
  select p_carrera_id is not null
    and exists (
      select 1
      from jsonb_array_elements_text(
        coalesce(auth.jwt() #> '{app_metadata,alcances,carreras}', '[]'::jsonb)
      ) as alcance(value)
      where alcance.value = p_carrera_id::text
    );
$$;


ALTER FUNCTION "private"."authz_claim_has_carrera_scope"("p_carrera_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."authz_claim_has_facultad_scope"("p_facultad_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public', 'private', 'auth', 'extensions', 'pg_temp'
    AS $$
  select p_facultad_id is not null
    and exists (
      select 1
      from jsonb_array_elements_text(
        coalesce(auth.jwt() #> '{app_metadata,alcances,facultades}', '[]'::jsonb)
      ) as alcance(value)
      where alcance.value = p_facultad_id::text
    );
$$;


ALTER FUNCTION "private"."authz_claim_has_facultad_scope"("p_facultad_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."authz_claim_has_global_scope"() RETURNS boolean
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public', 'private', 'auth', 'extensions', 'pg_temp'
    AS $$
  select private.authz_claim_has_role('ADMIN')
    or exists (
      select 1
      from jsonb_array_elements_text(
        coalesce(auth.jwt() #> '{app_metadata,alcances,global}', '[]'::jsonb)
      ) as alcance(value)
      where nullif(alcance.value, '') is not null
    )
    or exists (
      select 1
      from jsonb_array_elements(
        coalesce(auth.jwt() #> '{app_metadata,roles}', '[]'::jsonb)
      ) as rol(value)
      where rol.value ->> 'facultad_id' is null
        and rol.value ->> 'carrera_id' is null
        and rol.value ->> 'alcance_default' = 'global'
    );
$$;


ALTER FUNCTION "private"."authz_claim_has_global_scope"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."authz_claim_has_permission"("p_permiso" "text") RETURNS boolean
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public', 'private', 'auth', 'extensions', 'pg_temp'
    AS $$
  select coalesce((auth.jwt() -> 'app_metadata' -> 'permisos') ? p_permiso, false);
$$;


ALTER FUNCTION "private"."authz_claim_has_permission"("p_permiso" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."authz_claim_has_role"("p_rol" "text") RETURNS boolean
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public', 'private', 'auth', 'extensions', 'pg_temp'
    AS $$
  select coalesce((auth.jwt() -> 'app_metadata' -> 'roles_claves') ? p_rol, false);
$$;


ALTER FUNCTION "private"."authz_claim_has_role"("p_rol" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."authz_is_responsable_asignatura"("p_asignatura_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'private', 'auth', 'extensions', 'pg_temp'
    AS $$
  select (
      public.authz_simulacion_activa()
      and private.authz_claim_has_role('PROFESOR')
      and p_asignatura_id = nullif(auth.jwt() #>> '{app_metadata,authz_simulacion,asignatura_id}', '')::uuid
    )
    or exists (
      select 1
      from public.responsables_asignatura ra
      where ra.asignatura_id = p_asignatura_id
        and ra.usuario_id = auth.uid()
    );
$$;


ALTER FUNCTION "private"."authz_is_responsable_asignatura"("p_asignatura_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."authz_is_responsable_de_plan"("p_plan_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'private', 'auth', 'extensions', 'pg_temp'
    AS $$
  select exists (
      select 1
      from public.asignaturas a
      where public.authz_simulacion_activa()
        and private.authz_claim_has_role('PROFESOR')
        and a.id = nullif(auth.jwt() #>> '{app_metadata,authz_simulacion,asignatura_id}', '')::uuid
        and a.plan_estudio_id = p_plan_id
    )
    or exists (
      select 1
      from public.responsables_asignatura ra
      join public.asignaturas a on a.id = ra.asignatura_id
      where a.plan_estudio_id = p_plan_id
        and ra.usuario_id = auth.uid()
    );
$$;


ALTER FUNCTION "private"."authz_is_responsable_de_plan"("p_plan_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."authz_is_simulated_self"("p_usuario_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public', 'private', 'auth', 'extensions', 'pg_temp'
    AS $$
  select public.authz_simulacion_activa()
    and p_usuario_id is not null
    and p_usuario_id = auth.uid();
$$;


ALTER FUNCTION "private"."authz_is_simulated_self"("p_usuario_id" "uuid") OWNER TO "postgres";


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


CREATE OR REPLACE FUNCTION "private"."catalogo_asignaturas_buscar"("p_q" "text" DEFAULT NULL::"text", "p_facultad_id" "uuid" DEFAULT NULL::"uuid", "p_carrera_id" "uuid" DEFAULT NULL::"uuid", "p_plan_estudio_id" "uuid" DEFAULT NULL::"uuid", "p_tipo" "public"."tipo_asignatura" DEFAULT NULL::"public"."tipo_asignatura", "p_estado" "public"."estado_asignatura" DEFAULT NULL::"public"."estado_asignatura", "p_incluir_archivadas" boolean DEFAULT false, "p_limit" integer DEFAULT 20, "p_offset" integer DEFAULT 0) RETURNS TABLE("asignatura_id" "uuid", "plan_estudio_id" "uuid", "codigo" "text", "nombre" "text", "tipo" "public"."tipo_asignatura", "estado" "public"."estado_asignatura", "creditos" numeric, "numero_ciclo" integer, "plan_nombre" "text", "carrera_id" "uuid", "carrera_nombre" "text", "facultad_id" "uuid", "facultad_nombre" "text", "responsables" "jsonb", "motivos_acceso" "jsonb", "rank" real, "total_count" bigint)
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'private', 'auth', 'extensions', 'pg_temp'
    AS $$
declare
  v_uid uuid := auth.uid();
  v_is_global boolean := public.authz_has_global_scope();
  v_facultades uuid[];
  v_carreras uuid[];
  v_tsq tsquery := public.build_asignaturas_prefix_tsquery(p_q);
  v_limit int := greatest(1, least(coalesce(p_limit, 20), 100));
  v_offset int := greatest(0, coalesce(p_offset, 0));
begin
  if v_uid is null then
    return;
  end if;

  if not (
    public.authz_has_permission('asignaturas.ver')
    or public.authz_has_permission('planes.ver')
  ) then
    return;
  end if;

  select coalesce(array_agg((value)::uuid), '{}')
  into v_facultades
  from jsonb_array_elements_text(
    coalesce(auth.jwt() #> '{app_metadata,alcances,facultades}', '[]'::jsonb)
  ) as t(value);

  select coalesce(array_agg((value)::uuid), '{}')
  into v_carreras
  from jsonb_array_elements_text(
    coalesce(auth.jwt() #> '{app_metadata,alcances,carreras}', '[]'::jsonb)
  ) as t(value);

  return query
  with visibles as (
    select
      a.id,
      a.plan_estudio_id,
      a.codigo,
      a.nombre,
      a.tipo,
      a.estado,
      a.creditos,
      a.numero_ciclo,
      pe.nombre as plan_nombre,
      c.id as carrera_id,
      c.nombre as carrera_nombre,
      f.id as facultad_id,
      f.nombre as facultad_nombre,
      coalesce(ts_rank(a.search_vector, v_tsq), 0)::real as rank
    from public.asignaturas a
    join public.planes_estudio pe on pe.id = a.plan_estudio_id
    join public.carreras c on c.id = pe.carrera_id
    join public.facultades f on f.id = c.facultad_id
    where
      (
        public.authz_can_access_plan(a.plan_estudio_id)
        or public.authz_is_responsable_asignatura(a.id)
      )
      and (v_tsq is null or a.search_vector @@ v_tsq)
      and (p_facultad_id is null or c.facultad_id = p_facultad_id)
      and (p_carrera_id is null or pe.carrera_id = p_carrera_id)
      and (p_plan_estudio_id is null or a.plan_estudio_id = p_plan_estudio_id)
      and (p_tipo is null or a.tipo = p_tipo)
      and (p_estado is null or a.estado = p_estado)
      and (
        p_incluir_archivadas
        or p_estado is not null
        or a.estado <> 'archivada'
      )
  )
  select
    v.id,
    v.plan_estudio_id,
    v.codigo,
    v.nombre,
    v.tipo,
    v.estado,
    v.creditos,
    v.numero_ciclo,
    v.plan_nombre,
    v.carrera_id,
    v.carrera_nombre,
    v.facultad_id,
    v.facultad_nombre,
    coalesce(resp.responsables, '[]'::jsonb) as responsables,
    coalesce(mot.motivos, '[]'::jsonb) as motivos_acceso,
    v.rank,
    count(*) over () as total_count
  from visibles v
  left join lateral (
    select jsonb_agg(
             jsonb_build_object(
               'usuario_id', ra.usuario_id,
               'rol', ra.rol,
               'nombre', ua.nombre_completo
             )
             order by ra.rol, ua.nombre_completo
           ) as responsables
    from public.responsables_asignatura ra
    left join public.usuarios_app ua on ua.id = ra.usuario_id
    where ra.asignatura_id = v.id
  ) resp on true
  left join lateral (
    select jsonb_agg(m.motivo order by m.orden) as motivos
    from (
      select 0 as orden,
             jsonb_build_object('tipo', 'global', 'label', 'Visible globalmente') as motivo
      where v_is_global
      union all
      select 1,
             jsonb_build_object('tipo', 'facultad', 'label', 'Visible por facultad')
      where not v_is_global and v.facultad_id = any (v_facultades)
      union all
      select 2,
             jsonb_build_object('tipo', 'carrera', 'label', 'Visible por carrera')
      where not v_is_global and v.carrera_id = any (v_carreras)
      union all
      select 3,
             jsonb_build_object('tipo', 'experto', 'label', 'Visible como experto invitado')
      where not v_is_global
        and exists (
          select 1
          from public.plan_expertos px
          join public.expertos e on e.id = px.experto_id
          where px.plan_estudio_id = v.plan_estudio_id
            and e.usuario_id = v_uid
        )
      union all
      select 4,
             jsonb_build_object(
               'tipo', 'responsable_asignatura',
               'rol', ra.rol,
               'label',
               case ra.rol
                 when 'PROFESOR_RESPONSABLE' then 'Asignada como Profesor responsable'
                 when 'COAUTOR' then 'Asignada como Coautor'
                 when 'REVISOR' then 'Asignada como Revisor'
                 else 'Asignada'
               end
             )
      from public.responsables_asignatura ra
      where ra.asignatura_id = v.id
        and ra.usuario_id = v_uid
    ) m
  ) mot on true
  order by
    (case when v_tsq is not null then v.rank else 0 end) desc,
    v.nombre asc
  limit v_limit
  offset v_offset;
end;
$$;


ALTER FUNCTION "private"."catalogo_asignaturas_buscar"("p_q" "text", "p_facultad_id" "uuid", "p_carrera_id" "uuid", "p_plan_estudio_id" "uuid", "p_tipo" "public"."tipo_asignatura", "p_estado" "public"."estado_asignatura", "p_incluir_archivadas" boolean, "p_limit" integer, "p_offset" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."documentos_actualizar_timestamp"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "private"."documentos_actualizar_timestamp"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."documentos_impedir_borrado_archivo_usado"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if (
    (old.deleted_at is null and new.deleted_at is not null)
    or (old.status <> 'deleted' and new.status = 'deleted')
  ) and (
    exists (
      select 1
      from public.ai_request_references ar
      where ar.tenant_id = old.tenant_id
        and ar.file_id = old.id
    )
    or exists (
      select 1
      from public.message_file_references mr
      where mr.tenant_id = old.tenant_id
        and mr.file_id = old.id
    )
  ) then
    raise exception using
      errcode = '55000',
      message = 'el archivo ya fue utilizado y debe conservarse para trazabilidad';
  end if;

  return new;
end;
$$;


ALTER FUNCTION "private"."documentos_impedir_borrado_archivo_usado"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."documentos_impedir_retiro_referencia_usada"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_retirando boolean;
begin
  if tg_op = 'DELETE' then
    v_retirando := true;
  else
    v_retirando := old.removed_at is null and new.removed_at is not null;
  end if;

  if v_retirando and exists (
    select 1
    from public.ai_request_references ar
    where ar.tenant_id = old.tenant_id
      and ar.conversation_type = old.conversation_type
      and ar.conversation_id = old.conversation_id
      and ar.file_id = old.file_id
  ) then
    raise exception using
      errcode = '55000',
      message = 'la referencia ya fue utilizada por una petición de IA';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;


ALTER FUNCTION "private"."documentos_impedir_retiro_referencia_usada"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."documentos_otorgar_control_al_creador"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  insert into public.file_grants (
    tenant_id, file_id, subject_type, subject_id, permission, granted_by
  ) values (
    new.tenant_id, new.id, 'user', new.created_by, 'manage', new.created_by
  ) on conflict do nothing;
  return new;
end;
$$;


ALTER FUNCTION "private"."documentos_otorgar_control_al_creador"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."documentos_rechazar_cambio_inmutable"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
begin
  raise exception using errcode = '55000', message = 'Los originales documentales son inmutables; crea una nueva versión.';
end;
$$;


ALTER FUNCTION "private"."documentos_rechazar_cambio_inmutable"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."documentos_usuario_puede_archivo"("p_usuario_id" "uuid", "p_file_id" "uuid", "p_permiso" "public"."permiso_archivo_documental") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  with archivo as (
    select f.id, f.tenant_id, f.created_by
    from public.files f
    where f.id = p_file_id and f.deleted_at is null
  )
  select exists (
    select 1
    from archivo f
    join public.tenant_memberships tm
      on tm.tenant_id = f.tenant_id and tm.user_id = p_usuario_id
    where f.created_by = p_usuario_id
       or exists (
        select 1
        from public.file_grants g
        where g.file_id = f.id
          and g.tenant_id = f.tenant_id
          and (g.expires_at is null or g.expires_at > now())
          and (
            (p_permiso = 'view' and g.permission in ('view', 'use', 'manage'))
            or (p_permiso = 'use' and g.permission in ('use', 'manage'))
            or (p_permiso = 'manage' and g.permission = 'manage')
          )
          and (
            (g.subject_type = 'tenant' and g.subject_id = f.tenant_id)
            or (g.subject_type = 'user' and g.subject_id = p_usuario_id)
            or (g.subject_type = 'role' and exists (
              select 1 from public.usuarios_roles ur
              where ur.usuario_id = p_usuario_id and ur.rol_id = g.subject_id
            ))
            or (g.subject_type = 'plan' and public.usuario_puede_acceder_plan(p_usuario_id, g.subject_id))
            or (g.subject_type = 'subject' and exists (
              select 1
              from public.asignaturas a
              where a.id = g.subject_id
                and public.usuario_puede_acceder_plan(p_usuario_id, a.plan_estudio_id)
            ))
            or (g.subject_type = 'conversation' and (
              exists (
                select 1 from public.conversaciones_plan c
                where c.id = g.subject_id and c.creado_por = p_usuario_id
              )
              or exists (
                select 1 from public.conversaciones_asignatura c
                where c.id = g.subject_id and c.creado_por = p_usuario_id
              )
            ))
          )
       )
  )
$$;


ALTER FUNCTION "private"."documentos_usuario_puede_archivo"("p_usuario_id" "uuid", "p_file_id" "uuid", "p_permiso" "public"."permiso_archivo_documental") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."documentos_validar_mismo_tenant"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_tenant uuid;
begin
  if tg_table_name = 'file_versions' then
    select tenant_id into v_tenant from public.files where id = new.file_id;
    if v_tenant is distinct from new.tenant_id then
      raise exception using errcode = '23514', message = 'file_version no pertenece al tenant del archivo';
    end if;
    select tenant_id into v_tenant from public.file_blobs where id = new.blob_id;
    if v_tenant is distinct from new.tenant_id then
      raise exception using errcode = '23514', message = 'blob no pertenece al tenant de la versión';
    end if;
  elsif tg_table_name = 'collection_files' then
    select tenant_id into v_tenant from public.collections where id = new.collection_id;
    if v_tenant is distinct from new.tenant_id then
      raise exception using errcode = '23514', message = 'colección no pertenece al tenant';
    end if;
    select tenant_id into v_tenant from public.files where id = new.file_id;
    if v_tenant is distinct from new.tenant_id then
      raise exception using errcode = '23514', message = 'archivo no pertenece al tenant';
    end if;
  elsif tg_table_name in ('file_grants', 'file_user_state', 'conversation_files', 'message_file_references', 'ai_request_references') then
    select tenant_id into v_tenant from public.files where id = new.file_id;
    if v_tenant is distinct from new.tenant_id then
      raise exception using errcode = '23514', message = 'archivo no pertenece al tenant';
    end if;
  elsif tg_table_name in ('document_extractions', 'document_chunks') then
    select fv.tenant_id into v_tenant from public.file_versions fv where fv.id = new.file_version_id;
    if v_tenant is distinct from new.tenant_id then
      raise exception using errcode = '23514', message = 'versión no pertenece al tenant';
    end if;
  elsif tg_table_name = 'ingestion_jobs' and new.file_version_id is not null then
    select tenant_id into v_tenant from public.file_versions where id = new.file_version_id;
    if v_tenant is distinct from new.tenant_id then
      raise exception using errcode = '23514', message = 'job no pertenece al tenant de la versión';
    end if;
  end if;
  return new;
end;
$$;


ALTER FUNCTION "private"."documentos_validar_mismo_tenant"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."entidad_intento_ia_json"("p_tipo_entidad" "public"."tipo_trabajo_generacion_ia", "p_entidad_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_entidad jsonb;
begin
  if p_tipo_entidad = 'plan' then
    select to_jsonb(p) into v_entidad
    from public.planes_estudio p
    where p.id = p_entidad_id;
  elsif p_tipo_entidad = 'asignatura' then
    select to_jsonb(a) into v_entidad
    from public.asignaturas a
    where a.id = p_entidad_id;
  end if;
  return v_entidad;
end;
$$;


ALTER FUNCTION "private"."entidad_intento_ia_json"("p_tipo_entidad" "public"."tipo_trabajo_generacion_ia", "p_entidad_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."intento_chat_ia_json"("p_intento_id" "uuid") RETURNS "jsonb"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select to_jsonb(i)
  from private.intentos_chat_ia i
  where i.id = p_intento_id;
$$;


ALTER FUNCTION "private"."intento_chat_ia_json"("p_intento_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."intento_generacion_ia_json"("p_intento_id" "uuid") RETURNS "jsonb"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select to_jsonb(i)
  from private.intentos_generacion_ia i
  where i.id = p_intento_id;
$$;


ALTER FUNCTION "private"."intento_generacion_ia_json"("p_intento_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."nombrar_responsable"("p_usuario" "uuid", "p_rol" "uuid", "p_facultad" "uuid", "p_carrera" "uuid", "p_actor" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'private', 'auth', 'extensions', 'pg_temp'
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


ALTER FUNCTION "private"."nombrar_responsable"("p_usuario" "uuid", "p_rol" "uuid", "p_facultad" "uuid", "p_carrera" "uuid", "p_actor" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."openai_response_id_vigente_trabajo_ia"("p_tipo" "public"."tipo_trabajo_generacion_ia", "p_entidad_id" "uuid") RETURNS "text"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_response_id text;
begin
  case p_tipo
    when 'plan' then
      select p.meta_origen #>> '{ai,responseId}' into v_response_id
      from public.planes_estudio p where p.id = p_entidad_id;
    when 'asignatura' then
      select a.meta_origen #>> '{ai,responseId}' into v_response_id
      from public.asignaturas a where a.id = p_entidad_id;
    when 'chat_plan' then
      select m.openai_response_id into v_response_id
      from public.plan_mensajes_ia m where m.id = p_entidad_id;
    when 'chat_asignatura' then
      select m.openai_response_id into v_response_id
      from public.asignatura_mensajes_ia m where m.id = p_entidad_id;
    when 'recursos_aprendizaje' then
      select j.openai_response_id into v_response_id
      from public.learning_generation_jobs j where j.id = p_entidad_id;
    when 'observabilidad' then
      select o.openai_response_id into v_response_id
      from public.observability_test_runs o where o.id = p_entidad_id;
  end case;

  return v_response_id;
end;
$$;


ALTER FUNCTION "private"."openai_response_id_vigente_trabajo_ia"("p_tipo" "public"."tipo_trabajo_generacion_ia", "p_entidad_id" "uuid") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."learning_generation_jobs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "asignatura_id" "uuid" NOT NULL,
    "unidad_id" "text",
    "tema_id" "text",
    "scope" "public"."learning_generation_scope" DEFAULT 'tema'::"public"."learning_generation_scope" NOT NULL,
    "estado" "public"."learning_generation_estado" DEFAULT 'queued'::"public"."learning_generation_estado" NOT NULL,
    "requested_types" "public"."learning_object_tipo"[] NOT NULL,
    "config_json" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "openai_response_id" "text",
    "resultado_json" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "error" "text",
    "creado_por" "uuid",
    "creado_en" timestamp with time zone DEFAULT "now"() NOT NULL,
    "actualizado_en" timestamp with time zone DEFAULT "now"() NOT NULL,
    "completado_en" timestamp with time zone,
    "intento_generacion_activo_id" "uuid",
    CONSTRAINT "learning_generation_jobs_requested_types_nonempty" CHECK (("cardinality"("requested_types") > 0)),
    CONSTRAINT "learning_generation_jobs_scope_target_chk" CHECK ((("scope" = 'asignatura'::"public"."learning_generation_scope") OR (("scope" = 'unidad'::"public"."learning_generation_scope") AND ("unidad_id" IS NOT NULL)) OR (("scope" = 'tema'::"public"."learning_generation_scope") AND ("unidad_id" IS NOT NULL) AND ("tema_id" IS NOT NULL))))
);


ALTER TABLE "public"."learning_generation_jobs" OWNER TO "postgres";


COMMENT ON COLUMN "public"."learning_generation_jobs"."intento_generacion_activo_id" IS 'Intento durable vigente que puede publicar el próximo response_id de este job.';



CREATE OR REPLACE FUNCTION "private"."persistir_resultado_recursos_aprendizaje_ia"("p_generation_job_id" "uuid", "p_openai_response_id" "text", "p_resultado" "jsonb", "p_objetos" "jsonb", "p_score" "jsonb") RETURNS "public"."learning_generation_jobs"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
declare
  v_job public.learning_generation_jobs;
  v_objetos_insertados integer := 0;
begin
  if p_generation_job_id is null
     or nullif(btrim(p_openai_response_id), '') is null
     or jsonb_typeof(p_resultado) is distinct from 'object'
     or jsonb_typeof(p_objetos) is distinct from 'array'
     or jsonb_array_length(p_objetos) = 0
     or jsonb_typeof(p_score) is distinct from 'object' then
    raise exception using
      errcode = '22023',
      message = 'El resultado atomico de recursos no cumple el contrato requerido';
  end if;

  select j.* into v_job
  from public.learning_generation_jobs j
  where j.id = p_generation_job_id
  for update;

  if v_job.id is null then
    raise exception using
      errcode = 'P0002',
      message = 'No existe el trabajo local de recursos';
  end if;

  if v_job.openai_response_id is distinct from p_openai_response_id then
    raise exception using
      errcode = '22023',
      message = 'La respuesta de OpenAI no corresponde al trabajo de recursos';
  end if;

  if v_job.estado not in ('queued', 'running', 'needs_review', 'completed') then
    raise exception using
      errcode = '55000',
      message = 'El trabajo local de recursos ya no acepta resultados';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_objetos) as elemento(valor)
    where jsonb_typeof(elemento.valor) is distinct from 'object'
      or nullif(btrim(elemento.valor ->> 'tipo'), '') is null
      or nullif(btrim(elemento.valor ->> 'titulo'), '') is null
      or jsonb_typeof(coalesce(elemento.valor -> 'contenido_json', '{}'::jsonb))
           is distinct from 'object'
      or jsonb_typeof(coalesce(elemento.valor -> 'source_refs', '[]'::jsonb))
           is distinct from 'array'
      or jsonb_typeof(coalesce(elemento.valor -> 'metadata', '{}'::jsonb))
           is distinct from 'object'
  ) then
    raise exception using
      errcode = '22023',
      message = 'Uno o mas objetos de aprendizaje son invalidos';
  end if;

  delete from public.learning_objects
  where generation_job_id = v_job.id;

  insert into public.learning_objects (
    asignatura_id,
    unidad_id,
    tema_id,
    tipo,
    titulo,
    descripcion,
    contenido_json,
    score,
    source_refs,
    metadata,
    creado_por,
    actualizado_por,
    generation_job_id
  )
  select
    v_job.asignatura_id,
    v_job.unidad_id,
    v_job.tema_id,
    objeto.tipo::public.learning_object_tipo,
    objeto.titulo,
    objeto.descripcion,
    coalesce(objeto.contenido_json, '{}'::jsonb),
    objeto.score,
    coalesce(objeto.source_refs, '[]'::jsonb),
    coalesce(objeto.metadata, '{}'::jsonb),
    v_job.creado_por,
    v_job.creado_por,
    v_job.id
  from jsonb_to_recordset(p_objetos) as objeto(
    tipo text,
    titulo text,
    descripcion text,
    contenido_json jsonb,
    score integer,
    source_refs jsonb,
    metadata jsonb
  );

  get diagnostics v_objetos_insertados = row_count;
  if v_objetos_insertados <> jsonb_array_length(p_objetos) then
    raise exception using
      errcode = '22023',
      message = 'No se insertaron todos los objetos de aprendizaje';
  end if;

  delete from public.learning_quality_scores s
  where s.asignatura_id = v_job.asignatura_id
    and s.unidad_id is not distinct from v_job.unidad_id
    and s.tema_id is not distinct from v_job.tema_id;

  insert into public.learning_quality_scores (
    asignatura_id,
    unidad_id,
    tema_id,
    score_total,
    rubrica_json,
    recomendaciones_json,
    generation_job_id,
    generado_por
  ) values (
    v_job.asignatura_id,
    v_job.unidad_id,
    v_job.tema_id,
    (p_score ->> 'score_total')::integer,
    coalesce(p_score -> 'rubrica_json', '{}'::jsonb),
    coalesce(p_score -> 'recomendaciones_json', '[]'::jsonb),
    v_job.id,
    v_job.creado_por
  );

  update public.learning_generation_jobs j
  set estado = 'completed',
      openai_response_id = p_openai_response_id,
      resultado_json = p_resultado,
      error = null,
      completado_en = now()
  where j.id = v_job.id
  returning j.* into v_job;

  return v_job;
end;
$$;


ALTER FUNCTION "private"."persistir_resultado_recursos_aprendizaje_ia"("p_generation_job_id" "uuid", "p_openai_response_id" "text", "p_resultado" "jsonb", "p_objetos" "jsonb", "p_score" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."plan_estado_clave"("p_plan_id" "uuid") RETURNS "text"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'private', 'auth', 'extensions', 'pg_temp'
    AS $$
  SELECT ep.clave
  FROM public.planes_estudio pe
  LEFT JOIN public.estados_plan ep ON ep.id = pe.estado_actual_id
  WHERE pe.id = p_plan_id;
$$;


ALTER FUNCTION "private"."plan_estado_clave"("p_plan_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."proteger_publicacion_trabajo_entidad_ia"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if new.tipo_entidad = 'plan'
     and new.estado in ('pendiente', 'reclamado')
     and not exists (
       select 1 from public.planes_estudio p
       where p.id = new.entidad_id
         and p.meta_origen #>> '{ai,responseId}' = new.openai_response_id
     ) then
    raise exception using errcode = '55000', message = 'la respuesta del plan todavía no fue publicada';
  elsif new.tipo_entidad = 'asignatura'
     and new.estado in ('pendiente', 'reclamado')
     and not exists (
       select 1 from public.asignaturas a
       where a.id = new.entidad_id
         and a.meta_origen #>> '{ai,responseId}' = new.openai_response_id
     ) then
    raise exception using errcode = '55000', message = 'la respuesta de la asignatura todavía no fue publicada';
  end if;
  return new;
end;
$$;


ALTER FUNCTION "private"."proteger_publicacion_trabajo_entidad_ia"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."proteger_publicacion_trabajo_recursos_ia"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if new.tipo_entidad = 'recursos_aprendizaje'
     and new.estado in ('pendiente', 'reclamado')
     and not exists (
       select 1
       from public.learning_generation_jobs j
       where j.id = new.entidad_id
         and j.openai_response_id = new.openai_response_id
     ) then
    raise exception using
      errcode = '55000',
      message = 'la respuesta de recursos todavía no fue publicada';
  end if;
  return new;
end;
$$;


ALTER FUNCTION "private"."proteger_publicacion_trabajo_recursos_ia"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."publicar_intento_chat_ia_interno"("p_intento_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_intento private.intentos_chat_ia;
  v_trabajo public.trabajos_generacion_ia;
begin
  select * into v_intento
  from private.intentos_chat_ia i
  where i.id = p_intento_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'intento de chat no encontrado';
  end if;
  if v_intento.estado = 'publicado' then
    return jsonb_build_object(
      'resolution', 'already_applied',
      'attempt', private.intento_chat_ia_json(p_intento_id),
      'job', (
        select to_jsonb(j)
        from public.trabajos_generacion_ia j
        where j.openai_response_id = v_intento.openai_response_id
      )
    );
  end if;
  if v_intento.estado in ('fallido', 'expirado') then
    return jsonb_build_object(
      'resolution', 'stale',
      'attempt', private.intento_chat_ia_json(p_intento_id)
    );
  end if;
  if v_intento.openai_response_id is null then
    raise exception using errcode = '55000', message = 'el intento todavía no tiene response_id';
  end if;

  v_trabajo := public.publicar_solicitud_chat_ia(
    v_intento.tipo_conversacion,
    v_intento.conversacion_id,
    v_intento.mensaje_id,
    v_intento.usuario_id,
    v_intento.openai_response_id,
    coalesce(v_intento.estado_openai, 'queued'),
    coalesce(v_intento.iniciado_en, v_intento.creado_en),
    jsonb_build_object(
      'source', 'chat-attempt-outbox',
      'chatAttemptId', v_intento.id,
      'initiatedBy', v_intento.usuario_id
    ),
    v_intento.modo_referencias,
    v_intento.consulta_referencias,
    v_intento.referencias
  );

  update private.intentos_chat_ia
  set estado = 'publicado',
      token_reclamacion = null,
      reclamado_por = null,
      reclamado_hasta = null,
      actualizado_en = now(),
      publicado_en = coalesce(publicado_en, now()),
      ultimo_error = null
  where id = p_intento_id;

  return jsonb_build_object(
    'resolution', 'applied',
    'attempt', private.intento_chat_ia_json(p_intento_id),
    'job', to_jsonb(v_trabajo)
  );
end;
$$;


ALTER FUNCTION "private"."publicar_intento_chat_ia_interno"("p_intento_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."publicar_intento_entidad_ia_interno"("p_intento_id" "uuid", "p_token_reclamacion" "uuid" DEFAULT NULL::"uuid", "p_exigir_token" boolean DEFAULT true, "p_openai_response_id" "text" DEFAULT NULL::"text", "p_estado_openai" "text" DEFAULT NULL::"text", "p_iniciado_en" timestamp with time zone DEFAULT NULL::timestamp with time zone) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_previo private.intentos_generacion_ia;
  v_intento private.intentos_generacion_ia;
  v_trabajo public.trabajos_generacion_ia;
  v_response_id text := nullif(btrim(coalesce(p_openai_response_id, '')), '');
  v_active_attempt text;
  v_estado_generando boolean := false;
  v_usuario_id uuid;
  v_tenant_id uuid;
  v_referencia jsonb;
  v_file_id uuid;
  v_file_version_id uuid;
  v_chunk_ids uuid[];
  v_scores jsonb;
  v_conteo_referencias integer;
  v_entidad jsonb;
begin
  select i.* into v_previo
  from private.intentos_generacion_ia i
  where i.id = p_intento_id;
  if not found then
    return jsonb_build_object('resolution', 'stale', 'attempt', null);
  end if;
  if v_previo.handler not in ('plan', 'subject')
     or v_previo.tipo_entidad not in ('plan', 'asignatura') then
    raise exception using errcode = '22023', message = 'handler de entidad no válido';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(
    v_previo.handler || ':' || v_previo.tipo_entidad::text || ':' || v_previo.entidad_id::text,
    0
  ));

  select i.* into v_intento
  from private.intentos_generacion_ia i
  where i.id = p_intento_id
  for update;

  if v_intento.estado = 'publicado' then
    return jsonb_build_object(
      'resolution', 'already_applied',
      'attempt', private.intento_generacion_ia_json(p_intento_id),
      'job', (
        select to_jsonb(t)
        from public.trabajos_generacion_ia t
        where t.openai_response_id = v_intento.openai_response_id
      ),
      'entity', private.entidad_intento_ia_json(
        v_intento.tipo_entidad,
        v_intento.entidad_id
      )
    );
  end if;
  if v_intento.estado in ('fallido', 'expirado', 'obsoleto') then
    return jsonb_build_object(
      'resolution', 'stale',
      'attempt', private.intento_generacion_ia_json(p_intento_id)
    );
  end if;

  if v_response_id is not null then
    if v_intento.openai_response_id is not null
       and v_intento.openai_response_id <> v_response_id then
      return jsonb_build_object(
        'resolution', 'claimed_elsewhere',
        'attempt', private.intento_generacion_ia_json(p_intento_id)
      );
    end if;
    if v_intento.openai_response_id is null then
      update private.intentos_generacion_ia i
      set estado = 'respuesta_vinculada',
          openai_response_id = v_response_id,
          estado_openai = coalesce(nullif(btrim(p_estado_openai), ''), 'queued'),
          iniciado_en = coalesce(p_iniciado_en, now()),
          actualizado_en = now()
      where i.id = p_intento_id
      returning * into v_intento;
    end if;
  end if;

  if v_intento.openai_response_id is null then
    raise exception using errcode = '55000', message = 'el intento todavía no tiene response_id';
  end if;
  if p_exigir_token and (
    p_token_reclamacion is null
    or v_intento.token_reclamacion is distinct from p_token_reclamacion
    or v_intento.reclamado_hasta <= now()
  ) then
    return jsonb_build_object(
      'resolution', 'claimed_elsewhere',
      'attempt', private.intento_generacion_ia_json(p_intento_id)
    );
  end if;

  if v_intento.tipo_entidad = 'plan' then
    select
      p.meta_origen #>> '{ai,activeAttemptId}',
      exists (
        select 1 from public.estados_plan ep
        where ep.id = p.estado_actual_id and upper(ep.clave) = 'GENERANDO'
      )
    into v_active_attempt, v_estado_generando
    from public.planes_estudio p
    where p.id = v_intento.entidad_id;
  else
    select
      a.meta_origen #>> '{ai,activeAttemptId}',
      a.estado = 'generando'
    into v_active_attempt, v_estado_generando
    from public.asignaturas a
    where a.id = v_intento.entidad_id;
  end if;

  if v_active_attempt is distinct from v_intento.id::text
     or not coalesce(v_estado_generando, false) then
    update private.intentos_generacion_ia i
    set estado = 'obsoleto',
        token_reclamacion = null,
        reclamado_por = null,
        reclamado_hasta = null,
        actualizado_en = now(),
        ultimo_error = jsonb_build_object(
          'code', 'STALE_ATTEMPT',
          'message', 'La entidad ya no apunta a este intento.'
        )
    where i.id = p_intento_id;
    return jsonb_build_object(
      'resolution', 'stale',
      'attempt', private.intento_generacion_ia_json(p_intento_id)
    );
  end if;

  begin
    v_usuario_id := (v_intento.contexto ->> 'userId')::uuid;
  exception when invalid_text_representation or null_value_not_allowed then
    raise exception using errcode = '22023', message = 'usuario durable no válido';
  end;
  select tm.tenant_id into v_tenant_id
  from public.tenant_memberships tm
  where tm.user_id = v_usuario_id
    and tm.is_default
  limit 1;
  if v_tenant_id is null then
    raise exception using
      errcode = '42501',
      message = 'el usuario no tiene tenant documental predeterminado';
  end if;

  if v_intento.tipo_entidad = 'plan' then
    update public.planes_estudio p
    set meta_origen = jsonb_set(
      coalesce(p.meta_origen, '{}'::jsonb),
      '{ai,responseId}',
      to_jsonb(v_intento.openai_response_id),
      true
    )
    where p.id = v_intento.entidad_id
      and p.meta_origen #>> '{ai,activeAttemptId}' = v_intento.id::text
    returning to_jsonb(p) into v_entidad;
  else
    update public.asignaturas a
    set meta_origen = jsonb_set(
      coalesce(a.meta_origen, '{}'::jsonb),
      '{ai,responseId}',
      to_jsonb(v_intento.openai_response_id),
      true
    )
    where a.id = v_intento.entidad_id
      and a.meta_origen #>> '{ai,activeAttemptId}' = v_intento.id::text
    returning to_jsonb(a) into v_entidad;
  end if;
  if v_entidad is null then
    raise exception using errcode = '55000', message = 'no se pudo publicar response_id en la entidad';
  end if;

  v_trabajo := public.registrar_trabajo_generacion_ia(
    v_intento.tipo_entidad,
    v_intento.entidad_id,
    v_intento.openai_response_id,
    coalesce(v_intento.estado_openai, 'queued'),
    coalesce(v_intento.iniciado_en, v_intento.creado_en),
    coalesce(v_intento.contexto, '{}'::jsonb) || jsonb_build_object(
      'source', 'entity-generation-attempt',
      'generationAttemptId', v_intento.id,
      'publishedAtomically', true
    )
  );

  if jsonb_typeof(v_intento.referencias) <> 'array'
     or v_intento.modo_referencias not in ('none', 'direct', 'retrieval') then
    raise exception using errcode = '22023', message = 'snapshot documental no válido';
  end if;
  v_conteo_referencias := jsonb_array_length(v_intento.referencias);
  if v_conteo_referencias > 5
     or ((v_intento.modo_referencias = 'none') <> (v_conteo_referencias = 0)) then
    raise exception using errcode = '22023', message = 'cantidad o modo de referencias no válido';
  end if;

  for v_referencia in
    select value from jsonb_array_elements(v_intento.referencias)
  loop
    if jsonb_typeof(v_referencia) <> 'object'
       or jsonb_typeof(v_referencia -> 'chunkIds') <> 'array'
       or jsonb_typeof(v_referencia -> 'scores') <> 'object' then
      raise exception using errcode = '22023', message = 'referencia documental no válida';
    end if;
    begin
      v_file_id := (v_referencia ->> 'fileId')::uuid;
      v_file_version_id := (v_referencia ->> 'fileVersionId')::uuid;
      select coalesce(array_agg(chunk_id), '{}'::uuid[])
      into v_chunk_ids
      from (
        select jsonb_array_elements_text(v_referencia -> 'chunkIds')::uuid as chunk_id
      ) parsed_chunks;
    exception when invalid_text_representation or null_value_not_allowed then
      raise exception using errcode = '22023', message = 'identificador documental no válido';
    end;
    v_scores := v_referencia -> 'scores';
    if v_file_id is null or v_file_version_id is null
       or exists (
         select 1 from jsonb_each(v_scores) score
         where jsonb_typeof(score.value) <> 'number'
       ) then
      raise exception using errcode = '22023', message = 'snapshot documental no válido';
    end if;
    if not exists (
      select 1
      from public.file_versions fv
      join public.files f on f.id = fv.file_id
      where fv.id = v_file_version_id
        and fv.file_id = v_file_id
        and fv.tenant_id = v_tenant_id
        and f.tenant_id = v_tenant_id
        and f.deleted_at is null
    ) then
      raise exception using
        errcode = '23503',
        message = 'la versión documental no pertenece al archivo y tenant indicados';
    end if;
    if v_intento.modo_referencias = 'direct'
       and (cardinality(v_chunk_ids) <> 0 or v_scores <> '{}'::jsonb) then
      raise exception using errcode = '22023', message = 'referencia directa no válida';
    end if;
    if v_intento.modo_referencias = 'retrieval' and (
      cardinality(v_chunk_ids) = 0
      or (select count(*) from jsonb_object_keys(v_scores)) <> cardinality(v_chunk_ids)
      or exists (
        select 1 from unnest(v_chunk_ids) chunk_id
        where not (v_scores ? chunk_id::text)
      )
    ) then
      raise exception using errcode = '22023', message = 'referencia recuperada no válida';
    end if;
    if cardinality(v_chunk_ids) <> (
      select count(distinct chunk_id) from unnest(v_chunk_ids) chunk_id
    ) then
      raise exception using errcode = '22023', message = 'hay chunks documentales duplicados';
    end if;
    if exists (
      select 1
      from unnest(v_chunk_ids) chunk_id
      left join public.document_chunks dc
        on dc.id = chunk_id
       and dc.file_version_id = v_file_version_id
       and dc.tenant_id = v_tenant_id
      where dc.id is null
    ) then
      raise exception using errcode = '23503', message = 'un chunk no pertenece a la versión documental';
    end if;

    insert into public.ai_request_references (
      tenant_id,
      request_id,
      conversation_type,
      conversation_id,
      message_type,
      message_id,
      file_id,
      file_version_id,
      mode,
      chunk_ids,
      retrieval_query,
      retrieval_scores
    ) values (
      v_tenant_id,
      v_intento.openai_response_id,
      case when v_intento.tipo_entidad = 'plan'
        then 'plan'::public.tipo_conversacion_documental
        else 'asignatura'::public.tipo_conversacion_documental
      end,
      v_intento.entidad_id,
      case when v_intento.tipo_entidad = 'plan'
        then 'plan'::public.tipo_conversacion_documental
        else 'asignatura'::public.tipo_conversacion_documental
      end,
      null,
      v_file_id,
      v_file_version_id,
      v_intento.modo_referencias,
      v_chunk_ids,
      case when v_intento.modo_referencias = 'retrieval'
        then v_intento.consulta_referencias
        else null
      end,
      v_scores
    )
    on conflict (request_id, file_version_id, mode) do nothing;

    if not exists (
      select 1
      from public.ai_request_references ar
      where ar.request_id = v_intento.openai_response_id
        and ar.conversation_id = v_intento.entidad_id
        and ar.file_id = v_file_id
        and ar.file_version_id = v_file_version_id
        and ar.mode = v_intento.modo_referencias
        and ar.chunk_ids = v_chunk_ids
        and ar.retrieval_query is not distinct from (
          case when v_intento.modo_referencias = 'retrieval'
            then v_intento.consulta_referencias else null end
        )
        and ar.retrieval_scores = v_scores
    ) then
      raise exception using
        errcode = '55000',
        message = 'el response_id ya contiene otra referencia documental';
    end if;
  end loop;

  if (
    select count(*) from public.ai_request_references ar
    where ar.request_id = v_intento.openai_response_id
  ) <> v_conteo_referencias then
    raise exception using
      errcode = '55000',
      message = 'el response_id contiene un conjunto documental diferente';
  end if;

  update private.intentos_generacion_ia i
  set estado = 'publicado',
      token_reclamacion = null,
      reclamado_por = null,
      reclamado_hasta = null,
      publicado_en = coalesce(i.publicado_en, now()),
      actualizado_en = now(),
      ultimo_error = null
  where i.id = p_intento_id;

  return jsonb_build_object(
    'resolution', 'applied',
    'attempt', private.intento_generacion_ia_json(p_intento_id),
    'job', to_jsonb(v_trabajo),
    'entity', v_entidad
  );
end;
$$;


ALTER FUNCTION "private"."publicar_intento_entidad_ia_interno"("p_intento_id" "uuid", "p_token_reclamacion" "uuid", "p_exigir_token" boolean, "p_openai_response_id" "text", "p_estado_openai" "text", "p_iniciado_en" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."reasignar_responsabilidades"("p_origen" "uuid", "p_destino" "uuid", "p_actor" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'private', 'auth', 'extensions', 'pg_temp'
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


ALTER FUNCTION "private"."reasignar_responsabilidades"("p_origen" "uuid", "p_destino" "uuid", "p_actor" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."reparar_titulos_conversaciones_ia_legacy"() RETURNS TABLE("planes_actualizados" integer, "asignaturas_actualizadas" integer)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public', 'private'
    AS $$
begin
  with primeros_mensajes as (
    select distinct on (m.conversacion_plan_id)
      m.conversacion_plan_id as conversacion_id,
      private.titulo_conversacion_ia_desde_prompt(m.mensaje) as titulo
    from public.plan_mensajes_ia m
    where nullif(btrim(m.mensaje), '') is not null
    order by m.conversacion_plan_id, m.fecha_creacion, m.id
  )
  update public.conversaciones_plan c
  set nombre = p.titulo
  from primeros_mensajes p
  where c.id = p.conversacion_id
    and p.titulo is not null
    and c.nombre is distinct from p.titulo
    and (
      nullif(btrim(c.nombre), '') is null
      or translate(lower(btrim(c.nombre)), 'áéíóúüñ', 'aeiouun') in (
        'consulta academica',
        'mejora de campos'
      )
      or c.nombre ~* '^Chat[[:space:]]+[0-9]{4}-[0-9]{2}-[0-9]{2}'
    );
  get diagnostics planes_actualizados = row_count;

  with primeros_mensajes as (
    select distinct on (m.conversacion_asignatura_id)
      m.conversacion_asignatura_id as conversacion_id,
      private.titulo_conversacion_ia_desde_prompt(m.mensaje) as titulo
    from public.asignatura_mensajes_ia m
    where nullif(btrim(m.mensaje), '') is not null
    order by m.conversacion_asignatura_id, m.fecha_creacion, m.id
  )
  update public.conversaciones_asignatura c
  set nombre = p.titulo
  from primeros_mensajes p
  where c.id = p.conversacion_id
    and p.titulo is not null
    and c.nombre is distinct from p.titulo
    and (
      nullif(btrim(c.nombre), '') is null
      or translate(lower(btrim(c.nombre)), 'áéíóúüñ', 'aeiouun') in (
        'consulta academica',
        'mejora de campos'
      )
      or c.nombre ~* '^Chat[[:space:]]+[0-9]{4}-[0-9]{2}-[0-9]{2}'
    );
  get diagnostics asignaturas_actualizadas = row_count;

  return next;
end;
$$;


ALTER FUNCTION "private"."reparar_titulos_conversaciones_ia_legacy"() OWNER TO "postgres";


COMMENT ON FUNCTION "private"."reparar_titulos_conversaciones_ia_legacy"() IS 'Repara sólo títulos genéricos heredados usando el primer prompt de cada chat.';



CREATE OR REPLACE FUNCTION "private"."tenant_documental_predeterminado"("p_usuario_id" "uuid") RETURNS "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select m.tenant_id
  from public.tenant_memberships m
  where m.user_id = p_usuario_id and m.is_default
  limit 1
$$;


ALTER FUNCTION "private"."tenant_documental_predeterminado"("p_usuario_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."titulo_conversacion_ia_desde_prompt"("p_prompt" "text") RETURNS "text"
    LANGUAGE "plpgsql" IMMUTABLE STRICT
    SET "search_path" TO 'pg_catalog'
    AS $_$
declare
  v_source text;
  v_title text;
begin
  v_source := btrim(regexp_replace(p_prompt, '[[:space:]]+', ' ', 'g'));
  if v_source = '' then
    return null;
  end if;

  v_title := regexp_replace(
    v_source,
    '^[/"''`*_#>[[:space:]-]+',
    ''
  );
  v_title := regexp_replace(
    v_title,
    '^(por favor[[:space:]]+)?(ay[uú]dame a|puedes|podr[ií]as|quiero|necesito|mejora|mejorar|redacta|genera|crea|analiza|revisa|califica)[[:space:]]+',
    '',
    'i'
  );
  v_title := regexp_replace(v_title, '[.?!].*$', '');
  v_title := btrim(regexp_replace(v_title, '[[:space:]:;,.]+$', ''));

  if v_title = '' then
    v_title := v_source;
  end if;

  if char_length(v_title) > 72 then
    v_title := btrim(left(v_title, 72));
    v_title := btrim(regexp_replace(v_title, '[[:space:]]+[^[:space:]]*$', ''));
    if v_title = '' then
      v_title := left(v_source, 72);
    end if;
  end if;

  return nullif(v_title, '');
end;
$_$;


ALTER FUNCTION "private"."titulo_conversacion_ia_desde_prompt"("p_prompt" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "private"."titulo_conversacion_ia_desde_prompt"("p_prompt" "text") IS 'Deriva sin red un título provisional y acotado a partir del primer prompt.';



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



CREATE OR REPLACE FUNCTION "private"."transiciones_permitidas_plan"("p_plan_id" "uuid") RETURNS SETOF "public"."estados_plan"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'private', 'auth', 'extensions', 'pg_temp'
    AS $$
  select distinct e.*
  from public.planes_estudio pe
  join public.estructuras_plan ep on ep.id = pe.estructura_id
  join public.transiciones_estado_plan t
    on t.desde_estado_id = pe.estado_actual_id
    and (t.tipo_estructura is null or t.tipo_estructura = ep.tipo)
  join public.estados_plan e on e.id = t.hacia_estado_id
  join public.roles r on r.id = t.rol_permitido_id
  where pe.id = p_plan_id
    and public.usuario_puede_acceder_plan(auth.uid(), p_plan_id)
    and (
      public.authz_is_admin()
      or public.usuario_tiene_rol_contextual_plan(auth.uid(), p_plan_id, r.clave)
    )
  order by e.orden;
$$;


ALTER FUNCTION "private"."transiciones_permitidas_plan"("p_plan_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."usuario_cubre_carrera_para_gestion"("p_actor" "uuid", "p_carrera_id" "uuid", "p_incluir_secretaria" boolean DEFAULT false) RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'private', 'auth', 'extensions', 'pg_temp'
    AS $$
  select p_actor is not null
    and p_carrera_id is not null
    and exists (
      select 1
      from public.usuarios_app ua
      where ua.id = p_actor
        and ua.dado_de_baja_en is null
    )
    and exists (
      select 1
      from public.carreras c
      where c.id = p_carrera_id
        and (
          private.usuario_tiene_rol_activo(p_actor, 'ADMIN')
          or private.usuario_tiene_rol_activo(p_actor, 'VICERRECTOR_ACADEMICO')
          or exists (
            select 1
            from public.usuarios_roles ur
            join public.roles r on r.id = ur.rol_id
            where ur.usuario_id = p_actor
              and ur.facultad_id = c.facultad_id
              and r.clave = 'DIRECTOR_FACULTAD'
          )
          or (
            p_incluir_secretaria
            and exists (
              select 1
              from public.usuarios_roles ur
              join public.roles r on r.id = ur.rol_id
              where ur.usuario_id = p_actor
                and ur.facultad_id = c.facultad_id
                and r.clave = 'SECRETARIO_ACADEMICO'
            )
          )
          or exists (
            select 1
            from public.usuarios_roles ur
            join public.roles r on r.id = ur.rol_id
            where ur.usuario_id = p_actor
              and ur.carrera_id = c.id
              and r.clave = 'JEFE_CARRERA'
          )
          or exists (
            select 1
            from public.usuarios_roles ur
            join public.roles r on r.id = ur.rol_id
            where ur.usuario_id = p_actor
              and ur.facultad_id = c.facultad_id
              and r.clave = 'JEFE_POSGRADO'
              and public.nivel_es_posgrado(c.nivel::text)
          )
        )
    );
$$;


ALTER FUNCTION "private"."usuario_cubre_carrera_para_gestion"("p_actor" "uuid", "p_carrera_id" "uuid", "p_incluir_secretaria" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."usuario_es_externo_asignado_plan"("p_usuario_id" "uuid", "p_plan_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'private', 'auth', 'extensions', 'pg_temp'
    AS $$
  select p_usuario_id is not null
    and (
      (
        private.authz_is_simulated_self(p_usuario_id)
        and private.authz_claim_has_role('EVALUADOR_EXTERNO')
        and private.authz_claim_can_access_plan(p_plan_id)
      )
      or (
        not private.authz_is_simulated_self(p_usuario_id)
        and public.usuario_tiene_rol_en_plan(p_usuario_id, p_plan_id, 'EVALUADOR_EXTERNO')
        and exists (
          select 1
          from public.plan_expertos px
          join public.expertos e on e.id = px.experto_id
          where px.plan_estudio_id = p_plan_id
            and e.usuario_id = p_usuario_id
        )
      )
    );
$$;


ALTER FUNCTION "private"."usuario_es_externo_asignado_plan"("p_usuario_id" "uuid", "p_plan_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."usuario_es_jefe_encargado_plan"("p_usuario_id" "uuid", "p_plan_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'private', 'auth', 'extensions', 'pg_temp'
    AS $$
  select p_usuario_id is not null
    and (
      (
        private.authz_is_simulated_self(p_usuario_id)
        and private.authz_claim_has_role('JEFE_CARRERA')
        and private.authz_claim_can_access_plan(p_plan_id)
      )
      or (
        not private.authz_is_simulated_self(p_usuario_id)
        and exists (
          select 1
          from public.planes_estudio pe
          join public.usuarios_roles ur on ur.carrera_id = pe.carrera_id
          join public.roles r on r.id = ur.rol_id
          join public.usuarios_app ua on ua.id = ur.usuario_id
          where pe.id = p_plan_id
            and ur.usuario_id = p_usuario_id
            and ua.dado_de_baja_en is null
            and r.clave = 'JEFE_CARRERA'
        )
      )
      or private.usuario_es_jefe_posgrado_encargado_plan(
        p_usuario_id,
        p_plan_id
      )
    );
$$;


ALTER FUNCTION "private"."usuario_es_jefe_encargado_plan"("p_usuario_id" "uuid", "p_plan_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."usuario_es_jefe_posgrado_encargado_plan"("p_usuario_id" "uuid", "p_plan_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'private', 'auth', 'extensions', 'pg_temp'
    AS $$
  select p_usuario_id is not null
    and (
      (
        private.authz_is_simulated_self(p_usuario_id)
        and private.authz_claim_has_role('JEFE_POSGRADO')
        and private.authz_claim_can_access_plan(p_plan_id)
        and exists (
          select 1
          from public.planes_estudio pe
          join public.carreras c on c.id = pe.carrera_id
          where pe.id = p_plan_id
            and public.nivel_es_posgrado(c.nivel::text)
        )
      )
      or (
        not private.authz_is_simulated_self(p_usuario_id)
        and exists (
          select 1
          from public.planes_estudio pe
          join public.carreras c on c.id = pe.carrera_id
          join public.usuarios_roles ur on ur.facultad_id = c.facultad_id
          join public.roles r on r.id = ur.rol_id
          join public.usuarios_app ua on ua.id = ur.usuario_id
          where pe.id = p_plan_id
            and ur.usuario_id = p_usuario_id
            and ua.dado_de_baja_en is null
            and r.clave = 'JEFE_POSGRADO'
            and public.nivel_es_posgrado(c.nivel::text)
        )
      )
    );
$$;


ALTER FUNCTION "private"."usuario_es_jefe_posgrado_encargado_plan"("p_usuario_id" "uuid", "p_plan_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."usuario_puede_acceder_plan"("p_usuario_id" "uuid", "p_plan_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'private', 'auth', 'extensions', 'pg_temp'
    AS $$
  select p_usuario_id is not null
    and (
      (
        private.authz_is_simulated_self(p_usuario_id)
        and case
          when private.authz_claim_has_role('JEFE_POSGRADO') then
            private.usuario_es_jefe_posgrado_encargado_plan(
              p_usuario_id,
              p_plan_id
            )
          else private.authz_claim_can_access_plan(p_plan_id)
        end
      )
      or (
        not private.authz_is_simulated_self(p_usuario_id)
        and (
          exists (
            select 1
            from public.planes_estudio pe
            join public.carreras c on c.id = pe.carrera_id
            join public.usuarios_roles ur on ur.usuario_id = p_usuario_id
            join public.roles r on r.id = ur.rol_id
            join public.usuarios_app ua on ua.id = ur.usuario_id
            where pe.id = p_plan_id
              and ua.dado_de_baja_en is null
              and (
                r.clave = 'ADMIN'
                or (
                  ur.facultad_id is null
                  and ur.carrera_id is null
                  and r.alcance_default = 'global'
                )
                or ur.carrera_id = pe.carrera_id
                or (
                  ur.facultad_id = c.facultad_id
                  and (
                    r.clave <> 'JEFE_POSGRADO'
                    or public.nivel_es_posgrado(c.nivel::text)
                  )
                )
              )
          )
          or exists (
            select 1
            from public.plan_expertos px
            join public.expertos e on e.id = px.experto_id
            where px.plan_estudio_id = p_plan_id
              and e.usuario_id = p_usuario_id
          )
        )
      )
    );
$$;


ALTER FUNCTION "private"."usuario_puede_acceder_plan"("p_usuario_id" "uuid", "p_plan_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."usuario_puede_comentar_asignatura"("p_usuario_id" "uuid", "p_asignatura_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'private', 'auth', 'extensions', 'pg_temp'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.asignaturas a
    WHERE a.id = p_asignatura_id
      AND public.usuario_puede_comentar_plan(p_usuario_id, a.plan_estudio_id)
  );
$$;


ALTER FUNCTION "private"."usuario_puede_comentar_asignatura"("p_usuario_id" "uuid", "p_asignatura_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."usuario_puede_comentar_plan"("p_usuario_id" "uuid", "p_plan_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'private', 'auth', 'extensions', 'pg_temp'
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


ALTER FUNCTION "private"."usuario_puede_comentar_plan"("p_usuario_id" "uuid", "p_plan_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."usuario_puede_editar_asignatura"("p_usuario_id" "uuid", "p_asignatura_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'private', 'auth', 'extensions', 'pg_temp'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.asignaturas a
    WHERE a.id = p_asignatura_id
      AND public.usuario_puede_editar_plan(p_usuario_id, a.plan_estudio_id)
  );
$$;


ALTER FUNCTION "private"."usuario_puede_editar_asignatura"("p_usuario_id" "uuid", "p_asignatura_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."usuario_puede_editar_campo_asignatura"("p_usuario_id" "uuid", "p_asignatura_id" "uuid", "p_clave" "text") RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'private', 'auth', 'extensions', 'pg_temp'
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


ALTER FUNCTION "private"."usuario_puede_editar_campo_asignatura"("p_usuario_id" "uuid", "p_asignatura_id" "uuid", "p_clave" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."usuario_puede_editar_campo_plan"("p_usuario_id" "uuid", "p_plan_id" "uuid", "p_clave" "text") RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'private', 'auth', 'extensions', 'pg_temp'
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


ALTER FUNCTION "private"."usuario_puede_editar_campo_plan"("p_usuario_id" "uuid", "p_plan_id" "uuid", "p_clave" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."usuario_puede_editar_plan"("p_usuario_id" "uuid", "p_plan_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'private', 'auth', 'extensions', 'pg_temp'
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


ALTER FUNCTION "private"."usuario_puede_editar_plan"("p_usuario_id" "uuid", "p_plan_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."usuario_puede_gestionar_rol"("p_actor" "uuid", "p_rol" "uuid", "p_facultad" "uuid" DEFAULT NULL::"uuid", "p_carrera" "uuid" DEFAULT NULL::"uuid") RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'private', 'auth', 'extensions', 'pg_temp'
    AS $$
declare
  v_rol record;
  v_carrera_facultad uuid;
begin
  if p_actor is null or p_rol is null then
    return false;
  end if;

  if not exists (
    select 1
    from public.usuarios_app ua
    where ua.id = p_actor
      and ua.dado_de_baja_en is null
  ) then
    return false;
  end if;

  select r.id, r.clave, r.nivel_jerarquico, r.alcance_default
  into v_rol
  from public.roles r
  where r.id = p_rol;

  if not found then
    return false;
  end if;

  if p_facultad is not null and p_carrera is not null then
    return false;
  end if;

  if v_rol.alcance_default = 'global'
    and (p_facultad is not null or p_carrera is not null) then
    return false;
  end if;

  if v_rol.alcance_default = 'facultad'
    and (p_facultad is null or p_carrera is not null) then
    return false;
  end if;

  if v_rol.alcance_default = 'carrera'
    and (p_carrera is null or p_facultad is not null) then
    return false;
  end if;

  if v_rol.alcance_default in ('asignatura', 'externo') then
    return false;
  end if;

  if private.usuario_tiene_rol_activo(p_actor, 'ADMIN') then
    return true;
  end if;

  if v_rol.clave = 'ADMIN' then
    return false;
  end if;

  if private.usuario_tiene_rol_activo(p_actor, 'VICERRECTOR_ACADEMICO') then
    return v_rol.nivel_jerarquico > 10;
  end if;

  if p_carrera is not null then
    select c.facultad_id
    into v_carrera_facultad
    from public.carreras c
    where c.id = p_carrera;

    if v_carrera_facultad is null then
      return false;
    end if;
  end if;

  if v_rol.alcance_default = 'facultad' then
    if exists (
      select 1
      from public.usuarios_roles ur
      join public.roles r on r.id = ur.rol_id
      where ur.usuario_id = p_actor
        and ur.facultad_id = p_facultad
        and r.clave = 'DIRECTOR_FACULTAD'
        and v_rol.nivel_jerarquico > 20
    ) then
      return true;
    end if;

    return exists (
      select 1
      from public.usuarios_roles ur
      join public.roles r on r.id = ur.rol_id
      where ur.usuario_id = p_actor
        and ur.facultad_id = p_facultad
        and r.clave = 'SECRETARIO_ACADEMICO'
        and v_rol.clave in ('JEFE_CARRERA', 'JEFE_POSGRADO')
    );
  end if;

  if v_rol.alcance_default = 'carrera' then
    if exists (
      select 1
      from public.usuarios_roles ur
      join public.roles r on r.id = ur.rol_id
      where ur.usuario_id = p_actor
        and ur.facultad_id = v_carrera_facultad
        and r.clave = 'DIRECTOR_FACULTAD'
        and v_rol.nivel_jerarquico > 20
    ) then
      return true;
    end if;

    return exists (
      select 1
      from public.usuarios_roles ur
      join public.roles r on r.id = ur.rol_id
      where ur.usuario_id = p_actor
        and ur.facultad_id = v_carrera_facultad
        and r.clave = 'SECRETARIO_ACADEMICO'
        and v_rol.clave = 'JEFE_CARRERA'
    );
  end if;

  return false;
end;
$$;


ALTER FUNCTION "private"."usuario_puede_gestionar_rol"("p_actor" "uuid", "p_rol" "uuid", "p_facultad" "uuid", "p_carrera" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."usuario_puede_gestionar_usuario"("p_actor" "uuid", "p_usuario" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'private', 'auth', 'extensions', 'pg_temp'
    AS $$
declare
  v_target record;
  v_formal_roles int := 0;
  v_unmanageable_roles boolean := false;
  v_has_responsabilidades boolean := false;
  v_uncovered_responsabilidades boolean := false;
begin
  if p_actor is null or p_usuario is null or p_actor = p_usuario then
    return false;
  end if;

  if not exists (
    select 1
    from public.usuarios_app ua
    where ua.id = p_actor
      and ua.dado_de_baja_en is null
  ) then
    return false;
  end if;

  select ua.id, ua.invitado_por
  into v_target
  from public.usuarios_app ua
  where ua.id = p_usuario;

  if not found then
    return false;
  end if;

  if private.usuario_tiene_rol_activo(p_actor, 'ADMIN') then
    return true;
  end if;

  if exists (
    select 1
    from public.usuarios_roles ur
    join public.roles r on r.id = ur.rol_id
    where ur.usuario_id = p_usuario
      and r.clave = 'ADMIN'
  ) then
    return false;
  end if;

  if private.usuario_tiene_rol_activo(p_actor, 'VICERRECTOR_ACADEMICO') then
    return true;
  end if;

  select
    count(*),
    coalesce(
      bool_or(
        not private.usuario_puede_gestionar_rol(
          p_actor,
          ur.rol_id,
          ur.facultad_id,
          ur.carrera_id
        )
      ),
      false
    )
  into v_formal_roles, v_unmanageable_roles
  from public.usuarios_roles ur
  join public.roles r on r.id = ur.rol_id
  where ur.usuario_id = p_usuario
    and r.alcance_default in ('global', 'facultad', 'carrera');

  if v_formal_roles > 0 then
    if v_unmanageable_roles then
      return false;
    end if;

    select coalesce(
      bool_or(
        not private.usuario_cubre_carrera_para_gestion(
          p_actor,
          pe.carrera_id,
          true
        )
      ),
      false
    )
    into v_uncovered_responsabilidades
    from public.responsables_asignatura ra
    join public.asignaturas a on a.id = ra.asignatura_id
    join public.planes_estudio pe on pe.id = a.plan_estudio_id
    where ra.usuario_id = p_usuario;

    return not v_uncovered_responsabilidades;
  end if;

  if v_target.invitado_por = p_actor then
    return true;
  end if;

  select exists (
    select 1
    from public.responsables_asignatura ra
    where ra.usuario_id = p_usuario
  )
  into v_has_responsabilidades;

  if v_has_responsabilidades then
    select coalesce(
      bool_or(
        not private.usuario_cubre_carrera_para_gestion(
          p_actor,
          pe.carrera_id,
          false
        )
      ),
      false
    )
    into v_uncovered_responsabilidades
    from public.responsables_asignatura ra
    join public.asignaturas a on a.id = ra.asignatura_id
    join public.planes_estudio pe on pe.id = a.plan_estudio_id
    where ra.usuario_id = p_usuario;

    return not v_uncovered_responsabilidades;
  end if;

  return false;
end;
$$;


ALTER FUNCTION "private"."usuario_puede_gestionar_usuario"("p_actor" "uuid", "p_usuario" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."usuario_puede_transicionar_asignatura"("p_usuario_id" "uuid", "p_asignatura_id" "uuid", "p_nuevo_estado" "public"."estado_asignatura") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'private', 'auth', 'extensions', 'pg_temp'
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


ALTER FUNCTION "private"."usuario_puede_transicionar_asignatura"("p_usuario_id" "uuid", "p_asignatura_id" "uuid", "p_nuevo_estado" "public"."estado_asignatura") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."usuario_puede_transicionar_plan"("p_usuario_id" "uuid", "p_plan_id" "uuid", "p_hacia_estado_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'private', 'auth', 'extensions', 'pg_temp'
    AS $$
  select public.usuario_puede_acceder_plan(p_usuario_id, p_plan_id)
    and (
      public.usuario_tiene_rol_en_plan(p_usuario_id, p_plan_id, 'ADMIN')
      or exists (
        select 1
        from public.transiciones_estado_plan t
        join public.planes_estudio pe on pe.id = p_plan_id
        join public.estructuras_plan ep on ep.id = pe.estructura_id
        join public.roles r on r.id = t.rol_permitido_id
        where t.desde_estado_id = pe.estado_actual_id
          and t.hacia_estado_id = p_hacia_estado_id
          and (t.tipo_estructura is null or t.tipo_estructura = ep.tipo)
          and public.usuario_tiene_rol_contextual_plan(p_usuario_id, p_plan_id, r.clave)
      )
    );
$$;


ALTER FUNCTION "private"."usuario_puede_transicionar_plan"("p_usuario_id" "uuid", "p_plan_id" "uuid", "p_hacia_estado_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."usuario_puede_usar_ia_asignatura"("p_usuario_id" "uuid", "p_asignatura_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'private', 'auth', 'extensions', 'pg_temp'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.asignaturas a
    WHERE a.id = p_asignatura_id
      AND public.usuario_puede_usar_ia_plan(p_usuario_id, a.plan_estudio_id)
  );
$$;


ALTER FUNCTION "private"."usuario_puede_usar_ia_asignatura"("p_usuario_id" "uuid", "p_asignatura_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."usuario_tiene_rol_activo"("p_usuario_id" "uuid", "p_rol" "text") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'private', 'auth', 'extensions', 'pg_temp'
    AS $$
  select p_usuario_id is not null
    and exists (
      select 1
      from public.usuarios_roles ur
      join public.roles r on r.id = ur.rol_id
      join public.usuarios_app ua on ua.id = ur.usuario_id
      where ur.usuario_id = p_usuario_id
        and ua.dado_de_baja_en is null
        and r.clave = p_rol
    );
$$;


ALTER FUNCTION "private"."usuario_tiene_rol_activo"("p_usuario_id" "uuid", "p_rol" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."usuario_tiene_rol_contextual_plan"("p_usuario_id" "uuid", "p_plan_id" "uuid", "p_rol" "text") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'private', 'auth', 'extensions', 'pg_temp'
    AS $$
  SELECT CASE
    WHEN p_rol = 'JEFE_CARRERA' THEN public.usuario_es_jefe_encargado_plan(p_usuario_id, p_plan_id)
    ELSE public.usuario_tiene_rol_en_plan(p_usuario_id, p_plan_id, p_rol)
  END;
$$;


ALTER FUNCTION "private"."usuario_tiene_rol_contextual_plan"("p_usuario_id" "uuid", "p_plan_id" "uuid", "p_rol" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."usuario_tiene_rol_en_plan"("p_usuario_id" "uuid", "p_plan_id" "uuid", "p_rol" "text") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'private', 'auth', 'extensions', 'pg_temp'
    AS $$
  select p_usuario_id is not null
    and (
      (
        private.authz_is_simulated_self(p_usuario_id)
        and private.authz_claim_has_role(p_rol)
        and case
          when p_rol = 'JEFE_POSGRADO' then
            private.usuario_es_jefe_posgrado_encargado_plan(
              p_usuario_id,
              p_plan_id
            )
          else private.authz_claim_can_access_plan(p_plan_id)
        end
      )
      or (
        not private.authz_is_simulated_self(p_usuario_id)
        and exists (
          select 1
          from public.planes_estudio pe
          join public.carreras c on c.id = pe.carrera_id
          join public.usuarios_roles ur on ur.usuario_id = p_usuario_id
          join public.roles r on r.id = ur.rol_id
          join public.usuarios_app ua on ua.id = ur.usuario_id
          where pe.id = p_plan_id
            and ua.dado_de_baja_en is null
            and r.clave = p_rol
            and (
              r.clave = 'ADMIN'
              or (
                ur.facultad_id is null
                and ur.carrera_id is null
                and r.alcance_default = 'global'
              )
              or ur.carrera_id = pe.carrera_id
              or (
                ur.facultad_id = c.facultad_id
                and (
                  r.clave <> 'JEFE_POSGRADO'
                  or public.nivel_es_posgrado(c.nivel::text)
                )
              )
            )
        )
      )
    );
$$;


ALTER FUNCTION "private"."usuario_tiene_rol_en_plan"("p_usuario_id" "uuid", "p_plan_id" "uuid", "p_rol" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."activar_cron_documentos_academicos"() RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_job_id bigint;
  v_secretos integer;
begin
  select jobid into v_job_id from cron.job where jobname = 'procesar-documentos-ia-1m';
  if v_job_id is null then
    raise exception using errcode = '55000', message = 'El cron documental no está provisionado';
  end if;
  select count(*) into v_secretos
  from vault.decrypted_secrets
  where name in ('FILE_JOBS_CRON_URL', 'FILE_JOBS_CRON_PUBLISHABLE_KEY', 'FILE_JOBS_CRON_SECRET')
    and nullif(decrypted_secret, '') is not null;
  if v_secretos <> 3 then
    raise exception using errcode = '55000', message = 'Faltan secretos documentales en Vault';
  end if;
  perform cron.alter_job(job_id := v_job_id, active := true);
  return true;
end;
$$;


ALTER FUNCTION "public"."activar_cron_documentos_academicos"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."activar_cron_recuperacion_ia"() RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_job_id bigint;
  v_secretos integer;
begin
  select j.jobid into v_job_id
  from cron.job j
  where j.jobname = 'recuperar-generaciones-ia-30s';
  if v_job_id is null then
    raise exception using errcode = '55000', message = 'El cron de recuperación no está provisionado';
  end if;

  select count(*) into v_secretos
  from vault.decrypted_secrets
  where name in (
    'AI_RECOVERY_CRON_URL',
    'AI_RECOVERY_CRON_PUBLISHABLE_KEY',
    'AI_RECOVERY_CRON_SECRET'
  ) and nullif(decrypted_secret, '') is not null;
  if v_secretos <> 3 then
    raise exception using errcode = '55000', message = 'Faltan secretos de recuperación en Vault';
  end if;

  perform cron.alter_job(job_id := v_job_id, active := true);
  return true;
end;
$$;


ALTER FUNCTION "public"."activar_cron_recuperacion_ia"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."adoptar_publicar_intento_chat_ia_webhook"("p_intento_id" "uuid", "p_openai_response_id" "text", "p_estado_openai" "text", "p_iniciado_en" timestamp with time zone DEFAULT "now"()) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_intento private.intentos_chat_ia;
  v_response_id text := nullif(btrim(p_openai_response_id), '');
begin
  if p_intento_id is null or v_response_id is null then
    raise exception using errcode = '22023', message = 'intento y response_id son requeridos';
  end if;
  select * into v_intento
  from private.intentos_chat_ia i
  where i.id = p_intento_id
  for update;
  if not found then
    return jsonb_build_object('resolution', 'stale');
  end if;
  if v_intento.estado in ('fallido', 'expirado') then
    return jsonb_build_object(
      'resolution', 'stale',
      'attempt', private.intento_chat_ia_json(p_intento_id)
    );
  end if;
  if v_intento.openai_response_id is not null
     and v_intento.openai_response_id <> v_response_id then
    return jsonb_build_object(
      'resolution', 'claimed_elsewhere',
      'attempt', private.intento_chat_ia_json(p_intento_id)
    );
  end if;
  if v_intento.openai_response_id is null then
    update private.intentos_chat_ia
    set estado = 'respuesta_vinculada',
        openai_response_id = v_response_id,
        estado_openai = coalesce(nullif(btrim(p_estado_openai), ''), 'queued'),
        iniciado_en = coalesce(p_iniciado_en, now()),
        actualizado_en = now()
    where id = p_intento_id;
  end if;
  return private.publicar_intento_chat_ia_interno(p_intento_id);
end;
$$;


ALTER FUNCTION "public"."adoptar_publicar_intento_chat_ia_webhook"("p_intento_id" "uuid", "p_openai_response_id" "text", "p_estado_openai" "text", "p_iniciado_en" timestamp with time zone) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."adoptar_publicar_intento_chat_ia_webhook"("p_intento_id" "uuid", "p_openai_response_id" "text", "p_estado_openai" "text", "p_iniciado_en" timestamp with time zone) IS 'Permite al webhook verificado rescatar y publicar un intento cuyo iniciador cayó antes de guardar response_id.';



CREATE OR REPLACE FUNCTION "public"."adoptar_publicar_intento_entidad_ia_webhook"("p_intento_id" "uuid", "p_openai_response_id" "text", "p_estado_openai" "text", "p_iniciado_en" timestamp with time zone DEFAULT "now"()) RETURNS "jsonb"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select private.publicar_intento_entidad_ia_interno(
    p_intento_id,
    null,
    false,
    p_openai_response_id,
    p_estado_openai,
    p_iniciado_en
  );
$$;


ALTER FUNCTION "public"."adoptar_publicar_intento_entidad_ia_webhook"("p_intento_id" "uuid", "p_openai_response_id" "text", "p_estado_openai" "text", "p_iniciado_en" timestamp with time zone) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."adoptar_publicar_intento_entidad_ia_webhook"("p_intento_id" "uuid", "p_openai_response_id" "text", "p_estado_openai" "text", "p_iniciado_en" timestamp with time zone) IS 'Permite que el webhook verificado vincule y publique el primer response_id de un intento activo.';



CREATE OR REPLACE FUNCTION "public"."adoptar_publicar_intento_recursos_ia_webhook"("p_intento_id" "uuid", "p_openai_response_id" "text", "p_estado_openai" "text", "p_iniciado_en" timestamp with time zone DEFAULT "now"()) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_intento private.intentos_generacion_ia;
  v_token uuid := gen_random_uuid();
  v_usuario_id uuid;
  v_response_id text := nullif(btrim(p_openai_response_id), '');
begin
  if p_intento_id is null or v_response_id is null then
    raise exception using errcode = '22023', message = 'intento y response_id son requeridos';
  end if;
  select i.* into v_intento
  from private.intentos_generacion_ia i
  where i.id = p_intento_id
  for update;
  if not found then
    return jsonb_build_object('resolution', 'stale', 'attempt', null);
  end if;
  if v_intento.handler <> 'learning-resources'
     or v_intento.tipo_entidad <> 'recursos_aprendizaje'
     or v_intento.estado in ('fallido', 'expirado', 'obsoleto') then
    return jsonb_build_object(
      'resolution', 'stale',
      'attempt', private.intento_generacion_ia_json(p_intento_id)
    );
  end if;
  if v_intento.openai_response_id is not null
     and v_intento.openai_response_id <> v_response_id then
    return jsonb_build_object(
      'resolution', 'claimed_elsewhere',
      'attempt', private.intento_generacion_ia_json(p_intento_id),
      'winnerResponseId', v_intento.openai_response_id
    );
  end if;
  if v_intento.estado = 'publicado' then
    return jsonb_build_object(
      'resolution', 'already_applied',
      'attempt', private.intento_generacion_ia_json(p_intento_id)
    );
  end if;
  begin
    v_usuario_id := (v_intento.contexto ->> 'userId')::uuid;
  exception when invalid_text_representation or null_value_not_allowed then
    raise exception using errcode = '22023', message = 'el intento no contiene un usuario válido';
  end;

  update private.intentos_generacion_ia
  set estado = 'respuesta_vinculada',
      openai_response_id = v_response_id,
      estado_openai = coalesce(nullif(btrim(p_estado_openai), ''), 'queued'),
      iniciado_en = coalesce(p_iniciado_en, now()),
      token_reclamacion = v_token,
      reclamado_por = 'webhook:learning-resources',
      reclamado_hasta = now() + interval '2 minutes',
      actualizado_en = now()
  where id = p_intento_id;

  return public.publicar_intento_recursos_ia(
    p_intento_id,
    v_token,
    v_intento.entidad_id,
    v_usuario_id,
    v_response_id,
    case when p_estado_openai = 'queued' then 'queued' else 'running' end,
    p_estado_openai,
    p_iniciado_en,
    jsonb_build_object('source', 'openai-webhook')
  );
end;
$$;


ALTER FUNCTION "public"."adoptar_publicar_intento_recursos_ia_webhook"("p_intento_id" "uuid", "p_openai_response_id" "text", "p_estado_openai" "text", "p_iniciado_en" timestamp with time zone) OWNER TO "postgres";


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
    SET "search_path" TO 'public', 'private', 'auth', 'extensions', 'pg_temp'
    AS $$
  update conversaciones_asignatura
  set conversacion_json = coalesce(conversacion_json, '[]'::jsonb) || p_append
  where id = p_id;
$$;


ALTER FUNCTION "public"."append_conversacion_asignatura"("p_id" "uuid", "p_append" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."append_conversacion_plan"("p_id" "uuid", "p_append" "jsonb") RETURNS "void"
    LANGUAGE "sql"
    SET "search_path" TO 'public', 'private', 'auth', 'extensions', 'pg_temp'
    AS $$
  update conversaciones_plan
  set conversacion_json = coalesce(conversacion_json, '[]'::jsonb) || p_append
  where id = p_id;
$$;


ALTER FUNCTION "public"."append_conversacion_plan"("p_id" "uuid", "p_append" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."authz_admin_override_audit"("p_plan_id" "uuid") RETURNS TABLE("admin_override" boolean, "motivo" "text", "estado_clave" "text")
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public', 'private', 'auth', 'extensions', 'pg_temp'
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
    SET "search_path" TO 'public', 'private', 'auth', 'extensions', 'pg_temp'
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


CREATE OR REPLACE FUNCTION "public"."authz_asignatura_content_write_allowed"("p_asignatura_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public', 'private', 'auth', 'extensions', 'pg_temp'
    AS $$
  select public.authz_asignatura_write_allowed(p_asignatura_id)
    or private.authz_asignatura_responsable_editor(p_asignatura_id);
$$;


ALTER FUNCTION "public"."authz_asignatura_content_write_allowed"("p_asignatura_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."authz_asignatura_ia_allowed"("p_asignatura_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public', 'private', 'auth', 'extensions', 'pg_temp'
    AS $$
  SELECT public.usuario_puede_usar_ia_asignatura(auth.uid(), p_asignatura_id);
$$;


ALTER FUNCTION "public"."authz_asignatura_ia_allowed"("p_asignatura_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."authz_asignatura_restricted_field_write_allowed"("p_asignatura_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public', 'private', 'auth', 'extensions', 'pg_temp'
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
    SET "search_path" TO 'public', 'private', 'auth', 'extensions', 'pg_temp'
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
    SET "search_path" TO 'public', 'private', 'auth', 'extensions', 'pg_temp'
    AS $$
  SELECT public.authz_asignatura_write_allowed(p_asignatura_id)
    OR public.usuario_puede_editar_campo_asignatura(auth.uid(), p_asignatura_id, p_clave);
$$;


ALTER FUNCTION "public"."authz_campo_asignatura_write_allowed"("p_asignatura_id" "uuid", "p_clave" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."authz_campo_plan_write_allowed"("p_plan_id" "uuid", "p_clave" "text") RETURNS boolean
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public', 'private', 'auth', 'extensions', 'pg_temp'
    AS $$
  SELECT public.authz_plan_write_allowed(p_plan_id)
    OR public.usuario_puede_editar_campo_plan(auth.uid(), p_plan_id, p_clave);
$$;


ALTER FUNCTION "public"."authz_campo_plan_write_allowed"("p_plan_id" "uuid", "p_clave" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."authz_can_access_asignatura"("p_asignatura_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public', 'private', 'auth', 'extensions', 'pg_temp'
    AS $$
  select exists (
    select 1
    from public.asignaturas a
    where a.id = p_asignatura_id
      and (
        public.authz_can_access_plan(a.plan_estudio_id)
        or public.authz_is_responsable_asignatura(a.id)
      )
  );
$$;


ALTER FUNCTION "public"."authz_can_access_asignatura"("p_asignatura_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."authz_can_access_carrera"("p_carrera_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public', 'private', 'auth', 'extensions', 'pg_temp'
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
    SET "search_path" TO 'public', 'private', 'auth', 'extensions', 'pg_temp'
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
    SET "search_path" TO 'public', 'private', 'auth', 'extensions', 'pg_temp'
    AS $$
  SELECT public.usuario_puede_acceder_plan(auth.uid(), p_plan_id);
$$;


ALTER FUNCTION "public"."authz_can_access_plan"("p_plan_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."authz_can_create_carrera_catalog"("p_facultad_id" "uuid", "p_nivel" "text") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'private', 'auth', 'extensions', 'pg_temp'
    AS $$
  select p_facultad_id is not null
    and (
      (
        public.authz_simulacion_activa()
        and private.authz_claim_has_permission('catalogos.gestionar')
      )
      or (
        not public.authz_simulacion_activa()
        and public.authz_has_permission('catalogos.gestionar'::text)
      )
      or (
        public.authz_simulacion_activa()
        and (
          private.authz_claim_has_global_scope()
          or (
            (
              private.authz_claim_has_role('DIRECTOR_FACULTAD')
              or private.authz_claim_has_role('SECRETARIO_ACADEMICO')
            )
            and private.authz_claim_has_facultad_scope(p_facultad_id)
          )
          or (
            private.authz_claim_has_role('JEFE_POSGRADO')
            and private.authz_claim_has_facultad_scope(p_facultad_id)
            and public.nivel_es_posgrado(p_nivel)
          )
        )
      )
      or (
        not public.authz_simulacion_activa()
        and exists (
          select 1
          from public.usuarios_app ua
          where ua.id = auth.uid()
            and ua.dado_de_baja_en is null
        )
        and (
          private.usuario_tiene_rol_activo(auth.uid(), 'ADMIN')
          or private.usuario_tiene_rol_activo(
            auth.uid(),
            'VICERRECTOR_ACADEMICO'
          )
          or exists (
            select 1
            from public.usuarios_roles ur
            join public.roles r on r.id = ur.rol_id
            where ur.usuario_id = auth.uid()
              and ur.facultad_id = p_facultad_id
              and r.clave in ('DIRECTOR_FACULTAD', 'SECRETARIO_ACADEMICO')
          )
          or (
            public.nivel_es_posgrado(p_nivel)
            and exists (
              select 1
              from public.usuarios_roles ur
              join public.roles r on r.id = ur.rol_id
              where ur.usuario_id = auth.uid()
                and ur.facultad_id = p_facultad_id
                and r.clave = 'JEFE_POSGRADO'
            )
          )
        )
      )
    );
$$;


ALTER FUNCTION "public"."authz_can_create_carrera_catalog"("p_facultad_id" "uuid", "p_nivel" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."authz_can_list_plan_catalog_for_facultad"("p_facultad_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'private', 'auth', 'extensions', 'pg_temp'
    AS $$
  select p_facultad_id is not null
    and (
      (
        public.authz_simulacion_activa()
        and private.authz_claim_has_permission('planes.ver')
        and (
          private.authz_claim_has_global_scope()
          or private.authz_claim_has_facultad_scope(p_facultad_id)
          or exists (
            select 1
            from jsonb_array_elements_text(
              coalesce(auth.jwt() #> '{app_metadata,alcances,carreras}', '[]'::jsonb)
            ) as alcance(value)
            join public.carreras c on c.id::text = alcance.value
            where c.facultad_id = p_facultad_id
          )
        )
      )
      or (
        not public.authz_simulacion_activa()
        and public.authz_has_permission('planes.ver'::text)
        and exists (
          select 1
          from public.usuarios_roles ur
          join public.roles r on r.id = ur.rol_id
          join public.usuarios_app ua on ua.id = ur.usuario_id
          left join public.carreras c_scope on c_scope.id = ur.carrera_id
          where ur.usuario_id = auth.uid()
            and ua.dado_de_baja_en is null
            and (
              r.clave = 'ADMIN'
              or (
                ur.facultad_id is null
                and ur.carrera_id is null
                and r.alcance_default = 'global'
              )
              or ur.facultad_id = p_facultad_id
              or c_scope.facultad_id = p_facultad_id
            )
        )
      )
    );
$$;


ALTER FUNCTION "public"."authz_can_list_plan_catalog_for_facultad"("p_facultad_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."authz_can_manage_carrera_catalog"("p_carrera_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'private', 'auth', 'extensions', 'pg_temp'
    AS $$
  select p_carrera_id is not null
    and exists (
      select 1
      from public.carreras c
      where c.id = p_carrera_id
        and (
          public.authz_can_create_carrera_catalog(
            c.facultad_id,
            c.nivel::text
          )
          or (
            public.authz_simulacion_activa()
            and private.authz_claim_has_role('JEFE_CARRERA')
            and private.authz_claim_has_carrera_scope(c.id)
          )
          or (
            not public.authz_simulacion_activa()
            and exists (
              select 1
              from public.usuarios_app ua
              where ua.id = auth.uid()
                and ua.dado_de_baja_en is null
            )
            and exists (
              select 1
              from public.usuarios_roles ur
              join public.roles r on r.id = ur.rol_id
              where ur.usuario_id = auth.uid()
                and ur.carrera_id = c.id
                and r.clave = 'JEFE_CARRERA'
            )
          )
        )
    );
$$;


ALTER FUNCTION "public"."authz_can_manage_carrera_catalog"("p_carrera_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."authz_can_manage_facultad_catalog"("p_facultad_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'private', 'auth', 'extensions', 'pg_temp'
    AS $$
  select p_facultad_id is not null
    and (
      (
        public.authz_simulacion_activa()
        and private.authz_claim_has_permission('catalogos.gestionar')
      )
      or (
        not public.authz_simulacion_activa()
        and public.authz_has_permission('catalogos.gestionar'::text)
      )
      or (
        public.authz_simulacion_activa()
        and (
          private.authz_claim_has_global_scope()
          or (
            private.authz_claim_has_role('DIRECTOR_FACULTAD')
            and private.authz_claim_has_facultad_scope(p_facultad_id)
          )
        )
      )
      or (
        not public.authz_simulacion_activa()
        and exists (
          select 1
          from public.usuarios_app ua
          where ua.id = auth.uid()
            and ua.dado_de_baja_en is null
        )
        and (
          private.usuario_tiene_rol_activo(auth.uid(), 'ADMIN')
          or private.usuario_tiene_rol_activo(
            auth.uid(),
            'VICERRECTOR_ACADEMICO'
          )
          or exists (
            select 1
            from public.usuarios_roles ur
            join public.roles r on r.id = ur.rol_id
            where ur.usuario_id = auth.uid()
              and ur.facultad_id = p_facultad_id
              and r.clave = 'DIRECTOR_FACULTAD'
          )
        )
      )
    );
$$;


ALTER FUNCTION "public"."authz_can_manage_facultad_catalog"("p_facultad_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."authz_has_bootstrap_access"() RETURNS boolean
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public', 'private', 'auth', 'extensions', 'pg_temp'
    AS $$
  SELECT COALESCE((auth.jwt() -> 'app_metadata' ->> 'authz_bootstrap')::boolean, false);
$$;


ALTER FUNCTION "public"."authz_has_bootstrap_access"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."authz_has_global_scope"() RETURNS boolean
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public', 'private', 'auth', 'extensions', 'pg_temp'
    AS $$
  select case
    when public.authz_simulacion_activa()
      then private.authz_claim_has_global_scope()
    else private.authz_user_has_global_scope(auth.uid())
      or private.authz_claim_has_global_scope()
  end;
$$;


ALTER FUNCTION "public"."authz_has_global_scope"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."authz_has_permission"("p_permiso" "text") RETURNS boolean
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public', 'private', 'auth', 'extensions', 'pg_temp'
    AS $$
  select case
    when public.authz_simulacion_activa()
      then private.authz_claim_has_role('ADMIN')
        or private.authz_claim_has_permission(p_permiso)
    else public.authz_is_admin()
      or private.authz_claim_has_permission(p_permiso)
      or private.authz_user_has_permission(auth.uid(), p_permiso)
  end;
$$;


ALTER FUNCTION "public"."authz_has_permission"("p_permiso" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."authz_has_role"("p_rol" "text") RETURNS boolean
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public', 'private', 'auth', 'extensions', 'pg_temp'
    AS $$
  select case
    when public.authz_simulacion_activa()
      then private.authz_claim_has_role(p_rol)
    else private.authz_claim_has_role(p_rol)
      or private.authz_user_has_role(auth.uid(), p_rol)
  end;
$$;


ALTER FUNCTION "public"."authz_has_role"("p_rol" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."authz_is_admin"() RETURNS boolean
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public', 'private', 'auth', 'extensions', 'pg_temp'
    AS $$
  select public.authz_has_role('ADMIN');
$$;


ALTER FUNCTION "public"."authz_is_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."authz_is_responsable_asignatura"("p_asignatura_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public', 'private', 'auth', 'extensions', 'pg_temp'
    AS $$ select private.authz_is_responsable_asignatura(p_asignatura_id); $$;


ALTER FUNCTION "public"."authz_is_responsable_asignatura"("p_asignatura_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."authz_is_responsable_de_plan"("p_plan_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public', 'private', 'auth', 'extensions', 'pg_temp'
    AS $$ select private.authz_is_responsable_de_plan(p_plan_id); $$;


ALTER FUNCTION "public"."authz_is_responsable_de_plan"("p_plan_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."authz_is_service_role"() RETURNS boolean
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO 'public', 'private', 'auth', 'extensions', 'pg_temp'
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
    SET "search_path" TO 'public', 'private', 'auth', 'extensions', 'pg_temp'
    AS $$
  SELECT public.usuario_puede_editar_plan(auth.uid(), p_plan_id)
    AND public.authz_has_permission('ia.usar')
    AND public.plan_estado_clave(p_plan_id) IN ('BORRADOR', 'REVISION');
$$;


ALTER FUNCTION "public"."authz_plan_ia_allowed"("p_plan_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."authz_plan_restricted_field_write_allowed"("p_plan_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public', 'private', 'auth', 'extensions', 'pg_temp'
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
    SET "search_path" TO 'public', 'private', 'auth', 'extensions', 'pg_temp'
    AS $$
  SELECT public.usuario_puede_editar_plan(auth.uid(), p_plan_id)
    OR (
      public.authz_is_admin()
      AND public.authz_admin_override_reason() IS NOT NULL
      AND public.authz_can_access_plan(p_plan_id)
    );
$$;


ALTER FUNCTION "public"."authz_plan_write_allowed"("p_plan_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."authz_simulacion_activa"() RETURNS boolean
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public', 'private', 'auth', 'extensions', 'pg_temp'
    AS $$
  select lower(coalesce(auth.jwt() #>> '{app_metadata,authz_simulacion,activa}', 'false')) = 'true';
$$;


ALTER FUNCTION "public"."authz_simulacion_activa"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."autorizar_uso_archivo_documental"("p_usuario_id" "uuid", "p_file_id" "uuid", "p_permiso" "public"."permiso_archivo_documental") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select private.documentos_usuario_puede_archivo(p_usuario_id, p_file_id, p_permiso)
$$;


ALTER FUNCTION "public"."autorizar_uso_archivo_documental"("p_usuario_id" "uuid", "p_file_id" "uuid", "p_permiso" "public"."permiso_archivo_documental") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."build_asignaturas_prefix_tsquery"("p_search" "text") RETURNS "tsquery"
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO 'public', 'private', 'auth', 'extensions', 'pg_temp'
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

  cleaned := lower(extensions.unaccent(cleaned));
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


CREATE OR REPLACE FUNCTION "public"."carreras_guard_scoped_catalog_update"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'private', 'auth', 'extensions', 'pg_temp'
    AS $$
begin
  -- Sin sesión JWT (migrations, seeds, scripts de mantenimiento) → permitir siempre.
  if auth.jwt() is null then
    return new;
  end if;

  if public.authz_can_create_carrera_catalog(new.facultad_id, new.nivel::text) then
    return new;
  end if;

  if public.authz_can_manage_carrera_catalog(old.id)
    and new.id = old.id
    and new.facultad_id is not distinct from old.facultad_id
    and new.nivel is not distinct from old.nivel
    and new.activa is not distinct from old.activa
    and new.creado_en is not distinct from old.creado_en
    and new.creado_por is not distinct from old.creado_por
  then
    return new;
  end if;

  raise exception 'No tienes permisos para cambiar el alcance, nivel o estado de esta carrera.'
    using errcode = '42501';
end;
$$;


ALTER FUNCTION "public"."carreras_guard_scoped_catalog_update"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."catalogo_asignaturas_buscar"("p_q" "text" DEFAULT NULL::"text", "p_facultad_id" "uuid" DEFAULT NULL::"uuid", "p_carrera_id" "uuid" DEFAULT NULL::"uuid", "p_plan_estudio_id" "uuid" DEFAULT NULL::"uuid", "p_tipo" "public"."tipo_asignatura" DEFAULT NULL::"public"."tipo_asignatura", "p_estado" "public"."estado_asignatura" DEFAULT NULL::"public"."estado_asignatura", "p_incluir_archivadas" boolean DEFAULT false, "p_limit" integer DEFAULT 20, "p_offset" integer DEFAULT 0) RETURNS TABLE("asignatura_id" "uuid", "plan_estudio_id" "uuid", "codigo" "text", "nombre" "text", "tipo" "public"."tipo_asignatura", "estado" "public"."estado_asignatura", "creditos" numeric, "numero_ciclo" integer, "plan_nombre" "text", "plan_tipo_estructura" "public"."tipo_estructura_plan", "carrera_id" "uuid", "carrera_nombre" "text", "carrera_nivel" "public"."nivel_plan_estudio", "facultad_id" "uuid", "facultad_nombre" "text", "facultad_nombre_corto" "text", "facultad_prefijo" "text", "facultad_color" "text", "facultad_icono" "text", "responsables" "jsonb", "motivos_acceso" "jsonb", "rank" real, "total_count" bigint)
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_uid uuid := auth.uid();
  v_is_global boolean := public.authz_has_global_scope();
  v_facultades uuid[];
  v_carreras uuid[];
  v_tsq tsquery := public.build_asignaturas_prefix_tsquery(p_q);
  v_limit int := greatest(1, least(coalesce(p_limit, 20), 100));
  v_offset int := greatest(0, coalesce(p_offset, 0));
begin
  if v_uid is null then
    return;
  end if;
  if not (
    public.authz_has_permission('asignaturas.ver')
    or public.authz_has_permission('planes.ver')
  ) then
    return;
  end if;

  select coalesce(array_agg((value)::uuid), '{}')
  into v_facultades
  from jsonb_array_elements_text(
    coalesce(auth.jwt() #> '{app_metadata,alcances,facultades}', '[]'::jsonb)
  ) as t(value);

  select coalesce(array_agg((value)::uuid), '{}')
  into v_carreras
  from jsonb_array_elements_text(
    coalesce(auth.jwt() #> '{app_metadata,alcances,carreras}', '[]'::jsonb)
  ) as t(value);

  return query
  with visibles as (
    select
      a.id,
      a.plan_estudio_id,
      a.codigo,
      a.nombre,
      a.tipo,
      a.estado,
      a.creditos,
      a.numero_ciclo,
      pe.nombre_display as plan_nombre,
      ep.tipo as plan_tipo_estructura,
      c.id as carrera_id,
      c.nombre as carrera_nombre,
      c.nivel as carrera_nivel,
      f.id as facultad_id,
      f.nombre as facultad_nombre,
      f.nombre_corto as facultad_nombre_corto,
      f.prefijo as facultad_prefijo,
      f.color as facultad_color,
      f.icono as facultad_icono,
      coalesce(ts_rank(a.search_vector, v_tsq), 0)::real as rank
    from public.asignaturas a
    join public.planes_estudio pe on pe.id = a.plan_estudio_id
    join public.estructuras_plan ep on ep.id = pe.estructura_id
    join public.carreras c on c.id = pe.carrera_id
    join public.facultades f on f.id = c.facultad_id
    where
      (
        public.authz_can_access_plan(a.plan_estudio_id)
        or public.authz_is_responsable_asignatura(a.id)
      )
      and (v_tsq is null or a.search_vector @@ v_tsq)
      and (p_facultad_id is null or c.facultad_id = p_facultad_id)
      and (p_carrera_id is null or pe.carrera_id = p_carrera_id)
      and (p_plan_estudio_id is null or a.plan_estudio_id = p_plan_estudio_id)
      and (p_tipo is null or a.tipo = p_tipo)
      and (p_estado is null or a.estado = p_estado)
      and (p_incluir_archivadas or p_estado is not null or a.estado <> 'archivada')
  )
  select
    v.id,
    v.plan_estudio_id,
    v.codigo,
    v.nombre,
    v.tipo,
    v.estado,
    v.creditos,
    v.numero_ciclo,
    v.plan_nombre,
    v.plan_tipo_estructura,
    v.carrera_id,
    v.carrera_nombre,
    v.carrera_nivel,
    v.facultad_id,
    v.facultad_nombre,
    v.facultad_nombre_corto,
    v.facultad_prefijo,
    v.facultad_color,
    v.facultad_icono,
    coalesce(resp.responsables, '[]'::jsonb) as responsables,
    coalesce(mot.motivos, '[]'::jsonb) as motivos_acceso,
    v.rank,
    count(*) over () as total_count
  from visibles v
  left join lateral (
    select jsonb_agg(
      jsonb_build_object(
        'usuario_id', ra.usuario_id,
        'rol', ra.rol,
        'nombre', ua.nombre_completo
      ) order by ra.rol, ua.nombre_completo
    ) as responsables
    from public.responsables_asignatura ra
    left join public.usuarios_app ua on ua.id = ra.usuario_id
    where ra.asignatura_id = v.id
  ) resp on true
  left join lateral (
    select jsonb_agg(m.motivo order by m.orden) as motivos
    from (
      select 0 as orden,
        jsonb_build_object('tipo', 'global', 'label', 'Visible globalmente') as motivo
      where v_is_global
      union all
      select 1, jsonb_build_object('tipo', 'facultad', 'label', 'Visible por facultad')
      where not v_is_global and v.facultad_id = any (v_facultades)
      union all
      select 2, jsonb_build_object('tipo', 'carrera', 'label', 'Visible por carrera')
      where not v_is_global and v.carrera_id = any (v_carreras)
      union all
      select 3, jsonb_build_object('tipo', 'experto', 'label', 'Visible como experto invitado')
      where not v_is_global
        and exists (
          select 1
          from public.plan_expertos px
          join public.expertos e on e.id = px.experto_id
          where px.plan_estudio_id = v.plan_estudio_id
            and e.usuario_id = v_uid
        )
      union all
      select 4,
        jsonb_build_object(
          'tipo', 'responsable_asignatura',
          'rol', ra.rol,
          'label', case ra.rol
            when 'PROFESOR_RESPONSABLE' then 'Asignada como Profesor responsable'
            when 'COAUTOR' then 'Asignada como Coautor'
            when 'REVISOR' then 'Asignada como Revisor'
            else 'Asignada'
          end
        )
      from public.responsables_asignatura ra
      where ra.asignatura_id = v.id and ra.usuario_id = v_uid
    ) m
  ) mot on true
  order by
    (case when v_tsq is not null then v.rank else 0 end) desc,
    v.nombre asc
  limit v_limit
  offset v_offset;
end;
$$;


ALTER FUNCTION "public"."catalogo_asignaturas_buscar"("p_q" "text", "p_facultad_id" "uuid", "p_carrera_id" "uuid", "p_plan_estudio_id" "uuid", "p_tipo" "public"."tipo_asignatura", "p_estado" "public"."estado_asignatura", "p_incluir_archivadas" boolean, "p_limit" integer, "p_offset" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."confirmar_terminal_intento_generacion_ia"("p_intento_id" "uuid", "p_token_reclamacion" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_actualizado integer;
begin
  update private.intentos_generacion_ia i
  set terminal_aplicado_en = coalesce(i.terminal_aplicado_en, now()),
      token_reclamacion = null,
      reclamado_por = null,
      reclamado_hasta = null,
      actualizado_en = now()
  where i.id = p_intento_id
    and i.estado in ('fallido', 'expirado')
    and i.terminal_aplicado_en is null
    and i.token_reclamacion = p_token_reclamacion
    and i.reclamado_hasta > now();
  get diagnostics v_actualizado = row_count;
  return v_actualizado = 1;
end;
$$;


ALTER FUNCTION "public"."confirmar_terminal_intento_generacion_ia"("p_intento_id" "uuid", "p_token_reclamacion" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."confirmar_terminal_intento_generacion_ia"("p_intento_id" "uuid", "p_token_reclamacion" "uuid") IS 'Confirma dentro de la transición del handler que el fallo terminal ya se aplicó a la entidad vigente.';



CREATE OR REPLACE FUNCTION "public"."consultar_intento_chat_ia"("p_intento_id" "uuid") RETURNS "jsonb"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select public.consultar_intento_generacion_ia(p_intento_id);
$$;


ALTER FUNCTION "public"."consultar_intento_chat_ia"("p_intento_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."consultar_intento_generacion_ia"("p_intento_id" "uuid") RETURNS "jsonb"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select private.intento_generacion_ia_json(p_intento_id);
$$;


ALTER FUNCTION "public"."consultar_intento_generacion_ia"("p_intento_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."consultar_publicacion_generacion_recursos_ia"("p_generation_job_id" "uuid", "p_openai_response_id" "text", "p_modo_referencias" "text", "p_consulta_referencias" "text", "p_referencias" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_job public.learning_generation_jobs;
  v_trabajo public.trabajos_generacion_ia;
  v_referencia jsonb;
  v_chunk_ids uuid[];
  v_conteo integer := case
    when jsonb_typeof(p_referencias) = 'array' then jsonb_array_length(p_referencias)
    else -1
  end;
begin
  select j.* into v_job
  from public.learning_generation_jobs j
  where j.id = p_generation_job_id;

  if not found or v_job.openai_response_id is null then
    return jsonb_build_object('resolution', 'missing');
  end if;
  if v_job.openai_response_id <> p_openai_response_id then
    return jsonb_build_object(
      'resolution', 'claimed_elsewhere',
      'winnerResponseId', v_job.openai_response_id,
      'localJob', to_jsonb(v_job)
    );
  end if;

  select t.* into v_trabajo
  from public.trabajos_generacion_ia t
  where t.tipo_entidad = 'recursos_aprendizaje'
    and t.entidad_id = p_generation_job_id
    and t.openai_response_id = p_openai_response_id;
  if not found or v_conteo < 0 then
    return jsonb_build_object('resolution', 'incomplete', 'localJob', to_jsonb(v_job));
  end if;

  for v_referencia in
    select value from jsonb_array_elements(p_referencias)
  loop
    begin
      select coalesce(array_agg(chunk_id), '{}'::uuid[])
      into v_chunk_ids
      from (
        select jsonb_array_elements_text(v_referencia -> 'chunkIds')::uuid as chunk_id
      ) chunks;
    exception when others then
      return jsonb_build_object('resolution', 'incomplete', 'localJob', to_jsonb(v_job));
    end;

    if not exists (
      select 1
      from public.ai_request_references ar
      where ar.request_id = p_openai_response_id
        and ar.conversation_type = 'asignatura'
        and ar.conversation_id = v_job.asignatura_id
        and ar.message_type = 'asignatura'
        and ar.message_id is null
        and ar.file_id::text = v_referencia ->> 'fileId'
        and ar.file_version_id::text = v_referencia ->> 'fileVersionId'
        and ar.mode = p_modo_referencias
        and ar.chunk_ids = v_chunk_ids
        and ar.retrieval_query is not distinct from (
          case when p_modo_referencias = 'retrieval' then p_consulta_referencias else null end
        )
        and ar.retrieval_scores = v_referencia -> 'scores'
    ) then
      return jsonb_build_object(
        'resolution', 'incomplete',
        'localJob', to_jsonb(v_job),
        'globalJob', to_jsonb(v_trabajo)
      );
    end if;
  end loop;

  if (
    select count(*)
    from public.ai_request_references ar
    where ar.request_id = p_openai_response_id
  ) <> v_conteo then
    return jsonb_build_object(
      'resolution', 'incomplete',
      'localJob', to_jsonb(v_job),
      'globalJob', to_jsonb(v_trabajo)
    );
  end if;

  return jsonb_build_object(
    'resolution', 'published',
    'localJob', to_jsonb(v_job),
    'globalJob', to_jsonb(v_trabajo)
  );
end;
$$;


ALTER FUNCTION "public"."consultar_publicacion_generacion_recursos_ia"("p_generation_job_id" "uuid", "p_openai_response_id" "text", "p_modo_referencias" "text", "p_consulta_referencias" "text", "p_referencias" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."consultar_publicacion_intento_recursos_ia"("p_intento_id" "uuid", "p_generation_job_id" "uuid", "p_openai_response_id" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_intento private.intentos_generacion_ia;
  v_job public.learning_generation_jobs;
  v_publicacion jsonb;
begin
  select i.* into v_intento
  from private.intentos_generacion_ia i
  where i.id = p_intento_id;
  if not found then
    return jsonb_build_object('resolution', 'missing', 'attempt', null);
  end if;
  select j.* into v_job
  from public.learning_generation_jobs j
  where j.id = p_generation_job_id;
  if not found
     or v_job.intento_generacion_activo_id is distinct from p_intento_id then
    return jsonb_build_object(
      'resolution', 'claimed_elsewhere',
      'attempt', private.intento_generacion_ia_json(p_intento_id),
      'winnerAttemptId', v_job.intento_generacion_activo_id
    );
  end if;
  if v_intento.handler <> 'learning-resources'
     or v_intento.entidad_id <> p_generation_job_id
     or v_intento.tipo_entidad <> 'recursos_aprendizaje' then
    return jsonb_build_object(
      'resolution', 'stale',
      'attempt', private.intento_generacion_ia_json(p_intento_id)
    );
  end if;
  if v_intento.openai_response_id is not null
     and v_intento.openai_response_id <> p_openai_response_id then
    return jsonb_build_object(
      'resolution', 'claimed_elsewhere',
      'attempt', private.intento_generacion_ia_json(p_intento_id),
      'winnerResponseId', v_intento.openai_response_id
    );
  end if;
  if v_intento.estado in ('fallido', 'expirado', 'obsoleto') then
    return jsonb_build_object(
      'resolution', 'stale',
      'attempt', private.intento_generacion_ia_json(p_intento_id)
    );
  end if;
  if v_intento.estado <> 'publicado' then
    return jsonb_build_object(
      'resolution', 'active',
      'attempt', private.intento_generacion_ia_json(p_intento_id)
    );
  end if;

  v_publicacion := public.consultar_publicacion_generacion_recursos_ia(
    p_generation_job_id,
    p_openai_response_id,
    v_intento.modo_referencias,
    v_intento.consulta_referencias,
    v_intento.referencias
  );
  if v_publicacion ->> 'resolution' <> 'published' then
    return jsonb_build_object(
      'resolution', 'incomplete',
      'attempt', private.intento_generacion_ia_json(p_intento_id)
    );
  end if;
  return jsonb_build_object(
    'resolution', 'already_applied',
    'attempt', private.intento_generacion_ia_json(p_intento_id),
    'localJob', v_publicacion -> 'localJob',
    'globalJob', v_publicacion -> 'globalJob'
  );
end;
$$;


ALTER FUNCTION "public"."consultar_publicacion_intento_recursos_ia"("p_intento_id" "uuid", "p_generation_job_id" "uuid", "p_openai_response_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."crear_recursos_placeholder"("p_asignatura_id" "uuid", "p_unidad_id" "text", "p_tema_id" "text", "p_tipos" "text"[]) RETURNS SETOF "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'auth', 'extensions', 'pg_temp'
    AS $$
declare
    v_tipo text;
    v_id uuid;
begin
    foreach v_tipo in array p_tipos loop
        insert into public.learning_objects (
            asignatura_id, unidad_id, tema_id, tipo, titulo, score, creado_por
        )
        values (
            p_asignatura_id,
            p_unidad_id,
            p_tema_id,
            v_tipo::public.learning_object_tipo,
            initcap(replace(v_tipo, '_', ' ')),
            0,
            auth.uid()
        )
        returning id into v_id;

        if v_id is not null then
            return next v_id;
        end if;
    end loop;

    perform public.recalcular_learning_quality_scores(p_asignatura_id);
end;
$$;


ALTER FUNCTION "public"."crear_recursos_placeholder"("p_asignatura_id" "uuid", "p_unidad_id" "text", "p_tema_id" "text", "p_tipos" "text"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."custom_access_token_hook"("event" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'auth', 'extensions', 'pg_temp'
    AS $$
declare
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
  is_real_admin boolean := false;
  simulation jsonb;
  simulation_active boolean := false;
  simulation_role record;
  simulation_role_found boolean := false;
  sim_role_id uuid;
  sim_facultad_id uuid;
  sim_carrera_id uuid;
  sim_plan_id uuid;
  sim_asignatura_id uuid;
begin
  original_claims := event->'claims';
  new_claims := '{}'::jsonb;
  app_meta := coalesce(original_claims->'app_metadata', '{}'::jsonb);

  select not exists (select 1 from public.usuarios_roles)
  into is_bootstrap;

  if original_claims ? 'sub' then
    user_id := (original_claims->>'sub')::uuid;

    select coalesce(
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
        order by r.nivel_jerarquico, r.clave
      ),
      '[]'::jsonb
    )
    into roles_json
    from public.usuarios_roles ur
    join public.roles r on r.id = ur.rol_id
    join public.usuarios_app ua on ua.id = ur.usuario_id
    where ur.usuario_id = user_id
      and ua.dado_de_baja_en is null;

    select coalesce(jsonb_agg(clave order by clave), '[]'::jsonb)
    into roles_claves_json
    from (
      select distinct r.clave
      from public.usuarios_roles ur
      join public.roles r on r.id = ur.rol_id
      join public.usuarios_app ua on ua.id = ur.usuario_id
      where ur.usuario_id = user_id
        and ua.dado_de_baja_en is null
    ) s;

    is_real_admin := roles_claves_json ? 'ADMIN';

    select coalesce(jsonb_agg(clave order by clave), '[]'::jsonb)
    into permisos_json
    from (
      select distinct p.clave
      from public.usuarios_roles ur
      join public.roles_permisos rp on rp.rol_id = ur.rol_id
      join public.permisos p on p.id = rp.permiso_id
      join public.usuarios_app ua on ua.id = ur.usuario_id
      where ur.usuario_id = user_id
        and ua.dado_de_baja_en is null
    ) s;

    select jsonb_build_object(
      'global', coalesce(jsonb_agg(distinct r.clave) filter (where ur.facultad_id is null and ur.carrera_id is null), '[]'::jsonb),
      'facultades', coalesce(jsonb_agg(distinct ur.facultad_id) filter (where ur.facultad_id is not null), '[]'::jsonb),
      'carreras', coalesce(jsonb_agg(distinct ur.carrera_id) filter (where ur.carrera_id is not null), '[]'::jsonb)
    )
    into alcances_json
    from public.usuarios_roles ur
    join public.roles r on r.id = ur.rol_id
    join public.usuarios_app ua on ua.id = ur.usuario_id
    where ur.usuario_id = user_id
      and ua.dado_de_baja_en is null;

    simulation := coalesce(app_meta->'authz_simulacion', '{}'::jsonb);
    simulation_active := lower(coalesce(simulation->>'activa', 'false')) = 'true';

    if simulation_active and is_real_admin then
      sim_role_id := nullif(simulation->>'rol_id', '')::uuid;

      select r.id, r.clave, r.nombre, r.descripcion, r.nivel_jerarquico, r.alcance_default
      into simulation_role
      from public.roles r
      where (sim_role_id is not null and r.id = sim_role_id)
         or (sim_role_id is null and r.clave = nullif(simulation->>'rol_clave', ''))
      order by r.nivel_jerarquico, r.clave
      limit 1;

      simulation_role_found := found;

      if simulation_role_found then
        sim_facultad_id := nullif(simulation->>'facultad_id', '')::uuid;
        sim_carrera_id := nullif(simulation->>'carrera_id', '')::uuid;
        sim_plan_id := nullif(simulation->>'plan_estudio_id', '')::uuid;
        sim_asignatura_id := nullif(simulation->>'asignatura_id', '')::uuid;

        if sim_asignatura_id is not null then
          select
            coalesce(sim_plan_id, a.plan_estudio_id),
            coalesce(sim_carrera_id, pe.carrera_id),
            coalesce(sim_facultad_id, c.facultad_id)
          into sim_plan_id, sim_carrera_id, sim_facultad_id
          from public.asignaturas a
          join public.planes_estudio pe on pe.id = a.plan_estudio_id
          join public.carreras c on c.id = pe.carrera_id
          where a.id = sim_asignatura_id;
        elsif sim_plan_id is not null then
          select
            coalesce(sim_carrera_id, pe.carrera_id),
            coalesce(sim_facultad_id, c.facultad_id)
          into sim_carrera_id, sim_facultad_id
          from public.planes_estudio pe
          join public.carreras c on c.id = pe.carrera_id
          where pe.id = sim_plan_id;
        elsif sim_carrera_id is not null then
          select coalesce(sim_facultad_id, c.facultad_id)
          into sim_facultad_id
          from public.carreras c
          where c.id = sim_carrera_id;
        end if;

        roles_json := jsonb_build_array(
          jsonb_strip_nulls(jsonb_build_object(
            'id', 'simulacion',
            'rol_id', simulation_role.id,
            'clave', simulation_role.clave,
            'nombre', simulation_role.nombre,
            'nivel_jerarquico', simulation_role.nivel_jerarquico,
            'alcance_default', simulation_role.alcance_default,
            'facultad_id', case when simulation_role.alcance_default = 'facultad' then sim_facultad_id else null end,
            'carrera_id', case when simulation_role.alcance_default = 'carrera' then sim_carrera_id else null end,
            'simulada', true
          ))
        );

        roles_claves_json := jsonb_build_array(simulation_role.clave);

        select coalesce(jsonb_agg(clave order by clave), '[]'::jsonb)
        into permisos_json
        from (
          select distinct p.clave
          from public.roles_permisos rp
          join public.permisos p on p.id = rp.permiso_id
          where rp.rol_id = simulation_role.id
        ) s;

        alcances_json := jsonb_build_object(
          'global',
            case when simulation_role.alcance_default = 'global'
              then jsonb_build_array(simulation_role.clave)
              else '[]'::jsonb
            end,
          'facultades',
            case when simulation_role.alcance_default = 'facultad' and sim_facultad_id is not null
              then jsonb_build_array(sim_facultad_id)
              else '[]'::jsonb
            end,
          'carreras',
            case when simulation_role.alcance_default = 'carrera' and sim_carrera_id is not null
              then jsonb_build_array(sim_carrera_id)
              else '[]'::jsonb
            end
        );

        simulation := jsonb_strip_nulls(simulation || jsonb_build_object(
          'activa', true,
          'rol_id', simulation_role.id,
          'rol_clave', simulation_role.clave,
          'rol_nombre', simulation_role.nombre,
          'alcance_default', simulation_role.alcance_default,
          'facultad_id', sim_facultad_id,
          'carrera_id', sim_carrera_id,
          'plan_estudio_id', sim_plan_id,
          'asignatura_id', sim_asignatura_id,
          'admin_real', true
        ));
        app_meta := app_meta || jsonb_build_object('authz_simulacion', simulation);
      else
        app_meta := app_meta - 'authz_simulacion';
      end if;
    elsif simulation_active then
      app_meta := app_meta - 'authz_simulacion';
    end if;
  end if;

  app_meta := app_meta || jsonb_build_object(
    'roles', roles_json,
    'roles_claves', roles_claves_json,
    'permisos', permisos_json,
    'alcances', coalesce(alcances_json, '{"global": [], "facultades": [], "carreras": []}'::jsonb),
    'authz_bootstrap', is_bootstrap
  );

  foreach claim in array array[
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
  ] loop
    if original_claims ? claim then
      new_claims := jsonb_set(new_claims, array[claim], original_claims->claim);
    end if;
  end loop;

  new_claims := jsonb_set(new_claims, array['app_metadata'], app_meta);

  return jsonb_build_object('claims', new_claims);
end
$$;


ALTER FUNCTION "public"."custom_access_token_hook"("event" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."datos_validos_con_definicion"("p_definicion" "jsonb", "p_datos" "jsonb") RETURNS boolean
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public', 'private', 'auth', 'extensions', 'pg_temp'
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



CREATE TABLE IF NOT EXISTS "public"."ingestion_jobs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "upload_session_id" "uuid",
    "file_version_id" "uuid",
    "job_type" "public"."tipo_trabajo_ingesta_documental" NOT NULL,
    "idempotency_key" "text" NOT NULL,
    "payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "status" "public"."estado_trabajo_ingesta_documental" DEFAULT 'pending'::"public"."estado_trabajo_ingesta_documental" NOT NULL,
    "attempts" integer DEFAULT 0 NOT NULL,
    "available_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "locked_at" timestamp with time zone,
    "locked_by" "text",
    "last_error" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "completed_at" timestamp with time zone,
    CONSTRAINT "ingestion_jobs_attempts_check" CHECK ((("attempts" >= 0) AND ("attempts" <= 5))),
    CONSTRAINT "ingestion_jobs_check" CHECK ((("status" = 'processing'::"public"."estado_trabajo_ingesta_documental") = (("locked_at" IS NOT NULL) AND ("locked_by" IS NOT NULL))))
);


ALTER TABLE "public"."ingestion_jobs" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."encolar_trabajo_ingesta_documental"("p_tenant_id" "uuid", "p_upload_session_id" "uuid", "p_file_version_id" "uuid", "p_tipo" "public"."tipo_trabajo_ingesta_documental", "p_idempotency_key" "text", "p_payload" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "public"."ingestion_jobs"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_trabajo public.ingestion_jobs;
  v_cola text;
begin
  if nullif(btrim(p_idempotency_key), '') is null then
    raise exception using errcode = '22023', message = 'idempotency_key requerido';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(p_tenant_id::text || ':' || p_idempotency_key, 0)
  );
  select * into v_trabajo
  from public.ingestion_jobs
  where tenant_id = p_tenant_id and idempotency_key = p_idempotency_key;
  if v_trabajo.id is not null then return v_trabajo; end if;

  insert into public.ingestion_jobs (
    tenant_id, upload_session_id, file_version_id, job_type, idempotency_key, payload
  ) values (
    p_tenant_id, p_upload_session_id, p_file_version_id, p_tipo,
    p_idempotency_key, coalesce(p_payload, '{}'::jsonb)
  ) returning * into v_trabajo;

  v_cola := case p_tipo
    when 'hash_file' then 'file-hashing'
    when 'extract_local' then 'file-extraction'
    when 'extract_openai' then 'file-extraction'
    when 'chunk' then 'file-chunking'
    when 'embed' then 'file-embedding'
    when 'cleanup' then 'file-cleanup'
  end;
  perform pgmq.send(v_cola, jsonb_build_object('job_id', v_trabajo.id));
  return v_trabajo;
end;
$$;


ALTER FUNCTION "public"."encolar_trabajo_ingesta_documental"("p_tenant_id" "uuid", "p_upload_session_id" "uuid", "p_file_version_id" "uuid", "p_tipo" "public"."tipo_trabajo_ingesta_documental", "p_idempotency_key" "text", "p_payload" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."expirar_intentos_chat_ia"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_expirados integer;
begin
  with expirados as (
    update private.intentos_chat_ia i
    set estado = 'expirado',
        token_reclamacion = null,
        reclamado_por = null,
        reclamado_hasta = null,
        ultimo_error = jsonb_build_object(
          'code', 'CHAT_ATTEMPT_TIMEOUT',
          'message', 'El intento de chat excedió el límite de 60 minutos.'
        ),
        actualizado_en = now()
    where i.estado in ('preparado', 'reclamado', 'respuesta_vinculada')
      and i.fecha_limite <= now()
    returning i.tipo_conversacion, i.mensaje_id, i.openai_response_id
  ), plan_error as (
    update public.plan_mensajes_ia m
    set estado = 'ERROR',
        respuesta = 'La generación excedió el tiempo máximo. Puedes reintentarlo.',
        propuesta = '{"recommendations":[]}'::jsonb,
        is_refusal = false,
        fecha_actualizacion = now()
    from expirados e
    where e.tipo_conversacion = 'plan'
      and m.id = e.mensaje_id
      and m.estado = 'PROCESANDO'
      and (m.openai_response_id is null or m.openai_response_id = e.openai_response_id)
    returning m.id
  ), asignatura_error as (
    update public.asignatura_mensajes_ia m
    set estado = 'ERROR',
        respuesta = 'La generación excedió el tiempo máximo. Puedes reintentarlo.',
        propuesta = '{"recommendations":[]}'::jsonb,
        is_refusal = false,
        fecha_actualizacion = now()
    from expirados e
    where e.tipo_conversacion = 'asignatura'
      and m.id = e.mensaje_id
      and m.estado = 'PROCESANDO'
      and (m.openai_response_id is null or m.openai_response_id = e.openai_response_id)
    returning m.id
  )
  select count(*)::integer into v_expirados from expirados;

  delete from private.intentos_chat_ia i
  where i.estado in ('publicado', 'fallido', 'expirado')
    and i.actualizado_en < now() - interval '90 days';

  return v_expirados;
end;
$$;


ALTER FUNCTION "public"."expirar_intentos_chat_ia"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."expirar_intentos_entidad_ia"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_expirados integer := 0;
  v_estado_fallido uuid;
begin
  select ep.id into v_estado_fallido
  from public.estados_plan ep
  where upper(ep.clave) = 'FALLIDO'
  limit 1;

  with expirados as (
    update private.intentos_generacion_ia i
    set estado = 'expirado',
        token_reclamacion = null,
        reclamado_por = null,
        reclamado_hasta = null,
        actualizado_en = now(),
        ultimo_error = jsonb_build_object(
          'code', 'ENTITY_ATTEMPT_TIMEOUT',
          'message', 'La generación excedió el límite de 60 minutos.'
        )
    where i.handler in ('plan', 'subject')
      and i.estado in ('preparado', 'reclamado', 'respuesta_vinculada')
      and i.fecha_limite <= now()
    returning i.id, i.tipo_entidad, i.entidad_id
  ), planes as (
    update public.planes_estudio p
    set estado_actual_id = v_estado_fallido,
        meta_origen = jsonb_set(
          coalesce(p.meta_origen, '{}'::jsonb),
          '{ai,error}',
          jsonb_build_object(
            'code', 'ENTITY_ATTEMPT_TIMEOUT',
            'message', 'La generación excedió el límite de 60 minutos.'
          ),
          true
        )
    from expirados e
    where e.tipo_entidad = 'plan'
      and p.id = e.entidad_id
      and p.meta_origen #>> '{ai,activeAttemptId}' = e.id::text
    returning p.id
  ), asignaturas as (
    update public.asignaturas a
    set estado = 'fallida',
        meta_origen = jsonb_set(
          coalesce(a.meta_origen, '{}'::jsonb),
          '{ai,error}',
          jsonb_build_object(
            'code', 'ENTITY_ATTEMPT_TIMEOUT',
            'message', 'La generación excedió el límite de 60 minutos.'
          ),
          true
        )
    from expirados e
    where e.tipo_entidad = 'asignatura'
      and a.id = e.entidad_id
      and a.meta_origen #>> '{ai,activeAttemptId}' = e.id::text
    returning a.id
  )
  select count(*)::integer into v_expirados from expirados;

  return v_expirados;
end;
$$;


ALTER FUNCTION "public"."expirar_intentos_entidad_ia"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."expirar_intentos_generacion_ia"("p_handler" "text", "p_limite" integer DEFAULT 100) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_resultado jsonb;
begin
  if nullif(btrim(coalesce(p_handler, '')), '') is null then
    raise exception using errcode = '22023', message = 'handler es requerido';
  end if;

  with candidatas as (
    select i.id
    from private.intentos_generacion_ia i
    where i.handler = p_handler
      and i.terminal_aplicado_en is null
      and (
        (
          i.estado in ('preparado', 'reclamado', 'respuesta_vinculada')
          and i.fecha_limite <= now()
        )
        or (
          i.estado in ('fallido', 'expirado')
          and (i.reclamado_hasta is null or i.reclamado_hasta <= now())
        )
      )
    order by i.fecha_limite, i.creado_en
    for update skip locked
    limit greatest(1, least(coalesce(p_limite, 100), 500))
  ), terminales as (
    update private.intentos_generacion_ia i
    set estado = case
          when i.estado = 'fallido' then 'fallido'
          else 'expirado'
        end,
        token_reclamacion = gen_random_uuid(),
        reclamado_por = 'terminal:' || p_handler,
        reclamado_hasta = now() + interval '2 minutes',
        ultimo_error = case
          when i.estado = 'fallido' then i.ultimo_error
          else jsonb_build_object(
            'code', 'GENERATION_ATTEMPT_TIMEOUT',
            'message', 'El intento excedió el límite de 60 minutos.'
          )
        end,
        actualizado_en = now()
    from candidatas c
    where i.id = c.id
    returning to_jsonb(i) as value
  )
  select coalesce(jsonb_agg(value), '[]'::jsonb)
  into v_resultado
  from terminales;

  return v_resultado;
end;
$$;


ALTER FUNCTION "public"."expirar_intentos_generacion_ia"("p_handler" "text", "p_limite" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."expirar_intentos_generacion_ia"("p_handler" "text", "p_limite" integer) IS 'Reclama intentos vencidos y reentrega fallos o expiraciones no confirmados hasta que el adaptador aplique el terminal con CAS.';



CREATE OR REPLACE FUNCTION "public"."expirar_trabajos_generacion_ia"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_trabajo public.trabajos_generacion_ia;
  v_total integer := 0;
  v_token uuid;
begin
  for v_trabajo in
    select *
    from public.trabajos_generacion_ia t
    where t.estado in ('pendiente', 'reclamado')
      and t.fecha_limite <= now()
    order by t.fecha_limite
    for update skip locked
  loop
    v_token := gen_random_uuid();
    update public.trabajos_generacion_ia
    set estado = 'reclamado', token_reclamacion = v_token,
        reclamado_por = 'expirador', reclamado_hasta = now() + interval '1 minute'
    where id = v_trabajo.id;

    perform public.finalizar_trabajo_generacion_ia(
      v_trabajo.id,
      v_token,
      'expirado',
      coalesce(v_trabajo.estado_openai, 'timeout'),
      null,
      jsonb_build_object(
        'code', 'GENERATION_TIMEOUT',
        'message', 'La generación excedió el límite de 60 minutos.'
      )
    );
    v_total := v_total + 1;
  end loop;
  return v_total;
end;
$$;


ALTER FUNCTION "public"."expirar_trabajos_generacion_ia"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."facultades_guard_scoped_catalog_update"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'private', 'auth', 'extensions', 'pg_temp'
    AS $$
begin
  -- Sin sesión JWT (migrations, seeds, scripts de mantenimiento) → permitir siempre.
  if auth.jwt() is null then
    return new;
  end if;

  if (
    public.authz_simulacion_activa()
    and private.authz_claim_has_permission('catalogos.gestionar')
  ) or (
    not public.authz_simulacion_activa()
    and public.authz_has_permission('catalogos.gestionar'::text)
  ) then
    return new;
  end if;

  if public.authz_can_manage_facultad_catalog(old.id)
    and new.id = old.id
    and new.activa is not distinct from old.activa
    and new.creado_en is not distinct from old.creado_en
    and new.creado_por is not distinct from old.creado_por
  then
    return new;
  end if;

  raise exception 'No tienes permisos para cambiar el alcance o estado de esta facultad.'
    using errcode = '42501';
end;
$$;


ALTER FUNCTION "public"."facultades_guard_scoped_catalog_update"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fallar_intento_recursos_ia"("p_intento_id" "uuid", "p_token_reclamacion" "uuid", "p_generation_job_id" "uuid", "p_openai_response_id" "text" DEFAULT NULL::"text", "p_error" "jsonb" DEFAULT '{}'::"jsonb") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_intento private.intentos_generacion_ia;
  v_job public.learning_generation_jobs;
begin
  if jsonb_typeof(coalesce(p_error, '{}'::jsonb)) <> 'object' then
    raise exception using errcode = '22023', message = 'error debe ser un objeto JSON';
  end if;
  select i.* into v_intento
  from private.intentos_generacion_ia i
  where i.id = p_intento_id
  for update;
  if not found then return false; end if;
  if v_intento.estado = 'fallido' then return true; end if;
  if v_intento.handler <> 'learning-resources'
     or v_intento.entidad_id <> p_generation_job_id
     or v_intento.estado not in ('preparado', 'reclamado', 'respuesta_vinculada')
     or p_token_reclamacion is null
     or v_intento.token_reclamacion is distinct from p_token_reclamacion
     or v_intento.reclamado_hasta <= now()
     or (p_openai_response_id is not null and
       v_intento.openai_response_id is distinct from p_openai_response_id) then
    return false;
  end if;
  select j.* into v_job
  from public.learning_generation_jobs j
  where j.id = p_generation_job_id
  for update;
  if not found
     or v_job.intento_generacion_activo_id is distinct from p_intento_id
     or v_job.openai_response_id is not null then
    return false;
  end if;
  update private.intentos_generacion_ia
  set estado = 'fallido',
      token_reclamacion = null,
      reclamado_por = null,
      reclamado_hasta = null,
      actualizado_en = now(),
      ultimo_error = coalesce(p_error, '{}'::jsonb)
  where id = p_intento_id;
  update public.learning_generation_jobs
  set estado = 'failed',
      error = coalesce(nullif(p_error ->> 'message', ''), 'Falló el intento remoto de IA.'),
      completado_en = coalesce(completado_en, now())
  where id = p_generation_job_id;
  return true;
end;
$$;


ALTER FUNCTION "public"."fallar_intento_recursos_ia"("p_intento_id" "uuid", "p_token_reclamacion" "uuid", "p_generation_job_id" "uuid", "p_openai_response_id" "text", "p_error" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."finalizar_cancelacion_generacion_ia"("p_trabajo_id" "uuid", "p_token_reclamacion" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_trabajo public.trabajos_generacion_ia;
  v_eliminados integer := 0;
begin
  select * into v_trabajo
  from public.trabajos_generacion_ia
  where id = p_trabajo_id
    and estado = 'reclamado'
    and token_reclamacion = p_token_reclamacion
    and reclamado_hasta > now()
    and cancelacion_solicitada_en is not null
  for update;

  if v_trabajo.id is null then return false; end if;

  perform pg_advisory_xact_lock(
    hashtextextended(v_trabajo.tipo_entidad::text || ':' || v_trabajo.entidad_id::text, 0)
  );

  if private.openai_response_id_vigente_trabajo_ia(
    v_trabajo.tipo_entidad,
    v_trabajo.entidad_id
  ) is distinct from v_trabajo.openai_response_id then
    return false;
  end if;

  if v_trabajo.tipo_entidad = 'plan' then
    delete from public.lineas_plan l
    where l.plan_estudio_id = v_trabajo.entidad_id
      and exists (
        select 1
        from public.planes_estudio p
        join public.estados_plan ep on ep.id = p.estado_actual_id
        where p.id = v_trabajo.entidad_id and upper(ep.clave) = 'GENERANDO'
          and p.meta_origen #>> '{ai,responseId}' = v_trabajo.openai_response_id
      );
    delete from public.planes_estudio p
    using public.estados_plan ep
    where p.id = v_trabajo.entidad_id
      and ep.id = p.estado_actual_id
      and upper(ep.clave) = 'GENERANDO'
      and p.meta_origen #>> '{ai,responseId}' = v_trabajo.openai_response_id;
    get diagnostics v_eliminados = row_count;
  elsif v_trabajo.tipo_entidad = 'asignatura' then
    delete from public.asignaturas a
    where a.id = v_trabajo.entidad_id
      and a.estado = 'generando'
      and a.meta_origen #>> '{ai,responseId}' = v_trabajo.openai_response_id;
    get diagnostics v_eliminados = row_count;
  else
    return false;
  end if;

  if v_eliminados <> 1 then return false; end if;

  update public.trabajos_generacion_ia
  set estado = 'cancelado',
      estado_openai = 'cancelled',
      completado_en = now(),
      token_reclamacion = null,
      reclamado_por = null,
      reclamado_hasta = null
  where id = v_trabajo.id;

  return true;
end;
$$;


ALTER FUNCTION "public"."finalizar_cancelacion_generacion_ia"("p_trabajo_id" "uuid", "p_token_reclamacion" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."finalizar_extraccion_openai_documental"("p_response_id" "text", "p_estado" "text", "p_contenido" "jsonb" DEFAULT NULL::"jsonb", "p_error" "jsonb" DEFAULT NULL::"jsonb") RETURNS TABLE("applied" boolean, "file_id" "uuid", "tenant_id" "uuid", "file_version_id" "uuid")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_extraccion public.document_extractions;
  v_archivo_id uuid;
begin
  if nullif(btrim(p_response_id), '') is null
     or p_estado not in ('completed', 'failed') then
    raise exception using errcode = '22023', message = 'Finalización de extracción inválida';
  end if;

  select * into v_extraccion
  from public.document_extractions
  where provider = 'openai' and provider_response_id = p_response_id
  for update;
  if v_extraccion.id is null then return; end if;
  if v_extraccion.status <> 'waiting_provider' then
    applied := false;
    file_id := null;
    tenant_id := v_extraccion.tenant_id;
    file_version_id := v_extraccion.file_version_id;
    return next;
    return;
  end if;

  select fv.file_id into v_archivo_id
  from public.file_versions fv
  where fv.id = v_extraccion.file_version_id;
  if v_archivo_id is null then
    raise exception using errcode = 'P0002', message = 'La extracción no tiene archivo asociado';
  end if;

  update public.document_extractions
  set status = p_estado,
      extracted_content = case when p_estado = 'completed' then p_contenido else jsonb_build_object('error', coalesce(p_error, '{}'::jsonb), 'status', p_estado) end,
      quality_flags = case when p_estado = 'completed'
        then coalesce(p_contenido->'qualityFlags', '[]'::jsonb)
        else '["provider_failed"]'::jsonb end,
      completed_at = now()
  where id = v_extraccion.id;

  if p_estado = 'completed' then
    perform public.encolar_trabajo_ingesta_documental(
      v_extraccion.tenant_id,
      null,
      v_extraccion.file_version_id,
      'chunk',
      format('chunk:%s:v1', v_extraccion.file_version_id),
      jsonb_build_object('file_id', v_archivo_id, 'extraction_id', v_extraccion.id)
    );
  else
    update public.files set status = 'partial_error' where id = v_archivo_id;
  end if;

  applied := true;
  file_id := v_archivo_id;
  tenant_id := v_extraccion.tenant_id;
  file_version_id := v_extraccion.file_version_id;
  return next;
end;
$$;


ALTER FUNCTION "public"."finalizar_extraccion_openai_documental"("p_response_id" "text", "p_estado" "text", "p_contenido" "jsonb", "p_error" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."finalizar_indexacion_documental"("p_file_version_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_file_id uuid;
  v_blob_id uuid;
  v_actualizados integer;
begin
  select fv.file_id, fv.blob_id
  into v_file_id, v_blob_id
  from public.file_versions fv
  join public.files f
    on f.id = fv.file_id
   and f.current_version_id = fv.id
   and f.deleted_at is null
  where fv.id = p_file_version_id
  for update of f;

  if v_file_id is null
     or not exists (
       select 1 from public.document_chunks c
       where c.file_version_id = p_file_version_id
     )
     or exists (
       select 1 from public.document_chunks c
       where c.file_version_id = p_file_version_id
         and c.embedding is null
     ) then
    return false;
  end if;

  update public.files
  set status = 'ready'
  where id = v_file_id
    and current_version_id = p_file_version_id
    and deleted_at is null;
  get diagnostics v_actualizados = row_count;
  if v_actualizados <> 1 then return false; end if;

  update public.file_blobs
  set processing_status = 'ready'
  where id = v_blob_id and deleted_at is null;

  update public.upload_sessions
  set status = 'ready', error_code = null, completed_at = coalesce(completed_at, now())
  where result_file_id = v_file_id
    and status not in ('failed', 'expired');

  return true;
end;
$$;


ALTER FUNCTION "public"."finalizar_indexacion_documental"("p_file_version_id" "uuid") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."trabajos_generacion_ia" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tipo_entidad" "public"."tipo_trabajo_generacion_ia" NOT NULL,
    "entidad_id" "uuid" NOT NULL,
    "openai_response_id" "text" NOT NULL,
    "estado" "public"."estado_trabajo_generacion_ia" DEFAULT 'pendiente'::"public"."estado_trabajo_generacion_ia" NOT NULL,
    "estado_openai" "text",
    "token_reclamacion" "uuid",
    "reclamado_por" "text",
    "reclamado_hasta" timestamp with time zone,
    "intentos" integer DEFAULT 0 NOT NULL,
    "proxima_revision_en" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ultimo_error" "jsonb",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "cancelacion_solicitada_en" timestamp with time zone,
    "iniciado_en" timestamp with time zone DEFAULT "now"() NOT NULL,
    "fecha_limite" timestamp with time zone DEFAULT ("now"() + '01:00:00'::interval) NOT NULL,
    "completado_en" timestamp with time zone,
    "creado_en" timestamp with time zone DEFAULT "now"() NOT NULL,
    "actualizado_en" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "trabajos_generacion_ia_fecha_limite_valida" CHECK (("fecha_limite" >= "iniciado_en")),
    CONSTRAINT "trabajos_generacion_ia_intentos_check" CHECK (("intentos" >= 0)),
    CONSTRAINT "trabajos_generacion_ia_reclamacion_consistente" CHECK (((("estado" = 'reclamado'::"public"."estado_trabajo_generacion_ia") AND ("token_reclamacion" IS NOT NULL) AND ("reclamado_por" IS NOT NULL) AND ("reclamado_hasta" IS NOT NULL)) OR (("estado" <> 'reclamado'::"public"."estado_trabajo_generacion_ia") AND ("token_reclamacion" IS NULL) AND ("reclamado_por" IS NULL) AND ("reclamado_hasta" IS NULL)))),
    CONSTRAINT "trabajos_generacion_ia_response_id_no_vacio" CHECK (("btrim"("openai_response_id") <> ''::"text"))
);


ALTER TABLE "public"."trabajos_generacion_ia" OWNER TO "postgres";


COMMENT ON TABLE "public"."trabajos_generacion_ia" IS 'Bitácora operacional privada y cola con arrendamientos para respuestas asíncronas de OpenAI.';



CREATE OR REPLACE FUNCTION "public"."finalizar_recursos_aprendizaje_ia"("p_trabajo_id" "uuid", "p_token_reclamacion" "uuid", "p_generation_job_id" "uuid", "p_openai_response_id" "text", "p_estado_openai" "text", "p_resultado" "jsonb", "p_objetos" "jsonb", "p_score" "jsonb") RETURNS "public"."trabajos_generacion_ia"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_trabajo public.trabajos_generacion_ia;
  v_response_vigente text;
  v_job public.learning_generation_jobs;
begin
  select t.* into v_trabajo
  from public.trabajos_generacion_ia t
  where t.id = p_trabajo_id
    and t.tipo_entidad = 'recursos_aprendizaje'
    and t.entidad_id = p_generation_job_id
    and t.openai_response_id = p_openai_response_id
    and t.estado = 'reclamado'
    and t.token_reclamacion = p_token_reclamacion
    and t.reclamado_hasta > now()
  for update;

  if v_trabajo.id is null then
    return null;
  end if;

  -- Mantiene el mismo orden de bloqueo que el finalizador comun:
  -- trabajo global, advisory lock de entidad y finalmente entidad local.
  perform pg_advisory_xact_lock(
    hashtextextended(
      v_trabajo.tipo_entidad::text || ':' || v_trabajo.entidad_id::text,
      0
    )
  );

  v_response_vigente := private.openai_response_id_vigente_trabajo_ia(
    v_trabajo.tipo_entidad,
    v_trabajo.entidad_id
  );
  if v_response_vigente is distinct from v_trabajo.openai_response_id then
    update public.trabajos_generacion_ia t
    set estado = 'obsoleto',
        estado_openai = coalesce(p_estado_openai, t.estado_openai),
        completado_en = now(),
        ultimo_error = jsonb_build_object(
          'code', 'STALE_RESPONSE',
          'message', 'El trabajo de recursos ya apunta a otra respuesta de OpenAI.'
        ),
        token_reclamacion = null,
        reclamado_por = null,
        reclamado_hasta = null
    where t.id = v_trabajo.id
    returning t.* into v_trabajo;
    -- El cambio a obsoleto sí se confirma, pero NULL impide que el invocador
    -- interprete como aplicado un resultado que no tocó el job local.
    return null;
  end if;

  v_job := private.persistir_resultado_recursos_aprendizaje_ia(
    p_generation_job_id,
    p_openai_response_id,
    p_resultado,
    p_objetos,
    p_score
  );

  update public.trabajos_generacion_ia t
  set estado = 'completado',
      estado_openai = coalesce(p_estado_openai, 'completed'),
      ultimo_error = null,
      completado_en = now(),
      token_reclamacion = null,
      reclamado_por = null,
      reclamado_hasta = null,
      metadata = t.metadata || jsonb_build_object(
        'learning_generation_job_id', v_job.id,
        'objetos_aplicados', jsonb_array_length(p_objetos)
      )
  where t.id = v_trabajo.id
  returning t.* into v_trabajo;

  return v_trabajo;
end;
$$;


ALTER FUNCTION "public"."finalizar_recursos_aprendizaje_ia"("p_trabajo_id" "uuid", "p_token_reclamacion" "uuid", "p_generation_job_id" "uuid", "p_openai_response_id" "text", "p_estado_openai" "text", "p_resultado" "jsonb", "p_objetos" "jsonb", "p_score" "jsonb") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."finalizar_recursos_aprendizaje_ia"("p_trabajo_id" "uuid", "p_token_reclamacion" "uuid", "p_generation_job_id" "uuid", "p_openai_response_id" "text", "p_estado_openai" "text", "p_resultado" "jsonb", "p_objetos" "jsonb", "p_score" "jsonb") IS 'Aplica objetos, score y ambos trabajos de recursos en una sola transaccion, validando el lease token vigente.';



CREATE OR REPLACE FUNCTION "public"."finalizar_trabajo_generacion_ia"("p_trabajo_id" "uuid", "p_token_reclamacion" "uuid", "p_estado" "public"."estado_trabajo_generacion_ia", "p_estado_openai" "text", "p_resultado" "jsonb" DEFAULT NULL::"jsonb", "p_error" "jsonb" DEFAULT NULL::"jsonb") RETURNS "public"."trabajos_generacion_ia"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_trabajo public.trabajos_generacion_ia;
  v_response_vigente text;
  v_estado_plan_id uuid;
  v_actualizados integer := 0;
  v_patch jsonb;
begin
  if p_estado not in ('completado', 'fallido', 'cancelado', 'incompleto', 'expirado') then
    raise exception using errcode = '22023', message = 'Estado terminal inválido';
  end if;

  select * into v_trabajo
  from public.trabajos_generacion_ia
  where id = p_trabajo_id
    and estado = 'reclamado'
    and token_reclamacion = p_token_reclamacion
    and reclamado_hasta > now()
  for update;

  if v_trabajo.id is null then
    return null;
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(v_trabajo.tipo_entidad::text || ':' || v_trabajo.entidad_id::text, 0)
  );
  v_response_vigente := private.openai_response_id_vigente_trabajo_ia(
    v_trabajo.tipo_entidad,
    v_trabajo.entidad_id
  );

  if v_response_vigente is distinct from v_trabajo.openai_response_id then
    update public.trabajos_generacion_ia
    set estado = 'obsoleto',
        estado_openai = coalesce(p_estado_openai, estado_openai),
        completado_en = now(),
        ultimo_error = jsonb_build_object(
          'code', 'STALE_RESPONSE',
          'message', 'La entidad ya apunta a otra respuesta de OpenAI.'
        ),
        token_reclamacion = null,
        reclamado_por = null,
        reclamado_hasta = null
    where id = v_trabajo.id
    returning * into v_trabajo;
    return v_trabajo;
  end if;

  if p_estado = 'completado' and p_resultado is not null then
    case v_trabajo.tipo_entidad
      when 'plan' then
        select ep.id into v_estado_plan_id
        from public.estados_plan ep where upper(ep.clave) = 'BORRADOR' limit 1;
        update public.planes_estudio p
        set datos = p_resultado -> 'datos',
            estado_actual_id = v_estado_plan_id
        where p.id = v_trabajo.entidad_id
          and p.meta_origen #>> '{ai,responseId}' = v_trabajo.openai_response_id
          and exists (
            select 1 from public.estados_plan ep
            where ep.id = p.estado_actual_id and upper(ep.clave) = 'GENERANDO'
          );
      when 'asignatura' then
        v_patch := coalesce(p_resultado -> 'patch', '{}'::jsonb);
        update public.asignaturas a
        set datos = case when v_patch ? 'datos' then v_patch -> 'datos' else a.datos end,
            codigo = case when v_patch ? 'codigo' then v_patch ->> 'codigo' else a.codigo end,
            contenido_tematico = case when v_patch ? 'contenido_tematico' then v_patch -> 'contenido_tematico' else a.contenido_tematico end,
            criterios_de_evaluacion = case when v_patch ? 'criterios_de_evaluacion' then v_patch -> 'criterios_de_evaluacion' else a.criterios_de_evaluacion end,
            nombre = case when v_patch ? 'nombre' then v_patch ->> 'nombre' else a.nombre end,
            tipo = case when v_patch ? 'tipo' then (v_patch ->> 'tipo')::public.tipo_asignatura else a.tipo end,
            numero_ciclo = case when v_patch ? 'numero_ciclo' then (v_patch ->> 'numero_ciclo')::integer else a.numero_ciclo end,
            horas_academicas = case when v_patch ? 'horas_academicas' then (v_patch ->> 'horas_academicas')::integer else a.horas_academicas end,
            horas_independientes = case when v_patch ? 'horas_independientes' then (v_patch ->> 'horas_independientes')::integer else a.horas_independientes end,
            estado = 'borrador'
        where a.id = v_trabajo.entidad_id
          and a.meta_origen #>> '{ai,responseId}' = v_trabajo.openai_response_id
          and exists (
            select 1
            from public.planes_estudio p
            left join public.estados_plan ep on ep.id = p.estado_actual_id
            where p.id = a.plan_estudio_id
              and coalesce(ep.clave, '') not in (
                'REV_PLANEACION', 'CONSULTA_EXPERTOS', 'REV_SEDES',
                'CONSEJO_FACULTAD', 'CONSEJO_UNIVERSITARIO',
                'JUNTA_GOBIERNO', 'ENVIADO_SEP', 'APROBADO', 'RECHAZADO'
              )
          );
      when 'chat_plan' then
        update public.plan_mensajes_ia m
        set respuesta = p_resultado ->> 'respuesta',
            propuesta = coalesce(p_resultado -> 'propuesta', '{}'::jsonb),
            is_refusal = coalesce((p_resultado ->> 'is_refusal')::boolean, false),
            estado = 'COMPLETADO'
        where m.id = v_trabajo.entidad_id
          and m.openai_response_id = v_trabajo.openai_response_id
          and exists (
            select 1
            from public.conversaciones_plan c
            join public.planes_estudio p on p.id = c.plan_estudio_id
            left join public.estados_plan ep on ep.id = p.estado_actual_id
            where c.id = m.conversacion_plan_id
              and coalesce(ep.clave, '') not in (
                'REV_PLANEACION', 'CONSULTA_EXPERTOS', 'REV_SEDES',
                'CONSEJO_FACULTAD', 'CONSEJO_UNIVERSITARIO',
                'JUNTA_GOBIERNO', 'ENVIADO_SEP', 'APROBADO', 'RECHAZADO'
              )
          );
      when 'chat_asignatura' then
        update public.asignatura_mensajes_ia m
        set respuesta = p_resultado ->> 'respuesta',
            propuesta = coalesce(p_resultado -> 'propuesta', '{}'::jsonb),
            is_refusal = coalesce((p_resultado ->> 'is_refusal')::boolean, false),
            estado = 'COMPLETADO'
        where m.id = v_trabajo.entidad_id
          and m.openai_response_id = v_trabajo.openai_response_id
          and exists (
            select 1
            from public.conversaciones_asignatura c
            join public.asignaturas a on a.id = c.asignatura_id
            join public.planes_estudio p on p.id = a.plan_estudio_id
            left join public.estados_plan ep on ep.id = p.estado_actual_id
            where c.id = m.conversacion_asignatura_id
              and coalesce(ep.clave, '') not in (
                'REV_PLANEACION', 'CONSULTA_EXPERTOS', 'REV_SEDES',
                'CONSEJO_FACULTAD', 'CONSEJO_UNIVERSITARIO',
                'JUNTA_GOBIERNO', 'ENVIADO_SEP', 'APROBADO', 'RECHAZADO'
              )
          );
      when 'observabilidad' then
        update public.observability_test_runs o
        set estado = 'completed',
            completed_at = now(),
            latency_ms = greatest(0, floor(extract(epoch from (now() - o.started_at)) * 1000)::integer),
            error_code = null,
            error_message = null,
            metadata = o.metadata || coalesce(p_resultado, '{}'::jsonb)
        where o.id = v_trabajo.entidad_id
          and o.openai_response_id = v_trabajo.openai_response_id;
      when 'recursos_aprendizaje' then
        -- Los objetos y su score se escriben por el finalizador especializado.
        -- El arrendamiento global evita que dos actores entren a ese finalizador.
        update public.learning_generation_jobs j
        set estado = 'completed',
            resultado_json = coalesce(p_resultado -> 'resultado_json', j.resultado_json),
            error = null,
            completado_en = coalesce(j.completado_en, now())
        where j.id = v_trabajo.entidad_id
          and j.openai_response_id = v_trabajo.openai_response_id;
    end case;

    get diagnostics v_actualizados = row_count;
    if v_actualizados <> 1 then
      if v_trabajo.tipo_entidad = 'asignatura' then
        update public.asignaturas a
        set estado = 'fallida',
            meta_origen = jsonb_set(
              a.meta_origen,
              '{ai,error}',
              jsonb_build_object(
                'code', 'AI_NOT_ALLOWED_IN_CURRENT_STAGE',
                'message', 'El plan cambió de etapa antes de aplicar la respuesta.'
              ),
              true
            )
        where a.id = v_trabajo.entidad_id
          and a.meta_origen #>> '{ai,responseId}' = v_trabajo.openai_response_id;
      elsif v_trabajo.tipo_entidad = 'chat_plan' then
        update public.plan_mensajes_ia m
        set estado = 'ERROR',
            respuesta = 'La etapa actual del plan ya no permite aplicar esta respuesta.',
            propuesta = '{"recommendations":[]}'::jsonb,
            is_refusal = false
        where m.id = v_trabajo.entidad_id
          and m.openai_response_id = v_trabajo.openai_response_id;
      elsif v_trabajo.tipo_entidad = 'chat_asignatura' then
        update public.asignatura_mensajes_ia m
        set estado = 'ERROR',
            respuesta = 'La etapa actual del plan ya no permite aplicar esta respuesta.',
            propuesta = '{"recommendations":[]}'::jsonb,
            is_refusal = false
        where m.id = v_trabajo.entidad_id
          and m.openai_response_id = v_trabajo.openai_response_id;
      end if;
      get diagnostics v_actualizados = row_count;

      if v_actualizados = 1 and v_trabajo.tipo_entidad in (
        'asignatura', 'chat_plan', 'chat_asignatura'
      ) then
        update public.trabajos_generacion_ia
        set estado = 'fallido',
            estado_openai = coalesce(p_estado_openai, estado_openai),
            completado_en = now(),
            ultimo_error = jsonb_build_object(
              'code', 'AI_NOT_ALLOWED_IN_CURRENT_STAGE',
              'message', 'La etapa académica cambió antes de aplicar la respuesta.'
            ),
            token_reclamacion = null,
            reclamado_por = null,
            reclamado_hasta = null
        where id = v_trabajo.id
        returning * into v_trabajo;
        return v_trabajo;
      end if;

      update public.trabajos_generacion_ia
      set estado = 'obsoleto',
          completado_en = now(),
          ultimo_error = jsonb_build_object(
            'code', 'ENTITY_NOT_APPLIED',
            'message', 'La entidad dejó de aceptar esta respuesta antes de aplicarla.'
          ),
          token_reclamacion = null,
          reclamado_por = null,
          reclamado_hasta = null
      where id = v_trabajo.id
      returning * into v_trabajo;
      return v_trabajo;
    end if;
  elsif p_estado <> 'completado' then
    case v_trabajo.tipo_entidad
      when 'plan' then
        select ep.id into v_estado_plan_id
        from public.estados_plan ep where upper(ep.clave) = 'FALLIDO' limit 1;
        update public.planes_estudio p
        set estado_actual_id = v_estado_plan_id,
            meta_origen = jsonb_set(
              p.meta_origen,
              '{ai,error}',
              coalesce(p_error, jsonb_build_object('status', p_estado_openai)),
              true
            )
        where p.id = v_trabajo.entidad_id
          and p.meta_origen #>> '{ai,responseId}' = v_trabajo.openai_response_id;
      when 'asignatura' then
        update public.asignaturas a
        set estado = 'fallida',
            meta_origen = jsonb_set(
              a.meta_origen,
              '{ai,error}',
              coalesce(p_error, jsonb_build_object('status', p_estado_openai)),
              true
            )
        where a.id = v_trabajo.entidad_id
          and a.meta_origen #>> '{ai,responseId}' = v_trabajo.openai_response_id;
      when 'chat_plan' then
        update public.plan_mensajes_ia m
        set estado = case
              when p_estado = 'cancelado'
                then 'CANCELADO'::public.estado_mensaje_ia
              else 'ERROR'::public.estado_mensaje_ia
            end,
            respuesta = case when p_estado = 'cancelado'
              then 'Esta respuesta se ha cancelado.'
              else 'No se pudo generar la respuesta de la IA.' end,
            propuesta = '{"recommendations":[]}'::jsonb,
            is_refusal = false
        where m.id = v_trabajo.entidad_id
          and m.openai_response_id = v_trabajo.openai_response_id;
      when 'chat_asignatura' then
        update public.asignatura_mensajes_ia m
        set estado = case
              when p_estado = 'cancelado'
                then 'CANCELADO'::public.estado_mensaje_ia
              else 'ERROR'::public.estado_mensaje_ia
            end,
            respuesta = case when p_estado = 'cancelado'
              then 'Esta respuesta se ha cancelado.'
              else 'No se pudo generar la respuesta de la IA.' end,
            propuesta = '{"recommendations":[]}'::jsonb,
            is_refusal = false
        where m.id = v_trabajo.entidad_id
          and m.openai_response_id = v_trabajo.openai_response_id;
      when 'recursos_aprendizaje' then
        update public.learning_generation_jobs j
        set estado = 'failed',
            error = coalesce(p_error ->> 'message', 'La generación de recursos no pudo completarse.'),
            completado_en = now()
        where j.id = v_trabajo.entidad_id
          and j.openai_response_id = v_trabajo.openai_response_id;
      when 'observabilidad' then
        update public.observability_test_runs o
        set estado = 'failed',
            completed_at = now(),
            latency_ms = greatest(0, floor(extract(epoch from (now() - o.started_at)) * 1000)::integer),
            error_code = coalesce(p_error ->> 'code', upper(coalesce(p_estado_openai, p_estado::text))),
            error_message = coalesce(p_error ->> 'message', 'La prueba asíncrona no pudo completarse.')
        where o.id = v_trabajo.entidad_id
          and o.openai_response_id = v_trabajo.openai_response_id;
    end case;
  end if;

  update public.trabajos_generacion_ia
  set estado = p_estado,
      estado_openai = coalesce(p_estado_openai, estado_openai),
      ultimo_error = p_error,
      completado_en = now(),
      token_reclamacion = null,
      reclamado_por = null,
      reclamado_hasta = null
  where id = v_trabajo.id
  returning * into v_trabajo;

  return v_trabajo;
end;
$$;


ALTER FUNCTION "public"."finalizar_trabajo_generacion_ia"("p_trabajo_id" "uuid", "p_token_reclamacion" "uuid", "p_estado" "public"."estado_trabajo_generacion_ia", "p_estado_openai" "text", "p_resultado" "jsonb", "p_error" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."finalizar_trabajo_ingesta_documental"("p_job_id" "uuid", "p_worker" "text", "p_ok" boolean, "p_error" "jsonb" DEFAULT NULL::"jsonb", "p_reintentar_en" timestamp with time zone DEFAULT NULL::timestamp with time zone) RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_actualizados integer;
begin
  update public.ingestion_jobs
  set status = case
        when p_ok then 'completed'::public.estado_trabajo_ingesta_documental
        when attempts >= 5 then 'dead_letter'::public.estado_trabajo_ingesta_documental
        else 'retry'::public.estado_trabajo_ingesta_documental
      end,
      available_at = case when p_ok or attempts >= 5 then available_at
        else coalesce(p_reintentar_en, now() + interval '1 minute') end,
      locked_at = null,
      locked_by = null,
      last_error = case when p_ok then null else p_error end,
      completed_at = case when p_ok or attempts >= 5 then now() else null end
  where id = p_job_id
    and status = 'processing'
    and locked_by = p_worker;
  get diagnostics v_actualizados = row_count;
  return v_actualizados = 1;
end;
$$;


ALTER FUNCTION "public"."finalizar_trabajo_ingesta_documental"("p_job_id" "uuid", "p_worker" "text", "p_ok" boolean, "p_error" "jsonb", "p_reintentar_en" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_ajustar_seriacion_por_cambio_ciclo"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'private', 'auth', 'extensions', 'pg_temp'
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
    SET "search_path" TO 'public', 'private', 'auth', 'extensions', 'pg_temp'
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


CREATE OR REPLACE FUNCTION "public"."fn_asignaturas_contenido_tematico_ensure_ids"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'auth', 'extensions', 'pg_temp'
    AS $$
begin
    new.contenido_tematico := public.fn_ensure_contenido_tematico_ids(new.contenido_tematico);
    return new;
end;
$$;


ALTER FUNCTION "public"."fn_asignaturas_contenido_tematico_ensure_ids"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_asignaturas_update_search_vector"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'private', 'auth', 'extensions', 'pg_temp'
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
    SET "search_path" TO 'public', 'private', 'auth', 'extensions', 'pg_temp'
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


CREATE OR REPLACE FUNCTION "public"."fn_calcular_score_preparacion"("p_asignatura_id" "uuid", "p_unidad_id" "text" DEFAULT NULL::"text", "p_tema_id" "text" DEFAULT NULL::"text") RETURNS integer
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public', 'auth', 'extensions', 'pg_temp'
    AS $$
    with expected as (
        select unnest(array['apunte','outline_presentacion','quiz','actividad','ejercicios','recursos_externos','rubrica']) as tipo
    ),
    presentes as (
        select distinct lo.tipo::text as tipo
        from public.learning_objects lo
        where lo.asignatura_id = p_asignatura_id
          and (p_unidad_id is null or lo.unidad_id = p_unidad_id)
          and (p_tema_id is null or lo.tema_id = p_tema_id)
    )
    select coalesce(
        (count(p.*)::float / nullif(count(e.*), 0) * 100)::int,
        0
    )
    from expected e
    left join presentes p on p.tipo = e.tipo;
$$;


ALTER FUNCTION "public"."fn_calcular_score_preparacion"("p_asignatura_id" "uuid", "p_unidad_id" "text", "p_tema_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_carreras_refresh_planes_nombre_display"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
begin
  update public.planes_estudio
     set nombre = nombre
   where carrera_id = NEW.id;

  return NEW;
end;
$$;


ALTER FUNCTION "public"."fn_carreras_refresh_planes_nombre_display"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_ensure_contenido_tematico_ids"("j" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'auth', 'extensions', 'pg_temp'
    AS $$
declare
    result jsonb := '[]'::jsonb;
    unidad jsonb;
    tema jsonb;
    temas jsonb;
    unidad_id text;
    tema_id text;
begin
    if j is null then
        return '[]'::jsonb;
    end if;

    if jsonb_typeof(j) = 'object' and j ? 'unidades' then
        j := j->'unidades';
    end if;

    if jsonb_typeof(j) <> 'array' then
        return '[]'::jsonb;
    end if;

    for i in 0..jsonb_array_length(j) - 1 loop
        unidad := j->i;
        if jsonb_typeof(unidad) <> 'object' then
            continue;
        end if;

        unidad_id := unidad->>'id';
        if unidad_id is null or unidad_id = '' then
            unidad_id := gen_random_uuid()::text;
        end if;

        temas := coalesce(unidad->'temas', '[]'::jsonb);
        if jsonb_typeof(temas) <> 'array' then
            temas := '[]'::jsonb;
        end if;

        for k in 0..jsonb_array_length(temas) - 1 loop
            tema := temas->k;
            if jsonb_typeof(tema) = 'string' then
                tema := jsonb_build_object('nombre', tema, 'id', gen_random_uuid()::text);
            elsif jsonb_typeof(tema) = 'object' then
                tema_id := tema->>'id';
                if tema_id is null or tema_id = '' then
                    tema := tema || jsonb_build_object('id', gen_random_uuid()::text);
                end if;
            else
                tema := '{}'::jsonb;
            end if;
            temas := jsonb_set(temas, array[k::text], tema, true);
        end loop;

        unidad := unidad || jsonb_build_object('id', unidad_id, 'temas', temas);
        result := result || unidad;
    end loop;

    return result;
end;
$$;


ALTER FUNCTION "public"."fn_ensure_contenido_tematico_ids"("j" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_fill_author_from_auth_uid"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'private', 'auth', 'extensions', 'pg_temp'
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


CREATE OR REPLACE FUNCTION "public"."fn_generar_nombre_plan_curricular"("p_carrera_id" "uuid", "p_fecha_inicio_imparticion" "date") RETURNS "text"
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare
  v_carrera record;
  v_nivel text;
  v_nombre_carrera text;
  v_meses text[] := array[
    'Enero','Febrero','Marzo','Abril','Mayo','Junio',
    'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'
  ];
  v_fecha date;
  v_mes text;
  v_anio integer;
begin
  select nivel, nombre
    into v_carrera
    from public.carreras
   where id = p_carrera_id;

  if v_carrera is null then
    raise exception 'No se encontró la carrera para generar el nombre del plan.'
      using errcode = 'P0001';
  end if;

  v_nivel := coalesce(trim(v_carrera.nivel::text), '');
  v_nombre_carrera := coalesce(trim(v_carrera.nombre), '');

  if v_nombre_carrera = '' then
    raise exception 'La carrera no tiene nombre; no se puede generar el nombre del plan.'
      using errcode = 'P0001';
  end if;

  if p_fecha_inicio_imparticion is null then
    raise exception 'fecha_inicio_imparticion es requerida para planes CURRICULAR.'
      using errcode = 'P0001';
  end if;

  v_fecha := date_trunc('month', p_fecha_inicio_imparticion)::date;
  v_mes := v_meses[extract(month from v_fecha)::int];
  v_anio := extract(year from v_fecha)::int;

  if lower(v_nivel) = 'otro' or v_nivel = '' then
    return format('%s - Plan %s %s', v_nombre_carrera, v_mes, v_anio);
  end if;

  return format('%s en %s - Plan %s %s', v_nivel, v_nombre_carrera, v_mes, v_anio);
end;
$$;


ALTER FUNCTION "public"."fn_generar_nombre_plan_curricular"("p_carrera_id" "uuid", "p_fecha_inicio_imparticion" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_grant_profesor_on_responsable"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'private', 'auth', 'extensions', 'pg_temp'
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
    SET "search_path" TO 'public', 'private', 'auth', 'extensions', 'pg_temp'
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
    SET "search_path" TO 'public', 'private', 'auth', 'extensions', 'pg_temp'
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
    SET "search_path" TO 'public', 'private', 'auth', 'extensions', 'pg_temp'
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
    SET "search_path" TO 'public', 'private', 'auth', 'extensions', 'pg_temp'
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
    SET "search_path" TO 'public', 'private', 'auth', 'extensions', 'pg_temp'
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
    SET "search_path" TO 'public', 'private', 'auth', 'extensions', 'pg_temp'
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


CREATE OR REPLACE FUNCTION "public"."fn_planes_exige_registro_oficial_aprobado"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'private', 'auth', 'extensions', 'pg_temp'
    AS $$
declare
  v_estado_destino text;
  v_tipo_estructura public.tipo_estructura_plan;
begin
  if tg_op not in ('INSERT', 'UPDATE') then
    return new;
  end if;

  if new.estado_actual_id is null then
    return new;
  end if;

  select clave
  into v_estado_destino
  from public.estados_plan
  where id = new.estado_actual_id;

  select ep.tipo
  into v_tipo_estructura
  from public.estructuras_plan ep
  where ep.id = new.estructura_id;

  if v_estado_destino = 'APROBADO'
     and v_tipo_estructura = 'CURRICULAR'
     and not exists (
       select 1
       from public.registros_oficiales_plan rop
       where rop.plan_estudio_id = new.id
     ) then
    raise exception
      'Para aprobar oficialmente el plan debes registrar clave SEP/RVOE, dictamen, vigencia y documento.'
      using errcode = '23514';
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."fn_planes_exige_registro_oficial_aprobado"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_planes_set_nombre_display"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare
  v_estructura_tipo public.tipo_estructura_plan;
  v_nombre_base text;
begin
  select tipo
    into v_estructura_tipo
    from public.estructuras_plan
   where id = NEW.estructura_id;

  if v_estructura_tipo is null then
    raise exception 'No se encontró la estructura del plan.'
      using errcode = 'P0001';
  end if;

  if NEW.fecha_inicio_imparticion is not null then
    NEW.fecha_inicio_imparticion := date_trunc(
      'month',
      NEW.fecha_inicio_imparticion
    )::date;
  end if;

  if v_estructura_tipo = 'CURRICULAR' then
    if NEW.fecha_inicio_imparticion is null then
      raise exception 'Los planes con estructura CURRICULAR requieren fecha_inicio_imparticion.'
        using errcode = 'P0001';
    end if;

    NEW.nombre := null;
    NEW.nombre_propuesto := null;
    NEW.nombre_display := public.fn_generar_nombre_plan_curricular(
      NEW.carrera_id,
      NEW.fecha_inicio_imparticion
    );
  else
    v_nombre_base := coalesce(
      nullif(trim(NEW.nombre_propuesto), ''),
      nullif(trim(NEW.nombre), ''),
      'Plan sin nombre'
    );

    NEW.nombre_propuesto := nullif(trim(coalesce(NEW.nombre_propuesto, v_nombre_base)), '');
    NEW.nombre := nullif(trim(coalesce(NEW.nombre, v_nombre_base)), '');
    NEW.nombre_display := v_nombre_base;
  end if;

  return NEW;
end;
$$;


ALTER FUNCTION "public"."fn_planes_set_nombre_display"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_track_cambios_asignatura"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'private', 'auth', 'extensions', 'pg_temp'
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
    SET "search_path" TO 'public', 'private', 'auth', 'extensions', 'pg_temp'
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
    SET "search_path" TO 'public', 'private', 'auth', 'extensions', 'pg_temp'
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
    v_has_full_write := public.authz_asignatura_content_write_allowed(NEW.id)
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
    SET "search_path" TO 'public', 'private', 'auth', 'extensions', 'pg_temp'
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
    SET "search_path" TO 'public', 'private', 'auth', 'extensions', 'pg_temp'
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



CREATE OR REPLACE FUNCTION "public"."liberar_trabajo_generacion_ia"("p_trabajo_id" "uuid", "p_token_reclamacion" "uuid", "p_estado_openai" "text", "p_proxima_revision_en" timestamp with time zone, "p_error" "jsonb" DEFAULT NULL::"jsonb") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_actualizados integer;
begin
  update public.trabajos_generacion_ia
  set estado = case
        when fecha_limite <= now()
          then 'expirado'::public.estado_trabajo_generacion_ia
        else 'pendiente'::public.estado_trabajo_generacion_ia
      end,
      estado_openai = coalesce(p_estado_openai, estado_openai),
      proxima_revision_en = greatest(coalesce(p_proxima_revision_en, now()), now()),
      ultimo_error = p_error,
      completado_en = case when fecha_limite <= now() then now() else null end,
      token_reclamacion = null,
      reclamado_por = null,
      reclamado_hasta = null
  where id = p_trabajo_id
    and estado = 'reclamado'
    and token_reclamacion = p_token_reclamacion
    and reclamado_hasta > now();

  get diagnostics v_actualizados = row_count;
  return v_actualizados = 1;
end;
$$;


ALTER FUNCTION "public"."liberar_trabajo_generacion_ia"("p_trabajo_id" "uuid", "p_token_reclamacion" "uuid", "p_estado_openai" "text", "p_proxima_revision_en" timestamp with time zone, "p_error" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."listar_archivos_conversacion_documental"("p_usuario_id" "uuid", "p_tenant_id" "uuid", "p_conversation_type" "public"."tipo_conversacion_documental", "p_conversation_id" "uuid") RETURNS TABLE("file_id" "uuid", "added_at" timestamp with time zone, "active" boolean, "used" boolean, "first_used_at" timestamp with time zone, "can_remove" boolean)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  with primeros_usos as (
    select ar.file_id, min(ar.created_at) as first_used_at
    from public.ai_request_references ar
    where ar.tenant_id = p_tenant_id
      and ar.conversation_type = p_conversation_type
      and ar.conversation_id = p_conversation_id
    group by ar.file_id
  ), candidatos as (
    select cf.file_id
    from public.conversation_files cf
    where cf.tenant_id = p_tenant_id
      and cf.conversation_type = p_conversation_type
      and cf.conversation_id = p_conversation_id
    union
    select pu.file_id from primeros_usos pu
  )
  select
    c.file_id,
    coalesce(cf.added_at, pu.first_used_at) as added_at,
    (cf.file_id is null or cf.removed_at is null) as active,
    (pu.file_id is not null) as used,
    pu.first_used_at,
    (cf.file_id is not null and cf.removed_at is null and pu.file_id is null)
      as can_remove
  from candidatos c
  left join public.conversation_files cf
    on cf.tenant_id = p_tenant_id
   and cf.conversation_type = p_conversation_type
   and cf.conversation_id = p_conversation_id
   and cf.file_id = c.file_id
  left join primeros_usos pu on pu.file_id = c.file_id
  where private.documentos_usuario_puede_archivo(
    p_usuario_id,
    c.file_id,
    'view'::public.permiso_archivo_documental
  )
  order by coalesce(cf.added_at, pu.first_used_at), c.file_id
$$;


ALTER FUNCTION "public"."listar_archivos_conversacion_documental"("p_usuario_id" "uuid", "p_tenant_id" "uuid", "p_conversation_type" "public"."tipo_conversacion_documental", "p_conversation_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."listar_biblioteca_documental"("p_usuario_id" "uuid", "p_tenant_id" "uuid", "p_query" "text" DEFAULT NULL::"text", "p_sort" "text" DEFAULT 'updated_desc'::"text", "p_limit" integer DEFAULT 100, "p_offset" integer DEFAULT 0) RETURNS TABLE("id" "uuid", "display_name" "text", "description" "text", "status" "public"."estado_procesamiento_documento", "created_at" timestamp with time zone, "updated_at" timestamp with time zone, "current_version_id" "uuid", "last_viewed_at" timestamp with time zone, "last_used_at" timestamp with time zone, "pinned_at" timestamp with time zone, "archived_at" timestamp with time zone, "total_count" bigint)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  with visibles as (
    select
      f.id,
      f.display_name,
      f.description,
      f.status,
      f.created_at,
      f.updated_at,
      f.current_version_id,
      fus.last_viewed_at,
      fus.last_used_at,
      fus.pinned_at,
      fus.archived_at
    from public.files f
    left join public.file_user_state fus
      on fus.tenant_id = f.tenant_id
     and fus.user_id = p_usuario_id
     and fus.file_id = f.id
    where f.tenant_id = p_tenant_id
      and f.deleted_at is null
      and fus.archived_at is null
      and (
        nullif(btrim(coalesce(p_query, '')), '') is null
        or position(lower(btrim(p_query)) in lower(f.display_name)) > 0
      )
      and private.documentos_usuario_puede_archivo(
        p_usuario_id,
        f.id,
        'view'::public.permiso_archivo_documental
      )
  )
  select
    v.id,
    v.display_name,
    v.description,
    v.status,
    v.created_at,
    v.updated_at,
    v.current_version_id,
    v.last_viewed_at,
    v.last_used_at,
    v.pinned_at,
    v.archived_at,
    count(*) over() as total_count
  from visibles v
  order by
    case when p_sort = 'name_asc' then lower(v.display_name) end asc nulls last,
    case when p_sort = 'name_desc' then lower(v.display_name) end desc nulls last,
    case when p_sort = 'used_desc' then v.last_used_at end desc nulls last,
    case when p_sort = 'created_desc' then v.created_at end desc nulls last,
    case
      when p_sort = 'updated_desc'
        or p_sort not in ('name_asc', 'name_desc', 'used_desc', 'created_desc')
      then v.updated_at
    end desc nulls last,
    v.id asc
  limit least(greatest(coalesce(p_limit, 100), 1), 200)
  offset greatest(coalesce(p_offset, 0), 0)
$$;


ALTER FUNCTION "public"."listar_biblioteca_documental"("p_usuario_id" "uuid", "p_tenant_id" "uuid", "p_query" "text", "p_sort" "text", "p_limit" integer, "p_offset" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."listar_colecciones_documentales"("p_usuario_id" "uuid", "p_tenant_id" "uuid") RETURNS TABLE("id" "uuid", "name" "text", "description" "text", "kind" "text", "status" "text", "created_by" "uuid", "created_at" timestamp with time zone, "updated_at" timestamp with time zone, "file_ids" "uuid"[])
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  with colecciones_candidatas as (
    select c.*
    from public.collections c
    where c.tenant_id = p_tenant_id
      and c.status = 'active'
      and exists (
        select 1
        from public.tenant_memberships tm
        where tm.tenant_id = p_tenant_id
          and tm.user_id = p_usuario_id
      )
      and (
        (c.kind = 'collection' and c.created_by = p_usuario_id)
        or c.kind = 'curriculum_repository'
      )
  ), archivos_autorizados as (
    select
      cf.collection_id,
      array_agg(cf.file_id order by cf.added_at, cf.file_id) as file_ids
    from public.collection_files cf
    join colecciones_candidatas c on c.id = cf.collection_id
    where cf.tenant_id = p_tenant_id
      and private.documentos_usuario_puede_archivo(
        p_usuario_id,
        cf.file_id,
        'view'::public.permiso_archivo_documental
      )
    group by cf.collection_id
  )
  select
    c.id,
    c.name,
    c.description,
    c.kind,
    c.status,
    c.created_by,
    c.created_at,
    c.updated_at,
    coalesce(a.file_ids, '{}'::uuid[]) as file_ids
  from colecciones_candidatas c
  left join archivos_autorizados a on a.collection_id = c.id
  where c.kind = 'collection'
     or c.created_by = p_usuario_id
     or coalesce(cardinality(a.file_ids), 0) > 0
  order by lower(c.name), c.id
$$;


ALTER FUNCTION "public"."listar_colecciones_documentales"("p_usuario_id" "uuid", "p_tenant_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."listar_colecciones_documentales"("p_usuario_id" "uuid", "p_tenant_id" "uuid") IS 'Lista colecciones personales propias y repositorios curriculares alcanzables mediante archivos autorizados.';



CREATE OR REPLACE FUNCTION "public"."marcar_intento_generacion_ia_publicado"("p_intento_id" "uuid", "p_token_reclamacion" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_actualizado integer;
begin
  update private.intentos_generacion_ia i
  set estado = 'publicado',
      token_reclamacion = null,
      reclamado_por = null,
      reclamado_hasta = null,
      publicado_en = coalesce(i.publicado_en, now()),
      actualizado_en = now(),
      ultimo_error = null
  where i.id = p_intento_id
    and i.openai_response_id is not null
    and (
      i.estado = 'publicado'
      or (
        i.estado = 'respuesta_vinculada'
        and i.token_reclamacion = p_token_reclamacion
        and i.reclamado_hasta > now()
      )
    );
  get diagnostics v_actualizado = row_count;
  return v_actualizado = 1;
end;
$$;


ALTER FUNCTION "public"."marcar_intento_generacion_ia_publicado"("p_intento_id" "uuid", "p_token_reclamacion" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."materializar_sesion_carga_documento"("p_session_id" "uuid", "p_sha256" "text", "p_size_bytes" bigint, "p_detected_mime" "text", "p_storage_path" "text") RETURNS TABLE("file_id" "uuid", "file_version_id" "uuid", "blob_id" "uuid", "blob_created" boolean)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $_$
declare
  v_sesion public.upload_sessions;
  v_blob public.file_blobs;
  v_archivo public.files;
  v_version public.file_versions;
  v_nuevo_blob boolean := false;
begin
  if p_sha256 !~ '^[a-f0-9]{64}$'
     or p_size_bytes not between 1 and 20971520
     or nullif(btrim(p_detected_mime), '') is null then
    raise exception using errcode = '22023', message = 'Metadatos de archivo inválidos';
  end if;

  select * into v_sesion
  from public.upload_sessions
  where id = p_session_id
    and status in ('uploaded', 'hashing', 'deduplicating')
  for update;
  if v_sesion.id is null then
    raise exception using errcode = 'P0002', message = 'Sesión de carga no disponible';
  end if;
  if v_sesion.declared_size <> p_size_bytes then
    raise exception using errcode = '23514', message = 'El tamaño real no coincide con la sesión';
  end if;
  if p_storage_path <> format('content/%s/%s/%s', v_sesion.tenant_id, left(p_sha256, 2), p_sha256) then
    raise exception using errcode = '23514', message = 'Ruta física no canónica';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(v_sesion.tenant_id::text || ':' || p_sha256, 0)
  );
  select * into v_blob
  from public.file_blobs
  where tenant_id = v_sesion.tenant_id
    and sha256 = p_sha256
    and size_bytes = p_size_bytes
    and deleted_at is null
  for update;

  if v_blob.id is null then
    insert into public.file_blobs (
      tenant_id, sha256, size_bytes, detected_mime, storage_path, processing_status
    ) values (
      v_sesion.tenant_id, p_sha256, p_size_bytes, p_detected_mime,
      p_storage_path, 'pending'
    ) returning * into v_blob;
    v_nuevo_blob := true;
  end if;

  insert into public.files (
    tenant_id, display_name, created_by, status
  ) values (
    v_sesion.tenant_id, v_sesion.original_filename, v_sesion.user_id, 'processing'
  ) returning * into v_archivo;

  insert into public.file_versions (
    tenant_id, file_id, blob_id, version_number, original_filename, uploaded_by
  ) values (
    v_sesion.tenant_id, v_archivo.id, v_blob.id, 1,
    v_sesion.original_filename, v_sesion.user_id
  ) returning * into v_version;

  update public.files
  set current_version_id = v_version.id
  where id = v_archivo.id;
  update public.upload_sessions
  set status = 'extracting', result_file_id = v_archivo.id, completed_at = now(), error_code = null
  where id = v_sesion.id;

  perform public.encolar_trabajo_ingesta_documental(
    v_sesion.tenant_id,
    null,
    v_version.id,
    'extract_local',
    format('extract:%s:local:0:0:v1', v_version.id),
    jsonb_build_object('file_id', v_archivo.id, 'blob_created', v_nuevo_blob)
  );

  file_id := v_archivo.id;
  file_version_id := v_version.id;
  blob_id := v_blob.id;
  blob_created := v_nuevo_blob;
  return next;
end;
$_$;


ALTER FUNCTION "public"."materializar_sesion_carga_documento"("p_session_id" "uuid", "p_sha256" "text", "p_size_bytes" bigint, "p_detected_mime" "text", "p_storage_path" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."nivel_es_posgrado"("p_nivel" "text") RETURNS boolean
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $$
  select lower(public.unaccent_immutable(btrim(coalesce(p_nivel, '')))) in (
    'maestria',
    'doctorado',
    'especialidad'
  );
$$;


ALTER FUNCTION "public"."nivel_es_posgrado"("p_nivel" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."nombrar_responsable"("p_usuario" "uuid", "p_rol" "uuid", "p_facultad" "uuid", "p_carrera" "uuid", "p_actor" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'private', 'auth', 'extensions', 'pg_temp'
    AS $$
declare
  v_alcance text;
  v_reemplazados jsonb;
  v_nueva public.usuarios_roles;
begin
  select alcance_default into v_alcance from public.roles where id = p_rol;
  if not found then
    raise exception 'Rol no encontrado.' using errcode = 'P0404';
  end if;

  if p_facultad is not null and p_carrera is not null then
    raise exception 'El alcance debe ser por facultad o por carrera, no ambos.'
      using errcode = 'P0409';
  end if;
  if v_alcance = 'facultad' and p_facultad is null then
    raise exception 'Este rol requiere una facultad.' using errcode = 'P0409';
  end if;
  if v_alcance = 'carrera' and p_carrera is null then
    raise exception 'Este rol requiere una carrera.' using errcode = 'P0409';
  end if;

  if not public.usuario_puede_gestionar_usuario(p_actor, p_usuario) then
    raise exception 'No tienes permisos para gestionar a este usuario.'
      using errcode = 'P0403';
  end if;

  if not public.usuario_puede_gestionar_rol(
    p_actor,
    p_rol,
    p_facultad,
    p_carrera
  ) then
    raise exception 'No tienes permisos para nombrar ese rol en ese alcance.'
      using errcode = 'P0403';
  end if;

  if exists (
    select 1
    from public.usuarios_roles ur
    where ur.rol_id = p_rol
      and ur.usuario_id <> p_usuario
      and (
        (p_facultad is not null and ur.facultad_id = p_facultad)
        or (p_carrera is not null and ur.carrera_id = p_carrera)
      )
      and not public.usuario_puede_gestionar_usuario(p_actor, ur.usuario_id)
  ) then
    raise exception 'No tienes permisos para reemplazar al titular actual.'
      using errcode = 'P0403';
  end if;

  with removed as (
    delete from public.usuarios_roles ur
    where ur.rol_id = p_rol
      and ur.usuario_id <> p_usuario
      and (
        (p_facultad is not null and ur.facultad_id = p_facultad)
        or (p_carrera is not null and ur.carrera_id = p_carrera)
      )
    returning ur.usuario_id, ur.id as asignacion_id
  )
  select coalesce(jsonb_agg(to_jsonb(removed)), '[]'::jsonb)
  into v_reemplazados
  from removed;

  insert into public.usuarios_roles (
    usuario_id,
    rol_id,
    facultad_id,
    carrera_id,
    asignado_por
  )
  values (p_usuario, p_rol, p_facultad, p_carrera, p_actor)
  on conflict do nothing
  returning * into v_nueva;

  if v_nueva.id is null then
    select * into v_nueva
    from public.usuarios_roles
    where usuario_id = p_usuario
      and rol_id = p_rol
      and coalesce(facultad_id, '00000000-0000-0000-0000-000000000000'::uuid)
          = coalesce(p_facultad, '00000000-0000-0000-0000-000000000000'::uuid)
      and coalesce(carrera_id, '00000000-0000-0000-0000-000000000000'::uuid)
          = coalesce(p_carrera, '00000000-0000-0000-0000-000000000000'::uuid);
  end if;

  return jsonb_build_object(
    'asignacion_id', v_nueva.id,
    'usuario_id', p_usuario,
    'reemplazados', v_reemplazados
  );
end;
$$;


ALTER FUNCTION "public"."nombrar_responsable"("p_usuario" "uuid", "p_rol" "uuid", "p_facultad" "uuid", "p_carrera" "uuid", "p_actor" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."normalizar_datos_por_definicion"("p_datos" "jsonb", "p_definicion" "jsonb", "p_null_invalid" boolean DEFAULT false) RETURNS "jsonb"
    LANGUAGE "plpgsql" IMMUTABLE
    SET "search_path" TO 'public', 'private', 'auth', 'extensions', 'pg_temp'
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
    SET "search_path" TO 'public', 'private', 'auth', 'extensions', 'pg_temp'
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


CREATE OR REPLACE FUNCTION "public"."observability_admin_ping"() RETURNS "jsonb"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  select jsonb_build_object(
    'ok', public.authz_is_admin(),
    'user_id', auth.uid(),
    'is_admin', public.authz_is_admin(),
    'server_time', now()
  );
$$;


ALTER FUNCTION "public"."observability_admin_ping"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."observability_applied_migrations"() RETURNS TABLE("version" "text", "name" "text")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  select m.version::text, m.name::text
  from supabase_migrations.schema_migrations as m
  order by m.version asc;
$$;


ALTER FUNCTION "public"."observability_applied_migrations"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."observability_public_ping"() RETURNS "jsonb"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  select jsonb_build_object(
    'ok', true,
    'server_time', now()
  );
$$;


ALTER FUNCTION "public"."observability_public_ping"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."persistir_resultado_recursos_aprendizaje_ia"("p_generation_job_id" "uuid", "p_openai_response_id" "text", "p_resultado" "jsonb", "p_objetos" "jsonb", "p_score" "jsonb") RETURNS "public"."learning_generation_jobs"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_job public.learning_generation_jobs;
begin
  perform pg_advisory_xact_lock(
    hashtextextended(
      'recursos_aprendizaje:' || p_generation_job_id::text,
      0
    )
  );

  -- Una generacion asincrona registrada siempre debe cerrar mediante su lease.
  if exists (
    select 1
    from public.trabajos_generacion_ia t
    where t.tipo_entidad = 'recursos_aprendizaje'
      and t.entidad_id = p_generation_job_id
      and t.estado in ('pendiente', 'reclamado')
  ) then
    raise exception using
      errcode = '55000',
      message = 'La generacion asincrona requiere una reclamacion vigente';
  end if;

  v_job := private.persistir_resultado_recursos_aprendizaje_ia(
    p_generation_job_id,
    p_openai_response_id,
    p_resultado,
    p_objetos,
    p_score
  );
  return v_job;
end;
$$;


ALTER FUNCTION "public"."persistir_resultado_recursos_aprendizaje_ia"("p_generation_job_id" "uuid", "p_openai_response_id" "text", "p_resultado" "jsonb", "p_objetos" "jsonb", "p_score" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."plan_estado_clave"("p_plan_id" "uuid") RETURNS "text"
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public', 'private', 'auth', 'extensions', 'pg_temp'
    AS $$ select private.plan_estado_clave(p_plan_id); $$;


ALTER FUNCTION "public"."plan_estado_clave"("p_plan_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."planes_catalogo_buscar"("p_search" "text" DEFAULT NULL::"text", "p_facultad_id" "uuid" DEFAULT NULL::"uuid", "p_carrera_id" "uuid" DEFAULT NULL::"uuid", "p_estado_id" "uuid" DEFAULT NULL::"uuid", "p_nivel" "text" DEFAULT NULL::"text", "p_activo" boolean DEFAULT NULL::boolean, "p_limit" integer DEFAULT 50, "p_offset" integer DEFAULT 0) RETURNS TABLE("plan" "jsonb", "carrera" "jsonb", "facultad" "jsonb", "estructura_plan" "jsonb", "estado_plan" "jsonb", "puede_abrir_detalle" boolean, "total_count" bigint)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'private', 'auth', 'extensions', 'pg_temp'
    AS $$
  with normalized as (
    select
      lower(public.unaccent_immutable(btrim(coalesce(p_search, '')))) as search_term,
      nullif(btrim(coalesce(p_nivel, '')), '') as nivel_term,
      greatest(0, least(coalesce(p_limit, 50), 100)) as safe_limit,
      greatest(0, coalesce(p_offset, 0)) as safe_offset
  ),
  filtered as (
    select
      pe,
      c,
      f,
      eplan,
      ep,
      (
        case
          when public.authz_simulacion_activa()
            then private.authz_claim_has_permission('planes.ver')
          else public.authz_has_permission('planes.ver'::text)
        end
        and public.authz_can_access_plan(pe.id)
      ) as puede_abrir_detalle
    from public.planes_estudio pe
    join public.carreras c on c.id = pe.carrera_id
    join public.facultades f on f.id = c.facultad_id
    left join public.estructuras_plan eplan on eplan.id = pe.estructura_id
    left join public.estados_plan ep on ep.id = pe.estado_actual_id
    cross join normalized n
    where public.authz_can_list_plan_catalog_for_facultad(c.facultad_id)
      and (n.search_term = '' or pe.nombre_search ilike '%' || n.search_term || '%')
      and (p_facultad_id is null or c.facultad_id = p_facultad_id)
      and (p_carrera_id is null or pe.carrera_id = p_carrera_id)
      and (p_estado_id is null or pe.estado_actual_id = p_estado_id)
      and (p_activo is null or pe.activo = p_activo)
      and (
        n.nivel_term is null
        or lower(public.unaccent_immutable(c.nivel::text)) = lower(public.unaccent_immutable(n.nivel_term))
      )
  )
  select
    to_jsonb(filtered.pe) as plan,
    to_jsonb(filtered.c) as carrera,
    to_jsonb(filtered.f) as facultad,
    to_jsonb(filtered.eplan) as estructura_plan,
    to_jsonb(filtered.ep) as estado_plan,
    filtered.puede_abrir_detalle,
    count(*) over () as total_count
  from filtered
  cross join normalized n
  order by (filtered.pe).creado_en desc
  limit (select safe_limit from normalized)
  offset (select safe_offset from normalized);
$$;


ALTER FUNCTION "public"."planes_catalogo_buscar"("p_search" "text", "p_facultad_id" "uuid", "p_carrera_id" "uuid", "p_estado_id" "uuid", "p_nivel" "text", "p_activo" boolean, "p_limit" integer, "p_offset" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."preparar_intento_chat_ia"("p_intento_id" "uuid", "p_tipo_conversacion" "public"."tipo_conversacion_documental", "p_conversacion_id" "uuid", "p_mensaje_id" "uuid", "p_usuario_id" "uuid", "p_solicitud" "jsonb", "p_modo_referencias" "text" DEFAULT 'none'::"text", "p_consulta_referencias" "text" DEFAULT ''::"text", "p_referencias" "jsonb" DEFAULT '[]'::"jsonb", "p_actor" "text" DEFAULT 'create-chat-conversation'::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_conversacion_actual uuid;
  v_autor_actual uuid;
  v_estado_actual public.estado_mensaje_ia;
  v_response_actual text;
  v_tipo_entidad public.tipo_trabajo_generacion_ia;
begin
  if p_intento_id is null
     or p_conversacion_id is null
     or p_mensaje_id is null
     or p_usuario_id is null then
    raise exception using errcode = '22023', message = 'intento y contexto de chat son requeridos';
  end if;
  if jsonb_typeof(coalesce(p_solicitud, 'null'::jsonb)) <> 'object'
     or nullif(btrim(p_solicitud ->> 'model'), '') is null
     or p_solicitud ->> 'background' is distinct from 'true'
     or jsonb_typeof(p_solicitud -> 'input') <> 'array' then
    raise exception using errcode = '22023', message = 'la solicitud durable de OpenAI no es válida';
  end if;

  if p_tipo_conversacion = 'plan' then
    select m.conversacion_plan_id, m.enviado_por, m.estado, m.openai_response_id
    into v_conversacion_actual, v_autor_actual, v_estado_actual, v_response_actual
    from public.plan_mensajes_ia m
    where m.id = p_mensaje_id
    for update;
    v_tipo_entidad := 'chat_plan';
  elsif p_tipo_conversacion = 'asignatura' then
    select m.conversacion_asignatura_id, m.enviado_por, m.estado, m.openai_response_id
    into v_conversacion_actual, v_autor_actual, v_estado_actual, v_response_actual
    from public.asignatura_mensajes_ia m
    where m.id = p_mensaje_id
    for update;
    v_tipo_entidad := 'chat_asignatura';
  else
    raise exception using errcode = '22023', message = 'tipo de conversación no válido';
  end if;
  if not found then
    raise exception using errcode = 'P0002', message = 'mensaje de chat no encontrado';
  end if;
  if v_conversacion_actual is distinct from p_conversacion_id then
    raise exception using errcode = '22023', message = 'el mensaje no pertenece a la conversación indicada';
  end if;
  if v_autor_actual is distinct from p_usuario_id then
    raise exception using errcode = '42501', message = 'el usuario no es autor del mensaje';
  end if;
  if v_estado_actual <> 'PROCESANDO' or v_response_actual is not null then
    raise exception using errcode = '55000', message = 'el mensaje ya no admite un intento nuevo';
  end if;

  return public.preparar_intento_generacion_ia(
    p_intento_id,
    v_tipo_entidad,
    p_mensaje_id,
    'chat',
    1,
    jsonb_build_object(
      'conversationType', p_tipo_conversacion,
      'conversationId', p_conversacion_id,
      'messageId', p_mensaje_id,
      'userId', p_usuario_id
    ),
    p_solicitud,
    p_modo_referencias,
    coalesce(p_consulta_referencias, ''),
    p_referencias,
    p_actor
  );
end;
$$;


ALTER FUNCTION "public"."preparar_intento_chat_ia"("p_intento_id" "uuid", "p_tipo_conversacion" "public"."tipo_conversacion_documental", "p_conversacion_id" "uuid", "p_mensaje_id" "uuid", "p_usuario_id" "uuid", "p_solicitud" "jsonb", "p_modo_referencias" "text", "p_consulta_referencias" "text", "p_referencias" "jsonb", "p_actor" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."preparar_intento_chat_ia"("p_intento_id" "uuid", "p_tipo_conversacion" "public"."tipo_conversacion_documental", "p_conversacion_id" "uuid", "p_mensaje_id" "uuid", "p_usuario_id" "uuid", "p_solicitud" "jsonb", "p_modo_referencias" "text", "p_consulta_referencias" "text", "p_referencias" "jsonb", "p_actor" "text") IS 'Persiste y reclama el snapshot completo antes de iniciar cualquier efecto remoto en OpenAI.';



CREATE OR REPLACE FUNCTION "public"."preparar_intento_entidad_ia"("p_intento_id" "uuid", "p_tipo_entidad" "public"."tipo_trabajo_generacion_ia", "p_entidad_id" "uuid", "p_usuario_id" "uuid", "p_contexto" "jsonb", "p_solicitud" "jsonb", "p_modo_referencias" "text" DEFAULT 'none'::"text", "p_consulta_referencias" "text" DEFAULT ''::"text", "p_referencias" "jsonb" DEFAULT '[]'::"jsonb", "p_actor" "text" DEFAULT 'edge:entity-generation'::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_handler text;
  v_contexto jsonb;
  v_intento jsonb;
  v_actualizados integer := 0;
begin
  if p_intento_id is null
     or p_entidad_id is null
     or p_usuario_id is null
     or p_tipo_entidad not in ('plan', 'asignatura') then
    raise exception using
      errcode = '22023',
      message = 'intento, tipo, entidad y usuario son requeridos';
  end if;
  if jsonb_typeof(coalesce(p_contexto, 'null'::jsonb)) <> 'object' then
    raise exception using errcode = '22023', message = 'contexto debe ser un objeto JSON';
  end if;

  v_handler := case p_tipo_entidad
    when 'plan' then 'plan'
    else 'subject'
  end;
  v_contexto := coalesce(p_contexto, '{}'::jsonb) || jsonb_build_object(
    'userId', p_usuario_id,
    'entityId', p_entidad_id,
    'kind', p_tipo_entidad
  );

  -- La RPC común adquiere y conserva hasta el final de esta transacción el
  -- advisory lock de handler/tipo/entidad y obsoleta intentos anteriores.
  v_intento := public.preparar_intento_generacion_ia(
    p_intento_id,
    p_tipo_entidad,
    p_entidad_id,
    v_handler,
    1,
    v_contexto,
    p_solicitud,
    p_modo_referencias,
    coalesce(p_consulta_referencias, ''),
    p_referencias,
    p_actor
  );

  if p_tipo_entidad = 'plan' then
    update public.planes_estudio p
    set meta_origen = jsonb_set(
      coalesce(p.meta_origen, '{}'::jsonb),
      '{ai}',
      (
        case
          when jsonb_typeof(p.meta_origen -> 'ai') = 'object'
            then p.meta_origen -> 'ai'
          else '{}'::jsonb
        end
        - 'responseId'
        - 'error'
      ) || jsonb_strip_nulls(jsonb_build_object(
        'activeAttemptId', p_intento_id,
        'model', v_contexto ->> 'model',
        'reasoningEffort', v_contexto ->> 'reasoningEffort'
      )),
      true
    )
    where p.id = p_entidad_id
      and exists (
        select 1
        from public.estados_plan ep
        where ep.id = p.estado_actual_id
          and upper(ep.clave) = 'GENERANDO'
      );
  else
    update public.asignaturas a
    set meta_origen = jsonb_set(
      coalesce(a.meta_origen, '{}'::jsonb),
      '{ai}',
      (
        case
          when jsonb_typeof(a.meta_origen -> 'ai') = 'object'
            then a.meta_origen -> 'ai'
          else '{}'::jsonb
        end
        - 'responseId'
        - 'error'
      ) || jsonb_strip_nulls(jsonb_build_object(
        'activeAttemptId', p_intento_id,
        'model', v_contexto ->> 'model',
        'reasoningEffort', v_contexto ->> 'reasoningEffort'
      )),
      true
    )
    where a.id = p_entidad_id
      and a.estado = 'generando';
  end if;
  get diagnostics v_actualizados = row_count;

  if v_actualizados <> 1 then
    raise exception using
      errcode = '55000',
      message = 'la entidad ya no admite iniciar esta generación';
  end if;

  update public.trabajos_generacion_ia t
  set estado = 'obsoleto',
      completado_en = coalesce(t.completado_en, now()),
      token_reclamacion = null,
      reclamado_por = null,
      reclamado_hasta = null,
      ultimo_error = jsonb_build_object(
        'code', 'SUPERSEDED_ATTEMPT',
        'message', 'Un intento más reciente sustituyó esta respuesta.'
      )
  where t.tipo_entidad = p_tipo_entidad
    and t.entidad_id = p_entidad_id
    and t.estado in ('pendiente', 'reclamado');

  return jsonb_build_object(
    'resolution', 'prepared',
    'attempt', private.intento_generacion_ia_json(p_intento_id),
    'entity', private.entidad_intento_ia_json(p_tipo_entidad, p_entidad_id)
  );
end;
$$;


ALTER FUNCTION "public"."preparar_intento_entidad_ia"("p_intento_id" "uuid", "p_tipo_entidad" "public"."tipo_trabajo_generacion_ia", "p_entidad_id" "uuid", "p_usuario_id" "uuid", "p_contexto" "jsonb", "p_solicitud" "jsonb", "p_modo_referencias" "text", "p_consulta_referencias" "text", "p_referencias" "jsonb", "p_actor" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."preparar_intento_entidad_ia"("p_intento_id" "uuid", "p_tipo_entidad" "public"."tipo_trabajo_generacion_ia", "p_entidad_id" "uuid", "p_usuario_id" "uuid", "p_contexto" "jsonb", "p_solicitud" "jsonb", "p_modo_referencias" "text", "p_consulta_referencias" "text", "p_referencias" "jsonb", "p_actor" "text") IS 'Prepara plan o asignatura y fija activeAttemptId en la misma transacción que el outbox genérico.';



CREATE OR REPLACE FUNCTION "public"."preparar_intento_generacion_ia"("p_intento_id" "uuid", "p_tipo_entidad" "public"."tipo_trabajo_generacion_ia", "p_entidad_id" "uuid", "p_handler" "text", "p_payload_version" integer, "p_contexto" "jsonb", "p_solicitud" "jsonb", "p_modo_referencias" "text" DEFAULT 'none'::"text", "p_consulta_referencias" "text" DEFAULT ''::"text", "p_referencias" "jsonb" DEFAULT '[]'::"jsonb", "p_actor" "text" DEFAULT 'edge-function'::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_existente private.intentos_generacion_ia;
  v_tipo_conversacion public.tipo_conversacion_documental;
  v_conversacion_id uuid;
  v_mensaje_id uuid;
  v_usuario_id uuid;
begin
  if p_intento_id is null
     or p_entidad_id is null
     or nullif(btrim(coalesce(p_handler, '')), '') is null
     or coalesce(p_payload_version, 0) <= 0
     or nullif(btrim(coalesce(p_actor, '')), '') is null then
    raise exception using
      errcode = '22023',
      message = 'intento, entidad, handler, versión y actor son requeridos';
  end if;
  if jsonb_typeof(coalesce(p_contexto, 'null'::jsonb)) <> 'object'
     or jsonb_typeof(coalesce(p_solicitud, 'null'::jsonb)) <> 'object'
     or jsonb_typeof(coalesce(p_referencias, 'null'::jsonb)) <> 'array'
     or p_modo_referencias not in ('none', 'direct', 'retrieval')
     or ((p_modo_referencias = 'none') <>
       (jsonb_array_length(p_referencias) = 0)) then
    raise exception using
      errcode = '22023',
      message = 'el payload durable no es válido';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(
    p_handler || ':' || p_tipo_entidad::text || ':' || p_entidad_id::text,
    0
  ));

  select * into v_existente
  from private.intentos_generacion_ia i
  where i.id = p_intento_id
  for update;

  if found then
    if v_existente.tipo_entidad is distinct from p_tipo_entidad
       or v_existente.entidad_id is distinct from p_entidad_id
       or v_existente.handler is distinct from p_handler
       or v_existente.payload_version is distinct from p_payload_version
       or v_existente.contexto is distinct from p_contexto
       or v_existente.solicitud is distinct from p_solicitud
       or v_existente.modo_referencias is distinct from p_modo_referencias
       or v_existente.consulta_referencias is distinct from coalesce(p_consulta_referencias, '')
       or v_existente.referencias is distinct from p_referencias then
      raise exception using
        errcode = '23505',
        message = 'el identificador del intento ya corresponde a otro payload';
    end if;
    return private.intento_generacion_ia_json(p_intento_id);
  end if;

  update private.intentos_generacion_ia i
  set estado = 'obsoleto',
      token_reclamacion = null,
      reclamado_por = null,
      reclamado_hasta = null,
      actualizado_en = now(),
      ultimo_error = jsonb_build_object(
        'code', 'SUPERSEDED_ATTEMPT',
        'message', 'Un intento más reciente sustituyó este payload.'
      )
  where i.handler = p_handler
    and i.tipo_entidad = p_tipo_entidad
    and i.entidad_id = p_entidad_id
    and i.estado in ('preparado', 'reclamado', 'respuesta_vinculada');

  if p_handler = 'chat' then
    begin
      v_tipo_conversacion := (p_contexto ->> 'conversationType')::public.tipo_conversacion_documental;
      v_conversacion_id := (p_contexto ->> 'conversationId')::uuid;
      v_mensaje_id := (p_contexto ->> 'messageId')::uuid;
      v_usuario_id := (p_contexto ->> 'userId')::uuid;
    exception when invalid_text_representation or null_value_not_allowed then
      raise exception using
        errcode = '22023',
        message = 'el contexto durable del chat no es válido';
    end;
    if v_mensaje_id is distinct from p_entidad_id then
      raise exception using
        errcode = '22023',
        message = 'la entidad del intento no coincide con el mensaje';
    end if;
  end if;

  insert into private.intentos_generacion_ia (
    id,
    tipo_entidad,
    entidad_id,
    handler,
    payload_version,
    contexto,
    tipo_conversacion,
    conversacion_id,
    mensaje_id,
    usuario_id,
    estado,
    solicitud,
    modo_referencias,
    consulta_referencias,
    referencias,
    token_reclamacion,
    reclamado_por,
    reclamado_hasta,
    intentos
  ) values (
    p_intento_id,
    p_tipo_entidad,
    p_entidad_id,
    p_handler,
    p_payload_version,
    p_contexto,
    v_tipo_conversacion,
    v_conversacion_id,
    v_mensaje_id,
    v_usuario_id,
    'reclamado',
    p_solicitud,
    p_modo_referencias,
    coalesce(p_consulta_referencias, ''),
    p_referencias,
    gen_random_uuid(),
    p_actor,
    now() + interval '2 minutes',
    1
  );

  return private.intento_generacion_ia_json(p_intento_id);
end;
$$;


ALTER FUNCTION "public"."preparar_intento_generacion_ia"("p_intento_id" "uuid", "p_tipo_entidad" "public"."tipo_trabajo_generacion_ia", "p_entidad_id" "uuid", "p_handler" "text", "p_payload_version" integer, "p_contexto" "jsonb", "p_solicitud" "jsonb", "p_modo_referencias" "text", "p_consulta_referencias" "text", "p_referencias" "jsonb", "p_actor" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."preparar_intento_generacion_ia"("p_intento_id" "uuid", "p_tipo_entidad" "public"."tipo_trabajo_generacion_ia", "p_entidad_id" "uuid", "p_handler" "text", "p_payload_version" integer, "p_contexto" "jsonb", "p_solicitud" "jsonb", "p_modo_referencias" "text", "p_consulta_referencias" "text", "p_referencias" "jsonb", "p_actor" "text") IS 'Prepara un intento versionado, serializa por entidad y vuelve obsoleto cualquier intento activo anterior.';



CREATE OR REPLACE FUNCTION "public"."preparar_intento_recursos_ia"("p_intento_id" "uuid", "p_generation_job_id" "uuid", "p_usuario_id" "uuid", "p_contexto" "jsonb", "p_solicitud" "jsonb", "p_modo_referencias" "text" DEFAULT 'none'::"text", "p_consulta_referencias" "text" DEFAULT ''::"text", "p_referencias" "jsonb" DEFAULT '[]'::"jsonb", "p_actor" "text" DEFAULT 'learning-object-generate'::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $_$
declare
  v_job public.learning_generation_jobs;
  v_intento jsonb;
  v_context_job_id uuid;
  v_context_user_id uuid;
  v_context_asignatura_id uuid;
begin
  if p_intento_id is null
     or p_generation_job_id is null
     or p_usuario_id is null then
    raise exception using
      errcode = '22023',
      message = 'intento, job y usuario son requeridos';
  end if;
  if jsonb_typeof(coalesce(p_contexto, 'null'::jsonb)) <> 'object'
     or jsonb_typeof(coalesce(p_solicitud, 'null'::jsonb)) <> 'object'
     or nullif(btrim(p_solicitud ->> 'model'), '') is null
     or jsonb_typeof(p_solicitud -> 'input') <> 'array'
     or p_solicitud #>> '{metadata,generation_attempt_id}'
       is distinct from p_intento_id::text then
    raise exception using
      errcode = '22023',
      message = 'el payload durable de recursos no es válido';
  end if;
  if jsonb_path_exists(p_solicitud, '$.**.file_data')
     or jsonb_path_exists(p_solicitud, '$.**.image_url') then
    raise exception using
      errcode = '22023',
      message = 'el outbox no admite binarios ni data URLs';
  end if;

  begin
    v_context_job_id := (p_contexto ->> 'jobId')::uuid;
    v_context_user_id := (p_contexto ->> 'userId')::uuid;
    v_context_asignatura_id := (p_contexto ->> 'asignaturaId')::uuid;
  exception when invalid_text_representation or null_value_not_allowed then
    raise exception using
      errcode = '22023',
      message = 'el contexto durable de recursos no es válido';
  end;
  if v_context_job_id is distinct from p_generation_job_id
     or v_context_user_id is distinct from p_usuario_id then
    raise exception using
      errcode = '22023',
      message = 'el contexto durable no corresponde al job y usuario';
  end if;

  select j.* into v_job
  from public.learning_generation_jobs j
  where j.id = p_generation_job_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'job de recursos no encontrado';
  end if;
  if v_job.creado_por is distinct from p_usuario_id then
    raise exception using errcode = '42501', message = 'el usuario no creó el job de recursos';
  end if;
  if v_job.asignatura_id is distinct from v_context_asignatura_id then
    raise exception using errcode = '22023', message = 'la asignatura no corresponde al job';
  end if;
  if v_job.openai_response_id is not null
     or v_job.estado not in ('queued', 'running') then
    raise exception using
      errcode = '55000',
      message = 'el job de recursos ya no admite un intento remoto';
  end if;

  v_intento := public.preparar_intento_generacion_ia(
    p_intento_id,
    'recursos_aprendizaje',
    p_generation_job_id,
    'learning-resources',
    1,
    p_contexto,
    p_solicitud,
    p_modo_referencias,
    coalesce(p_consulta_referencias, ''),
    p_referencias,
    p_actor
  );

  if v_intento ->> 'id' is distinct from p_intento_id::text
     or v_intento ->> 'handler' is distinct from 'learning-resources'
     or v_intento ->> 'entidad_id' is distinct from p_generation_job_id::text then
    raise exception using
      errcode = '55000',
      message = 'no se pudo preparar el intento durable de recursos';
  end if;

  update public.learning_generation_jobs
  set intento_generacion_activo_id = p_intento_id,
      error = null
  where id = p_generation_job_id;

  return v_intento;
end;
$_$;


ALTER FUNCTION "public"."preparar_intento_recursos_ia"("p_intento_id" "uuid", "p_generation_job_id" "uuid", "p_usuario_id" "uuid", "p_contexto" "jsonb", "p_solicitud" "jsonb", "p_modo_referencias" "text", "p_consulta_referencias" "text", "p_referencias" "jsonb", "p_actor" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."propiedad_restriccion_estados"("p_prop" "jsonb") RETURNS "text"[]
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO 'public', 'private', 'auth', 'extensions', 'pg_temp'
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
    SET "search_path" TO 'public', 'private', 'auth', 'extensions', 'pg_temp'
    AS $$
  SELECT COALESCE(
    NULLIF(btrim(p_prop #>> ARRAY['x-acad-ia', 'restriccion', 'permiso_edicion']), ''),
    'planes.campos_restringidos.editar'
  );
$$;


ALTER FUNCTION "public"."propiedad_restriccion_permiso"("p_prop" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."propiedad_tiene_restriccion"("p_prop" "jsonb") RETURNS boolean
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO 'public', 'private', 'auth', 'extensions', 'pg_temp'
    AS $$
  SELECT jsonb_typeof(p_prop #> ARRAY['x-acad-ia', 'restriccion']) = 'object';
$$;


ALTER FUNCTION "public"."propiedad_tiene_restriccion"("p_prop" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."publicar_generacion_recursos_ia"("p_generation_job_id" "uuid", "p_usuario_id" "uuid", "p_openai_response_id" "text", "p_estado_local" "public"."learning_generation_estado" DEFAULT 'running'::"public"."learning_generation_estado", "p_estado_openai" "text" DEFAULT 'queued'::"text", "p_iniciado_en" timestamp with time zone DEFAULT "now"(), "p_metadata" "jsonb" DEFAULT '{}'::"jsonb", "p_modo_referencias" "text" DEFAULT 'none'::"text", "p_consulta_referencias" "text" DEFAULT ''::"text", "p_referencias" "jsonb" DEFAULT '[]'::"jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_job public.learning_generation_jobs;
  v_trabajo public.trabajos_generacion_ia;
  v_response_id text := nullif(btrim(p_openai_response_id), '');
  v_tenant_id uuid;
  v_referencia jsonb;
  v_file_id uuid;
  v_file_version_id uuid;
  v_chunk_ids uuid[];
  v_scores jsonb;
  v_conteo_referencias integer;
begin
  if p_generation_job_id is null
     or p_usuario_id is null
     or v_response_id is null then
    raise exception using
      errcode = '22023',
      message = 'job, usuario y response_id son requeridos';
  end if;
  if p_estado_local not in ('queued', 'running') then
    raise exception using
      errcode = '22023',
      message = 'estado local de publicación no válido';
  end if;
  if nullif(btrim(p_estado_openai), '') is null then
    raise exception using errcode = '22023', message = 'estado_openai es requerido';
  end if;
  if jsonb_typeof(coalesce(p_metadata, '{}'::jsonb)) <> 'object' then
    raise exception using errcode = '22023', message = 'metadata debe ser un objeto JSON';
  end if;
  if jsonb_typeof(coalesce(p_referencias, '[]'::jsonb)) <> 'array' then
    raise exception using errcode = '22023', message = 'referencias debe ser un arreglo JSON';
  end if;
  v_conteo_referencias := jsonb_array_length(p_referencias);
  if v_conteo_referencias > 5 then
    raise exception using errcode = '22023', message = 'se permiten como máximo cinco referencias';
  end if;
  if p_modo_referencias not in ('none', 'direct', 'retrieval') then
    raise exception using errcode = '22023', message = 'modo de referencias no válido';
  end if;
  if (p_modo_referencias = 'none') <> (v_conteo_referencias = 0) then
    raise exception using
      errcode = '22023',
      message = 'el modo none requiere cero referencias y los demás modos requieren al menos una';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(p_referencias) as r(value)
    group by r.value ->> 'fileVersionId'
    having count(*) > 1
  ) then
    raise exception using errcode = '22023', message = 'hay versiones documentales duplicadas';
  end if;

  -- Respeta el orden del finalizador: trabajo global, lock de entidad y job.
  perform t.id
  from public.trabajos_generacion_ia t
  where t.openai_response_id = v_response_id
  for update;
  perform pg_advisory_xact_lock(
    hashtextextended(
      'recursos_aprendizaje:' || p_generation_job_id::text,
      0
    )
  );

  select j.* into v_job
  from public.learning_generation_jobs j
  where j.id = p_generation_job_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'job de recursos no encontrado';
  end if;
  if v_job.creado_por is distinct from p_usuario_id then
    raise exception using errcode = '42501', message = 'el usuario no creó el job de recursos';
  end if;
  if v_job.openai_response_id is not null
     and v_job.openai_response_id <> v_response_id then
    raise exception using
      errcode = '55000',
      message = 'el job de recursos ya apunta a otra respuesta de OpenAI';
  end if;
  if v_job.openai_response_id is null then
    if v_job.estado not in ('queued', 'running') then
      raise exception using
        errcode = '55000',
        message = 'el job de recursos ya no admite publicar una respuesta';
    end if;
    update public.learning_generation_jobs
    set estado = p_estado_local,
        openai_response_id = v_response_id,
        error = null
    where id = v_job.id
    returning * into v_job;
  end if;

  select tm.tenant_id into v_tenant_id
  from public.tenant_memberships tm
  where tm.user_id = p_usuario_id
    and tm.is_default
  limit 1;
  if v_tenant_id is null then
    raise exception using
      errcode = '42501',
      message = 'el usuario no tiene tenant documental predeterminado';
  end if;

  v_trabajo := public.registrar_trabajo_generacion_ia(
    'recursos_aprendizaje',
    v_job.id,
    v_response_id,
    p_estado_openai,
    coalesce(p_iniciado_en, now()),
    coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object(
      'initiatedBy', p_usuario_id,
      'learningGenerationJobId', v_job.id,
      'publishedAtomically', true
    )
  );

  if v_trabajo.id is null
     or v_trabajo.tipo_entidad <> 'recursos_aprendizaje'
     or v_trabajo.entidad_id <> v_job.id
     or v_trabajo.openai_response_id <> v_response_id then
    raise exception using
      errcode = '55000',
      message = 'no se pudo adoptar el trabajo global de recursos';
  end if;

  for v_referencia in
    select value from jsonb_array_elements(p_referencias)
  loop
    if jsonb_typeof(v_referencia) <> 'object'
       or jsonb_typeof(v_referencia -> 'chunkIds') <> 'array'
       or jsonb_typeof(v_referencia -> 'scores') <> 'object' then
      raise exception using errcode = '22023', message = 'referencia documental no válida';
    end if;
    begin
      v_file_id := (v_referencia ->> 'fileId')::uuid;
      v_file_version_id := (v_referencia ->> 'fileVersionId')::uuid;
      select coalesce(array_agg(chunk_id), '{}'::uuid[])
      into v_chunk_ids
      from (
        select jsonb_array_elements_text(v_referencia -> 'chunkIds')::uuid as chunk_id
      ) parsed_chunks;
    exception when invalid_text_representation or null_value_not_allowed then
      raise exception using errcode = '22023', message = 'identificador documental no válido';
    end;
    if v_file_id is null or v_file_version_id is null then
      raise exception using errcode = '22023', message = 'identificador documental no válido';
    end if;
    v_scores := v_referencia -> 'scores';
    if exists (
      select 1 from jsonb_each(v_scores) score where jsonb_typeof(score.value) <> 'number'
    ) then
      raise exception using errcode = '22023', message = 'los puntajes documentales deben ser numéricos';
    end if;

    if not exists (
      select 1
      from public.file_versions fv
      join public.files f on f.id = fv.file_id
      where fv.id = v_file_version_id
        and fv.file_id = v_file_id
        and fv.tenant_id = v_tenant_id
        and f.tenant_id = v_tenant_id
        and f.deleted_at is null
    ) then
      raise exception using
        errcode = '23503',
        message = 'la versión documental no pertenece al archivo y tenant indicados';
    end if;
    if p_modo_referencias = 'direct'
       and (cardinality(v_chunk_ids) <> 0 or v_scores <> '{}'::jsonb) then
      raise exception using
        errcode = '22023',
        message = 'una referencia directa no contiene chunks ni puntajes';
    end if;
    if p_modo_referencias = 'retrieval'
       and cardinality(v_chunk_ids) = 0 then
      raise exception using
        errcode = '22023',
        message = 'una referencia recuperada requiere chunks';
    end if;
    if cardinality(v_chunk_ids) <> (
      select count(distinct chunk_id)
      from unnest(v_chunk_ids) chunk_id
    ) then
      raise exception using errcode = '22023', message = 'hay chunks documentales duplicados';
    end if;
    if p_modo_referencias = 'retrieval' and (
      (select count(*) from jsonb_object_keys(v_scores)) <> cardinality(v_chunk_ids)
      or exists (
        select 1
        from unnest(v_chunk_ids) chunk_id
        where not (v_scores ? chunk_id::text)
      )
    ) then
      raise exception using
        errcode = '22023',
        message = 'los puntajes no corresponden a los chunks recuperados';
    end if;
    if exists (
      select 1
      from unnest(v_chunk_ids) chunk_id
      left join public.document_chunks dc
        on dc.id = chunk_id
       and dc.file_version_id = v_file_version_id
       and dc.tenant_id = v_tenant_id
      where dc.id is null
    ) then
      raise exception using
        errcode = '23503',
        message = 'un chunk no pertenece a la versión documental';
    end if;

    insert into public.ai_request_references (
      tenant_id,
      request_id,
      conversation_type,
      conversation_id,
      message_type,
      message_id,
      file_id,
      file_version_id,
      mode,
      chunk_ids,
      retrieval_query,
      retrieval_scores
    ) values (
      v_tenant_id,
      v_response_id,
      'asignatura',
      v_job.asignatura_id,
      'asignatura',
      null,
      v_file_id,
      v_file_version_id,
      p_modo_referencias,
      v_chunk_ids,
      case when p_modo_referencias = 'retrieval' then p_consulta_referencias else null end,
      v_scores
    )
    on conflict (request_id, file_version_id, mode) do nothing;

    if not exists (
      select 1
      from public.ai_request_references ar
      where ar.request_id = v_response_id
        and ar.conversation_type = 'asignatura'
        and ar.conversation_id = v_job.asignatura_id
        and ar.message_type = 'asignatura'
        and ar.message_id is null
        and ar.tenant_id = v_tenant_id
        and ar.file_id = v_file_id
        and ar.file_version_id = v_file_version_id
        and ar.mode = p_modo_referencias
        and ar.chunk_ids = v_chunk_ids
        and ar.retrieval_query is not distinct from (
          case when p_modo_referencias = 'retrieval' then p_consulta_referencias else null end
        )
        and ar.retrieval_scores = v_scores
    ) then
      raise exception using
        errcode = '55000',
        message = 'el response_id ya tiene una referencia documental diferente';
    end if;
  end loop;

  if (
    select count(*)
    from public.ai_request_references ar
    where ar.request_id = v_response_id
  ) <> v_conteo_referencias then
    raise exception using
      errcode = '55000',
      message = 'el response_id contiene un conjunto de referencias diferente';
  end if;

  return jsonb_build_object(
    'resolution', 'published',
    'localJob', to_jsonb(v_job),
    'globalJob', to_jsonb(v_trabajo)
  );
end;
$$;


ALTER FUNCTION "public"."publicar_generacion_recursos_ia"("p_generation_job_id" "uuid", "p_usuario_id" "uuid", "p_openai_response_id" "text", "p_estado_local" "public"."learning_generation_estado", "p_estado_openai" "text", "p_iniciado_en" timestamp with time zone, "p_metadata" "jsonb", "p_modo_referencias" "text", "p_consulta_referencias" "text", "p_referencias" "jsonb") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."publicar_generacion_recursos_ia"("p_generation_job_id" "uuid", "p_usuario_id" "uuid", "p_openai_response_id" "text", "p_estado_local" "public"."learning_generation_estado", "p_estado_openai" "text", "p_iniciado_en" timestamp with time zone, "p_metadata" "jsonb", "p_modo_referencias" "text", "p_consulta_referencias" "text", "p_referencias" "jsonb") IS 'Publica job local, trabajo global y snapshot documental de recursos en una sola transacción idempotente.';



CREATE OR REPLACE FUNCTION "public"."publicar_intento_chat_ia"("p_intento_id" "uuid", "p_token_reclamacion" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_intento private.intentos_chat_ia;
begin
  select * into v_intento
  from private.intentos_chat_ia i
  where i.id = p_intento_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'intento de chat no encontrado';
  end if;
  if v_intento.estado = 'publicado' then
    return private.publicar_intento_chat_ia_interno(p_intento_id);
  end if;
  if p_token_reclamacion is null
     or v_intento.token_reclamacion is distinct from p_token_reclamacion
     or v_intento.reclamado_hasta <= now() then
    return jsonb_build_object(
      'resolution', 'claimed_elsewhere',
      'attempt', private.intento_chat_ia_json(p_intento_id)
    );
  end if;
  return private.publicar_intento_chat_ia_interno(p_intento_id);
end;
$$;


ALTER FUNCTION "public"."publicar_intento_chat_ia"("p_intento_id" "uuid", "p_token_reclamacion" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."publicar_intento_chat_ia"("p_intento_id" "uuid", "p_token_reclamacion" "uuid") IS 'Publica mensaje, trabajo, referencias e intento en una sola transacción verificando el arrendamiento.';



CREATE OR REPLACE FUNCTION "public"."publicar_intento_entidad_ia"("p_intento_id" "uuid", "p_token_reclamacion" "uuid") RETURNS "jsonb"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select private.publicar_intento_entidad_ia_interno(
    p_intento_id,
    p_token_reclamacion,
    true,
    null,
    null,
    null
  );
$$;


ALTER FUNCTION "public"."publicar_intento_entidad_ia"("p_intento_id" "uuid", "p_token_reclamacion" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."publicar_intento_entidad_ia"("p_intento_id" "uuid", "p_token_reclamacion" "uuid") IS 'Publica response_id, trabajo global, referencias y outbox con CAS de intento y arrendamiento.';



CREATE OR REPLACE FUNCTION "public"."publicar_intento_recursos_ia"("p_intento_id" "uuid", "p_token_reclamacion" "uuid", "p_generation_job_id" "uuid", "p_usuario_id" "uuid", "p_openai_response_id" "text", "p_estado_local" "public"."learning_generation_estado" DEFAULT 'running'::"public"."learning_generation_estado", "p_estado_openai" "text" DEFAULT 'queued'::"text", "p_iniciado_en" timestamp with time zone DEFAULT "now"(), "p_metadata" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_intento private.intentos_generacion_ia;
  v_job public.learning_generation_jobs;
  v_publicacion jsonb;
  v_marcado boolean;
  v_response_id text := nullif(btrim(p_openai_response_id), '');
begin
  if p_intento_id is null
     or p_generation_job_id is null
     or p_usuario_id is null
     or v_response_id is null then
    raise exception using
      errcode = '22023',
      message = 'intento, job, usuario y response_id son requeridos';
  end if;

  select i.* into v_intento
  from private.intentos_generacion_ia i
  where i.id = p_intento_id
  for update;
  if not found then
    return jsonb_build_object('resolution', 'stale', 'attempt', null);
  end if;
  if v_intento.handler <> 'learning-resources'
     or v_intento.payload_version <> 1
     or v_intento.tipo_entidad <> 'recursos_aprendizaje'
     or v_intento.entidad_id <> p_generation_job_id then
    return jsonb_build_object(
      'resolution', 'stale',
      'attempt', private.intento_generacion_ia_json(p_intento_id)
    );
  end if;

  select j.* into v_job
  from public.learning_generation_jobs j
  where j.id = p_generation_job_id
  for update;
  if not found
     or v_job.intento_generacion_activo_id is distinct from p_intento_id then
    return jsonb_build_object(
      'resolution', 'claimed_elsewhere',
      'attempt', private.intento_generacion_ia_json(p_intento_id)
    );
  end if;
  if v_job.creado_por is distinct from p_usuario_id
     or v_intento.contexto ->> 'userId' is distinct from p_usuario_id::text then
    raise exception using errcode = '42501', message = 'el usuario no corresponde al intento';
  end if;
  if v_intento.openai_response_id is distinct from v_response_id then
    return jsonb_build_object(
      'resolution', 'claimed_elsewhere',
      'attempt', private.intento_generacion_ia_json(p_intento_id),
      'winnerResponseId', v_intento.openai_response_id
    );
  end if;
  if v_intento.estado = 'publicado' then
    return jsonb_build_object(
      'resolution', 'already_applied',
      'attempt', private.intento_generacion_ia_json(p_intento_id),
      'localJob', to_jsonb(v_job),
      'globalJob', (
        select to_jsonb(t)
        from public.trabajos_generacion_ia t
        where t.openai_response_id = v_response_id
      )
    );
  end if;
  if v_intento.estado in ('fallido', 'expirado', 'obsoleto') then
    return jsonb_build_object(
      'resolution', 'stale',
      'attempt', private.intento_generacion_ia_json(p_intento_id)
    );
  end if;
  if v_intento.estado <> 'respuesta_vinculada'
     or p_token_reclamacion is null
     or v_intento.token_reclamacion is distinct from p_token_reclamacion
     or v_intento.reclamado_hasta <= now() then
    return jsonb_build_object(
      'resolution', 'claimed_elsewhere',
      'attempt', private.intento_generacion_ia_json(p_intento_id)
    );
  end if;

  v_publicacion := public.publicar_generacion_recursos_ia(
    p_generation_job_id,
    p_usuario_id,
    v_response_id,
    p_estado_local,
    p_estado_openai,
    p_iniciado_en,
    coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object(
      'generation_attempt_id', p_intento_id,
      'handler', 'learning-resources'
    ),
    v_intento.modo_referencias,
    v_intento.consulta_referencias,
    v_intento.referencias
  );

  v_marcado := public.marcar_intento_generacion_ia_publicado(
    p_intento_id,
    p_token_reclamacion
  );
  if not v_marcado then
    raise exception using
      errcode = '55000',
      message = 'el lease del intento venció antes de publicar';
  end if;

  return jsonb_build_object(
    'resolution', 'applied',
    'attempt', private.intento_generacion_ia_json(p_intento_id),
    'localJob', v_publicacion -> 'localJob',
    'globalJob', v_publicacion -> 'globalJob'
  );
end;
$$;


ALTER FUNCTION "public"."publicar_intento_recursos_ia"("p_intento_id" "uuid", "p_token_reclamacion" "uuid", "p_generation_job_id" "uuid", "p_usuario_id" "uuid", "p_openai_response_id" "text", "p_estado_local" "public"."learning_generation_estado", "p_estado_openai" "text", "p_iniciado_en" timestamp with time zone, "p_metadata" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."publicar_solicitud_chat_ia"("p_tipo_conversacion" "public"."tipo_conversacion_documental", "p_conversacion_id" "uuid", "p_mensaje_id" "uuid", "p_usuario_id" "uuid", "p_openai_response_id" "text", "p_estado_openai" "text" DEFAULT 'queued'::"text", "p_iniciado_en" timestamp with time zone DEFAULT "now"(), "p_metadata" "jsonb" DEFAULT '{}'::"jsonb", "p_modo_referencias" "text" DEFAULT 'none'::"text", "p_consulta_referencias" "text" DEFAULT ''::"text", "p_referencias" "jsonb" DEFAULT '[]'::"jsonb") RETURNS "public"."trabajos_generacion_ia"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_tipo_trabajo public.tipo_trabajo_generacion_ia;
  v_conversacion_actual uuid;
  v_autor_actual uuid;
  v_estado_actual public.estado_mensaje_ia;
  v_response_actual text;
  v_response_id text := nullif(btrim(p_openai_response_id), '');
  v_tenant_id uuid;
  v_referencia jsonb;
  v_file_id uuid;
  v_file_version_id uuid;
  v_chunk_ids uuid[];
  v_scores jsonb;
  v_conteo_referencias integer := jsonb_array_length(
    case when jsonb_typeof(p_referencias) = 'array' then p_referencias else '[]'::jsonb end
  );
  v_trabajo public.trabajos_generacion_ia;
begin
  if p_conversacion_id is null
     or p_mensaje_id is null
     or p_usuario_id is null
     or v_response_id is null then
    raise exception using
      errcode = '22023',
      message = 'conversación, mensaje, usuario y response_id son requeridos';
  end if;
  if nullif(btrim(p_estado_openai), '') is null then
    raise exception using errcode = '22023', message = 'estado_openai es requerido';
  end if;
  if jsonb_typeof(coalesce(p_metadata, '{}'::jsonb)) <> 'object' then
    raise exception using errcode = '22023', message = 'metadata debe ser un objeto JSON';
  end if;
  if jsonb_typeof(coalesce(p_referencias, '[]'::jsonb)) <> 'array' then
    raise exception using errcode = '22023', message = 'referencias debe ser un arreglo JSON';
  end if;
  if p_modo_referencias not in ('none', 'direct', 'retrieval') then
    raise exception using errcode = '22023', message = 'modo de referencias no válido';
  end if;
  if (p_modo_referencias = 'none') <> (v_conteo_referencias = 0) then
    raise exception using
      errcode = '22023',
      message = 'el modo none requiere cero referencias y los demás modos requieren al menos una';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(p_referencias) as r(value)
    group by r.value ->> 'fileVersionId'
    having count(*) > 1
  ) then
    raise exception using errcode = '22023', message = 'hay versiones documentales duplicadas';
  end if;

  if p_tipo_conversacion = 'plan' then
    select
      m.conversacion_plan_id,
      m.enviado_por,
      m.estado,
      m.openai_response_id
    into
      v_conversacion_actual,
      v_autor_actual,
      v_estado_actual,
      v_response_actual
    from public.plan_mensajes_ia m
    where m.id = p_mensaje_id
    for update;
    v_tipo_trabajo := 'chat_plan';
  elsif p_tipo_conversacion = 'asignatura' then
    select
      m.conversacion_asignatura_id,
      m.enviado_por,
      m.estado,
      m.openai_response_id
    into
      v_conversacion_actual,
      v_autor_actual,
      v_estado_actual,
      v_response_actual
    from public.asignatura_mensajes_ia m
    where m.id = p_mensaje_id
    for update;
    v_tipo_trabajo := 'chat_asignatura';
  else
    raise exception using errcode = '22023', message = 'tipo de conversación no válido';
  end if;

  if not found then
    raise exception using errcode = 'P0002', message = 'mensaje de chat no encontrado';
  end if;
  if v_conversacion_actual is distinct from p_conversacion_id then
    raise exception using errcode = '22023', message = 'el mensaje no pertenece a la conversación indicada';
  end if;
  if v_autor_actual is distinct from p_usuario_id then
    raise exception using errcode = '42501', message = 'el usuario no es autor del mensaje';
  end if;
  if v_estado_actual <> 'PROCESANDO' then
    raise exception using errcode = '55000', message = 'el mensaje ya no está procesando';
  end if;
  if v_response_actual is not null and v_response_actual <> v_response_id then
    raise exception using
      errcode = '55000',
      message = 'el mensaje ya apunta a otra respuesta de OpenAI';
  end if;

  select tm.tenant_id
  into v_tenant_id
  from public.tenant_memberships tm
  where tm.user_id = p_usuario_id
    and tm.is_default
  limit 1;
  if v_tenant_id is null then
    raise exception using errcode = '42501', message = 'el usuario no tiene tenant documental predeterminado';
  end if;

  if p_tipo_conversacion = 'plan' then
    update public.plan_mensajes_ia
    set openai_response_id = v_response_id,
        fecha_actualizacion = now()
    where id = p_mensaje_id;
  else
    update public.asignatura_mensajes_ia
    set openai_response_id = v_response_id,
        fecha_actualizacion = now()
    where id = p_mensaje_id;
  end if;

  v_trabajo := public.registrar_trabajo_generacion_ia(
    v_tipo_trabajo,
    p_mensaje_id,
    v_response_id,
    p_estado_openai,
    coalesce(p_iniciado_en, now()),
    coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object(
      'initiatedBy', p_usuario_id,
      'publishedAtomically', true
    )
  );

  for v_referencia in
    select value from jsonb_array_elements(p_referencias)
  loop
    if jsonb_typeof(v_referencia) <> 'object'
       or jsonb_typeof(v_referencia -> 'chunkIds') <> 'array'
       or jsonb_typeof(v_referencia -> 'scores') <> 'object' then
      raise exception using errcode = '22023', message = 'referencia documental no válida';
    end if;

    begin
      v_file_id := (v_referencia ->> 'fileId')::uuid;
      v_file_version_id := (v_referencia ->> 'fileVersionId')::uuid;
      select coalesce(array_agg(chunk_id), '{}'::uuid[])
      into v_chunk_ids
      from (
        select jsonb_array_elements_text(v_referencia -> 'chunkIds')::uuid as chunk_id
      ) parsed_chunks;
    exception when invalid_text_representation or null_value_not_allowed then
      raise exception using errcode = '22023', message = 'identificador documental no válido';
    end;
    if v_file_id is null or v_file_version_id is null then
      raise exception using errcode = '22023', message = 'identificador documental no válido';
    end if;
    v_scores := v_referencia -> 'scores';

    if not exists (
      select 1
      from public.file_versions fv
      join public.files f on f.id = fv.file_id
      where fv.id = v_file_version_id
        and fv.file_id = v_file_id
        and fv.tenant_id = v_tenant_id
        and f.tenant_id = v_tenant_id
        and f.deleted_at is null
    ) then
      raise exception using
        errcode = '23503',
        message = 'la versión documental no pertenece al archivo y tenant indicados';
    end if;

    if p_modo_referencias = 'direct' and cardinality(v_chunk_ids) <> 0 then
      raise exception using errcode = '22023', message = 'una referencia directa no contiene chunks';
    end if;
    if p_modo_referencias = 'retrieval' and cardinality(v_chunk_ids) = 0 then
      raise exception using errcode = '22023', message = 'una referencia recuperada requiere chunks';
    end if;
    if exists (
      select 1
      from unnest(v_chunk_ids) chunk_id
      left join public.document_chunks dc
        on dc.id = chunk_id
       and dc.file_version_id = v_file_version_id
       and dc.tenant_id = v_tenant_id
      where dc.id is null
    ) then
      raise exception using errcode = '23503', message = 'un chunk no pertenece a la versión documental';
    end if;

    insert into public.ai_request_references (
      tenant_id,
      request_id,
      conversation_type,
      conversation_id,
      message_type,
      message_id,
      file_id,
      file_version_id,
      mode,
      chunk_ids,
      retrieval_query,
      retrieval_scores
    ) values (
      v_tenant_id,
      v_response_id,
      p_tipo_conversacion,
      p_conversacion_id,
      p_tipo_conversacion,
      p_mensaje_id,
      v_file_id,
      v_file_version_id,
      p_modo_referencias,
      v_chunk_ids,
      case when p_modo_referencias = 'retrieval' then p_consulta_referencias else null end,
      v_scores
    )
    on conflict (request_id, file_version_id, mode) do nothing;

    if not exists (
      select 1
      from public.ai_request_references ar
      where ar.request_id = v_response_id
        and ar.conversation_type = p_tipo_conversacion
        and ar.conversation_id = p_conversacion_id
        and ar.message_type = p_tipo_conversacion
        and ar.message_id = p_mensaje_id
        and ar.tenant_id = v_tenant_id
        and ar.file_id = v_file_id
        and ar.file_version_id = v_file_version_id
        and ar.mode = p_modo_referencias
        and ar.chunk_ids = v_chunk_ids
        and ar.retrieval_query is not distinct from (
          case when p_modo_referencias = 'retrieval' then p_consulta_referencias else null end
        )
        and ar.retrieval_scores = v_scores
    ) then
      raise exception using
        errcode = '55000',
        message = 'el response_id ya tiene una referencia documental diferente';
    end if;

    insert into public.conversation_files (
      tenant_id,
      conversation_type,
      conversation_id,
      file_id,
      added_by,
      removed_at
    ) values (
      v_tenant_id,
      p_tipo_conversacion,
      p_conversacion_id,
      v_file_id,
      p_usuario_id,
      null
    )
    on conflict (conversation_type, conversation_id, file_id) do update
    set tenant_id = excluded.tenant_id,
        added_by = excluded.added_by,
        removed_at = null;
  end loop;

  if (
    select count(*)
    from public.ai_request_references ar
    where ar.request_id = v_response_id
  ) <> v_conteo_referencias then
    raise exception using
      errcode = '55000',
      message = 'el response_id contiene un conjunto de referencias diferente';
  end if;

  return v_trabajo;
end;
$$;


ALTER FUNCTION "public"."publicar_solicitud_chat_ia"("p_tipo_conversacion" "public"."tipo_conversacion_documental", "p_conversacion_id" "uuid", "p_mensaje_id" "uuid", "p_usuario_id" "uuid", "p_openai_response_id" "text", "p_estado_openai" "text", "p_iniciado_en" timestamp with time zone, "p_metadata" "jsonb", "p_modo_referencias" "text", "p_consulta_referencias" "text", "p_referencias" "jsonb") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."publicar_solicitud_chat_ia"("p_tipo_conversacion" "public"."tipo_conversacion_documental", "p_conversacion_id" "uuid", "p_mensaje_id" "uuid", "p_usuario_id" "uuid", "p_openai_response_id" "text", "p_estado_openai" "text", "p_iniciado_en" timestamp with time zone, "p_metadata" "jsonb", "p_modo_referencias" "text", "p_consulta_referencias" "text", "p_referencias" "jsonb") IS 'Publica response_id, trabajo y snapshot documental de un chat en una sola transacción.';



CREATE OR REPLACE FUNCTION "public"."puede_usar_carga_documental_temporal"("p_object_name" "text", "p_incluir_subido" boolean DEFAULT false) RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select exists (
    select 1
    from public.upload_sessions s
    where s.user_id = (select auth.uid())
      and s.temporary_path = p_object_name
      and (
        s.status in ('created', 'uploading')
        or (p_incluir_subido and s.status = 'uploaded')
      )
      and s.expires_at > now()
  )
$$;


ALTER FUNCTION "public"."puede_usar_carga_documental_temporal"("p_object_name" "text", "p_incluir_subido" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."purgar_trabajos_generacion_ia"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_total integer;
begin
  delete from public.trabajos_generacion_ia
  where estado in (
      'completado', 'fallido', 'cancelado', 'incompleto', 'expirado', 'obsoleto'
    )
    and completado_en < now() - interval '90 days';
  get diagnostics v_total = row_count;
  return v_total;
end;
$$;


ALTER FUNCTION "public"."purgar_trabajos_generacion_ia"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reasignar_responsabilidades"("p_origen" "uuid", "p_destino" "uuid", "p_actor" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'private', 'auth', 'extensions', 'pg_temp'
    AS $$
declare
  v_destino_baja timestamptz;
  v_detalle jsonb;
begin
  if p_origen = p_destino then
    raise exception 'El origen y el destino no pueden ser el mismo usuario.'
      using errcode = 'P0409';
  end if;

  if not exists (select 1 from public.usuarios_app where id = p_origen) then
    raise exception 'Usuario origen no encontrado.' using errcode = 'P0404';
  end if;

  select dado_de_baja_en
  into v_destino_baja
  from public.usuarios_app
  where id = p_destino;

  if not found then
    raise exception 'Usuario destino no encontrado.' using errcode = 'P0404';
  end if;

  if v_destino_baja is not null then
    raise exception 'El usuario destino esta dado de baja.'
      using errcode = 'P0409';
  end if;

  if not public.usuario_puede_gestionar_usuario(p_actor, p_origen) then
    raise exception 'No tienes permisos para reasignar a este usuario.'
      using errcode = 'P0403';
  end if;

  if not public.usuario_puede_gestionar_usuario(p_actor, p_destino) then
    raise exception 'No tienes permisos para reemplazar responsabilidades del usuario destino.'
      using errcode = 'P0403';
  end if;

  v_detalle := jsonb_build_object(
    'origen_roles',
      (select coalesce(jsonb_agg(to_jsonb(ur)), '[]'::jsonb)
       from public.usuarios_roles ur
       where ur.usuario_id = p_origen),
    'origen_tareas',
      (select coalesce(jsonb_agg(t.id), '[]'::jsonb)
       from public.tareas_revision t
       where t.asignado_a = p_origen),
    'origen_responsables',
      (select coalesce(jsonb_agg(ra.id), '[]'::jsonb)
       from public.responsables_asignatura ra
       where ra.usuario_id = p_origen),
    'destino_roles_previos',
      (select coalesce(jsonb_agg(to_jsonb(ur)), '[]'::jsonb)
       from public.usuarios_roles ur
       where ur.usuario_id = p_destino),
    'destino_tareas_previas',
      (select coalesce(jsonb_agg(t.id), '[]'::jsonb)
       from public.tareas_revision t
       where t.asignado_a = p_destino),
    'destino_responsables_previos',
      (select coalesce(jsonb_agg(ra.id), '[]'::jsonb)
       from public.responsables_asignatura ra
       where ra.usuario_id = p_destino)
  );

  delete from public.usuarios_roles where usuario_id = p_destino;
  delete from public.tareas_revision where asignado_a = p_destino;
  delete from public.responsables_asignatura where usuario_id = p_destino;

  update public.usuarios_roles
  set usuario_id = p_destino,
      asignado_por = p_actor
  where usuario_id = p_origen;

  update public.tareas_revision
  set asignado_a = p_destino
  where asignado_a = p_origen;

  update public.responsables_asignatura
  set usuario_id = p_destino
  where usuario_id = p_origen;

  update public.usuarios_app
  set dado_de_baja_en = now()
  where id = p_origen;

  insert into public.reasignaciones (
    reasignado_por,
    usuario_origen,
    usuario_destino,
    detalle
  )
  values (p_actor, p_origen, p_destino, v_detalle);

  return jsonb_build_object(
    'origen', p_origen,
    'destino', p_destino,
    'reasignado_por', p_actor,
    'detalle', v_detalle
  );
end;
$$;


ALTER FUNCTION "public"."reasignar_responsabilidades"("p_origen" "uuid", "p_destino" "uuid", "p_actor" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."recalcular_learning_quality_scores"("p_asignatura_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'auth', 'extensions', 'pg_temp'
    AS $$
declare
    v_contenido jsonb;
    v_unidad jsonb;
    v_tema jsonb;
    v_unidad_id text;
    v_tema_id text;
    v_score int;
begin
    v_score := public.fn_calcular_score_preparacion(p_asignatura_id, null, null);
    insert into public.learning_quality_scores (asignatura_id, unidad_id, tema_id, score_total)
    values (p_asignatura_id, null, null, v_score)
    on conflict (asignatura_id, coalesce(unidad_id, ''), coalesce(tema_id, '')) do update
    set score_total = excluded.score_total, calculado_en = now();

    select contenido_tematico into v_contenido
    from public.asignaturas
    where id = p_asignatura_id;

    if v_contenido is null or jsonb_typeof(v_contenido) <> 'array' then
        return;
    end if;

    for i in 0..jsonb_array_length(v_contenido) - 1 loop
        v_unidad := v_contenido->i;
        v_unidad_id := v_unidad->>'id';
        if v_unidad_id is null or v_unidad_id = '' then
            continue;
        end if;

        v_score := public.fn_calcular_score_preparacion(p_asignatura_id, v_unidad_id, null);
        insert into public.learning_quality_scores (asignatura_id, unidad_id, tema_id, score_total)
        values (p_asignatura_id, v_unidad_id, null, v_score)
        on conflict (asignatura_id, coalesce(unidad_id, ''), coalesce(tema_id, '')) do update
        set score_total = excluded.score_total, calculado_en = now();

        if jsonb_typeof(v_unidad->'temas') = 'array' then
            for k in 0..jsonb_array_length(v_unidad->'temas') - 1 loop
                v_tema := (v_unidad->'temas')->k;
                v_tema_id := v_tema->>'id';
                if v_tema_id is null or v_tema_id = '' then
                    continue;
                end if;

                v_score := public.fn_calcular_score_preparacion(p_asignatura_id, v_unidad_id, v_tema_id);
                insert into public.learning_quality_scores (asignatura_id, unidad_id, tema_id, score_total)
                values (p_asignatura_id, v_unidad_id, v_tema_id, v_score)
                on conflict (asignatura_id, coalesce(unidad_id, ''), coalesce(tema_id, '')) do update
                set score_total = excluded.score_total, calculado_en = now();
            end loop;
        end if;
    end loop;
end;
$$;


ALTER FUNCTION "public"."recalcular_learning_quality_scores"("p_asignatura_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."recalcular_vectores_asignaturas"() RETURNS "void"
    LANGUAGE "sql"
    SET "search_path" TO 'public', 'private', 'auth', 'extensions', 'pg_temp'
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


CREATE OR REPLACE FUNCTION "public"."reclamar_intentos_chat_ia"("p_actor" "text", "p_limite" integer DEFAULT 5) RETURNS "jsonb"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select public.reclamar_intentos_generacion_ia('chat', p_actor, p_limite);
$$;


ALTER FUNCTION "public"."reclamar_intentos_chat_ia"("p_actor" "text", "p_limite" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reclamar_intentos_generacion_ia"("p_handler" "text", "p_actor" "text", "p_limite" integer DEFAULT 5) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_resultado jsonb;
begin
  if nullif(btrim(coalesce(p_handler, '')), '') is null
     or nullif(btrim(coalesce(p_actor, '')), '') is null then
    raise exception using errcode = '22023', message = 'handler y actor son requeridos';
  end if;
  with candidatas as (
    select i.id
    from private.intentos_generacion_ia i
    where i.handler = p_handler
      and i.estado in ('preparado', 'reclamado', 'respuesta_vinculada')
      and i.siguiente_intento <= now()
      and i.fecha_limite > now()
      and (
        i.estado = 'preparado'
        or i.reclamado_hasta is null
        or i.reclamado_hasta <= now()
      )
    order by i.siguiente_intento, i.creado_en
    for update skip locked
    limit greatest(1, least(coalesce(p_limite, 5), 20))
  ), reclamadas as (
    update private.intentos_generacion_ia i
    set estado = case
          when i.openai_response_id is null then 'reclamado'
          else 'respuesta_vinculada'
        end,
        token_reclamacion = gen_random_uuid(),
        reclamado_por = p_actor,
        reclamado_hasta = now() + interval '2 minutes',
        intentos = i.intentos + 1,
        actualizado_en = now()
    from candidatas c
    where i.id = c.id
    returning to_jsonb(i) as value
  )
  select coalesce(jsonb_agg(value), '[]'::jsonb)
  into v_resultado
  from reclamadas;
  return v_resultado;
end;
$$;


ALTER FUNCTION "public"."reclamar_intentos_generacion_ia"("p_handler" "text", "p_actor" "text", "p_limite" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reclamar_lote_trabajos_generacion_ia"("p_reclamado_por" "text", "p_limite" integer DEFAULT 20, "p_arrendamiento" interval DEFAULT '00:02:00'::interval) RETURNS SETOF "public"."trabajos_generacion_ia"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if nullif(btrim(p_reclamado_por), '') is null
     or p_limite < 1 or p_limite > 100
     or p_arrendamiento <= interval '0 seconds'
     or p_arrendamiento > interval '10 minutes' then
    raise exception using errcode = '22023', message = 'Lote de reclamación inválido';
  end if;

  return query
  with seleccionados as (
    select q.id
    from public.trabajos_generacion_ia q
    where q.fecha_limite > now()
      and (
        (q.estado = 'pendiente' and q.proxima_revision_en <= now())
        or (q.estado = 'reclamado' and q.reclamado_hasta <= now())
      )
    order by q.proxima_revision_en, q.creado_en
    limit p_limite
    for update skip locked
  )
  update public.trabajos_generacion_ia t
  set estado = 'reclamado',
      token_reclamacion = gen_random_uuid(),
      reclamado_por = p_reclamado_por,
      reclamado_hasta = now() + p_arrendamiento,
      intentos = t.intentos + 1
  from seleccionados s
  where t.id = s.id
  returning t.*;
end;
$$;


ALTER FUNCTION "public"."reclamar_lote_trabajos_generacion_ia"("p_reclamado_por" "text", "p_limite" integer, "p_arrendamiento" interval) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reclamar_trabajo_generacion_ia"("p_openai_response_id" "text", "p_reclamado_por" "text", "p_arrendamiento" interval DEFAULT '00:02:00'::interval) RETURNS "public"."trabajos_generacion_ia"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_trabajo public.trabajos_generacion_ia;
begin
  if nullif(btrim(p_reclamado_por), '') is null
     or p_arrendamiento <= interval '0 seconds'
     or p_arrendamiento > interval '10 minutes' then
    raise exception using errcode = '22023', message = 'Reclamación inválida';
  end if;

  update public.trabajos_generacion_ia t
  set estado = 'reclamado',
      token_reclamacion = gen_random_uuid(),
      reclamado_por = p_reclamado_por,
      reclamado_hasta = now() + p_arrendamiento,
      intentos = t.intentos + 1
  where t.id = (
    select q.id
    from public.trabajos_generacion_ia q
    where q.openai_response_id = p_openai_response_id
      and q.fecha_limite > now()
      and (
        q.estado = 'pendiente'
        or (q.estado = 'reclamado' and q.reclamado_hasta <= now())
      )
    for update skip locked
  )
  returning t.* into v_trabajo;

  return v_trabajo;
end;
$$;


ALTER FUNCTION "public"."reclamar_trabajo_generacion_ia"("p_openai_response_id" "text", "p_reclamado_por" "text", "p_arrendamiento" interval) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reclamar_trabajos_ingesta_documental"("p_worker" "text", "p_limite" integer DEFAULT 3, "p_arrendamiento" interval DEFAULT '00:02:00'::interval) RETURNS SETOF "public"."ingestion_jobs"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if nullif(btrim(p_worker), '') is null
     or p_limite not between 1 and 3
     or p_arrendamiento <= interval '0 seconds' then
    raise exception using errcode = '22023', message = 'Reclamación de trabajos inválida';
  end if;
  return query
  with seleccionados as (
    select j.id
    from public.ingestion_jobs j
    where ((j.status in ('pending', 'retry') and j.available_at <= now())
       or (j.status = 'processing' and j.locked_at + p_arrendamiento <= now()))
      and j.attempts < 5
    order by j.available_at, j.created_at
    limit p_limite
    for update skip locked
  )
  update public.ingestion_jobs j
  set status = 'processing', locked_at = now(), locked_by = p_worker,
      attempts = j.attempts + 1
  from seleccionados s
  where j.id = s.id
  returning j.*;
end;
$$;


ALTER FUNCTION "public"."reclamar_trabajos_ingesta_documental"("p_worker" "text", "p_limite" integer, "p_arrendamiento" interval) OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."observability_webhook_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_id" "text" NOT NULL,
    "event_type" "text" NOT NULL,
    "openai_response_id" "text",
    "test_run_id" "uuid",
    "received_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "signature_valid" boolean DEFAULT true NOT NULL,
    "payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "processing_status" "text" DEFAULT 'received'::"text" NOT NULL,
    "processing_error" "text",
    "delivery_count" integer DEFAULT 1 NOT NULL,
    "last_received_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "observability_webhook_events_delivery_count_check" CHECK (("delivery_count" > 0)),
    CONSTRAINT "observability_webhook_events_processing_status_check" CHECK (("processing_status" = ANY (ARRAY['received'::"text", 'processed'::"text", 'ignored'::"text", 'failed'::"text"])))
);

ALTER TABLE ONLY "public"."observability_webhook_events" REPLICA IDENTITY FULL;


ALTER TABLE "public"."observability_webhook_events" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."registrar_entrega_webhook_ia"("p_event_id" "text", "p_event_type" "text", "p_openai_response_id" "text", "p_test_run_id" "uuid", "p_payload" "jsonb") RETURNS "public"."observability_webhook_events"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_evento public.observability_webhook_events;
begin
  insert into public.observability_webhook_events (
    event_id,
    event_type,
    openai_response_id,
    test_run_id,
    received_at,
    last_received_at,
    delivery_count,
    signature_valid,
    payload,
    processing_status,
    processing_error
  ) values (
    p_event_id,
    p_event_type,
    p_openai_response_id,
    p_test_run_id,
    now(),
    now(),
    1,
    true,
    coalesce(p_payload, '{}'::jsonb),
    'received',
    null
  )
  on conflict (event_id) do update
  set last_received_at = now(),
      delivery_count = public.observability_webhook_events.delivery_count + 1,
      payload = excluded.payload,
      processing_status = 'received',
      processing_error = null
  returning * into v_evento;
  return v_evento;
end;
$$;


ALTER FUNCTION "public"."registrar_entrega_webhook_ia"("p_event_id" "text", "p_event_type" "text", "p_openai_response_id" "text", "p_test_run_id" "uuid", "p_payload" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."registrar_trabajo_generacion_ia"("p_tipo_entidad" "public"."tipo_trabajo_generacion_ia", "p_entidad_id" "uuid", "p_openai_response_id" "text", "p_estado_openai" "text" DEFAULT 'queued'::"text", "p_iniciado_en" timestamp with time zone DEFAULT "now"(), "p_metadata" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "public"."trabajos_generacion_ia"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_trabajo public.trabajos_generacion_ia;
  v_response_vigente text;
begin
  if p_entidad_id is null or nullif(btrim(p_openai_response_id), '') is null then
    raise exception using
      errcode = '22023',
      message = 'entidad_id y openai_response_id son requeridos';
  end if;

  -- Serializa sólo el cambio de versión activa de una entidad. No cubre HTTP.
  perform pg_advisory_xact_lock(
    hashtextextended(p_tipo_entidad::text || ':' || p_entidad_id::text, 0)
  );

  v_response_vigente := private.openai_response_id_vigente_trabajo_ia(
    p_tipo_entidad,
    p_entidad_id
  );

  -- Un webhook puede llegar apenas OpenAI devuelve el response_id al iniciador.
  -- Mientras el mensaje no lo haya publicado, esa entrega no puede adoptar ni
  -- reclamar el trabajo. El cron lo encontrará después del commit atómico.
  if p_tipo_entidad in ('chat_plan', 'chat_asignatura')
     and v_response_vigente is null then
    raise exception using
      errcode = '55000',
      message = 'la respuesta de chat todavía no fue publicada';
  end if;

  if v_response_vigente is not null
     and v_response_vigente <> p_openai_response_id then
    insert into public.trabajos_generacion_ia (
      tipo_entidad,
      entidad_id,
      openai_response_id,
      estado,
      estado_openai,
      iniciado_en,
      fecha_limite,
      completado_en,
      ultimo_error,
      metadata
    ) values (
      p_tipo_entidad,
      p_entidad_id,
      p_openai_response_id,
      'obsoleto',
      p_estado_openai,
      coalesce(p_iniciado_en, now()),
      coalesce(p_iniciado_en, now()) + interval '60 minutes',
      now(),
      jsonb_build_object(
        'code', 'STALE_RESPONSE',
        'message', 'La entidad ya apunta a una respuesta más reciente.'
      ),
      coalesce(p_metadata, '{}'::jsonb)
    )
    on conflict (openai_response_id) do update
    set estado = case
          when public.trabajos_generacion_ia.estado in ('pendiente', 'reclamado')
            then 'obsoleto'::public.estado_trabajo_generacion_ia
          else public.trabajos_generacion_ia.estado
        end,
        estado_openai = coalesce(
          excluded.estado_openai,
          public.trabajos_generacion_ia.estado_openai
        ),
        completado_en = coalesce(
          public.trabajos_generacion_ia.completado_en,
          now()
        ),
        token_reclamacion = null,
        reclamado_por = null,
        reclamado_hasta = null,
        metadata = public.trabajos_generacion_ia.metadata || excluded.metadata
    where public.trabajos_generacion_ia.tipo_entidad = excluded.tipo_entidad
      and public.trabajos_generacion_ia.entidad_id = excluded.entidad_id
    returning * into v_trabajo;

    if v_trabajo.id is null then
      raise exception using
        errcode = '23505',
        message = 'openai_response_id ya pertenece a otra entidad';
    end if;
    return v_trabajo;
  end if;

  update public.trabajos_generacion_ia
  set estado = 'obsoleto',
      completado_en = coalesce(completado_en, now()),
      token_reclamacion = null,
      reclamado_por = null,
      reclamado_hasta = null,
      ultimo_error = jsonb_build_object(
        'code', 'SUPERSEDED',
        'message', 'Una respuesta más reciente sustituyó este trabajo.'
      )
  where tipo_entidad = p_tipo_entidad
    and entidad_id = p_entidad_id
    and openai_response_id <> p_openai_response_id
    and estado in ('pendiente', 'reclamado');

  insert into public.trabajos_generacion_ia (
    tipo_entidad,
    entidad_id,
    openai_response_id,
    estado_openai,
    iniciado_en,
    fecha_limite,
    metadata
  ) values (
    p_tipo_entidad,
    p_entidad_id,
    p_openai_response_id,
    p_estado_openai,
    coalesce(p_iniciado_en, now()),
    coalesce(p_iniciado_en, now()) + interval '60 minutes',
    coalesce(p_metadata, '{}'::jsonb)
  )
  on conflict (openai_response_id) do update
  set estado_openai = coalesce(
        excluded.estado_openai,
        public.trabajos_generacion_ia.estado_openai
      ),
      metadata = public.trabajos_generacion_ia.metadata || excluded.metadata
  where public.trabajos_generacion_ia.tipo_entidad = excluded.tipo_entidad
    and public.trabajos_generacion_ia.entidad_id = excluded.entidad_id
  returning * into v_trabajo;

  if v_trabajo.id is null then
    raise exception using
      errcode = '23505',
      message = 'openai_response_id ya pertenece a otra entidad';
  end if;

  return v_trabajo;
end;
$$;


ALTER FUNCTION "public"."registrar_trabajo_generacion_ia"("p_tipo_entidad" "public"."tipo_trabajo_generacion_ia", "p_entidad_id" "uuid", "p_openai_response_id" "text", "p_estado_openai" "text", "p_iniciado_en" timestamp with time zone, "p_metadata" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."registrar_webhook_documental"("p_event_id" "text", "p_event_type" "text", "p_response_id" "text", "p_payload" "jsonb") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_delivery_count integer;
begin
  insert into public.document_webhook_events (
    event_id, event_type, provider_response_id, payload, delivery_count, received_at
  ) values (
    p_event_id, p_event_type, p_response_id, p_payload, 1, now()
  ) on conflict (event_id) do update
  set delivery_count = public.document_webhook_events.delivery_count + 1,
      event_type = excluded.event_type,
      provider_response_id = excluded.provider_response_id,
      payload = excluded.payload,
      received_at = excluded.received_at
  returning delivery_count into v_delivery_count;
  return v_delivery_count;
end;
$$;


ALTER FUNCTION "public"."registrar_webhook_documental"("p_event_id" "text", "p_event_type" "text", "p_response_id" "text", "p_payload" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reprogramar_intento_chat_ia"("p_intento_id" "uuid", "p_token_reclamacion" "uuid", "p_error" "jsonb" DEFAULT NULL::"jsonb") RETURNS boolean
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select public.reprogramar_intento_generacion_ia(
    p_intento_id,
    p_token_reclamacion,
    p_error
  );
$$;


ALTER FUNCTION "public"."reprogramar_intento_chat_ia"("p_intento_id" "uuid", "p_token_reclamacion" "uuid", "p_error" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reprogramar_intento_generacion_ia"("p_intento_id" "uuid", "p_token_reclamacion" "uuid", "p_error" "jsonb" DEFAULT NULL::"jsonb") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_actualizado integer;
begin
  update private.intentos_generacion_ia i
  set estado = case
        when i.openai_response_id is null then 'preparado'
        else 'respuesta_vinculada'
      end,
      token_reclamacion = null,
      reclamado_por = null,
      reclamado_hasta = null,
      siguiente_intento = now() + make_interval(
        secs => least(300, 30 * (2 ^ least(greatest(i.intentos - 1, 0), 4))::integer)
      ),
      ultimo_error = p_error,
      actualizado_en = now()
  where i.id = p_intento_id
    and i.token_reclamacion = p_token_reclamacion
    and i.estado in ('reclamado', 'respuesta_vinculada');
  get diagnostics v_actualizado = row_count;
  return v_actualizado = 1;
end;
$$;


ALTER FUNCTION "public"."reprogramar_intento_generacion_ia"("p_intento_id" "uuid", "p_token_reclamacion" "uuid", "p_error" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."resumen_trabajos_generacion_ia"() RETURNS "jsonb"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select jsonb_build_object(
    'pendientes', count(*) filter (where estado in ('pendiente', 'reclamado')),
    'mas_antiguo_en', min(iniciado_en) filter (where estado in ('pendiente', 'reclamado')),
    'arrendamientos_vencidos', count(*) filter (
      where estado = 'reclamado' and reclamado_hasta <= now()
    ),
    'expirados_24h', count(*) filter (
      where estado = 'expirado' and completado_en >= now() - interval '24 hours'
    )
  )
  from public.trabajos_generacion_ia;
$$;


ALTER FUNCTION "public"."resumen_trabajos_generacion_ia"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."search_asignaturas"("p_search" "text" DEFAULT ''::"text", "p_facultad_id" "uuid" DEFAULT NULL::"uuid", "p_carrera_id" "uuid" DEFAULT NULL::"uuid", "p_plan_estudio_id" "uuid" DEFAULT NULL::"uuid", "p_limit" integer DEFAULT 20, "p_offset" integer DEFAULT 0) RETURNS TABLE("id" "uuid", "plan_estudio_id" "uuid", "codigo" "text", "nombre" "text", "tipo" "public"."tipo_asignatura", "creditos" numeric, "numero_ciclo" integer, "datos" "jsonb", "contenido_tematico" "jsonb", "estado" "public"."estado_asignatura", "rank" real, "total_count" bigint)
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO 'public', 'private', 'auth', 'extensions', 'pg_temp'
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


CREATE OR REPLACE FUNCTION "public"."search_authorized_chunks"("p_user_id" "uuid", "p_tenant_id" "uuid", "p_collection_ids" "uuid"[] DEFAULT '{}'::"uuid"[], "p_file_ids" "uuid"[] DEFAULT '{}'::"uuid"[], "p_conversation_id" "uuid" DEFAULT NULL::"uuid", "p_query_text" "text" DEFAULT ''::"text", "p_query_embedding" "extensions"."vector" DEFAULT NULL::"extensions"."vector", "p_limit" integer DEFAULT 12) RETURNS TABLE("chunk_id" "uuid", "file_id" "uuid", "file_version_id" "uuid", "page_start" integer, "page_end" integer, "heading_path" "text"[], "chunk_text" "text", "lexical_rank" real, "semantic_rank" real, "rrf_score" real)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  with autorizados as (
    select c.*, fv.file_id
    from public.document_chunks c
    join public.file_versions fv on fv.id = c.file_version_id
    where c.tenant_id = p_tenant_id
      and private.documentos_usuario_puede_archivo(p_user_id, fv.file_id, 'use')
      and (
        coalesce(cardinality(p_file_ids), 0) = 0
        or fv.file_id = any(p_file_ids)
      )
      and (
        coalesce(cardinality(p_collection_ids), 0) = 0
        or exists (
          select 1 from public.collection_files cf
          where cf.tenant_id = p_tenant_id
            and cf.file_id = fv.file_id
            and cf.collection_id = any(p_collection_ids)
        )
      )
      and (
        p_conversation_id is null
        or exists (
          select 1 from public.conversation_files cf
          where cf.tenant_id = p_tenant_id
            and cf.conversation_id = p_conversation_id
            and cf.file_id = fv.file_id
            and cf.removed_at is null
        )
      )
  ), puntuados as (
    select a.*,
      ts_rank_cd(a.search_vector, websearch_to_tsquery('spanish', p_query_text))::real as lexical_rank,
      case when p_query_embedding is null or a.embedding is null then 0::real
           else (1 - (a.embedding OPERATOR(extensions.<=>) p_query_embedding))::real end as semantic_rank
    from autorizados a
    where (p_query_text = '' or a.search_vector @@ websearch_to_tsquery('spanish', p_query_text))
       or p_query_embedding is not null
  ), ordenados as (
    select *,
      row_number() over (order by lexical_rank desc, id) as lexical_position,
      row_number() over (order by semantic_rank desc, id) as semantic_position
    from puntuados
  )
  select id, file_id, file_version_id, page_start, page_end, heading_path, text,
    lexical_rank, semantic_rank,
    (1.0 / (60 + lexical_position) + 1.0 / (60 + semantic_position))::real as rrf_score
  from ordenados
  order by rrf_score desc, id
  limit greatest(1, least(p_limit, 50))
$$;


ALTER FUNCTION "public"."search_authorized_chunks"("p_user_id" "uuid", "p_tenant_id" "uuid", "p_collection_ids" "uuid"[], "p_file_ids" "uuid"[], "p_conversation_id" "uuid", "p_query_text" "text", "p_query_embedding" "extensions"."vector", "p_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_actualizado_en"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'private', 'auth', 'extensions', 'pg_temp'
    AS $$
begin
  new.actualizado_en = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."set_actualizado_en"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."solicitar_cancelacion_trabajo_generacion_ia"("p_openai_response_id" "text") RETURNS "public"."trabajos_generacion_ia"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_trabajo public.trabajos_generacion_ia;
begin
  update public.trabajos_generacion_ia
  set cancelacion_solicitada_en = coalesce(cancelacion_solicitada_en, now())
  where openai_response_id = p_openai_response_id
    and estado in ('pendiente', 'reclamado')
  returning * into v_trabajo;
  return v_trabajo;
end;
$$;


ALTER FUNCTION "public"."solicitar_cancelacion_trabajo_generacion_ia"("p_openai_response_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."suma_porcentajes"("jsonb") RETURNS numeric
    LANGUAGE "plpgsql" IMMUTABLE
    SET "search_path" TO 'public', 'private', 'auth', 'extensions', 'pg_temp'
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
    SET "search_path" TO 'public', 'private', 'auth', 'extensions', 'pg_temp'
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


CREATE OR REPLACE FUNCTION "public"."transiciones_permitidas_plan"("p_plan_id" "uuid") RETURNS SETOF "public"."estados_plan"
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public', 'private', 'auth', 'extensions', 'pg_temp'
    AS $$ select * from private.transiciones_permitidas_plan(p_plan_id); $$;


ALTER FUNCTION "public"."transiciones_permitidas_plan"("p_plan_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."unaccent_immutable"("text") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE STRICT PARALLEL SAFE
    SET "search_path" TO 'public', 'private', 'auth', 'extensions', 'pg_temp'
    AS $_$
  select extensions.unaccent('extensions.unaccent', $1);
$_$;


ALTER FUNCTION "public"."unaccent_immutable"("text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."usuario_es_externo_asignado_plan"("p_usuario_id" "uuid", "p_plan_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public', 'private', 'auth', 'extensions', 'pg_temp'
    AS $$ select private.usuario_es_externo_asignado_plan(p_usuario_id, p_plan_id); $$;


ALTER FUNCTION "public"."usuario_es_externo_asignado_plan"("p_usuario_id" "uuid", "p_plan_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."usuario_es_jefe_encargado_plan"("p_usuario_id" "uuid", "p_plan_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'private', 'auth', 'extensions', 'pg_temp'
    AS $$
  select private.usuario_es_jefe_encargado_plan(p_usuario_id, p_plan_id);
$$;


ALTER FUNCTION "public"."usuario_es_jefe_encargado_plan"("p_usuario_id" "uuid", "p_plan_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."usuario_es_jefe_posgrado_encargado_plan"("p_usuario_id" "uuid", "p_plan_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'private', 'auth', 'extensions', 'pg_temp'
    AS $$
  select private.usuario_es_jefe_posgrado_encargado_plan(
    p_usuario_id,
    p_plan_id
  );
$$;


ALTER FUNCTION "public"."usuario_es_jefe_posgrado_encargado_plan"("p_usuario_id" "uuid", "p_plan_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."usuario_puede_acceder_plan"("p_usuario_id" "uuid", "p_plan_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'private', 'auth', 'extensions', 'pg_temp'
    AS $$
  select private.usuario_puede_acceder_plan(p_usuario_id, p_plan_id);
$$;


ALTER FUNCTION "public"."usuario_puede_acceder_plan"("p_usuario_id" "uuid", "p_plan_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."usuario_puede_comentar_asignatura"("p_usuario_id" "uuid", "p_asignatura_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public', 'private', 'auth', 'extensions', 'pg_temp'
    AS $$ select private.usuario_puede_comentar_asignatura(p_usuario_id, p_asignatura_id); $$;


ALTER FUNCTION "public"."usuario_puede_comentar_asignatura"("p_usuario_id" "uuid", "p_asignatura_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."usuario_puede_comentar_plan"("p_usuario_id" "uuid", "p_plan_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public', 'private', 'auth', 'extensions', 'pg_temp'
    AS $$ select private.usuario_puede_comentar_plan(p_usuario_id, p_plan_id); $$;


ALTER FUNCTION "public"."usuario_puede_comentar_plan"("p_usuario_id" "uuid", "p_plan_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."usuario_puede_editar_asignatura"("p_usuario_id" "uuid", "p_asignatura_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public', 'private', 'auth', 'extensions', 'pg_temp'
    AS $$ select private.usuario_puede_editar_asignatura(p_usuario_id, p_asignatura_id); $$;


ALTER FUNCTION "public"."usuario_puede_editar_asignatura"("p_usuario_id" "uuid", "p_asignatura_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."usuario_puede_editar_campo_asignatura"("p_usuario_id" "uuid", "p_asignatura_id" "uuid", "p_clave" "text") RETURNS boolean
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public', 'private', 'auth', 'extensions', 'pg_temp'
    AS $$ select private.usuario_puede_editar_campo_asignatura(p_usuario_id, p_asignatura_id, p_clave); $$;


ALTER FUNCTION "public"."usuario_puede_editar_campo_asignatura"("p_usuario_id" "uuid", "p_asignatura_id" "uuid", "p_clave" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."usuario_puede_editar_campo_plan"("p_usuario_id" "uuid", "p_plan_id" "uuid", "p_clave" "text") RETURNS boolean
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public', 'private', 'auth', 'extensions', 'pg_temp'
    AS $$ select private.usuario_puede_editar_campo_plan(p_usuario_id, p_plan_id, p_clave); $$;


ALTER FUNCTION "public"."usuario_puede_editar_campo_plan"("p_usuario_id" "uuid", "p_plan_id" "uuid", "p_clave" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."usuario_puede_editar_plan"("p_usuario_id" "uuid", "p_plan_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public', 'private', 'auth', 'extensions', 'pg_temp'
    AS $$ select private.usuario_puede_editar_plan(p_usuario_id, p_plan_id); $$;


ALTER FUNCTION "public"."usuario_puede_editar_plan"("p_usuario_id" "uuid", "p_plan_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."usuario_puede_gestionar_rol"("p_actor" "uuid", "p_rol" "uuid", "p_facultad" "uuid" DEFAULT NULL::"uuid", "p_carrera" "uuid" DEFAULT NULL::"uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'private', 'auth', 'extensions', 'pg_temp'
    AS $$
  select private.usuario_puede_gestionar_rol(
    p_actor,
    p_rol,
    p_facultad,
    p_carrera
  );
$$;


ALTER FUNCTION "public"."usuario_puede_gestionar_rol"("p_actor" "uuid", "p_rol" "uuid", "p_facultad" "uuid", "p_carrera" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."usuario_puede_gestionar_usuario"("p_actor" "uuid", "p_usuario" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'private', 'auth', 'extensions', 'pg_temp'
    AS $$
  select private.usuario_puede_gestionar_usuario(p_actor, p_usuario);
$$;


ALTER FUNCTION "public"."usuario_puede_gestionar_usuario"("p_actor" "uuid", "p_usuario" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."usuario_puede_transicionar_asignatura"("p_usuario_id" "uuid", "p_asignatura_id" "uuid", "p_nuevo_estado" "public"."estado_asignatura") RETURNS boolean
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public', 'private', 'auth', 'extensions', 'pg_temp'
    AS $$
        select private.usuario_puede_transicionar_asignatura(
          p_usuario_id,
          p_asignatura_id,
          p_nuevo_estado
        );
      $$;


ALTER FUNCTION "public"."usuario_puede_transicionar_asignatura"("p_usuario_id" "uuid", "p_asignatura_id" "uuid", "p_nuevo_estado" "public"."estado_asignatura") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."usuario_puede_transicionar_plan"("p_usuario_id" "uuid", "p_plan_id" "uuid", "p_hacia_estado_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public', 'private', 'auth', 'extensions', 'pg_temp'
    AS $$ select private.usuario_puede_transicionar_plan(p_usuario_id, p_plan_id, p_hacia_estado_id); $$;


ALTER FUNCTION "public"."usuario_puede_transicionar_plan"("p_usuario_id" "uuid", "p_plan_id" "uuid", "p_hacia_estado_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."usuario_puede_usar_ia_asignatura"("p_usuario_id" "uuid", "p_asignatura_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public', 'private', 'auth', 'extensions', 'pg_temp'
    AS $$ select private.usuario_puede_usar_ia_asignatura(p_usuario_id, p_asignatura_id); $$;


ALTER FUNCTION "public"."usuario_puede_usar_ia_asignatura"("p_usuario_id" "uuid", "p_asignatura_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."usuario_puede_usar_ia_plan"("p_usuario_id" "uuid", "p_plan_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public', 'private', 'auth', 'extensions', 'pg_temp'
    AS $$
  select public.usuario_puede_editar_plan(p_usuario_id, p_plan_id)
    and public.usuario_tiene_permiso(p_usuario_id, 'ia.usar')
    and public.plan_estado_clave(p_plan_id) IN ('BORRADOR', 'REVISION');
$$;


ALTER FUNCTION "public"."usuario_puede_usar_ia_plan"("p_usuario_id" "uuid", "p_plan_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."usuario_tiene_permiso"("p_usuario_id" "uuid", "p_permiso" "text") RETURNS boolean
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public', 'private', 'auth', 'extensions', 'pg_temp'
    AS $$
  select case
    when private.authz_is_simulated_self(p_usuario_id)
      then public.authz_has_permission(p_permiso)
    else private.authz_user_has_permission(p_usuario_id, p_permiso)
  end;
$$;


ALTER FUNCTION "public"."usuario_tiene_permiso"("p_usuario_id" "uuid", "p_permiso" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."usuario_tiene_rol_contextual_plan"("p_usuario_id" "uuid", "p_plan_id" "uuid", "p_rol" "text") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'private', 'auth', 'extensions', 'pg_temp'
    AS $$
  select case
    when p_rol = 'JEFE_CARRERA' then
      private.usuario_es_jefe_encargado_plan(p_usuario_id, p_plan_id)
    when p_rol = 'JEFE_POSGRADO' then
      private.usuario_es_jefe_posgrado_encargado_plan(p_usuario_id, p_plan_id)
    else
      private.usuario_tiene_rol_en_plan(p_usuario_id, p_plan_id, p_rol)
  end;
$$;


ALTER FUNCTION "public"."usuario_tiene_rol_contextual_plan"("p_usuario_id" "uuid", "p_plan_id" "uuid", "p_rol" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."usuario_tiene_rol_en_plan"("p_usuario_id" "uuid", "p_plan_id" "uuid", "p_rol" "text") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'private', 'auth', 'extensions', 'pg_temp'
    AS $$
  select private.usuario_tiene_rol_en_plan(p_usuario_id, p_plan_id, p_rol);
$$;


ALTER FUNCTION "public"."usuario_tiene_rol_en_plan"("p_usuario_id" "uuid", "p_plan_id" "uuid", "p_rol" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validar_numero_ciclo_asignatura"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'private', 'auth', 'extensions', 'pg_temp'
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
    SET "search_path" TO 'public', 'private', 'auth', 'extensions', 'pg_temp'
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
    SET "search_path" TO 'public', 'private', 'auth', 'extensions', 'pg_temp'
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


CREATE OR REPLACE FUNCTION "public"."vincular_respuesta_intento_chat_ia"("p_intento_id" "uuid", "p_token_reclamacion" "uuid", "p_openai_response_id" "text", "p_estado_openai" "text" DEFAULT 'queued'::"text", "p_iniciado_en" timestamp with time zone DEFAULT "now"()) RETURNS "jsonb"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select public.vincular_respuesta_intento_generacion_ia(
    p_intento_id,
    p_token_reclamacion,
    p_openai_response_id,
    p_estado_openai,
    p_iniciado_en
  );
$$;


ALTER FUNCTION "public"."vincular_respuesta_intento_chat_ia"("p_intento_id" "uuid", "p_token_reclamacion" "uuid", "p_openai_response_id" "text", "p_estado_openai" "text", "p_iniciado_en" timestamp with time zone) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."vincular_respuesta_intento_chat_ia"("p_intento_id" "uuid", "p_token_reclamacion" "uuid", "p_openai_response_id" "text", "p_estado_openai" "text", "p_iniciado_en" timestamp with time zone) IS 'Vincula por CAS el primer response_id conocido al intento privado; nunca sustituye al ganador.';



CREATE OR REPLACE FUNCTION "public"."vincular_respuesta_intento_generacion_ia"("p_intento_id" "uuid", "p_token_reclamacion" "uuid", "p_openai_response_id" "text", "p_estado_openai" "text" DEFAULT 'queued'::"text", "p_iniciado_en" timestamp with time zone DEFAULT "now"()) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_intento private.intentos_generacion_ia;
  v_response_id text := nullif(btrim(p_openai_response_id), '');
begin
  if p_intento_id is null or p_token_reclamacion is null or v_response_id is null then
    raise exception using errcode = '22023', message = 'intento, token y response_id son requeridos';
  end if;
  select * into v_intento
  from private.intentos_generacion_ia i
  where i.id = p_intento_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'intento de generación no encontrado';
  end if;
  if v_intento.openai_response_id is not null then
    return jsonb_build_object(
      'resolution', case
        when v_intento.openai_response_id = v_response_id then 'already_linked'
        else 'claimed_elsewhere'
      end,
      'attempt', private.intento_generacion_ia_json(p_intento_id)
    );
  end if;
  if v_intento.estado not in ('reclamado', 'preparado')
     or v_intento.token_reclamacion is distinct from p_token_reclamacion
     or v_intento.reclamado_hasta <= now() then
    return jsonb_build_object(
      'resolution', case when v_intento.estado = 'obsoleto' then 'stale' else 'claimed_elsewhere' end,
      'attempt', private.intento_generacion_ia_json(p_intento_id)
    );
  end if;
  update private.intentos_generacion_ia
  set estado = 'respuesta_vinculada',
      openai_response_id = v_response_id,
      estado_openai = coalesce(nullif(btrim(p_estado_openai), ''), 'queued'),
      iniciado_en = coalesce(p_iniciado_en, now()),
      actualizado_en = now()
  where id = p_intento_id;
  return jsonb_build_object(
    'resolution', 'linked',
    'attempt', private.intento_generacion_ia_json(p_intento_id)
  );
end;
$$;


ALTER FUNCTION "public"."vincular_respuesta_intento_generacion_ia"("p_intento_id" "uuid", "p_token_reclamacion" "uuid", "p_openai_response_id" "text", "p_estado_openai" "text", "p_iniciado_en" timestamp with time zone) OWNER TO "postgres";


CREATE TEXT SEARCH CONFIGURATION "public"."es_simple_unaccent" (
    PARSER = "pg_catalog"."default" );

ALTER TEXT SEARCH CONFIGURATION "public"."es_simple_unaccent"
    ADD MAPPING FOR "asciiword" WITH "simple";

ALTER TEXT SEARCH CONFIGURATION "public"."es_simple_unaccent"
    ADD MAPPING FOR "word" WITH "extensions"."unaccent", "simple";

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
    ADD MAPPING FOR "hword_part" WITH "extensions"."unaccent", "simple";

ALTER TEXT SEARCH CONFIGURATION "public"."es_simple_unaccent"
    ADD MAPPING FOR "hword_asciipart" WITH "simple";

ALTER TEXT SEARCH CONFIGURATION "public"."es_simple_unaccent"
    ADD MAPPING FOR "numhword" WITH "simple";

ALTER TEXT SEARCH CONFIGURATION "public"."es_simple_unaccent"
    ADD MAPPING FOR "asciihword" WITH "simple";

ALTER TEXT SEARCH CONFIGURATION "public"."es_simple_unaccent"
    ADD MAPPING FOR "hword" WITH "extensions"."unaccent", "simple";

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


CREATE TABLE IF NOT EXISTS "private"."intentos_generacion_ia" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tipo_conversacion" "public"."tipo_conversacion_documental",
    "conversacion_id" "uuid",
    "mensaje_id" "uuid",
    "usuario_id" "uuid",
    "estado" "text" DEFAULT 'preparado'::"text" NOT NULL,
    "solicitud" "jsonb" NOT NULL,
    "modo_referencias" "text" DEFAULT 'none'::"text" NOT NULL,
    "consulta_referencias" "text" DEFAULT ''::"text" NOT NULL,
    "referencias" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "openai_response_id" "text",
    "estado_openai" "text",
    "iniciado_en" timestamp with time zone,
    "token_reclamacion" "uuid",
    "reclamado_por" "text",
    "reclamado_hasta" timestamp with time zone,
    "intentos" integer DEFAULT 0 NOT NULL,
    "siguiente_intento" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ultimo_error" "jsonb",
    "creado_en" timestamp with time zone DEFAULT "now"() NOT NULL,
    "actualizado_en" timestamp with time zone DEFAULT "now"() NOT NULL,
    "publicado_en" timestamp with time zone,
    "fecha_limite" timestamp with time zone DEFAULT ("now"() + '01:00:00'::interval) NOT NULL,
    "tipo_entidad" "public"."tipo_trabajo_generacion_ia" NOT NULL,
    "entidad_id" "uuid" NOT NULL,
    "handler" "text" NOT NULL,
    "payload_version" integer DEFAULT 1 NOT NULL,
    "contexto" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "terminal_aplicado_en" timestamp with time zone,
    CONSTRAINT "intentos_chat_ia_check" CHECK ((("modo_referencias" = 'none'::"text") = ("jsonb_array_length"("referencias") = 0))),
    CONSTRAINT "intentos_chat_ia_intentos_check" CHECK (("intentos" >= 0)),
    CONSTRAINT "intentos_chat_ia_modo_referencias_check" CHECK (("modo_referencias" = ANY (ARRAY['none'::"text", 'direct'::"text", 'retrieval'::"text"]))),
    CONSTRAINT "intentos_chat_ia_referencias_check" CHECK (("jsonb_typeof"("referencias") = 'array'::"text")),
    CONSTRAINT "intentos_chat_ia_solicitud_check" CHECK (("jsonb_typeof"("solicitud") = 'object'::"text")),
    CONSTRAINT "intentos_generacion_ia_chat_contexto_check" CHECK ((("handler" <> 'chat'::"text") OR (("tipo_conversacion" IS NOT NULL) AND ("conversacion_id" IS NOT NULL) AND ("mensaje_id" IS NOT NULL) AND ("usuario_id" IS NOT NULL)))),
    CONSTRAINT "intentos_generacion_ia_contexto_check" CHECK (("jsonb_typeof"("contexto") = 'object'::"text")),
    CONSTRAINT "intentos_generacion_ia_estado_check" CHECK (("estado" = ANY (ARRAY['preparado'::"text", 'reclamado'::"text", 'respuesta_vinculada'::"text", 'publicado'::"text", 'fallido'::"text", 'expirado'::"text", 'obsoleto'::"text"]))),
    CONSTRAINT "intentos_generacion_ia_payload_version_check" CHECK (("payload_version" > 0)),
    CONSTRAINT "intentos_generacion_ia_response_check" CHECK (((("estado" = ANY (ARRAY['respuesta_vinculada'::"text", 'publicado'::"text"])) = ("openai_response_id" IS NOT NULL)) OR ("estado" = ANY (ARRAY['fallido'::"text", 'expirado'::"text", 'obsoleto'::"text"])))),
    CONSTRAINT "intentos_generacion_ia_sin_file_data_check" CHECK ((NOT "jsonb_path_exists"("solicitud", '$.**."file_data"'::"jsonpath"))),
    CONSTRAINT "intentos_generacion_ia_sin_image_data_url_check" CHECK ((NOT "jsonb_path_exists"("solicitud", '$.**."image_url"?(@ starts with "data:")'::"jsonpath")))
);


ALTER TABLE "private"."intentos_generacion_ia" OWNER TO "postgres";


COMMENT ON TABLE "private"."intentos_generacion_ia" IS 'Outbox genérico y privado para efectos remotos de IA recuperables por handler y versión de payload.';



CREATE OR REPLACE VIEW "private"."intentos_chat_ia" WITH ("security_invoker"='true') AS
 SELECT "id",
    "tipo_conversacion",
    "conversacion_id",
    "mensaje_id",
    "usuario_id",
    "estado",
    "solicitud",
    "modo_referencias",
    "consulta_referencias",
    "referencias",
    "openai_response_id",
    "estado_openai",
    "iniciado_en",
    "token_reclamacion",
    "reclamado_por",
    "reclamado_hasta",
    "intentos",
    "siguiente_intento",
    "ultimo_error",
    "creado_en",
    "actualizado_en",
    "publicado_en",
    "fecha_limite",
    "tipo_entidad",
    "entidad_id",
    "handler",
    "payload_version",
    "contexto"
   FROM "private"."intentos_generacion_ia"
  WHERE ("handler" = 'chat'::"text");


ALTER VIEW "private"."intentos_chat_ia" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ai_request_references" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "request_id" "text" NOT NULL,
    "conversation_type" "public"."tipo_conversacion_documental" NOT NULL,
    "conversation_id" "uuid" NOT NULL,
    "message_type" "public"."tipo_conversacion_documental",
    "message_id" "uuid",
    "file_id" "uuid" NOT NULL,
    "file_version_id" "uuid" NOT NULL,
    "mode" "text" NOT NULL,
    "chunk_ids" "uuid"[] DEFAULT '{}'::"uuid"[] NOT NULL,
    "retrieval_query" "text",
    "retrieval_scores" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "ai_request_references_mode_check" CHECK (("mode" = ANY (ARRAY['direct'::"text", 'retrieval'::"text"])))
);


ALTER TABLE "public"."ai_request_references" OWNER TO "postgres";


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
    "openai_response_id" "text",
    "web_search_enabled" boolean DEFAULT false NOT NULL,
    "reasoning_effort" "text" DEFAULT 'auto'::"text" NOT NULL,
    "retry_of_message_id" "uuid",
    CONSTRAINT "asignatura_mensajes_ia_reasoning_effort_check" CHECK (("reasoning_effort" = ANY (ARRAY['auto'::"text", 'none'::"text", 'low'::"text", 'medium'::"text", 'high'::"text"])))
);


ALTER TABLE "public"."asignatura_mensajes_ia" OWNER TO "postgres";


COMMENT ON COLUMN "public"."asignatura_mensajes_ia"."web_search_enabled" IS 'Control de búsqueda web congelado para reproducir fielmente una solicitud IA.';



COMMENT ON COLUMN "public"."asignatura_mensajes_ia"."reasoning_effort" IS 'Esfuerzo de razonamiento congelado para reproducir fielmente una solicitud IA.';



COMMENT ON COLUMN "public"."asignatura_mensajes_ia"."retry_of_message_id" IS 'Mensaje original cuya solicitud congelada se reutilizó en este reintento.';



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


CREATE TABLE IF NOT EXISTS "public"."collection_files" (
    "tenant_id" "uuid" NOT NULL,
    "collection_id" "uuid" NOT NULL,
    "file_id" "uuid" NOT NULL,
    "added_by" "uuid" NOT NULL,
    "added_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."collection_files" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."collections" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "created_by" "uuid" NOT NULL,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "kind" "text" DEFAULT 'collection'::"text" NOT NULL,
    CONSTRAINT "collections_kind_check" CHECK (("kind" = ANY (ARRAY['collection'::"text", 'curriculum_repository'::"text"]))),
    CONSTRAINT "collections_name_check" CHECK (("btrim"("name") <> ''::"text")),
    CONSTRAINT "collections_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'archived'::"text"])))
);


ALTER TABLE "public"."collections" OWNER TO "postgres";


COMMENT ON COLUMN "public"."collections"."kind" IS 'collection: carpeta de trabajo; curriculum_repository: acervo de planeación curricular.';



CREATE TABLE IF NOT EXISTS "public"."comentarios_adjuntos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "comentario_id" "uuid" NOT NULL,
    "plan_estudio_id" "uuid" NOT NULL,
    "bucket" "text" DEFAULT 'comentarios-adjuntos'::"text" NOT NULL,
    "path" "text" NOT NULL,
    "nombre" "text",
    "mime" "text",
    "size" bigint,
    "creado_por" "uuid",
    "creado_en" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "comentarios_adjuntos_size_chk" CHECK ((("size" IS NULL) OR ("size" >= 0)))
);


ALTER TABLE "public"."comentarios_adjuntos" OWNER TO "postgres";


COMMENT ON TABLE "public"."comentarios_adjuntos" IS 'Archivos adjuntos (imágenes/documentos) de un comentario de plan, almacenados en el bucket privado comentarios-adjuntos.';



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
    "asignatura_id" "uuid",
    "referencia" "jsonb",
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


CREATE TABLE IF NOT EXISTS "public"."conversation_files" (
    "tenant_id" "uuid" NOT NULL,
    "conversation_type" "public"."tipo_conversacion_documental" NOT NULL,
    "conversation_id" "uuid" NOT NULL,
    "file_id" "uuid" NOT NULL,
    "added_by" "uuid" NOT NULL,
    "added_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "removed_at" timestamp with time zone
);


ALTER TABLE "public"."conversation_files" OWNER TO "postgres";


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



CREATE TABLE IF NOT EXISTS "public"."document_chunks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "file_version_id" "uuid" NOT NULL,
    "chunk_index" integer NOT NULL,
    "heading_path" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "page_start" integer,
    "page_end" integer,
    "text" "text" NOT NULL,
    "token_count" integer NOT NULL,
    "text_sha256" "text" NOT NULL,
    "chunker_version" "text" NOT NULL,
    "search_vector" "tsvector" GENERATED ALWAYS AS ("to_tsvector"('"spanish"'::"regconfig", "text")) STORED,
    "embedding" "extensions"."vector"(1536),
    "embedding_model" "text",
    "embedding_version" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "document_chunks_check" CHECK ((("page_end" IS NULL) OR ("page_end" >= "page_start"))),
    CONSTRAINT "document_chunks_chunk_index_check" CHECK (("chunk_index" >= 0)),
    CONSTRAINT "document_chunks_page_start_check" CHECK ((("page_start" IS NULL) OR ("page_start" >= 1))),
    CONSTRAINT "document_chunks_text_check" CHECK (("btrim"("text") <> ''::"text")),
    CONSTRAINT "document_chunks_text_sha256_check" CHECK (("text_sha256" ~ '^[a-f0-9]{64}$'::"text")),
    CONSTRAINT "document_chunks_token_count_check" CHECK (("token_count" > 0))
);


ALTER TABLE "public"."document_chunks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."document_extractions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "file_version_id" "uuid" NOT NULL,
    "provider" "text" NOT NULL,
    "provider_response_id" "text",
    "page_from" integer,
    "page_to" integer,
    "status" "text" NOT NULL,
    "schema_version" "text" NOT NULL,
    "extracted_content" "jsonb",
    "quality_flags" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "attempts" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "completed_at" timestamp with time zone,
    CONSTRAINT "document_extractions_attempts_check" CHECK ((("attempts" >= 0) AND ("attempts" <= 5))),
    CONSTRAINT "document_extractions_check" CHECK ((("page_to" IS NULL) OR ("page_to" >= "page_from"))),
    CONSTRAINT "document_extractions_page_from_check" CHECK ((("page_from" IS NULL) OR ("page_from" >= 1))),
    CONSTRAINT "document_extractions_provider_check" CHECK (("provider" = ANY (ARRAY['local'::"text", 'openai'::"text"]))),
    CONSTRAINT "document_extractions_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'processing'::"text", 'waiting_provider'::"text", 'completed'::"text", 'failed'::"text"])))
);


ALTER TABLE "public"."document_extractions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."document_webhook_events" (
    "event_id" "text" NOT NULL,
    "event_type" "text" NOT NULL,
    "provider_response_id" "text" NOT NULL,
    "payload" "jsonb" NOT NULL,
    "delivery_count" integer DEFAULT 1 NOT NULL,
    "received_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "processed_at" timestamp with time zone,
    "processing_error" "text",
    CONSTRAINT "document_webhook_events_delivery_count_check" CHECK (("delivery_count" > 0))
);


ALTER TABLE "public"."document_webhook_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ejecuciones_recuperacion_ia" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "iniciado_en" timestamp with time zone DEFAULT "now"() NOT NULL,
    "completado_en" timestamp with time zone,
    "descubiertos" integer DEFAULT 0 NOT NULL,
    "reclamados" integer DEFAULT 0 NOT NULL,
    "completados" integer DEFAULT 0 NOT NULL,
    "reprogramados" integer DEFAULT 0 NOT NULL,
    "fallidos" integer DEFAULT 0 NOT NULL,
    "error" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    CONSTRAINT "ejecuciones_recuperacion_ia_completados_check" CHECK (("completados" >= 0)),
    CONSTRAINT "ejecuciones_recuperacion_ia_descubiertos_check" CHECK (("descubiertos" >= 0)),
    CONSTRAINT "ejecuciones_recuperacion_ia_fallidos_check" CHECK (("fallidos" >= 0)),
    CONSTRAINT "ejecuciones_recuperacion_ia_reclamados_check" CHECK (("reclamados" >= 0)),
    CONSTRAINT "ejecuciones_recuperacion_ia_reprogramados_check" CHECK (("reprogramados" >= 0))
);


ALTER TABLE "public"."ejecuciones_recuperacion_ia" OWNER TO "postgres";


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



CREATE TABLE IF NOT EXISTS "public"."file_blobs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "sha256" "text" NOT NULL,
    "size_bytes" bigint NOT NULL,
    "detected_mime" "text" NOT NULL,
    "storage_bucket" "text" DEFAULT 'documentos-academicos'::"text" NOT NULL,
    "storage_path" "text" NOT NULL,
    "processing_status" "public"."estado_procesamiento_documento" DEFAULT 'pending'::"public"."estado_procesamiento_documento" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted_at" timestamp with time zone,
    CONSTRAINT "file_blobs_sha256_check" CHECK (("sha256" ~ '^[a-f0-9]{64}$'::"text")),
    CONSTRAINT "file_blobs_size_bytes_check" CHECK ((("size_bytes" > 0) AND ("size_bytes" <= 20971520))),
    CONSTRAINT "file_blobs_storage_path_check" CHECK (((("storage_bucket" = 'documentos-academicos'::"text") AND ("storage_path" ~ '^content/[0-9a-f-]+/[a-f0-9]{2}/[a-f0-9]{64}$'::"text")) OR (("storage_bucket" = 'ai-storage'::"text") AND ("storage_path" !~ '(^|/)\.\.(/|$)'::"text") AND ("storage_path" !~ '^/'::"text"))))
);


ALTER TABLE "public"."file_blobs" OWNER TO "postgres";


COMMENT ON CONSTRAINT "file_blobs_storage_path_check" ON "public"."file_blobs" IS 'Contenido canónico nuevo o ruta histórica segura del bucket ai-storage durante la transición.';



CREATE TABLE IF NOT EXISTS "public"."file_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "file_id" "uuid",
    "actor_user_id" "uuid",
    "event_type" "text" NOT NULL,
    "entity_type" "text" NOT NULL,
    "entity_id" "uuid",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."file_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."file_grants" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "file_id" "uuid" NOT NULL,
    "subject_type" "public"."tipo_sujeto_archivo_documental" NOT NULL,
    "subject_id" "uuid" NOT NULL,
    "permission" "public"."permiso_archivo_documental" NOT NULL,
    "granted_by" "uuid" NOT NULL,
    "expires_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."file_grants" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."file_user_state" (
    "tenant_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "file_id" "uuid" NOT NULL,
    "last_viewed_at" timestamp with time zone,
    "last_used_at" timestamp with time zone,
    "pinned_at" timestamp with time zone,
    "archived_at" timestamp with time zone
);


ALTER TABLE "public"."file_user_state" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."file_versions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "file_id" "uuid" NOT NULL,
    "blob_id" "uuid" NOT NULL,
    "version_number" integer NOT NULL,
    "original_filename" "text" NOT NULL,
    "uploaded_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "file_versions_version_number_check" CHECK (("version_number" > 0))
);


ALTER TABLE "public"."file_versions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."files" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "display_name" "text" NOT NULL,
    "description" "text",
    "current_version_id" "uuid",
    "created_by" "uuid" NOT NULL,
    "status" "public"."estado_procesamiento_documento" DEFAULT 'pending'::"public"."estado_procesamiento_documento" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted_at" timestamp with time zone,
    CONSTRAINT "files_display_name_check" CHECK (("btrim"("display_name") <> ''::"text"))
);


ALTER TABLE "public"."files" OWNER TO "postgres";


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


CREATE TABLE IF NOT EXISTS "public"."learning_objects" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "asignatura_id" "uuid" NOT NULL,
    "unidad_id" "text",
    "tema_id" "text",
    "tipo" "public"."learning_object_tipo" NOT NULL,
    "titulo" "text" NOT NULL,
    "descripcion" "text",
    "contenido_json" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "archivo_path" "text",
    "score" integer,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "source_refs" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "creado_por" "uuid",
    "actualizado_por" "uuid",
    "interaccion_ia_id" "uuid",
    "generation_job_id" "uuid",
    "creado_en" timestamp with time zone DEFAULT "now"() NOT NULL,
    "actualizado_en" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "learning_objects_metadata_object_chk" CHECK (("jsonb_typeof"("metadata") = 'object'::"text")),
    CONSTRAINT "learning_objects_score_range_chk" CHECK ((("score" IS NULL) OR (("score" >= 0) AND ("score" <= 100)))),
    CONSTRAINT "learning_objects_source_refs_array_chk" CHECK (("jsonb_typeof"("source_refs") = 'array'::"text"))
);


ALTER TABLE "public"."learning_objects" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."learning_quality_scores" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "asignatura_id" "uuid" NOT NULL,
    "unidad_id" "text",
    "tema_id" "text",
    "score_total" integer NOT NULL,
    "rubrica_json" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "recomendaciones_json" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "generation_job_id" "uuid",
    "generado_por" "uuid",
    "calculado_en" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "learning_quality_scores_recomendaciones_array_chk" CHECK (("jsonb_typeof"("recomendaciones_json") = 'array'::"text")),
    CONSTRAINT "learning_quality_scores_rubrica_object_chk" CHECK (("jsonb_typeof"("rubrica_json") = 'object'::"text")),
    CONSTRAINT "learning_quality_scores_total_range_chk" CHECK ((("score_total" >= 0) AND ("score_total" <= 100)))
);


ALTER TABLE "public"."learning_quality_scores" OWNER TO "postgres";


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


CREATE TABLE IF NOT EXISTS "public"."message_file_references" (
    "tenant_id" "uuid" NOT NULL,
    "message_type" "public"."tipo_conversacion_documental" NOT NULL,
    "message_id" "uuid" NOT NULL,
    "file_id" "uuid" NOT NULL,
    "file_version_id" "uuid" NOT NULL,
    "reference_mode" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "message_file_references_reference_mode_check" CHECK (("reference_mode" = ANY (ARRAY['direct'::"text", 'retrieval'::"text"])))
);


ALTER TABLE "public"."message_file_references" OWNER TO "postgres";


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


CREATE TABLE IF NOT EXISTS "public"."observability_test_runs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tipo" "text" NOT NULL,
    "estado" "text" DEFAULT 'pending'::"text" NOT NULL,
    "openai_response_id" "text",
    "started_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "completed_at" timestamp with time zone,
    "latency_ms" integer,
    "error_code" "text",
    "error_message" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_by" "uuid",
    CONSTRAINT "observability_test_runs_estado_check" CHECK (("estado" = ANY (ARRAY['pending'::"text", 'running'::"text", 'completed'::"text", 'failed'::"text", 'unknown'::"text"]))),
    CONSTRAINT "observability_test_runs_tipo_check" CHECK (("tipo" = ANY (ARRAY['openai_foreground'::"text", 'openai_background'::"text", 'webhook_manual'::"text"])))
);

ALTER TABLE ONLY "public"."observability_test_runs" REPLICA IDENTITY FULL;


ALTER TABLE "public"."observability_test_runs" OWNER TO "postgres";


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
    "openai_response_id" "text",
    "web_search_enabled" boolean DEFAULT false NOT NULL,
    "reasoning_effort" "text" DEFAULT 'auto'::"text" NOT NULL,
    "retry_of_message_id" "uuid",
    CONSTRAINT "plan_mensajes_ia_reasoning_effort_check" CHECK (("reasoning_effort" = ANY (ARRAY['auto'::"text", 'none'::"text", 'low'::"text", 'medium'::"text", 'high'::"text"])))
);


ALTER TABLE "public"."plan_mensajes_ia" OWNER TO "postgres";


COMMENT ON COLUMN "public"."plan_mensajes_ia"."web_search_enabled" IS 'Control de búsqueda web congelado para reproducir fielmente una solicitud IA.';



COMMENT ON COLUMN "public"."plan_mensajes_ia"."reasoning_effort" IS 'Esfuerzo de razonamiento congelado para reproducir fielmente una solicitud IA.';



COMMENT ON COLUMN "public"."plan_mensajes_ia"."retry_of_message_id" IS 'Mensaje original cuya solicitud congelada se reutilizó en este reintento.';



CREATE TABLE IF NOT EXISTS "public"."planes_estudio" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "carrera_id" "uuid" NOT NULL,
    "estructura_id" "uuid" NOT NULL,
    "nombre" "text",
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
    "plan_hash" "text" GENERATED ALWAYS AS ("encode"(SUBSTRING("extensions"."digest"(("id")::"text", 'sha512'::"text") FROM 1 FOR 12), 'hex'::"text")) STORED,
    "nombre_propuesto" "text",
    "nombre_display" "text" NOT NULL,
    "fecha_inicio_imparticion" "date",
    "nombre_search" "text" GENERATED ALWAYS AS ("lower"("public"."unaccent_immutable"(COALESCE("nombre_display", ''::"text")))) STORED,
    CONSTRAINT "planes_estudio_numero_ciclos_check" CHECK (("numero_ciclos" > 0))
);


ALTER TABLE "public"."planes_estudio" OWNER TO "postgres";


COMMENT ON COLUMN "public"."planes_estudio"."nombre_propuesto" IS 'Nombre capturado para planes no curriculares. En planes curriculares se mantiene nulo.';



COMMENT ON COLUMN "public"."planes_estudio"."nombre_display" IS 'Nombre final mostrado por la aplicación. Para planes curriculares se calcula desde nivel, carrera y fecha_inicio_imparticion.';



COMMENT ON COLUMN "public"."planes_estudio"."fecha_inicio_imparticion" IS 'Mes de primera generación / inicio de impartición. Se almacena como el primer día del mes.';



CREATE OR REPLACE VIEW "public"."plantilla_asignatura" WITH ("security_invoker"='true') AS
 SELECT "asignaturas"."id" AS "asignatura_id",
    "struct"."id" AS "estructura_id",
    "struct"."template_id"
   FROM ("public"."asignaturas"
     JOIN "public"."estructuras_asignatura" "struct" ON (("asignaturas"."estructura_id" = "struct"."id")));


ALTER VIEW "public"."plantilla_asignatura" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."plantilla_plan" WITH ("security_invoker"='true') AS
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


CREATE TABLE IF NOT EXISTS "public"."registros_oficiales_plan" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "plan_estudio_id" "uuid" NOT NULL,
    "clave_sep" "text" NOT NULL,
    "numero_acuerdo" "text" NOT NULL,
    "autoridad" "text" DEFAULT 'SEP'::"text" NOT NULL,
    "fecha_aprobacion" "date" NOT NULL,
    "vigencia_inicio" "date" NOT NULL,
    "vigencia_fin" "date",
    "documento_archivo_id" "uuid",
    "documento_url" "text",
    "observaciones" "text",
    "registrado_por" "uuid",
    "actualizado_por" "uuid",
    "creado_en" timestamp with time zone DEFAULT "now"() NOT NULL,
    "actualizado_en" timestamp with time zone DEFAULT "now"() NOT NULL,
    "documento_bucket" "text" DEFAULT 'documentos-oficiales'::"text" NOT NULL,
    "documento_path" "text",
    "documento_nombre" "text",
    "documento_mime" "text",
    "documento_size" bigint,
    CONSTRAINT "registros_oficiales_plan_autoridad_not_blank" CHECK (("btrim"("autoridad") <> ''::"text")),
    CONSTRAINT "registros_oficiales_plan_clave_sep_not_blank" CHECK (("btrim"("clave_sep") <> ''::"text")),
    CONSTRAINT "registros_oficiales_plan_documento_chk" CHECK ((("documento_archivo_id" IS NOT NULL) OR (NULLIF("btrim"(COALESCE("documento_path", ''::"text")), ''::"text") IS NOT NULL) OR (NULLIF("btrim"(COALESCE("documento_url", ''::"text")), ''::"text") IS NOT NULL))),
    CONSTRAINT "registros_oficiales_plan_documento_size_chk" CHECK ((("documento_size" IS NULL) OR ("documento_size" >= 0))),
    CONSTRAINT "registros_oficiales_plan_numero_acuerdo_not_blank" CHECK (("btrim"("numero_acuerdo") <> ''::"text")),
    CONSTRAINT "registros_oficiales_plan_vigencia_chk" CHECK ((("vigencia_fin" IS NULL) OR ("vigencia_fin" >= "vigencia_inicio")))
);


ALTER TABLE "public"."registros_oficiales_plan" OWNER TO "postgres";


COMMENT ON TABLE "public"."registros_oficiales_plan" IS 'Ficha oficial SEP/RVOE que respalda el cierre APROBADO de un plan de estudios.';



COMMENT ON COLUMN "public"."registros_oficiales_plan"."clave_sep" IS 'Clave oficial asignada por SEP/RVOE al plan aprobado.';



COMMENT ON COLUMN "public"."registros_oficiales_plan"."numero_acuerdo" IS 'Número de acuerdo, dictamen, folio o documento oficial de aprobación.';



COMMENT ON COLUMN "public"."registros_oficiales_plan"."documento_archivo_id" IS 'Archivo subido a Storage/OpenAI que contiene el dictamen o documento oficial.';



COMMENT ON COLUMN "public"."registros_oficiales_plan"."documento_url" IS 'URL externa del documento oficial cuando no se adjunta archivo interno.';



COMMENT ON COLUMN "public"."registros_oficiales_plan"."documento_bucket" IS 'Bucket privado de Supabase Storage donde vive el documento oficial.';



COMMENT ON COLUMN "public"."registros_oficiales_plan"."documento_path" IS 'Path del documento oficial dentro del bucket de Storage.';



COMMENT ON COLUMN "public"."registros_oficiales_plan"."documento_nombre" IS 'Nombre original del archivo oficial cargado por el usuario.';



COMMENT ON COLUMN "public"."registros_oficiales_plan"."documento_mime" IS 'MIME type reportado por el navegador para el documento oficial.';



COMMENT ON COLUMN "public"."registros_oficiales_plan"."documento_size" IS 'Tamaño en bytes del documento oficial.';



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



CREATE OR REPLACE VIEW "public"."registros_oficiales_plan_detalle" WITH ("security_invoker"='true') AS
 SELECT "rop"."id",
    "rop"."plan_estudio_id",
    "rop"."clave_sep",
    "rop"."numero_acuerdo",
    "rop"."autoridad",
    "rop"."fecha_aprobacion",
    "rop"."vigencia_inicio",
    "rop"."vigencia_fin",
    "rop"."documento_archivo_id",
    "a"."path" AS "documento_archivo_path",
    "rop"."documento_bucket",
    "rop"."documento_path",
    "rop"."documento_nombre",
    "rop"."documento_mime",
    "rop"."documento_size",
    "rop"."documento_url",
    "rop"."observaciones",
    "rop"."registrado_por",
    "rop"."actualizado_por",
    "rop"."creado_en",
    "rop"."actualizado_en",
    "pe"."nombre_display" AS "plan_nombre",
    "pe"."nombre" AS "plan_nombre_legacy",
    "pe"."nombre_propuesto" AS "plan_nombre_propuesto",
    "pe"."fecha_inicio_imparticion",
    "e"."clave" AS "estado_clave",
    "e"."etiqueta" AS "estado_etiqueta",
    "e"."color" AS "estado_color",
    "c"."id" AS "carrera_id",
    "c"."nombre" AS "carrera_nombre",
    "c"."nombre_corto" AS "carrera_nombre_corto",
    "c"."nivel" AS "carrera_nivel",
    "f"."id" AS "facultad_id",
    "f"."nombre" AS "facultad_nombre",
    "f"."nombre_corto" AS "facultad_nombre_corto",
    "f"."prefijo" AS "facultad_prefijo",
    "ua"."nombre_completo" AS "registrado_por_nombre"
   FROM (((((("public"."registros_oficiales_plan" "rop"
     JOIN "public"."planes_estudio" "pe" ON (("pe"."id" = "rop"."plan_estudio_id")))
     LEFT JOIN "public"."estados_plan" "e" ON (("e"."id" = "pe"."estado_actual_id")))
     LEFT JOIN "public"."carreras" "c" ON (("c"."id" = "pe"."carrera_id")))
     LEFT JOIN "public"."facultades" "f" ON (("f"."id" = "c"."facultad_id")))
     LEFT JOIN "public"."archivos" "a" ON (("a"."id" = "rop"."documento_archivo_id")))
     LEFT JOIN "public"."usuarios_app" "ua" ON (("ua"."id" = "rop"."registrado_por")));


ALTER VIEW "public"."registros_oficiales_plan_detalle" OWNER TO "postgres";


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


CREATE TABLE IF NOT EXISTS "public"."tenant_memberships" (
    "tenant_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "is_default" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."tenant_memberships" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tenants" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "slug" "text" NOT NULL,
    "nombre" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "tenants_nombre_check" CHECK (("btrim"("nombre") <> ''::"text")),
    CONSTRAINT "tenants_slug_check" CHECK (("slug" ~ '^[a-z0-9][a-z0-9-]{1,62}$'::"text"))
);


ALTER TABLE "public"."tenants" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."transiciones_estado_plan" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "desde_estado_id" "uuid" NOT NULL,
    "hacia_estado_id" "uuid" NOT NULL,
    "rol_permitido_id" "uuid" NOT NULL,
    "creado_en" timestamp with time zone DEFAULT "now"() NOT NULL,
    "tipo_estructura" "public"."tipo_estructura_plan",
    CONSTRAINT "transiciones_no_auto_chk" CHECK (("desde_estado_id" <> "hacia_estado_id"))
);


ALTER TABLE "public"."transiciones_estado_plan" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."upload_sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "temporary_path" "text" NOT NULL,
    "original_filename" "text" NOT NULL,
    "declared_mime" "text" NOT NULL,
    "declared_size" bigint NOT NULL,
    "client_sha256" "text",
    "status" "public"."estado_sesion_carga_documento" DEFAULT 'created'::"public"."estado_sesion_carga_documento" NOT NULL,
    "result_file_id" "uuid",
    "error_code" "text",
    "expires_at" timestamp with time zone DEFAULT ("now"() + '24:00:00'::interval) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "completed_at" timestamp with time zone,
    CONSTRAINT "upload_sessions_client_sha256_check" CHECK ((("client_sha256" IS NULL) OR ("client_sha256" ~ '^[a-f0-9]{64}$'::"text"))),
    CONSTRAINT "upload_sessions_declared_size_check" CHECK ((("declared_size" > 0) AND ("declared_size" <= 20971520))),
    CONSTRAINT "upload_sessions_original_filename_check" CHECK ((("char_length"("original_filename") >= 1) AND ("char_length"("original_filename") <= 255))),
    CONSTRAINT "upload_sessions_temporary_path_check" CHECK (("temporary_path" ~ '^tmp/[0-9a-f-]+/[0-9a-f-]+/[0-9a-f-]+$'::"text"))
);


ALTER TABLE "public"."upload_sessions" OWNER TO "postgres";


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


ALTER TABLE ONLY "private"."intentos_generacion_ia"
    ADD CONSTRAINT "intentos_chat_ia_openai_response_id_key" UNIQUE ("openai_response_id");



ALTER TABLE ONLY "private"."intentos_generacion_ia"
    ADD CONSTRAINT "intentos_chat_ia_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ai_request_references"
    ADD CONSTRAINT "ai_request_references_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ai_request_references"
    ADD CONSTRAINT "ai_request_references_request_id_file_version_id_mode_key" UNIQUE ("request_id", "file_version_id", "mode");



ALTER TABLE ONLY "public"."archivos_repositorios"
    ADD CONSTRAINT "archivos_repositorios_pkey" PRIMARY KEY ("archivo_id", "repositorio_id");



ALTER TABLE ONLY "public"."archivos"
    ADD CONSTRAINT "archivos_usuarios_hash_key" UNIQUE ("hash");



ALTER TABLE ONLY "public"."archivos"
    ADD CONSTRAINT "archivos_usuarios_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."asignatura_mensajes_ia"
    ADD CONSTRAINT "asignatura_mensajes_ia_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."asignatura_mensajes_ia"
    ADD CONSTRAINT "asignatura_mensajes_ia_retry_identity_key" UNIQUE ("id", "conversacion_asignatura_id", "enviado_por");



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



ALTER TABLE ONLY "public"."collection_files"
    ADD CONSTRAINT "collection_files_pkey" PRIMARY KEY ("collection_id", "file_id");



ALTER TABLE ONLY "public"."collections"
    ADD CONSTRAINT "collections_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."comentarios_adjuntos"
    ADD CONSTRAINT "comentarios_adjuntos_pkey" PRIMARY KEY ("id");



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



ALTER TABLE ONLY "public"."conversation_files"
    ADD CONSTRAINT "conversation_files_pkey" PRIMARY KEY ("conversation_type", "conversation_id", "file_id");



ALTER TABLE ONLY "public"."crash_reports"
    ADD CONSTRAINT "crash_reports_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."document_chunks"
    ADD CONSTRAINT "document_chunks_file_version_id_chunk_index_chunker_version_key" UNIQUE ("file_version_id", "chunk_index", "chunker_version");



ALTER TABLE ONLY "public"."document_chunks"
    ADD CONSTRAINT "document_chunks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."document_extractions"
    ADD CONSTRAINT "document_extractions_file_version_id_provider_page_from_pag_key" UNIQUE NULLS NOT DISTINCT ("file_version_id", "provider", "page_from", "page_to", "schema_version");



ALTER TABLE ONLY "public"."document_extractions"
    ADD CONSTRAINT "document_extractions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."document_webhook_events"
    ADD CONSTRAINT "document_webhook_events_pkey" PRIMARY KEY ("event_id");



ALTER TABLE ONLY "public"."ejecuciones_recuperacion_ia"
    ADD CONSTRAINT "ejecuciones_recuperacion_ia_pkey" PRIMARY KEY ("id");



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



ALTER TABLE ONLY "public"."file_blobs"
    ADD CONSTRAINT "file_blobs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."file_blobs"
    ADD CONSTRAINT "file_blobs_storage_path_key" UNIQUE ("storage_path");



ALTER TABLE ONLY "public"."file_blobs"
    ADD CONSTRAINT "file_blobs_tenant_id_sha256_size_bytes_key" UNIQUE ("tenant_id", "sha256", "size_bytes");



ALTER TABLE ONLY "public"."file_events"
    ADD CONSTRAINT "file_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."file_grants"
    ADD CONSTRAINT "file_grants_file_id_subject_type_subject_id_permission_key" UNIQUE ("file_id", "subject_type", "subject_id", "permission");



ALTER TABLE ONLY "public"."file_grants"
    ADD CONSTRAINT "file_grants_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."file_user_state"
    ADD CONSTRAINT "file_user_state_pkey" PRIMARY KEY ("tenant_id", "user_id", "file_id");



ALTER TABLE ONLY "public"."file_versions"
    ADD CONSTRAINT "file_versions_file_id_version_number_key" UNIQUE ("file_id", "version_number");



ALTER TABLE ONLY "public"."file_versions"
    ADD CONSTRAINT "file_versions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."file_versions"
    ADD CONSTRAINT "file_versions_tenant_id_id_key" UNIQUE ("tenant_id", "id");



ALTER TABLE ONLY "public"."files"
    ADD CONSTRAINT "files_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ingestion_jobs"
    ADD CONSTRAINT "ingestion_jobs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ingestion_jobs"
    ADD CONSTRAINT "ingestion_jobs_tenant_id_idempotency_key_key" UNIQUE ("tenant_id", "idempotency_key");



ALTER TABLE ONLY "public"."interacciones_ia"
    ADD CONSTRAINT "interacciones_ia_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."learning_generation_jobs"
    ADD CONSTRAINT "learning_generation_jobs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."learning_objects"
    ADD CONSTRAINT "learning_objects_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."learning_quality_scores"
    ADD CONSTRAINT "learning_quality_scores_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."lineas_curriculares_sugeridas"
    ADD CONSTRAINT "lineas_curriculares_sugeridas_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."lineas_plan"
    ADD CONSTRAINT "lineas_plan_id_plan_unico" UNIQUE ("id", "plan_estudio_id");



ALTER TABLE ONLY "public"."lineas_plan"
    ADD CONSTRAINT "lineas_plan_nombre_unico" UNIQUE ("plan_estudio_id", "nombre");



ALTER TABLE ONLY "public"."lineas_plan"
    ADD CONSTRAINT "lineas_plan_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."message_file_references"
    ADD CONSTRAINT "message_file_references_pkey" PRIMARY KEY ("message_type", "message_id", "file_id", "file_version_id");



ALTER TABLE ONLY "public"."notificaciones"
    ADD CONSTRAINT "notificaciones_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."observability_test_runs"
    ADD CONSTRAINT "observability_test_runs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."observability_webhook_events"
    ADD CONSTRAINT "observability_webhook_events_event_id_key" UNIQUE ("event_id");



ALTER TABLE ONLY "public"."observability_webhook_events"
    ADD CONSTRAINT "observability_webhook_events_pkey" PRIMARY KEY ("id");



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



ALTER TABLE ONLY "public"."plan_mensajes_ia"
    ADD CONSTRAINT "plan_mensajes_ia_retry_identity_key" UNIQUE ("id", "conversacion_plan_id", "enviado_por");



ALTER TABLE ONLY "public"."planes_estudio"
    ADD CONSTRAINT "planes_estudio_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."reasignaciones"
    ADD CONSTRAINT "reasignaciones_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."registros_oficiales_plan"
    ADD CONSTRAINT "registros_oficiales_plan_clave_sep_unique" UNIQUE ("clave_sep");



ALTER TABLE ONLY "public"."registros_oficiales_plan"
    ADD CONSTRAINT "registros_oficiales_plan_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."registros_oficiales_plan"
    ADD CONSTRAINT "registros_oficiales_plan_plan_unique" UNIQUE ("plan_estudio_id");



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



ALTER TABLE ONLY "public"."tenant_memberships"
    ADD CONSTRAINT "tenant_memberships_pkey" PRIMARY KEY ("tenant_id", "user_id");



ALTER TABLE ONLY "public"."tenants"
    ADD CONSTRAINT "tenants_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tenants"
    ADD CONSTRAINT "tenants_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."trabajos_generacion_ia"
    ADD CONSTRAINT "trabajos_generacion_ia_entidad_response_unique" UNIQUE ("tipo_entidad", "entidad_id", "openai_response_id");



ALTER TABLE ONLY "public"."trabajos_generacion_ia"
    ADD CONSTRAINT "trabajos_generacion_ia_openai_response_id_key" UNIQUE ("openai_response_id");



ALTER TABLE ONLY "public"."trabajos_generacion_ia"
    ADD CONSTRAINT "trabajos_generacion_ia_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."transiciones_estado_plan"
    ADD CONSTRAINT "transiciones_estado_plan_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."transiciones_estado_plan"
    ADD CONSTRAINT "transiciones_unica_typed" UNIQUE ("desde_estado_id", "hacia_estado_id", "rol_permitido_id", "tipo_estructura");



ALTER TABLE ONLY "public"."upload_sessions"
    ADD CONSTRAINT "upload_sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."upload_sessions"
    ADD CONSTRAINT "upload_sessions_temporary_path_key" UNIQUE ("temporary_path");



ALTER TABLE ONLY "public"."usuarios_app"
    ADD CONSTRAINT "usuarios_app_clave_unique" UNIQUE ("clave");



ALTER TABLE ONLY "public"."usuarios_app"
    ADD CONSTRAINT "usuarios_app_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."usuarios_roles"
    ADD CONSTRAINT "usuarios_roles_pkey" PRIMARY KEY ("id");



CREATE UNIQUE INDEX "intentos_generacion_ia_entidad_activa_idx" ON "private"."intentos_generacion_ia" USING "btree" ("handler", "tipo_entidad", "entidad_id") WHERE ("estado" = ANY (ARRAY['preparado'::"text", 'reclamado'::"text", 'respuesta_vinculada'::"text"]));



CREATE INDEX "intentos_generacion_ia_recuperables_idx" ON "private"."intentos_generacion_ia" USING "btree" ("handler", "siguiente_intento", "creado_en") WHERE ("estado" = ANY (ARRAY['preparado'::"text", 'reclamado'::"text", 'respuesta_vinculada'::"text"]));



CREATE INDEX "intentos_generacion_ia_terminal_pendiente_idx" ON "private"."intentos_generacion_ia" USING "btree" ("handler", "actualizado_en") WHERE (("estado" = ANY (ARRAY['fallido'::"text", 'expirado'::"text"])) AND ("terminal_aplicado_en" IS NULL));



CREATE INDEX "ai_request_references_conversation_file_idx" ON "public"."ai_request_references" USING "btree" ("tenant_id", "conversation_type", "conversation_id", "file_id", "created_at");



CREATE INDEX "ai_request_references_message_idx" ON "public"."ai_request_references" USING "btree" ("tenant_id", "message_id", "created_at" DESC);



CREATE INDEX "archivos_creado_por_idx" ON "public"."archivos" USING "btree" ("creado_por");



CREATE INDEX "archivos_repositorios_repositorio_id_idx" ON "public"."archivos_repositorios" USING "btree" ("repositorio_id");



CREATE INDEX "asignatura_mensajes_ia_conversacion_asignatura_id_idx" ON "public"."asignatura_mensajes_ia" USING "btree" ("conversacion_asignatura_id");



CREATE INDEX "asignatura_mensajes_ia_retry_of_message_id_idx" ON "public"."asignatura_mensajes_ia" USING "btree" ("retry_of_message_id") WHERE ("retry_of_message_id" IS NOT NULL);



CREATE INDEX "asignaturas_actualizado_por_idx" ON "public"."asignaturas" USING "btree" ("actualizado_por");



CREATE INDEX "asignaturas_creado_por_idx" ON "public"."asignaturas" USING "btree" ("creado_por");



CREATE INDEX "asignaturas_estructura_id_idx" ON "public"."asignaturas" USING "btree" ("estructura_id");



CREATE INDEX "asignaturas_linea_plan_id_plan_estudio_id_idx" ON "public"."asignaturas" USING "btree" ("linea_plan_id", "plan_estudio_id");



CREATE UNIQUE INDEX "asignaturas_orden_celda_unico" ON "public"."asignaturas" USING "btree" ("plan_estudio_id", "linea_plan_id", "numero_ciclo", "orden_celda") WHERE (("linea_plan_id" IS NOT NULL) AND ("numero_ciclo" IS NOT NULL) AND ("orden_celda" IS NOT NULL));



CREATE INDEX "asignaturas_plan_linea_ciclo_idx" ON "public"."asignaturas" USING "btree" ("plan_estudio_id", "linea_plan_id", "numero_ciclo");



CREATE INDEX "asignaturas_prerrequisito_idx" ON "public"."asignaturas" USING "btree" ("prerrequisito_asignatura_id");



CREATE INDEX "asignaturas_search_vector_gin_idx" ON "public"."asignaturas" USING "gin" ("search_vector");



CREATE INDEX "bibliografia_asignatura_creado_por_idx" ON "public"."bibliografia_asignatura" USING "btree" ("creado_por");



CREATE INDEX "bibliografia_asignatura_idx" ON "public"."bibliografia_asignatura" USING "btree" ("asignatura_id");



CREATE INDEX "borradores_campo_actualizado_por_idx" ON "public"."borradores_campo" USING "btree" ("actualizado_por");



CREATE INDEX "borradores_campo_creado_por_idx" ON "public"."borradores_campo" USING "btree" ("creado_por");



CREATE INDEX "cambios_asignatura_asignatura_id_idx" ON "public"."cambios_asignatura" USING "btree" ("asignatura_id");



CREATE INDEX "cambios_asignatura_cambiado_por_idx" ON "public"."cambios_asignatura" USING "btree" ("cambiado_por");



CREATE INDEX "cambios_plan_cambiado_por_idx" ON "public"."cambios_plan" USING "btree" ("cambiado_por");



CREATE INDEX "carreras_actualizado_por_idx" ON "public"."carreras" USING "btree" ("actualizado_por");



CREATE INDEX "carreras_creado_por_idx" ON "public"."carreras" USING "btree" ("creado_por");



CREATE INDEX "carreras_facultad_id_idx" ON "public"."carreras" USING "btree" ("facultad_id");



CREATE INDEX "collection_files_file_idx" ON "public"."collection_files" USING "btree" ("tenant_id", "file_id");



CREATE UNIQUE INDEX "collections_personal_nombre_unique_idx" ON "public"."collections" USING "btree" ("tenant_id", "created_by", "lower"("btrim"("name"))) WHERE (("kind" = 'collection'::"text") AND ("status" = 'active'::"text"));



CREATE UNIQUE INDEX "collections_repositorio_nombre_unique_idx" ON "public"."collections" USING "btree" ("tenant_id", "lower"("btrim"("name"))) WHERE (("kind" = 'curriculum_repository'::"text") AND ("status" = 'active'::"text"));



CREATE INDEX "collections_tenant_kind_idx" ON "public"."collections" USING "btree" ("tenant_id", "kind", "updated_at" DESC) WHERE ("status" = 'active'::"text");



CREATE INDEX "comentarios_adjuntos_comentario_idx" ON "public"."comentarios_adjuntos" USING "btree" ("comentario_id");



CREATE INDEX "comentarios_adjuntos_plan_idx" ON "public"."comentarios_adjuntos" USING "btree" ("plan_estudio_id");



CREATE INDEX "comentarios_adjuntos_storage_idx" ON "public"."comentarios_adjuntos" USING "btree" ("bucket", "path");



CREATE INDEX "comentarios_asignatura_asig_idx" ON "public"."comentarios_asignatura" USING "btree" ("asignatura_id", "creado_en" DESC);



CREATE INDEX "comentarios_asignatura_autor_id_idx" ON "public"."comentarios_asignatura" USING "btree" ("autor_id");



CREATE INDEX "comentarios_asignatura_comentario_padre_id_idx" ON "public"."comentarios_asignatura" USING "btree" ("comentario_padre_id");



CREATE INDEX "comentarios_plan_asignatura_idx" ON "public"."comentarios_plan" USING "btree" ("asignatura_id");



CREATE INDEX "comentarios_plan_autor_id_idx" ON "public"."comentarios_plan" USING "btree" ("autor_id");



CREATE INDEX "comentarios_plan_comentario_padre_id_idx" ON "public"."comentarios_plan" USING "btree" ("comentario_padre_id");



CREATE INDEX "comentarios_plan_estado_id_idx" ON "public"."comentarios_plan" USING "btree" ("estado_id");



CREATE INDEX "comentarios_plan_plan_idx" ON "public"."comentarios_plan" USING "btree" ("plan_estudio_id", "creado_en" DESC);



CREATE INDEX "conversaciones_asignatura_archivado_por_idx" ON "public"."conversaciones_asignatura" USING "btree" ("archivado_por");



CREATE INDEX "conversaciones_asignatura_creado_por_idx" ON "public"."conversaciones_asignatura" USING "btree" ("creado_por");



CREATE INDEX "conversaciones_plan_archivado_por_idx" ON "public"."conversaciones_plan" USING "btree" ("archivado_por");



CREATE INDEX "conversaciones_plan_creado_por_idx" ON "public"."conversaciones_plan" USING "btree" ("creado_por");



CREATE INDEX "conversation_files_active_idx" ON "public"."conversation_files" USING "btree" ("tenant_id", "conversation_type", "conversation_id") WHERE ("removed_at" IS NULL);



CREATE INDEX "crash_reports_resuelto_por_idx" ON "public"."crash_reports" USING "btree" ("resuelto_por");



CREATE INDEX "crash_reports_usuario_idx" ON "public"."crash_reports" USING "btree" ("usuario_id") WHERE ("usuario_id" IS NOT NULL);



CREATE INDEX "document_chunks_embedding_hnsw_idx" ON "public"."document_chunks" USING "hnsw" ("embedding" "extensions"."vector_cosine_ops") WHERE ("embedding" IS NOT NULL);



CREATE INDEX "document_chunks_fts_idx" ON "public"."document_chunks" USING "gin" ("search_vector");



CREATE INDEX "document_chunks_version_idx" ON "public"."document_chunks" USING "btree" ("tenant_id", "file_version_id", "chunk_index");



CREATE INDEX "document_extractions_pending_idx" ON "public"."document_extractions" USING "btree" ("tenant_id", "status", "created_at") WHERE ("status" = ANY (ARRAY['pending'::"text", 'processing'::"text", 'waiting_provider'::"text"]));



CREATE INDEX "document_extractions_provider_idx" ON "public"."document_extractions" USING "btree" ("provider_response_id") WHERE ("provider_response_id" IS NOT NULL);



CREATE UNIQUE INDEX "document_extractions_provider_response_unique_idx" ON "public"."document_extractions" USING "btree" ("provider", "provider_response_id") WHERE ("provider_response_id" IS NOT NULL);



CREATE INDEX "document_webhook_events_response_idx" ON "public"."document_webhook_events" USING "btree" ("provider_response_id", "received_at" DESC);



CREATE INDEX "ejecuciones_recuperacion_ia_iniciado_en_idx" ON "public"."ejecuciones_recuperacion_ia" USING "btree" ("iniciado_en" DESC);



CREATE INDEX "estructuras_asignatura_actualizado_por_idx" ON "public"."estructuras_asignatura" USING "btree" ("actualizado_por");



CREATE INDEX "estructuras_asignatura_creado_por_idx" ON "public"."estructuras_asignatura" USING "btree" ("creado_por");



CREATE INDEX "estructuras_plan_actualizado_por_idx" ON "public"."estructuras_plan" USING "btree" ("actualizado_por");



CREATE INDEX "estructuras_plan_creado_por_idx" ON "public"."estructuras_plan" USING "btree" ("creado_por");



CREATE INDEX "expertos_creado_por_idx" ON "public"."expertos" USING "btree" ("creado_por");



CREATE INDEX "expertos_usuario_id_idx" ON "public"."expertos" USING "btree" ("usuario_id");



CREATE INDEX "facultades_actualizado_por_idx" ON "public"."facultades" USING "btree" ("actualizado_por");



CREATE INDEX "facultades_creado_por_idx" ON "public"."facultades" USING "btree" ("creado_por");



CREATE INDEX "file_blobs_gc_idx" ON "public"."file_blobs" USING "btree" ("deleted_at") WHERE ("deleted_at" IS NOT NULL);



CREATE INDEX "file_events_tenant_file_idx" ON "public"."file_events" USING "btree" ("tenant_id", "file_id", "created_at" DESC);



CREATE INDEX "file_grants_lookup_idx" ON "public"."file_grants" USING "btree" ("tenant_id", "subject_type", "subject_id", "permission") WHERE ("expires_at" IS NULL);



CREATE INDEX "file_versions_blob_idx" ON "public"."file_versions" USING "btree" ("blob_id");



CREATE INDEX "file_versions_file_idx" ON "public"."file_versions" USING "btree" ("file_id", "version_number" DESC);



CREATE INDEX "files_tenant_visible_idx" ON "public"."files" USING "btree" ("tenant_id", "updated_at" DESC) WHERE ("deleted_at" IS NULL);



CREATE INDEX "idx_borradores_campo_entidad" ON "public"."borradores_campo" USING "btree" ("entidad", "entidad_id");



CREATE INDEX "idx_borradores_campo_plan" ON "public"."borradores_campo" USING "btree" ("plan_id", "actualizado_en" DESC);



CREATE INDEX "idx_conv_asig_asignatura" ON "public"."conversaciones_asignatura" USING "btree" ("asignatura_id");



CREATE INDEX "idx_conv_plan_plan_estudio" ON "public"."conversaciones_plan" USING "btree" ("plan_estudio_id");



CREATE INDEX "idx_estructuras_asignatura_estructura_plan" ON "public"."estructuras_asignatura" USING "btree" ("estructura_plan_id", "nombre");



CREATE INDEX "idx_planes_nombre_search" ON "public"."planes_estudio" USING "btree" ("nombre_search");



CREATE INDEX "ingestion_jobs_claim_idx" ON "public"."ingestion_jobs" USING "btree" ("available_at", "created_at") WHERE ("status" = ANY (ARRAY['pending'::"public"."estado_trabajo_ingesta_documental", 'retry'::"public"."estado_trabajo_ingesta_documental"]));



CREATE INDEX "ingestion_jobs_locked_idx" ON "public"."ingestion_jobs" USING "btree" ("locked_at") WHERE ("status" = 'processing'::"public"."estado_trabajo_ingesta_documental");



CREATE INDEX "interacciones_ia_asignatura_id_idx" ON "public"."interacciones_ia" USING "btree" ("asignatura_id");



CREATE INDEX "interacciones_ia_plan_estudio_id_idx" ON "public"."interacciones_ia" USING "btree" ("plan_estudio_id");



CREATE INDEX "interacciones_ia_usuario_id_idx" ON "public"."interacciones_ia" USING "btree" ("usuario_id");



CREATE INDEX "learning_generation_jobs_asignatura_target_idx" ON "public"."learning_generation_jobs" USING "btree" ("asignatura_id", "scope", "unidad_id", "tema_id", "creado_en" DESC);



CREATE INDEX "learning_generation_jobs_intento_activo_idx" ON "public"."learning_generation_jobs" USING "btree" ("intento_generacion_activo_id") WHERE ("intento_generacion_activo_id" IS NOT NULL);



CREATE INDEX "learning_objects_asignatura_target_idx" ON "public"."learning_objects" USING "btree" ("asignatura_id", "unidad_id", "tema_id", "tipo", "creado_en" DESC);



CREATE INDEX "learning_objects_generation_job_idx" ON "public"."learning_objects" USING "btree" ("generation_job_id");



CREATE UNIQUE INDEX "learning_quality_scores_scope_uidx" ON "public"."learning_quality_scores" USING "btree" ("asignatura_id", COALESCE("unidad_id", ''::"text"), COALESCE("tema_id", ''::"text"));



CREATE INDEX "learning_quality_scores_target_idx" ON "public"."learning_quality_scores" USING "btree" ("asignatura_id", "unidad_id", "tema_id", "calculado_en" DESC);



CREATE INDEX "lineas_curriculares_sugeridas_actualizado_por_idx" ON "public"."lineas_curriculares_sugeridas" USING "btree" ("actualizado_por");



CREATE INDEX "lineas_curriculares_sugeridas_creado_por_idx" ON "public"."lineas_curriculares_sugeridas" USING "btree" ("creado_por");



CREATE INDEX "lineas_curriculares_sugeridas_facultad_idx" ON "public"."lineas_curriculares_sugeridas" USING "btree" ("facultad_id", "orden");



CREATE UNIQUE INDEX "lineas_curriculares_sugeridas_facultad_nombre_uq" ON "public"."lineas_curriculares_sugeridas" USING "btree" ("facultad_id", "lower"("nombre"));



CREATE INDEX "lineas_plan_actualizado_por_idx" ON "public"."lineas_plan" USING "btree" ("actualizado_por");



CREATE INDEX "lineas_plan_creado_por_idx" ON "public"."lineas_plan" USING "btree" ("creado_por");



CREATE INDEX "message_file_references_file_idx" ON "public"."message_file_references" USING "btree" ("tenant_id", "file_id", "created_at" DESC);



CREATE INDEX "notificaciones_usuario_id_idx" ON "public"."notificaciones" USING "btree" ("usuario_id");



CREATE INDEX "observability_test_runs_response_id_idx" ON "public"."observability_test_runs" USING "btree" ("openai_response_id") WHERE ("openai_response_id" IS NOT NULL);



CREATE INDEX "observability_test_runs_started_at_idx" ON "public"."observability_test_runs" USING "btree" ("started_at" DESC);



CREATE INDEX "observability_webhook_events_received_at_idx" ON "public"."observability_webhook_events" USING "btree" ("received_at" DESC);



CREATE INDEX "observability_webhook_events_response_id_idx" ON "public"."observability_webhook_events" USING "btree" ("openai_response_id") WHERE ("openai_response_id" IS NOT NULL);



CREATE INDEX "plan_expertos_experto_id_idx" ON "public"."plan_expertos" USING "btree" ("experto_id");



CREATE INDEX "plan_mensajes_ia_conversacion_plan_id_idx" ON "public"."plan_mensajes_ia" USING "btree" ("conversacion_plan_id");



CREATE INDEX "plan_mensajes_ia_retry_of_message_id_idx" ON "public"."plan_mensajes_ia" USING "btree" ("retry_of_message_id") WHERE ("retry_of_message_id" IS NOT NULL);



CREATE INDEX "planes_estudio_actualizado_por_idx" ON "public"."planes_estudio" USING "btree" ("actualizado_por");



CREATE INDEX "planes_estudio_carrera_id_idx" ON "public"."planes_estudio" USING "btree" ("carrera_id");



CREATE INDEX "planes_estudio_creado_por_idx" ON "public"."planes_estudio" USING "btree" ("creado_por");



CREATE INDEX "planes_estudio_estado_actual_id_idx" ON "public"."planes_estudio" USING "btree" ("estado_actual_id");



CREATE INDEX "planes_estudio_estructura_id_idx" ON "public"."planes_estudio" USING "btree" ("estructura_id");



CREATE INDEX "reasignaciones_reasignado_por_idx" ON "public"."reasignaciones" USING "btree" ("reasignado_por");



CREATE INDEX "reasignaciones_usuario_destino_idx" ON "public"."reasignaciones" USING "btree" ("usuario_destino");



CREATE INDEX "reasignaciones_usuario_origen_idx" ON "public"."reasignaciones" USING "btree" ("usuario_origen");



CREATE INDEX "registros_oficiales_plan_documento_archivo_idx" ON "public"."registros_oficiales_plan" USING "btree" ("documento_archivo_id");



CREATE INDEX "registros_oficiales_plan_documento_storage_idx" ON "public"."registros_oficiales_plan" USING "btree" ("documento_bucket", "documento_path");



CREATE INDEX "registros_oficiales_plan_plan_idx" ON "public"."registros_oficiales_plan" USING "btree" ("plan_estudio_id");



CREATE INDEX "registros_oficiales_plan_vigencia_fin_idx" ON "public"."registros_oficiales_plan" USING "btree" ("vigencia_fin");



CREATE INDEX "registros_oficiales_plan_vigencia_inicio_idx" ON "public"."registros_oficiales_plan" USING "btree" ("vigencia_inicio");



CREATE INDEX "responsables_asignatura_asignado_por_idx" ON "public"."responsables_asignatura" USING "btree" ("asignado_por");



CREATE INDEX "responsables_asignatura_usuario_id_idx" ON "public"."responsables_asignatura" USING "btree" ("usuario_id");



CREATE INDEX "roles_permisos_permiso_id_idx" ON "public"."roles_permisos" USING "btree" ("permiso_id");



CREATE INDEX "tareas_revision_asignado_a_idx" ON "public"."tareas_revision" USING "btree" ("asignado_a");



CREATE INDEX "tareas_revision_creado_por_idx" ON "public"."tareas_revision" USING "btree" ("creado_por");



CREATE INDEX "tareas_revision_estado_id_idx" ON "public"."tareas_revision" USING "btree" ("estado_id");



CREATE INDEX "tareas_revision_plan_estudio_id_idx" ON "public"."tareas_revision" USING "btree" ("plan_estudio_id");



CREATE INDEX "tareas_revision_rol_id_idx" ON "public"."tareas_revision" USING "btree" ("rol_id");



CREATE UNIQUE INDEX "tenant_memberships_one_default_per_user_idx" ON "public"."tenant_memberships" USING "btree" ("user_id") WHERE "is_default";



CREATE INDEX "trabajos_generacion_ia_arrendamientos_idx" ON "public"."trabajos_generacion_ia" USING "btree" ("reclamado_hasta") WHERE ("estado" = 'reclamado'::"public"."estado_trabajo_generacion_ia");



CREATE INDEX "trabajos_generacion_ia_cola_idx" ON "public"."trabajos_generacion_ia" USING "btree" ("proxima_revision_en", "creado_en") WHERE ("estado" = ANY (ARRAY['pendiente'::"public"."estado_trabajo_generacion_ia", 'reclamado'::"public"."estado_trabajo_generacion_ia"]));



CREATE UNIQUE INDEX "trabajos_generacion_ia_entidad_activa_idx" ON "public"."trabajos_generacion_ia" USING "btree" ("tipo_entidad", "entidad_id") WHERE ("estado" = ANY (ARRAY['pendiente'::"public"."estado_trabajo_generacion_ia", 'reclamado'::"public"."estado_trabajo_generacion_ia"]));



CREATE INDEX "trabajos_generacion_ia_terminales_idx" ON "public"."trabajos_generacion_ia" USING "btree" ("completado_en") WHERE ("estado" = ANY (ARRAY['completado'::"public"."estado_trabajo_generacion_ia", 'fallido'::"public"."estado_trabajo_generacion_ia", 'cancelado'::"public"."estado_trabajo_generacion_ia", 'incompleto'::"public"."estado_trabajo_generacion_ia", 'expirado'::"public"."estado_trabajo_generacion_ia", 'obsoleto'::"public"."estado_trabajo_generacion_ia"]));



CREATE INDEX "transiciones_estado_plan_hacia_estado_id_idx" ON "public"."transiciones_estado_plan" USING "btree" ("hacia_estado_id");



CREATE INDEX "transiciones_estado_plan_rol_permitido_id_idx" ON "public"."transiciones_estado_plan" USING "btree" ("rol_permitido_id");



CREATE INDEX "upload_sessions_pending_idx" ON "public"."upload_sessions" USING "btree" ("tenant_id", "status", "expires_at") WHERE ("status" <> ALL (ARRAY['ready'::"public"."estado_sesion_carga_documento", 'failed'::"public"."estado_sesion_carga_documento", 'expired'::"public"."estado_sesion_carga_documento"]));



CREATE INDEX "usuarios_app_invitado_por_idx" ON "public"."usuarios_app" USING "btree" ("invitado_por");



CREATE INDEX "usuarios_roles_asignado_por_idx" ON "public"."usuarios_roles" USING "btree" ("asignado_por");



CREATE INDEX "usuarios_roles_carrera_id_idx" ON "public"."usuarios_roles" USING "btree" ("carrera_id");



CREATE INDEX "usuarios_roles_facultad_id_idx" ON "public"."usuarios_roles" USING "btree" ("facultad_id");



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



CREATE OR REPLACE TRIGGER "carreras_guard_scoped_catalog_update" BEFORE UPDATE ON "public"."carreras" FOR EACH ROW EXECUTE FUNCTION "public"."carreras_guard_scoped_catalog_update"();



CREATE OR REPLACE TRIGGER "facultades_guard_scoped_catalog_update" BEFORE UPDATE ON "public"."facultades" FOR EACH ROW EXECUTE FUNCTION "public"."facultades_guard_scoped_catalog_update"();



CREATE OR REPLACE TRIGGER "trg_ai_request_references_tenant" BEFORE INSERT OR UPDATE ON "public"."ai_request_references" FOR EACH ROW EXECUTE FUNCTION "private"."documentos_validar_mismo_tenant"();



CREATE OR REPLACE TRIGGER "trg_asignaturas_actualizado_en" BEFORE UPDATE ON "public"."asignaturas" FOR EACH ROW EXECUTE FUNCTION "public"."set_actualizado_en"();



CREATE OR REPLACE TRIGGER "trg_asignaturas_contenido_tematico_ensure_ids" BEFORE INSERT OR UPDATE ON "public"."asignaturas" FOR EACH ROW EXECUTE FUNCTION "public"."fn_asignaturas_contenido_tematico_ensure_ids"();



CREATE OR REPLACE TRIGGER "trg_asignaturas_search_vector" BEFORE INSERT OR UPDATE OF "nombre", "codigo", "datos", "contenido_tematico" ON "public"."asignaturas" FOR EACH ROW EXECUTE FUNCTION "public"."fn_asignaturas_update_search_vector"();



CREATE OR REPLACE TRIGGER "trg_bibliografia_asignatura_actualizado_en" BEFORE UPDATE ON "public"."bibliografia_asignatura" FOR EACH ROW EXECUTE FUNCTION "public"."set_actualizado_en"();



CREATE OR REPLACE TRIGGER "trg_bibliografia_asignatura_log_cambios" AFTER INSERT OR DELETE OR UPDATE ON "public"."bibliografia_asignatura" FOR EACH ROW EXECUTE FUNCTION "public"."fn_log_bibliografia_asignatura_cambios"();



CREATE OR REPLACE TRIGGER "trg_borradores_campo_actualizado_en" BEFORE UPDATE ON "public"."borradores_campo" FOR EACH ROW EXECUTE FUNCTION "public"."set_actualizado_en"();



CREATE OR REPLACE TRIGGER "trg_carreras_actualizado_en" BEFORE UPDATE ON "public"."carreras" FOR EACH ROW EXECUTE FUNCTION "public"."set_actualizado_en"();



CREATE OR REPLACE TRIGGER "trg_carreras_refresh_planes_nombre_display" AFTER UPDATE OF "nombre", "nivel" ON "public"."carreras" FOR EACH ROW WHEN ((("old"."nombre" IS DISTINCT FROM "new"."nombre") OR ("old"."nivel" IS DISTINCT FROM "new"."nivel"))) EXECUTE FUNCTION "public"."fn_carreras_refresh_planes_nombre_display"();



CREATE OR REPLACE TRIGGER "trg_collection_files_tenant" BEFORE INSERT OR UPDATE ON "public"."collection_files" FOR EACH ROW EXECUTE FUNCTION "private"."documentos_validar_mismo_tenant"();



CREATE OR REPLACE TRIGGER "trg_collections_actualizado_en" BEFORE UPDATE ON "public"."collections" FOR EACH ROW EXECUTE FUNCTION "private"."documentos_actualizar_timestamp"();



CREATE OR REPLACE TRIGGER "trg_comentarios_asignatura_notificar" AFTER INSERT ON "public"."comentarios_asignatura" FOR EACH ROW EXECUTE FUNCTION "public"."fn_notificar_comentario_asignatura"();



CREATE OR REPLACE TRIGGER "trg_comentarios_plan_notificar" AFTER INSERT ON "public"."comentarios_plan" FOR EACH ROW EXECUTE FUNCTION "public"."fn_notificar_comentario_plan"();



CREATE OR REPLACE TRIGGER "trg_conversation_files_referencia_usada" BEFORE DELETE OR UPDATE OF "removed_at" ON "public"."conversation_files" FOR EACH ROW EXECUTE FUNCTION "private"."documentos_impedir_retiro_referencia_usada"();



CREATE OR REPLACE TRIGGER "trg_conversation_files_tenant" BEFORE INSERT OR UPDATE ON "public"."conversation_files" FOR EACH ROW EXECUTE FUNCTION "private"."documentos_validar_mismo_tenant"();



CREATE OR REPLACE TRIGGER "trg_document_chunks_tenant" BEFORE INSERT OR UPDATE ON "public"."document_chunks" FOR EACH ROW EXECUTE FUNCTION "private"."documentos_validar_mismo_tenant"();



CREATE OR REPLACE TRIGGER "trg_document_extractions_tenant" BEFORE INSERT OR UPDATE ON "public"."document_extractions" FOR EACH ROW EXECUTE FUNCTION "private"."documentos_validar_mismo_tenant"();



CREATE OR REPLACE TRIGGER "trg_estructuras_asignatura_actualizado_en" BEFORE UPDATE ON "public"."estructuras_asignatura" FOR EACH ROW EXECUTE FUNCTION "public"."set_actualizado_en"();



CREATE OR REPLACE TRIGGER "trg_estructuras_plan_actualizado_en" BEFORE UPDATE ON "public"."estructuras_plan" FOR EACH ROW EXECUTE FUNCTION "public"."set_actualizado_en"();



CREATE OR REPLACE TRIGGER "trg_facultades_actualizado_en" BEFORE UPDATE ON "public"."facultades" FOR EACH ROW EXECUTE FUNCTION "public"."set_actualizado_en"();



CREATE OR REPLACE TRIGGER "trg_file_events_append_only_delete" BEFORE DELETE ON "public"."file_events" FOR EACH ROW EXECUTE FUNCTION "private"."documentos_rechazar_cambio_inmutable"();



CREATE OR REPLACE TRIGGER "trg_file_events_append_only_update" BEFORE UPDATE ON "public"."file_events" FOR EACH ROW EXECUTE FUNCTION "private"."documentos_rechazar_cambio_inmutable"();



CREATE OR REPLACE TRIGGER "trg_file_grants_tenant" BEFORE INSERT OR UPDATE ON "public"."file_grants" FOR EACH ROW EXECUTE FUNCTION "private"."documentos_validar_mismo_tenant"();



CREATE OR REPLACE TRIGGER "trg_file_user_state_tenant" BEFORE INSERT OR UPDATE ON "public"."file_user_state" FOR EACH ROW EXECUTE FUNCTION "private"."documentos_validar_mismo_tenant"();



CREATE OR REPLACE TRIGGER "trg_file_versions_inmutables" BEFORE UPDATE ON "public"."file_versions" FOR EACH ROW EXECUTE FUNCTION "private"."documentos_rechazar_cambio_inmutable"();



CREATE OR REPLACE TRIGGER "trg_file_versions_tenant" BEFORE INSERT ON "public"."file_versions" FOR EACH ROW EXECUTE FUNCTION "private"."documentos_validar_mismo_tenant"();



CREATE OR REPLACE TRIGGER "trg_files_actualizado_en" BEFORE UPDATE ON "public"."files" FOR EACH ROW EXECUTE FUNCTION "private"."documentos_actualizar_timestamp"();



CREATE OR REPLACE TRIGGER "trg_files_archivo_usado" BEFORE UPDATE OF "deleted_at", "status" ON "public"."files" FOR EACH ROW EXECUTE FUNCTION "private"."documentos_impedir_borrado_archivo_usado"();



CREATE OR REPLACE TRIGGER "trg_files_grant_creador" AFTER INSERT ON "public"."files" FOR EACH ROW EXECUTE FUNCTION "private"."documentos_otorgar_control_al_creador"();



CREATE OR REPLACE TRIGGER "trg_ingestion_jobs_tenant" BEFORE INSERT OR UPDATE ON "public"."ingestion_jobs" FOR EACH ROW EXECUTE FUNCTION "private"."documentos_validar_mismo_tenant"();



CREATE OR REPLACE TRIGGER "trg_learning_generation_jobs_actualizado_en" BEFORE UPDATE ON "public"."learning_generation_jobs" FOR EACH ROW EXECUTE FUNCTION "public"."set_actualizado_en"();



CREATE OR REPLACE TRIGGER "trg_learning_objects_actualizado_en" BEFORE UPDATE ON "public"."learning_objects" FOR EACH ROW EXECUTE FUNCTION "public"."set_actualizado_en"();



CREATE OR REPLACE TRIGGER "trg_limpiar_seriacion_conflictiva" BEFORE UPDATE OF "numero_ciclo" ON "public"."asignaturas" FOR EACH ROW EXECUTE FUNCTION "public"."fn_ajustar_seriacion_por_cambio_ciclo"();



CREATE OR REPLACE TRIGGER "trg_lineas_curriculares_sugeridas_actualizado_en" BEFORE UPDATE ON "public"."lineas_curriculares_sugeridas" FOR EACH ROW EXECUTE FUNCTION "public"."set_actualizado_en"();



CREATE OR REPLACE TRIGGER "trg_lineas_plan_actualizado_en" BEFORE UPDATE ON "public"."lineas_plan" FOR EACH ROW EXECUTE FUNCTION "public"."set_actualizado_en"();



CREATE OR REPLACE TRIGGER "trg_lineas_plan_log_cambios" AFTER INSERT OR DELETE OR UPDATE ON "public"."lineas_plan" FOR EACH ROW EXECUTE FUNCTION "public"."fn_log_lineas_plan_cambios"();



CREATE OR REPLACE TRIGGER "trg_message_file_references_tenant" BEFORE INSERT OR UPDATE ON "public"."message_file_references" FOR EACH ROW EXECUTE FUNCTION "private"."documentos_validar_mismo_tenant"();



CREATE OR REPLACE TRIGGER "trg_planes_estudio_actualizado_en" BEFORE UPDATE ON "public"."planes_estudio" FOR EACH ROW EXECUTE FUNCTION "public"."set_actualizado_en"();



CREATE OR REPLACE TRIGGER "trg_planes_estudio_asignar_jefe" AFTER INSERT ON "public"."planes_estudio" FOR EACH ROW EXECUTE FUNCTION "public"."fn_asignar_jefe_al_crear_plan"();



CREATE OR REPLACE TRIGGER "trg_planes_estudio_log_cambios" AFTER INSERT OR DELETE OR UPDATE ON "public"."planes_estudio" FOR EACH ROW EXECUTE FUNCTION "public"."fn_log_cambios_planes_estudio"();



CREATE OR REPLACE TRIGGER "trg_planes_exige_registro_oficial_aprobado" BEFORE INSERT OR UPDATE OF "estado_actual_id" ON "public"."planes_estudio" FOR EACH ROW EXECUTE FUNCTION "public"."fn_planes_exige_registro_oficial_aprobado"();



CREATE OR REPLACE TRIGGER "trg_planes_notificar_estado" AFTER UPDATE ON "public"."planes_estudio" FOR EACH ROW EXECUTE FUNCTION "public"."fn_notificar_cambio_estado_plan"();



CREATE OR REPLACE TRIGGER "trg_planes_set_nombre_display" BEFORE INSERT OR UPDATE OF "carrera_id", "estructura_id", "nombre", "nombre_propuesto", "fecha_inicio_imparticion" ON "public"."planes_estudio" FOR EACH ROW EXECUTE FUNCTION "public"."fn_planes_set_nombre_display"();



CREATE OR REPLACE TRIGGER "trg_proteger_publicacion_trabajo_entidad_ia" BEFORE INSERT OR UPDATE OF "tipo_entidad", "entidad_id", "openai_response_id", "estado" ON "public"."trabajos_generacion_ia" FOR EACH ROW EXECUTE FUNCTION "private"."proteger_publicacion_trabajo_entidad_ia"();



CREATE OR REPLACE TRIGGER "trg_proteger_publicacion_trabajo_recursos_ia" BEFORE INSERT OR UPDATE OF "tipo_entidad", "entidad_id", "openai_response_id", "estado" ON "public"."trabajos_generacion_ia" FOR EACH ROW EXECUTE FUNCTION "private"."proteger_publicacion_trabajo_recursos_ia"();



CREATE OR REPLACE TRIGGER "trg_registros_oficiales_plan_actualizado_en" BEFORE UPDATE ON "public"."registros_oficiales_plan" FOR EACH ROW EXECUTE FUNCTION "public"."set_actualizado_en"();



CREATE OR REPLACE TRIGGER "trg_responsables_grant_profesor" AFTER INSERT ON "public"."responsables_asignatura" FOR EACH ROW EXECUTE FUNCTION "public"."fn_grant_profesor_on_responsable"();



CREATE OR REPLACE TRIGGER "trg_trabajos_generacion_ia_actualizado_en" BEFORE UPDATE ON "public"."trabajos_generacion_ia" FOR EACH ROW EXECUTE FUNCTION "public"."set_actualizado_en"();



CREATE OR REPLACE TRIGGER "trg_usuarios_app_actualizado_en" BEFORE UPDATE ON "public"."usuarios_app" FOR EACH ROW EXECUTE FUNCTION "public"."set_actualizado_en"();



CREATE OR REPLACE TRIGGER "trg_usuarios_app_tenant_predeterminado" AFTER INSERT ON "public"."usuarios_app" FOR EACH ROW EXECUTE FUNCTION "private"."asignar_tenant_predeterminado_a_usuario"();



CREATE OR REPLACE TRIGGER "trg_validar_numero_ciclo_asignatura" BEFORE INSERT OR UPDATE OF "numero_ciclo", "plan_estudio_id" ON "public"."asignaturas" FOR EACH ROW EXECUTE FUNCTION "public"."validar_numero_ciclo_asignatura"();



CREATE OR REPLACE TRIGGER "trg_validar_prerrequisito_asignatura" BEFORE INSERT OR UPDATE OF "prerrequisito_asignatura_id", "numero_ciclo", "plan_estudio_id" ON "public"."asignaturas" FOR EACH ROW EXECUTE FUNCTION "public"."validar_prerrequisito_asignatura"();



CREATE OR REPLACE TRIGGER "trigger_track_cambios_asignatura" BEFORE INSERT OR DELETE OR UPDATE ON "public"."asignaturas" FOR EACH ROW EXECUTE FUNCTION "public"."fn_track_cambios_asignatura"();



ALTER TABLE ONLY "public"."ai_request_references"
    ADD CONSTRAINT "ai_request_references_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."ai_request_references"
    ADD CONSTRAINT "ai_request_references_file_version_id_fkey" FOREIGN KEY ("file_version_id") REFERENCES "public"."file_versions"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."ai_request_references"
    ADD CONSTRAINT "ai_request_references_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE RESTRICT;



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



ALTER TABLE ONLY "public"."asignatura_mensajes_ia"
    ADD CONSTRAINT "asignatura_mensajes_ia_retry_source_fkey" FOREIGN KEY ("retry_of_message_id", "conversacion_asignatura_id", "enviado_por") REFERENCES "public"."asignatura_mensajes_ia"("id", "conversacion_asignatura_id", "enviado_por") DEFERRABLE;



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



ALTER TABLE ONLY "public"."collection_files"
    ADD CONSTRAINT "collection_files_added_by_fkey" FOREIGN KEY ("added_by") REFERENCES "public"."usuarios_app"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."collection_files"
    ADD CONSTRAINT "collection_files_collection_id_fkey" FOREIGN KEY ("collection_id") REFERENCES "public"."collections"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."collection_files"
    ADD CONSTRAINT "collection_files_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."collection_files"
    ADD CONSTRAINT "collection_files_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."collections"
    ADD CONSTRAINT "collections_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."usuarios_app"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."collections"
    ADD CONSTRAINT "collections_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."comentarios_adjuntos"
    ADD CONSTRAINT "comentarios_adjuntos_comentario_id_fkey" FOREIGN KEY ("comentario_id") REFERENCES "public"."comentarios_plan"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."comentarios_adjuntos"
    ADD CONSTRAINT "comentarios_adjuntos_creado_por_fkey" FOREIGN KEY ("creado_por") REFERENCES "public"."usuarios_app"("id");



ALTER TABLE ONLY "public"."comentarios_adjuntos"
    ADD CONSTRAINT "comentarios_adjuntos_plan_estudio_id_fkey" FOREIGN KEY ("plan_estudio_id") REFERENCES "public"."planes_estudio"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."comentarios_asignatura"
    ADD CONSTRAINT "comentarios_asignatura_asignatura_id_fkey" FOREIGN KEY ("asignatura_id") REFERENCES "public"."asignaturas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."comentarios_asignatura"
    ADD CONSTRAINT "comentarios_asignatura_autor_id_fkey" FOREIGN KEY ("autor_id") REFERENCES "public"."usuarios_app"("id");



ALTER TABLE ONLY "public"."comentarios_asignatura"
    ADD CONSTRAINT "comentarios_asignatura_comentario_padre_id_fkey" FOREIGN KEY ("comentario_padre_id") REFERENCES "public"."comentarios_asignatura"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."comentarios_plan"
    ADD CONSTRAINT "comentarios_plan_asignatura_id_fkey" FOREIGN KEY ("asignatura_id") REFERENCES "public"."asignaturas"("id") ON DELETE CASCADE;



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



ALTER TABLE ONLY "public"."conversation_files"
    ADD CONSTRAINT "conversation_files_added_by_fkey" FOREIGN KEY ("added_by") REFERENCES "public"."usuarios_app"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."conversation_files"
    ADD CONSTRAINT "conversation_files_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."conversation_files"
    ADD CONSTRAINT "conversation_files_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."crash_reports"
    ADD CONSTRAINT "crash_reports_resuelto_por_fkey" FOREIGN KEY ("resuelto_por") REFERENCES "public"."usuarios_app"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."crash_reports"
    ADD CONSTRAINT "crash_reports_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios_app"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."document_chunks"
    ADD CONSTRAINT "document_chunks_file_version_id_fkey" FOREIGN KEY ("file_version_id") REFERENCES "public"."file_versions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."document_chunks"
    ADD CONSTRAINT "document_chunks_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."document_extractions"
    ADD CONSTRAINT "document_extractions_file_version_id_fkey" FOREIGN KEY ("file_version_id") REFERENCES "public"."file_versions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."document_extractions"
    ADD CONSTRAINT "document_extractions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE RESTRICT;



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



ALTER TABLE ONLY "public"."file_blobs"
    ADD CONSTRAINT "file_blobs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."file_events"
    ADD CONSTRAINT "file_events_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "public"."usuarios_app"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."file_events"
    ADD CONSTRAINT "file_events_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."file_events"
    ADD CONSTRAINT "file_events_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."file_grants"
    ADD CONSTRAINT "file_grants_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."file_grants"
    ADD CONSTRAINT "file_grants_granted_by_fkey" FOREIGN KEY ("granted_by") REFERENCES "public"."usuarios_app"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."file_grants"
    ADD CONSTRAINT "file_grants_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."file_user_state"
    ADD CONSTRAINT "file_user_state_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."file_user_state"
    ADD CONSTRAINT "file_user_state_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."file_user_state"
    ADD CONSTRAINT "file_user_state_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."usuarios_app"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."file_versions"
    ADD CONSTRAINT "file_versions_blob_id_fkey" FOREIGN KEY ("blob_id") REFERENCES "public"."file_blobs"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."file_versions"
    ADD CONSTRAINT "file_versions_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."file_versions"
    ADD CONSTRAINT "file_versions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."file_versions"
    ADD CONSTRAINT "file_versions_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "public"."usuarios_app"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."files"
    ADD CONSTRAINT "files_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."usuarios_app"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."files"
    ADD CONSTRAINT "files_current_version_fk" FOREIGN KEY ("current_version_id") REFERENCES "public"."file_versions"("id") DEFERRABLE INITIALLY DEFERRED;



ALTER TABLE ONLY "public"."files"
    ADD CONSTRAINT "files_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."ingestion_jobs"
    ADD CONSTRAINT "ingestion_jobs_file_version_id_fkey" FOREIGN KEY ("file_version_id") REFERENCES "public"."file_versions"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."ingestion_jobs"
    ADD CONSTRAINT "ingestion_jobs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."ingestion_jobs"
    ADD CONSTRAINT "ingestion_jobs_upload_session_id_fkey" FOREIGN KEY ("upload_session_id") REFERENCES "public"."upload_sessions"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."interacciones_ia"
    ADD CONSTRAINT "interacciones_ia_asignatura_id_fkey" FOREIGN KEY ("asignatura_id") REFERENCES "public"."asignaturas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."interacciones_ia"
    ADD CONSTRAINT "interacciones_ia_plan_estudio_id_fkey" FOREIGN KEY ("plan_estudio_id") REFERENCES "public"."planes_estudio"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."interacciones_ia"
    ADD CONSTRAINT "interacciones_ia_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios_app"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."learning_generation_jobs"
    ADD CONSTRAINT "learning_generation_jobs_asignatura_id_fkey" FOREIGN KEY ("asignatura_id") REFERENCES "public"."asignaturas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."learning_generation_jobs"
    ADD CONSTRAINT "learning_generation_jobs_creado_por_fkey" FOREIGN KEY ("creado_por") REFERENCES "public"."usuarios_app"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."learning_generation_jobs"
    ADD CONSTRAINT "learning_generation_jobs_intento_generacion_activo_id_fkey" FOREIGN KEY ("intento_generacion_activo_id") REFERENCES "private"."intentos_generacion_ia"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."learning_objects"
    ADD CONSTRAINT "learning_objects_actualizado_por_fkey" FOREIGN KEY ("actualizado_por") REFERENCES "public"."usuarios_app"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."learning_objects"
    ADD CONSTRAINT "learning_objects_asignatura_id_fkey" FOREIGN KEY ("asignatura_id") REFERENCES "public"."asignaturas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."learning_objects"
    ADD CONSTRAINT "learning_objects_creado_por_fkey" FOREIGN KEY ("creado_por") REFERENCES "public"."usuarios_app"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."learning_objects"
    ADD CONSTRAINT "learning_objects_generation_job_id_fkey" FOREIGN KEY ("generation_job_id") REFERENCES "public"."learning_generation_jobs"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."learning_objects"
    ADD CONSTRAINT "learning_objects_interaccion_ia_id_fkey" FOREIGN KEY ("interaccion_ia_id") REFERENCES "public"."interacciones_ia"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."learning_quality_scores"
    ADD CONSTRAINT "learning_quality_scores_asignatura_id_fkey" FOREIGN KEY ("asignatura_id") REFERENCES "public"."asignaturas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."learning_quality_scores"
    ADD CONSTRAINT "learning_quality_scores_generado_por_fkey" FOREIGN KEY ("generado_por") REFERENCES "public"."usuarios_app"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."learning_quality_scores"
    ADD CONSTRAINT "learning_quality_scores_generation_job_id_fkey" FOREIGN KEY ("generation_job_id") REFERENCES "public"."learning_generation_jobs"("id") ON DELETE SET NULL;



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



ALTER TABLE ONLY "public"."message_file_references"
    ADD CONSTRAINT "message_file_references_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."message_file_references"
    ADD CONSTRAINT "message_file_references_file_version_id_fkey" FOREIGN KEY ("file_version_id") REFERENCES "public"."file_versions"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."message_file_references"
    ADD CONSTRAINT "message_file_references_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."notificaciones"
    ADD CONSTRAINT "notificaciones_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios_app"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."observability_test_runs"
    ADD CONSTRAINT "observability_test_runs_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."observability_webhook_events"
    ADD CONSTRAINT "observability_webhook_events_test_run_id_fkey" FOREIGN KEY ("test_run_id") REFERENCES "public"."observability_test_runs"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."plan_expertos"
    ADD CONSTRAINT "plan_expertos_experto_id_fkey" FOREIGN KEY ("experto_id") REFERENCES "public"."expertos"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."plan_expertos"
    ADD CONSTRAINT "plan_expertos_plan_estudio_id_fkey" FOREIGN KEY ("plan_estudio_id") REFERENCES "public"."planes_estudio"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."plan_mensajes_ia"
    ADD CONSTRAINT "plan_mensajes_ia_conversacion_plan_id_fkey" FOREIGN KEY ("conversacion_plan_id") REFERENCES "public"."conversaciones_plan"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."plan_mensajes_ia"
    ADD CONSTRAINT "plan_mensajes_ia_retry_source_fkey" FOREIGN KEY ("retry_of_message_id", "conversacion_plan_id", "enviado_por") REFERENCES "public"."plan_mensajes_ia"("id", "conversacion_plan_id", "enviado_por") DEFERRABLE;



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



ALTER TABLE ONLY "public"."registros_oficiales_plan"
    ADD CONSTRAINT "registros_oficiales_plan_actualizado_por_fkey" FOREIGN KEY ("actualizado_por") REFERENCES "public"."usuarios_app"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."registros_oficiales_plan"
    ADD CONSTRAINT "registros_oficiales_plan_documento_archivo_id_fkey" FOREIGN KEY ("documento_archivo_id") REFERENCES "public"."archivos"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."registros_oficiales_plan"
    ADD CONSTRAINT "registros_oficiales_plan_plan_estudio_id_fkey" FOREIGN KEY ("plan_estudio_id") REFERENCES "public"."planes_estudio"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."registros_oficiales_plan"
    ADD CONSTRAINT "registros_oficiales_plan_registrado_por_fkey" FOREIGN KEY ("registrado_por") REFERENCES "public"."usuarios_app"("id") ON DELETE SET NULL;



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



ALTER TABLE ONLY "public"."tenant_memberships"
    ADD CONSTRAINT "tenant_memberships_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tenant_memberships"
    ADD CONSTRAINT "tenant_memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."usuarios_app"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."transiciones_estado_plan"
    ADD CONSTRAINT "transiciones_estado_plan_desde_estado_id_fkey" FOREIGN KEY ("desde_estado_id") REFERENCES "public"."estados_plan"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."transiciones_estado_plan"
    ADD CONSTRAINT "transiciones_estado_plan_hacia_estado_id_fkey" FOREIGN KEY ("hacia_estado_id") REFERENCES "public"."estados_plan"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."transiciones_estado_plan"
    ADD CONSTRAINT "transiciones_estado_plan_rol_permitido_id_fkey" FOREIGN KEY ("rol_permitido_id") REFERENCES "public"."roles"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."upload_sessions"
    ADD CONSTRAINT "upload_sessions_result_file_fk" FOREIGN KEY ("result_file_id") REFERENCES "public"."files"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."upload_sessions"
    ADD CONSTRAINT "upload_sessions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."upload_sessions"
    ADD CONSTRAINT "upload_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."usuarios_app"("id") ON DELETE RESTRICT;



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



ALTER TABLE "private"."intentos_generacion_ia" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ai_request_references" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."archivos" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "archivos_delete_by_owner_or_permission" ON "public"."archivos" FOR DELETE TO "authenticated" USING ((("creado_por" = ( SELECT "auth"."uid"() AS "uid")) OR "public"."authz_has_permission"('archivos.gestionar'::"text")));



CREATE POLICY "archivos_insert_by_owner_or_permission" ON "public"."archivos" FOR INSERT TO "authenticated" WITH CHECK ((("creado_por" = ( SELECT "auth"."uid"() AS "uid")) OR "public"."authz_has_permission"('archivos.gestionar'::"text")));



ALTER TABLE "public"."archivos_repositorios" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "archivos_repositorios_delete_by_owner_or_permission" ON "public"."archivos_repositorios" FOR DELETE TO "authenticated" USING (("public"."authz_has_permission"('archivos.gestionar'::"text") OR (EXISTS ( SELECT 1
   FROM "public"."archivos" "a"
  WHERE (("a"."id" = "archivos_repositorios"."archivo_id") AND ("a"."creado_por" = ( SELECT "auth"."uid"() AS "uid"))))) OR (EXISTS ( SELECT 1
   FROM "public"."repositorios" "r"
  WHERE (("r"."id" = "archivos_repositorios"."repositorio_id") AND ("r"."enviado_por" = ( SELECT "auth"."uid"() AS "uid")))))));



CREATE POLICY "archivos_repositorios_insert_by_owner_or_permission" ON "public"."archivos_repositorios" FOR INSERT TO "authenticated" WITH CHECK (("public"."authz_has_permission"('archivos.gestionar'::"text") OR (EXISTS ( SELECT 1
   FROM "public"."archivos" "a"
  WHERE (("a"."id" = "archivos_repositorios"."archivo_id") AND ("a"."creado_por" = ( SELECT "auth"."uid"() AS "uid"))))) OR (EXISTS ( SELECT 1
   FROM "public"."repositorios" "r"
  WHERE (("r"."id" = "archivos_repositorios"."repositorio_id") AND ("r"."enviado_por" = ( SELECT "auth"."uid"() AS "uid")))))));



CREATE POLICY "archivos_repositorios_select_by_owner_or_permission" ON "public"."archivos_repositorios" FOR SELECT TO "authenticated" USING (("public"."authz_has_permission"('archivos.ver'::"text") OR "public"."authz_has_permission"('archivos.gestionar'::"text") OR (EXISTS ( SELECT 1
   FROM "public"."archivos" "a"
  WHERE (("a"."id" = "archivos_repositorios"."archivo_id") AND ("a"."creado_por" = ( SELECT "auth"."uid"() AS "uid"))))) OR (EXISTS ( SELECT 1
   FROM "public"."repositorios" "r"
  WHERE (("r"."id" = "archivos_repositorios"."repositorio_id") AND ("r"."enviado_por" = ( SELECT "auth"."uid"() AS "uid")))))));



CREATE POLICY "archivos_repositorios_update_by_owner_or_permission" ON "public"."archivos_repositorios" FOR UPDATE TO "authenticated" USING (("public"."authz_has_permission"('archivos.gestionar'::"text") OR (EXISTS ( SELECT 1
   FROM "public"."archivos" "a"
  WHERE (("a"."id" = "archivos_repositorios"."archivo_id") AND ("a"."creado_por" = ( SELECT "auth"."uid"() AS "uid"))))) OR (EXISTS ( SELECT 1
   FROM "public"."repositorios" "r"
  WHERE (("r"."id" = "archivos_repositorios"."repositorio_id") AND ("r"."enviado_por" = ( SELECT "auth"."uid"() AS "uid"))))))) WITH CHECK (("public"."authz_has_permission"('archivos.gestionar'::"text") OR (EXISTS ( SELECT 1
   FROM "public"."archivos" "a"
  WHERE (("a"."id" = "archivos_repositorios"."archivo_id") AND ("a"."creado_por" = ( SELECT "auth"."uid"() AS "uid"))))) OR (EXISTS ( SELECT 1
   FROM "public"."repositorios" "r"
  WHERE (("r"."id" = "archivos_repositorios"."repositorio_id") AND ("r"."enviado_por" = ( SELECT "auth"."uid"() AS "uid")))))));



CREATE POLICY "archivos_select_by_owner_or_permission" ON "public"."archivos" FOR SELECT TO "authenticated" USING ((("creado_por" = ( SELECT "auth"."uid"() AS "uid")) OR "public"."authz_has_permission"('archivos.ver'::"text") OR "public"."authz_has_permission"('archivos.gestionar'::"text")));



CREATE POLICY "archivos_update_by_owner_or_permission" ON "public"."archivos" FOR UPDATE TO "authenticated" USING ((("creado_por" = ( SELECT "auth"."uid"() AS "uid")) OR "public"."authz_has_permission"('archivos.gestionar'::"text"))) WITH CHECK ((("creado_por" = ( SELECT "auth"."uid"() AS "uid")) OR "public"."authz_has_permission"('archivos.gestionar'::"text")));



ALTER TABLE "public"."asignatura_mensajes_ia" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "asignatura_mensajes_ia_delete_by_scope" ON "public"."asignatura_mensajes_ia" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."conversaciones_asignatura" "c"
  WHERE (("c"."id" = "asignatura_mensajes_ia"."conversacion_asignatura_id") AND "public"."authz_asignatura_ia_allowed"("c"."asignatura_id")))));



CREATE POLICY "asignatura_mensajes_ia_insert_by_scope" ON "public"."asignatura_mensajes_ia" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."conversaciones_asignatura" "c"
  WHERE (("c"."id" = "asignatura_mensajes_ia"."conversacion_asignatura_id") AND "public"."authz_asignatura_ia_allowed"("c"."asignatura_id")))));



CREATE POLICY "asignatura_mensajes_ia_select_by_scope" ON "public"."asignatura_mensajes_ia" FOR SELECT TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM "public"."conversaciones_asignatura" "c"
  WHERE (("c"."id" = "asignatura_mensajes_ia"."conversacion_asignatura_id") AND (("c"."creado_por" = ( SELECT "auth"."uid"() AS "uid")) OR ("public"."authz_has_permission"('asignaturas.ver'::"text") AND "public"."authz_can_access_asignatura"("c"."asignatura_id")))))) OR (EXISTS ( SELECT 1
   FROM "public"."conversaciones_asignatura" "c"
  WHERE (("c"."id" = "asignatura_mensajes_ia"."conversacion_asignatura_id") AND "public"."authz_asignatura_ia_allowed"("c"."asignatura_id"))))));



CREATE POLICY "asignatura_mensajes_ia_update_by_scope" ON "public"."asignatura_mensajes_ia" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."conversaciones_asignatura" "c"
  WHERE (("c"."id" = "asignatura_mensajes_ia"."conversacion_asignatura_id") AND "public"."authz_asignatura_ia_allowed"("c"."asignatura_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."conversaciones_asignatura" "c"
  WHERE (("c"."id" = "asignatura_mensajes_ia"."conversacion_asignatura_id") AND "public"."authz_asignatura_ia_allowed"("c"."asignatura_id")))));



ALTER TABLE "public"."asignaturas" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "asignaturas_delete_by_scope" ON "public"."asignaturas" FOR DELETE TO "authenticated" USING (("public"."authz_plan_write_allowed"("plan_estudio_id") OR "public"."authz_asignatura_write_allowed"("id")));



CREATE POLICY "asignaturas_insert_by_scope" ON "public"."asignaturas" FOR INSERT TO "authenticated" WITH CHECK (("public"."authz_plan_write_allowed"("plan_estudio_id") OR "public"."authz_asignatura_write_allowed"("id")));



CREATE POLICY "asignaturas_select_by_scope" ON "public"."asignaturas" FOR SELECT TO "authenticated" USING (((("public"."authz_has_permission"('asignaturas.ver'::"text") OR "public"."authz_has_permission"('planes.ver'::"text")) AND ("public"."authz_can_access_plan"("plan_estudio_id") OR "private"."authz_is_responsable_asignatura"("id"))) OR "public"."authz_plan_write_allowed"("plan_estudio_id") OR "public"."authz_asignatura_write_allowed"("id")));



CREATE POLICY "asignaturas_update_by_scope" ON "public"."asignaturas" FOR UPDATE TO "authenticated" USING (("public"."authz_plan_write_allowed"("plan_estudio_id") OR "public"."authz_asignatura_content_write_allowed"("id") OR "public"."authz_asignatura_restricted_field_write_allowed"("id"))) WITH CHECK (("public"."authz_plan_write_allowed"("plan_estudio_id") OR "public"."authz_asignatura_content_write_allowed"("id") OR "public"."authz_asignatura_restricted_field_write_allowed"("id")));



ALTER TABLE "public"."bibliografia_asignatura" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "bibliografia_asignatura_delete_by_scope" ON "public"."bibliografia_asignatura" FOR DELETE TO "authenticated" USING ("public"."authz_asignatura_content_write_allowed"("asignatura_id"));



CREATE POLICY "bibliografia_asignatura_insert_by_scope" ON "public"."bibliografia_asignatura" FOR INSERT TO "authenticated" WITH CHECK ("public"."authz_asignatura_content_write_allowed"("asignatura_id"));



CREATE POLICY "bibliografia_asignatura_select_by_scope" ON "public"."bibliografia_asignatura" FOR SELECT TO "authenticated" USING ((("public"."authz_has_permission"('asignaturas.ver'::"text") AND "public"."authz_can_access_asignatura"("asignatura_id")) OR "public"."authz_asignatura_write_allowed"("asignatura_id")));



CREATE POLICY "bibliografia_asignatura_update_by_scope" ON "public"."bibliografia_asignatura" FOR UPDATE TO "authenticated" USING ("public"."authz_asignatura_content_write_allowed"("asignatura_id")) WITH CHECK ("public"."authz_asignatura_content_write_allowed"("asignatura_id"));



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



CREATE POLICY "carreras_insert_by_academic_catalog_scope" ON "public"."carreras" FOR INSERT TO "authenticated" WITH CHECK ("public"."authz_can_create_carrera_catalog"("facultad_id", ("nivel")::"text"));



CREATE POLICY "carreras_select_authenticated" ON "public"."carreras" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "carreras_update_by_academic_catalog_scope" ON "public"."carreras" FOR UPDATE TO "authenticated" USING ("public"."authz_can_manage_carrera_catalog"("id")) WITH CHECK ("public"."authz_can_manage_carrera_catalog"("id"));



ALTER TABLE "public"."collection_files" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."collections" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."comentarios_adjuntos" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "comentarios_adjuntos_delete" ON "public"."comentarios_adjuntos" FOR DELETE TO "authenticated" USING ((("creado_por" = ( SELECT "auth"."uid"() AS "uid")) OR "public"."authz_is_admin"()));



CREATE POLICY "comentarios_adjuntos_insert" ON "public"."comentarios_adjuntos" FOR INSERT TO "authenticated" WITH CHECK ((("creado_por" = ( SELECT "auth"."uid"() AS "uid")) AND "private"."usuario_puede_comentar_plan"(( SELECT "auth"."uid"() AS "uid"), "plan_estudio_id")));



CREATE POLICY "comentarios_adjuntos_select" ON "public"."comentarios_adjuntos" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."comentarios_plan" "cp"
  WHERE ("cp"."id" = "comentarios_adjuntos"."comentario_id"))));



ALTER TABLE "public"."comentarios_asignatura" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "comentarios_asignatura_delete_own" ON "public"."comentarios_asignatura" FOR DELETE TO "authenticated" USING ((("autor_id" = ( SELECT "auth"."uid"() AS "uid")) OR "public"."authz_is_admin"()));



CREATE POLICY "comentarios_asignatura_insert_by_scope" ON "public"."comentarios_asignatura" FOR INSERT TO "authenticated" WITH CHECK ((("autor_id" = ( SELECT "auth"."uid"() AS "uid")) AND "private"."usuario_puede_comentar_asignatura"(( SELECT "auth"."uid"() AS "uid"), "asignatura_id")));



CREATE POLICY "comentarios_asignatura_select_by_scope" ON "public"."comentarios_asignatura" FOR SELECT TO "authenticated" USING ((("autor_id" = ( SELECT "auth"."uid"() AS "uid")) OR ("public"."authz_has_permission"('asignaturas.ver'::"text") AND "public"."authz_can_access_asignatura"("asignatura_id"))));



CREATE POLICY "comentarios_asignatura_update_own" ON "public"."comentarios_asignatura" FOR UPDATE TO "authenticated" USING ((("autor_id" = ( SELECT "auth"."uid"() AS "uid")) OR "public"."authz_is_admin"())) WITH CHECK ((("autor_id" = ( SELECT "auth"."uid"() AS "uid")) OR "public"."authz_is_admin"()));



ALTER TABLE "public"."comentarios_plan" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "comentarios_plan_delete_own" ON "public"."comentarios_plan" FOR DELETE TO "authenticated" USING ((("autor_id" = ( SELECT "auth"."uid"() AS "uid")) OR "public"."authz_is_admin"()));



CREATE POLICY "comentarios_plan_insert_by_scope" ON "public"."comentarios_plan" FOR INSERT TO "authenticated" WITH CHECK ((("autor_id" = ( SELECT "auth"."uid"() AS "uid")) AND ((("asignatura_id" IS NULL) AND "private"."usuario_puede_comentar_plan"(( SELECT "auth"."uid"() AS "uid"), "plan_estudio_id")) OR (("asignatura_id" IS NOT NULL) AND "public"."authz_can_access_asignatura"("asignatura_id") AND "private"."usuario_puede_comentar_plan"(( SELECT "auth"."uid"() AS "uid"), "plan_estudio_id")))));



CREATE POLICY "comentarios_plan_select_by_scope" ON "public"."comentarios_plan" FOR SELECT TO "authenticated" USING ((("autor_id" = ( SELECT "auth"."uid"() AS "uid")) OR (("asignatura_id" IS NULL) AND "public"."authz_has_permission"('planes.ver'::"text") AND "public"."authz_can_access_plan"("plan_estudio_id")) OR (("asignatura_id" IS NOT NULL) AND "public"."authz_can_access_asignatura"("asignatura_id"))));



CREATE POLICY "comentarios_plan_update_own" ON "public"."comentarios_plan" FOR UPDATE TO "authenticated" USING ((("autor_id" = ( SELECT "auth"."uid"() AS "uid")) OR "public"."authz_is_admin"())) WITH CHECK ((("autor_id" = ( SELECT "auth"."uid"() AS "uid")) OR "public"."authz_is_admin"()));



ALTER TABLE "public"."conversaciones_asignatura" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "conversaciones_asignatura_delete_by_scope" ON "public"."conversaciones_asignatura" FOR DELETE TO "authenticated" USING ("public"."authz_asignatura_ia_allowed"("asignatura_id"));



CREATE POLICY "conversaciones_asignatura_insert_by_scope" ON "public"."conversaciones_asignatura" FOR INSERT TO "authenticated" WITH CHECK ("public"."authz_asignatura_ia_allowed"("asignatura_id"));



CREATE POLICY "conversaciones_asignatura_select_by_scope" ON "public"."conversaciones_asignatura" FOR SELECT TO "authenticated" USING ((("creado_por" = ( SELECT "auth"."uid"() AS "uid")) OR ("public"."authz_has_permission"('asignaturas.ver'::"text") AND "public"."authz_can_access_asignatura"("asignatura_id")) OR "public"."authz_asignatura_ia_allowed"("asignatura_id")));



CREATE POLICY "conversaciones_asignatura_update_by_scope" ON "public"."conversaciones_asignatura" FOR UPDATE TO "authenticated" USING ("public"."authz_asignatura_ia_allowed"("asignatura_id")) WITH CHECK ("public"."authz_asignatura_ia_allowed"("asignatura_id"));



ALTER TABLE "public"."conversaciones_plan" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "conversaciones_plan_delete_by_scope" ON "public"."conversaciones_plan" FOR DELETE TO "authenticated" USING ("public"."authz_plan_ia_allowed"("plan_estudio_id"));



CREATE POLICY "conversaciones_plan_insert_by_scope" ON "public"."conversaciones_plan" FOR INSERT TO "authenticated" WITH CHECK ("public"."authz_plan_ia_allowed"("plan_estudio_id"));



CREATE POLICY "conversaciones_plan_select_by_scope" ON "public"."conversaciones_plan" FOR SELECT TO "authenticated" USING ((("creado_por" = ( SELECT "auth"."uid"() AS "uid")) OR ("public"."authz_has_permission"('planes.ver'::"text") AND "public"."authz_can_access_plan"("plan_estudio_id")) OR "public"."authz_plan_ia_allowed"("plan_estudio_id")));



CREATE POLICY "conversaciones_plan_update_by_scope" ON "public"."conversaciones_plan" FOR UPDATE TO "authenticated" USING ("public"."authz_plan_ia_allowed"("plan_estudio_id")) WITH CHECK ("public"."authz_plan_ia_allowed"("plan_estudio_id"));



ALTER TABLE "public"."conversation_files" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."crash_reports" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "crash_reports_delete_admin" ON "public"."crash_reports" FOR DELETE TO "authenticated" USING ("public"."authz_is_admin"());



CREATE POLICY "crash_reports_insert_frontend" ON "public"."crash_reports" FOR INSERT TO "authenticated", "anon" WITH CHECK ((("origen" = 'frontend'::"text") AND ("severidad" = ANY (ARRAY['info'::"text", 'warning'::"text", 'error'::"text", 'fatal'::"text"])) AND (("usuario_id" IS NULL) OR ("usuario_id" = ( SELECT "auth"."uid"() AS "uid"))) AND ("resuelto_en" IS NULL) AND ("resuelto_por" IS NULL) AND ("notas" IS NULL)));



CREATE POLICY "crash_reports_select_auditoria" ON "public"."crash_reports" FOR SELECT TO "authenticated" USING ("public"."authz_has_permission"('auditoria.ver'::"text"));



CREATE POLICY "crash_reports_update_auditoria" ON "public"."crash_reports" FOR UPDATE TO "authenticated" USING ("public"."authz_has_permission"('auditoria.ver'::"text")) WITH CHECK (("public"."authz_has_permission"('auditoria.ver'::"text") AND ("origen" = 'frontend'::"text") AND ("severidad" = ANY (ARRAY['info'::"text", 'warning'::"text", 'error'::"text", 'fatal'::"text"]))));



ALTER TABLE "public"."document_chunks" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."document_extractions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."document_webhook_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ejecuciones_recuperacion_ia" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."estados_plan" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "estados_plan_delete_by_catalogos" ON "public"."estados_plan" FOR DELETE TO "authenticated" USING ("public"."authz_has_permission"('catalogos.gestionar'::"text"));



CREATE POLICY "estados_plan_insert_by_catalogos" ON "public"."estados_plan" FOR INSERT TO "authenticated" WITH CHECK ("public"."authz_has_permission"('catalogos.gestionar'::"text"));



CREATE POLICY "estados_plan_select_authenticated" ON "public"."estados_plan" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "estados_plan_update_by_catalogos" ON "public"."estados_plan" FOR UPDATE TO "authenticated" USING ("public"."authz_has_permission"('catalogos.gestionar'::"text")) WITH CHECK ("public"."authz_has_permission"('catalogos.gestionar'::"text"));



ALTER TABLE "public"."estructuras_asignatura" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "estructuras_asignatura_delete_by_catalogos" ON "public"."estructuras_asignatura" FOR DELETE TO "authenticated" USING ("public"."authz_has_permission"('catalogos.gestionar'::"text"));



CREATE POLICY "estructuras_asignatura_insert_by_catalogos" ON "public"."estructuras_asignatura" FOR INSERT TO "authenticated" WITH CHECK ("public"."authz_has_permission"('catalogos.gestionar'::"text"));



CREATE POLICY "estructuras_asignatura_select_authenticated" ON "public"."estructuras_asignatura" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "estructuras_asignatura_update_by_catalogos" ON "public"."estructuras_asignatura" FOR UPDATE TO "authenticated" USING ("public"."authz_has_permission"('catalogos.gestionar'::"text")) WITH CHECK ("public"."authz_has_permission"('catalogos.gestionar'::"text"));



ALTER TABLE "public"."estructuras_plan" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "estructuras_plan_delete_by_catalogos" ON "public"."estructuras_plan" FOR DELETE TO "authenticated" USING ("public"."authz_has_permission"('catalogos.gestionar'::"text"));



CREATE POLICY "estructuras_plan_insert_by_catalogos" ON "public"."estructuras_plan" FOR INSERT TO "authenticated" WITH CHECK ("public"."authz_has_permission"('catalogos.gestionar'::"text"));



CREATE POLICY "estructuras_plan_select_authenticated" ON "public"."estructuras_plan" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "estructuras_plan_update_by_catalogos" ON "public"."estructuras_plan" FOR UPDATE TO "authenticated" USING ("public"."authz_has_permission"('catalogos.gestionar'::"text")) WITH CHECK ("public"."authz_has_permission"('catalogos.gestionar'::"text"));



ALTER TABLE "public"."expertos" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "expertos_delete_by_permission" ON "public"."expertos" FOR DELETE TO "authenticated" USING ("public"."authz_has_permission"('expertos.gestionar'::"text"));



CREATE POLICY "expertos_insert_by_permission" ON "public"."expertos" FOR INSERT TO "authenticated" WITH CHECK ("public"."authz_has_permission"('expertos.gestionar'::"text"));



CREATE POLICY "expertos_select_by_scope" ON "public"."expertos" FOR SELECT TO "authenticated" USING ((("usuario_id" = ( SELECT "auth"."uid"() AS "uid")) OR "public"."authz_has_permission"('expertos.gestionar'::"text") OR (EXISTS ( SELECT 1
   FROM "public"."plan_expertos" "pe"
  WHERE (("pe"."experto_id" = "expertos"."id") AND "public"."authz_has_permission"('planes.ver'::"text") AND "public"."authz_can_access_plan"("pe"."plan_estudio_id"))))));



CREATE POLICY "expertos_update_by_permission" ON "public"."expertos" FOR UPDATE TO "authenticated" USING ("public"."authz_has_permission"('expertos.gestionar'::"text")) WITH CHECK ("public"."authz_has_permission"('expertos.gestionar'::"text"));



ALTER TABLE "public"."facultades" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "facultades_delete_by_catalogos" ON "public"."facultades" FOR DELETE TO "authenticated" USING ("public"."authz_has_permission"('catalogos.gestionar'::"text"));



CREATE POLICY "facultades_insert_by_catalogos" ON "public"."facultades" FOR INSERT TO "authenticated" WITH CHECK ("public"."authz_has_permission"('catalogos.gestionar'::"text"));



CREATE POLICY "facultades_select_authenticated" ON "public"."facultades" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "facultades_update_by_academic_catalog_scope" ON "public"."facultades" FOR UPDATE TO "authenticated" USING ("public"."authz_can_manage_facultad_catalog"("id")) WITH CHECK ("public"."authz_can_manage_facultad_catalog"("id"));



ALTER TABLE "public"."file_blobs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."file_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."file_grants" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."file_user_state" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."file_versions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."files" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ingestion_jobs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."interacciones_ia" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "interacciones_ia_delete_own" ON "public"."interacciones_ia" FOR DELETE TO "authenticated" USING ((("usuario_id" = ( SELECT "auth"."uid"() AS "uid")) AND (("plan_estudio_id" IS NULL) OR "public"."authz_plan_ia_allowed"("plan_estudio_id")) AND (("asignatura_id" IS NULL) OR "public"."authz_asignatura_ia_allowed"("asignatura_id"))));



CREATE POLICY "interacciones_ia_insert_own" ON "public"."interacciones_ia" FOR INSERT TO "authenticated" WITH CHECK ((("usuario_id" = ( SELECT "auth"."uid"() AS "uid")) AND (("plan_estudio_id" IS NULL) OR "public"."authz_plan_ia_allowed"("plan_estudio_id")) AND (("asignatura_id" IS NULL) OR "public"."authz_asignatura_ia_allowed"("asignatura_id"))));



CREATE POLICY "interacciones_ia_select_by_scope" ON "public"."interacciones_ia" FOR SELECT TO "authenticated" USING ((("usuario_id" = ( SELECT "auth"."uid"() AS "uid")) OR (("plan_estudio_id" IS NOT NULL) AND "public"."authz_has_permission"('auditoria.ver'::"text") AND "public"."authz_can_access_plan"("plan_estudio_id")) OR (("asignatura_id" IS NOT NULL) AND "public"."authz_has_permission"('auditoria.ver'::"text") AND "public"."authz_can_access_asignatura"("asignatura_id")) OR (("usuario_id" = ( SELECT "auth"."uid"() AS "uid")) AND (("plan_estudio_id" IS NULL) OR "public"."authz_plan_ia_allowed"("plan_estudio_id")) AND (("asignatura_id" IS NULL) OR "public"."authz_asignatura_ia_allowed"("asignatura_id")))));



CREATE POLICY "interacciones_ia_update_own" ON "public"."interacciones_ia" FOR UPDATE TO "authenticated" USING ((("usuario_id" = ( SELECT "auth"."uid"() AS "uid")) AND (("plan_estudio_id" IS NULL) OR "public"."authz_plan_ia_allowed"("plan_estudio_id")) AND (("asignatura_id" IS NULL) OR "public"."authz_asignatura_ia_allowed"("asignatura_id")))) WITH CHECK ((("usuario_id" = ( SELECT "auth"."uid"() AS "uid")) AND (("plan_estudio_id" IS NULL) OR "public"."authz_plan_ia_allowed"("plan_estudio_id")) AND (("asignatura_id" IS NULL) OR "public"."authz_asignatura_ia_allowed"("asignatura_id"))));



ALTER TABLE "public"."learning_generation_jobs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "learning_generation_jobs_delete_by_scope" ON "public"."learning_generation_jobs" FOR DELETE TO "authenticated" USING ("public"."authz_asignatura_content_write_allowed"("asignatura_id"));



CREATE POLICY "learning_generation_jobs_insert_by_scope" ON "public"."learning_generation_jobs" FOR INSERT TO "authenticated" WITH CHECK ("public"."authz_asignatura_content_write_allowed"("asignatura_id"));



CREATE POLICY "learning_generation_jobs_select_by_scope" ON "public"."learning_generation_jobs" FOR SELECT TO "authenticated" USING (("public"."authz_has_permission"('asignaturas.ver'::"text") AND "public"."authz_can_access_asignatura"("asignatura_id")));



CREATE POLICY "learning_generation_jobs_update_by_scope" ON "public"."learning_generation_jobs" FOR UPDATE TO "authenticated" USING ("public"."authz_asignatura_content_write_allowed"("asignatura_id")) WITH CHECK ("public"."authz_asignatura_content_write_allowed"("asignatura_id"));



ALTER TABLE "public"."learning_objects" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "learning_objects_delete_by_scope" ON "public"."learning_objects" FOR DELETE TO "authenticated" USING ("public"."authz_asignatura_content_write_allowed"("asignatura_id"));



CREATE POLICY "learning_objects_insert_by_scope" ON "public"."learning_objects" FOR INSERT TO "authenticated" WITH CHECK ("public"."authz_asignatura_content_write_allowed"("asignatura_id"));



CREATE POLICY "learning_objects_select_by_scope" ON "public"."learning_objects" FOR SELECT TO "authenticated" USING (("public"."authz_has_permission"('asignaturas.ver'::"text") AND "public"."authz_can_access_asignatura"("asignatura_id")));



CREATE POLICY "learning_objects_update_by_scope" ON "public"."learning_objects" FOR UPDATE TO "authenticated" USING ("public"."authz_asignatura_content_write_allowed"("asignatura_id")) WITH CHECK ("public"."authz_asignatura_content_write_allowed"("asignatura_id"));



ALTER TABLE "public"."learning_quality_scores" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "learning_quality_scores_delete_by_scope" ON "public"."learning_quality_scores" FOR DELETE TO "authenticated" USING ("public"."authz_asignatura_content_write_allowed"("asignatura_id"));



CREATE POLICY "learning_quality_scores_insert_by_scope" ON "public"."learning_quality_scores" FOR INSERT TO "authenticated" WITH CHECK ("public"."authz_asignatura_content_write_allowed"("asignatura_id"));



CREATE POLICY "learning_quality_scores_select_by_scope" ON "public"."learning_quality_scores" FOR SELECT TO "authenticated" USING (("public"."authz_has_permission"('asignaturas.ver'::"text") AND "public"."authz_can_access_asignatura"("asignatura_id")));



CREATE POLICY "learning_quality_scores_update_by_scope" ON "public"."learning_quality_scores" FOR UPDATE TO "authenticated" USING ("public"."authz_asignatura_content_write_allowed"("asignatura_id")) WITH CHECK ("public"."authz_asignatura_content_write_allowed"("asignatura_id"));



ALTER TABLE "public"."lineas_curriculares_sugeridas" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "lineas_curriculares_sugeridas_delete_by_catalogos" ON "public"."lineas_curriculares_sugeridas" FOR DELETE TO "authenticated" USING ("public"."authz_has_permission"('catalogos.gestionar'::"text"));



CREATE POLICY "lineas_curriculares_sugeridas_insert_by_catalogos" ON "public"."lineas_curriculares_sugeridas" FOR INSERT TO "authenticated" WITH CHECK ("public"."authz_has_permission"('catalogos.gestionar'::"text"));



CREATE POLICY "lineas_curriculares_sugeridas_select_authenticated" ON "public"."lineas_curriculares_sugeridas" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "lineas_curriculares_sugeridas_update_by_catalogos" ON "public"."lineas_curriculares_sugeridas" FOR UPDATE TO "authenticated" USING ("public"."authz_has_permission"('catalogos.gestionar'::"text")) WITH CHECK ("public"."authz_has_permission"('catalogos.gestionar'::"text"));



ALTER TABLE "public"."lineas_plan" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "lineas_plan_delete_by_scope" ON "public"."lineas_plan" FOR DELETE TO "authenticated" USING ("public"."authz_plan_write_allowed"("plan_estudio_id"));



CREATE POLICY "lineas_plan_insert_by_scope" ON "public"."lineas_plan" FOR INSERT TO "authenticated" WITH CHECK ("public"."authz_plan_write_allowed"("plan_estudio_id"));



CREATE POLICY "lineas_plan_select_by_scope" ON "public"."lineas_plan" FOR SELECT TO "authenticated" USING ((("public"."authz_has_permission"('planes.ver'::"text") AND "public"."authz_can_access_plan"("plan_estudio_id")) OR "public"."authz_plan_write_allowed"("plan_estudio_id")));



CREATE POLICY "lineas_plan_update_by_scope" ON "public"."lineas_plan" FOR UPDATE TO "authenticated" USING ("public"."authz_plan_write_allowed"("plan_estudio_id")) WITH CHECK ("public"."authz_plan_write_allowed"("plan_estudio_id"));



ALTER TABLE "public"."message_file_references" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."notificaciones" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "notificaciones_select_own" ON "public"."notificaciones" FOR SELECT TO "authenticated" USING (("usuario_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "notificaciones_update_own" ON "public"."notificaciones" FOR UPDATE TO "authenticated" USING (("usuario_id" = ( SELECT "auth"."uid"() AS "uid"))) WITH CHECK (("usuario_id" = ( SELECT "auth"."uid"() AS "uid")));



ALTER TABLE "public"."observability_test_runs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "observability_test_runs_select_admin" ON "public"."observability_test_runs" FOR SELECT TO "authenticated" USING ("public"."authz_is_admin"());



ALTER TABLE "public"."observability_webhook_events" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "observability_webhook_events_select_admin" ON "public"."observability_webhook_events" FOR SELECT TO "authenticated" USING ("public"."authz_is_admin"());



ALTER TABLE "public"."permisos" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "permisos_select_auth_admin" ON "public"."permisos" FOR SELECT TO "supabase_auth_admin" USING (true);



CREATE POLICY "permisos_select_authenticated" ON "public"."permisos" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."plan_expertos" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "plan_expertos_delete_by_scope" ON "public"."plan_expertos" FOR DELETE TO "authenticated" USING (("public"."authz_has_permission"('expertos.gestionar'::"text") AND "public"."authz_can_access_plan"("plan_estudio_id") AND ("private"."plan_estado_clave"("plan_estudio_id") = ANY (ARRAY['CONSULTA_EXPERTOS'::"text", 'REV_SEDES'::"text"]))));



CREATE POLICY "plan_expertos_insert_by_scope" ON "public"."plan_expertos" FOR INSERT TO "authenticated" WITH CHECK (("public"."authz_has_permission"('expertos.gestionar'::"text") AND "public"."authz_can_access_plan"("plan_estudio_id") AND ("private"."plan_estado_clave"("plan_estudio_id") = ANY (ARRAY['CONSULTA_EXPERTOS'::"text", 'REV_SEDES'::"text"]))));



CREATE POLICY "plan_expertos_select_by_scope" ON "public"."plan_expertos" FOR SELECT TO "authenticated" USING ((("public"."authz_has_permission"('planes.ver'::"text") AND "public"."authz_can_access_plan"("plan_estudio_id")) OR ("public"."authz_has_permission"('expertos.gestionar'::"text") AND "public"."authz_can_access_plan"("plan_estudio_id") AND ("private"."plan_estado_clave"("plan_estudio_id") = ANY (ARRAY['CONSULTA_EXPERTOS'::"text", 'REV_SEDES'::"text"])))));



CREATE POLICY "plan_expertos_update_by_scope" ON "public"."plan_expertos" FOR UPDATE TO "authenticated" USING (("public"."authz_has_permission"('expertos.gestionar'::"text") AND "public"."authz_can_access_plan"("plan_estudio_id") AND ("private"."plan_estado_clave"("plan_estudio_id") = ANY (ARRAY['CONSULTA_EXPERTOS'::"text", 'REV_SEDES'::"text"])))) WITH CHECK (("public"."authz_has_permission"('expertos.gestionar'::"text") AND "public"."authz_can_access_plan"("plan_estudio_id") AND ("private"."plan_estado_clave"("plan_estudio_id") = ANY (ARRAY['CONSULTA_EXPERTOS'::"text", 'REV_SEDES'::"text"]))));



ALTER TABLE "public"."plan_mensajes_ia" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "plan_mensajes_ia_delete_by_scope" ON "public"."plan_mensajes_ia" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."conversaciones_plan" "c"
  WHERE (("c"."id" = "plan_mensajes_ia"."conversacion_plan_id") AND "public"."authz_plan_ia_allowed"("c"."plan_estudio_id")))));



CREATE POLICY "plan_mensajes_ia_insert_by_scope" ON "public"."plan_mensajes_ia" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."conversaciones_plan" "c"
  WHERE (("c"."id" = "plan_mensajes_ia"."conversacion_plan_id") AND "public"."authz_plan_ia_allowed"("c"."plan_estudio_id")))));



CREATE POLICY "plan_mensajes_ia_select_by_scope" ON "public"."plan_mensajes_ia" FOR SELECT TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM "public"."conversaciones_plan" "c"
  WHERE (("c"."id" = "plan_mensajes_ia"."conversacion_plan_id") AND (("c"."creado_por" = ( SELECT "auth"."uid"() AS "uid")) OR ("public"."authz_has_permission"('planes.ver'::"text") AND "public"."authz_can_access_plan"("c"."plan_estudio_id")))))) OR (EXISTS ( SELECT 1
   FROM "public"."conversaciones_plan" "c"
  WHERE (("c"."id" = "plan_mensajes_ia"."conversacion_plan_id") AND "public"."authz_plan_ia_allowed"("c"."plan_estudio_id"))))));



CREATE POLICY "plan_mensajes_ia_update_by_scope" ON "public"."plan_mensajes_ia" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."conversaciones_plan" "c"
  WHERE (("c"."id" = "plan_mensajes_ia"."conversacion_plan_id") AND "public"."authz_plan_ia_allowed"("c"."plan_estudio_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."conversaciones_plan" "c"
  WHERE (("c"."id" = "plan_mensajes_ia"."conversacion_plan_id") AND "public"."authz_plan_ia_allowed"("c"."plan_estudio_id")))));



ALTER TABLE "public"."planes_estudio" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "planes_estudio_delete_by_scope" ON "public"."planes_estudio" FOR DELETE TO "authenticated" USING ("public"."authz_plan_write_allowed"("id"));



CREATE POLICY "planes_estudio_insert_by_scope" ON "public"."planes_estudio" FOR INSERT TO "authenticated" WITH CHECK (("public"."authz_has_permission"('planes.crear'::"text") AND "public"."authz_can_access_carrera"("carrera_id")));



CREATE POLICY "planes_estudio_select_by_scope" ON "public"."planes_estudio" FOR SELECT TO "authenticated" USING (("public"."authz_has_permission"('planes.ver'::"text") AND ("public"."authz_can_access_carrera"("carrera_id") OR "private"."authz_is_responsable_de_plan"("id"))));



CREATE POLICY "planes_estudio_update_by_scope" ON "public"."planes_estudio" FOR UPDATE TO "authenticated" USING (("public"."authz_plan_write_allowed"("id") OR "public"."authz_plan_restricted_field_write_allowed"("id"))) WITH CHECK (("public"."authz_plan_write_allowed"("id") OR "public"."authz_plan_restricted_field_write_allowed"("id")));



ALTER TABLE "public"."reasignaciones" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "reasignaciones_select_by_permission" ON "public"."reasignaciones" FOR SELECT TO "authenticated" USING (("public"."authz_has_permission"('auditoria.ver'::"text") OR "public"."authz_has_permission"('usuarios.roles.gestionar'::"text")));



ALTER TABLE "public"."registros_oficiales_plan" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "registros_oficiales_plan_delete_admin" ON "public"."registros_oficiales_plan" FOR DELETE TO "authenticated" USING ("public"."authz_is_admin"());



CREATE POLICY "registros_oficiales_plan_insert_by_approval_scope" ON "public"."registros_oficiales_plan" FOR INSERT TO "authenticated" WITH CHECK (("public"."authz_has_permission"('planes.aprobar'::"text") AND "public"."authz_can_access_plan"("plan_estudio_id")));



CREATE POLICY "registros_oficiales_plan_select_by_scope" ON "public"."registros_oficiales_plan" FOR SELECT TO "authenticated" USING (("public"."authz_has_permission"('planes.ver'::"text") AND "public"."authz_can_access_plan"("plan_estudio_id")));



CREATE POLICY "registros_oficiales_plan_update_by_approval_scope" ON "public"."registros_oficiales_plan" FOR UPDATE TO "authenticated" USING (("public"."authz_has_permission"('planes.aprobar'::"text") AND "public"."authz_can_access_plan"("plan_estudio_id"))) WITH CHECK (("public"."authz_has_permission"('planes.aprobar'::"text") AND "public"."authz_can_access_plan"("plan_estudio_id")));



ALTER TABLE "public"."repositorios" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "repositorios_delete_by_owner_or_permission" ON "public"."repositorios" FOR DELETE TO "authenticated" USING ((("enviado_por" = ( SELECT "auth"."uid"() AS "uid")) OR "public"."authz_has_permission"('archivos.gestionar'::"text")));



CREATE POLICY "repositorios_insert_by_owner_or_permission" ON "public"."repositorios" FOR INSERT TO "authenticated" WITH CHECK ((("enviado_por" = ( SELECT "auth"."uid"() AS "uid")) OR "public"."authz_has_permission"('archivos.gestionar'::"text")));



CREATE POLICY "repositorios_select_by_owner_or_permission" ON "public"."repositorios" FOR SELECT TO "authenticated" USING ((("enviado_por" = ( SELECT "auth"."uid"() AS "uid")) OR "public"."authz_has_permission"('archivos.ver'::"text") OR "public"."authz_has_permission"('archivos.gestionar'::"text")));



CREATE POLICY "repositorios_update_by_owner_or_permission" ON "public"."repositorios" FOR UPDATE TO "authenticated" USING ((("enviado_por" = ( SELECT "auth"."uid"() AS "uid")) OR "public"."authz_has_permission"('archivos.gestionar'::"text"))) WITH CHECK ((("enviado_por" = ( SELECT "auth"."uid"() AS "uid")) OR "public"."authz_has_permission"('archivos.gestionar'::"text")));



ALTER TABLE "public"."responsables_asignatura" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "responsables_asignatura_delete_by_scope" ON "public"."responsables_asignatura" FOR DELETE TO "authenticated" USING ("public"."authz_asignatura_write_allowed"("asignatura_id"));



CREATE POLICY "responsables_asignatura_insert_by_scope" ON "public"."responsables_asignatura" FOR INSERT TO "authenticated" WITH CHECK ("public"."authz_asignatura_write_allowed"("asignatura_id"));



CREATE POLICY "responsables_asignatura_select_by_scope" ON "public"."responsables_asignatura" FOR SELECT TO "authenticated" USING ((("usuario_id" = ( SELECT "auth"."uid"() AS "uid")) OR ("public"."authz_has_permission"('asignaturas.ver'::"text") AND "public"."authz_can_access_asignatura"("asignatura_id")) OR "public"."authz_asignatura_write_allowed"("asignatura_id")));



CREATE POLICY "responsables_asignatura_update_by_scope" ON "public"."responsables_asignatura" FOR UPDATE TO "authenticated" USING ("public"."authz_asignatura_write_allowed"("asignatura_id")) WITH CHECK ("public"."authz_asignatura_write_allowed"("asignatura_id"));



ALTER TABLE "public"."roles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "roles_delete_by_catalogos" ON "public"."roles" FOR DELETE TO "authenticated" USING ("public"."authz_has_permission"('catalogos.gestionar'::"text"));



CREATE POLICY "roles_insert_by_catalogos" ON "public"."roles" FOR INSERT TO "authenticated" WITH CHECK ("public"."authz_has_permission"('catalogos.gestionar'::"text"));



ALTER TABLE "public"."roles_permisos" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "roles_permisos_delete_by_catalogos" ON "public"."roles_permisos" FOR DELETE TO "authenticated" USING ("public"."authz_has_permission"('catalogos.gestionar'::"text"));



CREATE POLICY "roles_permisos_insert_by_catalogos" ON "public"."roles_permisos" FOR INSERT TO "authenticated" WITH CHECK ("public"."authz_has_permission"('catalogos.gestionar'::"text"));



CREATE POLICY "roles_permisos_select_auth_admin" ON "public"."roles_permisos" FOR SELECT TO "supabase_auth_admin" USING (true);



CREATE POLICY "roles_permisos_select_authenticated" ON "public"."roles_permisos" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "roles_permisos_update_by_catalogos" ON "public"."roles_permisos" FOR UPDATE TO "authenticated" USING ("public"."authz_has_permission"('catalogos.gestionar'::"text")) WITH CHECK ("public"."authz_has_permission"('catalogos.gestionar'::"text"));



CREATE POLICY "roles_select_auth_admin" ON "public"."roles" FOR SELECT TO "supabase_auth_admin" USING (true);



CREATE POLICY "roles_select_authenticated" ON "public"."roles" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "roles_update_by_catalogos" ON "public"."roles" FOR UPDATE TO "authenticated" USING ("public"."authz_has_permission"('catalogos.gestionar'::"text")) WITH CHECK ("public"."authz_has_permission"('catalogos.gestionar'::"text"));



ALTER TABLE "public"."tareas_revision" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "tareas_revision_delete_by_scope" ON "public"."tareas_revision" FOR DELETE TO "authenticated" USING (("public"."authz_has_permission"('planes.aprobar'::"text") AND "public"."authz_can_access_plan"("plan_estudio_id")));



CREATE POLICY "tareas_revision_insert_by_scope" ON "public"."tareas_revision" FOR INSERT TO "authenticated" WITH CHECK (("public"."authz_has_permission"('planes.aprobar'::"text") AND "public"."authz_can_access_plan"("plan_estudio_id")));



CREATE POLICY "tareas_revision_select_by_scope" ON "public"."tareas_revision" FOR SELECT TO "authenticated" USING ((("asignado_a" = ( SELECT "auth"."uid"() AS "uid")) OR ("public"."authz_has_permission"('planes.aprobar'::"text") AND "public"."authz_can_access_plan"("plan_estudio_id"))));



CREATE POLICY "tareas_revision_update_by_scope" ON "public"."tareas_revision" FOR UPDATE TO "authenticated" USING ((("asignado_a" = ( SELECT "auth"."uid"() AS "uid")) OR ("public"."authz_has_permission"('planes.aprobar'::"text") AND "public"."authz_can_access_plan"("plan_estudio_id")))) WITH CHECK ((("asignado_a" = ( SELECT "auth"."uid"() AS "uid")) OR ("public"."authz_has_permission"('planes.aprobar'::"text") AND "public"."authz_can_access_plan"("plan_estudio_id"))));



ALTER TABLE "public"."tenant_memberships" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tenants" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."trabajos_generacion_ia" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."transiciones_estado_plan" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "transiciones_estado_plan_delete_by_catalogos" ON "public"."transiciones_estado_plan" FOR DELETE TO "authenticated" USING ("public"."authz_has_permission"('catalogos.gestionar'::"text"));



CREATE POLICY "transiciones_estado_plan_insert_by_catalogos" ON "public"."transiciones_estado_plan" FOR INSERT TO "authenticated" WITH CHECK ("public"."authz_has_permission"('catalogos.gestionar'::"text"));



CREATE POLICY "transiciones_estado_plan_select_authenticated" ON "public"."transiciones_estado_plan" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "transiciones_estado_plan_update_by_catalogos" ON "public"."transiciones_estado_plan" FOR UPDATE TO "authenticated" USING ("public"."authz_has_permission"('catalogos.gestionar'::"text")) WITH CHECK ("public"."authz_has_permission"('catalogos.gestionar'::"text"));



ALTER TABLE "public"."upload_sessions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."usuarios_app" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "usuarios_app_select_auth_admin" ON "public"."usuarios_app" FOR SELECT TO "supabase_auth_admin" USING (true);



CREATE POLICY "usuarios_app_select_own_or_manage" ON "public"."usuarios_app" FOR SELECT TO "authenticated" USING ((("id" = ( SELECT "auth"."uid"() AS "uid")) OR "public"."authz_has_permission"('usuarios.ver'::"text") OR "public"."authz_has_permission"('usuarios.gestionar'::"text")));



CREATE POLICY "usuarios_app_update_own_or_manage" ON "public"."usuarios_app" FOR UPDATE TO "authenticated" USING ((("id" = ( SELECT "auth"."uid"() AS "uid")) OR "public"."usuario_puede_gestionar_usuario"(( SELECT "auth"."uid"() AS "uid"), "id"))) WITH CHECK ((("id" = ( SELECT "auth"."uid"() AS "uid")) OR "public"."usuario_puede_gestionar_usuario"(( SELECT "auth"."uid"() AS "uid"), "id")));



ALTER TABLE "public"."usuarios_roles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "usuarios_roles_delete_by_hierarchy" ON "public"."usuarios_roles" FOR DELETE TO "authenticated" USING (("public"."usuario_puede_gestionar_usuario"(( SELECT "auth"."uid"() AS "uid"), "usuario_id") AND "public"."usuario_puede_gestionar_rol"(( SELECT "auth"."uid"() AS "uid"), "rol_id", "facultad_id", "carrera_id")));



CREATE POLICY "usuarios_roles_insert_by_hierarchy" ON "public"."usuarios_roles" FOR INSERT TO "authenticated" WITH CHECK (("public"."usuario_puede_gestionar_usuario"(( SELECT "auth"."uid"() AS "uid"), "usuario_id") AND "public"."usuario_puede_gestionar_rol"(( SELECT "auth"."uid"() AS "uid"), "rol_id", "facultad_id", "carrera_id")));



CREATE POLICY "usuarios_roles_select_auth_admin" ON "public"."usuarios_roles" FOR SELECT TO "supabase_auth_admin" USING (true);



CREATE POLICY "usuarios_roles_select_own_or_manage" ON "public"."usuarios_roles" FOR SELECT TO "authenticated" USING ((("usuario_id" = ( SELECT "auth"."uid"() AS "uid")) OR "public"."authz_has_permission"('usuarios.ver'::"text") OR "public"."authz_has_permission"('usuarios.roles.gestionar'::"text")));



CREATE POLICY "usuarios_roles_update_by_hierarchy" ON "public"."usuarios_roles" FOR UPDATE TO "authenticated" USING (("public"."usuario_puede_gestionar_usuario"(( SELECT "auth"."uid"() AS "uid"), "usuario_id") AND "public"."usuario_puede_gestionar_rol"(( SELECT "auth"."uid"() AS "uid"), "rol_id", "facultad_id", "carrera_id"))) WITH CHECK (("public"."usuario_puede_gestionar_usuario"(( SELECT "auth"."uid"() AS "uid"), "usuario_id") AND "public"."usuario_puede_gestionar_rol"(( SELECT "auth"."uid"() AS "uid"), "rol_id", "facultad_id", "carrera_id")));





ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."asignatura_mensajes_ia";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."asignaturas";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."observability_test_runs";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."observability_webhook_events";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."plan_mensajes_ia";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."planes_estudio";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."roles_permisos";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."usuarios_app";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."usuarios_roles";









GRANT USAGE ON SCHEMA "private" TO "authenticated";
GRANT USAGE ON SCHEMA "private" TO "service_role";



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";
GRANT USAGE ON SCHEMA "public" TO "supabase_auth_admin";

































































































































































































































































































































































































































































































































































































































GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."estructuras_asignatura" TO "anon";
GRANT ALL ON TABLE "public"."estructuras_asignatura" TO "authenticated";
GRANT ALL ON TABLE "public"."estructuras_asignatura" TO "service_role";



REVOKE ALL ON FUNCTION "private"."actualizar_estructura_asignatura_definicion"("p_id" "uuid", "p_definicion" "jsonb", "p_operaciones" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "private"."actualizar_estructura_asignatura_definicion"("p_id" "uuid", "p_definicion" "jsonb", "p_operaciones" "jsonb") TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."estructuras_plan" TO "anon";
GRANT ALL ON TABLE "public"."estructuras_plan" TO "authenticated";
GRANT ALL ON TABLE "public"."estructuras_plan" TO "service_role";



REVOKE ALL ON FUNCTION "private"."actualizar_estructura_plan_definicion"("p_id" "uuid", "p_definicion" "jsonb", "p_operaciones" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "private"."actualizar_estructura_plan_definicion"("p_id" "uuid", "p_definicion" "jsonb", "p_operaciones" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "private"."authz_asignatura_responsable_editor"("p_asignatura_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "private"."authz_asignatura_responsable_editor"("p_asignatura_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "private"."authz_asignatura_responsable_editor"("p_asignatura_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "private"."authz_claim_can_access_plan"("p_plan_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "private"."authz_claim_can_access_plan"("p_plan_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "private"."authz_claim_can_access_plan"("p_plan_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "private"."authz_claim_has_carrera_scope"("p_carrera_id" "uuid") FROM PUBLIC;



REVOKE ALL ON FUNCTION "private"."authz_claim_has_facultad_scope"("p_facultad_id" "uuid") FROM PUBLIC;



REVOKE ALL ON FUNCTION "private"."authz_claim_has_global_scope"() FROM PUBLIC;
GRANT ALL ON FUNCTION "private"."authz_claim_has_global_scope"() TO "authenticated";
GRANT ALL ON FUNCTION "private"."authz_claim_has_global_scope"() TO "service_role";



REVOKE ALL ON FUNCTION "private"."authz_claim_has_permission"("p_permiso" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "private"."authz_claim_has_permission"("p_permiso" "text") TO "authenticated";
GRANT ALL ON FUNCTION "private"."authz_claim_has_permission"("p_permiso" "text") TO "service_role";



REVOKE ALL ON FUNCTION "private"."authz_claim_has_role"("p_rol" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "private"."authz_claim_has_role"("p_rol" "text") TO "authenticated";
GRANT ALL ON FUNCTION "private"."authz_claim_has_role"("p_rol" "text") TO "service_role";



REVOKE ALL ON FUNCTION "private"."authz_is_responsable_asignatura"("p_asignatura_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "private"."authz_is_responsable_asignatura"("p_asignatura_id" "uuid") TO "service_role";
GRANT ALL ON FUNCTION "private"."authz_is_responsable_asignatura"("p_asignatura_id" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "private"."authz_is_responsable_de_plan"("p_plan_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "private"."authz_is_responsable_de_plan"("p_plan_id" "uuid") TO "service_role";
GRANT ALL ON FUNCTION "private"."authz_is_responsable_de_plan"("p_plan_id" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "private"."authz_is_simulated_self"("p_usuario_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "private"."authz_is_simulated_self"("p_usuario_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "private"."authz_is_simulated_self"("p_usuario_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "private"."authz_user_has_global_scope"("p_usuario_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "private"."authz_user_has_global_scope"("p_usuario_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "private"."authz_user_has_global_scope"("p_usuario_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "private"."authz_user_has_permission"("p_usuario_id" "uuid", "p_permiso" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "private"."authz_user_has_permission"("p_usuario_id" "uuid", "p_permiso" "text") TO "authenticated";
GRANT ALL ON FUNCTION "private"."authz_user_has_permission"("p_usuario_id" "uuid", "p_permiso" "text") TO "service_role";



REVOKE ALL ON FUNCTION "private"."authz_user_has_role"("p_usuario_id" "uuid", "p_rol" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "private"."authz_user_has_role"("p_usuario_id" "uuid", "p_rol" "text") TO "authenticated";
GRANT ALL ON FUNCTION "private"."authz_user_has_role"("p_usuario_id" "uuid", "p_rol" "text") TO "service_role";



REVOKE ALL ON FUNCTION "private"."catalogo_asignaturas_buscar"("p_q" "text", "p_facultad_id" "uuid", "p_carrera_id" "uuid", "p_plan_estudio_id" "uuid", "p_tipo" "public"."tipo_asignatura", "p_estado" "public"."estado_asignatura", "p_incluir_archivadas" boolean, "p_limit" integer, "p_offset" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "private"."catalogo_asignaturas_buscar"("p_q" "text", "p_facultad_id" "uuid", "p_carrera_id" "uuid", "p_plan_estudio_id" "uuid", "p_tipo" "public"."tipo_asignatura", "p_estado" "public"."estado_asignatura", "p_incluir_archivadas" boolean, "p_limit" integer, "p_offset" integer) TO "authenticated";
GRANT ALL ON FUNCTION "private"."catalogo_asignaturas_buscar"("p_q" "text", "p_facultad_id" "uuid", "p_carrera_id" "uuid", "p_plan_estudio_id" "uuid", "p_tipo" "public"."tipo_asignatura", "p_estado" "public"."estado_asignatura", "p_incluir_archivadas" boolean, "p_limit" integer, "p_offset" integer) TO "service_role";



REVOKE ALL ON FUNCTION "private"."entidad_intento_ia_json"("p_tipo_entidad" "public"."tipo_trabajo_generacion_ia", "p_entidad_id" "uuid") FROM PUBLIC;



REVOKE ALL ON FUNCTION "private"."intento_chat_ia_json"("p_intento_id" "uuid") FROM PUBLIC;



REVOKE ALL ON FUNCTION "private"."intento_generacion_ia_json"("p_intento_id" "uuid") FROM PUBLIC;



REVOKE ALL ON FUNCTION "private"."nombrar_responsable"("p_usuario" "uuid", "p_rol" "uuid", "p_facultad" "uuid", "p_carrera" "uuid", "p_actor" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "private"."nombrar_responsable"("p_usuario" "uuid", "p_rol" "uuid", "p_facultad" "uuid", "p_carrera" "uuid", "p_actor" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "private"."openai_response_id_vigente_trabajo_ia"("p_tipo" "public"."tipo_trabajo_generacion_ia", "p_entidad_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "private"."openai_response_id_vigente_trabajo_ia"("p_tipo" "public"."tipo_trabajo_generacion_ia", "p_entidad_id" "uuid") TO "service_role";



GRANT ALL ON TABLE "public"."learning_generation_jobs" TO "anon";
GRANT ALL ON TABLE "public"."learning_generation_jobs" TO "authenticated";
GRANT ALL ON TABLE "public"."learning_generation_jobs" TO "service_role";



REVOKE ALL ON FUNCTION "private"."persistir_resultado_recursos_aprendizaje_ia"("p_generation_job_id" "uuid", "p_openai_response_id" "text", "p_resultado" "jsonb", "p_objetos" "jsonb", "p_score" "jsonb") FROM PUBLIC;



REVOKE ALL ON FUNCTION "private"."plan_estado_clave"("p_plan_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "private"."plan_estado_clave"("p_plan_id" "uuid") TO "service_role";
GRANT ALL ON FUNCTION "private"."plan_estado_clave"("p_plan_id" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "private"."proteger_publicacion_trabajo_entidad_ia"() FROM PUBLIC;



REVOKE ALL ON FUNCTION "private"."proteger_publicacion_trabajo_recursos_ia"() FROM PUBLIC;



REVOKE ALL ON FUNCTION "private"."publicar_intento_chat_ia_interno"("p_intento_id" "uuid") FROM PUBLIC;



REVOKE ALL ON FUNCTION "private"."publicar_intento_entidad_ia_interno"("p_intento_id" "uuid", "p_token_reclamacion" "uuid", "p_exigir_token" boolean, "p_openai_response_id" "text", "p_estado_openai" "text", "p_iniciado_en" timestamp with time zone) FROM PUBLIC;



REVOKE ALL ON FUNCTION "private"."reasignar_responsabilidades"("p_origen" "uuid", "p_destino" "uuid", "p_actor" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "private"."reasignar_responsabilidades"("p_origen" "uuid", "p_destino" "uuid", "p_actor" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "private"."reparar_titulos_conversaciones_ia_legacy"() FROM PUBLIC;
GRANT ALL ON FUNCTION "private"."reparar_titulos_conversaciones_ia_legacy"() TO "service_role";



REVOKE ALL ON FUNCTION "private"."titulo_conversacion_ia_desde_prompt"("p_prompt" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "private"."titulo_conversacion_ia_desde_prompt"("p_prompt" "text") TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."estados_plan" TO "anon";
GRANT ALL ON TABLE "public"."estados_plan" TO "authenticated";
GRANT ALL ON TABLE "public"."estados_plan" TO "service_role";



REVOKE ALL ON FUNCTION "private"."transiciones_permitidas_plan"("p_plan_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "private"."transiciones_permitidas_plan"("p_plan_id" "uuid") TO "service_role";
GRANT ALL ON FUNCTION "private"."transiciones_permitidas_plan"("p_plan_id" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "private"."usuario_cubre_carrera_para_gestion"("p_actor" "uuid", "p_carrera_id" "uuid", "p_incluir_secretaria" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "private"."usuario_cubre_carrera_para_gestion"("p_actor" "uuid", "p_carrera_id" "uuid", "p_incluir_secretaria" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "private"."usuario_cubre_carrera_para_gestion"("p_actor" "uuid", "p_carrera_id" "uuid", "p_incluir_secretaria" boolean) TO "service_role";



REVOKE ALL ON FUNCTION "private"."usuario_es_externo_asignado_plan"("p_usuario_id" "uuid", "p_plan_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "private"."usuario_es_externo_asignado_plan"("p_usuario_id" "uuid", "p_plan_id" "uuid") TO "service_role";
GRANT ALL ON FUNCTION "private"."usuario_es_externo_asignado_plan"("p_usuario_id" "uuid", "p_plan_id" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "private"."usuario_es_jefe_encargado_plan"("p_usuario_id" "uuid", "p_plan_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "private"."usuario_es_jefe_encargado_plan"("p_usuario_id" "uuid", "p_plan_id" "uuid") TO "service_role";
GRANT ALL ON FUNCTION "private"."usuario_es_jefe_encargado_plan"("p_usuario_id" "uuid", "p_plan_id" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "private"."usuario_es_jefe_posgrado_encargado_plan"("p_usuario_id" "uuid", "p_plan_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "private"."usuario_es_jefe_posgrado_encargado_plan"("p_usuario_id" "uuid", "p_plan_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "private"."usuario_es_jefe_posgrado_encargado_plan"("p_usuario_id" "uuid", "p_plan_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "private"."usuario_puede_acceder_plan"("p_usuario_id" "uuid", "p_plan_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "private"."usuario_puede_acceder_plan"("p_usuario_id" "uuid", "p_plan_id" "uuid") TO "service_role";
GRANT ALL ON FUNCTION "private"."usuario_puede_acceder_plan"("p_usuario_id" "uuid", "p_plan_id" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "private"."usuario_puede_comentar_asignatura"("p_usuario_id" "uuid", "p_asignatura_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "private"."usuario_puede_comentar_asignatura"("p_usuario_id" "uuid", "p_asignatura_id" "uuid") TO "service_role";
GRANT ALL ON FUNCTION "private"."usuario_puede_comentar_asignatura"("p_usuario_id" "uuid", "p_asignatura_id" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "private"."usuario_puede_comentar_plan"("p_usuario_id" "uuid", "p_plan_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "private"."usuario_puede_comentar_plan"("p_usuario_id" "uuid", "p_plan_id" "uuid") TO "service_role";
GRANT ALL ON FUNCTION "private"."usuario_puede_comentar_plan"("p_usuario_id" "uuid", "p_plan_id" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "private"."usuario_puede_editar_asignatura"("p_usuario_id" "uuid", "p_asignatura_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "private"."usuario_puede_editar_asignatura"("p_usuario_id" "uuid", "p_asignatura_id" "uuid") TO "service_role";
GRANT ALL ON FUNCTION "private"."usuario_puede_editar_asignatura"("p_usuario_id" "uuid", "p_asignatura_id" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "private"."usuario_puede_editar_campo_asignatura"("p_usuario_id" "uuid", "p_asignatura_id" "uuid", "p_clave" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "private"."usuario_puede_editar_campo_asignatura"("p_usuario_id" "uuid", "p_asignatura_id" "uuid", "p_clave" "text") TO "service_role";
GRANT ALL ON FUNCTION "private"."usuario_puede_editar_campo_asignatura"("p_usuario_id" "uuid", "p_asignatura_id" "uuid", "p_clave" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "private"."usuario_puede_editar_campo_plan"("p_usuario_id" "uuid", "p_plan_id" "uuid", "p_clave" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "private"."usuario_puede_editar_campo_plan"("p_usuario_id" "uuid", "p_plan_id" "uuid", "p_clave" "text") TO "service_role";
GRANT ALL ON FUNCTION "private"."usuario_puede_editar_campo_plan"("p_usuario_id" "uuid", "p_plan_id" "uuid", "p_clave" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "private"."usuario_puede_editar_plan"("p_usuario_id" "uuid", "p_plan_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "private"."usuario_puede_editar_plan"("p_usuario_id" "uuid", "p_plan_id" "uuid") TO "service_role";
GRANT ALL ON FUNCTION "private"."usuario_puede_editar_plan"("p_usuario_id" "uuid", "p_plan_id" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "private"."usuario_puede_gestionar_rol"("p_actor" "uuid", "p_rol" "uuid", "p_facultad" "uuid", "p_carrera" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "private"."usuario_puede_gestionar_rol"("p_actor" "uuid", "p_rol" "uuid", "p_facultad" "uuid", "p_carrera" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "private"."usuario_puede_gestionar_rol"("p_actor" "uuid", "p_rol" "uuid", "p_facultad" "uuid", "p_carrera" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "private"."usuario_puede_gestionar_usuario"("p_actor" "uuid", "p_usuario" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "private"."usuario_puede_gestionar_usuario"("p_actor" "uuid", "p_usuario" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "private"."usuario_puede_gestionar_usuario"("p_actor" "uuid", "p_usuario" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "private"."usuario_puede_transicionar_asignatura"("p_usuario_id" "uuid", "p_asignatura_id" "uuid", "p_nuevo_estado" "public"."estado_asignatura") FROM PUBLIC;
GRANT ALL ON FUNCTION "private"."usuario_puede_transicionar_asignatura"("p_usuario_id" "uuid", "p_asignatura_id" "uuid", "p_nuevo_estado" "public"."estado_asignatura") TO "service_role";
GRANT ALL ON FUNCTION "private"."usuario_puede_transicionar_asignatura"("p_usuario_id" "uuid", "p_asignatura_id" "uuid", "p_nuevo_estado" "public"."estado_asignatura") TO "authenticated";



REVOKE ALL ON FUNCTION "private"."usuario_puede_transicionar_plan"("p_usuario_id" "uuid", "p_plan_id" "uuid", "p_hacia_estado_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "private"."usuario_puede_transicionar_plan"("p_usuario_id" "uuid", "p_plan_id" "uuid", "p_hacia_estado_id" "uuid") TO "service_role";
GRANT ALL ON FUNCTION "private"."usuario_puede_transicionar_plan"("p_usuario_id" "uuid", "p_plan_id" "uuid", "p_hacia_estado_id" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "private"."usuario_puede_usar_ia_asignatura"("p_usuario_id" "uuid", "p_asignatura_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "private"."usuario_puede_usar_ia_asignatura"("p_usuario_id" "uuid", "p_asignatura_id" "uuid") TO "service_role";
GRANT ALL ON FUNCTION "private"."usuario_puede_usar_ia_asignatura"("p_usuario_id" "uuid", "p_asignatura_id" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "private"."usuario_tiene_rol_activo"("p_usuario_id" "uuid", "p_rol" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "private"."usuario_tiene_rol_activo"("p_usuario_id" "uuid", "p_rol" "text") TO "authenticated";
GRANT ALL ON FUNCTION "private"."usuario_tiene_rol_activo"("p_usuario_id" "uuid", "p_rol" "text") TO "service_role";



REVOKE ALL ON FUNCTION "private"."usuario_tiene_rol_contextual_plan"("p_usuario_id" "uuid", "p_plan_id" "uuid", "p_rol" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "private"."usuario_tiene_rol_contextual_plan"("p_usuario_id" "uuid", "p_plan_id" "uuid", "p_rol" "text") TO "service_role";
GRANT ALL ON FUNCTION "private"."usuario_tiene_rol_contextual_plan"("p_usuario_id" "uuid", "p_plan_id" "uuid", "p_rol" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "private"."usuario_tiene_rol_en_plan"("p_usuario_id" "uuid", "p_plan_id" "uuid", "p_rol" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "private"."usuario_tiene_rol_en_plan"("p_usuario_id" "uuid", "p_plan_id" "uuid", "p_rol" "text") TO "service_role";
GRANT ALL ON FUNCTION "private"."usuario_tiene_rol_en_plan"("p_usuario_id" "uuid", "p_plan_id" "uuid", "p_rol" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."activar_cron_documentos_academicos"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."activar_cron_documentos_academicos"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."activar_cron_recuperacion_ia"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."activar_cron_recuperacion_ia"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."adoptar_publicar_intento_chat_ia_webhook"("p_intento_id" "uuid", "p_openai_response_id" "text", "p_estado_openai" "text", "p_iniciado_en" timestamp with time zone) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."adoptar_publicar_intento_chat_ia_webhook"("p_intento_id" "uuid", "p_openai_response_id" "text", "p_estado_openai" "text", "p_iniciado_en" timestamp with time zone) TO "service_role";



REVOKE ALL ON FUNCTION "public"."adoptar_publicar_intento_entidad_ia_webhook"("p_intento_id" "uuid", "p_openai_response_id" "text", "p_estado_openai" "text", "p_iniciado_en" timestamp with time zone) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."adoptar_publicar_intento_entidad_ia_webhook"("p_intento_id" "uuid", "p_openai_response_id" "text", "p_estado_openai" "text", "p_iniciado_en" timestamp with time zone) TO "service_role";



REVOKE ALL ON FUNCTION "public"."adoptar_publicar_intento_recursos_ia_webhook"("p_intento_id" "uuid", "p_openai_response_id" "text", "p_estado_openai" "text", "p_iniciado_en" timestamp with time zone) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."adoptar_publicar_intento_recursos_ia_webhook"("p_intento_id" "uuid", "p_openai_response_id" "text", "p_estado_openai" "text", "p_iniciado_en" timestamp with time zone) TO "service_role";



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



REVOKE ALL ON FUNCTION "public"."authz_asignatura_content_write_allowed"("p_asignatura_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."authz_asignatura_content_write_allowed"("p_asignatura_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."authz_asignatura_content_write_allowed"("p_asignatura_id" "uuid") TO "service_role";



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



REVOKE ALL ON FUNCTION "public"."authz_can_create_carrera_catalog"("p_facultad_id" "uuid", "p_nivel" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."authz_can_create_carrera_catalog"("p_facultad_id" "uuid", "p_nivel" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."authz_can_create_carrera_catalog"("p_facultad_id" "uuid", "p_nivel" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."authz_can_list_plan_catalog_for_facultad"("p_facultad_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."authz_can_list_plan_catalog_for_facultad"("p_facultad_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."authz_can_list_plan_catalog_for_facultad"("p_facultad_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."authz_can_manage_carrera_catalog"("p_carrera_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."authz_can_manage_carrera_catalog"("p_carrera_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."authz_can_manage_carrera_catalog"("p_carrera_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."authz_can_manage_facultad_catalog"("p_facultad_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."authz_can_manage_facultad_catalog"("p_facultad_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."authz_can_manage_facultad_catalog"("p_facultad_id" "uuid") TO "service_role";



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



REVOKE ALL ON FUNCTION "public"."authz_simulacion_activa"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."authz_simulacion_activa"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."authz_simulacion_activa"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."autorizar_uso_archivo_documental"("p_usuario_id" "uuid", "p_file_id" "uuid", "p_permiso" "public"."permiso_archivo_documental") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."autorizar_uso_archivo_documental"("p_usuario_id" "uuid", "p_file_id" "uuid", "p_permiso" "public"."permiso_archivo_documental") TO "service_role";



GRANT ALL ON FUNCTION "public"."build_asignaturas_prefix_tsquery"("p_search" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."build_asignaturas_prefix_tsquery"("p_search" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."build_asignaturas_prefix_tsquery"("p_search" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."carreras_guard_scoped_catalog_update"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."carreras_guard_scoped_catalog_update"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."carreras_guard_scoped_catalog_update"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."catalogo_asignaturas_buscar"("p_q" "text", "p_facultad_id" "uuid", "p_carrera_id" "uuid", "p_plan_estudio_id" "uuid", "p_tipo" "public"."tipo_asignatura", "p_estado" "public"."estado_asignatura", "p_incluir_archivadas" boolean, "p_limit" integer, "p_offset" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."catalogo_asignaturas_buscar"("p_q" "text", "p_facultad_id" "uuid", "p_carrera_id" "uuid", "p_plan_estudio_id" "uuid", "p_tipo" "public"."tipo_asignatura", "p_estado" "public"."estado_asignatura", "p_incluir_archivadas" boolean, "p_limit" integer, "p_offset" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."catalogo_asignaturas_buscar"("p_q" "text", "p_facultad_id" "uuid", "p_carrera_id" "uuid", "p_plan_estudio_id" "uuid", "p_tipo" "public"."tipo_asignatura", "p_estado" "public"."estado_asignatura", "p_incluir_archivadas" boolean, "p_limit" integer, "p_offset" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."confirmar_terminal_intento_generacion_ia"("p_intento_id" "uuid", "p_token_reclamacion" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."confirmar_terminal_intento_generacion_ia"("p_intento_id" "uuid", "p_token_reclamacion" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."consultar_intento_chat_ia"("p_intento_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."consultar_intento_chat_ia"("p_intento_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."consultar_intento_generacion_ia"("p_intento_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."consultar_intento_generacion_ia"("p_intento_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."consultar_publicacion_generacion_recursos_ia"("p_generation_job_id" "uuid", "p_openai_response_id" "text", "p_modo_referencias" "text", "p_consulta_referencias" "text", "p_referencias" "jsonb") FROM PUBLIC;



REVOKE ALL ON FUNCTION "public"."consultar_publicacion_intento_recursos_ia"("p_intento_id" "uuid", "p_generation_job_id" "uuid", "p_openai_response_id" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."consultar_publicacion_intento_recursos_ia"("p_intento_id" "uuid", "p_generation_job_id" "uuid", "p_openai_response_id" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."crear_recursos_placeholder"("p_asignatura_id" "uuid", "p_unidad_id" "text", "p_tema_id" "text", "p_tipos" "text"[]) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."crear_recursos_placeholder"("p_asignatura_id" "uuid", "p_unidad_id" "text", "p_tema_id" "text", "p_tipos" "text"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."crear_recursos_placeholder"("p_asignatura_id" "uuid", "p_unidad_id" "text", "p_tema_id" "text", "p_tipos" "text"[]) TO "service_role";



REVOKE ALL ON FUNCTION "public"."custom_access_token_hook"("event" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."custom_access_token_hook"("event" "jsonb") TO "service_role";
GRANT ALL ON FUNCTION "public"."custom_access_token_hook"("event" "jsonb") TO "supabase_auth_admin";



REVOKE ALL ON FUNCTION "public"."datos_validos_con_definicion"("p_definicion" "jsonb", "p_datos" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."datos_validos_con_definicion"("p_definicion" "jsonb", "p_datos" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."datos_validos_con_definicion"("p_definicion" "jsonb", "p_datos" "jsonb") TO "service_role";



GRANT ALL ON TABLE "public"."ingestion_jobs" TO "service_role";



REVOKE ALL ON FUNCTION "public"."encolar_trabajo_ingesta_documental"("p_tenant_id" "uuid", "p_upload_session_id" "uuid", "p_file_version_id" "uuid", "p_tipo" "public"."tipo_trabajo_ingesta_documental", "p_idempotency_key" "text", "p_payload" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."encolar_trabajo_ingesta_documental"("p_tenant_id" "uuid", "p_upload_session_id" "uuid", "p_file_version_id" "uuid", "p_tipo" "public"."tipo_trabajo_ingesta_documental", "p_idempotency_key" "text", "p_payload" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."expirar_intentos_chat_ia"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."expirar_intentos_chat_ia"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."expirar_intentos_entidad_ia"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."expirar_intentos_entidad_ia"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."expirar_intentos_generacion_ia"("p_handler" "text", "p_limite" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."expirar_intentos_generacion_ia"("p_handler" "text", "p_limite" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."expirar_trabajos_generacion_ia"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."expirar_trabajos_generacion_ia"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."facultades_guard_scoped_catalog_update"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."facultades_guard_scoped_catalog_update"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."facultades_guard_scoped_catalog_update"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."fallar_intento_recursos_ia"("p_intento_id" "uuid", "p_token_reclamacion" "uuid", "p_generation_job_id" "uuid", "p_openai_response_id" "text", "p_error" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fallar_intento_recursos_ia"("p_intento_id" "uuid", "p_token_reclamacion" "uuid", "p_generation_job_id" "uuid", "p_openai_response_id" "text", "p_error" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."finalizar_cancelacion_generacion_ia"("p_trabajo_id" "uuid", "p_token_reclamacion" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."finalizar_cancelacion_generacion_ia"("p_trabajo_id" "uuid", "p_token_reclamacion" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."finalizar_extraccion_openai_documental"("p_response_id" "text", "p_estado" "text", "p_contenido" "jsonb", "p_error" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."finalizar_extraccion_openai_documental"("p_response_id" "text", "p_estado" "text", "p_contenido" "jsonb", "p_error" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."finalizar_indexacion_documental"("p_file_version_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."finalizar_indexacion_documental"("p_file_version_id" "uuid") TO "service_role";



GRANT ALL ON TABLE "public"."trabajos_generacion_ia" TO "service_role";



REVOKE ALL ON FUNCTION "public"."finalizar_recursos_aprendizaje_ia"("p_trabajo_id" "uuid", "p_token_reclamacion" "uuid", "p_generation_job_id" "uuid", "p_openai_response_id" "text", "p_estado_openai" "text", "p_resultado" "jsonb", "p_objetos" "jsonb", "p_score" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."finalizar_recursos_aprendizaje_ia"("p_trabajo_id" "uuid", "p_token_reclamacion" "uuid", "p_generation_job_id" "uuid", "p_openai_response_id" "text", "p_estado_openai" "text", "p_resultado" "jsonb", "p_objetos" "jsonb", "p_score" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."finalizar_trabajo_generacion_ia"("p_trabajo_id" "uuid", "p_token_reclamacion" "uuid", "p_estado" "public"."estado_trabajo_generacion_ia", "p_estado_openai" "text", "p_resultado" "jsonb", "p_error" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."finalizar_trabajo_generacion_ia"("p_trabajo_id" "uuid", "p_token_reclamacion" "uuid", "p_estado" "public"."estado_trabajo_generacion_ia", "p_estado_openai" "text", "p_resultado" "jsonb", "p_error" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."finalizar_trabajo_ingesta_documental"("p_job_id" "uuid", "p_worker" "text", "p_ok" boolean, "p_error" "jsonb", "p_reintentar_en" timestamp with time zone) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."finalizar_trabajo_ingesta_documental"("p_job_id" "uuid", "p_worker" "text", "p_ok" boolean, "p_error" "jsonb", "p_reintentar_en" timestamp with time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_ajustar_seriacion_por_cambio_ciclo"() TO "anon";
GRANT ALL ON FUNCTION "public"."fn_ajustar_seriacion_por_cambio_ciclo"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_ajustar_seriacion_por_cambio_ciclo"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."fn_asignar_jefe_al_crear_plan"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fn_asignar_jefe_al_crear_plan"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."fn_asignaturas_contenido_tematico_ensure_ids"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fn_asignaturas_contenido_tematico_ensure_ids"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_asignaturas_contenido_tematico_ensure_ids"() TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_asignaturas_update_search_vector"() TO "anon";
GRANT ALL ON FUNCTION "public"."fn_asignaturas_update_search_vector"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_asignaturas_update_search_vector"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."fn_borradores_campo_set_plan_id"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fn_borradores_campo_set_plan_id"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."fn_calcular_score_preparacion"("p_asignatura_id" "uuid", "p_unidad_id" "text", "p_tema_id" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fn_calcular_score_preparacion"("p_asignatura_id" "uuid", "p_unidad_id" "text", "p_tema_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_calcular_score_preparacion"("p_asignatura_id" "uuid", "p_unidad_id" "text", "p_tema_id" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."fn_carreras_refresh_planes_nombre_display"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fn_carreras_refresh_planes_nombre_display"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."fn_ensure_contenido_tematico_ids"("j" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fn_ensure_contenido_tematico_ids"("j" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_ensure_contenido_tematico_ids"("j" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."fn_fill_author_from_auth_uid"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fn_fill_author_from_auth_uid"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_fill_author_from_auth_uid"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."fn_generar_nombre_plan_curricular"("p_carrera_id" "uuid", "p_fecha_inicio_imparticion" "date") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fn_generar_nombre_plan_curricular"("p_carrera_id" "uuid", "p_fecha_inicio_imparticion" "date") TO "service_role";



REVOKE ALL ON FUNCTION "public"."fn_grant_profesor_on_responsable"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fn_grant_profesor_on_responsable"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."fn_log_bibliografia_asignatura_cambios"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fn_log_bibliografia_asignatura_cambios"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."fn_log_cambios_planes_estudio"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fn_log_cambios_planes_estudio"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."fn_log_lineas_plan_cambios"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fn_log_lineas_plan_cambios"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."fn_notificar_cambio_estado_plan"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fn_notificar_cambio_estado_plan"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."fn_notificar_comentario_asignatura"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fn_notificar_comentario_asignatura"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."fn_notificar_comentario_plan"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fn_notificar_comentario_plan"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."fn_planes_exige_registro_oficial_aprobado"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fn_planes_exige_registro_oficial_aprobado"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_planes_exige_registro_oficial_aprobado"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."fn_planes_set_nombre_display"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fn_planes_set_nombre_display"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."fn_track_cambios_asignatura"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fn_track_cambios_asignatura"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."fn_validar_asignatura_estructura_plan"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fn_validar_asignatura_estructura_plan"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."fn_validar_datos_asignatura"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fn_validar_datos_asignatura"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."fn_validar_datos_plan"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fn_validar_datos_plan"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."json_schema_parcial_definicion"("p_definicion" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."json_schema_parcial_definicion"("p_definicion" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."json_schema_parcial_definicion"("p_definicion" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."liberar_trabajo_generacion_ia"("p_trabajo_id" "uuid", "p_token_reclamacion" "uuid", "p_estado_openai" "text", "p_proxima_revision_en" timestamp with time zone, "p_error" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."liberar_trabajo_generacion_ia"("p_trabajo_id" "uuid", "p_token_reclamacion" "uuid", "p_estado_openai" "text", "p_proxima_revision_en" timestamp with time zone, "p_error" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."listar_archivos_conversacion_documental"("p_usuario_id" "uuid", "p_tenant_id" "uuid", "p_conversation_type" "public"."tipo_conversacion_documental", "p_conversation_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."listar_archivos_conversacion_documental"("p_usuario_id" "uuid", "p_tenant_id" "uuid", "p_conversation_type" "public"."tipo_conversacion_documental", "p_conversation_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."listar_biblioteca_documental"("p_usuario_id" "uuid", "p_tenant_id" "uuid", "p_query" "text", "p_sort" "text", "p_limit" integer, "p_offset" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."listar_biblioteca_documental"("p_usuario_id" "uuid", "p_tenant_id" "uuid", "p_query" "text", "p_sort" "text", "p_limit" integer, "p_offset" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."listar_colecciones_documentales"("p_usuario_id" "uuid", "p_tenant_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."listar_colecciones_documentales"("p_usuario_id" "uuid", "p_tenant_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."marcar_intento_generacion_ia_publicado"("p_intento_id" "uuid", "p_token_reclamacion" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."marcar_intento_generacion_ia_publicado"("p_intento_id" "uuid", "p_token_reclamacion" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."materializar_sesion_carga_documento"("p_session_id" "uuid", "p_sha256" "text", "p_size_bytes" bigint, "p_detected_mime" "text", "p_storage_path" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."materializar_sesion_carga_documento"("p_session_id" "uuid", "p_sha256" "text", "p_size_bytes" bigint, "p_detected_mime" "text", "p_storage_path" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."nivel_es_posgrado"("p_nivel" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."nivel_es_posgrado"("p_nivel" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."nivel_es_posgrado"("p_nivel" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."nombrar_responsable"("p_usuario" "uuid", "p_rol" "uuid", "p_facultad" "uuid", "p_carrera" "uuid", "p_actor" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."nombrar_responsable"("p_usuario" "uuid", "p_rol" "uuid", "p_facultad" "uuid", "p_carrera" "uuid", "p_actor" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."nombrar_responsable"("p_usuario" "uuid", "p_rol" "uuid", "p_facultad" "uuid", "p_carrera" "uuid", "p_actor" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."normalizar_datos_por_definicion"("p_datos" "jsonb", "p_definicion" "jsonb", "p_null_invalid" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."normalizar_datos_por_definicion"("p_datos" "jsonb", "p_definicion" "jsonb", "p_null_invalid" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."normalizar_datos_por_definicion"("p_datos" "jsonb", "p_definicion" "jsonb", "p_null_invalid" boolean) TO "service_role";



REVOKE ALL ON FUNCTION "public"."normalizar_valor_por_propiedad"("p_value" "jsonb", "p_prop" "jsonb", "p_null_invalid" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."normalizar_valor_por_propiedad"("p_value" "jsonb", "p_prop" "jsonb", "p_null_invalid" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."normalizar_valor_por_propiedad"("p_value" "jsonb", "p_prop" "jsonb", "p_null_invalid" boolean) TO "service_role";



REVOKE ALL ON FUNCTION "public"."observability_admin_ping"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."observability_admin_ping"() TO "anon";
GRANT ALL ON FUNCTION "public"."observability_admin_ping"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."observability_admin_ping"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."observability_applied_migrations"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."observability_applied_migrations"() TO "anon";
GRANT ALL ON FUNCTION "public"."observability_applied_migrations"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."observability_applied_migrations"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."observability_public_ping"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."observability_public_ping"() TO "anon";
GRANT ALL ON FUNCTION "public"."observability_public_ping"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."observability_public_ping"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."persistir_resultado_recursos_aprendizaje_ia"("p_generation_job_id" "uuid", "p_openai_response_id" "text", "p_resultado" "jsonb", "p_objetos" "jsonb", "p_score" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."persistir_resultado_recursos_aprendizaje_ia"("p_generation_job_id" "uuid", "p_openai_response_id" "text", "p_resultado" "jsonb", "p_objetos" "jsonb", "p_score" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."plan_estado_clave"("p_plan_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."plan_estado_clave"("p_plan_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."plan_estado_clave"("p_plan_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."planes_catalogo_buscar"("p_search" "text", "p_facultad_id" "uuid", "p_carrera_id" "uuid", "p_estado_id" "uuid", "p_nivel" "text", "p_activo" boolean, "p_limit" integer, "p_offset" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."planes_catalogo_buscar"("p_search" "text", "p_facultad_id" "uuid", "p_carrera_id" "uuid", "p_estado_id" "uuid", "p_nivel" "text", "p_activo" boolean, "p_limit" integer, "p_offset" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."planes_catalogo_buscar"("p_search" "text", "p_facultad_id" "uuid", "p_carrera_id" "uuid", "p_estado_id" "uuid", "p_nivel" "text", "p_activo" boolean, "p_limit" integer, "p_offset" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."preparar_intento_chat_ia"("p_intento_id" "uuid", "p_tipo_conversacion" "public"."tipo_conversacion_documental", "p_conversacion_id" "uuid", "p_mensaje_id" "uuid", "p_usuario_id" "uuid", "p_solicitud" "jsonb", "p_modo_referencias" "text", "p_consulta_referencias" "text", "p_referencias" "jsonb", "p_actor" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."preparar_intento_chat_ia"("p_intento_id" "uuid", "p_tipo_conversacion" "public"."tipo_conversacion_documental", "p_conversacion_id" "uuid", "p_mensaje_id" "uuid", "p_usuario_id" "uuid", "p_solicitud" "jsonb", "p_modo_referencias" "text", "p_consulta_referencias" "text", "p_referencias" "jsonb", "p_actor" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."preparar_intento_entidad_ia"("p_intento_id" "uuid", "p_tipo_entidad" "public"."tipo_trabajo_generacion_ia", "p_entidad_id" "uuid", "p_usuario_id" "uuid", "p_contexto" "jsonb", "p_solicitud" "jsonb", "p_modo_referencias" "text", "p_consulta_referencias" "text", "p_referencias" "jsonb", "p_actor" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."preparar_intento_entidad_ia"("p_intento_id" "uuid", "p_tipo_entidad" "public"."tipo_trabajo_generacion_ia", "p_entidad_id" "uuid", "p_usuario_id" "uuid", "p_contexto" "jsonb", "p_solicitud" "jsonb", "p_modo_referencias" "text", "p_consulta_referencias" "text", "p_referencias" "jsonb", "p_actor" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."preparar_intento_generacion_ia"("p_intento_id" "uuid", "p_tipo_entidad" "public"."tipo_trabajo_generacion_ia", "p_entidad_id" "uuid", "p_handler" "text", "p_payload_version" integer, "p_contexto" "jsonb", "p_solicitud" "jsonb", "p_modo_referencias" "text", "p_consulta_referencias" "text", "p_referencias" "jsonb", "p_actor" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."preparar_intento_generacion_ia"("p_intento_id" "uuid", "p_tipo_entidad" "public"."tipo_trabajo_generacion_ia", "p_entidad_id" "uuid", "p_handler" "text", "p_payload_version" integer, "p_contexto" "jsonb", "p_solicitud" "jsonb", "p_modo_referencias" "text", "p_consulta_referencias" "text", "p_referencias" "jsonb", "p_actor" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."preparar_intento_recursos_ia"("p_intento_id" "uuid", "p_generation_job_id" "uuid", "p_usuario_id" "uuid", "p_contexto" "jsonb", "p_solicitud" "jsonb", "p_modo_referencias" "text", "p_consulta_referencias" "text", "p_referencias" "jsonb", "p_actor" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."preparar_intento_recursos_ia"("p_intento_id" "uuid", "p_generation_job_id" "uuid", "p_usuario_id" "uuid", "p_contexto" "jsonb", "p_solicitud" "jsonb", "p_modo_referencias" "text", "p_consulta_referencias" "text", "p_referencias" "jsonb", "p_actor" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."propiedad_restriccion_estados"("p_prop" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."propiedad_restriccion_estados"("p_prop" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."propiedad_restriccion_estados"("p_prop" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."propiedad_restriccion_permiso"("p_prop" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."propiedad_restriccion_permiso"("p_prop" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."propiedad_restriccion_permiso"("p_prop" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."propiedad_tiene_restriccion"("p_prop" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."propiedad_tiene_restriccion"("p_prop" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."propiedad_tiene_restriccion"("p_prop" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."publicar_generacion_recursos_ia"("p_generation_job_id" "uuid", "p_usuario_id" "uuid", "p_openai_response_id" "text", "p_estado_local" "public"."learning_generation_estado", "p_estado_openai" "text", "p_iniciado_en" timestamp with time zone, "p_metadata" "jsonb", "p_modo_referencias" "text", "p_consulta_referencias" "text", "p_referencias" "jsonb") FROM PUBLIC;



REVOKE ALL ON FUNCTION "public"."publicar_intento_chat_ia"("p_intento_id" "uuid", "p_token_reclamacion" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."publicar_intento_chat_ia"("p_intento_id" "uuid", "p_token_reclamacion" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."publicar_intento_entidad_ia"("p_intento_id" "uuid", "p_token_reclamacion" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."publicar_intento_entidad_ia"("p_intento_id" "uuid", "p_token_reclamacion" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."publicar_intento_recursos_ia"("p_intento_id" "uuid", "p_token_reclamacion" "uuid", "p_generation_job_id" "uuid", "p_usuario_id" "uuid", "p_openai_response_id" "text", "p_estado_local" "public"."learning_generation_estado", "p_estado_openai" "text", "p_iniciado_en" timestamp with time zone, "p_metadata" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."publicar_intento_recursos_ia"("p_intento_id" "uuid", "p_token_reclamacion" "uuid", "p_generation_job_id" "uuid", "p_usuario_id" "uuid", "p_openai_response_id" "text", "p_estado_local" "public"."learning_generation_estado", "p_estado_openai" "text", "p_iniciado_en" timestamp with time zone, "p_metadata" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."publicar_solicitud_chat_ia"("p_tipo_conversacion" "public"."tipo_conversacion_documental", "p_conversacion_id" "uuid", "p_mensaje_id" "uuid", "p_usuario_id" "uuid", "p_openai_response_id" "text", "p_estado_openai" "text", "p_iniciado_en" timestamp with time zone, "p_metadata" "jsonb", "p_modo_referencias" "text", "p_consulta_referencias" "text", "p_referencias" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."publicar_solicitud_chat_ia"("p_tipo_conversacion" "public"."tipo_conversacion_documental", "p_conversacion_id" "uuid", "p_mensaje_id" "uuid", "p_usuario_id" "uuid", "p_openai_response_id" "text", "p_estado_openai" "text", "p_iniciado_en" timestamp with time zone, "p_metadata" "jsonb", "p_modo_referencias" "text", "p_consulta_referencias" "text", "p_referencias" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."puede_usar_carga_documental_temporal"("p_object_name" "text", "p_incluir_subido" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."puede_usar_carga_documental_temporal"("p_object_name" "text", "p_incluir_subido" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."puede_usar_carga_documental_temporal"("p_object_name" "text", "p_incluir_subido" boolean) TO "service_role";



REVOKE ALL ON FUNCTION "public"."purgar_trabajos_generacion_ia"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."purgar_trabajos_generacion_ia"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."reasignar_responsabilidades"("p_origen" "uuid", "p_destino" "uuid", "p_actor" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."reasignar_responsabilidades"("p_origen" "uuid", "p_destino" "uuid", "p_actor" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."reasignar_responsabilidades"("p_origen" "uuid", "p_destino" "uuid", "p_actor" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."recalcular_learning_quality_scores"("p_asignatura_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."recalcular_learning_quality_scores"("p_asignatura_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."recalcular_learning_quality_scores"("p_asignatura_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."recalcular_vectores_asignaturas"() TO "anon";
GRANT ALL ON FUNCTION "public"."recalcular_vectores_asignaturas"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."recalcular_vectores_asignaturas"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."reclamar_intentos_chat_ia"("p_actor" "text", "p_limite" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."reclamar_intentos_chat_ia"("p_actor" "text", "p_limite" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."reclamar_intentos_generacion_ia"("p_handler" "text", "p_actor" "text", "p_limite" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."reclamar_intentos_generacion_ia"("p_handler" "text", "p_actor" "text", "p_limite" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."reclamar_lote_trabajos_generacion_ia"("p_reclamado_por" "text", "p_limite" integer, "p_arrendamiento" interval) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."reclamar_lote_trabajos_generacion_ia"("p_reclamado_por" "text", "p_limite" integer, "p_arrendamiento" interval) TO "service_role";



REVOKE ALL ON FUNCTION "public"."reclamar_trabajo_generacion_ia"("p_openai_response_id" "text", "p_reclamado_por" "text", "p_arrendamiento" interval) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."reclamar_trabajo_generacion_ia"("p_openai_response_id" "text", "p_reclamado_por" "text", "p_arrendamiento" interval) TO "service_role";



REVOKE ALL ON FUNCTION "public"."reclamar_trabajos_ingesta_documental"("p_worker" "text", "p_limite" integer, "p_arrendamiento" interval) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."reclamar_trabajos_ingesta_documental"("p_worker" "text", "p_limite" integer, "p_arrendamiento" interval) TO "service_role";



GRANT ALL ON TABLE "public"."observability_webhook_events" TO "anon";
GRANT ALL ON TABLE "public"."observability_webhook_events" TO "authenticated";
GRANT ALL ON TABLE "public"."observability_webhook_events" TO "service_role";



REVOKE ALL ON FUNCTION "public"."registrar_entrega_webhook_ia"("p_event_id" "text", "p_event_type" "text", "p_openai_response_id" "text", "p_test_run_id" "uuid", "p_payload" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."registrar_entrega_webhook_ia"("p_event_id" "text", "p_event_type" "text", "p_openai_response_id" "text", "p_test_run_id" "uuid", "p_payload" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."registrar_trabajo_generacion_ia"("p_tipo_entidad" "public"."tipo_trabajo_generacion_ia", "p_entidad_id" "uuid", "p_openai_response_id" "text", "p_estado_openai" "text", "p_iniciado_en" timestamp with time zone, "p_metadata" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."registrar_trabajo_generacion_ia"("p_tipo_entidad" "public"."tipo_trabajo_generacion_ia", "p_entidad_id" "uuid", "p_openai_response_id" "text", "p_estado_openai" "text", "p_iniciado_en" timestamp with time zone, "p_metadata" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."registrar_webhook_documental"("p_event_id" "text", "p_event_type" "text", "p_response_id" "text", "p_payload" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."registrar_webhook_documental"("p_event_id" "text", "p_event_type" "text", "p_response_id" "text", "p_payload" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."reprogramar_intento_chat_ia"("p_intento_id" "uuid", "p_token_reclamacion" "uuid", "p_error" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."reprogramar_intento_chat_ia"("p_intento_id" "uuid", "p_token_reclamacion" "uuid", "p_error" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."reprogramar_intento_generacion_ia"("p_intento_id" "uuid", "p_token_reclamacion" "uuid", "p_error" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."reprogramar_intento_generacion_ia"("p_intento_id" "uuid", "p_token_reclamacion" "uuid", "p_error" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."resumen_trabajos_generacion_ia"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."resumen_trabajos_generacion_ia"() TO "service_role";



GRANT ALL ON FUNCTION "public"."search_asignaturas"("p_search" "text", "p_facultad_id" "uuid", "p_carrera_id" "uuid", "p_plan_estudio_id" "uuid", "p_limit" integer, "p_offset" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."search_asignaturas"("p_search" "text", "p_facultad_id" "uuid", "p_carrera_id" "uuid", "p_plan_estudio_id" "uuid", "p_limit" integer, "p_offset" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."search_asignaturas"("p_search" "text", "p_facultad_id" "uuid", "p_carrera_id" "uuid", "p_plan_estudio_id" "uuid", "p_limit" integer, "p_offset" integer) TO "service_role";






GRANT ALL ON FUNCTION "public"."set_actualizado_en"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_actualizado_en"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_actualizado_en"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."solicitar_cancelacion_trabajo_generacion_ia"("p_openai_response_id" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."solicitar_cancelacion_trabajo_generacion_ia"("p_openai_response_id" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."suma_porcentajes"("jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."suma_porcentajes"("jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."suma_porcentajes"("jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."tipo_propiedad_json_schema"("p_prop" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."tipo_propiedad_json_schema"("p_prop" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."tipo_propiedad_json_schema"("p_prop" "jsonb") TO "service_role";



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



REVOKE ALL ON FUNCTION "public"."usuario_es_jefe_posgrado_encargado_plan"("p_usuario_id" "uuid", "p_plan_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."usuario_es_jefe_posgrado_encargado_plan"("p_usuario_id" "uuid", "p_plan_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."usuario_es_jefe_posgrado_encargado_plan"("p_usuario_id" "uuid", "p_plan_id" "uuid") TO "service_role";



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



REVOKE ALL ON FUNCTION "public"."usuario_puede_gestionar_rol"("p_actor" "uuid", "p_rol" "uuid", "p_facultad" "uuid", "p_carrera" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."usuario_puede_gestionar_rol"("p_actor" "uuid", "p_rol" "uuid", "p_facultad" "uuid", "p_carrera" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."usuario_puede_gestionar_rol"("p_actor" "uuid", "p_rol" "uuid", "p_facultad" "uuid", "p_carrera" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."usuario_puede_gestionar_usuario"("p_actor" "uuid", "p_usuario" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."usuario_puede_gestionar_usuario"("p_actor" "uuid", "p_usuario" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."usuario_puede_gestionar_usuario"("p_actor" "uuid", "p_usuario" "uuid") TO "service_role";



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



REVOKE ALL ON FUNCTION "public"."vincular_respuesta_intento_chat_ia"("p_intento_id" "uuid", "p_token_reclamacion" "uuid", "p_openai_response_id" "text", "p_estado_openai" "text", "p_iniciado_en" timestamp with time zone) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."vincular_respuesta_intento_chat_ia"("p_intento_id" "uuid", "p_token_reclamacion" "uuid", "p_openai_response_id" "text", "p_estado_openai" "text", "p_iniciado_en" timestamp with time zone) TO "service_role";



REVOKE ALL ON FUNCTION "public"."vincular_respuesta_intento_generacion_ia"("p_intento_id" "uuid", "p_token_reclamacion" "uuid", "p_openai_response_id" "text", "p_estado_openai" "text", "p_iniciado_en" timestamp with time zone) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."vincular_respuesta_intento_generacion_ia"("p_intento_id" "uuid", "p_token_reclamacion" "uuid", "p_openai_response_id" "text", "p_estado_openai" "text", "p_iniciado_en" timestamp with time zone) TO "service_role";













































GRANT ALL ON TABLE "public"."ai_request_references" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."archivos" TO "anon";
GRANT ALL ON TABLE "public"."archivos" TO "authenticated";
GRANT ALL ON TABLE "public"."archivos" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."archivos_repositorios" TO "anon";
GRANT ALL ON TABLE "public"."archivos_repositorios" TO "authenticated";
GRANT ALL ON TABLE "public"."archivos_repositorios" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."asignatura_mensajes_ia" TO "anon";
GRANT ALL ON TABLE "public"."asignatura_mensajes_ia" TO "authenticated";
GRANT ALL ON TABLE "public"."asignatura_mensajes_ia" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."asignaturas" TO "anon";
GRANT ALL ON TABLE "public"."asignaturas" TO "authenticated";
GRANT ALL ON TABLE "public"."asignaturas" TO "service_role";
GRANT SELECT ON TABLE "public"."asignaturas" TO "supabase_auth_admin";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."bibliografia_asignatura" TO "anon";
GRANT ALL ON TABLE "public"."bibliografia_asignatura" TO "authenticated";
GRANT ALL ON TABLE "public"."bibliografia_asignatura" TO "service_role";



GRANT ALL ON TABLE "public"."borradores_campo" TO "anon";
GRANT ALL ON TABLE "public"."borradores_campo" TO "authenticated";
GRANT ALL ON TABLE "public"."borradores_campo" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."cambios_asignatura" TO "anon";
GRANT ALL ON TABLE "public"."cambios_asignatura" TO "authenticated";
GRANT ALL ON TABLE "public"."cambios_asignatura" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."cambios_plan" TO "anon";
GRANT ALL ON TABLE "public"."cambios_plan" TO "authenticated";
GRANT ALL ON TABLE "public"."cambios_plan" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."carreras" TO "anon";
GRANT ALL ON TABLE "public"."carreras" TO "authenticated";
GRANT ALL ON TABLE "public"."carreras" TO "service_role";
GRANT SELECT ON TABLE "public"."carreras" TO "supabase_auth_admin";



GRANT ALL ON TABLE "public"."collection_files" TO "service_role";



GRANT ALL ON TABLE "public"."collections" TO "service_role";



GRANT ALL ON TABLE "public"."comentarios_adjuntos" TO "anon";
GRANT ALL ON TABLE "public"."comentarios_adjuntos" TO "authenticated";
GRANT ALL ON TABLE "public"."comentarios_adjuntos" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."comentarios_asignatura" TO "anon";
GRANT ALL ON TABLE "public"."comentarios_asignatura" TO "authenticated";
GRANT ALL ON TABLE "public"."comentarios_asignatura" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."comentarios_plan" TO "anon";
GRANT ALL ON TABLE "public"."comentarios_plan" TO "authenticated";
GRANT ALL ON TABLE "public"."comentarios_plan" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."conversaciones_asignatura" TO "anon";
GRANT ALL ON TABLE "public"."conversaciones_asignatura" TO "authenticated";
GRANT ALL ON TABLE "public"."conversaciones_asignatura" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."conversaciones_plan" TO "anon";
GRANT ALL ON TABLE "public"."conversaciones_plan" TO "authenticated";
GRANT ALL ON TABLE "public"."conversaciones_plan" TO "service_role";



GRANT ALL ON TABLE "public"."conversation_files" TO "service_role";



GRANT INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."crash_reports" TO "anon";
GRANT ALL ON TABLE "public"."crash_reports" TO "authenticated";
GRANT ALL ON TABLE "public"."crash_reports" TO "service_role";



GRANT ALL ON TABLE "public"."document_chunks" TO "service_role";



GRANT ALL ON TABLE "public"."document_extractions" TO "service_role";



GRANT ALL ON TABLE "public"."document_webhook_events" TO "service_role";



GRANT ALL ON TABLE "public"."ejecuciones_recuperacion_ia" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."expertos" TO "anon";
GRANT ALL ON TABLE "public"."expertos" TO "authenticated";
GRANT ALL ON TABLE "public"."expertos" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."facultades" TO "anon";
GRANT ALL ON TABLE "public"."facultades" TO "authenticated";
GRANT ALL ON TABLE "public"."facultades" TO "service_role";
GRANT SELECT ON TABLE "public"."facultades" TO "supabase_auth_admin";



GRANT ALL ON TABLE "public"."file_blobs" TO "service_role";



GRANT ALL ON TABLE "public"."file_events" TO "service_role";



GRANT ALL ON TABLE "public"."file_grants" TO "service_role";



GRANT ALL ON TABLE "public"."file_user_state" TO "service_role";



GRANT ALL ON TABLE "public"."file_versions" TO "service_role";



GRANT ALL ON TABLE "public"."files" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."interacciones_ia" TO "anon";
GRANT ALL ON TABLE "public"."interacciones_ia" TO "authenticated";
GRANT ALL ON TABLE "public"."interacciones_ia" TO "service_role";



GRANT ALL ON TABLE "public"."learning_objects" TO "anon";
GRANT ALL ON TABLE "public"."learning_objects" TO "authenticated";
GRANT ALL ON TABLE "public"."learning_objects" TO "service_role";



GRANT ALL ON TABLE "public"."learning_quality_scores" TO "anon";
GRANT ALL ON TABLE "public"."learning_quality_scores" TO "authenticated";
GRANT ALL ON TABLE "public"."learning_quality_scores" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."lineas_curriculares_sugeridas" TO "anon";
GRANT ALL ON TABLE "public"."lineas_curriculares_sugeridas" TO "authenticated";
GRANT ALL ON TABLE "public"."lineas_curriculares_sugeridas" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."lineas_plan" TO "anon";
GRANT ALL ON TABLE "public"."lineas_plan" TO "authenticated";
GRANT ALL ON TABLE "public"."lineas_plan" TO "service_role";



GRANT ALL ON TABLE "public"."message_file_references" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."notificaciones" TO "anon";
GRANT ALL ON TABLE "public"."notificaciones" TO "authenticated";
GRANT ALL ON TABLE "public"."notificaciones" TO "service_role";



GRANT ALL ON TABLE "public"."observability_test_runs" TO "anon";
GRANT ALL ON TABLE "public"."observability_test_runs" TO "authenticated";
GRANT ALL ON TABLE "public"."observability_test_runs" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."permisos" TO "anon";
GRANT ALL ON TABLE "public"."permisos" TO "authenticated";
GRANT ALL ON TABLE "public"."permisos" TO "service_role";
GRANT SELECT ON TABLE "public"."permisos" TO "supabase_auth_admin";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."plan_expertos" TO "anon";
GRANT ALL ON TABLE "public"."plan_expertos" TO "authenticated";
GRANT ALL ON TABLE "public"."plan_expertos" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."plan_mensajes_ia" TO "anon";
GRANT ALL ON TABLE "public"."plan_mensajes_ia" TO "authenticated";
GRANT ALL ON TABLE "public"."plan_mensajes_ia" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."planes_estudio" TO "anon";
GRANT ALL ON TABLE "public"."planes_estudio" TO "authenticated";
GRANT ALL ON TABLE "public"."planes_estudio" TO "service_role";
GRANT SELECT ON TABLE "public"."planes_estudio" TO "supabase_auth_admin";



GRANT ALL ON TABLE "public"."plantilla_asignatura" TO "anon";
GRANT ALL ON TABLE "public"."plantilla_asignatura" TO "authenticated";
GRANT ALL ON TABLE "public"."plantilla_asignatura" TO "service_role";



GRANT ALL ON TABLE "public"."plantilla_plan" TO "anon";
GRANT ALL ON TABLE "public"."plantilla_plan" TO "authenticated";
GRANT ALL ON TABLE "public"."plantilla_plan" TO "service_role";



GRANT ALL ON TABLE "public"."reasignaciones" TO "anon";
GRANT ALL ON TABLE "public"."reasignaciones" TO "authenticated";
GRANT ALL ON TABLE "public"."reasignaciones" TO "service_role";



GRANT ALL ON TABLE "public"."registros_oficiales_plan" TO "anon";
GRANT ALL ON TABLE "public"."registros_oficiales_plan" TO "authenticated";
GRANT ALL ON TABLE "public"."registros_oficiales_plan" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."usuarios_app" TO "anon";
GRANT ALL ON TABLE "public"."usuarios_app" TO "authenticated";
GRANT ALL ON TABLE "public"."usuarios_app" TO "service_role";
GRANT SELECT ON TABLE "public"."usuarios_app" TO "supabase_auth_admin";



GRANT ALL ON TABLE "public"."registros_oficiales_plan_detalle" TO "anon";
GRANT ALL ON TABLE "public"."registros_oficiales_plan_detalle" TO "authenticated";
GRANT ALL ON TABLE "public"."registros_oficiales_plan_detalle" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."repositorios" TO "anon";
GRANT ALL ON TABLE "public"."repositorios" TO "authenticated";
GRANT ALL ON TABLE "public"."repositorios" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."responsables_asignatura" TO "anon";
GRANT ALL ON TABLE "public"."responsables_asignatura" TO "authenticated";
GRANT ALL ON TABLE "public"."responsables_asignatura" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."roles" TO "anon";
GRANT ALL ON TABLE "public"."roles" TO "authenticated";
GRANT ALL ON TABLE "public"."roles" TO "service_role";
GRANT SELECT ON TABLE "public"."roles" TO "supabase_auth_admin";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."roles_permisos" TO "anon";
GRANT ALL ON TABLE "public"."roles_permisos" TO "authenticated";
GRANT ALL ON TABLE "public"."roles_permisos" TO "service_role";
GRANT SELECT ON TABLE "public"."roles_permisos" TO "supabase_auth_admin";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."tareas_revision" TO "anon";
GRANT ALL ON TABLE "public"."tareas_revision" TO "authenticated";
GRANT ALL ON TABLE "public"."tareas_revision" TO "service_role";



GRANT ALL ON TABLE "public"."tenant_memberships" TO "service_role";



GRANT ALL ON TABLE "public"."tenants" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."transiciones_estado_plan" TO "anon";
GRANT ALL ON TABLE "public"."transiciones_estado_plan" TO "authenticated";
GRANT ALL ON TABLE "public"."transiciones_estado_plan" TO "service_role";



GRANT ALL ON TABLE "public"."upload_sessions" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."usuarios_roles" TO "anon";
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
-- Dumped schema changes for auth and storage
--

CREATE POLICY "acceso a todos en desarrollo dx3g7q_0" ON "storage"."objects" FOR SELECT USING (("bucket_id" = 'ai-storage'::"text"));



CREATE POLICY "acceso a todos en desarrollo dx3g7q_1" ON "storage"."objects" FOR INSERT WITH CHECK (("bucket_id" = 'ai-storage'::"text"));



CREATE POLICY "acceso a todos en desarrollo dx3g7q_2" ON "storage"."objects" FOR UPDATE USING (("bucket_id" = 'ai-storage'::"text"));



CREATE POLICY "acceso a todos en desarrollo dx3g7q_3" ON "storage"."objects" FOR DELETE USING (("bucket_id" = 'ai-storage'::"text"));



CREATE POLICY "avatars_authenticated_delete" ON "storage"."objects" FOR DELETE TO "authenticated" USING (("bucket_id" = 'avatars'::"text"));



CREATE POLICY "avatars_authenticated_insert" ON "storage"."objects" FOR INSERT TO "authenticated" WITH CHECK (("bucket_id" = 'avatars'::"text"));



CREATE POLICY "avatars_authenticated_update" ON "storage"."objects" FOR UPDATE TO "authenticated" USING (("bucket_id" = 'avatars'::"text")) WITH CHECK (("bucket_id" = 'avatars'::"text"));



CREATE POLICY "comment_attachments_delete" ON "storage"."objects" FOR DELETE TO "authenticated" USING ((("bucket_id" = 'comentarios-adjuntos'::"text") AND
CASE
    WHEN ("name" ~* '^comentarios/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/.+$'::"text") THEN "private"."usuario_puede_comentar_plan"(( SELECT "auth"."uid"() AS "uid"), ("split_part"("name", '/'::"text", 2))::"uuid")
    ELSE false
END));



CREATE POLICY "comment_attachments_insert" ON "storage"."objects" FOR INSERT TO "authenticated" WITH CHECK ((("bucket_id" = 'comentarios-adjuntos'::"text") AND
CASE
    WHEN ("name" ~* '^comentarios/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/.+$'::"text") THEN "private"."usuario_puede_comentar_plan"(( SELECT "auth"."uid"() AS "uid"), ("split_part"("name", '/'::"text", 2))::"uuid")
    ELSE false
END));



CREATE POLICY "comment_attachments_select" ON "storage"."objects" FOR SELECT TO "authenticated" USING ((("bucket_id" = 'comentarios-adjuntos'::"text") AND
CASE
    WHEN ("name" ~* '^comentarios/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/.+$'::"text") THEN "public"."authz_can_access_plan"(("split_part"("name", '/'::"text", 2))::"uuid")
    ELSE false
END));



CREATE POLICY "documentos_academicos_leer_temporal" ON "storage"."objects" FOR SELECT TO "authenticated" USING ((("bucket_id" = 'documentos-academicos'::"text") AND "public"."puede_usar_carga_documental_temporal"("name", true)));



CREATE POLICY "documentos_academicos_reanudar_temporal" ON "storage"."objects" FOR UPDATE TO "authenticated" USING ((("bucket_id" = 'documentos-academicos'::"text") AND "public"."puede_usar_carga_documental_temporal"("name", false))) WITH CHECK ((("bucket_id" = 'documentos-academicos'::"text") AND "public"."puede_usar_carga_documental_temporal"("name", false)));



CREATE POLICY "documentos_academicos_upload_temporal" ON "storage"."objects" FOR INSERT TO "authenticated" WITH CHECK ((("bucket_id" = 'documentos-academicos'::"text") AND "public"."puede_usar_carga_documental_temporal"("name", false)));



CREATE POLICY "learning_packages_storage_delete" ON "storage"."objects" FOR DELETE TO "authenticated" USING ((("bucket_id" = 'learning-packages'::"text") AND
CASE
    WHEN ("name" ~* '^asignaturas/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/.+$'::"text") THEN "public"."authz_asignatura_content_write_allowed"(("split_part"("name", '/'::"text", 2))::"uuid")
    ELSE false
END));



CREATE POLICY "learning_packages_storage_select" ON "storage"."objects" FOR SELECT TO "authenticated" USING ((("bucket_id" = 'learning-packages'::"text") AND "public"."authz_has_permission"('asignaturas.ver'::"text") AND
CASE
    WHEN ("name" ~* '^asignaturas/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/.+$'::"text") THEN "public"."authz_can_access_asignatura"(("split_part"("name", '/'::"text", 2))::"uuid")
    ELSE false
END));



CREATE POLICY "official_plan_documents_delete" ON "storage"."objects" FOR DELETE TO "authenticated" USING ((("bucket_id" = 'documentos-oficiales'::"text") AND "public"."authz_has_permission"('planes.aprobar'::"text") AND
CASE
    WHEN ("name" ~* '^planes/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/.+$'::"text") THEN "public"."authz_can_access_plan"(("split_part"("name", '/'::"text", 2))::"uuid")
    ELSE false
END));



CREATE POLICY "official_plan_documents_insert" ON "storage"."objects" FOR INSERT TO "authenticated" WITH CHECK ((("bucket_id" = 'documentos-oficiales'::"text") AND "public"."authz_has_permission"('planes.aprobar'::"text") AND
CASE
    WHEN ("name" ~* '^planes/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/.+$'::"text") THEN "public"."authz_can_access_plan"(("split_part"("name", '/'::"text", 2))::"uuid")
    ELSE false
END));



CREATE POLICY "official_plan_documents_select" ON "storage"."objects" FOR SELECT TO "authenticated" USING ((("bucket_id" = 'documentos-oficiales'::"text") AND "public"."authz_has_permission"('planes.ver'::"text") AND
CASE
    WHEN ("name" ~* '^planes/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/.+$'::"text") THEN "public"."authz_can_access_plan"(("split_part"("name", '/'::"text", 2))::"uuid")
    ELSE false
END));



CREATE POLICY "official_plan_documents_update" ON "storage"."objects" FOR UPDATE TO "authenticated" USING ((("bucket_id" = 'documentos-oficiales'::"text") AND "public"."authz_has_permission"('planes.aprobar'::"text") AND
CASE
    WHEN ("name" ~* '^planes/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/.+$'::"text") THEN "public"."authz_can_access_plan"(("split_part"("name", '/'::"text", 2))::"uuid")
    ELSE false
END)) WITH CHECK ((("bucket_id" = 'documentos-oficiales'::"text") AND "public"."authz_has_permission"('planes.aprobar'::"text") AND
CASE
    WHEN ("name" ~* '^planes/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/.+$'::"text") THEN "public"."authz_can_access_plan"(("split_part"("name", '/'::"text", 2))::"uuid")
    ELSE false
END));



CREATE POLICY "todos los permisos dx3g7q_0" ON "storage"."objects" FOR INSERT WITH CHECK (("bucket_id" = 'ai-storage'::"text"));



CREATE POLICY "todos los permisos dx3g7q_1" ON "storage"."objects" FOR SELECT USING (("bucket_id" = 'ai-storage'::"text"));



CREATE POLICY "todos los permisos dx3g7q_2" ON "storage"."objects" FOR DELETE USING (("bucket_id" = 'ai-storage'::"text"));



CREATE POLICY "todos los permisos dx3g7q_3" ON "storage"."objects" FOR UPDATE USING (("bucket_id" = 'ai-storage'::"text"));



