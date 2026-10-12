// ESM entry (npm `exports` default and the versioned /sdk folder): defines the element and nothing else.
// The runtime chunk loads the first time an element connects; its URL resolves against this file's URL,
// so the folder can live under any path.
import type { RuntimeModule } from './types/runtime-api'
import { define } from './element/define'
import { VERSION } from './version'

let runtime: Promise<RuntimeModule> | null = null

define({
  version: VERSION,
  eager: true,
  // The same static import() on every call; a failed load is retried by the element's Retry button.
  load: () => {
    runtime ??= import('./runtime/runtime').catch((error: unknown) => {
      runtime = null
      throw error
    })
    return runtime
  },
})
