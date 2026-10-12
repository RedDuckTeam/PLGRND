import type { ReactNode } from 'react'

// M3 (S-N safety net): RemoveScroll writes a <style> into the host <head>, sets body[data-scroll-locked]
// and blocks wheel/touch on the host document. Only Radix's modal paths use it; here it renders its child.
export function RemoveScroll({ children }: { children?: ReactNode }) {
  return children ?? null
}
