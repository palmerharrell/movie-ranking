import { useEffect } from 'react'

// Shrinks an element's font size, one pixel at a time, until its text fits
// on one line within its box — used for the subset pill label and screen
// titles, which must never wrap or ellipsize while a name is still readable.
// Re-measures on mount (polling until the ref is actually live, since it may
// not be on first paint), on resize via ResizeObserver, once web fonts swap
// in (the fallback face is narrower, so a size chosen against it can be too
// large once the real font loads), and once more after a short timeout as a
// backstop for that same font-swap case.
export function useFitText(ref, dep, { max = 19, min = 9 } = {}) {
  useEffect(() => {
    let cancelled = false
    let ro
    let mountPoll
    let fontTimer

    function fit() {
      const el = ref.current
      if (!el) return
      let size = max
      el.style.fontSize = `${size}px`
      while (size > min && el.scrollWidth > el.clientWidth) {
        size -= 1
        el.style.fontSize = `${size}px`
      }
    }

    function start() {
      if (cancelled) return
      if (!ref.current) {
        mountPoll = requestAnimationFrame(start)
        return
      }
      fit()
      ro = new ResizeObserver(fit)
      ro.observe(ref.current)
      document.fonts?.ready.then(() => {
        if (!cancelled) fit()
      })
      fontTimer = setTimeout(fit, 600)
    }

    start()

    return () => {
      cancelled = true
      if (mountPoll) cancelAnimationFrame(mountPoll)
      if (fontTimer) clearTimeout(fontTimer)
      ro?.disconnect()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ref, dep, max, min])
}
