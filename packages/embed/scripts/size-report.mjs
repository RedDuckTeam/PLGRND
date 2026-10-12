// `yarn workspace @plgrnd/embed size` (also run by `build`): raw, gzip -9 and brotli sizes of every artifact,
// written to dist/size-report.md. There is no hard budget (spec: "about 420 KB gzip"); the tripwire fires when
// the IIFE exceeds 500 kB gzip and lists the largest bundled modules from dist/module-list.json.
import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'
import { fileURLToPath, pathToFileURL } from 'node:url'

const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const TRIPWIRE_GZIP_BYTES = 500_000

const kb = (bytes) => `${(bytes / 1000).toFixed(1)} kB`

const sizes = (file) => {
  const data = fs.readFileSync(file)
  return {
    raw: data.length,
    gzip: zlib.gzipSync(data, { level: 9 }).length,
    brotli: zlib.brotliCompressSync(data, {
      params: { [zlib.constants.BROTLI_PARAM_QUALITY]: zlib.constants.BROTLI_MAX_QUALITY },
    }).length,
  }
}

const walk = (dir) =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name)
    return entry.isDirectory() ? walk(full) : [full]
  })

export function writeSizeReport({ dist = path.join(PACKAGE_ROOT, 'dist'), version }) {
  const published = [
    'plgrnd-flow.iife.js',
    'esm/plgrnd-flow.js',
    'esm/plgrnd-flow-runtime.js',
    'ssr/index.js',
    'THIRD_PARTY_LICENSES.txt',
  ]
  const sdkDir = path.join(dist, 'sdk', version)
  const sdk = fs.existsSync(sdkDir)
    ? walk(sdkDir)
        .map((file) => path.relative(dist, file).split(path.sep).join('/'))
        .sort()
    : []
  const rows = [...published, ...sdk].map((rel) => ({ rel, ...sizes(path.join(dist, rel)) }))

  const lines = [
    `# @plgrnd/embed ${version} — artifact sizes`,
    '',
    'Raw bytes, gzip level 9 and brotli quality 11. The `sdk/` files are the versioned downloads.',
    '',
    '| File | Raw | gzip -9 | brotli |',
    '|---|---:|---:|---:|',
    ...rows.map((r) => `| \`${r.rel}\` | ${kb(r.raw)} | ${kb(r.gzip)} | ${kb(r.brotli)} |`),
    '',
  ]

  const iife = rows.find((r) => r.rel === 'plgrnd-flow.iife.js')
  const tripped = iife.gzip > TRIPWIRE_GZIP_BYTES
  lines.push(
    `IIFE gzip: ${kb(iife.gzip)} (tripwire ${kb(TRIPWIRE_GZIP_BYTES)}: ${tripped ? '**exceeded**' : 'not exceeded'}).`,
    ''
  )
  if (tripped) {
    const list = JSON.parse(fs.readFileSync(path.join(dist, 'module-list.json'), 'utf8'))
    const modules = Object.values(list.builds['iife-runtime'].chunks)
      .flat()
      .sort((a, b) => b.renderedLength - a.renderedLength)
      .slice(0, 30)
    lines.push(
      '## Tripwire: largest modules in the IIFE runtime',
      '',
      '| Module | Rendered |',
      '|---|---:|',
      ...modules.map((m) => `| \`${m.id.replace(/^.*\/node_modules\//, '')}\` | ${kb(m.renderedLength)} |`),
      ''
    )
  }

  fs.writeFileSync(path.join(dist, 'size-report.md'), lines.join('\n'))
  return { rows, tripped }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const { version } = JSON.parse(fs.readFileSync(path.join(PACKAGE_ROOT, 'package.json'), 'utf8'))
  const { rows, tripped } = writeSizeReport({ version })
  for (const r of rows) console.log(`${r.rel.padEnd(52)} ${kb(r.raw).padStart(10)} ${kb(r.gzip).padStart(10)} gz`)
  if (tripped) console.warn('[size-report] the IIFE exceeds the 500 kB gzip tripwire; see dist/size-report.md')
}
