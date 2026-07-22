import { Outlet } from '@tanstack/react-router'

export function ReferencesLayout() {
  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 md:px-6 lg:px-8">
      <header>
        <h1 className="text-foreground text-2xl font-semibold tracking-tight">
          Referencias
        </h1>
      </header>
      <Outlet />
    </main>
  )
}
