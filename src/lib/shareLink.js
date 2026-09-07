// A shared link stays on this same app/origin (#220) — the share view is
// gated by a `?share=<slug>` query param (see main.jsx) rather than a new
// path, so it needs no server-side routing/rewrite support from GitHub
// Pages, unlike a dedicated `/share/:slug` path would.
export function buildShareUrl(shareSlug) {
  return `${window.location.origin}${window.location.pathname}?share=${shareSlug}`
}
