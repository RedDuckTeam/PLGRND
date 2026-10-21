'use client'

import dynamic from 'next/dynamic'

export const PdaSeedsFlow = dynamic(() => import('./pda-seeds-widget').then((m) => m.PdaSeedsFlow), {
  ssr: false,
  loading: () => <div aria-hidden className="min-h-[1740px] sm:min-h-[1090px]" />,
})
