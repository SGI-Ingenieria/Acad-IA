begin;

select plan(8);

select is(
  (
    select count(*)::integer
    from storage.buckets
    where id in (
      'comentarios-adjuntos',
      'documentos-academicos',
      'documentos-oficiales',
      'learning-packages'
    )
      and name = id
  ),
  4,
  'existen todas las cubetas activas con su nombre canonico'
);

select is(
  (
    select count(*)::integer
    from storage.buckets
    where id in (
      'comentarios-adjuntos',
      'documentos-academicos',
      'documentos-oficiales',
      'learning-packages'
    )
      and public = false
  ),
  4,
  'las cubetas activas son privadas'
);

select is(
  (
    select file_size_limit
    from storage.buckets
    where id = 'comentarios-adjuntos'
  ),
  (25 * 1024 * 1024)::bigint,
  'los adjuntos de comentarios respetan el limite de 25 MiB'
);

select is(
  (
    select file_size_limit
    from storage.buckets
    where id = 'documentos-academicos'
  ),
  (20 * 1024 * 1024)::bigint,
  'los documentos academicos respetan el limite de 20 MiB'
);

select is(
  (
    select count(*)::integer
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname like 'comment_attachments_%'
  ),
  3,
  'los adjuntos conservan sus politicas de acceso'
);

select is(
  (
    select count(*)::integer
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname like 'documentos_academicos_%'
  ),
  3,
  'los documentos academicos conservan sus politicas de acceso'
);

select is(
  (
    select count(*)::integer
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname like 'learning_packages_storage_%'
  ),
  2,
  'los paquetes de aprendizaje conservan sus politicas de acceso'
);

select is(
  (
    select count(*)::integer
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname like 'official_plan_documents_%'
  ),
  4,
  'los documentos oficiales conservan sus politicas de acceso'
);

select * from finish();

rollback;
