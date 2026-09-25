# Alxanthia — "Coming soon" reel

A 21-second, seamlessly looping Instagram teaser: stop-motion cut paper in a
vintage botanical-plate style, animated at 12 fps ("on twos") inside a 30 fps file.

1. Four herbarium sheets (Rose → Tulip → Gerbera → Lavender). On each, a "PL." sticker
   is stamped on, the flower is assembled from hand-tinted cut-paper pieces (stems
   grow, leaves swing open, petals pop on), and a torn name tag flips over. Then
   the sheet lifts and slides off, shaking a few petals loose. A paper butterfly
   visits the tulip.
2. PL. V, a paper sunflower, is assembled. Its pieces flip over to a gold side one
   by one, press flat and resolve into the real Alxanthia logo, and the sparkles
   pop in.
3. "ALXANTHIA" is placed as cut-out letters. The bilingual tagline, "Segera hadir ·
   Coming soon" and @alxanthia arrive on paper strips. The butterfly lands on the logo.
4. A blank PL. I sheet slides back over everything, which is exactly frame 0.

This folder is **not part of the website**. `scripts/build.js` copies only an
explicit allowlist into `dist/`, so nothing here is published.

## Files to post

| File | Use |
| --- | --- |
| `out/alxanthia-coming-soon-9x16.mp4` | Reels / Stories (1080×1920), with sound effects |
| `out/alxanthia-coming-soon-9x16-silent.mp4` | Same, no audio — add Instagram music on top |
| `out/alxanthia-coming-soon-4x5.mp4` | Feed post (1080×1350), with sound effects |
| `out/alxanthia-coming-soon-4x5-silent.mp4` | Same, no audio |
| `out/alxanthia-coming-soon-*-cover.jpg` | Cover / thumbnail frame for each format |

All videos are H.264 High, 30 fps, yuv420p, `faststart` — Instagram's
recommended format. In the 9:16 version, all text sits inside the Reels safe
area (clear of the top bar, the caption and the right-hand buttons).

## Preview locally

```bash
npm run serve            # from the repo root
# open http://localhost:8080/promo/coming-soon/
```

Play/pause, scrub, and switch between 9:16 and 4:5. `?t=15` opens paused at a
given second; `?ratio=4x5` opens the feed format.

## Re-render

Needs `ffmpeg` on your PATH and the repo's dev dependencies (`npm ci`).

```bash
node promo/coming-soon/render.js                       # everything
node promo/coming-soon/render.js 4x5                   # one format
node promo/coming-soon/render.js stills 9x16 5 16.4    # PNG stills at given seconds
```

Rendering drives headless Chromium and captures each 12 fps stop-motion step
once (a few minutes per format). If
Playwright's own browser isn't installed, set `CHROMIUM_PATH` to a Chromium binary.

## How it's put together

- `timeline.js`: every timing in one place, shared by the visuals and the sound.
- `scene.js`: the cut-paper pieces, sheets, butterfly and lock-up, drawn as SVG
  with code. `renderAt(t)` quantises time to 12 fps and sets every frame from
  scratch, which makes the output deterministic and lets the loop close exactly.
- `audio.js`: synthesised stamp thumps, a paper tap for each piece placed, tag
  flicks, sheet slides and a soft chime (no third-party audio, so there's
  nothing to license).
- `assets/logo-mark.webp`, `assets/logo-sparkles.webp`: `alxanthia-logo.png`
  split into the flower and its sparkles so the sparkles can pop in one by one.
  The paper sunflower resolves into this real artwork, so the final logo is exact.
- `fonts/`: Cormorant Garamond (SIL Open Font License), bundled so renders
  don't depend on Google Fonts.

To change wording, edit the lock-up in `scene.js` (search for `ALXANTHIA`).
To change pacing, edit `timeline.js`. Then re-render.
