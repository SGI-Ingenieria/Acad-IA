-- Imágenes didácticas generadas para actividades interactivas. El bucket es
-- público porque los paquetes SCORM se consumen fuera de la sesión de Acad-IA.
insert into storage.buckets (id, name, public)
values ('learning-media', 'learning-media', true)
on conflict (id) do update set public = true;
