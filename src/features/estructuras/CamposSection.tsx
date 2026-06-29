import { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'

import { CamposEditor } from './CamposEditor'
import {
  CamposSiempreIncluidos,
  esLlaveReservada,
} from './CamposSiempreIncluidos'
import { camposToDefinicion, getTipoCampo, parseCampos } from './types'

import type {
  CampoDefinicion,
  EstructuraAsignatura,
  EstructuraPlan,
} from './types'
import type { EstructuraPropagationOperations } from '@/data/api/meta.api'

import {
  useEstructurasAsignaturaCrud,
  useEstructurasPlanCrud,
  useEstadosPlan,
} from '@/data'
import { cloneRestriccion } from '@/lib/field-restrictions'

type Modo = 'planes' | 'materias'
type Estructura = EstructuraPlan | EstructuraAsignatura
type SaveState = 'idle' | 'pending' | 'saving' | 'saved' | 'error'

const AUTOSAVE_DELAY_MS = 700

function cloneCampos(campos: Array<CampoDefinicion>) {
  return campos.map((campo) => ({
    ...campo,
    enum: campo.enum ? [...campo.enum] : undefined,
    ejemplos: campo.ejemplos ? [...campo.ejemplos] : undefined,
    restriccion: cloneRestriccion(campo.restriccion),
  }))
}

function fingerprintCampos(campos: Array<CampoDefinicion>) {
  return JSON.stringify(
    campos.map((campo) => ({
      uid: campo.uid,
      key: campo.key,
      titulo: campo.titulo,
      descripcion: campo.descripcion,
      tipo: campo.tipo,
      enum: campo.enum ?? null,
      ejemplos: campo.ejemplos ?? null,
      minimum: campo.minimum ?? null,
      maximum: campo.maximum ?? null,
      referencia_normativa: campo.referencia_normativa ?? null,
      restriccion: campo.restriccion ?? null,
      requerido: campo.requerido,
      orden: campo.orden,
    })),
  )
}

function pushUnique(values: Array<string>, value: string | undefined) {
  const trimmed = value?.trim()
  if (!trimmed || values.includes(trimmed)) return
  values.push(trimmed)
}

function buildPropagationOperations(
  previous: Array<CampoDefinicion>,
  current: Array<CampoDefinicion>,
): EstructuraPropagationOperations {
  const currentByUid = new Map(
    current.filter((campo) => campo.uid).map((campo) => [campo.uid, campo]),
  )
  const removed: Array<string> = []
  const typeChanged: Array<string> = []
  const renames: Array<{ from: string; to: string }> = []

  for (const before of previous) {
    const after = before.uid ? currentByUid.get(before.uid) : undefined
    const beforeKey = before.key.trim()

    if (!after) {
      pushUnique(removed, beforeKey)
      continue
    }

    const afterKey = after.key.trim()
    if (beforeKey && afterKey && beforeKey !== afterKey) {
      renames.push({ from: beforeKey, to: afterKey })
    }

    if (getTipoCampo(before) !== getTipoCampo(after)) {
      pushUnique(typeChanged, afterKey || beforeKey)
    }
  }

  return { renames, removed, typeChanged }
}

function validateCampos(
  campos: Array<CampoDefinicion>,
  modo: 'plan' | 'asignatura',
) {
  const keys = new Set<string>()

  for (const campo of campos) {
    const key = campo.key.trim()
    if (!key || !campo.titulo.trim() || !campo.descripcion.trim()) {
      return 'Completa los campos marcados como incompletos.'
    }

    if (esLlaveReservada(modo, key)) {
      return `La llave "${key}" ya es un campo siempre incluido.`
    }

    if (keys.has(key)) {
      return `La llave "${key}" está duplicada.`
    }
    keys.add(key)

    if (getTipoCampo(campo) === 'enum') {
      const opciones = campo.enum ?? []
      if (opciones.length === 0 || opciones.some((op) => !op.trim())) {
        return 'Completa las opciones del campo.'
      }
    }

    if (
      campo.restriccion &&
      campo.restriccion.estados_editables.length === 0
    ) {
      return 'Selecciona al menos un estado editable para cada campo restringido.'
    }
  }

  return null
}

export function CamposSection({
  estructura,
  modo,
}: {
  estructura: Estructura
  modo: Modo
}) {
  const planCrud = useEstructurasPlanCrud()
  const asigCrud = useEstructurasAsignaturaCrud()
  const { data: estadosPlan = [] } = useEstadosPlan()
  const planUpdateRef = useRef(planCrud.update)
  const asigUpdateRef = useRef(asigCrud.update)

  const [campos, setCampos] = useState<Array<CampoDefinicion>>(() =>
    parseCampos(estructura.definicion),
  )
  const [dirty, setDirty] = useState(false)
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const savedCamposRef = useRef<Array<CampoDefinicion> | null>(null)
  const latestFingerprintRef = useRef(fingerprintCampos(campos))

  if (savedCamposRef.current === null) {
    savedCamposRef.current = cloneCampos(campos)
  }

  useEffect(() => {
    planUpdateRef.current = planCrud.update
    asigUpdateRef.current = asigCrud.update
  }, [asigCrud.update, planCrud.update])

  useEffect(() => {
    const parsed = parseCampos(estructura.definicion)
    savedCamposRef.current = cloneCampos(parsed)
    latestFingerprintRef.current = fingerprintCampos(parsed)
    setCampos(parsed)
    setDirty(false)
    setSaveState('idle')
    // Sólo reiniciamos el editor cuando cambia la estructura seleccionada; el
    // autoguardado actualiza `estructura.definicion` sin necesitar remontar campos.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estructura.id])

  const modoCampo = modo === 'planes' ? 'plan' : 'asignatura'
  const validationError = useMemo(
    () => validateCampos(campos, modoCampo),
    [campos, modoCampo],
  )

  useEffect(() => {
    if (!dirty) return

    if (validationError) {
      setSaveState('idle')
      return
    }

    setSaveState('pending')
    const snapshot = cloneCampos(campos)
    const snapshotFingerprint = fingerprintCampos(snapshot)
    const timeoutId = window.setTimeout(() => {
      const definicion = camposToDefinicion(snapshot)
      const propagationOperations = buildPropagationOperations(
        savedCamposRef.current ?? [],
        snapshot,
      )
      const updateMutation =
        modo === 'planes' ? planUpdateRef.current : asigUpdateRef.current

      setSaveState('saving')
      void updateMutation
        .mutateAsync({
          id: estructura.id,
          input: { definicion, propagationOperations },
        })
        .then(() => {
          savedCamposRef.current = cloneCampos(snapshot)
          if (latestFingerprintRef.current === snapshotFingerprint) {
            setDirty(false)
            setSaveState('saved')
          }
        })
        .catch(() => {
          setSaveState('error')
          toast.error('No se pudo guardar la estructura')
        })
    }, AUTOSAVE_DELAY_MS)

    return () => window.clearTimeout(timeoutId)
  }, [campos, dirty, estructura.id, modo, validationError])

  const handleCamposChange = (next: Array<CampoDefinicion>) => {
    latestFingerprintRef.current = fingerprintCampos(next)
    setCampos(next)
    setDirty(true)
  }

  const requiresDeleteConfirmation = (campo: CampoDefinicion) => {
    const saved = savedCamposRef.current?.find((item) => item.uid === campo.uid)
    return Boolean(saved?.key.trim())
  }

  const saveLabel =
    validationError ??
    (saveState === 'saving'
      ? 'Guardando...'
      : saveState === 'pending'
        ? 'Cambios pendientes'
        : saveState === 'saved'
          ? 'Guardado'
          : saveState === 'error'
            ? 'No guardado'
            : null)

  return (
    <div className="space-y-4">
      <CamposSiempreIncluidos
        modo={modo === 'planes' ? 'plan' : 'asignatura'}
      />
      <div>
        <div className="flex items-end justify-between gap-3">
          <div>
            <h3 className="text-foreground text-sm font-semibold">
              Campos adicionales de la estructura
            </h3>
            <p className="text-muted-foreground text-sm">
              Define campos extra (más allá de los que siempre se incluyen).
              Arrastra para reordenar.
            </p>
          </div>
          {saveLabel && (
            <p
              className={
                validationError || saveState === 'error'
                  ? 'text-destructive text-xs font-medium'
                  : 'text-muted-foreground text-xs font-medium'
              }
            >
              {saveLabel}
            </p>
          )}
        </div>
      </div>
      <CamposEditor
        campos={campos}
        modo={modo === 'planes' ? 'plan' : 'asignatura'}
        onChange={handleCamposChange}
        requiresDeleteConfirmation={requiresDeleteConfirmation}
        estadosPlan={estadosPlan}
      />
    </div>
  )
}
