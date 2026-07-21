export function canCancelOwnGeneration(args: {
  userId: string
  initiatedBy: string | null | undefined
  canUseAI: boolean
}): boolean {
  return Boolean(
    args.initiatedBy && args.initiatedBy === args.userId && args.canUseAI,
  )
}
