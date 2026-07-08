-- Simplifica el modelo de contenido generado:
-- 1. Elimina la tabla y enums de learning_packages (ya no hay exportaciones encoladas).
-- 2. Elimina el estado de learning_objects: todo contenido generado es directamente usable.
-- 3. Permite crear múltiples recursos del mismo tipo por tema (placeholder siempre crea nuevo).
-- 4. El score de preparacion ya no filtra por estado.

-- ---------------------------------------------------------------------------
-- 1. Eliminar learning_packages
-- ---------------------------------------------------------------------------

-- Eliminar tabla, indices, triggers y politicas de learning_packages.
drop table if exists public.learning_packages cascade;

-- Eliminar enums de paquetes.
drop type if exists public.learning_package_estado;
drop type if exists public.learning_package_tipo;

-- ---------------------------------------------------------------------------
-- 2. Actualizar funciones que dependen del estado de learning_objects
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
    )
    select coalesce(
        (count(p.*)::float / nullif(count(e.*), 0) * 100)::int,
        0
    )
    from expected e
    left join presentes p on p.tipo = e.tipo;
$$;

-- El placeholder ya no salta tipos existentes ni escribe un estado borrador;
-- ahora simplemente crea un nuevo recurso por cada tipo solicitado.
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
$function$;

-- ---------------------------------------------------------------------------
-- 3. Eliminar estado de learning_objects
-- ---------------------------------------------------------------------------

alter table public.learning_objects drop column if exists estado;

-- Eliminar enum de estado de learning_objects.
drop type if exists public.learning_object_estado;
