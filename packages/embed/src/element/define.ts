import { createElementClass, type ElementOptions } from './plgrnd-flow-element'

export const TAG_NAME = 'plgrnd-flow'

let warnedMismatch = false

/**
 * Registers <plgrnd-flow> once per page. Safe to call on the server (no `window`) and more than once (two
 * script tags, or the IIFE plus the npm entry): the first definition wins, a different version warns once.
 */
export function define(options: ElementOptions): void {
  if (typeof window === 'undefined' || typeof window.customElements === 'undefined') return
  const existing = window.customElements.get(TAG_NAME) as (CustomElementConstructor & { version?: string }) | undefined
  if (existing) {
    if (existing.version !== options.version && !warnedMismatch) {
      warnedMismatch = true
      console.warn(
        `[plgrnd] <${TAG_NAME}> ${existing.version ?? '(unknown)'} is already defined; ${options.version} is not used`
      )
    }
    return
  }
  window.customElements.define(TAG_NAME, createElementClass(options))
}
