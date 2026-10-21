import type { ReactNode } from 'react'
import { Footer } from '@/app/components/footer/footer'
import { Sidebar } from '@/app/components/guide/sidebar'
import { Header } from '@/app/components/header/header'

export default function IntegrateLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <div className="relative flex min-h-screen w-full flex-col">
      <Header />
      <div className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:grid lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-12 lg:py-12 xl:px-12">
        <aside className="mb-8 lg:mb-0">
          <div className="lg:sticky lg:top-8">
            <Sidebar />
          </div>
        </aside>
        <main className="min-w-0 break-words">{children}</main>
      </div>
      <Footer />
    </div>
  )
}
