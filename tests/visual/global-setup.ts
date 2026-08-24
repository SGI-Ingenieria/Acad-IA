import { createClient } from '@supabase/supabase-js'

import { VISUAL_TEST_EMAIL, VISUAL_TEST_PASSWORD } from './credentials'

import type { Json } from '@/types/supabase'

const TEST_PACKAGE_ID = '99999999-9999-4999-8999-999999999991'
const TEST_SUBJECT_STRUCTURE_ID = '99999999-9999-4999-8999-999999999992'
const TEST_PLAN_CONTENT_STRUCTURE_ID = '99999999-9999-4999-8999-999999999995'
const TEST_SUBJECT_CONTENT_STRUCTURE_ID = '99999999-9999-4999-8999-999999999996'
const TEST_PLAN_ID = '11111111-1111-4111-8111-111111111111'
const TEST_PLAN_STRUCTURE_ID = '69fb2b77-5a95-47e0-bf1f-389d384200e4'
const TEST_SUBJECT_SOURCE_STRUCTURE_ID = '7856e9cc-9ac1-4a31-b93a-0624d4c5e1de'
const TEST_CAREER_ID = '8208da08-d549-4359-8865-9d806bc54f19'
const TEST_MATH_LINE_ID = '11111111-1111-4111-8111-000000000002'
const GUIDE_KEYS = [
  'portada',
  'lista-planes',
  'creacion-plan',
  'datos-generales',
  'mapa-curricular',
  'bloques-conocimiento',
  'tabla-asignaturas',
] as const

const LEGACY_PLAN_FIELDS = new Set([
  'vigencia',
  'clave_del_plan_de_estudios',
  'duracion_del_ciclo_escolar',
  'nivel_y_nombre_del_plan_de_estudios',
  'total_de_ciclos_del_plan_de_estudios',
])
const OPTIONAL_PLAN_FIELDS = new Set([
  'curso_propedeutico',
  'programa_de_investigacion',
  'justificacion_de_la_propuesta_curricular',
])
const LEGACY_SUBJECT_FIELDS = new Set([
  'denominacion_de_la_asignatura_o_unidad_de_aprendizaje',
  'clave_de_la_asignatura',
  'ciclo',
])

function isJsonObject(value: Json | undefined): value is {
  [key: string]: Json | undefined
} {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function normalizedDefinition(
  source: Json,
  removedFields: Set<string>,
  optionalFields: Set<string>,
): {
  definition: { [key: string]: Json | undefined }
  properties: {
    [key: string]: Json | undefined
  }
} {
  const definition = structuredClone(source)
  if (!isJsonObject(definition) || !isJsonObject(definition.properties)) {
    throw new Error('La estructura curricular base no tiene un esquema válido.')
  }

  for (const field of removedFields) delete definition.properties[field]
  if (Array.isArray(definition.required)) {
    definition.required = definition.required.filter(
      (field) =>
        typeof field !== 'string' ||
        (!removedFields.has(field) && !optionalFields.has(field)),
    )
  }

  return { definition, properties: definition.properties }
}

function extendField(
  properties: { [key: string]: Json | undefined },
  field: string,
  patch: Record<string, Json>,
) {
  const property = properties[field]
  if (!isJsonObject(property)) return
  const acadia = property['x-acad-ia']
  property['x-acad-ia'] = {
    ...(isJsonObject(acadia) ? acadia : {}),
    ...patch,
  }
}

function visualPlanDefinition(source: Json): Json {
  const { definition, properties } = normalizedDefinition(
    source,
    LEGACY_PLAN_FIELDS,
    OPTIONAL_PLAN_FIELDS,
  )
  extendField(properties, 'perfil_de_ingreso', {
    'semantic-key': 'perfil_ingreso',
  })
  extendField(properties, 'perfil_de_egreso', {
    'semantic-key': 'perfil_egreso',
  })
  extendField(properties, 'fines_de_aprendizaje_o_formacion', {
    'semantic-key': 'fines_aprendizaje',
  })
  extendField(properties, 'programa_de_investigacion', {
    requiredWhen: { nivel: ['Doctorado'], orientacion: ['Investigación'] },
  })
  extendField(properties, 'justificacion_de_la_propuesta_curricular', {
    requiredWhen: { modalidad_educativa: ['No escolarizada', 'Mixta'] },
  })
  return definition
}

function visualSubjectDefinition(source: Json): Json {
  const { definition, properties } = normalizedDefinition(
    source,
    LEGACY_SUBJECT_FIELDS,
    new Set(['modalidades_tecnologicas_e_informaticas']),
  )
  extendField(properties, 'modalidades_tecnologicas_e_informaticas', {
    requiredWhen: { modalidad_educativa: ['No escolarizada', 'Mixta'] },
  })
  return definition
}

export default async function globalSetup() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    throw new Error(
      'Falta la configuración del Supabase local para Playwright.',
    )
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const listed = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
  if (listed.error) throw listed.error

  let user = listed.data.users.find((item) => item.email === VISUAL_TEST_EMAIL)
  if (user) {
    const updated = await admin.auth.admin.updateUserById(user.id, {
      password: VISUAL_TEST_PASSWORD,
      email_confirm: true,
    })
    if (updated.error) throw updated.error
    user = updated.data.user
  } else {
    const created = await admin.auth.admin.createUser({
      email: VISUAL_TEST_EMAIL,
      password: VISUAL_TEST_PASSWORD,
      email_confirm: true,
      user_metadata: { nombre_completo: 'Revisión visual' },
    })
    if (created.error) throw created.error
    user = created.data.user
  }

  const [
    roleResult,
    tenantResult,
    planStateResult,
    sourcePlanStructureResult,
    sourceSubjectStructureResult,
  ] = await Promise.all([
    admin.from('roles').select('id').eq('clave', 'ADMIN').single(),
    admin.from('tenants').select('id').eq('slug', 'acad-ia').single(),
    admin.from('estados_plan').select('id').eq('clave', 'BORRADOR').single(),
    admin
      .from('estructuras_plan')
      .select('definicion')
      .eq('id', TEST_PLAN_STRUCTURE_ID)
      .single(),
    admin
      .from('estructuras_asignatura')
      .select('definicion')
      .eq('id', TEST_SUBJECT_SOURCE_STRUCTURE_ID)
      .single(),
  ])
  if (roleResult.error) throw roleResult.error
  if (tenantResult.error) throw tenantResult.error
  if (planStateResult.error) throw planStateResult.error
  if (sourcePlanStructureResult.error) throw sourcePlanStructureResult.error
  if (sourceSubjectStructureResult.error)
    throw sourceSubjectStructureResult.error

  const profile = await admin.from('usuarios_app').upsert({
    id: user.id,
    nombre_completo: 'Revisión visual',
  })
  if (profile.error) throw profile.error

  const guideProgress = await admin.from('guias_usuario').upsert(
    GUIDE_KEYS.map((guiaClave) => ({
      usuario_id: user.id,
      guia_clave: guiaClave,
      guia_version: 1,
      paso_actual: 0,
      completada: false,
      descartada: true,
    })),
    { onConflict: 'usuario_id,guia_clave,guia_version' },
  )
  if (guideProgress.error) throw guideProgress.error

  const emptySchema = {
    type: 'object',
    properties: {},
    required: [],
    additionalProperties: false,
  }
  const packageFixture = await admin.from('estructuras_plan').upsert({
    id: TEST_PACKAGE_ID,
    nombre: 'Paquete de revisión visual',
    tipo: 'CURRICULAR',
    definicion: emptySchema,
    autoridad_normativa: 'SEP/DGAIR',
    etiqueta_version: 'Visual',
    estado_publicacion: 'BORRADOR',
    manifest_plantillas: {},
    creado_por: user.id,
    actualizado_por: user.id,
  })
  if (packageFixture.error) throw packageFixture.error

  const subjectStructureFixture = await admin
    .from('estructuras_asignatura')
    .upsert({
      id: TEST_SUBJECT_STRUCTURE_ID,
      estructura_plan_id: TEST_PACKAGE_ID,
      nombre: 'Programa de asignatura',
      tipo: 'CURRICULAR',
      definicion: emptySchema,
      creado_por: user.id,
      actualizado_por: user.id,
    })
  if (subjectStructureFixture.error) throw subjectStructureFixture.error

  const contentPlanStructureFixture = await admin
    .from('estructuras_plan')
    .upsert({
      id: TEST_PLAN_CONTENT_STRUCTURE_ID,
      nombre: 'Contenido del plan de revisión visual',
      tipo: 'CURRICULAR',
      definicion: visualPlanDefinition(
        sourcePlanStructureResult.data.definicion,
      ),
      autoridad_normativa: 'Pruebas visuales',
      etiqueta_version: 'Visual',
      estado_publicacion: 'BORRADOR',
      manifest_plantillas: {},
      creado_por: user.id,
      actualizado_por: user.id,
    })
  if (contentPlanStructureFixture.error) throw contentPlanStructureFixture.error

  const contentSubjectStructureFixture = await admin
    .from('estructuras_asignatura')
    .upsert({
      id: TEST_SUBJECT_CONTENT_STRUCTURE_ID,
      estructura_plan_id: TEST_PLAN_CONTENT_STRUCTURE_ID,
      nombre: 'Contenido de asignatura para revisión visual',
      tipo: 'CURRICULAR',
      definicion: visualSubjectDefinition(
        sourceSubjectStructureResult.data.definicion,
      ),
      creado_por: user.id,
      actualizado_por: user.id,
    })
  if (contentSubjectStructureFixture.error)
    throw contentSubjectStructureFixture.error

  const planFixture = await admin.from('planes_estudio').upsert({
    id: TEST_PLAN_ID,
    carrera_id: TEST_CAREER_ID,
    estructura_id: TEST_PLAN_CONTENT_STRUCTURE_ID,
    nombre_display: 'Doctorado en Ingeniería',
    fecha_inicio_imparticion: '2026-08-01',
    tipo_ciclo: 'Semestre',
    numero_ciclos: 8,
    semanas_por_ciclo: 16,
    etiqueta_version: '2026',
    datos: {
      nombre_autorizado_de_la_institucion: 'Universidad La Salle, A.C.',
      modalidad_educativa: 'Escolar',
      antecedente_academico: 'Bachillerato concluido o equivalente.',
      area_de_estudio: 'Ingeniería, industria y construcción',
      diseno_curricular: 'Flexible',
      carga_horaria_a_la_semana: 28,
      fines_de_aprendizaje_o_formacion:
        'Formar profesionales capaces de analizar, diseñar, construir y proteger sistemas computacionales integrados, con criterio ético, pensamiento sistémico y orientación a la solución de problemas reales.',
      perfil_de_ingreso:
        'Aspirantes con bases de matemáticas, lógica, comunicación escrita, curiosidad tecnológica y disposición para el trabajo colaborativo.',
      perfil_de_egreso:
        'La persona egresada diseñará soluciones de software, redes y sistemas ciberfísicos; evaluará riesgos de seguridad; integrará datos para la toma de decisiones y comunicará resultados técnicos a audiencias diversas.',
      programa_de_investigacion: null,
      curso_propedeutico:
        'Curso de inducción a herramientas digitales, pensamiento lógico y vida universitaria.',
      administracion_y_operatividad_del_plan_de_estudios:
        'El plan se organiza en ocho semestres con trayectos flexibles por línea curricular y asignaturas integradoras.',
      sustento_teorico_del_modelo_curricular:
        'Modelo curricular orientado al desarrollo progresivo de competencias profesionales, aprendizaje situado e integración interdisciplinaria.',
      justificacion_de_la_propuesta_curricular: null,
      propuesta_de_evaluacion_periodica_del_plan_de_estudios:
        'Revisión bienal con evidencias de egreso, empleabilidad, seguimiento de tendencias tecnológicas y consulta a cuerpos colegiados.',
      nombre_y_cargo_de_la_persona_facultada_para_autorizar_el_plan_de_estudios:
        null,
    },
    estado_actual_id: planStateResult.data.id,
    activo: true,
    tipo_origen: 'MANUAL',
    meta_origen: { fixture: 'visual-regression' },
    creado_por: user.id,
    actualizado_por: user.id,
  })
  if (planFixture.error) throw planFixture.error

  const lineFixture = await admin.from('lineas_plan').upsert({
    id: TEST_MATH_LINE_ID,
    plan_estudio_id: TEST_PLAN_ID,
    nombre: 'Matemáticas y ciencias básicas',
    orden: 20,
    area: 'Básica',
    color: '#2563eb',
    creado_por: user.id,
    actualizado_por: user.id,
  })
  if (lineFixture.error) throw lineFixture.error

  const subjectFixtures = await admin.from('asignaturas').upsert([
    {
      id: '22222222-2222-4222-8222-000000000001',
      plan_estudio_id: TEST_PLAN_ID,
      estructura_id: TEST_SUBJECT_CONTENT_STRUCTURE_ID,
      codigo: 'CIB101',
      nombre: 'Matemáticas para ingeniería',
      tipo: 'OBLIGATORIA',
      numero_ciclo: 1,
      linea_plan_id: TEST_MATH_LINE_ID,
      orden_celda: 1,
      datos: {
        fines_de_aprendizaje_o_formacion:
          'Aplicar pensamiento algebraico y modelos matemáticos a problemas de ingeniería.',
      },
      contenido_tematico: [],
      tipo_origen: 'MANUAL',
      meta_origen: { fixture: 'visual-regression' },
      horas_academicas: 64,
      horas_independientes: 32,
      criterios_de_evaluacion: [],
      creado_por: user.id,
      actualizado_por: user.id,
    },
    {
      id: '22222222-2222-4222-8222-000000000004',
      plan_estudio_id: TEST_PLAN_ID,
      estructura_id: TEST_SUBJECT_CONTENT_STRUCTURE_ID,
      codigo: 'CIB202',
      nombre: 'Matemáticas discretas',
      tipo: 'OBLIGATORIA',
      numero_ciclo: 2,
      linea_plan_id: TEST_MATH_LINE_ID,
      orden_celda: 1,
      datos: {
        fines_de_aprendizaje_o_formacion:
          'Usar lógica, conjuntos, grafos y conteo para fundamentar el razonamiento computacional.',
      },
      contenido_tematico: [],
      tipo_origen: 'MANUAL',
      meta_origen: { fixture: 'visual-regression' },
      horas_academicas: 64,
      horas_independientes: 32,
      criterios_de_evaluacion: [],
      creado_por: user.id,
      actualizado_por: user.id,
    },
  ])
  if (subjectFixtures.error) throw subjectFixtures.error

  const membership = await admin.from('tenant_memberships').upsert(
    {
      tenant_id: tenantResult.data.id,
      user_id: user.id,
      is_default: true,
    },
    { onConflict: 'tenant_id,user_id' },
  )
  if (membership.error) throw membership.error

  const removedRoles = await admin
    .from('usuarios_roles')
    .delete()
    .eq('usuario_id', user.id)
  if (removedRoles.error) throw removedRoles.error

  const assignedRole = await admin.from('usuarios_roles').insert({
    usuario_id: user.id,
    rol_id: roleResult.data.id,
  })
  if (assignedRole.error) throw assignedRole.error
}
