import { useEffect, useState } from 'react'
import { LeftPanel } from './components/LeftPanel.jsx'
import { RightPanel } from './components/RightPanel.jsx'
import { PackQueue } from './components/PackQueue.jsx'
import { RankButton } from './components/RankButton.jsx'
import { ThemeToggle } from './components/ThemeToggle.jsx'
import * as api from './lib/api.js'

const THEME_STORAGE_KEY = 'movie-ranking-theme'
const QUEUE_SIZE = 3

function initialTheme() {
  const stored = localStorage.getItem(THEME_STORAGE_KEY)
  return stored === 'classic' || stored === 'neon' ? stored : 'classic'
}

function App() {
  const [theme, setTheme] = useState(initialTheme)
  const [movies, setMovies] = useState(null)
  // packs[0] is the active pack; packs[1..] is the upcoming queue.
  const [packs, setPacks] = useState(null)
  const [error, setError] = useState(null)
  const [ranking, setRanking] = useState(false)

  const category = packs?.[0] ?? null
  const queue = packs?.slice(1) ?? []

  useEffect(() => {
    localStorage.setItem(THEME_STORAGE_KEY, theme)
  }, [theme])

  useEffect(() => {
    api.getMovies().then(setMovies).catch((err) => setError(err.message))
    Promise.all(Array.from({ length: QUEUE_SIZE + 1 }, () => api.getCategory()))
      .then(setPacks)
      .catch((err) => setError(err.message))
  }, [])

  function handleReorder(reorderedMovies) {
    setPacks((prev) => [{ ...prev[0], movies: reorderedMovies }, ...prev.slice(1)])
  }

  async function handleRank() {
    setRanking(true)
    try {
      const movieIds = category.movies.map((m) => m.id)
      const [updatedMovies, freshPack] = await Promise.all([
        api.rankFivePack(movieIds),
        api.getCategory(),
      ])
      setMovies(updatedMovies)
      setPacks((prev) => [...prev.slice(1), freshPack])
    } catch (err) {
      setError(err.message)
    } finally {
      setRanking(false)
    }
  }

  async function handleSelectQueued(queueIndex) {
    try {
      const freshPack = await api.getCategory()
      setPacks((prev) => {
        const packIndex = queueIndex + 1
        const selected = prev[packIndex]
        const rest = prev.filter((_, i) => i !== 0 && i !== packIndex)
        return [selected, ...rest, freshPack]
      })
    } catch (err) {
      setError(err.message)
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
            className={`flex min-h-0 flex-col items-center overflow-y-auto px-8 ${
              theme === 'neon' ? 'py-4' : 'py-[26px]'
            }`}
          >
            <div className="w-full max-w-xl">
              {category ? (
                <RightPanel category={category} onReorder={handleReorder} theme={theme} />
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
              {category && <PackQueue queue={queue} theme={theme} onSelect={handleSelectQueued} />}
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
