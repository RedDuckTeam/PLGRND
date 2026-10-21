import { VALUE_CARDS } from '@/app/lib/value-cards'
import { SectionHeading } from '../home/section-heading'
import { ValueCard } from '../home/value-card'

export function ValueProps() {
  return (
    <section
      aria-labelledby="value-props-title"
      className="bg-primary px-4 py-16 text-background sm:px-6 sm:py-24 xl:px-12"
    >
      <SectionHeading index="02" label="Why embed" className="mb-10 sm:mb-12" />
      <div className="flex flex-col gap-12 lg:flex-row">
        <h2 id="value-props-title" className="text-[28px] font-bold leading-tight lg:w-1/4 xl:text-4xl">
          Examples your readers can run, next to the text that explains them.
        </h2>
        <div className="grid w-full grid-cols-1 gap-x-10 gap-y-12 sm:grid-cols-2 lg:w-3/4">
          {VALUE_CARDS.map((card, index) => (
            <ValueCard key={card.id} card={card} index={index} />
          ))}
        </div>
      </div>
    </section>
  )
}
