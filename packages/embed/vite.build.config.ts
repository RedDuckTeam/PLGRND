// Production builds, one per `--mode` (scripts/build.mjs runs them in this order):
//   iife-runtime  src/runtime/runtime.tsx -> dist/.build/iife-runtime/out/runtime.iife.js (dynamic imports inlined)
//   iife-shell    src/entry.iife.ts       -> dist/.build/iife-shell/out/shell.iife.js
//   esm           src/entry.esm.ts        -> dist/esm/plgrnd-flow.js + exactly one dist/esm/plgrnd-flow-runtime.js
// scripts/assemble-iife.mjs then wraps the two IIFEs into dist/plgrnd-flow.iife.js. Build metadata (module lists,
// transform counts) goes to dist/.build/<mode>/, never into a published folder.
import fs from 'node:fs'
import path from 'node:path'
import { defineConfig, normalizePath, type Plugin, type UserConfig } from 'vite'
import type { OutputChunk } from 'rollup'
import { transform } from 'esbuild'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import inject from '@rollup/plugin-inject'
import { APP_SRC, PACKAGE_ROOT, shadowCompat, type TransformRecord } from './build/shadow-compat'
import { moduleList } from './build/module-list'
import { RUNTIME_GUARDS } from './build/guards'

export const BUILD_MODES = ['iife-runtime', 'iife-shell', 'esm'] as const
type BuildMode = (typeof BUILD_MODES)[number]

/** The single lazily loaded chunk of the ESM build. */
export const RUNTIME_CHUNK = 'plgrnd-flow-runtime'

const pkg = JSON.parse(fs.readFileSync(path.join(PACKAGE_ROOT, 'package.json'), 'utf8')) as { version: string }
const DIST = path.join(PACKAGE_ROOT, 'dist')
const SRC = normalizePath(path.join(PACKAGE_ROOT, 'src'))
const metaDir = (mode: BuildMode) => path.join(DIST, '.build', mode)

// The shell is the element, the entries and the version; every other module of the ESM graph is runtime.
const isShellModule = (id: string) => {
  const file = normalizePath(id.split('?')[0])
  return file.startsWith(`${SRC}/`) && !file.startsWith(`${SRC}/runtime/`) && !file.startsWith(`${SRC}/shims/`)
}

/** Records the M6/M18/M21 match counts of this build in dist/.build/<mode>/transforms.json. */
function transformReport(mode: BuildMode): { plugin: Plugin; onTransform: (record: TransformRecord) => void } {
  const records: TransformRecord[] = []
  return {
    onTransform: (record) => records.push(record),
    plugin: {
      name: 'plgrnd:transform-report',
      generateBundle() {
        fs.mkdirSync(metaDir(mode), { recursive: true })
        fs.writeFileSync(path.join(metaDir(mode), 'transforms.json'), `${JSON.stringify(records, null, 2)}\n`)
      },
    },
  }
}

/**
 * Finishes the ESM chunks after Vite's minification (generateBundle runs after renderChunk):
 * - whitespace is minified too. Vite keeps it in `es` library builds for consumers' tree-shaking, but these files
 *   also ship as static downloads, and the runtime chunk is loaded whole;
 * - M16 + M20 become the first statements of the runtime chunk, so its free `reportError` / `ResizeObserver`
 *   resolve to them lexically.
 */
function esmChunks(): Plugin {
  return {
    name: 'plgrnd:esm-chunks',
    async generateBundle(_, bundle) {
      const chunks = Object.values(bundle).filter((output): output is OutputChunk => output.type === 'chunk')
      const runtime = chunks.filter((chunk) => !chunk.isEntry)
      if (runtime.length !== 1 || runtime[0].fileName !== `${RUNTIME_CHUNK}.js`) {
        const names = runtime.map((chunk) => chunk.fileName).join(', ') || 'none'
        throw new Error(`[esm-chunks] expected exactly one runtime chunk ${RUNTIME_CHUNK}.js, got ${names}`)
      }
      for (const chunk of chunks) {
        chunk.code = (await transform(chunk.code, { minify: true, format: 'esm', legalComments: 'none' })).code
      }
      runtime[0].code = RUNTIME_GUARDS + runtime[0].code
    },
  }
}

// Free `Buffer` in bip39 and friends binds to the bundled npm package, module-scoped (never a host global).
const bufferInject = () => inject({ Buffer: ['buffer', 'Buffer'] })

/** `--mode fixtures` (run by the `fixtures` script): the React 19 host page, fixtures/react19 -> fixtures/.build/react19. */
const fixturesConfig = (): UserConfig => ({
  root: path.join(PACKAGE_ROOT, 'fixtures/react19'),
  base: './',
  publicDir: false,
  envDir: path.join(PACKAGE_ROOT, '.no-env'),
  envPrefix: 'PLGRND_EMBED_',
  logLevel: 'error',
  plugins: [react()],
  resolve: { dedupe: ['react', 'react-dom'] },
  build: { outDir: path.join(PACKAGE_ROOT, 'fixtures/.build/react19'), emptyOutDir: true, sourcemap: false },
})

export default defineConfig(({ mode }): UserConfig => {
  if (mode === 'fixtures') return fixturesConfig()
  if (!(BUILD_MODES as readonly string[]).includes(mode)) {
    throw new Error(`vite.build.config.ts: --mode must be one of ${BUILD_MODES.join(', ')} or fixtures (got ${mode})`)
  }
  const buildMode = mode as BuildMode
  const report = transformReport(buildMode)
  const runtimePlugins = [react(), tailwindcss(), ...shadowCompat({ onTransform: report.onTransform }), report.plugin]

  const shared: UserConfig = {
    root: PACKAGE_ROOT,
    publicDir: false,
    // No .env file can reach the artifacts (the app's Helius key lives in apps/web/.env).
    envDir: path.join(PACKAGE_ROOT, '.no-env'),
    envPrefix: 'PLGRND_EMBED_',
    logLevel: 'warn',
    resolve: {
      // `buffer` is the npm package, never Node's builtin.
      alias: [
        { find: /^buffer$/, replacement: 'buffer/' },
        { find: '@', replacement: APP_SRC },
      ],
      dedupe: ['react', 'react-dom'],
    },
    define: {
      'process.env.NODE_ENV': JSON.stringify('production'),
      'process.env': '{}',
      'process.browser': 'true',
      global: 'globalThis',
      __PLGRND_EMBED_VERSION__: JSON.stringify(pkg.version),
    },
    // Licences ship as dist/THIRD_PARTY_LICENSES.txt.
    esbuild: { legalComments: 'none' },
  }
  const build = { sourcemap: false, emptyOutDir: true, reportCompressedSize: false } as const

  if (buildMode === 'iife-runtime') {
    return {
      ...shared,
      plugins: [...runtimePlugins, moduleList(path.join(metaDir(buildMode), 'module-list.json'))],
      build: {
        ...build,
        outDir: path.join(DIST, '.build/iife-runtime/out'),
        lib: {
          entry: path.join(PACKAGE_ROOT, 'src/runtime/runtime.tsx'),
          formats: ['iife'],
          name: '__rt',
          fileName: () => 'runtime.iife.js',
        },
        rollupOptions: { plugins: [bufferInject()], output: { inlineDynamicImports: true } },
      },
    }
  }

  if (buildMode === 'iife-shell') {
    return {
      ...shared,
      plugins: [moduleList(path.join(metaDir(buildMode), 'module-list.json'))],
      build: {
        ...build,
        outDir: path.join(DIST, '.build/iife-shell/out'),
        lib: {
          entry: path.join(PACKAGE_ROOT, 'src/entry.iife.ts'),
          formats: ['iife'],
          name: '__plgrndShell',
          fileName: () => 'shell.iife.js',
        },
      },
    }
  }

  return {
    ...shared,
    plugins: [...runtimePlugins, moduleList(path.join(metaDir(buildMode), 'module-list.json')), esmChunks()],
    build: {
      ...build,
      outDir: path.join(DIST, 'esm'),
      lib: {
        entry: path.join(PACKAGE_ROOT, 'src/entry.esm.ts'),
        formats: ['es'],
        fileName: () => 'plgrnd-flow.js',
      },
      rollupOptions: {
        plugins: [bufferInject()],
        onwarn(warning, handler) {
          // Expected (K23): spl-token and the IDL model (lazy in the app, static in the tx importer) are imported both
          // statically and dynamically, and manualChunks keeps all of them in the runtime chunk anyway.
          if (warning.message.includes('dynamic import will not move')) return
          handler(warning)
        },
        output: {
          chunkFileNames: '[name].js',
          // Every runtime-graph module, including the dynamically imported @solana/spl-token (K23), goes to the
          // one runtime chunk; the entry keeps only the shell.
          manualChunks: (id) => (isShellModule(id) ? undefined : RUNTIME_CHUNK),
        },
      },
    },
  }
})
