import { Link, useRouter } from '@tanstack/react-router'
import { FileQuestion, Home, ArrowLeft } from 'lucide-react'

import { Button } from './button'

interface NotFoundPageProps {
  title?: string
  message?: string
  children?: React.ReactNode
}

export function NotFoundPage({
  title = 'Página no encontrada',
  message = 'Lo sentimos, no pudimos encontrar lo que buscabas. Es posible que la página haya sido movida o eliminada.',
  children,
}: NotFoundPageProps) {
  const router = useRouter()

  return (
    <div className="p-grupo flex min-h-[60vh] flex-col items-center justify-center text-center">
      <div className="bg-muted mb-seccion p-seccion rounded-full">
        <FileQuestion className="text-muted-foreground h-12 w-12" />
      </div>

      <h1 className="mb-relacionado text-3xl font-bold tracking-tight">
        {title}
      </h1>
      <p className="text-muted-foreground mb-region max-w-125">{message}</p>

      <div className="gap-relacionado flex flex-col sm:flex-row">
        <Button variant="outline" onClick={() => router.history.back()}>
          <ArrowLeft className="mr-relacionado h-4 w-4" />
          Regresar
        </Button>

        <Button asChild>
          <Link to="/">
            <Home className="mr-relacionado h-4 w-4" />
            Ir al inicio
          </Link>
        </Button>
        {children}
      </div>
    </div>
  )
}
