drop view if exists "public"."plantilla_asignatura";

create or replace view "public"."plantilla_asignatura" as  SELECT asignaturas.id AS asignatura_id,
    struct.id AS estructura_id,
    struct.template_id
   FROM (public.asignaturas
     JOIN public.estructuras_asignatura struct ON ((asignaturas.estructura_id = struct.id)));



