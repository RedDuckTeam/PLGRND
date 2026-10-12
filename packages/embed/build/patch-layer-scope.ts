import fs from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { normalizePath, type Plugin } from 'vite'

/** M18 is written against this exact dist; any other version must be re-ported before it builds. */
export const DISMISSABLE_LAYER_VERSION = '1.1.11'
const MODULE_SUFFIX = '/@radix-ui/react-dismissable-layer/dist/index.mjs'

const ESCAPE_CALL_RE = /(useEscapeKeydown\(\(event\) => \{[\s\S]*?\}, )ownerDocument(\);)/g
const EXPORT_RE = /export \{\n {2}Branch,\n/g

const HELPER = `
function __plgrndEscapeTarget(node, ownerDocument) {
  const root = node?.getRootNode?.();
  return root && typeof ShadowRoot !== "undefined" && root instanceof ShadowRoot ? root : ownerDocument;
}
`

function assertVersion(root: string) {
  const require = createRequire(path.join(root, 'package.json'))
  // The package's `exports` map hides package.json; read it next to the resolved dist entry.
  const entry = require.resolve('@radix-ui/react-dismissable-layer')
  const pkg = JSON.parse(fs.readFileSync(path.resolve(path.dirname(entry), '../package.json'), 'utf8')) as {
    version: string
  }
  if (pkg.version !== DISMISSABLE_LAYER_VERSION) {
    throw new Error(
      `[patch-layer-scope] @radix-ui/react-dismissable-layer is ${pkg.version}, M18 targets ${DISMISSABLE_LAYER_VERSION}`
    )
  }
}

/**
 * M18: per-widget Radix layers.
 * (i) the layer's Escape listener goes on the widget's ShadowRoot instead of the host document, so a
 *     host Escape is never preventDefault-ed and Escape is heard only inside the owning widget;
 * (ii) DismissableLayerContext is exported, so each widget mounts its own layer stack.
 * Exactly one match is required for each site.
 */
export function patchLayerScope(
  packageRoot: string,
  onCounts?: (id: string, counts: Record<string, number>) => void
): Plugin {
  return {
    name: 'plgrnd:patch-layer-scope',
    enforce: 'pre',
    buildStart() {
      assertVersion(packageRoot)
    },
    transform(code, id) {
      if (!normalizePath(id.split('?')[0]).endsWith(MODULE_SUFFIX)) return null
      const escapeSites = code.match(ESCAPE_CALL_RE)?.length ?? 0
      const exportSites = code.match(EXPORT_RE)?.length ?? 0
      if (escapeSites !== 1 || exportSites !== 1) {
        throw new Error(
          `[patch-layer-scope] expected 1 escape site and 1 export site, found ${escapeSites} and ${exportSites}`
        )
      }
      onCounts?.(id, { escapeSites, exportSites })
      const patched = code
        .replace(ESCAPE_CALL_RE, '$1__plgrndEscapeTarget(node, ownerDocument)$2')
        .replace(EXPORT_RE, 'export {\n  Branch,\n  DismissableLayerContext,\n')
      return { code: `${patched}\n${HELPER}`, map: null }
    },
  }
}
