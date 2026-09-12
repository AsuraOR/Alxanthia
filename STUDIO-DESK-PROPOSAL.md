# Studio Desk — a maker's interface on top of the Orders sheet

**Status:** proposal, revised. Nothing is built yet; the clickable prototype in
`mockups/studio-desk.html` exists so the layout can be judged before any code is written.

## The problem

The `Orders` worksheet has 43 columns. They were designed for three different readers at once:

| Reader | What they actually need |
| --- | --- |
| The script | `Idempotency Key`, `Payload Hash`, `Catalog Version`, `Submitted …` — deduplication and tamper diagnostics |
| The owner | money and logistics: `Verified Total`, `Shipping Fee`, `Final Total`, `Payment Status` |
| The maker | what to make, for when, in which wrap, and what to write on the card |

A row is 43 cells wide, so the maker scrolls sideways past 25 columns she will never use to reach
`Item Data`, which is raw JSON. That is the bloat — not too much data, but one surface serving three
jobs.

## The proposal in one line

Keep `Orders` exactly as it is and stop reading it by hand: make it the **database only**, written by
the Apps Script, and give the maker a separate interface that shows a dozen fields, renders
`Item Data` as a checklist, and writes back to four columns.

```text
Website → Cloudflare Worker → Apps Script → Orders sheet   (database, schema unchanged)
                                                 ↕
                                          Studio Desk       (interface, new)
                    reads 12 fields · writes Payment Status, Shipping Fee, Work Phase, Internal Notes
```

Every change she makes goes straight into that order's row — see
[How the sheet stays in step](#how-the-sheet-stays-in-step). No column is added or removed and no
formula changes.

## Settled decisions

| Decision | Choice |
| --- | --- |
| Payment | **Manual bank transfer**, no gateway. She sends the account details, she verifies the money, she marks it paid. |
| Verified total | Visible to her, as the amount to collect. |
| Buyer's WhatsApp | Visible. |
| Shipping fee | **She types it** in the Desk, for out-of-Bali orders. |
| `Shipped` / `Delivered` | **Hers to move**, like every other phase. |
| Language | **Indonesian only.** No toggle. |
| Sheet vocabulary | **English keys stay in the sheet**; Indonesian appears only in the Desk. |
| Transfer amounts | Round. No per-order unique digits. |
| Finished orders | Leave the queue **14 days** after `Selesai`; the `Selesai` filter still shows them. |

## What the interface is

Five parts, in the order she meets them. Open the prototype on a phone to try them — six example
orders, no real buyer data.

### 1. The day's load

One line: due today, overdue, waiting on payment, in progress. Small figures — the queue is the point.

### 2. The queue

One card per order, filtered by seven chips (`Semua`, `Menunggu bayar`, then the five work phases)
and sortable two ways:

- **Deadline terdekat** — by `Preferred Date`. What to touch next.
- **Pesanan pertama** — by `Submitted At`. Who has been waiting longest, which is the fair order to
  answer messages in and the one that settles "who ordered first".

A card carries the reference, buyer, due date with a plain-language countdown, a one-line summary of
what to make, when the order came in, and badges for anything unusual — `Review`, the payment state,
the current phase, the wrap colour, whether there is a card. The left edge is a colour stripe: red
overdue, amber due today, pine in progress. That is the only thing she needs to read from across the
room.

### 3. Payment — her step now

Without a gateway, payment stops being a status she reads and becomes a stage she works. It sits at
the top of the ticket, tinted amber until it clears, then collapses to one line.

- **The amount to collect** — `Verified Total` + `Shipping Fee`, with the breakdown underneath
  (produk / kartu / ongkir).
- **Ongkir** — a number field for out-of-Bali orders. Bali orders show `Rp 0` and why (Grab/Gojek is
  paid to the driver; self-pickup has no delivery).
- **Salin teks rekening** — a ready-made WhatsApp message: greeting, reference, total, the studio's
  account, and when it will be made. One tap, paste into the chat she is already in. The account
  number lives in Script Properties, never in the page.
- **Status**: `Belum bayar → Perlu dicek → Lunas`. `Perlu dicek` is the one that earns its place —
  the customer says "sudah transfer" at 11pm and the queue tells her next morning which accounts to
  open. Without it, that fact lives in her chat history.
- **Tandai lunas** asks her to confirm against the specific number ("Rp 497.000 sudah masuk ke
  rekening BCA …?") and states the rule in the dialog: check the mutasi, not a screenshot. That is
  Step 9 of `OWNER-ACTION-GUIDE.md`, enforced where the decision is made rather than in a document.

Until the ongkir is filled in there is no amount to bill, so the copy and *tandai lunas* buttons stay
disabled and say why.

### 4. The verification gate

Four checks read straight from the sheet, passing or failing on their own:

| Check | Source column | Fails when |
| --- | --- | --- |
| Payment lunas | `Payment Status` | anything other than `Paid` |
| Price verified | `Price Mismatch` | the script wrote `REVIEW` |
| Enough time left | `Preferred Date` | the date has passed (warns under the lead time) |
| Destination complete | `Location Type` + `Regency`/`Delivery Method` or `Address`/`City`/`Postal Code` | a required field is blank |

Plus one she ticks herself, on card orders only: *teks kartu sudah dibaca ulang*. An order without a
card is therefore all-automatic — **Mulai kerjakan** lights up the moment payment and price are
clean, and the button says why when it is disabled.

### 5. The build list, finishing, and phase

`Item Data` becomes one tick per line item — a whole custom bouquet is one thing to make, with its
composition as a spec line beneath it:

```text
☐  1×  Rangkaian custom
       per rangkaian: 3× Bunga Matahari · 2× Mawar · 1× Daun Pakis
☐  1×  Mini Pot Daisy
       tinggi 13 cm
```

When a bouquet is ordered more than once, a second line gives the totals (`total: 6× Gerbera ·
4× Daun Bulat`) so she can count out materials without doing the multiplication herself. Names are
the storefront's Indonesian names, not the catalogue keys `Order Summary` writes, and stem specs come
along, so the ticket doubles as the spec sheet.

Below that: the wrap with its real swatch, and the message card set in serif italic with recipient,
sender, and a copy button, because that text gets transcribed by hand. Then the five work phases —
`Belum mulai → Dirangkai dan dikemas → Siap dikirim → Dikirim → Selesai` — as a stepper with one
**Lanjut** button and a **Kembali** for mis-taps, and a notes box that writes to `Internal Notes`.

## How the sheet stays in step

Each of the four writable fields goes to the sheet the moment she changes it, and the Desk confirms
it by name ("Tersimpan ke sheet Orders · Work Phase"):

| She does | Column written |
| --- | --- |
| Marks perlu dicek / lunas | `Payment Status` |
| Types the ongkir | `Shipping Fee` |
| Taps **Lanjut** or **Kembali** | `Work Phase` |
| Types in the notes box | `Internal Notes` |

Three things make that safe:

- **Rows are found by `Order Reference`, never by row number.** Sorting or filtering the sheet cannot
  cause a write to land on the wrong order.
- **Each write takes a `LockService` lock**, the same one the order writer uses, so a write can never
  interleave with an incoming order.
- **`Final Total` needs no help.** The script already writes it as a live formula
  (`=IF(OR(Verified="",Shipping=""),"",Verified+Shipping)`), so the moment she types an ongkir, the
  final total fills itself in. Nothing recalculates it by hand.

Everything else on the row is read-only in the Desk, and the ticket's footer says so.

## What she sees, and what she doesn't

| Bucket | Columns |
| --- | --- |
| **Shown** | `Order Reference`, `Submitted At`, `Preferred Date`, `Buyer Name`, `Buyer WhatsApp`, `Location Type` + `Regency` + `Delivery Method` + `Address` + `City` + `Postal Code` (one destination line), `Item Data` (the build list), `Wrap`, `Message Card` + `Gift Message` + `Recipient Name` + `Card Sender Name` (one card block), `Verified Total` (as the amount to collect) |
| **Written by her** | `Payment Status`, `Shipping Fee`, `Work Phase`, `Internal Notes` |
| **Shown as a light, not a number** | `Price Mismatch` — a pass/fail line in the gate |
| **Owner only** | `Submitted Product Subtotal`, `Submitted Message Card Fee`, `Submitted Total`, `Verified Product Subtotal`, `Verified Message Card Fee`, `Final Total`, `Delivery Service`, `Tracking Link/Number` |
| **Never shown** | `Idempotency Key`, `Payload Hash`, `Catalog Version`, `Submitted Catalog Version`, `Language`, `Currency`, `Source`, `Acknowledged`, `Order Summary` (superseded by the build list), `Total Stems`, `Order Mode`, `Midtrans Payment Link` |

## What this costs on the sheet side

Midtrans appears nowhere customer-facing — only in the sheet and the setup guide — and no test
asserts the status strings, so the change is small:

| Change | Where |
| --- | --- |
| `Work Phase` dropdown: the middle five values collapse into one, `Cancelled` stays → `Not started`, `Assembly and packing`, `Ready for dispatch`, `Shipped`, `Delivered`, `Cancelled` | Part 1 of `CONFIGURE-SUBMISSION-ENDPOINT.md`, and the sheet's data validation |
| `Payment Status` dropdown → `Unpaid`, `Checking transfer`, `Paid`, `Cancelled` (`Expired` and `Refunded` were gateway concepts) | same |
| The default the script writes on a new row: `'Payment Status': 'Unpaid'` | one string in the Apps Script |
| One-time remap of existing rows' old phase and payment values | in the sheet |
| `Midtrans Payment Link` | now unused. Leave it — the script already writes empty. Renaming it is a separate change if you ever want the column back |

`npm test` is unaffected either way: the header row keeps all 43 columns in the same order.

## How to build it

**A Google Apps Script web app, in the same project that already writes the sheet.**

- It runs inside the account that owns the spreadsheet: no second copy of the data, no API key to
  leak, no hosting bill.
- Access is Google's own — deploy as "Execute as me, accessible to anyone with a Google account", and
  check the caller's email against a two-name allowlist in Script Properties. She signs in with the
  account she already has; the spreadsheet itself stays unshared.
- A phone-friendly page at a URL she adds to her home screen. No app store.
- Reads use the same header-lookup helpers the writer already uses, so reordering columns in the
  sheet still cannot break it.
- Roughly: `doGet()` serving one page, `listOrders()` returning the shown fields, and
  `updateOrder(ref, field, value)` writing one of the four allowed columns under a lock, with the
  allowed-field list checked server-side rather than trusted from the page.

Two alternatives, for completeness:

- **A second sheet tab with formulas.** Free and instant, but it cannot render a build list from JSON,
  cannot enforce the gate, and writing back means hand-editing rows again — the problem we are
  solving.
- **A standalone web app** (Cloudflare Pages + the Worker). More flexible long term, but it needs its
  own auth, its own deploy, and a second place where customer data lives. Not worth it for a
  two-person studio.

Optional later: move `Work Phase`, `Payment Status` and `Internal Notes` into a small `Workflow` tab
keyed by `Order Reference`, leaving `Orders` strictly append-only. Worth doing only if the
operational columns keep growing.

## If this direction is right

About a day's work: the web app (`doGet` plus two functions), the page (the prototype is most of it),
the email allowlist, the two dropdown changes, and a deploy. The existing suites are untouched, and
`tests/verify-server-pricing.js` already covers the pricing the amounts are derived from.

---

*Prototype: `mockups/studio-desk.html`. Sample orders only; the bank account in the payment message is
a placeholder. Every figure is recomputed from `Item Data` with the same formula as
`computeVerifiedTotals()` in the Apps Script, so what it shows cannot drift from what the sheet
stores. Ticks and phases are stored in that browser only — the real interface writes them to the row.*
