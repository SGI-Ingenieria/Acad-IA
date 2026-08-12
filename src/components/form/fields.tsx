import { useFieldContext } from './contexts'

import type { AnyFieldMeta } from '@tanstack/react-form'

import { Checkbox } from '@/components/ui/checkbox'
import { DatePicker } from '@/components/ui/date-picker'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'

/** Mensajes de zod (Standard Schema) o strings de validadores manuales. */
const errorText = (meta: AnyFieldMeta): string =>
  meta.errors
    .map((e: unknown) =>
      typeof e === 'string' ? e : ((e as { message?: string }).message ?? ''),
    )
    .filter(Boolean)
    .join(', ')

/** El error se muestra tras interactuar con el campo (blur) o al enviar. */
const isInvalid = (meta: AnyFieldMeta): boolean =>
  meta.isTouched && !meta.isValid

function FieldShell({
  name,
  label,
  description,
  invalid,
  error,
  children,
}: {
  name: string
  label: string
  description?: string
  invalid: boolean
  error: string
  children: React.ReactNode
}) {
  return (
    <div className="gap-relacionado grid">
      <Label htmlFor={name}>{label}</Label>
      {children}
      {description && !invalid ? (
        <p className="text-muted-foreground text-sm">{description}</p>
      ) : null}
      {invalid ? (
        <p id={`${name}-error`} className="text-destructive text-sm">
          {error}
        </p>
      ) : null}
    </div>
  )
}

type CommonFieldProps = {
  label: string
  description?: string
}

export function TextField({
  label,
  description,
  ...inputProps
}: CommonFieldProps &
  Omit<
    React.ComponentProps<typeof Input>,
    'id' | 'value' | 'onChange' | 'onBlur' | 'aria-invalid'
  >) {
  const field = useFieldContext<string>()
  const invalid = isInvalid(field.state.meta)
  return (
    <FieldShell
      name={field.name}
      label={label}
      description={description}
      invalid={invalid}
      error={errorText(field.state.meta)}
    >
      <Input
        id={field.name}
        value={field.state.value}
        onBlur={field.handleBlur}
        onChange={(e) => field.handleChange(e.target.value)}
        aria-invalid={invalid}
        aria-describedby={invalid ? `${field.name}-error` : undefined}
        {...inputProps}
      />
    </FieldShell>
  )
}

export function TextareaField({
  label,
  description,
  ...textareaProps
}: CommonFieldProps &
  Omit<
    React.ComponentProps<typeof Textarea>,
    'id' | 'value' | 'onChange' | 'onBlur' | 'aria-invalid'
  >) {
  const field = useFieldContext<string>()
  const invalid = isInvalid(field.state.meta)
  return (
    <FieldShell
      name={field.name}
      label={label}
      description={description}
      invalid={invalid}
      error={errorText(field.state.meta)}
    >
      <Textarea
        id={field.name}
        value={field.state.value}
        onBlur={field.handleBlur}
        onChange={(e) => field.handleChange(e.target.value)}
        aria-invalid={invalid}
        aria-describedby={invalid ? `${field.name}-error` : undefined}
        {...textareaProps}
      />
    </FieldShell>
  )
}

export function SelectField({
  label,
  description,
  placeholder,
  options,
  disabled,
}: CommonFieldProps & {
  placeholder?: string
  options: Array<{ value: string; label: string; disabled?: boolean }>
  disabled?: boolean
}) {
  const field = useFieldContext<string>()
  const invalid = isInvalid(field.state.meta)
  return (
    <FieldShell
      name={field.name}
      label={label}
      description={description}
      invalid={invalid}
      error={errorText(field.state.meta)}
    >
      <Select
        value={field.state.value}
        onValueChange={(value) => {
          field.handleChange(value)
          field.handleBlur()
        }}
        disabled={disabled}
      >
        <SelectTrigger
          id={field.name}
          aria-invalid={invalid}
          aria-describedby={invalid ? `${field.name}-error` : undefined}
        >
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem
              key={option.value}
              value={option.value}
              disabled={option.disabled}
            >
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </FieldShell>
  )
}

export function CheckboxField({
  label,
  description,
  disabled,
}: CommonFieldProps & { disabled?: boolean }) {
  const field = useFieldContext<boolean>()
  const invalid = isInvalid(field.state.meta)
  return (
    <div className="gap-relacionado grid">
      <div className="gap-relacionado flex items-center">
        <Checkbox
          id={field.name}
          checked={field.state.value}
          onCheckedChange={(checked) => {
            field.handleChange(checked === true)
            field.handleBlur()
          }}
          disabled={disabled}
          aria-invalid={invalid}
          aria-describedby={invalid ? `${field.name}-error` : undefined}
        />
        <Label htmlFor={field.name}>{label}</Label>
      </div>
      {description && !invalid ? (
        <p className="text-muted-foreground text-sm">{description}</p>
      ) : null}
      {invalid ? (
        <p id={`${field.name}-error`} className="text-destructive text-sm">
          {errorText(field.state.meta)}
        </p>
      ) : null}
    </div>
  )
}

export function DateField({
  label,
  description,
  placeholder,
  disabled,
}: CommonFieldProps & { placeholder?: string; disabled?: boolean }) {
  const field = useFieldContext<string>()
  const invalid = isInvalid(field.state.meta)
  return (
    <FieldShell
      name={field.name}
      label={label}
      description={description}
      invalid={invalid}
      error={errorText(field.state.meta)}
    >
      <DatePicker
        id={field.name}
        value={field.state.value}
        onChange={(value) => {
          field.handleChange(value)
          field.handleBlur()
        }}
        placeholder={placeholder}
        disabled={disabled}
      />
    </FieldShell>
  )
}
