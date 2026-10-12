import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { normalizePath, type Plugin } from 'vite'
import { resolveAliases, type ModuleAlias } from './resolve-aliases'
import { transformShadowCss, type ShadowCssCounts } from './shadow-css'
import { patchLayerScope } from './patch-layer-scope'
import { patchDialogWarnings } from './patch-dialog-warnings'

export const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
export const APP_SRC = path.resolve(PACKAGE_ROOT, '../../apps/web/src')
const shim = (file: string) => path.join(PACKAGE_ROOT, 'src/shims', file)

/** One application of a third-party or CSS transform, with its match counts (reported by the build). */
export interface TransformRecord {
  mitigation: 'M6' | 'M18' | 'M21'
  id: string
  counts: ShadowCssCounts | Record<string, number>
}

export interface ShadowCompatOptions {
  /** Called with the match counts of every M6, M18 and M21 transform. */
  onTransform?: (record: TransformRecord) => void
}

/** Library and app modules the self-hosted (S-N) build swaps out. */
export const SHADOW_ALIASES: ModuleAlias[] = [
  { from: 'sonner', to: shim('sonner.tsx') }, // M2
  { from: 'react-remove-scroll', to: shim('react-remove-scroll.tsx') }, // M3 (safety net in S-N)
  { from: 'aria-hidden', to: shim('aria-hidden.ts') }, // M4 (safety net in S-N)
  { from: '@radix-ui/react-focus-guards', to: shim('focus-guards.ts') }, // M14
  { from: '@solana/wallet-adapter-react-ui', to: shim('wallet-adapter-react-ui.ts') }, // M13 (AC-D3)
  { from: path.join(APP_SRC, 'components/ui/select.tsx'), to: shim('native-select.tsx') }, // M11
]

/** Packages the dev server must serve unbundled, so it runs the same aliased and patched copies (R51). */
export const DEV_EXCLUDE = [
  '@radix-ui/react-dismissable-layer',
  '@radix-ui/react-dialog',
  '@radix-ui/react-focus-guards',
  'react-remove-scroll',
  'aria-hidden',
]

const RUNTIME_STYLES_RE = /\/packages\/embed\/src\/runtime\/styles\.css\?inline$/

/** M6 on the runtime stylesheet, which Vite exposes as `export default "<css>"` for `?inline` imports. */
function shadowCssPlugin(onCounts?: (id: string, counts: ShadowCssCounts) => void): Plugin {
  return {
    name: 'plgrnd:shadow-css',
    enforce: 'post',
    transform(code, id) {
      if (!RUNTIME_STYLES_RE.test(normalizePath(id))) return null
      const match = /^export default (".*")\s*;?\s*$/s.exec(code.trim())
      if (!match) throw new Error(`[shadow-css] unexpected inline CSS module shape for ${id}`)
      const { css, counts } = transformShadowCss(JSON.parse(match[1]) as string)
      onCounts?.(id, counts)
      return { code: `export default ${JSON.stringify(css)}`, map: null }
    },
  }
}

/**
 * The single plugin set for every self-hosted pipeline (`dev` and the production builds):
 * module swaps (M2, M3, M4, M11, M13, M14), the shadow CSS transform (M6), the per-widget layer patch (M18) and the
 * dialog-warning lookup patch (M21).
 */
export function shadowCompat(options: ShadowCompatOptions = {}): Plugin[] {
  const report = (mitigation: TransformRecord['mitigation']) => (id: string, counts: TransformRecord['counts']) =>
    options.onTransform?.({ mitigation, id: normalizePath(id), counts })
  return [
    resolveAliases('plgrnd:shadow-aliases', SHADOW_ALIASES),
    patchLayerScope(PACKAGE_ROOT, report('M18')),
    patchDialogWarnings(PACKAGE_ROOT, report('M21')),
    shadowCssPlugin(report('M6')),
    {
      name: 'plgrnd:dev-parity',
      config: () => ({ optimizeDeps: { exclude: DEV_EXCLUDE } }),
    },
  ]
}
