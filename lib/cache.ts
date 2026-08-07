/**
 * Cache-Control for uploaded images.
 *
 * Every upload writes to a fresh UUID path, so the bytes behind a URL never
 * change: replacing a product photo produces a new URL, it doesn't overwrite an
 * old one. That makes the objects safe to cache forever.
 *
 * The default is one hour, and an hour is what turns storage into a recurring
 * bill: browsers, the CDN and Next's image optimiser all come back for the same
 * unchanged bytes every hour, and every one of those hits is billed as cached
 * egress. Anything served from cache is still egress — the way to spend less is
 * for clients not to ask again.
 */
export const INMUTABLE = "public, max-age=31536000, immutable";
