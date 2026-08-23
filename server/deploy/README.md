# Backend deploy — DigitalOcean droplet

One-time setup on the droplet, then a repeatable `deploy.sh` for updates.

## One-time setup

1. **Create a deploy user** (skip if reusing an existing one):
   ```
   sudo adduser --system --group --home /opt/movie-ranking movie-ranking
   sudo mkdir -p /opt/movie-ranking/server /opt/movie-ranking/data
   sudo chown -R movie-ranking:movie-ranking /opt/movie-ranking
   ```

2. **Install Node 22** (matches the CI workflow) if not already present:
   ```
   curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
   sudo apt-get install -y nodejs
   ```

3. **Copy this repo's `server/` and `data/` directories to the droplet** the
   first time (subsequent updates use `deploy.sh` instead):
   ```
   rsync -az --exclude node_modules server/ user@droplet:/opt/movie-ranking/server/
   rsync -az data/ user@droplet:/opt/movie-ranking/data/
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

8. **Allow the deploy user to restart the service without a password**, so
   `deploy.sh` doesn't need an interactive sudo prompt:
   ```
   echo "your-ssh-user ALL=(ALL) NOPASSWD: /usr/bin/systemctl restart movie-ranking-api" | sudo tee /etc/sudoers.d/movie-ranking-deploy
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
This rsyncs `server/` and `data/`, reinstalls dependencies, and restarts the
systemd service. It does not touch `.env` or `data.db` on the droplet.
