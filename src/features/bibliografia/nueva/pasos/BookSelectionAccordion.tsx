import type { BibliotecaOption } from '../types'

import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'

/**
 * Comparación lado a lado entre la sugerencia en línea y las alternativas de
 * la biblioteca. Componente totalmente controlado: `value` es la única fuente
 * de verdad (antes duplicaba el prop en un useState + useEffect espejo).
 */
export function BookSelectionAccordion({
  onlineSourceLabel,
  online,
  options,
  value,
  onValueChange,
}: {
  onlineSourceLabel: string
  online: {
    id: string
    title: string
    subtitle?: string
    authorsLine: string
    year?: number
    isbn?: string
  }
  options: Array<BibliotecaOption>
  value: string | undefined
  onValueChange: (value: string) => void
}) {
  const onlineValue = `online:${online.id}`
  // La referencia encontrada se conserva de inicio; el usuario solo cambia
  // esta selección cuando prefiere una alternativa institucional.
  const selectedBook = value ?? onlineValue

  const optionBaseClass =
    'relative flex items-start space-x-control rounded-lg border p-grupo transition-colors'

  const optionClass = (isSelected: boolean) =>
    cn(
      optionBaseClass,
      isSelected
        ? 'border-primary bg-primary/5'
        : 'hover:border-primary/30 hover:bg-accent/50',
    )

  return (
    <>
      {/* Un solo RadioGroup controla ambos lados */}
      <RadioGroup
        value={selectedBook}
        onValueChange={onValueChange}
        className="gap-seccion flex flex-col md:flex-row"
      >
        {/* --- LADO IZQUIERDO: Sugerencia Online --- */}
        <div className="space-y-grupo flex-1">
          <h4 className="text-muted-foreground text-sm font-medium">
            Sugerencia Original ({onlineSourceLabel})
          </h4>

          <div className={optionClass(selectedBook === onlineValue)}>
            <RadioGroupItem
              value={onlineValue}
              id={onlineValue}
              className="mt-micro"
            />
            <Label
              htmlFor={onlineValue}
              className="flex flex-1 cursor-pointer flex-col"
            >
              <span className="font-semibold">{online.title}</span>
              {online.subtitle ? (
                <span className="text-muted-foreground text-sm">
                  {online.subtitle}
                </span>
              ) : null}
              <span className="text-muted-foreground text-sm">
                {online.authorsLine}
                {online.year ? ` (${online.year})` : ''}
              </span>
              {online.isbn ? (
                <span className="text-muted-foreground mt-micro text-xs">
                  ISBN: {online.isbn}
                </span>
              ) : null}
            </Label>
          </div>
        </div>

        {/* Separador vertical para escritorio, horizontal en móviles */}
        <Separator orientation="vertical" className="hidden h-auto md:block" />
        <Separator orientation="horizontal" className="md:hidden" />

        {/* --- LADO DERECHO: Alternativas de Biblioteca --- */}
        <div className="space-y-grupo flex-1">
          <h4 className="text-muted-foreground text-sm font-medium">
            Disponibles en Biblioteca
          </h4>

          <div className="space-y-control pr-relacionado max-h-75 overflow-y-auto">
            {options.length === 0 ? (
              <div className="text-muted-foreground text-sm">
                No se encontraron alternativas.
              </div>
            ) : (
              options.map((opt) => {
                const optValue = `biblio:${opt.id}`
                const authorsLine = opt.authors.join('; ')
                const isSelected = selectedBook === optValue
                return (
                  <div key={opt.id} className={optionClass(isSelected)}>
                    <RadioGroupItem
                      value={optValue}
                      id={optValue}
                      className="mt-micro cursor-pointer"
                    />
                    <Label
                      htmlFor={optValue}
                      className="flex flex-1 cursor-pointer flex-col"
                    >
                      <div className="gap-relacionado flex items-center">
                        <span className="font-semibold">{opt.title}</span>
                        {opt.badgeText ? (
                          <Badge variant="secondary">{opt.badgeText}</Badge>
                        ) : null}
                      </div>
                      {opt.subtitle ? (
                        <span className="text-muted-foreground text-sm">
                          {opt.subtitle}
                        </span>
                      ) : null}
                      <span className="text-muted-foreground text-sm">
                        {authorsLine}
                        {opt.year ? ` (${opt.year})` : ''}
                      </span>
                      {opt.shelf ? (
                        <span className="bg-muted mt-relacionado px-micro w-fit rounded font-mono text-xs">
                          Estante: {opt.shelf}
                        </span>
                      ) : null}
                    </Label>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </RadioGroup>
    </>
  )
}
