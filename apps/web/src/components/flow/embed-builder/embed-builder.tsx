import { useEffect, useMemo, useState } from 'react'
import { cn } from '@/lib/utils'
import type { FlowSnapshot } from '@/stores/flow-store'
import { buildEmbedSnippet, buildEmbedUrl } from '@/embed/embed-url'
import { EmbedBuilderForm } from './embed-builder-form'
import { EmbedPreview } from './embed-preview'
import { EmbedSnippet } from './embed-snippet'
import { SelfHostedPanel } from './self-hosted-panel'
import {
  EMBED_VARIANTS,
  loadBuilderSettings,
  resolveSnippetSize,
  saveBuilderSettings,
  type BuilderSettings,
} from './constants'
import { labelClass, rowClass, segmentClass } from './styles'

interface EmbedBuilderProps {
  snapshot: FlowSnapshot
}

export const EmbedBuilder = ({ snapshot }: EmbedBuilderProps) => {
  const [settings, setSettings] = useState<BuilderSettings>(loadBuilderSettings)

  useEffect(() => {
    saveBuilderSettings(settings)
  }, [settings])

  const url = useMemo(() => buildEmbedUrl(snapshot, settings.config), [snapshot, settings.config])
  const size = useMemo(
    () => resolveSnippetSize(settings.sizeId, settings.fixedHeight),
    [settings.sizeId, settings.fixedHeight]
  )
  const snippet = useMemo(() => buildEmbedSnippet(url, size), [url, size])

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <EmbedPreview url={url} size={size} />
        <EmbedBuilderForm settings={settings} onChange={setSettings} />
      </div>
      <div className={rowClass}>
        <span className={labelClass}>Embed as</span>
        <div className="flex gap-1.5">
          {EMBED_VARIANTS.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              aria-pressed={settings.variant === id}
              onClick={() => setSettings((current) => ({ ...current, variant: id }))}
              className={cn(segmentClass(settings.variant === id), 'normal-case')}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      {settings.variant === 'hosted' ? (
        <EmbedSnippet snippet={snippet} url={url} />
      ) : (
        <SelfHostedPanel
          snapshot={snapshot}
          config={settings.config}
          size={size}
          format={settings.format}
          onFormatChange={(format) => setSettings((current) => ({ ...current, format }))}
        />
      )}
    </div>
  )
}
