import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  CalendarDays,
  FileText,
  Folder,
  LibraryBig,
  Sparkles,
  UserRound,
} from 'lucide-react'

import type { HistoryCreationSummary } from '@/lib/history-creation'

import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { useReferenciasDocumentalesResueltas } from '@/data/hooks/useDocumentos'

const REFERENCE_STATUS: Record<string, string> = {
  archived: 'Archivada',
  processing: 'Procesando',
  pending: 'Pendiente',
  partial_error: 'Incompleta',
  failed: 'Con error',
}

export function HistoryCreationCard({
  summary,
  active = true,
}: {
  summary: HistoryCreationSummary
  active?: boolean
}) {
  const hasReferences =
    summary.references.fileIds.length > 0 ||
    summary.references.collectionIds.length > 0
  const resolved = useReferenciasDocumentalesResueltas(
    summary.references,
    active && hasReferences,
  )
  const referenceOrder = new Map([
    ...summary.references.fileIds.map((id, index) => [id, index] as const),
    ...summary.references.collectionIds.map(
      (id, index) => [id, summary.references.fileIds.length + index] as const,
    ),
  ])
  const references = [...(resolved.data?.references ?? [])].sort(
    (left, right) =>
      (referenceOrder.get(left.id) ?? Number.MAX_SAFE_INTEGER) -
      (referenceOrder.get(right.id) ?? Number.MAX_SAFE_INTEGER),
  )
  const unavailableCount = resolved.isError
    ? summary.references.fileIds.length +
      summary.references.collectionIds.length
    : (resolved.data?.unavailableCount ?? 0)

  return (
    <article className="bg-card rounded-lg border p-5 shadow-xs">
      <header className="flex items-start gap-4">
        <div className="bg-primary/10 text-primary flex size-11 shrink-0 items-center justify-center rounded-lg">
          <LibraryBig className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
              {summary.entity === 'plan' ? 'Plan de estudios' : 'Asignatura'}
            </p>
            {summary.origin ? (
              <Badge variant="outline">{summary.origin}</Badge>
            ) : null}
          </div>
          <h3 className="text-foreground mt-1 text-xl font-semibold tracking-tight text-balance">
            {summary.name}
          </h3>
          <div className="text-muted-foreground mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs">
            <span className="inline-flex items-center gap-1.5">
              <UserRound className="size-3.5" />
              {summary.createdBy}
            </span>
            <span className="inline-flex items-center gap-1.5 tabular-nums">
              <CalendarDays className="size-3.5" />
              {format(summary.createdAt, "d 'de' MMMM 'de' yyyy, HH:mm", {
                locale: es,
              })}
            </span>
          </div>
        </div>
      </header>

      {summary.code || summary.planName ? (
        <dl className="border-border mt-5 grid gap-4 border-t pt-4 sm:grid-cols-2">
          {summary.code ? (
            <div>
              <dt className="text-muted-foreground text-xs">Clave</dt>
              <dd className="text-foreground mt-1 text-sm font-medium">
                {summary.code}
              </dd>
            </div>
          ) : null}
          {summary.planName ? (
            <div>
              <dt className="text-muted-foreground text-xs">Plan</dt>
              <dd className="text-foreground mt-1 text-sm font-medium">
                {summary.planName}
              </dd>
            </div>
          ) : null}
        </dl>
      ) : null}

      {summary.instructions.length > 0 ? (
        <section className="border-border mt-5 border-t pt-4">
          <h4 className="text-foreground flex items-center gap-2 text-sm font-semibold">
            <Sparkles className="text-primary size-4" />
            Indicaciones para IA
          </h4>
          <div className="mt-3 space-y-4">
            {summary.instructions.map((instruction) => (
              <div key={`${instruction.label}:${instruction.value}`}>
                <p className="text-muted-foreground text-xs font-medium">
                  {instruction.label}
                </p>
                <p className="text-foreground mt-1 text-sm leading-relaxed whitespace-pre-wrap">
                  {instruction.value}
                </p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {hasReferences ? (
        <section className="border-border mt-5 border-t pt-4">
          <h4 className="text-foreground text-sm font-semibold">Referencias</h4>
          <div className="mt-3 space-y-2">
            {resolved.isLoading ? (
              <>
                <Skeleton className="h-9 w-full" />
                {summary.references.fileIds.length +
                  summary.references.collectionIds.length >
                1 ? (
                  <Skeleton className="h-9 w-4/5" />
                ) : null}
              </>
            ) : (
              <>
                {references.map((reference) => {
                  const Icon = reference.type === 'file' ? FileText : Folder
                  const status = REFERENCE_STATUS[reference.status]
                  return (
                    <div
                      key={`${reference.type}:${reference.id}`}
                      className="flex min-w-0 items-center gap-3 py-1.5"
                    >
                      <Icon className="text-muted-foreground size-4 shrink-0" />
                      <span className="text-foreground min-w-0 flex-1 truncate text-sm">
                        {reference.name}
                      </span>
                      {status ? (
                        <span className="text-muted-foreground text-xs">
                          {status}
                        </span>
                      ) : null}
                    </div>
                  )
                })}
                {unavailableCount > 0 ? (
                  <div className="text-muted-foreground flex items-center gap-3 py-1.5 text-sm">
                    <FileText className="size-4 shrink-0" />
                    {unavailableCount === 1
                      ? 'Referencia no disponible'
                      : `${unavailableCount} referencias no disponibles`}
                  </div>
                ) : null}
              </>
            )}
          </div>
        </section>
      ) : null}
    </article>
  )
}
