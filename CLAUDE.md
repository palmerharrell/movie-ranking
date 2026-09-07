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
productionCountries[], sources[]`.
Static metadata only — `eloRating` and `timesRanked` live in the browser's
local ranking state instead (see **Online deployment**). `mpaaRating` is the
movie's US MPAA certification (e.g. `"PG-13"`), fetched from TMDb's
`/movie/{id}/release_dates` during enrichment, or `null` if TMDb has no US
certification for it. The Family subset (see **Movie subsets**) is
genre-based, not rating-based (#152) — `mpaaRating` doesn't drive that
filter — but it does drive the separate PG-13-and-under toggle (#193, see
**PG-13 and under toggle** below), which composes with every subset
including Family. `studio` is the movie's
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
below) — or `null` if TMDb has no vote data for it. `productionCountries[]`
is TMDb's `production_countries` from `/movie/{id}`, as ISO 3166-1 country
codes (e.g. `["US", "GB"]`) — used to build the British subset (see **Movie
subsets**); can be empty if TMDb has no production-country data for it.

## Popular subset (#104)
`GET /api/movies` also accepts `?popular=true` (composable with
`?family=true`), which restricts the pool to the top
`POPULAR_POOL_SIZE` (`src/lib/popularMode.js`) movies by `voteCount`
descending (`null`/missing sorts last). When combined with `family`, family
filtering is applied first so "popular" always means "top-N within whatever
scope is already active." See **Movie subsets** below for how this is
exposed in the UI.

## Ranking mechanic (Elo)
- Each right-panel "Rank →" click takes the pack's tiles (5, or fewer if any
  were skipped — see below) in their current drag order and treats it as
  every pairwise outcome (rank 1 beats everyone below it, rank 2 beats
  everyone below it, etc).
- Each pairwise outcome does a standard Elo update on both movies' `eloRating`.
- **Skip ("Haven't Seen"):** each tile has a button to remove that movie from
  the active pack without ranking it (its `eloRating`/`timesRanked` are
  untouched). Ranking proceeds normally as long as 2+ movies remain. If a
  skip would drop the pack to its last movie, the app does not silently
  discard the pack — a lone remaining movie was never itself declined, so
  treating it the same as an explicit skip would be presumptuous (#156).
  Instead the pack stays active with that one movie still displayed, and an
  inline prompt with explicit Yes/No buttons — No is the default, both
  visually (primary styling) and for keyboard use (autofocused) since it's
  the non-destructive choice (#194) — asks whether to skip it too
  (`awaitingLastSkipConfirm`/`handleConfirmSkipLast`/`handleDeclineSkipLast`
  in `App.jsx`, rendered by `RightPanel.jsx`). Neither answer leaves the user
  stranded on an unrankable 1-movie pack (#195): Yes skips it and then
  discards the (now-empty) pack without submitting any ranking data,
  advancing to the next pack; No leaves the movie itself unskipped but still
  discards the pack and advances the same way — mirroring "Rank →"'s
  queue-advance behavior, just without the Elo update either way. Clicking
  that lone movie's own tile skip button while the prompt is showing
  re-offers the same prompt rather than executing an unconfirmed skip,
  since that tile *is* the movie the prompt is already asking about. The
  "Rank →" button is disabled while only one movie remains,
  since a 1-movie pack can't be meaningfully ranked. Skipping also filters
  the skipped movie out of any already-generated queued packs that include
  it (#155, `replaceDiscardedQueuePacks` in `App.jsx`) — otherwise a movie
  just marked "haven't seen" could resurface if that pre-generated queue
  pack were later selected. Any queued pack containing the skipped movie is
  discarded wholesale and replaced with a freshly generated one, rather than
  just filtering the skipped movie out of it in place (#218) — packs are
  always meant to be a fixed size (5, or 2 for Head to Head), so quietly
  shrinking one in place instead of regenerating it could let a queued pack
  lose several movies across separate skips over time and eventually
  surface with too few tiles. Skip is persistent
  (#136), not just for the active pack: a skipped movie
  is marked "haven't seen" in this browser's local state
  (`src/lib/localRankingStore.js`) and is permanently excluded from future
  pack generation and from the ranked-progress denominator (see **Progress
  tracking**), until un-skipped. If the movie had already been ranked in a
  previous pack, marking it skipped also resets its `eloRating`/`timesRanked`
  back to defaults (1000/0) — a skip removes the movie from the ranking
  entirely, not just from future packs (#169); un-skipping it afterward
  starts it back at those same defaults rather than restoring the old
  rating, since that data is gone. Besides the in-pack "undo" while that pack
  is still active (`onUndoSkip`), a dedicated "Skipped" view (#137,
  `src/components/SkippedView.jsx`, opened via a "Skipped" button in the
  banner next to "Load Ranking") lists every persistently-skipped movie
  (poster/title/year, matching the Standings row styling) with a per-movie
  "Un-skip" button and a "Clear All" action that un-skips everything at
  once — both call `api.unmarkSkipped`/`localRankingStore.js`'s
  `unmarkSkipped` directly, independent of whether the pack that skip
  happened in is still active, so a skip can be reversed at any time, not
  just immediately after it happens. Skipped state survives Reset/Save
  (it's a fact about the viewer, not about a ranking run — see **Saved
  rankings**).
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
  `eloRating`) are available yet, or if fewer than
  `MIN_RANKED_FOR_HEAD_TO_HEAD` (20) movies have been ranked overall (#217)
  — below that, "top 50 by eloRating" is really just every movie ranked so
  far, no more meaningful a "top" than the very first pack ranked (mirrors
  Top 10 Tough Choice's own higher `MIN_RANKED_FOR_TOUGH_CHOICE` floor
  below, just set lower since Head to Head's pool (50) is already much
  larger than Tough Choice's (10)). Since both movies are already-ranked, a
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
  pick 5 at random from the matching set. The 1–2 already-ranked "filler"
  slots (here and in Head to Head/Top 10 Tough Choice's own draws) are
  chosen with a weighted pick favoring lower `timesRanked`
  (`categoryGenerator.js`'s `weightedSample`/`rankedWeight`, weight `1 /
  (timesRanked + 1)`) rather than uniformly at random — otherwise the same
  heavily-reinforced movies keep getting reused as filler/opponents instead
  of movies ranked only once or twice (#219).
- **Full-coverage measures (#224):** nothing in the mechanic above
  *guarantees* every movie eventually gets ranked — it's all probabilistic —
  but two things push hard toward full coverage without needing new
  persisted state:
  - `tryBuildCategory` draws its candidate attribute *values* from
    not-yet-ranked movies first, falling back to the whole pool only when
    none remain — so categories tend to get built around an unranked
    movie's own attributes instead of picking blind, making it far more
    likely an unranked movie actually lands in `matches`.
  - A forced-inclusion backstop: `unranked[totalRankedCount %
    unranked.length]` is guaranteed a slot in every Random Five pack a call
    to `generateCategory` produces (both the chance-triggered one and the
    attempt-exhausted fallback) — never in an attribute pack, since forcing
    a mismatched movie in would make the category's label inaccurate.
    `totalRankedCount` only advances when a "Rank →" actually lands, so
    this deterministically rotates which not-yet-ranked movie gets forced
    next, without any new per-movie staleness tracking.
- Display a plain-language label above the list, e.g. "Directed by Wes Anderson",
  "90s Comedies", "80s movies starring Harrison Ford", "Random Five".
- **Upcoming queue:** rather than a single "next category" generated on
  demand, the app keeps a small queue of pre-generated upcoming packs (8,
  `QUEUE_SIZE` in `App.jsx` — #134). Rather than a separate always-visible
  list column, it's surfaced via an icon-only dropdown (`QueueMenu.jsx`, no
  text label) in the pack card's own header, top-right, next to the pack's
  category label — opening it shows the same queued-pack cards (poster
  stack + label) as before, just on demand instead of permanently occupying
  layout space.
  - **"Rank →"** submits the active pack's Elo update, promotes the first
    queued pack to active, and generates one fresh pack to refill the queue.
  - **Clicking a queued pack** (from the dropdown) discards the current
    active pack without submitting it, promotes the clicked pack to active,
    and generates one fresh pack to refill the queue.
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
- **Completion → auto-save (#227):** once every non-skipped movie in the
  *currently visible* pool has `timesRanked ≥ 1`, the app immediately and
  silently saves it under a generated name (`src/lib/rankingName.js`'s
  `generateRankingName` — the subset's label, plus the PG-13-and-under
  qualifier when it's on, plus today's date, e.g. `"Sci-Fi (PG-13 & Under) —
  Sep 6, 2026"`) — no naming prompt, no separate confirmation step; this
  replaced an earlier flow where completion opened a modal asking the user
  to type a name before saving. "Visible pool" is whichever subset is active
  (Popular, Family, or All Movies) minus skipped movies, further narrowed by
  the PG-13-and-under toggle when it's on (#193) — see **Movie subsets**,
  **PG-13 and under toggle**, and **Skip ("Haven't Seen")** (#136). The
  Results screen (`ResultsScreen.jsx`) still appears right after, showing
  the just-completed standings with the generated name as its title and a
  "Saved automatically" subtitle, so the user can see what happened; its
  footer button reads "Continue Ranking" (dismissing it) rather than "Save
  Ranking" — dismissing is what starts the next run (see **Save** below),
  since the save itself already happened. If the save request itself fails,
  the Results screen simply doesn't appear (the same inline-error path any
  other API failure takes) — the completed state isn't lost, since the pool
  is still fully ranked, so the save is retried the next time
  `noteMoviesUpdate` runs (e.g. switching back to this subset).
- **Save:** the browser posts the current per-movie `eloRating`/`timesRanked`
  for the visible, non-skipped pool (gathered from its own local ranking
  state — see
  **Online deployment**) to the server as a named, timestamped snapshot, then
  resets that scope's local ranking state back to defaults (`eloRating =
  1000`, `timesRanked = 0`) so a fresh ranking run can start from scratch. A
  full-pool save resets the whole pool; a Family-mode save resets only the
  Family subset, leaving progress on the rest of the pool untouched; a save
  made with the PG-13-and-under toggle on resets only the toggle-filtered
  slice of whichever subset was active (#193).
  This lets the pool be ranked repeatedly over time (e.g. auto-named runs on
  different dates) without the runs interfering with each other. Every saved
  snapshot is stamped with the creating browser's client id (see **Online
  deployment**), reserved for a future feature restricting edits/re-ranks to
  the ranking's creator (#115) — not yet enforced anywhere. It's also
  stamped with the subset id it was saved from (`saved_rankings.subset` in
  the backend's SQLite table — see **Online deployment**), so a save made
  while, say, Sci-Fi was active is tagged `'sci-fi'` — and, independently,
  with whether the PG-13-and-under toggle was active
  (`saved_rankings.pg13`, `0`/`1`, `NULL` for snapshots saved before the
  toggle existed, #193). `pg13` gets its own column rather than folding into
  `subset` because the toggle is a second, orthogonal dimension that
  composes with every subset (Popular+PG-13, Family+PG-13, Sci-Fi+PG-13,
  etc.) rather than being a subset of its own — encoding it into the
  `subset` string (e.g. `'family-pg13'`) would have broken every place that
  already treats `subset` as one of the fixed picker ids (`subsetLabel`,
  the genre/language lookups, etc.).
- **Load:** a "Load Ranking" entry point lists saved snapshots scoped to the
  *currently active* subset **and** PG-13 toggle state only —
  `GET /api/rankings?subset=<id>&pg13=<true|false>` filters server-side, and
  `LoadRankingView.jsx`'s dialog title reads "Load \<Subset\> Ranking" (e.g.
  "Load Sci-Fi Ranking", or "Load Sci-Fi (PG-13 & Under) Ranking" when the
  toggle is on) so the scoping is visible, not just implicit; switching the
  active subset or toggle (closing and reopening the dialog) shows that
  combination's own saves instead. Snapshots saved before this scoping
  existed have no `subset`/`pg13` and are excluded from every filtered list.
  Listed by name/date/movie count; opening one displays it via the same
  tiered Results screen shown on live completion (#107, `ResultsScreen.jsx`
  reused by `LoadRankingView.jsx` with `readOnly` — Top 10 grid, 11-25 and
  26-100 tiers, and anything outside the snapshot's top 100) — only the
  movies that were actually part of that saved run, not the current full
  pool — read-only (no Save Ranking button; a "Back to list" link replaces
  it), and it does not affect or restore live ranking state.
- **Sharing (#220):** every saved snapshot gets a "Share" button in
  `ResultsScreen.jsx`'s footer — both the live post-completion screen and
  the read-only Load Ranking view — that copies a public link to that
  ranking's Top 10 to the clipboard. The link is `?share=<slug>` on the
  app's own URL (e.g. `https://.../movie-ranking/?share=ngfjyDxrZtbE`), not
  a new path, so it needs no GitHub Pages routing/rewrite support; `main.jsx`
  checks for that query param before rendering `App` at all, and if it's
  present renders `SharedRankingView.jsx` instead — a small standalone page
  with no bearer-token pool fetch and no app shell, since anyone with the
  link needs to be able to open it. That page's footer has its own "Rank
  your own movies →" link (#235) back to the app's root URL (`import.meta.env.BASE_URL`,
  i.e. the same URL with no `?share=` param) — a visitor who lands on a
  shared Top 10 has otherwise no way to reach the app itself from that
  page.
  - **Slug, not the row's own id:** `saved_rankings.share_slug` is a random,
    unguessable id (12-char base64url, `server/db.js`'s
    `generateShareSlug`), deliberately not the row's sequential numeric
    `id` — that would let a shared link's neighbors (id-1, id+1) be
    trivially browsed to see other people's saved rankings. Every new save
    is assigned one immediately (`createSavedRanking`), so the Share button
    works right away with no extra round trip; a snapshot saved before
    sharing existed has `share_slug = NULL` until backfilled (see below).
  - **Public endpoint:** `GET /api/rankings/share/:slug` is registered
    before the bearer-token auth middleware in `server/index.js` (and
    before the authenticated `GET /api/rankings/:id` route, so `:id` never
    swallows the literal `share` segment) — anyone can call it, no
    `Authorization` header needed. It returns far less than the
    authenticated saved-ranking endpoints: just `{name, subset, pg13,
    movies}`, where `movies` is only the Top 10 (`id`, `title`, `year`,
    `posterUrl` — no `eloRating`/`timesRanked`/`ownerClientId`) — see
    `getSharedRankingTopTen` in `server/rankingService.js`.
  - **Legacy backfill:** a snapshot saved before this feature has no slug
    yet. `LoadRankingView.jsx`'s Share button calls the authenticated
    `POST /api/rankings/:id/share` the first time it's clicked on such a
    snapshot, which lazily generates and persists one
    (`ensureShareSlug`/`setShareSlug`) and reuses it on any later click in
    that same session. The live post-completion screen never needs this
    path, since a fresh save already has a slug.

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
    - `saved_rankings(id, name, created_at, data, owner_client_id, subset,
      pg13)` — completed snapshots; `data` is the JSON-serialized
      `{movieId, eloRating, timesRanked}[]` at save time — only the movies
      actually in scope for that save (the whole pool, or just the Family
      subset for a Family-mode save, further narrowed if the PG-13-and-under
      toggle was on). `owner_client_id` is the
      creating browser's client id — reserved for a future edit/re-rank
      feature restricted to the ranking's creator (#115); not yet enforced by
      any endpoint. `subset` is the picker's subset id the save was made
      from (`'popular'`, `'family'`, `'all'`, or a genre/language/country
      id) — lets `GET /api/rankings` filter to one subset (see **Saved
      rankings**); `null` for snapshots saved before this column existed.
      `pg13` (#193) is `0`/`1` for whether the PG-13-and-under toggle (see
      **Movie subsets**) was active for that save — a separate column from
      `subset` since the toggle is an independent, composable dimension
      rather than one of the subset ids; `NULL` for snapshots saved before
      the toggle existed. `share_slug` (#220) is a random unguessable id for
      the public share link (see **Sharing** under **Saved rankings**) —
      `NULL` for a snapshot that hasn't had one assigned yet (every new save
      gets one immediately; a legacy snapshot gets one lazily on first
      Share click). Uniqueness is enforced via a separate index rather than
      a column constraint, since SQLite's `ALTER TABLE ADD COLUMN` doesn't
      support `UNIQUE` directly.
  - Endpoints:
    - `GET /api/movies` — the pool's static metadata only, no ranking state;
      `?family=true` restricts to the Family subset (see **Movie subsets**);
      `?pg13=true` restricts to the PG-13-and-under toggle's filter (#193,
      composable with `family`/`popular`/`genre`). The client merges this
      with its own local ranking state.
    - `POST /api/rankings` — body: `{name, subset, pg13, entries, clientId}`,
      where `entries` is the `{movieId, eloRating, timesRanked}[]` the
      browser gathered from its own local ranking state; the server just
      persists it tagged with `clientId` as `owner_client_id` and
      `subset`/`pg13` as-is, and assigns a `shareSlug` (#220), returned in
      the response alongside `id`/`name`. The browser resets its own local
      state for that scope after a successful save.
    - `GET /api/rankings` — list of saved snapshots (`id`, `name`,
      `createdAt`, `movieCount`, `subset`, `pg13`); `?subset=<id>` restricts
      to snapshots saved from that subset, and `?pg13=<true|false>`
      restricts to snapshots saved with the toggle in that state (see
      **Saved rankings**) — composable with each other
    - `GET /api/rankings/:id` — a saved snapshot's movies (static metadata +
      snapshot-time `eloRating`, limited to the movies that were part of
      that save), sorted descending, for read-only display; also includes
      `shareSlug` (`null` if not yet assigned)
    - `POST /api/rankings/:id/share` (#220) — lazily assigns and persists a
      share slug for a saved ranking that doesn't have one yet (a no-op,
      returning the existing slug, if it already does); see **Sharing**
      under **Saved rankings**
    - `GET /api/rankings/share/:slug` (#220) — public, no `Authorization`
      header required (registered ahead of the auth middleware) — a saved
      ranking's public Top 10 by its share slug: `{name, subset, pg13,
      movies}`, `movies` limited to `id`/`title`/`year`/`posterUrl` only;
      see **Sharing** under **Saved rankings**
  - Auth: single-user app, so a shared bearer token in an env var, checked on
    every request, is sufficient — no user accounts needed yet; the one
    exception is the public share endpoint above, deliberately excluded
    from that check since anyone with a shared link needs to be able to
    open it.
  - CORS: restrict to the GitHub Pages origin.
  - Process management: `systemd` or `pm2` so it survives reboots/crashes;
    reverse-proxied through Caddy or nginx for TLS.

## UI layout
- **Left panel:** full ranked list of every movie (poster thumbnail + title + year),
  sorted by eloRating. Progress label (`n/nnn ranked`) near the header — see
  **Progress tracking**.
- **Right panel:** the active pack — 5 draggable movie tiles under the category
  label, reorderable via drag-and-drop (`@dnd-kit`) — plus the icon-only
  queue dropdown in the card's own header described in **Category
  generation & queue**.
- **Center-bottom button:** "Rank →" — triggers the Elo update, left-panel
  resort, and queue advance.
- **Banner:** two rows. Top row: an app-icon (recolored to the active
  Neon-theme palette — see **Movie subsets**) on either side of the "Movie
  Ranking" title, all three sitting on a shared dark badge
  (`.app-title-badge`) so the icons and title read as one continuous piece
  rather than separate elements, without adding height beyond the icons'
  own. Bottom row, spread across the full width: an icon-only "☰" menu
  button (`BannerMenu.jsx`, no text label) on the left — opening it reveals
  Standings (mobile-only; desktop already shows the standings panel
  in-line), a "Load Ranking" entry point for browsing saved snapshots (see
  **Saved rankings**), a "Skipped" entry point for browsing/un-skipping
  persistently-skipped movies (#137, see **Skip ("Haven't Seen")**), and an
  "Instructions" entry point (#237) that reopens the startup instructions
  popup on demand — then the subset picker, then the PG-13-and-under toggle
  (#193, see **PG-13 and under toggle**) flush right. A large, very-faint
  film-reel watermark (baked-in low alpha, not CSS `opacity`, so it doesn't
  fade the banner's own gradient) sits behind the whole app-shell under the
  Neon theme only — see **Movie subsets**.
- **Startup instructions:** a one-time popup (`InstructionsModal.jsx`) shown
  on startup unless its "Show on load" checkbox (#236, checked by default)
  was left unchecked on a previous visit (`movie-ranking-hide-instructions`
  in `localStorage` — presence of the key means "hidden," inverse of the
  checkbox's own sense) — explains the drag/Rank/Head-to-Head flow and what
  each banner control above does, replacing the old always-visible per-pack
  captions. Also reachable any time via the ☰ menu's "Instructions" item
  (#237, see banner row above), in which case the checkbox reflects
  whatever the stored preference currently is rather than always defaulting
  to checked.

## Movie subsets (#104, #146, #150, #151, #180, #181)
There are no more cosmetic-only "themes" — the banner's picker
(`src/components/SubsetPicker.jsx`, a grouped `<select>`) chooses which
**subset of the pool** to rank, and each subset carries its own visual
identity (a `data-theme` value with its own CSS custom-property palette in
`src/index.css`) purely as a side effect of which subset is active, not as
an independent choice. Three general entries plus 15 genre entries, 3
language entries, and 1 country entry, grouped in the picker:
- **Popular** (`subset: 'popular'`, the default) — the top
  `POPULAR_POOL_SIZE` movies by TMDb `voteCount` (see **Popular subset**
  above). Dark, moody "Neon" palette (navy background, teal/pink accents) —
  shared by every other subset, All Movies included (#211). The app icons
  flanking the title, and the large low-opacity film-reel watermark behind
  the app shell, are recolored to this palette's navy/teal (see **UI
  layout**) and appear under every subset now that it's the only palette —
  the source art lives outside the repo (the
  original clip-art master), recolored via a one-off Pillow script (not
  checked in) into `public/favicon.svg`, `public/apple-touch-icon.png`,
  `public/pwa-192.png`, `public/pwa-512.png`, `public/pwa-maskable-512.png`,
  and `src/assets/film-reel-bg.png`.
- **Family** (`subset: 'family'`) — movies tagged with TMDb's own "Family"
  genre (`genres[]` includes `"Family"`) — see `src/lib/familyMode.js`'s
  `isFamilyGenre`/`selectFamilySubset` (#152). The genre tag alone isn't a
  safety guarantee — a Family-genre movie can still carry any `mpaaRating`,
  including `PG-13` or, in principle, something TMDb miscategorizes — so
  Family always additionally applies the PG-13-and-under filter (see **PG-13
  and under toggle** below) on top of the genre curation, regardless of the
  toggle's own on/off state (#200). (This
  replaced an earlier `mpaaRating`-based G/PG/PG-13 filter, `isFamilySafe`,
  which offered that safety guarantee but not genre-based curation; #152
  deliberately traded one for the other, and #200 brought the rating floor
  back as an unconditional addition to the genre curation rather than a
  replacement for it.) Caps to the same
  top-N-by-`voteCount` as Popular and the other genre/language subsets, via
  `selectFamilySubset`. Shares Popular's dark, moody palette, same as every
  genre/language/country subset below — it previously had its own bespoke
  "storybook night" palette (deep indigo background, marigold/teal accents),
  but that made it the only genre-shaped subset with a distinct visual
  identity, which read as inconsistent; removed in favor of one shared look
  across every subset.
- **All Movies** (`subset: 'all'`) — the entire unfiltered pool. Shares
  Popular's dark, moody palette like every other subset (#211) — it
  previously had its own bespoke warm/parchment-toned palette, which made it
  the last subset with a distinct visual identity; removed for the same
  reason Family's bespoke palette was, above.
- **Genre/language subsets** (`src/lib/genreSubsets.js`'s `GENRE_SUBSETS`) —
  Comedies, Action, Mysteries, Horror, Sci-Fi, Fantasy, Romance, Rom-Com,
  Musicals, Dramas, Adventure, Animation, Thrillers, Crime, French, Spanish,
  Italian, Comic Book (see below). TMDb's "Family" genre is deliberately not a `GENRE_SUBSETS` entry
  — it's the defining attribute of the general **Family** subset above
  instead, so a second "Family" entry in the picker's Genres group would be
  redundant (this was previously framed as avoiding a naming collision with
  the old MPAA-based Family subset, #150; now that Family means this genre,
  it's the same subset, not a collision to avoid). Each filters the pool by
  the movie's own genre(s) (`genres[]`,
  matched with AND semantics — Rom-Com requires both `Romance` and `Comedy`),
  keyword (`Musicals` — TMDb's `musical` keyword, not the too-broad `Music`
  genre; plus two hardcoded `tmdbId` exceptions, *Coco* and *Sister Act*,
  which are real musicals TMDb doesn't keyword-tag), or `originalLanguage`
  (French/Spanish/Italian) — then caps to `GENRE_SUBSET_POOL_SIZE` (100) via
  the shared `selectTopByVoteCountWithQuotas` (`src/lib/popularMode.js`) —
  smaller than Popular's `POPULAR_POOL_SIZE` (300), since niche genre/
  language/country subsets don't have as much depth of genuinely popular
  titles as Popular/Family/All Movies do; sharing Popular's cap left a long
  tail of obscure matches that users ended up skipping en masse (#165, e.g.
  nearly a third of the Sci-Fi subset). A flat voteCount cutoff also
  systematically favors modern/mainstream titles — TMDb engagement skews
  heavily toward recent, streamed releases — so `selectTopByVoteCountWithQuotas`
  reserves two independent floors within the cap, each topped up from
  outside the natural top-N only when the natural ranking doesn't already
  clear it: at least `CLASSIC_ERA_QUOTA` (20) of the slots go to the
  best-by-voteCount movies released before `CLASSIC_ERA_CUTOFF_YEAR` (1980)
  (#203, found via the Musicals subset missing golden-age titles to a wave
  of higher-voteCount modern/Disney musicals), and at least
  `CANONICAL_QUOTA` (20) go to the best-by-voteCount movies from a
  `CANONICAL_SOURCE_IDS` source (AFI's lists, Ebert's Great Movies, Sight &
  Sound, the National Film Registry, 1001 Movies — hand-curated
  critical/preservation lists, as opposed to the TMDb-discover-based
  `top-<genre>` sources) with at least `CANONICAL_MIN_VOTE_COUNT` (25) TMDb
  votes — that floor excludes a source-qualifying movie with too few votes,
  since the National Film Registry in particular preserves home movies,
  student films, and raw footage collections alongside actual narrative
  features, and a handful of votes is enough to tell an obscure-but-real
  classic from preservation ephemera almost nobody has "seen" (#207). Both
  are floors, not fixed partitions — a subset whose classics/canonical
  movies are already popular enough to rank highly on their own (e.g.
  Italian) is returned unchanged — and neither floor evicts a movie already
  kept to satisfy the other, so filling one can't silently undo the other.
  Both floors together still don't guarantee any specific title clears the
  cap: with a fixed-size quota and, in a subset like Musicals, dozens of
  genuine classics/canonical titles competing for it, a lower-voteCount
  entry (e.g. *The King and I*, at 414 votes) can still lose out to
  better-voted classics/canonical titles filling the same floor. All share
  Popular's palette (no bespoke palette per genre). Filtering is
  by the movie's own attributes, not by which `sources[]` tag brought it
  into the pool — a Comedy added via personal import still surfaces here if
  popular enough. See **Building the list** below for how the pool is kept
  stocked with genuinely popular movies per subset, not just whatever we'd
  already collected. Every genre/language subset here, plus Popular and
  Family above, also excludes Marvel/DC movies (#180) — see **Comic Book**
  below for where they went and why.
- **British** (`src/lib/genreSubsets.js`'s `GENRE_SUBSETS`, `id: 'british'`,
  #151) — filters by `productionCountries` including `"GB"` (unlike the
  genre/language subsets above, "British" isn't derivable from `genres[]`/
  `originalLanguage`, so it gets its own field — see **Data model**), then
  caps to `GENRE_SUBSET_POOL_SIZE` (100) via `selectTopByVoteCountWithQuotas`,
  same smaller-than-Popular cap and classic-era/canonical-source quotas as
  the genre/language subsets above (#165, #203, #207).
  Grouped under its own "Country" optgroup in the picker (`COUNTRY_SUBSET_IDS`
  in `genreSubsets.js`). Shares Popular's palette, same as the genre/language
  subsets. Topped up via TMDb's `/discover/movie?with_origin_country=GB`
  (`scripts/discoverTopMovies.js`'s `top-british` target, confirmed live
  against TMDb during planning) merged in via `scripts/enrich-sources.js`,
  same discover-fetch pattern as the genre/language subsets. Existing pool
  entries enriched before `productionCountries` existed are backfilled via
  `scripts/refreshEnrichedFields.js` (same one-off backfill script used for
  `voteCount` in #104 and the `musical` keyword in #150).
- **Comic Book** (`src/lib/genreSubsets.js`'s `GENRE_SUBSETS`, `id:
  'comicbook'`, #180/#181) — the one subset that still includes Marvel/DC
  movies. Every other subset above (Popular, Family, and every other
  genre/language/country subset) filters them out via
  `src/lib/comicBookMovies.js`'s `isMarvelOrDc` — their sheer volume (dozens
  of MCU/DCEU entries) was crowding out everything else in those top-N
  cutoffs. `isMarvelOrDc` matches on `studio === 'Marvel Studios'`, a
  curated allowlist of Marvel/DC collection names
  (`MARVEL_DC_COLLECTIONS`, same hand-picked spirit as
  `NOTABLE_STUDIOS`/`KEYWORD_LABELS` in `curatedAttributes.js`), or a small
  hardcoded `tmdbId` exception list (`MARVEL_DC_TMDB_ID_EXCEPTIONS`, same
  pattern as Musicals' Coco/Sister Act exceptions) for standalone
  films TMDb doesn't group into a collection. The Comic Book subset itself
  matches more broadly than `isMarvelOrDc` — `isComicBook` also includes
  TMDb's `superhero` keyword, so non-Marvel/DC comic adaptations (Hellboy,
  Kick-Ass, etc.) land here too, per #181 ("other comic book movies are
  allowed here too"); those non-Marvel/DC superhero movies are *not*
  excluded from other subsets, only Marvel/DC ones are. All Movies is
  unaffected by any of this — it stays the one place showing the entire
  unfiltered pool, Marvel/DC included, since `selectPopular`/
  `selectGenreSubset` (where the exclusion lives) are never applied there.
  Caps to `GENRE_SUBSET_POOL_SIZE` (100) via `selectTopByVoteCountWithQuotas`,
  same as the other genre subsets. Shares Popular's palette.
- `GET /api/movies?family=true&popular=true&genre=comedy&pg13=true` composes
  server-side filters (family applied first, then the pg13 toggle if on,
  then one top-N strategy — `genre` and `popular` are alternate strategies,
  only one ever applies); the client then merges in its own local ranking
  state and generates categories from that filtered set, so category
  generation (overlap rule, attribute matching) only ever draws from the
  active subset+toggle combination. Switching subsets, or flipping the
  toggle, always re-fetches, since either changes the pool.
- Pack labels never vary by subset — `src/lib/labelWording.js`'s
  `formatPackLabel` only shortens "Random Five" to "Random 5"; there is no
  more movie/film wording variance.
- **Scoped completion/save:** the "every movie ranked" completion check (see
  **Saved rankings**) operates on the currently-visible subset+toggle
  combination, so ranking all of any subset triggers the save prompt just as
  finishing All Movies does, and the same is true with the PG-13-and-under
  toggle on. Saving (`api.saveRanking(name, { family, popular, genre, pg13,
  subset })`) snapshots and resets only that combination's local Elo state —
  progress on movies outside it (a different subset, or the same subset with
  the toggle in the other state) is left untouched. This keeps a save from
  either being blocked by unrelated unranked movies, or fabricating
  "ranked" data for movies that were never actually compared.

## PG-13 and under toggle (#193, #200)
A global checkbox in the banner, next to the subset picker (`pg13` state in
`App.jsx`, persisted in its own `localStorage` key — unlike the subset
picker's own key, it survives subset switches rather than being tied to
one) — labeled "PG-13 & Under." Family always applies this filter
regardless of the checkbox's own state (#200, see **Movie subsets** above) —
while Family is active, the checkbox itself shows checked and disabled (with
a tooltip explaining why) rather than actually flipping the underlying
`pg13` preference, so switching to a different subset immediately reveals
whatever the user had it set to beforehand. `App.jsx`'s `effectivePg13`
(`isFamily || pg13`) is what every filter/fetch/save/load call and the
checkbox's own `checked` prop actually use; the raw `pg13` state is what's
read/written to `localStorage` and passed to `setPg13` by the checkbox's
`onChange`, so it never gets silently overwritten by Family forcing it on.
When on, it restricts whichever subset is
active to movies with `mpaaRating` of `G`, `PG`, or `PG-13`
(`src/lib/pg13Mode.js`'s `isPg13OrUnder`/`selectPg13OrUnder`), excluding `R`
and `NC-17` outright. A movie with a `null` `mpaaRating` (no US
certification on file — see **Data model**) is also excluded while the
toggle is on, since there's no way to verify it actually qualifies — with
one exception: a movie released before November 1, 1968 (when the MPAA
ratings system launched) predates the concept of a US certification
entirely, so a `null` rating on one of those isn't a signal about its
content (mainstream releases from that era were essentially
G/PG-equivalent under the Hays Code) — it's just an artifact of the rating
system not existing yet. Those pre-1968 `null`-rating movies are included
rather than excluded (`MPAA_RATINGS_START_YEAR` in `pg13Mode.js`); a
`null`-rating movie from 1968 onward is still excluded, since a missing
certification is more likely meaningful once the system exists (an unrated
cut, or a foreign/indie release TMDb has no US certification data for).
Unlike
Popular/Family/genre/language/country, this isn't a subset of its own — it's
an additional filter layered on top of whichever subset is active, the same
composable shape as the Popular/genre top-N strategies but applied as a
plain filter (mirroring how `family` composes, not how `genre`/`popular` are
mutually exclusive alternatives). Server-side, `getMovies` in
`server/rankingService.js` applies it right after the `family` filter and
before whichever top-N strategy runs, so "top-N" always means "top-N within
whatever's already been filtered" — same principle as `family`+`popular`
composing (see **Popular subset**). Client-side, `App.jsx`'s
`computeVisibleMovies` mirrors that same pipeline to re-derive "the
currently-visible pool" from `api.rankPack()`'s unfiltered response. Every
place that threads `family`/`popular`/`genre` through the app
(`api.getMovies`/`api.getCategory`/`api.saveRanking`/`api.resetRanking`,
`App.jsx`'s pack-fetching helpers) also threads `pg13` the same way. See
**Saved rankings** for how the toggle's state is tagged on saved snapshots
(its own `pg13` column, independent of `subset`, since it composes with
every subset rather than being one).

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
