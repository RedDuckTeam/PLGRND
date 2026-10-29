import type { MethodSlug } from './guide/index.ts'

export type Method = {
  slug: MethodSlug
  title: string
  summary: string
  whenToChoose: string
  href: `/integrate/${MethodSlug}`
}

// TODO(user): confirm wording and order
export const METHODS: Method[] = [
  {
    slug: 'iframe',
    title: 'Hosted iframe',
    summary: 'Paste an <iframe> that loads plgrnd.io/embed with the flow in the URL hash.',
    whenToChoose: 'The default: any docs platform that allows external iframes. No JavaScript on your side.',
    href: '/integrate/iframe',
  },
  {
    slug: 'self-hosted',
    title: 'Self-hosted widget',
    summary: 'Ship the <plgrnd-flow> element from npm or your own server; it renders the flow in place.',
    whenToChoose:
      'External iframes are forbidden or your CSP is strict: you need SRI and zero requests to plgrnd.io (the Metaplex case).',
    href: '/integrate/self-hosted',
  },
  {
    slug: 'react-wrapper',
    title: 'React wrapper',
    summary: 'One small component that renders the hosted iframe for allow-listed embed URLs.',
    whenToChoose: 'A React or MDX site that wants one vetted component with a central allow-list and theme.',
    href: '/integrate/react-wrapper',
  },
  {
    slug: 'open-in-plgrnd',
    title: 'Open in PLGRND',
    summary: 'A plain link that opens the flow in the PLGRND editor.',
    whenToChoose: 'No embeds are allowed at all, or you want a fallback link under any embed.',
    href: '/integrate/open-in-plgrnd',
  },
  {
    slug: 'native-port',
    title: 'Native port',
    summary: "Re-implement the flow's logic in your own code, for example with @solana/kit.",
    whenToChoose:
      'Neither iframes nor third-party scripts are allowed, or the example must match your design 1:1. You maintain the code.',
    href: '/integrate/native-port',
  },
]
