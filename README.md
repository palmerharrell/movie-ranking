# Movie Ranking

See [CLAUDE.md](./CLAUDE.md) for the full project spec.

## TMDb setup

1. Create a free account at [themoviedb.org](https://www.themoviedb.org/).
2. Go to Settings → API → Request an API key ("Developer", personal use is fine).
3. Copy the "API Read Access Token" (v4 auth) or the API key (v3) — either works.
4. Copy `.env.example` to `.env` and set `TMDB_API_KEY=...`. `.env` is gitignored
   — never commit it.

## Development

```bash
npm install
npm run dev
```
