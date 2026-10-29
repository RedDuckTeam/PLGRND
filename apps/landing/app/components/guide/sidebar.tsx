'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { METHODS } from '@/app/lib/methods'
import { cn } from '@/app/lib/utils'

const LINKS = [
  { href: '/integrate', label: 'Overview' },
  ...METHODS.map((method) => ({ href: method.href, label: method.title })),
]

export function Sidebar() {
  const pathname = usePathname().replace(/\/$/, '')

  return (
    <nav aria-label="Integration guide">
      <p className="mb-3 text-xs font-semibold tracking-wider text-muted-foreground uppercase">Integrate</p>
      <ul className="flex flex-wrap gap-2 lg:flex-col lg:gap-1">
        {LINKS.map((link) => {
          const active = pathname === link.href
          return (
            <li key={link.href}>
              <Link
                href={link.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'block rounded-md border px-3 py-1.5 text-sm transition-colors',
                  active
                    ? 'border-primary bg-muted text-primary'
                    : 'border-border text-muted-foreground hover:bg-muted hover:text-foreground lg:border-transparent'
                )}
              >
                {link.label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
