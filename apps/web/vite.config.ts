import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import tailwindcss from '@tailwindcss/vite'

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
    },
    plugins: [react(), tailwindcss(), releaseCheck],
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
