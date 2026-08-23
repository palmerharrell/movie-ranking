import { useMemo, useState } from 'react'
import { LeftPanel } from './components/LeftPanel.jsx'
import { RightPanel } from './components/RightPanel.jsx'
import { RankButton } from './components/RankButton.jsx'
import { ListPicker } from './components/ListPicker.jsx'
import { rankFivePack } from './lib/elo.js'
import { generateCategory } from './lib/categoryGenerator.js'
import { sampleMovies } from './lib/sampleMovies.js'
import { sampleCuratedLists } from './lib/sampleCuratedLists.js'

// Per-list movie sources, standing in for the real /data/movies.json +
// enriched curated-list JSON until the backend (issue #10/#11) is wired up.
// Each list_id gets independent Elo state, per CLAUDE.md.
const LIST_SOURCES = {
  personal: sampleMovies,
  ...sampleCuratedLists,
}

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

function initialStateFor(listId) {
  const movies = withRankingState(LIST_SOURCES[listId])
  return { movies, category: pickCategory(movies) }
}

function App() {
  const [activeListId, setActiveListId] = useState('personal')
  const [listState, setListState] = useState(() => ({
    personal: initialStateFor('personal'),
  }))

  const { movies, category } = listState[activeListId] ?? {}
  const movieMap = useMemo(() => new Map((movies || []).map((m) => [m.id, m])), [movies])

  function handleSelectList(listId) {
    setActiveListId(listId)
    setListState((prev) =>
      prev[listId] ? prev : { ...prev, [listId]: initialStateFor(listId) },
    )
  }

  function handleReorder(reorderedMovies) {
    setListState((prev) => ({
      ...prev,
      [activeListId]: { ...prev[activeListId], category: { ...prev[activeListId].category, movies: reorderedMovies } },
    }))
  }

  function handleRank() {
    const currentPack = category.movies.map((m) => movieMap.get(m.id))
    const updatedRatings = rankFivePack(currentPack)

    const updatedMovies = movies.map((m) =>
      m.id in updatedRatings
        ? { ...m, eloRating: updatedRatings[m.id], timesRanked: m.timesRanked + 1 }
        : m,
    )
    const newCategory = pickCategory(updatedMovies) ?? category

    setListState((prev) => ({
      ...prev,
      [activeListId]: { movies: updatedMovies, category: newCategory },
    }))
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-5xl flex-col">
      <h1 className="pt-6 text-center text-2xl font-semibold">Movie Ranking</h1>
      <ListPicker activeListId={activeListId} onSelect={handleSelectList} />
      <div className="flex flex-1 gap-8 px-6 pb-6">
        <div className="w-1/2 border-r border-gray-200 pr-6">
          <LeftPanel movies={movies} />
        </div>
        <div className="flex w-1/2 flex-col items-center gap-6">
          {category ? (
            <RightPanel category={category} onReorder={handleReorder} />
          ) : (
            <p className="text-gray-500">Not enough movies to build a category yet.</p>
          )}
          <RankButton onClick={handleRank} disabled={!category} />
        </div>
      </div>
    </div>
  )
}

export default App
