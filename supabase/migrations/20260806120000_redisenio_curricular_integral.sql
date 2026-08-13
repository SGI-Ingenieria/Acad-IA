-- Paquetes curriculares versionados, antecedentes inmutables e importación durable.
-- La migración conserva los contratos existentes y añade las primitivas necesarias
-- para que clonación e importación sean transaccionales.

alter type public.tipo_origen add value if not exists 'IMPORTADO_DOCUMENTAL';
alter type public.tipo_origen add value if not exists 'REDISENO';
alter type public.estado_publicacion_estructura add value if not exists 'ARCHIVADA';

do $$
begin
  if not exists (select 1 from pg_type where typname = 'rol_version_plan') then
    create type public.rol_version_plan as enum ('ANTECEDENTE', 'VERSION_TRABAJO');
  end if;
  if not exists (select 1 from pg_type where typname = 'tipo_instalacion_asignatura') then
    create type public.tipo_instalacion_asignatura as enum ('AULA', 'LABORATORIO', 'OTRA');
  end if;
  if not exists (select 1 from pg_type where typname = 'tipo_importacion_academica') then
    create type public.tipo_importacion_academica as enum ('EXPEDIENTE_PLAN', 'PROGRAMAS_ASIGNATURA');
  end if;
  if not exists (select 1 from pg_type where typname = 'estado_importacion_academica') then
    create type public.estado_importacion_academica as enum (
      'CARGANDO', 'ANALIZANDO', 'REVISION', 'APLICANDO',
      'COMPLETADA', 'FALLIDA', 'CANCELADA'
    );
  end if;
  if not exists (select 1 from pg_type where typname = 'rol_archivo_importacion') then
    create type public.rol_archivo_importacion as enum (
      'PLAN', 'MAPA', 'PROGRAMA', 'RESOLUCION', 'OTRO'
    );
  end if;
end
$$;

alter table public.estructuras_plan
  add column if not exists version_anterior_id uuid,
  add column if not exists manifest_plantillas jsonb not null default '{}'::jsonb;

alter table public.estructuras_plan
  drop constraint if exists estructuras_plan_version_anterior_id_fkey;
alter table public.estructuras_plan
  add constraint estructuras_plan_version_anterior_id_fkey
  foreign key (version_anterior_id) references public.estructuras_plan(id) on delete restrict;

-- Convertir el paquete legado conocido sin depender de que las semillas se
-- vuelvan a ejecutar en ambientes ya existentes.
update public.estructuras_plan
set nombre = 'SEP/DGAIR vigente',
    excel_template_id = '1402917575045089616',
    autoridad_normativa = 'SEP/DGAIR',
    etiqueta_version = 'Acuerdo 17/11/17 y reformas vigentes',
    aplicable_desde = date '2017-11-13',
    referencia_normativa = 'https://www.dof.gob.mx/nota_detalle.php?codigo=5504348&fecha=13/11/2017',
    manifest_plantillas = '{
      "plan_word":{"sha256":"c6b103b8c6be65a971e734ab28de52c5c02e8d8454741fc85ae70c08b91724a1","placeholders_validos":true},
      "mapa_xlsx":{"sha256":"094e09070aedb93328a16f4763198ad750225b44b39a9763c6581a9cc141a41b","placeholders_validos":true},
      "asignatura_word":{"sha256":"3fab7316b8537d55d7c8c526bbb6ddb5f04d88475cba2d77f6eae053cd66dc16","placeholders_validos":true}
    }'::jsonb,
    actualizado_en = now()
where id = '69fb2b77-5a95-47e0-bf1f-389d384200e4';

alter table public.planes_estudio
  add column if not exists rol_version_plan public.rol_version_plan not null default 'VERSION_TRABAJO',
  add column if not exists plan_origen_id uuid,
  add column if not exists etiqueta_version text;

alter table public.planes_estudio
  drop constraint if exists planes_estudio_plan_origen_id_fkey;
alter table public.planes_estudio
  add constraint planes_estudio_plan_origen_id_fkey
  foreign key (plan_origen_id) references public.planes_estudio(id) on delete restrict;

alter table public.planes_estudio
  drop constraint if exists planes_estudio_plan_origen_distinto_chk;
alter table public.planes_estudio
  add constraint planes_estudio_plan_origen_distinto_chk
  check (plan_origen_id is null or plan_origen_id <> id);

create index if not exists planes_estudio_plan_origen_idx
  on public.planes_estudio(plan_origen_id);
create index if not exists planes_estudio_rol_version_idx
  on public.planes_estudio(rol_version_plan);

alter table public.asignaturas
  add column if not exists instalacion public.tipo_instalacion_asignatura not null default 'AULA';

comment on column public.asignaturas.instalacion is
  'Instalación canónica del mapa curricular. Se exporta como A, L u O.';
comment on column public.planes_estudio.rol_version_plan is
  'ANTECEDENTE conserva una versión importada como evidencia inmutable; VERSION_TRABAJO admite rediseño.';
comment on column public.planes_estudio.plan_origen_id is
  'Predecesor inmediato del plan. El antecedente raíz se resuelve de forma recursiva.';

alter table public.registros_oficiales_plan
  add column if not exists anio_solicitud_rvoe integer;

alter table public.registros_oficiales_plan
  drop constraint if exists registros_oficiales_plan_anio_solicitud_chk;
alter table public.registros_oficiales_plan
  add constraint registros_oficiales_plan_anio_solicitud_chk
  check (anio_solicitud_rvoe is null or anio_solicitud_rvoe between 1900 and 2200);

-- Estado durable de una importación. El resultado normalizado nunca sustituye
-- los archivos fuente; importacion_archivos conserva la versión exacta usada.
create table if not exists public.importaciones_academicas (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  creado_por uuid not null references public.usuarios_app(id) on delete restrict,
  tipo public.tipo_importacion_academica not null,
  estado public.estado_importacion_academica not null default 'CARGANDO',
  carrera_id uuid references public.carreras(id) on delete restrict,
  estructura_detectada_id uuid references public.estructuras_plan(id) on delete restrict,
  estructura_destino_id uuid references public.estructuras_plan(id) on delete restrict,
  confianza_estructura numeric,
  resultado_normalizado jsonb not null default '{}'::jsonb,
  incidencias jsonb not null default '[]'::jsonb,
  evidencia jsonb not null default '{}'::jsonb,
  antecedente_plan_id uuid references public.planes_estudio(id) on delete restrict,
  version_trabajo_plan_id uuid references public.planes_estudio(id) on delete restrict,
  error_codigo text,
  error_mensaje text,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  completado_en timestamptz,
  constraint importaciones_confianza_chk check (
    confianza_estructura is null or confianza_estructura between 0 and 1
  ),
  constraint importaciones_resultado_objeto_chk check (
    jsonb_typeof(resultado_normalizado) = 'object'
  ),
  constraint importaciones_incidencias_arreglo_chk check (
    jsonb_typeof(incidencias) = 'array'
  )
);

create table if not exists public.importacion_archivos (
  id uuid primary key default gen_random_uuid(),
  importacion_id uuid not null references public.importaciones_academicas(id) on delete cascade,
  file_version_id uuid not null references public.file_versions(id) on delete restrict,
  rol public.rol_archivo_importacion not null,
  rol_detectado public.rol_archivo_importacion,
  confianza numeric,
  evidencia jsonb not null default '{}'::jsonb,
  creado_en timestamptz not null default now(),
  constraint importacion_archivos_unico unique (importacion_id, file_version_id),
  constraint importacion_archivos_confianza_chk check (
    confianza is null or confianza between 0 and 1
  )
);

create index if not exists importaciones_academicas_usuario_idx
  on public.importaciones_academicas(creado_por, actualizado_en desc);
create index if not exists importaciones_academicas_tenant_idx
  on public.importaciones_academicas(tenant_id, actualizado_en desc);
create index if not exists importacion_archivos_importacion_idx
  on public.importacion_archivos(importacion_id);

alter table public.importaciones_academicas enable row level security;
alter table public.importacion_archivos enable row level security;

drop policy if exists importaciones_select_scope on public.importaciones_academicas;
create policy importaciones_select_scope on public.importaciones_academicas
for select to authenticated using (
  creado_por = auth.uid()
  and public.authz_has_permission('planes.ver')
  and exists (
    select 1 from public.tenant_memberships tm
    where tm.tenant_id = importaciones_academicas.tenant_id
      and tm.user_id = auth.uid()
  )
  and (carrera_id is null or public.authz_can_access_carrera(carrera_id))
);

drop policy if exists importaciones_insert_scope on public.importaciones_academicas;
create policy importaciones_insert_scope on public.importaciones_academicas
for insert to authenticated with check (
  creado_por = auth.uid()
  and public.authz_has_permission('planes.crear')
  and exists (
    select 1 from public.tenant_memberships tm
    where tm.tenant_id = importaciones_academicas.tenant_id
      and tm.user_id = auth.uid()
  )
  and (carrera_id is null or public.authz_can_access_carrera(carrera_id))
);

drop policy if exists importaciones_update_scope on public.importaciones_academicas;
create policy importaciones_update_scope on public.importaciones_academicas
for update to authenticated using (
  creado_por = auth.uid()
  and public.authz_has_permission('planes.crear')
  and estado not in ('COMPLETADA', 'CANCELADA')
) with check (
  creado_por = auth.uid()
  and public.authz_has_permission('planes.crear')
);

drop policy if exists importaciones_delete_scope on public.importaciones_academicas;
create policy importaciones_delete_scope on public.importaciones_academicas
for delete to authenticated using (
  creado_por = auth.uid()
  and estado in ('CARGANDO', 'FALLIDA', 'CANCELADA')
);

drop policy if exists importacion_archivos_select_scope on public.importacion_archivos;
create policy importacion_archivos_select_scope on public.importacion_archivos
for select to authenticated using (
  exists (
    select 1 from public.importaciones_academicas i
    where i.id = importacion_archivos.importacion_id
      and i.creado_por = auth.uid()
      and public.authz_has_permission('planes.ver')
  )
);

drop policy if exists importacion_archivos_write_scope on public.importacion_archivos;
create policy importacion_archivos_write_scope on public.importacion_archivos
for all to authenticated using (
  exists (
    select 1 from public.importaciones_academicas i
    where i.id = importacion_archivos.importacion_id
      and i.creado_por = auth.uid()
      and i.estado in ('CARGANDO', 'ANALIZANDO', 'REVISION')
      and public.authz_has_permission('planes.crear')
  )
) with check (
  exists (
    select 1 from public.importaciones_academicas i
    join public.file_versions fv on fv.id = importacion_archivos.file_version_id
    where i.id = importacion_archivos.importacion_id
      and i.creado_por = auth.uid()
      and i.tenant_id = fv.tenant_id
      and i.estado in ('CARGANDO', 'ANALIZANDO', 'REVISION')
      and public.authz_has_permission('planes.crear')
      and public.autorizar_uso_archivo_documental(auth.uid(), fv.file_id, 'use')
  )
);

grant select, insert, update, delete on public.importaciones_academicas to authenticated;
grant select, insert, update, delete on public.importacion_archivos to authenticated;
grant all on public.importaciones_academicas to service_role;
grant all on public.importacion_archivos to service_role;

-- Antecedentes: negar edición tanto en las funciones de autorización como en
-- triggers. Los triggers cubren incluso escrituras privilegiadas accidentales.
create or replace function public.authz_plan_write_allowed(p_plan_id uuid)
returns boolean
language sql stable
set search_path to 'public', 'private', 'auth', 'extensions', 'pg_temp'
as $$
  select exists (
    select 1 from public.planes_estudio p
    where p.id = p_plan_id
      and p.rol_version_plan = 'VERSION_TRABAJO'
      and (
        public.usuario_puede_editar_plan(auth.uid(), p_plan_id)
        or (
          public.authz_is_admin()
          and public.authz_admin_override_reason() is not null
          and public.authz_can_access_plan(p_plan_id)
        )
      )
  );
$$;

create or replace function public.authz_plan_ia_allowed(p_plan_id uuid)
returns boolean
language sql stable
set search_path to 'public', 'private', 'auth', 'extensions', 'pg_temp'
as $$
  select exists (
    select 1 from public.planes_estudio p
    where p.id = p_plan_id
      and p.rol_version_plan = 'VERSION_TRABAJO'
      and public.usuario_puede_editar_plan(auth.uid(), p_plan_id)
      and public.authz_has_permission('ia.usar')
      and public.plan_estado_clave(p_plan_id) in ('BORRADOR', 'REVISION')
  );
$$;

create or replace function private.plan_es_antecedente(p_plan_id uuid)
returns boolean
language sql stable security definer
set search_path to ''
as $$
  select coalesce((
    select p.rol_version_plan = 'ANTECEDENTE'
    from public.planes_estudio p where p.id = p_plan_id
  ), false)
$$;

create or replace function private.proteger_antecedente()
returns trigger
language plpgsql security definer
set search_path to ''
as $$
declare
  v_plan_id uuid;
begin
  if tg_table_name = 'planes_estudio' then
    if tg_op in ('UPDATE', 'DELETE') and old.rol_version_plan = 'ANTECEDENTE' then
      raise exception using errcode = '55000', message = 'El antecedente es inmutable';
    end if;
    return coalesce(new, old);
  elsif tg_table_name = 'lineas_plan' then
    v_plan_id := case when tg_op = 'DELETE' then old.plan_estudio_id else new.plan_estudio_id end;
  elsif tg_table_name = 'asignaturas' then
    v_plan_id := case when tg_op = 'DELETE' then old.plan_estudio_id else new.plan_estudio_id end;
  elsif tg_table_name = 'bibliografia_asignatura' then
    select a.plan_estudio_id into v_plan_id
    from public.asignaturas a
    where a.id = case when tg_op = 'DELETE' then old.asignatura_id else new.asignatura_id end;
  end if;

  if private.plan_es_antecedente(v_plan_id) then
    raise exception using errcode = '55000', message = 'El antecedente es inmutable';
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists planes_estudio_antecedente_guard on public.planes_estudio;
create trigger planes_estudio_antecedente_guard
before update or delete on public.planes_estudio
for each row execute function private.proteger_antecedente();

drop trigger if exists lineas_plan_antecedente_guard on public.lineas_plan;
create trigger lineas_plan_antecedente_guard
before insert or update or delete on public.lineas_plan
for each row execute function private.proteger_antecedente();

drop trigger if exists asignaturas_antecedente_guard on public.asignaturas;
create trigger asignaturas_antecedente_guard
before insert or update or delete on public.asignaturas
for each row execute function private.proteger_antecedente();

drop trigger if exists bibliografia_antecedente_guard on public.bibliografia_asignatura;
create trigger bibliografia_antecedente_guard
before insert or update or delete on public.bibliografia_asignatura
for each row execute function private.proteger_antecedente();

-- Los paquetes publicados son snapshots. Se versionan, no se editan.
create or replace function private.proteger_paquete_publicado()
returns trigger
language plpgsql security definer
set search_path to ''
as $$
declare
  v_estado public.estado_publicacion_estructura;
begin
  if tg_table_name = 'estructuras_plan' then
    if old.estado_publicacion = 'PUBLICADA' then
      raise exception using errcode = '55000', message = 'El paquete publicado es inmutable';
    end if;
  else
    select ep.estado_publicacion into v_estado
    from public.estructuras_plan ep
    where ep.id = coalesce(new.estructura_plan_id, old.estructura_plan_id);
    if v_estado = 'PUBLICADA' then
      raise exception using errcode = '55000', message = 'El paquete publicado es inmutable';
    end if;
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists estructuras_plan_publicada_guard on public.estructuras_plan;
create trigger estructuras_plan_publicada_guard
before update or delete on public.estructuras_plan
for each row execute function private.proteger_paquete_publicado();

drop trigger if exists estructuras_asignatura_publicada_guard on public.estructuras_asignatura;
create trigger estructuras_asignatura_publicada_guard
before insert or update or delete on public.estructuras_asignatura
for each row execute function private.proteger_paquete_publicado();

create or replace function public.validar_paquete_curricular(p_estructura_id uuid)
returns jsonb
language plpgsql stable security definer
set search_path to ''
as $$
declare
  v_plan public.estructuras_plan;
  v_asignatura public.estructuras_asignatura;
  v_errores text[] := '{}';
  v_plan_aliases text[] := array[
    'nombre', 'nivel', 'carrera', 'nivel_y_nombre_del_plan_de_estudios',
    'tipo_ciclo', 'numero_ciclos', 'total_de_ciclos_del_plan_de_estudios',
    'semanas_por_ciclo', 'duracion_del_ciclo_escolar', 'clave_sep',
    'clave_del_plan_de_estudios', 'vigencia'
  ];
  v_asignatura_aliases text[] := array[
    'nombre', 'denominacion_de_la_asignatura_o_unidad_de_aprendizaje',
    'codigo', 'clave_de_la_asignatura', 'numero_ciclo', 'ciclo',
    'creditos', 'bibliografia'
  ];
  v_key text;
begin
  select * into v_plan from public.estructuras_plan where id = p_estructura_id;
  select * into v_asignatura from public.estructuras_asignatura
  where estructura_plan_id = p_estructura_id;

  if v_plan.id is null or v_plan.tipo <> 'CURRICULAR' then
    v_errores := array_append(v_errores, 'PAQUETE_CURRICULAR_REQUERIDO');
  end if;
  if v_asignatura.id is null then
    v_errores := array_append(v_errores, 'ESTRUCTURA_ASIGNATURA_REQUERIDA');
  end if;
  if nullif(btrim(v_plan.template_id), '') is null then
    v_errores := array_append(v_errores, 'PLANTILLA_PLAN_REQUERIDA');
  end if;
  if nullif(btrim(v_plan.excel_template_id), '') is null then
    v_errores := array_append(v_errores, 'PLANTILLA_MAPA_REQUERIDA');
  end if;
  if nullif(btrim(v_asignatura.template_id), '') is null then
    v_errores := array_append(v_errores, 'PLANTILLA_ASIGNATURA_REQUERIDA');
  end if;
  if jsonb_typeof(v_plan.definicion->'properties') is distinct from 'object' then
    v_errores := array_append(v_errores, 'ESQUEMA_PLAN_INVALIDO');
  end if;
  if v_asignatura.id is not null
     and jsonb_typeof(v_asignatura.definicion->'properties') is distinct from 'object' then
    v_errores := array_append(v_errores, 'ESQUEMA_ASIGNATURA_INVALIDO');
  end if;

  foreach v_key in array v_plan_aliases loop
    if coalesce(v_plan.definicion->'properties', '{}'::jsonb) ? v_key then
      v_errores := array_append(v_errores, 'CAMPO_PLAN_DUPLICADO:' || v_key);
    end if;
  end loop;
  if v_asignatura.id is not null then
    foreach v_key in array v_asignatura_aliases loop
      if coalesce(v_asignatura.definicion->'properties', '{}'::jsonb) ? v_key then
        v_errores := array_append(v_errores, 'CAMPO_ASIGNATURA_DUPLICADO:' || v_key);
      end if;
    end loop;
  end if;

  if coalesce((v_plan.manifest_plantillas #>> '{plan_word,placeholders_validos}')::boolean, false) is false then
    v_errores := array_append(v_errores, 'PLACEHOLDERS_PLAN_INVALIDOS');
  end if;
  if coalesce((v_plan.manifest_plantillas #>> '{mapa_xlsx,placeholders_validos}')::boolean, false) is false then
    v_errores := array_append(v_errores, 'PLACEHOLDERS_MAPA_INVALIDOS');
  end if;
  if coalesce((v_plan.manifest_plantillas #>> '{asignatura_word,placeholders_validos}')::boolean, false) is false then
    v_errores := array_append(v_errores, 'PLACEHOLDERS_ASIGNATURA_INVALIDOS');
  end if;

  return jsonb_build_object(
    'valido', cardinality(v_errores) = 0,
    'errores', to_jsonb(v_errores)
  );
end;
$$;

create or replace function public.publicar_paquete_curricular(p_estructura_id uuid)
returns public.estructuras_plan
language plpgsql security definer
set search_path to ''
as $$
declare
  v_validacion jsonb;
  v_result public.estructuras_plan;
begin
  if not public.authz_has_permission('catalogos.gestionar') then
    raise exception using errcode = '42501', message = 'No puedes publicar paquetes curriculares';
  end if;
  select public.validar_paquete_curricular(p_estructura_id) into v_validacion;
  if not coalesce((v_validacion->>'valido')::boolean, false) then
    raise exception using errcode = '23514', message = 'El paquete curricular no cumple los requisitos de publicación', detail = v_validacion::text;
  end if;
  update public.estructuras_plan
  set estado_publicacion = 'PUBLICADA', actualizado_en = now(), actualizado_por = auth.uid()
  where id = p_estructura_id and estado_publicacion = 'BORRADOR'
  returning * into v_result;
  if v_result.id is null then
    raise exception using errcode = '55000', message = 'Solo se puede publicar un paquete en borrador';
  end if;
  return v_result;
end;
$$;

create or replace function public.crear_version_paquete_curricular(
  p_estructura_id uuid,
  p_etiqueta_version text
)
returns public.estructuras_plan
language plpgsql security definer
set search_path to ''
as $$
declare
  v_source public.estructuras_plan;
  v_subject public.estructuras_asignatura;
  v_new public.estructuras_plan;
begin
  if not public.authz_has_permission('catalogos.gestionar') then
    raise exception using errcode = '42501', message = 'No puedes versionar paquetes curriculares';
  end if;
  select * into v_source from public.estructuras_plan where id = p_estructura_id;
  if v_source.id is null then
    raise exception using errcode = 'P0002', message = 'Paquete curricular no encontrado';
  end if;
  select * into v_subject from public.estructuras_asignatura where estructura_plan_id = v_source.id;

  insert into public.estructuras_plan (
    nombre, tipo, template_id, excel_template_id, definicion,
    autoridad_normativa, etiqueta_version, aplicable_desde, aplicable_hasta,
    estado_publicacion, referencia_normativa, version_anterior_id,
    manifest_plantillas, creado_por, actualizado_por
  ) values (
    v_source.nombre, v_source.tipo, v_source.template_id, v_source.excel_template_id,
    v_source.definicion, v_source.autoridad_normativa,
    nullif(btrim(p_etiqueta_version), ''), null, null, 'BORRADOR',
    v_source.referencia_normativa, v_source.id, v_source.manifest_plantillas,
    auth.uid(), auth.uid()
  ) returning * into v_new;

  if v_subject.id is not null then
    insert into public.estructuras_asignatura (
      estructura_plan_id, nombre, definicion, template_id, tipo, creado_por, actualizado_por
    ) values (
      v_new.id, v_subject.nombre, v_subject.definicion, v_subject.template_id,
      v_subject.tipo, auth.uid(), auth.uid()
    );
  end if;
  return v_new;
end;
$$;

-- Clon transaccional con tablas de correspondencia en JSON. La estructura de
-- asignatura destino es la hija única del paquete, nunca un fallback por nombre.
create or replace function public.crear_version_redisenio(
  p_plan_origen_id uuid,
  p_estructura_destino_id uuid,
  p_overrides jsonb default '{}'::jsonb
)
returns public.planes_estudio
language plpgsql security definer
set search_path to ''
as $$
declare
  v_source public.planes_estudio;
  v_target public.planes_estudio;
  v_target_structure public.estructuras_plan;
  v_subject_structure public.estructuras_asignatura;
  v_estado_id uuid;
  v_actor uuid := auth.uid();
  v_line_map jsonb := '{}'::jsonb;
  v_subject_map jsonb := '{}'::jsonb;
  v_line public.lineas_plan;
  v_subject public.asignaturas;
  v_new_line_id uuid;
  v_new_subject_id uuid;
  v_target_data jsonb;
  v_unknown jsonb;
  v_subject_data jsonb;
  v_subject_unknown jsonb;
  v_fecha date;
begin
  if v_actor is null then
    raise exception using errcode = '28000', message = 'Usuario no autenticado';
  end if;
  select * into v_source from public.planes_estudio where id = p_plan_origen_id;
  if v_source.id is null or not public.authz_can_access_plan(v_source.id) then
    raise exception using errcode = '42501', message = 'No puedes usar el plan de origen';
  end if;
  if not public.authz_has_permission('planes.crear') then
    raise exception using errcode = '42501', message = 'No puedes crear versiones de planes';
  end if;
  select * into v_target_structure from public.estructuras_plan where id = p_estructura_destino_id;
  if v_target_structure.id is null or v_target_structure.tipo <> 'CURRICULAR' then
    raise exception using errcode = '23514', message = 'El paquete curricular destino no es válido';
  end if;
  select * into v_subject_structure from public.estructuras_asignatura
  where estructura_plan_id = v_target_structure.id;
  if v_subject_structure.id is null then
    raise exception using errcode = '23514', message = 'El paquete destino no tiene estructura de asignatura';
  end if;
  select id into v_estado_id from public.estados_plan
  where clave = 'BORRADOR' order by orden limit 1;

  v_fecha := coalesce(
    nullif(p_overrides->>'fecha_inicio_imparticion', '')::date,
    v_source.fecha_inicio_imparticion,
    date_trunc('month', current_date)::date
  );
  v_target_data := public.normalizar_datos_por_definicion(
    coalesce(p_overrides->'datos', v_source.datos, '{}'::jsonb),
    v_target_structure.definicion,
    true
  );
  select coalesce(jsonb_object_agg(e.key, e.value), '{}'::jsonb)
  into v_unknown
  from jsonb_each(coalesce(v_source.datos, '{}'::jsonb)) e
  where not (coalesce(v_target_structure.definicion->'properties', '{}'::jsonb) ? e.key);

  insert into public.planes_estudio (
    carrera_id, estructura_id, nombre, tipo_ciclo, numero_ciclos, datos,
    estado_actual_id, activo, tipo_origen, meta_origen, creado_por, actualizado_por,
    nombre_propuesto, nombre_display, fecha_inicio_imparticion,
    estructura_recomendada_id, seleccion_estructura, fase_diseno,
    semanas_por_ciclo, rol_version_plan, plan_origen_id, etiqueta_version
  ) values (
    coalesce(nullif(p_overrides->>'carrera_id', '')::uuid, v_source.carrera_id),
    v_target_structure.id,
    coalesce(nullif(p_overrides->>'nombre', ''), v_source.nombre),
    coalesce(nullif(p_overrides->>'tipo_ciclo', '')::public.tipo_ciclo, v_source.tipo_ciclo),
    coalesce(nullif(p_overrides->>'numero_ciclos', '')::integer, v_source.numero_ciclos),
    v_target_data,
    v_estado_id, true, 'REDISENO',
    jsonb_build_object(
      'tipo', 'REDISENO', 'plan_origen_id', v_source.id,
      'campos_por_revisar', v_unknown
    ),
    v_actor, v_actor,
    coalesce(nullif(p_overrides->>'nombre_propuesto', ''), v_source.nombre_propuesto),
    coalesce(v_source.nombre_display, 'Plan de estudios'), v_fecha,
    v_target_structure.id, 'AUTOMATICA', v_source.fase_diseno,
    coalesce(nullif(p_overrides->>'semanas_por_ciclo', '')::integer, v_source.semanas_por_ciclo),
    'VERSION_TRABAJO', v_source.id,
    coalesce(nullif(p_overrides->>'etiqueta_version', ''), to_char(v_fecha, 'YYYY'))
  ) returning * into v_target;

  for v_line in select * from public.lineas_plan where plan_estudio_id = v_source.id order by orden loop
    v_new_line_id := gen_random_uuid();
    v_line_map := v_line_map || jsonb_build_object(v_line.id::text, v_new_line_id::text);
    insert into public.lineas_plan (
      id, plan_estudio_id, nombre, orden, area, color, proposito,
      aporte_perfil_egreso, alcance_formativo, creado_por, actualizado_por
    ) values (
      v_new_line_id, v_target.id, v_line.nombre, v_line.orden, v_line.area,
      v_line.color, v_line.proposito, v_line.aporte_perfil_egreso,
      v_line.alcance_formativo, v_actor, v_actor
    );
  end loop;

  for v_subject in
    select * from public.asignaturas
    where plan_estudio_id = v_source.id and estado <> 'archivada'
    order by numero_ciclo nulls last, orden_celda nulls last
  loop
    v_new_subject_id := gen_random_uuid();
    v_subject_map := v_subject_map || jsonb_build_object(v_subject.id::text, v_new_subject_id::text);
    v_subject_data := public.normalizar_datos_por_definicion(
      coalesce(v_subject.datos, '{}'::jsonb), v_subject_structure.definicion, true
    );
    select coalesce(jsonb_object_agg(e.key, e.value), '{}'::jsonb)
    into v_subject_unknown
    from jsonb_each(coalesce(v_subject.datos, '{}'::jsonb)) e
    where not (coalesce(v_subject_structure.definicion->'properties', '{}'::jsonb) ? e.key);

    insert into public.asignaturas (
      id, plan_estudio_id, estructura_id, codigo, nombre, tipo, numero_ciclo,
      linea_plan_id, orden_celda, datos, contenido_tematico, tipo_origen,
      meta_origen, creado_por, actualizado_por, horas_academicas,
      horas_independientes, estado, criterios_de_evaluacion, instalacion
    ) values (
      v_new_subject_id, v_target.id, v_subject_structure.id, v_subject.codigo,
      v_subject.nombre, v_subject.tipo, v_subject.numero_ciclo,
      nullif(v_line_map->>coalesce(v_subject.linea_plan_id::text, ''), '')::uuid,
      v_subject.orden_celda, v_subject_data, v_subject.contenido_tematico,
      'REDISENO', jsonb_build_object(
        'tipo', 'REDISENO', 'asignatura_origen_id', v_subject.id,
        'plan_origen_id', v_source.id, 'campos_por_revisar', v_subject_unknown
      ),
      v_actor, v_actor, v_subject.horas_academicas, v_subject.horas_independientes,
      v_subject.estado, v_subject.criterios_de_evaluacion, v_subject.instalacion
    );
  end loop;

  for v_subject in
    select * from public.asignaturas
    where plan_estudio_id = v_source.id and prerrequisito_asignatura_id is not null
  loop
    update public.asignaturas
    set prerrequisito_asignatura_id = nullif(v_subject_map->>v_subject.prerrequisito_asignatura_id::text, '')::uuid
    where id = nullif(v_subject_map->>v_subject.id::text, '')::uuid;
  end loop;

  insert into public.bibliografia_asignatura (
    asignatura_id, tipo, cita, creado_por, referencia_biblioteca,
    referencia_en_linea, titulo, autores, editorial, anio, isbn, formato
  )
  select
    nullif(v_subject_map->>b.asignatura_id::text, '')::uuid,
    b.tipo, b.cita, v_actor, b.referencia_biblioteca, b.referencia_en_linea,
    b.titulo, b.autores, b.editorial, b.anio, b.isbn, b.formato
  from public.bibliografia_asignatura b
  where b.asignatura_id in (
    select a.id from public.asignaturas a where a.plan_estudio_id = v_source.id
  ) and v_subject_map ? b.asignatura_id::text;

  return v_target;
end;
$$;

create or replace function public.obtener_linaje_plan(p_plan_id uuid)
returns table (
  id uuid,
  plan_origen_id uuid,
  rol_version_plan public.rol_version_plan,
  etiqueta_version text,
  nombre_display text,
  profundidad integer,
  es_raiz boolean
)
language sql stable security definer
set search_path to ''
as $$
  with recursive linaje as (
    select p.id, p.plan_origen_id, p.rol_version_plan, p.etiqueta_version,
           p.nombre_display, 0 as profundidad
    from public.planes_estudio p
    where p.id = p_plan_id and public.authz_can_access_plan(p.id)
    union all
    select p.id, p.plan_origen_id, p.rol_version_plan, p.etiqueta_version,
           p.nombre_display, l.profundidad + 1
    from public.planes_estudio p
    join linaje l on l.plan_origen_id = p.id
  )
  select l.id, l.plan_origen_id, l.rol_version_plan, l.etiqueta_version,
         l.nombre_display, l.profundidad, l.plan_origen_id is null
  from linaje l order by l.profundidad;
$$;

create or replace function public.obtener_plan_antecedente_raiz(p_plan_id uuid)
returns uuid
language sql stable security definer
set search_path to ''
as $$
  select l.id
  from public.obtener_linaje_plan(p_plan_id) l
  order by l.profundidad desc
  limit 1
$$;

-- Aplicación atómica del resultado revisado. El payload normalizado usa ids
-- externos solo dentro del JSON y nunca los expone como identificadores reales.
create or replace function public.aplicar_importacion_expediente(p_importacion_id uuid)
returns jsonb
language plpgsql security definer
set search_path to ''
as $$
declare
  v_import public.importaciones_academicas;
  v_result jsonb;
  v_plan jsonb;
  v_structure public.estructuras_plan;
  v_subject_structure public.estructuras_asignatura;
  v_antecedente public.planes_estudio;
  v_trabajo public.planes_estudio;
  v_actor uuid := auth.uid();
  v_estado_id uuid;
  v_line jsonb;
  v_subject jsonb;
  v_biblio jsonb;
  v_line_map jsonb := '{}'::jsonb;
  v_subject_map jsonb := '{}'::jsonb;
  v_id uuid;
begin
  select * into v_import from public.importaciones_academicas
  where id = p_importacion_id for update;
  if v_import.id is null or v_import.creado_por <> v_actor then
    raise exception using errcode = '42501', message = 'Importación no disponible';
  end if;
  if v_import.tipo <> 'EXPEDIENTE_PLAN' or v_import.estado <> 'REVISION' then
    raise exception using errcode = '55000', message = 'La importación no está lista para aplicar';
  end if;
  if not public.authz_has_permission('planes.crear')
     or v_import.carrera_id is null
     or not public.authz_can_access_carrera(v_import.carrera_id) then
    raise exception using errcode = '42501', message = 'No puedes aplicar esta importación';
  end if;

  update public.importaciones_academicas
  set estado = 'APLICANDO', actualizado_en = now() where id = v_import.id;
  v_result := v_import.resultado_normalizado;
  v_plan := coalesce(v_result->'plan', '{}'::jsonb);
  select * into v_structure from public.estructuras_plan
  where id = coalesce(v_import.estructura_detectada_id, v_import.estructura_destino_id);
  select * into v_subject_structure from public.estructuras_asignatura
  where estructura_plan_id = v_structure.id;
  if v_structure.id is null or v_subject_structure.id is null then
    raise exception using errcode = '23514', message = 'No se pudo resolver el paquete de origen';
  end if;
  select id into v_estado_id from public.estados_plan where clave = 'BORRADOR' order by orden limit 1;

  insert into public.planes_estudio (
    carrera_id, estructura_id, nombre, tipo_ciclo, numero_ciclos, datos,
    estado_actual_id, activo, tipo_origen, meta_origen, creado_por, actualizado_por,
    nombre_display, fecha_inicio_imparticion, seleccion_estructura,
    semanas_por_ciclo, rol_version_plan, etiqueta_version
  ) values (
    v_import.carrera_id, v_structure.id, null,
    coalesce(nullif(v_plan->>'tipo_ciclo', '')::public.tipo_ciclo, 'Semestre'),
    greatest(coalesce(nullif(v_plan->>'numero_ciclos', '')::integer, 1), 1),
    public.normalizar_datos_por_definicion(coalesce(v_plan->'datos', '{}'::jsonb), v_structure.definicion, true),
    v_estado_id, false, 'IMPORTADO_DOCUMENTAL',
    jsonb_build_object('tipo', 'IMPORTADO_DOCUMENTAL', 'importacion_id', v_import.id),
    v_actor, v_actor, coalesce(nullif(v_plan->>'nombre_display', ''), 'Plan importado'),
    coalesce(nullif(v_plan->>'fecha_inicio_imparticion', '')::date, date_trunc('month', current_date)::date),
    'AUTOMATICA', nullif(v_plan->>'semanas_por_ciclo', '')::integer,
    'VERSION_TRABAJO', nullif(v_plan->>'etiqueta_version', '')
  ) returning * into v_antecedente;

  for v_line in select value from jsonb_array_elements(coalesce(v_result->'lineas', '[]'::jsonb)) loop
    v_id := gen_random_uuid();
    v_line_map := v_line_map || jsonb_build_object(coalesce(v_line->>'id_externo', v_id::text), v_id::text);
    insert into public.lineas_plan (
      id, plan_estudio_id, nombre, orden, area, color, proposito,
      aporte_perfil_egreso, alcance_formativo, creado_por, actualizado_por
    ) values (
      v_id, v_antecedente.id, coalesce(nullif(v_line->>'nombre', ''), 'Área curricular'),
      coalesce((v_line->>'orden')::integer, 0), nullif(v_line->>'area', ''),
      nullif(v_line->>'color', ''), nullif(v_line->>'proposito', ''),
      nullif(v_line->>'aporte_perfil_egreso', ''), nullif(v_line->>'alcance_formativo', ''),
      v_actor, v_actor
    );
  end loop;

  for v_subject in select value from jsonb_array_elements(coalesce(v_result->'asignaturas', '[]'::jsonb)) loop
    v_id := gen_random_uuid();
    v_subject_map := v_subject_map || jsonb_build_object(coalesce(v_subject->>'id_externo', v_id::text), v_id::text);
    insert into public.asignaturas (
      id, plan_estudio_id, estructura_id, codigo, nombre, tipo, numero_ciclo,
      linea_plan_id, orden_celda, datos, contenido_tematico, tipo_origen,
      meta_origen, creado_por, actualizado_por, horas_academicas,
      horas_independientes, criterios_de_evaluacion, instalacion
    ) values (
      v_id, v_antecedente.id, v_subject_structure.id, nullif(v_subject->>'codigo', ''),
      coalesce(nullif(v_subject->>'nombre', ''), 'Asignatura importada'),
      coalesce(nullif(v_subject->>'tipo', '')::public.tipo_asignatura, 'OBLIGATORIA'),
      nullif(v_subject->>'numero_ciclo', '')::integer,
      nullif(v_line_map->>coalesce(v_subject->>'linea_id_externo', ''), '')::uuid,
      nullif(v_subject->>'orden_celda', '')::integer,
      public.normalizar_datos_por_definicion(coalesce(v_subject->'datos', '{}'::jsonb), v_subject_structure.definicion, true),
      coalesce(v_subject->'contenido_tematico', '[]'::jsonb), 'IMPORTADO_DOCUMENTAL',
      jsonb_build_object('tipo', 'IMPORTADO_DOCUMENTAL', 'importacion_id', v_import.id),
      v_actor, v_actor, nullif(v_subject->>'horas_academicas', '')::integer,
      nullif(v_subject->>'horas_independientes', '')::integer,
      coalesce(v_subject->'criterios_de_evaluacion', '[]'::jsonb),
      coalesce(nullif(v_subject->>'instalacion', '')::public.tipo_instalacion_asignatura, 'AULA')
    );
  end loop;

  for v_subject in select value from jsonb_array_elements(coalesce(v_result->'asignaturas', '[]'::jsonb)) loop
    if nullif(v_subject->>'prerrequisito_id_externo', '') is not null then
      update public.asignaturas set prerrequisito_asignatura_id =
        nullif(v_subject_map->>(v_subject->>'prerrequisito_id_externo'), '')::uuid
      where id = nullif(v_subject_map->>(v_subject->>'id_externo'), '')::uuid;
    end if;
    for v_biblio in select value from jsonb_array_elements(coalesce(v_subject->'bibliografia', '[]'::jsonb)) loop
      insert into public.bibliografia_asignatura (
        asignatura_id, tipo, cita, creado_por, titulo, autores, editorial, anio,
        isbn, referencia_biblioteca, referencia_en_linea, formato
      ) values (
        nullif(v_subject_map->>(v_subject->>'id_externo'), '')::uuid,
        coalesce(nullif(v_biblio->>'tipo', '')::public.tipo_bibliografia, 'BASICA'),
        coalesce(nullif(v_biblio->>'cita', ''), nullif(v_biblio->>'titulo', ''), 'Referencia importada'),
        v_actor, nullif(v_biblio->>'titulo', ''), coalesce(v_biblio->'autores', '[]'::jsonb),
        nullif(v_biblio->>'editorial', ''), nullif(v_biblio->>'anio', '')::integer,
        nullif(v_biblio->>'isbn', ''), nullif(v_biblio->>'referencia_biblioteca', ''),
        nullif(v_biblio->>'referencia_en_linea', ''), nullif(v_biblio->>'formato', '')
      );
    end loop;
  end loop;

  -- El bloqueo se activa solo cuando el antecedente ya está completo.
  update public.planes_estudio
  set rol_version_plan = 'ANTECEDENTE', actualizado_por = v_actor
  where id = v_antecedente.id;

  v_trabajo := public.crear_version_redisenio(
    v_antecedente.id,
    coalesce(v_import.estructura_destino_id, v_structure.id),
    jsonb_build_object(
      'fecha_inicio_imparticion', coalesce(v_result #>> '{redisenio,fecha_inicio_imparticion}', v_plan->>'fecha_inicio_imparticion'),
      'etiqueta_version', v_result #>> '{redisenio,etiqueta_version}'
    )
  );

  update public.importaciones_academicas
  set estado = 'COMPLETADA', antecedente_plan_id = v_antecedente.id,
      version_trabajo_plan_id = v_trabajo.id, actualizado_en = now(), completado_en = now()
  where id = v_import.id;

  return jsonb_build_object('antecedente_plan_id', v_antecedente.id, 'version_trabajo_plan_id', v_trabajo.id);
exception when others then
  -- Toda la función es una transacción: el estado APLICANDO y los registros
  -- parciales también se revierten. El cliente registra FALLIDA aparte.
  raise;
end;
$$;

grant execute on function public.validar_paquete_curricular(uuid) to authenticated;
grant execute on function public.publicar_paquete_curricular(uuid) to authenticated;
grant execute on function public.crear_version_paquete_curricular(uuid, text) to authenticated;
grant execute on function public.crear_version_redisenio(uuid, uuid, jsonb) to authenticated;
grant execute on function public.obtener_linaje_plan(uuid) to authenticated;
grant execute on function public.obtener_plan_antecedente_raiz(uuid) to authenticated;
grant execute on function public.aplicar_importacion_expediente(uuid) to authenticated;

revoke all on function public.publicar_paquete_curricular(uuid) from public;
revoke all on function public.crear_version_paquete_curricular(uuid, text) from public;
revoke all on function public.crear_version_redisenio(uuid, uuid, jsonb) from public;
revoke all on function public.aplicar_importacion_expediente(uuid) from public;

-- Migración conservadora de duplicados. Solo llena columnas canónicas vacías;
-- cualquier discrepancia se conserva en meta_origen.migracion.
alter table public.planes_estudio disable trigger user;
alter table public.asignaturas disable trigger user;

update public.planes_estudio p
set semanas_por_ciclo = nullif(regexp_replace(p.datos->>'duracion_del_ciclo_escolar', '[^0-9]', '', 'g'), '')::integer
where p.semanas_por_ciclo is null
  and p.datos ? 'duracion_del_ciclo_escolar'
  and nullif(regexp_replace(p.datos->>'duracion_del_ciclo_escolar', '[^0-9]', '', 'g'), '') is not null;

update public.asignaturas a
set codigo = nullif(btrim(a.datos->>'clave_de_la_asignatura'), '')
where nullif(btrim(a.codigo), '') is null
  and nullif(btrim(a.datos->>'clave_de_la_asignatura'), '') is not null;

update public.asignaturas a
set numero_ciclo = nullif(regexp_replace(a.datos->>'ciclo', '[^0-9]', '', 'g'), '')::integer
where a.numero_ciclo is null
  and nullif(regexp_replace(a.datos->>'ciclo', '[^0-9]', '', 'g'), '') is not null;

update public.registros_oficiales_plan r
set anio_solicitud_rvoe = nullif(
  regexp_replace(p.datos->>'clave_del_plan_de_estudios', '[^0-9]', '', 'g'),
  ''
)::integer
from public.planes_estudio p
where p.id = r.plan_estudio_id
  and r.anio_solicitud_rvoe is null
  and nullif(
    regexp_replace(p.datos->>'clave_del_plan_de_estudios', '[^0-9]', '', 'g'),
    ''
  ) is not null;

update public.planes_estudio p
set meta_origen = jsonb_set(
      coalesce(p.meta_origen, '{}'::jsonb),
      '{migracion,campos_conflictivos}',
      coalesce(p.meta_origen #> '{migracion,campos_conflictivos}', '[]'::jsonb)
      || coalesce((
        select jsonb_agg(k)
        from unnest(array[
          'nivel_y_nombre_del_plan_de_estudios', 'total_de_ciclos_del_plan_de_estudios',
          'duracion_del_ciclo_escolar', 'clave_del_plan_de_estudios', 'vigencia'
        ]) k where p.datos ? k
      ), '[]'::jsonb), true
    ),
    datos = coalesce(p.datos, '{}'::jsonb)
      - 'nivel_y_nombre_del_plan_de_estudios'
      - 'total_de_ciclos_del_plan_de_estudios'
      - 'duracion_del_ciclo_escolar'
      - 'clave_del_plan_de_estudios'
      - 'vigencia'
where p.datos ?| array[
  'nivel_y_nombre_del_plan_de_estudios', 'total_de_ciclos_del_plan_de_estudios',
  'duracion_del_ciclo_escolar', 'clave_del_plan_de_estudios', 'vigencia'
];

update public.asignaturas a
set meta_origen = jsonb_set(
      coalesce(a.meta_origen, '{}'::jsonb),
      '{migracion,campos_conflictivos}',
      coalesce(a.meta_origen #> '{migracion,campos_conflictivos}', '[]'::jsonb)
      || coalesce((
        select jsonb_agg(k)
        from unnest(array[
          'denominacion_de_la_asignatura_o_unidad_de_aprendizaje',
          'clave_de_la_asignatura', 'ciclo', 'creditos', 'bibliografia'
        ]) k where a.datos ? k
      ), '[]'::jsonb), true
    ),
    datos = coalesce(a.datos, '{}'::jsonb)
      - 'denominacion_de_la_asignatura_o_unidad_de_aprendizaje'
      - 'clave_de_la_asignatura' - 'ciclo' - 'creditos' - 'bibliografia'
where a.datos ?| array[
  'denominacion_de_la_asignatura_o_unidad_de_aprendizaje',
  'clave_de_la_asignatura', 'ciclo', 'creditos', 'bibliografia'
];

alter table public.planes_estudio enable trigger user;
alter table public.asignaturas enable trigger user;

-- Limpiar también los esquemas para que los triggers de validación y la UI
-- compartan exactamente las mismas fuentes canónicas.
update public.estructuras_plan ep
set definicion = jsonb_set(
  jsonb_set(
    ep.definicion,
    '{properties}',
    coalesce(ep.definicion->'properties', '{}'::jsonb)
      - 'nivel_y_nombre_del_plan_de_estudios'
      - 'total_de_ciclos_del_plan_de_estudios'
      - 'duracion_del_ciclo_escolar'
      - 'clave_del_plan_de_estudios'
      - 'vigencia',
    true
  ),
  '{required}',
  coalesce((
    select jsonb_agg(value)
    from jsonb_array_elements_text(coalesce(ep.definicion->'required', '[]'::jsonb)) t(value)
    where value not in (
      'nivel_y_nombre_del_plan_de_estudios', 'total_de_ciclos_del_plan_de_estudios',
      'duracion_del_ciclo_escolar', 'clave_del_plan_de_estudios', 'vigencia',
      'curso_propedeutico', 'programa_de_investigacion',
      'justificacion_de_la_propuesta_curricular'
    )
  ), '[]'::jsonb),
  true
)
-- Los paquetes publicados son snapshots inmutables. Sus definiciones se
-- conservan como evidencia; solo se normalizan paquetes en borrador.
where ep.tipo = 'CURRICULAR'
  and ep.estado_publicacion <> 'PUBLICADA';

update public.estructuras_asignatura ea
set definicion = jsonb_set(
  jsonb_set(
    ea.definicion,
    '{properties}',
    coalesce(ea.definicion->'properties', '{}'::jsonb)
      - 'denominacion_de_la_asignatura_o_unidad_de_aprendizaje'
      - 'clave_de_la_asignatura' - 'ciclo' - 'creditos' - 'bibliografia',
    true
  ),
  '{required}',
  coalesce((
    select jsonb_agg(value)
    from jsonb_array_elements_text(coalesce(ea.definicion->'required', '[]'::jsonb)) t(value)
    where value not in (
      'denominacion_de_la_asignatura_o_unidad_de_aprendizaje',
      'clave_de_la_asignatura', 'ciclo', 'creditos', 'bibliografia',
      'modalidades_tecnologicas_e_informaticas'
    )
  ), '[]'::jsonb),
  true
)
where ea.tipo = 'CURRICULAR'
  and not exists (
    select 1
    from public.estructuras_plan ep
    where ep.id = ea.estructura_plan_id
      and ep.estado_publicacion = 'PUBLICADA'
  );

comment on column public.planes_estudio.semanas_por_ciclo is
  'Duración canónica en semanas para cualquier tipo de ciclo; puede proponerse desde la carrera.';
