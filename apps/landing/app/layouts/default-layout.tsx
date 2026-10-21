import type { ReactNode } from 'react'
import { Header } from '../components/header/header'
import { LoadOverlay } from '../components/ui/load-overlay'
import { Footer } from '../components/footer/footer'

interface DefaultLayoutProps {
  children: ReactNode
  intro?: boolean
}

export function DefaultLayout({ children, intro = false }: DefaultLayoutProps) {
  return (
    <div className="relative min-h-screen w-full">
      <Header intro={intro} />
      <main>{children}</main>
      {intro && <LoadOverlay />}
      <Footer />
    </div>
  )
}
