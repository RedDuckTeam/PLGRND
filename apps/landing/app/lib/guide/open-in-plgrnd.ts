import type { MethodGuide } from './types.ts'
import { DOCS_REF, PLGRND_ORIGIN } from '../plgrnd.ts'
import { ANCHOR_PDA_SEEDS_FLOW } from '../flows.ts'

export const OPEN_IN_URL = `${PLGRND_ORIGIN}/?ref=${DOCS_REF}#flow=${ANCHOR_PDA_SEEDS_FLOW}`

export const openInPlgrndGuide: MethodGuide = {
  tabs: [
    {
      id: 'markdown',
      label: 'Markdown',
      platforms: ['MkDocs', 'Docusaurus', 'Nextra', 'Fumadocs', 'Starlight', 'GitBook', 'plain Markdown'],
      lang: 'markdown',
      code: `[Open in PLGRND](${OPEN_IN_URL})`,
    },
    {
      id: 'html-button',
      label: 'HTML / MDX button',
      platforms: ['HTML', 'MDX', 'Mintlify'],
      lang: 'html',
      code: `<a href="${OPEN_IN_URL}" target="_blank" rel="noopener noreferrer">Open in PLGRND</a>`,
    },
  ],
  gotchas: [
    {
      id: 'ref-before-hash',
      platform: 'All',
      issue:
        'The query string has to come before the hash. A `?ref=` placed after `#flow=...` becomes part of the flow payload and corrupts it.',
      fix: 'Keep the shape `https://plgrnd.io/?ref=<tag>#flow=<payload>`: path, then `?ref=`, then `#flow=`.',
      evidence: 'apps/web/src/embed/embed-url.ts:33-34',
    },
    {
      id: 'ref-log-only',
      platform: 'All',
      issue: 'The editor writes `?ref=` but never reads it, so it changes nothing in the app.',
      fix: 'Treat `ref` as a tag that shows up only in plgrnd.io request logs. Do not expect it to change behavior or attribute anything in the UI.',
      evidence: "F12: no .get('ref') in apps/web/src; plgrnd-links.ts:5-6 and embed-url.ts:31-35 only write it",
    },
    {
      id: 'fragment-client-only',
      platform: 'All',
      issue:
        'The `#flow=` fragment never reaches a server, so link checkers, crawlers and link-preview bots see only `https://plgrnd.io/`.',
      fix: 'Do not rely on server-side checks or previews of the flow. Open the link in a browser to confirm it loads the flow.',
      evidence: 'README.md:88 (flow stays in the #flow= hash)',
    },
    {
      id: 'fallback-link',
      platform: 'MkDocs, plain Markdown',
      issue: 'Hosts that cannot run an iframe or the self-hosted widget show nothing where the embed should be.',
      fix: 'Put an Open in PLGRND link directly under the iframe so readers on these hosts can still open the flow.',
      evidence: 'PR/06.diff:24, PR/10.diff:10',
    },
  ],
  requiredGotchaIds: ['ref-before-hash', 'ref-log-only', 'fragment-client-only', 'fallback-link'],
}
