interface Props {
  value: 'internal' | 'external'
  onChange: (v: 'internal' | 'external') => void
}

export function LoginTabs({ value, onChange }: Props) {
  const tabs: Array<{ key: 'internal' | 'external'; label: string }> = [
    { key: 'internal', label: 'Interno' },
    { key: 'external', label: 'Externo' },
  ]

  return (
    <div className="bg-background mb-seccion p-micro flex rounded-lg">
      {tabs.map((tab) => {
        const active = value === tab.key
        return (
          <button
            key={tab.key}
            onClick={() => onChange(tab.key)}
            className={`py-relacionado flex-1 rounded-md text-sm font-medium transition-colors duration-150 ${
              active
                ? 'bg-card text-card-foreground shadow'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}
