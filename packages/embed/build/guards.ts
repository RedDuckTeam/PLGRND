// Lexical guards inserted by the IIFE and ESM assemblies AFTER minification, at the top of the runtime
// (declared in a source module, Rollup would rename them and the bundle's free identifiers would keep
// resolving to the host's globals). The verify script asserts each occurs exactly once per runtime artifact.

/** M16: react-dom routes handler errors to the global `reportError`; on a host page they must not reach `window`. */
export const REPORT_ERROR_GUARD = "var reportError = function (e) { console.error('[plgrnd]', e) };"

/**
 * M20 (found in Phase 0): every ResizeObserver in the bundle (React Flow, floating-ui, Radix useSize, ours) delivers
 * on the next animation frame, so no callback changes layout inside the browser's ResizeObserver step and the host
 * window never receives "ResizeObserver loop completed with undelivered notifications". Callbacks stop after disconnect().
 */
export const RESIZE_OBSERVER_GUARD =
  'var ResizeObserver=typeof globalThis.ResizeObserver=="function"?class extends globalThis.ResizeObserver{#l=!0;' +
  'constructor(c){super(e=>requestAnimationFrame(()=>{this.#l&&c(e,this)}))}' +
  'observe(t,o){this.#l=!0;super.observe(t,o)}disconnect(){this.#l=!1;super.disconnect()}}:globalThis.ResizeObserver;'

/** Both guards, in order: the first statements of the runtime factory (IIFE) or chunk (ESM). */
export const RUNTIME_GUARDS = REPORT_ERROR_GUARD + RESIZE_OBSERVER_GUARD
