import { createContext, useContext } from 'react'

export const FLOW_PANE_CLICK = 'flow-pane-click'

/** One EventTarget per FlowCanvas, so a pane click only reaches the nodes of that canvas. */
export const FlowPaneEventsContext = createContext<EventTarget | null>(null)

export const useFlowPaneEvents = (): EventTarget | null => useContext(FlowPaneEventsContext)
