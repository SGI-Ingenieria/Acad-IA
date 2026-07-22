-- Retiro de los repositorios legacy (vector stores manuales de OpenAI).
-- El retrieval de referencias vive ahora en la biblioteca documental con su
-- caché de vector stores por selección (vector_store_selecciones).
--
-- La tabla `archivos` NO se elimina: los registros oficiales de plan
-- (registros_oficiales_plan.documento_archivo_id) dependen de ella y ese
-- flujo se conserva. Queda como registro de documentos oficiales.
--
-- El bucket `ai-storage` deja de recibir escrituras desde este despliegue;
-- sus objetos huérfanos se depuran manualmente (no en una migración, para no
-- borrar binarios de forma irreversible junto con un cambio de esquema).

drop table if exists public.archivos_repositorios;
drop table if exists public.repositorios;

comment on table public.archivos is
  'Registro de documentos oficiales de plan (bucket documentos-oficiales). Las referencias de IA viven en files/file_blobs.';
