// Wraps the minified runtime IIFE and the shell IIFE into the classic-script artifact:
//
//   (function(){
//     var f=function(){<M16 guard><M20 guard><runtime IIFE: var __rt=…>\nreturn __rt};
//     var load=(function(){var p;return function(){return p||(p=Promise.resolve().then(f).catch(…reset…))}})();
//     <shell IIFE, which calls load()>
//   })();
//
// The guards are inserted after minification as the first statements of the lazy runtime factory, so the
// runtime's free `reportError` (react-dom) and `ResizeObserver` resolve to them lexically; declared in a source
// module, Rollup would rename them and the bundle would keep reaching the host's globals. `load` is a lexical
// binding, never a window property. A failed evaluation resets it, so the element's Retry evaluates again.
//
// Outputs dist/plgrnd-flow.iife.js and dist/sdk/<v>/plgrnd-flow-<v>.js (byte-identical).
import fs from 'node:fs'
import path from 'node:path'
import { REPORT_ERROR_GUARD, RESIZE_OBSERVER_GUARD, RUNTIME_GUARDS } from '../build/guards.ts'

const count = (text, needle) => text.split(needle).length - 1

export function assembleIife({ dist, version }) {
  const runtime = fs.readFileSync(path.join(dist, '.build/iife-runtime/out/runtime.iife.js'), 'utf8').trim()
  const shell = fs.readFileSync(path.join(dist, '.build/iife-shell/out/shell.iife.js'), 'utf8').trim()

  if (!runtime.startsWith('var __rt=')) throw new Error('[assemble-iife] unexpected runtime IIFE prologue')
  if (/\b(?:globalThis|window|self)\.reportError\b/.test(runtime)) {
    throw new Error('[assemble-iife] the runtime reaches the global reportError')
  }
  if (!/^\(function\(\)\{/.test(shell) || !shell.endsWith('})();')) {
    throw new Error('[assemble-iife] unexpected shell IIFE shape')
  }
  for (const guard of [REPORT_ERROR_GUARD, RESIZE_OBSERVER_GUARD]) {
    if (count(runtime, guard) !== 0 || count(shell, guard) !== 0)
      throw new Error('[assemble-iife] guard already present')
  }

  const out =
    '(function(){' +
    `var f=function(){${RUNTIME_GUARDS}${runtime}\nreturn __rt};` +
    'var load=(function(){var p;return function(){return p||(p=Promise.resolve().then(f).catch(function(e){p=null;throw e}))}})();' +
    `${shell}\n})();\n`

  for (const guard of [REPORT_ERROR_GUARD, RESIZE_OBSERVER_GUARD]) {
    if (count(out, guard) !== 1) throw new Error('[assemble-iife] each guard must occur exactly once')
  }
  if (!out.startsWith(`(function(){var f=function(){${REPORT_ERROR_GUARD}${RESIZE_OBSERVER_GUARD}`)) {
    throw new Error('[assemble-iife] the guards must be the first statements of the runtime factory')
  }

  const iife = path.join(dist, 'plgrnd-flow.iife.js')
  const versioned = path.join(dist, 'sdk', version, `plgrnd-flow-${version}.js`)
  fs.mkdirSync(path.dirname(versioned), { recursive: true })
  fs.writeFileSync(iife, out)
  fs.writeFileSync(versioned, out)
  return { bytes: Buffer.byteLength(out) }
}
