-- La consolidacion conservo las politicas sobre storage.objects, pero omitio
-- las filas de storage.buckets que materializan las cubetas activas.
-- Se reparan de forma idempotente sin reemplazar restricciones MIME que ya
-- pudieran estar configuradas en un entorno desplegado.

insert into storage.buckets (id, name, public)
values
  ('comentarios-adjuntos', 'comentarios-adjuntos', false),
  ('documentos-academicos', 'documentos-academicos', false),
  ('documentos-oficiales', 'documentos-oficiales', false),
  ('learning-packages', 'learning-packages', false)
on conflict (id) do update
set
  name = excluded.name,
  public = excluded.public;

-- Estos limites ya forman parte de las validaciones del producto. Mantenerlos
-- tambien en Storage evita que una llamada directa eluda el limite de la UI o
-- de la funcion documental.
update storage.buckets
set file_size_limit = 25 * 1024 * 1024
where id = 'comentarios-adjuntos';

update storage.buckets
set file_size_limit = 20 * 1024 * 1024
where id = 'documentos-academicos';
