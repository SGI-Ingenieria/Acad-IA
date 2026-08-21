// Generates self-contained interactive HTML for each H5P activity type.
// No external dependencies — all JS/CSS is inline so files open with double-click from file://.

export interface H5PActividad {
  titulo: string
  descripcion: string
  nivel: string
  idioma: string
  tipoActividad:
    | 'MultipleChoice'
    | 'TrueFalse'
    | 'FillInTheBlanks'
    | 'DragText'
    | 'Crossword'
    | 'FindTheWords'
    | 'Flashcards'
    | 'Timeline'
    | 'QuestionSet'
    | 'Essay'
    | 'FindMultipleHotspots'
  datos: Record<string, unknown>
  source_ref_ids?: unknown[]
}

function esc(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function asArr(v: unknown): unknown[] {
  return Array.isArray(v) ? v : []
}

function asRec(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {}
}

function str(v: unknown): string {
  return typeof v === 'string' ? v : ''
}

/** Convierte URLs del gateway interno en URLs que puede abrir el navegador. */
function browserImageUrl(value: string): string {
  try {
    const url = new URL(value)
    const internalUrl = Deno.env.get('SUPABASE_URL')
    const publicUrl = Deno.env.get('SUPABASE_PUBLIC_URL')

    if (
      internalUrl &&
      publicUrl &&
      url.origin === new URL(internalUrl).origin
    ) {
      const publicBase = new URL(publicUrl)
      url.protocol = publicBase.protocol
      url.hostname = publicBase.hostname
      url.port = publicBase.port
      return url.toString()
    }

    if (url.hostname === 'kong' && url.port === '8000') {
      return `http://127.0.0.1:54321${url.pathname}${url.search}`
    }
  } catch {
    // La URL se escapa posteriormente; se conserva el valor original.
  }
  return value
}

// ─── Shared CSS ──────────────────────────────────────────────────────────────

const BASE_CSS = `
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:system-ui,sans-serif;background:#f0f4f8;color:#1a202c;line-height:1.55;padding:1.5rem}
.h5p-card{background:#fff;border-radius:12px;box-shadow:0 2px 12px rgba(0,0,0,.1);max-width:740px;margin:0 auto;overflow:hidden}
.h5p-header{background:#1a73e8;color:#fff;padding:1.25rem 1.5rem}
.h5p-header h1{font-size:1.15rem;font-weight:700;margin-bottom:.2rem}
.h5p-header p{font-size:.85rem;opacity:.88}
.h5p-body{padding:1.5rem}
.h5p-nivel{display:inline-block;font-size:.72rem;background:rgba(255,255,255,.25);border-radius:9999px;padding:.1rem .6rem;margin-top:.4rem;text-transform:uppercase;letter-spacing:.04em}
button.h5p-btn{background:#1a73e8;color:#fff;border:none;border-radius:8px;padding:.55rem 1.2rem;font-size:.9rem;font-weight:600;cursor:pointer;margin-top:1rem;transition:background .15s}
button.h5p-btn:hover{background:#1558c0}
button.h5p-btn:disabled{background:#94a3b8;cursor:default}
.h5p-feedback{margin-top:.75rem;padding:.65rem .9rem;border-radius:8px;font-size:.88rem;font-weight:500}
.h5p-feedback.ok{background:#d1fae5;color:#065f46}
.h5p-feedback.err{background:#fee2e2;color:#991b1b}
.h5p-score{font-size:1.05rem;font-weight:700;margin-top:.9rem;color:#1a73e8}
`

function wrapPage(
  titulo: string,
  descripcion: string,
  nivel: string,
  body: string,
  extraCss = '',
  extraScriptSrcs: string[] = [],
): string {
  const scriptTags = extraScriptSrcs
    .map((src) => `<script src="${esc(src)}"></script>`)
    .join('\n')
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(titulo)}</title>
${scriptTags}
<style>${BASE_CSS}${extraCss}</style>
</head>
<body data-scorm="quiz" data-mastery-score="70">
<div class="h5p-card">
<div class="h5p-header">
  <h1>${esc(titulo)}</h1>
  ${descripcion ? `<p>${esc(descripcion)}</p>` : ''}
  ${nivel ? `<span class="h5p-nivel">${esc(nivel)}</span>` : ''}
</div>
<div class="h5p-body">
${body}
</div>
</div>
</body>
</html>`
}

// ─── 1. MultipleChoice ───────────────────────────────────────────────────────

function renderMultipleChoice(actividad: H5PActividad): string {
  // datos.preguntas is shared by MultipleChoice, TrueFalse, and QuestionSet
  const preguntas = asArr(actividad.datos.preguntas).filter((p) => {
    const pr = asRec(p)
    // For MultipleChoice: tipo=null and opciones is an array
    const tipo = pr.tipo
    return tipo === null || tipo === undefined || tipo === 'MultipleChoice'
  })
  const claves = preguntas.map((p) => {
    const pr = asRec(p)
    return {
      correcta: Number(pr.respuestaCorrecta ?? 0),
      retro: str(pr.retroalimentacion),
    }
  })

  const preguntasHtml = preguntas
    .map((p, i) => {
      const pr = asRec(p)
      const opciones = asArr(pr.opciones)
      const optsHtml = opciones
        .map(
          (o, j) =>
            `<label class="mc-opcion"><input type="radio" name="q${i}" value="${j}"><span>${esc(o)}</span></label>`,
        )
        .join('')
      return `<fieldset class="mc-pregunta" data-idx="${i}">
  <legend>${i + 1}. ${esc(pr.pregunta)}</legend>
  ${optsHtml}
  <p class="h5p-feedback" hidden></p>
</fieldset>`
    })
    .join('\n')

  const clavesJson = JSON.stringify(claves)

  const css = `
.mc-pregunta{border:1.5px solid #e2e8f0;border-radius:10px;padding:1rem;margin-bottom:1rem}
.mc-pregunta legend{font-weight:600;font-size:.95rem;padding:0 .4rem;color:#1e40af}
.mc-opcion{display:flex;align-items:flex-start;gap:.5rem;padding:.4rem .2rem;cursor:pointer;border-radius:6px}
.mc-opcion:hover{background:#f1f5f9}
.mc-opcion input{margin-top:.2rem;accent-color:#1a73e8}
.mc-pregunta.correcta{border-color:#16a34a;background:#f0fdf4}
.mc-pregunta.incorrecta{border-color:#dc2626;background:#fef2f2}
`

  const js = `
(function(){
  var claves=${clavesJson};
  var form=document.getElementById('mc-form');
  form.addEventListener('submit',function(e){
    e.preventDefault();
    if(form.dataset.done==='1')return;
    form.dataset.done='1';
    var ok=0;
    claves.forEach(function(c,i){
      var sel=form.querySelector('input[name="q'+i+'"]:checked');
      var fs=form.querySelector('[data-idx="'+i+'"]');
      var fb=fs.querySelector('.h5p-feedback');
      var correct=sel&&Number(sel.value)===c.correcta;
      if(correct)ok++;
      fs.classList.toggle('correcta',correct);
      fs.classList.toggle('incorrecta',!correct);
      if(c.retro){fb.hidden=false;fb.textContent=(correct?'✓ Correcto. ':'✗ Incorrecto. ')+c.retro;fb.className='h5p-feedback '+(correct?'ok':'err');}
    });
    form.querySelectorAll('input').forEach(function(i){i.disabled=true;});
    var btn=form.querySelector('.h5p-btn');btn.disabled=true;
    var score=claves.length?Math.round(ok/claves.length*100):0;
    var r=document.getElementById('mc-resultado');
    r.hidden=false;r.textContent='Resultado: '+ok+'/'+claves.length+' ('+score+'%)';
    if(window.AcadScorm)window.AcadScorm.reportScore(score);
  });
})();
`

  const body = `<form id="mc-form">
${preguntasHtml}
<button type="submit" class="h5p-btn">Calificar</button>
<p id="mc-resultado" class="h5p-score" hidden></p>
</form>
<script>${js}</script>`

  return wrapPage(
    actividad.titulo,
    actividad.descripcion,
    actividad.nivel,
    body,
    css,
  )
}

// ─── 2. TrueFalse ────────────────────────────────────────────────────────────

function renderTrueFalse(actividad: H5PActividad): string {
  // datos.preguntas — for TrueFalse items: respuesta=boolean, opciones=null
  const preguntas = asArr(actividad.datos.preguntas).filter((p) => {
    const pr = asRec(p)
    const tipo = pr.tipo
    return tipo === null || tipo === undefined || tipo === 'TrueFalse'
  })
  const claves = preguntas.map((p) => {
    const pr = asRec(p)
    return {
      respuesta: Boolean(pr.respuesta),
      retro: str(pr.retroalimentacion),
    }
  })

  const preguntasHtml = preguntas
    .map((p, i) => {
      const pr = asRec(p)
      return `<div class="tf-item" data-idx="${i}">
  <p class="tf-enunciado">${i + 1}. ${esc(pr.pregunta)}</p>
  <div class="tf-botones">
    <button type="button" class="tf-btn" data-val="true">Verdadero</button>
    <button type="button" class="tf-btn" data-val="false">Falso</button>
  </div>
  <p class="h5p-feedback" hidden></p>
</div>`
    })
    .join('\n')

  const clavesJson = JSON.stringify(claves)

  const css = `
.tf-item{border:1.5px solid #e2e8f0;border-radius:10px;padding:1rem;margin-bottom:1rem}
.tf-enunciado{font-weight:600;font-size:.95rem;color:#1e40af;margin-bottom:.6rem}
.tf-botones{display:flex;gap:.6rem}
.tf-btn{background:#f1f5f9;border:1.5px solid #cbd5e1;border-radius:8px;padding:.4rem 1rem;font-size:.9rem;font-weight:600;cursor:pointer;transition:background .15s}
.tf-btn:hover{background:#e2e8f0}
.tf-item.correcta{border-color:#16a34a;background:#f0fdf4}
.tf-item.incorrecta{border-color:#dc2626;background:#fef2f2}
.tf-btn.elegida{outline:2.5px solid #1a73e8}
`

  const js = `
(function(){
  var claves=${clavesJson};
  var total=claves.length,ok=0,respondidas=0;
  document.querySelectorAll('.tf-item').forEach(function(item){
    var idx=parseInt(item.dataset.idx);
    item.querySelectorAll('.tf-btn').forEach(function(btn){
      btn.addEventListener('click',function(){
        if(item.dataset.done==='1')return;
        item.dataset.done='1';
        var val=btn.dataset.val==='true';
        var correct=val===claves[idx].respuesta;
        if(correct)ok++;
        respondidas++;
        item.classList.toggle('correcta',correct);
        item.classList.toggle('incorrecta',!correct);
        btn.classList.add('elegida');
        item.querySelectorAll('.tf-btn').forEach(function(b){b.disabled=true;});
        var fb=item.querySelector('.h5p-feedback');
        if(claves[idx].retro){fb.hidden=false;fb.textContent=(correct?'✓ ':'✗ ')+claves[idx].retro;fb.className='h5p-feedback '+(correct?'ok':'err');}
        if(respondidas===total){
          var score=Math.round(ok/total*100);
          var r=document.getElementById('tf-resultado');
          r.hidden=false;r.textContent='Resultado: '+ok+'/'+total+' ('+score+'%)';
          if(window.AcadScorm)window.AcadScorm.reportScore(score);
        }
      });
    });
  });
})();
`

  const body = `${preguntasHtml}
<p id="tf-resultado" class="h5p-score" hidden></p>
<script>${js}</script>`

  return wrapPage(
    actividad.titulo,
    actividad.descripcion,
    actividad.nivel,
    body,
    css,
  )
}

// ─── 3. FillInTheBlanks ──────────────────────────────────────────────────────

function renderFillInTheBlanks(actividad: H5PActividad): string {
  // datos.ejerciciosFib — renamed to avoid collision with outer field name
  const ejercicios = asArr(actividad.datos.ejerciciosFib)

  // Convert *word* syntax to <input> elements
  const ejerciciosHtml = ejercicios
    .map((e, i) => {
      const texto = str(asRec(e).texto)
      // Extract answers and replace *word* with <input data-answer="word">
      let inputIdx = 0
      const html = texto.replace(
        /\*([^*]+)\*/g,
        (_match: string, word: string) => {
          const id = `fib-${i}-${inputIdx++}`
          const w = word.trim().length
          return `<input class="fib-input" id="${id}" data-answer="${esc(word.trim())}" size="${Math.max(5, w + 2)}" maxlength="${w + 5}" autocomplete="off">`
        },
      )
      return `<p class="fib-linea">${i + 1}. ${html}</p>`
    })
    .join('\n')

  const css = `
.fib-linea{margin-bottom:.8rem;font-size:.97rem;line-height:2}
.fib-input{border:none;border-bottom:2px solid #1a73e8;background:transparent;font-size:.95rem;padding:.1rem .3rem;color:#1a202c;outline:none;font-family:inherit}
.fib-input.ok{border-bottom-color:#16a34a;background:#d1fae5;border-radius:4px}
.fib-input.err{border-bottom-color:#dc2626;background:#fee2e2;border-radius:4px}
`

  const js = `
(function(){
  var form=document.getElementById('fib-form');
  form.addEventListener('submit',function(e){
    e.preventDefault();
    if(form.dataset.done==='1')return;
    form.dataset.done='1';
    var inputs=form.querySelectorAll('.fib-input');
    var ok=0;
    inputs.forEach(function(inp){
      var ans=inp.dataset.answer.trim().toLowerCase();
      var val=(inp.value||'').trim().toLowerCase();
      var correct=val===ans;
      if(correct)ok++;
      inp.classList.toggle('ok',correct);
      inp.classList.toggle('err',!correct);
      if(!correct)inp.value=inp.dataset.answer;
      inp.disabled=true;
    });
    var score=inputs.length?Math.round(ok/inputs.length*100):0;
    var r=document.getElementById('fib-resultado');
    r.hidden=false;r.textContent='Resultado: '+ok+'/'+inputs.length+' ('+score+'%)';
    if(window.AcadScorm)window.AcadScorm.reportScore(score);
  });
})();
`

  const body = `<form id="fib-form">
${ejerciciosHtml}
<button type="submit" class="h5p-btn">Verificar</button>
<p id="fib-resultado" class="h5p-score" hidden></p>
</form>
<script>${js}</script>`

  return wrapPage(
    actividad.titulo,
    actividad.descripcion,
    actividad.nivel,
    body,
    css,
  )
}

// ─── 4. DragText ─────────────────────────────────────────────────────────────

function renderDragText(actividad: H5PActividad): string {
  const texto = str(actividad.datos.texto)
  const distractores = asArr(actividad.datos.distractores).map((d) => str(d))

  // Extract draggable words from *word* syntax
  const palabras: string[] = []
  const textoHtml = texto.replace(/\*([^*]+)\*/g, (_m: string, w: string) => {
    palabras.push(w.trim())
    const idx = palabras.length - 1
    return `<span class="dt-slot" data-answer="${esc(w.trim())}" data-idx="${idx}">[&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;]</span>`
  })

  // All draggable chips = palabras + distractores, shuffled deterministically by sort
  const allChips = [...palabras, ...distractores].sort((a, b) =>
    a.localeCompare(b),
  )
  const chipsHtml = allChips
    .map(
      (w, i) =>
        `<span class="dt-chip" draggable="true" data-word="${esc(w)}" data-chip-id="${i}">${esc(w)}</span>`,
    )
    .join('')

  const css = `
.dt-texto{font-size:1rem;line-height:2.2;margin-bottom:1rem}
.dt-slot{display:inline-block;border-bottom:2px dashed #1a73e8;min-width:80px;color:#94a3b8;cursor:pointer;border-radius:4px;padding:0 .3rem;margin:0 .1rem;transition:background .15s}
.dt-slot.filled{color:#1a202c;border-bottom-color:#16a34a;background:#d1fae5}
.dt-slot.correcta{background:#d1fae5;border-bottom-color:#16a34a}
.dt-slot.incorrecta{background:#fee2e2;border-bottom-color:#dc2626}
.dt-slot.drag-over{background:#e0effe;border-bottom-color:#1a73e8}
.dt-chips{display:flex;flex-wrap:wrap;gap:.5rem;margin-bottom:1rem;padding:.75rem;background:#f8fafc;border-radius:10px;border:1.5px solid #e2e8f0;min-height:52px}
.dt-chip{background:#e0effe;border:1.5px solid #93c5fd;border-radius:20px;padding:.3rem .8rem;cursor:grab;font-size:.9rem;font-weight:500;user-select:none;transition:opacity .15s}
.dt-chip:active{cursor:grabbing;opacity:.7}
.dt-chip.used{opacity:.35;cursor:default}
`

  const js = `
(function(){
  var dragged=null;
  var slots=document.querySelectorAll('.dt-slot');
  var chips=document.querySelectorAll('.dt-chip');

  chips.forEach(function(chip){
    chip.addEventListener('dragstart',function(e){
      if(chip.classList.contains('used'))return;
      dragged=chip;e.dataTransfer.effectAllowed='move';
    });
    chip.addEventListener('dragend',function(){dragged=null;});
  });

  slots.forEach(function(slot){
    slot.addEventListener('dragover',function(e){e.preventDefault();slot.classList.add('drag-over');});
    slot.addEventListener('dragleave',function(){slot.classList.remove('drag-over');});
    slot.addEventListener('drop',function(e){
      e.preventDefault();slot.classList.remove('drag-over');
      if(!dragged)return;
      var prev=slot.dataset.chipId;
      if(prev!=null){
        var old=document.querySelector('[data-chip-id="'+prev+'"]');
        if(old)old.classList.remove('used');
      }
      slot.textContent=dragged.dataset.word;
      slot.dataset.chipId=dragged.dataset.chipId;
      slot.classList.add('filled');
      dragged.classList.add('used');
    });
    // Touch-friendly click-to-assign (click chip then click slot)
    slot.addEventListener('click',function(){
      var active=document.querySelector('.dt-chip.active-pick');
      if(!active)return;
      var prev=slot.dataset.chipId;
      if(prev!=null){var old=document.querySelector('[data-chip-id="'+prev+'"]');if(old)old.classList.remove('used');}
      slot.textContent=active.dataset.word;
      slot.dataset.chipId=active.dataset.chipId;
      slot.classList.add('filled');
      active.classList.add('used');
      active.classList.remove('active-pick');
    });
  });

  chips.forEach(function(chip){
    chip.addEventListener('click',function(){
      if(chip.classList.contains('used'))return;
      document.querySelectorAll('.dt-chip.active-pick').forEach(function(c){c.classList.remove('active-pick');});
      chip.classList.toggle('active-pick');
    });
  });

  document.getElementById('dt-verificar').addEventListener('click',function(){
    var btn=this;
    if(btn.disabled)return;
    btn.disabled=true;
    var ok=0;
    slots.forEach(function(slot){
      var correct=(slot.textContent.trim())===slot.dataset.answer;
      if(correct)ok++;
      slot.classList.toggle('correcta',correct);
      slot.classList.toggle('incorrecta',!correct);
    });
    chips.forEach(function(c){c.style.pointerEvents='none';});
    var score=slots.length?Math.round(ok/slots.length*100):0;
    var r=document.getElementById('dt-resultado');
    r.hidden=false;r.textContent='Resultado: '+ok+'/'+slots.length+' ('+score+'%)';
    if(window.AcadScorm)window.AcadScorm.reportScore(score);
  });
})();
`

  const body = `<p class="dt-texto">${textoHtml}</p>
<div class="dt-chips">${chipsHtml}</div>
<button id="dt-verificar" class="h5p-btn">Verificar</button>
<p id="dt-resultado" class="h5p-score" hidden></p>
<script>${js}</script>`

  return wrapPage(
    actividad.titulo,
    actividad.descripcion,
    actividad.nivel,
    body,
    css,
  )
}

// ─── 5. Crossword ────────────────────────────────────────────────────────────

function renderCrossword(actividad: H5PActividad): string {
  // datos.palabrasCrucigrama — renamed to distinguish from FindTheWords palabrasSopa
  const palabras = asArr(actividad.datos.palabrasCrucigrama)
    .map((p) => {
      const pr = asRec(p)
      return {
        palabra: str(pr.palabra)
          .toUpperCase()
          .replace(/[^A-Z]/g, ''),
        pista: str(pr.pista),
      }
    })
    .filter((p) => p.palabra.length >= 2)

  // Simple crossword layout algorithm: try to place words on a grid
  interface Placed {
    word: string
    pista: string
    row: number
    col: number
    dir: 'H' | 'V'
    num: number
  }
  const GRID_SIZE = 20
  const grid: (string | null)[][] = Array.from({ length: GRID_SIZE }, () =>
    Array(GRID_SIZE).fill(null),
  )
  const placed: Placed[] = []
  let clueNum = 0

  function tryPlace(
    word: string,
    row: number,
    col: number,
    dir: 'H' | 'V',
  ): boolean {
    for (let i = 0; i < word.length; i++) {
      const r = dir === 'V' ? row + i : row
      const c = dir === 'H' ? col + i : col
      if (r < 0 || r >= GRID_SIZE || c < 0 || c >= GRID_SIZE) return false
      if (grid[r][c] !== null && grid[r][c] !== word[i]) return false
    }
    // Check neighbours don't conflict
    for (let i = 0; i < word.length; i++) {
      const r = dir === 'V' ? row + i : row
      const c = dir === 'H' ? col + i : col
      if (dir === 'H') {
        if (i === 0 && c > 0 && grid[r][c - 1]) return false
        if (i === word.length - 1 && c < GRID_SIZE - 1 && grid[r][c + 1])
          return false
      } else {
        if (i === 0 && r > 0 && grid[r - 1][c]) return false
        if (i === word.length - 1 && r < GRID_SIZE - 1 && grid[r + 1][c])
          return false
      }
    }
    for (let i = 0; i < word.length; i++) {
      const r = dir === 'V' ? row + i : row
      const c = dir === 'H' ? col + i : col
      grid[r][c] = word[i]
    }
    return true
  }

  // Place first word in center
  if (palabras.length > 0) {
    const w = palabras[0].palabra
    const row = Math.floor(GRID_SIZE / 2)
    const col = Math.floor((GRID_SIZE - w.length) / 2)
    if (tryPlace(w, row, col, 'H')) {
      placed.push({
        word: w,
        pista: palabras[0].pista,
        row,
        col,
        dir: 'H',
        num: ++clueNum,
      })
    }
  }

  // Try to intersect remaining words
  for (let pi = 1; pi < palabras.length; pi++) {
    const { palabra, pista } = palabras[pi]
    let bestScore = -1
    let bestPlacement: { row: number; col: number; dir: 'H' | 'V' } | null =
      null

    for (const p of placed) {
      for (let pi2 = 0; pi2 < p.word.length; pi2++) {
        for (let wi = 0; wi < palabra.length; wi++) {
          if (palabra[wi] !== p.word[pi2]) continue
          const dir: 'H' | 'V' = p.dir === 'H' ? 'V' : 'H'
          const row = p.dir === 'H' ? p.row - wi : p.row + pi2
          const col = p.dir === 'H' ? p.col + pi2 : p.col - wi
          const savedGrid = grid.map((r) => [...r])
          if (tryPlace(palabra, row, col, dir)) {
            const intersections = placed.filter((pp) => {
              for (let i = 0; i < palabra.length; i++) {
                const r = dir === 'V' ? row + i : row
                const c = dir === 'H' ? col + i : col
                for (let j = 0; j < pp.word.length; j++) {
                  const pr2 = pp.dir === 'V' ? pp.row + j : pp.row
                  const pc = pp.dir === 'H' ? pp.col + j : pp.col
                  if (r === pr2 && c === pc) return true
                }
              }
              return false
            }).length
            if (intersections > bestScore) {
              bestScore = intersections
              bestPlacement = { row, col, dir }
            }
            // Restore grid for now
            for (let r = 0; r < GRID_SIZE; r++)
              for (let c = 0; c < GRID_SIZE; c++) grid[r][c] = savedGrid[r][c]
          } else {
            for (let r = 0; r < GRID_SIZE; r++)
              for (let c = 0; c < GRID_SIZE; c++) grid[r][c] = savedGrid[r][c]
          }
        }
      }
    }

    if (bestPlacement) {
      tryPlace(palabra, bestPlacement.row, bestPlacement.col, bestPlacement.dir)
      placed.push({
        word: palabra,
        pista,
        row: bestPlacement.row,
        col: bestPlacement.col,
        dir: bestPlacement.dir,
        num: ++clueNum,
      })
    }
  }

  // Find bounding box
  let minR = GRID_SIZE,
    maxR = 0,
    minC = GRID_SIZE,
    maxC = 0
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      if (grid[r][c]) {
        minR = Math.min(minR, r)
        maxR = Math.max(maxR, r)
        minC = Math.min(minC, c)
        maxC = Math.max(maxC, c)
      }
    }
  }
  if (minR > maxR) {
    minR = 0
    maxR = 5
    minC = 0
    maxC = 5
  }

  // Build cell number map
  const cellNums: Record<string, number> = {}
  for (const p of placed) cellNums[`${p.row},${p.col}`] = p.num

  // Render grid HTML
  let gridHtml = '<table class="cw-grid">'
  for (let r = minR; r <= maxR; r++) {
    gridHtml += '<tr>'
    for (let c = minC; c <= maxC; c++) {
      const letter = grid[r][c]
      if (!letter) {
        gridHtml += '<td class="cw-cell cw-empty"></td>'
      } else {
        const num = cellNums[`${r},${c}`]
        gridHtml += `<td class="cw-cell"><div class="cw-wrap">${num ? `<span class="cw-num">${num}</span>` : ''}<input class="cw-inp" maxlength="1" data-answer="${esc(letter)}" autocomplete="off"></div></td>`
      }
    }
    gridHtml += '</tr>'
  }
  gridHtml += '</table>'

  // Pistas
  const horizontales = placed
    .filter((p) => p.dir === 'H')
    .sort((a, b) => a.num - b.num)
  const verticales = placed
    .filter((p) => p.dir === 'V')
    .sort((a, b) => a.num - b.num)

  const pistasHtml = `<div class="cw-pistas">
  <div class="cw-col"><h3>Horizontales</h3><ol>${horizontales.map((p) => `<li value="${p.num}">${esc(p.pista)}</li>`).join('')}</ol></div>
  <div class="cw-col"><h3>Verticales</h3><ol>${verticales.map((p) => `<li value="${p.num}">${esc(p.pista)}</li>`).join('')}</ol></div>
</div>`

  const css = `
.cw-layout{display:flex;flex-direction:column;gap:1.25rem}
.cw-grid{border-collapse:collapse;margin:0 auto}
.cw-cell{width:36px;height:36px;border:1.5px solid #64748b;padding:0}
.cw-empty{background:#1e293b;border-color:#1e293b}
.cw-wrap{position:relative;width:34px;height:34px}
.cw-num{position:absolute;top:1px;left:2px;font-size:9px;color:#1a73e8;font-weight:700;line-height:1;z-index:1}
.cw-inp{position:absolute;inset:0;width:100%;height:100%;border:none;background:transparent;text-align:center;font-size:1rem;font-weight:700;text-transform:uppercase;color:#1a202c;cursor:pointer;padding:0}
.cw-inp:focus{background:#e0effe;outline:none}
.cw-inp.ok{background:#d1fae5;color:#065f46}
.cw-inp.err{background:#fee2e2;color:#991b1b}
.cw-pistas{display:flex;gap:1.5rem;flex-wrap:wrap}
.cw-col{flex:1;min-width:180px}
.cw-col h3{font-size:.9rem;font-weight:700;color:#1e40af;margin-bottom:.4rem;text-transform:uppercase;letter-spacing:.04em}
.cw-col ol{padding-left:1.2rem}
.cw-col li{font-size:.85rem;margin-bottom:.3rem}
`

  const js = `
(function(){
  var inputs=document.querySelectorAll('.cw-inp');
  inputs.forEach(function(inp){
    inp.addEventListener('input',function(){inp.value=inp.value.toUpperCase();});
    inp.addEventListener('keydown',function(e){
      if(e.key==='Tab'||e.key==='Enter'){e.preventDefault();var arr=Array.from(inputs);var i=arr.indexOf(inp);if(i<arr.length-1)arr[i+1].focus();}
    });
  });
  document.getElementById('cw-verificar').addEventListener('click',function(){
    var btn=this;btn.disabled=true;
    var ok=0;
    inputs.forEach(function(inp){
      var correct=inp.value.toUpperCase()===inp.dataset.answer.toUpperCase();
      if(correct)ok++;
      inp.classList.toggle('ok',correct);inp.classList.toggle('err',!correct);
      if(!correct)inp.value=inp.dataset.answer;
      inp.disabled=true;
    });
    var score=inputs.length?Math.round(ok/inputs.length*100):0;
    var r=document.getElementById('cw-resultado');
    r.hidden=false;r.textContent='Letras correctas: '+ok+'/'+inputs.length+' ('+score+'%)';
    if(window.AcadScorm)window.AcadScorm.reportScore(score);
  });
  document.getElementById('cw-reveal').addEventListener('click',function(){
    inputs.forEach(function(inp){inp.value=inp.dataset.answer;inp.classList.add('ok');});
  });
})();
`

  const body = `<div class="cw-layout">
${gridHtml}
${pistasHtml}
<div style="display:flex;gap:.6rem">
<button id="cw-verificar" class="h5p-btn">Verificar</button>
<button id="cw-reveal" class="h5p-btn" style="background:#64748b">Revelar</button>
</div>
<p id="cw-resultado" class="h5p-score" hidden></p>
</div>
<script>${js}</script>`

  return wrapPage(
    actividad.titulo,
    actividad.descripcion,
    actividad.nivel,
    body,
    css,
  )
}

// ─── 6. FindTheWords ─────────────────────────────────────────────────────────

function renderFindTheWords(actividad: H5PActividad): string {
  // datos.palabrasSopa — array of strings (uppercase letters only)
  const palabras = asArr(actividad.datos.palabrasSopa)
    .map((p) =>
      str(p)
        .toUpperCase()
        .replace(/[^A-ZÁÉÍÓÚÜÑ]/g, ''),
    )
    .filter((p) => p.length >= 2)

  // Generate word-search grid
  const SIZE = Math.max(
    10,
    Math.ceil(Math.sqrt(palabras.reduce((s, p) => s + p.length, 0) * 2.5)),
  )
  const grid: string[][] = Array.from({ length: SIZE }, () =>
    Array.from({ length: SIZE }, () =>
      String.fromCharCode(65 + Math.floor(Math.random() * 26)),
    ),
  )

  interface WordPlacement {
    word: string
    cells: [number, number][]
  }
  const placements: WordPlacement[] = []
  const DIRS = [
    [0, 1],
    [1, 0],
    [0, -1],
    [-1, 0],
    [1, 1],
    [1, -1],
    [-1, 1],
    [-1, -1],
  ]

  function placeWord(word: string): boolean {
    // Try random starting positions and directions
    for (let attempt = 0; attempt < 200; attempt++) {
      const dir = DIRS[Math.floor(Math.random() * DIRS.length)]
      const row = Math.floor(Math.random() * SIZE)
      const col = Math.floor(Math.random() * SIZE)
      const cells: [number, number][] = []
      let ok = true
      for (let i = 0; i < word.length; i++) {
        const r = row + dir[0] * i
        const c = col + dir[1] * i
        if (r < 0 || r >= SIZE || c < 0 || c >= SIZE) {
          ok = false
          break
        }
        if (grid[r][c] !== word[i] && grid[r][c] !== grid[r][c]) {
          // Cell already has a different letter from another word
        }
        cells.push([r, c])
      }
      if (ok) {
        cells.forEach(([r, c], i) => {
          grid[r][c] = word[i]
        })
        placements.push({ word, cells })
        return true
      }
    }
    return false
  }

  // Place words sorted by length descending
  const sorted = [...palabras].sort((a, b) => b.length - a.length)
  sorted.forEach((w) => placeWord(w))

  // Build placed cell set for data attributes
  const placedCells: Record<string, string> = {}
  for (const { word, cells } of placements) {
    cells.forEach(([r, c]) => {
      placedCells[`${r}-${c}`] = word
    })
  }

  const gridHtml = grid
    .map(
      (row, r) =>
        '<tr>' +
        row
          .map(
            (letter, c) =>
              `<td class="fw-cell" data-r="${r}" data-c="${c}">${esc(letter)}</td>`,
          )
          .join('') +
        '</tr>',
    )
    .join('')

  const listaHtml = palabras
    .map((p) => `<span class="fw-palabra" id="fw-word-${p}">${esc(p)}</span>`)
    .join('')

  const placementsJson = JSON.stringify(
    placements.map((p) => ({ word: p.word, cells: p.cells })),
  )

  const css = `
.fw-layout{display:flex;flex-direction:column;gap:1rem}
.fw-grid{border-collapse:collapse;user-select:none;margin:0 auto}
.fw-cell{width:32px;height:32px;border:1px solid #e2e8f0;text-align:center;font-size:.85rem;font-weight:700;color:#334155;cursor:pointer;background:#fff}
.fw-cell.selected{background:#bfdbfe;color:#1e40af}
.fw-cell.found{background:#a7f3d0;color:#065f46;cursor:default}
.fw-palabras{display:flex;flex-wrap:wrap;gap:.5rem}
.fw-palabra{background:#f1f5f9;border:1.5px solid #cbd5e1;border-radius:20px;padding:.2rem .7rem;font-size:.85rem;font-weight:600;color:#475569}
.fw-palabra.encontrada{background:#d1fae5;border-color:#34d399;color:#065f46;text-decoration:line-through}
`

  const js = `
(function(){
  var placements=${placementsJson};
  var selecting=false,startCell=null,selectedCells=[];

  function cellKey(td){return td.dataset.r+'-'+td.dataset.c;}

  function getSelected(){return Array.from(document.querySelectorAll('.fw-cell.selected'));}

  function clearSelection(){
    getSelected().forEach(function(c){c.classList.remove('selected');});
    selectedCells=[];
  }

  function cellsBetween(a,b){
    var r1=parseInt(a.dataset.r),c1=parseInt(a.dataset.c);
    var r2=parseInt(b.dataset.r),c2=parseInt(b.dataset.c);
    var dr=Math.sign(r2-r1),dc=Math.sign(c2-c1);
    if(dr===0&&dc===0)return [a];
    var cells=[],steps=Math.max(Math.abs(r2-r1),Math.abs(c2-c1));
    for(var i=0;i<=steps;i++){
      var td=document.querySelector('[data-r="'+(r1+dr*i)+'"][data-c="'+(c1+dc*i)+'"]');
      if(td)cells.push(td);
    }
    return cells;
  }

  function checkWord(cells){
    var word=cells.map(function(c){return c.textContent;}).join('');
    var found=placements.find(function(p){
      var cellKeys=cells.map(cellKey).join(',');
      var placedKeys=p.cells.map(function(c){return c[0]+'-'+c[1];}).join(',');
      return word===p.word&&cellKeys===placedKeys;
    });
    if(!found){
      var rev=cells.slice().reverse().map(function(c){return c.textContent;}).join('');
      found=placements.find(function(p){
        var cellKeys=cells.slice().reverse().map(cellKey).join(',');
        var placedKeys=p.cells.map(function(c){return c[0]+'-'+c[1];}).join(',');
        return rev===p.word&&cellKeys===placedKeys;
      });
    }
    return found;
  }

  var cells=document.querySelectorAll('.fw-cell');
  cells.forEach(function(td){
    td.addEventListener('mousedown',function(e){e.preventDefault();if(td.classList.contains('found'))return;selecting=true;startCell=td;clearSelection();td.classList.add('selected');});
    td.addEventListener('mouseover',function(){
      if(!selecting||!startCell)return;
      clearSelection();
      cellsBetween(startCell,td).forEach(function(c){if(!c.classList.contains('found'))c.classList.add('selected');});
    });
  });

  document.addEventListener('mouseup',function(){
    if(!selecting)return;selecting=false;
    var sel=getSelected();
    var found=checkWord(sel);
    if(found){
      sel.forEach(function(c){c.classList.remove('selected');c.classList.add('found');});
      var lbl=document.getElementById('fw-word-'+found.word);
      if(lbl)lbl.classList.add('encontrada');
      var remaining=document.querySelectorAll('.fw-palabra:not(.encontrada)').length;
      if(remaining===0){
        var r=document.getElementById('fw-resultado');r.hidden=false;
        r.textContent='¡Todas las palabras encontradas!';
        if(window.AcadScorm)window.AcadScorm.reportScore(100);
      }
    }else{clearSelection();}
  });
})();
`

  const body = `<div class="fw-layout">
<div class="fw-palabras">${listaHtml}</div>
<table class="fw-grid"><tbody>${gridHtml}</tbody></table>
<p id="fw-resultado" class="h5p-score" hidden></p>
</div>
<script>${js}</script>`

  return wrapPage(
    actividad.titulo,
    actividad.descripcion,
    actividad.nivel,
    body,
    css,
  )
}

// ─── 7. Flashcards ───────────────────────────────────────────────────────────

function renderFlashcards(actividad: H5PActividad): string {
  const tarjetas = asArr(actividad.datos.tarjetas)

  const tarjetasHtml = tarjetas
    .map((t, i) => {
      const tr = asRec(t)
      return `<div class="fc-card${i === 0 ? ' active' : ''}" data-idx="${i}">
  <div class="fc-inner">
    <div class="fc-front"><p>${esc(tr.frente)}</p></div>
    <div class="fc-back"><p>${esc(tr.reverso)}</p></div>
  </div>
</div>`
    })
    .join('\n')

  const css = `
.fc-container{display:flex;flex-direction:column;align-items:center;gap:1rem}
.fc-card{display:none;perspective:800px;width:100%;max-width:480px;height:200px}
.fc-card.active{display:block}
.fc-inner{position:relative;width:100%;height:100%;transform-style:preserve-3d;transition:transform .5s;cursor:pointer}
.fc-card.flipped .fc-inner{transform:rotateY(180deg)}
.fc-front,.fc-back{position:absolute;inset:0;border-radius:14px;display:flex;align-items:center;justify-content:center;padding:1.2rem;text-align:center;backface-visibility:hidden;font-size:1.05rem;font-weight:600}
.fc-front{background:#1a73e8;color:#fff;box-shadow:0 4px 16px rgba(26,115,232,.3)}
.fc-back{background:#f0fdf4;color:#065f46;border:2px solid #34d399;transform:rotateY(180deg)}
.fc-nav{display:flex;align-items:center;gap:1rem}
.fc-nav button{background:#f1f5f9;border:1.5px solid #cbd5e1;border-radius:8px;padding:.4rem .9rem;font-size:.9rem;font-weight:600;cursor:pointer}
.fc-nav button:hover{background:#e2e8f0}
.fc-nav button:disabled{opacity:.4;cursor:default}
.fc-counter{font-size:.9rem;color:#64748b;font-weight:600;min-width:60px;text-align:center}
.fc-hint{font-size:.78rem;color:#94a3b8;margin-top:-.5rem}
`

  const total = tarjetas.length

  const js = `
(function(){
  var total=${total},current=0;
  function show(idx){
    document.querySelectorAll('.fc-card').forEach(function(c,i){
      c.classList.toggle('active',i===idx);
      c.classList.remove('flipped');
    });
    document.getElementById('fc-counter').textContent=(idx+1)+'/'+total;
    document.getElementById('fc-prev').disabled=idx===0;
    document.getElementById('fc-next').disabled=idx===total-1;
  }
  document.querySelectorAll('.fc-inner').forEach(function(inner){
    inner.addEventListener('click',function(){inner.parentElement.classList.toggle('flipped');});
  });
  document.getElementById('fc-prev').addEventListener('click',function(){if(current>0){current--;show(current);}});
  document.getElementById('fc-next').addEventListener('click',function(){if(current<total-1){current++;show(current);}});
  show(0);
})();
`

  const body = `<div class="fc-container">
${tarjetasHtml}
<p class="fc-hint">Haz clic en la tarjeta para voltearla</p>
<div class="fc-nav">
  <button id="fc-prev">&#8592; Anterior</button>
  <span id="fc-counter" class="fc-counter">1/${total}</span>
  <button id="fc-next">Siguiente &#8594;</button>
</div>
</div>
<script>${js}</script>`

  return wrapPage(
    actividad.titulo,
    actividad.descripcion,
    actividad.nivel,
    body,
    css,
  )
}

// ─── 8. Timeline ─────────────────────────────────────────────────────────────

function renderTimeline(actividad: H5PActividad): string {
  const eventos = asArr(actividad.datos.eventos)

  const eventosHtml = eventos
    .map((e) => {
      const ev = asRec(e)
      return `<div class="tl-evento">
  <div class="tl-fecha">${esc(ev.fecha)}</div>
  <div class="tl-contenido">
    <h3>${esc(ev.titulo)}</h3>
    ${str(ev.descripcion) ? `<p>${esc(ev.descripcion)}</p>` : ''}
  </div>
</div>`
    })
    .join('\n')

  const css = `
.tl-contenedor{position:relative;padding-left:2.5rem}
.tl-contenedor::before{content:'';position:absolute;left:.85rem;top:0;bottom:0;width:2px;background:#bfdbfe}
.tl-evento{position:relative;margin-bottom:1.5rem}
.tl-evento::before{content:'';position:absolute;left:-1.65rem;top:.35rem;width:12px;height:12px;border-radius:50%;background:#1a73e8;border:2.5px solid #fff;box-shadow:0 0 0 2px #1a73e8}
.tl-fecha{font-size:.78rem;font-weight:700;color:#1a73e8;text-transform:uppercase;letter-spacing:.05em;margin-bottom:.2rem}
.tl-contenido{background:#f8fafc;border:1.5px solid #e2e8f0;border-radius:10px;padding:.75rem 1rem}
.tl-contenido h3{font-size:.97rem;font-weight:700;color:#1e293b;margin-bottom:.25rem}
.tl-contenido p{font-size:.88rem;color:#475569}
`

  const body = `<div class="tl-contenedor">${eventosHtml}</div>`

  return wrapPage(
    actividad.titulo,
    actividad.descripcion,
    actividad.nivel,
    body,
    css,
  )
}

// ─── 9. QuestionSet ──────────────────────────────────────────────────────────

function renderQuestionSet(actividad: H5PActividad): string {
  // datos.preguntas — for QuestionSet, tipo field is "MultipleChoice" or "TrueFalse"
  const preguntas = asArr(actividad.datos.preguntas)

  const preguntasHtml = preguntas
    .map((p, i) => {
      const pr = asRec(p)
      const tipo = str(pr.tipo) || 'MultipleChoice'
      const pregunta = str(pr.pregunta)
      const retro = str(pr.retroalimentacion)
      let inputHtml = ''

      if (tipo === 'TrueFalse') {
        inputHtml = `<div class="qs-tf">
  <label><input type="radio" name="qs-q${i}" value="true"> Verdadero</label>
  <label><input type="radio" name="qs-q${i}" value="false"> Falso</label>
</div>`
      } else {
        const opciones = asArr(pr.opciones)
        inputHtml = opciones
          .map(
            (o, j) =>
              `<label class="qs-opcion"><input type="radio" name="qs-q${i}" value="${j}"><span>${esc(o)}</span></label>`,
          )
          .join('')
      }

      const correcta =
        tipo === 'TrueFalse'
          ? String(Boolean(pr.respuesta))
          : String(Number(pr.respuestaCorrecta ?? 0))

      return `<div class="qs-pregunta${i === 0 ? ' active' : ''}" data-idx="${i}" data-correcta="${esc(correcta)}" data-retro="${esc(retro)}">
  <p class="qs-num">Pregunta ${i + 1} de ${preguntas.length}</p>
  <p class="qs-enunciado">${esc(pregunta)}</p>
  ${inputHtml}
  <p class="h5p-feedback" hidden></p>
  <button type="button" class="h5p-btn qs-siguiente">${i < preguntas.length - 1 ? 'Siguiente' : 'Finalizar'}</button>
</div>`
    })
    .join('\n')

  const css = `
.qs-pregunta{display:none}
.qs-pregunta.active{display:block}
.qs-num{font-size:.8rem;color:#64748b;font-weight:600;margin-bottom:.5rem;text-transform:uppercase;letter-spacing:.04em}
.qs-enunciado{font-size:1rem;font-weight:600;color:#1e293b;margin-bottom:.8rem}
.qs-opcion{display:flex;align-items:flex-start;gap:.5rem;padding:.4rem .2rem;cursor:pointer;border-radius:6px;margin-bottom:.2rem}
.qs-opcion:hover{background:#f1f5f9}
.qs-opcion input{margin-top:.2rem;accent-color:#1a73e8}
.qs-tf{display:flex;gap:1rem;margin-bottom:.5rem}
.qs-tf label{display:flex;align-items:center;gap:.4rem;cursor:pointer;accent-color:#1a73e8}
.qs-pregunta.correcta .qs-enunciado{color:#065f46}
.qs-pregunta.incorrecta .qs-enunciado{color:#991b1b}
`

  const js = `
(function(){
  var total=${preguntas.length},current=0,ok=0;
  document.querySelectorAll('.qs-siguiente').forEach(function(btn){
    btn.addEventListener('click',function(){
      var panel=btn.closest('.qs-pregunta');
      var correcta=panel.dataset.correcta;
      var sel=panel.querySelector('input:checked');
      var val=sel?sel.value:'';
      var isOk=val===correcta;
      if(isOk)ok++;
      panel.classList.toggle('correcta',isOk);panel.classList.toggle('incorrecta',!isOk);
      var fb=panel.querySelector('.h5p-feedback');
      var retro=panel.dataset.retro;
      if(retro){fb.hidden=false;fb.textContent=(isOk?'✓ Correcto. ':'✗ Incorrecto. ')+retro;fb.className='h5p-feedback '+(isOk?'ok':'err');}
      panel.querySelectorAll('input').forEach(function(i){i.disabled=true;});
      btn.disabled=true;
      current++;
      if(current<total){
        var next=document.querySelector('[data-idx="'+current+'"]');
        if(next)next.classList.add('active');
      }else{
        var score=Math.round(ok/total*100);
        var r=document.getElementById('qs-resultado');
        r.hidden=false;r.textContent='Resultado final: '+ok+'/'+total+' ('+score+'%)';
        if(window.AcadScorm)window.AcadScorm.reportScore(score);
      }
    });
  });
})();
`

  const body = `${preguntasHtml}
<p id="qs-resultado" class="h5p-score" hidden></p>
<script>${js}</script>`

  return wrapPage(
    actividad.titulo,
    actividad.descripcion,
    actividad.nivel,
    body,
    css,
  )
}

// ─── 10. Essay ───────────────────────────────────────────────────────────────

function renderEssay(actividad: H5PActividad): string {
  const pregunta = str(actividad.datos.pregunta)
  const respuestaEsperada = str(actividad.datos.respuestaEsperada)
  const palabrasClave = asArr(actividad.datos.palabrasClave).map((p) =>
    str(p).toLowerCase(),
  )

  const css = `
.essay-pregunta{font-size:1rem;font-weight:600;color:#1e293b;margin-bottom:.8rem}
.essay-textarea{width:100%;min-height:160px;border:1.5px solid #cbd5e1;border-radius:10px;padding:.75rem;font-family:inherit;font-size:.92rem;color:#1a202c;resize:vertical;outline:none;transition:border-color .15s}
.essay-textarea:focus{border-color:#1a73e8}
.essay-palabras{margin-top:.75rem;padding:.6rem .9rem;background:#f8fafc;border-radius:8px;border:1.5px solid #e2e8f0;font-size:.85rem}
.essay-palabras strong{color:#1e40af}
.essay-chip{display:inline-block;border-radius:20px;padding:.1rem .55rem;margin:.15rem;font-size:.8rem;font-weight:600}
.essay-chip.encontrada{background:#d1fae5;color:#065f46}
.essay-chip.faltante{background:#fee2e2;color:#991b1b}
.essay-respuesta-esperada{margin-top:.75rem;padding:.75rem;background:#fffbeb;border:1.5px solid #fcd34d;border-radius:8px;font-size:.87rem;color:#78350f}
`

  const palabrasJson = JSON.stringify(palabrasClave)
  const respuestaJson = JSON.stringify(respuestaEsperada)

  const js = `
(function(){
  var palabras=${palabrasJson};
  var respuestaEsperada=${respuestaJson};
  document.getElementById('essay-verificar').addEventListener('click',function(){
    var btn=this;btn.disabled=true;
    var texto=document.getElementById('essay-input').value.toLowerCase();
    var encontradas=palabras.filter(function(p){return texto.indexOf(p)!==-1;});
    var faltantes=palabras.filter(function(p){return texto.indexOf(p)===-1;});
    var chips=encontradas.map(function(p){return '<span class="essay-chip encontrada">✓ '+p+'</span>';}).join('')
              +faltantes.map(function(p){return '<span class="essay-chip faltante">✗ '+p+'</span>';}).join('');
    var panel=document.getElementById('essay-palabras');
    panel.hidden=false;
    panel.innerHTML='<strong>Palabras clave:</strong> '+chips;
    if(respuestaEsperada){
      var re=document.getElementById('essay-respuesta');
      re.hidden=false;
      re.textContent='Respuesta de referencia: '+respuestaEsperada;
    }
    var score=palabras.length?Math.round(encontradas.length/palabras.length*100):50;
    if(window.AcadScorm)window.AcadScorm.reportScore(score);
    var r=document.getElementById('essay-resultado');
    r.hidden=false;r.textContent='Palabras clave encontradas: '+encontradas.length+'/'+palabras.length;
  });
})();
`

  const body = `<p class="essay-pregunta">${esc(pregunta)}</p>
<textarea id="essay-input" class="essay-textarea" placeholder="Escribe tu respuesta aquí..."></textarea>
<button id="essay-verificar" class="h5p-btn">Verificar respuesta</button>
<div id="essay-palabras" class="essay-palabras" hidden></div>
${respuestaEsperada ? `<div id="essay-respuesta" class="essay-respuesta-esperada" hidden></div>` : '<div id="essay-respuesta" hidden></div>'}
<p id="essay-resultado" class="h5p-score" hidden></p>
<script>${js}</script>`

  return wrapPage(
    actividad.titulo,
    actividad.descripcion,
    actividad.nivel,
    body,
    css,
  )
}

// ─── Main dispatcher ─────────────────────────────────────────────────────────

function renderFindMultipleHotspots(actividad: H5PActividad): string {
  const hotspots = asArr(actividad.datos.hotspots)
  const imagenUrl = browserImageUrl(str(actividad.datos.imagenUrl))
  const imagenAlt = str(actividad.datos.imagenAlt)
  const botones = hotspots
    .map((hotspot, index) => {
      const h = asRec(hotspot)
      const x = Math.max(0, Math.min(100, Number(h.x) || 0))
      const y = Math.max(0, Math.min(100, Number(h.y) || 0))
      return `<button type="button" class="fmh-hotspot" style="left:${x}%;top:${y}%" data-correcto="${Boolean(h.correcto)}" data-retro="${esc(h.retroalimentacion)}" aria-label="Zona ${index + 1}"></button>`
    })
    .join('')
  const correctos = hotspots.filter((hotspot) =>
    Boolean(asRec(hotspot).correcto),
  ).length
  const fondo = imagenUrl ? `background-image:url('${esc(imagenUrl)}')` : ''
  const fallback = imagenUrl
    ? ''
    : `<p class="fmh-placeholder">${esc(imagenAlt || 'Selecciona las zonas correctas del diagrama.')}</p>`
  const css = `
.fmh-escena{position:relative;min-height:360px;border:1.5px solid #bfdbfe;border-radius:12px;background:#eff6ff center/cover no-repeat;overflow:hidden}
.fmh-placeholder{position:absolute;inset:0;display:grid;place-items:center;padding:2rem;text-align:center;color:#1e3a5f;font-weight:600;background:radial-gradient(circle at 25% 30%,#dbeafe 0 15%,transparent 16%),radial-gradient(circle at 75% 65%,#bfdbfe 0 20%,transparent 21%)}
.fmh-hotspot{position:absolute;transform:translate(-50%,-50%);width:32px;height:32px;border:3px solid #1d4ed8;border-radius:999px;background:#fff8;cursor:pointer;box-shadow:0 0 0 4px #dbeafe99}
.fmh-hotspot:hover,.fmh-hotspot:focus-visible{background:#dbeafe;outline:none}.fmh-hotspot.ok{border-color:#047857;background:#d1fae5}.fmh-hotspot.err{border-color:#b91c1c;background:#fee2e2}
`
  const js = `
(function(){var total=${correctos},found=0;document.querySelectorAll('.fmh-hotspot').forEach(function(btn){btn.addEventListener('click',function(){if(btn.disabled)return;btn.disabled=true;var ok=btn.dataset.correcto==='true';btn.classList.add(ok?'ok':'err');var feedback=document.getElementById('fmh-feedback');feedback.hidden=false;feedback.textContent=(ok?'✓ ':'✗ ')+(btn.dataset.retro||'');feedback.className='h5p-feedback '+(ok?'ok':'err');if(ok){found++;if(found===total){var result=document.getElementById('fmh-resultado');result.hidden=false;result.textContent='¡Encontraste todas las zonas correctas!';if(window.AcadScorm)window.AcadScorm.reportScore(100)}}})})})()
`
  const body = `<div class="fmh-escena" style="${fondo}">${fallback}${botones}</div><p id="fmh-feedback" class="h5p-feedback" hidden></p><p id="fmh-resultado" class="h5p-score" hidden></p><script>${js}</script>`
  return wrapPage(
    actividad.titulo,
    actividad.descripcion,
    actividad.nivel,
    body,
    css,
  )
}

/**
 * Renders a complete standalone HTML page for the H5P activity.
 * Pass `scriptsHref` to inject external scripts (e.g. shared/scorm-api.js for SCORM packages).
 */
export function renderH5PActividad(
  actividad: H5PActividad,
  _scriptsHref: string[] = [],
): string {
  switch (actividad.tipoActividad) {
    case 'MultipleChoice':
      return renderMultipleChoice(actividad)
    case 'TrueFalse':
      return renderTrueFalse(actividad)
    case 'FillInTheBlanks':
      return renderFillInTheBlanks(actividad)
    case 'DragText':
      return renderDragText(actividad)
    case 'Crossword':
      return renderCrossword(actividad)
    case 'FindTheWords':
      return renderFindTheWords(actividad)
    case 'Flashcards':
      return renderFlashcards(actividad)
    case 'Timeline':
      return renderTimeline(actividad)
    case 'QuestionSet':
      return renderQuestionSet(actividad)
    case 'Essay':
      return renderEssay(actividad)
    case 'FindMultipleHotspots':
      return renderFindMultipleHotspots(actividad)
    default:
      return wrapPage(
        actividad.titulo,
        actividad.descripcion,
        actividad.nivel,
        `<p>Tipo de actividad no soportado: ${esc(actividad.tipoActividad)}</p>`,
      )
  }
}
