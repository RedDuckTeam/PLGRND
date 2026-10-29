import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const WEB_SRC = new URL('../../web/src/', import.meta.url).href

function withTs(url) {
  const file = `${url}.ts`
  return existsSync(fileURLToPath(file)) ? file : `${url}/index.ts`
}

export async function resolve(specifier, context, nextResolve) {
  if (context.parentURL?.startsWith(WEB_SRC)) {
    if (specifier.startsWith('@/')) return nextResolve(withTs(new URL(specifier.slice(2), WEB_SRC).href), context)
    if (/^\.\.?\//.test(specifier) && !/\.[cm]?[jt]sx?$/.test(specifier)) {
      return nextResolve(withTs(new URL(specifier, context.parentURL).href), context)
    }
  }
  return nextResolve(specifier, context)
}
