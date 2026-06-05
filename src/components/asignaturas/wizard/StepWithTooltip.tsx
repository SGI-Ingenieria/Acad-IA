import { useState } from 'react'

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

export function StepWithTooltip({
  title,
  desc,
}: {
  title: string
  desc: string
}) {
  const [isOpen, setIsOpen] = useState(false)
  return (
    <TooltipProvider delayDuration={0}>
      <Tooltip open={isOpen} onOpenChange={setIsOpen}>
        <TooltipTrigger asChild>
          <span
            className="cursor-help decoration-dotted underline-offset-4 hover:underline"
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation()
              setIsOpen((prev) => !prev)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.stopPropagation()
                setIsOpen((prev) => !prev)
              }
            }}
            onMouseEnter={() => setIsOpen(true)}
            onMouseLeave={() => setIsOpen(false)}
          >
            {title}
          </span>
        </TooltipTrigger>
        <TooltipContent className="max-w-50 text-xs">
          <p>{desc}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
