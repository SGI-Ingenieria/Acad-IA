import { Outlet } from '@tanstack/react-router'

export function ReferencesLayout() {
  return (
    <main className="gap-seccion px-grupo py-seccion md:px-seccion lg:px-region mx-auto flex w-full max-w-6xl flex-col">
      <Outlet />
    </main>
  )
}
