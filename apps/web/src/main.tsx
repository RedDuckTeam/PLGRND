import '@/embed/legacy-redirect'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { App } from './App.tsx'
import '@xyflow/react/dist/style.css'
import { Buffer } from 'buffer'
import { ErrorBoundary } from './components/ui/error-boundary'
import { IS_EMBED, parseLocationParams } from '@/embed/embed-location'
import { parseEmbedConfig } from '@/embed/embed-config'
import { applyThemeToDocument, resolveTheme } from '@/embed/embed-theme'

window.Buffer = Buffer

if (IS_EMBED) {
  const { config } = parseEmbedConfig(parseLocationParams())
  const prefersDark =
    typeof window.matchMedia === 'function' ? window.matchMedia('(prefers-color-scheme: dark)').matches : true
  applyThemeToDocument(resolveTheme(config.theme, prefersDark), config)
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>
)
