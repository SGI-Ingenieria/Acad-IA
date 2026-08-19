import { HttpError } from './utils.ts'

export type ValidationIssue = {
  path: ReadonlyArray<PropertyKey>
  message: string
}

type ValidationFailure = {
  success: false
  error: { issues: ReadonlyArray<ValidationIssue> }
}

type ValidationSuccess<Output> = { success: true; data: Output }

type SafeParseSchema<Output> = {
  safeParse(value: unknown): ValidationSuccess<Output> | ValidationFailure
}

export type ValidationOptions = {
  status?: number
  code?: string
  message?: (issues: ReadonlyArray<ValidationIssue>) => string
}

export function formatValidationIssues(
  issues: ReadonlyArray<ValidationIssue>,
): string {
  return issues
    .map((issue, index) => {
      const path = issue.path.length ? issue.path.join('.') : '(root)'
      return `${index + 1}. ${path}: ${issue.message}`
    })
    .join('\n')
}

export function joinValidationMessages(
  issues: ReadonlyArray<ValidationIssue>,
): string {
  return issues.map((issue) => issue.message).join(' ')
}

export function validateInput<Output>(
  schema: SafeParseSchema<Output>,
  value: unknown,
  options: ValidationOptions = {},
): ValidationSuccess<Output> {
  const result = schema.safeParse(value)
  if (result.success) return result
  throw new HttpError(
    options.status ?? 422,
    (options.message ?? formatValidationIssues)(result.error.issues),
    options.code ?? 'VALIDATION_ERROR',
    result.error,
  )
}
