// Dependency-free fixture server: fixtures/ at /, dist/ at /dist/ (http://localhost:4180 by default).
// HTML fixtures go through scripts/fixture-html.mjs (flow payloads, ?widgets=, ?host=tw4); in addition,
// ?csp=<variant> adds a Content-Security-Policy response header (strict-dynamic | tt | no-unsafe-inline-style).
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { FIXTURES, renderFixtureHtml } from './fixture-html.mjs'

const DIST = path.resolve(FIXTURES, '../dist')
const PORT = Number(process.env.PORT ?? 4180)
const HOST = process.env.HOST ?? 'localhost'

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
}

const CSP_VARIANTS = {
  'strict-dynamic': (nonce) => `script-src 'nonce-${nonce}' 'strict-dynamic'; object-src 'none'; base-uri 'none'`,
  tt: () => "require-trusted-types-for 'script'",
  'no-unsafe-inline-style': () => "style-src 'self'",
}

// Resolve a URL path inside base; null when it escapes base (traversal) or is malformed.
function resolveInside(base, urlPath) {
  let decoded
  try {
    decoded = decodeURIComponent(urlPath)
  } catch {
    return null
  }
  if (decoded.includes('\0')) return null
  const resolved = path.resolve(base, `.${path.posix.normalize(`/${decoded}`)}`)
  const relative = path.relative(base, resolved)
  if (relative.startsWith('..') || path.isAbsolute(relative)) return null
  if (decoded.split(/[\\/]/).includes('..')) return null
  return resolved
}

function send(res, status, body, headers = {}) {
  res.writeHead(status, { 'Cache-Control': 'no-store', 'Content-Type': 'text/plain; charset=utf-8', ...headers })
  res.end(body)
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? `${HOST}:${PORT}`}`)
  if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'Method Not Allowed')

  // Reject traversal attempts before any normalisation done by URL parsing hides them.
  const rawPath = (req.url ?? '/').split('?')[0]
  if (/(^|[\\/])\.\.([\\/]|$)/.test(rawPath) || /%2e%2e|%5c/i.test(rawPath)) return send(res, 400, 'Bad Request')

  const isDist = url.pathname === '/dist' || url.pathname.startsWith('/dist/')
  const base = isDist ? DIST : FIXTURES
  let rel = isDist ? url.pathname.slice('/dist'.length) : url.pathname
  if (rel === '' || rel.endsWith('/')) rel += 'index.html'

  const file = resolveInside(base, rel)
  if (!file) return send(res, 403, 'Forbidden')
  let stat
  try {
    stat = fs.statSync(file)
  } catch {
    return send(res, 404, 'Not Found')
  }
  if (!stat.isFile()) return send(res, 404, 'Not Found')

  const ext = path.extname(file).toLowerCase()
  const headers = { 'Content-Type': MIME[ext] ?? 'application/octet-stream' }
  const variant = url.searchParams.get('csp')
  let nonce = null
  if (ext === '.html' && variant && CSP_VARIANTS[variant]) {
    nonce = variant === 'strict-dynamic' ? crypto.randomBytes(12).toString('base64') : null
    headers['Content-Security-Policy'] = CSP_VARIANTS[variant](nonce)
  }

  try {
    const body =
      ext === '.html' && !isDist
        ? renderFixtureHtml(fs.readFileSync(file, 'utf8'), url, { nonce })
        : fs.readFileSync(file)
    send(res, 200, req.method === 'HEAD' ? '' : body, headers)
  } catch (err) {
    send(res, 500, String(err?.message ?? err))
  }
})

server.listen(PORT, HOST, () => {
  console.log(
    `fixtures: http://${HOST}:${PORT}/  (fixtures ${path.relative(process.cwd(), FIXTURES)}, dist ${path.relative(process.cwd(), DIST)})`
  )
})
