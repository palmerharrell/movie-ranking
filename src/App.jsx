import { useEffect, useState } from 'react'
import { LeftPanel } from './components/LeftPanel.jsx'
import { RightPanel } from './components/RightPanel.jsx'
import { RankButton } from './components/RankButton.jsx'
import { ListPicker } from './components/ListPicker.jsx'
import * as api from './lib/api.js'

function App() {
  const [lists, setLists] = useState([])
  const [activeListId, setActiveListId] = useState(null)
  const [movies, setMovies] = useState(null)
  const [category, setCategory] = useState(null)
  const [error, setError] = useState(null)
  const [ranking, setRanking] = useState(false)

  useEffect(() => {
    api
      .getLists()
      .then((data) => {
        setLists(data)
        if (data.length > 0) setActiveListId(data[0].id)
      })
      .catch((err) => setError(err.message))
  }, [])

  useEffect(() => {
    if (!activeListId) return
    setError(null)
    setMovies(null)
    setCategory(null)
    api.getListMovies(activeListId).then(setMovies).catch((err) => setError(err.message))
    api.getCategory(activeListId).then(setCategory).catch((err) => setError(err.message))
  }, [activeListId])

  function handleReorder(reorderedMovies) {
    setCategory((prev) => ({ ...prev, movies: reorderedMovies }))
  }

  async function handleRank() {
    setRanking(true)
    try {
      const movieIds = category.movies.map((m) => m.id)
      const updatedMovies = await api.rankFivePack(activeListId, movieIds)
      const nextCategory = await api.getCategory(activeListId)
      setMovies(updatedMovies)
      setCategory(nextCategory)
    } catch (err) {
      setError(err.message)
    } finally {
      setRanking(false)
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-5xl flex-col">
      <h1 className="pt-6 text-center text-2xl font-semibold">Movie Ranking</h1>
      {lists.length > 0 && (
        <ListPicker lists={lists} activeListId={activeListId} onSelect={setActiveListId} />
      )}
      <div className="flex flex-1 gap-8 px-6 pb-6">
        <div className="w-1/2 border-r border-gray-200 pr-6">
          {movies ? (
            <LeftPanel movies={movies} />
          ) : error ? (
            <p className="text-red-600">{error}</p>
          ) : (
            <p className="text-gray-500">Loading…</p>
          )}
        </div>
        <div className="flex w-1/2 flex-col items-center gap-6">
          {category ? (
            <RightPanel category={category} onReorder={handleReorder} />
          ) : error ? (
            <p className="text-red-600">{error}</p>
          ) : movies ? (
            <p className="text-gray-500">Not enough movies to build a category yet.</p>
          ) : (
            <p className="text-gray-500">Loading…</p>
          )}
          <RankButton onClick={handleRank} disabled={!category || ranking} />
        </div>
      </div>
    </div>
  )
}

export default App
