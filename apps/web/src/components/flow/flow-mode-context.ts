import { createContext, useContext } from 'react'
import type { EmbedMode } from '@/embed/embed-config'

export interface FlowMode {
  mode: EmbedMode
  embedded: boolean
}

export const FlowModeContext = createContext<FlowMode>({ mode: 'editor', embedded: false })

export const useFlowMode = (): FlowMode => useContext(FlowModeContext)
