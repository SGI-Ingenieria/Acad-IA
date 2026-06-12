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
          <button
            type="button"
            className="cursor-help decoration-dotted underline-offset-4 hover:underline"
            onClick={(e) => {
              e.stopPropagation()
              setIsOpen((prev) => !prev)
            }}
            onMouseEnter={() => setIsOpen(true)}
            onMouseLeave={() => setIsOpen(false)}
          >
            {title}
          </button>
        </TooltipTrigger>
        <TooltipContent className="max-w-50 text-xs">
          <p>{desc}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
