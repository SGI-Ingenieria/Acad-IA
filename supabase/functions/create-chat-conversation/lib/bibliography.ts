export function temaBibliografico(
  consulta: string,
  temaPredeterminado: string,
) {
  const consultaNormalizada = consulta
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
  const coincidencia = consultaNormalizada.match(
    /(?:bibliograf(?:ia|ias)|referencias?|libros?|lecturas?)\s+(?:de|sobre|para)\s+(.+?)(?=\s+(?:quiero|propon|genera|crea|bibliograf)|[.!?]|$)|(?:del estudio de|sobre|acerca de)\s+(.+?)(?=\s+(?:quiero|propon|genera|crea|bibliograf)|[.!?]|$)/iu,
  )
  const tema = (coincidencia?.[1] ?? coincidencia?.[2])
    ?.replace(
      /\b(?:de\s+(?:la\s+)?biblioteca|en\s+linea|online|internet)\b/giu,
      '',
    )
    .replace(/\b(?:esta|la|mi)\s+asignatura\b/giu, '')
    ?.replace(/\s+/g, ' ')
    .trim()
  return tema &&
    tema.length >= 4 &&
    !/^(?:(?:la )?biblioteca|en linea|asignatura)$/iu.test(tema)
    ? tema
    : temaPredeterminado
}
