'use client'

import * as React from 'react'
import { motion, type Transition } from 'motion/react'
import { cn } from '@/app/lib/utils'

type GradientTextProps = React.ComponentProps<'span'> & {
  text: string
  gradient?: string
  transition?: Transition
}

export function GradientText({
  text,
  className,
  gradient = 'linear-gradient(90deg, #3b82f6 0%, #a855f7 20%, #ec4899 50%, #a855f7 80%, #3b82f6 100%)',
  transition = { duration: 3, repeat: Infinity, ease: 'linear' },
  ...props
}: GradientTextProps) {
  return (
    <span data-slot="gradient-text" className={cn('relative inline-block', className)} {...props}>
      <motion.span
        className="m-0 text-transparent bg-clip-text bg-[length:200%_100%]"
        style={{ backgroundImage: gradient }}
        animate={{ backgroundPositionX: ['0%', '200%'] }}
        transition={transition}
      >
        {text}
      </motion.span>
    </span>
  )
}
