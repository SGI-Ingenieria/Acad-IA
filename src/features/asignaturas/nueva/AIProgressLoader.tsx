import React, { useState, useEffect, useMemo } from 'react'

// --- DEFINICIÓN DE MENSAJES ---
const MENSAJES_CORTOS = [
  // Hasta 5 sugerencias (6 mensajes)
  'Analizando el plan de estudios...',
  'Identificando áreas de oportunidad...',
  'Consultando bases de datos académicas...',
  'Redactando competencias específicas...',
  'Calculando créditos y horas...',
  'Afinando los últimos detalles...',
]

const MENSAJES_MEDIOS = [
  // Hasta 10 sugerencias (10 mensajes)
  'Conectando con el motor de IA...',
  'Analizando estructura curricular...',
  'Buscando asignaturas compatibles...',
  'Verificando prerrequisitos...',
  'Generando descripciones detalladas...',
  'Balanceando cargas académicas...',
  'Asignando horas independientes...',
  'Validando coherencia temática...',
  'Formateando resultados...',
  'Finalizando generación...',
]

const MENSAJES_LARGOS = [
  // Más de 10 sugerencias (14 mensajes)
  'Iniciando procesamiento masivo...',
  'Escaneando retícula completa...',
  'Detectando líneas de investigación...',
  'Generando primer bloque de asignaturas...',
  'Evaluando pertinencia académica...',
  'Optimizando créditos por ciclo...',
  'Redactando objetivos de aprendizaje...',
  'Generando segundo bloque...',
  'Revisando duplicidad de contenidos...',
  'Ajustando tiempos teóricos y prácticos...',
  'Verificando normatividad...',
  'Compilando sugerencias...',
  'Aplicando formato final...',
  'Casi listo, gracias por tu paciencia...',
]

interface AIProgressLoaderProps {
  isLoading: boolean
  cantidadDeSugerencias: number
}

export const AIProgressLoader: React.FC<AIProgressLoaderProps> = ({
  isLoading,
  cantidadDeSugerencias,
}) => {
  const [progress, setProgress] = useState(0)
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0)

  // 1. Seleccionar el grupo de mensajes según la cantidad
  const messages = useMemo(() => {
    if (cantidadDeSugerencias <= 5) return MENSAJES_CORTOS
    if (cantidadDeSugerencias <= 10) return MENSAJES_MEDIOS
    return MENSAJES_LARGOS
  }, [cantidadDeSugerencias])

  useEffect(() => {
    if (!isLoading) {
      setProgress(0)
      setCurrentMessageIndex(0)
      return
    }

    // --- CÁLCULO DEL TIEMPO TOTAL ---
    // y = 4.07x + 10.93 (en segundos)
    const estimatedSeconds = 4.07 * cantidadDeSugerencias + 10.93
    const durationMs = estimatedSeconds * 1000

    // Intervalo de actualización de la barra (cada 50ms para suavidad)
    const updateInterval = 50
    const totalSteps = durationMs / updateInterval
    const incrementPerStep = 99 / totalSteps // Llegamos al 99% para esperar la respuesta real

    // --- TIMER 1: BARRA DE PROGRESO ---
    const progressTimer = setInterval(() => {
      setProgress((prev) => {
        const next = prev + incrementPerStep
        return next >= 99 ? 99 : next // Topar en 99%
      })
    }, updateInterval)

    // --- TIMER 2: MENSAJES (CADA 5 SEGUNDOS) ---
    const messagesTimer = setInterval(() => {
      setCurrentMessageIndex((prev) => {
        // Si ya es el último mensaje, no avanzar más (no ciclar)
        if (prev >= messages.length - 1) return prev
        return prev + 1
      })
    }, 5000)

    // Cleanup al desmontar o cuando isLoading cambie
    return () => {
      clearInterval(progressTimer)
      clearInterval(messagesTimer)
    }
  }, [isLoading, cantidadDeSugerencias, messages])

  if (!isLoading) return null

  return (
    <div className="animate-in fade-in zoom-in m-relacionado mx-auto w-full max-w-md duration-300">
      {/* Contenedor de la barra */}
      <div className="pt-micro relative">
        <div className="mb-relacionado flex items-center justify-between">
          <div>
            <span className="px-relacionado py-micro inline-block rounded-full bg-blue-200 text-xs font-semibold text-blue-600 uppercase">
              Generando IA
            </span>
          </div>
          <div className="text-right">
            <span className="inline-block text-xs font-semibold text-blue-600">
              {Math.floor(progress)}%
            </span>
          </div>
        </div>

        {/* Barra de fondo */}
        <div className="mb-grupo flex h-2 overflow-hidden rounded bg-blue-100 text-xs">
          {/* Barra de progreso dinámica */}
          <div
            style={{ width: `${progress}%` }}
            className="flex flex-col justify-center bg-blue-500 text-center whitespace-nowrap text-white shadow-none transition-all duration-75 ease-linear"
          ></div>
        </div>

        {/* Mensajes cambiantes */}
        <div className="h-6 text-center">
          {' '}
          {/* Altura fija para evitar saltos */}
          <p className="text-sm text-slate-500 italic transition-opacity duration-500">
            {messages[currentMessageIndex]}
          </p>
        </div>

        {/* Nota de tiempo estimado (Opcional, transparencia operacional) */}
        <p className="mt-relacionado text-center text-[10px] text-slate-400">
          Tiempo estimado: ~{Math.ceil(4.07 * cantidadDeSugerencias + 10.93)}{' '}
          segs
        </p>
      </div>
    </div>
  )
}
