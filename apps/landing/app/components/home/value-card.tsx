'use client'

import { motion } from 'motion/react'
import { Link2, Palette, Route, ShieldCheck } from 'lucide-react'
import type { ValueCard as ValueCardData, ValueCardIcon } from '@/app/lib/value-cards'

const ICONS: Record<ValueCardIcon, typeof Link2> = {
  link: Link2,
  shield: ShieldCheck,
  route: Route,
  palette: Palette,
}

interface ValueCardProps {
  card: ValueCardData
  index: number
}

export function ValueCard({ card, index }: ValueCardProps) {
  const Icon = ICONS[card.icon]

  return (
    <motion.article
      data-value-card={card.id}
      className="flex flex-col gap-4 border-t border-background/25 pt-6"
      initial={{ opacity: 0, y: 50 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-50px' }}
      transition={{
        duration: 0.6,
        delay: index * 0.15,
        ease: [0.25, 0.1, 0.25, 1],
      }}
    >
      <div className="flex items-center justify-between">
        <Icon aria-hidden className="size-10 sm:size-12" strokeWidth={1.5} />
        <span aria-hidden className="text-sm opacity-60">
          {String(index + 1).padStart(2, '0')}
        </span>
      </div>
      <h3 className="text-2xl font-bold sm:text-3xl">{card.title}</h3>
      <p className="text-base leading-7 sm:text-lg">{card.description}</p>
    </motion.article>
  )
}
