interface Props {
  text?: string
  loading?: boolean
}

export function SubmitButton({ text = 'Iniciar sesión', loading = false }: Props) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:ring-ring/50 w-full cursor-pointer rounded-xl py-2.5 text-sm font-semibold shadow-md transition-colors focus-visible:ring-[3px] focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60"
    >
      {loading ? 'Iniciando sesión...' : text}
    </button>
  )
}
