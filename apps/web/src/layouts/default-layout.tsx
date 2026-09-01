import { memo } from 'react'
import { Outlet } from 'react-router-dom'
import { Toaster } from '@/components/ui/sonner'

import Providers from '@/providers/Providers'
import { Header } from '@/components/header/header'

const DefaultLayout = memo(() => {
  return (
    <Providers>
      <div className="relative">
        <Header showNodeMenu />
        <Outlet />
        <Toaster />
      </div>
    </Providers>
  )
})
DefaultLayout.displayName = 'DefaultLayout'

export default DefaultLayout
