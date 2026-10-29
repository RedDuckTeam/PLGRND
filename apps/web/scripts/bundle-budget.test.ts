import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { measureClosure } from './bundle-budget'

const chunk = (fileName: string, gzip: number, extra: Partial<Parameters<typeof measureClosure>[0][number]> = {}) => ({
  fileName,
  name: fileName,
  isEntry: false,
  moduleIds: [],
  imports: [],
  gzip,
  ...extra,
})

describe('measureClosure', () => {
  const root = path.resolve('/web')
  const id = (file: string) => path.join(root, file).replace(/\\/g, '/')
  const chunks = [
    chunk('index.js', 100, { isEntry: true, imports: ['shared.js'] }),
    chunk('shared.js', 10),
    chunk('home.js', 50, {
      moduleIds: [id('src/components/a.tsx'), id('src/pages/home.tsx')],
      imports: ['shared.js', 'heavy.js'],
    }),
    chunk('heavy.js', 30),
    chunk('lazy.js', 999, { moduleIds: [id('src/lazy.ts')] }),
  ]

  it('sums the entry, the roots and their static imports once each, ignoring unrelated chunks', () => {
    expect(measureClosure(chunks, ['src/pages/home.tsx'], root)).toBe(100 + 10 + 50 + 30)
  })

  it('throws when a root has no chunk, so a renamed page cannot silently drop out of the budget', () => {
    expect(() => measureClosure(chunks, ['src/pages/missing.tsx'], root)).toThrow(/no chunk/)
  })
})
