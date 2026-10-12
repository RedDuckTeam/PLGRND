import path from 'node:path'
import { normalizePath, type Plugin } from 'vite'

export interface ModuleAlias {
  /** A bare package specifier (`'sonner'`) or an absolute file path of the module being replaced. */
  from: string
  /** Absolute path of the replacement module. */
  to: string
}

const isBare = (spec: string) => !spec.startsWith('.') && !path.isAbsolute(spec)
const stripQuery = (id: string) => id.split('?')[0]

/**
 * Swaps modules by identity, not by import spelling: bare package specifiers match exactly, and file
 * aliases match the resolved absolute path, so `'@/components/ui/select'` and `'../../ui/select'`
 * are both caught. The replacement module itself still reaches the original (shims may wrap it).
 */
export function resolveAliases(name: string, aliases: ModuleAlias[]): Plugin {
  const bare = new Map<string, string>()
  const files = new Map<string, string>()
  for (const alias of aliases) {
    const to = normalizePath(alias.to)
    if (isBare(alias.from)) bare.set(alias.from, to)
    else files.set(normalizePath(alias.from).toLowerCase(), to)
  }
  const replacements = new Set([...bare.values(), ...files.values()].map((p) => p.toLowerCase()))
  const fileBasenames = new Set([...files.keys()].map((p) => path.posix.basename(p).replace(/\.[^.]+$/, '')))

  return {
    name,
    enforce: 'pre',
    async resolveId(source, importer, options) {
      if (importer && replacements.has(normalizePath(stripQuery(importer)).toLowerCase())) return null
      const direct = bare.get(source)
      if (direct) return direct
      if (files.size === 0) return null
      const base = path.posix.basename(source).replace(/\.[^.]+$/, '')
      if (!fileBasenames.has(base)) return null
      const resolved = await this.resolve(source, importer, { ...options, skipSelf: true })
      if (!resolved) return null
      return files.get(normalizePath(stripQuery(resolved.id)).toLowerCase()) ?? null
    },
  }
}
