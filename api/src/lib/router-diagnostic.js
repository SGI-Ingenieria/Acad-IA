const MISSING_SETTING_PATTERN =
  /^Missing Azure Static Web App setting: ([A-Z0-9_]+)$/

const SAFE_ERROR_NAMES = new Set([
  'DataError',
  'NotSupportedError',
  'OperationError',
  'SyntaxError',
  'TypeError',
])

export function routerConfigurationCode(error) {
  const message = error instanceof Error ? error.message : ''
  const missingSetting = message.match(MISSING_SETTING_PATTERN)?.[1]

  if (missingSetting) return `missing_${missingSetting.toLowerCase()}`
  if (message === 'SUPABASE_PARENT_PROJECT_REF is invalid.') {
    return 'invalid_supabase_parent_project_ref'
  }

  const errorName = error instanceof Error ? error.name : ''
  if (SAFE_ERROR_NAMES.has(errorName)) {
    return `initialization_${errorName.toLowerCase()}`
  }

  return 'initialization_error'
}
