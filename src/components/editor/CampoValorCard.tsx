import type { PayloadMejorarCampo, ResultadoMejorarCampo } from '@/data'
import type { DraftEntity } from '@/data/api/drafts.api'
import type { DatosGeneralesField } from '@/types/plan'

import { EditableNumber } from '@/components/ui/editable-number'
import { EditableSelect } from '@/components/ui/editable-select'
import { EditableText } from '@/components/ui/editable-text'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { idCampoAgente, useAccionAgente } from '@/features/agente'
import { ejemploDeEsquema } from '@/lib/campo-ejemplos'
import { cn } from '@/lib/utils'

/**
 * Tarjeta de un campo de valor único: enum, número o texto corto. Es la hermana
 * de `CampoCanvasCard`, que se ocupa de los campos de texto enriquecido.
 *
 * El valor ES el control: se muestra grande y centrado y se edita al hacer clic,
 * sin botón de edición aparte. En **modo agente** ese mismo clic lo intercepta
 * la IA (`modo: 'captura'`): no se abre el editor inline, se ajusta el valor con
 * las palabras de contexto del dock. Es la diferencia deliberada con los campos
 * de texto enriquecido, donde el cuerpo sigue siendo editable a mano y la IA
 * vive en un botón propio.
 */
export function CampoValorCard({
  campo,
  entidad,
  entidadId,
  onGuardar,
}: {
  campo: DatosGeneralesField
  entidad: DraftEntity
  entidadId: string
  /** Persiste el valor. Resuelve a `false` si el usuario canceló el override. */
  onGuardar: (valor: string) => Promise<boolean>
}) {
  const canEditInline = Boolean(campo.canEdit)
  const numericValue = campo.value.trim() !== '' ? Number(campo.value) : null

  const escribir = async (valor: string) => {
    const ok = await onGuardar(valor)
    if (!ok) throw new Error('No se pudo guardar el campo.')
  }

  const agente = useAccionAgente<ResultadoMejorarCampo, string>({
    id: idCampoAgente(entidad, entidadId, campo.clave),
    accion: 'mejorar_campo',
    etiqueta: `Ajustar «${campo.label}»`,
    ariaLabel: `Ajustar ${campo.label} con IA`,
    disabled: !campo.canUseIA,
    payload: () =>
      ({
        entidad,
        entidad_id: entidadId,
        clave: campo.clave,
        label: campo.label,
        ...(campo.helperText ? { ayuda: campo.helperText } : {}),
        contenido_actual: campo.value,
        es_richtext: false,
        campo_schema: campo.schema ?? null,
        ...(campo.tipo === 'select' && campo.opciones?.length
          ? { opciones: campo.opciones }
          : {}),
        ...(campo.tipo === 'number'
          ? { minimo: campo.minimum ?? null, maximo: campo.maximum ?? null }
          : {}),
      }) satisfies PayloadMejorarCampo,
    snapshot: () => campo.value,
    aplicar: (resultado) => escribir(resultado.contenido),
    restaurar: (previo) => escribir(previo),
  })

  // El control conserva su rol (botón, spinbutton, textbox) pero en modo agente
  // anuncia lo que va a ocurrir de verdad al activarlo, que ya no es editar.
  const etiquetaControl = agente.enModoAgente
    ? `Ajustar ${campo.label} con IA`
    : campo.label

  const control =
    campo.tipo === 'select' ? (
      <EditableSelect
        value={campo.value}
        options={campo.opciones ?? []}
        onSave={(value) => void onGuardar(value)}
        editable={canEditInline}
        ariaLabel={etiquetaControl}
        className="max-w-full"
      />
    ) : campo.tipo === 'number' ? (
      <EditableNumber
        value={numericValue}
        min={campo.minimum}
        max={campo.maximum}
        editable={canEditInline}
        onSave={(n) => void onGuardar(n === null ? '' : String(n))}
        ariaLabel={etiquetaControl}
        // En modo agente el clic ya no incrementa: los pasos +/− prometerían algo
        // que no va a pasar. El número sigue enfocable, así que el teclado
        // continúa disparando la acción de IA.
        showControls={!agente.enModoAgente}
        size="lg"
        underline
        className="text-foreground gap-3"
      />
    ) : (
      <EditableText
        value={campo.value}
        onSave={(value) => void onGuardar(value.trim())}
        editable={canEditInline}
        // Igual que en la tarjeta-canvas: si la estructura trae un ejemplo
        // redactado, vale más como pista que un «sin contenido» que no dice
        // qué se espera. `EditableText` ya lo pinta en cursiva y apagado.
        placeholder={
          campo.holder?.trim() ||
          ejemploDeEsquema(campo.schema) ||
          'Sin contenido.'
        }
        ariaLabel={etiquetaControl}
        className="whitespace-pre-wrap"
      />
    )

  return (
    <div
      className={cn(
        'bg-card border-border/70 hover:border-border rounded-2xl border transition-all hover:shadow-md',
        agente.halo.className,
      )}
      style={agente.halo.style}
    >
      <div className="bg-muted/30 flex items-center gap-2.5 border-b px-6 py-4">
        <Tooltip>
          <TooltipTrigger asChild>
            <h3 className="text-foreground cursor-help text-xl font-semibold tracking-tight">
              {campo.label}
            </h3>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs text-xs leading-relaxed">
            {campo.helperText || 'Información del campo'}
          </TooltipContent>
        </Tooltip>

        {campo.requerido && (
          <span className="text-destructive text-xs leading-none font-semibold">
            *
          </span>
        )}
      </div>

      <div
        className="flex min-h-16 flex-col items-center justify-center px-6 py-5"
        data-comment-scope="plan-field"
        data-comment-key={campo.clave}
      >
        {agente.ejecutando ? (
          <Skeleton className="h-7 w-44" />
        ) : (
          <div
            className={cn(
              'flex w-full items-center justify-center',
              agente.enModoAgente && 'cursor-pointer rounded-xl',
            )}
            {...agente.props}
          >
            {control}
          </div>
        )}

        {agente.rechazo && (
          <p className="text-muted-foreground animate-in fade-in mt-2 text-center text-xs leading-relaxed">
            {agente.rechazo}
          </p>
        )}
      </div>
    </div>
  )
}
