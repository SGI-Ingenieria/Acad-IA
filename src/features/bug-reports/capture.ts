export type BugReportCaptureResult =
  | { file: File; status: 'captured' }
  | { file: null; status: 'cancelled' | 'unavailable' }

function captureTimeout<T>(promise: Promise<T>, timeoutMs: number) {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      window.setTimeout(
        () => reject(new Error('La captura tardó demasiado.')),
        timeoutMs,
      )
    }),
  ])
}

async function waitForVisualStability() {
  await document.fonts.ready
  await new Promise<void>((resolve) =>
    window.setTimeout(
      () => requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      350,
    ),
  )
}

async function canvasToFile(canvas: HTMLCanvasElement) {
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/png'),
  )
  if (!blob || blob.size === 0) return null
  return new File([blob], 'captura-reporte.png', { type: 'image/png' })
}

function replaceFunctionCalls(
  value: string,
  functionNames: ReadonlyArray<string>,
  documentClone: Document,
  colorCache: Map<string, string>,
) {
  let output = ''
  let cursor = 0
  const pattern = new RegExp(`(?:${functionNames.join('|')})\\s*\\(`, 'gi')
  let match: RegExpExecArray | null

  while ((match = pattern.exec(value))) {
    output += value.slice(cursor, match.index)
    let depth = 1
    let end = match.index + match[0].length
    while (end < value.length && depth > 0) {
      if (value[end] === '(') depth += 1
      if (value[end] === ')') depth -= 1
      end += 1
    }
    output += resolveCssColor(
      value.slice(match.index, end),
      documentClone,
      colorCache,
    )
    cursor = end
    pattern.lastIndex = end
  }

  return output + value.slice(cursor)
}

function resolveCssColor(
  value: string,
  documentClone: Document,
  colorCache: Map<string, string>,
) {
  const cached = colorCache.get(value)
  if (cached) return cached

  const probe = documentClone.createElement('span')
  probe.style.setProperty('color', value, 'important')
  documentClone.body.appendChild(probe)
  const computed = documentClone.defaultView?.getComputedStyle(probe).color
  probe.remove()
  const canvas = documentClone.createElement('canvas')
  canvas.width = 1
  canvas.height = 1
  const context = canvas.getContext('2d')
  let normalized = 'rgb(128 128 128)'
  if (context && computed) {
    context.fillStyle = 'rgb(1, 2, 3)'
    context.fillRect(0, 0, 1, 1)
    context.clearRect(0, 0, 1, 1)
    context.fillStyle = computed
    context.fillRect(0, 0, 1, 1)
    const [red, green, blue, alpha] = context.getImageData(0, 0, 1, 1).data
    if (!(red === 1 && green === 2 && blue === 3 && alpha === 255)) {
      normalized =
        alpha === 255
          ? `rgb(${red} ${green} ${blue})`
          : `rgba(${red} ${green} ${blue} / ${(alpha / 255).toFixed(3)})`
    }
  }
  colorCache.set(value, normalized)
  return normalized
}

function replaceUnsupportedColorFunctions(
  value: string,
  documentClone: Document,
  colorCache: Map<string, string>,
) {
  return replaceFunctionCalls(
    replaceFunctionCalls(value, ['color-mix'], documentClone, colorCache),
    ['oklch', 'oklab', 'lab', 'lch'],
    documentClone,
    colorCache,
  )
}

function sanitizeCloneForHtml2Canvas(documentClone: Document) {
  documentClone.getAnimations().forEach((animation) => {
    try {
      animation.finish()
    } catch {
      animation.cancel()
    }
  })
  const colorCache = new Map<string, string>()
  documentClone.querySelectorAll('style').forEach((style) => {
    style.textContent = replaceUnsupportedColorFunctions(
      style.textContent,
      documentClone,
      colorCache,
    )
  })
  documentClone.querySelectorAll<HTMLElement>('[style]').forEach((element) => {
    const inlineStyle = element.getAttribute('style')
    if (inlineStyle) {
      element.setAttribute(
        'style',
        replaceUnsupportedColorFunctions(
          inlineStyle,
          documentClone,
          colorCache,
        ),
      )
    }
  })
  documentClone
    .querySelectorAll<SVGElement>('[fill], [stroke]')
    .forEach((element) => {
      for (const attribute of ['fill', 'stroke']) {
        const value = element.getAttribute(attribute)
        if (value) {
          element.setAttribute(
            attribute,
            replaceUnsupportedColorFunctions(value, documentClone, colorCache),
          )
        }
      }
    })
}

/** Captures the rendered Acad-IA viewport without opening a browser picker. */
export async function captureCurrentView(): Promise<BugReportCaptureResult> {
  try {
    const { default: html2canvas } = await import('html2canvas')
    await waitForVisualStability()
    const target = document.documentElement
    const width = Math.max(1, Math.min(window.innerWidth, 1600))
    const height = Math.max(1, Math.min(window.innerHeight, 1200))
    const canvas = await captureTimeout(
      html2canvas(target, {
        x: 0,
        y: 0,
        width,
        height,
        windowWidth: width,
        windowHeight: height,
        scrollX: window.scrollX,
        scrollY: window.scrollY,
        scale: Math.min(window.devicePixelRatio || 1, 2),
        useCORS: true,
        allowTaint: false,
        backgroundColor: null,
        logging: false,
        foreignObjectRendering: true,
        onclone: sanitizeCloneForHtml2Canvas,
        ignoreElements: (element) =>
          element.matches(
            '[data-slot="dialog-content"], [data-slot="dialog-overlay"], [data-radix-popper-content-wrapper]',
          ),
      }),
      8000,
    )

    const file = await canvasToFile(canvas)
    if (!file) return { file: null, status: 'unavailable' }

    return { file, status: 'captured' }
  } catch (error) {
    console.warn('No se pudo capturar la vista del reporte.', error)
    return { file: null, status: 'unavailable' }
  }
}
