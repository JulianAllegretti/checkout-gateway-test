// A one-line seam around `window.location.reload()`: jsdom's real
// `Location` object has non-configurable, non-writable own properties, so
// tests can't stub it directly — they mock this module instead.
export function reloadPage() {
  window.location.reload()
}
