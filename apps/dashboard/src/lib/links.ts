/**
 * Public ChainPe repository. There is no confirmed URL yet, so GitHub links
 * render only when this is set at build time.
 */
export const GITHUB_URL = process.env.NEXT_PUBLIC_GITHUB_URL?.replace(/\/$/, '') || null
