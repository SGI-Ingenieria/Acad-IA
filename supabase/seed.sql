-- Acad-IA local/dev seed
-- Complementa a seed.stage.sql con datos demo locales

BEGIN;

SET LOCAL search_path = public, extensions;

-- ---------------------------------------------------------------------------
-- Administradores de preview
-- ---------------------------------------------------------------------------
-- Esta semilla sólo se aplica a entornos locales y branches de preview. Las
-- cuentas internas siguen validando su contraseña institucional mediante NTLM;
-- el hash local únicamente permite que GoTrue mantenga una identidad completa.
-- La cuenta externa usa su correo como contraseña inicial de preview.

WITH preview_admins (
  id,
  email,
  password_seed,
  nombre_completo,
  clave,
  user_type,
  auth_provider
) AS (
  VALUES
    (
      'ad017045-0000-4000-8000-000000000001'::uuid,
      'alejandro.rosales@lasalle.mx',
      'Preview-internal-ad017045-not-for-login',
      'Alejandro Rosales',
      'ad017045',
      'internal',
      'ulsa_ntlm'
    ),
    (
      'ad011538-0000-4000-8000-000000000002'::uuid,
      'javier.garrido@lasalle.mx',
      'Preview-internal-ad011538-not-for-login',
      'Javier Garrido',
      'ad011538',
      'internal',
      'ulsa_ntlm'
    ),
    (
      'b067e470-51a5-4f15-9000-000000000003'::uuid,
      'roberto.silva@lasalle.mx',
      'roberto.silva@lasalle.mx',
      'Roberto Silva',
      NULL,
      'external',
      'password'
    )
)
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  confirmation_token,
  recovery_token,
  email_change_token_new,
  email_change,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
SELECT
  '00000000-0000-0000-0000-000000000000'::uuid,
  preview_admins.id,
  'authenticated',
  'authenticated',
  preview_admins.email,
  extensions.crypt(
    preview_admins.password_seed,
    extensions.gen_salt('bf')
  ),
  now(),
  '',
  '',
  '',
  '',
  jsonb_build_object(
    'provider', 'email',
    'providers', jsonb_build_array('email'),
    'user_type', preview_admins.user_type,
    'auth_provider', preview_admins.auth_provider
  ),
  jsonb_build_object(
    'nombre_completo', preview_admins.nombre_completo,
    'email_verified', true
  ),
  now(),
  now()
FROM preview_admins
ON CONFLICT (id) DO UPDATE
SET
  email = EXCLUDED.email,
  email_confirmed_at = COALESCE(auth.users.email_confirmed_at, now()),
  raw_app_meta_data = EXCLUDED.raw_app_meta_data,
  raw_user_meta_data = EXCLUDED.raw_user_meta_data,
  updated_at = now();

WITH preview_admins (id, email) AS (
  VALUES
    (
      'ad017045-0000-4000-8000-000000000001'::uuid,
      'alejandro.rosales@lasalle.mx'
    ),
    (
      'ad011538-0000-4000-8000-000000000002'::uuid,
      'javier.garrido@lasalle.mx'
    ),
    (
      'b067e470-51a5-4f15-9000-000000000003'::uuid,
      'roberto.silva@lasalle.mx'
    )
)
INSERT INTO auth.identities (
  provider_id,
  user_id,
  identity_data,
  provider,
  last_sign_in_at,
  created_at,
  updated_at
)
SELECT
  preview_admins.id::text,
  preview_admins.id,
  jsonb_build_object(
    'sub', preview_admins.id::text,
    'email', preview_admins.email,
    'email_verified', true,
    'phone_verified', false
  ),
  'email',
  now(),
  now(),
  now()
FROM preview_admins
ON CONFLICT (provider_id, provider) DO UPDATE
SET
  user_id = EXCLUDED.user_id,
  identity_data = EXCLUDED.identity_data,
  updated_at = now();

WITH preview_admins (id, nombre_completo, clave) AS (
  VALUES
    (
      'ad017045-0000-4000-8000-000000000001'::uuid,
      'Alejandro Rosales',
      'ad017045'
    ),
    (
      'ad011538-0000-4000-8000-000000000002'::uuid,
      'Javier Garrido',
      'ad011538'
    ),
    (
      'b067e470-51a5-4f15-9000-000000000003'::uuid,
      'Roberto Silva',
      NULL
    )
)
INSERT INTO public.usuarios_app (
  id,
  nombre_completo,
  clave,
  dado_de_baja_en
)
SELECT
  preview_admins.id,
  preview_admins.nombre_completo,
  preview_admins.clave,
  NULL
FROM preview_admins
ON CONFLICT (id) DO UPDATE
SET
  nombre_completo = EXCLUDED.nombre_completo,
  clave = EXCLUDED.clave,
  dado_de_baja_en = NULL;

WITH preview_admins (id) AS (
  VALUES
    ('ad017045-0000-4000-8000-000000000001'::uuid),
    ('ad011538-0000-4000-8000-000000000002'::uuid),
    ('b067e470-51a5-4f15-9000-000000000003'::uuid)
)
INSERT INTO public.usuarios_roles (usuario_id, rol_id)
SELECT preview_admins.id, roles.id
FROM preview_admins
CROSS JOIN public.roles
WHERE roles.clave = 'ADMIN'
ON CONFLICT DO NOTHING;

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
  '8f1ce751-949b-45dd-8e38-e10c64b077fd',
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
