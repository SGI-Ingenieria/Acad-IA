// Render de learning_objects a HTML estático. Lo comparten el exportador
// SCORM 1.2 (cada página se envuelve como SCO) y el bundle HTML de preview.

import { type H5PActividad, renderH5PActividad } from './h5p-render.ts'

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

function readBracedGroup(tex: string, start: number) {
  if (tex[start] !== '{') return null
  let depth = 0
  for (let i = start; i < tex.length; i++) {
    const char = tex[i]
    if (char === '{') depth++
    if (char === '}') depth--
    if (depth === 0) {
      return {
        value: tex.slice(start + 1, i),
        next: i + 1,
      }
    }
  }
  return null
}

function renderLatexExpression(tex: string): string {
  let out = ''
  let i = 0
  const input = tex
    .trim()
    .replaceAll('...', '\\ldots')
    .replaceAll('…', '\\ldots')

  while (i < input.length) {
    const char = input[i]
    const rest = input.slice(i)

    if (/\s/.test(char)) {
      i++
      continue
    }

    if (rest.startsWith('\\frac')) {
      const numerator = readBracedGroup(input, i + 5)
      const denominator = numerator
        ? readBracedGroup(input, numerator.next)
        : null
      if (numerator && denominator) {
        out += `<span class="math-frac"><span class="math-num">${renderLatexExpression(numerator.value)}</span><span class="math-den">${renderLatexExpression(denominator.value)}</span></span>`
        i = denominator.next
        continue
      }
    }

    if (rest.startsWith('\\ldots') || rest.startsWith('\\cdots')) {
      out += '<span class="math-ellipsis">...</span>'
      i += 7
      continue
    }

    if (rest.startsWith('\\times')) {
      out += '<span class="math-op">×</span>'
      i += 6
      continue
    }

    if (rest.startsWith('\\div')) {
      out += '<span class="math-op">÷</span>'
      i += 4
      continue
    }

    if (rest.startsWith('\\leq') || rest.startsWith('\\le')) {
      out += '<span class="math-op">≤</span>'
      i += rest.startsWith('\\leq') ? 4 : 3
      continue
    }

    if (rest.startsWith('\\geq') || rest.startsWith('\\ge')) {
      out += '<span class="math-op">≥</span>'
      i += rest.startsWith('\\geq') ? 4 : 3
      continue
    }

    if (rest.startsWith('\\neq')) {
      out += '<span class="math-op">≠</span>'
      i += 4
      continue
    }

    if (rest.startsWith('\\approx')) {
      out += '<span class="math-op">≈</span>'
      i += 7
      continue
    }

    const plainFraction = rest.match(/^(-?\d+)\s*\/\s*(-?\d+)/)
    if (plainFraction) {
      out += `<span class="math-frac"><span class="math-num">${escapeHtml(plainFraction[1])}</span><span class="math-den">${escapeHtml(plainFraction[2])}</span></span>`
      i += plainFraction[0].length
      continue
    }

    if ('+-=<>'.includes(char)) {
      out += `<span class="math-op">${escapeHtml(char)}</span>`
      i++
      continue
    }

    if ('()[]{}'.includes(char)) {
      out += `<span class="math-delim">${escapeHtml(char)}</span>`
      i++
      continue
    }

    const number = rest.match(/^\d+(?:\.\d+)?/)
    if (number) {
      out += `<span class="math-num">${escapeHtml(number[0])}</span>`
      i += number[0].length
      continue
    }

    const identifier = rest.match(/^[a-zA-ZñÑáéíóúÁÉÍÓÚüÜ]+/)
    if (identifier) {
      out += `<span class="math-var">${escapeHtml(identifier[0])}</span>`
      i += identifier[0].length
      continue
    }

    out += escapeHtml(char)
    i++
  }

  return out
}

function renderMath(tex: string): string {
  return `<span class="math" role="math" aria-label="${escapeHtml(tex)}">${renderLatexExpression(tex)}</span>`
}

function renderTextWithAutoMath(text: string): string {
  const fractionSeries =
    /\d+\s*\/\s*\d+(?:\s*[+\-−]\s*\d+\s*\/\s*\d+)*(?:\s*[+\-−]\s*(?:\.{3}|…))?/g
  let out = ''
  let last = 0

  for (const match of text.matchAll(fractionSeries)) {
    const index = match.index ?? 0
    out += escapeHtml(text.slice(last, index))
    out += renderMath(match[0].replaceAll('−', '-'))
    last = index + match[0].length
  }

  out += escapeHtml(text.slice(last))
  return out
}

function renderText(value: unknown): string {
  const text = String(value ?? '')
  let out = ''
  let i = 0

  while (i < text.length) {
    const inlineStart = text.indexOf('\\(', i)
    const displayStart = text.indexOf('\\[', i)
    const dollarStart = text.indexOf('$$', i)
    const starts = [inlineStart, displayStart, dollarStart].filter(
      (pos) => pos >= 0,
    )

    if (!starts.length) {
      out += renderTextWithAutoMath(text.slice(i))
      break
    }

    const nextStart = Math.min(...starts)
    out += renderTextWithAutoMath(text.slice(i, nextStart))

    const isInline = nextStart === inlineStart
    const isDisplay = nextStart === displayStart
    const startToken = isInline ? '\\(' : isDisplay ? '\\[' : '$$'
    const endToken = isInline ? '\\)' : isDisplay ? '\\]' : '$$'
    const contentStart = nextStart + startToken.length
    const end = text.indexOf(endToken, contentStart)

    if (end < 0) {
      out += escapeHtml(text.slice(nextStart))
      break
    }

    out += renderMath(text.slice(contentStart, end))
    i = end + endToken.length
  }

  return out
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
  return `<ul>${items.map((item) => `<li>${renderText(item)}</li>`).join('')}</ul>`
}

function renderParrafo(texto: unknown, clase = ''): string {
  const value = str(texto)
  if (!value) return ''
  const attr = clase ? ` class="${clase}"` : ''
  return `<p${attr}>${renderText(value)}</p>`
}

function renderApunte(c: Record<string, unknown>): string {
  const secciones = asArray(c.secciones)
    .map((seccion) => {
      const s = asRecord(seccion)
      if (!s) return ''
      return `<section><h3>${renderText(s.titulo)}</h3>${renderParrafo(s.desarrollo)}</section>`
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
  <legend>${i + 1}. ${renderText(p.pregunta)}</legend>
  ${p.opciones
    .map(
      (o) => `
  <label class="quiz-opcion">
    <input type="radio" name="q${i}" value="${escapeHtml(o.id)}" />
    <span>${renderText(o.texto)}</span>
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
      retroHtml: renderText(p.retroalimentacion),
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
  var submit = form.querySelector('.quiz-enviar')
  form.addEventListener('submit', function (ev) {
    ev.preventDefault()
    if (form.dataset.submitted === 'true') return
    form.dataset.submitted = 'true'
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
      feedback.innerHTML = (ok ? 'Correcto. ' : 'Incorrecto. ') + clave.retroHtml
    })
    form.querySelectorAll('input').forEach(function (input) {
      input.disabled = true
    })
    if (submit) {
      submit.disabled = true
      submit.textContent = 'Intento enviado'
    }
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
          .map((paso) => `<li>${renderText(paso)}</li>`)
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
  // New H5P format — delegate to h5p-render; each activity is a full standalone page.
  // When rendered inside a single-page HTML bundle, wrap each in a section.
  if (Array.isArray(c.actividades_h5p) && c.actividades_h5p.length > 0) {
    return (c.actividades_h5p as H5PActividad[])
      .map(
        (act) =>
          `<section class="h5p-actividad-embed">${renderH5PActividad(act)}</section>`,
      )
      .join('\n')
  }

  // Legacy format (backward compat)
  const ejercicios = asArray(c.ejercicios)
    .map((ejercicio, i) => {
      const e = asRecord(ejercicio)
      if (!e) return ''
      return `
<details class="ejercicio">
  <summary>${i + 1}. ${renderText(e.enunciado)} <em>(${escapeHtml(e.dificultad)})</em></summary>
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
          return `<li><strong>${renderText(n.nivel)}</strong> (${escapeHtml(n.puntaje)}): ${renderText(n.descripcion)}</li>`
        })
        .join('')
      return `
<tr>
  <td>${renderText(cr.criterio)}</td>
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
  <h3>${escapeHtml(d.numero)}. ${renderText(d.titulo)}</h3>
  ${renderLista(asArray(d.puntos))}
  ${str(d.notas_docente) ? renderParrafo(`Notas del docente: ${str(d.notas_docente)}`, 'notas') : ''}
</section>`
    })
    .join('')

  return `<h2>${renderText(c.titulo_presentacion)}</h2>${diapositivas}`
}

function renderRecursosExternos(c: Record<string, unknown>): string {
  const recursos = asArray(c.recursos)
    .map((recurso) => {
      const r = asRecord(recurso)
      if (!r) return ''
      const url = str(r.url)
      const titulo = url
        ? `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${renderText(r.titulo)}</a>`
        : renderText(r.titulo)
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
    `<header><h1>${renderText(obj.titulo)}</h1>${renderParrafo(obj.descripcion, 'descripcion')}</header>`,
    cuerpo,
    renderFuentes(obj.source_refs),
  ].join('\n')
}

export const BASE_CSS = `
@font-face {
  font-family: 'Indivisa Text Sans';
  src: url('fonts/IndivisaTextSans-Regular.otf') format('opentype');
  font-weight: 400;
  font-style: normal;
}
@font-face {
  font-family: 'Indivisa Text Sans';
  src: url('fonts/IndivisaTextSans-Bold.otf') format('opentype');
  font-weight: 700;
  font-style: normal;
}
@font-face {
  font-family: 'Indivisa Text Serif';
  src: url('fonts/IndivisaTextSerif-Regular.otf') format('opentype');
  font-weight: 400;
  font-style: normal;
}
@font-face {
  font-family: 'Indivisa Text Serif';
  src: url('fonts/IndivisaTextSerif-Bold.otf') format('opentype');
  font-weight: 700;
  font-style: normal;
}
:root { color-scheme: light; }
* { box-sizing: border-box; }
body {
  font-family: 'Indivisa Text Sans', system-ui, sans-serif;
  color: #3c3c3c;
  line-height: 1.55;
  margin: 0;
  padding: 2rem 1.25rem 4rem;
  max-width: 52rem;
  margin-inline: auto;
  border-top: 0.35rem solid #28356e;
}
h1 {
  color: #28356e;
  border-bottom: 3px solid #0d99d9;
  font-family: 'Indivisa Text Serif', Georgia, serif;
  padding-bottom: 0.4rem;
}
h2, h3 {
  color: #28356e;
  font-family: 'Indivisa Text Serif', Georgia, serif;
}
a { color: #0d99d9; }
p.descripcion { color: #313c41; font-style: italic; }
p.meta, p.notas { color: #313c41; font-size: 0.9rem; }
table.rubrica { border-collapse: collapse; width: 100%; }
table.rubrica th, table.rubrica td { border: 1px solid #95d2f1; padding: 0.5rem; vertical-align: top; text-align: left; }
table.rubrica th { background: #28356e; color: #fff; }
fieldset.quiz-pregunta { border: 1px solid #95d2f1; border-radius: 6px; margin-bottom: 1rem; padding: 0.75rem 1rem; }
fieldset.quiz-pregunta.correcta { border-color: #15803d; }
fieldset.quiz-pregunta.incorrecta { border-color: #d72130; }
label.quiz-opcion { display: block; padding: 0.15rem 0; }
.quiz-feedback { font-size: 0.9rem; color: #313c41; }
button.quiz-enviar {
  background: #28356e; color: #fff; border: 0; border-radius: 6px;
  padding: 0.5rem 1.25rem; font-size: 1rem; cursor: pointer;
}
button.quiz-enviar:disabled { background: #313c41; cursor: not-allowed; }
#quiz-resultado { font-weight: 600; }
details.ejercicio { border: 1px solid #95d2f1; border-radius: 6px; padding: 0.5rem 0.75rem; margin-bottom: 0.5rem; }
footer.fuentes { margin-top: 2.5rem; border-top: 1px solid #95d2f1; font-size: 0.9rem; }
nav.indice ul { list-style: none; padding: 0; }
nav.indice li { margin: 0.35rem 0; }
nav.indice a { color: #28356e; text-decoration: none; }
nav.indice a:hover { text-decoration: underline; }
.badge { display: inline-block; background: #eef8fd; color: #313c41; border-radius: 999px; padding: 0.05rem 0.6rem; font-size: 0.75rem; margin-left: 0.4rem; }
.math {
  display: inline-flex;
  align-items: center;
  gap: 0.18em;
  font-family: 'Indivisa Text Serif', 'Cambria Math', Georgia, serif;
  font-size: 1.08em;
  line-height: 1;
  white-space: nowrap;
  vertical-align: -0.18em;
}
.math-frac {
  display: inline-grid;
  grid-template-rows: auto auto;
  min-width: 0.9em;
  text-align: center;
  vertical-align: middle;
}
.math-frac > .math-num {
  border-bottom: 0.08em solid currentColor;
  padding: 0 0.12em 0.08em;
}
.math-frac > .math-den { padding: 0.08em 0.12em 0; }
.math-op { margin: 0 0.2em; }
.math-ellipsis { letter-spacing: 0.1em; margin-left: 0.12em; }
.math-var { font-style: italic; }
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
