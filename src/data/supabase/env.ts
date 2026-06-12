export function getEnv(...keys: string[]): string {
  for (const key of keys) {
    const fromProcess =
      typeof process !== 'undefined' ? (process as any).env?.[key] : undefined

    // Vite / bundlers
    const fromImportMeta =
      typeof import.meta !== 'undefined'
        ? (import.meta as any).env?.[key]
        : undefined

    const value = fromProcess ?? fromImportMeta
    if (typeof value === 'string' && value.trim().length > 0)
      return value.trim()
  }

  throw new Error(`Falta variable de entorno. Probé: ${keys.join(', ')}`)
}
