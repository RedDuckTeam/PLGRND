import { createContext, useContext } from 'react'

export interface EmbedHost {
  /** Origin of the editor that "Open in PLGRND" targets; unset = this page's origin (the hosted app). */
  editorOrigin?: string
  /** Referral tag appended to outgoing plgrnd.io links. */
  linkRef?: string
}

export const EmbedHostContext = createContext<EmbedHost>({})

export const useEmbedHost = (): EmbedHost => useContext(EmbedHostContext)
