-- Flujo de aprobación separado para planes no curriculares.
-- Los planes curriculares conservan el pipeline completo (DACE, sedes,
-- consejos, ACERT, SEP). Los planes no curriculares solo requieren dos
-- vistos buenos: Planeación Curricular y Vicerrectoría Académica.

-- 1. Tipo de estructura al que aplica cada transición.
--    NULL significa que aplica a ambos tipos.
alter table public.transiciones_estado_plan
add column if not exists tipo_estructura public.tipo_estructura_plan;

-- 2. Las transiciones existentes corresponden al flujo curricular.
update public.transiciones_estado_plan
set tipo_estructura = 'CURRICULAR'
where tipo_estructura is null;

-- 3. Ampliar la unicidad para distinguir transiciones por tipo de plan.
alter table public.transiciones_estado_plan
drop constraint if exists transiciones_unica;

alter table public.transiciones_estado_plan
drop constraint if exists transiciones_unica_typed;

alter table public.transiciones_estado_plan
add constraint transiciones_unica_typed
unique (desde_estado_id, hacia_estado_id, rol_permitido_id, tipo_estructura);

-- 4. Recrear funciones de autorización filtrando por tipo de estructura.
create or replace function private.transiciones_permitidas_plan(p_plan_id uuid)
returns setof public.estados_plan
language sql
stable
security definer
set search_path to public, private, auth, extensions, pg_temp
as $$
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

create or replace function private.usuario_puede_transicionar_plan(
  p_usuario_id uuid,
  p_plan_id uuid,
  p_hacia_estado_id uuid
)
returns boolean
language sql
stable
security definer
set search_path to public, private, auth, extensions, pg_temp
as $$
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

-- 5. Nuevo estado intermedio para el visto bueno de Vicerrectoría.
insert into public.estados_plan (id, clave, etiqueta, orden, es_final, color, es_campo_editable)
values (
  '71684c51-869d-45ba-90f9-8793efb0c08d',
  'REV_VICERRECTORIA',
  'En revisión de Vicerrectoría Académica',
  35,
  false,
  '#8b5cf6',
  true
)
on conflict do nothing;

-- 6. Transiciones exclusivas del flujo no curricular.
insert into public.transiciones_estado_plan (
  id,
  desde_estado_id,
  hacia_estado_id,
  rol_permitido_id,
  tipo_estructura
)
select
  t.id::uuid,
  d.id as desde_estado_id,
  h.id as hacia_estado_id,
  r.id as rol_permitido_id,
  'NO_CURRICULAR'::public.tipo_estructura_plan as tipo_estructura
from (
  values
    ('a563b850-d43c-4d11-907f-2795d6e41802', 'BORRADOR', 'REV_PLANEACION', 'JEFE_CARRERA'),
    ('4840b6d9-591d-4e50-9a05-a2b6b6250d50', 'REV_PLANEACION', 'REV_VICERRECTORIA', 'PLANEACION_CURRICULAR'),
    ('14113ee2-a65a-4ffb-bcd5-5838548ae88a', 'REV_PLANEACION', 'BORRADOR', 'PLANEACION_CURRICULAR'),
    ('6058c38d-1771-4e0a-80c9-8fbacbf012f5', 'REV_PLANEACION', 'RECHAZADO', 'PLANEACION_CURRICULAR'),
    ('225260a3-bd47-4326-a0c0-0fda1dea73e0', 'REV_VICERRECTORIA', 'APROBADO', 'VICERRECTOR_ACADEMICO'),
    ('de3f621e-cf4e-4f7f-84fd-fcd19d41e78c', 'REV_VICERRECTORIA', 'BORRADOR', 'VICERRECTOR_ACADEMICO'),
    ('2bb15b57-84f6-45b2-afa9-46c727fb113c', 'REV_VICERRECTORIA', 'RECHAZADO', 'VICERRECTOR_ACADEMICO')
) as t (id, desde_clave, hacia_clave, rol_clave)
join public.estados_plan d on d.clave = t.desde_clave
join public.estados_plan h on h.clave = t.hacia_clave
join public.roles r on r.clave = t.rol_clave
on conflict (desde_estado_id, hacia_estado_id, rol_permitido_id, tipo_estructura) do nothing;

-- 7. El registro oficial SEP solo se exige para planes curriculares.
create or replace function public.fn_planes_exige_registro_oficial_aprobado()
returns trigger
language plpgsql
security definer
set search_path to public, private, auth, extensions, pg_temp
as $$
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
