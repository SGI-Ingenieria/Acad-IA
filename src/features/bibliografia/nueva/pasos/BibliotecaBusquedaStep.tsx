import { useStore } from '@tanstack/react-form'
import { Library, Loader2, Plus, Search } from 'lucide-react'
import { useState } from 'react'

import { bibliotecaItemToRef, computeRefsParaDetalle } from '../lib'
import { nuevaBibliografiaFormOpts } from '../schema'

import type { BibliografiaTipo } from '../types'

import { withForm } from '@/components/form'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useBuscarBibliografia } from '@/data/hooks/useRepositories'

export const BibliotecaBusquedaStep = withForm({
  ...nuevaBibliografiaFormOpts,
  render: function Render({ form }) {
    const { mutate: buscar, data, isPending, isError } = useBuscarBibliografia()

    // Estado local legítimo: interacción efímera de la búsqueda dentro del
    // paso (no pertenece al form ni sobrevive al wizard).
    const [query, setQuery] = useState('')
    const [tipo, setTipo] = useState<BibliografiaTipo>('BASICA')
    const [hasSearched, setHasSearched] = useState(false)

    const refs = useStore(form.store, (s) => s.values.manual.refs)

    const canSearch = query.trim().length > 0
    const results = data?.results ?? []

    const handleSearch = () => {
      if (!canSearch || isPending) return
      setHasSearched(true)
      // Un solo campo: si parece ISBN buscamos por ISBN, si no por título/autor.
      const texto = query.trim()
      const posibleIsbn = texto.replace(/[\s-]/g, '')
      const esIsbn = /^(?:\d{9}[\dxX]|\d{13})$/.test(posibleIsbn)
      buscar(esIsbn ? { titulo: texto, isbn: posibleIsbn } : { titulo: texto })
    }

    const addRef = (ref: ReturnType<typeof bibliotecaItemToRef>) => {
      form.setFieldValue('manual.refs', [...form.state.values.manual.refs, ref])
      form.setFieldValue('refs', computeRefsParaDetalle(form.state.values))
    }

    const removeRef = (id: string) => {
      form.setFieldValue(
        'manual.refs',
        form.state.values.manual.refs.filter((r) => r.id !== id),
      )
      form.setFieldValue('refs', computeRefsParaDetalle(form.state.values))
    }

    return (
      <div className="grid gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Library className="text-primary h-5 w-5" /> Buscar en biblioteca
            </CardTitle>
            <CardDescription>
              Catálogo institucional. Busca por título, autor o ISBN y agrega lo
              que necesites.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative flex-1">
                <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      handleSearch()
                    }
                  }}
                  placeholder="Título, autor o ISBN..."
                  className="pl-9"
                />
              </div>
              <Select
                value={tipo}
                onValueChange={(v) => setTipo(v as BibliografiaTipo)}
              >
                <SelectTrigger className="sm:w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="BASICA">Básica</SelectItem>
                  <SelectItem value="COMPLEMENTARIA">Complementaria</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={handleSearch} disabled={!canSearch || isPending}>
                {isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Search className="mr-2 h-4 w-4" />
                )}
                Buscar
              </Button>
            </div>

            <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
              {isPending && (
                <div className="text-muted-foreground flex items-center justify-center gap-2 py-8 text-sm">
                  <Loader2 className="h-4 w-4 animate-spin" /> Buscando en el
                  catálogo...
                </div>
              )}
              {!isPending && isError && (
                <p className="text-destructive py-6 text-center text-sm">
                  No se pudo consultar la biblioteca. Intenta de nuevo.
                </p>
              )}
              {!isPending &&
                !isError &&
                hasSearched &&
                results.length === 0 && (
                  <p className="text-muted-foreground py-6 text-center text-sm">
                    Sin resultados en el catálogo para esa búsqueda.
                  </p>
                )}
              {!isPending && !hasSearched && (
                <p className="text-muted-foreground py-6 text-center text-sm">
                  Ingresa un título o ISBN y presiona Buscar.
                </p>
              )}
              {!isPending &&
                results.map((item) => {
                  const yaAgregada = refs.some(
                    (r) => r.id === `biblio-${item.id}`,
                  )
                  return (
                    <div
                      key={item.id}
                      className="border-border/60 bg-background flex items-start justify-between gap-3 rounded-lg border p-3"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {item.titulo}
                        </p>
                        {item.autor && (
                          <p className="text-muted-foreground truncate text-xs">
                            {item.autor}
                          </p>
                        )}
                        <p className="text-muted-foreground/80 mt-0.5 truncate text-xs">
                          {[item.editorial, item.anio]
                            .filter(Boolean)
                            .join(' · ')}
                          {item.isbn ? ` · ISBN ${item.isbn}` : ''}
                        </p>
                      </div>
                      {yaAgregada ? (
                        <Badge
                          variant="secondary"
                          className="bg-muted text-muted-foreground shrink-0 text-[10px]"
                        >
                          Agregada
                        </Badge>
                      ) : (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="shrink-0"
                          onClick={() =>
                            addRef(bibliotecaItemToRef(item, tipo))
                          }
                        >
                          <Plus className="mr-1 h-3.5 w-3.5" /> Agregar
                        </Button>
                      )}
                    </div>
                  )
                })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Referencias</CardTitle>
            <CardDescription>{refs.length} en total</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {refs.length === 0 && (
              <p className="text-muted-foreground text-sm">
                Aún no agregas referencias desde la biblioteca.
              </p>
            )}
            {refs.map((r) => (
              <div
                key={r.id}
                className="border-border/60 bg-background flex items-start justify-between gap-3 rounded-lg border p-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{r.title}</div>
                  <div className="text-muted-foreground text-xs">
                    {r.authors.join(', ') || '—'}
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeRef(r.id)}
                >
                  Quitar
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    )
  },
})
