import { useMemo } from 'react'
import { Copy } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { EmbedConfig } from '@/embed/embed-config'
import type { EmbedSnippetSize } from '@/embed/embed-url'
import { PLGRND_ORIGIN } from '@/embed/plgrnd-links'
import {
  buildSelfHostedSnippet,
  MINTLIFY_IMPORT,
  SELF_HOSTED_FORMATS,
  type SelfHostedFormat,
} from '@/embed/self-hosted-snippet'
import { sanitizeNodes, type FlowSnapshot } from '@/stores/flow-snapshot'
import { requiresV4 } from '@/utils/flow/requires-v4'
import { copyText } from './copy-text'
import { EmbedSnippet } from './embed-snippet'
import { labelClass, noteClass, rowClass, segmentClass } from './styles'

const VERSION = __PLGRND_EMBED_VERSION__
const SDK_URL = `${PLGRND_ORIGIN}/sdk/${VERSION}`
const GUIDE_URL = 'https://github.com/RedDuckTeam/PLGRND#self-hosted-embedding'
// Version-4 flows (non-legacy IDLs, IDLs loaded by reference) are readable from @plgrnd/embed 1.1 on.
const SDK_READS_V4 = (() => {
  const [major, minor] = VERSION.split('.').map(Number)
  return major > 1 || (major === 1 && minor >= 1)
})()

const DOWNLOADS = [
  `plgrnd-flow-${VERSION}.js`,
  `plgrnd-flow-${VERSION}/plgrnd-flow.js`,
  `plgrnd-flow-${VERSION}/plgrnd-flow-runtime.js`,
  'SHA256SUMS.txt',
]

const SETUP: Record<SelfHostedFormat, string> = {
  html: `Load plgrnd-flow-${VERSION}.js once per page with a <script> tag.`,
  mdx: `Load plgrnd-flow-${VERSION}.js once per page, or import '@plgrnd/embed' in a client module.`,
  mintlify: `Put plgrnd-flow-${VERSION}.js at the root of the docs repo and add snippets/plgrnd-flow.jsx.`,
  markdoc: 'Register the plgrnd-flow tag and its component once.',
}

const linkClass = 'text-foreground underline underline-offset-2 hover:text-primary'

const CopyLine = ({ text, message }: { text: string; message: string }) => (
  <div className="flex gap-2">
    <code className="min-w-0 flex-1 truncate rounded-md border border-border bg-background px-2 py-1.5 font-mono text-[10px] text-muted-foreground">
      {text}
    </code>
    <button
      type="button"
      onClick={() => void copyText(text, message)}
      className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 font-mono text-xs text-foreground transition-colors hover:bg-muted"
    >
      <Copy className="h-3.5 w-3.5" />
      Copy
    </button>
  </div>
)

interface SelfHostedPanelProps {
  snapshot: FlowSnapshot
  config: EmbedConfig
  size: EmbedSnippetSize
  format: SelfHostedFormat
  onFormatChange: (format: SelfHostedFormat) => void
}

/** The Share dialog's self-hosted variant: the <plgrnd-flow> snippet per docs format, plus where to get the files. */
export const SelfHostedPanel = ({ snapshot, config, size, format, onFormatChange }: SelfHostedPanelProps) => {
  const snippet = useMemo(
    () => buildSelfHostedSnippet(snapshot, config, size, format),
    [snapshot, config, size, format]
  )
  const needsNewerSdk = useMemo(
    () => !SDK_READS_V4 && requiresV4({ nodes: sanitizeNodes(snapshot.nodes), edges: snapshot.edges }),
    [snapshot]
  )

  return (
    <div className="flex flex-col gap-3">
      <div className={rowClass}>
        <span className={labelClass}>Format</span>
        <div className="flex flex-wrap gap-1.5">
          {SELF_HOSTED_FORMATS.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              aria-pressed={format === id}
              onClick={() => onFormatChange(id)}
              className={cn(segmentClass(format === id), 'normal-case')}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {format === 'mintlify' && (
        <div className={rowClass}>
          <span className={labelClass}>Add once per page</span>
          <CopyLine text={MINTLIFY_IMPORT} message="Import copied" />
        </div>
      )}

      {needsNewerSdk ? (
        <p className={noteClass}>
          This flow needs @plgrnd/embed 1.1 or later, which is not released yet. Use the iframe embed for now.
        </p>
      ) : (
        <EmbedSnippet snippet={snippet} />
      )}

      {config.mode === 'editor' && (
        <p className={noteClass}>
          Editor mode is not available in the self-hosted widget, so this snippet uses interactive mode.
        </p>
      )}

      <div className={rowClass}>
        <span className={labelClass}>Files</span>
        <p className={noteClass}>
          {SETUP[format]}{' '}
          <a href={GUIDE_URL} target="_blank" rel="noopener noreferrer" className={linkClass}>
            Setup guide
          </a>
        </p>
        {__PLGRND_EMBED_RELEASED__ ? (
          <ul className="flex flex-col gap-0.5">
            {DOWNLOADS.map((file) => (
              <li key={file} className={noteClass}>
                <a href={`${SDK_URL}/${file}`} target="_blank" rel="noopener noreferrer" className={linkClass}>
                  {file}
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <p className={noteClass}>
            Not released yet. Build the files from the repository with{' '}
            <code className="text-foreground">yarn workspace @plgrnd/embed build</code> (output in
            packages/embed/dist/sdk/{VERSION}/).
          </p>
        )}
        {__PLGRND_EMBED_NPM_PUBLISHED__ ? (
          <CopyLine text={`npm i @plgrnd/embed@${VERSION}`} message="Command copied" />
        ) : (
          <p className={noteClass}>npm: pending</p>
        )}
      </div>
    </div>
  )
}
