import type { Metadata } from 'next'

const SITE_URL = 'https://docs.plgrnd.io'
const SITE_NAME = 'PLGRND Docs'
const SITE_DESCRIPTION =
  'Embed live, runnable Solana flows from PLGRND in your docs: a hosted iframe, the self-hosted plgrnd-flow web component, a React wrapper, an Open in PLGRND link or a native port.'

const IMAGE_PATH = '/logo.png'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  applicationName: SITE_NAME,
  title: {
    default: SITE_NAME,
    template: '%s | ' + SITE_NAME,
  },
  description: SITE_DESCRIPTION,
  keywords: [
    'PLGRND',
    'Solana',
    'Solana docs',
    'Solana playground',
    'embed Solana example',
    'plgrnd-flow',
    'web component',
    'PDA',
    'Anchor',
  ],
  authors: [{ name: 'RedDuck', url: 'https://redduck.io' }],
  creator: 'RedDuck',
  publisher: 'RedDuck',
  category: 'technology',
  referrer: 'origin-when-cross-origin',
  formatDetection: {
    telephone: false,
    address: false,
    email: false,
  },
  icons: {
    icon: IMAGE_PATH,
    apple: IMAGE_PATH,
  },
  openGraph: {
    type: 'website',
    siteName: SITE_NAME,
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    images: [{ url: IMAGE_PATH, width: 1800, height: 1800, alt: 'PLGRND' }],
    locale: 'en_US',
  },
  twitter: {
    card: 'summary',
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    images: [IMAGE_PATH],
  },
  robots: {
    index: true,
    follow: true,
  },
}

export const homeMetadata: Metadata = {
  alternates: { canonical: '/' },
  openGraph: { ...metadata.openGraph, url: '/' },
}
