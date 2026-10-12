import { useEffect, type RefObject } from 'react'
import { FLOW_PANE_CLICK, useFlowPaneEvents } from '@/components/flow/flow-pane-events'

/**
 * Blurs the focusable element when the user clicks outside the container.
 *
 * The xyflow pane swallows native focus changes (it calls preventDefault on
 * mousedown), so we listen on the container's root node (the document, or the
 * shadow root of a self-hosted widget) for clicks elsewhere AND for the
 * canvas's own pane-click event dispatched from `<ReactFlow onPaneClick>`.
 */
export const useBlurOnOutsideClick = (
  containerRef: RefObject<HTMLElement | null>,
  focusableRef: RefObject<HTMLElement | null>
) => {
  const paneEvents = useFlowPaneEvents()

  useEffect(() => {
    const root = (containerRef.current?.getRootNode() ?? document) as Document | ShadowRoot
    const blurIfFocused = () => {
      const focusable = focusableRef.current
      if (focusable && root.activeElement === focusable) focusable.blur()
    }
    const handleDown = (e: Event) => {
      const container = containerRef.current
      if (container && e.composedPath().includes(container)) return
      blurIfFocused()
    }

    root.addEventListener('pointerdown', handleDown, true)
    paneEvents?.addEventListener(FLOW_PANE_CLICK, blurIfFocused)

    return () => {
      root.removeEventListener('pointerdown', handleDown, true)
      paneEvents?.removeEventListener(FLOW_PANE_CLICK, blurIfFocused)
    }
  }, [containerRef, focusableRef, paneEvents])
}
