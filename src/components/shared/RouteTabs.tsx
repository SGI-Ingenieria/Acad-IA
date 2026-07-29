import { createLink } from '@tanstack/react-router'
import { useReducedMotion } from 'motion/react'
import * as React from 'react'

import type { LinkComponent } from '@tanstack/react-router'

import {
  MotionHighlight,
  MotionHighlightItem,
  useMotionHighlight,
} from '@/components/ui/motion-highlight'
import { cn } from '@/lib/utils'

type RouteTabsProps = {
  value: string
  children: React.ReactNode
  ariaLabel: string
  className?: string
}

function RouteTabs({ value, children, ariaLabel, className }: RouteTabsProps) {
  const reduceMotion = useReducedMotion()

  return (
    <div
      className={cn(
        'no-scrollbar touch-pan-x overflow-x-auto overscroll-x-contain border-b py-2',
        className,
      )}
    >
      <MotionHighlight
        mode="parent"
        controlledItems
        value={value}
        className="bg-card dark:bg-primary/10 ring-primary/20 rounded-lg shadow-sm ring-1"
        containerClassName="mx-auto w-max min-w-full sm:min-w-max"
        transition={
          reduceMotion
            ? { duration: 0 }
            : { type: 'spring', stiffness: 360, damping: 32, mass: 0.8 }
        }
      >
        <nav
          aria-label={ariaLabel}
          className="bg-secondary/65 dark:bg-muted/25 flex min-w-full items-center justify-start gap-1 rounded-xl p-1 shadow-inner sm:min-w-max sm:justify-center dark:shadow-none"
        >
          {children}
        </nav>
      </MotionHighlight>
    </div>
  )
}

interface RouteTabAnchorProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  tabValue: string
}

const RouteTabAnchor = React.forwardRef<HTMLAnchorElement, RouteTabAnchorProps>(
  ({ tabValue, className, children, ...props }, ref) => {
    const { activeValue } = useMotionHighlight<string>()
    const isActive = activeValue === tabValue

    return (
      <MotionHighlightItem value={tabValue} asChild>
        <a
          ref={ref}
          aria-current={isActive ? 'page' : undefined}
          className={cn(
            'text-muted-foreground hover:text-foreground focus-visible:ring-primary/30 relative z-1 inline-flex shrink-0 items-center justify-center rounded-lg px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-[color,transform] duration-200 ease-out hover:-translate-y-px focus-visible:ring-2 focus-visible:outline-none',
            isActive && 'text-primary font-semibold',
            className,
          )}
          {...props}
        >
          {children}
        </a>
      </MotionHighlightItem>
    )
  },
)
RouteTabAnchor.displayName = 'RouteTabAnchor'

const CreatedRouteTabLink = createLink(RouteTabAnchor)

const RouteTabLink: LinkComponent<typeof RouteTabAnchor> = (props) => (
  <CreatedRouteTabLink preload="intent" {...props} />
)

export { RouteTabLink, RouteTabs }
