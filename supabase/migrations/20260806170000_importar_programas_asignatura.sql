alter table public.importaciones_academicas
  add column if not exists plan_destino_id uuid
  references public.planes_estudio(id) on delete restrict;

create index if not exists importaciones_academicas_plan_destino_idx
  on public.importaciones_academicas(plan_destino_id)
  where plan_destino_id is not null;

create or replace function public.crear_importacion_academica(
  p_tipo public.tipo_importacion_academica,
  p_carrera_id uuid default null,
  p_estructura_destino_id uuid default null,
  p_plan_destino_id uuid default null
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
  if p_tipo = 'EXPEDIENTE_PLAN'
     and not public.authz_has_permission('planes.crear') then
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
  if p_tipo = 'PROGRAMAS_ASIGNATURA' and (
    p_plan_destino_id is null
    or not public.authz_plan_write_allowed(p_plan_destino_id)
    or not public.authz_has_permission('asignaturas.editar')
  ) then
    raise exception using errcode = '42501', message = 'No puedes importar programas en este plan';
  end if;

  v_tenant_id := private.tenant_documental_predeterminado(v_actor);
  if v_tenant_id is null then
    raise exception using errcode = '42501', message = 'No existe un espacio documental predeterminado';
  end if;

  insert into public.importaciones_academicas (
    tenant_id, creado_por, tipo, carrera_id, estructura_destino_id,
    plan_destino_id
  ) values (
    v_tenant_id, v_actor, p_tipo, p_carrera_id, p_estructura_destino_id,
    p_plan_destino_id
  ) returning * into v_result;

  return v_result;
end;
$$;

create or replace function public.aplicar_importacion_programas(
  p_importacion_id uuid,
  p_ids_externos text[] default null
)
returns jsonb
language plpgsql security definer
set search_path to ''
as $$
declare
  v_import public.importaciones_academicas;
  v_plan public.planes_estudio;
  v_subject_structure public.estructuras_asignatura;
  v_subject jsonb;
  v_biblio jsonb;
  v_id uuid;
  v_ids uuid[] := '{}';
  v_actor uuid := auth.uid();
begin
  select * into v_import
  from public.importaciones_academicas
  where id = p_importacion_id
  for update;

  if v_import.id is null or v_import.creado_por <> v_actor then
    raise exception using errcode = '42501', message = 'Importación no disponible';
  end if;
  if v_import.tipo <> 'PROGRAMAS_ASIGNATURA' or v_import.estado <> 'REVISION' then
    raise exception using errcode = '55000', message = 'La importación no está lista para aplicar';
  end if;
  if v_import.plan_destino_id is null
     or not public.authz_plan_write_allowed(v_import.plan_destino_id)
     or not public.authz_has_permission('asignaturas.editar') then
    raise exception using errcode = '42501', message = 'No puedes aplicar esta importación';
  end if;

  select * into v_plan from public.planes_estudio
  where id = v_import.plan_destino_id;
  select * into v_subject_structure from public.estructuras_asignatura
  where estructura_plan_id = v_plan.estructura_id;
  if v_subject_structure.id is null then
    raise exception using errcode = '23514', message = 'El plan no tiene estructura de asignaturas';
  end if;

  update public.importaciones_academicas
  set estado = 'APLICANDO', actualizado_en = now()
  where id = v_import.id;

  for v_subject in
    select value
    from jsonb_array_elements(
      coalesce(v_import.resultado_normalizado->'asignaturas', '[]'::jsonb)
    )
  loop
    if p_ids_externos is not null
       and not coalesce(v_subject->>'id_externo', '') = any(p_ids_externos) then
      continue;
    end if;

    v_id := gen_random_uuid();
    insert into public.asignaturas (
      id, plan_estudio_id, estructura_id, codigo, nombre, tipo, numero_ciclo,
      orden_celda, datos, contenido_tematico, tipo_origen, meta_origen,
      creado_por, actualizado_por, horas_academicas, horas_independientes,
      criterios_de_evaluacion, instalacion
    ) values (
      v_id, v_plan.id, v_subject_structure.id,
      nullif(v_subject->>'codigo', ''),
      coalesce(nullif(v_subject->>'nombre', ''), 'Asignatura importada'),
      coalesce(nullif(v_subject->>'tipo', '')::public.tipo_asignatura, 'OBLIGATORIA'),
      nullif(v_subject->>'numero_ciclo', '')::integer,
      nullif(v_subject->>'orden_celda', '')::integer,
      public.normalizar_datos_por_definicion(
        coalesce(v_subject->'datos', '{}'::jsonb),
        v_subject_structure.definicion,
        true
      ),
      coalesce(v_subject->'contenido_tematico', '[]'::jsonb),
      'IMPORTADO_DOCUMENTAL',
      jsonb_build_object(
        'tipo', 'IMPORTADO_DOCUMENTAL',
        'importacion_id', v_import.id,
        'id_externo', v_subject->>'id_externo'
      ),
      v_actor, v_actor,
      nullif(v_subject->>'horas_academicas', '')::integer,
      nullif(v_subject->>'horas_independientes', '')::integer,
      coalesce(v_subject->'criterios_de_evaluacion', '[]'::jsonb),
      coalesce(
        nullif(v_subject->>'instalacion', '')::public.tipo_instalacion_asignatura,
        'AULA'
      )
    );
    v_ids := array_append(v_ids, v_id);

    for v_biblio in
      select value
      from jsonb_array_elements(coalesce(v_subject->'bibliografia', '[]'::jsonb))
    loop
      insert into public.bibliografia_asignatura (
        asignatura_id, tipo, cita, creado_por, titulo, autores, editorial,
        anio, isbn, referencia_biblioteca, referencia_en_linea, formato
      ) values (
        v_id,
        coalesce(nullif(v_biblio->>'tipo', '')::public.tipo_bibliografia, 'BASICA'),
        coalesce(
          nullif(v_biblio->>'cita', ''),
          nullif(v_biblio->>'titulo', ''),
          'Referencia importada'
        ),
        v_actor, nullif(v_biblio->>'titulo', ''),
        coalesce(v_biblio->'autores', '[]'::jsonb),
        nullif(v_biblio->>'editorial', ''),
        nullif(v_biblio->>'anio', '')::integer,
        nullif(v_biblio->>'isbn', ''),
        nullif(v_biblio->>'referencia_biblioteca', ''),
        nullif(v_biblio->>'referencia_en_linea', ''),
        nullif(v_biblio->>'formato', '')
      );
    end loop;
  end loop;

  if cardinality(v_ids) = 0 then
    raise exception using errcode = '23514', message = 'Selecciona al menos una asignatura';
  end if;

  update public.importaciones_academicas
  set estado = 'COMPLETADA', version_trabajo_plan_id = v_plan.id,
      actualizado_en = now(), completado_en = now()
  where id = v_import.id;

  return jsonb_build_object('asignatura_ids', to_jsonb(v_ids));
exception when others then
  raise;
end;
$$;

grant execute on function public.crear_importacion_academica(
  public.tipo_importacion_academica, uuid, uuid, uuid
) to authenticated;
grant execute on function public.aplicar_importacion_programas(uuid, text[])
  to authenticated;
revoke all on function public.aplicar_importacion_programas(uuid, text[])
  from public;
