# Storefront UX fixes — implementation brief

**Status:** implemented on branch `claude/compassionate-goldberg-kdf7km` — see the Completion report at the bottom. Written for a coding agent to implement, task by task.
**Base commit:** `a65f53b` (main). Reconfirm each finding against HEAD before changing code.
**Background and evidence:** [`WEBSITE-UX-AUDIT.md`](WEBSITE-UX-AUDIT.md). Read it first; this file
says *what to change*, the audit says *why*.
**Files in scope:** `index.html`, `styles.css`, `app.js`, `site-content.js`, `tests/verify-ordering.js`,
`tests/browser-runner.html`, and `dist/` (regenerated, never hand-edited).

---

## How to work on this

1. Work on the branch you were given. Never push to `main`.
2. **Locate code by the quoted anchor string, not by line number.** Line numbers in this file are
   hints from the base commit and drift as you edit.
3. **One commit per task**, message `Fix storefront UX-NN: <short summary>`, the same style as the
   repo's history (`Fix Studio Desk P1-3 …`).
4. Before the first change, record the baseline: run `npm test` and `npm run test:browser` (see
   *Running the tests*). Both pass at the base commit.
5. After each task, run `npm test`. After every 2–3 tasks, and at the end, also run
   `npm run test:browser`.
6. At the end, run `npm run build` and commit the regenerated `dist/` in a final commit
   (`chore: rebuild dist/`). Never edit files in `dist/` by hand.
7. Finish with the **Completion report** at the bottom of this file. Mark every task
   **Fixed**, **Partly fixed**, **Needs owner input** or **Not reproduced**, with evidence.

### Ground rules — do not break these

- **Vanilla stack.** No frameworks, bundlers or new runtime dependencies.
- **Every customer-visible string lives in `site-content.js`, in both `translations.id` and
  `translations.en`.** When you add or change a string, add or change both. App code reads strings
  through `t.<key>` (or `ck('<key>')` inside checkout code), with a sensible fallback.
- **Do not change prices, pricing arithmetic, the order payload shape, or the server contract.**
  In particular, the `wrap` field (`wrapId` in `normalizedCheckoutState()`) must keep sending a
  valid wrap key: the server (`CONFIGURE-SUBMISSION-ENDPOINT.md`,
  `if (WRAP_IDS.indexOf(order.wrap) === -1) return fail(...)`) rejects anything else, and it
  already blanks the Sheet's `Wrap` column for orders without a bouquet.
- **Do not touch** `studio-desk/`, `CONFIGURE-SUBMISSION-ENDPOINT.md`, or the Worker.
- **Never put user-typed text into `innerHTML`.** Use `textContent`, as the existing code does.
- **Keep `prefers-reduced-motion` support.** Any new animation must be skipped under it, as
  `renderFloatingCartBadge` does.
- **Keep the element IDs the tests rely on** (`#btn-checkout`, `#save-order`, `#cart-lines`,
  `#sticky-order-title`, `#finish-label`, `#order-picker`, `.btn-order-stem`,
  `.btn-choose-bouquet`, …) unless a task below explicitly says to change a test.
- **Do not invent business facts** (payment methods, couriers, cancellation rules, prices). Where a
  task needs one, it is listed under *Owner questions*. Leave it out and report it.
- Tap targets stay at least 44 × 44 px. Interactive text stays at least 13 px.

### Some current behaviour is deliberate — you are reversing it on purpose

Earlier review rounds chose two behaviours that this brief now reverses. Tests lock both in, and
the code comments explain them. **Update those tests as described below.** Don't treat the
failures as regressions to work around.

| Behaviour today | Where it's pinned | Reversed by |
| --- | --- | --- |
| Adding a stem or package moves focus to `#finish-label`, and the first add scrolls to `#order` | `tests/verify-ordering.js` Suite 13 ("Selecting a stem should focus #finish-label"); `tests/browser-runner.html` Test 1 and Test 4 (DEV-24 comment) | UX-01 |
| With an empty cart, `#order-picker` renders every product as tiles, and a tile click scrolls to `#order` | `tests/verify-ordering.js` Suite 21 (P1-08) | UX-02 |

### Running the tests

```bash
npm ci                     # once
npm test                   # Node suites: ordering, pricing, boot, metadata, worker, Studio Desk
npm start &                # static server on :8080 (python); the browser runner does NOT start one
PLAYWRIGHT_CHROMIUM_PATH=/path/to/chrome npm run test:browser   # path only if Playwright's bundled Chromium is missing
```

---

## Task list (do them in this order)

| Order | ID | Sev | Summary |
| --- | --- | --- | --- |
| 1 | UX-01 | P1 | Stay in place on add; confirm on the button; don't move focus |
| 2 | UX-04 | P1 | One cart control per viewport; move the desktop pill off the cards |
| 3 | UX-02 | P1 | Replace the duplicate empty-cart product picker with three shortcuts |
| 4 | UX-03 | P1 | Only mention wrap colour in review when a bouquet is in the cart |
| 5 | UX-05 | P2 | Stem cards: remove the repeated price note; clean phone button layout |
| 6 | UX-06 | P2 | Add buttons get the product name in their accessible description |
| 7 | UX-07 | P2 | Show full descriptions on phones; visible zoom hint on photos |
| 8 | UX-09 | P2 | Cart panel: hide the empty "Termasuk" heading; demote "Kosongkan keranjang" |
| 9 | UX-10 | P2 | Hide the Shopee notice in the order panel until Shopee is live |
| 10 | UX-08 | P2 | Checkout: honest step count, "Kirim pesanan", cleaner review button |
| 11 | UX-11 | P2 | Privacy notice: short summary + expandable full text |
| 12 | UX-12 | P2 | Consistent location copy; translate the hard-coded English strings |
| 13 | UX-13 | P2 | Add two FAQs from facts already on the site; drop "Baca FAQ" |
| 14 | UX-14 | P3 | Align the mini-pot grid and the kit teaser to the page grid |
| 15 | UX-15 | P3 | Raise 11–12 px interactive text to ≥ 13 px; card checkbox target to 44 px |
| 16 | UX-16 | P3 | Rename the catalogue heading; header "Pesan" goes to the cart when it has items |

---

## UX-01 (P1) — Stay in place on add

**Problem.** The first "add" from a product card scrolls the page 3,000–5,000 px down to `#order`
(desktop 1,791 → 4,825 px; phone ~1,800 → 6,938 px), past products the visitor hasn't seen yet.
Every stem or package add also moves keyboard focus to `#finish-label`, far from the card.

**Where (app.js).**
- `function selectStemOrder(`: the `if (scroll) { if (wasCartEmpty) scrollToSection('#order', '.order-controls-col'); const finishLabel = …` block.
- `function selectMiniPot(`: the line `if (scroll && wasCartEmpty) scrollToSection('#order', '.order-controls-col');`.
- `function selectPackageOrder(`: the `if (scroll) { … }` block (scroll + `finishLabel.focus` + pulse).
- The stem click handler in `renderCollection`: `orderBtn.addEventListener('click', (e) => { … selectStemOrder(key, true, …)`.
- The mini-pot click handler: `card.querySelector('.btn-add-mini-pot').addEventListener('click', () => selectMiniPot(pot.key));`.

**Change.**
1. In `selectStemOrder`, `selectMiniPot` and `selectPackageOrder`, remove the scroll to `#order`
   and the `#finish-label` focus/pulse. Keep the function signatures, including the `scroll`
   parameter, because `window.AlxanthiaApp` exposes them and the tests call them. `scroll` can
   simply have no effect now.
2. Keep `selectPackageOrder`'s `restoreFocus` behaviour: focus stays on the package's button.
   The package button already confirms the add with `pkgBtnActive`
   ("✓ {qty} di keranjang — tambah lagi"). Keep that.
3. Add a helper `flashAddedConfirmation(btn)` and call it from the stem and mini-pot click
   handlers, after the select call:
   - Do nothing if `btn.dataset.flashing === 'true'`. Otherwise save `btn.innerHTML`, set
     `btn.textContent` to the new string `t.addedConfirm` (ID `"✓ Ditambahkan"`,
     EN `"✓ Added"`), and add class `is-added`.
   - After 1,400 ms, restore the saved markup, remove the class, and clear the flag.
   - Don't change `aria-label` or move focus. `addLine()` already announces the add through
     `announceToScreenReader(... t.announceLineAdded ...)`, so screen readers are covered.
   - Style `.is-added` with the existing "advance" green (`var(--accent-green)` background,
     `var(--bg-main)` text). No motion needed.
4. **Leave `useCustomBouquet()` alone.** Committing a custom bouquet is a deliberate "I'm done"
   step, and the builder sits directly above `#order`, so scrolling there is correct.
5. Any add that doesn't actually add (cart limits: `addLine` returns `null` or the unchanged line
   and shows `#cart-limit-notice`) must not flash "✓ Ditambahkan". Have the select functions
   return whether a unit was added, and flash only when they did.

**Tests.**
- `tests/verify-ordering.js` Suite 13: replace the `finishLabel.focused === true` assertion with:
  stub `sandbox.scrollTo` (Suite 21 shows the pattern), call `app.selectStem('Sunflower', true)`
  on an empty cart, then assert `finishLabel.focused !== true`, that `scrollTo` was **not**
  called, and that the cart has one line.
- `tests/browser-runner.html` Test 1: assert `doc.activeElement === stemBtn` after the click
  (rename the assertion: "Stem add keeps focus on the clicked button"). Test 4: assert
  `doc.activeElement === targetBtn`. Update the DEV-24 comment to say the behaviour was reversed
  by UX-01.
- Add a browser assertion: the page's `scrollY` is unchanged (±2 px) after the first stem add.

**Acceptance.** At 390 px and 1440 px, tapping the first product's add button leaves `scrollY`
unchanged. Focus stays on the button, which reads "✓ Ditambahkan" for about 1.4 s, and the cart
count updates (UX-04).

---

## UX-04 (P1) — One cart control per viewport

**Problem.** On phones, the floating pill ("1 di keranjang") and the sticky order bar both show
after an add. The pill sits above the bar and covers content. On desktop the pill sits at
`top: 86px; right: 20px`, over the last product card's photo badge.

**Where (styles.css).** The base `.floating-cart-pill {` rule (`top: 86px; right: 20px;`) and its
`@media (max-width: 860px)` override (the one with the comment "Bottom-right, clear of the slim
sticky order bar"). The sticky bar is `.sticky-order-bar`, which is already hidden at
`min-width: 861px`.

**Change.**
1. Phones (`max-width: 860px`): hide the pill completely (`display: none !important`). The sticky
   bar is the phone's cart control. `display: none` also takes the pill out of the tab order.
2. Desktop: move the pill to bottom-right (`top: auto; bottom: 24px; right: 24px;`, plus
   `env(safe-area-inset-bottom)`), and start its hidden transform from `translateY(8px)` instead
   of `-8px`, so it rises into place.
3. When the cart count changes, give the sticky bar the same short bump the pill gets
   (`renderFloatingCartBadge` has the reduced-motion-aware pattern; reuse the
   `floatingCartBump` keyframes on `.sticky-order-inner`). Track the last count the same way
   `lastFloatingCartCount` does.
4. Don't change the sticky bar's title logic. `tests/verify-ordering.js` Suite 32 pins it.

**Acceptance.** At 390 px, after an add and a scroll to `#bouquets`, the pill's computed `display`
is `none` and the sticky bar is visible. At 1440 px, the pill's bottom edge is within 24–40 px
of the viewport bottom, and it overlaps neither the header nor any `.flower-card`.

---

## UX-02 (P1) — Remove the duplicate empty-cart picker

**Problem.** With an empty cart, `#order` renders `#order-picker` with every product again
(8 stem tiles, 3 pots, 4 packages). The catalogue is shown twice; at 390 px, `document.body.scrollHeight`
is about **15,577 px**. The empty copy also says "di bawah" (below), but on desktop the picker
is to the left.

**Where.** `index.html`: `<div class="order-picker" id="order-picker">` and its three
`order-picker-group` children. `app.js`: `function renderOrderPicker(` and `function renderPickerTile(`.
`site-content.js`: `orderPickerLabel`, `cartEmpty` (ID and EN).

**Change.**
1. Keep the `#order-picker` container and `#order-picker-label`. Replace the three group blocks
   with one row of three buttons:
   `<button type="button" class="order-empty-shortcut" data-shortcut="stems|pots|bouquets">`.
   Labels come from the existing `t.catOneTitle`, `t.catTwoTitle`, `t.catThreeTitle`.
2. `renderOrderPicker()` keeps its show/hide rule (visible only while `cart.length === 0`). It now
   only sets the label and the button texts. Bind the click handlers once, outside the render, or
   guard them with a `data-` flag, because render runs often.
3. Click behaviour, the same as the hero buttons: call `setCategory('all', false)` so a category
   filter can't hide the target, then `scrollToSection('#collection' | '#mini-pots' | '#bouquets')`.
4. Copy: `orderPickerLabel` → ID `"Keranjang Anda masih kosong. Mulai dari:"`,
   EN `"Your cart is empty. Start with:"`. `cartEmpty` → ID `"Belum ada produk dipilih."`,
   EN `"Nothing selected yet."`. Also update the two hard-coded fallbacks in `renderCartLines`.
5. Delete `renderPickerTile` and any picker-tile CSS once nothing uses them (search for
   `order-picker-tile` or the class `renderPickerTile` emits). Keep `.order-picker-group-label`
   only if you still use it.
6. Style the shortcuts as secondary buttons (outline, at least 44 px tall). They wrap onto two
   rows at 320 px.

**Tests.** Rewrite `tests/verify-ordering.js` Suite 21:
- Empty cart: `#order-picker` is visible, and `#order-picker` contains exactly 3
  `.order-empty-shortcut` buttons and **no** `img`.
- After `app.selectStem('Rose', false)`: `#order-picker` is `display: none`.
- Remove the tile-click/scroll assertions. If the mock DOM has the picker grid elements
  registered (`order-picker-flowers`, `order-picker-packages`), remove those registrations too.

**Acceptance.** With an empty cart at 390 px, `#order` shows no product images, and
`document.body.scrollHeight` is several screens shorter than the 15,577 px baseline (record both
numbers in the report). Each shortcut lands on its section even with the "Mini pot" filter active.

---

## UX-03 (P1) — Only mention wrap colour when a bouquet is in the cart

**Problem.** The review step always prints "Bungkus: Kraft." (`#checkout-finish`), including for a
mini-pot-only cart and for "Tanpa bungkus" stems. The customer never chose that. The wrap chips
and the cart's includes list already show the colour only for bouquets
(`const cartUsesWrap = cart.some(line => line.type === 'package' || line.type === 'custom');`);
the review line ignores that rule.

**Where (app.js).** In `openCheckoutReview()`:
`setText('#checkout-finish', \`${en ? 'Wrap' : 'Bungkus'}: ${t.wrapNames[selectedWrap]}.${cardNoteText}\`);`
and the `cartUsesWrap` line in `renderOrderSection()`.

**Change.**
1. Extract `function cartUsesBouquetWrap() { return cart.some(l => l.type === 'package' || l.type === 'custom'); }`
   and use it in `renderOrderSection()` and the WhatsApp message builder (`const wrapTxt = cartUsesWrap ? …`).
2. In `openCheckoutReview()`, build the finish line from parts: the wrap sentence only when
   `cartUsesBouquetWrap()` is true, then the card-note sentence if any. If both are empty, set
   `#checkout-finish` to `hidden`; otherwise un-hide it and set the text.
3. **Do not touch `wrapId` / `wrap` in the payload.** See Ground rules: the server needs a valid
   key and already blanks it for non-bouquet orders.

**Tests.** Add to `tests/browser-runner.html`: start from an empty cart, add one mini pot
(`win.AlxanthiaApp.selectMiniPot('daisy', false)`), click `#btn-checkout`, and assert that
`#checkout-finish` is hidden or does not contain `Bungkus`/`Wrap`. Then add a package and reopen;
assert it does contain the wrap name. Close the dialog and clear the cart afterwards, so later
tests start clean.

**Acceptance.** Mini-pot-only and stem-only reviews say nothing about wrap colour. A review with a
package or custom bouquet shows "Bungkus: <colour>." The submitted payload is byte-identical to
before for the same cart (Suite 24 still passes).

---

## UX-05 (P2) — Stem cards: one price, tidy buttons

**Problem.** Each stem card shows the price three times: the price line, a grey "ⓘ Harga per 1
tangkai jadi" box that looks like an alert, and both buttons. At 390 px (2-column grid) the price
line and the button labels wrap mid-phrase.

**Where.** `app.js` `renderCollection`: `const singleNoteHtml = trans.singleNote ? …` and
`${singleNoteHtml}`; `function stemOrderButtonLabel(`. `site-content.js`: every
`singleNote:` (one per flower per language). `styles.css`: `.flower-single-note` rules,
`.btn-order-stem`, `.btn-order-stem-price`, `.per-stem-tag`.

**Change.**
1. Delete `singleNoteHtml` and its use, the `singleNote` keys in `site-content.js`, and the
   `.flower-single-note` CSS. (Studio Desk doesn't read `singleNote`; confirm with a search before
   deleting.)
2. `stemOrderButtonLabel`: ID `"+ Tanpa bungkus"` / `"+ Dengan bungkus"`, EN `"+ Without wrap"` /
   `"+ With wrap"`. The function is also used for picker tiles, which UX-02 removes.
3. Below 481 px: lay out `.btn-order-stem` as a column (`flex-direction: column; align-items: flex-start; gap: 2px;`)
   so the label is line 1 and the price is line 2, with no mid-phrase wrapping. Make
   `.per-stem-tag` `display: block` so "per tangkai" sits on its own line under the price,
   instead of wrapping arbitrarily.
4. Keep both buttons, their classes and their `data-flower` / `data-wrapped` attributes. Tests and
   handlers rely on them.

**Acceptance.** At 390 px, no stem button label breaks inside "Tanpa bungkus" / "Dengan bungkus",
and each stem card shows the per-stem price once outside the buttons. At 1440 px, cards look
unchanged apart from the removed note box.

---

## UX-06 (P2) — Add buttons name their product

**Problem.** Measured accessible names: 4× "Tanpa bungkus Rp …", 3× "Tambahkan mini pot",
4× "Tambahkan buket ini". None names the product.

**Change.** Use `aria-describedby`, which keeps the visible text as the accessible name (WCAG 2.5.3,
label in name) and adds the product:
1. Give each card's title element a stable id: flower `flower-title-${key}`, pot
   `pot-title-${pot.key}`, package `pkg-title-${index}`. The title elements are the flower name
   heading in `renderCollection`, `<h4 class="mini-pot-title">` and `<h4 class="bouquet-title">`.
2. Add `aria-describedby="<that id>"` to every `.btn-order-stem`, `.btn-add-mini-pot`, and
   package `.btn-choose-bouquet`.
3. Make sure the in-place update in `renderBouquetsUI` (the `existingCards.forEach` branch) keeps
   the attribute. It only changes `textContent`, so it should.

**Tests.** In `tests/browser-runner.html`, for each of the three button sets: every button has
`aria-describedby`, it resolves to an element with non-empty text, and within each set the
described-by texts are unique per card.

**Acceptance.** A screen reader announces, for example, "+ Tanpa bungkus Rp 60.000, button, Mawar".

---

## UX-07 (P2) — Full descriptions on phones; visible zoom hint

**Problem.** Under 769 px, `.flower-blurb`, `.mini-pot-blurb` and `.bouquet-blurb` are clamped to
3 lines, and four were cut off at 390 px. The flower photo modal caption
(`openImageModal(flower.photo, flowerAlt, trans.name, \`${flower.latin} · ${trans.size} · ${trans.detail}\`, photoWrap)`)
doesn't include the description, so the cut-off text is unreachable. The only zoom hint is a
`title` tooltip, which touch screens never show.

**Change.**
1. In `styles.css`, inside `@media (max-width: 768px)`, remove the `-webkit-line-clamp: 3`,
   `display: -webkit-box`, `-webkit-box-orient` and `overflow: hidden` declarations from those
   three blurb rules. Keep their font size, line-height and margin.
2. Flower modal caption: prepend the description, e.g.
   `\`${trans.blurb} — ${flower.latin} · ${trans.size} · ${trans.detail}\``.
3. Add a visible zoom hint inside `.flower-photo-wrapper`, `.mini-pot-photo-wrapper` and
   `.bouquet-photo-wrapper`: `<span class="photo-zoom-hint" aria-hidden="true">` containing a
   small inline magnifier SVG, positioned top-right (a 28 px circle on a translucent
   `var(--bg-main)` background). The flower photo already has a bottom-centred "Foto: N tangkai"
   badge, so don't use the bottom edge. The wrappers already have `role="button"` and an
   aria-label, so the hint is decorative.

**Acceptance.** At 390 px, no product description is truncated. Every product photo shows the
zoom hint. The flower modal shows the description.

---

## UX-09 (P2) — Cart panel tidy-up

**Problem.** At 390 px the cart header crams "PILIHAN ANDA" (wrapping to two lines), "KOSONGKAN
KERANJANG" and "UBAH PILIHAN" together. With a stem-only cart, an empty **"TERMASUK"** heading
renders. In the empty state the panel shows stray divider lines.

**Where.** `index.html`: `<div class="summary-top-row">` and `<h3 class="step-label" id="includes-label">`.
`app.js` `renderSummaryIncludes()`:
`includesLabelEl.style.display = cartHasSelection ? '' : 'none';`.

**Change.**
1. `renderSummaryIncludes()`: decide label visibility **after** building `allIncludes`:
   `includesLabelEl.style.display = allIncludes.length ? '' : 'none'`. Hide the list itself
   too when it's empty.
2. Move `#btn-clear-cart` out of `.summary-top-actions` to directly after
   `.summary-price-container`, styled as a small muted text link (still at least 44 px tall).
   Keep its id and its existing `window.confirm`. "Ubah pilihan" stays at the top, next to the
   title.
3. Below 481 px, put the title on its own line and the "Ubah pilihan" button below it, left-aligned.
4. Empty state: find what draws the two stray lines (likely borders on `.summary-price-container`
   or the includes block while they're hidden) and hide those borders while
   `cart.length === 0`.

**Acceptance.** At 390 px with one wrapped stem: no "Termasuk" heading and no empty list.
"Pilihan Anda" fits on one line. "Kosongkan keranjang" sits under the total. Empty cart: no
stray dividers.

---

## UX-10 (P2) — Hide the Shopee notice until Shopee is live

**Problem.** Under the checkout button, `#marketplace-status-box` says "Shopee · SEGERA HADIR" and
explains that Shopee isn't ready: a dead end at the moment of decision. The footer already says
"Shopee (segera hadir)".

**Where.** `app.js` `renderOrderSection()`: `if (mktNoticeBox) { if (siteData.store.channels?.showShopee === false && !waReady) { … } else { … } }`.

**Change.** When `!shopeeActive` (Shopee not ready), set `mktNoticeBox.style.display = 'none'`.
Keep filling its texts as today, so nothing else breaks. When `shopeeActive`, show it as today.
Leave the footer link as is.

**Tests.** `tests/verify-ordering.js` Suite 9 asserts
`mktText.textContent.includes('Listing Shopee sedang disiapkan')`. Keep that assertion (the text
is still set) and add `assert.strictEqual(mktBox.style.display, 'none')` for the not-ready case.
Add the opposite assertion to the existing "Shopee ready" case, if one exists.

**Acceptance.** With `store.shopeeUrl: ""`, the order panel shows no Shopee box. The footer still
shows "Shopee (segera hadir)".

---

## UX-08 (P2) — Honest checkout steps and labels

**Problem.** The review button has a WhatsApp-style chat icon and a redundant second line
("lanjut →"). The disabled state ("Pilih produk terlebih dahulu") is a dashed serif box that
reads like a text field. The dialog says "Langkah 2 dari 2" on the form, and the primary button
is "Simpan pesanan", but the customer still has to tap "Lanjut ke WhatsApp →" afterwards.

**Where.** `index.html` `#btn-checkout` (its `<span class="channel-icon">` and
`<span class="channel-action">`). `app.js`: the `checkoutButton` block in `renderOrderSection()`
(`if (action) action.textContent = enabled ? … 'lanjut →' …`); `CHECKOUT_STEPS`
(`'checkout-success': { …, stepNumber: 2, … }`); the indicator code
(`ck('checkoutStepIndicator', { step: meta.stepNumber, total: 2 })`). `styles.css`
`.btn-channel.btn-disabled` and the related rules. `site-content.js` keys `checkoutStepReview`,
`checkoutStepForm`, `checkoutStepSuccess`, `checkoutSaveOrder`, `checkoutSaving`.

**Change.**
1. Remove the chat icon span and the `.channel-action` span from `#btn-checkout`, and the JS line
   that fills `.channel-action`. The button shows only `.channel-name` ("Tinjau pesanan").
   Check that no CSS breaks without the spans.
2. Disabled state: solid 1 px border (no dashes), sans-serif label, muted background and text
   from existing tokens, `cursor: not-allowed`. It must look like a disabled button.
3. Steps: set `'checkout-success'.stepNumber = 3`. The indicator text becomes
   `ck('checkoutStepIndicator', { step, total: 3 }) + ' · ' + <step name>` on all three steps
   (including success, which currently shows only `checkoutStepSuccess`). Step names:
   ID `"Tinjau"`, `"Data"`, `"Kirim via WhatsApp"`; EN `"Review"`, `"Details"`, `"Send via WhatsApp"`.
4. `checkoutSaveOrder`: ID `"Kirim pesanan"`, EN `"Submit order"`. `checkoutSaving`:
   ID `"Mengirim…"`, EN `"Submitting…"`. `checkoutSubmittingNotice` (EN
   `"Saving your order, please wait…"`): change "Saving" to "Submitting", and make the matching
   ID text consistent. Leave the failure messages alone; they describe storage accurately.

**Acceptance.** The dialog reads "Langkah 1 dari 3 · Tinjau", "Langkah 2 dari 3 · Data" and
"Langkah 3 dari 3 · Kirim via WhatsApp". The form button reads "Kirim pesanan". The review
button has no chat icon. The disabled CTA clearly looks disabled.

---

## UX-11 (P2) — Privacy notice: summary plus full text on demand

**Problem.** On phones, `#checkout-privacy-notice` is about 10 lines of small text between the
last field and the consent checkbox.

**Change.**
1. Add a key `checkoutPrivacySummary`. ID: `"Data Anda hanya dipakai untuk pesanan ini, disimpan
   {retention} di sistem internal studio, lalu dihapus."` EN: `"Your details are only used for
   this order, kept {retention} in the studio's internal records, then deleted."` Fill
   `{retention}` exactly as the existing notice does.
2. Render `#checkout-privacy-notice` as: the summary sentence, then
   `<details><summary>{checkoutPrivacyLinkText}</summary><p>{full checkoutPrivacyNotice}</p></details>`.
   Build it with `createElement` and `textContent`, not `innerHTML`. The selector map near
   `'#checkout-privacy-notice': ck('checkoutPrivacyNotice', …)` currently sets it as plain text;
   replace that entry with a call to a small render function.
3. The full text still ends with "Dengan mencentang kotak di bawah, Anda menyetujui…", so consent
   stays informed. Don't change the full text.

**Acceptance.** Collapsed, the notice is at most 3 lines at 390 px. Expanded, it shows the full
original text in both languages. The `<summary>` is keyboard-operable.

---

## UX-12 (P2) — Consistent location; no hard-coded English

**Problem.** The header says "est. 2026 | Based in Bali" (hard-coded English in `index.html`,
`<span class="brand-est">`). The trust bar says "Dikirim dari Indonesia" (`tr1t`), FAQ #1 says
"dibuat dan dikirim dari Indonesia", the footer says "Bali, Indonesia", and pickup is at "studio
(Jimbaran)".

**Change.**
1. Add a key `brandEst`: ID `"est. 2026 · Bali"`, EN `"est. 2026 · Bali"`. Render it into
   `.brand-est` in the header render code (give the span an id), replacing the hard-coded text.
2. `tr1t`: ID `"Dikirim dari Bali"`, EN `"Ships from Bali"`. Keep `tr1d` as is ("Ke seluruh
   Indonesia…").
3. FAQ #1 answer (`faqs[0][1]`, ID and EN): "Semuanya dibuat di studio kami di Jimbaran, Bali, dan
   dikirim ke seluruh Indonesia dalam kotak pelindung." / "Everything is made in our studio in
   Jimbaran, Bali, and shipped across Indonesia in a protective box."
4. Staging-only strings: `index.html` `<button type="submit" class="lock-btn">Unlock →</button>` and
   `<button … id="btn-lock-site" … title="Lock the site again">Lock Site</button>`. Add keys
   (`lockUnlock`: ID `"Buka →"`; `lockSiteLabel`: ID `"Kunci situs"`, plus EN equivalents) and
   set them in the existing auth/render code. Low priority: the relock button already hides when
   `auth.enabled` is false.

**Report this one to the owner:** the copy now states the studio is in Jimbaran and ships from
Bali. That's consistent with the pickup copy, but the owner should confirm (see *Owner questions*).

---

## UX-13 (P2) — FAQ additions from known facts; drop "Baca FAQ"

**Change.**
1. Append these two entries to `faqs` in both languages. Every fact here already appears on the
   site; don't add anything beyond them.
   - ID `"Kapan saya membayar?"` → `"Tidak ada pembayaran saat Anda mengirim pesanan. Studio akan
     mengonfirmasi ketersediaan, ongkos kirim, dan total akhir lewat WhatsApp, lalu mengirimkan
     cara pembayarannya."` · EN `"When do I pay?"` → `"Nothing is charged when you submit an
     order. The studio confirms availability, delivery cost, and the final total on WhatsApp,
     then sends you how to pay."`
   - ID `"Bisa diambil sendiri?"` → `"Bisa. Di Bali, pilih \"Ambil sendiri di studio (Jimbaran)\"
     saat mengisi pesanan; alamat pengambilan dikirim lewat WhatsApp. Anda juga bisa memesan
     Grab/Gojek sendiri."` · EN `"Can I pick it up?"` → `"Yes. In Bali, choose \"Pick up at the
     studio (Jimbaran)\" when you order; we'll send the pickup address on WhatsApp. You can also
     book your own Grab/Gojek."`
   Check the EN pickup option label in `site-content.js` and quote it exactly.
2. Remove the "Baca FAQ" button: `index.html` `<a href="#faq" class="btn-secondary" id="kit-soon-secondary">`,
   the `setText('#kit-soon-secondary', …)` line, and the `kitSoonSecondary` keys.
3. **Do not add** FAQs about payment methods, couriers, shipping prices, or changes and
   cancellations. List them in the report as owner input needed.

---

## UX-14 (P3) — Grid alignment

**Change.**
1. **Mini-pot grid** (`.mini-pots-grid` and its `@media (min-width: 769px)` block with the UX-23
   comment): instead of 3 centred cards capped at 262 px, use the same 4-track grid as the other
   categories (`grid-template-columns: repeat(4, minmax(0, 1fr))` at ≥ 769 px), so the 3 cards
   align to the container's left edge at the same width as their neighbours. Remove
   `justify-items: center` and the `max-width: 262px` cap. Update the UX-23 comment.
   Leave the phone breakpoints alone.
2. **Kit teaser** (`.kit-teaser-band`): its `padding: 30px 0` removes the container's 24 px side
   padding, so its content starts 24 px left of every other section. Change it to
   `padding: 30px 24px`. Then check `.footer-bottom` (or whatever holds "© 2026 Alxanthia") for
   the same issue, and align it.
3. Optional (copy only): "Dibuat sesuai pesanan" is the only hero benefit title that wraps, which
   leaves a gap above the other two descriptions (the subgrid alignment is deliberate, UX-26).
   Shorten `ben3t` to ID `"Dibuat per pesanan"`, keep EN `"Made to order"`.

**Acceptance.** At 1440 px, the left edges of the stems grid, mini-pot grid, bouquet grid, kit
teaser text and footer content all sit at the same x.

---

## UX-15 (P3) — Minimum text and target sizes

Measured at 390 px. Raise each to at least 13 px:
`.nav-cta-mobile` (11 px), `.btn-primary` / `.btn-secondary` (12 px), `.flower-latin` in the
≤ 768 px block (12 px), `.btn-order-stem-price` in the ≤ 768 px block (`0.92em` ≈ 11.96 px).
`.order-picker-group-label` goes away with UX-02. Make `.message-card-option` at least 44 px tall
(it's 30 px today), e.g. `min-height: 44px; display: flex; align-items: center;`.
Check the header at 320 px still fits after enlarging `.nav-cta-mobile`; reduce its letter-spacing
before its font size if it doesn't.

---

## UX-16 (P3) — Navigation naming

1. `colTitle`: ID `"Pilih bunga Anda"`, EN `"Choose your flowers"` (the catalogue isn't "how to
   order").
2. Header "Pesan" (`#nav-order`, `#mobile-order-btn`): when `cart.length > 0`, set `href="#order"`
   and an `aria-label` from a new key `navOrderWithCount` (ID `"Pesan — {n} item di keranjang"`,
   EN `"Order — {n} item(s) in cart"`). When the cart is empty, restore `#collection-overview` and
   remove the `aria-label`. Update this wherever the cart re-renders (`renderOrderSection()` is
   called after every cart change).

---

## Owner questions — do not implement; list them in the report

1. **Payment.** Which methods (bank transfer, QRIS, Midtrans link) and when? This unlocks a fuller
   "Kapan saya membayar?" FAQ.
2. **Shipping outside Bali.** Couriers and a rough cost range?
3. **Changes and cancellation** after the studio confirms an order?
4. **Wrapped single stems.** Should customers choose a paper colour for "Dengan bungkus" stems
   too? Today they can't, and the server's `usesBouquetWrap` deliberately records colour only
   for bouquets. Saying yes needs a server, Sheet and Studio Desk change, not just the website.
5. **Location copy** (UX-12). Confirm "made in Jimbaran, Bali, ships across Indonesia".
6. **Hero benefits and trust bar** overlap. Merge them into one row? This is a design and copy call.

---

## Final verification

Run all of these and paste the results into the report:

1. `npm test`: all suites pass.
2. `npm run test:browser` (server on :8080): all assertions pass, including the new ones.
3. `npm run build`, then commit `dist/`.
4. A manual or Playwright pass at **390 × 844** and **1440 × 900**, with the preview curtain unlocked
   locally via `localStorage.setItem('alxanthia_unlocked','true')`:
   - first stem add: `scrollY` unchanged, focus on the button, "✓ Ditambahkan" shown (UX-01);
   - phone: only the sticky bar is visible, the pill's `display` is `none`; desktop: pill at
     bottom-right (UX-04);
   - empty cart: no product images in `#order`; page height at 390 px, before and after (UX-02);
   - mini-pot-only review: no wrap line (UX-03);
   - no clamped blurbs at 390 px (UX-07);
   - checkout reads "Langkah 1/2/3 dari 3" and "Kirim pesanan" (UX-08);
   - both languages: no leftover hard-coded English in ID mode, and no missing EN strings.
5. No console errors on load or during the flow.

## Completion report

| ID | Status | Commit | Evidence |
| --- | --- | --- | --- |
| UX-01 | Fixed | c7b4db7 | Playwright 390 and 1440: `scrollY` 1798 → 1798 and 1300 → 1300 after the first stem add; focus stays on the button, which reads "✓ Ditambahkan". Suites 13, 18, 21 and browser Tests 1 and 4 updated. A cart-limit refusal does not flash. |
| UX-04 | Fixed | 289cbe3 | 390: pill `display: none`, sticky bar visible. 1440: pill bottom gap 24 px, bottom-right. Sticky bar gets the same reduced-motion-aware bump. |
| UX-02 | Fixed | ca237c5 | Empty `#order` has 0 images and 3 `.order-empty-shortcut` buttons. The "Mini pot" filter was active when the Buket shortcut was clicked; `#bouquets` was displayed. Suite 21 rewritten. |
| UX-03 | Fixed | 6551ff7 | Browser Test 8: a mini-pot-only review shows no wrap line, and a review with a package does. `wrapId` and the payload are untouched; Suite 24 passes. |
| UX-05 | Fixed | 8875b29 | `singleNote` removed. Screenshot at 390 shows label over price with no mid-phrase wrap. |
| UX-06 | Fixed | a84f664 | Browser Test 9: every stem, mini-pot and package button has an `aria-describedby` that resolves to its card title. Titles are unique per card. |
| UX-07 | Fixed | 24152ea | 0 clamped blurbs at 390. 11 of 11 product photos show the zoom hint. The flower modal caption now starts with the description. |
| UX-09 | Fixed | eb29b37 | With a stem-only cart there is no "Termasuk" heading and no empty list. "Kosongkan keranjang" sits under the total. The empty price block and its dividers are hidden. |
| UX-10 | Fixed | 74e363c | Suite 9 asserts the notice box has `display: none` while Shopee is not live. Its text is still set. There is no "Shopee ready" case in the suite, so I added no opposite assertion. |
| UX-08 | Fixed | 6c8bc79 | Browser tests: "Langkah 1 dari 3 · Tinjau", "Langkah 2 dari 3 · Data", the form button reads "Kirim pesanan", and the review button has no icon. Step 3 uses the same format with "Kirim via WhatsApp"; I did not drive the browser to it. |
| UX-11 | Fixed | bcf4667 | Browser test: the notice is a summary plus `<details>` holding the full text, ending in "Dengan mencentang kotak di bawah…". Built with `createElement`/`textContent`. |
| UX-12 | Fixed | 7bc226c | Header, trust bar, FAQ #1 and lock-screen strings come from `site-content.js` in both languages. A check for "Based in Bali", "Unlock" and "Lock Site" in ID mode found none. |
| UX-13 | Fixed | 2ad54e6 | Two FAQs added in ID and EN, using the exact label "Self pickup at the studio (Jimbaran)". "Baca FAQ" button and `kitSoonSecondary` keys removed. |
| UX-14 | Fixed | dfb3239 | At 1440 the left edge is x = 154 for the stems grid, mini-pot grid, bouquet grid, kit teaser text and footer copyright. `ben3t` ID shortened to "Dibuat per pesanan". |
| UX-15 | Fixed | dabd0e8 | Computed font sizes at 390 are 13 px for the targeted items, and the message-card option is 44 px tall. At 320 the header does not overflow. |
| UX-16 | Fixed | 21b0ee5 | Browser Test 10: the header "Pesan" link goes to `#collection-overview` with no aria-label when the cart is empty. With items it goes to `#order` with an aria-label giving the count. `colTitle` renamed. |

Tests: `npm test` passes (32 + 10 + 3 + 3 + 11 + 50 suites). `npm run test:browser` ran 71 assertions with 0 failures.
Page height @390px empty cart: before 15,577 px (my own measurement of the same state at the base commit: 15,598 px) → after 13,469 px.
Final `dist/` rebuild: 1889656. Console errors on load and during the flow: none from the app. The only errors were blocked external requests in this sandbox (certificate and tunnel failures).
Owner questions outstanding: 1, 2, 3, 4, 5, 6.
Anything skipped or changed from this brief, and why:
- **Brief file location.** `WEBSITE-UX-FIXES.md` and `WEBSITE-UX-AUDIT.md` were not on this branch. I copied them in from `origin/claude/kind-allen-1dw9i2` (commit 5670471) and then worked from them.
- **UX-02 shortcut buttons.** They are created once by `renderOrderPicker()` into an empty `#order-empty-shortcuts` container instead of being static HTML. The test mock cannot parse `index.html`, and this keeps the count assertion exact. Handlers are bound once.
- **UX-05 photo badge.** The "Foto: N tangkai" badge was gated on `trans.singleNote`. I made it unconditional, so deleting the `singleNote` keys did not remove it.
- **UX-11 Indonesian summary.** It reads "disimpan **selama** {retention}", matching the existing notice's wording. The brief's text, "disimpan {retention}", does not read correctly in Indonesian once the retention phrase is filled in.
- **UX-12 owner confirmation.** The copy now says the studio is in Jimbaran and ships from Bali. This needs owner confirmation (question 5).
- **UX-12 lock-screen strings.** Their EN versions are only visible after the language switch runs. The static HTML is Indonesian.
- **UX-04 pill gap.** At 1440 it is 24 px, the lower edge of the 24–40 px range.
