/** The canonical PLGRND site: links out of an embed never point at the host page's origin. */
export const PLGRND_ORIGIN = 'https://plgrnd.io'

/** A link into plgrnd.io; `ref` (the integrator's referral tag) is appended as `?ref=` when set. */
export const buildPlgrndHref = (path = '', ref?: string): string =>
  ref ? `${PLGRND_ORIGIN}${path || '/'}?ref=${encodeURIComponent(ref)}` : `${PLGRND_ORIGIN}${path}`
