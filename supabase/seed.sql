-- Acad-IA local/dev seed
-- Complementa seed.stage.sql con datos demo locales.

BEGIN;

SET LOCAL search_path = public, extensions;

INSERT INTO public.planes_estudio (
  id,
  carrera_id,
  estructura_id,
  nombre,
  tipo_ciclo,
  numero_ciclos,
  datos,
  estado_actual_id,
  activo,
  tipo_origen,
  meta_origen
) VALUES (
  '11111111-1111-4111-8111-111111111111',
  '8208da08-d549-4359-8865-9d806bc54f19',
  '69fb2b77-5a95-47e0-bf1f-389d384200e4',
  'Ingenieria en Cibernetica y Sistemas Computacionales 2026',
  'Semestre',
  8,
  $json$
  {
    "nombre_autorizado_de_la_institucion": "Universidad La Salle, A.C.",
    "nivel_y_nombre_del_plan_de_estudios": "Licenciatura en Ingenieria en Cibernetica y Sistemas Computacionales",
    "modalidad_educativa": "Escolar",
    "vigencia": null,
    "antecedente_academico": "Bachillerato concluido o equivalente.",
    "area_de_estudio": "Ingenieria, industria y construccion",
    "clave_del_plan_de_estudios": null,
    "diseno_curricular": "Flexible",
    "total_de_ciclos_del_plan_de_estudios": "8 semestres",
    "duracion_del_ciclo_escolar": "16 semanas",
    "carga_horaria_a_la_semana": 28,
    "fines_de_aprendizaje_o_formacion": "Formar profesionales capaces de analizar, disenar, construir y proteger sistemas computacionales integrados, con criterio etico, pensamiento sistemico y orientacion a la solucion de problemas reales.",
    "perfil_de_ingreso": "Aspirantes con bases de matematicas, logica, comunicacion escrita, curiosidad tecnologica y disposicion para el trabajo colaborativo.",
    "perfil_de_egreso": "La persona egresada disenara soluciones de software, redes y sistemas ciberfisicos; evaluara riesgos de seguridad; integrara datos para la toma de decisiones y comunicara resultados tecnicos a audiencias diversas.",
    "programa_de_investigacion": null,
    "curso_propedeutico": "Curso de induccion a herramientas digitales, pensamiento logico y vida universitaria.",
    "administracion_y_operatividad_del_plan_de_estudios": "El plan se organiza en ocho semestres con trayectos flexibles por linea curricular y asignaturas integradoras.",
    "sustento_teorico_del_modelo_curricular": "Modelo curricular orientado al desarrollo progresivo de competencias profesionales, aprendizaje situado e integracion interdisciplinaria.",
    "justificacion_de_la_propuesta_curricular": null,
    "propuesta_de_evaluacion_periodica_del_plan_de_estudios": "Revision bienal con evidencias de egreso, empleabilidad, seguimiento de tendencias tecnologicas y consulta a cuerpos colegiados.",
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
  ('11111111-1111-4111-8111-000000000001', '11111111-1111-4111-8111-111111111111', 'Area comun de ingenieria', 10, 'Basica', '#64748b'),
  ('11111111-1111-4111-8111-000000000002', '11111111-1111-4111-8111-111111111111', 'Matematicas y ciencias basicas', 20, 'Basica', '#2563eb'),
  ('11111111-1111-4111-8111-000000000003', '11111111-1111-4111-8111-111111111111', 'Programacion y sistemas', 30, 'Profesional', '#16a34a'),
  ('11111111-1111-4111-8111-000000000004', '11111111-1111-4111-8111-111111111111', 'Ciberseguridad', 40, 'Profesional', '#dc2626'),
  ('11111111-1111-4111-8111-000000000005', '11111111-1111-4111-8111-111111111111', 'Integracion profesional', 50, 'Integracion', '#7c3aed')
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
      'Matematicas para ingenieria',
      1,
      '11111111-1111-4111-8111-000000000002'::uuid,
      1,
      64,
      32,
      'Aplicar pensamiento algebraico, funciones y modelos matematicos para representar problemas iniciales de ingenieria.',
      'Resolucion guiada de problemas, laboratorios de modelacion y analisis de casos aplicados.',
      'Practica individual, lecturas dirigidas y elaboracion de ejercicios con retroalimentacion.',
      'Calculadora cientifica, hojas de calculo y entorno de graficacion.'
    ),
    (
      '22222222-2222-4222-8222-000000000002'::uuid,
      'CIB102',
      'Fundamentos de programacion',
      1,
      '11111111-1111-4111-8111-000000000003'::uuid,
      1,
      64,
      48,
      'Resolver problemas mediante algoritmos claros, estructuras de control y programas documentados.',
      'Talleres de codificacion, revision de ejercicios y desarrollo incremental de pequenos programas.',
      'Practica en repositorio, lectura de documentacion y depuracion de ejercicios.',
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
      'Seleccionar e implementar estructuras de datos de acuerdo con complejidad, memoria y claridad de diseno.',
      'Analisis de algoritmos, ejercicios en laboratorio y revision de soluciones comparadas.',
      'Implementacion de practicas, pruebas unitarias y estudio de complejidad.',
      'Lenguaje de programacion, repositorio Git y herramientas de pruebas.'
    ),
    (
      '22222222-2222-4222-8222-000000000004'::uuid,
      'CIB202',
      'Matematicas discretas',
      2,
      '11111111-1111-4111-8111-000000000002'::uuid,
      1,
      64,
      32,
      'Usar logica, conjuntos, grafos y conteo para fundamentar el razonamiento computacional.',
      'Discusion de demostraciones, ejercicios colaborativos y modelado de relaciones discretas.',
      'Resolucion de problemas, lectura de notas tecnicas y preparacion de evidencias.',
      'Editor matematico, simuladores de grafos y biblioteca digital.'
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
      'Explicar y configurar servicios de red considerando protocolos, direccionamiento y diagnostico basico.',
      'Practicas de laboratorio, trazas de paquetes y configuracion guiada de servicios.',
      'Bitacoras de practica, lectura de estandares y simulaciones de escenarios.',
      'Simulador de redes, analizador de paquetes y maquinas virtuales.'
    ),
    (
      '22222222-2222-4222-8222-000000000006'::uuid,
      'CIB302',
      'Seguridad informatica',
      3,
      '11111111-1111-4111-8111-000000000004'::uuid,
      1,
      48,
      48,
      'Identificar riesgos, controles y buenas practicas para proteger informacion y servicios digitales.',
      'Analisis de casos, laboratorios controlados y discusion de marcos de seguridad.',
      'Elaboracion de reportes, ejercicios de hardening y revision de guias tecnicas.',
      'Laboratorio aislado, escaneres autorizados y gestor de evidencias.'
    ),
    (
      '22222222-2222-4222-8222-000000000007'::uuid,
      'CIB401',
      'Ingenieria de software',
      4,
      '11111111-1111-4111-8111-000000000003'::uuid,
      1,
      48,
      64,
      'Planear, construir y evaluar software mediante practicas de requisitos, diseno, pruebas y gestion de proyecto.',
      'Talleres de arquitectura, revisiones de codigo y seguimiento de iteraciones.',
      'Desarrollo de proyecto, documentacion tecnica y preparacion de entregables.',
      'Repositorio, tablero de trabajo, integracion continua y herramientas de modelado.'
    ),
    (
      '22222222-2222-4222-8222-000000000008'::uuid,
      'CIB402',
      'Criptografia aplicada',
      4,
      '11111111-1111-4111-8111-000000000004'::uuid,
      1,
      48,
      48,
      'Aplicar conceptos criptograficos para proteger confidencialidad, integridad, autenticacion y no repudio.',
      'Resolucion de ejercicios, analisis de protocolos y practicas con bibliotecas criptograficas.',
      'Lecturas, implementacion de pruebas y analisis de fallas comunes.',
      'Bibliotecas criptograficas, terminal segura y cuadernos computacionales.'
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
      'Integrar diagnostico, diseno de controles y comunicacion ejecutiva en un proyecto de seguridad aplicado.',
      'Asesorias de proyecto, revisiones de avance y simulacion de presentacion profesional.',
      'Trabajo de proyecto, documentacion de evidencias y preparacion de defensa tecnica.',
      'Repositorio, herramientas de analisis autorizadas, tablero de proyecto y plataforma de presentacion.'
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
    'denominacion_de_la_asignatura_o_unidad_de_aprendizaje', nombre,
    'ciclo', numero_ciclo::text || ' semestre',
    'clave_de_la_asignatura', codigo,
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
        jsonb_build_object('nombre', 'Conceptos base y vocabulario tecnico', 'horasEstimadas', 12),
        jsonb_build_object('nombre', 'Problemas representativos de la asignatura', 'horasEstimadas', 12)
      )
    ),
    jsonb_build_object(
      'unidad', 2,
      'titulo', 'Aplicacion guiada',
      'temas', jsonb_build_array(
        jsonb_build_object('nombre', 'Metodos, herramientas y criterios de solucion', 'horasEstimadas', 16),
        jsonb_build_object('nombre', 'Practicas con retroalimentacion academica', 'horasEstimadas', 16)
      )
    ),
    jsonb_build_object(
      'unidad', 3,
      'titulo', 'Integracion',
      'temas', jsonb_build_array(
        jsonb_build_object('nombre', 'Caso integrador y comunicacion de resultados', 'horasEstimadas', 16)
      )
    )
  ),
  'MANUAL'::public.tipo_origen,
  '{"seed": "demo", "origen": "supabase/seed.sql"}'::jsonb,
  horas_academicas,
  horas_independientes,
  jsonb_build_array(
    jsonb_build_object('nombre', 'Evidencias y ejercicios', 'porcentaje', 30),
    jsonb_build_object('nombre', 'Practicas o laboratorio', 'porcentaje', 30),
    jsonb_build_object('nombre', 'Proyecto o caso integrador', 'porcentaje', 30),
    jsonb_build_object('nombre', 'Participacion academica', 'porcentaje', 10)
  )
FROM asignaturas_seed
ON CONFLICT DO NOTHING;

COMMIT;
