alter table "public"."repositorios" add column if not exists "enviado_por" uuid;

alter table "public"."repositorios" alter column "openai_vector_store_id" set data type text using "openai_vector_store_id"::text;


