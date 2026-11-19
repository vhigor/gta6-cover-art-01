[![make.fun · gta6-cover-art-01](https://make.fun/badge/gta6-cover-art-01.svg)](https://make.fun/bounty/gta6-cover-art-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)
[![rank](https://make.fun/badge/gta6-cover-art-01/vhigor/gta6-cover-art-01/rank.svg)](https://make.fun/bounty/gta6-cover-art-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)
[![reward](https://make.fun/badge/gta6-cover-art-01/vhigor/gta6-cover-art-01/reward.svg)](https://make.fun/bounty/gta6-cover-art-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)

# Vice Coast Cover Studio

Turn any photo and a caption into GTA 6-style cover art — the multi-panel
poster look with bold lettering and a Vice City sunset / neon grade —
exported as a PNG to share. It runs **offline in a desktop browser from its
own static files**: photos never leave the machine, no upload, no watermark.

## What it does

- **6 layouts** — Quad Grid, Hero + Three, Full Bleed, Nine Grid (title
  block in the centre), Tilted Snaps (polaroid-style, on a sunset sky) and
  Duo.
- **Any photo** — up to 4 photos; click a panel to select it, drag it to
  reposition, scroll to zoom, or set its zoom and photo from the panel
  editor. Panels can share one photo or mix several, each with its own crop.
- **5 colour grades** — Sunset, Neon Vice, Dusk, Golden Hour and Mono Noir,
  each a real gradient-map grade applied per panel on canvas.
- **Caption** — a title in Anton with a halftone title block, a neon script
  subtitle in Pacifico, and a 5-star meter; all editable live.
- **Fast and easy** — photo to PNG in a few clicks: export the current size
  or **all three post sizes at once** (1080 × 1080, 1080 × 1350, 1920 × 1080).
- **Polish** — film grain, vignette, inked panel edges, undo / redo
  (Ctrl+Z / Ctrl+Y), and two bundled sample photos to try it instantly.

## Try it

```sh
node serve.ts
# open http://localhost:8080
```

No build step, no network request. Fonts (Anton and Pacifico, SIL Open
Font License — see `app/fonts/OFL-*.txt`) and sample photos live under
`app/`. Everything is original: no Rockstar Games logo, artwork or fonts.

## Entry

`main.ts` (Node 22, standard library only) copies `app/` and `screenshots/`
to `/output` and writes `/output/dossier.json` with the kit's
`vendor/makefun-app.ts`:

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```
