import { EMBED_URL } from '../plgrnd.ts'
import { BLUESHIFT_PDA_FLOW } from '../flows.ts'
import type { MethodGuide } from './types.ts'

export const WRAPPER_PREVIEW_SRC = `${EMBED_URL}?bg=0b0e14&surface=11141a&border=1a1e26&accent=00e6e6#flow=${BLUESHIFT_PDA_FLOW}`

const USAGE = `// mdx-components.tsx: register the wrapper once
import type { MDXComponents } from 'mdx/types'
import { PlgrndEmbed } from '@/components/plgrnd-embed'

export function useMDXComponents(components: MDXComponents): MDXComponents {
  return { PlgrndEmbed, ...components }
}

// page.mdx
<PlgrndEmbed
  src="${WRAPPER_PREVIEW_SRC}"
  title="PDA seeds in PLGRND"
/>
`

export const reactWrapperGuide: MethodGuide = {
  tabs: [
    // TODO(user): confirm isAllowedEmbedSrc in previews/plgrnd-embed.tsx
    {
      id: 'component',
      label: 'Component (TSX)',
      platforms: [],
      lang: 'tsx',
      file: 'app/components/previews/plgrnd-embed.tsx',
    },
    {
      id: 'usage',
      label: 'Usage in MDX',
      platforms: [],
      lang: 'tsx',
      code: USAGE,
    },
  ],
  gotchas: [
    {
      id: 'allow-list',
      platform: 'All React/MDX sites',
      issue:
        'The wrapper renders nothing for a src that is not a hosted PLGRND embed URL, so a typo or a pasted editor link leaves a blank gap.',
      fix: 'Pass a URL that starts with https://plgrnd.io/embed? or https://plgrnd.io/embed#. Everything else is dropped on purpose, so authors cannot point the iframe elsewhere.',
      evidence: 'PR/08.diff:15-17',
    },
    {
      id: 'theming-query',
      platform: 'All React/MDX sites',
      issue: 'Colour parameters written with a leading # break the query string, because # starts the URL fragment.',
      fix: 'Write hex colours without #: bg=0b0e14, not bg=%230b0e14. The default theme=dark is omitted from the URL.',
      evidence: 'apps/web/src/embed/embed-url.ts:12-15',
    },
    {
      id: 'ref-log-tag',
      platform: 'All React/MDX sites',
      issue: 'Adding ?ref= to the embed URL does not attribute anything inside the app, which never reads it.',
      fix: 'Treat ref as visible only in plgrnd.io request logs. For the self-hosted widget, use link-ref to attribute its own links.',
      evidence: 'README.md:106 (unknown params ignored; app never reads ref, F12); links.ts:5-6; runtime.tsx:135',
    },
  ],
  requiredGotchaIds: ['allow-list', 'theming-query', 'ref-log-tag'],
}
