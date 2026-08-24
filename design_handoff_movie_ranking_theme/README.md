# Handoff: Movie Ranking — Theater Themes (Classic / Neon)

## Overview
A visual redesign of the existing Movie Ranking app (github.com/palmerharrell/movie-ranking).
Same information architecture as today — a full standings list on the left, a five-movie
category pack on the right that the user drags into order, and a Rank button — restyled
around a movie-theater aesthetic, plus a new theme switcher offering two palettes:
**Classic** (Velvet & Gold) and **Neon** (Neon Marquee).

## About the Design Files
`Movie Ranking Redesign.dc.html` is a **design reference created in HTML** — a prototype
showing intended look and behavior, not production code to copy. The task is to recreate
it inside the existing React + Vite + Tailwind app, using its components
(`src/App.jsx`, `src/components/LeftPanel.jsx`, `RightPanel.jsx`, `MovieTile.jsx`,
`RankButton.jsx`, `ListPicker.jsx`) and its @dnd-kit drag implementation. Do not port the
inline styles verbatim; express them as Tailwind classes / theme tokens.

The prototype hard-codes data from `data/curated-lists/top-80s-action.source.json` and uses
striped placeholder blocks where TMDb `posterUrl` images go. In the real app those blocks
are `<img src={movie.posterUrl}>` at the same dimensions.

## Fidelity
**High-fidelity.** Colors, type, spacing, and radii below are final and should be matched.
The one liberty: the prototype pins the app frame to 1120 × 1010 px so both themes could be
compared side by side. In the app it is a normal full-viewport layout — keep the column
widths and paddings, let height flow.

## Screens / Views

### Ranking screen (single screen, two themes)
**Purpose:** see where every movie in the active list currently stands, drag the current
five-pack into the order you believe in, hit Rank, get the next pack.

**Layout**
- Root: column flex, max width ~1120px, full height.
- **Banner** (fixed `height: 78px`, `box-sizing: border-box`, `padding: 0 32px`, bottom
  1px border, `display:flex; align-items:center; justify-content:space-between`).
  The fixed height exists so the theme toggle does not jump when themes switch — keep it.
  - Left: app title. Classic also shows three 9px marquee bulbs (gold, `box-shadow:0 0 10px`,
    two of them pulsing via a 2.4s `bulbGlow` keyframe alternating opacity 1 → .35).
  - Right: list picker chips, then the theme toggle (`margin-left:14px`).
- **Body**: CSS grid, `grid-template-columns: 340px 1px 1fr` (Classic — the 1px column is a
  vertical gradient rule) or `340px 1fr` with `border-right` on the first column (Neon).
  No gap, no outer padding: the standings column runs flush to the left edge and up to the banner.

**Standings column (left, 340px)**
- Padding `22px 8px 22px 22px`. Header row: label "THE STANDINGS" (mono, 12–14px,
  uppercase, letterspacing .12–.16em, accent color) and a right-aligned count, e.g. "15 titles".
- `<ol>`: `overflow-y:auto`, `padding: 0 15px 0 0` — the right gutter keeps the scrollbar
  outside the row tiles. Row gap 2px (Classic) / 6px (Neon).
- Row: rank number (fixed 24–26px wide), poster **38 × 56** (radius 4px), then title
  (15px, 500) and year (mono, 11px). No elo number is shown.
- Top 3 are emphasized: Classic fades a gold gradient
  `linear-gradient(90deg, rgba(224,178,90,.16→.07), transparent)` across ranks 1/2/3 with a
  serif gold numeral; Neon gives rank 1 a magenta tinted row with a magenta border and ranks
  2–3 a teal numeral. Ranks 4+ are quiet.

**Pack column (right)**
- Padding `26px 32px`. Header: eyebrow "NOW SHOWING" (mono, 11px, uppercase, ls .16–.18em,
  accent) above the category label (Classic: Playfair italic 26px; Neon: Archivo Black 24px).
  Neon wraps the whole pack in a card: 1px `rgba(63,210,199,.3)` border, radius 12px,
  `background: rgba(63,210,199,.05)`, padding `18px 20px 20px`.
- Five draggable tiles, 8–10px apart, `cursor:grab` (`grabbing` while dragging, 0.5 opacity
  on the dragged tile — current `MovieTile` behavior is correct):
  rank numeral · poster **72 × 108** (radius 5px) · text block · 3-line drag affordance
  (three 14–16px × 2px bars, 3px apart).
  Text block: title (15–16px, 600/700), year (mono 11px), then
  `Starring: <three names>` and `Directed by: <name>` at 12px / line-height 1.35 in a muted
  tone (#c7b6a8 Classic, #aab3cc Neon). These two lines are **new data** — see State below.
- Button: label exactly `Rank →`. Classic: pill, `linear-gradient(180deg,#f0c771,#d9a746)`,
  `padding:15px 46px`, ink #2a1216, `box-shadow:0 8px 24px rgba(224,178,90,.3)`.
  Neon: full-width, radius 8px, `#f04f8c`, ink #2a0a18, `box-shadow:0 8px 24px rgba(240,79,140,.28)`.
- Caption under the button (mono, 11px, muted):
  "Drag to reorder, click Rank to set order and go to next list".

**Theme toggle** (top right of banner)
- Two segments, `Classic` and `Neon`, mono 11px uppercase, ls .1em, padding `6px 14px`,
  inside a container with `height:37px; box-sizing:border-box; padding:3px`, 1px border,
  `background: rgba(0,0,0,.25)`. Classic theme: pill radius 999px, gold border, active
  segment solid #e0b25a. Neon: radius 6px container / 4px segments, active segment #f04f8c.
- The fixed 37px height and fixed 78px banner height together guarantee the control does not
  move when the theme changes. Preserve both.

## Interactions & Behavior
- **Theme toggle** switches the entire palette. Persist the choice (localStorage) and apply it
  at the root as a data attribute or class; nothing else about layout changes between themes
  except where noted above (Neon's pack card, Classic's divider rule and marquee bulbs).
- **List picker chips** switch the active curated list (existing behavior).
- **Drag to reorder** the five-pack (existing @dnd-kit sortable list).
- **Rank →** submits the current order, then loads the next category (existing
  `rankFivePack` + `getCategory` flow). Disabled state: existing 50% opacity /
  `cursor:not-allowed`.
- Hover: banner chips brighten border and text to the accent; primary button lightens
  (Classic → `linear-gradient(180deg,#f8d68d,#e5b65a)`, Neon → `#ff6ba1`).
- Standings list scrolls independently; the pack column does not scroll.

## State Management
- `theme: 'classic' | 'neon'` — new, persisted.
- Existing: `lists`, `activeListId`, `movies`, `category`, `ranking`, `error`.
- **New data requirement:** the pack tiles show cast and director. TMDb credits are not
  currently fetched — extend `scripts/enrich.js` / the movie store to persist
  `cast` (first three billed) and `director` per movie, and fall back to hiding those two
  lines when absent rather than showing empty labels.

## Design Tokens

### Classic — Velvet & Gold
| Token | Value |
| --- | --- |
| Page ground | `#2a1216` + `radial-gradient(120% 90% at 50% -20%, rgba(224,178,90,.16), transparent 60%)` |
| Tile surface | `#3a1a21`, border `rgba(224,178,90,.35)`, shadow `0 6px 18px rgba(0,0,0,.35)` |
| Gold accent | `#e0b25a` (hover `#f0c771`, deep `#d9a746`) |
| Text high / mid / low | `#f6ead6` / `#e8dccd` / `#8a7770` |
| Muted credit text | `#c7b6a8` |
| Divider | `linear-gradient(180deg, transparent, rgba(224,178,90,.3), transparent)` |
| Poster placeholder | `repeating-linear-gradient(135deg,#3b1a21 0 5px,#452027 5px 10px)` |

### Neon — Neon Marquee
| Token | Value |
| --- | --- |
| Page ground | `#0b1224` + teal radial at 15% 0% `rgba(63,210,199,.14)` + magenta radial at 95% 100% `rgba(240,79,140,.16)` |
| Tile surface | `#141d34`, border `rgba(255,255,255,.09)` |
| Row surface | `rgba(255,255,255,.04)`, border `rgba(255,255,255,.06)` |
| Teal accent | `#3fd2c7` (hover `#5fe3d9`) |
| Magenta accent | `#f04f8c` (hover `#ff6ba1`) |
| Text high / mid / low | `#f2f5ff` / `#dfe4f5` / `#8b95b5`, faint `#6f7a9c` |
| Divider | `1px solid rgba(255,255,255,.12)` |
| Poster placeholder | `repeating-linear-gradient(135deg,#1b2540 0 5px,#212c4c 5px 10px)` |

### Shared
- Radii: 4px (small poster), 5px (large poster), 6–9px (rows/tiles), 12px (cards), 999px (pills).
- Spacing rhythm: 2/6/8/10/14/18/22/26/32.
- Poster sizes: standings 38 × 56, pack 72 × 108 (both 2:3).
- Type — Classic: Playfair Display (600/800, italic for the category label) for display,
  DM Sans (400/500/700) for UI, IBM Plex Mono for metadata.
  Neon: Archivo Black for display, IBM Plex Sans (400/500/600) for UI, IBM Plex Mono for metadata.
  All from Google Fonts.
- Type scale: 30/26 display, 24 category, 15–16 title, 12–14 label, 11–12 metadata.

## Assets
No image assets. Posters come from TMDb (`movie.posterUrl`), as today; the prototype's
striped blocks are placeholders only. Favicon and everything else in the repo is unchanged.

## Files
- `screenshot-classic.png` — the Classic (Velvet & Gold) theme, full screen at 2x.
- `screenshot-neon.png` — the Neon (Neon Marquee) theme, full screen at 2x.
- `Movie Ranking Redesign.dc.html` — the prototype; open it in a browser and use the
  CLASSIC/NEON toggle to see both themes.
