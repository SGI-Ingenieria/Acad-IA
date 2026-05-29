interface InputProps {
  label: string
  value: string
  onChange: (value: string) => void
  type?: string
}

export function LoginInput({
  label,
  value,
  onChange,
  type = 'text',
}: InputProps) {
  return (
    <div className="space-y-1">
      <label className="text-foreground text-sm font-medium">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-background text-foreground placeholder:text-muted-foreground border-border focus-visible:border-ring focus-visible:ring-ring/50 w-full rounded-xl border px-3 py-2 text-sm shadow-sm transition-colors focus-visible:ring-[3px] focus-visible:outline-none"
      />
    </div>
  )
}
