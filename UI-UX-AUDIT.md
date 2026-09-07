# Komorebi Creations — UI/UX & Layout Audit

**Date:** 2026-09-07
**Scope:** `index.html`, `styles.css`, `app.js`, `site-content.js`, `img/`
**Method:** Live render in headless Chromium at 1440×900, 820×1180, 390×844 and 360×740, plus DOM measurement, network profiling, contrast calculation, and keyboard/anchor testing.

---

## Summary

The design language is genuinely good. The botanical-plate framing, the `Cormorant Garamond` + `Karla` + mono-eyebrow hierarchy, and the linen palette are coherent and distinctive. Contrast passes AA almost everywhere (body text 6.66:1, muted 5.27:1, ochre eyebrow 5.01:1).

The problems are not taste. They are **delivery, mobile, and the checkout handoff**.

| Priority | Theme | Count |
|---|---|---|
| P0 | Blocking — the store cannot take an order today | 4 |
| P1 | Mobile — the weakest surface, and where the traffic is | 5 |
| P2 | Layout & visual polish | 7 |
| P3 | Accessibility | 8 |
| P4 | SEO & metadata | 6 |
| P5 | Code hygiene affecting users | 4 |

---

## P0 — Blocking. The store cannot take an order today.

### 1. Every commercial link is a placeholder

`site-content.js` ships with:

| Field | Current value | Problem |
|---|---|---|
| `tokopediaUrl` | `https://www.tokopedia.com` | Marketplace homepage |
| `shopeeUrl` | `https://shopee.co.id` | Marketplace homepage |
| `instagramUrl` | `https://instagram.com/komorebi` | Not your handle |
| `whatsappNumber` | `6281234567890` | Dummy number |

This is live on `komorebicreations.com`. Every purchase path is a dead end — WhatsApp opens a chat with a nonexistent number.

### 2. The order builder throws away the user's selection at handoff

The Step 1 → 2 → 3 flow is the centrepiece of the page, but the checkout link is a single constant:

```js
// app.js:434
btnTokopedia.href = siteData.store.tokopediaUrl || '#';
```

Pick "Mawar → Buket, Rp 305.000", tap Tokopedia, and you land on Tokopedia's homepage with nothing selected. Only WhatsApp interpolates the choice.

**Fix:** per-flower, per-format URLs — `flowers.Rose.urls.Bouquet.tokopedia` — so the builder actually hands off. Until then the builder promises more than it delivers.

### 3. ~15 MB downloads before the visitor scrolls a pixel; 19 MB for the full page

Measured at 390×844:

```
  2566 KB  kit.png            2392 KB  hero.png
  2266 KB  macro.png          2111 KB  us.png
  2040 KB  sunflower.png      1972 KB  lavender.png
  1970 KB  rose.png           1862 KB  tulip.png
  1821 KB  komorebi-logo.png   <-- rendered at 40x40 px
    24 KB  styles.css            40 KB  app.js + site-content.js
```

Source PNGs are uncompressed at 1122×1402 and 1448×1086. For a mobile-first Indonesian audience on 4G this is 30–60 seconds to first paint. It is by far the single biggest thing costing you sales.

**Fix:** AVIF/WebP at 2–3 display sizes with `srcset`, sources resized to ~1200px max, and a 96px logo. Realistic target: **under 600 KB above the fold** — a 25× reduction with no visible quality loss. `loading="lazy"` is already on the below-fold images but cannot save you when each one is 2 MB.

### 4. The passcode gate is decorative, and it costs you the whole internet

- The passcode is `22062024`, readable by anyone at `komorebicreations.com/site-content.js`.
- The overlay has **no focus trap**. Pressing Tab while locked walks straight into the page behind it — testing reached `about-ig`, all three footer links, and "Lock Site" without ever unlocking. The full page content is in the DOM.
- Google cannot index the site, and every link shared on WhatsApp or Instagram shows a passcode wall instead of your product.

**Decide what this is for.** If it is pre-launch privacy, use hosting-level auth (Cloudflare Access, Netlify password) on a staging subdomain. If you are open for business, delete it. What is there now is the worst of both — it blocks customers and stops nobody.

---

## P1 — Mobile. Where the traffic is, and the weakest surface.

### 5. The sticky header eats 160 px of an 844 px phone screen — 19% of the viewport, permanently

It wraps into three rows (brand / four nav links + ID·EN / green PESAN button) because `.nav-group` relies on `flex-wrap` with no mobile treatment.

| Viewport | Header height |
|---|---|
| 1440 × 900 | 69 px |
| 820 × 1180 | 123 px |
| 390 × 844 | **160 px** |
| 360 × 740 | 147 px |

**Fix:** a hamburger or bottom sheet below 768px; collapse to logo + PESAN + menu icon at ~64px.

### 6. Every anchor link on mobile lands with the section title hidden under that header

Measured, all five:

```
mobile  #collection  headerH=160  first content top=142   <-- hidden
mobile  #kit         headerH=160  first content top=142   <-- hidden
mobile  #howto       headerH=160  first content top= 60   <-- hidden
mobile  #order       headerH=160  first content top=142   <-- hidden
mobile  #faq         headerH=160  first content top= 60   <-- hidden
```

`scroll-margin-top: 82px` was tuned for the 69px desktop header, and the two dark sections (`.how-section`, `.faq-section`) have no `scroll-margin-top` at all. Tapping "Koleksi" drops you into the middle of the cards.

### 7. The hero product photo starts at y=1000 on mobile — far below the fold

The `auto-fit` grid stacks text-then-image, so a phone visitor reads a headline, three benefit blocks and two buttons before ever seeing a flower. For a visual craft product that is backwards.

**Fix:** `order` the figure above the copy under 768px, or crop to a shorter aspect on mobile.

### 8. The mobile page is 12,873 px tall — roughly 15 screens

No sticky order affordance, no back-to-top. Once past the collection, ordering means scrolling blind.

**Fix:** a slim sticky bottom bar ("Bunga Matahari · Kit · Rp 95.000 → Pesan") that appears after the hero.

### 9. Tap targets below the 44 px minimum

27 elements fail. The ones that matter:

| Element | Size |
|---|---|
| Nav links (`#nav-collection`, `#nav-kit`, …) | 18 px tall |
| Stem / Bouquet quick-links on every product card | 18 px tall |
| Language buttons (`#lang-id`, `#lang-en`) | 29 px tall |

The quick-links are ordering paths sitting 8px apart — easy to mis-tap.

---

## P2 — Layout & visual polish

### 10. The "Isi kit" section has ~420 px of dead space

`align-items: start` on the two-column grid lets the right column (list + specs card) run much longer than the left photo. Either `position: sticky` the figure, let it fill, or move the specs card full-width beneath both columns.

### 11. Hero benefit items have a ragged baseline

"Semua sudah termasuk" wraps to two lines while "Ramah pemula" does not, so the three descriptions start at different heights. Same on mobile, where it becomes 2 columns plus an orphan third. Fix with subgrid or a `min-height` on `dt`.

### 12. The order section is lopsided on desktop

The left column ends at the "Buket" card while the summary box runs ~500px further, leaving a large empty quadrant. Consider a narrower left rail, or a sticky summary.

### 13. Flower chips wrap 3 + 1 at 1440px

Reads as accidental. Four fixed chips in a row, or a deliberate 2×2 grid.

### 14. Specs card mixes stats with sentences

"Sebaiknya didampingi orang dewasa" is set in 21px serif — the same treatment as "3 bunga" — and wraps to three lines, so a stat block reads like a paragraph. Move that row to a footnote under the card.

### 15. Format cards split label and note to opposite edges

On one baseline; on mobile the note crowds the label and the WhatsApp button's "CHAT →" wraps to two lines. Stack label above note.

### 16. Product cards are under-built for a shop

- Only the dark button is clickable — the photo and the name are not.
- No hover state on the image.
- No stem/bouquet price (only Kit price shows).
- No stock or "sold out" concept.

Making the whole card a link with a subtle image zoom would roughly double the tap area and match e-commerce convention.

---

## P3 — Accessibility

| # | Issue | Detail |
|---|---|---|
| 17 | **No focus styles anywhere** | `grep ":focus"` returns exactly one hit — the passcode input. Keyboard users navigating nav, chips, format cards and channel buttons see nothing at all. |
| 18 | **`<html lang="id">` never changes** | Switching to EN leaves the document declared Indonesian; screen readers read English copy with Indonesian pronunciation. |
| 19 | **Alt text is English-only and generic** | e.g. "Handmade chenille roses in dusty pink" regardless of active language, and it lives outside the translation blocks. |
| 20 | **No `prefers-reduced-motion`** | `scroll-behavior: smooth` plus JS `scrollIntoView({behavior:'smooth'})` are forced on everyone. |
| 21 | **Language buttons lack `aria-pressed`** | Active state is purely visual. |
| 22 | **FAQ is plain `<div>`s** | Fine on desktop (scannable 3×2 grid), but six long stacked blocks on mobile. `<details>`/`<summary>` would cut ~1,200px of scroll and add semantics for free. |
| 23 | **Lock error text is 3.56:1** | `#C0614E` on `#F3EDE1` — fails AA for small text. |
| 24 | **The lock overlay is not `inert`** | See P0 #4 — a screen reader reads the entire page behind it. |

### Contrast reference (all others pass)

```
  5.01  eyebrow ochre on cream       #8E6127 / #FAF6EE   PASS
  6.66  body text on cream           #5C574D / #FAF6EE   PASS
  5.27  muted on cream               #6E6656 / #FAF6EE   PASS
  4.87  muted on card                #6E6656 / #F3EDE1   PASS
  8.05  dark-text-muted on dark      #BDB6A8 / #23201B   PASS
  6.39  dark-accent on dark          #C79B5C / #23201B   PASS
  7.50  green button text            #FAF6EE / #3F5545   PASS
  5.22  shopee button text           #FDFBF6 / #8E6127   PASS
  3.56  lock error red               #C0614E / #F3EDE1   FAIL (small text)
```

---

## P4 — SEO & metadata (currently: none)

`index.html` has **zero** of these. Not weak — absent.

- No `<meta name="description">`
- No Open Graph or Twitter Card tags → shared links on WhatsApp and Instagram render as a bare URL with no image or copy. For a visual product sold through social, this is a real loss.
- No favicon
- No canonical URL
- No `robots.txt`, no `sitemap.xml`
- No JSON-LD. `Product` + `Offer` schema (you already have prices, availability and images structured in `site-content.js`) and `FAQPage` would be nearly free to add and would earn rich results.

The title `"Komorebi — DIY Flower Kits · Chenille Stems"` also omits Indonesia and the categories anyone would actually search — "kit bunga chenille", "buket bunga handmade".

---

## P5 — Code hygiene that affects users

### 25. `editor.js` + `editor.css` (31 KB) are dead code

Nothing references them. But `README.md` and the header comment in `site-content.js` both tell a non-developer to click a "⚙️ Mode Edit" button on the website. **That button does not exist.** Either wire the editor back up or delete it along with the instructions.

### 26. Each flower object has a duplicate `id:` key

```js
Sunflower: {
  id: "Sunflower",        // <-- silently overwritten
  ...
  id: { name: "Bunga Matahari", ... }   // <-- this one wins
}
```

It works only because nothing reads `flower.id` as a string. It is a trap for the next edit.

### 27. Every language switch and every chip click re-renders the entire page

`renderAll()` tears down and rebuilds all DOM and listeners. It is why `quickOrder` needs a smooth-scroll chaser. Scoping `setLanguage` to text-only updates would be faster and less jumpy.

### 28. `loadData()` deletes `komorebi_custom_data` on every page load

Leftover from the editor — harmless but confusing.

---

## If I had to pick five things

1. **Real marketplace / WhatsApp / Instagram URLs, per product and format.** Nothing else matters until an order can complete.
2. **Compress the images.** 19 MB → under 1 MB. Biggest conversion win available, at zero design cost.
3. **Resolve the passcode gate** — hosting-level auth on staging, or remove it. Then add meta description and OG tags so shared links show the sunflower.
4. **Rebuild the mobile header** as a hamburger, fix `scroll-margin-top` to match it, and move the hero image above the copy.
5. **Add a sticky mobile order bar** and make product cards fully clickable.

Items 1–3 are roughly half a day of work. They are worth more than everything in P2–P3 combined.
