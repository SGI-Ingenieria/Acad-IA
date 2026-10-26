type PlanNameLike = {
  categoria?: string | null
  nombre_display?: string | null
  nombre?: string | null
  nombre_propuesto?: string | null
}

export function getPlanDisplayName(
  plan: PlanNameLike | null | undefined,
  fallback = 'Plan sin nombre',
) {
  const nombre =
    plan?.nombre_display?.trim() ||
    plan?.nombre_propuesto?.trim() ||
    plan?.nombre?.trim() ||
    fallback
  return plan?.categoria === 'AREA_COMUN'
    ? nombre.replace(/^2\.\s*/, '')
    : nombre
}
