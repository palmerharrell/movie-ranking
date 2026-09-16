# Pool Curator (owner-only, local network)

A standalone tool for browsing the movie pool, permanently excluding
movies, and adding new ones by TMDb search — separate from the deployed
app, never shipped in the public GitHub Pages bundle, and reachable from
your phone on the same Wi-Fi as this machine (#392).

It reads and writes `../data/movies.json` and `../data/excluded-movies.json`
directly on disk. It does **not** talk to the droplet — see **Getting
changes live** below.

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

Everything this tool does only touches your local working copy. To make it
real for every visitor:

1. Commit `data/excluded-movies.json` (git-tracked) and open a PR as usual.
2. Push the updated `data/movies.json` (gitignored, not part of the PR) to
   the droplet — same one-off `rsync` used for graduated Search & Suggest
   additions (see `server/deploy/README.md`):
   ```
   rsync -az data/ user@droplet:/opt/movie-ranking/data/
   ```

If you haven't pulled the droplet's latest pool data recently, run
`server/deploy/pull-pool-data.sh` first so you're not curating against a
stale local copy — the tool's header shows when your local `movies.json`
was last modified as a sanity check.
