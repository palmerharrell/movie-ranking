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

> **Setup & data pipeline:** TMDb API signup and the enrichment scripts that
> build `/data/movies.json` are documented in the `tmdb-setup` and
> `enrich-movie-data` skills (`.claude/skills/`) rather than here, since
> they're one-time/occasional workflows, not everyday context.

## Data model (`movies.json`)
Each movie: `id, title, year, decade, director, genres[], cast[], posterUrl,
mpaaRating, studio, collection, originalLanguage, keywords[], voteCount,
sources[]`.
Static metadata only — `eloRating` and `timesRanked` live in the browser's
local ranking state instead (see **Online deployment**). `mpaaRating` is the
movie's US MPAA certification (e.g. `"PG-13"`), fetched from TMDb's
`/movie/{id}/release_dates` during enrichment, or `null` if TMDb has no US
certification for it — see **Family mode**. `studio` is the movie's
production company if it matches a curated allowlist of notable studios
(`NOTABLE_STUDIOS` in `src/lib/curatedAttributes.js`), or `null` otherwise —
TMDb lists several production companies per movie, most too obscure to be a
useful category, so only allowlisted matches are kept. `collection` is
TMDb's franchise/collection name (e.g. `"Knives Out Collection"`), or `null`
if the movie isn't part of one. `originalLanguage` is TMDb's ISO 639-1
original-language code (e.g. `"fr"`). `keywords[]` is the subset of TMDb's
keyword tags that match a curated allowlist (`KEYWORD_LABELS` in
`src/lib/curatedAttributes.js`) — TMDb keyword data is high-cardinality and
mostly one-off per movie, so only allowlisted tags are kept (can be empty).
`voteCount` is TMDb's `vote_count` from `/movie/{id}` — a stable "how
mainstream/well-known is this" proxy, used to build the Popular subset (see
below) — or `null` if TMDb has no vote data for it.

## Popular subset (#104)
`GET /api/movies` also accepts `?popular=true` (composable with
`?family=true`), which restricts the pool to the top
`POPULAR_POOL_SIZE` (`src/lib/popularMode.js`) movies by `voteCount`
descending (`null`/missing sorts last). When combined with `family`, family
filtering is applied first so "popular" always means "top-N within whatever
scope is already active." This exists purely as data/filtering plumbing
today — **NOT YET IMPLEMENTED**: there is no UI entry point to turn Popular
mode on, no default-subset behavior, and no theme changes; that's tracked in
#146, which also removes the Classic/Neon themes and replaces the theme
toggle with a subset picker defaulting to Popular.

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
  Skip is persistent (#136), not just for the active pack: a skipped movie
  is marked "haven't seen" in this browser's local state
  (`src/lib/localRankingStore.js`) and is permanently excluded from future
  pack generation and from the ranked-progress denominator (see **Progress
  tracking**), until un-skipped. The only way to undo a skip today is the
  in-pack "undo" while that pack is still active (`onUndoSkip`) — a
  dedicated "Skipped" view for browsing/un-skipping/clearing the whole list
  later is tracked separately (#137, **NOT YET IMPLEMENTED**). Skipped state
  survives Reset/Save (it's a fact about the viewer, not about a ranking
  run — see **Saved rankings**).
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
  year, decade, cast member, studio, franchise/collection, original language, or
  keyword/tag.
- Pick either one attribute or a random pair (e.g. decade + genre, genre + actor).
  `collection` and `keyword` are single-attribute only — never paired with
  another attribute (`isForbiddenPair` in `src/lib/categoryRules.js`), since
  collections rarely have 5+ pool entries to begin with and keyword labels
  ("Based on a True Story") don't compose grammatically the way decade/genre/
  director/studio/language modifiers do. `language` excludes English — the
  pool skews heavily English, so an "English Movies" category would be
  near-universal and low-signal.
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
- **Head to Head packs:** `categoryGenerator.js` also throws in a "Head to
  Head" pack — 2 movies instead of 5, drawn at random from the current top 50
  ranked movies by `eloRating` — with a 10% chance on each pack generated
  (`HEAD_TO_HEAD_CHANCE`), checked before the Random Five chance. Falls
  through to the normal pack flow if fewer than 2 ranked movies (with a real
  `eloRating`) are available yet. Since both movies are already-ranked, a
  Head to Head pack has no "Haven't Seen" skip button, no drag-and-drop, and
  no separate "Rank →" confirmation — clicking one of the two movies submits
  a single pairwise Elo update (`HeadToHeadPanel.jsx`) and advances the queue
  like any other pack, but not immediately (#135): the winner first slides
  toward center while the loser slides off and fades out (350ms, matching
  the `.head-to-head-card` CSS transition duration), then the loser is
  removed and the winner grows to fill the freed-up row, held there alone
  for about 1.6s before the pick is actually submitted and the pack
  advances. It doesn't apply the overlap requirement below — reinforcing
  standings among movies the pool has already ranked isn't about linking in
  new movies.
- **Top 10 Tough Choice packs (#131):** a rarer variant of Head to Head —
  same 2-movie pick-a-winner UI and submission flow (`HeadToHeadPanel.jsx`,
  `type: 'head-to-head'`) — but drawn from just the current top 10 ranked
  movies by `eloRating` instead of the top 50, with a 4% chance
  (`TOP_10_TOUGH_CHOICE_CHANCE`), checked before the regular Head to Head
  chance. Only becomes possible once at least 50 movies have been ranked
  (`MIN_RANKED_FOR_TOUGH_CHOICE`) — below that, the "top 10" would just be
  whichever handful of movies got ranked first, not movies the user actually
  cares about. Falls through to the normal pack flow if the threshold isn't
  met or fewer than 2 ranked movies are available.
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
  demand, the app keeps a small queue of pre-generated upcoming packs (8,
  via `PackQueue.jsx`, `QUEUE_SIZE` in `App.jsx` — #134) displayed alongside
  the active pack, replacing the old multi-list picker chips (there's only
  one pool now, so there's nothing to switch between).
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
  size minus the number of skipped ("haven't seen") movies (#136) — see
  **Skip ("Haven't Seen")** above.
- Below that label, when the skipped count is nonzero, a second line reads
  `n skipped` (#136).

## Saved rankings
- **Completion:** once every non-skipped movie in the *currently visible*
  pool has `timesRanked ≥ 1`, show a modal prompting the user to name and
  save the ranking. Outside Family mode "visible pool" is the whole pool
  minus skipped movies; inside Family mode it's the family-safe subset minus
  skipped movies — see **Family mode** and **Skip ("Haven't Seen")** (#136).
- **Save:** the browser posts the current per-movie `eloRating`/`timesRanked`
  for the visible, non-skipped pool (gathered from its own local ranking
  state — see
  **Online deployment**) to the server as a named, timestamped snapshot, then
  resets that scope's local ranking state back to defaults (`eloRating =
  1000`, `timesRanked = 0`) so a fresh ranking run can start from scratch. A
  full-pool save resets the whole pool; a Family-mode save resets only the
  family-safe subset, leaving progress on the rest of the pool untouched.
  This lets the pool be ranked repeatedly over time (e.g. "2026 Draft",
  "2027 Redo") without the runs interfering with each other. Every saved
  snapshot is stamped with the creating browser's client id (see **Online
  deployment**), reserved for a future feature restricting edits/re-ranks to
  the ranking's creator (#115) — not yet enforced anywhere.
- **Load:** a "Load Ranking" entry point lists saved snapshots by
  name/date/movie count; opening one displays it via the same tiered Results
  screen shown on live completion (#107, `ResultsScreen.jsx` reused by
  `LoadRankingView.jsx` with `readOnly` — Top 10 grid, 11-25 and 26-100
  tiers, and anything outside the snapshot's top 100) — only the movies that
  were actually part of that saved run, not the current full pool —
  read-only (no Save Ranking button; a "Back to list" link replaces it), and
  it does not affect or restore live ranking state.

## Online deployment
- **Frontend:** static build hosted on GitHub Pages. It never needs the TMDb key
  at runtime — enrichment is a build-time/offline step (`enrich.js` /
  `enrich-sources.js`), so the deployed site only ever serves already-enriched
  JSON.
- **In-progress ranking state lives in the browser, not the server** (#115).
  `eloRating`/`timesRanked` for a run in progress are kept in `localStorage`
  (`src/lib/localRankingStore.js`), computed with the same `elo.js`/
  `categoryGenerator.js`/`familyMode.js` logic the server used to run — those
  modules are framework-agnostic and now run client-side instead. This is a
  deliberate change from the app's original single-user design: since the
  deployed site is reachable by more than one person at once (e.g. several
  family members ranking on their own devices in Family mode), a shared
  server-side ranking state let one visitor's clicks clobber another's. A
  consequence is that in-progress state no longer syncs across a single
  person's own devices — only completed, named snapshots do (see below). Each
  browser also holds a durable random client id (`src/lib/clientId.js`),
  generated once and reused, unrelated to any account.
- **Backend:** a small Node (Express or Fastify) API on the existing DigitalOcean
  droplet, whose only job is persisting completed saved-ranking snapshots
  across sessions and devices, plus serving the pool's static metadata —
  everything else stays static or lives client-side.
  - Storage: SQLite (`better-sqlite3`) is enough at this scale:
    - `saved_rankings(id, name, created_at, data, owner_client_id)` —
      completed snapshots; `data` is the JSON-serialized
      `{movieId, eloRating, timesRanked}[]` at save time — only the movies
      actually in scope for that save (the whole pool, or just the
      family-safe subset for a Family-mode save). `owner_client_id` is the
      creating browser's client id — reserved for a future edit/re-rank
      feature restricted to the ranking's creator (#115); not yet enforced by
      any endpoint.
  - Endpoints:
    - `GET /api/movies` — the pool's static metadata only, no ranking state;
      `?family=true` restricts to the family-safe subset (see **Family
      mode**). The client merges this with its own local ranking state.
    - `POST /api/rankings` — body: `{name, family, entries, clientId}`, where
      `entries` is the `{movieId, eloRating, timesRanked}[]` the browser
      gathered from its own local ranking state; the server just persists it
      tagged with `clientId` as `owner_client_id`. The browser resets its own
      local state for that scope after a successful save.
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
- `GET /api/movies?family=true` filters the pool's static metadata
  server-side; the client then merges in its own local ranking state and
  generates categories from that filtered set, so category generation
  (overlap rule, attribute matching) only ever draws from the family-safe
  subset.
- Switching Classic ⇄ Neon does not re-fetch (same pool, cosmetic only);
  switching Family mode on/off does, since the pool itself differs.
- **Scoped completion/save:** the "every movie ranked" completion check (see
  **Saved rankings**) operates on the currently-visible pool, so ranking all
  of the family-safe subset while in Family mode triggers the save prompt
  just like finishing the whole pool does outside it. Saving from Family
  mode (`api.saveRanking(name, { family: true })`) snapshots and resets only
  the family-safe subset's local Elo state — progress on movies outside
  Family mode (e.g. R-rated movies ranked in Classic/Neon) is left untouched. This
  keeps a Family-mode save from either being blocked by unrelated unranked
  movies, or fabricating "ranked" data for movies that were never actually
  compared.

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
  something to stop per-task. Exception: if the task changed any code under
  `server/`, restart it (kill the running process, start a fresh `node
  index.js`) before finishing, so the running instance reflects the change.
- Close any browser tabs opened for testing.
- Check `git branch -a` / `git worktree list` for stray branches or worktrees
  created during the task and remove ones no longer needed (especially after a
  PR merges — see **Branching & PR workflow** above).
