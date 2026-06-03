export function Header() {
  return (
    <div className="relative z-10 flex items-center gap-4 border-b bg-white shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-600 text-white">
        🎓
      </div>

      <div>
        <h1 className="text-xl font-semibold text-gray-900">
          Gestión Curricular
        </h1>
        <p className="text-sm text-gray-500">Sistema de Planes de Estudio</p>
      </div>
    </div>
  )
}
