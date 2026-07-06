-- Refuerzo del esquema existente de objetos de aprendizaje:
--  - IDs persistentes para unidades y temas dentro de contenido_tematico.
--  - Funciones para scores de preparacion y placeholders de recursos.
--  - Permisos y politicas RLS acordes con la edicion de contenido.
--
-- Este archivo asume que la migracion 20260706164013_learning_objects_generation.sql
-- ya creo las tablas learning_objects, learning_generation_jobs y learning_quality_scores.
-- Scope del milestone SCORM: sin prompts complejos ni exportacion SCORM.

-- ---------------------------------------------------------------------------
-- 1. Indice unico para scores por alcance (asignatura/unidad/tema)
-- ---------------------------------------------------------------------------
create unique index if not exists learning_quality_scores_scope_uidx
  on public.learning_quality_scores (asignatura_id, coalesce(unidad_id, ''), coalesce(tema_id, ''));

-- ---------------------------------------------------------------------------
-- 2. Asegurar IDs persistentes en contenido_tematico (JSONB)
-- ---------------------------------------------------------------------------
create or replace function public.fn_ensure_contenido_tematico_ids(j jsonb)
returns jsonb
language plpgsql
security definer
set search_path to public, auth, extensions, pg_temp
as $function$
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
$function$;

create or replace function public.fn_asignaturas_contenido_tematico_ensure_ids()
returns trigger
language plpgsql
security definer
set search_path to public, auth, extensions, pg_temp
as $function$
begin
    new.contenido_tematico := public.fn_ensure_contenido_tematico_ids(new.contenido_tematico);
    return new;
end;
$function$;

drop trigger if exists trg_asignaturas_contenido_tematico_ensure_ids on public.asignaturas;
create trigger trg_asignaturas_contenido_tematico_ensure_ids
    before insert or update on public.asignaturas
    for each row execute function public.fn_asignaturas_contenido_tematico_ensure_ids();

-- El backfill evade validaciones de etapa del plan; solo normaliza ids en JSONB.
set session_replication_role = 'replica';
update public.asignaturas
set contenido_tematico = public.fn_ensure_contenido_tematico_ids(contenido_tematico)
where contenido_tematico is not null;
set session_replication_role = 'origin';

-- ---------------------------------------------------------------------------
-- 3. Score de preparacion del contenido
-- ---------------------------------------------------------------------------
create or replace function public.fn_calcular_score_preparacion(
    p_asignatura_id uuid,
    p_unidad_id text default null,
    p_tema_id text default null
)
returns integer
language sql
stable
set search_path to public, auth, extensions, pg_temp
as $$
    with expected as (
        select unnest(array['apunte','outline_presentacion','quiz','actividad','ejercicios','recursos_externos','rubrica']) as tipo
    ),
    presentes as (
        select distinct lo.tipo::text as tipo
        from public.learning_objects lo
        where lo.asignatura_id = p_asignatura_id
          and (p_unidad_id is null or lo.unidad_id = p_unidad_id)
          and (p_tema_id is null or lo.tema_id = p_tema_id)
          and lo.estado in ('generated', 'reviewed', 'published')
    )
    select coalesce(
        (count(p.*)::float / nullif(count(e.*), 0) * 100)::int,
        0
    )
    from expected e
    left join presentes p on p.tipo = e.tipo;
$$;

create or replace function public.recalcular_learning_quality_scores(p_asignatura_id uuid)
returns void
language plpgsql
security definer
set search_path to public, auth, extensions, pg_temp
as $function$
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
$function$;

-- ---------------------------------------------------------------------------
-- 4. Creacion de recursos placeholder (MVP sin prompts complejos)
-- ---------------------------------------------------------------------------
create or replace function public.crear_recursos_placeholder(
    p_asignatura_id uuid,
    p_unidad_id text,
    p_tema_id text,
    p_tipos text[]
)
returns setof uuid
language plpgsql
security definer
set search_path to public, auth, extensions, pg_temp
as $function$
declare
    v_tipo text;
    v_id uuid;
    v_existentes text[];
begin
    select coalesce(array_agg(lo.tipo::text), array[]::text[])
    into v_existentes
    from public.learning_objects lo
    where lo.asignatura_id = p_asignatura_id
      and coalesce(lo.unidad_id, '') = coalesce(p_unidad_id, '')
      and coalesce(lo.tema_id, '') = coalesce(p_tema_id, '');

    foreach v_tipo in array p_tipos loop
        if v_tipo = any (v_existentes) then
            continue;
        end if;

        insert into public.learning_objects (
            asignatura_id, unidad_id, tema_id, tipo, titulo, estado, score, creado_por
        )
        values (
            p_asignatura_id,
            p_unidad_id,
            p_tema_id,
            v_tipo::public.learning_object_tipo,
            initcap(replace(v_tipo, '_', ' ')),
            'draft'::public.learning_object_estado,
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
$function$;

-- ---------------------------------------------------------------------------
-- 5. Ajustar RLS para vincularse a la edicion de contenido de asignaturas
-- ---------------------------------------------------------------------------
drop policy if exists learning_objects_select_by_scope on public.learning_objects;
create policy learning_objects_select_by_scope on public.learning_objects
    for select to authenticated
    using (
        public.authz_has_permission('asignaturas.ver')
        and public.authz_can_access_asignatura(asignatura_id)
    );

drop policy if exists learning_objects_insert_by_scope on public.learning_objects;
create policy learning_objects_insert_by_scope on public.learning_objects
    for insert to authenticated
    with check (
        public.authz_asignatura_content_write_allowed(asignatura_id)
    );

drop policy if exists learning_objects_update_by_scope on public.learning_objects;
create policy learning_objects_update_by_scope on public.learning_objects
    for update to authenticated
    using (public.authz_asignatura_content_write_allowed(asignatura_id))
    with check (public.authz_asignatura_content_write_allowed(asignatura_id));

drop policy if exists learning_objects_delete_by_scope on public.learning_objects;
create policy learning_objects_delete_by_scope on public.learning_objects
    for delete to authenticated
    using (public.authz_asignatura_content_write_allowed(asignatura_id));

drop policy if exists learning_generation_jobs_select_by_scope on public.learning_generation_jobs;
create policy learning_generation_jobs_select_by_scope on public.learning_generation_jobs
    for select to authenticated
    using (
        public.authz_has_permission('asignaturas.ver')
        and public.authz_can_access_asignatura(asignatura_id)
    );

drop policy if exists learning_generation_jobs_insert_by_scope on public.learning_generation_jobs;
create policy learning_generation_jobs_insert_by_scope on public.learning_generation_jobs
    for insert to authenticated
    with check (
        public.authz_asignatura_content_write_allowed(asignatura_id)
    );

drop policy if exists learning_generation_jobs_update_by_scope on public.learning_generation_jobs;
create policy learning_generation_jobs_update_by_scope on public.learning_generation_jobs
    for update to authenticated
    using (public.authz_asignatura_content_write_allowed(asignatura_id))
    with check (public.authz_asignatura_content_write_allowed(asignatura_id));

drop policy if exists learning_generation_jobs_delete_by_scope on public.learning_generation_jobs;
create policy learning_generation_jobs_delete_by_scope on public.learning_generation_jobs
    for delete to authenticated
    using (public.authz_asignatura_content_write_allowed(asignatura_id));

drop policy if exists learning_quality_scores_select_by_scope on public.learning_quality_scores;
create policy learning_quality_scores_select_by_scope on public.learning_quality_scores
    for select to authenticated
    using (
        public.authz_has_permission('asignaturas.ver')
        and public.authz_can_access_asignatura(asignatura_id)
    );

drop policy if exists learning_quality_scores_insert_by_scope on public.learning_quality_scores;
create policy learning_quality_scores_insert_by_scope on public.learning_quality_scores
    for insert to authenticated
    with check (public.authz_asignatura_content_write_allowed(asignatura_id));

drop policy if exists learning_quality_scores_update_by_scope on public.learning_quality_scores;
create policy learning_quality_scores_update_by_scope on public.learning_quality_scores
    for update to authenticated
    using (public.authz_asignatura_content_write_allowed(asignatura_id))
    with check (public.authz_asignatura_content_write_allowed(asignatura_id));

drop policy if exists learning_quality_scores_delete_by_scope on public.learning_quality_scores;
create policy learning_quality_scores_delete_by_scope on public.learning_quality_scores
    for delete to authenticated
    using (public.authz_asignatura_content_write_allowed(asignatura_id));

-- ---------------------------------------------------------------------------
-- 6. Permisos seed
-- ---------------------------------------------------------------------------
insert into public.permisos (id, clave, nombre, descripcion, grupo, orden, creado_en)
select gen_random_uuid(), 'asignaturas.recursos.generar', 'Generar recursos de aprendizaje',
       'Generar objetos de aprendizaje asociados a unidades y temas', 'asignaturas', 25, now()
where not exists (select 1 from public.permisos where clave = 'asignaturas.recursos.generar');

insert into public.permisos (id, clave, nombre, descripcion, grupo, orden, creado_en)
select gen_random_uuid(), 'asignaturas.recursos.gestionar', 'Gestionar recursos de aprendizaje',
       'Editar, revisar, publicar y archivar recursos generados', 'asignaturas', 26, now()
where not exists (select 1 from public.permisos where clave = 'asignaturas.recursos.gestionar');

insert into public.roles_permisos (rol_id, permiso_id)
select r.id, p.id
from public.roles r
cross join public.permisos p
where p.clave in ('asignaturas.recursos.generar', 'asignaturas.recursos.gestionar')
  and r.clave in (
      'ADMIN', 'VICERRECTOR_ACADEMICO', 'DIRECTOR_FACULTAD', 'SECRETARIO_ACADEMICO',
      'JEFE_CARRERA', 'JEFE_POSGRADO', 'PROFESOR', 'PLANEACION_CURRICULAR', 'COORD_DHP'
  )
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- 7. Grants
-- ---------------------------------------------------------------------------
revoke all on function public.fn_ensure_contenido_tematico_ids(jsonb) from public, anon;
grant execute on function public.fn_ensure_contenido_tematico_ids(jsonb) to authenticated, service_role;

revoke all on function public.fn_asignaturas_contenido_tematico_ensure_ids() from public, anon;
grant execute on function public.fn_asignaturas_contenido_tematico_ensure_ids() to authenticated, service_role;

revoke all on function public.fn_calcular_score_preparacion(uuid, text, text) from public, anon;
grant execute on function public.fn_calcular_score_preparacion(uuid, text, text) to authenticated, service_role;

revoke all on function public.recalcular_learning_quality_scores(uuid) from public, anon;
grant execute on function public.recalcular_learning_quality_scores(uuid) to authenticated, service_role;

revoke all on function public.crear_recursos_placeholder(uuid, text, text, text[]) from public, anon;
grant execute on function public.crear_recursos_placeholder(uuid, text, text, text[]) to authenticated, service_role;
