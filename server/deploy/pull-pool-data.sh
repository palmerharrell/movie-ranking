#!/usr/bin/env bash
# Pulls the droplet's live movie pool down into this repo's data/movies.json
# (#383). The droplet is the source of truth for pool data: its own
# data/movies.json plus anything added live via Search & Suggest, stored
# separately in the suggested_movies table (server/db.js, #243) and merged in
# at read time (rankingService.js's loadAllMovies). Hitting the running API's
# own GET /api/movies (unfiltered) gets that same merge for free, rather than
# reimplementing it here or SSHing in to read two separate sources by hand.
#
# Usage: API_BASE_URL=https://api.example.com API_TOKEN=... ./pull-pool-data.sh
#
# data/movies.json is gitignored (a generated build artifact, not checked
# into the repo — see .gitignore) rather than something to `git diff`/commit,
# so back this file up yourself first if you want to compare before/after —
# this overwrites it outright.
set -euo pipefail

API_BASE_URL="${API_BASE_URL:?Set API_BASE_URL=https://your-api-host}"
API_TOKEN="${API_TOKEN:?Set API_TOKEN=<the droplets API bearer token>}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(dirname "$(dirname "$SCRIPT_DIR")")"
OUT_FILE="$REPO_DIR/data/movies.json"
TMP_FILE="$OUT_FILE.pull-tmp"

echo "Fetching merged pool (movies.json + suggested_movies) from ${API_BASE_URL}/api/movies ..."
curl -sf -H "Authorization: Bearer ${API_TOKEN}" "${API_BASE_URL}/api/movies" -o "$TMP_FILE"

node -e "
const fs = require('node:fs')
const movies = JSON.parse(fs.readFileSync('$TMP_FILE', 'utf8'))
if (!Array.isArray(movies)) throw new Error('Expected an array of movies')
fs.writeFileSync('$OUT_FILE', JSON.stringify(movies, null, 2) + '\n')
console.log('Wrote ' + movies.length + ' movies to $OUT_FILE')
"
rm -f "$TMP_FILE"

echo "Done."
