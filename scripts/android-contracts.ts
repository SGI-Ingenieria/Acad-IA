/** Local API contract smoke test. Never uses service-role credentials or touches hosted data. */
import assert from 'node:assert/strict'

const status = Bun.spawnSync(['bunx', 'supabase', 'status', '-o', 'json'], {
  stdout: 'pipe',
  stderr: 'pipe',
})
assert.equal(status.exitCode, 0, 'Supabase local debe estar iniciado')
const { API_URL, ANON_KEY } = JSON.parse(status.stdout.toString())
assert.ok(['localhost', '127.0.0.1'].includes(new URL(API_URL).hostname))
const email = process.env.ANDROID_TEST_EMAIL
const password = process.env.ANDROID_TEST_PASSWORD
assert.ok(
  email && password,
  'Define ANDROID_TEST_EMAIL y ANDROID_TEST_PASSWORD para una cuenta local',
)
let token = ANON_KEY
async function api(
  path: string,
  body?: unknown,
  method = body ? 'POST' : 'GET',
) {
  const response = await fetch(`${API_URL}/${path}`, {
    method,
    headers: {
      apikey: ANON_KEY,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(20000),
  })
  const result = await response.json()
  assert.ok(
    response.ok,
    `${method} ${path.split('?')[0]}: ${response.status} ${result.code || result.error || ''} ${result.message || ''}`,
  )
  return result
}
const session = await api('auth/v1/token?grant_type=password', {
  email,
  password,
})
token = session.access_token
const plans = await api('rest/v1/rpc/planes_catalogo_buscar_versiones', {
  p_search: null,
  p_modo_version: 'actuales',
  p_sort: 'actualizado_desc',
  p_limit: 30,
  p_offset: 0,
})
assert.ok(plans.length, 'Se necesita al menos un plan local')
console.log(`PASS auth + catálogo de planes (${plans.length})`)
const plan = plans[0].plan
const routes = [
  `planes_estudio?id=eq.${plan.id}&select=*,carreras(*,facultades(*)),estructuras_plan!planes_estudio_estructura_id_fkey(*),estados_plan(*)`,
  `cambios_plan?plan_estudio_id=eq.${plan.id}&select=*,usuarios_app:cambiado_por(nombre_completo)&order=cambiado_en.desc`,
  `comentarios_plan?plan_estudio_id=eq.${plan.id}&select=*,autor:autor_id(nombre_completo)`,
  'registros_oficiales_plan_detalle?order=actualizado_en.desc&limit=1',
  `notificaciones?usuario_id=eq.${session.user.id}&order=creado_en.desc&limit=1`,
]
for (const route of routes) {
  await api(`rest/v1/${route}`)
  console.log(`PASS ${route.split('?')[0]}`)
}
await api('rest/v1/rpc/catalogo_asignaturas_buscar', {
  p_q: null,
  p_sort: 'nombre_asc',
  p_limit: 30,
  p_offset: 0,
})
await api('rest/v1/rpc/transiciones_permitidas_plan', { p_plan_id: plan.id })
assert.equal(
  await api('rest/v1/rpc/authz_plan_write_allowed', { p_plan_id: plan.id }),
  true,
)
console.log('PASS catálogo de asignaturas + permisos + transiciones')
const structures = await api(
  `rest/v1/estructuras_asignatura?estructura_plan_id=eq.${plan.estructura_id}&select=id`,
)
assert.ok(structures.length, 'Se necesita estructura de asignatura')
const subjectId = crypto.randomUUID()
const commentId = crypto.randomUUID()
const referenceId = crypto.randomUUID()
try {
  await api('rest/v1/asignaturas', {
    id: subjectId,
    plan_estudio_id: plan.id,
    estructura_id: structures[0].id,
    nombre: 'Prueba automatizada Android',
    codigo: `AND-${subjectId.slice(0, 8)}`,
    numero_ciclo: 1,
    creado_por: session.user.id,
  })
  await api(
    `rest/v1/asignaturas?id=eq.${subjectId}`,
    {
      horas_academicas: 16,
      horas_independientes: 32,
      actualizado_por: session.user.id,
    },
    'PATCH',
  )
  const [subject] = await api(
    `rest/v1/asignaturas?id=eq.${subjectId}&select=*,planes_estudio(id,nombre_display,tipo_ciclo,numero_ciclos,estructura_id),estructuras_asignatura(id,nombre,definicion)`,
  )
  assert.equal(subject.horas_academicas, 16)
  await api('rest/v1/bibliografia_asignatura', {
    id: referenceId,
    asignatura_id: subjectId,
    tipo: 'BASICA',
    cita: 'Referencia de prueba Android',
    creado_por: session.user.id,
  })
  await api('rest/v1/comentarios_asignatura', {
    id: commentId,
    asignatura_id: subjectId,
    cuerpo: 'Observación de prueba Android',
    autor_id: session.user.id,
    categoria: 'INTERNO',
  })
  await api(
    `rest/v1/comentarios_asignatura?id=eq.${commentId}`,
    { resuelto: true },
    'PATCH',
  )
  await api(
    `rest/v1/cambios_asignatura?asignatura_id=eq.${subjectId}&select=*,usuarios_app:cambiado_por(nombre_completo)&order=cambiado_en.desc`,
  )
  console.log(
    'PASS alta/edición de asignatura + bibliografía + revisión + historial',
  )
} finally {
  for (const [table, id] of [
    ['comentarios_asignatura', commentId],
    ['bibliografia_asignatura', referenceId],
    ['asignaturas', subjectId],
  ]) {
    await api(`rest/v1/${table}?id=eq.${id}`, undefined, 'DELETE')
  }
  console.log('Limpieza: solo registros creados por esta prueba')
}
