# Bruce Loose

A three.js side-scroller starring Bruce and Gremlin, with the roommates as enemies.

## Run with Docker

```bash
docker compose up -d --build
```

Play at http://localhost:8080. Stop with `docker compose down`.

Two services:
- `bruce-loose`: nginx serving the game, forwarding `/api` to the score server
- `api`: Node score server with SQLite (`server/`). Scores live in the `scores` Docker volume, so they survive restarts and rebuilds.

After changing the game, run `docker compose up -d --build` again.

## Run without Docker

Needs Node 22.13 or newer. No `npm install` required.

```bash
cd server
npm run dev        # serves the game + API at http://localhost:3000
```

Or just open `public/index.html` in a browser to play without saving scores.

## Score API

| Method | Path | What it does |
|---|---|---|
| GET | `/api/health` | `{ "ok": true }` |
| GET | `/api/scores?limit=10` | Top scores (max 50) |
| POST | `/api/scores` | Save `{ name, score, coins, totalCoins, character, result, timeMs }`, returns `{ id, rank }` |

Names are 1-16 characters. Saves are limited to 6 per minute per IP.

## Backing up or resetting scores

```bash
docker compose cp api:/data/scores.db ./scores-backup.db   # back up
docker compose down -v                                       # wipe all scores (deletes the volume)
```

## Layout

- `public/`: everything the browser loads. Put new sprites, sounds, etc. here.
  - `index.html`, `css/`, `js/` (`js/game.js` main loop, `js/cats.js`, `js/roommates.js`, `js/scores.js`)
- `server/`: score API
- `Dockerfile`, `nginx.conf`: the web container, which serves `public/`
- `source/`: reference photos and `design.json` (not shipped in the container)
