-- Mesa de trabajo curricular, versionado normativo y recorrido guiado.
-- La migración es aditiva: ningún plan existente cambia de estructura.

create type public.estado_publicacion_estructura as enum (
  'BORRADOR',
  'PUBLICADA',
  'RETIRADA'
);

create type public.fase_diseno_curricular as enum (
  'FUNDAMENTOS',
  'BLOQUES',
  'MAPA'
);

alter table public.estructuras_plan
  add column autoridad_normativa text,
  add column etiqueta_version text,
  add column aplicable_desde date,
  add column aplicable_hasta date,
  add column estado_publicacion public.estado_publicacion_estructura
    not null default 'BORRADOR',
  add column referencia_normativa text;

alter table public.estructuras_plan
  add constraint estructuras_plan_aplicabilidad_chk
  check (aplicable_hasta is null or aplicable_desde is null or aplicable_hasta >= aplicable_desde);

create unique index estructuras_plan_version_publicada_uidx
  on public.estructuras_plan (tipo, autoridad_normativa, etiqueta_version)
  where estado_publicacion = 'PUBLICADA' and etiqueta_version is not null;

-- La estructura semilla actual queda utilizable sin atribuirle una norma
-- histórica que el repositorio no puede demostrar.
update public.estructuras_plan
set autoridad_normativa = coalesce(autoridad_normativa, 'SEP / Universidad La Salle'),
    etiqueta_version = coalesce(etiqueta_version, nombre),
    estado_publicacion = 'PUBLICADA'
where estado_publicacion = 'BORRADOR';

alter table public.planes_estudio
  add column estructura_recomendada_id uuid references public.estructuras_plan(id),
  add column seleccion_estructura text not null default 'LEGACY'
    check (seleccion_estructura in ('AUTOMATICA', 'MANUAL', 'LEGACY')),
  add column motivo_estructura_manual text,
  add column fase_diseno public.fase_diseno_curricular
    not null default 'FUNDAMENTOS';

alter table public.planes_estudio
  add constraint planes_estructura_manual_motivo_chk
  check (
    seleccion_estructura <> 'MANUAL'
    or nullif(btrim(motivo_estructura_manual), '') is not null
  );

alter table public.lineas_plan
  add column proposito text,
  add column aporte_perfil_egreso text,
  add column alcance_formativo text;

-- Backfill de fase sin modificar el contenido ni la estructura elegida.
update public.planes_estudio p
set fase_diseno = case
  when exists (
    select 1 from public.asignaturas a
    where a.plan_estudio_id = p.id
      and (a.linea_plan_id is not null or a.numero_ciclo is not null)
  ) then 'MAPA'::public.fase_diseno_curricular
  when exists (
    select 1 from public.lineas_plan l where l.plan_estudio_id = p.id
  ) then 'BLOQUES'::public.fase_diseno_curricular
  else 'FUNDAMENTOS'::public.fase_diseno_curricular
end;

-- Mapeo semántico de los tres fundamentos canónicos. Las etiquetas y su
-- posición siguen perteneciendo a cada plantilla.
update public.estructuras_plan
set definicion = jsonb_set(
  jsonb_set(
    jsonb_set(
      definicion,
      '{properties,perfil_de_ingreso,x-acad-ia.semantic-key}',
      '"perfil_ingreso"'::jsonb,
      true
    ),
    '{properties,perfil_de_egreso,x-acad-ia.semantic-key}',
    '"perfil_egreso"'::jsonb,
    true
  ),
  '{properties,fines_de_aprendizaje_o_formacion,x-acad-ia.semantic-key}',
  '"fines_aprendizaje"'::jsonb,
  true
)
where tipo = 'CURRICULAR'
  and definicion ? 'properties';

create or replace function public.estructura_curricular_tiene_fundamentos(
  p_definicion jsonb
) returns boolean
language sql
immutable
set search_path = ''
as $$
  select (
    select count(distinct prop.value ->> 'x-acad-ia.semantic-key') = 3
    from jsonb_each(coalesce(p_definicion -> 'properties', '{}'::jsonb)) prop
    where prop.value ->> 'x-acad-ia.semantic-key' in (
      'perfil_ingreso',
      'perfil_egreso',
      'fines_aprendizaje'
    )
  );
$$;

create or replace function public.validar_publicacion_estructura_curricular()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.tipo = 'CURRICULAR'
    and new.estado_publicacion = 'PUBLICADA'
    and not public.estructura_curricular_tiene_fundamentos(new.definicion)
  then
    raise exception using
      errcode = '23514',
      message = 'Una estructura curricular publicada debe mapear perfil de ingreso, perfil de egreso y fines de aprendizaje.';
  end if;
  return new;
end;
$$;

create trigger estructuras_plan_validar_publicacion_curricular
before insert or update of estado_publicacion, definicion
on public.estructuras_plan
for each row execute function public.validar_publicacion_estructura_curricular();

create or replace function public.recomendar_estructura_plan(
  p_tipo public.tipo_estructura_plan,
  p_fecha_inicio date
) returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select ep.id
  from public.estructuras_plan ep
  where ep.tipo = p_tipo
    and ep.estado_publicacion = 'PUBLICADA'
    and (
      p_tipo <> 'CURRICULAR'
      or p_fecha_inicio is null
      or (
        (ep.aplicable_desde is null or ep.aplicable_desde <= p_fecha_inicio)
        and (ep.aplicable_hasta is null or ep.aplicable_hasta >= p_fecha_inicio)
      )
    )
  order by
    case when ep.aplicable_desde is null then 1 else 0 end,
    ep.aplicable_desde desc nulls last,
    ep.creado_en desc
  limit 1;
$$;

revoke all on function public.recomendar_estructura_plan(public.tipo_estructura_plan, date) from public;
grant execute on function public.recomendar_estructura_plan(public.tipo_estructura_plan, date) to authenticated;

create table public.avisos_institucionales (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  cuerpo text not null,
  accion_etiqueta text,
  accion_ruta text,
  roles_claves text[] not null default '{}',
  facultad_id uuid references public.facultades(id) on delete cascade,
  carrera_id uuid references public.carreras(id) on delete cascade,
  visible_desde timestamptz not null default now(),
  visible_hasta timestamptz,
  activo boolean not null default true,
  creado_por uuid references public.usuarios_app(id),
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  constraint avisos_vigencia_chk
    check (visible_hasta is null or visible_hasta >= visible_desde)
);

create table public.guias_usuario (
  usuario_id uuid not null references public.usuarios_app(id) on delete cascade,
  guia_clave text not null,
  guia_version integer not null check (guia_version > 0),
  paso_actual integer not null default 0 check (paso_actual >= 0),
  completada boolean not null default false,
  descartada boolean not null default false,
  actualizado_en timestamptz not null default now(),
  primary key (usuario_id, guia_clave, guia_version)
);

create table public.borradores_diseno_plan (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references public.usuarios_app(id) on delete cascade,
  estado text not null default 'CAPTURA'
    check (estado in ('CAPTURA', 'ANALIZANDO', 'ACLARANDO', 'LISTO', 'CONSUMIDO', 'FALLIDO')),
  ronda smallint not null default 0 check (ronda between 0 and 2),
  datos_basicos jsonb not null default '{}'::jsonb,
  solicitud jsonb not null default '{}'::jsonb,
  analisis jsonb not null default '{}'::jsonb,
  preguntas jsonb not null default '[]'::jsonb,
  respuestas jsonb not null default '{}'::jsonb,
  referencias jsonb not null default '[]'::jsonb,
  error jsonb,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  expira_en timestamptz not null default (now() + interval '30 days')
);

alter table public.avisos_institucionales enable row level security;
alter table public.guias_usuario enable row level security;
alter table public.borradores_diseno_plan enable row level security;

create policy avisos_select_visibles on public.avisos_institucionales
for select to authenticated
using (
  activo
  and visible_desde <= now()
  and (visible_hasta is null or visible_hasta >= now())
  and (
    cardinality(roles_claves) = 0
    or exists (
      select 1
      from public.roles r
      where r.clave = any(roles_claves)
        and private.authz_claim_has_role(r.clave)
    )
  )
);

create policy avisos_manage_catalogos on public.avisos_institucionales
for all to authenticated
using (public.authz_has_permission('catalogos.gestionar'))
with check (public.authz_has_permission('catalogos.gestionar'));

create policy guias_usuario_propias on public.guias_usuario
for all to authenticated
using (usuario_id = auth.uid())
with check (usuario_id = auth.uid());

create policy borradores_diseno_propios on public.borradores_diseno_plan
for all to authenticated
using (usuario_id = auth.uid())
with check (usuario_id = auth.uid());

create or replace function public.obtener_progreso_guia(
  p_guia_clave text,
  p_guia_version integer
) returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select jsonb_build_object(
        'ultimoPaso', g.paso_actual,
        'completada', g.completada,
        'descartada', g.descartada
      )
      from public.guias_usuario g
      where g.usuario_id = auth.uid()
        and g.guia_clave = p_guia_clave
        and g.guia_version = p_guia_version
    ),
    jsonb_build_object(
      'ultimoPaso', 0,
      'completada', false,
      'descartada', false
    )
  );
$$;

create or replace function public.guardar_progreso_guia(
  p_guia_clave text,
  p_guia_version integer,
  p_ultimo_paso integer,
  p_completada boolean,
  p_descartada boolean
) returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'Autenticación requerida';
  end if;

  insert into public.guias_usuario (
    usuario_id,
    guia_clave,
    guia_version,
    paso_actual,
    completada,
    descartada,
    actualizado_en
  ) values (
    auth.uid(),
    p_guia_clave,
    p_guia_version,
    greatest(p_ultimo_paso, 0),
    p_completada,
    p_descartada,
    now()
  )
  on conflict (usuario_id, guia_clave, guia_version)
  do update set
    paso_actual = excluded.paso_actual,
    completada = excluded.completada,
    descartada = excluded.descartada,
    actualizado_en = now();
end;
$$;

create index avisos_visibilidad_idx
  on public.avisos_institucionales (activo, visible_desde, visible_hasta);
create index borradores_diseno_usuario_idx
  on public.borradores_diseno_plan (usuario_id, actualizado_en desc);

-- Una sola lectura autorizada para la portada. p_rol_clave solo elige la
-- perspectiva visual; authz_can_access_plan sigue siendo la frontera real.
create or replace function public.inicio_mesa_trabajo(
  p_rol_clave text default null,
  p_facultad_id uuid default null,
  p_carrera_id uuid default null
) returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_usuario uuid := auth.uid();
  v_result jsonb;
begin
  if v_usuario is null then
    raise exception using errcode = '42501', message = 'Autenticación requerida';
  end if;
  if p_rol_clave is not null and not public.authz_has_role(p_rol_clave) then
    raise exception using errcode = '42501', message = 'El rol solicitado no pertenece al usuario';
  end if;

  with planes_visibles as (
    select
      p.id,
      p.nombre_display,
      p.actualizado_en,
      p.fase_diseno,
      p.fecha_inicio_imparticion,
      p.carrera_id,
      c.nombre as carrera_nombre,
      c.nivel,
      c.facultad_id,
      f.nombre as facultad_nombre,
      ep.clave as estado_clave,
      ep.etiqueta as estado_etiqueta,
      (
        select count(*)::integer
        from public.comentarios_plan cp
        where cp.plan_estudio_id = p.id and not cp.resuelto
      ) as comentarios_pendientes,
      rop.vigencia_fin
    from public.planes_estudio p
    join public.carreras c on c.id = p.carrera_id
    join public.facultades f on f.id = c.facultad_id
    left join public.estados_plan ep on ep.id = p.estado_actual_id
    left join lateral (
      select r.vigencia_fin
      from public.registros_oficiales_plan r
      where r.plan_estudio_id = p.id
      order by r.vigencia_inicio desc
      limit 1
    ) rop on true
    where p.activo
      and coalesce(ep.clave, '') <> 'FALLIDO'
      and public.authz_can_access_plan(p.id)
      and (p_facultad_id is null or c.facultad_id = p_facultad_id)
      and (p_carrera_id is null or c.id = p_carrera_id)
  ),
  tareas as (
    select
      tr.id,
      tr.plan_estudio_id,
      tr.fecha_limite,
      tr.estatus,
      pv.nombre_display as plan_nombre,
      pv.estado_etiqueta
    from public.tareas_revision tr
    join planes_visibles pv on pv.id = tr.plan_estudio_id
    where tr.asignado_a = v_usuario and tr.estatus = 'PENDIENTE'
  ),
  avisos as (
    select coalesce(jsonb_agg(
      jsonb_build_object(
        'id', a.id,
        'titulo', a.titulo,
        'cuerpo', a.cuerpo,
        'accionEtiqueta', a.accion_etiqueta,
        'accionRuta', a.accion_ruta
      ) order by a.visible_desde desc
    ), '[]'::jsonb) value
    from public.avisos_institucionales a
    where a.activo
      and a.visible_desde <= now()
      and (a.visible_hasta is null or a.visible_hasta >= now())
      and (a.facultad_id is null or a.facultad_id = p_facultad_id)
      and (a.carrera_id is null or a.carrera_id = p_carrera_id)
      and (
        cardinality(a.roles_claves) = 0
        or p_rol_clave is null
        or p_rol_clave = any(a.roles_claves)
      )
  )
  select jsonb_build_object(
    'contexto', jsonb_build_object(
      'rolClave', p_rol_clave,
      'facultadId', p_facultad_id,
      'carreraId', p_carrera_id
    ),
    'resumen', jsonb_build_object(
      'planes', (select count(*) from planes_visibles),
      'tareasPendientes', (select count(*) from tareas),
      'comentariosPendientes', coalesce((select sum(comentarios_pendientes) from planes_visibles), 0),
      'vigenciasProximas', (
        select count(*) from planes_visibles
        where vigencia_fin between current_date and current_date + 365
      )
    ),
    'requiereAtencion', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', t.id,
        'tipo', 'TAREA_REVISION',
        'planId', t.plan_estudio_id,
        'titulo', t.plan_nombre,
        'detalle', t.estado_etiqueta,
        'fechaLimite', t.fecha_limite
      ) order by t.fecha_limite nulls last)
      from tareas t
    ), '[]'::jsonb),
    'planesRecientes', coalesce((
      select jsonb_agg(to_jsonb(x))
      from (
        select * from planes_visibles order by actualizado_en desc limit 8
      ) x
    ), '[]'::jsonb),
    'facultades', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', x.facultad_id,
        'nombre', x.facultad_nombre,
        'planes', x.planes,
        'comentariosPendientes', x.comentarios
      ) order by x.facultad_nombre)
      from (
        select facultad_id, facultad_nombre, count(*) planes,
          sum(comentarios_pendientes) comentarios
        from planes_visibles
        group by facultad_id, facultad_nombre
      ) x
    ), '[]'::jsonb),
    'avisos', (select value from avisos),
    'saludOperativa', case
      when p_rol_clave = 'ADMIN' and public.authz_has_role('ADMIN') then jsonb_build_object(
        'estructurasSinVigencia', (
          select count(*) from public.estructuras_plan e
          where e.estado_publicacion = 'PUBLICADA'
            and e.tipo = 'CURRICULAR'
            and e.aplicable_desde is null
        ),
        'estructurasSinPlantilla', (
          select count(*) from public.estructuras_plan e
          where e.estado_publicacion = 'PUBLICADA' and e.template_id is null
        )
      )
      else null
    end
  ) into v_result;

  return v_result;
end;
$$;

revoke all on function public.inicio_mesa_trabajo(text, uuid, uuid) from public;
grant execute on function public.inicio_mesa_trabajo(text, uuid, uuid) to authenticated;

create or replace function public.actualizar_fase_diseno_plan(
  p_plan_id uuid,
  p_fase public.fase_diseno_curricular
) returns public.planes_estudio
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_plan public.planes_estudio;
begin
  if not public.authz_plan_write_allowed(p_plan_id) then
    raise exception using errcode = '42501', message = 'No puedes cambiar la fase de este plan';
  end if;

  update public.planes_estudio
  set fase_diseno = p_fase,
      actualizado_en = now(),
      actualizado_por = auth.uid()
  where id = p_plan_id
  returning * into v_plan;

  return v_plan;
end;
$$;

revoke all on function public.actualizar_fase_diseno_plan(uuid, public.fase_diseno_curricular) from public;
grant execute on function public.actualizar_fase_diseno_plan(uuid, public.fase_diseno_curricular) to authenticated;
