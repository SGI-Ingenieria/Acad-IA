import { useEffect, useState } from 'react'
import { BookOpen } from 'lucide-react'
import type { LucideProps } from 'lucide-react'

type LucideIcon = React.ComponentType<LucideProps>

const iconCache = new Map<string, LucideIcon>()

export function DynamicIcon({
  name,
  ...props
}: { name: string | null } & LucideProps) {
  const [Icon, setIcon] = useState<LucideIcon>(
    () => iconCache.get(name ?? '') ?? BookOpen,
  )

  useEffect(() => {
    if (!name) {
      setIcon(() => BookOpen)
      return
    }
    const cached = iconCache.get(name)
    if (cached) {
      setIcon(() => cached)
      return
    }
    import('lucide-react').then((icons) => {
      const resolved = ((icons as any)[name] as LucideIcon | undefined) ?? BookOpen
      iconCache.set(name, resolved)
      setIcon(() => resolved)
    })
  }, [name])

  return <Icon {...props} />
}
