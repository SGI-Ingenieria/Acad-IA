import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/referencias/')({
  beforeLoad: () => {
    throw redirect({ to: '/referencias/repositorios' })
  },
})
