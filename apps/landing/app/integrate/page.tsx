import type { Metadata } from 'next'
import { MethodsOverview } from '@/app/components/sections/methods-overview'

export const metadata: Metadata = {
  title: 'Integration guide',
  description: 'Five ways to put a PLGRND flow into your docs, and when to choose each one.',
  alternates: { canonical: '/integrate' },
}

export default function IntegratePage() {
  return (
    <>
      <h1 className="mb-6 text-3xl font-bold tracking-tight sm:text-4xl">Integration guide</h1>
      <p className="my-4 leading-7">
        Every PLGRND flow encodes into its own URL. Pick the way to show it in your docs that your platform allows: each
        method has its own page with copy-ready snippets and the pitfalls found while integrating it.
      </p>
      <div className="mt-8">
        <MethodsOverview />
      </div>
    </>
  )
}
