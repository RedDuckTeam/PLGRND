import { createContext, useContext } from 'react'

/**
 * Where Radix portals render. `undefined` keeps Radix's default (`document.body`, the app and `/embed`);
 * a self-hosted widget provides a node inside its own root.
 */
export const PortalContainerContext = createContext<HTMLElement | undefined>(undefined)

export const usePortalContainer = (): HTMLElement | undefined => useContext(PortalContainerContext)
