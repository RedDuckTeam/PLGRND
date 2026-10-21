import Link from 'next/link'
import { ArrowRight, ArrowUpRight } from 'lucide-react'

const BUTTON =
  'group inline-flex h-[60px] items-center justify-center gap-3 rounded-sm px-6 text-xl font-medium transition-colors duration-300 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white max-sm:w-full'

export function ClosingCta() {
  return (
    <section
      aria-labelledby="closing-cta-title"
      className="bg-primary-2 px-4 py-16 text-white sm:px-6 sm:py-20 xl:px-12"
    >
      <div className="flex flex-col justify-between gap-10 lg:flex-row lg:items-end">
        <h2 id="closing-cta-title" className="max-w-3xl text-[28px] font-bold leading-tight sm:text-4xl xl:text-5xl">
          Have a flow? Put it next to the docs that explain it.
        </h2>
        <div className="flex shrink-0 flex-col gap-3 sm:flex-row sm:gap-4">
          <Link href="/integrate" className={`${BUTTON} bg-background text-foreground hover:text-primary`}>
            Read the guide
            <ArrowRight aria-hidden className="size-5 transition-transform duration-300 group-hover:translate-x-1" />
          </Link>
          <a
            href="https://github.com/RedDuckTeam/PLGRND"
            target="_blank"
            rel="noopener noreferrer"
            className={`${BUTTON} border border-white/70 hover:border-white hover:bg-white/10`}
          >
            View on GitHub
            <ArrowUpRight
              aria-hidden
              className="size-5 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
            />
          </a>
        </div>
      </div>
    </section>
  )
}
