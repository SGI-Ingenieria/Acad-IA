import { useStore } from '@tanstack/react-form'

import { nuevaBibliografiaFormOpts } from '../schema'

import type { BibliografiaRef } from '../types'

import { withForm } from '@/components/form'

const SIN_CITAS: Record<string, string> = {}

function ReferenciaResumen({
  r,
  citations,
}: {
  r: BibliografiaRef
  citations: Record<string, string>
}) {
  const warnings = [
    r.authors.length === 0 ? 'Falta autor(es)' : null,
    !r.isInPress && !r.year ? 'Falta año' : null,
    !r.publisher ? 'Falta editorial' : null,
    !r.isbn ? 'Falta ISBN' : null,
  ].filter(Boolean) as Array<string>

  return (
    <div className="bg-background rounded-md border p-3 text-sm shadow-sm">
      <div className="mb-1 flex min-w-0 items-baseline gap-2">
        <p className="min-w-0 truncate font-medium">{r.title}</p>
        {r.subtitle ? (
          <p className="text-muted-foreground min-w-0 truncate text-xs">
            {r.subtitle}
          </p>
        ) : null}
      </div>
      <p className="text-muted-foreground">
        {citations[r.id] ?? 'Sin cita generada'}
      </p>
      {warnings.length > 0 ? (
        <div className="mt-2 space-y-1">
          {warnings.map((w) => (
            <p key={w} className="text-destructive text-xs">
              {w}
            </p>
          ))}
        </div>
      ) : null}
    </div>
  )
}

export const ResumenStep = withForm({
  ...nuevaBibliografiaFormOpts,
  render: function Render({ form }) {
    const metodo = useStore(form.store, (s) => s.values.metodo)
    const formato = useStore(form.store, (s) => s.values.formato)
    const refs = useStore(form.store, (s) => s.values.refs)
    const citations = useStore(form.store, (s) =>
      s.values.formato ? s.values.citaEdits[s.values.formato] : SIN_CITAS,
    )

    // 1. Separar las referencias
    const basicas = refs.filter((r) => r.tipo === 'BASICA')
    const complementarias = refs.filter((r) => r.tipo === 'COMPLEMENTARIA')
    const metodoLabel =
      metodo === 'MANUAL'
        ? 'Manual'
        : metodo === 'BUSCAR'
          ? 'Búsqueda académica'
          : '—'

    return (
      <div className="space-y-8">
        {/* Panel de Resumen General */}
        <div className="bg-muted/40 rounded-lg border p-4">
          <h3 className="text-foreground mb-4 text-sm font-semibold">
            Resumen de importación
          </h3>
          <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
            <div>
              <p className="text-muted-foreground text-xs uppercase">Método</p>
              <p className="font-medium">{metodoLabel}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs uppercase">Formato</p>
              <p className="font-medium uppercase">{formato ?? '—'}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs uppercase">Básicas</p>
              <p className="font-medium">{basicas.length}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs uppercase">
                Complementarias
              </p>
              <p className="font-medium">{complementarias.length}</p>
            </div>
          </div>
        </div>

        {/* Sección: Bibliografía Básica */}
        {basicas.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-foreground border-b pb-2 text-sm font-medium">
              Bibliografía Básica
            </h4>
            <div className="space-y-2">
              {basicas.map((r) => (
                <ReferenciaResumen key={r.id} r={r} citations={citations} />
              ))}
            </div>
          </div>
        )}

        {/* Sección: Bibliografía Complementaria */}
        {complementarias.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-foreground border-b pb-2 text-sm font-medium">
              Bibliografía Complementaria
            </h4>
            <div className="space-y-2">
              {complementarias.map((r) => (
                <ReferenciaResumen key={r.id} r={r} citations={citations} />
              ))}
            </div>
          </div>
        )}
      </div>
    )
  },
})
