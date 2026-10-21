import { MethodsOverview } from './methods-overview'
import { SectionHeading } from '../home/section-heading'

export function Methods() {
  return (
    <section aria-labelledby="methods-title" className="px-4 py-16 sm:px-6 sm:py-24 xl:px-12">
      <SectionHeading index="03" label="Integration methods" className="mb-10 text-muted-foreground sm:mb-12" />
      <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,2.4fr)] lg:gap-12">
        <div className="flex flex-col gap-6">
          <h2 id="methods-title" className="text-[28px] font-bold leading-tight sm:text-4xl">
            Pick the one your platform allows.
          </h2>
          <p className="leading-7 text-muted-foreground">
            From a pasted iframe to a full port of the flow&apos;s logic. Each method has its own page with snippets, a
            live preview and the gotchas.
          </p>
        </div>
        <div className="min-w-0">
          <MethodsOverview />
        </div>
      </div>
    </section>
  )
}
