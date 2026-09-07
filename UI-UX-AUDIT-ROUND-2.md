# Komorebi Creations — Follow-up Review (Round 2)

**Date:** 2026-09-07
**Reviewing:** `origin/main` @ `abd8515` — 4 commits since the first audit
**Baseline:** `UI-UX-AUDIT.md` (28 findings, `f7b75e1`)
**Method:** Same as round 1 — headless Chromium at 1440×900, 820×1180, 390×844, 360×740; network profiling, DOM measurement, computed-contrast sampling, real keyboard and tap simulation.

---

## Verdict

**24 of 28 findings resolved.** This is a substantial, well-executed pass. Several fixes went beyond what was recommended — the honest "segera hadir" channel state and the per-flower/per-format channel structure are better than what I proposed.

The headline result:

| Metric | Round 1 | Round 2 | Change |
|---|---|---|---|
| Page weight, above fold (390px) | 14,993 KB | **354 KB** | **42× smaller** |
| Page weight, full page | 19,077 KB | **410 KB** | **46× smaller** |
| Mobile sticky header height | 160 px | **65 px** | −59% |
| Hero image position on mobile | y=1000 (below fold) | **y=307 (above fold)** | fixed |
| Anchor links landing under header | 5 of 5 broken | **0 of 7 broken** | fixed |
| Tap targets under 44 px | 27 | **3** | −89% |
| Contrast failures | 1 | 3 | see below |
| Console errors | 0 | 0 | — |
| Horizontal overflow | none | none | — |

The 410 KB full-page figure beats the 600 KB target I set. What remains is mostly **content contradictions and two dead contact details**, not layout or engineering.

---

## Verified fixed

### Performance (P0 #3)
WebP at 2–3 widths with correct `srcset`/`sizes`, `width`/`height` on every image, `decoding="async"`, `fetchpriority="high"` on the hero. The 1.8 MB logo is now a 7.7 KB `komorebi-logo-96.webp` with a 2× variant. Largest single asset on the page is now 70 KB.

### Marketplace handoff (P0 #2) — exceeded the recommendation
`app.js:722` now resolves `optMeta.channels.tokopediaUrl` per flower *per format*, falling back to store level. When a URL is absent the button is genuinely disabled (`aria-disabled`, `href` removed, label switches to "segera hadir") and the order note swaps to explain that WhatsApp handles orders for now. The WhatsApp draft correctly carries species + format + quantity + price:

```
https://wa.me/…?text=Halo Komorebi! Saya ingin memesan Lavender — Buket
(11 tangkai, Rp 275.000). Apakah masih tersedia?
```

Being honest about what isn't live yet is the right call and better than the placeholder links I flagged.

### Mobile (P1 #5–#9)
Hamburger with `aria-expanded`/`aria-controls`, auto-closing on selection (verified). Header 65 px. `scroll-margin-top: 85px` on all seven sections — verified by simulating real taps through the open menu, not just hash changes: section lands at top=85, first content at 149, header 65. Sticky order bar appears on scroll, live-updates title and price, and is `aria-hidden` toggled correctly.

### Accessibility (P3 #17–#24)
- `:focus-visible` rings across links, buttons, chips, format cards, channel buttons, FAQ summaries
- Skip link added
- `document.documentElement.lang` updates on switch; `aria-pressed` toggles correctly
- **Focus trap verified**: background `<header>`, `<main>`, `<footer>` and the sticky bar all get `inert = true` while locked. Tab cycles `lock-btn → skip-link → passcode-input` and never escapes. `elementFromPoint` mid-screen returns the overlay.
- `prefers-reduced-motion` honored in both CSS and JS. Scrolled the full page under `reducedMotion: reduce` — zero elements left below 0.9 opacity, and zero stranded invisible under normal motion either. The reveal system is safe.
- FAQ is now `<details>`/`<summary>`, first item open, remaining five closed
- `role="radiogroup"` on the selectors, `aria-live` announcer for selection changes, `<main>` landmark

### SEO (P4)
Description, canonical, full OG + Twitter Card, favicon set, `theme-color`, `robots.txt`, `sitemap.xml`, and a genuinely good JSON-LD `@graph` — Organization + WebSite + ItemList with four Products carrying `AggregateOffer` and per-format `Offer` nodes.

### Code hygiene (P5)
`editor.js` and `editor.css` deleted (935 lines). The duplicate `id:` key is gone — flowers now use `key` + `slug` alongside separate `en`/`id` translation blocks.

### Layout (P2 #10, #12, #14, #15)
Specs card moved full-width below both kit columns — the ~420 px dead space is gone, and the age guidance is now a `.specs-guidance` footnote rather than a fake stat. Format cards stack label above note and **now show per-format prices** (Rp 95.000 / 55.000 / 285.000), which was P2 #16. Chips fit four across with a check indicator.

---

## Still open

### P0 — the only live order channel points at a dummy number

`site-content.js` still ships:

```js
whatsappNumber: "6281234567890",       // dummy
instagramUrl: "https://instagram.com/komorebi",   // not your handle
```

Tokopedia and Shopee are now honestly disabled, which means **WhatsApp is the sole working path to an order — and it is a placeholder.** Round 1's finding #1 is narrower now but sharper: previously three broken channels among three, now one broken channel among one. This is still the single thing standing between the site and a sale.

Instagram appears in three places (about link, footer, JSON-LD `sameAs`).

### P1 — the copy contradicts the order box, in both languages

The order section honestly says Tokopedia and Shopee are "segera hadir" and that WhatsApp handles orders. But elsewhere the site states the opposite as fact:

| Location | Text | Problem |
|---|---|---|
| `site-content.js:316` trust bar `tr4d` | "Checkout lewat Tokopedia atau Shopee." | Under a heading reading "Pembayaran terlindungi" — a trust claim that is currently false |
| `site-content.js:411` FAQ | "…dikirim ke seluruh nusantara lewat kurir Tokopedia dan Shopee." | Neither is active |
| `site-content.js:457` / `:552` | Same two strings in English | Same |

A visitor reads "checkout is protected via Tokopedia or Shopee" in the trust bar, then finds both greyed out 800 px later. That undercuts exactly the trust the bar exists to build. Either soften these to future tense while the channels are pending, or gate them on the same `hasMarketplaceListing` flag `app.js` already computes for the order note.

**Related:** the footer's Tokopedia and Shopee links fall back to `href="#"` (`app.js:854-855`) — dead links that scroll to top, while the order section correctly disables the same channels. The footer should use the same disabled treatment or drop the links until the URLs exist.

### P2 — small, factual bugs

1. **`og:image:height` is wrong.** Declared `1122`; `img/hero-1122.webp` is actually **1122×1402**. Social platforms use this to reserve the preview box, so a wrong ratio risks a cropped or letterboxed card — on WhatsApp, which is your main sharing surface.
2. **`robots.txt` and the robots meta tag disagree.** `robots.txt` says `Allow: /` and advertises the sitemap; the page says `noindex, nofollow`. Not harmful (the meta wins), but if the intent is "staging, stay out" then `robots.txt` should say `Disallow: /`. Right now you invite crawlers in and then tell them to ignore everything. This is a launch-checklist item — worth pairing the two so they flip together.
3. **`hreflang` alternates are meaningless.** The sitemap declares `id`, `en` and `x-default` all pointing at `https://komorebicreations.com/`. Language is `localStorage`-driven with no distinct URLs, so there is nothing for a crawler to choose between. Either drop the alternates or give each language a real URL (`/en/`).
4. **`sitemap.xml` `lastmod` is hardcoded** to `2026-09-07` and will silently go stale.

### P3 — polish

5. **Contrast — one unfixed, two new.** Sampled from the rendered page:

```
  3.56:1   .lock-error            11px   #C0614E on #F3EDE1   (unfixed from round 1)
  4.23:1   .btn-disabled .channel-action  10px  "SEGERA HADIR"
  4.45:1   .btn-disabled .channel-name    21px
```

The disabled-channel text is the new one. Disabled *form controls* are exempt from WCAG 1.4.3, but these are links conveying essential status ("this channel isn't open yet") at 10 px with 0.16em tracking. Worth darkening.

6. **The mobile primary CTA moved below the fold.** Moving the hero image up was correct, but it pushed "Lihat koleksi" to y=967 on a 844 px screen (y=921 on 360×740, where the subheadline also drops below). Round 1 traded CTA-visible/image-hidden; this is the mirror image. A shorter hero crop on mobile (3:2 rather than 4:5, ~285 px) would fit both. Partly mitigated by the header's PESAN button and the sticky bar.

7. **Order section still lopsided on desktop.** The left column ends ~500 px above the summary box (round 1 #12 — the one layout item not addressed).

8. **`site-content.js:9` and `:14` still tell editors to click "⚙️ Mode Edit"** — the button and its code were deleted in `ab5faf7`. README was updated; this header comment was missed.

9. **README overstates a feature.** Line 42 claims the WhatsApp draft includes a "nomor referensi". No reference number exists anywhere in `app.js` or `site-content.js` — the generated message ends at the price.

10. **Focus placement after unlock.** Focus lands on `body#top` rather than the skip link, `<h1>`, or `#main-content`. And the skip link stays in the tab cycle while locked (it is the one body child not marked `inert`) — pressing Enter on it targets an inert `<main>`. Both are minor.

11. **`about-ig` link is 351×15 px** — one of the three remaining sub-44px targets, alongside `lock-btn` (306×42) and `mobile-order-btn` (75×40). The last two miss by 2–4 px.

### P3 — one resilience note

With JavaScript disabled, the page renders **0 product cards and 0 FAQ items** — the catalog, FAQ, trust bar and order builder are all client-rendered. The static JSON-LD means crawlers still get the product data, so this is not an SEO problem. But any JS error in the field yields a page with a headline, one photo, and nothing to buy. Worth knowing as a risk, not worth restructuring for.

---

## Corrections to my own round-1 report

Two things I should flag about the first audit's method:

- My original anchor test set `location.hash = ''` then immediately reassigned it, which raced with smooth scrolling and produced misleading offsets for `#howto` and `#faq` in this round's first run. Re-tested by clicking the real nav links: **anchors are correct.** The round-1 finding itself was real (82 px margin vs 160 px header), but I re-verified it properly this time.
- An early screenshot this round appeared to show the order summary box missing on desktop. That was the reveal animation not yet fired for an off-screen element at capture time. Measured directly: opacity 1, 802 px tall, `revealed` class applied. **No regression.**

---

## Suggested order of work

1. Real WhatsApp number and Instagram handle — one line each, unblocks everything.
2. Reconcile the marketplace copy (trust bar `tr4d`, both FAQ entries, footer links) with the "segera hadir" state.
3. Fix `og:image:height` to 1402.
4. At launch: flip robots meta to `index, follow`, decide `robots.txt`, remove the passcode gate.
5. Darken the disabled-channel and lock-error text.
6. Housekeeping: `site-content.js` edit-mode comment, README reference-number claim.

Items 1 and 2 are the difference between a site that looks trustworthy and one that is.
