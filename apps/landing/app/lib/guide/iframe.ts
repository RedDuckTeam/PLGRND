import type { MethodGuide } from './types.ts'
import { EMBED_URL, IFRAME_ALLOW, IFRAME_SANDBOX } from '../plgrnd.ts'
import { ANCHOR_PDA_SEEDS_FLOW } from '../flows.ts'

export const IFRAME_PREVIEW_SRC = `${EMBED_URL}?accent=14f195#flow=${ANCHOR_PDA_SEEDS_FLOW}`

const SNIPPET_SRC = `${EMBED_URL}?theme=auto#flow=${ANCHOR_PDA_SEEDS_FLOW}`

const HTML_SNIPPET = `<div style="position:relative;width:100%;aspect-ratio:16/9;overflow:hidden;border-radius:12px">
  <iframe
    src="${SNIPPET_SRC}"
    title="PLGRND interactive flow"
    loading="lazy"
    sandbox="${IFRAME_SANDBOX}"
    allow="${IFRAME_ALLOW}"
    style="position:absolute;inset:0;width:100%;height:100%;border:0"></iframe>
</div>`

const MDX_SNIPPET = `<div style={{ position: 'relative', width: '100%', aspectRatio: '16/9', overflow: 'hidden', borderRadius: '12px' }}>
  <iframe
    src="${SNIPPET_SRC}"
    title="PLGRND interactive flow"
    loading="lazy"
    sandbox="${IFRAME_SANDBOX}"
    allow="${IFRAME_ALLOW}"
    style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0 }}
  />
</div>`

const MINTLIFY_SNIPPET = `<Frame>
${MDX_SNIPPET.replace(/^/gm, '  ')}
</Frame>`

export const iframeGuide: MethodGuide = {
  tabs: [
    {
      id: 'mintlify',
      label: 'Mintlify',
      platforms: ['Mintlify'],
      lang: 'mdx',
      code: MINTLIFY_SNIPPET,
    },
    {
      id: 'mdx',
      label: 'MDX',
      platforms: ['Docusaurus', 'Nextra', 'Fumadocs', 'Starlight'],
      lang: 'mdx',
      code: MDX_SNIPPET,
    },
    {
      id: 'html',
      label: 'HTML / Markdown',
      platforms: ['MkDocs', 'plain Markdown', 'SvelteKit (mdsvex)'],
      lang: 'html',
      code: HTML_SNIPPET,
    },
  ],
  gotchas: [
    {
      id: 'mintlify-frame',
      platform: 'Mintlify',
      issue:
        'Mintlify renders every page as MDX, so React rejects the `style="…"` strings of the HTML snippet. An iframe placed outside `<Frame>` also misses the bordered card that Mintlify gives screenshots.',
      fix: 'Paste the Mintlify tab: the iframe sits inside `<Frame>` and every `style` is a JSX object.',
      evidence: 'PR/07.diff:9-20',
    },
    {
      id: 'docusaurus-jsx-props',
      platform: 'Docusaurus, Nextra, Fumadocs, Starlight',
      issue:
        'MDX parses HTML as JSX. A `style="…"` string breaks the page with `The style prop expects a mapping from style properties to values, not a string`, and `class` has to be `className`.',
      fix: "Paste the MDX tab: `style={{ … }}` objects with camelCase keys, and lengths written as strings with units (`borderRadius: '12px'`).",
      evidence: 'PR/12.diff:9-20',
    },
    {
      id: 'mkdocs-no-jsx-fallback',
      platform: 'MkDocs, plain Markdown, SvelteKit (mdsvex)',
      issue:
        'Markdown pages have no JSX. They pass the iframe through as raw HTML, so `style={{ … }}` from an MDX snippet ends up as broken markup, and renderers that sanitize HTML drop the iframe completely.',
      fix: 'Paste the HTML / Markdown tab as it is, with a blank line before and after it. Add a plain link that opens the same flow in the editor right under it (see Open in PLGRND), so readers still get there when the iframe is stripped.',
      evidence: 'PR/04.diff:9, PR/06.diff:24, PR/10.diff:10',
    },
    {
      id: 'fumadocs-md-to-mdx',
      platform: 'Fumadocs',
      issue: 'Fumadocs compiles `.md` pages as plain Markdown, not MDX, so the JSX of the MDX tab is not parsed there.',
      fix: 'Rename the page from `.md` to `.mdx` before pasting the MDX tab. The page slug stays the same.',
      evidence: 'PR/18.diff:1-7',
    },
    {
      id: 'sandbox-review',
      platform: 'All',
      issue:
        'Security reviews often ask to trim `sandbox`. The widget needs `allow-scripts allow-same-origin` to run at all. Without `allow-popups allow-popups-to-escape-sandbox`, "Open in PLGRND" and the badge link fall back to a copyable link in a toast, and `allow="clipboard-write"` is what enables click-to-copy inside nodes.',
      fix: 'Keep the `sandbox` and `allow` values from the snippets. If popups must go, remove only the two `allow-popups` tokens.',
      evidence: 'README.md:150',
    },
    {
      id: 'theme-auto-os',
      platform: 'Sites with a theme toggle',
      issue:
        "`theme=auto` follows the visitor's OS setting (`prefers-color-scheme`), not your site's own theme toggle, so the widget can stay dark on a light page.",
      fix: "Pin `theme=dark` or `theme=light` to the theme you render, or post `{ type: 'plgrnd:theme', theme }` to the iframe's `contentWindow` from your toggle once it has sent `plgrnd:ready`.",
      evidence: 'README.md:121, README.md:123',
    },
    {
      id: 'ref-log-only',
      platform: 'All',
      issue:
        'Adding `?ref=<your-site>` to the `/embed` URL changes nothing in the app: `/embed` reads only its 13 display options and ignores unknown parameters, so the tag appears only in plgrnd.io request logs.',
      fix: 'Leave `ref` out of iframe URLs, as the snippets above do. Do not expect it to attribute anything in the app.',
      evidence: 'F12: embed-config.ts:93-106 (13 keys), embed-host-context.ts:10; PR/01.diff:12, PR/07.diff:11',
    },
    {
      id: 'mode-editor-iframe-only',
      platform: 'Hosted iframe vs self-hosted',
      issue:
        '`mode=editor` (move, connect, add and delete nodes, plus the node menu) exists only in the hosted iframe. The self-hosted `<plgrnd-flow>` element turns `mode="editor"` into `interactive` and reports it as ignored.',
      fix: 'Choose the iframe when readers must change the graph itself. `readonly` and `interactive` behave the same in both methods.',
      evidence: 'F24: embed-config.ts:1, 67-70; packages/embed/src/runtime/attributes.ts:56-60',
    },
  ],
  requiredGotchaIds: [
    'mintlify-frame',
    'docusaurus-jsx-props',
    'mkdocs-no-jsx-fallback',
    'fumadocs-md-to-mdx',
    'sandbox-review',
    'theme-auto-os',
    'ref-log-only',
    'mode-editor-iframe-only',
  ],
}
