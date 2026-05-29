interface Props {
  text?: string
}

export function SubmitButton({ text = 'Iniciar sesión' }: Props) {
  return (
    <button
      type="submit"
      className="bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:ring-ring/50 w-full rounded-xl py-2.5 text-sm font-semibold shadow-md transition-colors focus-visible:ring-[3px] focus-visible:outline-none"
    >
      {text}
    </button>
  )
}
