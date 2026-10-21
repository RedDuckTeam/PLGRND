import type { Metadata, Viewport } from 'next'
import { Kode_Mono } from 'next/font/google'
import './globals.css'
import { metadata as metadataConfig } from './seo.config'

const kodeMono = Kode_Mono({
  subsets: ['latin'],
  weight: ['400', '700'],
})

export const metadata: Metadata = metadataConfig

export const viewport: Viewport = {
  themeColor: '#171717',
  colorScheme: 'dark',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={`${kodeMono.className} antialiased`}>{children}</body>
    </html>
  )
}
