// AC-R6 on React 19: `vite build --config vite.build.config.ts --mode fixtures` builds this page into
// fixtures/.build/react19/ (served at /.build/react19/). The element is already defined by the classic script, so
// React 19 sets `flow`, `theme`, `accent` and `controls` as properties and `font-mono` as an attribute.
import { StrictMode, useState } from 'react'
import { createRoot } from 'react-dom/client'
import type {} from '../../types'

function App({ flow }: { flow: string }) {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')
  const [accent, setAccent] = useState('ed4937')
  return (
    <>
      <button id="toggle-theme" type="button" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
        Toggle theme
      </button>
      <button id="toggle-accent" type="button" onClick={() => setAccent(accent === 'ed4937' ? '2563eb' : 'ed4937')}>
        Toggle accent
      </button>
      <plgrnd-flow
        id="r19"
        flow={flow}
        theme={theme}
        accent={accent}
        controls="0"
        font-mono="monospace"
        style={{ display: 'block', aspectRatio: '16/9', minHeight: 320 }}
      />
    </>
  )
}

void fetch('/flows.json')
  .then((response) => response.json() as Promise<Record<string, { payload: string }>>)
  .then((flows) => {
    createRoot(document.getElementById('root') as HTMLElement).render(
      <StrictMode>
        <App flow={flows.P0.payload} />
      </StrictMode>
    )
  })
