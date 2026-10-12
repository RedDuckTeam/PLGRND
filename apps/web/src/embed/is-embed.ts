import { isEmbedFromLocation } from './embed-location'

/** App-only: whether this document is the hosted `/embed` route (read once, at startup). */
export const IS_EMBED = isEmbedFromLocation()
