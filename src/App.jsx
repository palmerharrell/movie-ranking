import { useMemo, useState } from 'react'
import { LeftPanel } from './components/LeftPanel.jsx'
import { RightPanel } from './components/RightPanel.jsx'
import { RankButton } from './components/RankButton.jsx'
import { rankFivePack } from './lib/elo.js'
import { generateCategory } from './lib/categoryGenerator.js'
import { sampleMovies } from './lib/sampleMovies.js'

function withRankingState(movies) {
  return movies.map((m) => ({ ...m, eloRating: 1000, timesRanked: 0 }))
}

function pickCategory(movies) {
  const rankedIds = new Set(movies.filter((m) => m.timesRanked > 0).map((m) => m.id))
  return generateCategory(movies, {
    isRanked: (m) => rankedIds.has(m.id),
    totalRankedCount: rankedIds.size,
  })
}

function App() {
  const [movies, setMovies] = useState(() => withRankingState(sampleMovies))
  const [category, setCategory] = useState(() => pickCategory(withRankingState(sampleMovies)))

  const movieMap = useMemo(() => new Map(movies.map((m) => [m.id, m])), [movies])

  function handleReorder(reorderedMovies) {
    setCategory((prev) => ({ ...prev, movies: reorderedMovies }))
  }

  function handleRank() {
    const currentPack = category.movies.map((m) => movieMap.get(m.id))
    const updatedRatings = rankFivePack(currentPack)

    const updatedMovies = movies.map((m) =>
      m.id in updatedRatings
        ? { ...m, eloRating: updatedRatings[m.id], timesRanked: m.timesRanked + 1 }
        : m,
    )

    setMovies(updatedMovies)
    setCategory(pickCategory(updatedMovies) ?? category)
  }

  if (!category) {
    return (
      <div className="flex min-h-screen items-center justify-center text-gray-500">
        Not enough movies to build a category yet.
      </div>
    )
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-5xl flex-col">
      <h1 className="py-6 text-center text-2xl font-semibold">Movie Ranking</h1>
      <div className="flex flex-1 gap-8 px-6 pb-6">
        <div className="w-1/2 border-r border-gray-200 pr-6">
          <LeftPanel movies={movies} />
        </div>
        <div className="flex w-1/2 flex-col items-center gap-6">
          <RightPanel category={category} onReorder={handleReorder} />
          <RankButton onClick={handleRank} />
        </div>
      </div>
    </div>
  )
}

export default App
