# sources/

Master image files and old derivative sets that are **not referenced by
the live site** (checked automatically by `scripts/build.js`, which only
copies files that `index.html`/`app.js`/`styles.css`/`site-content.js`
actually mention). Kept here instead of deleted, in case they're needed
again — e.g. to regenerate a WebP derivative at a different size.

- `ALXANTHIA LOGO 2-02.png`, `alxanthia-logo-96.png` — unreferenced logo
  variants (the site uses `alxanthia-logo.png` and the `.webp` versions).
- `img/*.png` (hero, macro, rose, sunflower, tulip, gerbera, lavender,
  bouquet 3/5/9/15) — full-resolution master images. The site only ever
  loads the smaller `-360`/`-720`/etc. WebP derivatives generated from
  these.
- `img/kit-*.webp`, `img/us-*.webp` — derivative sets for a "Kit" product
  and an "About us" section that aren't part of the current site.

None of this is served by the deployed site (see ALX-01/ALX-23 in
`AUDIT.md`) — it's just kept out of the way here rather than lost.
