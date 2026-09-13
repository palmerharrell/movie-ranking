// Hot (top-ranked) -> cold (bottom-ranked) gradient for already-ranked
// movies (#352), shared by the Rankings panel and pack tiles so both
// surfaces render the same movie with the same color. Hot/cold reuse the
// existing accent2 (pink)/accent (teal) palette so the gradient still reads
// as an extension of the old flat pink (pack tiles) / teal (Rankings panel)
// tints rather than an unrelated color scheme.
const HOT_COLOR = [240, 79, 140] // --accent2
const COLD_COLOR = [63, 210, 199] // --accent

function mixRgb(a, b, t) {
  return a.map((channel, i) => Math.round(channel + (b[i] - channel) * t))
}

// Returns a Map<movieId, "rgb(r, g, b)"> for every movie with
// timesRanked >= 1 in `movies`, positioned by the same eloRating-desc/
// title-asc order the Rankings panel already sorts by. Movies never yet
// ranked are omitted — there's nothing to color, since they don't get the
// already-ranked treatment either way.
export function computeHeatColors(movies) {
  const ranked = movies
    .filter((movie) => (movie.timesRanked || 0) >= 1)
    .sort((a, b) => {
      if (a.eloRating !== b.eloRating) return b.eloRating - a.eloRating
      return a.title.localeCompare(b.title)
    })

  const colors = new Map()
  const lastIndex = ranked.length - 1
  ranked.forEach((movie, index) => {
    const percentile = lastIndex <= 0 ? 0 : index / lastIndex
    const [r, g, b] = mixRgb(HOT_COLOR, COLD_COLOR, percentile)
    colors.set(movie.id, `rgb(${r}, ${g}, ${b})`)
  })
  return colors
}
