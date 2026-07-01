-- Acad-IA stage seed
-- Datos base idempotentes para Dokploy. No siembra roles ni estados:
-- esos catálogos ya viven en la migración v2.0.

BEGIN;

SET LOCAL search_path = public, extensions;

INSERT INTO public.facultades (
  id,
  nombre,
  nombre_corto,
  prefijo,
  color,
  icono,
  activa
) VALUES
  ('155b5fe7-9e09-420f-8d9d-ddd8219f193d', 'Ingeniería', 'ING', NULL, '#ef4444', 'Hammer', true),
  ('45a6da79-1e2d-4854-9953-6229f46c8e82', 'Negocios', 'NEG', NULL, '#2980b9', 'Briefcase', true),
  ('21561e2c-22be-40ec-b0ad-520b5253f846', 'Desarrollo Humano Profesional', 'CDHP', 'Coordinación', '#f472b6', 'HeartHandshake', true),
  ('cd9409f5-bbcd-466d-82eb-b206cea51b8b', 'Idiomas', 'CI', 'Centro', '#2dd4bf', 'Languages', true),
  ('0d711469-4668-4910-b08e-88406ad30c9a', 'Arquitectura, Diseño y Comunicación', 'FAMADYC', 'Mexicana', '#ec4899', 'DraftingCompass', true),
  ('7a162523-1120-4fb9-b291-dfb606c8f1d4', 'Derecho', 'DER', NULL, '#64748b', 'Scale', true),
  ('a977a640-709d-47d7-a306-9acbe4a867a9', 'Humanidades y Ciencias Sociales', 'HUM', NULL, '#6366f1', 'Users', true),
  ('7884f606-71b0-4f67-92da-bf22e0601480', 'Medicina', 'MED', 'Mexicana', '#10b981', 'HeartPulse', true),
  ('d17b19c6-b7ab-4bdc-8bb9-ddf6f9e0358e', 'Ciencias Químicas', 'FCQ', NULL, '#84cc16', 'FlaskConical', true),
  ('45a15339-dd80-4ef7-ab8a-63c5d844e692', 'Ciencias de la Educación', 'EDU', NULL, '#fb7185', 'GraduationCap', true)
ON CONFLICT DO NOTHING;

INSERT INTO public.carreras (
  id,
  facultad_id,
  nombre,
  nombre_corto,
  clave_sep,
  activa,
  nivel
) VALUES
  ('8208da08-d549-4359-8865-9d806bc54f19', '155b5fe7-9e09-420f-8d9d-ddd8219f193d', 'Ingeniería en Cibernética y Sistemas Computacionales', 'CIB', NULL, true, 'Licenciatura'),
  ('089cdeda-d557-4a57-b49f-eb44921dfa3a', '155b5fe7-9e09-420f-8d9d-ddd8219f193d', 'Ingeniería Mecatrónica', 'MTR', NULL, true, 'Licenciatura'),
  ('76224caa-1203-4b18-b9df-758f1f9a97fb', '155b5fe7-9e09-420f-8d9d-ddd8219f193d', 'Ingeniería Biomédica', 'LIB', NULL, true, 'Licenciatura'),
  ('83fcc355-b79b-4650-a757-0c935127e161', '155b5fe7-9e09-420f-8d9d-ddd8219f193d', 'Ciberseguridad', 'MCIB', NULL, true, 'Maestría'),
  ('6a9ae3f4-91ae-4e56-8806-9d9f4692d796', '155b5fe7-9e09-420f-8d9d-ddd8219f193d', 'Inteligencia de Datos', 'EID', NULL, true, 'Especialidad'),
  ('334763cf-973e-4610-9ee3-6475e861b783', '45a6da79-1e2d-4854-9953-6229f46c8e82', 'Contaduría y Finanzas', 'LCF', NULL, true, 'Licenciatura'),
  ('7075d507-6404-4b18-a5cb-e07a187bae55', '45a6da79-1e2d-4854-9953-6229f46c8e82', 'Mercadotecnia', 'LMER', NULL, true, 'Licenciatura'),
  ('c296f7b6-351b-44dc-a08c-2a676aa6786c', '45a6da79-1e2d-4854-9953-6229f46c8e82', 'Tecnologías de Información', 'LTI', NULL, true, 'Licenciatura'),
  ('33c850f2-160c-472c-bf14-b39031e8e47e', '21561e2c-22be-40ec-b0ad-520b5253f846', 'Área Curricular Común', 'ACC', NULL, true, 'Licenciatura'),
  ('73f639f2-71a7-4313-ac21-23420eb6f738', '0d711469-4668-4910-b08e-88406ad30c9a', 'Arquitectura', 'ARQ', NULL, true, 'Licenciatura'),
  ('cafa9b44-f894-48c8-8aa5-ac3dab3a384f', '0d711469-4668-4910-b08e-88406ad30c9a', 'Ciencias de la Comunicación', 'LCC', NULL, true, 'Licenciatura'),
  ('4d52027e-ce61-4758-b643-448d09d6a1d9', '0d711469-4668-4910-b08e-88406ad30c9a', 'Diseño Gráfico y Digital', 'LDGD', NULL, true, 'Licenciatura'),
  ('20593041-d605-4174-8404-4b152041eece', '7a162523-1120-4fb9-b291-dfb606c8f1d4', 'Derecho', 'LDER', NULL, true, 'Licenciatura'),
  ('431eaf1c-42a3-4a37-a7a2-79c350bbe1ae', '7a162523-1120-4fb9-b291-dfb606c8f1d4', 'Relaciones Internacionales', 'LRI', NULL, true, 'Licenciatura'),
  ('c8a8cd55-e124-4393-9775-b2da161297dd', 'a977a640-709d-47d7-a306-9acbe4a867a9', 'Psicología', 'LPS', NULL, true, 'Licenciatura'),
  ('e7b89d58-6b55-4993-a96f-bb4eb8c2eb88', '45a15339-dd80-4ef7-ab8a-63c5d844e692', 'Ciencias de la Educación', 'LCE', NULL, true, 'Licenciatura'),
  ('ade7dcff-d65b-4d95-919b-d2e09788253f', '7884f606-71b0-4f67-92da-bf22e0601480', 'Médico Cirujano', 'LMC', NULL, true, 'Licenciatura'),
  ('ab3bb83e-fcd9-4838-92f1-b6c4fb98ed2e', 'd17b19c6-b7ab-4bdc-8bb9-ddf6f9e0358e', 'Ingeniería Química', 'LIQ', NULL, true, 'Licenciatura')
ON CONFLICT DO NOTHING;

INSERT INTO public.estructuras_plan (
  id,
  nombre,
  tipo,
  template_id,
  excel_template_id,
  definicion
) VALUES (
  '69fb2b77-5a95-47e0-bf1f-389d384200e4',
  'Plan base SEP/ULSA (2026)',
  'CURRICULAR',
  '1373945625988937236',
  '1402917575045089616',
  $json$
  {
    "type": "object",
    "required": [
      "nombre_autorizado_de_la_institucion",
      "nivel_y_nombre_del_plan_de_estudios",
      "modalidad_educativa",
      "antecedente_academico",
      "area_de_estudio",
      "diseno_curricular",
      "total_de_ciclos_del_plan_de_estudios",
      "duracion_del_ciclo_escolar",
      "carga_horaria_a_la_semana",
      "fines_de_aprendizaje_o_formacion",
      "perfil_de_ingreso",
      "perfil_de_egreso"
    ],
    "properties": {
      "nombre_autorizado_de_la_institucion": {
        "type": "string",
        "title": "Nombre autorizado de la institución",
        "description": "Nombre institucional autorizado ante la autoridad educativa."
      },
      "nivel_y_nombre_del_plan_de_estudios": {
        "type": "string",
        "title": "Nivel y nombre del plan de estudios",
        "description": "Nivel educativo y denominación oficial del plan."
      },
      "modalidad_educativa": {
        "type": "string",
        "enum": ["Escolar", "No escolarizada", "Mixta"],
        "title": "Modalidad educativa"
      },
      "vigencia": {
        "type": ["string", "null"],
        "title": "Vigencia",
        "description": "Campo administrativo que se llena cuando la autoridad educativa aprueba el plan.",
        "x-acad-ia": {
          "restriccion": {
            "estados_editables": ["APROBADO"],
            "permiso_edicion": "planes.campos_restringidos.editar",
            "visibilidad": "oculto_hasta_llenarse"
          }
        }
      },
      "antecedente_academico": {
        "type": "string",
        "title": "Antecedente académico"
      },
      "area_de_estudio": {
        "type": "string",
        "title": "Área de estudio"
      },
      "clave_del_plan_de_estudios": {
        "type": ["string", "null"],
        "title": "Clave del plan de estudios",
        "description": "Clave administrativa asignada al plan aprobado.",
        "x-acad-ia": {
          "restriccion": {
            "estados_editables": ["APROBADO"],
            "permiso_edicion": "planes.campos_restringidos.editar",
            "visibilidad": "oculto_hasta_llenarse"
          }
        }
      },
      "diseno_curricular": {
        "type": "string",
        "enum": ["Rígido", "Flexible"],
        "title": "Diseño curricular"
      },
      "total_de_ciclos_del_plan_de_estudios": {
        "type": "string",
        "title": "Total de ciclos del plan"
      },
      "duracion_del_ciclo_escolar": {
        "type": "string",
        "title": "Duración del ciclo escolar"
      },
      "carga_horaria_a_la_semana": {
        "type": "number",
        "title": "Carga horaria a la semana"
      },
      "fines_de_aprendizaje_o_formacion": {
        "type": "string",
        "title": "Fines de aprendizaje o formación"
      },
      "perfil_de_ingreso": {
        "type": "string",
        "title": "Perfil de ingreso"
      },
      "perfil_de_egreso": {
        "type": "string",
        "title": "Perfil de egreso"
      },
      "programa_de_investigacion": {
        "type": ["string", "null"],
        "title": "Programa de investigación"
      },
      "curso_propedeutico": {
        "type": ["string", "null"],
        "title": "Curso propedéutico"
      },
      "administracion_y_operatividad_del_plan_de_estudios": {
        "type": ["string", "null"],
        "title": "Administración y operatividad"
      },
      "sustento_teorico_del_modelo_curricular": {
        "type": ["string", "null"],
        "title": "Sustento teórico del modelo curricular"
      },
      "justificacion_de_la_propuesta_curricular": {
        "type": ["string", "null"],
        "title": "Justificación de la propuesta curricular"
      },
      "propuesta_de_evaluacion_periodica_del_plan_de_estudios": {
        "type": ["string", "null"],
        "title": "Propuesta de evaluación periódica"
      },
      "nombre_y_cargo_de_la_persona_facultada_para_autorizar_el_plan_de_estudios": {
        "type": ["string", "null"],
        "title": "Persona que aprobó el plan",
        "description": "Dato administrativo posterior a la aprobación.",
        "x-acad-ia": {
          "restriccion": {
            "estados_editables": ["APROBADO"],
            "permiso_edicion": "planes.campos_restringidos.editar",
            "visibilidad": "oculto_hasta_llenarse"
          }
        }
      }
    },
    "additionalProperties": false
  }
  $json$::jsonb
)
ON CONFLICT (id) DO UPDATE
SET
  template_id = COALESCE(public.estructuras_plan.template_id, EXCLUDED.template_id),
  excel_template_id = COALESCE(
    public.estructuras_plan.excel_template_id,
    EXCLUDED.excel_template_id
  ),
  definicion = CASE
    WHEN NOT EXISTS (
      SELECT 1
      FROM jsonb_each(COALESCE(public.estructuras_plan.definicion->'properties', '{}'::jsonb)) AS prop(key, value)
      WHERE jsonb_typeof(prop.value #> '{x-acad-ia,restriccion}') = 'object'
    )
    THEN EXCLUDED.definicion
    ELSE public.estructuras_plan.definicion
  END;

INSERT INTO public.estructuras_asignatura (
  id,
  estructura_plan_id,
  nombre,
  definicion,
  template_id,
  tipo
) VALUES (
  '7856e9cc-9ac1-4a31-b93a-0624d4c5e1de',
  '69fb2b77-5a95-47e0-bf1f-389d384200e4',
  'Asignatura SEP/ULSA (semilla)',
  $json$
  {
    "type": "object",
    "required": [
      "denominacion_de_la_asignatura_o_unidad_de_aprendizaje",
      "ciclo",
      "clave_de_la_asignatura",
      "fines_de_aprendizaje_o_formacion",
      "actividades_de_aprendizaje_bajo_conduccion_de_un_academico",
      "actividades_de_aprendizaje_independientes",
      "modalidades_tecnologicas_e_informaticas"
    ],
    "properties": {
      "denominacion_de_la_asignatura_o_unidad_de_aprendizaje": {
        "type": "string",
        "title": "Denominación de la asignatura o unidad de aprendizaje"
      },
      "ciclo": {
        "type": "string",
        "title": "Ciclo"
      },
      "clave_de_la_asignatura": {
        "type": "string",
        "title": "Clave de la asignatura"
      },
      "fines_de_aprendizaje_o_formacion": {
        "type": "string",
        "title": "Fines de aprendizaje o formación"
      },
      "actividades_de_aprendizaje_bajo_conduccion_de_un_academico": {
        "type": "string",
        "title": "Actividades bajo conducción académica"
      },
      "actividades_de_aprendizaje_independientes": {
        "type": "string",
        "title": "Actividades independientes"
      },
      "modalidades_tecnologicas_e_informaticas": {
        "type": "string",
        "title": "Modalidades tecnológicas e informáticas"
      }
    },
    "additionalProperties": false
  }
  $json$::jsonb,
  '1373944894291796699',
  'CURRICULAR'
)
ON CONFLICT (id) DO UPDATE
SET
  estructura_plan_id = EXCLUDED.estructura_plan_id,
  template_id = COALESCE(public.estructuras_asignatura.template_id, EXCLUDED.template_id),
  tipo = COALESCE(public.estructuras_asignatura.tipo, EXCLUDED.tipo);

INSERT INTO public.lineas_curriculares_sugeridas (
  id,
  facultad_id,
  nombre,
  area,
  color,
  orden
) VALUES
  ('b0000001-0000-4000-8000-000000000001', '155b5fe7-9e09-420f-8d9d-ddd8219f193d', 'Área común de ingeniería', 'Básica', '#64748b', 10),
  ('b0000001-0000-4000-8000-000000000002', '155b5fe7-9e09-420f-8d9d-ddd8219f193d', 'Matemáticas y ciencias básicas', 'Básica', '#2563eb', 20),
  ('b0000001-0000-4000-8000-000000000003', '155b5fe7-9e09-420f-8d9d-ddd8219f193d', 'Programación y sistemas', 'Profesional', '#16a34a', 30),
  ('b0000001-0000-4000-8000-000000000004', '155b5fe7-9e09-420f-8d9d-ddd8219f193d', 'Ciberseguridad', 'Profesional', '#dc2626', 40),
  ('b0000001-0000-4000-8000-000000000005', '155b5fe7-9e09-420f-8d9d-ddd8219f193d', 'Integración profesional', 'Integración', '#7c3aed', 50),
  ('b0000002-0000-4000-8000-000000000001', '0d711469-4668-4910-b08e-88406ad30c9a', 'Fundamentos de diseño', 'Básica', '#ec4899', 10),
  ('b0000002-0000-4000-8000-000000000002', '0d711469-4668-4910-b08e-88406ad30c9a', 'Comunicación y medios', 'Profesional', '#f97316', 20),
  ('b0000002-0000-4000-8000-000000000003', '0d711469-4668-4910-b08e-88406ad30c9a', 'Proyecto integrador', 'Integración', '#0f766e', 30)
ON CONFLICT DO NOTHING;

COMMIT;
