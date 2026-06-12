-- Almacena los datos estructurados del libro por separado de la cita ya
-- formateada. La `cita` se conserva como el valor mostrado/renderizado (el
-- documento SEP la usa tal cual); el navegador la regenera con citeproc a
-- partir de estos campos al crear o editar la referencia.

alter table "public"."bibliografia_asignatura"
  add column if not exists "titulo" text,
  add column if not exists "autores" jsonb not null default '[]'::jsonb,
  add column if not exists "editorial" text,
  add column if not exists "anio" integer,
  add column if not exists "isbn" text,
  add column if not exists "formato" text;

comment on column "public"."bibliografia_asignatura"."titulo" is
  'Título del libro/recurso (dato estructurado, fuente para regenerar la cita).';
comment on column "public"."bibliografia_asignatura"."autores" is
  'Arreglo JSON de autores, p. ej. ["Stewart, James"].';
comment on column "public"."bibliografia_asignatura"."editorial" is
  'Editorial del recurso.';
comment on column "public"."bibliografia_asignatura"."anio" is
  'Año de publicación.';
comment on column "public"."bibliografia_asignatura"."isbn" is
  'ISBN del recurso, si está disponible.';
comment on column "public"."bibliografia_asignatura"."formato" is
  'Formato usado para generar `cita` (apa, ieee, chicago, vancouver, manual).';
