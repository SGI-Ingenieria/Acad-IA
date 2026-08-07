import { createClient } from '@supabase/supabase-js'

import { VISUAL_TEST_EMAIL, VISUAL_TEST_PASSWORD } from './credentials'

const TEST_PACKAGE_ID = '99999999-9999-4999-8999-999999999991'
const TEST_SUBJECT_STRUCTURE_ID = '99999999-9999-4999-8999-999999999992'
const GUIDE_KEYS = [
  'portada',
  'lista-planes',
  'creacion-plan',
  'datos-generales',
  'mapa-curricular',
  'bloques-conocimiento',
  'tabla-asignaturas',
] as const

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

  const [roleResult, tenantResult] = await Promise.all([
    admin.from('roles').select('id').eq('clave', 'ADMIN').single(),
    admin.from('tenants').select('id').eq('slug', 'acad-ia').single(),
  ])
  if (roleResult.error) throw roleResult.error
  if (tenantResult.error) throw tenantResult.error

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
