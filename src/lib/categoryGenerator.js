import {
  isForbiddenPair,
  pairLabel,
  shortDecade,
  stripCollectionSuffix,
  languageName,
  genreLabel,
} from './categoryRules.js'
import { KEYWORD_LABELS } from './curatedAttributes.js'

const MIN_RANKED_FOR_OVERLAP = 5
const MAX_CATEGORY_ATTEMPTS = 50
const RANDOM_FIVE_CHANCE = 0.15
const RANDOM_FIVE_LABEL = 'Random Five'
const ENGLISH_LANGUAGE_CODE = 'en'
const HEAD_TO_HEAD_CHANCE = 0.1
const HEAD_TO_HEAD_LABEL = 'Head to Head'
const HEAD_TO_HEAD_POOL_SIZE = 50
export const HEAD_TO_HEAD_TYPE = 'head-to-head'
// A rarer, tighter-pool variant of Head to Head (#131): 2 movies from the
// current top 10 by eloRating instead of the top 50. Gated behind a higher
// ranked-count threshold than the overlap requirement — with only a
// handful of movies ranked, the "top 10" is arbitrary noise rather than
// movies the user actually cares about.
const TOP_10_TOUGH_CHOICE_CHANCE = 0.04
const TOP_10_TOUGH_CHOICE_LABEL = 'Top 10 Tough Choice'
const TOP_10_TOUGH_CHOICE_POOL_SIZE = 10
const MIN_RANKED_FOR_TOUGH_CHOICE = 50

const ATTRIBUTE_TYPES = [
  'director',
  'genre',
  'decade',
  'year',
  'cast',
  'studio',
  'collection',
  'language',
  'keyword',
]

const LABELS = {
  director: (v) => `Directed by ${v}`,
  genre: (v) => genreLabel(v),
  decade: (v) => `${shortDecade(v)} Movies`,
  year: (v) => `Movies from ${v}`,
  cast: (v) => `Movies starring ${v}`,
  studio: (v) => `${v} Movies`,
  collection: (v) => `${stripCollectionSuffix(v)} Movies`,
  language: (v) => `${languageName(v)} Movies`,
  keyword: (v) => KEYWORD_LABELS[v],
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
    case 'studio':
      return movie.studio ? [movie.studio] : []
    case 'collection':
      return movie.collection ? [movie.collection] : []
    case 'language':
      return movie.originalLanguage && movie.originalLanguage !== ENGLISH_LANGUAGE_CODE
        ? [movie.originalLanguage]
        : []
    case 'keyword':
      return movie.keywords || []
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

// Shared by "Head to Head" and "Top 10 Tough Choice": a 2-movie
// pick-a-winner round drawn from the current top `poolSize` by eloRating
// among already-ranked movies — reinforcing standings the pool has already
// formed an opinion on, rather than linking in new movies, so the usual
// overlap rule doesn't apply here. Returns null if fewer than 2 ranked
// movies (with a real eloRating) are available.
function rankedTopPack(movies, { isRanked, random }, poolSize, label) {
  const ranked = movies
    .filter((m) => isRanked(m) && typeof m.eloRating === 'number')
    .sort((a, b) => b.eloRating - a.eloRating)
    .slice(0, poolSize)
  if (ranked.length < 2) return null
  return { label, movies: sample(ranked, 2, random), type: HEAD_TO_HEAD_TYPE }
}

function headToHeadPack(movies, selectOptions) {
  return rankedTopPack(movies, selectOptions, HEAD_TO_HEAD_POOL_SIZE, HEAD_TO_HEAD_LABEL)
}

// A rarer variant of Head to Head (#131), drawn from just the top 10 by
// eloRating instead of the top 50 — a "tougher" choice since both movies
// are already elite. Gated behind MIN_RANKED_FOR_TOUGH_CHOICE so the top 10
// reflects real signal rather than the first handful of packs ranked.
function toughChoicePack(movies, selectOptions) {
  if (selectOptions.totalRankedCount < MIN_RANKED_FOR_TOUGH_CHOICE) return null
  return rankedTopPack(movies, selectOptions, TOP_10_TOUGH_CHOICE_POOL_SIZE, TOP_10_TOUGH_CHOICE_LABEL)
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
// attribute-based category can find 5 matches. A "Head to Head" 2-movie
// pick-a-winner pack gets thrown in even more occasionally
// (HEAD_TO_HEAD_CHANCE), drawn from the current top 50 ranked movies, and
// an even rarer "Top 10 Tough Choice" variant (TOP_10_TOUGH_CHOICE_CHANCE)
// is checked first, drawn from just the top 10.
export function generateCategory(
  movies,
  { isRanked = () => false, totalRankedCount = 0, random = Math.random } = {},
) {
  const selectOptions = { isRanked, random, totalRankedCount }

  if (random() < TOP_10_TOUGH_CHOICE_CHANCE) {
    const toughChoice = toughChoicePack(movies, selectOptions)
    if (toughChoice) return toughChoice
  }

  if (random() < HEAD_TO_HEAD_CHANCE) {
    const headToHead = headToHeadPack(movies, selectOptions)
    if (headToHead) return headToHead
  }

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
