// dist/THIRD_PARTY_LICENSES.txt: the licence text of every third-party package bundled into the runtime artifacts,
// read from dist/module-list.json (modules with rendered code only). A package without a licence file fails the
// script, unless build/license-overrides.json names a package of the same repository and licence to take it from.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OVERRIDES = path.join(PACKAGE_ROOT, 'build/license-overrides.json')
const LICENSE_FILE_RE = /^(?:licen[cs]e|copying)(?:[-._][\w.-]*)?$/i
const RULE = '-'.repeat(80)

/** `<…>/node_modules/@scope/name/dist/x.js` (or a `\0…?commonjs-*` virtual id) -> the package root. */
export function packageRootOf(id) {
  const file = id.replace(/^\0/, '').split('?')[0]
  const marker = '/node_modules/'
  const at = file.lastIndexOf(marker)
  if (at === -1) return null
  const segments = file.slice(at + marker.length).split('/')
  const name = segments[0].startsWith('@') ? `${segments[0]}/${segments[1]}` : segments[0]
  return { name, dir: `${file.slice(0, at + marker.length)}${name}` }
}

/** The files of every module with rendered code in any build (virtual-id prefix and query stripped), in order. */
export function renderedModuleFiles(moduleListFile) {
  const list = JSON.parse(fs.readFileSync(moduleListFile, 'utf8'))
  const files = new Set()
  for (const build of Object.values(list.builds)) {
    for (const modules of Object.values(build.chunks)) {
      for (const module of modules) {
        if (module.renderedLength !== 0) files.add(module.id.replace(/^\0/, '').split('?')[0])
      }
    }
  }
  return [...files]
}

/** Every bundled package root (by directory), from the module lists of all builds. */
export function bundledPackages(moduleListFile) {
  const roots = new Map()
  for (const file of renderedModuleFiles(moduleListFile)) {
    const root = packageRootOf(file)
    if (root) roots.set(root.dir, root)
  }
  return [...roots.values()]
}

export const readManifest = (dir) => JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'))
const licenseId = (manifest) =>
  typeof manifest.license === 'string' ? manifest.license : (manifest.license?.type ?? 'UNKNOWN')
const licenseFile = (dir) =>
  fs
    .readdirSync(dir)
    .filter((name) => LICENSE_FILE_RE.test(name))
    .sort()[0]

/** The installed copy of `name` that Node would resolve from this package (walking up the node_modules dirs). */
function installedDir(name) {
  for (let dir = PACKAGE_ROOT; ; dir = path.dirname(dir)) {
    const candidate = path.join(dir, 'node_modules', name)
    if (fs.existsSync(path.join(candidate, 'package.json'))) return candidate
    if (path.dirname(dir) === dir) throw new Error(`[third-party-licenses] ${name} is not installed`)
  }
}

function overrideText(manifest, override) {
  const sourceDir = installedDir(override.textFrom)
  const source = readManifest(sourceDir)
  const file = licenseFile(sourceDir)
  if (licenseId(manifest) !== override.license || licenseId(source) !== override.license || !file) {
    throw new Error(
      `[third-party-licenses] override for ${manifest.name}: expected ${override.license} on both packages and a ` +
        `licence file in ${override.textFrom}@${source.version}`
    )
  }
  return {
    text: fs.readFileSync(path.join(sourceDir, file), 'utf8'),
    note: `No licence file in this package; text from ${override.textFrom} ${source.version} (${override.reason}).`,
  }
}

export function writeThirdPartyLicenses({ dist, version }) {
  const overrides = fs.existsSync(OVERRIDES) ? JSON.parse(fs.readFileSync(OVERRIDES, 'utf8')).packages : {}
  const entries = new Map()
  const missing = []
  for (const root of bundledPackages(path.join(dist, 'module-list.json'))) {
    const manifest = readManifest(root.dir)
    const key = `${manifest.name}@${manifest.version}`
    if (entries.has(key)) continue // the same version installed twice (nested copies)
    const file = licenseFile(root.dir)
    let text = file ? fs.readFileSync(path.join(root.dir, file), 'utf8') : null
    let note = null
    if (!text && overrides[manifest.name]) ({ text, note } = overrideText(manifest, overrides[manifest.name]))
    if (!text) {
      missing.push(`${key} (${root.dir})`)
      continue
    }
    entries.set(key, {
      name: manifest.name,
      version: manifest.version,
      license: licenseId(manifest),
      note,
      text: text.replace(/\r\n/g, '\n').trim(),
    })
  }
  if (missing.length > 0) {
    throw new Error(`[third-party-licenses] no licence file for:\n  ${missing.join('\n  ')}`)
  }

  const sorted = [...entries.values()].sort(
    (a, b) => a.name.localeCompare(b.name) || a.version.localeCompare(b.version)
  )
  const out = [
    `Third-party software bundled in @plgrnd/embed ${version}`,
    '',
    'The published artifacts (dist/plgrnd-flow.iife.js and dist/esm/) include the packages below.',
    'Each entry gives the package, its version and declared licence, then the licence text it ships with.',
    '',
    ...sorted.flatMap((e) => [
      RULE,
      `${e.name} ${e.version} (${e.license})`,
      ...(e.note ? [e.note] : []),
      RULE,
      '',
      e.text,
      '',
    ]),
  ].join('\n')
  fs.writeFileSync(path.join(dist, 'THIRD_PARTY_LICENSES.txt'), out)
  return sorted
}
