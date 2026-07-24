import { Outlet } from '@tanstack/react-router'

export function ReferencesLayout() {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 md:px-6 lg:px-8">
      <Outlet />
    </main>
  )
}
