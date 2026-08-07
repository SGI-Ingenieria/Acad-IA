import { useStore } from '@tanstack/react-form'
import {
  BookOpenText,
  CalendarDays,
  Copy,
  FileText,
  GraduationCap,
  Scale,
  Sparkles,
} from 'lucide-react'

import { withForm } from '@/components/form'
import { FacultadIconPill } from '@/components/shared/FacultadIconPill'
import { useCatalogosPlanes } from '@/data/hooks/usePlans'
import { nuevoPlanFormOpts } from '@/features/planes/nuevo/schema'
import { semanasTotalesPlan } from '@/lib/ciclo-utils'
import { formatCarreraNombre, formatFacultadNombre } from '@/lib/facultad-utils'
import { formatMesAnioEs } from '@/lib/plan-curricular'

const MODOS = {
  MANUAL: { label: 'Creación vacía', icon: FileText },
  IA: { label: 'Creación asistida por IA', icon: Sparkles },
  CLONADO_INTERNO: { label: 'Clonado desde Acad‑IA', icon: Copy },
  CLONADO_TRADICIONAL: { label: 'Importación documental', icon: BookOpenText },
  IMPORTADO_DOCUMENTAL: { label: 'Antecedente importado', icon: BookOpenText },
  REDISENO: { label: 'Rediseño curricular', icon: Copy },
  OTRO: { label: 'Creación de plan', icon: FileText },
} as const

export const PasoResumenCard = withForm({
  ...nuevoPlanFormOpts,
  render: function Render({ form }) {
    const values = useStore(form.store, (state) => state.values)
    const { data: catalogos } = useCatalogosPlanes()
    const facultad = catalogos?.facultades.find(
      (item) => item.id === values.datosBasicos.facultad.id,
    )
    const carrera = catalogos?.carreras.find(
      (item) => item.id === values.datosBasicos.carrera.id,
    )
    const estructura = catalogos?.estructurasPlan.find(
      (item) => item.id === values.datosBasicos.estructuraPlanId,
    )
    const versionNormativa = leerVersionNormativa(estructura)
    const modo = values.tipoOrigen ? MODOS[values.tipoOrigen] : null
    const ModoIcon = modo?.icon ?? FileText
    const totalReferencias =
      values.iaConfig.archivosReferencia.length +
      values.iaConfig.coleccionesReferencia.length +
      values.iaConfig.archivosAdjuntos.length

    const semanasTotales = semanasTotalesPlan(
      values.datosBasicos.numCiclos,
      values.datosBasicos.semanasPorCiclo,
    )
    const recorrido = [
      `${values.datosBasicos.numCiclos ?? '—'} ${values.datosBasicos.tipoCiclo || 'ciclos'}`,
      semanasTotales ? `${semanasTotales} semanas en total` : null,
      values.datosBasicos.fechaInicioImparticion
        ? `inicia ${formatMesAnioEs(values.datosBasicos.fechaInicioImparticion)}`
        : null,
    ]
      .filter(Boolean)
      .join(' · ')

    return (
      <article className="mx-auto max-w-3xl" data-guia="resumen-plan">
        <header className="border-border pb-seccion border-b">
          <p className="text-primary text-sm font-semibold">
            Resumen del plan de estudios
          </p>
          <h2 className="mt-relacionado text-3xl font-bold tracking-tight text-balance">
            {values.datosBasicos.nombrePlan || 'Plan de estudios'}
          </h2>
          <p className="text-muted-foreground mt-relacionado gap-relacionado flex items-center">
            <FacultadIconPill facultad={facultad} />
            <span>
              {facultad
                ? formatFacultadNombre(facultad)
                : values.datosBasicos.facultad.nombre}{' '}
              ·{' '}
              {carrera
                ? formatCarreraNombre(carrera)
                : values.datosBasicos.carrera.nombre}
            </span>
          </p>
        </header>

        <dl className="gap-x-region gap-y-seccion py-region grid border-b sm:grid-cols-2">
          <Dato
            icon={CalendarDays}
            termino="Recorrido académico"
            valor={recorrido}
          />
          <Dato
            icon={GraduationCap}
            termino="Naturaleza"
            valor={
              values.datosBasicos.tipoEstructura === 'CURRICULAR'
                ? 'Plan curricular'
                : 'Plan no curricular'
            }
          />
          <Dato
            icon={Scale}
            termino="Marco aplicado"
            valor={[
              versionNormativa.autoridad,
              versionNormativa.version ?? estructura?.nombre,
            ]
              .filter(Boolean)
              .join(' · ')}
          />
          <Dato
            icon={ModoIcon}
            termino="Forma de creación"
            valor={modo?.label ?? '—'}
          />
        </dl>

        {values.datosBasicos.motivoEstructuraManual && (
          <section className="border-warning/30 bg-warning/5 py-seccion border-b">
            <p className="text-sm font-semibold">
              Versión normativa elegida manualmente
            </p>
            <p className="text-muted-foreground mt-micro text-sm">
              {values.datosBasicos.motivoEstructuraManual}
            </p>
          </section>
        )}

        {values.tipoOrigen === 'IA' && (
          <section className="space-y-grupo py-region">
            <div>
              <h3 className="font-semibold">Encuadre para la generación</h3>
              <p className="text-muted-foreground mt-relacionado whitespace-pre-wrap">
                {values.iaConfig.descripcionEnfoqueAcademico}
              </p>
            </div>
            <p className="text-muted-foreground text-sm">
              {totalReferencias
                ? `${totalReferencias} referencia${totalReferencias === 1 ? '' : 's'} vinculada${totalReferencias === 1 ? '' : 's'}`
                : 'Sin referencias documentales'}
              {' · '}
              {values.iaConfig.alcance.lineasCurriculares
                ? 'Generará bloques de conocimiento'
                : 'No generará bloques'}
              {values.iaConfig.alcance.asignaturas ? ' y asignaturas' : ''}
            </p>
            <dl className="gap-seccion pt-seccion grid border-t sm:grid-cols-3">
              <DatoTexto
                termino="Perfil de ingreso"
                valor={values.iaBrief.fundamentos.perfilIngreso}
              />
              <DatoTexto
                termino="Perfil de egreso"
                valor={values.iaBrief.fundamentos.perfilEgreso}
              />
              <DatoTexto
                termino="Fines de aprendizaje"
                valor={values.iaBrief.fundamentos.finesAprendizaje}
              />
            </dl>
            {values.iaBrief.supuestos.length > 0 ? (
              <div className="border-border pt-seccion border-t">
                <h3 className="font-semibold">Supuestos explícitos</h3>
                <ul className="text-muted-foreground mt-relacionado space-y-micro pl-seccion list-disc text-sm">
                  {values.iaBrief.supuestos.map((supuesto) => (
                    <li key={supuesto}>{supuesto}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </section>
        )}

        {values.tipoOrigen === 'CLONADO_INTERNO' && (
          <p className="py-region text-sm">
            Se conservará la trazabilidad con{' '}
            <strong>
              {values.clonInterno.planOrigenNombre ?? 'el plan seleccionado'}
            </strong>
            .
          </p>
        )}
      </article>
    )
  },
})

function Dato({
  icon: Icon,
  termino,
  valor,
}: {
  icon: typeof CalendarDays
  termino: string
  valor: string
}) {
  return (
    <div className="gap-control flex">
      <Icon className="text-primary mt-micro size-5 shrink-0" />
      <div>
        <dt className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
          {termino}
        </dt>
        <dd className="mt-micro font-medium">{valor || '—'}</dd>
      </div>
    </div>
  )
}

function DatoTexto({ termino, valor }: { termino: string; valor: string }) {
  return (
    <div>
      <dt className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
        {termino}
      </dt>
      <dd className="mt-relacionado text-sm leading-relaxed">
        {valor || 'Por definir'}
      </dd>
    </div>
  )
}

function leerVersionNormativa(value: unknown): {
  autoridad: string | null
  version: string | null
} {
  if (!value || typeof value !== 'object') {
    return { autoridad: null, version: null }
  }
  const row = value as Record<string, unknown>
  return {
    autoridad:
      typeof row.autoridad_normativa === 'string'
        ? row.autoridad_normativa
        : null,
    version:
      typeof row.etiqueta_version === 'string' ? row.etiqueta_version : null,
  }
}
