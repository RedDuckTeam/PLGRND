'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { ArrowUpRight, Github } from 'lucide-react'
import { AnimationOverlay } from '../animation-overlay'

const WORDMARK = 'PLGRND'

const NAV_LINK =
  'group inline-flex items-center gap-1 rounded-sm py-2 text-muted-foreground transition-colors duration-300 hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary data-[active=true]:text-foreground'

interface HeaderProps {
  intro?: boolean
}

export function Header({ intro = false }: HeaderProps) {
  const [showIntro, setShowIntro] = useState(false)
  const logoRef = useRef<HTMLDivElement | null>(null)
  const pathname = usePathname()
  const guideActive = pathname === '/integrate' || pathname.startsWith('/integrate/')

  useEffect(() => {
    if (!intro || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    setShowIntro(true)
  }, [intro])

  return (
    <>
      {showIntro && <AnimationOverlay headerRef={logoRef} onComplete={() => setShowIntro(false)} />}

      <header className="relative z-40 flex items-center justify-between gap-4 border-b border-border bg-background px-4 py-4 backdrop-blur-md sm:px-6 xl:px-12">
        <Link
          href="/"
          aria-label="PLGRND home"
          className="flex shrink-0 items-center gap-4 rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
        >
          <div ref={logoRef} className="h-12 w-12 shrink-0 sm:h-16 sm:w-16">
            <Image src="/logo-light.png" alt="" width={64} height={64} priority className="h-full w-full" />
          </div>
          <div aria-hidden className="flex gap-1 overflow-hidden whitespace-nowrap">
            {WORDMARK.split('').map((char, i) => (
              <span key={i} className="inline-block text-xl font-bold text-foreground sm:text-3xl">
                {char}
              </span>
            ))}
          </div>
        </Link>

        <nav aria-label="Main" className="flex items-center gap-4 text-sm sm:gap-8 sm:text-base">
          <Link href="/integrate" data-active={guideActive ? 'true' : 'false'} className={NAV_LINK}>
            Guide
          </Link>
          <a href="https://plgrnd.io" target="_blank" rel="noopener noreferrer" className={NAV_LINK}>
            Editor
            <ArrowUpRight
              aria-hidden
              className="hidden size-4 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 sm:block"
            />
          </a>
          <a
            href="https://github.com/RedDuckTeam/PLGRND"
            target="_blank"
            rel="noopener noreferrer"
            className={NAV_LINK}
          >
            <Github aria-hidden className="size-5 sm:hidden" />
            <span className="max-sm:sr-only">GitHub</span>
            <ArrowUpRight
              aria-hidden
              className="hidden size-4 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 sm:block"
            />
          </a>
        </nav>
      </header>
    </>
  )
}
