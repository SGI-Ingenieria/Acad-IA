import { LayoutGrid, BookOpen } from 'lucide-react'

import type { LucideIcon } from 'lucide-react'

export function Sidebar() {
  return (
    <aside className="px-grupo py-seccion w-64 border-r bg-white">
      <h2 className="mb-seccion text-lg font-semibold">Planes de Estudio</h2>

      <nav className="space-y-relacionado">
        <NavItem icon={LayoutGrid} label="Dashboard" active />
        <NavItem icon={BookOpen} label="Planes" />
      </nav>
    </aside>
  )
}

interface NavItemProps {
  icon: LucideIcon
  label: string
  active?: boolean
}

function NavItem({ icon: Icon, label, active }: NavItemProps) {
  return (
    <div
      className={`gap-control px-control py-relacionado flex cursor-pointer items-center rounded-lg ${
        active ? 'bg-gray-100 text-gray-900' : 'text-gray-500 hover:bg-gray-50'
      }`}
    >
      <Icon size={18} />
      <span className="text-sm font-medium">{label}</span>
    </div>
  )
}
