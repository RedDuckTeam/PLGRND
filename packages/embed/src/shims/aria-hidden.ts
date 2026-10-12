import { hideOthers as hideOthersIn } from 'aria-hidden'

type Target = Element | Element[]

const widgetRootOf = (target: Target): HTMLElement | undefined => {
  const element = Array.isArray(target) ? target[0] : target
  return (element?.closest('.plgrnd-root') as HTMLElement | null) ?? undefined
}

// M4 (S-N safety net): Radix's modal dialog marks every sibling up to <body> aria-hidden. Inside a widget
// the walk stops at the widget root, so host content is never hidden from assistive technology.
export const hideOthers = (target: Target, parentNode?: HTMLElement, markerName?: string): (() => void) =>
  hideOthersIn(target, parentNode ?? widgetRootOf(target), markerName)
