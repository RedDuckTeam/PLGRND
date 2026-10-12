import type { FlowSnapshot } from '@/stores/flow-snapshot'
import { encodeFlowToHash } from '@/utils/flow/share'
import type { EmbedConfig } from './embed-config'
import { serializeEmbedConfig, type EmbedSnippetSize } from './embed-url'

export type SelfHostedFormat = 'html' | 'mdx' | 'mintlify' | 'markdoc'

export const SELF_HOSTED_FORMATS: { id: SelfHostedFormat; label: string }[] = [
  { id: 'html', label: 'HTML' },
  { id: 'mdx', label: 'MDX' },
  { id: 'mintlify', label: 'Mintlify' },
  { id: 'markdoc', label: 'Markdoc' },
]

/** Mintlify pages import the recipe component once (README, "Self-hosted embedding"). */
export const MINTLIFY_IMPORT = "import { PlgrndFlow } from '/snippets/plgrnd-flow.jsx'"

// Below the widget's own minimum (320 px) a fixed height still wins, as it does for the iframe.
const MIN_HEIGHT = 320

/**
 * The element's attributes for this flow and builder config: the same payload and query values as the hosted
 * iframe (AC-B2), with `fontMono` spelled `font-mono` and editor mode dropped (the element has none). Every value
 * is a string: React 18 drops a JSX `{false}`, and React 19 does so in SSR before the element upgrades.
 */
export const selfHostedAttributes = (snapshot: FlowSnapshot, config: EmbedConfig): [string, string][] => {
  const attributes: [string, string][] = [['flow', encodeFlowToHash(snapshot)]]
  for (const [key, value] of new URLSearchParams(serializeEmbedConfig(config))) {
    if (key === 'mode' && value === 'editor') continue
    attributes.push([key === 'fontMono' ? 'font-mono' : key, value])
  }
  return attributes
}

const escapeHtml = (value: string): string =>
  value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

// JSX string attributes have no escapes; anything beyond plain text goes into an expression container.
const jsxAttribute = (name: string, value: string): string =>
  /^[^"{}<>&\\]*$/.test(value) ? `${name}="${value}"` : `${name}={${JSON.stringify(value)}}`

const camelCase = (name: string): string => name.replace(/-(\w)/g, (_, c: string) => c.toUpperCase())

const htmlStyle = (size: EmbedSnippetSize): string =>
  size.kind === 'aspect'
    ? `display:block;aspect-ratio:${size.ratio};min-height:${MIN_HEIGHT}px`
    : `display:block;height:${size.height}px;min-height:0`

const jsxStyle = (size: EmbedSnippetSize): string =>
  size.kind === 'aspect'
    ? `{{ display: 'block', aspectRatio: '${size.ratio}', minHeight: ${MIN_HEIGHT} }}`
    : `{{ display: 'block', height: ${size.height}, minHeight: 0 }}`

const jsxElement = (tag: string, attributes: [string, string][], size: EmbedSnippetSize): string =>
  [
    `<${tag}`,
    ...attributes.map(([name, value]) => `  ${jsxAttribute(name, value)}`),
    `  style=${jsxStyle(size)}`,
    '/>',
  ].join('\n')

/** The snippet for one documentation format. The page still loads the widget script once (see the README). */
export const buildSelfHostedSnippet = (
  snapshot: FlowSnapshot,
  config: EmbedConfig,
  size: EmbedSnippetSize,
  format: SelfHostedFormat
): string => {
  const attributes = selfHostedAttributes(snapshot, config)
  switch (format) {
    case 'html': {
      // One line: Markdown that is not CommonMark (Python-Markdown in MkDocs) passes inline HTML through only when the
      // tag name and its attributes start on the same line; a line break after `<plgrnd-flow` gets the tag escaped.
      const html = [
        ...attributes.map(([name, value]) => `${name}="${escapeHtml(value)}"`),
        `style="${htmlStyle(size)}"`,
      ]
      return `<plgrnd-flow ${html.join(' ')}></plgrnd-flow>`
    }
    case 'mdx':
      return jsxElement('plgrnd-flow', attributes, size)
    case 'mintlify':
      return jsxElement('PlgrndFlow', attributes, size)
    case 'markdoc': {
      // Markdoc attribute names are identifiers; the recipe's tag maps them back (fontMono -> font-mono).
      const sizing: [string, string] = size.kind === 'aspect' ? ['aspect', size.ratio] : ['height', String(size.height)]
      return [
        '{% plgrnd-flow',
        ...[...attributes, sizing].map(([name, value]) => `  ${camelCase(name)}=${JSON.stringify(value)}`),
        '/%}',
      ].join('\n')
    }
  }
}
