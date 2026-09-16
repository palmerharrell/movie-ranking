# Pool Curator (owner-only, local network)

A standalone tool for browsing the movie pool, permanently excluding
movies, adding new ones by TMDb search, and undoing an exclusion — separate
from the deployed app, never shipped in the public GitHub Pages bundle, and
reachable from your phone on the same Wi-Fi as this machine (#392, #401).

The **Excluded** tab lists every entry in `data/excluded-movies.json`
(title, year, reason) with an "Un-exclude" button per row — it removes the
entry from the exclusion list and re-adds the movie to `data/movies.json`
by re-enriching it from TMDb (the same lookup the Add tab uses). No data is
carried over from before the exclusion, since TMDb is already the source of
truth for every field.

It reads and writes `../data/movies.json` and `../data/excluded-movies.json`
directly on disk, and can push those two files straight to the droplet over
SSH via the **Push to Droplet** button (#399) — see **Getting changes
live** below.

## Run it

```
cd admin-tool
npm install
npm start
```

Add movies requires a TMDb key: put `TMDB_API_KEY=...` in the repo root's
`.env` (the same key `scripts/enrich.js`/`enrich-sources.js` already use).
Browsing/excluding works without it.

By default it listens on port `4100` (override with `ADMIN_TOOL_PORT`) on
`0.0.0.0`, so it's reachable from any device on your LAN — not just
`localhost`. There is deliberately no login/auth: it's meant to run only
while you're actively curating, on your home network.

- On this machine: http://localhost:4100
- From your phone (same Wi-Fi): find this Mac's LAN IP with
  `ipconfig getifaddr en0`, then open `http://<that-ip>:4100`

## Getting changes live

Every add/exclude only touches your local working copy until you push:

1. Click **Push to Droplet**. It first runs an `rsync --dry-run` and shows
   you exactly what would change on the droplet — nothing is sent yet at
   this point. If it says "no changes," you're already in sync (or there's
   nothing to push).
2. Review the preview, then click **Push** to actually send `movies.json`
   and `excluded-movies.json` to the droplet's `data/` directory. This
   takes effect immediately — `server/movieStore.js` re-reads `movies.json`
   fresh on every request, no restart needed.
3. Separately, still commit `data/excluded-movies.json` (git-tracked) and
   open a PR as usual — the push above only updates the *droplet's* live
   copy, not this repo's own history, so committing keeps the exclusion
   list's audit trail intact.

By default the push targets the `movie-ranking-droplet` SSH host alias (see
the "Droplet SSH access" setup) and `/opt/movie-ranking/data`. Override with
`DROPLET_HOST`/`REMOTE_DATA_DIR` env vars if your setup differs.

If you haven't pulled the droplet's latest pool data recently, run
`server/deploy/pull-pool-data.sh` first so you're not curating against a
stale local copy — the tool's header shows when your local `movies.json`
was last modified as a sanity check, and the dry-run preview will also
surface a stale-push risk (e.g. it looking like it would remove entries
that were added live since your last pull).
