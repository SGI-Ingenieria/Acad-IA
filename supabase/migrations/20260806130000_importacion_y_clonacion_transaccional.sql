-- Operaciones transaccionales que sustituyen escrituras secuenciales del
-- navegador y mantienen la identidad documental dentro del servidor.

create or replace function public.crear_importacion_academica(
  p_tipo public.tipo_importacion_academica,
  p_carrera_id uuid default null,
  p_estructura_destino_id uuid default null
)
returns public.importaciones_academicas
language plpgsql security definer
set search_path to ''
as $$
declare
  v_actor uuid := auth.uid();
  v_tenant_id uuid;
  v_result public.importaciones_academicas;
begin
  if v_actor is null then
    raise exception using errcode = '28000', message = 'Usuario no autenticado';
  end if;
  if not public.authz_has_permission('planes.crear') then
    raise exception using errcode = '42501', message = 'No puedes iniciar importaciones académicas';
  end if;
  if p_carrera_id is not null and not public.authz_can_access_carrera(p_carrera_id) then
    raise exception using errcode = '42501', message = 'No puedes usar la carrera seleccionada';
  end if;
  if p_estructura_destino_id is not null and not exists (
    select 1 from public.estructuras_plan ep
    where ep.id = p_estructura_destino_id
      and ep.tipo = 'CURRICULAR'
      and ep.estado_publicacion = 'PUBLICADA'
  ) then
    raise exception using errcode = '23514', message = 'El paquete curricular destino no está publicado';
  end if;

  v_tenant_id := private.tenant_documental_predeterminado(v_actor);
  if v_tenant_id is null then
    raise exception using errcode = '42501', message = 'No existe un espacio documental predeterminado';
  end if;

  insert into public.importaciones_academicas (
    tenant_id, creado_por, tipo, carrera_id, estructura_destino_id
  ) values (
    v_tenant_id, v_actor, p_tipo, p_carrera_id, p_estructura_destino_id
  ) returning * into v_result;

  return v_result;
end;
$$;

create or replace function public.vincular_archivo_importacion(
  p_importacion_id uuid,
  p_file_id uuid,
  p_rol public.rol_archivo_importacion
)
returns public.importacion_archivos
language plpgsql security definer
set search_path to ''
as $$
declare
  v_actor uuid := auth.uid();
  v_import public.importaciones_academicas;
  v_file public.files;
  v_result public.importacion_archivos;
begin
  select * into v_import
  from public.importaciones_academicas
  where id = p_importacion_id
  for update;

  if v_import.id is null
     or v_import.creado_por is distinct from v_actor
     or v_import.estado not in ('CARGANDO', 'ANALIZANDO', 'REVISION') then
    raise exception using errcode = '42501', message = 'La importación no admite archivos';
  end if;
  if not public.autorizar_uso_archivo_documental(v_actor, p_file_id, 'use') then
    raise exception using errcode = '42501', message = 'No puedes usar el archivo seleccionado';
  end if;

  select * into v_file from public.files where id = p_file_id;
  if v_file.id is null
     or v_file.current_version_id is null
     or v_file.tenant_id is distinct from v_import.tenant_id
     or v_file.deleted_at is not null then
    raise exception using errcode = '23514', message = 'El archivo aún no está disponible';
  end if;

  insert into public.importacion_archivos (
    importacion_id, file_version_id, rol
  ) values (
    v_import.id, v_file.current_version_id, p_rol
  )
  on conflict (importacion_id, file_version_id)
  do update set rol = excluded.rol
  returning * into v_result;

  return v_result;
end;
$$;

create or replace function public.actualizar_rol_archivo_importacion(
  p_importacion_archivo_id uuid,
  p_rol public.rol_archivo_importacion
)
returns public.importacion_archivos
language plpgsql security definer
set search_path to ''
as $$
declare
  v_result public.importacion_archivos;
begin
  update public.importacion_archivos ia
  set rol = p_rol
  from public.importaciones_academicas i
  where ia.id = p_importacion_archivo_id
    and i.id = ia.importacion_id
    and i.creado_por = auth.uid()
    and i.estado in ('CARGANDO', 'ANALIZANDO', 'REVISION')
    and public.authz_has_permission('planes.crear')
  returning ia.* into v_result;

  if v_result.id is null then
    raise exception using errcode = '42501', message = 'No puedes reclasificar este archivo';
  end if;
  return v_result;
end;
$$;

create or replace function public.cancelar_importacion_academica(
  p_importacion_id uuid
)
returns public.importaciones_academicas
language plpgsql security definer
set search_path to ''
as $$
declare
  v_result public.importaciones_academicas;
begin
  update public.importaciones_academicas
  set estado = 'CANCELADA', actualizado_en = now()
  where id = p_importacion_id
    and creado_por = auth.uid()
    and estado in ('CARGANDO', 'ANALIZANDO', 'REVISION', 'FALLIDA')
  returning * into v_result;

  if v_result.id is null then
    raise exception using errcode = '55000', message = 'La importación ya no se puede cancelar';
  end if;
  return v_result;
end;
$$;

-- La clonación independiente conserva contenido y bibliografía en una única
-- transacción. Los prerrequisitos no se enlazan a otra carrera implícitamente:
-- quedan como incidencia de procedencia en meta_origen.
create or replace function public.clonar_asignatura_transaccional(
  p_asignatura_origen_id uuid,
  p_plan_destino_id uuid,
  p_overrides jsonb default '{}'::jsonb
)
returns public.asignaturas
language plpgsql security definer
set search_path to ''
as $$
declare
  v_actor uuid := auth.uid();
  v_source public.asignaturas;
  v_target_plan public.planes_estudio;
  v_target_structure public.estructuras_asignatura;
  v_target public.asignaturas;
  v_target_data jsonb;
  v_unknown jsonb;
begin
  if v_actor is null then
    raise exception using errcode = '28000', message = 'Usuario no autenticado';
  end if;
  select * into v_source from public.asignaturas where id = p_asignatura_origen_id;
  select * into v_target_plan from public.planes_estudio where id = p_plan_destino_id;

  if v_source.id is null
     or not public.authz_can_access_asignatura(v_source.id)
     or v_target_plan.id is null
     or not public.authz_plan_write_allowed(v_target_plan.id)
     or not public.authz_has_permission('asignaturas.editar') then
    raise exception using errcode = '42501', message = 'No puedes clonar esta asignatura';
  end if;
  if v_target_plan.rol_version_plan <> 'VERSION_TRABAJO' then
    raise exception using errcode = '55000', message = 'El plan destino es de solo lectura';
  end if;

  select * into v_target_structure
  from public.estructuras_asignatura
  where estructura_plan_id = v_target_plan.estructura_id;
  if v_target_structure.id is null then
    raise exception using errcode = '23514', message = 'El paquete destino no tiene estructura de asignatura';
  end if;

  v_target_data := public.normalizar_datos_por_definicion(
    coalesce(p_overrides->'datos', v_source.datos, '{}'::jsonb),
    v_target_structure.definicion,
    true
  );
  select coalesce(jsonb_object_agg(e.key, e.value), '{}'::jsonb)
  into v_unknown
  from jsonb_each(coalesce(v_source.datos, '{}'::jsonb)) e
  where not (coalesce(v_target_structure.definicion->'properties', '{}'::jsonb) ? e.key);

  insert into public.asignaturas (
    plan_estudio_id, estructura_id, codigo, nombre, tipo, numero_ciclo,
    linea_plan_id, orden_celda, datos, contenido_tematico,
    criterios_de_evaluacion, tipo_origen, meta_origen, creado_por,
    actualizado_por, horas_academicas, horas_independientes, estado,
    instalacion
  ) values (
    v_target_plan.id, v_target_structure.id,
    nullif(p_overrides->>'codigo', ''),
    coalesce(nullif(p_overrides->>'nombre', ''), v_source.nombre),
    coalesce(nullif(p_overrides->>'tipo', '')::public.tipo_asignatura, v_source.tipo),
    coalesce(nullif(p_overrides->>'numero_ciclo', '')::integer, v_source.numero_ciclo),
    nullif(p_overrides->>'linea_plan_id', '')::uuid,
    nullif(p_overrides->>'orden_celda', '')::integer,
    v_target_data, v_source.contenido_tematico, v_source.criterios_de_evaluacion,
    'CLONADO_INTERNO',
    jsonb_build_object(
      'tipo', 'CLONADO_INTERNO',
      'asignatura_origen_id', v_source.id,
      'plan_origen_id', v_source.plan_estudio_id,
      'prerrequisito_origen_id', v_source.prerrequisito_asignatura_id,
      'campos_por_revisar', v_unknown
    ),
    v_actor, v_actor,
    coalesce(nullif(p_overrides->>'horas_academicas', '')::integer, v_source.horas_academicas),
    coalesce(nullif(p_overrides->>'horas_independientes', '')::integer, v_source.horas_independientes),
    'borrador',
    coalesce(nullif(p_overrides->>'instalacion', '')::public.tipo_instalacion_asignatura, v_source.instalacion)
  ) returning * into v_target;

  insert into public.bibliografia_asignatura (
    asignatura_id, tipo, cita, creado_por, referencia_biblioteca,
    referencia_en_linea, titulo, autores, editorial, anio, isbn, formato
  )
  select
    v_target.id, b.tipo, b.cita, v_actor, b.referencia_biblioteca,
    b.referencia_en_linea, b.titulo, b.autores, b.editorial, b.anio,
    b.isbn, b.formato
  from public.bibliografia_asignatura b
  where b.asignatura_id = v_source.id;

  return v_target;
end;
$$;

grant execute on function public.crear_importacion_academica(
  public.tipo_importacion_academica, uuid, uuid
) to authenticated;
grant execute on function public.vincular_archivo_importacion(
  uuid, uuid, public.rol_archivo_importacion
) to authenticated;
grant execute on function public.actualizar_rol_archivo_importacion(
  uuid, public.rol_archivo_importacion
) to authenticated;
grant execute on function public.cancelar_importacion_academica(uuid) to authenticated;
grant execute on function public.clonar_asignatura_transaccional(uuid, uuid, jsonb) to authenticated;

revoke all on function public.crear_importacion_academica(
  public.tipo_importacion_academica, uuid, uuid
) from public;
revoke all on function public.vincular_archivo_importacion(
  uuid, uuid, public.rol_archivo_importacion
) from public;
revoke all on function public.actualizar_rol_archivo_importacion(
  uuid, public.rol_archivo_importacion
) from public;
revoke all on function public.cancelar_importacion_academica(uuid) from public;
revoke all on function public.clonar_asignatura_transaccional(uuid, uuid, jsonb) from public;

comment on function public.clonar_asignatura_transaccional(uuid, uuid, jsonb) is
  'Clona contenido y bibliografía en una sola transacción sin alterar la carrera de origen.';
