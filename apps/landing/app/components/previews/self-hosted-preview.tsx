'use client'

import { PlgrndRegister } from '@/app/components/plgrnd/plgrnd-register'
import { ReadyIndicator } from '@/app/components/plgrnd/ready-indicator'
import { ANCHOR_PDA_SEEDS_FLOW } from '@/app/lib/flows'
import { SDK_VERSION } from '@/app/lib/plgrnd'
import { cn } from '@/app/lib/utils'

interface SelfHostedPreviewProps {
  caption: string
  className?: string
}

export function SelfHostedPreview({ caption, className }: SelfHostedPreviewProps) {
  return (
    <figure className={cn('min-w-0 overflow-hidden rounded-lg border border-border bg-[#121212]', className)}>
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-2.5 text-xs text-muted-foreground">
        <span className="flex min-w-0 items-center gap-2">
          <span aria-hidden className="size-2 shrink-0 bg-primary-2" />
          <span className="truncate">example / pda-seeds</span>
        </span>
        <span className="shrink-0">@plgrnd/embed {SDK_VERSION}</span>
      </div>
      <ReadyIndicator>
        <plgrnd-flow
          flow={ANCHOR_PDA_SEEDS_FLOW}
          theme="dark"
          link-ref="plgrnd-docs"
          style={{ display: 'block', aspectRatio: '16/9', minHeight: 320 }}
        />
      </ReadyIndicator>
      <figcaption className="border-t border-border px-4 py-3 text-sm leading-6 text-muted-foreground">
        {caption}
      </figcaption>
      <PlgrndRegister />
    </figure>
  )
}
