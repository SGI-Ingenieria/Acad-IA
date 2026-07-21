import { Outlet } from '@tanstack/react-router'

export function ReferencesLayout() {
  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 md:px-6 lg:px-8">
      <header>
        <h1 className="text-foreground text-2xl font-semibold tracking-tight">
          Referencias
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Una biblioteca académica para organizar, reutilizar y rastrear las
          fuentes que utiliza la IA.
        </p>
      </header>
      <Outlet />
    </main>
  )
}
