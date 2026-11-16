# GD Arcade

Six independent Geometry Dash daily mini-games in one neon cabinet collection. Every game has its own daily puzzle, practice or endless mode, scoring, streak, completion state and browser storage. Nothing is shared between cabinets except the local level database and the design system.

| Game | What you do | Daily mode | Practice / endless |
| --- | --- | --- | --- |
| **GD-le** | Guess a level from nine clues per guess. Green = exact, yellow = close, arrows point toward the answer. | Six guesses, thumbnail reveal at the end. | Practice board, no daily stats. |
| **Connections** | Split 16 levels into four groups of four. | Four mistakes, four category tiers, shuffle. | Practice sets. |
| **Thumbnaille** | Identify a level from its real thumbnail under progressive blur. | Six attempts, automatic hints, three difficulties. | Practice thumbnails. |
| **Higher / Lower** | Compare a hidden level stat: higher, lower or tie. | 10 fixed comparisons, 8/10 clear target. | Endless until the first miss. |
| **Demon Order** | Drag demons into hardest-to-easiest order. | Six Pointercrate-ranked demons. | Practice and endless ladders with Pointercrate or in-game tiers. |
| **Songle** | Name a GD track from a growing Newgrounds audio excerpt. | Six attempts, 1s → 12s excerpts, automatic hints. | Practice song and endless solve chain. |

## Run it

The site is fully static — no build step and no server-side code.

```bash
cd gd-arcade
python3 -m http.server 8000
```

Open `http://localhost:8000/`. Opening `index.html` directly also works, but a local server gives more reliable font, image and audio loading.

## Project layout

```text
gd-arcade/
├─ index.html              homepage, daily board, arcade snapshot
├─ script.js               homepage cards and summary
├─ style.css               shared design system + all game styles
├─ js/core.js              data API, storage, stats, dialogs, search, UI helpers
├─ data/
│  ├─ levels.js            122-level central database
│  ├─ songs.js             86 Newgrounds tracks with official stream URLs
│  ├─ demonlist.js         Pointercrate top-100 snapshot
│  └─ connections.js       curated groups and compatibility exclusions
├─ games/
│  ├─ gdle.html / .js
│  ├─ connections.html / .js
│  ├─ thumbnaille.html / .js
│  ├─ higher-lower.html / .js
│  ├─ demon-order.html / .js
│  └─ songle.html / .js
└─ scripts/fetch-meta.mjs  data refresh helper
```

`window.GDArcade` in `js/core.js` is the only shared runtime. It exposes the level/song/ranking data, seeded daily RNG, per-game storage helpers, stats, header/footer, settings, dialogs, toast/confetti/share helpers, thumbnails and the searchable combobox.

## Data provenance

All data is a **local snapshot** taken on **2026-11-15**. No live API call is required to play.

- **Levels** — 122 community levels from [GDBrowser](https://gdbrowser.com/): creator, difficulty, song metadata, downloads, likes, stars, length, version and level IDs. 108 levels are eligible for daily pools.
- **Demon rankings** — the top 100 positions from [Pointercrate](https://pointercrate.com/demonlist/). Thirty demonlist entries share a name with a local level (one name appears twice on the list), giving 29 local levels with a Pointercrate position after creator disambiguation — 28 are rated Demon in-game, while Old Orochi is ranked #17 despite an Insane rating. Demon Order's Pointercrate mode uses these exact positions; its tier mode uses the official in-game Easy / Medium / Hard / Insane / Extreme Demon labels.
- **Thumbnails** — real community thumbnails are requested by level ID from `levelthumbs.prevter.me`. If a thumbnail is missing or blocked, the card shows a labelled fallback instead of inventing an image.
- **Songs** — 86 custom-song streams from [Newgrounds](https://www.newgrounds.com/audio). Songle streams audio directly from Newgrounds' official CDN and links each answer to its track page and artist profile. **No music files are downloaded, re-hosted or redistributed by this project.**

  > **Do not remove `<meta name="referrer" content="no-referrer">` from `games/songle.html`.** Newgrounds CDN checks the `Referer` header: a request from any non-Newgrounds origin receives a ~10-second hotlink-warning MP3 instead of the real track. Suppressing the referrer document-wide makes the browser send no `Referer` for the `<audio>` request, which returns the full track. `referrerpolicy` is *not* a valid attribute on `<audio>`, so the document-level meta tag is the supported mechanism. Do not add `crossorigin` either — the CDN sends no `Access-Control-Allow-Origin`, so CORS mode would break playback.
- **Connections groups** — curated by hand from the local database. Some levels intentionally belong to more than one category, so groups carry `excludes` rules and a board is only drawn from four mutually compatible, level-disjoint groups. All 143 valid four-group combinations were checked before shipping.
- **Official Geometry Dash soundtrack** — intentionally not included. Those songs are not redistributed here; Songle only uses community tracks with public Newgrounds streams.

### Refreshing the snapshot

```bash
node scripts/fetch-meta.mjs
```

The script reads the existing `data/levels.js`, requests Pointercrate and GDBrowser with retries and rate-limit backoff, resolves Newgrounds track pages, and rewrites `data/levels.js`, `data/songs.js` and `data/demonlist.js`. It is deliberately gentle: 220 ms between GDBrowser requests and 180 ms between Newgrounds requests.

Things to know before refreshing:

- APIs can rate-limit (`429`), change shape, or be temporarily unavailable. The script retries `429`/`5xx` responses, but a refresh can still leave data missing.
- If Pointercrate fails or returns an empty list, the refresh keeps the previous `data/demonlist.js` and demon fields instead of wiping rankings. On a successful fetch, levels that dropped off the list have their `demonPosition` and `verifier` cleared so stale metadata cannot linger.
- Pointercrate can contain **two different levels with the same name**. The refresh matches duplicates by creator as well as name. The shipped snapshot fixes Thinking Space II to the CairoX entry (position 4), not the unrelated CoCyMain entry.
- Newgrounds stream URLs can expire, be removed or be region-blocked. Songle has an audio-error panel with a direct track link for exactly this case.
- Newgrounds returns `403` to server-side page requests from some networks. When that happens the refresh reuses the cached stream URL for each song, stops after three consecutive blocks, and leaves `data/songs.js` untouched if nothing new resolves — so a refresh never empties Songle.
- GDBrowser does not expose a reliable “total levels by creator” value, so GD Arcade does not display one.
- Song titles/artists can contain HTML entities. The refresh decodes them before writing JSON.

## Persistence and reset

Storage uses a single versioned prefix: `gdarcade.v1.`. Each game has isolated keys:

- `stats.<game>` — per-game stats and records
- `daily.<game>.<YYYY-MM-DD>` — completed daily result
- `progress.<game>.<YYYY-MM-DD>` — in-progress daily state
- `gdarcade.v1.settings` — sound, reduced motion, master volume
- `gdarcade.v1.songle.volume` — Songle’s separate audio volume preference

The **Stats** dialog in every game has a reset action scoped to that game. The homepage settings dialog can reset the whole arcade after confirmation. Daily completion is never combined across games.

## Accessibility & resilience

- Keyboard-first comboboxes with arrow keys, Enter and Escape.
- Arrow-button and arrow-key sorting in Demon Order, plus drag and drop.
- Visible focus states, skip link, semantic dialogs and live regions.
- Reduced-motion support via both the settings panel and `prefers-reduced-motion`.
- Mobile layouts with stacked game boards, touch-friendly controls and responsive audio controls.
- Loading, empty-search, duplicate-guess, missing-data, thumbnail-failure and audio-failure states are all handled explicitly.
- Daily selection uses a seeded RNG, so the same date produces the same puzzle for everyone using the same snapshot.

## Attribution

Unofficial fan project. Geometry Dash is a game by RobTop Games. Not affiliated with RobTop Games, GDBrowser, Pointercrate, Newgrounds or the thumbnail artists. Level, ranking and audio metadata belong to their respective creators. Music rights remain with the artists.
