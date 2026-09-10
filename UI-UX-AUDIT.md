# Alxanthia Studio — UI/UX Audit & Remediation Spec

**Audited:** 2026-09-10 · **Branch:** `claude/ui-ux-audit-upgaoq` · **Base:** `main@65d0179`
**Method:** live browser audit (Chromium via Playwright) at 320 / 375 / 390 / 768 / 1440 px, plus source review of
`index.html`, `app.js`, `styles.css`, `site-content.js`.
**Audience:** an AI coding agent implementing the fixes. Every finding names a file, a location, a reproduction, and an
acceptance test.

---

## 0. How to use this document

1. **Read §7 (Verified NOT defects) first.** A previous audit pass in this repo restated already-fixed items as open
   work. Several things that *look* broken here are correct by design and are listed there with the evidence. Do not
   "fix" them.
2. **Re-measure before you start any task.** Line numbers are from `main@65d0179` and drift with every edit. Use the
   grep anchors given in each task, not the line numbers.
3. **Tasks are independent unless a `Depends on:` line says otherwise.** The site must stay functional after each one.
4. **Run §8 (verification harness) before and after each task.** It is a copy-pasteable script.
5. **Do not change prices, phone numbers, social handles, marketplace URLs, or the passcode.** These are intentional
   owner-supplied placeholders (see `README.md` Owner-Input List). They are not defects and are out of scope.

### Severity key

| Level | Meaning |
| :--- | :--- |
| **P1** | Damages the core order flow, or blocks a keyboard/screen-reader user from completing a purchase. |
| **P2** | Confusing, inconsistent, or misleading. The user can still get through, but with friction or doubt. |
| **P3** | Polish. Visual inconsistency, copy drift, redundancy. |

**There are no P0 findings.** Ordering works. No data loss during a session, no security hole, no console errors, no
horizontal overflow at any tested width, and no WCAG AA contrast failure anywhere on the page.

---

## 1. Executive summary

This is a well-built zero-dependency static storefront. The things that are usually wrong on a site like this are right
here: contrast passes AA everywhere, tap targets are ≥44px, `prefers-reduced-motion` is honoured properly, the scroll
reveals are fail-safe, the "honest channel" pattern for the unconfigured Shopee link is correctly implemented in three
separate places, and the custom-builder stepper already restores keyboard focus after re-render.

The problems cluster in **one place: the order section (`#order`)**, and they share **one root cause** — the section was
built for a single-selection model and retrofitted into a multi-line cart, but its *states* were never revisited. Nine
of the ten P1/P2 findings are states the order section does not handle:

- the empty cart renders as a blank box with no message (**UX-01**)
- the cart evaporates on reload with no persistence (**UX-02**)
- the picker restates the entire catalogue with no group labels (**UX-03**)
- pressing "+" throws keyboard focus to `<body>` (**UX-04**) — while the *custom builder's* identical stepper
  handles this correctly 300 lines away
- "Ubah pilihan ↑" is live and points the wrong way when there is nothing to change (**UX-05**)

Fixing UX-01 through UX-05 addresses the substance of the audit. Everything below P1 is genuine but secondary.

The second theme is **disabled and zero states that don't look disabled or zero**: a disabled primary button rendered in
solid fill (**UX-08**), a disabled CTA that still says "continue →" (**UX-09**), a total showing "—" next to a line item
showing "Rp 35.000" (**UX-07**), and a "−" stepper that is live at zero (**UX-10**).

---

## 2. What was measured

| Check | Result |
| :--- | :--- |
| Horizontal overflow @ 320 / 375 / 768 / 1440 | **Pass** — `scrollWidth === clientWidth`, zero offending elements |
| WCAG AA contrast (computed, all text nodes) | **Pass** — 0 failures |
| Tap targets < 44×44 | 3 raw checkboxes, all wrapped in larger `<label>` hit areas — **pass in practice** |
| Console / page errors | **None** |
| `prefers-reduced-motion: reduce` | **Correctly handled** — opacity 1, no transform, `scroll-behavior: auto` |
| `scroll-margin-top` under sticky header | **Pass** — 20px clearance on every linked section |
| Keyboard focus indicators | **Present** on every control (2px ring); see UX-29 for a timing nit |
| Anchor smooth-scroll duration | ~750ms regardless of distance (browser-capped) — **not a problem** |
| `dist/` vs root sources | **In sync** — no stale deploy artifacts |
| Mobile page height @ 390px | **15,096px ≈ 18 viewport screens** (see UX-30) |

---

## 3. P1 — Damages the core order flow

### UX-01 · The empty cart renders as a blank box

**Where:** `index.html` → `<ul class="cart-lines" id="cart-lines">` · `app.js` → `function renderCartLines()`

**Reproduce:** Load the site, unlock, scroll to `#order` without selecting anything.

**Evidence:** `renderCartLines()` opens by emptying the list, then iterates `cart` — which is `[]`. Nothing is appended.
`#summary-price`, `#includes-label` and `#summary-shipping-note` are all correctly set to `display: none` for the empty
state, so what the user sees is: the label "Pilihan Anda", an active "Ubah pilihan ↑" button, and **two horizontal rules
with empty space between them**. Measured: `#cart-lines.innerHTML === ''`, `#summary-includes-list` has 0 children.

**Why it matters:** This is the single most important box on the page — the thing that tells a buyer what they are about
to purchase. In its default state it looks broken rather than empty. There is no instruction telling the user what to do
next.

**Fix:** In `renderCartLines()`, when `cart.length === 0`, append a single `<li class="cart-line-empty">` carrying an
empty-state message, and give it a style in `styles.css` (muted text, centred, generous padding — not a card).

Add the string to **both** language blocks in `site-content.js` `translations`:

```js
cartEmpty: "Belum ada produk dipilih. Pilih tangkai, mini pot, atau buket di bawah untuk memulai.",   // id
cartEmpty: "Nothing selected yet. Pick a stem, a mini pot, or a bouquet below to start.",             // en
```

Use `textContent`, not `innerHTML` — this file's convention for anything that renders user- or config-supplied text.

**Acceptance:**
- Empty cart → `#cart-lines` contains exactly one `<li>` with non-empty text, in the active language.
- Adding any product → the empty `<li>` is gone and only real cart lines remain.
- Removing the last product → the empty `<li>` returns.
- No layout shift larger than the height of that one `<li>`.

---

### UX-02 · The cart is lost on reload, while language and unlock both persist

**Where:** `app.js` → `let cart = []` (module scope) and `AUTH_KEY` / language persistence for contrast

**Reproduce:** Add three products → reload the page → the cart is empty. Language selection **does** survive. The unlock
**does** survive.

**Evidence:** Measured across a reload: `{ lang: "en", activeBtn: "lang-en", cartLines: 0, locked: false }`. The app
already uses `localStorage` for two other pieces of state; the cart is the one thing it does not save.

**Why it matters:** This is a mobile-first storefront with an 18-screen page and no server-side cart. A buyer selecting a
15-stem bouquet plus additions has invested real effort. Any tab restore, accidental back-navigation, or OS memory purge
on mobile Safari silently discards it — and because language *does* survive, the app looks like it remembers you while
having thrown away the only state you cared about.

**Fix:** Persist `cart`, `wrapKey`, `orderNote` and `customCounts` to `localStorage` under a versioned key
(`alxanthia_cart_v1`). Write on every mutation (`addLine`, `removeLine`, `bumpLineQty`, `selectWrap`,
`selectPackageVariety`, the card-note `input` handler, `bumpCustomCount`, `resetCustomCounts`). Read once in `init()`,
before `renderAll()`.

Guard the restore — a stale or hand-edited payload must never break the page:

- Wrap read and write in `try/catch` (the file already does this for `AUTH_KEY`; match that pattern).
- Validate every restored line against current `siteData`: drop lines whose `flowerKey` / `potKey` is unknown or whose
  `pkgIndex` is out of range, and clamp `qty` to a sane positive integer. Prices must be **recomputed** from
  `site-content.js`, never restored from storage — otherwise an owner's price edit would not reach a returning visitor.
- Re-seed `nextLineId` above the highest restored `id`.
- If nothing valid survives, fall back to an empty cart silently.

**Acceptance:**
- Add 2 stems + 1 package → reload → all three lines return with correct quantities and a correct total.
- Edit a price in `site-content.js` → reload with a stored cart → the **new** price is shown.
- Corrupt the stored value (`localStorage.setItem('alxanthia_cart_v1','{{{')`) → reload → empty cart, no console error.
- Remove the last line → reload → still empty.

---

### UX-03 · The order picker restates the whole catalogue, unlabelled

**Where:** `index.html` → `#order-picker-flowers` / `#order-picker-pots` / `#order-picker-packages` ·
`app.js` → `function renderOrderPicker()`

**Reproduce:** Load with an empty cart, scroll to `#order` at 390px width.

**Evidence:** Three sibling `<div class="order-picker-grid">` render 11 tiles (4 flowers, 3 pots, 4 packages) under a
**single** label, "Pilih produk". There are no headings between the groups. At 390px this is a 2-column grid roughly
1,000px tall — and every one of those 11 products already appeared, larger and better described, in `#collection`,
`#mini-pots` and `#bouquets` further up the same page. The mini-pot group has 3 items in a 2-column grid, so it leaves a
visible hole mid-list.

**Why it matters:** The buyer scrolls the entire catalogue, reaches the order section, and is shown the entire catalogue
again as thumbnails — with no labels to tell them that tiles 5–7 are mini pots and tiles 8–11 are bouquets. Two products
here are called "Mini Pot Bunga Matahari" and "Bunga Matahari" and sit four tiles apart with nothing distinguishing
their category.

**Fix — do the labels first; they are cheap and are most of the win:**

1. Add a group heading above each of the three grids, styled like the existing `.step-label` but one step quieter.
   Reuse the category names already in `translations` (`cat1Title` "Bunga jadi", `cat2Title` "Mini pot",
   `cat3Title` "Buket") rather than inventing new strings. Hide a group's heading when its grid is empty.
2. Change `#order-picker-label` from "Pilih produk" to something that states the situation, e.g.
   "Belum ada pilihan — pilih produk di sini" / "Nothing selected — pick a product here".
3. Make the mini-pot grid fill its row at 2 columns, or let all three grids share one column count so the hole closes.

**Then consider the structural fix** (larger change, worth proposing before building): replace the 11-tile restatement
with a short "jump back to the collection" control plus the empty-state message from UX-01. The catalogue is already on
the page; the order section's job is to confirm and finish, not to re-sell. If you take this route, keep the picker for
the `?` no-JS-scroll case and do not remove `renderOrderPicker()` outright.

**Acceptance:**
- Each visible picker grid is preceded by a heading naming its category, in the active language.
- Switching ID↔EN updates those headings.
- No group heading is rendered for an empty group.
- No row in any picker grid has a trailing gap at 390px.

---

### UX-04 · Changing a cart quantity throws keyboard focus to `<body>`

**Where:** `app.js` → `function renderCartLines()` and `function bumpLineQty(id, delta)`

**Reproduce:** Tab to the "+" button on a cart line → press Enter → `document.activeElement` is `<body>`.

**Evidence:** Measured — before Enter: `btn-stepper btn-line-inc`; after Enter: `BODY`. `bumpLineQty()` calls
`renderCartLines()`, which destroys and rebuilds every `<li>`, including the button that was just activated. Nothing
restores focus.

**Why it matters:** A keyboard or switch user cannot set a quantity of 3. Each press ejects them to the top of the
document, forcing a full re-tab through the header, nav, and every product card to press "+" again. `removeLine()`
already restores focus correctly, so the cart is inconsistent with itself.

**The fix already exists in this codebase.** `renderCustomBuilder()` solves exactly this problem — it captures the active
element's `data-flower` and `.btn-inc`/`.btn-dec` class *before* the rebuild, then re-focuses the matching button after.
Mirror that pattern in `renderCartLines()`, keyed on `data-line-id` instead of `data-flower`:

- Before the rebuild, read `document.activeElement`; record its line id and which control it was
  (`.btn-line-inc` / `.btn-line-dec`).
- After the rebuild, re-query and `.focus()` the matching button.
- If the line no longer exists (quantity hit 0 and it was removed), fall through to the existing `removeLine()` focus
  behaviour rather than focusing nothing.

**Acceptance:**
- Tab to "+", press Enter three times → quantity is 4 and focus is still on that line's "+".
- Same for "−" down to quantity 1.
- Pressing "−" at quantity 1 removes the line and moves focus per the existing `removeLine()` rule, not to `<body>`.
- Mouse users see no change in behaviour.

---

### UX-05 · "Ubah pilihan ↑" is live on an empty cart and points the wrong way on mobile

**Where:** `index.html` → `#btn-edit-selection` · `app.js` → `renderOrderSection()`

**Reproduce:** Load with an empty cart → the button reads "Ubah pilihan ↑" ("Change your selection"), is enabled, and
`display: flex`.

**Evidence:** Measured on an empty cart: `{ display: "flex", txt: "Ubah pilihan ↑", disabled: false }`. Clicking it
scrolls to `#collection`.

Two problems compound:
1. There is no selection to change, so the label is meaningless in the state where it is most prominent (it sits
   directly beside the blank box from UX-01).
2. The **↑** arrow is wrong on mobile. In the mobile stacking order the product picker sits *below* the summary box, so
   the control that says "up" is pointing away from the products.

**Fix:**
- Hide `#btn-edit-selection` entirely when `cart.length === 0` (the empty-state message from UX-01 carries the
  instruction instead). Set `style.display = 'none'`, consistent with how `#includes-label` and `#summary-price` are
  already handled a few lines above in the same function.
- Drop the hardcoded `↑` from the translation strings and render the arrow direction from layout, or simply remove the
  arrow. Do not ship a glyph that is correct at one breakpoint and wrong at the other.

**Acceptance:**
- Empty cart → the button is not rendered.
- Non-empty cart → the button is rendered and scrolls to the collection.
- No arrow in the label contradicts the scroll direction at 390px.

---

## 4. P2 — Confusing, inconsistent, or misleading

### UX-06 · Screen-reader announcements count cart *lines*, not items

**Where:** `app.js` → `addLine()` / `removeLine()` / `bumpLineQty()` · `site-content.js` → `announceLineAdded`,
`announceLineRemoved`, `announceQtyChanged`

**Evidence:** Add a sunflower, then add a second sunflower. Announced: *"Bunga Matahari ditambahkan. **1 item** di
keranjang."* — because `{n}` is bound to `cart.length` (number of lines), and both sunflowers merged into one line at
qty 2. A sighted user sees "2"; a screen-reader user is told "1 item".

**Fix:** Bind `{n}` to the summed quantity — `cart.reduce((s, l) => s + l.qty, 0)` — at all three call sites. Keep the
translation strings as they are; only the value changes.

**Acceptance:** Add the same stem twice → the second announcement says 2 items, in both languages.

---

### UX-07 · The custom estimate shows a "—" total beside a real Rp line item

**Where:** `app.js` → `renderCustomBuilder()`, near `setText('#est-total-val', ...)` and `setText('#est-wrap-val', ...)`

**Evidence:** With 0 stems selected: `est-wrap-val` = **"Rp 35.000"**, `est-total-val` = **"—"**. The wrap row is
labelled "Bungkus & pita (termasuk dalam total)" — "included in the total" — pointing at a total that does not exist.

**Fix:** When the estimate is not yet valid (`!tot.isValid`), zero or dash the *whole* list, not just the total. Either
set every row to "—" or hide the breakdown rows until the 3-stem minimum is met and show only the hint. Do not leave one
concrete number floating in an otherwise empty estimate.

**Acceptance:** At 0, 1 and 2 stems, no row in `#custom-est-list` shows a currency value while the total shows "—".
At 3 stems all rows and the total show currency.

---

### UX-08 · The disabled "add custom bouquet" button is rendered in solid fill

**Where:** `styles.css` → `.btn-use-custom:disabled`

**Evidence:** `background: var(--text-muted)` (`#6E6656`) with `color: var(--bg-main)` — a solid, saturated, full-width
dark button reading "TAMBAHKAN BUKET INI KE KERANJANG →". Measured computed style while `disabled === true`:
`bg: rgb(110,102,86)`, `color: rgb(250,246,238)`, `opacity: 1`. Only `cursor: not-allowed` distinguishes it — which does
not exist on touch.

**Why it matters:** On mobile this reads as the section's primary call to action. It is the most visually dominant
element in the custom builder and it does nothing when tapped.

**Fix:** Give `:disabled` a genuinely inert treatment consistent with the one already used for `.btn-channel.btn-disabled`
in the same stylesheet (`background: #EAE3D5; color: #8C8474`) — a flat, low-contrast fill that reads as unavailable.
Keep the text above 4.5:1 against the new background so the label stays readable; verify with the contrast script in §8.

**Acceptance:** Disabled and enabled states are distinguishable in a greyscale screenshot. Disabled label contrast ≥4.5:1.

---

### UX-09 · The disabled checkout button still says "continue →"

**Where:** `app.js` → `renderOrderSection()`, the `checkoutButton` block

**Evidence:** With an empty cart the button is correctly `disabled`, and `.channel-name` correctly switches to
"Pilih produk terlebih dahulu". But `.channel-action` is set unconditionally:

```js
if (action) action.textContent = currentLang === 'en' ? 'continue →' : 'lanjut →';
```

So the disabled state reads *"Choose a product first / continue →"* — an instruction and an invitation to proceed, in
one control. The two lines also invert the intended hierarchy: the serif `.channel-name` renders the *instruction* large
and the *action* small.

**Fix:** Clear or hide `.channel-action` when `!enabled`, in the same `if/else` that already switches `.channel-name`.

**Acceptance:** Empty cart → no "lanjut →"/"continue →" text anywhere on the disabled button. Non-empty → it returns.

---

### UX-10 · The custom builder's "−" is live at zero

**Where:** `app.js` → `renderCustomBuilder()`, the `.btn-dec` in the row template

**Evidence:** Measured `#custom-rows-list .btn-dec` at count 0 → `disabled: false`. Pressing it calls
`bumpCustomCount(key, -1)` and nothing happens.

**Fix:** Set `disabled` on `.btn-dec` when `count === 0`. Note this interacts with UX-04's sibling pattern: the focus
restore already in `renderCustomBuilder()` must not try to focus a now-disabled button — when the decrement that reaches
0 disables the button, move focus to the row's "+" instead.

**Acceptance:** At count 0 the "−" is `disabled` and skipped by Tab. At count 1, pressing "−" reaches 0, the button
disables, and focus lands on "+" rather than being lost.

---

### UX-11 · Three different verbs for one action

**Where:** `site-content.js` → `orderStemLabel`, `miniPotBtn`, `pkgBtn`, and the custom builder's button label

**Evidence:** Four controls that all do the same thing — append a line to the cart — are labelled:

| Control | Label (ID) |
| :--- | :--- |
| `.btn-order-stem` | **Pesan** tangkai ini |
| `.btn-add-mini-pot` | **Tambahkan** mini pot |
| `.btn-choose-bouquet` | **Pilih** buket ini |
| `.btn-use-custom` | **Tambahkan** buket ini ke keranjang |

"Pesan" (order), "Tambahkan" (add), and "Pilih" (choose) describe three different mental models. "Pesan" is the most
misleading: it suggests the click places an order, when it adds a line to a cart the user must still review.

**Fix:** Standardise on the add-to-cart verb — **"Tambahkan"** / **"Add"** — across all four, in both languages. Keep the
object noun so the labels stay distinguishable to a screen-reader user tabbing the grid ("Tambahkan tangkai ini",
"Tambahkan mini pot", "Tambahkan buket ini"). Reserve "Pesan" for the controls that genuinely advance the order: the
header CTA and the checkout button.

**Acceptance:** All four add-to-cart controls share one verb in each language. No add-to-cart control uses "Pesan".

---

### UX-12 · The custom builder's estimate scrolls out of view while you use it

**Where:** `styles.css` → `.custom-estimate-card` · `index.html` → the two-column `.custom-builder-body`

**Evidence:** At 1440px the estimate card ends at ~570px while the left column continues to ~950px — the additions
fieldset and the reset control sit well below the card's bottom edge, and the right column is left with ~380px of empty
space. The estimate is not sticky, so a user adding leaf additions or scrolling to the message-card checkbox has the live
price off-screen.

**Fix:** `position: sticky; top: 85px;` on `.custom-estimate-card` at ≥769px (85px matches the existing
`scroll-margin-top` used for the sticky header, so reuse that value). Leave the mobile stacking alone — sticky on a
single-column layout would cover content.

**Acceptance:** At 1440px, scrolling through the additions keeps the estimate total visible. At 390px nothing becomes
sticky and no content is overlapped.

---

### UX-13 · The checkout review always shows a zero discount, and drops the detail the user needs to verify

**Where:** `index.html` → `#checkout-discount-row` · `app.js` → `openCheckoutReview()`

**Evidence:** Reviewing a single Rp 55.000 stem shows a **"Potongan − Rp 0"** row. `#checkout-discount-row` has no
conditional hide, unlike `#est-discount-row` in the custom builder, which correctly carries `style="display: none"` and
is toggled.

The item list is also thinner than the cart it summarises: `• 1 × Bunga Matahari` — no thumbnail, no per-item price. The
cart lines above it have both. This is the last screen before a buyer commits to a WhatsApp conversation, and it shows
less than the screen before it.

**Fix:**
- Hide `#checkout-discount-row` when the discount is 0; mirror the toggle already used for `#est-discount-row`.
- Add the per-line price to each `#checkout-items` entry. A thumbnail is optional but the price is not.
- Fix the double-negative phrasing "Pesan kartu: Tidak ada pesan kartu" — omit the row entirely when there is no card
  message, the same way the wrap and gift rows are handled.

**Acceptance:** A no-discount order shows no discount row. A 9-stem custom bouquet still shows its 10% row. Every review
line shows a price. No row reads "Tidak ada ...".

---

### UX-14 · Form validation speaks English on an Indonesian form, one field at a time

**Where:** `index.html` → `<form id="checkout-form" novalidate>` · `app.js` → `submitWebsiteOrder()`

**Reproduce:** Open checkout → continue → submit the empty form.

**Evidence:** A native Chromium bubble appears reading **"Please fill out this field."** on a form whose every label is
Indonesian. Only one field is flagged at a time, the bubble overlaps and hides the field's own label, and it disappears
on the next interaction. The only persistent message is a single generic `#form-error`: "Mohon lengkapi semua kolom
wajib." — which does not say *which* fields.

The form is marked `novalidate` but the code calls `reportValidity()`, which re-enables exactly the native UI that
`novalidate` was there to suppress.

**Why it matters:** This form has 14 fields across four fieldsets, 8 of them required. A buyer who misses two fields is
told "complete the required fields" and shown one English bubble.

**Fix:** Validate in-app and render per-field messages:
- On submit, collect **all** invalid fields rather than stopping at the first.
- Render a message element per invalid field, associated via `aria-describedby`, and set `aria-invalid="true"`.
- Add the message strings to both language blocks in `site-content.js` — required, invalid phone, invalid email.
- Keep `#form-error` as a summary ("3 kolom perlu dilengkapi") and move focus to the first invalid field, which the code
  already does correctly.
- Drop the `reportValidity()` call once in-app messages render, so no English bubble can appear.

**Acceptance:** Submitting the empty form shows an Indonesian message beside every required field (English in EN mode),
no native bubble appears, and `#form-error` names the count. Filling one field clears only its message.

---

### UX-15 · The gift-card note is unbounded and flows into a URL

**Where:** `index.html` → `#card-note-input` · `app.js` → `updateWhatsAppLink()` and `renderSummaryIncludes()`

**Evidence:** Measured — pasting 1,200 characters is accepted (`maxlength: null`, no counter) and renders verbatim into a
single 1,217-character `<li>` in the order summary. That text is also interpolated into the `wa.me` deep link.

**Why it matters:** Two consequences. Visually, one cart-summary line can grow taller than the entire summary box.
Functionally, `wa.me` URLs are length-limited in practice; a long note risks a truncated or rejected deep link at the
exact moment the order is handed off — the least recoverable point in the flow. The field is a *handwritten* card
message, so a limit is honest, not arbitrary.

**Fix:** Set `maxlength="200"` on the textarea (a realistic handwritten-card length) and add a live
`<span aria-live="polite">` character counter beneath it, using the existing `.card-note-hint` slot. Clamp again in JS
before building the WhatsApp URL so a paste that bypasses the attribute cannot reach the link.

**Acceptance:** The field stops at 200 characters, the counter updates as you type and is announced, and the summary line
never exceeds one or two wrapped lines.

---

### UX-16 · The sticky order bar occupies the mobile viewport with an empty cart

**Where:** `app.js` → `initStickyOrderBar()` / `updateSticky()`

**Evidence:** Measured at 390px, empty cart, scrolled mid-page:
`{ ariaHidden: "false", visibleClass: true, title: "Alxanthia Studio", price: "Pilih bunga" }`. Visible in the captured
`#howto` screenshot as a bar reading *"Alxanthia Studio / Pilih bunga"* with a "LIHAT BUNGANYA ↓" button.

`updateSticky()` decides visibility purely from whether the hero, order section, or footer is on screen. It never
consults `cart.length`. Together with the 65px sticky header, roughly 15% of an 844px mobile viewport is permanently
chrome — and in the empty-cart case the bottom bar's only content is the brand name and a prompt.

**Fix:** Add `cart.length > 0` to the visibility condition in `updateSticky()`. Keep the existing `focusInside` escape
hatch so the bar cannot vanish out from under a keyboard user mid-interaction.

**Acceptance:** Empty cart → the bar never appears at any scroll position. One item → it appears outside the hero, order
and footer regions, as today. Focus inside the bar keeps it visible regardless.

---

### UX-17 · Identical-looking labels are sometimes headings and sometimes paragraphs

**Where:** `index.html`, all `class="step-label"` elements

**Evidence:** `.step-label` is applied to eight elements across the order and custom-builder sections. One of them is a
heading; the rest are not:

| Element | Tag |
| :--- | :--- |
| `#finish-label` "Sentuhan akhir" | **`<h3>`** |
| `#custom-additions-label` "Pilih tambahan" | `<legend>` |
| `#selection-label` "Pilihan Anda" | `<p>` |
| `#card-label` "Kartu ucapan" | `<p>` |
| `#includes-label` "Termasuk" | `<p>` |
| `#step3-label` "Lanjut ke pemesanan" | `<p>` |
| `#order-picker-label`, `#custom-pick-label`, `#custom-est-label` | `<p>` |

They are visually indistinguishable. A screen-reader user navigating by heading finds one landmark inside the entire
order flow — "Sentuhan akhir" — and none for "Pilihan Anda", "Termasuk", or "Lanjut ke pemesanan", which are the three
steps that actually matter.

**Fix:** Promote the labels that head a real region to `<h3>`: `#selection-label`, `#card-label`, `#includes-label`,
`#step3-label`, `#order-picker-label`. Keep `.step-label` as the shared visual class — no CSS change needed beyond
ensuring the heading tags inherit it cleanly (`h3.step-label` may need `margin` and `font-size` normalised to match `p`).
Leave `#custom-additions-label` as a `<legend>` — it is already correct inside its `<fieldset>`.

**Acceptance:** The order section exposes a heading for each of its steps. Heading levels remain in order (no h2→h4
jumps). No visual change at any breakpoint.

---

### UX-18 · The mobile nav menu does not trap focus

**Where:** `app.js` → `openNavMenu()` / `closeNavMenu()` in `setupEventListeners()`

**Evidence:** Measured Tab sequence with the menu open at 390px:
`nav-collection → nav-bouquets → nav-how → nav-faq → lang-id → lang-en → ` **`cta-browse`** ` → ` **`cat-tab-all`** ...

After the last menu item, focus leaves the menu and lands on hero and category controls that are behind the scrim and
visually obscured. The menu sets `body { overflow: hidden }` and renders a scrim, and `Escape` correctly closes it — the
focus containment is the missing piece.

**Fix:** Trap Tab within `#nav-menu` while it is open: capture `keydown`, and on `Tab` from the last focusable element
wrap to the first (and `Shift+Tab` from the first to the last). On close, return focus to `#nav-toggle` — verify this,
since the toggle already retains focus on open. Alternatively set `inert` on `<main>` and `<footer>` while the menu is
open, which achieves the same thing declaratively; check browser support against the project's targets first.

**Acceptance:** With the menu open, Tab cycles only through menu items and the toggle. `Escape` closes and returns focus
to `#nav-toggle`. Mouse behaviour unchanged.

---

### UX-19 · The lock screen declares `aria-modal` but leaves the page reachable

**Where:** `index.html` → `#lock-screen` · `app.js` → `setupAuth()` / `updateLockA11y()`

**Evidence:** Measured while locked: `role="dialog"`, `aria-modal="true"`, and **68 focusable elements still reachable
behind it**. Tabbing from the passcode field goes: `lock-btn → body#top → skip-link → passcode-input`. `document.body`
computes to `overflow: clip visible`, so the page behind still scrolls.

To be clear about scope: this is a client-side staging curtain, not a security boundary, and it is not treated as one
here. The finding is that `aria-modal="true"` tells assistive technology the rest of the page is inert when it is not —
a screen-reader user is told they are in a modal and then walks straight out of it into content the curtain exists to
hide.

**Fix:** While locked, set `inert` (or `aria-hidden="true"` plus `tabindex="-1"` management) on `<header>`, `<main>`,
`<footer>` and the sticky bar, and remove it on unlock. `updateLockA11y()` is already the right home for this. Also set
`overflow: hidden` on `body` while locked, matching how the mobile nav already does it.

**Acceptance:** While locked, Tab cycles only between the passcode input and the unlock button. After unlocking, all 68
controls are reachable again and the skip link works.

---

## 5. P3 — Polish

### UX-20 · Product card rows misalign when the spec line wraps

**Where:** `styles.css` → `.flower-meta-block`, `.flower-spec-line`, `.flower-price-line`

**Evidence:** Measured `top` offsets at 1440px across the four flower cards:

| Card | spec line | price line | info box | button |
| :--- | ---: | ---: | ---: | ---: |
| Bunga Matahari | 2121 | 2146 | 2176 | 2258 |
| Mawar | 2101 | 2146 | 2176 | 2258 |
| Tulip | 2121 | 2146 | 2176 | 2258 |
| **Gerbera** | 2120 | **2165** | **2194** | 2258 |

The buttons are correctly bottom-aligned. But Gerbera's spec — "TANGKAI 40 CM · KORAL, DUA NADA" — wraps to two lines,
pushing its price 19px and its info box 18px below the other three. In a four-across row the price is the value the eye
scans horizontally, and it is the one row that breaks.

**Fix:** Give `.flower-spec-line` a `min-height` equal to two lines (`calc(2 * <line-height>)`) so every card reserves the
same space whether or not it wraps. Apply only at the breakpoints where the cards are side by side; at 390px they are
stacked and the reservation is wasted vertical space.

**Acceptance:** At 1440px and 768px, all four cards' price lines share one `top`. At 390px no extra whitespace appears.

---

### UX-21 · Price is the quietest element in the product card

**Where:** `styles.css` → `.flower-price-line` vs `.flower-spec-line`

**Evidence:** The spec line above the price is uppercase with wide letter-spacing in an accent colour, making it the
loudest element in the lower card. The price sits below it in plain bold at `--fs-button` (14px). On a storefront card
the price should be the strongest element after the product name.

**Fix:** Raise `.flower-price-line` to at least `--fs-body` (16px), and quiet `.flower-spec-line` — drop it to
`--fs-label` and reduce the letter-spacing. Apply the same relationship to `.bouquet-card` and `.mini-pot-card`, which
share the pattern.

**Acceptance:** In a squint test of a card, the price reads before the spec line. Contrast still passes (§8).

---

### UX-22 · The photo-count badge says the same thing twice

**Where:** `app.js` → `renderCollection()`, `photoBadgeHtml` and `singleNoteHtml`

**Evidence:** The sunflower card carries a "FOTO: 3 TANGKAI" badge over the image *and*, 300px below, an info box reading
"Harga per 1 tangkai jadi · Foto menampilkan 3 tangkai yang ditata bersama". Same fact, twice, on every one of the four
cards.

**Fix:** Keep the badge on the photo — it sits where the confusion happens. Reduce the info box to the part the badge
does not carry ("Harga per 1 tangkai jadi") or remove it. Do not remove the badge; it is the one that prevents a buyer
thinking Rp 55.000 buys three stems.

**Acceptance:** The stem-count fact appears once per card. The per-stem pricing fact still appears.

---

### UX-23 · The mini-pot section breaks the grid rhythm and carries an empty badge

**Where:** `styles.css` → `.mini-pots-grid` · `app.js` → `renderMiniPots()`

**Evidence:** `#collection` and `#bouquets` are 4-across at 1440px; `#mini-pots`, sandwiched between them, is 3-across.
The cards and their photos are visibly wider than the neighbours above and below. Mini-pot cards also drop the accent top
rule and the latin name that the flower cards use, so the section reads as a different design system.

All three mini-pot cards carry the identical badge "100% KERAJINAN CHENILLE" — which is true of every product on the
site, including the ones without the badge. It differentiates nothing.

**Fix:** Either run the mini-pot grid at 4 columns to match its neighbours, or accept 3 and cap `.mini-pot-card`'s width
so the photos match the flower cards' size. Replace the badge with something that varies per product (pot size, height)
or remove it.

**Acceptance:** Photo widths across `#collection`, `#mini-pots` and `#bouquets` are within ~10% at 1440px. No badge text
is identical across all cards in a section.

---

### UX-24 · "Three ways to order" sits above five tabs

**Where:** `site-content.js` → `colTitle` / `colIntro` · `index.html` → `#category-nav`

**Evidence:** `colTitle: "Tiga cara memesan"` / `"Three ways to order"`, with `colIntro` naming three things (stem, mini
pot, bouquet). Directly beneath sits a five-tab filter: Semua, Bunga Jadi, Mini Pot, Paket Buket, Buket Custom. At 390px
those five wrap into a ragged 2-2-1 grid, so the last tab sits alone on its own row.

The copy predates the mini-pot launch (`65d0179 feat: add mini pots`) and was not revisited — there are now four buyable
categories, not three.

**Fix:** Update `colTitle` in both languages to match reality ("Empat cara memesan" / "Four ways to order"), or drop the
number ("Cara memesan" / "Ways to order") so the heading stops needing maintenance every time a category is added.
Prefer the second. Separately, make the tab row a horizontal scroller at ≤480px — the markup already has the
`.category-tabs-inner` wrapper the pattern needs — so it reads as one strip rather than a ragged block.

**Acceptance:** The heading does not state a count that contradicts the tab bar. At 390px the tabs form one row.

---

### UX-25 · The hero subheading ends in an unpunctuated fragment

**Where:** `site-content.js` → `heroSub` (both language blocks)

**Evidence:** Rendered: *"...atau susun campuran Anda sendiri. **Based in Bali, Indonesia**"* — an English fragment
appended to Indonesian body copy, with no closing punctuation, in the site's most-read sentence. The same string is
already shown in the header as `brand-est` ("est. 2026 | Based in Bali").

**Fix:** Remove the appended fragment from `heroSub` in both languages. The location is already communicated by the
header and the footer.

**Acceptance:** `#hero-sub` ends with a full stop in both languages and contains no English text in ID mode.

---

### UX-26 · Hero benefit descriptions sit on three different baselines

**Where:** `styles.css` → `.hero-benefits`, `.benefit-item`

**Evidence:** Measured `dd` top offsets at 1440px: **818, 818, 851**. The third `dt`, "Dibuat sesuai pesanan", wraps to
two lines and pushes its description 33px below the other two.

**Fix:** Make `.hero-benefits` a grid with `grid-template-rows: auto auto` and `.benefit-item` a subgrid spanning both
rows, so all `dt`s share one row and all `dd`s share the next. Where subgrid is not acceptable, a `min-height` on `dt`
sized to two lines achieves the same at these three fixed strings.

**Acceptance:** All three `dd` elements share one `top` at 1440px and 768px.

---

### UX-27 · The photo zoom button announces only the flower's name

**Where:** `app.js` → `renderCollection()`, the `.flower-photo-wrapper` template

**Evidence:** `<div class="flower-photo-wrapper" role="button" tabindex="0" aria-label="${trans.name}">`. A screen-reader
user hears *"Bunga Matahari, button"*, immediately followed by the `<h4>` "Bunga Matahari" and then
*"Pesan tangkai ini, button"*. Nothing conveys that the first button opens a larger photo. The `title` attribute does say
"Klik untuk memperbesar foto", but `aria-label` overrides `title` for the accessible name, so that text is never
announced.

**Fix:** Build the `aria-label` from the existing zoom string plus the flower name — "Perbesar foto Bunga Matahari" /
"Enlarge photo of Sunflower". Add the prefix to both language blocks in `site-content.js` rather than hardcoding it, and
reuse it for the mini-pot and bouquet photo triggers if they share the pattern.

**Acceptance:** Each photo trigger announces the action and the product. Switching language updates the label.

---

### UX-28 · Shopee's "coming soon" is stated twice, adjacently

**Where:** `index.html` → `#btn-shopee` and `#marketplace-status-box`

**Evidence:** In the order section the disabled Shopee channel button reads "Shopee / Toko Resmi · Segera hadir /
SEGERA HADIR", and immediately below it a status box repeats "Shopee — SEGERA HADIR — Listing Shopee sedang disiapkan...".
Two adjacent blocks, three instances of the same badge, one fact.

Note the underlying link handling is correct and should not be touched — see §7.

**Fix:** Keep one. The status box carries the useful sentence (custom bouquets are served via WhatsApp), so prefer
collapsing the disabled button into it rather than the reverse. When `shopeeUrl` is populated the button becomes a real
CTA and should reappear — so gate the merge on `isShopeeReady()`, do not delete the button.

**Acceptance:** With `shopeeUrl: ""`, "segera hadir" appears once in `#order`. With a real URL, the Shopee button renders
as an active link exactly as it does today.

---

### UX-29 · The focus ring fades in instead of appearing

**Where:** `styles.css` → the `transition` declarations on `.category-tab`, `.btn-choose-bouquet`, `.btn-add-mini-pot`

**Evidence:** These controls transition `outline` (or `all`), so on Tab the ring animates 0 → 2px over the transition
duration. Measured immediately after `Tab`: `outline-width: 0px` while `:focus-visible` already matches; measured 600ms
later: `outline-width: 2px`. The ring is correct — it just arrives late.

For a fast keyboard user tabbing through the four bouquet cards, the indicator is mid-fade at each stop.

**Fix:** Exclude `outline` from those transitions — list the animated properties explicitly (`background-color`,
`border-color`, `transform`) instead of `all`, and never transition `outline` or `outline-width`.

**Acceptance:** `outline-width` is 2px in the same frame `:focus-visible` starts matching.

---

### UX-30 · The page is 18 mobile screens long, with the order section in the middle

**Where:** structural — `index.html` section order

**Evidence:** Measured `document.body.scrollHeight` at 390px = **15,096px**, ≈18 viewport heights. Section heights at
390px: `#bouquets` 2,721px, `#order` 2,725px, `#howto` 2,212px, `#collection` 1,476px, `#mini-pots` 1,124px.

`#order` sits at roughly the halfway point, followed by ~6,000px of supporting content (how-it's-made, materials, FAQ,
DIY-kit teaser) that a buyer who has already decided must scroll past — or, more likely, never sees, because the order
section came first.

This is not a defect on its own; a long single-page storefront is a legitimate choice, and the sticky bar and nav both
mitigate it. It is listed because it is the constraint that makes UX-03 (the picker restating the catalogue) and UX-02
(losing the cart) hurt as much as they do.

**Fix (proposal — confirm before building):** `#howto` and `#material` are trust-building content that belongs *before*
the decision, not after it. Consider moving `#order` below `#faq`, so the page reads: hero → catalogue → how it's made →
materials → FAQ → order. Alternatively collapse `#howto`'s four full-bleed steps into a more compact layout at ≤480px,
which alone would remove ~1,000px.

**Acceptance:** If reordered, every in-page anchor (`#order` from the nav, footer, and sticky bar) still resolves with
correct `scroll-margin-top` clearance, and the sticky bar's `IntersectionObserver` targets still work.

---

### UX-31 · The "Lock Site" button is visible during the staging review

**Where:** `index.html` → `#btn-lock-site` · `app.js` → `setupAuth()`

**Evidence:** A "Lock Site" button sits in the footer beside the copyright. It clears the auth key and re-raises the
passcode curtain, with no confirmation.

`setupAuth()` **correctly hides it** when `auth.enabled === false`, so it disappears at public launch. The finding is
scoped to the current state: `auth.enabled` is `true`, so during owner and client review the button is live for everyone,
and a stray click locks the viewer out mid-demo.

**Fix:** Low priority, and optional. If you address it, add a confirmation step rather than changing the visibility
logic — the existing `auth.enabled` gate is correct and should not be touched.

**Acceptance:** With `auth.enabled: false`, the button is still absent (unchanged behaviour).

---

## 6. Suggested order of work

Each phase leaves the site fully functional.

| Phase | Tasks | Why this grouping |
| :--- | :--- | :--- |
| **1** | UX-01, UX-05, UX-09, UX-16 | All four are order-section state bugs in `renderOrderSection()` / `renderCartLines()` / `updateSticky()`. One pass over one file, and it fixes the empty-cart experience end to end. |
| **2** | UX-04, UX-10, UX-06 | Cart and stepper accessibility. UX-04 and UX-10 interact (see UX-10's note); do them together. |
| **3** | UX-02 | Cart persistence. Self-contained but touches every mutation site — do it after phase 2 so you are not re-editing the same functions. |
| **4** | UX-03, UX-11, UX-17 | Order-section information architecture, labels, and semantics. UX-03's labels reuse strings that UX-11 may rename — do UX-11 first within this phase. |
| **5** | UX-07, UX-08, UX-12, UX-13 | Custom builder and checkout review states. |
| **6** | UX-14, UX-15 | Checkout form validation and input bounds. Largest single task in the list; isolate it. |
| **7** | UX-18, UX-19 | Focus containment for the nav and the lock curtain. Same technique (`inert`) in both. |
| **8** | All P3 | Polish. UX-25 and UX-24 are one-line copy edits — cheap, do them any time. |

---

## 7. Verified NOT defects — do not "fix" these

Each of these was measured and found correct. They are listed with evidence so a later pass does not spend effort on
them, and to correct plausible-looking assumptions.

| # | Thing that looks wrong | What was actually measured |
| :--- | :--- | :--- |
| 1 | Contrast on the cream/ochre palette | **0 failures.** Every text node checked against its computed backdrop at its own size and weight. Passes AA throughout, including the dark sections. |
| 2 | Tap targets | Only 3 elements under 44×44 — raw `<input type="checkbox">` in the custom builder — and every one is wrapped in a `<label>` that provides a full-size hit area. |
| 3 | Horizontal overflow on mobile | None at 320, 375, 768 or 1440. `scrollWidth === clientWidth` at every width; zero elements extend past the viewport. |
| 4 | Sticky header covering anchored sections | **Works.** `scroll-margin-top: 85px` yields 20px clearance below the 65px header on every linked section. Element screenshots appear to show overlap only because `scrollIntoViewIfNeeded()` ignores `scroll-margin` — that is a tooling artifact, not the site's behaviour. |
| 5 | Missing focus rings on tabs and bouquet buttons | **Present.** `:focus-visible` matches and resolves to a 2px ring on every control. An initial reading of `outline-width: 0px` is the CSS transition mid-flight — see UX-29, which is about the timing only. |
| 6 | `#summary-price` keeps a stale "Rp 195.000" after the cart empties | The `textContent` is stale, but `renderOrderSection()` sets `display: none` on the element for the empty state. **Not user-visible.** The real empty-state problem is UX-01. |
| 7 | Shopee / WhatsApp links pointing nowhere | **Correctly implemented.** When `shopeeUrl` is empty, all three call sites (`#btn-shopee`, `#footer-link-shopee`, the status box) `removeAttribute('href')` and set `aria-disabled` rather than leaving a dead link. `isShopeeReady()` also rejects the placeholder `https://shopee.co.id`. Leave this pattern alone. |
| 8 | Scroll-reveal animations hiding content | **Fail-safe.** `opacity: 0` comes from a `.reveal-item` class that JS adds; if JS never runs, content stays visible. Also correctly skipped under `prefers-reduced-motion`, when `IntersectionObserver` is absent, on `focusin`, and for the current hash target. |
| 9 | `prefers-reduced-motion` support | **Correct.** Measured under `reducedMotion: 'reduce'`: `opacity: 1`, `transform: none`, `scroll-behavior: auto`, no reveal class applied. |
| 10 | Category filter tabs | **Work correctly.** Each tab shows exactly its own category; `custom` correctly shows the builder and hides the packages grid; `all` restores everything. |
| 11 | Long smooth-scroll jumps feeling slow | ~750ms regardless of distance — the browser caps it. Not a problem. |
| 12 | `dist/` holding a stale build | `index.html`, `app.js`, `styles.css` and `site-content.js` are **byte-identical** to the root sources. |
| 13 | Hero eyebrow missing on mobile | **Present** at 390px (wraps to two lines, 39px tall). An earlier element-screenshot crop suggested otherwise. |
| 14 | Prices, phone number, Instagram handle, passcode | Intentional owner-supplied placeholders per `README.md`. Out of scope by instruction. |
| 15 | `<details>`/`<summary>` FAQ accordion | Correct native semantics with an `<h3>` inside each `<summary>`. Keyboard and screen-reader behaviour come free. |
| 16 | Alt text | Good throughout. Decorative picker thumbnails correctly carry `alt=""`; content images carry descriptive Indonesian text. |
| 17 | Package variety chooser | A correct `role="radiogroup"` with `aria-checked` — matching the wrap-colour chips pattern. |
| 18 | Wrong-passcode handling | Correct: error announced via `aria-live`, field cleared, focus returned to the input. |

---

## 8. Verification harness

Run before and after every task. Requires the repo's own `@playwright/test` and the preinstalled Chromium.

```bash
# terminal 1
npm start                       # python -m http.server 8080

# terminal 2
node verify-ui.js
```

`verify-ui.js`:

```js
const { chromium } = require('./node_modules/@playwright/test');
const EXEC = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';  // or omit if `npx playwright install` was run
const PASS = '22062024';                                            // site-content.js → auth.passcode

(async () => {
  const browser = await chromium.launch({ executablePath: EXEC });
  let failures = 0;
  const check = (name, ok, detail) => {
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : '  → ' + JSON.stringify(detail)}`);
    if (!ok) failures++;
  };

  for (const vp of [{ width: 320, height: 700 }, { width: 390, height: 844 },
                    { width: 768, height: 1024 }, { width: 1440, height: 900 }]) {
    const ctx = await browser.newContext({ viewport: vp });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => m.type() === 'error' && !/ERR_CONNECTION|net::/.test(m.text()) && errors.push(m.text()));

    await page.goto('http://localhost:8080/index.html', { waitUntil: 'domcontentloaded' });
    await page.fill('#passcode-input', PASS);
    await page.click('.lock-btn');
    await page.waitForTimeout(900);

    // no horizontal overflow
    const of = await page.evaluate(() => ({ s: document.documentElement.scrollWidth,
                                            c: document.documentElement.clientWidth }));
    check(`${vp.width}px no h-overflow`, of.s <= of.c + 1, of);

    // contrast AA on every text node
    const bad = await page.evaluate(() => {
      const lum = c => { const [r,g,b] = c.map(v => { v/=255; return v<=0.03928 ? v/12.92 : ((v+0.055)/1.055)**2.4; });
                         return 0.2126*r + 0.7152*g + 0.0722*b; };
      const parse = s => (s.match(/[\d.]+/g) || []).slice(0,3).map(Number);
      const bgOf = el => { let n = el;
        while (n && n !== document.documentElement) { const c = getComputedStyle(n).backgroundColor;
          const a = c.match(/[\d.]+/g);
          if (a && (a[3] === undefined || +a[3] > 0.5)) return parse(c);
          n = n.parentElement; }
        return [250,246,238]; };
      const out = [];
      document.querySelectorAll('body *').forEach(el => {
        if (el.closest('#lock-screen')) return;
        if (![...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) return;
        const cs = getComputedStyle(el);
        if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') return;
        const fg = parse(cs.color), bg = bgOf(el);
        if (!fg.length) return;
        const L1 = lum(fg), L2 = lum(bg);
        const ratio = (Math.max(L1,L2) + 0.05) / (Math.min(L1,L2) + 0.05);
        const size = parseFloat(cs.fontSize), bold = parseInt(cs.fontWeight) >= 700;
        const need = (size >= 24 || (size >= 18.66 && bold)) ? 3 : 4.5;
        if (ratio < need) out.push({ txt: el.textContent.trim().slice(0,30), ratio: +ratio.toFixed(2), need });
      });
      return out;
    });
    check(`${vp.width}px contrast AA`, bad.length === 0, bad.slice(0,5));
    check(`${vp.width}px no JS errors`, errors.length === 0, errors.slice(0,3));
    await ctx.close();
  }

  // --- order-flow regressions (390px) ---
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await page.goto('http://localhost:8080/index.html', { waitUntil: 'domcontentloaded' });
  await page.fill('#passcode-input', PASS);
  await page.click('.lock-btn');
  await page.waitForTimeout(900);

  // UX-01 empty cart has a message
  check('UX-01 empty cart message',
    await page.evaluate(() => document.querySelector('#cart-lines').textContent.trim().length > 0));

  // UX-05 edit-selection hidden when empty
  check('UX-05 edit btn hidden when empty',
    await page.evaluate(() => getComputedStyle(document.querySelector('#btn-edit-selection')).display === 'none'));

  // UX-09 disabled CTA has no "continue"
  check('UX-09 no action text when disabled',
    await page.evaluate(() => !/lanjut|continue/i.test(
      document.querySelector('#btn-checkout .channel-action').textContent)));

  // UX-16 sticky bar hidden with empty cart
  await page.evaluate(() => window.scrollTo(0, 3000));
  await page.waitForTimeout(800);
  check('UX-16 sticky hidden when cart empty',
    await page.evaluate(() => document.querySelector('#sticky-order-bar').getAttribute('aria-hidden') === 'true'));

  // UX-04 focus survives quantity change
  await page.click('#collection-grid .btn-order-stem');
  await page.waitForTimeout(500);
  await page.focus('#cart-lines .btn-line-inc');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(400);
  check('UX-04 focus retained on +',
    await page.evaluate(() => document.activeElement.classList.contains('btn-line-inc')));

  // UX-06 announcement counts units
  await page.click('#collection-grid .btn-order-stem');
  await page.waitForTimeout(400);
  check('UX-06 announces unit count',
    await page.evaluate(() => /\b3\b/.test(document.querySelector('#order-announcer').textContent)),
    await page.evaluate(() => document.querySelector('#order-announcer').textContent));

  // UX-02 cart survives reload
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);
  check('UX-02 cart persists',
    await page.evaluate(() => document.querySelectorAll('#cart-lines .cart-line').length > 0));

  await browser.close();
  console.log(`\n${failures} failing check(s)`);
  process.exit(failures ? 1 : 0);
})();
```

The checks for tasks not yet implemented will fail until you do them — that is the point. `npm test`
(`tests/verify-ordering.js`) must also continue to pass after every task; it loads the real `app.js` and
`site-content.js` in a `vm` sandbox and is not a mock.

---

## 9. Scope notes

- **Not reported as defects:** prices, WhatsApp number, Instagram handle, Shopee URL, passcode, order-submission
  endpoint, and the `noindex` robots directive. All are intentional pre-launch configuration per `README.md`.
- **Fonts:** the audit ran with Google Fonts unreachable, so screenshots render in fallback faces. Nothing in this
  document depends on the webfont metrics. `display=swap` is already set. If you want to eliminate the fallback→webfont
  reflow, `size-adjust` on a local fallback `@font-face` is the tool, but it was not measured here and is not a finding.
- **Not audited:** the `orderSubmissionUrl` Cloudflare Worker (server-side, outside this repo), analytics, and email
  deliverability.
