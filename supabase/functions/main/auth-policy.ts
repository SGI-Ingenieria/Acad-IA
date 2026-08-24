const splitNames = (value: string): Array<string> =>
  value
    .split(',')
    .map((name) => name.trim())
    .filter(Boolean)

export function parsePublicFunctionNames(
  value: string | undefined,
): ReadonlySet<string> | null {
  if (value === undefined || value.trim() === '') return null
  return new Set(splitNames(value))
}

export function shouldVerifyFunctionJwt(options: {
  functionName: string
  publicFunctionNames: ReadonlySet<string> | null
  legacyVerifyJwt: boolean
}): boolean {
  const { functionName, publicFunctionNames, legacyVerifyJwt } = options

  if (publicFunctionNames === null) return legacyVerifyJwt
  return !publicFunctionNames.has(functionName)
}
