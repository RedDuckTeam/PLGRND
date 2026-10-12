// Release check for the versioned @plgrnd/embed downloads (plan 5.1-5.2). The apps/web build runs it (vite.config.ts),
// so every Cloudflare deploy from main is checked:
//   default    verifies every committed apps/web/public/sdk/<v>/ folder against its own SHA256SUMS.txt and fails only
//              on a mismatch. A missing folder for the current version only warns (before the first release), so
//              routine site deploys never need an embed build.
//   --release  also requires apps/web/public/sdk/<v>/ for the current version, byte-identical to a fresh
//              packages/embed/dist/sdk/<v>/ (run `yarn workspace @plgrnd/embed build` first).
// Both modes check apps/web/public/_headers: the one-year cache rule must name committed version folders only
// (`/sdk/<v>/*`). Cloudflare applies the rules to the SPA fallback too, so a broader rule would cache index.html for
// a year at paths that do not exist yet.
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SDK_ROOT = path.resolve(PACKAGE_ROOT, '../../apps/web/public/sdk')
const HEADERS_FILE = path.resolve(PACKAGE_ROOT, '../../apps/web/public/_headers')
const DIST_SDK = path.join(PACKAGE_ROOT, 'dist/sdk')
const release = process.argv.includes('--release')
const { version } = JSON.parse(fs.readFileSync(path.join(PACKAGE_ROOT, 'package.json'), 'utf8'))

const problems = []
const warnings = []
const sha256 = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')
const walk = (dir) =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name)
    return entry.isDirectory() ? walk(full) : [full]
  })
const filesOf = (dir) =>
  walk(dir)
    .map((file) => path.relative(dir, file).split(path.sep).join('/'))
    .sort()

function checkFolder(dir, v) {
  const sumsFile = path.join(dir, 'SHA256SUMS.txt')
  if (!fs.existsSync(sumsFile)) {
    problems.push(`sdk/${v}: SHA256SUMS.txt is missing`)
    return
  }
  const listed = fs
    .readFileSync(sumsFile, 'utf8')
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => line.split(/\s+/))
  for (const [hash, rel] of listed) {
    const file = path.join(dir, rel)
    if (!fs.existsSync(file)) problems.push(`sdk/${v}/${rel} is listed in SHA256SUMS.txt but missing`)
    else if (sha256(file) !== hash) problems.push(`sdk/${v}/${rel} does not match SHA256SUMS.txt`)
  }
  for (const rel of filesOf(dir)) {
    if (rel.endsWith('.js') && !listed.some(([, name]) => name === rel)) {
      problems.push(`sdk/${v}/${rel} is not listed in SHA256SUMS.txt`)
    }
  }
}

const versions = fs.existsSync(SDK_ROOT)
  ? fs
      .readdirSync(SDK_ROOT, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort()
  : []
for (const v of versions) checkFolder(path.join(SDK_ROOT, v), v)

const sdkRules = fs.existsSync(HEADERS_FILE)
  ? fs
      .readFileSync(HEADERS_FILE, 'utf8')
      .split(/\r?\n/)
      .filter((line) => line.startsWith('/sdk'))
      .map((line) => line.trim())
  : []
for (const rule of sdkRules) {
  const ruleVersion = /^\/sdk\/([^/*]+)\/\*$/.exec(rule)?.[1]
  if (!ruleVersion || !versions.includes(ruleVersion)) {
    problems.push(`apps/web/public/_headers: "${rule}" must be /sdk/<v>/* for a committed version folder`)
  }
}
for (const v of versions) {
  if (!sdkRules.includes(`/sdk/${v}/*`))
    warnings.push(`apps/web/public/_headers has no /sdk/${v}/* rule (no long cache)`)
}

const current = path.join(SDK_ROOT, version)
if (!fs.existsSync(current)) {
  const message = `apps/web/public/sdk/${version}/ does not exist`
  if (release) problems.push(`${message}: copy packages/embed/dist/sdk/${version}/ there`)
  else warnings.push(`${message} yet (not released); the Share dialog shows "not released yet"`)
} else if (release) {
  const fresh = path.join(DIST_SDK, version)
  if (!fs.existsSync(fresh)) {
    problems.push(`packages/embed/dist/sdk/${version}/ is missing: run yarn workspace @plgrnd/embed build`)
  } else {
    const committed = filesOf(current)
    const built = filesOf(fresh)
    if (committed.join() !== built.join()) {
      problems.push(
        `sdk/${version}: committed files [${committed.join(', ')}] differ from the build [${built.join(', ')}]`
      )
    }
    for (const rel of committed.filter((name) => built.includes(name))) {
      if (sha256(path.join(current, rel)) !== sha256(path.join(fresh, rel))) {
        problems.push(`sdk/${version}/${rel} differs from the fresh build`)
      }
    }
  }
}

for (const warning of warnings) console.warn(`[release-check] warning: ${warning}`)
for (const problem of problems) console.error(`[release-check] ${problem}`)
console.log(
  `[release-check] @plgrnd/embed ${version}${release ? ' (--release)' : ''}: ${versions.length} committed version(s), ` +
    `${problems.length} problem(s), ${warnings.length} warning(s)`
)
process.exitCode = problems.length > 0 ? 1 : 0
