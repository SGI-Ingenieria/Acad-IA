type PlanNameLike = {
  nombre_display?: string | null
  nombre?: string | null
  nombre_propuesto?: string | null
}

export function getPlanDisplayName(
  plan: PlanNameLike | null | undefined,
  fallback = 'Plan sin nombre',
) {
  return (
    plan?.nombre_display?.trim() ||
    plan?.nombre_propuesto?.trim() ||
    plan?.nombre?.trim() ||
    fallback
  )
}
