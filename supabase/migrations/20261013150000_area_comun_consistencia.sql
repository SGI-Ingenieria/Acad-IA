-- Alcance institucional explícito: no es un evaluador externo ni un editor global.
alter table public.roles drop constraint roles_alcance_default_chk;
alter table public.roles add constraint roles_alcance_default_chk check
  (alcance_default in ('global','facultad','carrera','asignatura','externo','area_comun'));
update public.roles set alcance_default='area_comun' where clave='AREA_COMUN';

-- Nunca borrar automáticamente una relación externa al cambiar ubicaciones oficiales.
create function private.validar_seriacion_publicacion_comun() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if private.area_comun_operacion() and new.area_comun_incorporacion_id is not null
    and new.numero_ciclo is distinct from old.numero_ciclo and exists (
      select 1 from public.asignaturas a where a.prerrequisito_asignatura_id=new.id
        and a.area_comun_incorporacion_id is distinct from new.area_comun_incorporacion_id
        and (new.numero_ciclo is null or a.numero_ciclo<=new.numero_ciclo)
    ) then
    raise exception 'La ubicación publicada rompe un prerrequisito del plan receptor; resuelve la relación antes de publicar' using errcode='23514';
  end if;
  return new;
end $$;
create trigger a_area_comun_seriacion_guard before update of numero_ciclo on public.asignaturas
for each row execute function private.validar_seriacion_publicacion_comun();
revoke all on function private.validar_seriacion_publicacion_comun() from public,anon,authenticated,service_role;

-- Eliminar un plan receptor completo debe retirar su incorporación antes del cascade.
create function private.retirar_area_comun_al_eliminar_plan() returns trigger
language plpgsql security definer set search_path = '' as $$
declare i public.area_comun_incorporaciones; begin
  if old.categoria='AREA_COMUN' then return old; end if;
  select * into i from public.area_comun_incorporaciones where plan_id=old.id;
  if i.id is not null then
    insert into private.area_comun_operaciones values(txid_current(),pg_backend_pid()) on conflict do nothing;
    update public.asignaturas set prerrequisito_asignatura_id=null where plan_estudio_id=old.id;
    delete from public.asignaturas where area_comun_incorporacion_id=i.id;
    delete from public.area_comun_incorporaciones where id=i.id;
    delete from public.lineas_plan where id=i.linea_id;
    delete from private.area_comun_operaciones where transaccion=txid_current();
  end if;
  return old;
end $$;
create trigger ab_area_comun_plan_delete before delete on public.planes_estudio
for each row execute function private.retirar_area_comun_al_eliminar_plan();
revoke all on function private.retirar_area_comun_al_eliminar_plan() from public,anon,authenticated,service_role;

-- Refrescar el contador del área en otras sesiones al incorporar o retirar la línea.
create function private.notificar_uso_area_comun() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.area_comun_configuracion set actualizado_en=clock_timestamp();
  if tg_op='DELETE' then return old; else return new; end if;
end $$;
create trigger area_comun_notificar_uso after insert or delete on public.area_comun_incorporaciones
for each row execute function private.notificar_uso_area_comun();
revoke all on function private.notificar_uso_area_comun() from public,anon,authenticated,service_role;

-- Un antecedente conserva evidencia inmutable. Retirar el vínculo antes de convertirlo.
create function private.validar_categoria_receptor_comun() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.rol_version_plan='ANTECEDENTE' and old.rol_version_plan is distinct from new.rol_version_plan
    and exists(select 1 from public.area_comun_incorporaciones where plan_id=new.id) then
    raise exception 'Retira el vínculo de Área común antes de convertir el plan en antecedente' using errcode='23514';
  end if;
  return new;
end $$;
create trigger a_area_comun_antecedente_guard before update of rol_version_plan on public.planes_estudio
for each row execute function private.validar_categoria_receptor_comun();
revoke all on function private.validar_categoria_receptor_comun() from public,anon,authenticated,service_role;
