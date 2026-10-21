'use client'

import Image from 'next/image'
import { motion } from 'motion/react'
import { useEffect, useState, type RefObject, useRef } from 'react'

const textVariants = {
  hidden: { opacity: 0 },
  visible: (i: number) => ({
    opacity: 1,
    transition: {
      delay: 2 + i * 0.05,
      duration: 0.3,
    },
  }),
}

const containerVariants = {
  hidden: { opacity: 1 },
  visible: {
    transition: {
      staggerChildren: 0.05,
      delayChildren: 2,
    },
  },
}

interface AnimationOverlayProps {
  onComplete?: () => void
  headerRef?: RefObject<Element | null>
}

export function AnimationOverlay({ onComplete, headerRef }: AnimationOverlayProps) {
  const overlayLogoRef = useRef<HTMLDivElement | null>(null)
  const [headerPos, setHeaderPos] = useState({ x: 0, y: 0 })

  useEffect(() => {
    if (!headerRef?.current || !overlayLogoRef.current) return

    const compute = () => {
      const targetRect = headerRef.current!.getBoundingClientRect()
      const sourceRect = overlayLogoRef.current!.getBoundingClientRect()

      const targetCenterX = targetRect.left + targetRect.width / 2
      const targetCenterY = targetRect.top + targetRect.height / 2
      const sourceCenterX = sourceRect.left + sourceRect.width / 2
      const sourceCenterY = sourceRect.top + sourceRect.height / 2

      setHeaderPos({ x: targetCenterX - sourceCenterX, y: targetCenterY - sourceCenterY })
    }

    const timeout = setTimeout(compute, 1600)
    return () => clearTimeout(timeout)
  }, [headerRef])

  return (
    <motion.div
      aria-hidden
      className="fixed inset-0 z-999 w-screen h-screen bg-black pointer-events-none"
      initial={{ opacity: 1 }}
      animate={{ opacity: 0 }}
      transition={{
        delay: 3,
        duration: 1,
      }}
      onAnimationComplete={onComplete}
    >
      <div className="w-full h-full flex items-center justify-center">
        <motion.div
          className="flex items-center gap-4"
          initial={{
            x: 0,
            y: 0,
          }}
          animate={{
            x: [0, 0, headerPos.x],
            y: [0, 0, headerPos.y],
          }}
          transition={{
            duration: 1.3,
            times: [0, 1],
            ease: 'easeOut',
          }}
        >
          <div ref={overlayLogoRef} className="shrink-0 sm:w-16 w-12 sm:h-16 h-12">
            <Image src="/logo-light.png" alt="" width={64} height={64} priority className="w-full h-full" />
          </div>
          <motion.div
            className="flex gap-1 whitespace-nowrap overflow-hidden"
            variants={containerVariants}
            initial={{ opacity: 0, width: 0 }}
            animate={{ opacity: 1, width: 'auto' }}
            transition={{
              width: { delay: 1, duration: 0.5 },
              opacity: { duration: 0 },
            }}
          >
            {'PLGRND'.split('').map((char, i) => (
              <motion.span
                key={i}
                className="sm:text-3xl text-xl font-bold text-foreground inline-block"
                custom={i}
                variants={textVariants}
              >
                {char}
              </motion.span>
            ))}
          </motion.div>
        </motion.div>
      </div>
    </motion.div>
  )
}
