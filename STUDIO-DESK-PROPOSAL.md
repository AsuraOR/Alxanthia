# Studio Desk — a maker's interface on top of the Orders sheet

**Status:** proposal. Nothing in this document is built yet; the clickable prototype in
`mockups/studio-desk.html` exists so the layout can be judged before any code is written.

## The problem

The `Orders` worksheet has 43 columns. They were designed for three different readers at once:

| Reader | What they actually need |
| --- | --- |
| The script | `Idempotency Key`, `Payload Hash`, `Catalog Version`, `Submitted …` — deduplication and tamper diagnostics |
| The owner | money and logistics: `Verified Total`, `Shipping Fee`, `Final Total`, `Midtrans Payment Link`, `Payment Status`, `Delivery Service`, `Tracking Link/Number` |
| The maker | what to make, for when, in which wrap, and what to write on the card |

A row is 43 cells wide, so the maker scrolls sideways past 25 columns she will never use to reach
`Item Data`, which is raw JSON. That is the bloat — not too much data, but one surface serving three
jobs.

## The proposal in one line

Keep `Orders` exactly as it is and stop reading it by hand: make it the **database only**, written by
the Apps Script, and give the maker a separate read-mostly **interface** that shows twelve fields,
renders `Item Data` as a checklist of things to make, and writes back only two columns.

```text
Website → Cloudflare Worker → Apps Script → Orders sheet   (database, unchanged)
                                                 ↓ reads
                                          Studio Desk       (interface, new)
                                                 ↑ writes Work Phase + Internal Notes only
```

No column is removed, no formula changes, the existing tests keep passing. The sheet stops being a
workplace and becomes what it already is: storage.

## What the interface is

Five parts, in the order she meets them. Open `mockups/studio-desk.html` (or the published
prototype) on a phone to try them — it ships with six example orders, no real buyer data.

### 1. The day's load

One line at the top: how many orders are due today, how many are overdue, how many are waiting to be
verified, how many are in her hands. Small figures, not a dashboard — the queue below is the point.

### 2. The queue

One card per order, sorted by preferred date, filtered by five chips (All / Not started / In progress
/ Ready to ship / Finished). A card carries: reference, buyer, the date with a plain-language
countdown ("2 hari lagi"), a one-line summary of what to make, and badges for anything unusual —
`REVIEW`, an unpaid order, the current work phase, the wrap colour, whether there is a card.

The left edge of each card is a colour stripe: red overdue, amber due today, pine in progress. That
is the only thing she needs to read from across the room.

### 3. The verification gate

Tapping a card opens the work ticket, which opens with a check — the step that is currently in her
head. Four checks are read straight from the sheet and pass or fail on their own:

| Check | Source column | Fails when |
| --- | --- | --- |
| Payment confirmed | `Payment Status` | anything other than `Paid` |
| Price verified | `Price Mismatch` | the script wrote `REVIEW` |
| Enough time left | `Preferred Date` | the date has passed (warns when under the lead time) |
| Destination complete | `Location Type` + `Regency`/`Delivery Method` or `Address`/`City`/`Postal Code` | a required field is blank |
| Shipping fee filled in *(out-of-Bali only)* | `Shipping Fee` | still blank — that is the owner's field, not hers |

Then two she ticks herself: materials in stock, and card text read back once (shown only when there
is a card).

**Start making** stays disabled until all of them are green, and the button says why it is disabled.
This is the whole point of the interface: today, "is this order safe to start?" is a judgement she
has to make by scanning a wide row and remembering the rule about `REVIEW`. Here it is a gate that
cannot be walked past by accident, and Step 9 of `OWNER-ACTION-GUIDE.md` ("never mark Paid on a
screenshot") is enforced by the layout rather than by memory.

### 4. The build list

`Item Data` is parsed and rendered as a checklist she can tick off at the bench, grouped the way she
works:

```text
CUSTOM BOUQUET
  3×  Bunga Matahari    45 cm · kepala 12 cm
  2×  Mawar             40 cm · kepala melingkar
LEAF ADDITIONS
  1×  Daun Pakis
MINI POT
  1×  Mini Pot Daisy    tinggi 13 cm
```

Three details matter here:

- **Quantities are multiplied out.** An order for 2× a bouquet of 3 Gerbera shows `6× Gerbera`, not
  `2× custom bouquet`. She makes six flowers.
- **Names are the storefront's names, in her language**, not the catalogue keys `Order Summary`
  writes (`3× Sunflower`). The interface holds the same label table as `site-content.js`.
- **Stem specs come along** — 45 cm stem, 12 cm head — so the ticket is also the spec sheet.

Below it, finishing: wrap colour with its real swatch, total stems, order type, verified total, and
the message card set as a card — the exact text in a serif italic, recipient and sender underneath,
and a copy button, because that text must be transcribed exactly.

### 5. The work phase

The ten `Work Phase` values you already have, as a stepper with one button: *Next: Bunga dibuat*.
The last two (`Shipped`, `Delivered`) are marked as the owner's, since they follow the courier, not
the bench. Below that, a notes box that writes to `Internal Notes`.

This is the only thing the interface writes back, which is what keeps the sheet trustworthy: a
mis-tap can change a phase or a note, never a price, an address, or a total.

## What she sees, and what she doesn't

| Bucket | Columns |
| --- | --- |
| **Shown to the maker** (12 fields, some rendered together) | `Order Reference`, `Preferred Date`, `Buyer Name`, `Buyer WhatsApp`, `Location Type` + `Regency` + `Delivery Method` + `Address` + `City` + `Postal Code` (as one destination line), `Item Data` (as the build list), `Total Stems`, `Wrap`, `Message Card` + `Gift Message` + `Recipient Name` + `Card Sender Name` (as one card block), `Verified Total` (one read-only figure), `Work Phase` (writable), `Internal Notes` (writable) |
| **Shown as a light, not a number** | `Payment Status`, `Price Mismatch`, `Shipping Fee` — pass/fail lines in the gate |
| **Owner only** | `Submitted Product Subtotal`, `Submitted Message Card Fee`, `Submitted Total`, `Verified Product Subtotal`, `Verified Message Card Fee`, `Final Total`, `Midtrans Payment Link`, `Delivery Service`, `Tracking Link/Number` |
| **Never shown to anyone** | `Idempotency Key`, `Payload Hash`, `Catalog Version`, `Submitted Catalog Version`, `Submitted At`, `Language`, `Currency`, `Source`, `Acknowledged`, `Order Summary` (superseded by the rendered build list) |

If you would rather she not see totals or phone numbers at all, both are single lines to remove — the
buckets above are a starting point, not a constraint.

## How to build it

**Recommended: a Google Apps Script web app, in the same project that already writes the sheet.**

- It runs inside the account that owns the spreadsheet, so there is no second copy of the data, no
  API key to leak, and no new hosting bill.
- Access is Google's own: deploy as "Execute as me, accessible to anyone with a Google account", and
  check the caller's email against a two-name allowlist in Script Properties. She signs in with the
  Google account she already has; nobody else gets in, and the spreadsheet itself stays unshared.
- It is a phone-friendly page at a URL she can add to her home screen — no app store, no install.
- Reads use the same header-lookup helpers the writer already uses, so reordering columns in the
  sheet still cannot break it.
- Roughly: `doGet()` serving one HTML page, `listOrders()` returning the twelve fields for open
  orders, `setPhase(ref, phase)` and `setNote(ref, text)` writing back with a `LockService` lock and
  a re-read of the row's reference before writing (so a sorted or filtered sheet can't cause a write
  to the wrong row).

Two alternatives, for completeness:

- **A second sheet tab with formulas** (`=FILTER(Orders!…)`). Free and instant, but it cannot render
  a build list from JSON, cannot enforce the gate, and writing back means hand-editing rows again —
  which is the problem we are solving.
- **A standalone web app** (Cloudflare Pages + the Worker). More flexible long term, but it needs its
  own auth, its own deploy, and a second place where customer data lives. Not worth it for a
  two-person studio.

Optional later: move `Work Phase` and `Internal Notes` out of `Orders` into a small `Workflow` tab
keyed by `Order Reference`. Then `Orders` becomes strictly append-only — written by the script,
never by a person — and the operational state lives beside it. Worth doing only if you find yourself
wanting a second operational field; phase 1 works fine without it.

## Decisions for you

1. **Totals** — should she see `Verified Total`? (Useful for self-pickup, arguably not her business.)
2. **Phone numbers** — the ticket shows the buyer's WhatsApp so she can ask about a colour. Keep,
   or hide behind a tap?
3. **Who moves an order to `Shipped`/`Delivered`** — the prototype assumes you do.
4. **Language** — the prototype defaults to Indonesian with an EN toggle. Keep the toggle or drop it?
5. **Retention** — `OWNER-ACTION-GUIDE.md` Step 1b sets 12 months. The interface should probably stop
   listing an order some weeks after `Delivered`, so the queue doesn't grow forever. What window?

## If this direction is right

Building it is about a day's work: the Apps Script web app (`doGet`, three functions), the HTML page
(the prototype is most of it), the email allowlist, and a deploy. The existing `npm test` suites are
untouched — the sheet's schema doesn't change — and the server-side suite in
`tests/verify-server-pricing.js` already covers the pricing the build list is derived from.

---

*Prototype: `mockups/studio-desk.html`. Sample orders only; no real buyer data. Every figure in it is
recomputed from `Item Data` with the same formula as `computeVerifiedTotals()` in the Apps Script, so
what it shows cannot drift from what the sheet stores.*
