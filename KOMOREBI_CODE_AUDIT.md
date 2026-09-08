# KOMOREBI — Code Audit & Implementation Specification

**Audited:** 2026-09-08 · **Repo state:** branch `claude/website-ui-ux-audit-9o3uso`, base `main@1f6a9ba`
**Implementation model:** any capable coding model (spec is model-agnostic) · **Author:** senior audit pass
**Companion doc:** `revisions/ui-ux-audit-2026-09.md` (UI/UX findings, Tier 1–3). This document
supersedes it for implementation purposes and restates every task in executable form.

---

## 1. Executive summary

The site is a zero-dependency static storefront (vanilla HTML/CSS/ES6, no build step). Quality is
higher than typical for its class: the ARIA radiogroup, modal focus restoration, reduced-motion
support, responsive images, and the "honest channel" pattern for the unconfigured Shopee link are
all correctly implemented. The integration test loads **real** `app.js` and `site-content.js` into
a `vm` sandbox — it is not a mock.

**There are no P0 findings.** Ordering is not blocked, there is no data loss, and there is no
security hole: `orderNote` — the only free-text user input — never reaches an `innerHTML` sink.

The dominant structural problem is the **single-selection state machine**. `app.js:17` declares
`orderMode = 'stem' | 'package' | 'custom'` with exactly one selection alive at a time. Five
user-facing defects are consequences of that one design choice, not independent bugs. Phase 1
replaces it with a line-item cart, decomposed into six sequential tasks so the site remains
functional after each.

Two additional confirmed defects were found during this pass that were not in the earlier UI/UX
audit:

- **`whatsappTemplateId` / `whatsappTemplateEn` are dead configuration** (`site-content.js:34–35`).
  The README tells the owner these are editable. Nothing reads them; all six WhatsApp messages are
  hardcoded in `app.js:1587–1610`.
- **The WhatsApp message renders malformed text**: `Bunga Matahari (— tangkai jadi)` — an em-dash
  inside parentheses, caused by wrapping an already-dash-prefixed suffix.

**Scope discipline:** all prices, phone numbers, social handles and marketplace URLs are
intentional placeholders and are **not** reported as defects. See §11.

---

## 2. Checks performed and their results

| Check | Command / method | Result |
|---|---|---|
| Integration suite | `node tests/verify-ordering.js` | **15/15 pass** |
| Do tests exercise production code? | Read `tests/verify-ordering.js:465–476` | **Yes** — `vm.runInContext` loads real `app.js` + `site-content.js`; asserts `window.KomorebiApp` exists |
| Test DOM fidelity | Read `tests/verify-ordering.js:288+` | **Hand-rolled stub**, not jsdom. Elements registered manually via `registerEl()`. See P2-05 |
| Render @1440 / 390 / 320px | Headless Chromium, both languages | Overflow at 320px; geometry captured below |
| Contrast (all text nodes) | Computed-style sweep vs. resolved background | 4 failures, worst 2.46:1 |
| Tap targets @390px | Bounding-box sweep of interactive elements | 2 below 44px |
| Heading order | DOM order of `h1`–`h6` | 1 violation (curtain `h2` precedes page `h1`) |
| `alt` attributes / duplicate IDs | DOM sweep | **Clean** — no missing `alt`, no duplicate IDs |
| XSS sinks | `grep innerHTML` (17 sites) + `orderNote` flow trace | **No user input reaches `innerHTML`** |
| Dead config | `grep` for every `site-content.js` key | 2 dead keys (WA templates) |
| Linter / build | None configured | N/A — zero-dependency project by design |

**Reproduction environment.** Serve with `python3 -m http.server 8080`. The site sits behind a
client-side staging curtain; the passcode is `auth.passcode` in `site-content.js`. Chromium is at
`/opt/pw-browsers/chromium-1194/chrome-linux/chrome` — pass `executablePath` explicitly, because
the version Playwright auto-resolves is a mismatch. Google Fonts may be blocked in a sandbox; the
page falls back to Georgia/Helvetica, which does not affect geometry.

---

## 3. What is already implemented correctly

Do not "improve" these. Changing them is a regression.

- **Wrap-colour radiogroup** (`#wrap-chips`): WAI-ARIA radiogroup with arrow-key navigation and
  roving `tabindex`. Verified working.
- **Image dialog focus restoration**: `#image-modal` returns focus to the triggering element on
  Escape. Verified by keyboard.
- **Channel honesty gates**: `isWhatsAppReady()` / `isShopeeReady()` correctly render a disabled
  "Segera hadir" state rather than linking to a generic marketplace URL. This is correct product
  behaviour, not a bug.
- **XSS-safe note handling**: `orderNote` is inserted via `textContent` only.
- **`prefers-reduced-motion: reduce`** honoured (`styles.css:3411`).
- **Responsive images**: `srcset` + `sizes` on hero, macro and every product photo; hero carries
  `fetchpriority="high"`.
- **Base colour palette**: `--accent-ochre` on `--bg-main` 5.0:1; `--text-muted` 5.26:1;
  `--text-body` on `--bg-card` 6.16:1; `--dark-text-muted` on `--dark-bg` 8.05:1. All pass. The
  contrast failures in P1-09 are local overrides, not palette tokens.
- **Skip link**, `<main>` landmark, `<html lang>` switching on language change.
- **Tests load real production code.** Preserve that property.

---

## 4. Findings summary table

| ID | Priority | Area | Finding | Files | Depends on |
|---|---|---|---|---|---|
| P1-01 | P1 | Ordering | WhatsApp message renders `(— tangkai jadi)` — em-dash inside parens | `app.js` | None |
| P1-02 | P1 | Ordering / config | Owner-editable WA templates are dead config; messages hardcoded | `app.js`, `site-content.js` | None |
| P1-03 | P1 | State | No cart model: introduce data structure + pure totals (no UI change) | `app.js`, `tests/verify-ordering.js` | P1-02 |
| P1-04 | P1 | State | Route all three selection paths through the cart (no visible change) | `app.js`, `tests/verify-ordering.js` | P1-03 |
| P1-05 | P1 | Ordering | Stem and package commits behave differently; selected card shifts layout | `app.js`, `styles.css` | P1-04 |
| P1-06 | P1 | Ordering | Cart cannot hold multiple items; no line-item UI | `index.html`, `app.js`, `styles.css` | P1-04 |
| P1-07 | P1 | Ordering | Packages have no flower picker; summary contradicts card copy | `index.html`, `app.js`, `site-content.js` | P1-06 |
| P1-08 | P1 | Ordering | `#order` reachable in empty state; primary CTA is a dead end | `index.html`, `app.js` | P1-06 |
| P1-09 | P1 | A11y | 4 WCAG AA contrast failures, worst 2.46:1 | `styles.css` | None |
| P1-10 | P1 | A11y | 2 tap targets below 44px on mobile | `styles.css` | None |
| P1-11 | P1 | Responsive | Horizontal overflow at 320px; hamburger clipped | `styles.css` | None |
| P2-01 | P2 | A11y | Curtain `<h2>` precedes page `<h1>` | `index.html` | None |
| P2-02 | P2 | A11y | Cart mutations not announced to screen readers | `app.js` | P1-06 |
| P2-03 | P2 | Responsive | Custom-builder live estimate off-screen on mobile | `styles.css` | None |
| P2-04 | P2 | Presentation | Product card price rows not aligned across grid | `styles.css` | None |
| P2-05 | P2 | Tests | DOM stub must be extended for cart; no cart coverage | `tests/verify-ordering.js` | P1-06 |
| P2-06 | P2 | SEO | FAQ content present but no `FAQPage` JSON-LD | `index.html`, `app.js` | None |
| P3-01 | P3 | Presentation | Systemic 11px type incl. primary CTAs | `styles.css` | None |
| P3-02 | P3 | Presentation | Decorative dots read as data on bouquet cards | `app.js`, `styles.css` | None |
| P3-03 | P3 | Hygiene | Staging leftovers in customer UI (`Lock Site`, `(draf)`) | `index.html`, `site-content.js` | None |
| P3-04 | P3 | Hygiene | ~37 MB unused PNGs incl. space-in-filename duplicates | `img/` | None |

---

## 5. Phase 1 — Critical correctness and ordering

### P1-01 · WhatsApp message renders an em-dash inside parentheses

**Problem and evidence.** `site-content.js:393` defines `stemSuffix: "— tangkai jadi"` (and
`:588` `"— finished stem"`). The suffix is designed to be appended *without* parentheses — the
summary title does this correctly. But `app.js:1606` and `:1608` wrap it in parens:

```js
`... memesan ${selectedStemQty} × ${flTrans.name} (${t.stemSuffix}) — Total ...`
```

Producing: `1 × Bunga Matahari (— tangkai jadi) — Total Rp 55.000`. Confirmed by reading the
generated `#btn-whatsapp` `href` after selecting a stem. Both languages affected.

**Required behavior.** The stem line reads `1 × Bunga Matahari — tangkai jadi — Total Rp 55.000`
(ID) and `1 × Sunflower — finished stem — Total Rp 55.000` (EN). No parenthesis characters around
the suffix.

**Files to change.** `app.js` only.

**Implementation instructions.**
1. Locate the `else { // stem mode }` branch of the WhatsApp assembly, `app.js:1600–1610`.
2. In both the `en` and the `id` template literal, replace `(${t.stemSuffix})` with
   `${t.stemSuffix}`.
3. Change nothing else in the branch. Do not edit `site-content.js` — the suffix string is
   correct; only its usage is wrong.

**Acceptance criteria.**
- [ ] Selecting any single stem produces a `#btn-whatsapp` href whose decoded text contains
      `— tangkai jadi` and does **not** contain `(—`.
- [ ] The same holds after switching to EN (`— finished stem`, no `(—`).
- [ ] `#summary-title` is unchanged (it already renders correctly).
- [ ] `node tests/verify-ordering.js` still reports 15/15.

**Required tests.** Integration test in `tests/verify-ordering.js`, exercising the real
`window.KomorebiApp`. Setup: `resetToInitial()`, then `selectStem('Rose')`. Assert the
`#btn-whatsapp` href, URL-decoded, contains `Mawar — tangkai jadi` and does not match `/\(\s*—/`.
Repeat after `setLanguage('en')`. Do not rebuild the message string inside the test.

**Manual verification.** 1) Serve, unlock. 2) Click "Pesan tangkai ini" on Mawar. 3) Hover the
WhatsApp button and read the status-bar URL, or copy the `href`. 4) Confirm no `(—`.

**Do not change.** `stemSuffix` values; the package and custom message branches; `#summary-title`.

**Dependencies.** None.

---

### P1-02 · Owner-editable WhatsApp templates are dead configuration

**Problem and evidence.** `site-content.js:34–35` define `whatsappTemplateId` and
`whatsappTemplateEn` with `{title}`, `{price}`, `{wrapInfo}`, `{cardInfo}` placeholders. `README.md`
presents these as owner-editable. A repo-wide grep finds **no reader** — the only matches are the
definitions themselves. All six message variants are hardcoded in `app.js:1587–1610`.

**Impact.** The owner is told they can change the WhatsApp wording; editing those keys does
nothing. Bilingual customer-facing copy is locked inside application logic, contradicting the
`site-content.js` single-source-of-configuration design used everywhere else. This must be fixed
**before** the cart work, because the cart changes the message shape and would otherwise harden
the same mistake.

**Required behavior.** All WhatsApp message text originates from `site-content.js`. Editing a
template there changes the produced message with no `app.js` edit. Messages produced for the
current three modes are byte-identical to today's output, except for the P1-01 fix.

**Files to change.** `site-content.js`, `app.js`, `tests/verify-ordering.js`.

**Implementation instructions.**
1. In `site-content.js`, **replace** the two dead keys with a `whatsappTemplates` object holding
   one template per mode per language. Use exactly these keys and placeholders:

   ```js
   whatsappTemplates: {
     id: {
       stem:    "Halo Komorebi! Saya ingin memesan {items} — Total {total} (belum termasuk ongkir). {wrapInfo}{cardInfo}Apakah masih tersedia?",
       package: "Halo Komorebi! Saya ingin memesan {items} — {total} (belum termasuk ongkir). {wrapInfo}{cardInfo}Apakah masih tersedia?",
       custom:  "Halo Komorebi! Saya ingin memesan Buket Custom ({stems} tangkai, estimasi {total}, belum termasuk ongkir):\n{itemList}\n{wrapInfo}{cardInfo}Apakah bisa dibuatkan?"
     },
     en: {
       stem:    "Hello Komorebi! I would like to order {items} — Total {total} (excludes delivery fee). {wrapInfo}{cardInfo}Is it available?",
       package: "Hello Komorebi! I would like to order {items} — {total} (excludes delivery fee). {wrapInfo}{cardInfo}Is it available?",
       custom:  "Hello Komorebi! I would like to order a Custom Bouquet ({stems} stems, estimated {total}, excludes delivery fee):\n{itemList}\n{wrapInfo}{cardInfo}Can this be arranged?"
     }
   }
   ```

2. In `app.js`, add a single pure helper near `getCustomTotals`:

   ```js
   function fillTemplate(tpl, vars) {
     return String(tpl).replace(/\{(\w+)\}/g, (m, k) =>
       Object.prototype.hasOwnProperty.call(vars, k) ? String(vars[k]) : '');
   }
   ```
   An unknown placeholder resolves to empty string — it must never leave a literal `{foo}` in a
   customer-facing message.

3. Rewrite `app.js:1583–1610` so each branch builds a `vars` object and calls `fillTemplate` with
   `siteData.store.whatsappTemplates[currentLang][mode]`. Supply: `items`, `total`, `stems`,
   `itemList`, `wrapInfo`, `cardInfo`. Keep the existing `wrapTxt` / `cardTxt` computation
   (`app.js:1580–1581`) and pass them as `wrapInfo` / `cardInfo` unchanged — they already include
   their own trailing spaces.
4. If `whatsappTemplates` or the needed language key is missing, fall back to the current
   hardcoded string for that branch so a malformed config cannot produce an empty message.
5. `encodeURIComponent(waMsg)` and the `https://wa.me/${waNumber}` construction stay exactly as
   they are.

**Acceptance criteria.**
- [ ] `grep -c "Halo Komorebi" app.js` returns only the fallback occurrences from step 4; no
      message is assembled from inline prose elsewhere.
- [ ] For each of the 6 combinations (3 modes × 2 languages) the decoded href matches today's
      output, except the P1-01 dash fix.
- [ ] Editing `whatsappTemplates.id.stem` in `site-content.js` changes the produced message with
      no `app.js` edit.
- [ ] No decoded message contains a literal `{` or `}`.
- [ ] 15/15 suites still pass.

**Required tests.** Integration, via `window.KomorebiApp`. (a) For each mode × language assert the
decoded href contains the expected substrings. (b) Call `setData()` with a clone whose
`whatsappTemplates.id.stem` is `"TESTMARKER {total}"`, select a stem, assert the href contains
`TESTMARKER Rp` — this proves the config is actually read. (c) Assert no href contains `{`. Do not
reimplement `fillTemplate` in the test.

**Manual verification.** 1) Edit `whatsappTemplates.id.stem`, prepend `HALO TEST `. 2) Reload,
unlock, select a stem. 3) Confirm the WhatsApp href begins with the edited text. 4) Revert.

**Do not change.** `wa.me` URL shape; `encodeURIComponent` usage; the waitlist message at
`app.js:1031`; the disabled-state branches above line 1576.

**Dependencies.** None. **Do P1-01 first or together** — both touch the same block.

---

### P1-03 · Introduce the cart data model and totals function (no UI change)

> **This is step 1 of 6 replacing the single-selection state machine. It must produce no visible
> change.** Its purpose is to land the data structure and pricing logic under test before any UI
> depends on them.

**Problem and evidence.** `app.js:17–18`:

```js
let orderMode = 'stem'; // 'stem' | 'package' | 'custom'
let hasUserSelected = false;
```

`orderMode` is assigned at 11 sites and branched on at 12 more. Because exactly one selection can
exist, a customer cannot order two sunflowers *and* one rose as loose stems — the only path is the
custom bouquet builder, which forces a 3-stem minimum (`site-content.js:61`) and a wrap fee
(`site-content.js:58`). This is the shared root cause of P1-05, P1-06, P1-07 and P1-08.

**Required behavior.** A cart data structure and a pure `computeCartTotals()` function exist and
are exported for testing. Nothing in the UI reads them yet. Site behaviour is byte-identical.

**Files to change.** `app.js`, `tests/verify-ordering.js`.

**Implementation instructions.**
1. Add module-scope state next to the existing declarations. **Do not delete `orderMode`,
   `hasUserSelected`, `selectedFlower`, `selectedStemQty`, `selectedPackage` or `customCounts`
   yet** — P1-04 removes them.

   ```js
   let cart = []; // line items; see shape below
   let nextLineId = 1;
   ```

2. Line-item shape — use exactly these three `type` values and field names:

   ```js
   { id: 1, type: 'stem',    flowerKey: 'Sunflower', qty: 2 }
   { id: 2, type: 'package', pkgIndex: 1,            qty: 1 }
   { id: 3, type: 'custom',  counts: { Sunflower: 2, Rose: 1, Tulip: 0, Gerbera: 0 }, qty: 1 }
   ```
   `id` is assigned from `nextLineId++` and is stable for the item's lifetime. `qty` is always
   `>= 1`. `counts` keys always cover every key in `siteData.flowerOrder`.

3. Add a **pure** function `computeCartTotals(cartArg)` — it must read only its argument and
   `siteData`, must not read module state, and must not mutate anything:

   ```js
   // returns:
   // { lines: [{ id, type, stems, subtotal, discount, total }], stems, subtotal, discount, wrapFee, total, isValid }
   ```

   Per-line rules — **these preserve today's pricing exactly; do not invent new rules**:
   - `stem`: `stems = qty`; `subtotal = flower.stemPrice * qty`; `discount = 0`.
   - `package`: `stems = pkg.stems * qty`; `subtotal = pkg.price * qty`; `discount = 0`
     (package prices are already inclusive of their advertised saving).
   - `custom`: `bouquetStems = sum(counts)`; `stems = bouquetStems * qty`;
     `subtotal = sum(counts[k] * flowers[k].stemPrice) * qty`;
     `discount = bouquetStems >= siteData.bulkFrom ? Math.round(subtotal * siteData.bulkRate) : 0`.
     **The threshold is evaluated per bouquet, not on the cart total.**

   Cart level:
   - `wrapFee = siteData.wrapFee` if the cart contains at least one `custom` line, else `0`.
     (Package prices already include wrap; stems ship in protective paper, not a wrap.)
   - `total = subtotal - discount + wrapFee`.
   - `isValid = cart.length > 0 && every custom line has bouquetStems >= siteData.minStems`.

   All money is integer rupiah. Use `Math.round` only where specified above.

4. Read every rule constant through `siteData` with the existing `??` defaults (see
   `getCustomTotals`, `app.js`): `bulkFrom ?? 9`, `bulkRate ?? 0.10`, `wrapFee ?? 35000`,
   `minStems ?? 3`. Never hardcode a number.
5. Export on `window.KomorebiApp` (`app.js:2245`): `computeCartTotals`, `getCart: () => cart.map(l => ({...l}))`,
   and `_setCartForTest: (c) => { cart = c; }`. Add them; remove nothing.
6. **Do not call `computeCartTotals` from any render function in this task.**

**Acceptance criteria.**
- [ ] `git diff` touches no render function and no HTML/CSS.
- [ ] The site renders and behaves identically before and after (spot-check stem, package, custom).
- [ ] `computeCartTotals([])` returns `{ total: 0, isValid: false, ... }` without throwing.
- [ ] For a single `custom` line matching today's builder state, `computeCartTotals` returns the
      same `total` as the existing `getCustomTotals()`.
- [ ] Calling `computeCartTotals` twice with the same input returns equal results and leaves the
      argument unmutated.
- [ ] 15/15 suites still pass.

**Required tests.** Unit-style, through the exported `computeCartTotals` (real production
function — do **not** copy the arithmetic into the test). Cases: empty cart; single stem qty 1 and
qty 3; single package; custom with 3 stems (no discount, `isValid` true); custom with 8 stems (no
discount); custom with 9 stems (discount applied — boundary); custom with 2 stems
(`isValid` false); mixed cart of stem + package + custom (assert `wrapFee` charged once, and that
the 9-stem threshold is **not** met by summing across lines); assert input array is not mutated.

**Manual verification.** No visible change is expected. 1) Serve, unlock. 2) Order a stem, a
package, and a 9-stem custom bouquet. 3) Confirm every displayed price matches the pre-change
build.

**Do not change.** `getCustomTotals` (still in use until P1-04); any render function; any existing
export.

**Dependencies.** P1-02.

---

### P1-04 · Route all selections through the cart (no visible change)

**Problem and evidence.** Selection handlers assign `orderMode` directly: `selectStemOrder`
(`app.js:227`), `addFlowerToBouquet` (`:269`), `selectPackageOrder` (`:291`). Rendering branches on
`orderMode` at `app.js:736, 815, 1197, 1281, 1302, 1338, 1347, 1395, 1417, 1553, 1564, 1584`.

**Required behavior.** The cart is the single source of truth, holding **at most one line item**
in this task. Every existing behaviour — summary, prices, WhatsApp message, sticky bar, disabled
states — is preserved exactly. Selecting a product replaces the cart's single line.

**Files to change.** `app.js`, `tests/verify-ordering.js`.

**Implementation instructions.**
1. Replace the body of each selection handler so it writes a cart line instead of setting
   `orderMode`. Keep every function name and signature — they are part of the exported test
   interface.
   - `selectStemOrder(flowerKey, scroll)` → `cart = [{ id: nextLineId++, type:'stem', flowerKey, qty: 1 }]`
   - `selectPackageOrder(pkgIndex, scroll, restoreFocus)` → `cart = [{ id: nextLineId++, type:'package', pkgIndex, qty: 1 }]`
   - `useCustomBouquet()` → `cart = [{ id: nextLineId++, type:'custom', counts: {...customCounts}, qty: 1 }]`
2. `bumpStemQty(delta)` mutates `qty` on the single `stem` line, clamped to `>= 1`.
3. Keep `customCounts` as the **builder's working draft** — it is the widget's own state and is
   not the cart. `useCustomBouquet` copies it into a line. Do not delete it.
4. Derive the old variables instead of storing them, so render code needs minimal edits. Add near
   the top of the render section:
   ```js
   function activeLine() { return cart.length ? cart[cart.length - 1] : null; }
   ```
   Then replace each `orderMode === 'x'` test with `activeLine()?.type === 'x'`, and each
   `hasUserSelected` test with `cart.length > 0`.
5. Delete the declarations of `orderMode` and `hasUserSelected` (`app.js:17–18`) **only after**
   every reference is replaced. `grep -n "orderMode\|hasUserSelected" app.js` must return zero
   matches at the end of this task.
6. Update `resetToInitial()` in the export block to `cart = []; nextLineId = 1;` plus the existing
   non-mode resets. Update `getState()` to report `cart: getCart()` and keep
   `hasUserSelected: cart.length > 0` as a **derived** field so existing tests keep passing.
7. Replace internal callers of `getCustomTotals()` with `computeCartTotals(cart)`. Keep
   `getCustomTotals` exported and working — the custom builder widget still uses it to price its
   *draft* before the item is added.

**Acceptance criteria.**
- [ ] `grep -n "orderMode\|hasUserSelected" app.js` returns matches only inside `getState()`'s
      derived field.
- [ ] All three product types still select, price, and generate the correct WhatsApp message.
- [ ] `getState().hasUserSelected` is `false` on load and `true` after any selection.
- [ ] Selecting a package after adding a stem replaces it — `getCart().length === 1`.
- [ ] 15/15 suites still pass **without weakening any assertion**.

**Required tests.** Integration via `window.KomorebiApp`. Assert `getCart()` shape after
`selectStem('Rose')`, `selectPackage(2)`, and `bumpCustom` + `useCustom`. Assert that selecting a
package after a stem leaves length 1. Assert `resetToInitial()` empties the cart. Assert
`getState().hasUserSelected` tracks cart emptiness.

**Manual verification.** 1) Serve, unlock. 2) Select each of: a stem, a package, a 5-stem custom
bouquet. 3) After each, confirm the summary title, price, "Termasuk" list, sticky bar, and
WhatsApp href match the pre-change build.

**Do not change.** Any user-visible string; the wrap or note handling; `getCustomTotals`'s
signature.

**Dependencies.** P1-03.

---

### P1-05 · Unify the commit interaction and remove the selection layout shift

**Problem and evidence.** Two divergences with one visible symptom each:

1. `selectStemOrder(flowerKey, scroll = true)` (`app.js:227`) auto-scrolls to `#order`.
   `selectPackageOrder(pkgIndex, scroll = false, ...)` (`app.js:291`) does not. Same user intent,
   two outcomes.
2. Because a package doesn't advance, its card instead swaps its button to "✓ Dipilih" **and grows
   a second button** ("Lanjut ke sentuhan akhir ↓"). That changes the card's height, breaking its
   alignment with the other three cards mid-row — an observable layout shift on click.

**Required behavior.** Selecting any product — stem or package — scrolls to `#order` using the
same path. The selected package card shows its selected state **without changing height**.

**Files to change.** `app.js`, `styles.css`.

**Implementation instructions.**
1. Change `selectPackageOrder`'s default to `scroll = true` (`app.js:291`) so both handlers share
   the behaviour. Verify each internal call site: any caller that legitimately must not scroll
   (e.g. a re-render restoring state) must now pass `false` explicitly. Check all callers before
   changing the default.
2. Remove the second "Lanjut ke sentuhan akhir ↓" button from the selected-package card render
   (`app.js` bouquet card template, near `:826`). It is redundant once selection scrolls.
3. In `styles.css`, express the selected state without affecting layout: `.bouquet-card.active`
   (see `styles.css:1140`) should change border/background only. Reserve the "✓ " affordance
   inside the existing button so its box does not resize — set a `min-height` on
   `.btn-choose-bouquet` (`styles.css:1110`) and keep the label swap purely textual.

**Acceptance criteria.**
- [ ] Clicking "Pilih buket ini" scrolls to `#order`, matching stem behaviour.
- [ ] Measured `offsetHeight` of all four `.bouquet-card` elements is equal before and after one is
      selected.
- [ ] No second button appears inside a selected package card.
- [ ] Keyboard: activating the button with Enter produces the same scroll and focus outcome.
- [ ] 15/15 suites still pass.

**Required tests.** Integration: assert `selectPackage(1)` with default args triggers the same
scroll path as `selectStem` (assert via the sandbox's recorded `scrollIntoView` call, which the
existing harness already stubs). Browser/manual for the equal-height criterion.

**Manual verification.** 1) At 1440px, note the four bouquet cards' bottom edges align. 2) Click
"Pilih buket ini" on Buket Sedang. 3) Confirm the page scrolls to the order section and the four
cards' bottom edges still align.

**Do not change.** The card's visual style beyond the selected-state border; the stem card's
two-button layout.

**Dependencies.** P1-04.

---

### P1-06 · Multi-item cart with line-item UI

**Problem and evidence.** With P1-04 the cart holds one line by construction. The customer-facing
gap remains: two sunflowers plus one rose as loose stems is unbuildable, and the only workaround
(the custom builder) imposes a 3-stem minimum and a wrap fee.

**Required behavior.** The order section lists every cart line with its own quantity stepper and a
remove control, plus a cart-level total. Selecting a product **adds** a line rather than replacing
the cart; selecting the same product again increments that line's `qty`.

**Files to change.** `index.html`, `app.js`, `styles.css`, `tests/verify-ordering.js`.

**Implementation instructions.**
1. In `index.html`, inside `.summary-box`, replace the single-selection block
   (`#summary-photo-frame` + `#summary-meta`, around `:600–625`) with a list container:
   ```html
   <ul class="cart-lines" id="cart-lines"></ul>
   ```
   Keep `#summary-price` and `#summary-includes-list` — they become cart-level. Keep every existing
   `id` that `app.js` or the tests reference; do not rename.
2. Add `renderCartLines()` in `app.js`. For each line render an `<li class="cart-line">` with:
   thumbnail, title, per-line price, a `−` / count / `+` stepper, and a remove `<button>` labelled
   via `aria-label` from `site-content.js` (add `removeLineLabel` to both language blocks — text
   is new UI chrome, not marketing copy, so adding it is in scope).
3. Build each `<li>` with `document.createElement` and set text via `textContent`. **Do not use
   `innerHTML` for cart lines** — this is the one region whose content is derived from a growing
   data structure, and keeping it out of `innerHTML` preserves the project's XSS posture.
4. Selection semantics: `addLine(line)` searches for an existing line with the same identity
   (`type` + `flowerKey`, or `type` + `pkgIndex`) and increments `qty` if found, else pushes.
   `custom` lines never merge — each is a distinct bouquet.
5. `removeLine(id)` splices by `id`. After removal, move focus to the next line's remove button,
   or to `#cart-lines` if the cart is now empty.
6. Render the cart-level `#summary-price` from `computeCartTotals(cart).total`. Show the wrap fee
   as its own row only when it is non-zero.
7. Export `addLine`, `removeLine`, `bumpLineQty(id, delta)` on `window.KomorebiApp`.

**Acceptance criteria.**
- [ ] Two sunflowers and one rose can be ordered as three stems in one cart.
- [ ] Selecting the same stem twice yields **one** line with `qty: 2`, not two lines.
- [ ] Two custom bouquets yield two separate lines.
- [ ] Removing a line updates `#summary-price` and moves focus per step 5.
- [ ] `#cart-lines` contains no `innerHTML`-assigned markup (`grep` the render function).
- [ ] `bumpLineQty(id, -1)` at `qty: 1` removes the line (or clamps — pick removal, and document
      it in the function's comment).
- [ ] The WhatsApp message enumerates every line (P1-02's `{itemList}` placeholder).
- [ ] Tests pass, including new cart coverage.

**Required tests.** Integration via exported `addLine` / `removeLine` / `bumpLineQty`. Cases:
merge-on-duplicate; custom lines don't merge; remove updates totals; qty floor behaviour;
`computeCartTotals` charges `wrapFee` once for a cart with two custom lines; WhatsApp href
enumerates all lines. Plus P2-05's DOM-stub extension.

**Manual verification.** 1) At 1440px add 2× Sunflower, 1× Rose, and Buket Mini. 2) Confirm three
lines with correct quantities and a correct total. 3) Remove the middle line; confirm total updates
and focus lands on a sensible control. 4) Repeat at 390px.

**Do not change.** Wrap chooser; greeting-card textarea; the channel buttons block.

**Dependencies.** P1-04. (P1-05 is independent but should land first — see §12.)

---

### P1-07 · Package flower picker

**Problem and evidence.** `site-content.js:285` tells the customer a Buket Mini is *"pilihan satu
jenis bunga atau campuran variasi studio"* (choice of a single variety, or a studio mix). But
`pkgIncludes[0]` (`site-content.js:291`) hardcodes `"{n} tangkai jadi, bunga campur"` — mixed — and
there is no control to express the choice. The three highest-value SKUs are the only unconfigurable
products, so every package order is renegotiated in chat.

**Required behavior.** After selecting a package, the customer chooses **one variety** or **studio
mix**. The choice appears in the summary, the includes list, and the WhatsApp message.

**Files to change.** `index.html`, `app.js`, `site-content.js`, `styles.css`.

**Implementation instructions.**
1. Extend the `package` line shape with `variety: 'mix' | '<flowerKey>'`, defaulting to `'mix'`.
   This is additive — `computeCartTotals` ignores it, because **variety does not change price**.
2. Render a chooser inside the package's `<li class="cart-line">`: a `radiogroup` with one option
   per `siteData.flowerOrder` entry plus "Campuran studio". **Reuse the existing wrap-chip
   radiogroup pattern** (`#wrap-chips`, `app.js` `selectWrap`) — same roving `tabindex`, same
   arrow-key handling, same `role="radio"` / `aria-checked`. Do not write a second keyboard
   implementation.
3. Add `pkgVarietyLabel`, `pkgVarietyMix`, and a `pkgIncludesVariety` string (e.g.
   `"{n} tangkai jadi, {variety}"`) to both language blocks in `site-content.js`. When
   `variety !== 'mix'`, render `pkgIncludesVariety`; otherwise keep the existing
   `pkgIncludes[0]`.
4. Pass the resolved variety name into the WhatsApp `{items}` text for package lines.

**Acceptance criteria.**
- [ ] Selecting a package shows a variety chooser defaulting to "Campuran studio".
- [ ] Choosing "Mawar" updates the summary includes line and the WhatsApp message.
- [ ] Price is identical for every variety.
- [ ] Arrow keys move between options; only the checked option is in the tab order.
- [ ] Both languages render correct labels.
- [ ] Tests pass.

**Required tests.** Integration: assert default `variety === 'mix'`; assert setting a variety
changes the includes text and the WhatsApp href but **not** `computeCartTotals(...).total`; assert
`aria-checked` moves with selection.

**Manual verification.** 1) Select Buket Sedang. 2) Confirm the chooser defaults to studio mix.
3) Choose Tulip; confirm summary + WhatsApp text change and price does not. 4) Tab to the group and
verify arrow-key navigation. 5) Switch to EN and re-check labels.

**Do not change.** Package prices; the existing `#wrap-chips` group.

**Dependencies.** P1-06.

---

### P1-08 · Eliminate the empty-state dead end

**Problem and evidence.** The header CTA "Pesan" (and its mobile twin) targets `#order`. On first
visit `app.js:1326–1337` renders an empty state that instructs the user to scroll back up. The
site's most prominent button does not advance the funnel. The state also contradicts itself: title
"Belum ada bunga dipilih" beside a **sunflower hero photo** (`app.js:1330`), a price of `—` with
"(belum termasuk ongkir)" attached to a nonexistent price (`index.html:622`), and a live "Jumlah
tangkai: 1" stepper counting nothing (`app.js:1197`).

**Required behavior.** `#order` is never reachable in a state that offers no action. It contains an
inline product picker so the CTA always lands somewhere actionable.

**Files to change.** `index.html`, `app.js`.

**Implementation instructions.**
1. Add an `#order-picker` block at the top of `.order-controls-col`, visible only when
   `cart.length === 0`. Render the four flowers and four packages as compact selectable
   thumbnails that call the same `selectStemOrder` / `selectPackageOrder` handlers with
   `scroll = false` (the user is already at `#order`).
2. Reuse the existing flower and package data and photo fields. Do not duplicate the card markup —
   extract a small `renderPickerTile(item)` helper.
3. When `cart.length === 0`: hide `#summary-price`, `#summary-shipping-note`, and
   `#summary-includes-list` rather than filling them with instructional text. Delete the
   placeholder-photo assignment at `app.js:1330`.
4. Gate `#stem-qty-card` on `cart` containing a `stem` line, replacing the current
   `activeLine()?.type === 'stem'` test which is true by default.

**Acceptance criteria.**
- [ ] Loading the page and clicking header "Pesan" lands on `#order` with a usable picker.
- [ ] No sunflower photo appears while the cart is empty.
- [ ] No `—` price and no shipping note render while the cart is empty.
- [ ] No quantity stepper renders while the cart holds no stem line.
- [ ] Choosing from the inline picker adds a line without scrolling the page.
- [ ] Tests pass.

**Required tests.** Integration: with an empty cart assert `#summary-price` is hidden and
`#stem-qty-card` is hidden; after `addLine` of a stem assert the stepper is shown. Browser/manual
for the CTA journey.

**Manual verification.** 1) Hard-reload, unlock. 2) Click "Pesan" in the header. 3) Confirm you can
pick a product without scrolling up. 4) Repeat at 390px.

**Do not change.** The wrap chooser and greeting-card field, which remain visible and are
order-level.

**Dependencies.** P1-06.

---

## 6. Phase 2 — Core UX and accessibility

### P1-09 · WCAG AA contrast failures

**Problem and evidence.** Measured against each element's resolved background:

| Selector | Location | Measured | Required |
|---|---|---|---|
| `.btn-use-custom:disabled` | `styles.css:1551` | **2.46:1** | 4.5 |
| `.btn-channel .channel-name` | `styles.css:2101` | 4.45:1 | 4.5 |
| `.btn-channel .channel-action` | `styles.css:2119` | 4.23:1 | 4.5 |
| `.mkt-active-tag` | `styles.css:2301` | 4.13:1 | 4.5 |

The disabled button is `#FAF6EE` on `#A79E8C` **compounded by `opacity: 0.8`** — that opacity is
what drives it to 2.46. It is the first thing a visitor sees on the custom builder's primary CTA.

**Required behavior.** Every text node meets 4.5:1 (3:1 for ≥24px, or ≥18.66px bold).

**Files to change.** `styles.css` only.

**Implementation instructions.**
1. `.btn-use-custom:disabled` (`:1551`): remove `opacity: 0.8`; change `background` to `#6E6656`
   (the existing `--text-muted` value), keeping `color: var(--bg-main)`. That pair measures
   ≈5.3:1. Keep `cursor: not-allowed`.
2. For the three 4.1–4.5 rows, darken the **foreground** only. Do not introduce new hex values —
   use `var(--text-dark)` for `.channel-name`, and darken `--accent-ochre` usages by switching
   those two rules to a new token `--accent-ochre-strong: #7A5220` added to `:root`
   (`styles.css:5`).
3. Do not alter existing `:root` palette values — they already pass (see §3).

**Acceptance criteria.**
- [ ] All four selectors measure ≥4.5:1 against their rendered background.
- [ ] No `opacity` remains on `.btn-use-custom:disabled`.
- [ ] Existing `:root` token values are unchanged except the one added token.
- [ ] The disabled button remains visually distinguishable from its enabled state.
- [ ] 15/15 suites still pass.

**Required tests.** Browser/manual — automated contrast assertions are out of scope for this
harness. Use the DOM sweep in §2 to re-measure.

**Manual verification.** 1) Load with an empty custom builder. 2) Confirm "Lanjut ke sentuhan
akhir" is legible. 3) Add 3 stems; confirm the enabled state still reads as clearly enabled.

**Do not change.** `:root` palette values; the disabled-state *logic*.

**Dependencies.** None.

---

### P1-10 · Tap targets below 44px

**Problem and evidence.** Measured at 390px: `.btn-edit-selection` (`styles.css:1894`) is
127×**32** — it sets `min-height: 32px` explicitly. `.btn-toggle-custom` (`styles.css:1270`,
mobile override `:3135`) is 212×**38**. Every other interactive element measured ≥44px.

**Required behavior.** No interactive element is below 44×44 CSS px at 390px.

**Files to change.** `styles.css` only.

**Implementation instructions.**
1. `.btn-edit-selection`: change `min-height: 32px` → `44px`; adjust `padding` to `8px 12px` so the
   label stays vertically centred.
2. `.btn-toggle-custom`: the base rule already declares `min-height: 48px`; the mobile override at
   `:3135` lets padding collapse it. Add `min-height: 48px` to the override.
3. Do not scale the font size here — that is P3-01.

**Acceptance criteria.**
- [ ] A bounding-box sweep at 390px reports no interactive element with width or height < 44.
- [ ] Neither button's label wraps to a second line at 320px.
- [ ] 15/15 suites still pass.

**Required tests.** Browser/manual sweep (script in §2).

**Manual verification.** At 390px, confirm both controls are comfortably tappable and their labels
are not clipped.

**Do not change.** Button colours or typography.

**Dependencies.** None.

---

### P2-01 · Heading order violation

**Problem and evidence.** `index.html:337` is `<h2 class="lock-brand">Komorebi</h2>` inside the
staging curtain. It precedes the page `<h1>` at `index.html:412`, so the first heading a screen
reader encounters is an `h2`.

**Required behavior.** The first heading in DOM order is the page `<h1>`.

**Files to change.** `index.html`.

**Implementation instructions.** Change the curtain's `<h2 class="lock-brand">` to
`<p class="lock-brand">`. The class carries the styling; no CSS change is needed. It is a
decorative wordmark on a temporary overlay, not document structure. Also give the empty
`<h3 id="image-modal-title">` (`index.html:791`) a non-empty default or leave it — it is populated
before the dialog opens and is not a violation.

**Acceptance criteria.**
- [ ] The curtain renders visually identically.
- [ ] A DOM sweep of `h1`–`h6` in document order returns the hero `h1` first.
- [ ] 15/15 suites still pass.

**Required tests.** Browser/manual DOM sweep.

**Manual verification.** Load, and before unlocking confirm the wordmark looks unchanged.

**Do not change.** `.lock-brand` styling; the curtain's behaviour.

**Dependencies.** None.

---

### P2-02 · Cart mutations are not announced

**Problem and evidence.** `#order-announcer` (`index.html`, `aria-live="polite"`) exists and is
used for the current single-selection flow. Once a cart exists (P1-06), adding and removing lines
is a state change a screen-reader user cannot perceive.

**Required behavior.** Adding, incrementing and removing a line each produce one concise polite
announcement.

**Files to change.** `app.js`, `site-content.js`.

**Implementation instructions.** Reuse the existing `#order-announcer` element and whatever helper
already writes to it — do not add a second live region. Announce via templated strings added to
both language blocks: `announceLineAdded` (`"{item} ditambahkan. {n} item di keranjang."`),
`announceLineRemoved`, `announceQtyChanged`. Write with `textContent`. Debounce rapid stepper
presses to one announcement per 500ms so holding `+` does not flood the queue.

**Acceptance criteria.**
- [ ] Each of add / increment / remove produces exactly one announcement.
- [ ] Holding the stepper produces at most one announcement per 500ms.
- [ ] Only one `aria-live` region exists in the document.
- [ ] Strings come from `site-content.js`, both languages.

**Required tests.** Integration: assert `#order-announcer` `textContent` after `addLine`,
`bumpLineQty`, `removeLine`.

**Manual verification.** With VoiceOver or NVDA, add and remove a line and confirm a single
sensible announcement each time.

**Do not change.** The existing announcer element or its `aria-live` value.

**Dependencies.** P1-06.

---

## 7. Phase 3 — Responsive behavior and presentation

### P1-11 · Horizontal overflow at 320px

**Problem and evidence.** At a 320px viewport `document.documentElement.scrollWidth` is **325** vs
`clientWidth` **320**. `.header-actions-mobile` and `.nav-toggle` both report `right: 325`. The
wordmark is clipped under the PESAN button and ~5px of the hamburger is cut off.
`body { overflow-x: clip }` (`styles.css:59`) hides the scrollbar, which makes it worse — the
control becomes unreachable rather than scrollable. Root cause: `.brand-group` (`styles.css:191`)
is a flex child that never shrinks, and `.brand-name` (`styles.css:206`) is 25px with `0.2em`
tracking.

**Required behavior.** `scrollWidth === clientWidth` at 320, 360 and 390px, and `.nav-toggle` is
fully within the viewport.

**Files to change.** `styles.css` only.

**Implementation instructions.**
1. Add `min-width: 0` to `.brand-group` (`:191`) so it can shrink below its content width.
2. Add `overflow: hidden; text-overflow: ellipsis; white-space: nowrap;` to `.brand-name` (`:206`).
3. In the `@media (max-width: 360px)` block (`styles.css:3272`), add `.brand-est { display: none; }`
   and reduce `.brand-name` to `font-size: 18px; letter-spacing: 0.12em;`.
4. Do **not** remove `overflow-x: clip` from `body` — it is a correct safety net once the real
   overflow is gone.

**Acceptance criteria.**
- [ ] Overflow delta is `0` at 320, 360 and 390px.
- [ ] `.nav-toggle`'s bounding box right edge is ≤ viewport width at 320px.
- [ ] The wordmark is not visually clipped by the PESAN button at 320px.
- [ ] Desktop header at 1440px is pixel-unchanged.
- [ ] 15/15 suites still pass.

**Required tests.** Browser/manual using the overflow script in §2 at all three widths.

**Manual verification.** At 320px confirm the hamburger is fully visible and tappable, and the page
does not scroll sideways.

**Do not change.** Header height; the PESAN button; desktop layout.

**Dependencies.** None.

---

### P2-03 · Custom-builder estimate is off-screen on mobile

**Problem and evidence.** At 390px the estimate card sits below four stepper rows and the count
bar, so the customer taps `+`/`−` with the running total out of view. Measured page height is
11,114px; the estimate card's top is below the fold from the stepper position.

**Required behavior.** The running total is visible while the steppers are being used at 390px.

**Files to change.** `styles.css` only.

**Implementation instructions.** In the mobile block, make `.custom-estimate-card`
`position: sticky; bottom: 0;` within the builder body, with a solid background token (not
transparent) and a top border so it reads as a bar. Ensure it does not overlap the existing
`#sticky-order-bar` — give the estimate card a lower `z-index` and add bottom padding to
`.custom-builder-body` equal to the sticky bar's height.

**Acceptance criteria.**
- [ ] At 390px, with the builder scrolled to the stepper rows, the estimate total is visible.
- [ ] The estimate card does not overlap `#sticky-order-bar`.
- [ ] Desktop layout at 1440px is unchanged.

**Required tests.** Browser/manual at 390px.

**Manual verification.** At 390px scroll to the builder, tap `+` several times, confirm the total
updates in view.

**Do not change.** Desktop two-column builder layout.

**Dependencies.** None.

---

### P2-04 · Product card price rows are not aligned

**Problem and evidence.** In `#collection-grid` the four cards' bottom buttons align but their
**price rows land at different Y positions** — Gerbera's is ~49px higher because it carries an
extra disclaimer box, and Mawar's spec line wraps to two lines. Price is the element scanned
horizontally across a product row, and it is the one off the grid.

**Required behavior.** All four cards' price rows share a Y position regardless of description or
spec length.

**Files to change.** `styles.css` only.

**Implementation instructions.** Convert `.flower-card` to a grid with named rows so
media / title / blurb / spec / price / actions occupy fixed tracks:
`grid-template-rows: auto auto 1fr auto auto auto;` with the blurb in the `1fr` track absorbing
slack. Relevant existing rules: `.flower-spec-line` (`styles.css:728`), `.flower-price-line`
(`:737`). Do not use `subgrid` — browser support for the project's audience is not established.

**Acceptance criteria.**
- [ ] All four `.flower-price-line` elements report the same `offsetTop` relative to the grid at
      1440px.
- [ ] Cards remain equal height.
- [ ] The 2-column mobile layout at 390px still renders without clipping.

**Required tests.** Browser/manual measurement of `offsetTop`.

**Manual verification.** At 1440px confirm the four prices sit on one line; at 390px confirm no
regression.

**Do not change.** Card colours, borders, or photo aspect ratios.

**Dependencies.** None.

---

## 8. Phase 4 — Tests and maintainability

### P2-05 · Extend the test DOM stub and add cart coverage

**Problem and evidence.** `tests/verify-ordering.js:465–476` loads real `app.js` and
`site-content.js` via `vm.runInContext` — **the tests do exercise production code**, which is
good. But the DOM is a hand-rolled stub: every element `app.js` touches must be pre-registered via
`registerEl()` (`tests/verify-ordering.js:288+`). **Any new element added by P1-06, P1-07 or P1-08
will cause the suite to throw unless it is registered.** This is the single most likely way the
Phase 1 work breaks the build.

**Required behavior.** The suite covers cart behaviour and continues to exercise real production
code.

**Files to change.** `tests/verify-ordering.js`.

**Implementation instructions.**
1. Register every new element ID introduced in Phase 1: `#cart-lines`, `#order-picker`, and any
   per-line control IDs. Follow the existing `registerEl(tag, id, className)` convention exactly.
2. Add cart suites as specified in P1-03, P1-04, P1-06 and P1-07.
3. **Do not reimplement pricing arithmetic in the test.** Assert against the exported
   `computeCartTotals`. A test that recomputes the discount and compares two implementations proves
   nothing.
4. Where a Phase 1 change legitimately invalidates an existing suite's premise (several assert
   against `orderMode`), **rewrite the assertion to express the new intended behaviour**. Never
   delete a suite or weaken an assertion to turn red green. If the final suite count differs from
   15, state the new number and why in the run output.

**Acceptance criteria.**
- [ ] Suite runs clean with no "element not registered" errors.
- [ ] Cart merge, removal, quantity floor, wrap-fee-once, and per-bouquet discount threshold are
      each asserted.
- [ ] No test contains a second copy of the pricing formula.
- [ ] Every assertion goes through `window.KomorebiApp`.

**Required tests.** This task *is* the test task.

**Manual verification.** Run `node tests/verify-ordering.js`; confirm the reported suite count and
that failures name the specific behaviour.

**Do not change.** The `vm` sandbox approach; the `window.KomorebiApp` assertion at line 474.

**Dependencies.** P1-06.

---

### P2-06 · FAQ content has no `FAQPage` structured data

**Problem and evidence.** `index.html` contains three JSON-LD blocks (`Organization`, `WebSite`,
`ItemList` of products) but no `FAQPage`, despite six substantive FAQ entries rendered from
`translations.*.faqs`. This forgoes eligible rich results for exactly the pre-purchase questions
that drive discovery.

**Required behavior.** A valid `FAQPage` JSON-LD block reflects the rendered FAQ entries in the
active language.

**Files to change.** `index.html`, `app.js`.

**Implementation instructions.** Add a `<script type="application/ld+json" id="faq-jsonld">` in
`<head>`. Populate it in `app.js` from `t.faqs` inside the existing language-metadata routine
(`applyLanguageMetadata`) so it tracks language switches. Build the object with `JSON.stringify` —
never string concatenation. Emit `mainEntity` as an array of `Question` / `acceptedAnswer`.

**Acceptance criteria.**
- [ ] The block validates as `FAQPage` and lists all six questions.
- [ ] Switching to EN rewrites it with English text.
- [ ] Content is produced via `JSON.stringify`, not concatenation.
- [ ] `<meta name="robots">` is left at `noindex, nofollow` — release is gated separately.

**Required tests.** Integration: after `setLanguage('en')`, parse `#faq-jsonld` `textContent` and
assert `@type === 'FAQPage'` and `mainEntity.length === 6`.

**Manual verification.** Paste the rendered block into a structured-data validator.

**Do not change.** The three existing JSON-LD blocks; the robots meta tag.

**Dependencies.** None.

---

## 9. Phase 5 — Performance, SEO, and optional polish

### P3-01 · Systemic small type

Measured: nearly every label, button and badge renders at 11–11.5px; `.footer-soon-tag` at
**9.58px**. This includes the primary product CTAs — `.btn-order-stem` (`styles.css:775`),
`.btn-add-bouquet` (`:804`), `.btn-choose-bouquet` (`:1110`), `.btn-use-custom` (`:1530`) — all
11px uppercase with tracking. Body copy `.section-sub` (`:112`) is 15px.

**Instruction.** Raise the floor via the shared classes only: label/badge minimum 13px, button text
14px, body 16px. Change the rules listed above plus `.step-label` (`:1732`) and
`.footer-soon-tag`. Do not hand-edit individual component rules; preserve relative hierarchy.

**Acceptance criteria.** No rendered text node below 13px; no button label below 14px; no layout
overflow introduced at 320px (re-run the P1-11 check). **Dependencies.** P1-11.

### P3-02 · Decorative dots read as data

Every bouquet card renders the same four coloured dots regardless of stem count or contents, so
they read as a colour specification. **Instruction:** remove them from the bouquet card template in
`app.js` and delete the corresponding CSS rule. Do not attempt to bind them to real data — the
per-package flower composition is not modelled. **Acceptance:** no dots render; no orphaned CSS
remains. **Dependencies.** None.

### P3-03 · Staging leftovers in customer-facing UI

Two items: (a) the "Lock Site" button (`index.html:764`) sits inside `.footer-links` styled like a
real navigation link — wrap it in a container rendered only when `siteData.auth.enabled` is true,
so it disappears automatically at launch rather than needing a manual delete; (b) `(draf)` /
`(draft)` renders in the Buket Mini blurb — `site-content.js:285` (ID) and `:480` (EN). Remove only
the parenthetical; **do not rewrite the surrounding copy** (§11). **Acceptance:** with
`auth.enabled: false` the Lock Site control is absent; neither blurb contains "draf"/"draft".
**Dependencies.** None.

### P3-04 · Unused image assets

`img/` holds ~37 MB of PNGs. `app.js` references only `.webp` derivatives (flower cards use
`flower.photo` which is a `.webp`; packages use `photoWebp`). The PNGs are never requested by the
browser, but they are deployed by GitHub Pages and bloat every clone. The directory also contains
space-in-filename duplicates (`bouquet 15.png` alongside `bouquet-15.png`).

**Instruction.** Confirm with `grep -rn "\.png" --include=*.js --include=*.html .` that no PNG in
`img/` is referenced, then remove the unreferenced PNGs in a **separate commit that touches nothing
else**. `komorebi-logo.png` (root, 1.8 MB) **is** referenced by the JSON-LD `logo` field — keep it.
**Acceptance:** no `img/*.png` is referenced anywhere; site renders identically; the commit contains
only deletions. **Dependencies.** None.

---

## 10. Owner decisions required

### OD-01 · Should the 9-stem bulk discount apply across the whole cart?

**Why this is needed.** Today `bulkFrom: 9` / `bulkRate: 0.10` (`site-content.js:58–61`) applies to
a single custom bouquet. Once a cart can hold several lines, "9 stems" becomes ambiguous: nine in
one bouquet, or nine across the order? This changes revenue, so it is not an engineering call.

**Choices.**
1. **Per bouquet (recommended).** The threshold is evaluated per `custom` line, exactly as today.
   No pricing changes for any existing scenario. Trade-off: a customer buying 3+3+3 stems as three
   separate bouquets gets no discount, which may feel arbitrary.
2. **Per cart.** Sum all stems across all lines; discount the flower subtotal if the total ≥9.
   More generous and easier to explain. Trade-off: reduces revenue on multi-item orders, and
   package lines would need an explicit include/exclude rule.
3. **Per cart, stems and custom bouquets only** (packages excluded, since their prices already bake
   in a saving). Middle ground; hardest to explain to a customer.

**Recommendation: choice 1.** It is the only option that ships Phase 1 with **zero pricing change**,
which removes an entire class of risk from a large refactor. P1-03 isolates the rule inside
`computeCartTotals`, so switching later is a one-function change plus a test update.

**Blocks.** Nothing — P1-03 implements choice 1 as the default. Revisit after Phase 1 ships.

---

### Decisions already made during this audit — the implementer must not revisit these

Recorded so the implementation model does not stop to ask:

| # | Decision | Rationale |
|---|---|---|
| 1 | **Wrap colour is per order**, not per line item | Matches today's single `selectedWrap`; a small studio packs one box |
| 2 | **Greeting card is per order**, not per line item | Matches today's single `orderNote`; multi-recipient is speculative |
| 3 | **Cart does not persist** across reloads | Matches today's behaviour; avoids stale-cart and stale-price bugs |
| 4 | **WhatsApp messages are driven from `site-content.js` templates** with an enumerated `{itemList}` | Restores the owner-editable promise the README already makes (P1-02) |
| 5 | **Package variety does not change price** | No price data exists per variety; inventing one would be a business decision |
| 6 | **Duplicate stem selections merge; custom bouquets never merge** | Two bouquets are two distinct arrangements |

---

## 11. Manual verification required

Not confirmable in this environment; do **not** report these as failures.

- **WhatsApp deep links.** `store.whatsappNumber` is a placeholder (`site-content.js:33`). The
  generated `wa.me` URL can be verified for *shape and content* but not for delivery. Requires a
  real number and a device with WhatsApp.
- **Shopee channel.** `store.shopeeUrl` is intentionally empty (`site-content.js:31`); the disabled
  "Segera hadir" state is correct behaviour. Live-store behaviour needs a real listing.
- **Instagram link.** Placeholder handle (`site-content.js:29`).
- **Screen-reader announcements (P2-02).** Needs VoiceOver/NVDA on a real device; the DOM stub
  cannot verify announcement quality.
- **Webfont rendering.** Google Fonts may be blocked in sandboxes; type colour and metrics should be
  judged on a network-enabled device.
- **Real-device touch ergonomics (P1-10).** Bounding-box measurements confirm size, not comfort.
- **Photography-dependent items.** Bouquet photos are inconsistent within one product family
  (Mini/Sedang unwrapped, Besar/Istimewa wrapped with ribbon) and "Cara dibuat" has no process
  imagery. Both require new photography and an owner decision — **no code task is specified**.

---

## 12. Recommended execution order

Each batch leaves the site in a working, shippable state.

| Batch | Tasks | Rationale |
|---|---|---|
| **A** | P1-01, P1-02 | Isolated ordering-correctness fixes. Must precede cart work — the cart changes the message shape. |
| **B** | P1-09, P1-10, P1-11, P2-01 | Pure CSS/HTML. Zero interaction with Phase 1 logic; safe to land any time. |
| **C** | P1-03 | Cart model + pricing under test. **No visible change.** |
| **D** | P1-04, P1-05 | Route selections through the cart; unify commit behaviour. Still one line max. |
| **E** | P1-06, P2-05 | Multi-item cart + test coverage. **Land together** — new DOM breaks the stub otherwise. |
| **F** | P1-07, P1-08, P2-02 | Package picker, empty-state removal, announcements. All require the cart. |
| **G** | P2-03, P2-04, P2-06 | Responsive and SEO polish. |
| **H** | P3-01, P3-02, P3-03, P3-04 | Optional polish. P3-04 must be its own commit. |

**Suggested assignment for a token-constrained run:** batches A and B first — they deliver most of
the visible improvement, carry near-zero risk, and require no cart understanding. Then C→D→E→F in
strict order. Do not start E without completing C and D.

---

## 13. Implementation handoff prompt

Copy everything below into a fresh implementation session, replacing `<TASK IDS>`.

If the implementing model has **no repository access** (a plain chat window rather than a coding
agent), see the note at the end of this section before using the prompt.

---

> You are implementing changes to the Komorebi Creations website: a zero-dependency static site
> built from vanilla HTML5, CSS3 and ES6. There is no build step, no bundler, no framework, and no
> runtime dependencies. Four files carry everything: `index.html`, `styles.css`, `app.js`,
> `site-content.js`. Tests live in `tests/verify-ordering.js` and run with `node`.
>
> **Implement only these task IDs: `<TASK IDS>`.** Do not implement any other finding from the
> audit, even if you notice it while working. If you spot something genuinely broken that is not in
> your assigned scope, note it in your final report — do not fix it.
>
> **Before changing anything:**
> 1. Read `KOMOREBI_CODE_AUDIT.md` in full, then re-read the specific tasks you were assigned.
> 2. Open and read the current contents of every file your tasks name. **Do not trust the code
>    snippets or line numbers quoted in the audit** — the repository may have changed since it was
>    written. Verify current reality yourself before editing.
> 3. Check each task's `Dependencies` field. If a prerequisite task ID is not yet present in the
>    code, stop and report that rather than implementing the prerequisite yourself.
> 4. Run `node tests/verify-ordering.js` once to establish the baseline suite count and confirm it
>    is green before you start.
>
> **Rules:**
> - Make the **smallest coherent change** that satisfies the task. Do not reformat, reorder,
>   rename, or "tidy" code you were not asked to touch. Never rewrite a whole file.
> - Preserve all unrelated existing behaviour, including changes made by others since the audit.
> - All prices, phone numbers, social handles and marketplace URLs are **intentional placeholders**.
>   Do not fill them in, do not replace them with realistic-looking values, and do not report them
>   as bugs. The empty Shopee URL producing a disabled "Segera hadir" button is correct behaviour.
> - Do not add a framework, bundler, package, or any runtime dependency. `@playwright/test` is a
>   devDependency for tests only and must stay that way.
> - Preserve the existing vintage-botanical visual identity. Do not redesign anything.
> - Follow each task's `Do not change` list exactly.
> - Where a task names a specific approach, use that approach. The audit already resolved the design
>   trade-offs; do not substitute your own solution because you prefer it.
> - Section 10 of the audit lists six decisions already made (wrap scope, note scope, persistence,
>   message templating, package pricing, line-merge behaviour). Treat those as settled requirements,
>   not suggestions.
>
> **Testing:**
> - Add or update the tests named in each task's `Required tests`.
> - Tests must exercise real production code through the `window.KomorebiApp` interface. The suite
>   loads the actual `app.js` and `site-content.js` into a `vm` sandbox — keep it that way. Never
>   copy a production algorithm into a test to compare two implementations against each other; that
>   proves nothing.
> - **If you add any new DOM element, register it in the hand-rolled DOM stub in
>   `tests/verify-ordering.js` (see the `registerEl(...)` calls).** The stub is not jsdom. An
>   unregistered element will make the suite throw, and this is the most likely way to break the
>   build.
> - Run `node tests/verify-ordering.js` and report the actual output, not a summary of it.
> - Never weaken or delete an assertion to turn a failure green. If a task legitimately changes
>   intended behaviour, rewrite the assertion to express the new behaviour and say explicitly that
>   you did and why. If the final suite count differs from the baseline, state the new number and
>   the reason.
>
> **Before reporting done:**
> - Review your own diff line by line and remove anything out of scope.
> - Walk each acceptance criterion in your assigned tasks and check it against actual behaviour or
>   actual code — not against your intention.
> - **If any acceptance criterion is unmet, say so explicitly. Do not report a task as complete
>   while a criterion remains unsatisfied.** A partially finished task honestly reported is more
>   useful than a task claimed done.
>
> **Report back:**
> 1. Files changed, one line of reasoning each.
> 2. Behaviour implemented, grouped by task ID.
> 3. Tests added or updated, the exact command run, and the real output.
> 4. Every acceptance criterion, marked met or unmet.
> 5. Remaining limitations and anything needing manual verification on a real device.
>
> **Stop and ask** if: the repository contradicts the audit in a way that changes the task; a
> dependency is unmet; an acceptance criterion cannot be satisfied as written; or the work appears
> to require a product decision the audit did not settle.

---

### If the implementing model has no repository access

The prompt above assumes an agentic session that can read files and run `node`. In a plain chat
window, adapt as follows:

1. **Assign one task ID per message.** These tasks are sized for one focused turn each; batching
   them into a chat session loses the verification step that makes them safe.
2. **Paste the whole of every file the task names**, not excerpts. Several tasks depend on state
   declared far from the code being edited — `app.js` alone is 2,307 lines, and a partial paste
   will produce a plausible edit that breaks something off-screen.
3. **Ask for a unified diff, not a rewritten file.** Whole-file output at this size reliably drops
   or alters unrelated code.
4. **You must run the tests yourself** after applying each diff: `node tests/verify-ordering.js`.
   Paste failures back verbatim. Do not accept "this should pass" as evidence.
5. **Skip the browser-verified tasks** (P1-09, P1-10, P1-11, P2-03, P2-04) unless you can measure
   the result yourself — their acceptance criteria are measurements, and a model without a browser
   cannot confirm them.

Under those constraints, batches A and B from §12 are the realistic scope. Batches C through F (the
cart rewrite) involve coordinated edits across `index.html`, `app.js`, `styles.css` and the test
stub, sequenced across six dependent tasks — that needs a session that can read the repo and run
the suite between steps.

---


## 14. Audit self-check

- Every finding cites a file and a line, function, or selector, and states how it was confirmed.
- Every task has objective acceptance criteria; no criterion uses subjective wording.
- Every task names exact files and its required tests.
- Dependencies form a consistent DAG: P1-01/02 → P1-03 → P1-04 → {P1-05, P1-06} → {P1-07, P1-08,
  P2-02, P2-05}; P1-11 → P3-01; all others independent.
- No placeholder value is classified as a defect. Placeholders are listed in §11.
- Duplicate findings removed: the five cart symptoms are consolidated into one root cause
  (P1-03/04) with distinct downstream tasks, not reported five times.
- Only one genuine owner decision is escalated (OD-01); six ordinary engineering decisions were
  resolved during the audit and are recorded so the implementer does not re-open them.
- Tasks are sized for one focused turn each; the cart rewrite is split into six sequential steps
  rather than one large change.
- Line references were verified against the working tree at the time of writing. The implementer is
  instructed to re-verify before editing.
