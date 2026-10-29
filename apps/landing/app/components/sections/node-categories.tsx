import { EXAMPLE_FLOWS, NODE_CATEGORIES } from '../../lib/product'
import { SectionHeading } from '../home/section-heading'

const HANDLE = 'absolute top-1/2 size-2.5 -translate-y-1/2 rounded-full border border-foreground/40 bg-background'

export function NodeCategories() {
  return (
    <section aria-labelledby="node-categories-title" className="px-4 py-16 sm:px-6 sm:py-24 xl:px-12">
      <SectionHeading index="04" label="Node categories" className="mb-10 text-muted-foreground sm:mb-12" />
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between lg:gap-12">
        <h2 id="node-categories-title" className="max-w-2xl text-[28px] font-bold leading-tight sm:text-4xl">
          From a keypair to a transaction.
        </h2>
        <p className="max-w-md text-balance leading-7 text-muted-foreground">
          Each category maps to a piece of the Solana model.
        </p>
      </div>
      <ul className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:mt-16 lg:grid-cols-4">
        {NODE_CATEGORIES.map((category, index) => (
          <li
            key={category.id}
            className="relative flex flex-col rounded-lg border border-foreground/10 bg-muted transition-colors duration-300 hover:border-foreground/30"
          >
            <span aria-hidden className={`${HANDLE} -left-[5px]`} />
            <span aria-hidden className={`${HANDLE} -right-[5px]`} />
            <div
              className="flex items-center justify-between gap-3 rounded-t-[7px] px-4 py-2.5"
              style={{ backgroundColor: category.color }}
            >
              <h3 className="text-xs font-bold uppercase tracking-widest sm:text-sm">{category.name}</h3>
              <span aria-hidden className="text-xs opacity-60">
                {String(index + 1).padStart(2, '0')}
              </span>
            </div>
            <ul aria-label={`${category.name} nodes`} className="flex flex-wrap gap-2 p-4">
              {category.nodes.map((node) => (
                <li
                  key={node}
                  className="rounded-sm border border-foreground/15 bg-background/60 px-2 py-1 text-xs sm:text-sm"
                >
                  {node}
                </li>
              ))}
            </ul>
          </li>
        ))}
        <li className="flex flex-col rounded-lg border border-primary/40 bg-primary/5">
          <div className="flex items-center gap-3 border-b border-primary/30 px-4 py-2.5 text-primary">
            <span aria-hidden className="size-2 shrink-0 bg-current" />
            <h3 className="text-xs font-bold uppercase tracking-widest sm:text-sm">Example flows</h3>
          </div>
          <p className="p-4 text-sm leading-6 text-muted-foreground">{EXAMPLE_FLOWS}</p>
        </li>
      </ul>
    </section>
  )
}
