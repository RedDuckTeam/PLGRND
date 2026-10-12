import fs from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { normalizePath, type Plugin } from 'vite'

/** M21 is written against this exact dist; any other version must be re-ported before it builds. */
export const DIALOG_VERSION = '1.1.15'
const MODULE_SUFFIX = '/@radix-ui/react-dialog/dist/index.mjs'

// Two sites (TitleWarning, DescriptionWarning), four named edits; each must match exactly once.
const EDITS: [name: string, pattern: RegExp, replacement: string][] = [
  [
    'titleWarningProps',
    /jsx\(TitleWarning, \{ titleId: context\.titleId \}\)/g,
    'jsx(TitleWarning, { titleId: context.titleId, contentRef })',
  ],
  [
    'titleWarningParams',
    /var TitleWarning = \(\{ titleId \}\) => \{/g,
    'var TitleWarning = ({ titleId, contentRef }) => {',
  ],
  [
    'titleLookup',
    /const hasTitle = document\.getElementById\(titleId\);/g,
    'const hasTitle = __plgrndFindById(contentRef, titleId);',
  ],
  [
    'descriptionLookup',
    /const hasDescription = document\.getElementById\(descriptionId\);/g,
    'const hasDescription = __plgrndFindById(contentRef, descriptionId);',
  ],
]

const HELPER = `
function __plgrndFindById(contentRef, id) {
  const root = contentRef?.current?.getRootNode?.();
  return root && typeof root.getElementById === "function" ? root.getElementById(id) : document.getElementById(id);
}
`

function assertVersion(root: string) {
  const require = createRequire(path.join(root, 'package.json'))
  // The package's `exports` map hides package.json; read it next to the resolved dist entry.
  const entry = require.resolve('@radix-ui/react-dialog')
  const pkg = JSON.parse(fs.readFileSync(path.resolve(path.dirname(entry), '../package.json'), 'utf8')) as {
    version: string
  }
  if (pkg.version !== DIALOG_VERSION) {
    throw new Error(`[patch-dialog-warnings] @radix-ui/react-dialog is ${pkg.version}, M21 targets ${DIALOG_VERSION}`)
  }
}

/**
 * M21 (approved at G1, 2026-10-12): Radix Dialog's dev-time title/description checks call
 * `document.getElementById`, which never sees into a shadow root, so every dialog in a widget logged a false
 * "DialogContent requires a DialogTitle" error on the host console. The checks now look the ids up in the
 * dialog content's own root node (the widget's shadow root; the document elsewhere).
 */
export function patchDialogWarnings(
  packageRoot: string,
  onCounts?: (id: string, counts: Record<string, number>) => void
): Plugin {
  return {
    name: 'plgrnd:patch-dialog-warnings',
    enforce: 'pre',
    buildStart() {
      assertVersion(packageRoot)
    },
    transform(code, id) {
      if (!normalizePath(id.split('?')[0]).endsWith(MODULE_SUFFIX)) return null
      const counts: Record<string, number> = {}
      let patched = code
      for (const [name, pattern, replacement] of EDITS) {
        const matches = patched.match(pattern)?.length ?? 0
        if (matches !== 1) throw new Error(`[patch-dialog-warnings] expected 1 match of ${pattern}, found ${matches}`)
        counts[name] = matches
        patched = patched.replace(pattern, replacement)
      }
      onCounts?.(id, counts)
      return { code: `${patched}\n${HELPER}`, map: null }
    },
  }
}
