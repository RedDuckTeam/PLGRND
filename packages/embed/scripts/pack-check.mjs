// `yarn workspace @plgrnd/embed pack:check`: `npm pack --dry-run` must list exactly the planned files (plan 4.5),
// and every `exports` target must be among them. It never publishes: `npm publish` is a separate, manual release
// step behind the npm-ownership gate (AC-D6).
import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const EXPECTED = [
  'LICENSE',
  'README.md',
  'dist/THIRD_PARTY_LICENSES.txt',
  'dist/esm/plgrnd-flow-runtime.js',
  'dist/esm/plgrnd-flow.js',
  'dist/plgrnd-flow.iife.js',
  'dist/ssr/index.js',
  'package.json',
  'types/index.d.ts',
]

const [report] = JSON.parse(execSync('npm pack --dry-run --json', { cwd: PACKAGE_ROOT, encoding: 'utf8' }))
const files = report.files.map((file) => file.path.split(path.sep).join('/')).sort()
const problems = []
for (const file of EXPECTED) if (!files.includes(file)) problems.push(`missing from the tarball: ${file}`)
for (const file of files) if (!EXPECTED.includes(file)) problems.push(`unexpected in the tarball: ${file}`)

const manifest = JSON.parse(fs.readFileSync(path.join(PACKAGE_ROOT, 'package.json'), 'utf8'))
const targets = (value) => (typeof value === 'string' ? [value] : Object.values(value).flatMap(targets))
for (const target of [...targets(manifest.exports), manifest.types]) {
  if (!files.includes(target.replace(/^\.\//, ''))) problems.push(`export target not packed: ${target}`)
}
if (manifest.private !== false) problems.push('package.json must set "private": false')
if ('sideEffects' in manifest)
  problems.push('package.json must not declare sideEffects (the entry registers the element)')

for (const file of files) console.log(`  ${file}`)
console.log(
  `[pack:check] ${report.name}@${report.version}: ${files.length} files, ${(report.size / 1000).toFixed(1)} kB packed`
)
for (const problem of problems) console.error(`[pack:check] ${problem}`)
process.exitCode = problems.length > 0 ? 1 : 0
