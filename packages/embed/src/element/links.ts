// The shell's own copy of the canonical link (the shell imports nothing from apps/web).
export const PLGRND_ORIGIN = 'https://plgrnd.io'
export const LINK_REF_RE = /^[A-Za-z0-9._-]{1,64}$/

export const plgrndHref = (ref: string | null | undefined): string =>
  ref && LINK_REF_RE.test(ref) ? `${PLGRND_ORIGIN}/?ref=${encodeURIComponent(ref)}` : PLGRND_ORIGIN
