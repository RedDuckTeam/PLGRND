import { Activity, Boxes, Braces, Share2 } from 'lucide-react'
import { PRODUCT_LEAD, PRODUCT_POINTS, type ProductPointIcon } from '../../lib/product'
import { SectionHeading } from '../home/section-heading'

const ICONS: Record<ProductPointIcon, typeof Boxes> = {
  blocks: Boxes,
  live: Activity,
  idl: Braces,
  link: Share2,
}

export function WhatIsPlgrnd() {
  return (
    <section aria-labelledby="what-is-plgrnd-title" className="px-4 py-16 sm:px-6 sm:py-24 xl:px-12">
      <SectionHeading index="02" label="What is PLGRND" className="mb-10 text-muted-foreground sm:mb-12" />
      <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,2.4fr)] lg:gap-12">
        <div className="flex flex-col gap-6">
          <h2 id="what-is-plgrnd-title" className="text-[28px] font-bold leading-tight sm:text-4xl">
            A visual playground for Solana.
          </h2>
          <p className="leading-7 text-muted-foreground">{PRODUCT_LEAD}</p>
        </div>
        <ul className="grid grid-cols-1 gap-x-10 gap-y-12 sm:grid-cols-2">
          {PRODUCT_POINTS.map((point, index) => {
            const Icon = ICONS[point.icon]
            return (
              <li key={point.id} className="flex flex-col gap-4 border-t border-foreground/15 pt-6">
                <div className="flex items-center justify-between">
                  <Icon aria-hidden className="size-8 text-primary sm:size-10" strokeWidth={1.5} />
                  <span aria-hidden className="text-sm text-muted-foreground">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                </div>
                <h3 className="text-xl font-bold sm:text-2xl">{point.title}</h3>
                <p className="leading-7 text-muted-foreground">{point.description}</p>
              </li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}
