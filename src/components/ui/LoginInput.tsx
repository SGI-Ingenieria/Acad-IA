import { Eye, EyeOff } from 'lucide-react'
import { useState } from 'react'

interface InputProps {
  label: string
  value: string
  onChange: (value: string) => void
  type?: string
  disabled?: boolean
  placeholder?: string
}

export function LoginInput({
  label,
  value,
  onChange,
  type = 'text',
  disabled = false,
  placeholder,
}: InputProps) {
  const isPassword = type === 'password'
  const [showPassword, setShowPassword] = useState(false)
  const resolvedType = isPassword ? (showPassword ? 'text' : 'password') : type

  return (
    <div className="space-y-1">
      <label className="text-foreground text-sm font-medium">{label}</label>
      <div className="relative">
        <input
          type={resolvedType}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          placeholder={placeholder}
          className="bg-background text-foreground placeholder:text-muted-foreground border-border focus-visible:border-ring/50 focus-visible:ring-ring/15 w-full rounded-xl border-[0.5px] px-3 py-2 text-sm shadow-sm focus-visible:ring-[1px] focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
        />
        {isPassword && (
          <button
            type="button"
            tabIndex={-1}
            onClick={() => setShowPassword((v) => !v)}
            className="text-muted-foreground hover:text-foreground absolute top-1/2 right-3 -translate-y-1/2 transition-colors"
            aria-label={
              showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'
            }
          >
            {showPassword ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </button>
        )}
      </div>
    </div>
  )
}
