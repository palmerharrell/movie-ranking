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
This rsyncs `server/`, `data/`, and `src/lib/`, fixes ownership back to the
`movie-ranking` service account (rsync otherwise preserves the deploying
machine's local file owner), reinstalls dependencies, and restarts the
systemd service. It does not touch `.env` or `data.db` on the droplet.
