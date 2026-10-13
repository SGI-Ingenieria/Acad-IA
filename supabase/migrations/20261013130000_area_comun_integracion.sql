-- Endurecer rutas de escritura indirectas y conservar vínculos al clonar planes.
create or replace function private.area_comun_distribucion(p_config jsonb,p_plan uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select d from public.planes_estudio p join public.estructuras_plan ep on ep.id=p.estructura_id
    cross join jsonb_array_elements(p_config) d
  where p.id=p_plan and ep.tipo='CURRICULAR' and d->>'tipo_ciclo'=p.tipo_ciclo::text
    and (d->>'numero_ciclos')::integer=p.numero_ciclos
    and (nullif(d->>'carrera_id','') is null or d->>'carrera_id'=p.carrera_id::text)
  order by (nullif(d->>'carrera_id','') is not null) desc limit 1;
$$;

-- referencia_biblioteca / referencia_en_linea son referencias textuales, no booleanos.
do $$ declare d text; begin
  select pg_get_functiondef(oid) into d from pg_proc where pronamespace='private'::regnamespace and proname='area_comun_materializar';
  execute replace(replace(d,$txt$(b->>'referencia_biblioteca')::boolean$txt$,$txt$b->>'referencia_biblioteca'$txt$),
    $txt$(b->>'referencia_en_linea')::boolean$txt$,$txt$b->>'referencia_en_linea'$txt$);
end $$;

-- Los guardas también cubren reasignaciones de entidades y líneas receptoras.
create or replace function private.proteger_area_comun() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_old_id uuid; v_plan uuid; v_old_plan uuid; begin
  if private.area_comun_operacion() then
    if tg_op='DELETE' then return old; else return new; end if;
  end if;
  if tg_table_name='asignaturas' then
    if (tg_op<>'INSERT' and old.area_comun_incorporacion_id is not null)
       or (tg_op<>'DELETE' and new.area_comun_incorporacion_id is not null) then
      raise exception 'La asignatura es administrada por Área común' using errcode='42501';
    end if;
    if tg_op<>'DELETE' and exists(select 1 from public.area_comun_incorporaciones where linea_id=new.linea_plan_id) then
      raise exception 'La línea común solo admite sus materias oficiales' using errcode='42501';
    end if;
    if tg_op<>'INSERT' then v_old_plan:=old.plan_estudio_id; end if;
    if tg_op='DELETE' then
      if exists(select 1 from public.area_comun_publicaciones p,
        jsonb_array_elements(p.contenido->'asignaturas') a where a->>'id'=old.id::text) then
        raise exception 'La asignatura tiene publicaciones; retírala de la distribución o sustitúyela' using errcode='23514';
      end if;
      v_plan:=old.plan_estudio_id;
    else v_plan:=new.plan_estudio_id; end if;
    if tg_op='UPDATE' and new.plan_estudio_id is distinct from old.plan_estudio_id
      and exists(select 1 from public.planes_estudio where id=old.plan_estudio_id and categoria='AREA_COMUN') then
      raise exception 'Las materias originales permanecen en el plan de Área común' using errcode='42501';
    end if;
  elsif tg_table_name='lineas_plan' then
    if tg_op<>'INSERT' then v_old_plan:=old.plan_estudio_id; end if;
    if tg_op='DELETE' then v_id:=old.id; v_plan:=old.plan_estudio_id;
    else v_id:=new.id; v_plan:=new.plan_estudio_id; end if;
    if exists(select 1 from public.area_comun_incorporaciones where linea_id=v_id) then
      raise exception 'La línea es administrada por Área común' using errcode='42501';
    end if;
  elsif tg_table_name='planes_estudio' then
    if tg_op='UPDATE' and new.categoria is distinct from old.categoria then
      raise exception 'No se puede cambiar la categoría de un plan' using errcode='42501';
    end if;
    if tg_op='DELETE' and old.categoria='AREA_COMUN' then
      raise exception 'El plan institucional de Área común no se puede eliminar' using errcode='42501';
    end if;
    if tg_op='UPDATE' and exists(select 1 from public.area_comun_incorporaciones where plan_id=new.id)
       and (new.numero_ciclos is distinct from old.numero_ciclos
         or new.tipo_ciclo is distinct from old.tipo_ciclo or new.carrera_id is distinct from old.carrera_id
         or new.estructura_id is distinct from old.estructura_id) then
      raise exception 'Retira la línea común antes de cambiar la carrera o duración del plan' using errcode='23514';
    end if;
    if tg_op='DELETE' then v_plan:=old.id; else v_plan:=new.id; end if;
  else
    if tg_op<>'INSERT' then v_old_id:=old.asignatura_id; end if;
    if tg_op='DELETE' then v_id:=old.asignatura_id; else v_id:=new.asignatura_id; end if;
    select a.plan_estudio_id into v_plan from public.asignaturas a where a.id=v_id;
    select a.plan_estudio_id into v_old_plan from public.asignaturas a where a.id=v_old_id;
    if exists(select 1 from public.asignaturas where id in (v_id,v_old_id) and area_comun_incorporacion_id is not null) then
      raise exception 'El contenido vinculado es de solo lectura' using errcode='42501';
    end if;
  end if;
  -- Serializar ediciones del catálogo con la fotografía de publicación.
  perform 1 from public.planes_estudio where id in (v_plan,v_old_plan) and categoria='AREA_COMUN' for update;
  if found and auth.uid() is not null and not private.area_comun_gestor(auth.uid()) then
    raise exception 'Solo Área común puede gestionar el catálogo' using errcode='42501';
  end if;
  if tg_op='DELETE' then return old; else return new; end if;
end $$;

do $$ declare d text; begin
  select pg_get_functiondef(oid) into d from pg_proc where pronamespace='public'::regnamespace and proname='area_comun_publicar';
  execute replace(d,'if c.plan_id is null or c.revision<>p_revision then',
    'perform 1 from public.planes_estudio where id=p_plan_id for update; if c.plan_id is null or c.revision<>p_revision then');
end $$;

create function private.area_comun_registrar_historial() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.cambios_plan(plan_estudio_id,cambiado_por,tipo,campo,valor_nuevo,fuente)
  values(new.plan_id,new.usuario_id,'OTRO','area_comun',jsonb_build_object('accion',new.accion,'detalle',new.detalle),'HUMANO');
  return new;
end $$;
create trigger area_comun_historial_plan after insert on public.area_comun_historial
for each row execute function private.area_comun_registrar_historial();
revoke all on function private.area_comun_registrar_historial() from public,anon,authenticated,service_role;

-- El clonador ordinario no debe generar copias editables de proyecciones.
-- Reutilizar su código para materias propias y reconstruir la incorporación al final.
do $$ declare d text; begin
  select pg_get_functiondef(oid) into d from pg_proc where pronamespace='public'::regnamespace and proname='crear_version_redisenio';
  d:=replace(d,'FUNCTION public.crear_version_redisenio(', 'FUNCTION private.crear_version_redisenio_sin_area_comun(');
  d:=replace(d,'from public.lineas_plan where plan_estudio_id = v_source.id order by orden',
    'from public.lineas_plan where plan_estudio_id = v_source.id and id not in (select linea_id from public.area_comun_incorporaciones) order by orden');
  d:=replace(d,'where plan_estudio_id = v_source.id and estado <>',
    'where plan_estudio_id = v_source.id and area_comun_incorporacion_id is null and estado <>');
  execute d;
end $$;
revoke all on function private.crear_version_redisenio_sin_area_comun(uuid,uuid,jsonb) from public,anon,authenticated,service_role;
create or replace function public.crear_version_redisenio(p_plan_origen_id uuid,p_estructura_destino_id uuid,p_overrides jsonb default '{}'::jsonb)
returns public.planes_estudio language plpgsql security definer set search_path = '' as $$
declare destino public.planes_estudio; i public.area_comun_incorporaciones; nuevo uuid; r record; begin
  -- La incorporación se conserva con la publicación actual y selección válida.
  perform 1 from public.area_comun_configuracion for share;
  if exists(select 1 from public.planes_estudio where id=p_plan_origen_id and categoria='AREA_COMUN') then
    raise exception 'El catálogo institucional no se clona como licenciatura' using errcode='23514';
  end if;
  destino:=private.crear_version_redisenio_sin_area_comun(p_plan_origen_id,p_estructura_destino_id,p_overrides);
  select * into i from public.area_comun_incorporaciones where plan_id=p_plan_origen_id;
  if i.id is not null then
    nuevo:=public.area_comun_incorporar(destino.id,i.electivas);
    -- Reconectar prerrequisitos de materias propias hacia los mismos espacios comunes.
    for r in select a.id,s.area_comun_espacio from public.asignaturas a
      join public.asignaturas original on original.id=nullif(a.meta_origen->>'asignatura_origen_id','')::uuid
      join public.asignaturas s on s.id=original.prerrequisito_asignatura_id
      where a.plan_estudio_id=destino.id and s.area_comun_incorporacion_id=i.id loop
      update public.asignaturas set prerrequisito_asignatura_id=(select id from public.asignaturas
        where area_comun_incorporacion_id=nuevo and area_comun_espacio=r.area_comun_espacio) where id=r.id;
    end loop;
  end if;
  return destino;
end $$;

-- Tampoco el clonado individual puede convertir una proyección en copia editable.
do $$ declare d text; begin
  select pg_get_functiondef(oid) into d from pg_proc where pronamespace='public'::regnamespace and proname='clonar_asignatura_transaccional';
  execute replace(d,E'begin\r\n',E'begin\r\n  if exists(select 1 from public.asignaturas where id=p_asignatura_origen_id and area_comun_incorporacion_id is not null) then raise exception ''Incorpora la línea común para usar esta asignatura'' using errcode=''23514''; end if;\r\n');
end $$;
