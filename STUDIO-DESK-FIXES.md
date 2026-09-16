# Studio Desk — review findings and fix brief

**Status:** open. Written for a coding agent (Sonnet, high effort) to implement.
**Target of every change:** [`STUDIO-DESK-SETUP.md`](STUDIO-DESK-SETUP.md), unless a finding says otherwise.
**Reviewed at commit:** `82763aa`, with all 13 suites of `node tests/verify-studio-desk.js` passing.

This document is the output of a review of the Studio Desk as shipped in `STUDIO-DESK-SETUP.md`. The
architecture is sound — the server-side field allow-list, the fail-closed access check, optimistic
writes with rollback, and the rule that money never crosses in from the catalogue are all correct and
must survive every change below. What follows is the list of defects and gaps found on top of that
foundation.

---

## How to work on this

The Studio Desk's source does not live in `.js` / `.html` files. It lives inside two fenced code
blocks in `STUDIO-DESK-SETUP.md`:

| Block | Fence | Lines (at review time) | What it is |
| --- | --- | --- | --- |
| Apps Script server | ```` ```javascript ```` | 122–610 | pasted into the standalone Apps Script project |
| Desk page | ```` ```html ```` | 615–2342 | saved as the `Index.html` file in that project |

`tests/verify-studio-desk.js` extracts both blocks by regex (`function doGet` identifies the server
block, `function paymentBlock` the HTML one) and runs the server block in a `vm` sandbox against a
fake Orders sheet. **So editing the markdown is editing the program**, and `npm test` genuinely
exercises what you wrote.

**Line numbers in this document are as of the review commit and will drift as you apply fixes.**
Locate each site by the quoted anchor string, not by line number.

### Ground rules — do not break these

1. The Desk writes exactly five columns: `Payment Plan`, `Payment Status`, `Shipping Fee`,
   `Work Phase`, `Internal Notes`. `WRITABLE_FIELDS` is the enforcement point. Do not add a sixth
   without an explicit decision from the owner.
2. The Desk never calculates or stores a price. `Verified Total` and `Shipping Fee` come from the
   sheet; `Final Total` is a live sheet formula written by the order writer. Nothing in the Desk may
   compute a product price.
3. No prices may enter through the catalogue. `pickLabels_()` reduces `site-content.js` to display
   labels only — keep it that way.
4. Rows are located by `Order Reference`, never by row number alone. `findRowByReference_` is the
   only lookup.
5. Server-side validation is authoritative. A UI guard is a convenience; the matching check in
   `updateOrder` / `validateFieldValue_` is the real one. Never add a UI-only rule for something that
   protects data.
6. Run `npm test` after every finding you close. Add a suite for each behavioural change.

---

## Priority 1 — Defects

### P1-1. Customer messages greet people by their last name

**Where:** `STUDIO-DESK-SETUP.md:1499`, in the Desk page block.

```js
function firstName(full) { return String(full).split(' ').slice(-1)[0]; }
```

`slice(-1)` takes the **last** token, not the first. The function is named `firstName` and is used in
all six customer-facing WhatsApp templates (`paymentRequestMessage`, `paymentConfirmedMessage`,
`phaseMessage`).

- "Budi Santoso" → "Halo Santoso"
- "Ni Made Ayu Lestari" → "Halo Lestari"

**Fix:** take the first token — but not naively. Most of this studio's customers are in Bali, and
Balinese names open with a gender marker and a birth-order name (`Ni`/`I`, then
`Wayan`/`Made`/`Nyoman`/`Ketut`), while Indonesian customers often write an honorific into the name
field. Blindly taking token one gives "Halo Ni", which is no better than "Halo Lestari". Strip the
leading honorifics and gender markers first:

```js
  var NAME_PREFIXES = ['ni', 'i', 'ibu', 'bu', 'bapak', 'pak', 'mbak', 'mas', 'kak'];

  function firstName(full) {
    var parts = String(full || '').trim().split(/\s+/).filter(Boolean);
    while (parts.length > 1 && NAME_PREFIXES.indexOf(parts[0].toLowerCase().replace(/\.$/, '')) !== -1) {
      parts.shift();
    }
    return parts.length ? parts[0] : '';
  }
```

The `parts.length > 1` guard matters: someone who wrote only `Ni` keeps it rather than being greeted
by an empty string. The `replace(/\.$/, '')` handles `Pak.` and `Bpk.`-style input.

Note the other added guards: the current version also returns `undefined` on an empty buyer name
(producing the literal text "Halo undefined"), and `split(' ')` on a name containing a double space
yields an empty string.

**Worth raising with the owner:** for a Balinese customer, the birth-order name (`Made`, `Wayan`) is
the normal friendly address form, so `Ni Made Ayu Lestari` → "Halo Made" is right. But whether to
address customers by first name at all, versus the more formal `Ibu`/`Bapak` + name, is a business
decision about the studio's voice, not a code decision. Implement the above, and flag the question.

**Acceptance:** `Ni Made Ayu Lestari` → `Halo Made`; `I Wayan Sudiarta` → `Halo Wayan`;
`Budi Santoso` → `Halo Budi`; `Budi` → `Halo Budi`; `Ibu Sari` → `Halo Sari`; an empty buyer name
never produces `Halo undefined` or a dangling `Halo ,`.

---

### P1-2. She cannot tell a buyer their payment arrived, and the paid ticket loses its money panel

**Where:** `STUDIO-DESK-SETUP.md:1795` (`paymentBlock`), `:2236` (the click handler), `:2307`
(`paymentConfirmedMessage`).

Two connected problems:

```js
function paymentBlock(o) {
  var pay = o.payment;
  if (pay === 'Paid') return '';          // :1795 — whole panel disappears
```

```js
    if (e.target.closest('[data-sendpaid]')) {   // :2236 — handler exists
      openWhatsApp(o, paymentConfirmedMessage(o));
      return;
    }
```

Nothing in the entire page renders a `data-sendpaid` button. Grep confirms three hits for
`sendpaid`: the handler, and two inside `paymentConfirmedMessage`'s own definition. The handler and
its message template are **unreachable dead code**.

And because `paymentBlock` returns `''` the moment status reaches `Paid`, there is nowhere for such a
button to live anyway — along with it the ticket loses the billed total, the ongkir figure, and the
cancel action. After she marks an order lunas, the ticket no longer shows what the customer was
charged.

**Fix:** replace the early return with a compact read-only paid summary that keeps the money visible
and gives `paymentConfirmedMessage` a home.

```js
  if (pay === 'Paid') {
    var paidAmount = billed(o);
    return '<div class="block"><h3>Pembayaran</h3>' +
      '<div class="paid-line"><span class="ok">Lunas</span>' +
      '<span class="amt">' + esc(paidAmount === null ? '—' : rupiah(paidAmount)) + '</span></div>' +
      '<div class="breakdown"><span>Produk &amp; kartu ' + esc(rupiah(o.verified)) + '</span>' +
      '<span>Ongkir ' + (o.shipping === null || o.shipping === undefined || o.shipping === ''
        ? 'belum diisi' : esc(rupiah(o.shipping))) + '</span></div>' +
      '<div class="actions">' +
      '<button type="button" class="btn ghost" data-sendpaid="1">Kirim konfirmasi lunas</button>' +
      '</div></div>';
  }
```

Keep the existing `.paid-line`, `.ok`, `.amt` and `.breakdown` CSS classes — they already exist in
the stylesheet and need no additions.

**Acceptance:** an order with `Payment Status = Paid` still shows its total and ongkir on the ticket;
tapping **Kirim konfirmasi lunas** opens WhatsApp with the text from `paymentConfirmedMessage`; a
deposit order that reached `Paid` gets the deposit wording, a full-payment order the other.

---

### P1-3. Cancelling an order is a one-way door, with no confirmation

**Where:** `STUDIO-DESK-SETUP.md:1836` (the Cancelled branch), `:1854` and `:1859` (the two buttons).

```js
    if (pay === 'Cancelled') {
      html += '<div class="paid-line"><span class="cancelled">Dibatalkan</span>' +
        (isDeposit ? '<span class="why">Jika DP sudah diterima, proses pengembalian dicatat manual.</span>' : '') + '</div>';
    } else if (isDeposit) {
```

Two problems compound each other:

1. **No confirmation.** `<button ... data-pay="Cancelled">Batalkan pesanan</button>` is a small ghost
   button sitting immediately beside **Tandai lunas**, and its handler writes straight through:
   ```js
   var payBtn = e.target.closest('[data-pay]');
   if (payBtn) { confirming = false; writeField(o.ref, 'payment', payBtn.dataset.pay, 'Payment Status'); return; }
   ```
   Note the asymmetry: marking an order **paid** goes through the `data-askpaid` confirm dialog.
   Destroying an order does not.
2. **No way back.** The `pay === 'Cancelled'` branch renders no `.actions` group at all, so once
   cancelled there is no control to restore the order. She would have to open the Orders sheet —
   the single thing the Desk exists to spare her.

**Fix, both halves:**

- Route cancellation through the existing confirm mechanism rather than inventing a second one.
  Generalise `confirming` so it can carry a cancel intent, e.g. `confirming = 'cancel'`, and render a
  distinct confirm body for it ("Batalkan pesanan ALX-…? Pesanan akan ditandai dibatalkan.") with
  **Ya, batalkan** / **Tidak**. Change both `data-pay="Cancelled"` buttons to
  `data-askcancel="1"`.
- Give the Cancelled branch a way out:
  ```js
  '<div class="actions">' +
  '<button type="button" class="btn ghost" data-pay="Unpaid">Aktifkan lagi</button></div>'
  ```
  Restoring to `Unpaid` is correct: it is the only status the Desk can safely assume, and
  `PAYMENT_VALUES` already permits it, so no server change is needed.

**Also check:** `includeOrder_` drops rows whose **Work Phase** is `Cancelled`, but this button writes
**Payment Status**. A cancelled order therefore stays in the queue inside its old phase lane wearing a
red tag. That is arguably correct (she can still see and restore it) but it is undocumented and
surprising — see P2-4 for the lane that makes it legible.

**Acceptance:** tapping **Batalkan pesanan** shows a confirm step and writes nothing until confirmed;
a cancelled order shows **Aktifkan lagi**; tapping it returns `Payment Status` to `Unpaid` and the
normal payment actions come back.

---

### P1-4. A catalogue failure blanks the whole Desk

**Where:** `STUDIO-DESK-SETUP.md:1661` (`render`), `:2083` (the boot failure handler).

```js
    if (state.ordersError || state.catalogError) {
      elSkeleton.hidden = true;
      elApp.hidden = true;
      elErrorScreen.hidden = false;
      elErrorMessage.textContent = state.ordersError || state.catalogError;
      return;
    }
```

The catalogue is **labels only** — flower names, pot specs, wrap colours, `minimumLeadDays`. Order
data and every rupiah figure come from the sheet and are entirely unaffected by a catalogue failure.
`resolveLabel()` already degrades gracefully to `humanizeKey()` for any key it cannot find. Yet a
failed `getCatalog` call takes down a screen that would still be perfectly usable.

`fetchAndCacheCatalog_` has good internal fallbacks (cache → live fetch → `DESK_CATALOG_BACKUP` →
empty shape), so this fires only on a thrown error: an access-check failure, a quota error, a
timeout. The access-check case *should* be fatal; the rest should not be.

**Fix:** make `ordersError` fatal and `catalogError` a degraded state.

1. In `render()`, gate the error screen on `state.ordersError` alone.
2. When `state.catalogError` is set, boot with a safe empty catalogue so rendering can proceed:
   ```js
   .withFailureHandler(function (err) {
     state.catalogError = String((err && err.message) || err);
     state.catalog = { stale: true, flowers: {}, pots: {}, additions: {},
                       packages: [], wraps: {}, minimumLeadDays: 2, bank: {} };
     render();
   })
   ```
3. Reuse the existing `.stale-banner` to say so, in Indonesian, e.g. *"Katalog tidak bisa dimuat —
   nama bunga tampil apa adanya. Data pesanan dan semua angka tetap akurat."*

**Careful:** `paymentRequestMessage` reads `state.catalog.bank`, and an empty `bank` produces a
WhatsApp message with `undefined` in the account line. Guard the send buttons — disable them with a
`why` note when `bank.number` is empty — rather than sending a broken message.

**Acceptance:** with `getCatalog` forced to throw, the queue and every ticket still render, flower
names appear as humanised keys, all rupiah figures are correct, and the payment-send buttons are
disabled with an explanation instead of sending a message containing `undefined`.

---

### P1-5. `KEEP_DELIVERED_DAYS` counts from the wrong date

**Where:** `STUDIO-DESK-SETUP.md:136` (the constant), `:202` (`includeOrder_`).

```js
function includeOrder_(order) {
  if (order.phase === 'Cancelled') return false;
  if (order.phase === 'Delivered') {
    var daysPast = daysBetween_(order.date, todayStr_());
    if (daysPast > KEEP_DELIVERED_DAYS) return false;
  }
  return true;
}
```

`order.date` is **Preferred Date** — when the customer wanted the flowers — not when she marked the
order Delivered. The intent ("keep finished orders around for 14 days") is not what the code does:

- An order whose preferred date was three weeks ago, marked Delivered today, **vanishes immediately**.
  She loses it from her history the instant she finishes it.
- An order marked Delivered ahead of a future preferred date **lingers past 14 days**.

**Fix — pick one and be explicit about it:**

- **(a) Correct, more work.** Stamp the delivery. When `updateOrder` writes `Work Phase = Delivered`,
  also record the date. This needs a column, which collides with ground rule 1 — so it requires the
  owner's sign-off first. If taken, add `Delivered At` to the sheet, to the order writer's header
  list in `CONFIGURE-SUBMISSION-ENDPOINT.md`, and to `WRITABLE_FIELDS` as a Desk-written column, then
  measure from it.
- **(b) Cheap, honest.** Leave the behaviour and fix the description. Rename the constant to
  `KEEP_DELIVERED_DAYS_PAST_PREFERRED_DATE`, correct the comment at `:1588` in the Desk page block
  (which currently describes the intended behaviour, not the actual one), and note it in the
  Troubleshooting section so a disappearing finished order is not a mystery.

**Recommendation: (b) now, (a) only if the owner wants delivery history.** Flag the choice in your
summary rather than deciding silently.

**Acceptance:** whichever path, `tests/verify-studio-desk.js` gains a suite pinning the retention
rule, and the guide text matches the code.

---

## Priority 2 — Usability for the person actually using it

### P2-1. An unsaved note can be lost by the Desk's own buttons

**Where:** `STUDIO-DESK-SETUP.md:1431` (`noteDrafts` declared), `:2252` (the `change` handler),
`:2265` (the `input` handler).

Notes save only on `change` — that is, on blur. Between keystroke and blur the text lives in
`noteDrafts`, which is a plain in-memory object. Meanwhile the Desk's own **Kirim pesan** buttons
call `window.open(...)` to WhatsApp, which is exactly the action most likely to evict an Apps Script
iframe on a phone. Typing a note and then messaging the customer about it is a natural sequence that
can silently destroy the note.

`state.per` is already persisted to `localStorage` under `alxanthia-desk-per-v1`, so the mechanism
exists.

**Fix:**
1. Persist `noteDrafts` to `localStorage` next to `state.per`, with the same `try`/`catch` guards
   (the existing code correctly tolerates private-window storage failures — match that).
2. Clear a draft only once the server confirms the write.
3. Show the unsaved state. Render a small "belum tersimpan" marker beside the **Catatan kerja**
   heading when `noteDrafts[o.ref] !== undefined`, and add an explicit **Simpan catatan** button
   rather than relying on blur alone. Blur-to-save is invisible; on a phone it is close to
   undiscoverable.

**Acceptance:** type a note, tap **Kirim pesan**, return to the Desk, reload the page — the draft is
still in the textarea and still marked unsaved.

---

### P2-2. The phone's back gesture exits the app

**Where:** `STUDIO-DESK-SETUP.md:2157` (`classList.add('detail')`), `:2168` (the `data-back`
handler), `:1305` (the `@media (max-width: 899px)` block that implements the two panes).

Master/detail on mobile is pure CSS state:

```js
    document.body.classList.add('detail');
```

with an in-page `← Daftar pesanan` button as the only way back. The phone's own back gesture — which
is what someone will reach for — leaves the Desk entirely.

**Fix:** push a history entry when a ticket opens and listen for `popstate`:

```js
  history.pushState({ desk: 'detail', ref: state.selected }, '');
  // ...
  window.addEventListener('popstate', function () {
    document.body.classList.remove('detail');
  });
```

and have the `data-back` handler call `history.back()` so both routes share one path.

**Verify in the real deployment, not just locally:** the Desk runs inside the Apps Script
`/exec` sandbox iframe, where history manipulation is more restricted than on a normal page. If
`pushState` throws or is ignored there, wrap it in `try`/`catch`, keep the existing in-page button as
the guaranteed route, and say so in a comment — do not leave a half-working back gesture.

---

### P2-3. The deposit balance cannot be collected early

**Where:** `STUDIO-DESK-SETUP.md:1849`.

```js
          : (o.phase === 'Ready for dispatch'
            ? '<button type="button" class="btn" data-sendpayment="balance">Kirim pesan pelunasan</button>' +
              '<button type="button" class="btn ghost" data-pay="Checking balance">Tandai perlu dicek</button>' +
              '<button type="button" class="btn" data-askpaid="Paid">Tandai lunas</button>'
            : '<span class="why">Pelunasan diminta saat pesanan Siap dikirim.</span>')) +
```

The strict `=== 'Ready for dispatch'` means that if a customer simply pays the balance early — common
— there is no button to record it. The panel only explains that the balance is requested later. To
log real money that has actually arrived, she has to advance the work phase to a stage the order is
not at.

**Fix:** allow the balance actions at or after `Ready for dispatch`, using the existing `PHASES`
index rather than a string equality:

```js
var readyIndex = PHASES.findIndex(function (x) { return x.key === 'Ready for dispatch'; });
var phaseIndex = PHASES.findIndex(function (x) { return x.key === o.phase; });
var balanceDue = phaseIndex >= readyIndex;
```

Keep **Kirim pesan pelunasan** gated as it is (asking for money early is a business decision), but
let **Tandai lunas** and **Tandai perlu dicek** through at any phase. Recording money that arrived is
never wrong.

**Note:** this does not weaken any protection. The rule that matters — an order cannot ship unpaid —
is enforced server-side in `updateOrder` and stays untouched.

---

### P2-4. No lane for cancelled orders

**Where:** `STUDIO-DESK-SETUP.md:1710` (`var lanes = ...`).

```js
    var lanes = [{ key: 'all', label: 'Aktif' }, { key: 'pay', label: 'Menunggu bayar' }]
      .concat(PHASES.map(function (p) { return { key: p.key, label: p.label }; }));
```

Cancelling writes `Payment Status`, not `Work Phase`, so a cancelled order keeps sitting inside e.g.
**Belum mulai** with a red tag and no way to review the set of them. With P1-3's restore button in
place, a lane to find them from becomes necessary.

**Fix:** add a `{ key: 'cancelled', label: 'Dibatalkan' }` lane, matched by
`o.payment === 'Cancelled'`, and exclude those orders from the `all` / `Aktif` lane by extending
`isActive`:

```js
  function isActive(order) {
    return order.phase !== 'Delivered' && order.payment !== 'Cancelled';
  }
```

Check `waitingPay` too — it already excludes `Cancelled`, so the pulse counts stay right.

---

### P2-5. The default selected order is not the one at the top of her list

**Where:** `STUDIO-DESK-SETUP.md:1687`.

```js
    if (!state.selected && state.orders.length) state.selected = state.orders[0].ref;
```

`state.orders` is in sheet order. The queue she is looking at is filtered by lane and search and
sorted by deadline. On desktop, where both panes are visible, the ticket on the right is for an order
that is not at the top of the list on the left.

**Fix:** compute the visible, sorted list once and default `state.selected` to its first entry.
`renderQueue` already builds exactly that list — extract it into a `visibleOrders()` helper and use it
in both places, which also removes the duplicated filter/sort logic.

---

### P2-6. Search does not cover the WhatsApp number

**Where:** `STUDIO-DESK-SETUP.md:1576`.

```js
  function matchesSearch(order, query) {
    var needle = String(query || '').trim().toLowerCase();
    if (!needle) return true;
    return String(order.buyer || '').toLowerCase().indexOf(needle) !== -1 ||
      String(order.ref || '').toLowerCase().indexOf(needle) !== -1;
  }
```

When a customer messages her, what she has in hand is a phone number. Add it as a third haystack,
comparing digits only so `+62 812-3456` matches `0812 3456` and `628123456`:

```js
    var digits = needle.replace(/[^\d]/g, '');
    if (digits && String(order.wa || '').replace(/[^\d]/g, '').indexOf(digits) !== -1) return true;
```

Update the input's placeholder from `Nama atau kode pesanan` to `Nama, kode pesanan, atau nomor WA`,
and extend the existing "Suite 10d: order search matches buyer names and order codes" test.

---

## Priority 3 — Hardening

### P3-1. The website is a code-execution path into the orders sheet

**Where:** `STUDIO-DESK-SETUP.md:477`, in `fetchAndCacheCatalog_`.

```js
      var data = (new Function('window', res.getContentText() + '\nreturn window.ALXANTHIA_DATA;'))({});
```

This executes whatever `https://alxanthia.com/site-content.js` returns, as code, inside a script that
holds:

- an authenticated `SpreadsheetApp` handle on the Orders spreadsheet, and
- `BANK_NAME` / `BANK_NUMBER` / `BANK_HOLDER` in Script Properties.

It is the studio's own site over HTTPS, so this is not an active vulnerability. But it means anyone
who can change what that URL serves — a compromised host, a hijacked DNS record, a bad deploy — gets
arbitrary code execution against the orders sheet and the bank details. The guide is otherwise
careful about secrets (the Part 4 preamble explicitly warns against pasting any secret into the
Desk); this line quietly undoes that care.

**Fix — preferred:** have `scripts/build.js` emit a `site-content.json` alongside `site-content.js`,
point `SITE_CONTENT_URL` at it, and replace the line with `JSON.parse(res.getContentText())`. Data
stops being code, and the failure mode becomes a parse error instead of execution.

**Fix — fallback, if the build cannot be changed:** extract the object literal and `JSON.parse` it,
refusing anything that does not match:

```js
  var text = res.getContentText();
  var start = text.indexOf('{', text.indexOf('ALXANTHIA_DATA'));
  // ... bounded brace-matching scan, then JSON.parse
```

This is strictly worse — brittle against formatting changes — so prefer the JSON endpoint.

**Either way:** keep the existing cache → `DESK_CATALOG_BACKUP` → empty-shape fallback chain intact.
A parse failure must degrade exactly as a fetch failure already does.

**Acceptance:** Suite 11 (`getCatalog() parses site-content.js into the Part 4 shape, no prices`) and
Suite 12 (the backup fallback) pass against the new parser, plus a new suite asserting that a
malformed payload falls back to the backup instead of throwing.

---

## Priority 4 — Document organisation

### P4-1. Part 4 is 2,235 lines long, and buries the steps that follow it

Part 4 spans lines 111–2345. Parts 5 through 9 — the Script Properties, the deploy settings that
actually matter (*"Execute as: User accessing the web app ← this one matters; the default is
wrong"*), and getting the Desk onto her phone — all sit **behind** that wall of code. An owner
following the guide has to scroll past 2,200 lines of JavaScript to reach the settings table.

**Fix:** move both blocks into real files — `studio-desk/Code.gs` and `studio-desk/Index.html` — and
reduce Part 4 to the project-creation clicks plus "copy the contents of `studio-desk/Code.gs` into the
editor". Update `tests/verify-studio-desk.js` to read those files directly instead of regex-extracting
from markdown, which makes the harness simpler and less brittle at the same time.

**Constraint:** the test harness must keep testing *the exact text the owner pastes*. Read the files;
do not let a copy drift into the tests.

If the single-file format is a deliberate choice (one document to send, nothing to assemble), say so
explicitly in the preamble and add a table of contents with anchor links so Parts 5–9 are one tap
away. Do not leave it implicit.

### P4-2. Part 8 tells the owner to test a button that does not exist

**Where:** `STUDIO-DESK-SETUP.md:2402`.

```text
- **Salin teks rekening** produces a message with the right total and your account number.
```

There is no such button. It comes from the prototype, `mockups/studio-desk.html:1211`
(`data-copybank`), which copied the bank details to the clipboard. The shipped Desk replaced that
with WhatsApp deep links: **Kirim pesan**, **Kirim tagihan DP**, **Kirim pesan pelunasan**. The only
surviving copy button is **Salin teks kartu**, which copies the gift-card text.

**Fix:** rewrite that checklist line to match the shipped buttons — tapping **Kirim pesan** opens
WhatsApp with the buyer's number, the right total and the studio's account details already typed in,
ready for her to send.

### P4-3. Part 8 never exercises the deposit path

The deposit flow is the newest and most intricate part of the Desk, and the acceptance checklist does
not touch it. Add:

- Switching a new order to **DP 50%** shows the deposit and balance split, and writes `Deposit 50%`
  to `Payment Plan`.
- Once payment has started, the plan can no longer be switched — the Desk refuses with
  *"Cara pembayaran tidak bisa diubah setelah transfer mulai diproses."* (this is enforced
  server-side in `updateOrder`).
- An order with DP received but no final payment **cannot** be advanced to *Dikirim* — the Desk
  refuses with *"Pelunasan harus diterima sebelum pesanan dikirim."*

### P4-4. There is nothing to hand *her*

All 2,461 lines of `STUDIO-DESK-SETUP.md` are written for the owner, in English, about installation.
The person who will use this every day gets no page of her own.

**Fix:** add `STUDIO-DESK-PANDUAN.md` — one page, Indonesian, written for the maker, not the
installer. `PANDUAN-KONTEN.md` already establishes the house style for an Indonesian-language guide in
this repo; follow it. Cover only:

1. Opening the Desk from the home-screen icon.
2. Reading the top row — jatuh tempo hari ini, terlambat, menunggu bayar, sedang dikerjakan.
3. The chips, and what **Aktif** means.
4. Picking an order, and what **Periksa dulu** is checking before **Mulai kerjakan** unlocks.
5. Ticking off items in **Yang dibuat**.
6. Confirming money in the bank's mutasi — never from a screenshot. This is the rule from
   `OWNER-ACTION-GUIDE.md` Step 9 and it belongs in front of her, not only in the owner's guide.
7. Moving through the work phases and sending the customer a message at each one.
8. What to do when something looks wrong — the red **Review** tag, a stale catalogue banner, a save
   that fails.

Keep it under two printed pages. It will do more for day-to-day usability than any single code change
in this document.

---

## Suggested commit sequence

Branch: `claude/trusting-gates-hwj3vq`.

| # | Scope | Contents |
| --- | --- | --- |
| 1 | Defects | P1-1, P1-2, P1-3, P1-4, P1-5(b) |
| 2 | Usability | P2-1, P2-2, P2-3, P2-4, P2-5, P2-6 |
| 3 | Hardening | P3-1 — touches `scripts/build.js` and the catalogue tests, keep it isolated |
| 4 | Docs | P4-1, P4-2, P4-3 |
| 5 | Her guide | P4-4 — `STUDIO-DESK-PANDUAN.md`, new file |

Commits 3 and 4 are the risky ones (they move code between files and change the build), which is why
they are separate from the behavioural fixes. Do not fold them together.

## Definition of done

- [ ] `npm test` passes — all six suites, not only `verify-studio-desk.js`.
- [ ] `npm run test:browser` passes, or its failure is shown to be pre-existing on `main`.
- [ ] Every behavioural change from P1 and P2 has a test suite pinning it.
- [ ] `buildTicketLines_` (server) and `buildList` (page) remain character-for-character equivalent in
      logic. They are a deliberate duplicate — the page cannot call the server synchronously — and
      both carry a comment saying to keep them in sync. If you touch one, touch the other, and
      consider adding a test that asserts they produce identical output for the same fixture.
- [ ] No new column is written by the Desk beyond the five in `WRITABLE_FIELDS`, unless P1-5(a) was
      chosen **and** the owner approved it.
- [ ] No price is calculated anywhere in the Desk.
- [ ] Every string added to the page is in Indonesian, matching the tone of the existing copy.
- [ ] P1-5 and P4-1 record which option was taken and why.
