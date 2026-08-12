begin;

\ir _fixtures_usuarios.inc

select plan(14);

select is(
  (
    select delete_rule
    from information_schema.referential_constraints
    where constraint_schema = 'public'
      and constraint_name = 'estructuras_asignatura_estructura_plan_id_fkey'
  ),
  'CASCADE',
  'la estructura de asignatura pertenece al ciclo de vida del paquete'
);

create temp table _paquetes_prueba (
  eliminable_id uuid,
  eliminable_hija_id uuid,
  usado_id uuid,
  usado_hija_id uuid,
  plan_id uuid,
  publicado_id uuid,
  protegido_id uuid
);

do $$
declare
  v_admin constant uuid := '90000000-0000-4000-8000-000000000001';
  v_eliminable public.estructuras_plan;
  v_eliminable_hija public.estructuras_asignatura;
  v_usado public.estructuras_plan;
  v_usado_hija public.estructuras_asignatura;
  v_publicado public.estructuras_plan;
  v_protegido public.estructuras_plan;
  v_plan public.planes_estudio;
  v_plan_protegido public.planes_estudio;
begin
  insert into public.estructuras_plan (
    nombre, tipo, definicion, autoridad_normativa, etiqueta_version,
    estado_publicacion, creado_por, actualizado_por
  ) values (
    'Paquete eliminable pgTAP', 'CURRICULAR', '{}'::jsonb, 'SEP/DGAIR',
    'prueba-eliminar', 'BORRADOR', v_admin, v_admin
  ) returning * into v_eliminable;

  insert into public.estructuras_asignatura (
    nombre, tipo, definicion, estructura_plan_id, creado_por, actualizado_por
  ) values (
    'Asignatura eliminable pgTAP', 'CURRICULAR', '{}'::jsonb,
    v_eliminable.id, v_admin, v_admin
  ) returning * into v_eliminable_hija;

  insert into public.estructuras_plan (
    nombre, tipo, definicion, autoridad_normativa, etiqueta_version,
    estado_publicacion, creado_por, actualizado_por
  ) values (
    'Paquete usado pgTAP', 'CURRICULAR', '{}'::jsonb, 'SEP/DGAIR',
    'prueba-archivar', 'BORRADOR', v_admin, v_admin
  ) returning * into v_usado;

  insert into public.estructuras_asignatura (
    nombre, tipo, definicion, estructura_plan_id, creado_por, actualizado_por
  ) values (
    'Asignatura usada pgTAP', 'CURRICULAR', '{}'::jsonb,
    v_usado.id, v_admin, v_admin
  ) returning * into v_usado_hija;

  insert into public.planes_estudio (
    carrera_id, estructura_id, fecha_inicio_imparticion, tipo_ciclo,
    numero_ciclos, semanas_por_ciclo, estado_actual_id, activo, tipo_origen,
    datos, creado_por, actualizado_por
  ) values (
    (select id from public.carreras limit 1), v_usado.id, '2026-08-01',
    'Semestre', 8, 16,
    (select id from public.estados_plan where clave = 'BORRADOR' limit 1),
    false, 'MANUAL', '{}'::jsonb, v_admin, v_admin
  ) returning * into v_plan;

  insert into public.estructuras_plan (
    nombre, tipo, definicion, autoridad_normativa, etiqueta_version,
    estado_publicacion, creado_por, actualizado_por
  ) values (
    'Último paquete vigente pgTAP', 'CURRICULAR', '{}'::jsonb, 'SEP/DGAIR',
    'prueba-protegido', 'BORRADOR', v_admin, v_admin
  ) returning * into v_protegido;

  insert into public.planes_estudio (
    carrera_id, estructura_id, fecha_inicio_imparticion, tipo_ciclo,
    numero_ciclos, semanas_por_ciclo, estado_actual_id, activo, tipo_origen,
    datos, creado_por, actualizado_por
  ) values (
    (select id from public.carreras limit 1), v_protegido.id, '2026-09-01',
    'Semestre', 8, 16,
    (select id from public.estados_plan where clave = 'BORRADOR' limit 1),
    false, 'MANUAL', '{}'::jsonb, v_admin, v_admin
  ) returning * into v_plan_protegido;

  select * into v_publicado
  from public.estructuras_plan
  where tipo = 'CURRICULAR'
    and estado_publicacion = 'PUBLICADA'
  limit 1;

  insert into public.estructuras_plan (
    nombre, tipo, definicion, autoridad_normativa, etiqueta_version,
    estado_publicacion, creado_por, actualizado_por
  ) values (
    'Paquete vigente de respaldo pgTAP', 'CURRICULAR', '{}'::jsonb,
    'SEP/DGAIR', 'prueba-respaldo', 'BORRADOR', v_admin, v_admin
  );

  insert into _paquetes_prueba values (
    v_eliminable.id, v_eliminable_hija.id,
    v_usado.id, v_usado_hija.id, v_plan.id, v_publicado.id, v_protegido.id
  );
end;
$$;

grant select on _paquetes_prueba to authenticated;

select throws_ok(
  $$ select public.retirar_paquete_curricular(
       (select eliminable_id from _paquetes_prueba)
     ) $$,
  '42501',
  'No puedes retirar paquetes curriculares',
  'retirar exige el permiso de catálogos'
);

select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', '90000000-0000-4000-8000-000000000001',
    'role', 'authenticated',
    'app_metadata', jsonb_build_object('roles_claves', jsonb_build_array('ADMIN'))
  )::text,
  true
);
set local role authenticated;

select is(
  public.retirar_paquete_curricular(
    (select eliminable_id from _paquetes_prueba)
  ),
  'ELIMINADO',
  'un borrador sin planes se elimina'
);

select is(
  (select count(*)::integer from public.estructuras_plan
   where id = (select eliminable_id from _paquetes_prueba)),
  0,
  'se elimina la raíz sin uso'
);

select is(
  (select count(*)::integer from public.estructuras_asignatura
   where id = (select eliminable_hija_id from _paquetes_prueba)),
  0,
  'se elimina en cascada la estructura de asignatura hija'
);

select is(
  public.retirar_paquete_curricular(
    (select usado_id from _paquetes_prueba)
  ),
  'ARCHIVADO',
  'un paquete usado se archiva'
);

select is(
  (select estado_publicacion::text from public.estructuras_plan
   where id = (select usado_id from _paquetes_prueba)),
  'ARCHIVADA',
  'el paquete usado conserva estado archivado'
);

select is(
  (select count(*)::integer from public.estructuras_asignatura
   where id = (select usado_hija_id from _paquetes_prueba)),
  1,
  'archivar conserva la estructura de asignatura hija'
);

select is(
  (select count(*)::integer from public.planes_estudio
   where id = (select plan_id from _paquetes_prueba)),
  1,
  'archivar conserva el plan que utiliza el paquete'
);

select is(
  public.retirar_paquete_curricular(
    (select publicado_id from _paquetes_prueba)
  ),
  'ARCHIVADO',
  'un paquete publicado se archiva para conservar su trazabilidad'
);

select is(
  (select estado_publicacion::text from public.estructuras_plan
   where id = (select publicado_id from _paquetes_prueba)),
  'ARCHIVADA',
  'la publicación solo cambia al estado archivado'
);

select is(
  public.retirar_paquete_curricular(
    (select usado_id from _paquetes_prueba)
  ),
  'ARCHIVADO',
  'retirar un paquete archivado es idempotente'
);

update public.estructuras_plan
set
  estado_publicacion = 'ARCHIVADA',
  actualizado_en = now(),
  actualizado_por = '90000000-0000-4000-8000-000000000001'
where id <> (select protegido_id from _paquetes_prueba)
  and tipo = 'CURRICULAR'
  and estado_publicacion not in ('ARCHIVADA', 'RETIRADA');

select is(
  public.evaluar_retiro_paquete_curricular(
    (select protegido_id from _paquetes_prueba)
  ),
  'BLOQUEADO',
  'la última estructura vigente usada no ofrece archivo'
);

select throws_ok(
  $$ select public.retirar_paquete_curricular(
       (select protegido_id from _paquetes_prueba)
     ) $$,
  '55000',
  'Debe permanecer al menos un paquete curricular vigente',
  'la base impide archivar la última estructura vigente'
);

rollback;
