export type RectSeleccion = {
  top: number
  right: number
  bottom: number
  left: number
}

export type PosicionToolbarSeleccion = {
  top: number
  left: number
  estrategia: 'sobre-seleccion' | 'centro-visible'
}

type CalcularPosicionToolbarSeleccionArgs = {
  inicio: RectSeleccion
  fin: RectSeleccion
  rectangulos: Array<RectSeleccion>
  contenedor: RectSeleccion
  altoViewport: number
  altoToolbar: number
  separacion: number
  margenViewport: number
}

/**
 * Conserva el toolbar encima de una selección ordinaria. Cuando el inicio de
 * una selección extensa ya salió del área visible del editor, lo centra sobre
 * el tramo seleccionado que todavía se ve: así una selección total sigue
 * ofreciendo sus acciones junto al texto que el usuario tiene enfrente.
 */
export function calcularPosicionToolbarSeleccion({
  inicio,
  fin,
  rectangulos,
  contenedor,
  altoViewport,
  altoToolbar,
  separacion,
  margenViewport,
}: CalcularPosicionToolbarSeleccionArgs): PosicionToolbarSeleccion {
  const limiteSuperior = Math.max(contenedor.top, margenViewport)
  const limiteInferior = Math.min(
    contenedor.bottom,
    altoViewport - margenViewport,
  )
  const rectangulosValidos = rectangulos.filter(
    (rectangulo) =>
      Number.isFinite(rectangulo.top) &&
      Number.isFinite(rectangulo.bottom) &&
      rectangulo.bottom > rectangulo.top,
  )
  const inicioSeleccion = Math.min(
    inicio.top,
    fin.top,
    ...rectangulosValidos.map((rectangulo) => rectangulo.top),
  )

  if (inicioSeleccion >= limiteSuperior || limiteInferior <= limiteSuperior) {
    return {
      top: inicioSeleccion - altoToolbar - separacion,
      left: (inicio.left + fin.right) / 2,
      estrategia: 'sobre-seleccion',
    }
  }

  const visibles = rectangulosValidos.filter(
    (rectangulo) =>
      rectangulo.bottom > limiteSuperior && rectangulo.top < limiteInferior,
  )
  const seleccionVisibleSuperior = visibles.length
    ? Math.max(
        limiteSuperior,
        Math.min(...visibles.map((rectangulo) => rectangulo.top)),
      )
    : limiteSuperior
  const seleccionVisibleInferior = visibles.length
    ? Math.min(
        limiteInferior,
        Math.max(...visibles.map((rectangulo) => rectangulo.bottom)),
      )
    : limiteInferior

  return {
    top:
      (seleccionVisibleSuperior + seleccionVisibleInferior - altoToolbar) / 2,
    left: (contenedor.left + contenedor.right) / 2,
    estrategia: 'centro-visible',
  }
}
