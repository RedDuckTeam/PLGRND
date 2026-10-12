// `yarn workspace @plgrnd/embed dev`: the fixtures on a Vite dev server, with the element loaded from source
// (src/entry.esm.ts) through the same shadowCompat() plugin set as the production builds. shadowCompat()
// excludes the patched/aliased Radix packages from dependency pre-bundling, so dev runs the same copies (R51).
import fs from 'node:fs'
import path from 'node:path'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { APP_SRC, PACKAGE_ROOT, shadowCompat } from './build/shadow-compat'
import { FIXTURES, renderFixtureHtml } from './scripts/fixture-html.mjs'

const pkg = JSON.parse(fs.readFileSync(path.join(PACKAGE_ROOT, 'package.json'), 'utf8')) as { version: string }

// Serves fixtures/ at / and swaps the built IIFE for the source ESM entry.
function fixturesDev(): Plugin {
  return {
    name: 'plgrnd:fixtures-dev',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url ?? '/', 'http://localhost')
        const page = url.pathname === '/' ? '/index.html' : url.pathname
        if (page.endsWith('.html')) {
          const file = path.join(FIXTURES, page)
          if (!file.startsWith(FIXTURES) || !fs.existsSync(file)) return next()
          let html = renderFixtureHtml(fs.readFileSync(file, 'utf8'), url)
          html = html.replace(
            /<script src="\/dist\/plgrnd-flow\.iife\.js"><\/script>/g,
            '<script type="module" src="/src/entry.esm.ts"></script>'
          )
          html = await server.transformIndexHtml(page, html)
          res.setHeader('Content-Type', 'text/html; charset=utf-8')
          res.setHeader('Cache-Control', 'no-store')
          res.end(html)
          return
        }
        if (/^\/(assets|vendor)\/|^\/flows\.json$/.test(url.pathname)) req.url = `/fixtures${req.url}`
        next()
      })
    },
  }
}

export default defineConfig({
  root: PACKAGE_ROOT,
  publicDir: false,
  // No .env file can reach the widget (the app's Helius key lives in apps/web/.env).
  envDir: path.join(PACKAGE_ROOT, '.no-env'),
  envPrefix: 'PLGRND_EMBED_',
  plugins: [react(), tailwindcss(), ...shadowCompat(), fixturesDev()],
  resolve: {
    // `buffer` is the npm package, never Node's builtin (which Vite externalizes in the browser).
    alias: [
      { find: /^buffer$/, replacement: 'buffer/' },
      { find: '@', replacement: APP_SRC },
    ],
    dedupe: ['react', 'react-dom'],
  },
  define: {
    __PLGRND_EMBED_VERSION__: JSON.stringify(`${pkg.version}-dev`),
    global: 'globalThis',
  },
  optimizeDeps: {
    // The fixtures load the element through fixturesDev(), which the dependency scanner cannot see; crawling the
    // source entries up front avoids a mid-load re-optimization (504 "Outdated Optimize Dep") on a cold start.
    entries: ['src/entry.esm.ts', 'src/runtime/runtime.tsx'],
    esbuildOptions: {
      define: { global: 'globalThis' },
      inject: [path.join(PACKAGE_ROOT, 'build/buffer-global.js')],
    },
  },
  server: {
    port: 4190,
    strictPort: true,
    fs: { allow: [PACKAGE_ROOT, APP_SRC, path.resolve(PACKAGE_ROOT, '../../node_modules')] },
  },
})
