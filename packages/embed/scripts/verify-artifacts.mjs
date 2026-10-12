// `yarn workspace @plgrnd/embed verify`: the artifact checks of plan §6.4 (1-17), plus M20 and the M21 counts,
// on dist/ (or `--dist <dir>`). Every failed check is listed and the script exits 1.
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'
import { parseAst } from 'rollup/parseAst'
import { REPORT_ERROR_GUARD, RESIZE_OBSERVER_GUARD } from '../build/guards.ts'
import { bundledPackages, readManifest } from './third-party-licenses.mjs'
import { compareRegister, readRegister, scanRegister } from './global-access-register.mjs'

const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const REPO_ROOT = path.resolve(PACKAGE_ROOT, '../..')
const distArg = process.argv.indexOf('--dist')
const DIST = distArg > 0 ? path.resolve(process.argv[distArg + 1]) : path.join(PACKAGE_ROOT, 'dist')
const { version } = JSON.parse(fs.readFileSync(path.join(PACKAGE_ROOT, 'package.json'), 'utf8'))

const read = (rel) => fs.readFileSync(path.join(DIST, rel), 'utf8')
const count = (text, needle) => text.split(needle).length - 1
const matchAll = (text, re) => [
  ...text.matchAll(new RegExp(re.source, re.flags.includes('g') ? re.flags : `${re.flags}g`)),
]
const walk = (dir) =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name)
    return entry.isDirectory() ? walk(full) : [full]
  })

const IIFE = 'plgrnd-flow.iife.js'
const ENTRY = 'esm/plgrnd-flow.js'
const RUNTIME = 'esm/plgrnd-flow-runtime.js'
const SSR = 'ssr/index.js'
const SHELL = '.build/iife-shell/out/shell.iife.js'
const SDK = `sdk/${version}`
const SDK_FILES = [
  `${SDK}/plgrnd-flow-${version}.js`,
  `${SDK}/plgrnd-flow-${version}/plgrnd-flow.js`,
  `${SDK}/plgrnd-flow-${version}/plgrnd-flow-runtime.js`,
]
const ARTIFACTS = [IIFE, ENTRY, RUNTIME, SSR, ...SDK_FILES]
const RUNTIME_ARTIFACTS = [IIFE, RUNTIME]

const text = Object.fromEntries([...ARTIFACTS, SHELL].map((rel) => [rel, read(rel)]))
const moduleList = JSON.parse(read('module-list.json'))
const buildReport = JSON.parse(read('build-report.json'))
const modulesOf = (build, chunk) =>
  Object.entries(moduleList.builds[build].chunks)
    .filter(([name]) => !chunk || name === chunk)
    .flatMap(([, modules]) => modules)
const renderedIds = (modules) => [
  ...new Set(modules.filter((m) => m.renderedLength > 0).map((m) => m.id.replace(/^\0/, '').split('?')[0])),
]
const allRendered = renderedIds(Object.keys(moduleList.builds).flatMap((build) => modulesOf(build)))

const results = []
function check(id, title, fn) {
  try {
    const problems = fn() ?? []
    results.push({ id, title, ok: problems.length === 0, problems })
  } catch (error) {
    results.push({ id, title, ok: false, problems: [String(error?.message ?? error)] })
  }
}
const absent = (files, needles) =>
  files.flatMap((rel) =>
    needles.flatMap((needle) => {
      const hits = needle instanceof RegExp ? matchAll(text[rel], needle).length : count(text[rel], needle)
      return hits > 0 ? [`${rel}: ${needle} x${hits}`] : []
    })
  )

/** Module-level imports of an ES module, from its AST (strings that merely look like imports do not count). */
function moduleImports(code) {
  const found = { static: [], dynamic: [] }
  const visit = (node) => {
    if (Array.isArray(node)) return node.forEach(visit)
    if (!node || typeof node !== 'object' || typeof node.type !== 'string') return
    if (node.type === 'ImportDeclaration' || (node.type.startsWith('Export') && node.source))
      found.static.push(node.source.value)
    if (node.type === 'ImportExpression')
      found.dynamic.push(node.source.type === 'Literal' ? node.source.value : '<expression>')
    for (const key of Object.keys(node)) if (key !== 'type') visit(node[key])
  }
  visit(parseAst(code))
  return found
}

// react-dom bundles ReactDOM.preloadModule/preinitModule, whose resource-hint code holds the `modulepreload` literal
// (a dedupe selector and the link's rel). Check 3 targets Vite's preload helper, so exactly those react-dom
// literals are allowed, as many times as react-dom's own source has them, and nothing else.
const reactDomClientSource = allRendered.find((id) => /\/react-dom\/cjs\/react-dom-client\.production\.js$/.test(id))
const REACT_DOM_MODULEPRELOAD = reactDomClientSource
  ? count(fs.readFileSync(reactDomClientSource, 'utf8'), 'modulepreload')
  : 0

check(1, 'IIFE is a classic script with no module or blob/data script loading', () => {
  new vm.Script(text[IIFE], { filename: IIFE })
  return absent([IIFE], [/\bimport\s*\(/, 'new Worker', 'createObjectURL', 'blob:', 'data:text/javascript'])
})

check(2, 'AC-R14: no secrets, trackers or env names', () => {
  const problems = absent(ARTIFACTS, [
    /helius/i,
    'api-key',
    'fonts.googleapis',
    'cloudflareinsights',
    /\bVITE_[A-Z0-9_]+/,
  ])
  // Values of every apps/web .env file must not appear either (only their count is reported).
  const envDir = path.join(REPO_ROOT, 'apps/web')
  const values = fs
    .readdirSync(envDir)
    .filter((name) => /^\.env/.test(name))
    .flatMap((name) => fs.readFileSync(path.join(envDir, name), 'utf8').split(/\r?\n/))
    .map((line) => /^\s*[A-Z0-9_]+\s*=\s*["']?([^"'\s#]+)/.exec(line)?.[1])
    .filter((value) => value && value.length >= 8)
  const leaked = values.filter((value) => ARTIFACTS.some((rel) => text[rel].includes(value)))
  if (leaked.length > 0) problems.push(`${leaked.length} apps/web .env value(s) found in the artifacts`)
  return problems
})

check(3, 'no reload, history writes, parent messaging or preload helpers', () => {
  const problems = absent(ARTIFACTS, [
    'location.reload',
    'replaceState',
    'pushState',
    'parent.postMessage',
    '__vitePreload',
  ])
  const withReactDom = new Set([IIFE, RUNTIME, SDK_FILES[0], SDK_FILES[2]])
  for (const rel of ARTIFACTS) {
    const hits = count(text[rel], 'modulepreload')
    const allowed = withReactDom.has(rel) ? REACT_DOM_MODULEPRELOAD : 0
    const reactDomForms = count(text[rel], 'link[rel="modulepreload"]') + count(text[rel], 'rel:"modulepreload"')
    if (hits > allowed || hits !== reactDomForms)
      problems.push(`${rel}: modulepreload x${hits} (react-dom's own: ${allowed})`)
  }
  return problems
})

check(4, 'no unguarded process.; one react-dom client and one dismissable-layer module', () => {
  const problems = []
  for (const rel of ARTIFACTS) {
    for (const match of matchAll(text[rel], /\bprocess\./)) {
      const before = text[rel].slice(Math.max(0, match.index - 160), match.index)
      if (!/typeof process/.test(before))
        problems.push(`${rel}: unguarded ${text[rel].slice(match.index, match.index + 40)}`)
    }
  }
  const reactDomClient = allRendered.filter((id) => /\/react-dom\/cjs\/react-dom-client\.[\w.]+\.js$/.test(id))
  const reactDomRoots = new Set(
    allRendered
      .filter((id) => /\/node_modules\/react-dom\//.test(id))
      .map((id) => id.replace(/\/node_modules\/react-dom\/.*$/, ''))
  )
  const layer = allRendered.filter((id) => id.endsWith('/@radix-ui/react-dismissable-layer/dist/index.mjs'))
  if (reactDomClient.length !== 1) problems.push(`react-dom client modules: ${reactDomClient.length}`)
  if (reactDomRoots.size !== 1) problems.push(`react-dom package copies: ${reactDomRoots.size}`)
  if (layer.length !== 1) problems.push(`dismissable-layer modules: ${layer.length}`)
  return problems
})

check(5, 'module list excludes AC-D3, app-only and S-N-replaced modules', () => {
  const forbidden = [
    // AC-D3
    /\/node_modules\/zod\//,
    /\/node_modules\/@t3-oss\//,
    /\/node_modules\/react-router/,
    /\/node_modules\/@solana\/wallet-adapter-react-ui\//,
    // app-only
    /\/apps\/web\/src\/main\.tsx$/,
    /\/apps\/web\/src\/router\//,
    /\/apps\/web\/src\/providers\/Providers\.tsx$/,
    /\/apps\/web\/src\/providers\/solana-provider\.tsx$/,
    /\/apps\/web\/src\/providers\/embed-providers\.tsx$/,
    /\/apps\/web\/src\/pages\/embed\.tsx$/,
    /\/apps\/web\/src\/lib\/query-client\.ts$/,
    /\/apps\/web\/src\/lib\/solana\.ts$/,
    /\/apps\/web\/src\/env\.ts$/,
    /\/apps\/web\/src\/constants\/solana\/app-rpc\.ts$/,
    /\/apps\/web\/src\/stores\/flow-store-local\.ts$/,
    /\/apps\/web\/src\/embed\/is-embed\.ts$/,
    /\/apps\/web\/src\/embed\/legacy-redirect\.ts$/,
    /\/apps\/web\/src\/components\/ui\/error-boundary\.tsx$/,
    /\/apps\/web\/src\/.*page-loader\.tsx$/,
    /\/apps\/web\/src\/components\/header\//,
    /\/apps\/web\/src\/layouts\//,
    /\/apps\/web\/src\/hooks\/embed\/use-embed-theme\.ts$/,
    // replaced under S-N
    /\/node_modules\/sonner\//,
    /\/node_modules\/@radix-ui\/react-focus-guards\//,
    /\/node_modules\/@radix-ui\/react-select\//,
    /\/apps\/web\/src\/components\/ui\/select\.tsx$/,
  ]
  return allRendered.filter((id) => forbidden.some((re) => re.test(id))).map((id) => `bundled: ${id}`)
})

check(6, 'ESM entry: < 20 KB, one dynamic import of the runtime chunk, no apps/web/src module', () => {
  const problems = []
  const bytes = Buffer.byteLength(text[ENTRY])
  if (bytes >= 20_000) problems.push(`entry is ${bytes} bytes`)
  const imports = moduleImports(text[ENTRY])
  if (imports.dynamic.length !== 1 || imports.dynamic[0] !== './plgrnd-flow-runtime.js') {
    problems.push(`dynamic imports: ${JSON.stringify(imports.dynamic)}`)
  }
  if (imports.static.length > 0) problems.push(`static imports: ${JSON.stringify(imports.static)}`)
  const appModules = renderedIds(modulesOf('esm', 'plgrnd-flow.js')).filter((id) => id.includes('/apps/web/src/'))
  problems.push(...appModules.map((id) => `entry bundles ${id}`))
  return problems
})

check(7, 'dist/ssr/index.js imports nothing', () =>
  absent([SSR], [/\bimport\b/, /\brequire\s*\(/, /\bdocument\b/, /\bwindow\b/])
)

check(8, 'SHA256SUMS.txt and SRI.txt match; sdk copies equal the dist artifacts', () => {
  const problems = []
  const sums = read(`${SDK}/SHA256SUMS.txt`).trim().split('\n')
  const sri = read(`${SDK}/SRI.txt`).trim().split('\n')
  const digest = (algorithm, rel, encoding) =>
    crypto
      .createHash(algorithm)
      .update(fs.readFileSync(path.join(DIST, SDK, rel)))
      .digest(encoding)
  for (const line of sums) {
    const [hash, rel] = line.split(/\s+/)
    if (digest('sha256', rel, 'hex') !== hash) problems.push(`SHA256 mismatch: ${rel}`)
  }
  for (const line of sri) {
    const [hash, rel] = line.split(/\s+/)
    if (`sha384-${digest('sha384', rel, 'base64')}` !== hash) problems.push(`SRI mismatch: ${rel}`)
  }
  const listed = (lines) =>
    lines
      .map((line) => line.split(/\s+/)[1])
      .sort()
      .join()
  const expected = SDK_FILES.map((rel) => rel.slice(SDK.length + 1))
    .sort()
    .join()
  if (listed(sums) !== expected || listed(sri) !== expected)
    problems.push('integrity files do not list exactly the sdk downloads')
  const pairs = [
    [IIFE, SDK_FILES[0]],
    [ENTRY, SDK_FILES[1]],
    [RUNTIME, SDK_FILES[2]],
  ]
  for (const [a, b] of pairs) if (text[a] !== text[b]) problems.push(`${b} differs from ${a}`)
  return problems
})

check(9, 'no /logo asset path', () => absent(ARTIFACTS, [/\/logo(?:[\w.-]*\.(?:svg|png|ico|webp|jpe?g)|["'`])/]))

check(10, 'no .css file emitted', () =>
  walk(DIST)
    .filter((file) => file.endsWith('.css'))
    .map((file) => `emitted ${path.relative(DIST, file)}`)
)

check(11, 'THIRD_PARTY_LICENSES.txt covers every bundled package and ships with the downloads', () => {
  const licenses = read('THIRD_PARTY_LICENSES.txt')
  const problems = bundledPackages(path.join(DIST, 'module-list.json'))
    .map((root) => readManifest(root.dir))
    .filter((manifest) => !licenses.includes(`\n${manifest.name} ${manifest.version} (`))
    .map((manifest) => `missing ${manifest.name}@${manifest.version}`)
  const sdkCopy = path.join(DIST, SDK, 'THIRD_PARTY_LICENSES.txt')
  if (!fs.existsSync(sdkCopy) || fs.readFileSync(sdkCopy, 'utf8') !== licenses) {
    problems.push(`${SDK}/THIRD_PARTY_LICENSES.txt is missing or differs`)
  }
  return problems
})

check(12, 'the shell has no HTML-injection sinks', () =>
  absent([ENTRY, SHELL], ['innerHTML', 'outerHTML', 'insertAdjacentHTML', 'document.write', '.srcdoc'])
)

check(13, 'the runtime chunk does not import the entry', () => {
  const imports = moduleImports(text[RUNTIME])
  // The chunk is self-contained: any static import (the entry or anything else) is a failure.
  const problems = imports.static.map((source) => `static import of ${source}`)
  if (imports.dynamic.includes('./plgrnd-flow.js')) problems.push('dynamic import of the entry')
  return problems
})

check(14, 'M16: reportError guard first, once, ahead of every typeof reportError', () => {
  const problems = []
  for (const rel of RUNTIME_ARTIFACTS) {
    const code = text[rel]
    const guards = count(code, REPORT_ERROR_GUARD)
    if (guards !== 1) problems.push(`${rel}: guard x${guards}`)
    const first =
      rel === IIFE
        ? code.startsWith(`(function(){var f=function(){${REPORT_ERROR_GUARD}`)
        : code.startsWith(REPORT_ERROR_GUARD)
    if (!first)
      problems.push(`${rel}: the guard is not the first statement of the runtime ${rel === IIFE ? 'factory' : 'chunk'}`)
    const at = code.indexOf(REPORT_ERROR_GUARD)
    const typeofs = matchAll(code, /typeof reportError\b/).map((m) => m.index)
    if (typeofs.length === 0) problems.push(`${rel}: no typeof reportError (react-dom shape changed?)`)
    if (typeofs.some((index) => index < at)) problems.push(`${rel}: typeof reportError before the guard`)
    const globalUses = matchAll(code, /\b(?:globalThis|window|self)\.reportError\b/).length
    if (globalUses > 0) problems.push(`${rel}: global reportError x${globalUses}`)
  }
  const sources = [path.join(REPO_ROOT, 'apps/web/src'), path.join(PACKAGE_ROOT, 'src')]
    .flatMap(walk)
    .filter((file) => /\.(?:[cm]?[jt]sx?)$/.test(file))
  for (const file of sources) {
    if (/\b(?:var|let|const|function|class)\s+reportError\b/.test(fs.readFileSync(file, 'utf8'))) {
      problems.push(`source declares reportError: ${path.relative(REPO_ROOT, file)}`)
    }
  }
  return problems
})

check(15, 'global-access register matches build/global-access-register.json', () => {
  const stored = readRegister()
  const problems = compareRegister(scanRegister(DIST), stored)
  const accepted = Object.entries(stored.entries).filter(([, entry]) => entry.classification?.startsWith('accepted:'))
  // Not a failure: Checkpoint 4 re-opens G1 for these (plan, Decisions block).
  for (const [key, entry] of accepted) console.warn(`[verify] G1 must be re-opened for ${key}: ${entry.classification}`)
  return problems
})

check(16, '__PLGRND_RUNTIME__ once per runtime artifact, never in the entry', () => {
  const problems = []
  for (const rel of RUNTIME_ARTIFACTS) {
    const n = count(text[rel], '__PLGRND_RUNTIME__')
    if (n !== 1) problems.push(`${rel}: x${n}`)
  }
  if (count(text[ENTRY], '__PLGRND_RUNTIME__') !== 0) problems.push(`${ENTRY} contains the marker`)
  return problems
})

const transformSummary = []
check(17, 'transform match counts (M6, M18, M21; M5/M17 are S-R only)', () => {
  const problems = []
  for (const build of ['iife-runtime', 'esm']) {
    const records = buildReport.transforms[build] ?? []
    for (const mitigation of ['M6', 'M18', 'M21']) {
      const applied = records.filter((record) => record.mitigation === mitigation)
      if (applied.length !== 1) problems.push(`${build}: ${mitigation} applied ${applied.length} times`)
      for (const record of applied) transformSummary.push(`${build} ${mitigation} ${JSON.stringify(record.counts)}`)
    }
    const m18 = records.find((record) => record.mitigation === 'M18')?.counts
    const m21 = records.find((record) => record.mitigation === 'M21')?.counts
    if (m18 && (m18.escapeSites !== 1 || m18.exportSites !== 1))
      problems.push(`${build}: M18 sites ${JSON.stringify(m18)}`)
    if (m21 && Object.values(m21).some((n) => n !== 1)) problems.push(`${build}: M21 edits ${JSON.stringify(m21)}`)
  }
  return problems
})

check('M20', 'ResizeObserver guard once per runtime artifact, right after M16', () => {
  const problems = []
  for (const rel of RUNTIME_ARTIFACTS) {
    const n = count(text[rel], RESIZE_OBSERVER_GUARD)
    if (n !== 1) problems.push(`${rel}: x${n}`)
    if (!text[rel].includes(REPORT_ERROR_GUARD + RESIZE_OBSERVER_GUARD)) problems.push(`${rel}: not directly after M16`)
  }
  return problems
})

for (const result of results) {
  console.log(`${result.ok ? 'PASS' : 'FAIL'}  ${String(result.id).padStart(3)}  ${result.title}`)
  for (const problem of result.problems.slice(0, 20)) console.log(`        - ${problem}`)
}
console.log('\nTransform match counts:')
for (const line of transformSummary) console.log(`  ${line}`)
const failed = results.filter((result) => !result.ok)
console.log(
  `\n[verify] ${results.length - failed.length}/${results.length} checks passed (${path.relative(PACKAGE_ROOT, DIST) || DIST})`
)
process.exitCode = failed.length > 0 ? 1 : 0
