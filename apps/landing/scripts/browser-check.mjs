import { existsSync, mkdirSync, readFileSync, statSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

import { ANCHOR_PDA_SEEDS_FLOW, BLUESHIFT_PDA_FLOW } from '../app/lib/flows.ts'
import { GUIDES } from '../app/lib/guide/index.ts'
import { OPEN_IN_URL } from '../app/lib/guide/open-in-plgrnd.ts'

const LANDING = fileURLToPath(new URL('../', import.meta.url))
const OUT = path.join(LANDING, 'out')
const SHOTS = path.join(LANDING, '.verify')
const READY_TIMEOUT = 30_000
const UPSTREAM =
  'plgrnd.io/embed did not signal ready (upstream, R18: rerun once `curl -sI https://plgrnd.io/embed` is 200)'
const HOSTED_PAGES = new Set(['/integrate/iframe', '/integrate/react-wrapper'])
const HOSTED_HOSTS = ['plgrnd.io', 'fonts.googleapis.com', 'fonts.gstatic.com', 'static.cloudflareinsights.com']
const RPC_HOST_RE =
  /(^|\.)(solana\.com|helius-rpc\.com|helius\.xyz|quiknode\.pro|alchemy\.com|rpcpool\.com|ankr\.com)$|rpc/i
const GOLDEN = [
  '8sL1VL19Ys3cSa5HZ3fM3DK3CtfwouG8bJCB9Vet6Bhz',
  '653KiEKxxy8wBDSt8mVBT11gAGXV97mGST6EZqr3JsAX',
  'F4wqZFfdioESkn43AS9sxoseX18QFugoeVojjii3xHyv',
  '253',
  '255',
  '251',
]
const PAGES = [
  '/',
  '/integrate',
  '/integrate/iframe',
  '/integrate/self-hosted',
  '/integrate/react-wrapper',
  '/integrate/open-in-plgrnd',
  '/integrate/native-port',
]
const READY_PAGES = new Set(['/', '/integrate/iframe', '/integrate/self-hosted', '/integrate/react-wrapper'])
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.map': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
}

const results = []
function record(label, problems, note) {
  results.push({ status: problems.length ? 'FAIL' : 'PASS', label, problems, note })
}
const short = (value, max = 90) => (value.length > max ? `${value.slice(0, max)}… (${value.length} chars)` : value)
function firstDiff(actual, expected) {
  let i = 0
  while (i < actual.length && i < expected.length && actual[i] === expected[i]) i++
  const around = (s) => JSON.stringify(s.slice(Math.max(0, i - 30), i + 50))
  return `first difference at char ${i}: got ${around(actual)}, expected ${around(expected)}`
}

function resolveFile(pathname) {
  const clean = decodeURIComponent(pathname).replace(/\/+$/, '')
  const candidates = clean === '' ? ['index.html'] : [clean, `${clean}.html`, `${clean}/index.html`]
  for (const candidate of candidates) {
    const full = path.join(OUT, candidate)
    if (full.startsWith(OUT + path.sep) && existsSync(full) && statSync(full).isFile()) return full
  }
  return null
}

const server = createServer(async (req, res) => {
  const file = resolveFile(new URL(req.url ?? '/', 'http://localhost').pathname)
  const target = file ?? path.join(OUT, '404.html')
  res.writeHead(file ? 200 : 404, { 'content-type': TYPES[path.extname(target)] ?? 'application/octet-stream' })
  res.end(await readFile(target))
})

async function openPage(browser, origin, viewport = { width: 1440, height: 900 }) {
  const context = await browser.newContext({ viewport, reducedMotion: 'reduce' })
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin })
  const requests = []
  context.on('request', (r) => {
    let frame = ''
    try {
      frame = r.frame().url()
    } catch {
      frame = '(worker)'
    }
    requests.push({ url: r.url(), method: r.method(), body: r.postData() ?? '', frame })
  })
  const page = await context.newPage()
  page.on('websocket', (ws) => requests.push({ url: ws.url(), method: 'WS', body: '', frame: '' }))
  return { context, page, requests }
}

async function checkReady(page, route) {
  const previews = page.locator('[data-plgrnd-ready]')
  const count = await previews.count()
  if (!count) return ['no [data-plgrnd-ready] preview on the page']
  const problems = []
  for (let i = 0; i < count; i++) {
    const preview = previews.nth(i)
    await preview.evaluate((el) => el.scrollIntoView({ block: 'center' }))
    try {
      await preview.and(page.locator('[data-plgrnd-ready="true"]')).waitFor({ timeout: READY_TIMEOUT })
    } catch {
      const state = await preview.getAttribute('data-plgrnd-ready')
      problems.push(
        HOSTED_PAGES.has(route)
          ? `preview ${i + 1}/${count}: ${UPSTREAM}`
          : `preview ${i + 1}/${count}: data-plgrnd-ready="${state}" after ${READY_TIMEOUT / 1000} s`
      )
    }
  }
  return problems
}

async function checkGolden(page) {
  try {
    await page.waitForFunction((values) => values.every((v) => document.body.innerText.includes(v)), GOLDEN, {
      timeout: READY_TIMEOUT,
    })
    return []
  } catch {
    const text = await page.evaluate(() => document.body.innerText)
    return GOLDEN.filter((v) => !text.includes(v)).map((v) => `page text lacks ${v}`)
  }
}

async function checkOpenIn(page) {
  const buttons = page.locator('a[target="_blank"]').filter({ hasText: /^\s*Open in PLGRND\s*$/ })
  const count = await buttons.count()
  if (!count) return ['no <a target="_blank">Open in PLGRND</a> preview button']
  const problems = []
  for (let i = 0; i < count; i++) {
    const href = (await buttons.nth(i).getAttribute('href')) ?? ''
    const rel = (await buttons.nth(i).getAttribute('rel')) ?? ''
    if (href !== OPEN_IN_URL) problems.push(`button ${i + 1}: href != OPEN_IN_URL; ${firstDiff(href, OPEN_IN_URL)}`)
    if (!/\bnoopener\b/.test(rel) || !/\bnoreferrer\b/.test(rel)) problems.push(`button ${i + 1}: rel="${rel}"`)
  }
  return problems
}

async function checkClipboard(page, slug) {
  const tabs = GUIDES[slug].tabs
  const problems = []
  const tabCount = await page.locator('[role="tab"]').count()
  const buttonCount = await page.locator('[data-copy-button]').count()
  if (tabCount !== tabs.length || buttonCount !== tabs.length) {
    problems.push(`${tabCount} tabs / ${buttonCount} copy buttons rendered, guide data has ${tabs.length} tabs`)
  }
  for (const tab of tabs) {
    const expected = 'code' in tab ? tab.code : readFileSync(path.join(LANDING, tab.file), 'utf8')
    try {
      await page.locator(`[role="tab"][id$="-tab-${tab.id}"]`).click()
      await page.evaluate(() => navigator.clipboard.writeText(''))
      const button = page.locator(`[data-copy-button="${tab.id}"]`)
      await button.click()
      await button.filter({ hasText: /Copied|Copy failed/ }).waitFor({ timeout: 5000 })
      const copied = await page.evaluate(() => navigator.clipboard.readText())
      if (copied !== expected) problems.push(`${tab.id}: clipboard != tab code; ${firstDiff(copied, expected)}`)
      for (const [name, payload] of [
        ['ANCHOR_PDA_SEEDS_FLOW', ANCHOR_PDA_SEEDS_FLOW],
        ['BLUESHIFT_PDA_FLOW', BLUESHIFT_PDA_FLOW],
      ]) {
        if (expected.includes(payload) && !copied.includes(payload)) problems.push(`${tab.id}: clipboard lacks ${name}`)
      }
    } catch (error) {
      problems.push(`${tab.id}: ${error.message.split('\n')[0]}`)
    }
  }
  return problems
}

function checkHosts(requests, route, origin) {
  const problems = []
  const hosts = new Set()
  for (const { url, method, body, frame } of requests) {
    let parsed
    try {
      parsed = new URL(url)
    } catch {
      continue
    }
    if (!['http:', 'https:', 'ws:', 'wss:'].includes(parsed.protocol)) continue
    if (method === 'POST' && body.includes('"jsonrpc"')) problems.push(`JSON-RPC POST to ${short(url)}`)
    if (parsed.origin === origin) continue
    hosts.add(parsed.hostname)
    if (RPC_HOST_RE.test(parsed.hostname)) problems.push(`Solana RPC host ${parsed.hostname}`)
    else if (!(HOSTED_PAGES.has(route) && HOSTED_HOSTS.includes(parsed.hostname))) {
      const from = frame && !frame.startsWith(origin) ? ` (from frame ${frame.split(/[?#]/)[0]})` : ''
      problems.push(`request to ${parsed.hostname}${from}: ${short(url)}`)
    }
  }
  return { problems, note: `external hosts: ${[...hosts].join(', ') || 'none'}` }
}

if (!existsSync(path.join(OUT, 'index.html'))) {
  console.error('FAIL apps/landing/out/index.html is missing: run `yarn landing:build` first')
  process.exit(1)
}
mkdirSync(SHOTS, { recursive: true })
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
const origin = `http://127.0.0.1:${server.address().port}`
const browser = await chromium.launch()
const shots = []

try {
  {
    const { context, page } = await openPage(browser, origin, { width: 375, height: 812 })
    await page.goto(`${origin}/`, { waitUntil: 'load' })
    await page.waitForTimeout(1500)
    await page.screenshot({ path: path.join(SHOTS, 'home-hero-375.png') })
    shots.push('home-hero-375.png')
    await context.close()
  }

  for (const route of PAGES) {
    const { context, page, requests } = await openPage(browser, origin)
    const slug = route.startsWith('/integrate/') ? route.slice('/integrate/'.length) : null
    try {
      const response = await page.goto(`${origin}${route}`, { waitUntil: 'load', timeout: 60_000 })
      if (response?.status() !== 200) {
        record(`load ${route}`, [`HTTP ${response?.status()}`])
        continue
      }
      if (route === '/') {
        await page.waitForTimeout(1500)
        await page.screenshot({ path: path.join(SHOTS, 'home-hero-1440.png') })
        shots.push('home-hero-1440.png')
      }
      if (READY_PAGES.has(route)) {
        record(
          `${route === '/' ? 'C-8' : 'C-12'} ready ${route} ([data-plgrnd-ready="true"] after scrollIntoView)`,
          await checkReady(page, route)
        )
      }
      if (route === '/integrate/native-port')
        record('C-12 native-port golden addresses and bumps (F16)', await checkGolden(page))
      if (route === '/integrate/open-in-plgrnd')
        record('C-12 open-in preview href equals OPEN_IN_URL', await checkOpenIn(page))
      if (slug) {
        record(`C-13 clipboard ${route} (every [data-copy-button])`, await checkClipboard(page, slug))
        await page.evaluate(() => window.scrollTo(0, 0))
        await page.screenshot({ path: path.join(SHOTS, `integrate-${slug}.png`), fullPage: true })
        shots.push(`integrate-${slug}.png`)
      }
      await page.waitForTimeout(1000)
      const hosts = checkHosts(requests, route, origin)
      record(`C-12n hosts ${route}`, hosts.problems, hosts.note)
    } catch (error) {
      record(`load ${route}`, [error.message.split('\n')[0]])
    } finally {
      await context.close()
    }
  }
  record('C-7 screenshots saved to apps/landing/.verify/', [], shots.join(', '))
} finally {
  await browser.close()
  server.close()
}

let failed = 0
for (const { status, label, problems, note } of results) {
  if (status === 'FAIL') failed++
  console.log(`${status} ${label}${note ? ` (${note})` : ''}`)
  for (const problem of problems) console.log(`    - ${problem}`)
}
console.log(`\nbrowser-check: ${results.length - failed} passed, ${failed} failed`)
process.exit(failed ? 1 : 0)
