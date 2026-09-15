# Backend deploy — DigitalOcean droplet

One-time setup on the droplet, then a repeatable `deploy.sh` for updates.

## One-time setup

1. **Create a deploy user** (skip if reusing an existing one):
   ```
   sudo adduser --system --group --home /opt/movie-ranking movie-ranking
   sudo mkdir -p /opt/movie-ranking/server /opt/movie-ranking/data
   sudo chown -R movie-ranking:movie-ranking /opt/movie-ranking
   ```

2. **Install Node 22** (matches the CI workflow) and build tools (`better-sqlite3`
   compiles a native addon on install) if not already present:
   ```
   curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
   sudo apt-get install -y nodejs build-essential python3
   ```

3. **Copy this repo's `server/`, `data/`, and `src/lib/` directories to the
   droplet** the first time (subsequent updates use `deploy.sh` instead —
   `server/rankingService.js` imports `elo.js`/`categoryGenerator.js` from
   `../src/lib`, so that directory must exist alongside `server/` on the
   droplet too):
   ```
   rsync -az --exclude node_modules server/ user@droplet:/opt/movie-ranking/server/
   rsync -az data/ user@droplet:/opt/movie-ranking/data/
   rsync -az src/lib/ user@droplet:/opt/movie-ranking/src/lib/
   ```

4. **Create `/opt/movie-ranking/server/.env`** on the droplet (never commit this):
   ```
   API_TOKEN=<generate a long random token, e.g. `openssl rand -hex 32`>
   ALLOWED_ORIGIN=https://palmerharrell.github.io
   PORT=3001
   DATA_DIR=/opt/movie-ranking/data
   DB_PATH=/opt/movie-ranking/server/data.db
   TMDB_API_KEY=<your TMDb API key — powers Search & Suggest (#243) and the
     scheduled source enrichment job (#385); both are optional and simply
     stay disabled without it>
   ```

5. **Install dependencies:**
   ```
   cd /opt/movie-ranking/server && sudo -u movie-ranking npm ci --omit=dev
   ```

6. **Install and enable the systemd service:**
   ```
   sudo cp deploy/movie-ranking-api.service /etc/systemd/system/
   sudo systemctl daemon-reload
   sudo systemctl enable --now movie-ranking-api
   sudo systemctl status movie-ranking-api
   ```

6b. **Install and enable the scheduled source enrichment timer (#385,
   optional — skip if `TMDB_API_KEY` isn't set)**, which runs
   `scripts/enrich-sources.js --changed-only` daily so a new/changed
   `data/sources/*.source.json` (synced by `deploy.sh`, see **Ongoing
   deploys**) gets enriched automatically instead of requiring a manual
   local run:
   ```
   sudo cp deploy/movie-ranking-enrich.service deploy/movie-ranking-enrich.timer /etc/systemd/system/
   sudo systemctl daemon-reload
   sudo systemctl enable --now movie-ranking-enrich.timer
   sudo systemctl list-timers movie-ranking-enrich.timer
   ```
   Trigger a run immediately (e.g. to test) with
   `sudo systemctl start movie-ranking-enrich.service`, then check
   `sudo journalctl -u movie-ranking-enrich.service -n 50 --no-pager`.

7. **Set up Caddy for TLS + reverse proxy.** Edit `deploy/Caddyfile`, replacing
   `api.example.com` with the real subdomain (must have DNS pointed at the
   droplet), then:
   ```
   sudo cp deploy/Caddyfile /etc/caddy/Caddyfile
   sudo systemctl reload caddy
   ```
   Caddy issues/renews the TLS cert automatically via Let's Encrypt.

8. **Allow the deploy user to restart the service and fix ownership without a
   password**, so `deploy.sh` doesn't need an interactive sudo prompt. The
   chown grant matters because rsync preserves the *deploying machine's*
   local file owner, not the `movie-ranking` service account — without a way
   to fix that up, the service loses write access to its own working
   directory (needed for SQLite's journal/WAL files) after every deploy:
   ```
   echo "your-ssh-user ALL=(ALL) NOPASSWD: /usr/bin/systemctl restart movie-ranking-api, /usr/bin/chown -R movie-ranking\:movie-ranking /opt/movie-ranking/*" | sudo tee /etc/sudoers.d/movie-ranking-deploy
   ```

## Point the frontend at the deployed backend

In the GitHub repo (Settings → Secrets and variables → Actions):
- **Variable** `VITE_API_URL` = `https://api.example.com`
- **Secret** `VITE_API_TOKEN` = the same value as `API_TOKEN` on the droplet

Re-run the `Deploy to GitHub Pages` workflow (or push to `main`) after setting
these — the build bakes them into the static bundle.

## Ongoing deploys

From the repo root, after merging changes to `server/`:
```
DROPLET_HOST=user@droplet ./server/deploy/deploy.sh
```
This rsyncs `server/`, `src/lib/`, `scripts/`, and `data/sources/`, fixes
ownership back to the `movie-ranking` service account (rsync otherwise
preserves the deploying machine's local file owner), reinstalls
dependencies, and restarts the systemd service. It does not touch `.env`,
`data.db`, `data/movies.json`, or `data/.enrich-state.json` on the droplet
(#383) — the droplet's own `data/movies.json` plus its `suggested_movies`
table (server/db.js) is the live pool's source of truth, so a routine code
deploy must not silently overwrite it with this machine's possibly-stale
copy. `data/sources/*.source.json` IS synced (git-tracked curation input,
not live pool state — see #385) so the scheduled enrichment timer below
always sees the latest sources.

## Pulling pool data down for local curation

To bring this repo's `data/movies.json` up to date with whatever's live on
the droplet (including anything added via Search & Suggest, #243) before a
local curation pass:
```
API_BASE_URL=https://api.example.com API_TOKEN=<the droplet's API_TOKEN> ./server/deploy/pull-pool-data.sh
```
This calls the running API's own `GET /api/movies` (which already merges
`movies.json` with `suggested_movies` — see `rankingService.js`'s
`loadAllMovies`) and overwrites the local `data/movies.json` with the result.
`data/movies.json` is gitignored (a generated build artifact, not checked
into the repo), so there's no diff to commit — it's just this machine's
working copy for local curation/enrichment, refreshed from the droplet on
demand. There's currently no reverse "push" script: pushing a
locally-edited `data/movies.json` back up is a deliberate one-off action
(e.g. `rsync -az data/ user@droplet:/opt/movie-ranking/data/`), not part of
the routine `deploy.sh` flow.

## Scheduled source enrichment (#385)

Adding a new published-list source (#351) — e.g. an AFI Top 100 list, or a
new `scripts/discoverTopMovies.js` genre target — used to require running
`npm run enrich-sources` locally against TMDb before the new movies showed
up anywhere. The `movie-ranking-enrich.timer` set up in **One-time setup**
above runs `scripts/enrich-sources.js --changed-only` on the droplet daily
instead, writing straight into the droplet's live `data/movies.json` (same
trust level as Search & Suggest's own live writes — `upsertSourceMovie`
never overwrites an existing entry's fields on a source-only match, so this
can only add coverage, never corrupt what's already there).

`--changed-only` skips any `data/sources/*.source.json` file whose content
hash matches what a previous run already recorded in
`data/.enrich-state.json` (gitignored, droplet-local) — so a nightly run
only spends TMDb quota on sources that are actually new or edited, not all
~50+ every time. Add or edit a `.source.json` file locally, commit it, and
the next `deploy.sh` run (or a manual
`rsync -az data/sources/ user@droplet:/opt/movie-ranking/data/sources/`)
puts it in front of the timer.

To force a specific source to re-enrich regardless of its recorded hash
(e.g. after a schema change to what enrichment extracts) — the same
explicit-argument behavior the script always had, run on the droplet:
```
ssh user@droplet 'cd /opt/movie-ranking && TMDB_API_KEY=... node scripts/enrich-sources.js afi-top-100'
```
TMDb rate limits (429s) and transient 5xx errors are retried with backoff
(`scripts/tmdb.js`) — necessary for an unattended batch job with no one
watching, unlike a manual local run.

## Graduating Search & Suggest additions (#382)

Search & Suggest additions (#243) accumulate in the droplet's
`suggested_movies` table rather than `movies.json` directly (see CLAUDE.md's
**Search & Suggest** section). To fold accumulated suggestions into
`data/movies.json` for good instead of leaving them there indefinitely:

```
API_BASE_URL=https://api.example.com API_TOKEN=<the droplet's API_TOKEN> npm run graduate-suggestions -- list
API_BASE_URL=https://api.example.com API_TOKEN=<the droplet's API_TOKEN> npm run graduate-suggestions -- graduate
```
`graduate` writes the folded-in result straight to this machine's local
`data/movies.json` (gitignored, nothing to commit — see above). Push that
updated file to the droplet (same one-off `rsync` as above). Only after
that push has landed, clear the now-redundant rows from the droplet's table:
```
API_BASE_URL=https://api.example.com API_TOKEN=<the droplet's API_TOKEN> npm run graduate-suggestions -- clear-all
```
Clearing before the push would make a graduated movie briefly vanish from
the live pool (its `suggested_movies` row gone, its `movies.json` entry not
yet on the droplet) — see `scripts/graduateSuggestions.js`'s own comments
for the full ordering rationale.
