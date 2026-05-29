import { createFileRoute } from '@tanstack/react-router'

import { IaPlanChatView } from './iaplan'

export const Route = createFileRoute('/planes/$planId/_detalle/iaplan_/chat')({
  component: ChatRouteComponent,
})

function ChatRouteComponent() {
  const { planId } = Route.useParams()

  return <IaPlanChatView planId={planId} chatOnly />
}