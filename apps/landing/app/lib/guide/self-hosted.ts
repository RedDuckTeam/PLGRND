import { ANCHOR_PDA_SEEDS_FLOW } from '../flows.ts'
import { MINTLIFY_IMPORT, SDK_SRI, SDK_VERSION } from '../plgrnd.ts'
import type { MethodGuide } from './types.ts'

const IIFE_FILE = `plgrnd-flow-${SDK_VERSION}.js` as const
const ESM_FOLDER = `plgrnd-flow-${SDK_VERSION}`

const HTML_ELEMENT = `<plgrnd-flow flow="${ANCHOR_PDA_SEEDS_FLOW}" theme="auto" style="display:block;aspect-ratio:16/9;min-height:320px"></plgrnd-flow>`

const MDX_ELEMENT = `<plgrnd-flow
  flow="${ANCHOR_PDA_SEEDS_FLOW}"
  theme="auto"
  style={{ display: 'block', aspectRatio: '16/9', minHeight: 320 }}
/>`

const MINTLIFY_ELEMENT = `<PlgrndFlow
  flow="${ANCHOR_PDA_SEEDS_FLOW}"
  theme="auto"
  style={{ display: 'block', aspectRatio: '16/9', minHeight: 320 }}
/>`

const MARKDOC_ELEMENT = `{% plgrnd-flow
  flow="${ANCHOR_PDA_SEEDS_FLOW}"
  theme="auto"
  aspect="16/9"
/%}`

export const selfHostedGuide: MethodGuide = {
  tabs: [
    {
      id: 'html-script',
      label: 'HTML <script> + SRI',
      platforms: ['Plain HTML', 'Any static site'],
      lang: 'html',
      code: `<!-- ${IIFE_FILE} from https://plgrnd.io/sdk/${SDK_VERSION}/, served by your site -->
<script src="/${IIFE_FILE}" integrity="${SDK_SRI[IIFE_FILE]}"></script>

${HTML_ELEMENT}`,
    },
    {
      id: 'npm-esm',
      label: 'npm / ESM',
      platforms: ['Next.js', 'Fumadocs', 'Docusaurus'],
      lang: 'tsx',
      code: `// npm install @plgrnd/embed

// Next.js / Fumadocs: client component in the root layout
'use client'
import '@plgrnd/embed'

export default function PlgrndFlowRegister() {
  return null
}

// Docusaurus: src/plgrnd.js in clientModules
import '@plgrnd/embed'

// page.mdx
${MDX_ELEMENT}`,
    },
    {
      id: 'mintlify',
      label: 'Mintlify',
      platforms: ['Mintlify'],
      lang: 'jsx',
      code: `// ${IIFE_FILE} at the docs repo root

// snippets/plgrnd-flow.jsx
export const PlgrndFlow = ({ style, ...props }) => (
  <plgrnd-flow style={{ display: 'block', aspectRatio: '16/9', minHeight: 320, ...style }} {...props} />
)

// page.mdx
${MINTLIFY_IMPORT}

${MINTLIFY_ELEMENT}`,
    },
    {
      id: 'markdoc',
      label: 'Markdoc (tags.js + component)',
      platforms: ['Markdoc'],
      lang: 'jsx',
      code: `// markdoc/tags.js
'plgrnd-flow': {
  selfClosing: true,
  render: PlgrndFlow,
  attributes: Object.fromEntries(
    ['flow', 'theme', 'bg', 'surface', 'fg', 'border', 'accent', 'radius', 'font', 'fontMono',
     'controls', 'minimap', 'toolbar', 'mode', 'rpcMainnet', 'rpcDevnet', 'linkRef',
     'aspect', 'height'].map((name) => [name, { type: String }])
  ),
},

// components/PlgrndFlow.jsx
import '@plgrnd/embed'

export function PlgrndFlow({ aspect = '16/9', height, fontMono, rpcMainnet, rpcDevnet, linkRef, ...attributes }) {
  const style = height
    ? { display: 'block', height: \`\${height}px\`, minHeight: 0 }
    : { display: 'block', aspectRatio: aspect, minHeight: 320 }
  return (
    <plgrnd-flow
      {...attributes}
      font-mono={fontMono}
      rpc-mainnet={rpcMainnet}
      rpc-devnet={rpcDevnet}
      link-ref={linkRef}
      style={style}
    />
  )
}

// page.md
${MARKDOC_ELEMENT}`,
    },
    {
      id: 'mkdocs',
      label: 'MkDocs Material',
      platforms: ['MkDocs Material'],
      lang: 'yaml',
      code: `# mkdocs.yml (${ESM_FOLDER}/ copied to docs/javascripts/)
extra_javascript:
  - path: javascripts/${ESM_FOLDER}/plgrnd-flow.js
    type: module

# page.md
${HTML_ELEMENT}`,
    },
  ],
  gotchas: [
    {
      id: 'metaplex-no-external-iframes',
      platform: 'Metaplex docs',
      issue: 'Metaplex docs forbid external iframes, so the hosted `/embed` iframe is not an option there.',
      fix: `Self-host the classic script \`${IIFE_FILE}\` with its \`integrity\` hash from \`SRI.txt\`, as the Metaplex integration does, and render \`<plgrnd-flow>\` directly in the page.`,
      evidence:
        'PR/03.diff:3021-3041 (src/components/PlgrndFlow.jsx: next/script with integrity sha384-Y2Bk…qv3B, public/assets/plgrnd/plgrnd-flow-1.0.1.js)',
    },
    {
      id: 'no-hotlink',
      platform: 'All sites',
      issue:
        'Hot-linking `plgrnd.io/sdk` turns every page view into a request to plgrnd.io, which defeats self-hosting.',
      fix: 'Download the files once and serve them from your own site or bundle. The version is in the file name, so a page keeps exactly the build it was tested with.',
      evidence: 'README.md:172',
    },
    {
      id: 'mintlify-single-js',
      platform: 'Mintlify',
      issue: 'Mintlify injects every `.js` file in the docs repo into every page, as a classic script.',
      fix: `Keep exactly one version file, \`${IIFE_FILE}\`, at the repo root, and never add the ESM folder. When you update, delete the old version file.`,
      evidence: 'README.md:244, 332',
    },
    {
      id: 'mkdocs-single-line',
      platform: 'MkDocs',
      issue:
        'Python-Markdown passes inline HTML through only when the tag name and its attributes start on the same line. A line break after `<plgrnd-flow` gets the tag escaped.',
      fix: 'Paste the HTML format exactly as generated, on one line. Do not reformat it into one attribute per line.',
      evidence: 'apps/web/src/embed/self-hosted-snippet.ts:72-73',
    },
    {
      id: 'jsx-string-attrs',
      platform: 'MDX, React, Mintlify',
      issue: 'Until the element is defined, React 19 drops a JSX `{false}` and writes `{true}` as an empty attribute.',
      fix: 'Pass booleans and numbers as strings, such as `controls="0"`.',
      evidence: 'README.md:342',
    },
    {
      id: 'sri-iife-only',
      platform: 'HTML',
      issue:
        'An `integrity` attribute checks only the file its `<script>` tag loads. The ESM entry loads its runtime with a plain `import()`, which no integrity value covers.',
      fix: `For SRI, load the classic script \`${IIFE_FILE}\`: it holds everything in one file. Check ESM downloads against \`SHA256SUMS.txt\` instead.`,
      evidence:
        'apps/web/public/sdk/1.0.1/SRI.txt:1-3; plgrnd-flow-1.0.1/plgrnd-flow.js contains import("./plgrnd-flow-runtime.js") (F7); README.md:168-170, 349',
    },
    {
      id: 'link-ref-not-ref',
      platform: 'JSX / MDX',
      issue:
        'In JSX, `ref` is React\'s ref: it never reaches the element, and the types accept `ref="…"`, so typecheck does not catch it.',
      fix: "Use `link-ref` (`linkRef` in Markdoc). It only adds `?ref=` to the widget's own links to plgrnd.io and changes nothing else.",
      evidence:
        'packages/embed/src/element/links.ts:5-6; packages/embed/src/runtime/runtime.tsx:135; packages/embed/src/runtime/attributes.ts:70; packages/embed/types/index.d.ts:34 (F22)',
    },
    {
      id: 'host-font',
      platform: 'All sites',
      issue:
        'Without `font`, the widget copies the computed font of its parent into its sans stack. The preview on this page shows Kode Mono for that reason.',
      fix: 'Set `font` (and `font-mono`) to a font-family string. The widget loads no web fonts, so pick a family your page already has.',
      evidence: 'packages/embed/src/runtime/shadow-root.ts:98 (F23); README.md:194, 341',
    },
    {
      id: 'mount-near-viewport',
      platform: 'All sites',
      issue:
        'A widget mounts when it comes within one viewport height of the visible area, so an off-screen widget fires `plgrnd:ready` only after the reader scrolls near it.',
      fix: 'In tests and scripts, scroll the widget into view before waiting for `plgrnd:ready`.',
      evidence: 'README.md:205; plgrnd-flow.js IntersectionObserver rootMargin "100% 0px" (F7)',
    },
  ],
  requiredGotchaIds: [
    'metaplex-no-external-iframes',
    'no-hotlink',
    'mintlify-single-js',
    'mkdocs-single-line',
    'jsx-string-attrs',
    'sri-iife-only',
    'link-ref-not-ref',
    'host-font',
    'mount-near-viewport',
  ],
}
