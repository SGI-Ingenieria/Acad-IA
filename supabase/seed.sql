-- Acad-IA local/dev seed
-- Complementa a seed.stage.sql con datos demo locales.

BEGIN;

SET LOCAL search_path = public, extensions;

INSERT INTO public.planes_estudio (
  id,
  carrera_id,
  estructura_id,
  nombre,
  nombre_propuesto,
  fecha_inicio_imparticion,
  tipo_ciclo,
  numero_ciclos,
  semanas_por_ciclo,
  etiqueta_version,
  datos,
  estado_actual_id,
  activo,
  tipo_origen,
  meta_origen
) VALUES (
  '11111111-1111-4111-8111-111111111111',
  '8208da08-d549-4359-8865-9d806bc54f19',
  '69fb2b77-5a95-47e0-bf1f-389d384200e4',
  null,
  null,
  '2026-08-01',
  'Semestre',
  8,
  16,
  '2026',
  $json$
  {
    "nombre_autorizado_de_la_institucion": "Universidad La Salle, A.C.",
    "modalidad_educativa": "Escolar",
    "antecedente_academico": "Bachillerato concluido o equivalente.",
    "area_de_estudio": "Ingeniería, industria y construcción",
    "diseno_curricular": "Flexible",
    "carga_horaria_a_la_semana": 28,
    "fines_de_aprendizaje_o_formacion": "Formar profesionales capaces de analizar, diseñar, construir y proteger sistemas computacionales integrados, con criterio ético, pensamiento sistémico y orientación a la solución de problemas reales.",
    "perfil_de_ingreso": "Aspirantes con bases de matemáticas, lógica, comunicación escrita, curiosidad tecnológica y disposición para el trabajo colaborativo.",
    "perfil_de_egreso": "La persona egresada diseñará soluciones de software, redes y sistemas ciberfísicos; evaluará riesgos de seguridad; integrará datos para la toma de decisiones y comunicará resultados técnicos a audiencias diversas.",
    "programa_de_investigacion": null,
    "curso_propedeutico": "Curso de inducción a herramientas digitales, pensamiento lógico y vida universitaria.",
    "administracion_y_operatividad_del_plan_de_estudios": "El plan se organiza en ocho semestres con trayectos flexibles por línea curricular y asignaturas integradoras.",
    "sustento_teorico_del_modelo_curricular": "Modelo curricular orientado al desarrollo progresivo de competencias profesionales, aprendizaje situado e integración interdisciplinaria.",
    "justificacion_de_la_propuesta_curricular": null,
    "propuesta_de_evaluacion_periodica_del_plan_de_estudios": "Revisión bienal con evidencias de egreso, empleabilidad, seguimiento de tendencias tecnológicas y consulta a cuerpos colegiados.",
    "nombre_y_cargo_de_la_persona_facultada_para_autorizar_el_plan_de_estudios": null
  }
  $json$::jsonb,
  (SELECT id FROM public.estados_plan WHERE clave = 'BORRADOR'),
  true,
  'MANUAL',
  '{"seed": "demo", "origen": "supabase/seed.sql"}'::jsonb
)
ON CONFLICT DO NOTHING;

INSERT INTO public.lineas_plan (
  id,
  plan_estudio_id,
  nombre,
  orden,
  area,
  color
) VALUES
  ('11111111-1111-4111-8111-000000000001', '11111111-1111-4111-8111-111111111111', 'Área común de ingeniería', 10, 'Básica', '#64748b'),
  ('11111111-1111-4111-8111-000000000002', '11111111-1111-4111-8111-111111111111', 'Matemáticas y ciencias básicas', 20, 'Básica', '#2563eb'),
  ('11111111-1111-4111-8111-000000000003', '11111111-1111-4111-8111-111111111111', 'Programación y sistemas', 30, 'Profesional', '#16a34a'),
  ('11111111-1111-4111-8111-000000000004', '11111111-1111-4111-8111-111111111111', 'Ciberseguridad', 40, 'Profesional', '#dc2626'),
  ('11111111-1111-4111-8111-000000000005', '11111111-1111-4111-8111-111111111111', 'Integración profesional', 50, 'Integración', '#7c3aed')
ON CONFLICT DO NOTHING;

WITH asignaturas_seed (
  id,
  codigo,
  nombre,
  numero_ciclo,
  linea_plan_id,
  orden_celda,
  horas_academicas,
  horas_independientes,
  fines,
  conduccion,
  independientes,
  tecnologia
) AS (
  VALUES
    (
      '22222222-2222-4222-8222-000000000001'::uuid,
      'CIB101',
      'Matemáticas para ingeniería',
      1,
      '11111111-1111-4111-8111-000000000002'::uuid,
      1,
      64,
      32,
      'Aplicar pensamiento algebraico, funciones y modelos matemáticos para representar problemas iniciales de ingeniería.',
      'Resolución guiada de problemas, laboratorios de modelación y análisis de casos aplicados.',
      'Práctica individual, lecturas dirigidas y elaboración de ejercicios con retroalimentación.',
      'Calculadora científica, hojas de cálculo y entorno de graficación.'
    ),
    (
      '22222222-2222-4222-8222-000000000002'::uuid,
      'CIB102',
      'Fundamentos de programación',
      1,
      '11111111-1111-4111-8111-000000000003'::uuid,
      1,
      64,
      48,
      'Resolver problemas mediante algoritmos claros, estructuras de control y programas documentados.',
      'Talleres de codificación, revisión de ejercicios y desarrollo incremental de pequeños programas.',
      'Práctica en repositorio, lectura de documentación y depuración de ejercicios.',
      'Entorno de desarrollo, control de versiones y plataforma de entrega.'
    ),
    (
      '22222222-2222-4222-8222-000000000003'::uuid,
      'CIB201',
      'Estructuras de datos',
      2,
      '11111111-1111-4111-8111-000000000003'::uuid,
      1,
      64,
      48,
      'Seleccionar e implementar estructuras de datos de acuerdo con complejidad, memoria y claridad de diseño.',
      'Análisis de algoritmos, ejercicios en laboratorio y revisión de soluciones comparadas.',
      'Implementación de prácticas, pruebas unitarias y estudio de complejidad.',
      'Lenguaje de programación, repositorio Git y herramientas de pruebas.'
    ),
    (
      '22222222-2222-4222-8222-000000000004'::uuid,
      'CIB202',
      'Matemáticas discretas',
      2,
      '11111111-1111-4111-8111-000000000002'::uuid,
      1,
      64,
      32,
      'Usar lógica, conjuntos, grafos y conteo para fundamentar el razonamiento computacional.',
      'Discusión de demostraciones, ejercicios colaborativos y modelado de relaciones discretas.',
      'Resolución de problemas, lectura de notas técnicas y preparación de evidencias.',
      'Editor matemático, simuladores de grafos y biblioteca digital.'
    ),
    (
      '22222222-2222-4222-8222-000000000005'::uuid,
      'CIB301',
      'Redes de computadoras',
      3,
      '11111111-1111-4111-8111-000000000003'::uuid,
      1,
      48,
      48,
      'Explicar y configurar servicios de red considerando protocolos, direccionamiento y diagnóstico básico.',
      'Prácticas de laboratorio, trazas de paquetes y configuración guiada de servicios.',
      'Bitácoras de práctica, lectura de estándares y simulaciones de escenarios.',
      'Simulador de redes, analizador de paquetes y máquinas virtuales.'
    ),
    (
      '22222222-2222-4222-8222-000000000006'::uuid,
      'CIB302',
      'Seguridad informática',
      3,
      '11111111-1111-4111-8111-000000000004'::uuid,
      1,
      48,
      48,
      'Identificar riesgos, controles y buenas prácticas para proteger información y servicios digitales.',
      'Análisis de casos, laboratorios controlados y discusión de marcos de seguridad.',
      'Elaboración de reportes, ejercicios de hardening y revisión de guías técnicas.',
      'Laboratorio aislado, escáneres autorizados y gestor de evidencias.'
    ),
    (
      '22222222-2222-4222-8222-000000000007'::uuid,
      'CIB401',
      'Ingeniería de software',
      4,
      '11111111-1111-4111-8111-000000000003'::uuid,
      1,
      48,
      64,
      'Planear, construir y evaluar software mediante prácticas de requisitos, diseño, pruebas y gestión de proyecto.',
      'Talleres de arquitectura, revisiones de código y seguimiento de iteraciones.',
      'Desarrollo de proyecto, documentación técnica y preparación de entregables.',
      'Repositorio, tablero de trabajo, integración continua y herramientas de modelado.'
    ),
    (
      '22222222-2222-4222-8222-000000000008'::uuid,
      'CIB402',
      'Criptografía aplicada',
      4,
      '11111111-1111-4111-8111-000000000004'::uuid,
      1,
      48,
      48,
      'Aplicar conceptos criptográficos para proteger confidencialidad, integridad, autenticación y no repudio.',
      'Resolución de ejercicios, análisis de protocolos y prácticas con bibliotecas criptográficas.',
      'Lecturas, implementación de pruebas y análisis de fallas comunes.',
      'Bibliotecas criptográficas, terminal segura y cuadernos computacionales.'
    ),
    (
      '22222222-2222-4222-8222-000000000009'::uuid,
      'CIB701',
      'Proyecto integrador de ciberseguridad',
      7,
      '11111111-1111-4111-8111-000000000005'::uuid,
      1,
      32,
      96,
      'Integrar diagnóstico, diseño de controles y comunicación ejecutiva en un proyecto de seguridad aplicado.',
      'Asesorías de proyecto, revisiones de avance y simulación de presentación profesional.',
      'Trabajo de proyecto, documentación de evidencias y preparación de defensa técnica.',
      'Repositorio, herramientas de análisis autorizadas, tablero de proyecto y plataforma de presentación.'
    )
)
INSERT INTO public.asignaturas (
  id,
  plan_estudio_id,
  estructura_id,
  codigo,
  nombre,
  tipo,
  numero_ciclo,
  linea_plan_id,
  orden_celda,
  datos,
  contenido_tematico,
  tipo_origen,
  meta_origen,
  horas_academicas,
  horas_independientes,
  criterios_de_evaluacion
)
SELECT
  id,
  '11111111-1111-4111-8111-111111111111'::uuid,
  '7856e9cc-9ac1-4a31-b93a-0624d4c5e1de'::uuid,
  codigo,
  nombre,
  'OBLIGATORIA'::public.tipo_asignatura,
  numero_ciclo,
  linea_plan_id,
  orden_celda,
  jsonb_build_object(
    'fines_de_aprendizaje_o_formacion', fines,
    'actividades_de_aprendizaje_bajo_conduccion_de_un_academico', conduccion,
    'actividades_de_aprendizaje_independientes', independientes,
    'modalidades_tecnologicas_e_informaticas', tecnologia
  ),
  jsonb_build_array(
    jsonb_build_object(
      'unidad', 1,
      'titulo', 'Fundamentos',
      'temas', jsonb_build_array(
        jsonb_build_object('nombre', 'Conceptos base y vocabulario técnico', 'horasEstimadas', 12),
        jsonb_build_object('nombre', 'Problemas representativos de la asignatura', 'horasEstimadas', 12)
      )
    ),
    jsonb_build_object(
      'unidad', 2,
      'titulo', 'Aplicación guiada',
      'temas', jsonb_build_array(
        jsonb_build_object('nombre', 'Métodos, herramientas y criterios de solución', 'horasEstimadas', 16),
        jsonb_build_object('nombre', 'Prácticas con retroalimentación académica', 'horasEstimadas', 16)
      )
    ),
    jsonb_build_object(
      'unidad', 3,
      'titulo', 'Integración',
      'temas', jsonb_build_array(
        jsonb_build_object('nombre', 'Caso integrador y comunicación de resultados', 'horasEstimadas', 16)
      )
    )
  ),
  'MANUAL'::public.tipo_origen,
  '{"seed": "demo", "origen": "supabase/seed.sql"}'::jsonb,
  horas_academicas,
  horas_independientes,
  jsonb_build_array(
    jsonb_build_object('nombre', 'Evidencias y ejercicios', 'porcentaje', 30),
    jsonb_build_object('nombre', 'Prácticas o laboratorio', 'porcentaje', 30),
    jsonb_build_object('nombre', 'Proyecto o caso integrador', 'porcentaje', 30),
    jsonb_build_object('nombre', 'Participación académica', 'porcentaje', 10)
  )
FROM asignaturas_seed
ON CONFLICT DO NOTHING;

COMMIT;
