create or replace view public.registros_oficiales_plan_detalle
with (security_invoker = true) as
select
  rop.id,
  rop.plan_estudio_id,
  rop.clave_sep,
  rop.numero_acuerdo,
  rop.autoridad,
  rop.fecha_aprobacion,
  rop.vigencia_inicio,
  rop.vigencia_fin,
  rop.documento_archivo_id,
  a.path as documento_archivo_path,
  rop.documento_bucket,
  rop.documento_path,
  rop.documento_nombre,
  rop.documento_mime,
  rop.documento_size,
  rop.documento_url,
  rop.observaciones,
  rop.registrado_por,
  rop.actualizado_por,
  rop.creado_en,
  rop.actualizado_en,
  pe.nombre_display as plan_nombre,
  pe.nombre as plan_nombre_legacy,
  pe.nombre_propuesto as plan_nombre_propuesto,
  pe.fecha_inicio_imparticion,
  e.clave as estado_clave,
  e.etiqueta as estado_etiqueta,
  e.color as estado_color,
  c.id as carrera_id,
  c.nombre as carrera_nombre,
  c.nombre_corto as carrera_nombre_corto,
  c.nivel as carrera_nivel,
  f.id as facultad_id,
  f.nombre as facultad_nombre,
  f.nombre_corto as facultad_nombre_corto,
  f.prefijo as facultad_prefijo,
  ua.nombre_completo as registrado_por_nombre,
  rop.anio_solicitud_rvoe
from public.registros_oficiales_plan rop
join public.planes_estudio pe on pe.id = rop.plan_estudio_id
left join public.estados_plan e on e.id = pe.estado_actual_id
left join public.carreras c on c.id = pe.carrera_id
left join public.facultades f on f.id = c.facultad_id
left join public.archivos a on a.id = rop.documento_archivo_id
left join public.usuarios_app ua on ua.id = rop.registrado_por;
