'use client'

import { useRef, useState, type KeyboardEvent } from 'react'
import { cn } from '@/app/lib/utils'

export type CodeTab = {
  id: string
  label: string
  platforms: string[]
  html: string
  code: string
}

type CodeTabsProps = {
  idPrefix: string
  tabs: CodeTab[]
}

export function CodeTabs({ idPrefix, tabs }: CodeTabsProps) {
  const [active, setActive] = useState(0)
  const [copyStatus, setCopyStatus] = useState<{ id: string; text: string } | null>(null)
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([])
  const resetTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  function onTabKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const last = tabs.length - 1
    const targets: Record<string, number> = {
      ArrowRight: active === last ? 0 : active + 1,
      ArrowLeft: active === 0 ? last : active - 1,
      Home: 0,
      End: last,
    }
    const next = targets[event.key]
    if (next === undefined) return
    event.preventDefault()
    setActive(next)
    tabRefs.current[next]?.focus()
  }

  async function copy(tab: CodeTab) {
    let text = 'Copied'
    try {
      await navigator.clipboard.writeText(tab.code)
    } catch {
      text = 'Copy failed'
    }
    setCopyStatus({ id: tab.id, text })
    clearTimeout(resetTimer.current)
    resetTimer.current = setTimeout(() => setCopyStatus(null), 2000)
  }

  return (
    <div className="my-6 min-w-0 overflow-hidden rounded-lg border border-border bg-sidebar">
      <div
        role="tablist"
        aria-label="Snippet formats"
        onKeyDown={onTabKeyDown}
        className="flex flex-wrap gap-1 border-b border-border p-2"
      >
        {tabs.map((tab, index) => {
          const selected = index === active
          return (
            <button
              key={tab.id}
              ref={(element) => {
                tabRefs.current[index] = element
              }}
              type="button"
              role="tab"
              id={`${idPrefix}-tab-${tab.id}`}
              aria-selected={selected}
              aria-controls={`${idPrefix}-panel-${tab.id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setActive(index)}
              className={cn(
                'flex flex-col items-start rounded-md px-3 py-2 text-left text-sm transition-colors focus-visible:outline-2 focus-visible:outline-primary',
                selected ? 'bg-accent text-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              <span className="font-semibold">{tab.label}</span>
              {tab.platforms.length > 0 && (
                <span className="text-xs text-muted-foreground">{tab.platforms.join(' · ')}</span>
              )}
            </button>
          )
        })}
      </div>
      {tabs.map((tab, index) => (
        <div
          key={tab.id}
          role="tabpanel"
          id={`${idPrefix}-panel-${tab.id}`}
          aria-labelledby={`${idPrefix}-tab-${tab.id}`}
          hidden={index !== active}
        >
          <div className="flex justify-end border-b border-border px-2 py-1">
            <button
              type="button"
              data-copy-button={tab.id}
              aria-label={`Copy ${tab.label}`}
              onClick={() => copy(tab)}
              className="rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary"
            >
              <span aria-live="polite">{copyStatus?.id === tab.id ? copyStatus.text : 'Copy'}</span>
            </button>
          </div>
          <div
            className="text-sm leading-6 [&_pre]:m-0 [&_pre]:p-4 [&_pre]:whitespace-pre-wrap [&_pre]:[overflow-wrap:anywhere]"
            dangerouslySetInnerHTML={{ __html: tab.html }}
          />
        </div>
      ))}
    </div>
  )
}
