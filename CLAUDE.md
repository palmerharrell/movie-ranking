# Movie Ranking — Project Spec

## Overview
A React app that builds one continuously-growing pool of movies — starting from
the owner's personal Letterboxd ratings, then expanded over time with other
published lists (AFI Top 100, best-of-decade lists, genre lists, etc.) — and
uses a repeated 5-at-a-time drag-and-drop ranking game to build a full ranking
of every movie in that pool, using an Elo-style rating system.

> **Note:** this spec originally described a personal Letterboxd pool *plus*
> several separate curated lists, switchable via a list picker. That model was
> replaced (see #20/#21/#13) with the single-pool model described here — the
> personal Letterboxd import is just the first source merged into the one list,
> not a separate ranking pool.

> **Status:** this file is the target spec, not a changelog — it describes
> design that may still be open work. Sections referencing an open GitHub
> issue number (e.g. "(#26)") are marked **NOT YET IMPLEMENTED** below if the
> feature doesn't exist on `dev` yet; check the linked issue for current
> status rather than assuming the spec text means it's built.

## Confirmed decisions
- **Data source:** Letterboxd's own CSV export (Settings → Import & Export) for
  the personal-ratings source. No scraping — avoids ToS issues.
- **Metadata enrichment:** TMDb API, since none of the source data (Letterboxd
  export or hand-maintained title/year lists) has director, genre, cast, or
  poster info. Signup steps below.
- **Left panel initial sort:** alphabetical, until the user has ranked movies.
- **Build:** React + Vite, Tailwind for styling. Movie metadata lives in local
  JSON files (no database for metadata). Ranking state (Elo ratings) is persisted
  via a small backend API — see **Online deployment** below.
- **Source control:** GitHub, with GitHub Issues for work items. Branching
  strategy and PR workflow are documented below in **Branching & PR workflow**.
- **One evolving pool, many sources:** there is a single ranking pool, not
  multiple switchable lists. It starts from the owner's personal Letterboxd
  ratings and grows over time as more published lists (AFI Top 100, other
  best-of lists, genre/decade lists, etc.) are merged in. See **Building the
  list** below.

## TMDb signup steps
1. Create a free account at themoviedb.org.
2. Go to Settings → API → Request an API key (choose "Developer", personal use is fine).
3. Copy the "API Read Access Token" (v4 auth) or the API key (v3) — either works.
4. Store it in a local `.env` file as `TMDB_API_KEY=...` — **never commit this file**.

## Building the list
There is one output file, `/data/movies.json`, built by merging multiple
sources. Movies are deduped by TMDb ID — a title appearing in more than one
source (e.g. on both the Letterboxd export and AFI Top 100) is a single entry
with a `sources[]` field listing every source it came from.

- **Personal Letterboxd source** (`scripts/enrich.js`):
  1. Export Letterboxd data as a zip (Settings → Import & Export) — produces
     `films.csv`, the full watched list.
  2. Drop the extracted CSVs into `/data/letterboxd-export/`.
  3. Run `scripts/enrich.js`: parses `films.csv` into unique movies (deduped —
     a rewatch can produce multiple rows for the same title); calls TMDb
     `/search/movie?query={title}&year={year}` for `tmdb_id`, then
     `/movie/{id}?append_to_response=credits` for director, genres, top-billed
     cast, and poster path; upserts each into `/data/movies.json` tagged with
     `sources: ["personal"]`. An entry with no TMDb movie match (e.g. a TV
     series) is skipped rather than written in as a bare placeholder.
  4. Re-run any time the user re-exports fresh Letterboxd data.
- **Published-list sources** (`scripts/enrich-sources.js`):
  - Each source is a hand-maintained `title, year` JSON file under
    `/data/sources/` (e.g. `afi-top-100.source.json`), added as needed — no
    user-facing list management, just files in the repo.
  - `scripts/enrich-sources.js` runs every `/data/sources/*.source.json`
    through the same TMDb enrichment as `scripts/enrich.js` and upserts each
    into `/data/movies.json`, tagging with that source's id (e.g.
    `sources: ["afi-top-100"]`). A movie already present from another source
    gets the new source id appended to its `sources[]` rather than being
    duplicated.

## Data model (`movies.json`)
Each movie: `id, title, year, decade, director, genres[], cast[], posterUrl,
mpaaRating, sources[]`. Static metadata only — `eloRating` and `timesRanked`
live in the backend's ranking-state store instead (see **Online
deployment**). `mpaaRating` is the movie's US MPAA certification (e.g.
`"PG-13"`), fetched from TMDb's `/movie/{id}/release_dates` during
enrichment, or `null` if TMDb has no US certification for it — see **Family
mode**.

## Ranking mechanic (Elo)
- Each right-panel "Rank →" click takes the pack's tiles (5, or fewer if any
  were skipped — see below) in their current drag order and treats it as
  every pairwise outcome (rank 1 beats everyone below it, rank 2 beats
  everyone below it, etc).
- Each pairwise outcome does a standard Elo update on both movies' `eloRating`.
- **Skip ("Haven't Seen"):** each tile has a button to remove that movie from
  the active pack without ranking it (its `eloRating`/`timesRanked` are
  untouched). Ranking proceeds normally as long as 2+ movies remain. If a
  skip would drop the pack to 1 movie, the app discards the pack (without
  submitting any ranking data) and advances to the next pack instead —
  mirroring "Rank →"'s queue-advance behavior, just without the Elo update.
- A movie appearing in two different 5-packs is how the pool becomes
  transitively linked — approximate (Elo doesn't guarantee strict
  transitivity) but converges toward a consistent full ranking as more of the
  pool gets ranked.
- Left panel re-sorts by `eloRating` descending after every "Rank →" click.
  Movies never yet included in a ranked 5-pack stay at their default 1000,
  sorted alphabetically among themselves.
- See **Saved rankings** below for what happens once every movie has been
  ranked at least once.

## Category generation & queue (right panel)
- Categories are built from single or paired attributes: director, genre, release
  year, decade, or cast member.
- Pick either one attribute or a random pair (e.g. decade + genre, genre + actor).
- Filter the pool's movies for matches; if fewer than 5 movies match, discard
  and try another category (don't show the user a category with < 5 eligible
  movies).
- **Random packs:** `categoryGenerator.js` throws in a dedicated "Random Five"
  pack — skipping the attribute filter entirely and sampling 5 movies at
  random from the whole pool — with a 15% chance on each pack generated
  (`RANDOM_FIVE_CHANCE`), and also as the fallback when no attribute-based
  category can find 5 matches (which becomes more likely as the pool grows
  and gets more thoroughly ranked). A Random Five pack still applies the
  overlap requirement below, same as attribute-based packs.
- **Overlap requirement:** once the pool has enough ranked movies to draw
  from, each new 5-pack (attribute-based or random) must include 1–2 movies
  that have already appeared in a previous pack, with the rest being movies
  not yet ranked (or, if the category doesn't have enough not-yet-ranked
  matches, whatever's available). This overlap is what transitively links
  separate 5-packs into one converging ranking — no explicit
  connectivity/island tracking, just this steady overlap rule is expected to
  merge things in practice. Before there are enough ranked movies to satisfy
  it (e.g. very first few packs), fall back to 0 required overlap and just
  pick 5 at random from the matching set.
- Display a plain-language label above the list, e.g. "Directed by Wes Anderson",
  "90s Comedies", "80s movies starring Harrison Ford", "Random Five".
- **Upcoming queue:** rather than a single "next category" generated on
  demand, the app keeps a small queue of pre-generated upcoming packs (3,
  via `PackQueue.jsx`) displayed alongside the active pack, replacing the old
  multi-list picker chips (there's only one pool now, so there's nothing to
  switch between).
  - **"Rank →"** submits the active pack's Elo update, promotes the first
    queued pack to active, and generates one fresh pack to refill the queue.
  - **Clicking a queued pack** discards the current active pack without
    submitting it, promotes the clicked pack to active, and generates one
    fresh pack to refill the queue.
  - Queued packs are generated independently and may overlap each other in
    which movies they include — that's expected, not a bug, since only one of
    them will ever actually get submitted.

## Progress tracking
- `LeftPanel.jsx` shows a label near the standings header: `n/nnn ranked` —
  `n` is the count of movies with `timesRanked ≥ 1`, `nnn` is the total pool
  size.

## Saved rankings
- **Completion:** once every movie in the *currently visible* pool has
  `timesRanked ≥ 1`, show a modal prompting the user to name and save the
  ranking. Outside Family mode "visible pool" is the whole pool; inside
  Family mode it's just the family-safe subset — see **Family mode**.
- **Save:** copies the current per-movie `eloRating`/`timesRanked` for the
  visible pool into a named, timestamped snapshot, then resets that scope's
  live ranking state back to defaults (`eloRating = 1000`, `timesRanked =
  0`) so a fresh ranking run can start from scratch. A full-pool save resets
  the whole pool; a Family-mode save resets only the family-safe subset,
  leaving progress on the rest of the pool untouched. This lets the pool be
  ranked repeatedly over time (e.g. "2026 Draft", "2027 Redo") without the
  runs interfering with each other.
- **Load:** a "Load Ranking" entry point lists saved snapshots by
  name/date/movie count; opening one shows its standings list — only the
  movies that were actually part of that saved run, not the current full
  pool — read-only, and it does not affect or restore live ranking state.

## Online deployment
- **Frontend:** static build hosted on GitHub Pages. It never needs the TMDb key
  at runtime — enrichment is a build-time/offline step (`enrich.js` /
  `enrich-sources.js`), so the deployed site only ever serves already-enriched
  JSON.
- **Backend:** a small Node (Express or Fastify) API on the existing DigitalOcean
  droplet, whose only job is persisting ranking state (Elo ratings/`timesRanked`)
  and saved-ranking snapshots across sessions and devices — everything else
  stays static.
  - Storage: SQLite (`better-sqlite3`) is enough at this scale:
    - `movie_state(movie_id, elo_rating, times_ranked)` — live ranking state,
      seeded from `movies.json` on first load.
    - `saved_rankings(id, name, created_at, data)` — completed snapshots;
      `data` is the JSON-serialized `{movieId, eloRating, timesRanked}[]` at
      save time — only the movies actually in scope for that save (the
      whole pool, or just the family-safe subset for a Family-mode save).
  - Endpoints:
    - `GET /api/movies` — the pool's movies + current `eloRating`/`timesRanked`;
      `?family=true` restricts to the family-safe subset (see **Family mode**)
    - `POST /api/rank` — body: ordered array of 5 movie IDs; server performs
      the 10 pairwise Elo updates, persists, returns updated ratings
    - `GET /api/category` — server picks a random valid category (≥5
      matches, applying the overlap rule), reusing `categoryGenerator.js`
      logic; stateless — safe to call repeatedly to fill the upcoming queue;
      `?family=true` restricts category generation to the family-safe subset
    - `POST /api/rankings` — body: `{name, family}`; snapshots the current
      (optionally family-scoped) `movie_state` into `saved_rankings`, then
      resets just that scope's `movie_state` rows to defaults
    - `GET /api/rankings` — list of saved snapshots (`id`, `name`,
      `createdAt`, `movieCount`)
    - `GET /api/rankings/:id` — a saved snapshot's movies (static metadata +
      snapshot-time `eloRating`, limited to the movies that were part of
      that save), sorted descending, for read-only display
  - Auth: single-user app, so a shared bearer token in an env var, checked on
    every request, is sufficient — no user accounts needed yet.
  - CORS: restrict to the GitHub Pages origin.
  - Process management: `systemd` or `pm2` so it survives reboots/crashes;
    reverse-proxied through Caddy or nginx for TLS.

## UI layout
- **Left panel:** full ranked list of every movie (poster thumbnail + title + year),
  sorted by eloRating. Progress label (`n/nnn ranked`) near the header — see
  **Progress tracking**.
- **Right panel:** the active pack — 5 draggable movie tiles under the category
  label, reorderable via drag-and-drop (`@dnd-kit`) — plus the upcoming-packs
  queue described in **Category generation & queue**.
- **Center-bottom button:** "Rank →" — triggers the Elo update, left-panel
  resort, and queue advance.
- **Banner:** app title, theme toggle, and a "Load Ranking" entry point for
  browsing saved snapshots (see **Saved rankings**). No more list-picker
  chips — there's only one pool.

## Family mode
- **Themes:** the theme toggle has three entries — Classic, Neon, and
  Family — each a `data-theme` value with its own CSS custom-property
  palette in `src/index.css`. Family uses a dark, warm "storybook night"
  palette (deep indigo background, marigold/teal accents) — cheerful without
  being glaring, and visually distinct from Classic/Neon.
- **Filtering:** selecting Family also restricts the pool everywhere (left
  panel, active pack, upcoming queue) to movies whose `mpaaRating` is `G`,
  `PG`, or `PG-13` — see `src/lib/familyMode.js`'s `isFamilySafe`. A movie
  with no confirmed US certification (`mpaaRating: null`) is excluded, not
  assumed safe.
- Filtering happens server-side: `GET /api/movies` and `GET /api/category`
  accept `?family=true` and filter before merging Elo state / generating a
  category, so category generation (overlap rule, attribute matching) only
  ever draws from the family-safe subset.
- Switching Classic ⇄ Neon does not re-fetch (same pool, cosmetic only);
  switching Family mode on/off does, since the pool itself differs.
- **Scoped completion/save:** the "every movie ranked" completion check (see
  **Saved rankings**) operates on the currently-visible pool, so ranking all
  of the family-safe subset while in Family mode triggers the save prompt
  just like finishing the whole pool does outside it. Saving from Family
  mode (`POST /api/rankings` with `family: true`) snapshots and resets only
  the family-safe subset's Elo state — progress on movies outside Family
  mode (e.g. R-rated movies ranked in Classic/Neon) is left untouched. This
  keeps a Family-mode save from either being blocked by unrelated unranked
  movies, or fabricating "ranked" data for movies that were never actually
  compared.

## Suggested project structure
```
/data/letterboxd-export/     <- user drops raw Letterboxd CSVs here
/data/sources/*.source.json  <- hand-maintained title/year lists (AFI Top 100, etc.)
/data/movies.json            <- the one merged, enriched pool
/scripts/enrich.js           <- Letterboxd CSV parse + TMDb enrichment (personal source)
/scripts/enrich-sources.js   <- title/year + TMDb enrichment (published-list sources)
/server/                     <- DigitalOcean backend (Express/Fastify + SQLite)
/server/index.js
/server/db.js
/src/components/LeftPanel.jsx
/src/components/RightPanel.jsx
/src/components/MovieTile.jsx
/src/components/RankButton.jsx
/src/components/PackQueue.jsx        <- upcoming-packs queue
/src/components/SaveRankingModal.jsx <- name/save prompt on completion
/src/components/LoadRankingView.jsx  <- read-only saved-snapshot viewer
/src/lib/elo.js
/src/lib/categoryGenerator.js
.env                          <- TMDB_API_KEY (gitignored)
```

## Maintaining this spec
- When a PR implements a feature marked **NOT YET IMPLEMENTED** above (or
  closes the GitHub issue tied to one of those sections), that same PR must
  remove the marker and the "not yet implemented" caveat text from the
  affected section(s) of this file.
- Conversely, if new spec text is added for planned-but-unbuilt work, mark it
  **NOT YET IMPLEMENTED** with the issue number, per the pattern above, so the
  spec doesn't silently drift ahead of the code again.

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
