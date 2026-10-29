'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { cn } from '@/app/lib/utils'

interface ReadyIndicatorProps {
  children: ReactNode
  className?: string
}

export function ReadyIndicator({ children, className }: ReadyIndicatorProps) {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const wrapper = wrapperRef.current
    if (!wrapper) return

    const markReady = () => setReady(true)
    const onMessage = (event: MessageEvent) => {
      if (event.data?.type !== 'plgrnd:ready' || !event.source) return
      const fromChildFrame = Array.from(wrapper.querySelectorAll('iframe')).some(
        (frame) => frame.contentWindow === event.source
      )
      if (fromChildFrame) markReady()
    }

    wrapper.addEventListener('plgrnd:ready', markReady)
    window.addEventListener('message', onMessage)
    return () => {
      wrapper.removeEventListener('plgrnd:ready', markReady)
      window.removeEventListener('message', onMessage)
    }
  }, [])

  return (
    <div ref={wrapperRef} data-plgrnd-ready={ready ? 'true' : 'false'} className={cn('relative', className)}>
      {children}
      {ready && (
        <span className="pointer-events-none absolute -top-2.5 right-3 z-10 inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-2 py-0.5 text-xs text-foreground">
          <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-primary" />
          live
        </span>
      )}
    </div>
  )
}
