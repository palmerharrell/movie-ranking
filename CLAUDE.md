# Movie Ranking — Project Spec

## Overview
A React app that pulls a user's rated/liked/reviewed movies from Letterboxd — or
one of several curated "Top 100" style lists — then uses a repeated 5-at-a-time
drag-and-drop ranking game to build a full ranking of every movie in that pool,
using an Elo-style rating system.

## Confirmed decisions
- **Data source:** Letterboxd's own CSV export (Settings → Import & Export). No
  scraping — avoids ToS issues.
- **Metadata enrichment:** TMDb API, since Letterboxd's export has no director,
  genre, cast, or poster info. Signup steps below.
- **Left panel initial sort:** alphabetical, until the user has ranked movies.
- **Build:** React + Vite, Tailwind for styling. Movie metadata lives in local
  JSON files (no database for metadata). Ranking state (Elo ratings) is persisted
  via a small backend API — see **Online deployment** below.
- **Source control:** GitHub, with GitHub Issues for work items. Branching
  strategy and PR workflow are documented below in **Branching & PR workflow**.
- **Multiple ranking pools:** in addition to the user's personal Letterboxd list,
  the app supports ranking curated static lists (e.g. "Top 100 Movies of the 80s",
  "Top 100 Comedies", "Top 80s Action Movies"). See **Curated lists** below.

## TMDb signup steps
1. Create a free account at themoviedb.org.
2. Go to Settings → API → Request an API key (choose "Developer", personal use is fine).
3. Copy the "API Read Access Token" (v4 auth) or the API key (v3) — either works.
4. Store it in a local `.env` file as `TMDB_API_KEY=...` — **never commit this file**.

## Data pipeline
1. User exports their Letterboxd data as a zip (produces `ratings.csv`, `diary.csv`,
   `reviews.csv`, `likes/films.csv`, `watched.csv`).
2. User drops the extracted CSVs into `/data/letterboxd-export/`.
3. Run `scripts/enrich.js` (one-time Node script):
   - Parses the CSVs, merges into one list of unique movies with: title, year,
     letterboxd rating (if rated), liked (bool), reviewed (bool), review text.
   - For each movie, calls TMDb `/search/movie?query={title}&year={year}` to get
     `tmdb_id`, then `/movie/{id}?append_to_response=credits` for director, genres,
     top-billed cast, and poster path.
   - Writes the merged, enriched result to `/data/movies.json`.
   - Re-run any time the user re-exports fresh Letterboxd data.

## Data model (`movies.json`)
Each movie: `id, title, year, decade, director, genres[], cast[], posterUrl,
letterboxdRating, liked, reviewed`. Static metadata only — `eloRating` and
`timesRanked` live in the backend's ranking-state store instead (see **Online
deployment**), scoped per list.

## Curated lists
- Alongside the user's personal Letterboxd pool, the app offers curated static
  lists to rank instead — e.g. "Top 100 Movies of the 60s/70s/80s/90s", "Top 100
  Comedies/Thrillers/Sci-Fi/Fantasy", "Top 80s Action Movies", "Top 90s Comedies".
- Each curated list is a hand-maintained `title, year` JSON file under
  `/data/curated-lists/` (e.g. `top-100-80s.json`), added to or edited as needed
  during development — no user-facing list management, just files in the repo.
- `/data/curated-lists/manifest.json` lists `{id, label}` for every available
  list; this is what populates the "choose what to rank" picker in the UI and
  what the backend's `GET /api/lists` serves.
- `scripts/enrich-curated.js` runs each curated list's `title, year` pairs through
  the same TMDb enrichment logic as `scripts/enrich.js`, producing the enriched
  JSON for that list.
- The personal Letterboxd pool is just another list in this system (e.g.
  `list_id = "personal"`), so it shares the same picker, API, and per-list Elo
  scoping as curated lists.

## Ranking mechanic (Elo)
- Each right-panel "Rank →" click takes the 5 tiles in their current drag order
  (rank 1–5) and treats it as 10 pairwise outcomes (1 beats 2,3,4,5 / 2 beats 3,4,5 / etc).
- Each pairwise outcome does a standard Elo update on both movies' `eloRating`.
- **Elo ratings are scoped per list, not global.** A movie appearing in two
  different 5-packs *within the same list* is how that list becomes transitively
  linked — approximate (Elo doesn't guarantee strict transitivity) but converges
  toward a consistent full ranking as more of that list gets ranked. Ranking
  progress on "Top 80s Action Movies" must not affect that movie's rating in the
  personal Letterboxd list or any other curated list — each list keeps its own
  independent Elo state, keyed by `(list_id, movie_id)`.
- Left panel re-sorts by `eloRating` descending (within the current list) after
  every "Rank →" click. Movies never yet included in a ranked 5-pack for that
  list stay at their default 1000, sorted alphabetically among themselves.

## Category generation (right panel)
- Categories are built from single or paired attributes: director, genre, release
  year, decade, or cast member.
- Pick either one attribute or a random pair (e.g. decade + genre, genre + actor).
- Filter the *current list's* movies for matches; if fewer than 5 movies match,
  discard and try another category (don't show the user a category with < 5
  eligible movies).
- **Overlap requirement:** once the list has enough ranked movies to draw from,
  each new 5-pack must include 1–2 movies that have already appeared in a
  previous pack for this list, with the rest being movies not yet ranked (or, if
  the category doesn't have enough not-yet-ranked matches, whatever's available).
  This overlap is what transitively links separate 5-packs into one converging
  ranking — no explicit connectivity/island tracking, just this steady overlap
  rule is expected to merge things in practice. Before there are enough ranked
  movies to satisfy it (e.g. very first few packs for a list), fall back to 0
  required overlap and just pick 5 at random from the matching set.
- Display a plain-language label above the list, e.g. "Directed by Wes Anderson",
  "90s Comedies", "80s movies starring Harrison Ford".
- After "Rank →" is clicked, generate a fresh random category (from the same
  list) to replace the 5-pack.

## Online deployment
- **Frontend:** static build hosted on GitHub Pages. It never needs the TMDb key
  at runtime — enrichment is a build-time/offline step (`enrich.js` /
  `enrich-curated.js`), so the deployed site only ever serves already-enriched
  JSON.
- **Backend:** a small Node (Express or Fastify) API on the existing DigitalOcean
  droplet, whose only job is persisting ranking state (Elo ratings/`timesRanked`)
  across sessions and devices — everything else stays static.
  - Storage: SQLite (`better-sqlite3`) is enough at this scale — one table
    `movie_state(list_id, movie_id, elo_rating, times_ranked)`, seeded from each
    list's enriched JSON on first load. No separate DB server needed.
  - Endpoints:
    - `GET /api/lists` — available ranking pools (personal + curated), from
      `manifest.json`
    - `GET /api/lists/:listId/movies` — that list's movies + current
      `eloRating`/`timesRanked`
    - `POST /api/lists/:listId/rank` — body: ordered array of 5 movie IDs; server
      performs the 10 pairwise Elo updates, persists, returns updated ratings
    - `GET /api/lists/:listId/category` — server picks a random valid category
      (≥5 matches) for that list, reusing `categoryGenerator.js` logic
  - Auth: single-user app, so a shared bearer token in an env var, checked on
    every request, is sufficient — no user accounts needed yet.
  - CORS: restrict to the GitHub Pages origin.
  - Process management: `systemd` or `pm2` so it survives reboots/crashes;
    reverse-proxied through Caddy or nginx for TLS.

## UI layout
- **Left panel:** full ranked list of every movie (poster thumbnail + title + year),
  sorted by eloRating.
- **Right panel:** 5 draggable movie tiles under the category label, reorderable via
  drag-and-drop (use `@dnd-kit` — actively maintained, unlike react-beautiful-dnd).
- **Center-bottom button:** "Rank →" — triggers the Elo update, left-panel resort,
  and new category generation.

## Suggested project structure
```
/data/letterboxd-export/          <- user drops raw CSVs here
/data/movies.json                 <- enriched personal Letterboxd dataset
/data/curated-lists/manifest.json <- {id, label} for each curated list
/data/curated-lists/*.json        <- enriched curated list datasets
/scripts/enrich.js                <- CSV parse + TMDb enrichment script (personal)
/scripts/enrich-curated.js        <- title/year + TMDb enrichment (curated lists)
/server/                          <- DigitalOcean backend (Express/Fastify + SQLite)
/server/index.js
/server/db.js
/src/components/LeftPanel.jsx
/src/components/RightPanel.jsx
/src/components/MovieTile.jsx
/src/components/RankButton.jsx
/src/components/ListPicker.jsx
/src/lib/elo.js
/src/lib/categoryGenerator.js
.env                               <- TMDB_API_KEY (gitignored)
```

## First steps for Claude Code
1. Scaffold Vite + React + Tailwind project.
2. Set up `.env` handling and `scripts/enrich.js` for the Letterboxd CSV → TMDb
   enrichment pipeline.
3. Build `elo.js` and `categoryGenerator.js` as pure functions first (easy to test
   in isolation before wiring up UI).
4. Build LeftPanel and RightPanel components, wire up dnd-kit for drag reordering.
5. Wire the "Rank →" button to run the Elo update, resort, and regenerate category.
6. Add curated lists: `enrich-curated.js`, `manifest.json`, and a `ListPicker`
   component to choose between the personal list and curated lists.
7. Build the backend (`/server`) with the endpoints in **Online deployment**, and
   point the frontend at it for ranking state instead of local JSON writes.
8. Deploy: frontend to GitHub Pages, backend to the DigitalOcean droplet.

## Branching & PR workflow
- **`main`** is the deployed branch — pushing to `main` triggers
  `.github/workflows/deploy.yml` (GitHub Pages build/deploy). Nothing lands on
  `main` except by merging a PR from `dev`.
- **`dev`** is the integration branch. Feature/fix work branches off `dev`, and
  PRs merge back into `dev`. Once `dev` is in a good state, open a PR from
  `dev` → `main` to release/deploy.
- **Per-task branches:** for any non-trivial task (a GitHub issue, a feature, a
  fix), create a branch off `dev` — e.g. `issue-17-theme-redesign` or
  `fix/rank-button-disabled-state` — rather than committing directly to `dev`.
  Use `git worktree add` for the branch so it gets its own working directory
  (keeps `node_modules`/dev servers isolated per task and avoids clobbering
  in-progress work in the main checkout).
- **Pull requests:** open a PR (`gh pr create`) for branch → `dev` and for
  `dev` → `main`, rather than pushing straight to either. Fill in a summary and
  test plan per the usual PR conventions.
- **After merge:** delete the merged branch (`git push origin --delete
  <branch>` / `git branch -d <branch>`) and remove its worktree
  (`git worktree remove <path>`) — see **Dev/test cleanup** below.

## Dev/test cleanup
When wrapping up a task that involved running the app locally (e.g. `npm run dev`
for visual verification), clean up before finishing:
- Stop any `vite`/frontend dev server processes you started.
- Leave the `server/` backend (`node index.js`, port 3001) running if it was
  already running before you started — it's a long-lived local process, not
  something to stop per-task.
- Close any browser tabs opened for testing.
- Check `git branch -a` / `git worktree list` for stray branches or worktrees
  created during the task and remove ones no longer needed (especially after a
  PR merges — see **Branching & PR workflow** above).
