# Komorebi — UI/UX Audit & Remediation Brief

**Audited:** 2026-09-08 · **Target:** `index.html`, `styles.css`, `app.js`, `site-content.js`
**For:** the agent fixing the live site. Read this whole file before editing anything.

Findings were produced by running the site in headless Chromium at 1440px, 390px and 320px,
walking the full order flow in both languages, and measuring contrast, tap targets and layout
geometry directly from the DOM. Every number below is measured, not estimated.

---

## 0. Hard constraints — read first

These are the rules that make a fix acceptable. Violating any of them makes the change worse
than doing nothing.

### 0.1 Placeholder content is intentional. Do not "fix" it.

The store owner has **not** supplied final content yet. The following are known placeholders and
are **out of scope**. Do not invent values, do not fill them in, do not flag them as bugs:

- `store.whatsappNumber` (`site-content.js:33`) — placeholder digits
- `store.shopeeUrl` (`site-content.js:31`) — deliberately empty; the disabled "Segera hadir"
  state is the *correct, honest* behaviour
- `store.instagramUrl` (`site-content.js:29`) — placeholder handle
- All prices in `site-content.js` (stem prices, package prices, `wrapFee`, `bulkRate`)
- All marketing copy in `translations.id` / `translations.en`
- Product photography

If a fix appears to require a real value, implement the fix so it works correctly *when* the real
value arrives, and leave the placeholder alone.

### 0.2 Zero-dependency architecture

No build step, no bundler, no framework, no runtime `node_modules`. Vanilla HTML5 + CSS3 custom
properties + ES6+. The site must stay openable as a plain file and deployable to GitHub Pages.
`@playwright/test` is a devDependency for tests only — it must not become a runtime dependency.

### 0.3 The test suite is the regression gate

```bash
node tests/verify-ordering.js
```

**Baseline as of this audit: all 15 suites pass.** Any change must leave them passing. If a fix
in Tier 3 legitimately invalidates a test's assumptions (it will — the tests assert against the
current three-mode state machine), **update the test to assert the new intended behaviour**;
never delete a suite or weaken an assertion to make red go green.

### 0.4 Keep the visual language

The botanical-plate framing, the cream/`#FAF6EE` palette, Cormorant Garamond + Karla, the dark
craft sections. This audit asks for *corrections within* that language, not a restyle.

---

## 1. How to run and reproduce

```bash
python3 -m http.server 8080     # or: npm start
```

Open `http://localhost:8080`. The site is behind a client-side staging curtain; the passcode is
in `site-content.js` under `auth.passcode`.

### Measurement harness

Chromium is available at `/opt/pw-browsers/chromium-1194/chrome-linux/chrome` (the version
Playwright auto-resolves is a mismatch — pass `executablePath` explicitly). This script reproduces
the geometry numbers cited below:

```js
const { chromium } = require('./node_modules/playwright');
(async () => {
  const b = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
  });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true });
  const p = await ctx.newPage();
  await p.goto('http://localhost:8080/index.html', { waitUntil: 'networkidle' });
  await p.fill('#passcode-input', '<passcode>');
  await p.click('.lock-btn');
  await p.waitForTimeout(900);
  console.log(await p.evaluate(() => ({
    docH: document.body.scrollHeight,
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    firstProduct: Math.round(document.querySelector('#collection').getBoundingClientRect().top + scrollY),
  })));
  await b.close();
})();
```

Note: Google Fonts may be blocked in a sandboxed environment; the page falls back to
Georgia/Helvetica. Layout geometry is unaffected, but don't judge type colour from a screenshot
taken without webfonts.

---

## 2. Findings

Ordered by tier. **Tier 1 and 2 are independent of each other and of Tier 3** — they can be done
in any order, in separate commits. Tier 3 is a coordinated rewrite and should be its own branch.

---

## TIER 1 — Mechanical fixes

Unambiguous, single-rule changes. No design judgment required.

### T1-1 · Horizontal overflow at 320px

**Measured:** `document.scrollWidth` = 325 vs `clientWidth` = 320 at a 320px viewport.
`.header-actions-mobile` and `.nav-toggle` both report `right: 325`.

**Effect:** The wordmark is clipped underneath the PESAN button and ~5px of the hamburger is cut
off the right edge. `body { overflow-x: clip }` (`styles.css:59`) suppresses the scrollbar, which
makes it *worse* — the control is unreachable rather than scrollable.

**Cause:** `.brand-group` (`styles.css:191`) is a flex child that never shrinks; `.brand-name`
(`styles.css:206`) is 25px with `0.2em` letter-spacing and has no shrink allowance. The
`@media (max-width: 860px)` block (`styles.css:2679`) reduces the logo and name but not enough at
320px, and there is no rule below the `360px` breakpoint (`styles.css:3272`) that addresses the
header at all.

**Fix direction:** Give `.brand-group` `min-width: 0` and allow the brand name to shrink or
truncate. Consider hiding `.brand-est` below ~360px. Verify `scrollWidth === clientWidth` at 320px
**and** that `.nav-toggle` is fully within the viewport.

**Verify:** overflow delta is `0` at 320, 360 and 390px.

---

### T1-2 · Contrast failures (WCAG AA)

Measured against the computed background of each element.

| Selector | Location | Measured | Required | Note |
|---|---|---|---|---|
| `.btn-use-custom:disabled` | `styles.css:1551` | **2.46:1** | 4.5 | `#FAF6EE` on `#A79E8C` at `opacity: 0.8` |
| `.btn-channel .channel-name` | `styles.css:2101` | 4.45:1 | 4.5 | |
| `.btn-channel .channel-action` | `styles.css:2119` | 4.23:1 | 4.5 | `--accent-ochre` on card |
| `.mkt-active-tag` | `styles.css:2301` | 4.13:1 | 4.5 | |

The disabled-button case is the serious one — 2.46:1 is roughly illegible, and it is the state a
first-time visitor sees on the custom builder's primary CTA.

**Fix direction:** Darken the disabled background and drop the compounding `opacity: 0.8` (opacity
on top of a low-contrast pair is what pushes it to 2.46). For the 4.1–4.5 rows, nudge the
foreground token rather than inventing new one-off colours. The base palette in `:root`
(`styles.css:5–37`) is otherwise sound — `--accent-ochre` on `--bg-main` measures 5.0:1,
`--text-muted` 5.26:1, `--dark-text-muted` on `--dark-bg` 8.05:1. Don't disturb those.

**Verify:** every text node ≥ 4.5:1 (≥ 3:1 for ≥24px or ≥18.66px bold).

---

### T1-3 · Tap targets below 44px on mobile

| Selector | Location | Measured @390px |
|---|---|---|
| `.btn-edit-selection` | `styles.css:1894` | 127 × **32** |
| `.btn-toggle-custom` | `styles.css:1270`, mobile override `styles.css:3135` | 212 × **38** |

`.btn-edit-selection` sets `min-height: 32px` explicitly. `.btn-toggle-custom` declares
`min-height: 48px` but the mobile override doesn't preserve it against the surrounding padding.

The README claims 44px throughout; these two are the exceptions. Everything else measured clean.

**Verify:** no interactive element reports width or height < 44 at 390px.

---

### T1-4 · Heading order violation

The staging curtain's `<h2>Komorebi</h2>` (`index.html:337`) precedes the page `<h1>`
(`index.html:412`) in document order, so the first heading a screen reader meets is an h2.

**Fix direction:** the lock card's brand line is decorative — demote it to a `<p>` with the
existing `.lock-brand` class, or make it the `h1` of the curtain and leave the page h1 as the
document's second. Prefer demoting; it's a curtain, not content.

Also note `#image-modal-title` (`index.html:791`) is an empty `<h3>` while the dialog is closed.
Harmless in practice, but populate or hide it if trivial.

---

### T1-5 · Staging leftovers in customer-facing UI

Two items that are structural rather than copy, so they're in scope:

1. **"Lock Site" button** (`index.html:764`) sits inside `.footer-links` among real navigation
   links, styled like them. It's a developer affordance. It should be visually separated, or
   gated behind the same flag as the curtain (`auth.enabled`), so it disappears at launch rather
   than needing a manual delete.
2. **`(draf)` / `(draft)` renders in the Buket Mini card** — `site-content.js:285` (ID) and
   `site-content.js:480` (EN). This is a review marker that reached the customer-facing string.
   Only Buket Mini has it; the other three package blurbs don't. Removing the parenthetical is the
   fix — **do not rewrite the surrounding copy** (see §0.1).

---

## TIER 2 — Design corrections

These need judgment, but each is self-contained and low-risk. None touch order-flow logic.

### T2-1 · Product card grid doesn't align on the price row

In `#collection-grid`, the four cards' bottom buttons align but their **price rows land at
different Y positions**: Gerbera's is ~49px higher than Sunflower's because Gerbera carries an
extra disclaimer box, and Mawar's spec line wraps to two lines.

Price is the element the eye sweeps horizontally across a product row. It's currently the one
element off the grid.

**Fix direction:** give the card interior a consistent row structure — CSS Grid with named rows,
or `subgrid` on the card so spec/price/actions land on shared tracks regardless of content length.
Relevant: `.flower-spec-line` (`styles.css:728`), `.flower-price-line` (`styles.css:737`).

---

### T2-2 · Per-stem pricing vs multi-stem photography

All four flower photos show 3–4 stems, but every price is **per single stem**. Only Gerbera
carries the `.flower-photo-pill` badge ("Foto: 3 varian", `app.js:642`) plus a disclaimer box.

Two problems: the disclaimer is needed on all four or none, and the one-card treatment is what
breaks T2-1's alignment.

**Fix direction:** either apply a consistent per-card note (a small "harga per tangkai" qualifier
under every price, which the layout already has room for), or re-shoot/crop to single stems. The
current asymmetric apology reads as if only Gerbera is misleading.

---

### T2-3 · Bouquet photography is inconsistent within one product family

Buket Mini (3) and Sedang (5) are photographed as **unwrapped hand-ties on plain cream**. Buket
Besar (9) and Istimewa (15) are **fully wrapped with ribbon**. Wrap and ribbon are included in all
four (`pkgIncludes`, `site-content.js:291`).

Effect: the two cheaper SKUs visually appear to include less than they do.

**Fix direction:** photography change, not code — flag it to the owner. If unfixable near-term,
compensate by surfacing the "wrap + ribbon included" line more prominently on the 3 and 5 cards.

---

### T2-4 · The four colour dots are decoration shaped like information

Every bouquet card renders the same four dots regardless of stem count or contents. A user
reasonably reads them as a colour spec.

**Fix direction:** either bind them to real data (the actual flower mix for that package) or
remove them. Don't leave a fake data visualisation on a product card.

---

### T2-5 · Systemic small type

Measured: nearly every label, button, badge and eyebrow renders at **11–11.5px**;
`.footer-soon-tag` at **9.58px**. Notably the primary product CTAs:

- `.btn-order-stem` (`styles.css:775`) — 11px, uppercase, `letter-spacing`
- `.btn-add-bouquet` (`styles.css:804`) — 11px
- `.btn-choose-bouquet` (`styles.css:1110`) — 11px
- `.btn-use-custom` (`styles.css:1530`) — 11px
- `.step-label` (`styles.css:1732`) — 11px

11px uppercase with tracking is a caption size doing a purchase button's job. Body copy at 15px
(`.section-sub`, `styles.css:112`) is also low for a gift-buying audience.

**Fix direction:** establish a real scale. Suggested floor: 13px for labels/badges, 14–15px for
button text, 16px for body. This is a token-level change — do it in `:root` and the shared label
classes, not by hand-editing dozens of rules. Preserve the *relative* hierarchy; just move the
floor up.

---

### T2-6 · Monospace is overused

`--font-mono` (`styles.css:28`) currently carries: eyebrows, category labels, spec lines, prices,
badges, `est. 2026`, the roman numerals in the material section, the entire footer, and several
buttons. It reads as a terminal/technical texture fighting the botanical direction, and it makes
prices wrap badly on mobile ("Rp 55.000 /" + "tangkai" on two lines in the custom builder rows).

**Fix direction:** restrict mono to the plate captions where it earns its keep — `.hero-caption-pl`
("PL. I"), `.material-caption` ("Gbr. 1"). Move labels, prices and button text to a small-caps or
tracked treatment of `--font-sans`. Prices especially should not be 11.5px mono.

---

### T2-7 · Two unexplained primary button colours

Hero and product CTAs use `--text-dark` (`#23201B`). The header CTA `.nav-cta` and
`.nav-cta-mobile` use `--accent-green` (`#3F5545`). No rule distinguishes them; both read as
"primary".

**Fix direction:** pick one primary and demote the other to a documented role (e.g. green = "go to
checkout", dark = "select this product"), or unify. Write the rule down in a comment so it survives.

---

### T2-8 · Order-section empty state contradicts itself

On first visit `#order` shows three conflicting signals at once:

1. Title "Belum ada bunga dipilih" (`app.js:1327`)
2. …next to a **sunflower hero photo** — `photoSrc = siteData.images?.hero` (`app.js:1330`)
3. …a price of `—` with "(belum termasuk ongkir)" attached to a price that doesn't exist
   (`#summary-shipping-note`, `index.html:622`)
4. …plus a live "Jumlah tangkai: 1" stepper counting nothing, because `#stem-qty-card` is shown
   whenever `orderMode === 'stem'` (`app.js:1197`) and `'stem'` is the initial value
   (`app.js:17`) even while `hasUserSelected === false` (`app.js:18`)

The "Termasuk" list in this state also holds *instructions* ("pick a stem above…",
`app.js:1332`) rather than inclusions.

**Fix direction (Tier 2 scope — cosmetic only):** neutral placeholder image or empty frame; hide
the shipping note when there's no price; gate `#stem-qty-card` on `hasUserSelected && orderMode
=== 'stem'`; suppress the includes list rather than filling it with instructions.

> The *structural* fix — making `#order` never reachable in an empty state at all — is **T3-1**.
> Do the cosmetic fix only if Tier 3 is deferred; they overlap.

---

### T2-9 · Lopsided order-section columns

At 1440px the left column (`.order-controls-col`) ends roughly 40% up while `.summary-box` runs
the full height, leaving a large dead zone under the greeting-card textarea.

**Fix direction:** rebalance — move the wrap chooser or card-note field into the summary column,
or let the summary box become sticky within the grid so the dead space reads as intentional.

---

### T2-10 · Category filter tabs earn little

Three real categories, all reachable within one screen. Filtering `display: none`s whole sections
without adjusting scroll position, so the page shrinks under the user and leaves ~100px of dead
space above the remaining content. The tab bar is also centred while the section header above it
is left-aligned, so there's no shared axis.

**Fix direction:** simplest good outcome is to remove the filter and rely on the two category
sections plus header nav. If kept: restore scroll position after filtering, and align the tab bar
to the content axis.

Note the copy says "Dua cara memesan" (two ways) above a filter offering three
(`index.html:461`, `site-content.js` `catOneNote`/`catTwoNote`) — an IA inconsistency that
disappears if the filter goes.

---

### T2-11 · Mobile page length and lead

**Measured @390px:** total document height **11,114px**. First buyable product (`#collection`) at
**y = 2,017px** — roughly 2.4 screens of scrolling before the user sees anything clickable. Hero
photo doesn't begin until y = 570px.

For a visual product with four SKUs, the page leads with text and buries the goods.

**Fix direction:** on mobile, bring the hero image up (or crop the hero block), and tighten
vertical rhythm between hero → trust bar → collection. Target: first product card visible within
~1.5 screens.

---

### T2-12 · Mobile flower grid is cramped

At 390px the 2-column grid pushes `.flower-price-line` to the card edge and wraps
`.flower-spec-line` to two ragged lines. There's a single-column fallback but it only fires at
`≤360px` (`styles.css:3272`).

**Fix direction:** raise the single-column breakpoint, or reduce price/spec type width (see T2-6 —
dropping mono largely solves this on its own).

---

### T2-13 · "Cara dibuat" has no imagery

The section whose entire job is proving handwork is four columns of pure text
(`index.html:693`, `#steps-grid`). This is the largest missed asset opportunity on the page and
the place the price premium gets justified.

**Fix direction:** four process photos, one per step. Requires new photography — flag to owner.

---

### T2-14 · Trust bar reads as a paragraph

`.trust-bar` (`index.html:448`) is four columns of unstyled text — no icons, no rules, no rhythm.
It doesn't read as a guarantee strip.

**Fix direction:** add inline SVG icons (keep them inline — no icon font, per §0.2), vertical
rules or increased gap, and tighten each line to one clause.

---

### T2-15 · Footer is a single thin line

`.site-footer` measures **105px tall at desktop**. For a store it omits: contact route, shipping
and returns policy, payment information, business address, email.

**Fix direction:** build a real footer structure with placeholder-safe slots that read correctly
while empty (same honesty pattern the Shopee button already uses). Do not invent the values.

---

## TIER 3 — Architectural

**This is one coordinated change. Do it on its own branch. Do not start it in the same commit as
Tier 1 or 2.**

### T3-1 · Replace the three-mode state machine with a line-item cart

**Root cause.** `app.js:17–18` declares:

```js
let orderMode = 'stem';        // 'stem' | 'package' | 'custom'
let hasUserSelected = false;
```

`orderMode` is reassigned at 11 sites (`app.js:228, 256, 269, 292, 324, 350, 364, …`) and branched
on at 9 more (`app.js:736, 815, 1197, 1281, 1302, 1338, 1347, 1395, 1417, 1553, 1564, 1584`).
Because the model holds exactly one selection, five distinct user-facing defects fall out of it:

**T3-1a — the primary CTA is a dead end.**
The header "Pesan" button and its mobile twin both target `#order`, which on first visit renders
the empty state described in T2-8 and instructs the user to go back up. The site's most prominent
button does not advance the funnel.

**T3-1b — packages have no flower picker.**
Selecting a package sets `orderMode = 'package'` and the summary hard-codes
`"{n} tangkai jadi, bunga campur"` (`pkgIncludes[0]`, `site-content.js:291`). Meanwhile the Buket
Mini card copy offers *"pilihan satu jenis bunga atau campuran"* — a direct contradiction. There
is no UI to express the choice. The three highest-value SKUs are the only unconfigurable ones, so
every package order gets renegotiated in chat.

**T3-1c — two selections can be active simultaneously.**
Reproduce: click "Tambah ke buket +" on any flower (sets `orderMode = 'custom'`, `app.js:269`),
then click "Pilih buket ini" on a package (sets `orderMode = 'package'`, `app.js:292`). The
package card now shows "✓ Dipilih" **and** the custom builder still shows 1 stem with a live
estimate. Nothing indicates which one won. The builder is neither reset nor de-emphasised.

**T3-1d — the two product types commit differently.**
`selectStemOrder(flowerKey, scroll = true)` (`app.js:227`) auto-scrolls to `#order`.
`selectPackageOrder(pkgIndex, scroll = false, …)` (`app.js:291`) does not — it swaps the button to
"✓ Dipilih" and *grows a second button*, which changes that card's height and breaks its alignment
with the other three mid-row. Same user intent, two interaction models, one visible layout shift.

**T3-1e — no multi-item order.**
Two sunflowers plus one rose as loose stems is unbuildable. The only path is the custom bouquet
builder, which forces a 3-stem minimum and a wrap fee (`minStems`, `wrapFee`,
`site-content.js:58` / `site-content.js:61`). This is the structural ceiling on order value.

---

### Before writing any Tier 3 code — resolve these

A cart model has real design decisions inside it. **Ask the owner; do not assume.** Getting these
wrong produces a confident implementation of the wrong product.

1. **Wrap scope.** Is wrap colour per *line item* or per *order*? Currently `selectedWrap` is a
   single global (`app.js`), and the summary appends "Pembungkus: Kraft" to whatever is selected.
   A cart with three items and one wrap colour is a different UI from one with per-item wraps.

2. **Can a package and loose stems coexist in one cart?** If yes, how is the 9+ stem bulk discount
   (`bulkFrom: 9`, `bulkRate: 0.10`) computed — per line item, per bouquet, or across the whole
   cart? The current `getCustomTotals()` assumes one bouquet.

3. **Does the greeting card belong to the order or to each item?** `orderNote` is currently
   global. Two bouquets going to two recipients is a plausible order.

4. **What does the WhatsApp draft look like with N items?** The template
   (`whatsappTemplateId` / `whatsappTemplateEn`, `site-content.js:34–35`) uses flat
   `{title}` / `{price}` substitution. A cart needs an enumerated body, which changes the template
   contract — and the template is owner-editable, so the new shape must stay editable without
   touching `app.js`.

5. **Does the cart persist?** Language choice survives reload today; selection does not. On a
   single-page funnel that may be fine, or may be a loss.

---

### Implementation notes

- **Sequencing.** T3-1a and T3-1b are *consequences*, not separate work. Build the cart, and both
  resolve. Do not attempt to patch them individually first — that adds a fourth mode.
- **The tests will break, and that is correct.** `tests/verify-ordering.js` asserts against the
  three-mode model. Rewrite the affected suites to assert cart behaviour. Keep the count honest:
  if you end up with 12 meaningful suites instead of 15, say so.
- **The empty state should become unreachable**, not prettier. If `#order` can only be reached
  with a non-empty cart — or if it contains its own inline picker — T2-8 disappears entirely.
- **Preserve** the XSS-safe `textContent` insertion pattern for `orderNote` and all dynamic
  strings, the WAI-ARIA radiogroup on `#wrap-chips` with roving tabindex, the focus-return from
  `#image-modal`, the `IntersectionObserver` on the sticky order bar, and the
  `isWhatsAppReady()` / `isShopeeReady()` channel-honesty gates. These are all currently correct
  and are easy to lose in a rewrite.

---

## 3. What is already correct — don't "fix" these

Verified working; changing them is a regression:

- Wrap-colour radiogroup: arrow-key navigation and roving tabindex behave per WAI-ARIA
- `#image-modal` returns focus to the triggering element on Escape (verified)
- `prefers-reduced-motion: reduce` is honoured (`styles.css:3411`)
- Skip link present and functional
- Language switch persists across reload; `<html lang>` updates correctly
- All `<img>` elements have `alt`; no duplicate `id`s in the document
- Base palette contrast: `--accent-ochre` on `--bg-main` 5.0:1, `--text-muted` 5.26:1,
  `--text-body` on `--bg-card` 6.16:1, `--dark-text-muted` on `--dark-bg` 8.05:1
- Responsive images: `srcset` + `sizes` on hero, macro, and all product photos; hero carries
  `fetchpriority="high"`
- The Shopee "Segera hadir" disabled state — this is the honesty pattern working as designed

Minor, low priority: the staging curtain does not trap focus (Tab reaches the skip link behind
it). It's a client-side curtain, not access control, so this is cosmetic.

---

## 4. Suggested commit sequence

| Order | Scope | Risk | Test impact |
|---|---|---|---|
| 1 | T1-1 … T1-5 | Low | None — 15/15 must stay green |
| 2 | T2-5, T2-6 (type + mono tokens) | Low | None |
| 3 | T2-1, T2-2, T2-4, T2-12 (product cards) | Low | None |
| 4 | T2-9, T2-10, T2-11 (layout/rhythm) | Medium | Suite 15 touches category filter |
| 5 | T2-14, T2-15 (trust bar, footer) | Low | None |
| 6 | T3-1 (cart) — **separate branch** | High | Expect several suites to need rewriting |

T2-3 and T2-13 require photography and are owner-blocked; raise them rather than coding around
them.
