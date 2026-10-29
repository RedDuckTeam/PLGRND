import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import LZString from 'lz-string'

import { ANCHOR_PDA_SEEDS_FLOW, BLUESHIFT_PDA_FLOW } from '../app/lib/flows.ts'
import { IFRAME_ALLOW, IFRAME_SANDBOX, SDK_SRI, SDK_VERSION } from '../app/lib/plgrnd.ts'
import { GUIDES, type MethodSlug } from '../app/lib/guide/index.ts'
import * as iframeGuideModule from '../app/lib/guide/iframe.ts'
import * as openInGuideModule from '../app/lib/guide/open-in-plgrnd.ts'
import * as reactWrapperGuideModule from '../app/lib/guide/react-wrapper.ts'
import type { Tab } from '../app/lib/guide/types.ts'

import { COLOR_TOKEN_VARS, EMBED_DEFAULTS, parseEmbedConfig } from '../../web/src/embed/embed-config.ts'
import * as editorEmbed from '../../web/src/embed/embed-url.ts'
import { buildSelfHostedSnippet } from '../../web/src/embed/self-hosted-snippet.ts'
import { decodeFlowFromHash, encodeFlowToHash } from '../../web/src/utils/flow/share.ts'

const LANDING = fileURLToPath(new URL('../', import.meta.url))
const REPO = fileURLToPath(new URL('../../../', import.meta.url))
const OUT = path.join(LANDING, 'out')
const VERIFY_DIR = path.join(LANDING, '.verify')
const ORIGIN = 'https://plgrnd.io'
const DOCS_TAG = 'plgrnd-docs'
const SIZE = { kind: 'aspect', ratio: '16/9' } as const
const ALLOW_NO_OUT = process.env.VERIFY_ALLOW_NO_OUT === '1'

const REQUIRED_GOTCHAS: Record<MethodSlug, string[]> = {
  iframe: [
    'mintlify-frame',
    'docusaurus-jsx-props',
    'mkdocs-no-jsx-fallback',
    'fumadocs-md-to-mdx',
    'sandbox-review',
    'theme-auto-os',
    'ref-log-only',
    'mode-editor-iframe-only',
  ],
  'self-hosted': [
    'metaplex-no-external-iframes',
    'no-hotlink',
    'mintlify-single-js',
    'mkdocs-single-line',
    'jsx-string-attrs',
    'sri-iife-only',
    'link-ref-not-ref',
    'host-font',
    'mount-near-viewport',
  ],
  'react-wrapper': ['allow-list', 'theming-query', 'ref-log-tag'],
  'open-in-plgrnd': ['ref-before-hash', 'ref-log-only', 'fragment-client-only', 'fallback-link'],
  'native-port': [
    'credit-line',
    'ed25519-keygen',
    'crypto-subtle-http',
    'client-only',
    'fumadocs-md-to-mdx',
    'you-own-the-port',
  ],
}
const DISPLAYED_FILES = ['app/components/previews/plgrnd-embed.tsx', 'app/components/previews/pda-seeds-widget.tsx']
const JSX_LANGS = new Set(['jsx', 'tsx', 'mdx', 'js', 'ts', 'javascript', 'typescript'])
const COLOR_KEYS = Object.keys(COLOR_TOKEN_VARS)
const MODES = ['readonly', 'interactive', 'editor']
const EMBED_URL_RE = /https:\/\/plgrnd\.io\/embed(?![\w-])[^\s"'<>`)\]]*/g
const EDITOR_URL_RE = /https:\/\/plgrnd\.io\/\?[^\s"'<>`)\]]*/g
const HEX_RE = /^(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i

type Outcome = string[] | { problems: string[]; note: string }
type Result = { status: 'PASS' | 'FAIL' | 'SKIP'; label: string; problems: string[]; note?: string }
const results: Result[] = []

function report(label: string, run: () => Outcome) {
  try {
    const outcome = run()
    const problems = [...new Set(Array.isArray(outcome) ? outcome : outcome.problems)]
    const note = Array.isArray(outcome) ? undefined : outcome.note
    results.push({ status: problems.length ? 'FAIL' : 'PASS', label, problems, note })
  } catch (error) {
    results.push({ status: 'FAIL', label, problems: [`crashed: ${(error as Error).stack ?? error}`] })
  }
}

function reportHtml(label: string, run: (pages: Map<string, string>) => Outcome) {
  if (htmlPages) return report(label, () => run(htmlPages as Map<string, string>))
  const reason = 'apps/landing/out is missing (run yarn landing:build first)'
  if (ALLOW_NO_OUT) results.push({ status: 'SKIP', label, problems: [], note: `${reason}; VERIFY_ALLOW_NO_OUT=1` })
  else results.push({ status: 'FAIL', label, problems: [reason] })
}

const short = (value: string, max = 70) =>
  value.length > max ? `${value.slice(0, max)}… (${value.length} chars)` : value
const sameSet = (a: string[], b: string[]) => a.length === b.length && new Set([...a, ...b]).size === new Set(a).size

function firstDiff(actual: string, expected: string): string {
  let i = 0
  while (i < actual.length && i < expected.length && actual[i] === expected[i]) i++
  const around = (s: string) => JSON.stringify(s.slice(Math.max(0, i - 30), i + 50))
  return `first difference at char ${i}: got ${around(actual)}, expected ${around(expected)}`
}

const readText = (relativeToRepo: string) => readFileSync(path.join(REPO, relativeToRepo), 'utf8')

type TabText = { slug: MethodSlug; tab: Tab; code: string; where: string }
const SLUGS = Object.keys(GUIDES) as MethodSlug[]
const tabTexts: TabText[] = []
const unreadableTabs: string[] = []
for (const slug of SLUGS) {
  for (const tab of GUIDES[slug].tabs) {
    if ('code' in tab) {
      tabTexts.push({ slug, tab, code: tab.code, where: `${slug}/${tab.id}` })
      continue
    }
    try {
      const code = readFileSync(path.join(LANDING, tab.file), 'utf8')
      tabTexts.push({ slug, tab, code, where: `${slug}/${tab.id} (${tab.file})` })
    } catch {
      unreadableTabs.push(`${slug}/${tab.id}: file tab ${tab.file} cannot be read`)
    }
  }
}
const tabCode = (slug: MethodSlug, tab: Tab) => tabTexts.find((t) => t.slug === slug && t.tab === tab)?.code

function walkHtml(dir: string, base = dir, pages = new Map<string, string>()) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory() && entry.name !== '_next') walkHtml(full, base, pages)
    else if (entry.isFile() && entry.name.endsWith('.html'))
      pages.set(path.relative(base, full), readFileSync(full, 'utf8'))
  }
  return pages
}
const htmlPages = existsSync(OUT) ? walkHtml(OUT) : null

const unescapeHtml = (value: string) =>
  value
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')

function tagEnd(text: string, from: number): number {
  let depth = 0
  let quote = ''
  for (let i = from; i < text.length; i++) {
    const ch = text[i]
    if (quote) {
      if (ch === '\\' && depth > 0) i++
      else if (ch === quote) quote = ''
    } else if (ch === '"' || ch === "'" || ch === '`') quote = ch
    else if (ch === '{') depth++
    else if (ch === '}') depth--
    else if (ch === '>' && depth === 0) return i + 1
  }
  return text.length
}

function findTags(text: string, name: string): string[] {
  const tags: string[] = []
  const open = `<${name}`
  for (let start = text.indexOf(open); start >= 0; start = text.indexOf(open, start + open.length)) {
    const next = text[start + open.length]
    if (next !== undefined && !/[\s/>]/.test(next)) continue
    tags.push(text.slice(start, tagEnd(text, start + open.length)))
  }
  return tags
}

type Attr = { name: string; value: string; literal: boolean }

function parseAttrs(tag: string): Attr[] {
  const attrs: Attr[] = []
  let i = tag.search(/[\s/>]/)
  while (i >= 0 && i < tag.length) {
    const ch = tag[i]
    if (/[\s/>]/.test(ch)) {
      i++
      continue
    }
    if (ch === '{') {
      i = braceEnd(tag, i)
      continue
    }
    const name = /^[^\s=/>{]+/.exec(tag.slice(i))?.[0] ?? ''
    i += name.length
    while (/\s/.test(tag[i] ?? '')) i++
    if (tag[i] !== '=') {
      attrs.push({ name, value: '', literal: true })
      continue
    }
    i++
    while (/\s/.test(tag[i] ?? '')) i++
    const q = tag[i]
    if (q === '"' || q === "'") {
      const end = tag.indexOf(q, i + 1)
      attrs.push({ name, value: tag.slice(i + 1, end), literal: true })
      i = end + 1
    } else if (q === '{') {
      const end = braceEnd(tag, i)
      const inner = tag.slice(i + 1, end - 1).trim()
      const str = /^(["'`])([^"'`$\\]*)\1$/.exec(inner)
      attrs.push({ name, value: str ? str[2] : inner, literal: Boolean(str) })
      i = end
    } else {
      const value = /^[^\s>]*/.exec(tag.slice(i))?.[0] ?? ''
      attrs.push({ name, value, literal: true })
      i += value.length
    }
  }
  return attrs
}

function braceEnd(text: string, start: number): number {
  let depth = 0
  let quote = ''
  for (let i = start; i < text.length; i++) {
    const ch = text[i]
    if (quote) {
      if (ch === '\\') i++
      else if (ch === quote) quote = ''
    } else if (ch === '"' || ch === "'" || ch === '`') quote = ch
    else if (ch === '{') depth++
    else if (ch === '}' && --depth === 0) return i + 1
  }
  return text.length
}

const attrValue = (tag: string, name: string) => parseAttrs(tag).find((a) => a.name === name)

function markdocTags(text: string): Attr[][] {
  return [...text.matchAll(/\{%\s*plgrnd-flow\b([\s\S]*?)\/?%\}/g)].map((m) =>
    [...m[1].matchAll(/([A-Za-z_][\w-]*)\s*=\s*("(?:[^"\\]|\\.)*"|\S+)/g)].map(([, name, raw]) => ({
      name,
      value: raw.startsWith('"') ? JSON.parse(raw) : raw,
      literal: true,
    }))
  )
}

const urlsIn = (text: string, re: RegExp) => [...text.matchAll(re)].map((m) => unescapeHtml(m[0]))
const flowOf = (url: string) => /[#&?]flow=([^&#?]*)/.exec(new URL(url).hash)?.[1]

function htmlAttrUrls(html: string, tagName: string, attr: string, prefix: string) {
  return findTags(html, tagName)
    .map((tag) => attrValue(tag, attr))
    .filter((a): a is Attr => Boolean(a && a.literal))
    .map((a) => unescapeHtml(a.value))
    .filter((v) => v.startsWith(prefix))
}

const ELEMENT_ATTRS = (() => {
  const src = readText('packages/embed/src/element/plgrnd-flow-element.ts')
  const list = /export const ATTRIBUTES = \[([\s\S]*?)\] as const/.exec(src)?.[1] ?? ''
  return [...list.matchAll(/'([^']+)'/g)].map((m) => m[1])
})()
const MARKDOC_ATTRS = (() => {
  const lines = readText('README.md').split('\n').slice(299, 302).join('\n')
  return [...lines.matchAll(/'([^']+)'/g)].map((m) => m[1])
})()
const CONFIG_KEYS = (() => {
  const src = readText('apps/web/src/embed/embed-config.ts')
  const block = /const config: EmbedConfig = \{([\s\S]*?)\n {2}\}/.exec(src)?.[1] ?? ''
  return [...block.matchAll(/take\('([^']+)'/g)].map((m) => m[1])
})()

const KNOWN_PAYLOADS = new Map([
  [ANCHOR_PDA_SEEDS_FLOW, { name: 'ANCHOR_PDA_SEEDS_FLOW', nodes: 27 }],
  [BLUESHIFT_PDA_FLOW, { name: 'BLUESHIFT_PDA_FLOW', nodes: 23 }],
])

function snapshotOf(payload: string) {
  const snapshot = decodeFlowFromHash(payload)
  if (!snapshot) throw new Error(`payload does not decode: ${short(payload)}`)
  return snapshot
}

function payloadProblems(payload: string, where: string): string[] {
  let raw: { v?: unknown; nodes?: unknown[] } | null = null
  try {
    const json = LZString.decompressFromEncodedURIComponent(payload)
    raw = json ? JSON.parse(json) : null
  } catch {
    raw = null
  }
  if (!raw) return [`${where}: payload does not decode (${short(payload)})`]
  const problems: string[] = []
  if (raw.v !== 3) problems.push(`${where}: payload decodes to v=${raw.v}, expected 3`)
  const snapshot = decodeFlowFromHash(payload)
  if (!snapshot || encodeFlowToHash(snapshot) !== payload) {
    problems.push(`${where}: encodeFlowToHash(decodeFlowFromHash(P)) !== P for ${short(payload)}`)
  }
  const known = KNOWN_PAYLOADS.get(payload)
  if (!known)
    problems.push(`${where}: payload is neither ANCHOR_PDA_SEEDS_FLOW nor BLUESHIFT_PDA_FLOW (${short(payload)})`)
  else if (raw.nodes?.length !== known.nodes) {
    problems.push(`${where}: ${known.name} has ${raw.nodes?.length} nodes, expected ${known.nodes}`)
  }
  return problems
}

function payloadsIn(text: string, jsx: boolean): string[] {
  const payloads: string[] = []
  for (const url of [...urlsIn(text, EMBED_URL_RE), ...urlsIn(text, EDITOR_URL_RE)]) {
    const flow = flowOf(url)
    if (flow) payloads.push(flow)
  }
  for (const tag of [...findTags(text, 'plgrnd-flow'), ...(jsx ? findTags(text, 'PlgrndFlow') : [])]) {
    const flow = attrValue(tag, 'flow')
    if (flow?.literal) payloads.push(jsx ? flow.value : unescapeHtml(flow.value))
  }
  for (const attrs of markdocTags(text)) {
    const flow = attrs.find((a) => a.name === 'flow')
    if (flow) payloads.push(flow.value)
  }
  return payloads
}

function embedUrlProblems(raw: string, where: string): string[] {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return [`${where}: not a URL: ${short(raw)}`]
  }
  const problems: string[] = []
  for (const [key, value] of url.searchParams) {
    if (!CONFIG_KEYS.includes(key)) problems.push(`${where}: query key "${key}" is not one of embed-config.ts:94-106`)
    if (COLOR_KEYS.includes(key) && (value.includes('#') || !HEX_RE.test(value))) {
      problems.push(`${where}: colour ${key}=${JSON.stringify(value)} must be bare hex without #`)
    }
    if (key === 'mode' && !MODES.includes(value))
      problems.push(`${where}: mode=${JSON.stringify(value)} not in ${MODES}`)
  }
  for (const key of new URLSearchParams(url.hash.slice(1).replace(/\?/g, '&')).keys()) {
    if (key !== 'flow' && !CONFIG_KEYS.includes(key)) problems.push(`${where}: hash key "${key}" is not a config key`)
  }
  return problems
}

function elementAttrProblems(tag: string, allowed: string[], where: string): string[] {
  const problems: string[] = []
  for (const attr of parseAttrs(tag)) {
    if (!allowed.includes(attr.name))
      problems.push(`${where}: attribute "${attr.name}" not allowed on ${tag.slice(0, 13)}`)
    if (attr.name === 'mode' && attr.literal && attr.value === 'editor') {
      problems.push(`${where}: element mode="editor" (iframe only, F24)`)
    }
  }
  return problems
}

const HTML_ELEMENT_ATTRS = [...ELEMENT_ATTRS, 'style', 'class']
const JSX_ELEMENT_ATTRS = [...ELEMENT_ATTRS.filter((a) => a !== 'ref'), 'style', 'className']

const anchorSnapshot = snapshotOf(ANCHOR_PDA_SEEDS_FLOW)
const blueshiftSnapshot = snapshotOf(BLUESHIFT_PDA_FLOW)
const EXPECTED_IFRAME_PREVIEW = editorEmbed.buildEmbedUrl(
  anchorSnapshot,
  { ...EMBED_DEFAULTS, accent: '#14f195' },
  ORIGIN
)
const EXPECTED_WRAPPER_PREVIEW = editorEmbed.buildEmbedUrl(
  blueshiftSnapshot,
  { ...EMBED_DEFAULTS, bg: '#0b0e14', surface: '#11141a', border: '#1a1e26', accent: '#00e6e6' },
  ORIGIN
)
const EXPECTED_OPEN_IN = editorEmbed.buildEditorUrl(anchorSnapshot, ORIGIN, DOCS_TAG)

console.log(
  `INFO editor generators loaded through the hook; buildEmbedSnippet -> ${JSON.stringify(
    editorEmbed.buildEmbedSnippet(EXPECTED_IFRAME_PREVIEW, SIZE).slice(0, 80)
  )}`
)

report('C-14 gotcha data holds the required IDs (plan Step 2)', () => {
  const problems: string[] = []
  for (const slug of SLUGS) {
    const required = REQUIRED_GOTCHAS[slug]
    const guide = GUIDES[slug]
    if (!sameSet(guide.requiredGotchaIds, required)) {
      problems.push(
        `${slug}: requiredGotchaIds ${JSON.stringify(guide.requiredGotchaIds)} != plan ${JSON.stringify(required)}`
      )
    }
    const ids = guide.gotchas.map((g) => g.id)
    const missing = required.filter((id) => !ids.includes(id))
    const extra = ids.filter((id) => !required.includes(id))
    const duplicate = ids.filter((id, i) => ids.indexOf(id) !== i)
    if (missing.length) problems.push(`${slug}: missing gotcha IDs ${missing.join(', ')}`)
    if (extra.length) problems.push(`${slug}: gotcha IDs outside the required set ${extra.join(', ')}`)
    if (duplicate.length) problems.push(`${slug}: duplicate gotcha IDs ${duplicate.join(', ')}`)
  }
  return problems
})

reportHtml('C-14 (html) data-gotcha-id set inside <section data-gotchas> equals the required set', (pages) => {
  const problems: string[] = []
  for (const slug of SLUGS) {
    const file = `integrate/${slug}.html`
    const html = pages.get(file)
    if (!html) {
      problems.push(`${file}: missing`)
      continue
    }
    const open = new RegExp(`<section\\b[^>]*\\bdata-gotchas="${slug}"[^>]*>`).exec(html)
    if (!open) {
      problems.push(`${file}: no <section data-gotchas="${slug}">`)
      continue
    }
    const inside = html.slice(open.index, html.indexOf('</section>', open.index))
    const ids = [...new Set([...inside.matchAll(/data-gotcha-id="([a-z0-9-]*)"/g)].map((m) => m[1]))]
    const required = REQUIRED_GOTCHAS[slug]
    if (!sameSet(ids, required)) {
      const missing = required.filter((id) => !ids.includes(id))
      const extra = ids.filter((id) => !required.includes(id))
      problems.push(`${file}: rendered gotcha IDs differ; missing [${missing.join(', ')}], extra [${extra.join(', ')}]`)
    }
    const outside = (html.match(/data-gotcha-id="/g)?.length ?? 0) - (inside.match(/data-gotcha-id="/g)?.length ?? 0)
    if (outside) problems.push(`${file}: ${outside} data-gotcha-id outside <section data-gotchas>`)
  }
  if (!pages.get('integrate/self-hosted.html')?.includes('Metaplex')) {
    problems.push('integrate/self-hosted.html: "Metaplex" not found')
  }
  return problems
})

report('C-15(a) IFRAME_SANDBOX/IFRAME_ALLOW equal embed-url.ts:37-38 (lib, plgrnd-embed.tsx, iframe tabs)', () => {
  const problems = [...unreadableTabs]
  const expect = { sandbox: editorEmbed.IFRAME_SANDBOX, allow: editorEmbed.IFRAME_ALLOW }
  if (IFRAME_SANDBOX !== expect.sandbox) {
    problems.push(
      `app/lib/plgrnd.ts IFRAME_SANDBOX ${JSON.stringify(IFRAME_SANDBOX)} != ${JSON.stringify(expect.sandbox)}`
    )
  }
  if (IFRAME_ALLOW !== expect.allow) {
    problems.push(`app/lib/plgrnd.ts IFRAME_ALLOW ${JSON.stringify(IFRAME_ALLOW)} != ${JSON.stringify(expect.allow)}`)
  }
  const wrapperFile = DISPLAYED_FILES[0]
  const sources = [
    { where: wrapperFile, code: readFileSync(path.join(LANDING, wrapperFile), 'utf8'), mustHaveIframe: true },
    ...tabTexts.map((t) => ({ where: t.where, code: t.code, mustHaveIframe: false })),
  ]
  for (const { where, code, mustHaveIframe } of sources) {
    const iframes = findTags(code, 'iframe')
    if (mustHaveIframe && !iframes.length) problems.push(`${where}: no <iframe> literal found`)
    for (const tag of iframes) {
      for (const name of ['sandbox', 'allow'] as const) {
        const attr = attrValue(tag, name)
        if (!attr?.literal || unescapeHtml(attr.value) !== expect[name]) {
          problems.push(
            `${where}: <iframe ${name}=${JSON.stringify(attr?.value ?? null)}> != ${JSON.stringify(expect[name])}`
          )
        }
      }
    }
  }
  return problems
})

reportHtml('C-15(a) (html) preview <iframe> sandbox/allow equal embed-url.ts:37-38', (pages) => {
  const problems: string[] = []
  for (const [file, html] of pages) {
    for (const tag of findTags(html, 'iframe')) {
      for (const [name, expected] of [
        ['sandbox', editorEmbed.IFRAME_SANDBOX],
        ['allow', editorEmbed.IFRAME_ALLOW],
      ]) {
        const value = attrValue(tag, name)?.value
        if (value === undefined || unescapeHtml(value) !== expected) {
          problems.push(`${file}: <iframe ${name}=${JSON.stringify(value ?? null)}> != ${JSON.stringify(expected)}`)
        }
      }
    }
  }
  return problems
})

report(`C-15(b) SDK_SRI equals apps/web/public/sdk/${SDK_VERSION}/SRI.txt`, () => {
  const file = `apps/web/public/sdk/${SDK_VERSION}/SRI.txt`
  if (!existsSync(path.join(REPO, file))) return [`${file} does not exist (SDK_VERSION ${SDK_VERSION})`]
  const fromFile: Record<string, string> = {}
  for (const line of readText(file).split('\n').filter(Boolean)) {
    const [hash, name] = line.trim().split(/\s+/)
    fromFile[name] = hash
  }
  const problems: string[] = []
  const sri = SDK_SRI as Record<string, string>
  for (const name of new Set([...Object.keys(fromFile), ...Object.keys(sri)])) {
    if (fromFile[name] !== sri[name])
      problems.push(`${name}: SDK_SRI ${sri[name] ?? '(missing)'} != SRI.txt ${fromFile[name] ?? '(missing)'}`)
  }
  for (const { where, code } of tabTexts) {
    for (const m of code.matchAll(/integrity="([^"]*)"/g)) {
      if (!Object.values(fromFile).includes(m[1])) problems.push(`${where}: integrity ${m[1]} is not in ${file}`)
    }
  }
  return problems
})

report('C-15(c) plgrnd.io/embed URLs in tabs use only the 13 config keys, bare hex, valid mode', () => {
  const problems =
    CONFIG_KEYS.length === 13 ? [] : [`embed-config.ts:94-106 now has ${CONFIG_KEYS.length} keys (${CONFIG_KEYS})`]
  for (const { where, code } of tabTexts)
    for (const url of urlsIn(code, EMBED_URL_RE)) problems.push(...embedUrlProblems(url, where))
  return problems
})

reportHtml('C-15(c) (html) preview <iframe src> uses only the 13 config keys', (pages) => {
  const problems: string[] = []
  for (const [file, html] of pages) {
    for (const url of htmlAttrUrls(html, 'iframe', 'src', 'https://plgrnd.io/embed'))
      problems.push(...embedUrlProblems(url, file))
  }
  return problems
})

report('C-15(d) <plgrnd-flow>/<PlgrndFlow>/Markdoc attributes in tabs are allowed; no element mode="editor"', () => {
  const problems: string[] = []
  if (ELEMENT_ATTRS.length !== 18)
    problems.push(`plgrnd-flow-element.ts:7-25 ATTRIBUTES now has ${ELEMENT_ATTRS.length} entries`)
  if (!MARKDOC_ATTRS.includes('flow') || !MARKDOC_ATTRS.includes('aspect')) {
    problems.push(`README.md:300-302 no longer holds the Markdoc attribute list (got ${JSON.stringify(MARKDOC_ATTRS)})`)
  }
  for (const { where, code, tab } of tabTexts) {
    const jsx = JSX_LANGS.has(tab.lang)
    for (const tag of findTags(code, 'plgrnd-flow')) {
      problems.push(
        ...elementAttrProblems(tag, jsx ? JSX_ELEMENT_ATTRS : HTML_ELEMENT_ATTRS, `${where} [${jsx ? 'JSX' : 'HTML'}]`)
      )
    }
    for (const tag of findTags(code, 'PlgrndFlow'))
      problems.push(...elementAttrProblems(tag, JSX_ELEMENT_ATTRS, `${where} [JSX]`))
    for (const attrs of markdocTags(code)) {
      for (const attr of attrs) {
        if (!MARKDOC_ATTRS.includes(attr.name))
          problems.push(`${where} [Markdoc]: attribute "${attr.name}" not in README.md:300-302`)
        if (attr.name === 'mode' && attr.value === 'editor') problems.push(`${where} [Markdoc]: mode="editor" (F24)`)
      }
    }
  }
  return problems
})

reportHtml('C-15(d) (html) exported <plgrnd-flow> attributes are allowed', (pages) => {
  const problems: string[] = []
  for (const [file, html] of pages) {
    for (const tag of findTags(html, 'plgrnd-flow'))
      problems.push(...elementAttrProblems(tag, HTML_ELEMENT_ATTRS, file))
  }
  return problems
})

report('C-15(e) https://plgrnd.io/? URLs carry no query key other than ref', () => {
  const problems: string[] = []
  const sources = [
    ...tabTexts.map(({ where, code }) => ({ where, urls: urlsIn(code, EDITOR_URL_RE) })),
    { where: 'app/lib/guide/open-in-plgrnd.ts OPEN_IN_URL', urls: [String(openInGuideModule.OPEN_IN_URL)] },
  ]
  for (const { where, urls } of sources) {
    for (const url of urls) {
      for (const key of new URL(url).searchParams.keys()) {
        if (key !== 'ref') problems.push(`${where}: query key "${key}" in ${short(url)}`)
      }
    }
  }
  return problems
})

reportHtml('C-15(e) (html) https://plgrnd.io/? links carry no query key other than ref', (pages) => {
  const problems: string[] = []
  for (const [file, html] of pages) {
    for (const url of htmlAttrUrls(html, 'a', 'href', 'https://plgrnd.io/?')) {
      for (const key of new URL(url).searchParams.keys())
        if (key !== 'ref') problems.push(`${file}: query key "${key}"`)
    }
  }
  return problems
})

report('C-15(f) payloads round-trip and decode to v=3 with 27 (anchor) / 23 (blueshift) nodes', () => {
  const problems: string[] = []
  const seen = new Map<string, string>([
    [ANCHOR_PDA_SEEDS_FLOW, 'flows.ts ANCHOR_PDA_SEEDS_FLOW'],
    [BLUESHIFT_PDA_FLOW, 'flows.ts BLUESHIFT_PDA_FLOW'],
  ])
  for (const { where, code, tab } of tabTexts) {
    for (const payload of payloadsIn(code, JSX_LANGS.has(tab.lang))) if (!seen.has(payload)) seen.set(payload, where)
  }
  for (const [payload, where] of seen) problems.push(...payloadProblems(payload, where))
  return problems
})

reportHtml('C-15(f) (html) payloads in exported previews are known and round-trip', (pages) => {
  const problems: string[] = []
  const seen = new Map<string, string>()
  for (const [file, html] of pages) {
    const urls = [
      ...htmlAttrUrls(html, 'iframe', 'src', 'https://plgrnd.io/embed'),
      ...htmlAttrUrls(html, 'a', 'href', 'https://plgrnd.io/'),
    ]
    for (const url of urls) {
      const flow = flowOf(url)
      if (flow && !seen.has(flow)) seen.set(flow, file)
    }
    for (const tag of findTags(html, 'plgrnd-flow')) {
      const flow = attrValue(tag, 'flow')
      if (flow && !seen.has(unescapeHtml(flow.value))) seen.set(unescapeHtml(flow.value), file)
    }
  }
  for (const [payload, where] of seen) problems.push(...payloadProblems(payload, where))
  return problems
})

report('C-15(h) generator parity: iframe HTML tab, self-hosted tabs, Open-in URL, preview src', () => {
  const problems: string[] = []

  const htmlTabs = GUIDES.iframe.tabs.filter((t) => t.lang === 'html')
  const htmlTab = htmlTabs.length === 1 ? htmlTabs[0] : htmlTabs.find((t) => t.id === 'html')
  const htmlCode = htmlTab && tabCode('iframe', htmlTab)
  const htmlUrl = htmlCode ? urlsIn(htmlCode, EMBED_URL_RE)[0] : undefined
  if (!htmlTab || htmlCode === undefined) problems.push('iframe: cannot identify the HTML/Markdown tab (lang "html")')
  else if (!htmlUrl) problems.push(`iframe/${htmlTab.id}: no https://plgrnd.io/embed URL in the tab`)
  else {
    const payload = flowOf(htmlUrl)
    if (payload !== ANCHOR_PDA_SEEDS_FLOW) problems.push(`iframe/${htmlTab.id}: payload is not ANCHOR_PDA_SEEDS_FLOW`)
    const parsed = parseEmbedConfig(new URL(htmlUrl).searchParams)
    if (parsed.ignored.length) problems.push(`iframe/${htmlTab.id}: invalid config values ${parsed.ignored}`)
    const expected = editorEmbed.buildEmbedSnippet(
      editorEmbed.buildEmbedUrl(anchorSnapshot, parsed.config, ORIGIN),
      SIZE
    )
    if (htmlCode !== expected)
      problems.push(`iframe/${htmlTab.id}: != buildEmbedSnippet output; ${firstDiff(htmlCode, expected)}`)
  }

  const selfHostedConfig = { ...EMBED_DEFAULTS, theme: 'auto' as const }
  const formats = ['html', 'mdx', 'mintlify', 'markdoc'] as const
  const expectedSelfHosted = formats.map((format) => ({
    format,
    snippet: buildSelfHostedSnippet(anchorSnapshot, selfHostedConfig, SIZE, format),
  }))
  const selfHostedTabs = tabTexts.filter((t) => t.slug === 'self-hosted')
  for (const { where, code } of selfHostedTabs) {
    if (!expectedSelfHosted.some(({ snippet }) => code.includes(snippet))) {
      problems.push(`${where}: contains no buildSelfHostedSnippet output (html|mdx|mintlify|markdoc, theme auto, 16/9)`)
    }
  }
  for (const { format, snippet } of expectedSelfHosted) {
    if (!selfHostedTabs.some(({ code }) => code.includes(snippet))) {
      problems.push(`self-hosted: no tab contains the "${format}" snippet: ${short(snippet, 90)}`)
    }
  }

  const openIn = openInGuideModule.OPEN_IN_URL
  if (openIn !== EXPECTED_OPEN_IN)
    problems.push(`OPEN_IN_URL != buildEditorUrl(); ${firstDiff(String(openIn), EXPECTED_OPEN_IN)}`)
  for (const { where, code } of tabTexts.filter((t) => t.slug === 'open-in-plgrnd')) {
    for (const url of urlsIn(code, EDITOR_URL_RE)) {
      if (url !== EXPECTED_OPEN_IN)
        problems.push(`${where}: editor URL != buildEditorUrl(); ${firstDiff(url, EXPECTED_OPEN_IN)}`)
    }
  }

  const previews = [
    [
      'iframe.ts IFRAME_PREVIEW_SRC',
      (iframeGuideModule as Record<string, unknown>).IFRAME_PREVIEW_SRC,
      EXPECTED_IFRAME_PREVIEW,
    ],
    ['react-wrapper.ts WRAPPER_PREVIEW_SRC', reactWrapperGuideModule.WRAPPER_PREVIEW_SRC, EXPECTED_WRAPPER_PREVIEW],
  ] as const
  for (const [name, actual, expected] of previews) {
    if (actual !== undefined && actual !== expected)
      problems.push(`${name} != buildEmbedUrl(); ${firstDiff(String(actual), expected)}`)
  }

  for (const { where, code } of tabTexts) {
    for (const url of urlsIn(code, EMBED_URL_RE)) {
      const payload = flowOf(url)
      const snapshot = payload ? decodeFlowFromHash(payload) : null
      if (!snapshot) continue
      const canonical = editorEmbed.buildEmbedUrl(snapshot, parseEmbedConfig(new URL(url).searchParams).config, ORIGIN)
      if (url !== canonical)
        problems.push(`${where}: embed URL is not buildEmbedUrl output; ${firstDiff(url, canonical)}`)
    }
  }
  return problems
})

reportHtml('C-15(h) (html) preview iframe src and Open-in href equal the generators', (pages) => {
  const problems: string[] = []
  const expectations = [
    ['integrate/iframe.html', 'iframe', 'src', 'https://plgrnd.io/embed', EXPECTED_IFRAME_PREVIEW],
    ['integrate/react-wrapper.html', 'iframe', 'src', 'https://plgrnd.io/embed', EXPECTED_WRAPPER_PREVIEW],
    ['integrate/open-in-plgrnd.html', 'a', 'href', 'https://plgrnd.io/?', EXPECTED_OPEN_IN],
  ] as const
  for (const [file, tagName, attr, prefix, expected] of expectations) {
    const values = htmlAttrUrls(pages.get(file) ?? '', tagName, attr, prefix)
    if (!values.length) problems.push(`${file}: no <${tagName} ${attr}="${prefix}…">`)
    for (const value of values) {
      if (value !== expected) problems.push(`${file}: <${tagName} ${attr}> != generator; ${firstDiff(value, expected)}`)
    }
  }
  return problems
})

report('C-15(i) displayed files import only npm packages and contain no TODO', () => {
  const problems = [...unreadableTabs]
  const fileTabs = SLUGS.flatMap((slug) => GUIDES[slug].tabs.flatMap((t) => ('file' in t ? [t.file] : [])))
  for (const file of new Set([...DISPLAYED_FILES, ...fileTabs])) {
    const full = path.join(LANDING, file)
    if (!existsSync(full)) {
      problems.push(`${file}: missing`)
      continue
    }
    const code = readFileSync(full, 'utf8')
    const specifiers = [
      ...code.matchAll(/\b(?:import|export)\s[^'"`;]*?\bfrom\s*['"]([^'"]+)['"]/g),
      ...code.matchAll(/\bimport\s*\(?\s*['"]([^'"]+)['"]/g),
      ...code.matchAll(/\brequire\s*\(\s*['"]([^'"]+)['"]/g),
    ].map((m) => m[1])
    for (const spec of specifiers) {
      if (/^(@\/|~\/|\.{1,2}\/|\/)/.test(spec)) problems.push(`${file}: non-npm import "${spec}"`)
    }
    code.split('\n').forEach((line, i) => {
      if (line.includes('TODO')) problems.push(`${file}:${i + 1}: contains TODO`)
    })
  }
  return problems
})

report('C-15(j) Vue tab <script setup lang="ts"> type-checks', () => {
  const vueTabs = tabTexts.filter((t) => t.tab.lang === 'vue' || t.code.includes('<script setup'))
  if (!vueTabs.length) return { problems: [], note: 'no Vue tab (dropped per R13; C-13 then expects 14 tabs)' }
  const problems: string[] = []
  for (const { where, code } of vueTabs) {
    const body = /<script setup lang="ts">([\s\S]*?)<\/script>/.exec(code)?.[1]
    if (body === undefined) {
      problems.push(`${where}: no <script setup lang="ts"> block`)
      continue
    }
    mkdirSync(VERIFY_DIR, { recursive: true })
    const file = path.join(VERIFY_DIR, 'vue-tab.ts')
    writeFileSync(file, body)
    const tsc = createRequire(import.meta.url).resolve('typescript/bin/tsc')
    const args = [
      '--noEmit',
      '--strict',
      '--module',
      'esnext',
      '--moduleResolution',
      'bundler',
      '--target',
      'es2022',
      '--types',
      'node',
    ]
    const run = spawnSync(process.execPath, [tsc, ...args, file], { encoding: 'utf8' })
    if (run.status !== 0) {
      problems.push(`${where}: tsc ${args.join(' ')} .verify/vue-tab.ts failed`)
      problems.push(...`${run.stdout}${run.stderr}`.trim().split('\n'))
    }
  }
  return problems
})

let failed = 0
for (const { status, label, problems, note } of results) {
  if (status === 'FAIL') failed++
  console.log(`${status} ${label}${note ? ` (${note})` : ''}`)
  for (const problem of problems) console.log(`    - ${problem}`)
}
const count = (status: Result['status']) => results.filter((r) => r.status === status).length
console.log(`\nverify: ${count('PASS')} passed, ${failed} failed, ${count('SKIP')} skipped`)
process.exit(failed ? 1 : 0)
