'use client'

import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { SelfHostedPreview } from '@/app/components/previews/self-hosted-preview'
import { SectionHeading } from '../home/section-heading'

export function LiveDemo() {
  return (
    <section aria-labelledby="live-demo-title" className="px-4 py-16 sm:px-6 sm:py-24 xl:px-12">
      <SectionHeading index="01" label="Live demo" className="mb-10 text-muted-foreground sm:mb-12" />
      <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,2.4fr)] lg:gap-12">
        <div className="flex flex-col gap-6">
          <h2 id="live-demo-title" className="text-[28px] font-bold leading-tight sm:text-4xl">
            This flow runs on this page.
          </h2>
          <p className="leading-7 text-muted-foreground">
            Values flow along the edges and evaluate live: edit an input and every node wired to it updates. No iframe
            and no screenshot: the widget is served from this site.
          </p>
          <pre className="overflow-x-auto rounded-md border border-border bg-muted px-4 py-3 text-xs leading-6 sm:text-sm">
            <code>
              <span className="text-primary-2">&lt;plgrnd-flow</span>
              {'\n  '}
              <span className="text-muted-foreground">flow=</span>
              <span className="text-primary">&quot;N4Ig…&quot;</span>
              {'\n  '}
              <span className="text-muted-foreground">theme=</span>
              <span className="text-primary">&quot;dark&quot;</span>
              {'\n  '}
              <span className="text-muted-foreground">link-ref=</span>
              <span className="text-primary">&quot;plgrnd-docs&quot;</span>
              {'\n'}
              <span className="text-primary-2">/&gt;</span>
            </code>
          </pre>
          <Link
            href="/integrate/self-hosted"
            className="group inline-flex w-max items-center gap-2 rounded-sm text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
          >
            Embed it the same way
            <ArrowRight aria-hidden className="size-4 transition-transform duration-300 group-hover:translate-x-1" />
          </Link>
        </div>

        <SelfHostedPreview caption="A PDA seeds example with three derivations. Pan, zoom and edit the inputs." />
      </div>
    </section>
  )
}
