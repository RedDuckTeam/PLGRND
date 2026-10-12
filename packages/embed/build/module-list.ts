import fs from 'node:fs'
import path from 'node:path'
import { normalizePath, type Plugin } from 'vite'

export interface ModuleListEntry {
  id: string
  renderedLength: number
  originalLength: number
}

/**
 * Writes every module of every chunk, with its rendered size, to `file` (outside the output folder, so the
 * list never ships in a published directory).
 */
export function moduleList(file: string): Plugin {
  return {
    name: 'plgrnd:module-list',
    generateBundle(_, bundle) {
      const chunks: Record<string, ModuleListEntry[]> = {}
      for (const output of Object.values(bundle)) {
        if (output.type !== 'chunk') continue
        chunks[output.fileName] = Object.entries(output.modules)
          .map(([id, info]) => ({
            id: normalizePath(id),
            renderedLength: info.renderedLength,
            originalLength: info.originalLength,
          }))
          .sort((a, b) => a.id.localeCompare(b.id))
      }
      fs.mkdirSync(path.dirname(file), { recursive: true })
      fs.writeFileSync(file, `${JSON.stringify({ chunks }, null, 2)}\n`)
    },
  }
}
