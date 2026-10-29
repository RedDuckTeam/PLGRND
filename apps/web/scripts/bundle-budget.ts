// Fails `vite build` when a page's JavaScript or a named chunk grows past its gzip budget (bundle-budget.json).
// Budgets are checked in the build because Cloudflare deploys whatever `yarn web:build` produces on push to main.
import fs from 'node:fs'
import path from 'node:path'
import { gzipSync } from 'node:zlib'
import type { Plugin } from 'vite'

interface ClosureBudget {
  /** Modules (relative to apps/web) whose chunks, plus the entry and every chunk they import statically, make up the page. */
  roots: string[]
  baselineGzip?: number
  maxGzip?: number
}

interface ChunkBudget {
  maxGzip: number
}

interface BudgetFile {
  closures: Record<string, ClosureBudget>
  /** Keyed by manualChunks name; a trailing `*` matches a prefix. */
  chunks: Record<string, ChunkBudget>
}

interface ChunkInfo {
  fileName: string
  name: string
  isEntry: boolean
  /** Every module rendered into the chunk: a page that shares modules with its lazy chunks has no facade. */
  moduleIds: string[]
  imports: string[]
  gzip: number
}

const kB = (bytes: number) => `${(bytes / 1000).toFixed(1)} kB`

const normalize = (file: string) => file.replace(/\\/g, '/')

export const measureClosure = (chunks: ChunkInfo[], roots: string[], webRoot: string): number => {
  const byFile = new Map(chunks.map((c) => [c.fileName, c]))
  const rootIds = roots.map((r) => normalize(path.resolve(webRoot, r)))
  const holds = (c: ChunkInfo, id: string) => c.moduleIds.some((m) => normalize(m) === id)
  const start = chunks.filter((c) => c.isEntry || rootIds.some((id) => holds(c, id)))
  const missing = rootIds.filter((id) => !chunks.some((c) => holds(c, id)))
  if (missing.length > 0) throw new Error(`no chunk for ${missing.join(', ')}`)

  const seen = new Set<string>()
  const queue = start.map((c) => c.fileName)
  while (queue.length > 0) {
    const file = queue.pop()!
    if (seen.has(file)) continue
    seen.add(file)
    queue.push(...(byFile.get(file)?.imports ?? []))
  }
  let total = 0
  for (const file of seen) total += byFile.get(file)?.gzip ?? 0
  return total
}

const matchesChunk = (pattern: string, name: string) =>
  pattern.endsWith('*') ? name.startsWith(pattern.slice(0, -1)) : name === pattern

export function bundleBudget(budgetPath: string): Plugin {
  const webRoot = path.dirname(budgetPath)
  return {
    name: 'plgrnd:bundle-budget',
    apply: 'build',
    enforce: 'post',
    generateBundle(_options, bundle) {
      const budget = JSON.parse(fs.readFileSync(budgetPath, 'utf8')) as BudgetFile
      const chunks: ChunkInfo[] = Object.values(bundle)
        .filter((output) => output.type === 'chunk')
        .map((chunk) => ({
          fileName: chunk.fileName,
          name: chunk.name,
          isEntry: chunk.isEntry,
          moduleIds: chunk.moduleIds,
          imports: chunk.imports,
          gzip: gzipSync(chunk.code, { level: 9 }).length,
        }))

      const failures: string[] = []
      for (const [name, closure] of Object.entries(budget.closures)) {
        const size = measureClosure(chunks, closure.roots, webRoot)
        const limit = closure.maxGzip
        this.info(`${name}: ${kB(size)} gzip${limit === undefined ? '' : ` / ${kB(limit)}`}`)
        if (limit !== undefined && size > limit) failures.push(`${name} is ${kB(size)} gzip, budget ${kB(limit)}`)
      }
      for (const [pattern, { maxGzip }] of Object.entries(budget.chunks)) {
        const matched = chunks.filter((c) => matchesChunk(pattern, c.name))
        if (matched.length === 0) {
          this.info(`${pattern}: no such chunk yet, skipped`)
          continue
        }
        for (const chunk of matched) {
          this.info(`${chunk.name}: ${kB(chunk.gzip)} gzip / ${kB(maxGzip)}`)
          if (chunk.gzip > maxGzip) failures.push(`${chunk.name} is ${kB(chunk.gzip)} gzip, budget ${kB(maxGzip)}`)
        }
      }
      if (failures.length > 0) this.error(`bundle budget exceeded:\n  ${failures.join('\n  ')}`)
    },
  }
}
