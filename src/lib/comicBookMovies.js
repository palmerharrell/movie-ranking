// Marvel/DC identification for #180 (excluding them from every subset but
// the dedicated Comic Book subset, #181) — same curated-allowlist spirit as
// NOTABLE_STUDIOS/KEYWORD_LABELS in curatedAttributes.js: TMDb's collection
// names are the most reliable signal for "which franchise is this," but
// matching on the collection *name* means hand-picking which collections are
// actually Marvel/DC (confirmed against the current pool's collection list).
export const MARVEL_DC_COLLECTIONS = [
  // Marvel
  'Ant-Man Collection',
  'Black Panther Collection',
  'Blade Collection',
  'Captain America Collection',
  'Captain Marvel Collection',
  'Deadpool Collection',
  'Doctor Strange Collection',
  'Fantastic Four Collection',
  'Ghost Rider Collection',
  'Guardians of the Galaxy Collection',
  'Iron Man Collection',
  'Spider-Man (MCU) Collection',
  'Spider-Man Collection',
  'Spider-Man: Spider-Verse Collection',
  'The Amazing Spider-Man Collection',
  'The Avengers Collection',
  'The Punisher Collection',
  'The Wolverine Collection',
  'Thor Collection',
  'Venom Collection',
  'X-Men Collection',
  // DC
  'Aquaman Collection',
  'Batman (DC Universe Animated) Collection',
  'Batman Collection',
  'Batman: The Dark Knight Returns Collection',
  'Constantine Collection',
  'Joker Collection',
  'Justice League (DCAMU) Collection',
  'Man of Steel Collection',
  'Shazam! Collection',
  'Suicide Squad Collection',
  'Superman (DCU) Collection',
  'Superman Collection',
  'The Batman Collection',
  'The Dark Knight Collection',
  'The Red Hood Collection',
  'Wonder Woman Collection',
]

// Standalone Marvel/DC movies that TMDb doesn't group into any collection
// above and aren't produced under the "Marvel Studios" credit either — a
// small curated exception, same spirit as genreSubsets.js's
// MUSICAL_TMDB_ID_EXCEPTIONS (#150). Confirmed against the current pool.
export const MARVEL_DC_TMDB_ID_EXCEPTIONS = [
  495764, // Birds of Prey and the Fantabulous Emancipation of One Harley Quinn (2020)
  141052, // Justice League (2017)
  791373, // Zack Snyder's Justice League (2021)
  436270, // Black Adam (2022)
  13183, // Watchmen (2009)
  752, // V for Vendetta (2006)
]

export function isMarvelOrDc(movie) {
  return (
    movie.studio === 'Marvel Studios' ||
    MARVEL_DC_COLLECTIONS.includes(movie.collection) ||
    MARVEL_DC_TMDB_ID_EXCEPTIONS.includes(movie.tmdbId)
  )
}

// The Comic Book subset (#181) is deliberately broader than isMarvelOrDc —
// "other comic book movies are allowed here too," so TMDb's `superhero`
// keyword (already curated into KEYWORD_LABELS) fills in non-Marvel/DC
// comic adaptations (Hellboy, Kick-Ass, The Crow, etc.) without needing its
// own allowlist.
export function isComicBook(movie) {
  return isMarvelOrDc(movie) || (movie.keywords || []).includes('superhero')
}
