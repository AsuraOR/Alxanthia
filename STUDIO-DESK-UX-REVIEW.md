# Studio Desk — UI/UX and workflow review

**Status:** open. Written for a coding agent (Sonnet, high effort) to implement.
**Reviewed at commit:** `e610982`.
**Files under review:** [`studio-desk/Index.html`](studio-desk/Index.html) (the whole Desk page) and
[`studio-desk/Code.gs`](studio-desk/Code.gs) (server), plus
[`STUDIO-DESK-PANDUAN.md`](STUDIO-DESK-PANDUAN.md) wherever behaviour described there changes.

This is a **usability** review, not a security or architecture one. The architecture is sound and the
earlier defect list in [`STUDIO-DESK-FIXES.md`](STUDIO-DESK-FIXES.md) has been closed. What follows is
what a first-time, non-technical user — the person who actually makes the flowers, on a phone, with
one hand, in a workshop — runs into.

The guiding question for every finding below: *can she work the whole order through the Desk without
ever needing to open the spreadsheet or ask someone what a word means?* Today the answer is no, in
five places.

---

## How to work on this

The Desk's source lives in real files now (`studio-desk/Code.gs`, `studio-desk/Index.html`) — the old
"edit the markdown" workflow in `STUDIO-DESK-FIXES.md` no longer applies. `tests/verify-studio-desk.js`
reads those two files directly.

**Locate each site by the quoted anchor string, not by line number** — line numbers drift as you apply
fixes.

### Ground rules — unchanged, do not break these

These carry over verbatim from `STUDIO-DESK-FIXES.md` and still bind every change in this document:

1. The Desk writes exactly five columns: `Payment Plan`, `Payment Status`, `Shipping Fee`,
   `Work Phase`, `Internal Notes`. `WRITABLE_FIELDS` is the enforcement point.
2. The Desk never calculates or stores a price.
3. No prices may enter through the catalogue — `pickLabels_()` stays labels-only.
4. Rows are located by `Order Reference`, never by row number alone.
5. Server-side validation is authoritative. A UI guard is a convenience, never the real check.
6. Run `npm test` after every finding you close. Add a suite for each behavioural change.

### Two more rules specific to this review

7. **Every string she can see is Indonesian, and contains no sheet column names, no file names, no row
   numbers, and no timezone identifiers.** If a developer needs that information, it goes in a
   `<!-- comment -->` or a collapsed details block, not on her screen.
8. **Never destroy the ticket DOM inside an event handler that the user's next tap depends on.** This
   is the root cause of P1-2 and P1-4. Prefer targeted in-place updates over `innerHTML =`.

---

## Priority 1 — Traps. She gets stuck, or loses work she already did.

### P1-1. A late order can never be started

**Where:** `studio-desk/Index.html`, in `gate()` — anchor `ok: d >= 0,`.

```js
var d = daysUntil(order.date);
var leadDays = (catalog && catalog.minimumLeadDays) || 2;
auto.push({
  ok: d >= 0,
  label: d < 0 ? 'Sudah lewat tanggal' : (d < leadDays ? 'Tanggal mepet' : 'Tanggal masih cukup'),
  sub: fmtDate(order.date) + ' · ' + relDate(order.date)
});
```

`gate()` returns `ready = autoOk && manualOk`, and the **Mulai kerjakan** button is
`disabled` unless `g.ready`. So the moment an order's Preferred Date slips into the past, that check
flips to ✕ **permanently** and the button is dead forever.

And there is no other way out: the *Tahap kerja* block only renders its **Lanjut** / **Kembali**
buttons under `if (pIndex > 0 || !next)` — anchor `var next = PHASES[pIndex + 1];`. At `pIndex === 0`
with a next phase available, that block renders **no buttons at all**. The gate's button is the only
door, and it is locked.

**Why this is the worst bug in the Desk:** the red **terlambat** counter at the top of the screen is,
by definition, the exact set of orders she cannot touch. The Desk shouts "3 terlambat!" and then
refuses to let her work on any of the three. Her only recourse is to open the spreadsheet and change
`Work Phase` by hand — the one thing the Desk exists to prevent.

The same trap catches an order with a missing or malformed `Preferred Date`: `daysUntil` returns
`NaN`, `NaN >= 0` is `false`, and the order is unstartable for a reason no message explains.

**Fix.** A past date is *information*, not a *gate*. Split the notion of "blocking" from "worth
warning about":

- Give each auto-check an explicit `blocking` flag. Payment, price-mismatch (`REVIEW`), and an
  incomplete destination stay **blocking**. The date check becomes **non-blocking**: it still renders,
  still turns amber/red, still reads `Sudah lewat tanggal` — but it no longer contributes to `ready`.
- Compute `autoOk` from blocking checks only; keep rendering all of them.
- When a non-blocking check is failing, the button stays enabled and reads **Tetap mulai kerjakan**,
  with the `.why` line explaining in her words: `Tanggalnya sudah lewat — kabari pembeli dulu kalau
  perlu.` A late order is a real order that still has to be made.
- Handle `NaN` explicitly in `daysUntil`/`relDate` callers: if the date is unreadable, render
  `Tanggal pesanan tidak terbaca — cek di sheet` as a **blocking** check with a clear message, rather
  than silently failing the `d >= 0` comparison.

**Acceptance:** an order dated yesterday, payment `Paid`, destination complete, card ticked → **Tetap
mulai kerjakan** is enabled and advances the phase. An order with an empty Preferred Date → button
disabled with a message that names the actual problem. Add a `verify-studio-desk.js` suite covering
both.

---

### P1-2. Typing in a field and then tapping a button loses the tap

**Where:** `studio-desk/Index.html` — anchor `elTicket.addEventListener('change', function (e) {`.

```js
elTicket.addEventListener('change', function (e) {
  var o = findOrder(state.selected);
  if (!o) return;
  if (e.target.classList.contains('notes')) { saveNotes(o); return; }
  if (e.target.type !== 'number') return;
  ...
  writeField(o.ref, 'shipping', value, 'Shipping Fee');
});
```

`writeField` calls `render()` synchronously, and `renderTicket()` does `elTicket.innerHTML = html`.

On a touch device the event order when she taps a button while the Ongkir field or the notes textarea
is focused is: `touchend` → `mousedown` → **blur on the input** → **`change` fires** → our handler
runs → `innerHTML` is replaced → the button she is pressing is removed from the document → `mouseup`
and `click` land on a detached node, so the delegated `closest('[data-pay]')` lookup returns `null`.

**Her tap does nothing. Silently.**

This hits the two most common sequences in the whole workflow:

1. Fill in **Ongkir** → tap **Tandai lunas** (or **Kirim pesan**). Nothing happens. She taps again.
2. Type a line in **Catatan kerja** → tap **Lanjut: Siap dikirim**. Nothing happens. She taps again.

The second tap works, because by then the re-render is done. So the Desk trains her to double-tap
everything, which is exactly the habit you do not want on a button called **Tandai lunas**.

**Fix.** Stop tearing down the ticket from inside a `change` handler. `writeField` should take an
option for how to reflect the optimistic state:

- Add a fourth mode to `writeField(ref, field, value, columnLabel, opts)` where
  `opts.rerender === false` skips the synchronous `render()`. Instead, mark only the specific control
  pending in place: set `disabled` on the one input, and add a small inline "menyimpan…" marker.
- Call it with `{ rerender: false }` for `shipping` and `notes` — the two fields reached via `change`.
  The success/failure handler already re-renders when the server answers, hundreds of milliseconds
  later, long after the click has resolved.
- While you are here: make the ticket's re-render preserve scroll position. Capture
  `window.scrollY` (and, on desktop, `elTicket.scrollTop` if it ever becomes its own scroll container)
  before writing `innerHTML` and restore it after.

**Acceptance:** with the Ongkir field focused and dirty, a single tap on **Tandai lunas** opens the
confirmation. With the notes textarea focused and dirty, a single tap on **Lanjut** advances the phase
*and* saves the note. Add a browser-runner case (`tests/browser-runner.html`) for the single-tap path
if the harness can drive it; otherwise assert the `rerender: false` contract in the node suite.

---

### P1-3. The counters at the top of the screen include cancelled orders

**Where:** `studio-desk/Index.html`, in `renderTop()` — anchor `if (o.phase === 'Delivered') return;`.

```js
state.orders.forEach(function (o) {
  if (o.phase === 'Delivered') return;
  var d = daysUntil(o.date);
  if (d < 0) late++;
  else if (d === 0) today++;
  if (waitingPay(o)) pay++;
  if (o.phase === 'Assembly and packing') working++;
});
```

An order is cancelled by setting **Payment Status** to `Cancelled` — its `Work Phase` is untouched. So
a cancelled order whose date has passed keeps incrementing **terlambat**, a cancelled order dated today
keeps incrementing **jatuh tempo hari ini**, and a cancelled order left mid-assembly keeps
incrementing **sedang dikerjakan**.

The Desk already has the right predicate for this — `isActive(order)`, used by `laneMatch` — it just
isn't used here. The result is that the top strip and the **Aktif** chip disagree, and the number she
is told to "look at first every morning" (`STUDIO-DESK-PANDUAN.md` §2) is wrong.

**Fix.** Replace the guard with the shared predicate:

```js
state.orders.forEach(function (o) {
  if (!isActive(o)) return;
  ...
});
```

`isActive` is `order.phase !== 'Delivered' && order.payment !== 'Cancelled'`, which is exactly what
every one of these four counters means.

**Acceptance:** a cancelled order dated last week contributes to no counter, and the **Aktif** chip
count plus the **Dibatalkan** chip count reconcile with the strip. Add a suite asserting the four
counters against a fixture containing one cancelled-and-overdue order.

---

### P1-4. Ticking off an item she just made scrolls the page out from under her

**Where:** `studio-desk/Index.html` — anchors `var comp = e.target.closest('[data-comp]');` and
`var tick = e.target.closest('[data-tick]');`.

```js
var comp = e.target.closest('[data-comp]');
if (comp) {
  p.comps = p.comps || {};
  p.comps[comp.dataset.comp] = !p.comps[comp.dataset.comp];
  refocus = 'comp-' + comp.dataset.comp;
  savePer();
  renderTicket();   // ← rebuilds the entire ticket for one checkbox
  return;
}
```

These ticks are **purely local** — device-only bench state in `localStorage`, never sent to the
server. Yet each one destroys and rebuilds the whole ticket (payment block, gate, make list, finishing,
delivery, phases, notes), then calls `.focus()` on the replacement node, which scrolls it back into
view at whatever position the browser picks.

**Yang dibuat** is the block she uses most: it is the checklist she works down while assembling a
bouquet, item by item, phone propped on the bench. Every tick is a full page repaint plus a scroll
jump. On an order with six items that is six jumps, and the textarea below loses its uncommitted
cursor position each time.

**Fix.** Update in place. Neither tick needs a re-render:

- Toggle `aria-pressed` on the button that was tapped, and let CSS do the rest — the strike-through and
  the filled box are already driven by `[aria-pressed="true"]` selectors.
- Update the counter text node in the block heading (`doneComps + '/' + comps.length + ' item'`)
  directly.
- Drop the `refocus` round-trip for these two cases entirely: the button was never removed, so it
  never lost focus, and no scroll correction is needed.
- Keep `savePer()` as-is.

Re-render only when something changes that the rest of the ticket depends on — and a local checkbox
does not, with one exception: the manual card tick feeds `gate()`, so after toggling `data-tick`,
update the **Mulai kerjakan** button's `disabled` state and its `.why` message in place too.

**Acceptance:** ticking any item in **Yang dibuat** does not move the scroll position and does not
blank the notes textarea's draft cursor. The counter updates. The card tick still enables/disables
**Mulai kerjakan**.

---

### P1-5. "Aktifkan lagi" erases the record that a deposit was received

**Where:** `studio-desk/Index.html`, in `paymentBlock()` — anchor
`'<div class="actions"><button type="button" class="btn ghost" data-pay="Unpaid">Aktifkan lagi</button></div>'`.

Un-cancelling an order writes `Payment Status = 'Unpaid'` unconditionally. If the order was a
**DP 50%** order whose deposit had already landed in the bank before it was cancelled, that money's
only record in the sheet is now gone, and the Desk will ask her to collect the deposit a second time.

The block even acknowledges the problem one line above — `Jika DP sudah diterima, proses pengembalian
dicatat manual.` — and then does the destructive thing anyway.

**Fix.** Un-cancelling should restore, not reset:

- Present the choice instead of guessing. For a `Deposit 50%` order, render two buttons:
  **Aktifkan — DP sudah diterima** (`data-pay="Deposit paid"`) and **Aktifkan — belum ada pembayaran**
  (`data-pay="Unpaid"`), with a one-line explanation of which to pick.
- For a `Full` order, keep the single **Aktifkan lagi** → `Unpaid`.
- Longer-term and better, but only with the owner's sign-off because it touches ground rule 1: record
  the pre-cancellation status so it can be restored exactly. Do **not** add a sixth writable column to
  do this without that decision — the two-button approach above needs no schema change and should ship
  first.

**Acceptance:** cancelling a `Deposit 50%` order that was at `Deposit paid` and then re-activating it
offers the `Deposit paid` path, and choosing it leaves the payment block showing the balance due, not
the full amount.

---

## Priority 2 — Orientation. She can't tell where she is or find what she needs.

### P2-1. The open ticket goes stale when the list underneath it changes

**Where:** `studio-desk/Index.html` — anchors `state.lane = b.dataset.lane;` (chips handler),
`state.search = elSearch.value;` (search handler), and `if (!state.selected) {` in `render()`.

Both handlers call `renderTop()` / `renderQueue()` but never reconcile `state.selected`. `render()`
only auto-selects when `state.selected` is `null`. So:

- Switch from **Aktif** to **Siap dikirim**, and the right-hand pane keeps showing an order that is not
  in the list on the left.
- Type a name into search that excludes the open order, same result.
- Mark an order **Selesai** while on **Aktif**, and its card vanishes from the queue while its ticket
  stays open — with no acknowledgement that anything happened.

**Fix.** After any change to `lane`, `search`, or the order data, check whether `state.selected` is
still in `visibleOrders()`. If it isn't, select the first visible order (or `null` if the list is
empty) and re-render the ticket. Add this as a single `reconcileSelection()` helper called from all
three sites, so the two panes can never disagree.

For the **Selesai** case specifically, also fire a toast — `Pesanan selesai. Dipindahkan ke daftar
Selesai.` — so the card disappearing reads as a result, not a glitch.

---

### P2-2. Search only looks inside the lane she happens to be on

**Where:** `studio-desk/Index.html` — anchor `return laneMatch(o, state.lane) && matchesSearch(o, state.search);`.

She searches for "Putu" while the **Aktif** chip is selected. The order is finished, so it lives in
**Selesai**, so she is told `Tidak ada pesanan yang cocok.` — which reads as *this order does not
exist*, not *this order is in a different tab*.

**Fix.** Make the empty state do the second search for her. When `state.search` is non-empty and the
in-lane result is empty, run `matchesSearch` across all orders. If there are hits, replace the empty
message with a button:

> Tidak ada di daftar ini. **Ada 1 pesanan cocok di Selesai — lihat**

Tapping it sets the lane and keeps the query. If there are genuinely no hits anywhere, keep the current
message.

---

### P2-3. Nothing tells her an order is new

**Where:** `studio-desk/Index.html`, `renderTop()` and `renderQueue()`.

Spotting the order that arrived overnight is the first job of the day, and the Desk offers no help:
the only cue is the small mono `masuk 14 Sep 09:12` line, which she'd have to read on every card and
compare against memory. The **Pesanan pertama** sort is oldest-first, which is the *opposite* of what
she'd want for this.

**Fix.**

- Record `lastSeenAt` in `localStorage` (same pattern as `PER_KEY`) — the timestamp of the most recent
  `submitted` value she has seen, updated when she opens a ticket.
- Give cards whose `submitted` is newer than `lastSeenAt` a **Baru** tag — use the existing
  `.tag.go` style so no new CSS is needed.
- Add a fifth counter to the pulse strip: `<n>` **pesanan baru**, shown only when `n > 0`.

This is per-device scratch state exactly like the ticks, so it needs no schema change and no server
work.

---

### P2-4. She can't see what phase an order is in without scrolling to the bottom

**Where:** `studio-desk/Index.html` — anchor `'<div class="ticket-head' + headCls + '">'`, and the
`.phases` block near `'<div class="block"><h3>Tahap kerja</h3><div class="phases">'`.

The ticket header shows reference, buyer, WhatsApp, submitted-at and due date. It does **not** show the
work phase — the single most important fact about an order for the person making it. To find it she
scrolls past payment, the gate, the make list, finishing and delivery.

And when she gets there, the phase strip itself is broken on a phone: five `.phase` items at
`min-width: 108px` plus `padding-inline-end: 16px` is ~540px of content in roughly 320px of available
width on a 390px-wide phone. It scrolls horizontally, with `scrollbar-width: none`, and **nothing
scrolls the current phase into view**. For an order at *Dikirim* (index 3) or *Selesai* (index 4), the
highlighted step is off-screen to the right and she sees a row of identical grey stubs.

**Fix.**

- Put the current phase in the ticket header as a `.tag.go` chip next to the reference line.
- After `renderTicket()`, call `scrollIntoView({ inline: 'center', block: 'nearest' })` on
  `.phase.now` inside its scroll container. Guard it for `prefers-reduced-motion` (the stylesheet
  already disables animation there — use `behavior: 'auto'`).
- Add a fade mask on the scroll container's trailing edge so it reads as scrollable at all:
  `mask-image: linear-gradient(to right, #000 calc(100% - 24px), transparent)`.

---

### P2-5. The lane chips scroll sideways with no hint that they do

**Where:** `studio-desk/Index.html` — anchor `.chips { display: flex; gap: 7px; overflow-x: auto;`.

There are eight chips — **Aktif**, **Menunggu bayar**, the five phases, **Dibatalkan** — in a row with
`scrollbar-width: none` and a hidden webkit scrollbar. On a phone the last two or three are off-screen
with no visual cue. **Dibatalkan** is effectively undiscoverable.

The active chip also never scrolls itself into view, so selecting one from the far right and then
re-rendering can leave the highlighted chip outside the viewport.

**Fix.** Same two treatments as P2-4: a trailing fade mask on `.chips`, and
`scrollIntoView({ inline: 'nearest', block: 'nearest' })` on the `[aria-pressed="true"]` chip after
`renderTop()`.

---

### P2-6. The numbers she is told to read first aren't tappable

**Where:** `studio-desk/Index.html` — anchor `elPulse.innerHTML =`.

`STUDIO-DESK-PANDUAN.md` §2 tells her: *"Lihat baris ini dulu setiap kali membuka Desk — itu ringkasan
hari Anda."* She reads **2 terlambat**, and the obvious next move is to tap it. It's a `<div>`.

Worse, there is no lane that corresponds to it. **terlambat** and **jatuh tempo hari ini** are
computed in `renderTop()` and exist nowhere else — she cannot filter to them at all, by any means.

**Fix.**

- Render each pulse item as a `<button>` that sets `state.lane`.
- Add two lane keys to `laneMatch()`: `late` (`isActive(o) && daysUntil(o.date) < 0`) and `today`
  (`isActive(o) && daysUntil(o.date) === 0`). **menunggu bayar** already maps to the existing `pay`
  lane; **sedang dikerjakan** maps to the existing `Assembly and packing` lane.
- These two need no new chips — reaching them by tapping the number is enough, and adding two more
  chips would make P2-5 worse. Show the active one in the chip row only while it is selected.

---

### P2-7. The queue is an undifferentiated wall of cards

**Where:** `studio-desk/Index.html` — anchor `elQueue.innerHTML = list.map(function (o) {`.

Sorted by due date, the list runs from *3 hari lewat* through *12 hari lagi* with no breaks. Every card
carries its own date, so she has to read each one to work out where "today" ends.

**Fix.** Insert lightweight group headers as `<li>` separators when the sort is `due`:
**Terlambat**, **Hari ini**, **Besok**, **Minggu ini**, **Nanti**. Style them like the existing
`.block > h3` (uppercase, `10.5px`, `--muted` → see P4-2 for the colour). Skip empty groups. Suppress
the headers entirely when the sort is `in`, where they would be meaningless.

---

## Priority 3 — Her language. Strings written for a developer, read by her.

### P3-1. Sheet column names, file names, row numbers and timezone IDs are on screen

Five separate sites leak implementation vocabulary into her interface:

| Where (anchor) | What she sees | What it should say |
| --- | --- | --- |
| `function savedToast(column)` | `Tersimpan ke sheet Orders · Payment Status` | `Status pembayaran tersimpan.` |
| `'<div class="provenance"><span>Orders · baris '` | `Orders · baris 47` / `Desk menulis: Payment Plan · Payment Status · Shipping Fee · Work Phase · Internal Notes` / `Kolom lain hanya dibaca` | Remove the whole block from her view. It is developer provenance; nothing she can act on. |
| `esc(o.ref) + ' · baris ' + o.row` | `ALX-0142 · baris 47` | `ALX-0142` |
| `fmtDate(todayStr()) + ' · Asia/Makassar'` | `16 Sep · Asia/Makassar` | `Selasa, 16 Sep · WITA` |
| the `.foot` paragraph | `…dibaca langsung dari site-content.js.` | `…diambil langsung dari katalog situs Alxanthia.` |

**Fix.** Apply the replacements above.

- `savedToast` should map the five writable fields to Indonesian labels via a lookup
  (`{ paymentPlan: 'Cara pembayaran', payment: 'Status pembayaran', shipping: 'Ongkir',
  phase: 'Tahap kerja', notes: 'Catatan kerja' }`) and take the **field key**, not the column name.
  Every `writeField` call site passes the column name today — change the signature so the English
  column string never reaches the page at all.
- The `.provenance` block's information is genuinely useful when something goes wrong, so don't delete
  it outright: move it behind a `<details><summary>Info teknis</summary>` at the very bottom, closed by
  default.
- Keep `o.row` in the payload sent to `updateOrder` — ground rule 4 still wants the hint. Just stop
  rendering it.

**Acceptance:** `grep -o 'Payment Status\|Work Phase\|Internal Notes\|Shipping Fee\|Payment Plan\|site-content\.js\|Asia/Makassar' studio-desk/Index.html` returns matches only inside `<script>` logic,
comments, and the collapsed technical block — never inside a string that renders visibly by default.

---

### P3-2. The payment-plan switcher looks like two buttons that do two different things

**Where:** `studio-desk/Index.html` — anchor `'<div class="actions" role="group" aria-label="Cara pembayaran">'`.

```js
'<button type="button" class="btn ' + (!isDeposit ? '' : 'ghost') + '" data-plan="Full"…>Bayar penuh</button>' +
'<button type="button" class="btn ' + (isDeposit ? '' : 'ghost') + '" data-plan="Deposit 50%"…>DP 50%</button>'
```

Two same-sized buttons side by side, one filled green and one outlined, sitting in a row that also
contains **Tandai lunas** and **Batalkan pesanan** styled identically. Nothing says "these two are one
choice, and the green one is the current state" — the filled one reads as *the recommended action*,
so tapping it is a natural move, and tapping it does nothing.

There is a working segmented control in this same file already: the **Urutkan** switcher (`.sort .seg`),
which is visually unmistakable as a two-state toggle and correctly uses `aria-pressed`.

**Fix.**

- Re-use `.sort .seg` markup and styling for the plan switcher, with `aria-pressed` on both buttons.
  Label it above with the same `.sort .k` treatment: `CARA PEMBAYARAN`.
- Move it out of the `.actions` row so it is not adjacent to **Tandai lunas** / **Batalkan pesanan**.
  It belongs directly under the amount breakdown, where it explains the numbers.
- The server rejects a plan change once payment has started (`PAYMENT_STARTED` in
  `studio-desk/Code.gs`), but the UI leaves both buttons live, so she taps and gets a red error toast.
  Mirror the server rule client-side: when `o.payment !== 'Unpaid'`, render the control `disabled` with
  the reason underneath — `Cara pembayaran terkunci setelah pembayaran mulai diproses.` Ground rule 5
  applies: this is a convenience, the server check stays.

---

### P3-3. The hint that unblocks the payment panel is at the bottom of it

**Where:** `studio-desk/Index.html` — anchor `if (amount === null) html += '<span class="why">Isi ongkir dulu supaya totalnya bisa ditagih.</span>';`

When `Shipping Fee` is blank, the total reads `—`, **DP 50%** is disabled, and the explanation is
appended *after* the action rows, below everything. The field it refers to is several elements above.

**Fix.** Render that message immediately under the Ongkir input (where `shipErr` already goes), not at
the end of the block. Keep one copy, not two.

---

### P3-4. The Ongkir field doesn't look like money

**Where:** `studio-desk/Index.html` — anchor `'<div class="ongkir"><label for="ongkir-'`.

Every other amount in the Desk is formatted `Rp 45.000` via `rupiah()`. This one is a bare
`<input type="number">` where she types `45000` and gets `45000`. With no thousands separator, `45000`
and `450000` are easy to confuse at a glance — and this number goes straight onto the customer's bill.

**Fix.** Keep `type="number"` (it gets the right keypad and `validateFieldValue_` expects a number),
but:

- Put a static `Rp` prefix inside the field's border, as a sibling span in a bordered wrapper.
- Echo the formatted value next to the input as she types, on `input`: `= Rp 45.000`. This is display
  only — do not reformat the input's own value, which would fight the numeric keypad.
- Make the total in `.amount .big` visibly update from the echo, so the connection between the field
  and the bill is immediate.

---

### P3-5. Dates have no weekday

**Where:** `studio-desk/Index.html` — `fmtDate()`, anchor `var MONTHS = ['Jan', 'Feb', 'Mar',`.

`fmtDate` renders `20 Sep`. For a flower studio, *which day of the week* is the operative fact — a
Saturday order and a Tuesday order mean completely different things for planning.

**Fix.** Add a `DAYS = ['Min','Sen','Sel','Rab','Kam','Jum','Sab']` lookup and a `fmtDateLong()` that
returns `Sab, 20 Sep`. Use it in the ticket header's `.when .d` and in the top bar's today line; leave
the compact `fmtDate` in card rows and inline breakdowns where horizontal space is tight.

---

### P3-6. "Batalkan pesanan" sits in the same row as "Tandai lunas"

**Where:** `studio-desk/Index.html` — anchor `'<button type="button" class="btn ghost small" data-askcancel="1">Batalkan pesanan</button>'` (two sites, deposit and full paths).

The most destructive action in the Desk shares an `.actions` flex row with the most routine one, at
`.btn.small` size (see P4-1 — a ~32px tap target). It does have a confirmation step, which is the
important protection and should stay. But proximity is the wrong default.

**Fix.** Move **Batalkan pesanan** out of the payment `.actions` row to the bottom of the ticket, below
the notes block, on its own, at normal `.btn.ghost` size. Keep the existing inline confirmation exactly
as it is.

---

### P3-7. "Simpan catatan" implies notes aren't saved, but blur already saves them

**Where:** `studio-desk/Index.html` — anchors `data-savenotes="1"` and the `change` branch
`if (e.target.classList.contains('notes')) { saveNotes(o); return; }`.

Notes auto-save on blur *and* have an explicit save button *and* an `belum tersimpan` indicator. Three
mechanisms for one field. In practice the `belum tersimpan` state almost never appears, because tapping
anywhere else blurs the textarea and saves it — so the button she was taught to press is usually a
no-op, and `saveNotes` returns early.

**Fix.** Pick one story and make it visible. Recommended: keep auto-save, drop the button, and make the
status line honest — `Menyimpan…` → `Tersimpan` → (on failure) `Gagal menyimpan — coba lagi` with a
retry affordance that only appears when there is something to retry. Update
`STUDIO-DESK-PANDUAN.md` §"Catatan kerja" to match.

Note the interaction with **P1-2**: fixing that one is a prerequisite here, because auto-save-on-blur
is precisely what eats the next tap today.

---

## Priority 4 — Touch targets, contrast, accessibility

### P4-1. Every control in the Desk is below the minimum tap target

Measured from the stylesheet (font-size × line-height + vertical padding + borders):

| Control | Anchor | Height |
| --- | --- | --- |
| `.refresh` | `.bar .refresh {` | ~30px |
| `.sort .seg button` | `.sort .seg button {` | ~31px |
| `.chips button` | `.chips button {` | ~33px |
| `.btn.small` | `.btn.small {` | ~32px |
| `.tick` | `.tick {` | ~34px |
| `.btn` | `.btn {` | ~40px |

The accepted minimum is 44×44 CSS px (Apple HIG; WCAG 2.2 SC 2.5.8 sets 24×24 as the floor and 44 as
the target). This is a phone-first tool used in a workshop, one-handed, possibly with damp or
flower-stained fingers. **Tandai lunas** is a `.btn` at 40px; **Batalkan pesanan** is a `.btn.small` at
32px, which is the wrong way round.

**Fix.** Set a floor on every interactive element: `min-height: 44px` plus
`display: inline-flex; align-items: center` so the existing padding and centring still work. For
`.tick` and `.comp`, increase the block padding rather than the font size — the row should grow, not the
text. Where a 44px control would break a dense row (`.sort .seg`, `.chips`), keep the visual height but
extend the hit area with a transparent `::before` inset overlay, so the design doesn't change but the
target does.

### P4-2. `--muted` fails WCAG AA in light mode, on the smallest text in the app

Measured contrast for `--muted: #737B70`:

| Pair | Ratio | AA (4.5:1) |
| --- | --- | --- |
| on `--surface` `#FCFCF9` | **4.26** | ✕ |
| on `--ground` `#F2F4EF` | **3.95** | ✕ |
| on `--surface-2` `#EDEFE8` | **3.78** | ✕ |

Dark mode is fine (`#929A8C` scores 5.68 / 5.10). Every other pairing in the palette passes — `--ink-2`
at 7.40, `--pine` at 8.66, `--amber` at 5.17, `--madder` at 7.41.

`--muted` is used for exactly the text that most needs to be legible at a glance: `.pulse span`
(11.5px, uppercase — the daily summary labels), `.card .ref`, `.card .in`, `.block > h3` section
headings, `.comp .spec .k`, `.phase .t`, `.provenance`, and every `::placeholder`.

**Fix.** Darken `--muted` in the light palette to at least `#5F6A5D` (≈5.4:1 on `--surface`, ≈4.9:1 on
`--surface-2`, comfortably AA at these sizes). Leave the dark-mode value alone. The change is one line
and preserves the palette's character — it is the same hue, one step down in lightness.

Re-run the check after editing; the script used for the table above is worth keeping as
`scripts/check-contrast.js` so a future palette tweak can't quietly regress it.

### P4-3. `aria-live="polite"` on the ticket makes a screen reader re-read the entire order

**Where:** `studio-desk/Index.html` — `<section class="ticket" id="ticket" aria-live="polite">` and
`<section class="pulse" id="pulse" aria-live="polite">`.

The whole ticket is replaced on nearly every interaction, so an `aria-live` region wrapping it
announces the complete order — payment, checks, every item, delivery, phases — after each tap. The
intent was clearly to announce *changes*; the effect is to announce *everything*.

**Fix.** Remove `aria-live` from `#ticket`. The toast already exists, already has `role="status"`, and
is the correct place for change announcements — route the save confirmations through it (they already
are). Keep `aria-live="polite"` on `#pulse`, which is a short, genuinely live summary.

### P4-4. Focus is lost after every server write

**Where:** `studio-desk/Index.html` — `writeField`'s `render()` calls; `refocus` is only ever set by the
two local-tick handlers.

Tap **Tandai lunas** → `innerHTML` is replaced → focus falls to `<body>`. A keyboard or screen-reader
user is returned to the top of the document after every single action.

**Fix.** Generalise the existing `refocus` mechanism: give every action button a `data-fk`, set
`refocus` from the tapped button's `data-fk` in the `elTicket` click handler before the write, and
restore it after render (the restore code already exists). Where the button no longer exists after the
state change — **Mulai kerjakan** becomes **Lanjut** — fall back to focusing the enclosing `.block`'s
heading with `tabindex="-1"`.

### P4-5. Dark mode has no manual switch, though the CSS is already written for one

**Where:** `studio-desk/Index.html` — `:root[data-theme="dark"]` and
`:root:not([data-theme="light"])` in the stylesheet.

The stylesheet fully supports an explicit `data-theme` attribute in both directions. Nothing ever sets
it — the Desk follows the OS only. A phone set to auto-dark will flip the Desk to a dark palette
mid-afternoon whether or not that suits a bench with a lamp on it.

**Fix.** Add a small three-state control (`Otomatis` / `Terang` / `Gelap`) to the technical details
block from P3-1 or the top bar, writing `data-theme` on `<html>` and persisting the choice in
`localStorage` alongside `PER_KEY`. The CSS needs no changes. Wrap the read in `try/catch` like the
existing storage accessors.

### P4-6. A card can carry five tags

**Where:** `studio-desk/Index.html` — anchor `var tags = [];` in `renderQueue()`.

Review + payment status + phase + wrap swatch + Kartu, all at `10.5px` uppercase, wrapping onto two
rows under a two-line item summary. The **Review** tag — the one that means *stop, the price is wrong* —
has no more visual weight than the **Kartu** tag.

**Fix.** Cap the row at three tags in priority order: (1) `Review` if present, (2) payment state if
waiting or cancelled, (3) phase or `Siap dikerjakan`. Move the wrap swatch to sit inline next to the
item summary as a bare colour chip with no label, and drop the `Kartu` tag from the card entirely — it
is already unmissable in the ticket, where it matters. Bump `.tag` to `11.5px` while you are there.

---

## Priority 5 — Small polish

| # | Where (anchor) | Issue | Fix |
| --- | --- | --- | --- |
| P5-1 | `boot()` / `reloadOrders()` | No offline indication. A dropped connection surfaces only as a red toast after she has already tapped something. | Listen for `online`/`offline` and render a persistent `.stale-banner` variant: `Tidak ada koneksi — perubahan belum tersimpan.` Disable write buttons while offline. |
| P5-2 | `elCatalogMeta.textContent` | The *catalogue* shows when it was fetched; the *orders* never do, though they matter far more. | Add `diperbarui <relative time>` next to the refresh button, from the last successful `listOrders()`. |
| P5-3 | `history.pushState({ desk: 'detail', …})` in the queue click handler | On desktop (≥900px) `body.detail` has no visual effect, so each card tap pushes a history entry whose Back does nothing visible. | Only push when the master/detail breakpoint is active: guard with `window.matchMedia('(max-width: 899px)').matches`. |
| P5-4 | `copyCard.textContent = 'Tersalin';` | Never reverts until the next re-render, so the button can read "Tersalin" for an order she has since scrolled past. | Revert after ~2s with a timer, matching the toast's own timing. |
| P5-5 | `renderTicket()` phase block | A cancelled order still renders the full make list and working phase controls, so its phase can be advanced. | When `o.payment === 'Cancelled'`, collapse the make/finishing/phase blocks behind a single line and leave only the re-activation path from P1-5. |
| P5-6 | `includeOrder_` in `Code.gs` vs `laneMatch(o, 'cancelled')` in `Index.html` | Two different notions of "cancelled": the server drops rows whose **Work Phase** is `Cancelled`; the Desk's chip matches rows whose **Payment Status** is `Cancelled`. An order cancelled from the sheet by phase vanishes entirely instead of appearing under **Dibatalkan**. | Make `includeOrder_` keep phase-cancelled rows (subject to the same `KEEP_DELIVERED_DAYS_PAST_PREFERRED_DATE` window) and make `laneMatch` match either signal. Add a server suite for the round trip. |
| P5-7 | `todayStr()` | Uses the device clock, while the header claims `Asia/Makassar` and the server uses `TIMEZONE`. A phone on the wrong timezone silently shifts every *hari ini* / *terlambat* calculation. | Have `getCatalog()` return the server's `todayStr_()`, and use it in place of the local computation when present. Falls back to device time if absent. |

---

## Suggested commit sequence

Each of these should be one commit, in this order, with `npm test` green at every step:

1. **P1-3** (counters) — smallest, self-contained, and makes the rest easier to verify by eye.
2. **P1-1** (late orders can be started) — the trap. Ship this early.
3. **P1-2** + **P1-4** (re-render discipline) — do these together; they share the fix.
4. **P1-5** (un-cancel preserves the deposit).
5. **P2-1** + **P2-2** (selection reconciliation and cross-lane search) — both touch `visibleOrders()`.
6. **P2-4** + **P2-5** + **P2-6** + **P2-7** (orientation: phase chip, scroll-into-view, tappable
   counters, date groups).
7. **P2-3** (new-order badge).
8. **P3-1** through **P3-7** (language and payment-panel clarity) — can be one commit or several;
   update `STUDIO-DESK-PANDUAN.md` in the same commit as any behaviour it describes.
9. **P4-1** + **P4-2** + **P4-6** (touch targets, contrast, tag density) — pure CSS, easy to review.
10. **P4-3** + **P4-4** + **P4-5** (accessibility and theme switch).
11. **P5** items, individually or batched.

---

## Definition of done

- `npm test` passes, with a new suite for each of P1-1, P1-3, P1-5, P2-1 and P5-6.
- `npm run test:browser` passes.
- On a 390×844 viewport: no horizontal page scroll; the current phase and the active chip are visible
  without manual scrolling; every interactive element is at least 44px tall.
- With the Ongkir field or the notes textarea focused and dirty, **one** tap on any action button
  performs that action.
- An order dated yesterday can be started from the Desk.
- `--muted` scores ≥4.5:1 against `--surface`, `--surface-2` and `--ground` in the light palette.
- No sheet column name, file name, spreadsheet row number, or timezone identifier is visible on screen
  by default.
- `STUDIO-DESK-PANDUAN.md` matches the shipped behaviour — in particular §2 (the counters), §4
  (Periksa dulu and starting a late order), and the notes section.
