# Studio Desk — build guide

This document is the specification for building the Studio Desk: a phone-friendly interface that
sits on top of the existing `Orders` Google Sheet so the maker never has to open the sheet.

It is written for **two readers**:

- **A coding agent** (Claude Sonnet, high effort) — Parts 1–8. Everything it needs to build this
  without re-deriving decisions. Read the whole document before writing any code.
- **The store owner, who is not a programmer** — [Part 9](#part-9--what-the-owner-does-by-hand). Every
  click that cannot be done from code. Nothing in Parts 1–8 needs to be understood to follow Part 9.

Design rationale lives in [`STUDIO-DESK-PROPOSAL.md`](STUDIO-DESK-PROPOSAL.md). The visual and
interaction reference is [`mockups/studio-desk.html`](mockups/studio-desk.html) — a working
prototype with sample data. **Do not redesign it.** Reuse its markup, CSS and interaction logic
almost verbatim; the work is replacing its sample data and local storage with real sheet reads and
writes.

---

## Part 1 — What you are building

A **standalone Google Apps Script web app** that reads the `Orders` worksheet, shows one work ticket
per order, and writes back exactly four columns.

```text
Website → Cloudflare Worker → Apps Script "Order Writer" → Orders sheet   (existing, do not touch)
                                                                ↕
                                          Apps Script "Studio Desk" (new, standalone)
                                                                ↕
                                                  site-content.js on alxanthia.com (labels only)
```

**Standalone, not bound to the spreadsheet, and a separate project from the order writer.** A
spreadsheet can only have one bound script, the order writer already is it, and a syntax error in
Desk code must never be able to stop order intake. The Desk opens the spreadsheet with
`SpreadsheetApp.openById(...)` using an ID from Script Properties.

### Deliverables

| File | What it is |
| --- | --- |
| `STUDIO-DESK-SETUP.md` | **New.** Owner-facing setup guide in the exact style of `CONFIGURE-SUBMISSION-ENDPOINT.md`, containing the complete server code in one ```` ```javascript ```` block and the complete page in one ```` ```html ```` block, for pasting into Apps Script. Part 9 of this document is the raw material for its manual steps — expand it, don't shorten it. |
| `tests/verify-studio-desk.js` | **New.** Extracts the ```` ```javascript ```` block from that guide and exercises it in a sandbox, exactly the way `tests/verify-server-pricing.js` does for the order writer. |
| `package.json` | Add the new suite to the `test` script. |
| `CONFIGURE-SUBMISSION-ENDPOINT.md` | Two dropdown vocabularies and one default string change — see [Part 7](#part-7--changes-to-existing-files). |
| `mockups/studio-desk.html` | Leave as-is. It is the reference, not a build artifact. |

Follow the house convention: the code lives in fenced blocks inside the markdown guide, and the test
suite extracts it from there. There is no `.gs` file in this repository.

---

## Part 2 — Ground rules

These are not preferences. Breaking one is a bug.

1. **Money comes from the sheet, words come from `site-content.js`.** The Desk never recalculates a
   price. It reads `Verified Total` and `Shipping Fee` and adds them. Product *names, stem sizes,
   wrap colours and package sizes* come from `site-content.js` at runtime — see [Part 4](#part-4--the-live-catalogue).
2. **Exactly four columns are writable**, and the list is enforced on the server, never trusted from
   the page: `Payment Status`, `Shipping Fee`, `Work Phase`, `Internal Notes`. A request to write
   anything else is rejected, not ignored.
3. **Columns are found by header text, never by letter or index.** Reuse the order writer's
   approach (`readHeaders`/`headers.map` in `CONFIGURE-SUBMISSION-ENDPOINT.md`). Someone reordering
   the sheet must not break the Desk.
4. **Rows are found by `Order Reference`, never by a row number the page sent.** The page may pass a
   row number as a hint, but the server re-reads that row's reference and re-scans if it does not
   match.
5. **Indonesian only.** No language toggle, no English strings in the interface. Code comments and
   identifiers stay English, like the rest of the repo.
6. **The sheet stores English keys** (`Paid`, `Not started`). Indonesian is a display layer in the
   Desk. Never write an Indonesian value into a sheet cell.
7. **No customer data in logs.** `console.log`/`Logger.log` may record an order reference and an
   error, never a name, phone number, address or gift message.
8. **Fail visibly.** If a write fails, the page says so and puts the control back the way it was. A
   silent failure that leaves the screen looking saved is the worst outcome here.

---

## Part 3 — Server API

Three functions callable from the page via `google.script.run`, plus `doGet`.

### `doGet(e)`

Returns `HtmlService.createTemplateFromFile('Index').evaluate()` with
`.addMetaTag('viewport', 'width=device-width, initial-scale=1')` and
`.setTitle('Alxanthia Studio Desk')`. Nothing else — no data is injected into the template; the page
fetches its own data so a slow catalogue fetch cannot delay first paint.

### `listOrders()`

Reads the sheet once (`getRange(1, 1, lastRow, lastCol).getValues()` — one call, never cell by
cell) and returns an array of plain objects, newest row last. Cap the read at the last 500 data
rows.

```js
{
  ref: 'ALX-260912-K4T9',       // Order Reference
  row: 128,                      // sheet row, a hint only
  submitted: '2026-09-12 09:14', // Submitted At, formatted in TIMEZONE
  buyer: 'Ni Putu Ayu Lestari',
  wa: '+6281234567890',
  locationType: 'bali',          // 'bali' | 'luar_bali'
  regency: 'Denpasar',           // bali only
  method: 'grab_gojek',          // bali only: 'grab_gojek' | 'self_pickup'
  address: '', city: '', postal: '',   // luar_bali only
  date: '2026-09-14',            // Preferred Date, always yyyy-mm-dd
  items: [ … ],                  // Item Data, JSON.parse'd; [] if unparseable
  itemsRaw: '3× Sunflower; …',   // Order Summary, shown only if items is []
  wrap: 'sage',
  card: { to: 'Kadek Surya', from: 'Ayu', text: '…' } | null,
  verified: 497000,              // Verified Total
  shipping: 0,                   // Shipping Fee; null when the cell is blank
  mismatch: true,                // Price Mismatch is non-empty
  payment: 'Paid',               // Payment Status, English key
  phase: 'Not started',          // Work Phase, English key
  notes: ''                      // Internal Notes
}
```

Exclusions, applied server-side: rows whose `Work Phase` is `Cancelled`, and rows whose `Work Phase`
is `Delivered` and whose `Preferred Date` is more than **14 days** before today. Everything else is
returned; filtering by chip and sorting happen on the page.

Dates: `Preferred Date` may come back from Sheets as a `Date` object or a string. Normalise to
`yyyy-mm-dd` with `Utilities.formatDate(value, TIMEZONE, 'yyyy-MM-dd')` when it is a Date, and pass
through when it is already a string. `TIMEZONE` is `'Asia/Makassar'`, matching the order writer.

### `updateOrder(payload)`

```js
updateOrder({ ref: 'ALX-260912-K4T9', row: 128, field: 'phase', value: 'Assembly and packing' })
  → { ok: true, order: { …the refreshed order object… } }
  → { ok: false, code: 'STALE_ROW' | 'BAD_FIELD' | 'BAD_VALUE' | 'NOT_FOUND' | 'LOCKED', message: 'Indonesian sentence' }
```

`field` is one of `payment`, `shipping`, `phase`, `notes` — page-side names, mapped server-side to
the four column headers. Validation before any write:

- `payment` ∈ `Unpaid`, `Checking transfer`, `Paid`, `Cancelled`
- `phase` ∈ `Not started`, `Assembly and packing`, `Ready for dispatch`, `Shipped`, `Delivered`, `Cancelled`
- `shipping` — a finite number ≥ 0, or `''` to clear it. Reject anything else.
- `notes` — a string, trimmed to 1000 characters. Apply the order writer's `safeText()` guard so a
  note starting with `=`, `+`, `-` or `@` cannot become a formula.

Take `LockService.getScriptLock()` with a 10-second timeout around the read-verify-write sequence,
and return `LOCKED` if it cannot be had. Note for the implementer: this lock is per-script, so it
does **not** exclude the order writer's `appendRow`. That is safe — the writer only ever appends at
the bottom and never inserts, so an existing row's index cannot shift under the Desk mid-write. Do
not invent a cross-script locking scheme.

Return the refreshed order object so the page re-renders from server truth rather than from what it
hoped it wrote. **`Final Total` needs no attention**: the order writer already puts a live
`=IF(OR(Verified="",Shipping=""),"",Verified+Shipping)` formula in that cell, so writing
`Shipping Fee` makes the final total appear by itself. Never write that column.

### `getCatalog()`

Returns the label maps described in Part 4. The page calls it once at boot, alongside `listOrders()`.

---

## Part 4 — The live catalogue

**Requirement: renaming a flower, changing a stem length, adding a mini pot, or changing a package's
stem count in `site-content.js` must show up in the Desk without anyone editing Desk code.**

The Desk fetches `https://alxanthia.com/site-content.js`, which is one statement —
`window.ALXANTHIA_DATA = { … };` — and evaluates it against a stub `window`:

```js
var SITE_CONTENT_URL = 'https://alxanthia.com/site-content.js';
var CATALOG_CACHE_KEY = 'desk_catalog_v1';
var CATALOG_TTL_SECONDS = 21600; // 6 hours, the CacheService maximum

function getCatalog() {
  var cache = CacheService.getScriptCache();
  var hit = cache.get(CATALOG_CACHE_KEY);
  if (hit) return JSON.parse(hit);

  var props = PropertiesService.getScriptProperties();
  try {
    var res = UrlFetchApp.fetch(SITE_CONTENT_URL, { muteHttpExceptions: true, followRedirects: true });
    if (res.getResponseCode() === 200) {
      var data = (new Function('window', res.getContentText() + '\nreturn window.ALXANTHIA_DATA;'))({});
      var labels = pickLabels_(data);
      cache.put(CATALOG_CACHE_KEY, JSON.stringify(labels), CATALOG_TTL_SECONDS);
      props.setProperty('DESK_CATALOG_BACKUP', JSON.stringify(labels)); // survives a site outage
      return labels;
    }
  } catch (fetchError) {
    // fall through to the last good copy
  }

  var backup = props.getProperty('DESK_CATALOG_BACKUP');
  return backup ? JSON.parse(backup) : { stale: true, flowers: {}, pots: {}, additions: {}, packages: [], wraps: {}, minimumLeadDays: 2 };
}
```

`pickLabels_(data)` reduces `ALXANTHIA_DATA` to display labels only — it must not carry prices into
the Desk, and must read the Indonesian strings:

| Desk field | Read from |
| --- | --- |
| `flowers[key] = { name, spec }` | `flowers[key].id.name`, and `id.size` + `id.detail` joined with ` · ` |
| `pots[key] = { name, spec }` | `miniPots[].key`, `.id.name`, `'tinggi ' + heightCm + ' cm'` |
| `additions[key] = { name }` | `customAdditions[].key`, `.id.name` |
| `packages[i] = { stems }` | `packages[].stems` — index matches `Item Data`'s `{type:'package', id:'2'}` |
| `wraps[key] = { name, swatch }` | `wraps[].key`, `.swatch`, and `strings.id.wrapNames[key]` |
| `minimumLeadDays` | `minimumLeadDays` — drives the "tanggal mepet" warning |

Three requirements around it:

1. **Unknown keys never break a ticket.** An old order naming a flower that has since been removed
   renders the raw key with dashes turned into spaces. Reuse the prototype's fallback shape.
2. **A "Muat ulang katalog" control** in the Desk's footer calls a `refreshCatalog()` function that
   removes the cache key and re-fetches, so a change made on the website shows immediately instead of
   within six hours. Show the fetch time next to it ("katalog dimuat 12 Sep 09:02").
3. **A stale banner.** If `getCatalog()` fell back to the backup or the empty shape, the page shows
   one quiet line saying the catalogue could not be refreshed and names may be out of date. Never
   fail the whole screen over it — the sheet data is what matters.

Note for whoever maintains prices later: this changes nothing about the existing rule that a price
edit in `site-content.js` must be mirrored into the Apps Script `CATALOG` and `catalogVersion`
bumped. The Desk sidesteps that entirely by taking money from the sheet.

---

## Part 5 — The page

Start from `mockups/studio-desk.html`. Keep its CSS wholesale, keep its markup structure, keep its
render functions. The changes:

1. **Delete** the `ORDERS` sample array, the `CATALOG` literal, the `totals()` function and all
   `localStorage` order state. Orders and catalogue arrive from the server; money arrives with the
   order.
2. **Boot**: show a skeleton, call `getCatalog()` and `listOrders()` in parallel via
   `google.script.run.withSuccessHandler(...).withFailureHandler(...)`, then render. On failure show
   one retry button and the error, not a blank screen.
3. **Writes are optimistic with rollback.** Apply the change locally, render, call `updateOrder`. On
   success, replace the local order with the returned one and show the existing toast ("Tersimpan ke
   sheet Orders · Work Phase"). On failure, restore the previous value, re-render, and show the
   error message in place of the toast. Disable the control that is in flight so a double-tap cannot
   queue two writes.
4. **The build-list ticks and the card tick stay in `localStorage`**, keyed by order reference. They
   are bench scratch state, not business records, and they are per-device by design. Wrap every
   access in try/catch. Clear an order's ticks when its phase moves past `Ready for dispatch`.
5. **Refresh**: re-run `listOrders()` when the tab regains focus (`visibilitychange`) and on a pull
   or a manual refresh button, so two devices do not drift. Never poll on a timer.
6. **`BANK`** comes from Script Properties via `getCatalog()`'s payload (add a `bank` field to it),
   not from a literal in the page.
7. **Keep**: the seven chips, both sort orders, the colour stripes, the payment block with its
   confirmation step, the gate, the one-tick-per-line-item build list, the five-phase stepper, the
   Indonesian copy, and both themes.

Everything the prototype renders is derivable from the `listOrders()` object plus the catalogue; if
something is not, say so rather than inventing a column.

---

## Part 6 — Tests

Add `tests/verify-studio-desk.js`, modelled directly on `tests/verify-server-pricing.js`: extract the
```` ```javascript ```` block from `STUDIO-DESK-SETUP.md`, run it in a `vm` sandbox with stubs for
`SpreadsheetApp`, `PropertiesService`, `CacheService`, `LockService`, `UrlFetchApp`, `Utilities` and
`Session`, and assert:

| # | Assertion |
| --- | --- |
| 1 | `listOrders()` maps a known fixture row to the documented object shape, with `shipping: null` for a blank cell |
| 2 | A `Delivered` row 20 days past its date is excluded; one 5 days past is included |
| 3 | A `Cancelled` row is excluded |
| 4 | A row whose `Item Data` is malformed JSON returns `items: []` and a non-empty `itemsRaw`, rather than throwing |
| 5 | `updateOrder` with `field: 'verified'` (or any column outside the four) returns `BAD_FIELD` and writes nothing |
| 6 | `updateOrder` with `phase: 'Selesai'` (an Indonesian label) returns `BAD_VALUE` and writes nothing |
| 7 | `updateOrder` with a stale `row` still writes the correct row, located by reference |
| 8 | `updateOrder` with a reference that no longer exists returns `NOT_FOUND` |
| 9 | `updateOrder` with `notes: '=SUM(A1:A9)'` stores it prefixed so Sheets cannot evaluate it |
| 10 | `updateOrder` never touches `Final Total` — assert the stubbed range was not written |
| 11 | `getCatalog()` parses a fixture copy of `site-content.js` into the Part 4 shape, with no price fields present |
| 12 | `getCatalog()` returns the backup copy when the fetch returns 500, and sets no cache entry |
| 13 | An `Item Data` entry naming an unknown flower key renders a humanised fallback name, not a crash |

Use a trimmed copy of the real `site-content.js` as the fixture for 11–13 — read the real file from
the repository root so the fixture cannot drift from the site.

Then add the suite to `package.json`'s `test` script, after `verify-worker.js`. `npm test` must pass.

---

## Part 7 — Changes to existing files

Small, and all in `CONFIGURE-SUBMISSION-ENDPOINT.md`:

1. **Part 1's `Work Phase` dropdown list** becomes exactly:

   ```text
   Not started
   Assembly and packing
   Ready for dispatch
   Shipped
   Delivered
   Cancelled
   ```

2. **Part 1's `Payment Status` dropdown list** becomes exactly:

   ```text
   Unpaid
   Checking transfer
   Paid
   Cancelled
   ```

3. **In the Apps Script block**, `'Payment Status': 'Awaiting confirmation'` becomes
   `'Payment Status': 'Unpaid'`. `'Work Phase': 'Not started'` is already correct.

4. **Add a short note** in Part 1 explaining that `Midtrans Payment Link` is unused now that payment
   is by manual transfer; it stays in the header row so the column layout does not change.

5. Add a line to `OWNER-ACTION-GUIDE.md`'s Step 9 pointing at the Desk as where payment is now
   confirmed.

Do not change the header row, the column order, or any pricing logic.

---

## Part 8 — Definition of done

- `npm test` passes, including the new suite.
- `STUDIO-DESK-SETUP.md` contains the complete server code and page, and someone who has never seen
  this repository can follow it end to end.
- Every one of Part 2's eight ground rules holds, and Part 6's thirteen assertions pass.
- The Desk renders correctly at 400px wide and in both light and dark themes.
- Nothing under `dist/`, `app.js`, `index.html`, `styles.css` or `site-content.js` changed.

---

## Part 9 — What the owner does by hand

Everything in this part has to be clicked by a person — no code can do it. Do them in order. You do
not need to understand any of the code; just copy and paste exactly what the setup guide tells you.

### 9.1 Before the agent starts — get the spreadsheet ID

1. Open your **Alxanthia Orders** spreadsheet.
2. Look at the address bar. The link looks like:
   `https://docs.google.com/spreadsheets/d/`**`1a2B3c4D5e6F7g8H9i0J`**`/edit#gid=0`
3. The bold middle part is the **spreadsheet ID**. Copy it into a note — you will paste it in step 9.4.

### 9.2 Update the two dropdown lists in the sheet

The words the Desk uses for work stage and payment are changing. Old rows keep their old words until
you fix them, and the Desk cannot show a stage it does not recognise.

1. In the sheet, click the **Work Phase** column header to select the column.
2. **Data → Data validation**, click the existing rule, and replace the list with exactly these six
   lines:

   ```text
   Not started
   Assembly and packing
   Ready for dispatch
   Shipped
   Delivered
   Cancelled
   ```

3. Click the **Payment Status** column header and do the same with exactly these four:

   ```text
   Unpaid
   Checking transfer
   Paid
   Cancelled
   ```

4. Now fix the orders already in the sheet. Scroll through the `Work Phase` column and change any old
   value to its nearest new one:

   | Old value | Change it to |
   | --- | --- |
   | Materials prepared, Flowers being made, Bouquet assembly, Quality check, Packed | Assembly and packing |
   | Awaiting payment | *(payment column)* Unpaid |
   | Awaiting confirmation | *(payment column)* Checking transfer |
   | Expired, Refunded | *(payment column)* Cancelled |

   Anything already reading `Not started`, `Ready for dispatch`, `Shipped`, `Delivered`, `Paid` or
   `Cancelled` stays as it is.

### 9.3 Share the spreadsheet with her

The Desk runs as *her*, so Google itself decides whether she is allowed in. That is the safest
arrangement: nobody can use the Desk who cannot already open the sheet.

1. Click **Share** in the top right of the spreadsheet.
2. Add her Google account email, set it to **Editor**, and send.
3. Confirm the sheet is still **not** "Anyone with the link" — it must stay restricted to named
   people.

Because she now has sheet access, re-check the protected columns: **Data → Protect sheets and
ranges** should still restrict `Verified Product Subtotal`, `Verified Message Card Fee`,
`Verified Total` and `Final Total` to you only. The Desk never writes those, but this stops an
accidental edit if she ever opens the sheet directly.

### 9.4 Create the Studio Desk script

1. Go to <https://script.google.com> and click **New project** (top left).
2. Rename it **Alxanthia Studio Desk** (click the title).
3. Delete the sample `myFunction` code.
4. Paste in the big code block from `STUDIO-DESK-SETUP.md`, then save (the disk icon).
5. Click the **+** next to *Files*, choose **HTML**, name it exactly `Index` (no `.html`), delete
   what is there, paste in the page block from the setup guide, and save.

### 9.5 Add the settings

In the same project, click the gear (**Project Settings**) in the left sidebar, scroll to **Script
Properties**, and click **Add script property** for each of these:

| Property | Value |
| --- | --- |
| `SPREADSHEET_ID` | the ID you copied in 9.1 |
| `DESK_ALLOWED_EMAILS` | her Google email and yours, separated by a comma |
| `BANK_NAME` | e.g. `BCA` |
| `BANK_NUMBER` | your studio account number |
| `BANK_HOLDER` | the account holder name |

Save. Changing the bank details later means editing these values — never the code.

### 9.6 Publish it

1. Top right: **Deploy → New deployment**.
2. Click the gear next to *Select type* and choose **Web app**.
3. Fill in:
   - **Description**: `v1`
   - **Execute as**: **User accessing the web app** ← this one matters; the default is wrong
   - **Who has access**: **Anyone with a Google account**
4. Click **Deploy**.
5. Google will ask for permission. You will see a warning screen saying *"Google hasn't verified this
   app"* — that is normal for a private script you wrote yourself. Click **Advanced**, then **Go to
   Alxanthia Studio Desk (unsafe)**, then **Allow**. It is your own script accessing your own sheet.
6. Copy the **Web app URL** that ends in `/exec`. That is the Desk.

### 9.7 Put it on her phone

Send her the `/exec` link, then walk her through adding it to her home screen so it opens like an app:

- **iPhone (Safari)**: open the link → the share button at the bottom → **Add to Home Screen**.
- **Android (Chrome)**: open the link → the ⋮ menu top right → **Add to Home screen**.

The first time she opens it, Google will ask her to sign in and approve the same permission screen
from step 9.6. She will see the same "hasn't verified this app" warning and the same **Advanced → Go
to … → Allow** path.

### 9.8 Check it works

Place one test order on the website, then on the Desk confirm:

- The new order appears in the queue with the right buyer, date and flowers.
- **Salin teks rekening** produces a message with the right total and your account number.
- Marking it *perlu dicek* and then *lunas* changes `Payment Status` in the sheet within a second.
- Typing an ongkir on an out-of-Bali order fills in `Final Total` in the sheet by itself.
- **Lanjut** changes `Work Phase` in the sheet.
- A note typed in the Desk appears in `Internal Notes`.
- Changing a flower's name in `site-content.js`, deploying the website, then tapping **Muat ulang
  katalog** shows the new name on the Desk.

Then delete the test row from the sheet.

### 9.9 Two things to remember afterwards

1. **Any code change needs a redeploy.** Editing the script is not enough: **Deploy → Manage
   deployments → edit (pencil) → Version: New version → Deploy**. The `/exec` link stays the same, so
   nothing on her phone needs changing.
2. **The Desk is the place to mark an order paid** — not the sheet. It is the only screen that shows
   the exact amount to check against, and the rule is still the one from
   `OWNER-ACTION-GUIDE.md` Step 9: confirm the money in your bank's mutasi, never from a screenshot.
