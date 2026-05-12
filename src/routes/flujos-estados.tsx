import { createFileRoute } from '@tanstack/react-router'
import { GitBranch } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

export const Route = createFileRoute('/flujos-estados')({
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <main className="bg-background min-h-screen w-full">
      <div className="mx-auto flex w-full flex-col gap-6 p-4 md:px-6 md:pb-6 lg:px-8 lg:pb-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="text-primary bg-primary/10 rounded-lg p-2">
              <GitBranch className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-foreground text-3xl font-bold">
                Flujos y Estados
              </h1>
              <p className="text-muted-foreground text-sm">
                Gestión de flujos y estados de aprobación
              </p>
            </div>
          </div>
          <Button>Nuevo Flujo</Button>
        </div>

        <Card className="p-6">
          <div className="flex flex-col items-center justify-center gap-4 py-12">
            <GitBranch className="text-muted-foreground h-12 w-12" />
            <div className="text-center">
              <h2 className="text-foreground text-xl font-semibold">
                Sin flujos registrados
              </h2>
              <p className="text-muted-foreground text-sm">
                Comienza creando un nuevo flujo
              </p>
            </div>
          </div>
        </Card>
      </div>
    </main>
  )
}
