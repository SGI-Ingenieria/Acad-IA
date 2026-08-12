import type { Tables } from '@/types/supabase'

import { useAppForm } from '@/components/form'
import { Button } from '@/components/ui/button'
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer'
import { RECURSO_TIPO_SINGULAR_LABEL } from '@/data/api/recursos.api'

type RecursoDrawerProps = {
  recurso: Tables<'learning_objects'> | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onGuardar: (patch: { titulo: string; descripcion: string }) => void
  isPending: boolean
  readOnly?: boolean
}

export function RecursoDrawer({ recurso, ...props }: RecursoDrawerProps) {
  if (!recurso) return null

  // key-remount: al cambiar de recurso el formulario renace con los
  // defaultValues derivados de la query (sin useEffect de resiembra).
  return <RecursoDrawerForm key={recurso.id} recurso={recurso} {...props} />
}

function RecursoDrawerForm({
  recurso,
  open,
  onOpenChange,
  onGuardar,
  isPending,
  readOnly,
}: Omit<RecursoDrawerProps, 'recurso'> & {
  recurso: Tables<'learning_objects'>
}) {
  const form = useAppForm({
    defaultValues: {
      titulo: recurso.titulo,
      descripcion: recurso.descripcion ?? '',
    },
    onSubmit: ({ value }) => {
      onGuardar({ titulo: value.titulo, descripcion: value.descripcion })
    },
  })

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle className="text-lg">{recurso.titulo}</DrawerTitle>
          <DrawerDescription>
            Contenido: {RECURSO_TIPO_SINGULAR_LABEL[recurso.tipo]}
          </DrawerDescription>
        </DrawerHeader>

        <div className="space-y-grupo px-grupo py-relacionado">
          <form.AppField name="titulo">
            {(field) => (
              <field.TextField
                label="Título"
                disabled={readOnly || isPending}
              />
            )}
          </form.AppField>

          <form.AppField name="descripcion">
            {(field) => (
              <field.TextareaField
                label="Descripción / notas"
                rows={5}
                disabled={readOnly || isPending}
              />
            )}
          </form.AppField>
        </div>

        <DrawerFooter className="gap-relacionado flex-row justify-end">
          <DrawerClose asChild>
            <Button variant="outline" disabled={isPending}>
              Cerrar
            </Button>
          </DrawerClose>
          {!readOnly && (
            <Button
              disabled={isPending}
              onClick={() => void form.handleSubmit()}
            >
              {isPending ? 'Guardando...' : 'Guardar'}
            </Button>
          )}
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}
