const K_FACTOR = 32

function expectedScore(ratingA, ratingB) {
  return 1 / (1 + 10 ** ((ratingB - ratingA) / 400))
}

// One pairwise Elo update. `winner`/`loser` are { id, eloRating }.
// Returns the two updated ratings, keyed by id.
export function applyPairwiseResult(winner, loser) {
  const expectedWinner = expectedScore(winner.eloRating, loser.eloRating)
  const expectedLoser = expectedScore(loser.eloRating, winner.eloRating)
  return {
    [winner.id]: winner.eloRating + K_FACTOR * (1 - expectedWinner),
    [loser.id]: loser.eloRating + K_FACTOR * (0 - expectedLoser),
  }
}

// Takes 2-5 movies in ranked order (index 0 = rank 1, best) — a pack can
// shrink below 5 when movies are skipped via "Haven't Seen" — and produces
// every pairwise outcome (each movie beats every movie ranked below it),
// applying a standard Elo update sequentially for each. Returns a map of
// { [movieId]: newEloRating } for every movie in the pack.
export function rankPack(orderedMovies) {
  if (orderedMovies.length < 2 || orderedMovies.length > 5) {
    throw new Error('rankPack requires between 2 and 5 movies')
  }

  const ratings = new Map(
    orderedMovies.map((m) => [m.id, m.eloRating]),
  )

  for (let i = 0; i < orderedMovies.length; i++) {
    for (let j = i + 1; j < orderedMovies.length; j++) {
      const winner = { id: orderedMovies[i].id, eloRating: ratings.get(orderedMovies[i].id) }
      const loser = { id: orderedMovies[j].id, eloRating: ratings.get(orderedMovies[j].id) }
      const updated = applyPairwiseResult(winner, loser)
      ratings.set(winner.id, updated[winner.id])
      ratings.set(loser.id, updated[loser.id])
    }
  }

  return Object.fromEntries(ratings)
}
