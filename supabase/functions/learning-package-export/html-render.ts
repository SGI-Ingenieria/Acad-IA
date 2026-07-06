// Render de learning_objects a HTML estático. Lo comparten el exportador
// SCORM 1.2 (cada página se envuelve como SCO) y el bundle HTML de preview.

export type LearningObjectTipo =
  | 'apunte'
  | 'quiz'
  | 'actividad'
  | 'ejercicios'
  | 'rubrica'
  | 'outline_presentacion'
  | 'recursos_externos'

export type RenderableObject = {
  id: string
  tipo: LearningObjectTipo
  titulo: string
  descripcion: string | null
  contenido_json: unknown
  source_refs: unknown
}

export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function asArray(value: unknown): Array<unknown> {
  return Array.isArray(value) ? value : []
}

function str(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

/**
 * contenido_json se guarda como el objeto `contenido` completo del schema de
 * generación (las 7 claves, solo la del tipo poblada). Extrae la sección del
 * tipo, tolerando también el formato "plano" (el contenido directo).
 */
export function extractContenido(
  obj: RenderableObject,
): Record<string, unknown> {
  const raw = asRecord(obj.contenido_json)
  if (!raw) return {}
  const nested = asRecord(raw[obj.tipo])
  return nested ?? raw
}

function renderLista(items: Array<unknown>): string {
  if (!items.length) return ''
  return `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`
}

function renderParrafo(texto: unknown, clase = ''): string {
  const value = str(texto)
  if (!value) return ''
  const attr = clase ? ` class="${clase}"` : ''
  return `<p${attr}>${escapeHtml(value)}</p>`
}

function renderApunte(c: Record<string, unknown>): string {
  const secciones = asArray(c.secciones)
    .map((seccion) => {
      const s = asRecord(seccion)
      if (!s) return ''
      return `<section><h3>${escapeHtml(s.titulo)}</h3>${renderParrafo(s.desarrollo)}</section>`
    })
    .join('')

  const conceptos = asArray(c.conceptos_clave)
  return [
    renderParrafo(c.objetivo, 'objetivo'),
    renderParrafo(c.introduccion),
    secciones,
    conceptos.length
      ? `<section><h3>Conceptos clave</h3>${renderLista(conceptos)}</section>`
      : '',
    str(c.ejemplo_aplicado)
      ? `<section><h3>Ejemplo aplicado</h3>${renderParrafo(c.ejemplo_aplicado)}</section>`
      : '',
    renderParrafo(c.cierre),
  ].join('')
}

/**
 * Quiz interactivo: los datos van embebidos como JSON y un script inline
 * califica en el navegador. Si `window.AcadScorm` existe (páginas SCORM),
 * reporta el score al LMS.
 */
function renderQuiz(c: Record<string, unknown>): string {
  const preguntas = asArray(c.preguntas)
    .map((pregunta) => {
      const p = asRecord(pregunta)
      if (!p) return null
      return {
        pregunta: str(p.pregunta),
        opciones: asArray(p.opciones)
          .map((opcion) => {
            const o = asRecord(opcion)
            return o ? { id: str(o.id), texto: str(o.texto) } : null
          })
          .filter((o): o is { id: string; texto: string } => o !== null),
        respuesta_correcta: str(p.respuesta_correcta),
        retroalimentacion: str(p.retroalimentacion),
      }
    })
    .filter((p) => p !== null)

  const preguntasHtml = preguntas
    .map(
      (p, i) => `
<fieldset class="quiz-pregunta" data-pregunta="${i}">
  <legend>${i + 1}. ${escapeHtml(p.pregunta)}</legend>
  ${p.opciones
    .map(
      (o) => `
  <label class="quiz-opcion">
    <input type="radio" name="q${i}" value="${escapeHtml(o.id)}" />
    <span>${escapeHtml(o.texto)}</span>
  </label>`,
    )
    .join('')}
  <p class="quiz-feedback" hidden></p>
</fieldset>`,
    )
    .join('')

  // `<` escapado para que un texto malicioso no cierre el tag <script>.
  const quizJson = JSON.stringify(
    preguntas.map((p) => ({
      correcta: p.respuesta_correcta,
      retro: p.retroalimentacion,
    })),
  ).replaceAll('<', '\\u003c')

  return `
${renderParrafo(c.instrucciones)}
<form id="quiz-form">
${preguntasHtml}
<button type="submit" class="quiz-enviar">Calificar</button>
<p id="quiz-resultado" hidden></p>
</form>
<script>
(function () {
  var claves = ${quizJson}
  var form = document.getElementById('quiz-form')
  form.addEventListener('submit', function (ev) {
    ev.preventDefault()
    var correctas = 0
    claves.forEach(function (clave, i) {
      var elegida = form.querySelector('input[name="q' + i + '"]:checked')
      var fieldset = form.querySelector('[data-pregunta="' + i + '"]')
      var feedback = fieldset.querySelector('.quiz-feedback')
      var ok = Boolean(elegida) && elegida.value === clave.correcta
      if (ok) correctas++
      fieldset.classList.toggle('correcta', ok)
      fieldset.classList.toggle('incorrecta', !ok)
      feedback.hidden = false
      feedback.textContent = (ok ? 'Correcto. ' : 'Incorrecto. ') + clave.retro
    })
    var score = claves.length ? Math.round((correctas / claves.length) * 100) : 0
    var resultado = document.getElementById('quiz-resultado')
    resultado.hidden = false
    resultado.textContent = 'Resultado: ' + correctas + '/' + claves.length + ' (' + score + '/100)'
    if (window.AcadScorm) window.AcadScorm.reportScore(score)
  })
})()
</script>`
}

function renderActividad(c: Record<string, unknown>): string {
  const meta: Array<string> = []
  if (str(c.modalidad)) meta.push(`Modalidad: ${str(c.modalidad)}`)
  if (typeof c.duracion_minutos === 'number') {
    meta.push(`Duración: ${c.duracion_minutos} minutos`)
  }

  return [
    meta.length ? renderParrafo(meta.join(' · '), 'meta') : '',
    renderParrafo(c.instrucciones),
    asArray(c.pasos).length
      ? `<section><h3>Pasos</h3><ol>${asArray(c.pasos)
          .map((paso) => `<li>${escapeHtml(paso)}</li>`)
          .join('')}</ol></section>`
      : '',
    str(c.producto_esperado)
      ? `<section><h3>Producto esperado</h3>${renderParrafo(c.producto_esperado)}</section>`
      : '',
    asArray(c.criterios_exito).length
      ? `<section><h3>Criterios de éxito</h3>${renderLista(asArray(c.criterios_exito))}</section>`
      : '',
  ].join('')
}

function renderEjercicios(c: Record<string, unknown>): string {
  const ejercicios = asArray(c.ejercicios)
    .map((ejercicio, i) => {
      const e = asRecord(ejercicio)
      if (!e) return ''
      return `
<details class="ejercicio">
  <summary>${i + 1}. ${escapeHtml(e.enunciado)} <em>(${escapeHtml(e.dificultad)})</em></summary>
  ${str(e.pista) ? renderParrafo(`Pista: ${str(e.pista)}`) : ''}
  ${str(e.solucion_esperada) ? renderParrafo(`Solución esperada: ${str(e.solucion_esperada)}`) : ''}
</details>`
    })
    .join('')

  return `${renderParrafo(c.instrucciones)}${ejercicios}`
}

function renderRubrica(c: Record<string, unknown>): string {
  const criterios = asArray(c.criterios)
    .map((criterio) => {
      const cr = asRecord(criterio)
      if (!cr) return ''
      const niveles = asArray(cr.niveles)
        .map((nivel) => {
          const n = asRecord(nivel)
          if (!n) return ''
          return `<li><strong>${escapeHtml(n.nivel)}</strong> (${escapeHtml(n.puntaje)}): ${escapeHtml(n.descripcion)}</li>`
        })
        .join('')
      return `
<tr>
  <td>${escapeHtml(cr.criterio)}</td>
  <td>${escapeHtml(cr.peso_porcentaje)}%</td>
  <td><ul>${niveles}</ul></td>
</tr>`
    })
    .join('')

  return `
${str(c.escala) ? renderParrafo(`Escala: ${str(c.escala)}`, 'meta') : ''}
<table class="rubrica">
  <thead><tr><th>Criterio</th><th>Peso</th><th>Niveles</th></tr></thead>
  <tbody>${criterios}</tbody>
</table>`
}

function renderOutline(c: Record<string, unknown>): string {
  const diapositivas = asArray(c.diapositivas)
    .map((diapositiva) => {
      const d = asRecord(diapositiva)
      if (!d) return ''
      return `
<section class="diapositiva">
  <h3>${escapeHtml(d.numero)}. ${escapeHtml(d.titulo)}</h3>
  ${renderLista(asArray(d.puntos))}
  ${str(d.notas_docente) ? renderParrafo(`Notas del docente: ${str(d.notas_docente)}`, 'notas') : ''}
</section>`
    })
    .join('')

  return `<h2>${escapeHtml(c.titulo_presentacion)}</h2>${diapositivas}`
}

function renderRecursosExternos(c: Record<string, unknown>): string {
  const recursos = asArray(c.recursos)
    .map((recurso) => {
      const r = asRecord(recurso)
      if (!r) return ''
      const url = str(r.url)
      const titulo = url
        ? `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(r.titulo)}</a>`
        : escapeHtml(r.titulo)
      return `
<li>
  ${titulo} <em>(${escapeHtml(r.tipo_recurso)}${str(r.licencia) ? ` · ${escapeHtml(r.licencia)}` : ''})</em>
  ${renderParrafo(r.descripcion)}
  ${str(r.uso_sugerido) ? renderParrafo(`Uso sugerido: ${str(r.uso_sugerido)}`, 'meta') : ''}
</li>`
    })
    .join('')

  return `<ul class="recursos-externos">${recursos}</ul>`
}

function renderFuentes(sourceRefs: unknown): string {
  const fuentes = asArray(sourceRefs)
    .map((ref) => {
      const r = asRecord(ref)
      if (!r) return ''
      const partes = [str(r.autor), str(r.titulo), str(r.editorial_o_sitio)]
        .filter(Boolean)
        .map((parte) => escapeHtml(parte))
        .join('. ')
      const licencia = str(r.licencia)
        ? ` <em>(${escapeHtml(r.licencia)})</em>`
        : ''
      const url = str(r.url)
      return `<li>${partes}${licencia}${url ? ` — <a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(url)}</a>` : ''}</li>`
    })
    .filter(Boolean)
    .join('')

  if (!fuentes) return ''
  return `<footer class="fuentes"><h3>Fuentes</h3><ol>${fuentes}</ol></footer>`
}

export function renderObjectBody(obj: RenderableObject): string {
  const contenido = extractContenido(obj)
  let cuerpo: string
  switch (obj.tipo) {
    case 'apunte':
      cuerpo = renderApunte(contenido)
      break
    case 'quiz':
      cuerpo = renderQuiz(contenido)
      break
    case 'actividad':
      cuerpo = renderActividad(contenido)
      break
    case 'ejercicios':
      cuerpo = renderEjercicios(contenido)
      break
    case 'rubrica':
      cuerpo = renderRubrica(contenido)
      break
    case 'outline_presentacion':
      cuerpo = renderOutline(contenido)
      break
    case 'recursos_externos':
      cuerpo = renderRecursosExternos(contenido)
      break
  }

  return [
    `<header><h1>${escapeHtml(obj.titulo)}</h1>${renderParrafo(obj.descripcion, 'descripcion')}</header>`,
    cuerpo,
    renderFuentes(obj.source_refs),
  ].join('\n')
}

export const BASE_CSS = `
:root { color-scheme: light; }
* { box-sizing: border-box; }
body {
  font-family: 'Segoe UI', system-ui, sans-serif;
  color: #1f2937;
  line-height: 1.55;
  margin: 0;
  padding: 2rem 1.25rem 4rem;
  max-width: 52rem;
  margin-inline: auto;
}
h1 { color: #00335b; border-bottom: 3px solid #c8a24b; padding-bottom: 0.4rem; }
h2, h3 { color: #00335b; }
p.descripcion { color: #5b6472; font-style: italic; }
p.meta, p.notas { color: #5b6472; font-size: 0.9rem; }
table.rubrica { border-collapse: collapse; width: 100%; }
table.rubrica th, table.rubrica td { border: 1px solid #d6dae0; padding: 0.5rem; vertical-align: top; text-align: left; }
table.rubrica th { background: #00335b; color: #fff; }
fieldset.quiz-pregunta { border: 1px solid #d6dae0; border-radius: 6px; margin-bottom: 1rem; padding: 0.75rem 1rem; }
fieldset.quiz-pregunta.correcta { border-color: #15803d; }
fieldset.quiz-pregunta.incorrecta { border-color: #b91c1c; }
label.quiz-opcion { display: block; padding: 0.15rem 0; }
.quiz-feedback { font-size: 0.9rem; color: #5b6472; }
button.quiz-enviar {
  background: #00335b; color: #fff; border: 0; border-radius: 6px;
  padding: 0.5rem 1.25rem; font-size: 1rem; cursor: pointer;
}
#quiz-resultado { font-weight: 600; }
details.ejercicio { border: 1px solid #d6dae0; border-radius: 6px; padding: 0.5rem 0.75rem; margin-bottom: 0.5rem; }
footer.fuentes { margin-top: 2.5rem; border-top: 1px solid #d6dae0; font-size: 0.9rem; }
nav.indice ul { list-style: none; padding: 0; }
nav.indice li { margin: 0.35rem 0; }
nav.indice a { color: #00335b; text-decoration: none; }
nav.indice a:hover { text-decoration: underline; }
.badge { display: inline-block; background: #eef2f7; color: #5b6472; border-radius: 999px; padding: 0.05rem 0.6rem; font-size: 0.75rem; margin-left: 0.4rem; }
`

export function buildPageHtml(args: {
  titulo: string
  bodyHtml: string
  cssHref: string
  scriptsHref?: Array<string>
  bodyAttrs?: string
}): string {
  const scripts = (args.scriptsHref ?? [])
    .map((src) => `<script src="${escapeHtml(src)}"></script>`)
    .join('\n')

  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(args.titulo)}</title>
<link rel="stylesheet" href="${escapeHtml(args.cssHref)}" />
${scripts}
</head>
<body${args.bodyAttrs ? ` ${args.bodyAttrs}` : ''}>
${args.bodyHtml}
</body>
</html>`
}
