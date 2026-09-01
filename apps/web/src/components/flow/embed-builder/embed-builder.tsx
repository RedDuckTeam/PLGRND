import { useEffect, useMemo, useState } from 'react'
import type { FlowSnapshot } from '@/stores/flow-store'
import { buildEmbedSnippet, buildEmbedUrl } from '@/embed/embed-url'
import { EmbedBuilderForm } from './embed-builder-form'
import { EmbedPreview } from './embed-preview'
import { EmbedSnippet } from './embed-snippet'
import { loadBuilderSettings, resolveSnippetSize, saveBuilderSettings, type BuilderSettings } from './constants'

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
      <EmbedSnippet snippet={snippet} url={url} />
    </div>
  )
}
