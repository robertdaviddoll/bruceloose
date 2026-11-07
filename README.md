# Bruce Loose

A three.js side-scroller starring Bruce and Gremlin, with the roommates as enemies.

## Settings

Copy the example settings file and edit it:

```bash
cp .env.example .env
```

| Setting | Default | What it does |
|---|---|---|
| `GAME_PORT` | `8080` | Port to play on (`http://localhost:GAME_PORT`) |
| `SAVES_PER_MINUTE` | `6` | Score saves allowed per IP address per minute |

`.env` is git-ignored so your local settings never get committed. Without a `.env`, the defaults are used.

## Run with Docker

```bash
docker compose up -d --build
```

Play at http://localhost:8080 (or your `GAME_PORT`). Stop with `docker compose down`.
After changing `.env`, run `docker compose up -d` again to apply it.

Two services:
- `bruce-loose`: nginx serving the game, forwarding `/api` to the score server
- `api`: Node score server with SQLite (`server/`). Scores live in the `scores` Docker volume, so they survive restarts and rebuilds.

After changing the game, run `docker compose up -d --build` again.

## Run without Docker

Needs Node 22.13 or newer. No `npm install` required.

```bash
cd server
npm run dev        # serves the game + API at http://localhost:GAME_PORT (from ../.env, else 3000)
```

Or just open `public/index.html` in a browser to play without saving scores.

## Phones and controllers

- **Touch:** on-screen ◀ ▶, JUMP and ability buttons appear automatically on phones and tablets.
- **Controllers:** any controller the browser recognizes (Backbone, Razer Kishi, Xbox, PlayStation, Switch Pro over Bluetooth or USB):

  | Control | Action |
  |---|---|
  | D-pad / left stick | Move (and pick a cat on the title screen) |
  | A / Cross | Jump, start the game |
  | B, X, RB or RT | Ability (POUNCE / GROWL) |
  | Start / Menu | Pause and resume |

- **Fullscreen:** the ⛶ button (top right) goes fullscreen and locks to landscape where the phone allows it.
- **Add to Home Screen:** opens like an app with its own icon. On iPhone use Share → Add to Home Screen. Android's install prompt needs the game served over HTTPS (plain `http://` on your local network still works for playing).
- **Vibration:** on hits, stomps, abilities and winning (Android phones and rumble-capable controllers; iPhones don't allow web vibration).
- The screen stays awake while you play.

## Score API

| Method | Path | What it does |
|---|---|---|
| GET | `/api/health` | `{ "ok": true }` |
| GET | `/api/scores?limit=10` | Top scores (max 50) |
| POST | `/api/scores` | Save `{ name, score, coins, totalCoins, character, result, timeMs }`, returns `{ id, rank }` |

Names are 1-16 characters. Saves are limited per IP (`SAVES_PER_MINUTE`, default 6 per minute).

## Backing up or resetting scores

```bash
docker compose cp api:/data/scores.db ./scores-backup.db   # back up
docker compose down -v                                       # wipe all scores (deletes the volume)
```

## Layout

- `public/`: everything the browser loads. Put new sprites, sounds, etc. here.
  - `index.html`, `css/`, `js/` (`js/game.js` main loop, `js/cats.js`, `js/roommates.js`, `js/scores.js`, `js/mobile.js`)
  - `manifest.webmanifest`, `icons/`: home-screen app name and icons
- `server/`: score API
- `Dockerfile`, `nginx.conf`: the web container, which serves `public/`
- `source/`: reference photos and `design.json` (not shipped in the container)
