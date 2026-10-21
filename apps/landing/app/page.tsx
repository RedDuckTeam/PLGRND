import { DefaultLayout } from '@/app/layouts/default-layout'
import { ClosingCta } from './components/sections/closing-cta'
import { LiveDemo } from './components/sections/live-demo'
import { Main } from './components/sections/main'
import { Methods } from './components/sections/methods'
import { ValueProps } from './components/sections/value-props'
import { homeMetadata } from './seo.config'

export const metadata = homeMetadata

export default function Home() {
  return (
    <DefaultLayout intro>
      <Main />
      <LiveDemo />
      <ValueProps />
      <Methods />
      <ClosingCta />
    </DefaultLayout>
  )
}
