-- Estructura de ciclos: duración en semanas y valores por omisión por carrera.
--
-- Hasta ahora «cuántos ciclos y de qué tipo» se derivaba de una tabla de
-- constantes por nivel dentro del cliente (Licenciatura → 9 semestres,
-- Maestría → 6 cuatrimestres). Cada carrera que no seguía la norma general se
-- corregía a mano en cada creación y la corrección no dejaba memoria: la
-- generación siguiente volvía a empezar mal. La regla pasa al catálogo, junto
-- al resto de la identidad de la carrera, que es donde se puede mantener.
--
-- `semanas_por_ciclo` se añade porque un ciclo de tipo «Otro» no dice nada por
-- sí mismo: sin su duración no se puede calcular la carga horaria del plan ni
-- compararlo con otro. Queda anulable —y sin obligarla en la base— porque los
-- planes ya registrados no la tienen y forzarla bloquearía editarlos; el
-- asistente la exige al crear, que es donde el dato sí se conoce.

alter table public.carreras
  add column if not exists tipo_ciclo_default public.tipo_ciclo,
  add column if not exists ciclos_default integer,
  add column if not exists semanas_por_ciclo_default integer;

comment on column public.carreras.tipo_ciclo_default is
  'Tipo de ciclo que el asistente propone al crear un plan de esta carrera. Nulo = usar la convención del nivel.';
comment on column public.carreras.ciclos_default is
  'Número de ciclos que el asistente propone al crear un plan de esta carrera. Nulo = usar la convención del nivel.';
comment on column public.carreras.semanas_por_ciclo_default is
  'Semanas que dura cada ciclo de esta carrera. Sólo se pregunta cuando el tipo de ciclo es «Otro».';

alter table public.carreras
  drop constraint if exists carreras_ciclos_default_check;
alter table public.carreras
  add constraint carreras_ciclos_default_check
  check (ciclos_default is null or (ciclos_default between 1 and 99));

alter table public.carreras
  drop constraint if exists carreras_semanas_por_ciclo_default_check;
alter table public.carreras
  add constraint carreras_semanas_por_ciclo_default_check
  check (semanas_por_ciclo_default is null or (semanas_por_ciclo_default between 1 and 104));

alter table public.planes_estudio
  add column if not exists semanas_por_ciclo integer;

comment on column public.planes_estudio.semanas_por_ciclo is
  'Duración de cada ciclo en semanas. Se captura cuando el tipo de ciclo es «Otro», donde el nombre del ciclo no implica una duración conocida.';

alter table public.planes_estudio
  drop constraint if exists planes_estudio_semanas_por_ciclo_check;
alter table public.planes_estudio
  add constraint planes_estudio_semanas_por_ciclo_check
  check (semanas_por_ciclo is null or (semanas_por_ciclo between 1 and 104));

-- El registro de cambios del plan pasa a incluir la nueva columna: la duración
-- del ciclo altera la carga horaria de todas las asignaturas, así que cambiarla
-- sin dejar rastro rompería la trazabilidad del plan.

CREATE OR REPLACE FUNCTION public.fn_log_cambios_planes_estudio()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'auth', 'extensions', 'pg_temp'
AS $function$
DECLARE
  k text;
  old_val jsonb;
  new_val jsonb;
  v_response_id text := NULL;
  v_actor uuid;
  v_override boolean := false;
  v_motivo text := NULL;
  v_estado text := NULL;
BEGIN
  IF tg_op <> 'DELETE' THEN
    v_response_id := NULLIF(new.meta_origen->>'response_id', '');
  END IF;

  v_actor := CASE
    WHEN tg_op = 'INSERT' THEN new.creado_por
    WHEN tg_op = 'DELETE' THEN old.actualizado_por
    ELSE new.actualizado_por
  END;

  SELECT a.admin_override, a.motivo, a.estado_clave
  INTO v_override, v_motivo, v_estado
  FROM public.authz_admin_override_audit(CASE WHEN tg_op = 'DELETE' THEN old.id ELSE new.id END) a;

  IF tg_op = 'INSERT' THEN
    INSERT INTO public.cambios_plan (
      plan_estudio_id, cambiado_por, tipo, campo, valor_anterior, valor_nuevo,
      response_id, admin_override, admin_override_motivo, admin_override_estado_clave
    )
    VALUES (
      new.id, v_actor, 'CREACION'::public.tipo_cambio, NULL, NULL, to_jsonb(new),
      NULL, v_override, v_motivo, v_estado
    );
    RETURN new;
  END IF;

  IF tg_op = 'DELETE' THEN
    INSERT INTO public.cambios_plan (
      plan_estudio_id, cambiado_por, tipo, campo, valor_anterior, valor_nuevo,
      response_id, admin_override, admin_override_motivo, admin_override_estado_clave
    )
    VALUES (
      old.id, v_actor, 'OTRO'::public.tipo_cambio, 'DELETE', to_jsonb(old), NULL,
      NULL, v_override, v_motivo, v_estado
    );
    RETURN old;
  END IF;

  IF (new.estado_actual_id IS DISTINCT FROM old.estado_actual_id) THEN
    INSERT INTO public.cambios_plan (
      plan_estudio_id, cambiado_por, tipo, campo, valor_anterior, valor_nuevo,
      response_id, admin_override, admin_override_motivo, admin_override_estado_clave
    )
    VALUES (
      new.id, v_actor, 'TRANSICION_ESTADO'::public.tipo_cambio, 'estado_actual_id',
      to_jsonb(old.estado_actual_id), to_jsonb(new.estado_actual_id),
      NULL, v_override, v_motivo, v_estado
    );
  END IF;

  IF (new.datos IS DISTINCT FROM old.datos) THEN
    FOR k IN
      SELECT DISTINCT key
      FROM (
        SELECT jsonb_object_keys(coalesce(old.datos, '{}'::jsonb)) AS key
        UNION ALL
        SELECT jsonb_object_keys(coalesce(new.datos, '{}'::jsonb)) AS key
      ) t
    LOOP
      old_val := coalesce(old.datos, '{}'::jsonb) -> k;
      new_val := coalesce(new.datos, '{}'::jsonb) -> k;

      IF (old_val IS DISTINCT FROM new_val) THEN
        INSERT INTO public.cambios_plan (
          plan_estudio_id, cambiado_por, tipo, campo, valor_anterior, valor_nuevo,
          response_id, admin_override, admin_override_motivo, admin_override_estado_clave
        )
        VALUES (
          new.id, v_actor, 'ACTUALIZACION_CAMPO'::public.tipo_cambio, k,
          old_val, new_val, v_response_id, v_override, v_motivo, v_estado
        );
      END IF;
    END LOOP;
  END IF;

  IF (new.nombre IS DISTINCT FROM old.nombre) THEN
    INSERT INTO public.cambios_plan (plan_estudio_id, cambiado_por, tipo, campo, valor_anterior, valor_nuevo, response_id, admin_override, admin_override_motivo, admin_override_estado_clave)
    VALUES (new.id, v_actor, 'ACTUALIZACION'::public.tipo_cambio, 'nombre', to_jsonb(old.nombre), to_jsonb(new.nombre), NULL, v_override, v_motivo, v_estado);
  END IF;

  IF (new.tipo_ciclo IS DISTINCT FROM old.tipo_ciclo) THEN
    INSERT INTO public.cambios_plan (plan_estudio_id, cambiado_por, tipo, campo, valor_anterior, valor_nuevo, response_id, admin_override, admin_override_motivo, admin_override_estado_clave)
    VALUES (new.id, v_actor, 'ACTUALIZACION'::public.tipo_cambio, 'tipo_ciclo', to_jsonb(old.tipo_ciclo), to_jsonb(new.tipo_ciclo), NULL, v_override, v_motivo, v_estado);
  END IF;

  IF (new.numero_ciclos IS DISTINCT FROM old.numero_ciclos) THEN
    INSERT INTO public.cambios_plan (plan_estudio_id, cambiado_por, tipo, campo, valor_anterior, valor_nuevo, response_id, admin_override, admin_override_motivo, admin_override_estado_clave)
    VALUES (new.id, v_actor, 'ACTUALIZACION'::public.tipo_cambio, 'numero_ciclos', to_jsonb(old.numero_ciclos), to_jsonb(new.numero_ciclos), NULL, v_override, v_motivo, v_estado);
  END IF;

  IF (new.semanas_por_ciclo IS DISTINCT FROM old.semanas_por_ciclo) THEN
    INSERT INTO public.cambios_plan (plan_estudio_id, cambiado_por, tipo, campo, valor_anterior, valor_nuevo, response_id, admin_override, admin_override_motivo, admin_override_estado_clave)
    VALUES (new.id, v_actor, 'ACTUALIZACION'::public.tipo_cambio, 'semanas_por_ciclo', to_jsonb(old.semanas_por_ciclo), to_jsonb(new.semanas_por_ciclo), NULL, v_override, v_motivo, v_estado);
  END IF;

  IF (new.activo IS DISTINCT FROM old.activo) THEN
    INSERT INTO public.cambios_plan (plan_estudio_id, cambiado_por, tipo, campo, valor_anterior, valor_nuevo, response_id, admin_override, admin_override_motivo, admin_override_estado_clave)
    VALUES (new.id, v_actor, 'ACTUALIZACION'::public.tipo_cambio, 'activo', to_jsonb(old.activo), to_jsonb(new.activo), NULL, v_override, v_motivo, v_estado);
  END IF;

  IF (new.carrera_id IS DISTINCT FROM old.carrera_id) THEN
    INSERT INTO public.cambios_plan (plan_estudio_id, cambiado_por, tipo, campo, valor_anterior, valor_nuevo, response_id, admin_override, admin_override_motivo, admin_override_estado_clave)
    VALUES (new.id, v_actor, 'ACTUALIZACION'::public.tipo_cambio, 'carrera_id', to_jsonb(old.carrera_id), to_jsonb(new.carrera_id), NULL, v_override, v_motivo, v_estado);
  END IF;

  IF (new.estructura_id IS DISTINCT FROM old.estructura_id) THEN
    INSERT INTO public.cambios_plan (plan_estudio_id, cambiado_por, tipo, campo, valor_anterior, valor_nuevo, response_id, admin_override, admin_override_motivo, admin_override_estado_clave)
    VALUES (new.id, v_actor, 'ACTUALIZACION'::public.tipo_cambio, 'estructura_id', to_jsonb(old.estructura_id), to_jsonb(new.estructura_id), NULL, v_override, v_motivo, v_estado);
  END IF;

  IF (new.tipo_origen IS DISTINCT FROM old.tipo_origen) THEN
    INSERT INTO public.cambios_plan (plan_estudio_id, cambiado_por, tipo, campo, valor_anterior, valor_nuevo, response_id, admin_override, admin_override_motivo, admin_override_estado_clave)
    VALUES (new.id, v_actor, 'ACTUALIZACION'::public.tipo_cambio, 'tipo_origen', to_jsonb(old.tipo_origen), to_jsonb(new.tipo_origen), NULL, v_override, v_motivo, v_estado);
  END IF;

  IF v_response_id IS NOT NULL THEN
    new.meta_origen := new.meta_origen - 'response_id';
  END IF;

  RETURN new;
END;
$function$

;
