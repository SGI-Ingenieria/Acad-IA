revoke delete on table "public"."vector_stores" from "anon";

revoke insert on table "public"."vector_stores" from "anon";

revoke references on table "public"."vector_stores" from "anon";

revoke select on table "public"."vector_stores" from "anon";

revoke trigger on table "public"."vector_stores" from "anon";

revoke truncate on table "public"."vector_stores" from "anon";

revoke update on table "public"."vector_stores" from "anon";

revoke delete on table "public"."vector_stores" from "authenticated";

revoke insert on table "public"."vector_stores" from "authenticated";

revoke references on table "public"."vector_stores" from "authenticated";

revoke select on table "public"."vector_stores" from "authenticated";

revoke trigger on table "public"."vector_stores" from "authenticated";

revoke truncate on table "public"."vector_stores" from "authenticated";

revoke update on table "public"."vector_stores" from "authenticated";

revoke delete on table "public"."vector_stores" from "service_role";

revoke insert on table "public"."vector_stores" from "service_role";

revoke references on table "public"."vector_stores" from "service_role";

revoke select on table "public"."vector_stores" from "service_role";

revoke trigger on table "public"."vector_stores" from "service_role";

revoke truncate on table "public"."vector_stores" from "service_role";

revoke update on table "public"."vector_stores" from "service_role";

alter table "public"."vector_stores" drop constraint "vector_stores_creado_por_fkey";

alter table "public"."vector_stores" drop constraint "vector_stores_pkey";

drop index if exists "public"."vector_stores_pkey";

drop table "public"."vector_stores";

alter table "public"."archivos" enable row level security;

alter table "public"."archivos_repositorios" enable row level security;

alter table "public"."asignatura_mensajes_ia" enable row level security;

alter table "public"."asignaturas" enable row level security;

alter table "public"."bibliografia_asignatura" enable row level security;

alter table "public"."cambios_asignatura" enable row level security;

alter table "public"."cambios_plan" enable row level security;

alter table "public"."carreras" enable row level security;

alter table "public"."conversaciones_asignatura" enable row level security;

alter table "public"."conversaciones_plan" enable row level security;

alter table "public"."estados_plan" enable row level security;

alter table "public"."estructuras_asignatura" enable row level security;

alter table "public"."estructuras_plan" enable row level security;

alter table "public"."facultades" enable row level security;

alter table "public"."interacciones_ia" enable row level security;

alter table "public"."lineas_plan" enable row level security;

alter table "public"."notificaciones" enable row level security;

alter table "public"."plan_mensajes_ia" enable row level security;

alter table "public"."planes_estudio" enable row level security;

alter table "public"."repositorios" enable row level security;

alter table "public"."responsables_asignatura" enable row level security;

alter table "public"."roles" enable row level security;

alter table "public"."tareas_revision" enable row level security;

alter table "public"."transiciones_estado_plan" enable row level security;

alter table "public"."usuarios_app" add column "dado_de_baja_en" timestamp with time zone;

alter table "public"."usuarios_app" enable row level security;

alter table "public"."usuarios_roles" enable row level security;

alter table "public"."usuarios_app" add constraint "usuarios_app_id_fkey" FOREIGN KEY (id) REFERENCES auth.users(id) ON UPDATE CASCADE ON DELETE CASCADE not valid;

alter table "public"."usuarios_app" validate constraint "usuarios_app_id_fkey";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$
  declare
    original_claims jsonb;
    new_claims jsonb;
    claim text;
  begin
    original_claims = event->'claims';
    new_claims = '{}'::jsonb;

    foreach claim in array array[
      -- add claims you want to keep here
      'iss',
      'aud',
      'exp',
      'iat',
      'sub',
      'role',
      'aal',
      'session_id',
      'email',
      'phone',
      'is_anonymous'
   ] loop
      if original_claims ? claim then
        -- original_claims contains one of the listed claims, set it on new_claims
        new_claims = jsonb_set(new_claims, array[claim], original_claims->claim);
      end if;
    end loop;

    return jsonb_build_object('claims', new_claims);
  end
$function$
;


  create policy "policy_name"
  on "public"."archivos"
  as permissive
  for all
  to public
using (true);



  create policy "policy_name"
  on "public"."archivos_repositorios"
  as permissive
  for all
  to public
using (true);



  create policy "policy_name"
  on "public"."asignatura_mensajes_ia"
  as permissive
  for all
  to public
using (true);



  create policy "policy_name"
  on "public"."asignaturas"
  as permissive
  for all
  to public
using (true);



  create policy "policy_name"
  on "public"."bibliografia_asignatura"
  as permissive
  for all
  to public
using (true);



  create policy "policy_name"
  on "public"."cambios_asignatura"
  as permissive
  for all
  to public
using (true);



  create policy "policy_name"
  on "public"."cambios_plan"
  as permissive
  for all
  to public
using (true);



  create policy "policy_name"
  on "public"."carreras"
  as permissive
  for all
  to public
using (true);



  create policy "policy_name"
  on "public"."conversaciones_asignatura"
  as permissive
  for all
  to public
using (true);



  create policy "policy_name"
  on "public"."conversaciones_plan"
  as permissive
  for all
  to public
using (true);



  create policy "policy_name"
  on "public"."estados_plan"
  as permissive
  for all
  to public
using (true);



  create policy "policy_name"
  on "public"."estructuras_asignatura"
  as permissive
  for all
  to public
using (true);



  create policy "policy_name"
  on "public"."estructuras_plan"
  as permissive
  for all
  to public
using (true);



  create policy "policy_name"
  on "public"."facultades"
  as permissive
  for all
  to public
using (true);



  create policy "policy_name"
  on "public"."interacciones_ia"
  as permissive
  for all
  to public
using (true);



  create policy "policy_name"
  on "public"."lineas_plan"
  as permissive
  for all
  to public
using (true);



  create policy "policy_name"
  on "public"."notificaciones"
  as permissive
  for all
  to public
using (true);



  create policy "policy_name"
  on "public"."plan_mensajes_ia"
  as permissive
  for all
  to public
using (true);



  create policy "Enable read access for all users"
  on "public"."planes_estudio"
  as permissive
  for all
  to public
using (true)
with check (true);



  create policy "policy_name"
  on "public"."planes_estudio"
  as permissive
  for all
  to public
using (true);



  create policy "policy_name"
  on "public"."repositorios"
  as permissive
  for all
  to public
using (true);



  create policy "policy_name"
  on "public"."responsables_asignatura"
  as permissive
  for all
  to public
using (true);



  create policy "policy_name"
  on "public"."roles"
  as permissive
  for all
  to public
using (true);



  create policy "policy_name"
  on "public"."tareas_revision"
  as permissive
  for all
  to public
using (true);



  create policy "policy_name"
  on "public"."transiciones_estado_plan"
  as permissive
  for all
  to public
using (true);



  create policy "policy_name"
  on "public"."usuarios_app"
  as permissive
  for all
  to public
using (true);



  create policy "policy_name"
  on "public"."usuarios_roles"
  as permissive
  for all
  to public
using (true);



