'use client'

import { motion, type HTMLMotionProps, type Transition, type Variants } from 'motion/react'
import { cn } from '../../lib/utils'

type FlipButtonProps = HTMLMotionProps<'span'> & {
  frontText: string
  backText: string
  frontClassName?: string
}

const SPRING: Transition = { type: 'spring', stiffness: 280, damping: 20 }
const FACE = 'absolute inset-0 flex items-center justify-center rounded-sm'

const FRONT: Variants = {
  initial: { opacity: 1, rotateX: 0, y: '0%' },
  hover: { opacity: 0, rotateX: 90, y: '50%' },
}
const BACK: Variants = {
  initial: { opacity: 0, rotateX: 90, y: '-50%' },
  hover: { opacity: 1, rotateX: 0, y: '0%' },
}

export function FlipButton({ frontText, backText, className, frontClassName, ...props }: FlipButtonProps) {
  return (
    <motion.span
      data-slot="flip-button"
      initial="initial"
      whileHover="hover"
      whileTap={{ scale: 0.95 }}
      className={cn(
        'relative inline-flex w-max h-[60px] xl:px-6 px-4 py-2 text-[22px] xl:text-[28px] font-medium cursor-pointer rounded-sm perspective-[1000px] transition-all',
        className
      )}
      {...props}
    >
      <motion.span
        data-slot="flip-button-front"
        variants={FRONT}
        transition={SPRING}
        className={cn(FACE, 'bg-background text-primary', frontClassName)}
      >
        {frontText}
      </motion.span>

      <motion.span
        data-slot="flip-button-back"
        variants={BACK}
        transition={SPRING}
        className={cn(FACE, 'bg-primary-2 text-foreground')}
      >
        {backText}
      </motion.span>

      <span className="invisible select-none">{frontText}</span>
    </motion.span>
  )
}
