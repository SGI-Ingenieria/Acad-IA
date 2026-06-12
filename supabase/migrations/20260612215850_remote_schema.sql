drop view if exists "public"."plantilla_asignatura";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.append_conversacion_asignatura(p_id uuid, p_append jsonb)
 RETURNS void
 LANGUAGE sql
AS $function$
  update conversaciones_asignatura
  set conversacion_json = coalesce(conversacion_json, '[]'::jsonb) || p_append
  where id = p_id;
$function$
;

CREATE OR REPLACE FUNCTION public.append_conversacion_plan(p_id uuid, p_append jsonb)
 RETURNS void
 LANGUAGE sql
AS $function$
  update conversaciones_plan
  set conversacion_json = coalesce(conversacion_json, '[]'::jsonb) || p_append
  where id = p_id;
$function$
;

CREATE OR REPLACE FUNCTION public.borrar_asignaturas_fallidas()
 RETURNS void
 LANGUAGE plpgsql
AS $function$
BEGIN
  DELETE FROM public.asignaturas
  WHERE creado_en < NOW() - INTERVAL '10 minutes'
    AND estado IN ('fallida', 'generando');
END;
$function$
;

CREATE OR REPLACE FUNCTION public.borrar_planes_fallidos()
 RETURNS void
 LANGUAGE plpgsql
AS $function$
BEGIN
  DELETE FROM public.planes_estudio
  WHERE creado_en < NOW() - INTERVAL '10 minutes'
    AND estado_actual_id IN (
      SELECT id FROM public.estados_plan WHERE clave IN ('FALLIDO', 'GENERANDO')
    );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.build_asignaturas_prefix_tsquery(p_search text)
 RETURNS tsquery
 LANGUAGE plpgsql
 STABLE
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.fn_ajustar_seriacion_por_cambio_ciclo()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.fn_asignaturas_update_search_vector()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.fn_log_cambios_planes_estudio()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$declare
  k text;
  old_val jsonb;
  new_val jsonb;

  v_response_id text;
begin
  v_response_id := nullif(new.meta_origen->>'response_id','');

  -- INSERT -> CREACION
  if tg_op = 'INSERT' then
    insert into public.cambios_plan (
      plan_estudio_id,
      cambiado_por,
      tipo,
      campo,
      valor_anterior,
      valor_nuevo,
      response_id
    )
    values (
      new.id,
      new.creado_por,
      'CREACION'::public.tipo_cambio,
      null,
      null,
      to_jsonb(new),
      null
    );

    return new;
  end if;

  -- DELETE (opcional): si no lo quieres, bórralo
  if tg_op = 'DELETE' then
    insert into public.cambios_plan (
      plan_estudio_id,
      cambiado_por,
      tipo,
      campo,
      valor_anterior,
      valor_nuevo,
      response_id
    )
    values (
      old.id,
      old.actualizado_por,
      'OTRO'::public.tipo_cambio,
      'DELETE',
      to_jsonb(old),
      null,
      null
    );

    return old;
  end if;

  -- UPDATE ----------------------------------------------------------
  -- 1) Transición de estado
  if (new.estado_actual_id is distinct from old.estado_actual_id) then
    insert into public.cambios_plan (
      plan_estudio_id, cambiado_por, tipo, campo, valor_anterior, valor_nuevo, response_id
    )
    values (
      new.id,
      new.actualizado_por,
      'TRANSICION_ESTADO'::public.tipo_cambio,
      'estado_actual_id',
      to_jsonb(old.estado_actual_id),
      to_jsonb(new.estado_actual_id),
      null
    );
  end if;

  -- 2) Cambios en JSONB "datos" (diff top-level por llave)
  if (new.datos is distinct from old.datos) then
    for k in
      select distinct key
      from (
        select jsonb_object_keys(coalesce(old.datos, '{}'::jsonb)) as key
        union all
        select jsonb_object_keys(coalesce(new.datos, '{}'::jsonb)) as key
      ) t
    loop
      old_val := coalesce(old.datos, '{}'::jsonb) -> k;
      new_val := coalesce(new.datos, '{}'::jsonb) -> k;

      if (old_val is distinct from new_val) then
        insert into public.cambios_plan (
          plan_estudio_id, cambiado_por, tipo, campo, valor_anterior, valor_nuevo, response_id
        )
        values (
          new.id,
          new.actualizado_por,
          'ACTUALIZACION_CAMPO'::public.tipo_cambio,
          k,
          old_val,
          new_val,
          v_response_id
        );
      end if;
    end loop;

  end if;

  -- 3) Cambios en columnas "normales" (uno por columna)
  if (new.nombre is distinct from old.nombre) then
    insert into public.cambios_plan values (gen_random_uuid(), new.id, new.actualizado_por, now(),
      'ACTUALIZACION'::public.tipo_cambio, 'nombre', to_jsonb(old.nombre), to_jsonb(new.nombre), null);
  end if;

  if (new.tipo_ciclo is distinct from old.tipo_ciclo) then
    insert into public.cambios_plan values (gen_random_uuid(), new.id, new.actualizado_por, now(),
      'ACTUALIZACION'::public.tipo_cambio, 'tipo_ciclo', to_jsonb(old.tipo_ciclo), to_jsonb(new.tipo_ciclo), null);
  end if;

  if (new.numero_ciclos is distinct from old.numero_ciclos) then
    insert into public.cambios_plan values (gen_random_uuid(), new.id, new.actualizado_por, now(),
      'ACTUALIZACION'::public.tipo_cambio, 'numero_ciclos', to_jsonb(old.numero_ciclos), to_jsonb(new.numero_ciclos), null);
  end if;

  if (new.activo is distinct from old.activo) then
    insert into public.cambios_plan values (gen_random_uuid(), new.id, new.actualizado_por, now(),
      'ACTUALIZACION'::public.tipo_cambio, 'activo', to_jsonb(old.activo), to_jsonb(new.activo), null);
  end if;

  if (new.carrera_id is distinct from old.carrera_id) then
    insert into public.cambios_plan values (gen_random_uuid(), new.id, new.actualizado_por, now(),
      'ACTUALIZACION'::public.tipo_cambio, 'carrera_id', to_jsonb(old.carrera_id), to_jsonb(new.carrera_id), null);
  end if;

  if (new.estructura_id is distinct from old.estructura_id) then
    insert into public.cambios_plan values (gen_random_uuid(), new.id, new.actualizado_por, now(),
      'ACTUALIZACION'::public.tipo_cambio, 'estructura_id', to_jsonb(old.estructura_id), to_jsonb(new.estructura_id), null);
  end if;

  if (new.tipo_origen is distinct from old.tipo_origen) then
    insert into public.cambios_plan values (gen_random_uuid(), new.id, new.actualizado_por, now(),
      'ACTUALIZACION'::public.tipo_cambio, 'tipo_origen', to_jsonb(old.tipo_origen), to_jsonb(new.tipo_origen), null);
  end if;



  -- 🔥 consumirlo para que NO se guarde en planes_estudio
  if v_response_id is not null then
    new.meta_origen := new.meta_origen - 'response_id';
  end if;

  return new;
end;$function$
;

CREATE OR REPLACE FUNCTION public.fn_track_cambios_asignatura()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$declare
  k text;
  old_val jsonb;
  new_val jsonb;
  v_interaccion_id uuid;
  v_usuario uuid;
begin
  -- 1. Extraer ID de interacción de IA de meta_origen si existe
  v_interaccion_id := nullif(new.meta_origen->>'interaccion_ia_id', '')::uuid;
  
  -- Definir quién hace el cambio
  v_usuario := case when tg_op = 'INSERT' then new.creado_por else new.actualizado_por end;

  -- ----------------------------------------------------------
  -- INSERT -> Registro de creación completo
  -- ----------------------------------------------------------
  if tg_op = 'INSERT' then
    insert into public.cambios_asignatura (
      asignatura_id, cambiado_por, tipo, valor_nuevo, interaccion_ia_id
    )
    values (
      new.id, v_usuario, 'CREACION'::public.tipo_cambio, to_jsonb(new), v_interaccion_id
    );
    return new;
  end if;

  -- ----------------------------------------------------------
  -- DELETE -> Registro de eliminación
  -- ----------------------------------------------------------
  if tg_op = 'DELETE' then
    insert into public.cambios_asignatura (
      asignatura_id, cambiado_por, tipo, campo, valor_anterior
    )
    values (
      old.id, old.actualizado_por, 'OTRO'::public.tipo_cambio, 'DELETE', to_jsonb(old)
    );
    return old;
  end if;

  -- ----------------------------------------------------------
  -- UPDATE -> Registro de cambios específicos
  -- ----------------------------------------------------------
  
  -- A) Columnas normales de texto y números
  if (new.nombre is distinct from old.nombre) then
    insert into public.cambios_asignatura (asignatura_id, cambiado_por, tipo, campo, valor_anterior, valor_nuevo, interaccion_ia_id)
    values (new.id, v_usuario, 'ACTUALIZACION', 'nombre', to_jsonb(old.nombre), to_jsonb(new.nombre), v_interaccion_id);
  end if;

  if (new.codigo is distinct from old.codigo) then
    insert into public.cambios_asignatura (asignatura_id, cambiado_por, tipo, campo, valor_anterior, valor_nuevo, interaccion_ia_id)
    values (new.id, v_usuario, 'ACTUALIZACION', 'codigo', to_jsonb(old.codigo), to_jsonb(new.codigo), v_interaccion_id);
  end if;

  if (new.numero_ciclo is distinct from old.numero_ciclo) then
    insert into public.cambios_asignatura (asignatura_id, cambiado_por, tipo, campo, valor_anterior, valor_nuevo, interaccion_ia_id)
    values (new.id, v_usuario, 'ACTUALIZACION', 'numero_ciclo', to_jsonb(old.numero_ciclo), to_jsonb(new.numero_ciclo), v_interaccion_id);
  end if;

  if (new.creditos is distinct from old.creditos) then
    insert into public.cambios_asignatura (asignatura_id, cambiado_por, tipo, campo, valor_anterior, valor_nuevo, interaccion_ia_id)
    values (new.id, v_usuario, 'ACTUALIZACION', 'creditos', to_jsonb(old.creditos), to_jsonb(new.creditos), v_interaccion_id);
  end if;

  if (new.prerrequisito_asignatura_id is distinct from old.prerrequisito_asignatura_id) then
    insert into public.cambios_asignatura (asignatura_id, cambiado_por, tipo, campo, valor_anterior, valor_nuevo, interaccion_ia_id)
    values (new.id, v_usuario, 'ACTUALIZACION', 'prerrequisito_asignatura_id', to_jsonb(old.prerrequisito_asignatura_id), to_jsonb(new.prerrequisito_asignatura_id), v_interaccion_id);
  end if;

  -- B) Cambios en JSONB "datos" (recorriendo llaves)
  if (new.datos is distinct from old.datos) then
    for k in
      select distinct key from (
        select jsonb_object_keys(coalesce(old.datos, '{}'::jsonb)) as key
        union all
        select jsonb_object_keys(coalesce(new.datos, '{}'::jsonb)) as key
      ) t
    loop
      old_val := coalesce(old.datos, '{}'::jsonb) -> k;
      new_val := coalesce(new.datos, '{}'::jsonb) -> k;

      if (old_val is distinct from new_val) then
        insert into public.cambios_asignatura (asignatura_id, cambiado_por, tipo, campo, valor_anterior, valor_nuevo, interaccion_ia_id)
        values (new.id, v_usuario, 'ACTUALIZACION_CAMPO', k, old_val, new_val, v_interaccion_id);
      end if;
    end loop;
  end if;

  -- C) Criterios de Evaluación (JSONB completo)
  if (new.criterios_de_evaluacion is distinct from old.criterios_de_evaluacion) then
    insert into public.cambios_asignatura (asignatura_id, cambiado_por, tipo, campo, valor_anterior, valor_nuevo, interaccion_ia_id)
    values (new.id, v_usuario, 'ACTUALIZACION', 'criterios_de_evaluacion', old.criterios_de_evaluacion, new.criterios_de_evaluacion, v_interaccion_id);
  end if;

-- D) Contenido Temático (JSONB completo)
  if (new.contenido_tematico is distinct from old.contenido_tematico) then
    insert into public.cambios_asignatura (
      asignatura_id, 
      cambiado_por, 
      tipo, 
      campo, 
      valor_anterior, 
      valor_nuevo, 
      interaccion_ia_id
    )
    values (
      new.id, 
      v_usuario, 
      'ACTUALIZACION', 
      'contenido_tematico', 
      old.contenido_tematico, 
      new.contenido_tematico, 
      v_interaccion_id
    );
  end if;


  --  Limpiar meta_origen para que interaccion_ia_id no se guarde permanentemente en la tabla base
  if v_interaccion_id is not null then
    new.meta_origen := new.meta_origen - 'interaccion_ia_id';
  end if;

  return new;
end;$function$
;

create or replace view "public"."plantilla_asignatura" as  SELECT asignaturas.id AS asignatura_id,
    struct.id AS estructura_id,
    struct.template_id
   FROM (public.asignaturas
     JOIN public.estructuras_asignatura struct ON ((asignaturas.estructura_id = struct.id)));


CREATE OR REPLACE FUNCTION public.recalcular_vectores_asignaturas()
 RETURNS void
 LANGUAGE sql
AS $function$
  UPDATE public.asignaturas
  SET search_vector =
      setweight(to_tsvector('public.es_simple_unaccent', coalesce(nombre, '')), 'A') ||
      setweight(to_tsvector('public.es_simple_unaccent', coalesce(codigo, '')), 'A') ||
      setweight(to_tsvector('public.es_simple_unaccent', coalesce(datos, '{}'::jsonb)::text), 'B') ||
      setweight(to_tsvector('public.es_simple_unaccent', coalesce(contenido_tematico, '[]'::jsonb)::text), 'B')
  WHERE id IS NOT NULL;
$function$
;

CREATE OR REPLACE FUNCTION public.search_asignaturas(p_search text DEFAULT ''::text, p_facultad_id uuid DEFAULT NULL::uuid, p_carrera_id uuid DEFAULT NULL::uuid, p_plan_estudio_id uuid DEFAULT NULL::uuid, p_limit integer DEFAULT 20, p_offset integer DEFAULT 0)
 RETURNS TABLE(id uuid, plan_estudio_id uuid, codigo text, nombre text, tipo public.tipo_asignatura, creditos numeric, numero_ciclo integer, datos jsonb, contenido_tematico jsonb, estado public.estado_asignatura, rank real, total_count bigint)
 LANGUAGE plpgsql
 STABLE
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.suma_porcentajes(jsonb)
 RETURNS numeric
 LANGUAGE plpgsql
 IMMUTABLE
AS $function$
declare
    total numeric;
begin
    select coalesce(sum((elem->>'porcentaje')::numeric),0)
    into total
    from jsonb_array_elements($1) elem;

    return total;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.validar_prerrequisito_asignatura()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
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
$function$
;

drop trigger if exists "protect_buckets_delete" on "storage"."buckets";

drop trigger if exists "protect_objects_delete" on "storage"."objects";


  create policy "todos los permisos dx3g7q_0"
  on "storage"."objects"
  as permissive
  for insert
  to public
with check ((bucket_id = 'ai-storage'::text));



  create policy "todos los permisos dx3g7q_1"
  on "storage"."objects"
  as permissive
  for select
  to public
using ((bucket_id = 'ai-storage'::text));



  create policy "todos los permisos dx3g7q_2"
  on "storage"."objects"
  as permissive
  for delete
  to public
using ((bucket_id = 'ai-storage'::text));



  create policy "todos los permisos dx3g7q_3"
  on "storage"."objects"
  as permissive
  for update
  to public
using ((bucket_id = 'ai-storage'::text));



