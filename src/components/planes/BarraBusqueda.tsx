import { SearchIcon } from 'lucide-react'
import { useId } from 'react'

import { Input } from '@/components/ui/input'

type Props = {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
}

const BarraBusqueda: React.FC<Props> = ({
  value,
  onChange,
  placeholder = 'Buscar…',
  className,
}) => {
  const id = useId()

  return (
    <div className={['relative', className].filter(Boolean).join(' ')}>
      <div className="text-muted-foreground pl-control pointer-events-none absolute inset-y-0 left-0 flex items-center justify-center peer-disabled:opacity-50">
        <SearchIcon className="size-4" />
        <span className="sr-only">Buscar</span>
      </div>
      <Input
        id={id}
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="peer px-pagina [&::-webkit-search-cancel-button]:appearance-none [&::-webkit-search-decoration]:appearance-none [&::-webkit-search-results-button]:appearance-none [&::-webkit-search-results-decoration]:appearance-none"
      />
    </div>
  )
}

export default BarraBusqueda
