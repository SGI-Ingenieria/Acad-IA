import { LayoutGrid, BookOpen } from 'lucide-react'

import type { LucideIcon } from 'lucide-react'

export function Sidebar() {
  return (
    <aside className="w-64 border-r bg-white px-4 py-6">
      <h2 className="mb-6 text-lg font-semibold">Planes de Estudio</h2>

      <nav className="space-y-2">
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
      className={`flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 ${
        active ? 'bg-gray-100 text-gray-900' : 'text-gray-500 hover:bg-gray-50'
      }`}
    >
      <Icon size={18} />
      <span className="text-sm font-medium">{label}</span>
    </div>
  )
}
