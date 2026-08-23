#!/usr/bin/env bash
# Syncs /server to the droplet and restarts the API service.
# Usage: DROPLET_HOST=user@host ./deploy.sh
set -euo pipefail

DROPLET_HOST="${DROPLET_HOST:?Set DROPLET_HOST=user@host}"
REMOTE_DIR="${REMOTE_DIR:-/opt/movie-ranking/server}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_DIR="$(dirname "$SCRIPT_DIR")"
DATA_DIR="$(dirname "$SERVER_DIR")/data"

echo "Syncing server code to ${DROPLET_HOST}:${REMOTE_DIR} ..."
rsync -az --delete \
  --exclude node_modules \
  --exclude data.db \
  --exclude .env \
  "$SERVER_DIR/" "${DROPLET_HOST}:${REMOTE_DIR}/"

echo "Syncing enriched movie data ..."
rsync -az "$DATA_DIR/" "${DROPLET_HOST}:$(dirname "$REMOTE_DIR")/data/"

echo "Installing dependencies and restarting service ..."
ssh "$DROPLET_HOST" "cd ${REMOTE_DIR} && npm ci --omit=dev && sudo systemctl restart movie-ranking-api"

echo "Done. Tailing recent logs:"
ssh "$DROPLET_HOST" "sudo journalctl -u movie-ranking-api -n 20 --no-pager"
