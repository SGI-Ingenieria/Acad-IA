import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/archivos')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/archivos"!</div>
}
