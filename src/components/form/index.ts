import { createFormHook } from '@tanstack/react-form'

import { fieldContext, formContext } from './contexts'
import {
  CheckboxField,
  DateField,
  SelectField,
  TextareaField,
  TextField,
} from './fields'
import { FormSubmitButton } from './form-submit'

export { useFieldContext, useFormContext } from './contexts'

/**
 * Hook de formularios de la app (TanStack Form + zod como Standard Schema).
 *
 * Uso típico:
 *
 *   const form = useAppForm({
 *     defaultValues: { nombre: '' },
 *     validators: { onBlur: schema, onSubmit: schema },
 *     onSubmit: ({ value }) => mutation.mutateAsync(value),
 *   })
 *
 *   <form.AppField name="nombre">
 *     {(field) => <field.TextField label="Nombre" />}
 *   </form.AppField>
 *   <form.AppForm>
 *     <form.SubmitButton>Guardar</form.SubmitButton>
 *   </form.AppForm>
 *
 * Regla anti-"useEffect resiembra": deriva `defaultValues` de la query y
 * remonta con `key={entidad.id}` al cambiar de entidad; nunca sincronices la
 * query al form con useEffect.
 */
export const { useAppForm, withForm } = createFormHook({
  fieldContext,
  formContext,
  fieldComponents: {
    TextField,
    TextareaField,
    SelectField,
    CheckboxField,
    DateField,
  },
  formComponents: {
    SubmitButton: FormSubmitButton,
  },
})
