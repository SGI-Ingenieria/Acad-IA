import { useStore } from '@tanstack/react-form'
import { useEffect, useRef } from 'react'

import {
  anclaBibliotecaSugerencia,
  computeRefsParaDetalle,
  getOnlineSuggestionAuthors,
  getOnlineSuggestionIsbn,
  getOnlineSuggestionSubtitle,
  getOnlineSuggestionTitle,
  getOnlineSuggestionYear,
} from '../lib'
import { nuevaBibliografiaFormOpts } from '../schema'

import { BookSelectionAccordion } from './BookSelectionAccordion'

import type { BibliotecaOption, IASugerencia } from '../types'

import { withForm } from '@/components/form'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { useBuscarBibliografia } from '@/data/hooks/useRepositories'

export const BibliotecaStep = withForm({
  ...nuevaBibliografiaFormOpts,
  props: {} as {
    /**
     * Estado del acordeón elevado al contenedor: la validación por paso
     * necesita abrir la comparación pendiente al pulsar "Siguiente".
     */
    openIds: Array<string>
    onOpenIdsChange: (ids: Array<string>) => void
  },
  render: function Render({ form, openIds, onOpenIdsChange }) {
    const todas = useStore(form.store, (s) => s.values.ia.sugerencias)
    const sugerencias = todas.filter((s) => s.selected)

    const initializedRef = useRef(new Set<string>())

    const { mutateAsync: buscar } = useBuscarBibliografia()

    const patchSugerencia = (
      id: string,
      biblioteca: IASugerencia['biblioteca'],
    ) => {
      form.setFieldValue(
        'ia.sugerencias',
        form.state.values.ia.sugerencias.map((s) =>
          s.id === id ? { ...s, biblioteca } : s,
        ),
      )
      // Mantener/sustituir cambia la referencia elegida del paso Detalles.
      form.setFieldValue('refs', computeRefsParaDetalle(form.state.values))
    }

    // Carga perezosa del catálogo institucional para cada sugerencia
    // seleccionada. Es sincronización con un sistema externo disparada al
    // entrar al paso; el resultado se persiste en los valores del form.
    useEffect(() => {
      const cargarBiblioteca = async () => {
        for (const s of sugerencias) {
          const b = s.biblioteca
          const hasOptions = Array.isArray(b?.options)

          if (hasOptions) continue
          if (initializedRef.current.has(s.id)) continue

          initializedRef.current.add(s.id)

          try {
            const titulo = getOnlineSuggestionTitle(s)

            if (!titulo) {
              patchSugerencia(s.id, {
                options: [],
                choiceId: 'online',
              })
              continue
            }

            const result = await buscar({
              titulo: getOnlineSuggestionTitle(s),
              autor: getOnlineSuggestionAuthors(s)[0],
              isbn: getOnlineSuggestionIsbn(s),
            })

            const options: Array<BibliotecaOption> = result.results.map(
              (item) => ({
                id: item.id,
                title: item.titulo,
                subtitle: item.descripcion,
                authors: item.autor ? [item.autor] : [],
                publisher: item.editorial,
                year: item.anio
                  ? Number(
                      String(item.anio).replace(/[^\d]/g, '').substring(0, 4),
                    )
                  : undefined,
                isbn: item.isbn,
                badgeText: 'Biblioteca ULSA',
              }),
            )

            patchSugerencia(s.id, {
              options,
              choiceId: options.length === 0 ? 'online' : undefined,
            })
          } catch (error) {
            console.error(`Error consultando biblioteca para ${s.id}`, error)

            patchSugerencia(s.id, {
              options: [],
              choiceId: 'online',
            })
          }
        }
      }

      void cargarBiblioteca()
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [todas])

    return (
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Comparar con alternativas de la biblioteca</CardTitle>
            <CardDescription>
              Conserva la sugerencia original o sustitúyela por una
              coincidencia.
            </CardDescription>
          </CardHeader>
        </Card>

        <Accordion
          type="multiple"
          value={openIds}
          onValueChange={onOpenIdsChange}
          className="w-full space-y-2"
        >
          {sugerencias.map((s) => {
            const title = getOnlineSuggestionTitle(s)
            const subtitle = getOnlineSuggestionSubtitle(s)
            const authors = getOnlineSuggestionAuthors(s)
            const authorsLine = authors.join('; ') || '—'
            const year = getOnlineSuggestionYear(s)
            const isbn = getOnlineSuggestionIsbn(s)
            const sourceLabel =
              s.endpoint === 'google' ? 'Google Books' : 'Open Library'

            const b = s.biblioteca
            const options = b?.options ?? []

            const badgeState: 'por_revisar' | 'sustituido' | 'mantenido' =
              !b || !Array.isArray(b.options)
                ? 'por_revisar'
                : options.length === 0
                  ? 'mantenido'
                  : !b.choiceId
                    ? 'por_revisar'
                    : b.choiceId === 'online'
                      ? 'mantenido'
                      : 'sustituido'

            const badge =
              badgeState === 'por_revisar' ? (
                <Badge variant="secondary">Por revisar</Badge>
              ) : badgeState === 'sustituido' ? (
                <Badge variant="outline">Sustituido</Badge>
              ) : (
                <Badge>Mantenido</Badge>
              )

            const radioValue =
              b?.choiceId === 'online' || (options.length === 0 && !b?.choiceId)
                ? `online:${s.id}`
                : typeof b?.choiceId === 'string'
                  ? `biblio:${b.choiceId}`
                  : undefined

            return (
              <AccordionItem
                key={s.id}
                value={s.id}
                className="border-border/60 bg-background/40 rounded-lg border border-b-0 px-3"
              >
                <div id={anclaBibliotecaSugerencia(s.id)} />
                <AccordionTrigger className="hover:bg-accent/30 data-[state=open]:bg-accent/20 data-[state=open]:text-accent-foreground -mx-3 px-3">
                  <div className="flex w-full items-center justify-between gap-3">
                    <span className="min-w-0 text-wrap">{title}</span>
                    {badge}
                  </div>
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground mt-4">
                  <div className="mx-1 grid gap-3 pb-2">
                    <BookSelectionAccordion
                      onlineSourceLabel={sourceLabel}
                      online={{
                        id: s.id,
                        title,
                        subtitle,
                        authorsLine,
                        year,
                        isbn,
                      }}
                      options={options}
                      value={radioValue}
                      onValueChange={(v) => {
                        const nextChoiceId = v.startsWith('online:')
                          ? 'online'
                          : v.startsWith('biblio:')
                            ? v.slice('biblio:'.length)
                            : undefined

                        if (!nextChoiceId) return

                        patchSugerencia(s.id, {
                          options,
                          choiceId: nextChoiceId,
                        })
                      }}
                    />
                  </div>
                </AccordionContent>
              </AccordionItem>
            )
          })}
        </Accordion>
      </div>
    )
  },
})
