// `yarn workspace @plgrnd/embed build`:
//   1. the three Vite builds of vite.build.config.ts (iife-runtime, iife-shell, esm);
//   2. scripts/assemble-iife.mjs: dist/plgrnd-flow.iife.js and dist/sdk/<v>/plgrnd-flow-<v>.js;
//   3. dist/ssr/index.js, dist/module-list.json and dist/build-report.json (M6/M18/M21 match counts);
//   4. the versioned ESM folder dist/sdk/<v>/plgrnd-flow-<v>/, plus SHA256SUMS.txt and SRI.txt (sha384);
//   5. dist/THIRD_PARTY_LICENSES.txt and dist/size-report.md.
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'vite'
import { transform } from 'esbuild'
import { assembleIife } from './assemble-iife.mjs'
import { writeSizeReport } from './size-report.mjs'
import { writeThirdPartyLicenses } from './third-party-licenses.mjs'

const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DIST = path.join(PACKAGE_ROOT, 'dist')
const MODES = ['iife-runtime', 'iife-shell', 'esm']
const ESM_FILES = ['plgrnd-flow.js', 'plgrnd-flow-runtime.js']
const { version } = JSON.parse(fs.readFileSync(path.join(PACKAGE_ROOT, 'package.json'), 'utf8'))

const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'))
const writeJson = (file, data) => fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`)

fs.rmSync(DIST, { recursive: true, force: true })
for (const mode of MODES) {
  console.log(`[build] vite build --mode ${mode}`)
  await build({ configFile: path.join(PACKAGE_ROOT, 'vite.build.config.ts'), mode })
}

const iife = assembleIife({ dist: DIST, version })

// The `node` export condition: registers nothing and imports nothing.
const ssr = await transform(fs.readFileSync(path.join(PACKAGE_ROOT, 'src/ssr.ts'), 'utf8'), {
  loader: 'ts',
  format: 'esm',
  legalComments: 'none',
})
fs.mkdirSync(path.join(DIST, 'ssr'), { recursive: true })
// esbuild drops a bare `export {}`; keep the file an explicit, empty ES module.
fs.writeFileSync(path.join(DIST, 'ssr/index.js'), /\bexport\b/.test(ssr.code) ? ssr.code : `${ssr.code}export {};\n`)

writeJson(path.join(DIST, 'module-list.json'), {
  version,
  builds: Object.fromEntries(
    MODES.map((mode) => [mode, readJson(path.join(DIST, '.build', mode, 'module-list.json'))])
  ),
})
writeJson(path.join(DIST, 'build-report.json'), {
  version,
  transforms: Object.fromEntries(
    ['iife-runtime', 'esm'].map((mode) => [mode, readJson(path.join(DIST, '.build', mode, 'transforms.json'))])
  ),
})

const esmFiles = fs.readdirSync(path.join(DIST, 'esm')).sort()
if (esmFiles.join() !== [...ESM_FILES].sort().join()) {
  throw new Error(`[build] dist/esm must hold exactly ${ESM_FILES.join(' and ')}, found ${esmFiles.join(', ')}`)
}
const sdkDir = path.join(DIST, 'sdk', version)
const esmVersioned = path.join(sdkDir, `plgrnd-flow-${version}`)
fs.mkdirSync(esmVersioned, { recursive: true })
for (const file of ESM_FILES) fs.copyFileSync(path.join(DIST, 'esm', file), path.join(esmVersioned, file))

// Integrators verify downloads against these (the SPA fallback answers a mistyped /sdk path with HTML).
const downloads = [`plgrnd-flow-${version}.js`, ...ESM_FILES.map((file) => `plgrnd-flow-${version}/${file}`)]
const digest = (algorithm, file, encoding) =>
  crypto
    .createHash(algorithm)
    .update(fs.readFileSync(path.join(sdkDir, file)))
    .digest(encoding)
fs.writeFileSync(
  path.join(sdkDir, 'SHA256SUMS.txt'),
  downloads.map((file) => `${digest('sha256', file, 'hex')}  ${file}\n`).join('')
)
fs.writeFileSync(
  path.join(sdkDir, 'SRI.txt'),
  downloads.map((file) => `sha384-${digest('sha384', file, 'base64')}  ${file}\n`).join('')
)

const licensed = writeThirdPartyLicenses({ dist: DIST, version })
// The downloads carry the notices too (legalComments are stripped from the bundles).
fs.copyFileSync(path.join(DIST, 'THIRD_PARTY_LICENSES.txt'), path.join(sdkDir, 'THIRD_PARTY_LICENSES.txt'))
const { rows, tripped } = writeSizeReport({ dist: DIST, version })

const gzip = (rel) => rows.find((row) => row.rel === rel)?.gzip ?? 0
console.log(
  `[build] @plgrnd/embed ${version}: IIFE ${(iife.bytes / 1000).toFixed(1)} kB (${(gzip('plgrnd-flow.iife.js') / 1000).toFixed(1)} kB gzip), ` +
    `ESM entry ${(gzip('esm/plgrnd-flow.js') / 1000).toFixed(1)} kB gzip + runtime ${(gzip('esm/plgrnd-flow-runtime.js') / 1000).toFixed(1)} kB gzip, ` +
    `${licensed.length} third-party packages`
)
if (tripped) console.warn('[build] the IIFE exceeds the 500 kB gzip tripwire; see dist/size-report.md')
