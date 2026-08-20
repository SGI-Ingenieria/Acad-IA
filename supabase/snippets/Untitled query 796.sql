select
  id,
  estado,
  evidencia->'documentos' as documentos
from importaciones_academicas
where id = '7bf94150-7e90-4248-8270-e0849b89a310';