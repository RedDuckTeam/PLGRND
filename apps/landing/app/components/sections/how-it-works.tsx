'use client'

import { motion } from 'motion/react'
import { ArrowRight } from 'lucide-react'
import { HOW_IT_WORKS } from '../../lib/product'
import { SectionHeading } from '../home/section-heading'

export function HowItWorks() {
  return (
    <section
      aria-labelledby="how-it-works-title"
      className="bg-primary-2 px-4 py-16 text-white sm:px-6 sm:py-24 xl:px-12"
    >
      <SectionHeading index="03" label="How it works" className="mb-10 sm:mb-12" />
      <h2 id="how-it-works-title" className="max-w-3xl text-[28px] font-bold leading-tight sm:text-4xl xl:text-5xl">
        Drag, wire, send, share.
      </h2>
      <ol className="mt-12 grid grid-cols-1 gap-x-10 gap-y-12 sm:grid-cols-2 lg:mt-16 lg:grid-cols-4">
        {HOW_IT_WORKS.map((step, index) => (
          <motion.li
            key={step.id}
            className="flex flex-col gap-4"
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-50px' }}
            transition={{
              duration: 0.6,
              delay: index * 0.15,
              ease: [0.25, 0.1, 0.25, 1],
            }}
          >
            <div aria-hidden className="flex items-center gap-3">
              <span className="text-5xl font-bold xl:text-6xl">{String(index + 1).padStart(2, '0')}</span>
              <span className="h-px flex-1 bg-white/40" />
              {index < HOW_IT_WORKS.length - 1 && <ArrowRight className="hidden size-5 shrink-0 lg:block" />}
            </div>
            <h3 className="mt-2 text-2xl font-bold sm:text-3xl">{step.title}</h3>
            <p className="text-base leading-7 sm:text-lg">{step.description}</p>
          </motion.li>
        ))}
      </ol>
    </section>
  )
}
