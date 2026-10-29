import { DefaultLayout } from '@/app/layouts/default-layout'
import { ClosingCta } from './components/sections/closing-cta'
import { HowItWorks } from './components/sections/how-it-works'
import { LiveDemo } from './components/sections/live-demo'
import { Main } from './components/sections/main'
import { Methods } from './components/sections/methods'
import { NodeCategories } from './components/sections/node-categories'
import { ValueProps } from './components/sections/value-props'
import { WhatIsPlgrnd } from './components/sections/what-is-plgrnd'
import { homeMetadata } from './seo.config'

export const metadata = homeMetadata

export default function Home() {
  return (
    <DefaultLayout intro>
      <Main />
      <LiveDemo />
      <WhatIsPlgrnd />
      <HowItWorks />
      <NodeCategories />
      <ValueProps />
      <Methods />
      <ClosingCta />
    </DefaultLayout>
  )
}
