import { cva } from 'class-variance-authority'
import { Slot } from 'radix-ui'
import * as React from 'react'

import type { VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

export type EspaciadoProximidad =
  | 'micro'
  | 'relacionado'
  | 'control'
  | 'grupo'
  | 'seccion'
  | 'region'
  | 'pagina'
  | 'exhibicion'

const proximityVariants = {
  micro: 'gap-micro',
  relacionado: 'gap-relacionado',
  control: 'gap-control',
  grupo: 'gap-grupo',
  seccion: 'gap-seccion',
  region: 'gap-region',
  pagina: 'gap-pagina',
  exhibicion: 'gap-exhibicion',
} satisfies Record<EspaciadoProximidad, string>

const stackVariants = cva('flex flex-col', {
  variants: {
    space: proximityVariants,
  },
  defaultVariants: {
    space: 'grupo',
  },
})

function Stack({
  className,
  space,
  asChild = false,
  ...props
}: React.ComponentProps<'div'> &
  VariantProps<typeof stackVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : 'div'

  return (
    <Comp
      data-slot="stack"
      data-space={space ?? 'grupo'}
      className={cn(stackVariants({ space }), className)}
      {...props}
    />
  )
}

const inlineVariants = cva('flex items-center', {
  variants: {
    space: proximityVariants,
    wrap: {
      true: 'flex-wrap',
      false: 'flex-nowrap',
    },
  },
  defaultVariants: {
    space: 'relacionado',
    wrap: false,
  },
})

function Inline({
  className,
  space,
  wrap,
  asChild = false,
  ...props
}: React.ComponentProps<'div'> &
  VariantProps<typeof inlineVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : 'div'

  return (
    <Comp
      data-slot="inline"
      data-space={space ?? 'relacionado'}
      className={cn(inlineVariants({ space, wrap }), className)}
      {...props}
    />
  )
}

const pageContainerVariants = cva(
  'px-grupo md:px-seccion lg:px-region mx-auto w-full',
  {
    variants: {
      width: {
        full: 'max-w-none',
        wide: 'max-w-7xl',
        content: 'max-w-5xl',
        reading: 'max-w-3xl',
      },
      spacing: {
        none: '',
        content: 'py-seccion lg:py-region',
        page: 'py-region lg:py-pagina',
      },
    },
    defaultVariants: {
      width: 'wide',
      spacing: 'content',
    },
  },
)

function PageContainer({
  className,
  width,
  spacing,
  as = 'div',
  asChild = false,
  ...props
}: React.ComponentProps<'div'> &
  VariantProps<typeof pageContainerVariants> & {
    as?: 'div' | 'main' | 'section'
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : as

  return (
    <Comp
      data-slot="page-container"
      className={cn(pageContainerVariants({ width, spacing }), className)}
      {...props}
    />
  )
}

export {
  Inline,
  PageContainer,
  Stack,
  inlineVariants,
  pageContainerVariants,
  stackVariants,
}
