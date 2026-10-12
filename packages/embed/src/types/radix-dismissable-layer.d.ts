import type { Context } from 'react'

// M18 (build/patch-layer-scope.ts) adds DismissableLayerContext to the package's exports, so each
// widget can mount its own Radix layer stack.
declare module '@radix-ui/react-dismissable-layer' {
  export const DismissableLayerContext: Context<{
    layers: Set<HTMLElement>
    layersWithOutsidePointerEventsDisabled: Set<HTMLElement>
    branches: Set<HTMLElement>
  }>
}
