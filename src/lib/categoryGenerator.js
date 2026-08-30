import { isForbiddenPair, pairLabel, shortDecade } from './categoryRules.js'

const MIN_RANKED_FOR_OVERLAP = 5
const MAX_CATEGORY_ATTEMPTS = 50
const RANDOM_FIVE_CHANCE = 0.15
const RANDOM_FIVE_LABEL = 'Random Five'

const ATTRIBUTE_TYPES = ['director', 'genre', 'decade', 'year', 'cast']

const LABELS = {
  director: (v) => `Directed by ${v}`,
  genre: (v) => v,
  decade: (v) => `${shortDecade(v)} Movies`,
  year: (v) => `Movies from ${v}`,
  cast: (v) => `Movies starring ${v}`,
}

function attributeValues(movie, type) {
  switch (type) {
    case 'director':
      return movie.director ? [movie.director] : []
    case 'genre':
      return movie.genres || []
    case 'decade':
      return movie.decade ? [movie.decade] : []
    case 'year':
      return movie.year ? [movie.year] : []
    case 'cast':
      return movie.cast || []
    default:
      return []
  }
}

function matchesAttribute(movie, type, value) {
  return attributeValues(movie, type).includes(value)
}

function randomItem(array, random) {
  return array[Math.floor(random() * array.length)]
}

function shuffle(array, random) {
  const copy = [...array]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

function sample(array, n, random) {
  return shuffle(array, random).slice(0, n)
}

function labelFor(picks) {
  if (picks.length === 1) return LABELS[picks[0].type](picks[0].value)
  return pairLabel(picks)
}

// Picks a random single attribute, or a random pair of two different
// attribute types, and returns the movies matching all picked values —
// or null if fewer than 5 movies match.
export function tryBuildCategory(movies, random) {
  const usePair = random() < 0.5
  const types = shuffle(ATTRIBUTE_TYPES, random)
  const picks = []

  const firstType = types[0]
  const firstPool = movies.flatMap((m) => attributeValues(m, firstType))
  if (firstPool.length === 0) return null
  picks.push({ type: firstType, value: randomItem(firstPool, random) })

  if (usePair) {
    const secondType = types.find((t) => t !== firstType && !isForbiddenPair(firstType, t))
    const remaining = movies.filter((m) =>
      matchesAttribute(m, picks[0].type, picks[0].value),
    )
    const secondPool = remaining.flatMap((m) => attributeValues(m, secondType))
    if (secondPool.length > 0) {
      picks.push({ type: secondType, value: randomItem(secondPool, random) })
    }
  }

  const matches = movies.filter((m) =>
    picks.every((p) => matchesAttribute(m, p.type, p.value)),
  )

  if (matches.length < 5) return null

  return { label: labelFor(picks), movies: matches, picks }
}

// Selects 5 movies from `matches` for the pack, applying the overlap rule:
// once the list overall has enough ranked movies, require 1-2 movies that
// have already appeared in a previous pack (isRanked), filling the rest with
// not-yet-ranked movies where possible. Falls back to a fully random pick
// when there isn't enough ranked history yet, or when the category has no
// ranked movies to draw an overlap from.
function selectFivePack(matches, { isRanked, random, totalRankedCount }) {
  const ranked = matches.filter(isRanked)
  const unranked = matches.filter((m) => !isRanked(m))

  const overlapEligible =
    totalRankedCount >= MIN_RANKED_FOR_OVERLAP && ranked.length > 0

  if (!overlapEligible) {
    return sample(matches, 5, random)
  }

  const desiredOverlap = Math.min(2, ranked.length)
  const neededUnranked = 5 - desiredOverlap

  const unrankedPicks = sample(unranked, Math.min(neededUnranked, unranked.length), random)
  const shortfall = 5 - unrankedPicks.length
  const rankedPicks = sample(ranked, Math.min(shortfall, ranked.length), random)

  return shuffle([...unrankedPicks, ...rankedPicks], random)
}

// A "Random Five" pack skips the attribute filter and draws from the whole
// pool, still subject to the same overlap rule as attribute-based packs.
// Returns null if the pool itself is smaller than 5.
function randomFivePack(movies, selectOptions) {
  const pack = selectFivePack(movies, selectOptions)
  if (pack.length !== 5) return null
  return { label: RANDOM_FIVE_LABEL, movies: pack }
}

// Generates a category + 5-pack for the given list of movies.
// `isRanked(movie)` should return whether the movie has appeared in a
// previous pack for this list. `totalRankedCount` is the number of such
// movies in the whole list (used for the overlap-eligibility threshold).
// `random` defaults to Math.random but can be injected for deterministic tests.
//
// Most packs are attribute-based, but a "Random Five" pack — sampled from
// the whole pool with no attribute filter — gets thrown in occasionally
// (RANDOM_FIVE_CHANCE), and also serves as the fallback when no
// attribute-based category can find 5 matches.
export function generateCategory(
  movies,
  { isRanked = () => false, totalRankedCount = 0, random = Math.random } = {},
) {
  const selectOptions = { isRanked, random, totalRankedCount }

  if (random() < RANDOM_FIVE_CHANCE) {
    const randomPack = randomFivePack(movies, selectOptions)
    if (randomPack) return randomPack
  }

  for (let attempt = 0; attempt < MAX_CATEGORY_ATTEMPTS; attempt++) {
    const category = tryBuildCategory(movies, random)
    if (!category) continue
    const pack = selectFivePack(category.movies, selectOptions)
    if (pack.length === 5) {
      return { label: category.label, movies: pack }
    }
  }

  return randomFivePack(movies, selectOptions)
}
