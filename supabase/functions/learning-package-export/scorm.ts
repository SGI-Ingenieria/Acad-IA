// Exportador SCORM 1.2: imsmanifest.xml + wrapper del API SCORM + SCOs HTML.
// Cada learning_object revisado se empaqueta como un SCO independiente.

export function xmlEscape(value: unknown): string {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}

export type ScormSco = {
  identifier: string
  titulo: string
  href: string
  /** Solo quizzes: umbral de aprobación (adlcp:masteryscore). */
  masteryScore?: number
}

export type ScormGrupo = {
  identifier: string
  titulo: string
  scos: Array<ScormSco>
}

/**
 * Manifiesto SCORM 1.2 con una organización cuyo primer nivel son los grupos
 * (unidad/tema) y cuyas hojas son los SCOs. Los archivos compartidos
 * (estilos, wrapper del API) se declaran en cada resource.
 */
export function buildImsManifest(args: {
  identifier: string
  tituloCurso: string
  grupos: Array<ScormGrupo>
  sharedFiles: Array<string>
}): string {
  const items = args.grupos
    .map((grupo) => {
      const hojas = grupo.scos
        .map(
          (sco) => `
        <item identifier="ITEM-${xmlEscape(sco.identifier)}" identifierref="RES-${xmlEscape(sco.identifier)}">
          <title>${xmlEscape(sco.titulo)}</title>${
            sco.masteryScore != null
              ? `
          <adlcp:masteryscore>${sco.masteryScore}</adlcp:masteryscore>`
              : ''
          }
        </item>`,
        )
        .join('')

      return `
      <item identifier="ITEM-${xmlEscape(grupo.identifier)}">
        <title>${xmlEscape(grupo.titulo)}</title>${hojas}
      </item>`
    })
    .join('')

  const sharedFileTags = args.sharedFiles
    .map(
      (href) => `
      <file href="${xmlEscape(href)}"/>`,
    )
    .join('')

  const resources = args.grupos
    .flatMap((grupo) => grupo.scos)
    .map(
      (sco) => `
    <resource identifier="RES-${xmlEscape(sco.identifier)}" type="webcontent" adlcp:scormtype="sco" href="${xmlEscape(sco.href)}">
      <file href="${xmlEscape(sco.href)}"/>${sharedFileTags}
    </resource>`,
    )
    .join('')

  return `<?xml version="1.0" encoding="UTF-8"?>
<manifest identifier="${xmlEscape(args.identifier)}" version="1.0"
  xmlns="http://www.imsproject.org/xsd/imscp_rootv1p1p2"
  xmlns:adlcp="http://www.adlcp.org/xsd/adlcp_rootv1p2"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.imsproject.org/xsd/imscp_rootv1p1p2 imscp_rootv1p1p2.xsd http://www.imsglobal.org/xsd/imsmd_rootv1p2p1 imsmd_rootv1p2p1.xsd http://www.adlcp.org/xsd/adlcp_rootv1p2 adlcp_rootv1p2.xsd">
  <metadata>
    <schema>ADL SCORM</schema>
    <schemaversion>1.2</schemaversion>
  </metadata>
  <organizations default="ORG-ACADIA">
    <organization identifier="ORG-ACADIA">
      <title>${xmlEscape(args.tituloCurso)}</title>${items}
    </organization>
  </organizations>
  <resources>${resources}
  </resources>
</manifest>
`
}

/**
 * Wrapper clásico del API SCORM 1.2. Cada SCO lo carga y según
 * `data-scorm` en <body>:
 *  - "lesson": marca completed al cargar.
 *  - "quiz": queda incomplete hasta que el quiz llama AcadScorm.reportScore.
 */
export const SCORM_API_JS = `(function () {
  function findAPI(win) {
    var intentos = 0
    while (win && intentos < 10) {
      if (win.API) return win.API
      if (win.parent && win.parent !== win) win = win.parent
      else if (win.opener) win = win.opener
      else win = null
      intentos++
    }
    return null
  }

  var API = findAPI(window)
  var inicializado = false
  var terminado = false

  function init() {
    if (!API || inicializado) return
    API.LMSInitialize('')
    inicializado = true
  }

  function set(clave, valor) {
    if (!API) return
    init()
    API.LMSSetValue(clave, String(valor))
    API.LMSCommit('')
  }

  function finish() {
    if (!API || !inicializado || terminado) return
    API.LMSFinish('')
    terminado = true
  }

  window.AcadScorm = {
    setCompleted: function () {
      set('cmi.core.lesson_status', 'completed')
    },
    reportScore: function (score) {
      if (!API) return
      init()
      var mastery = Number(document.body.dataset.masteryScore || '70')
      API.LMSSetValue('cmi.core.score.min', '0')
      API.LMSSetValue('cmi.core.score.max', '100')
      API.LMSSetValue('cmi.core.score.raw', String(score))
      API.LMSSetValue(
        'cmi.core.lesson_status',
        score >= mastery ? 'passed' : 'failed'
      )
      API.LMSCommit('')
    },
    finish: finish,
  }

  window.addEventListener('load', function () {
    init()
    var modo = document.body.dataset.scorm
    if (modo === 'lesson') window.AcadScorm.setCompleted()
    else if (modo === 'quiz') set('cmi.core.lesson_status', 'incomplete')
  })
  window.addEventListener('beforeunload', finish)
  window.addEventListener('unload', finish)
})()
`
