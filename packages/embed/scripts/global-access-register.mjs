// Global-access register (plan 4.4): for every bundled third-party package and every runtime source module
// (apps/web/src, packages/embed/src), count the tokens through which code can reach the host page. react-dom,
// @radix-ui/* and @xyflow/* are registered per site (a fingerprint of the token and its normalised ±40-character
// context); everything else per package or module (counts). Each entry carries one classification:
// `safe`, `mitigated:Mx`, `unreachable-in-S-N` or `accepted:<reason>`, stored in build/global-access-register.json.
//
//   node scripts/global-access-register.mjs           compare dist/ against the stored register (exit 1 on drift)
//   node scripts/global-access-register.mjs --write   store the current entries, keeping the classification of
//                                                     unchanged ones; new or changed entries come out unreviewed
//
// The register flags drift. It does not prove the first classification right; Phase 0's probes cover that.
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { packageRootOf, readManifest, renderedModuleFiles } from './third-party-licenses.mjs'

const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const REPO_ROOT = path.resolve(PACKAGE_ROOT, '../..')
export const REGISTER_FILE = path.join(PACKAGE_ROOT, 'build/global-access-register.json')
export const CLASSIFICATION_RE = /^(?:safe|mitigated:M\d+[A-Z]?|unreachable-in-S-N|accepted:.+)$/

// Bare identifiers: not a property access, not part of a longer name.
const bare = (name) => new RegExp(`(?<![.\\w$])${name}\\b`, 'g')
export const TOKENS = [
  ['document.', /(?<![.\w$])document\./g],
  ['window.', /(?<![.\w$])window\./g],
  ['globalThis.', /(?<![.\w$])globalThis\./g],
  ['global.', /(?<![.\w$])global\./g],
  ['self.', /(?<![.\w$])self\./g],
  ['ownerDocument', /\bownerDocument\b/g],
  ['defaultView', /\bdefaultView\b/g],
  ['getRootNode', /\bgetRootNode\b/g],
  ['activeElement', /\bactiveElement\b/g],
  ['addEventListener(', /\baddEventListener\(/g],
  ['matchMedia(', /\bmatchMedia\(/g],
  ['requestAnimationFrame(', /\brequestAnimationFrame\(/g],
  ['setTimeout(', /\bsetTimeout\(/g],
  ['postMessage(', /\bpostMessage\(/g],
  ['fetch(', /\bfetch\(/g],
  ['WebSocket(', /\bWebSocket\(/g],
  ['localStorage', bare('localStorage')],
  ['sessionStorage', bare('sessionStorage')],
  ['location', bare('location')],
  ['history', bare('history')],
  ['navigator', bare('navigator')],
  // Not in the plan's list: the Navigation API reaches history and routers the same way (spec: no history writes).
  ['navigation', bare('navigation')],
]

const PER_SITE_RE = /^(?:react-dom|@radix-ui\/.+|@xyflow\/.+)$/
const CONTEXT = 40
const SOURCE_EXT_RE = /\.(?:[cm]?jsx?|tsx?)$/

const toPosix = (file) => file.split(path.sep).join('/')
const normalise = (text) => text.replace(/\s+/g, ' ').trim()
const fingerprint = (token, context) =>
  crypto.createHash('sha256').update(`${token}\n${context}`).digest('hex').slice(0, 12)

/** Bundled source files with rendered code, from dist/module-list.json (commonjs virtual ids folded in). */
export function bundledSources(dist) {
  return renderedModuleFiles(path.join(dist, 'module-list.json'))
    .filter((file) => SOURCE_EXT_RE.test(file) && fs.existsSync(file))
    .sort()
}

/** The owner of a source file: `{ owner, name, kind, base }` (a package, or a repo-relative module path). */
function ownerOf(file) {
  const root = packageRootOf(file)
  if (root) {
    const manifest = readManifest(root.dir)
    return { owner: `${manifest.name}@${manifest.version}`, name: manifest.name, kind: 'package', base: root.dir }
  }
  const rel = toPosix(path.relative(REPO_ROOT, file))
  return { owner: rel, name: rel, kind: 'module', base: path.dirname(file) }
}

/** Scans the bundled sources; returns entries keyed `owner|token` (counts) or `owner|token|fingerprint` (sites). */
export function scanRegister(dist = path.join(PACKAGE_ROOT, 'dist')) {
  const entries = new Map()
  const add = (key, entry) => {
    const existing = entries.get(key)
    if (existing) existing.count += entry.count
    else entries.set(key, entry)
  }
  for (const file of bundledSources(dist)) {
    const { owner, name, kind, base } = ownerOf(file)
    const source = fs.readFileSync(file, 'utf8')
    const perSite = kind === 'package' && PER_SITE_RE.test(name)
    for (const [token, pattern] of TOKENS) {
      pattern.lastIndex = 0
      let match
      let count = 0
      while ((match = pattern.exec(source))) {
        count++
        if (!perSite) continue
        const context = normalise(
          source.slice(Math.max(0, match.index - CONTEXT), match.index + token.length + CONTEXT)
        )
        const fp = fingerprint(token, context)
        add(`${owner}|${token}|${fp}`, {
          owner,
          token,
          site: fp,
          file: toPosix(path.relative(base, file)),
          context,
          count: 1,
        })
      }
      if (!perSite && count > 0) add(`${owner}|${token}`, { owner, token, count })
    }
  }
  return entries
}

export function readRegister() {
  if (!fs.existsSync(REGISTER_FILE)) return { entries: {} }
  return JSON.parse(fs.readFileSync(REGISTER_FILE, 'utf8'))
}

/** Compares scanned entries with the stored register; every difference is a failure until re-reviewed. */
export function compareRegister(scanned, stored) {
  const problems = []
  for (const [key, entry] of scanned) {
    const known = stored.entries[key]
    if (!known) problems.push(`new: ${key} (x${entry.count})`)
    else if (known.count !== entry.count) problems.push(`count changed: ${key} ${known.count} -> ${entry.count}`)
    else if (!CLASSIFICATION_RE.test(known.classification ?? '')) problems.push(`unreviewed: ${key}`)
  }
  for (const key of Object.keys(stored.entries)) if (!scanned.has(key)) problems.push(`gone: ${key}`)
  return problems
}

function writeRegister(scanned) {
  const stored = readRegister()
  const entries = {}
  for (const [key, entry] of [...scanned].sort(([a], [b]) => a.localeCompare(b))) {
    const known = stored.entries[key]
    const unchanged = known && known.count === entry.count
    entries[key] = {
      ...entry,
      classification: unchanged ? known.classification : null,
      ...(unchanged && known.note ? { note: known.note } : {}),
    }
  }
  fs.writeFileSync(
    REGISTER_FILE,
    `${JSON.stringify({ description: stored.description ?? '', classifications: stored.classifications ?? {}, entries }, null, 2)}\n`
  )
  return Object.values(entries).filter((entry) => entry.classification === null).length
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const scanned = scanRegister()
  if (process.argv.includes('--write')) {
    const unreviewed = writeRegister(scanned)
    console.log(`[register] ${scanned.size} entries written, ${unreviewed} unreviewed`)
  } else {
    const problems = compareRegister(scanned, readRegister())
    for (const problem of problems) console.error(`[register] ${problem}`)
    console.log(`[register] ${scanned.size} entries, ${problems.length} problems`)
    process.exitCode = problems.length > 0 ? 1 : 0
  }
}
