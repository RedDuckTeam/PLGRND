import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv, type Rollup } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import { bundleBudget } from './scripts/bundle-budget'

import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const EMBED_ROOT = path.resolve(__dirname, '../../packages/embed')
const readJson = (file: string) => JSON.parse(fs.readFileSync(file, 'utf8'))
const embedVersion: string = readJson(path.join(EMBED_ROOT, 'package.json')).version
const embedReleased = fs.existsSync(path.resolve(__dirname, 'public/sdk', embedVersion))
const embedNpmPublished = (readJson(path.join(EMBED_ROOT, 'release-state.json')).npmPublished as string[]).includes(
  embedVersion
)

const isCodama = (id: string) => {
  const file = id.replace(/\\/g, '/')
  return file.includes('/node_modules/@codama/') || file.includes('/src/utils/idl/model/')
}

// True when `id` belongs to the group or is imported only by modules that do (transitively).
const onlyUsedBy = (
  id: string,
  inGroup: (id: string) => boolean,
  getModuleInfo: Rollup.GetModuleInfo,
  seen = new Set<string>()
): boolean => {
  if (inGroup(id) || seen.has(id)) return true
  seen.add(id)
  const info = getModuleInfo(id)
  const importers = [...(info?.importers ?? []), ...(info?.dynamicImporters ?? [])]
  return importers.length > 0 && importers.every((importer) => onlyUsedBy(importer, inGroup, getModuleInfo, seen))
}

const releaseCheck = {
  name: 'plgrnd:release-check',
  apply: 'build' as const,
  buildStart() {
    execFileSync(process.execPath, [path.join(EMBED_ROOT, 'scripts/release-check.mjs')], { stdio: 'inherit' })
  },
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    build: {
      sourcemap: env.NODE_ENV === 'production',
      rollupOptions: {
        output: {
          // Named lazy chunks, measured by bundle-budget.json. Nothing on the editor's initial path may import them.
          // Explicit membership only: by default Rollup also pulls a manual chunk's dependencies in, including modules
          // the initial path shares with it (buffer, utils/idl/format), which would make that path load the chunk.
          onlyExplicitManualChunks: true,
          manualChunks(id, { getModuleInfo }) {
            const file = id.replace(/\\/g, '/')
            if (file.includes('/src/constants/programs/native/')) return `idl-native-${path.basename(file, '.json')}`
            if (file.includes('/src/utils/tx-import/')) return 'tx-import'
            // Codama, the IDL model, and the libraries only they use (their @solana/codecs copy, json-stable-stringify).
            if (onlyUsedBy(id, isCodama, getModuleInfo)) return 'codama'
          },
        },
      },
    },
    plugins: [react(), tailwindcss(), releaseCheck, bundleBudget(path.resolve(__dirname, 'bundle-budget.json'))],
    define: {
      global: 'window',
      process: { env: 'import.meta.env', browser: true },
      __PLGRND_EMBED_VERSION__: JSON.stringify(embedVersion),
      __PLGRND_EMBED_RELEASED__: JSON.stringify(embedReleased),
      __PLGRND_EMBED_NPM_PUBLISHED__: JSON.stringify(embedNpmPublished),
    },

    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
        buffer: 'buffer',
      },
    },
  }
})
