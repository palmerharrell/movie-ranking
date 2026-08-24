import { useEffect, useState } from 'react'
import { LeftPanel } from './components/LeftPanel.jsx'
import { RightPanel } from './components/RightPanel.jsx'
import { RankButton } from './components/RankButton.jsx'
import { ListPicker } from './components/ListPicker.jsx'
import { ThemeToggle } from './components/ThemeToggle.jsx'
import * as api from './lib/api.js'

const THEME_STORAGE_KEY = 'movie-ranking-theme'

function initialTheme() {
  const stored = localStorage.getItem(THEME_STORAGE_KEY)
  return stored === 'classic' || stored === 'neon' ? stored : 'classic'
}

function App() {
  const [theme, setTheme] = useState(initialTheme)
  const [lists, setLists] = useState([])
  const [activeListId, setActiveListId] = useState(null)
  const [movies, setMovies] = useState(null)
  const [category, setCategory] = useState(null)
  const [error, setError] = useState(null)
  const [ranking, setRanking] = useState(false)

  useEffect(() => {
    localStorage.setItem(THEME_STORAGE_KEY, theme)
  }, [theme])

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
    <div data-theme={theme} className="app-shell flex h-screen flex-col overflow-hidden">
      <div className="mx-auto flex h-full w-full max-w-[1120px] min-h-0 flex-col">
        <header className="banner flex shrink-0 items-center justify-between px-8">
          <div className="flex items-center gap-3">
            {theme === 'classic' && (
              <div className="flex items-center gap-1.5">
                <span className="marquee-bulb" />
                <span className="marquee-bulb pulsing" />
                <span className="marquee-bulb pulsing" style={{ animationDelay: '1.2s' }} />
              </div>
            )}
            <h1 className="app-title">
              {theme === 'neon' ? (
                <>
                  Movie <span className="accent">Ranking</span>
                </>
              ) : (
                'Movie Ranking'
              )}
            </h1>
          </div>
          <div className="flex items-center">
            {lists.length > 0 && (
              <ListPicker lists={lists} activeListId={activeListId} onSelect={setActiveListId} />
            )}
            <ThemeToggle theme={theme} onChange={setTheme} />
          </div>
        </header>

        <div
          className={`grid min-h-0 flex-1 ${
            theme === 'classic' ? 'grid-cols-[340px_1px_1fr]' : 'grid-cols-[340px_1fr]'
          }`}
        >
          <aside
            className="standings-col min-h-0"
            style={{ padding: '22px 8px 22px 22px' }}
          >
            {movies ? (
              <LeftPanel movies={movies} />
            ) : error ? (
              <p className="text-sm text-red-400">{error}</p>
            ) : (
              <p className="text-sm" style={{ color: 'var(--text-low)' }}>
                Loading…
              </p>
            )}
          </aside>

          {theme === 'classic' && <div className="standings-divider" />}

          <main
            className={`flex min-h-0 flex-col items-center overflow-hidden px-8 ${
              theme === 'neon' ? 'py-4' : 'py-[26px]'
            }`}
          >
            <div className="w-full max-w-xl">
              {category ? (
                <RightPanel category={category} onReorder={handleReorder} />
              ) : error ? (
                <p className="text-sm text-red-400">{error}</p>
              ) : movies ? (
                <p className="text-sm" style={{ color: 'var(--text-low)' }}>
                  Not enough movies to build a category yet.
                </p>
              ) : (
                <p className="text-sm" style={{ color: 'var(--text-low)' }}>
                  Loading…
                </p>
              )}
              <div className="mt-4">
                <RankButton onClick={handleRank} disabled={!category || ranking} />
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  )
}

export default App
