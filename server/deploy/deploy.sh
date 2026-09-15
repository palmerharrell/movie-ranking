#!/usr/bin/env bash
# Syncs /server code (not pool data) to the droplet and restarts the API
# service. Usage: DROPLET_HOST=user@host ./deploy.sh
#
# Deliberately does NOT sync data/ (#383). The droplet's own data/movies.json
# plus its suggested_movies table (server/db.js) is the live pool's source of
# truth — Search & Suggest additions and any droplet-side curation only exist
# there. Syncing data/ here would silently overwrite it with this machine's
# possibly-stale copy on every routine code deploy. To pull the droplet's
# current pool down to this machine instead (e.g. before a local curation
# pass), use pull-pool-data.sh in this same directory. A brand-new droplet
# still needs data/movies.json placed once by hand (or via
# pull-pool-data.sh's underlying `GET /api/movies` reversed with a one-off
# rsync) before the API can serve anything.
set -euo pipefail

DROPLET_HOST="${DROPLET_HOST:?Set DROPLET_HOST=user@host}"
REMOTE_DIR="${REMOTE_DIR:-/opt/movie-ranking/server}"
# The systemd service (see deploy/movie-ranking-api.service) runs as this
# user and needs write access to its own working directory (for SQLite's
# journal/WAL files). rsync preserves the *local* file owner by default,
# which silently reassigns everything to whoever's deploying (e.g. root over
# SSH can chown to anything) instead of this service account — breaking the
# service on restart. GNU rsync's --chown fixes this at transfer time, but
# macOS's built-in rsync (openrsync) doesn't support that flag, so we chown
# explicitly on the remote side afterward instead, which works everywhere.
REMOTE_USER="${REMOTE_USER:-movie-ranking}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_DIR="$(dirname "$SCRIPT_DIR")"
REPO_DIR="$(dirname "$SERVER_DIR")"
LIB_DIR="$REPO_DIR/src/lib"
SCRIPTS_DIR="$REPO_DIR/scripts"
REPO_REMOTE_DIR="$(dirname "$REMOTE_DIR")"

echo "Syncing server code to ${DROPLET_HOST}:${REMOTE_DIR} ..."
rsync -az --delete \
  --exclude node_modules \
  --exclude data.db \
  --exclude .env \
  "$SERVER_DIR/" "${DROPLET_HOST}:${REMOTE_DIR}/"

echo "Syncing shared elo/categoryGenerator lib (server imports these from ../src/lib) ..."
rsync -az "$LIB_DIR/" "${DROPLET_HOST}:${REPO_REMOTE_DIR}/src/lib/"

echo "Syncing TMDb enrichment scripts (server imports tmdb.js/enrichMovie.js/mergeSourceMovie.js from ../scripts for Search & Suggest, #243) ..."
rsync -az "$SCRIPTS_DIR/" "${DROPLET_HOST}:${REPO_REMOTE_DIR}/scripts/"

echo "Fixing ownership (rsync preserves the local file owner, not the service account) ..."
ssh "$DROPLET_HOST" "sudo chown -R ${REMOTE_USER}:${REMOTE_USER} ${REMOTE_DIR} ${REPO_REMOTE_DIR}/src ${REPO_REMOTE_DIR}/scripts"

echo "Installing dependencies and restarting service ..."
ssh "$DROPLET_HOST" "cd ${REMOTE_DIR} && npm ci --omit=dev && sudo systemctl restart movie-ranking-api"

echo "Done. Tailing recent logs:"
ssh "$DROPLET_HOST" "sudo journalctl -u movie-ranking-api -n 20 --no-pager"
