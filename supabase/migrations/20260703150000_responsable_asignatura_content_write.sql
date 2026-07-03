-- Permitir que un responsable de asignatura (PROFESOR_RESPONSABLE / COAUTOR)
-- edite el contenido de SU asignatura mientras el plan esta en una etapa de
-- escritura normal (BORRADOR / REVISION).
--
-- Antes: editar una asignatura exigia poder editar el plan
-- (usuario_puede_editar_plan -> roles de plan: ADMIN / JEFE_* / SECRETARIO).
-- Un profesor responsable solo tenia acceso de LECTURA
-- (authz_can_access_asignatura -> authz_is_responsable_asignatura), sin ninguna
-- ruta de escritura ni en cliente ni en BD.
--
-- Diseno: se introduce una capacidad de "escritura de contenido" separada de la
-- "escritura administrativa completa" (authz_asignatura_write_allowed). La
-- primera SI incluye a los responsables editores; la segunda NO cambia, de modo
-- que borrar la asignatura y gestionar responsables siguen restringidos a los
-- roles de plan. Los campos restringidos (x-acad-ia.restriccion) siguen fuera
-- del alcance del responsable porque el trigger de datos sigue validando cada
-- campo restringido con usuario_puede_editar_campo_asignatura.
--
-- REVISOR queda excluido a proposito: solo comenta / revisa, no edita.

-- 1. Es el actor un responsable EDITOR de esta asignatura y el plan lo permite?
--    Cubre tanto la simulacion de rol (PROFESOR + asignatura_id + responsable_rol
--    en el JWT) como la responsabilidad real (fila en responsables_asignatura).
create or replace function private.authz_asignatura_responsable_editor(p_asignatura_id uuid)
returns boolean
language sql
stable
security definer
set search_path to public, private, auth, extensions, pg_temp
as $$
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

revoke all on function private.authz_asignatura_responsable_editor(uuid) from public, anon;
grant execute on function private.authz_asignatura_responsable_editor(uuid) to authenticated, service_role;

-- 2. Escritura de CONTENIDO: escritura administrativa completa O responsable editor.
--    Es un superconjunto de authz_asignatura_write_allowed, por lo que puede
--    sustituirlo con seguridad en las politicas de contenido.
create or replace function public.authz_asignatura_content_write_allowed(p_asignatura_id uuid)
returns boolean
language sql
stable
set search_path to public, private, auth, extensions, pg_temp
as $$
  select public.authz_asignatura_write_allowed(p_asignatura_id)
    or private.authz_asignatura_responsable_editor(p_asignatura_id);
$$;

revoke all on function public.authz_asignatura_content_write_allowed(uuid) from public, anon;
grant execute on function public.authz_asignatura_content_write_allowed(uuid) to authenticated, service_role;

-- 3. UPDATE de asignaturas: permitir a los responsables editores.
--    (DELETE / INSERT y la gestion de responsables siguen usando
--     authz_asignatura_write_allowed, asi que no se ven afectados.)
drop policy if exists asignaturas_update_by_scope on public.asignaturas;
create policy asignaturas_update_by_scope on public.asignaturas
  for update to authenticated
  using (
    public.authz_plan_write_allowed(plan_estudio_id)
    or public.authz_asignatura_content_write_allowed(id)
    or public.authz_asignatura_restricted_field_write_allowed(id)
  )
  with check (
    public.authz_plan_write_allowed(plan_estudio_id)
    or public.authz_asignatura_content_write_allowed(id)
    or public.authz_asignatura_restricted_field_write_allowed(id)
  );

-- 4. Bibliografia de la asignatura: los responsables editores gestionan la suya.
drop policy if exists bibliografia_asignatura_insert_by_scope on public.bibliografia_asignatura;
create policy bibliografia_asignatura_insert_by_scope on public.bibliografia_asignatura
  for insert to authenticated
  with check (public.authz_asignatura_content_write_allowed(asignatura_id));

drop policy if exists bibliografia_asignatura_update_by_scope on public.bibliografia_asignatura;
create policy bibliografia_asignatura_update_by_scope on public.bibliografia_asignatura
  for update to authenticated
  using (public.authz_asignatura_content_write_allowed(asignatura_id))
  with check (public.authz_asignatura_content_write_allowed(asignatura_id));

drop policy if exists bibliografia_asignatura_delete_by_scope on public.bibliografia_asignatura;
create policy bibliografia_asignatura_delete_by_scope on public.bibliografia_asignatura
  for delete to authenticated
  using (public.authz_asignatura_content_write_allowed(asignatura_id));

-- 5. Trigger de validacion de datos: el gate de "escritura completa" (que permite
--    tocar columnas fuera de `datos`: contenido_tematico, criterios, nombre, etc.)
--    ahora reconoce al responsable editor. Los campos RESTRINGIDOS siguen
--    validandose por campo con usuario_puede_editar_campo_asignatura, por lo que
--    el responsable NO puede editarlos. Unico cambio vs. la version previa:
--    v_has_full_write usa authz_asignatura_content_write_allowed.
create or replace function public.fn_validar_datos_asignatura()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'private', 'auth', 'extensions', 'pg_temp'
as $function$
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
$function$;
