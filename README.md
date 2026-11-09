# Bruce Loose

Current version: see `public/config.js` (shown on the main menu and saved with every score).

## Versioning

Versions are `MAJOR.MINOR.PATCH`, set in `public/config.js`:

- **PATCH** (third number): bump for any code change that doesn't affect gameplay or scoring, such as menus, the server, visuals or bug fixes. Example: 0.0.14 → 0.0.15.
- **MINOR** (second number): bump for any change to how the game plays or how score is counted, such as level layout, physics, abilities, enemies, points or lives. Reset PATCH to 0. Example: 0.0.15 → 0.1.0.
- **MAJOR** (first number): not used yet.

Because every score is saved with its version, scores from different minor versions were played under different rules. In-game leaderboards (Hall of Fame, end-of-game top 10, All scores) only show the current major.minor (e.g. all 0.1.x scores). Everything else is under **Archived**.

A three.js side-scroller starring Bruce and Gremlin, with the roommates as enemies.

## Scoring

| What | Points |
|---|---|
| Coin | +10 |
| Knock out a roommate (stomp, or Bruce's pounce) | +100 |
| Smash a thrown object with Bruce's pounce | +10, **once per roommate** (more smashes from the same roommate give nothing) |
| Finish: each life left | +500 |
| Finish: every coin collected | +2,000 |

Checkpoints, Gremlin's growl, Steven P's rescue and time give no points (time only breaks ties). The current level's maximum is 5,040: 79 coins, 7 roommates, 5 thrower smash bonuses, 3 lives and the all-coins bonus.

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

## Menus

- **Play:** pick Bruce or Gremlin, then Start.
- **Options:** sound on/off, volume, vibration on/off, and touch buttons (Auto / Always / Off). Saved in the browser.
- **Characters:** bios, what each character does in the game, and a tip for beating them. Text lives in `public/js/characters.js`.
- **Hall of Fame:** top 20 saved scores (needs the score server). **See more** (here and on the end-of-game leaderboard) opens every score, with filters for device, cat and player; more load as you scroll.

Menus work with touch/mouse, keyboard (arrows, Enter/Space, Esc to go back) and controllers (d-pad, A to choose, B to go back). On the cat picker, Enter or A on a cat starts the game with that cat.

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
| GET | `/api/scores?limit=25&series=0.1&archived=1&device=phone&character=bruce&player=ste&after=…` | Scores, best first (max 50 per page). `series=0.1` limits to versions 0.1.x; add `archived=1` for every other version (including untagged older scores). Optional `device` (`phone`/`tablet`/`desktop`), `character` (`bruce`/`gremlin`) and `player` (name contains, any case) filters. Returns `{ scores, next, total }`; pass `next` back as `after` for the next page (`total` only on the first page). |
| GET | `/api/players` | Player names, for search suggestions |
| POST | `/api/scores` | Save `{ name, score, coins, totalCoins, character, result, timeMs, device, checkpoints, totalCheckpoints }`, returns `{ id, rank, total, series }` (rank and total are within the same major.minor version). Also accepts `version` (e.g. `0.1.1`) |

`device` is `phone`, `tablet` or `desktop`, and `checkpoints` / `totalCheckpoints` count checkpoints passed (all optional; shown as icons on the score lists). Names are 1-16 characters. Saves are limited per IP (`SAVES_PER_MINUTE`, default 6 per minute).

## Backing up or resetting scores

```bash
docker compose cp api:/data/scores.db ./scores-backup.db   # back up
docker compose down -v                                       # wipe all scores (deletes the volume)
```

## Layout

- `public/`: everything the browser loads. Put new sprites, sounds, etc. here.
  - `index.html`, `css/`, `js/` (`js/game.js` main loop, `js/cats.js`, `js/roommates.js`, `js/scores.js`, `js/mobile.js`, `js/menu.js`, `js/settings.js`, `js/characters.js`)
  - `config.js`: main game config (name, version). Bump `version` for each release.
  - `manifest.webmanifest`, `icons/`: home-screen app name and icons
- `server/`: score API
- `Dockerfile`, `nginx.conf`: the web container, which serves `public/`
- `source/`: reference photos and `design.json` (not shipped in the container)
