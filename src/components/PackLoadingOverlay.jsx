// Covers the active pack card while a rank/pick submission is in flight and
// the next pack hasn't loaded yet, so the gap isn't just a disabled, inert
// pack sitting on screen.
export function PackLoadingOverlay() {
  return (
    <div className="pack-loading-overlay" aria-hidden="true">
      <span className="pack-loading-spinner" />
    </div>
  )
}
