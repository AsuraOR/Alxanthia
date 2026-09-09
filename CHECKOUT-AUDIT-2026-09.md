# Checkout system audit — remediation spec

Audit date: 2026-09-09. Scope: the full order path — browser form (`index.html`,
`app.js`) → Cloudflare Worker → Google Apps Script → Google Sheet, as specified in
[`CONFIGURE-SUBMISSION-ENDPOINT.md`](CONFIGURE-SUBMISSION-ENDPOINT.md) and
[`CHECKOUT-SETUP.md`](CHECKOUT-SETUP.md).

State at audit time: endpoint configured (`site-content.js:42`), all 24 test suites
in `tests/verify-ordering.js` passing. The live Worker was **not** reachable from the
audit sandbox, so every finding below comes from reading code and docs, not from
probing production.

---

## How to use this document

**Part A** items can be completed by an AI coding agent working in this repository.
**Part B** items cannot — they need a human in the Google Sheets UI, the Apps Script
editor, or the Cloudflare dashboard, or they are business decisions.

Several items are **split**: the agent rewrites the code block inside
`CONFIGURE-SUBMISSION-ENDPOINT.md`, and a human then copies that block into Apps
Script or Cloudflare and redeploys. Those are marked `SPLIT` and appear in both parts.

### Rules for the agent

1. Work on branch `claude/checkout-system-audit-sulluj`.
2. `npm test` must pass after every item. All 24 existing suites must stay green — do
   not weaken an assertion to make a change fit.
3. The Apps Script and Worker code live **only** as fenced code blocks inside
   `CONFIGURE-SUBMISSION-ENDPOINT.md`. Editing them changes documentation, not
   running production code. Never claim an endpoint fix is "deployed".
4. Do not put secrets, the Apps Script `/exec` URL, or Cloudflare tokens in this
   repository. The public Worker URL in `site-content.js:42` is fine and stays.
5. Prefer the smallest change that fixes the stated defect. Do not refactor
   surrounding code.
6. Items are ordered by priority within each part. A1–A4 are the ones that cause
   visible breakage today.

---

# Part A — an AI agent can fix these

## A1. `appendRow` destroys the Final Total formula on every order `SPLIT` `bug`

**Where:** `CONFIGURE-SUBMISSION-ENDPOINT.md:100-120` (the `appendRow` call in `doPost`).

**Problem.** Part 1 of the guide instructs the owner to enter
`=IF(AA2="","",AA2+IF(AB2="",0,AB2))` in cell `AC2` (Final Total) and copy it down the
column. Part 2's `appendRow` writes 35 values, and value #29 is a literal `''` —
that is column `AC`. Counting the array against the header row:

| # | Column | Header | appendRow value |
|---|--------|--------|-----------------|
| 27 | `AA` | Estimated Product Total | `safeNumber(order.estimated_product_total)` |
| 28 | `AB` | Shipping Fee | `''` — correct, staff fills this |
| 29 | `AC` | **Final Total** | `''` — **wrong, this is a formula column** |

Both possible states of the sheet are broken:

- Formula copied down only a few rows → `appendRow` appends *past* the formula block,
  and Final Total is permanently blank for real orders.
- Formula copied down many rows → `getLastRow()` counts those rows as occupied, so the
  first real order lands below all of them, leaving a large blank gap, and still gets
  no formula.

This also contradicts `CHECKOUT-SETUP.md` ("protect `Final Total`") and
`revisions/komorebi-checkout-implementation-plan.md:460` ("Protect formula columns such
as `Final Total`"). A protected column and a script that writes `''` into it cannot
both be right.

**Fix.** Keep the array at 35 values so column alignment is preserved, then set the
formula on the row that was just appended. Inside the lock, after `appendRow`:

```javascript
sheet.appendRow([ /* ...unchanged, still 35 values... */ ]);
const newRow = sheet.getLastRow();
sheet.getRange(newRow, 29).setFormula(
  '=IF(AA' + newRow + '="","",AA' + newRow + '+IF(AB' + newRow + '="",0,AB' + newRow + '))'
);
```

Then update Part 1 of the guide: the owner should enter the formula in `AC2` **only if
they want a worked example**, and must not copy it down an empty range. Reword step so
it reads that the script writes the Final Total formula per row automatically.

**Verify.** Not verifiable from this repo. See B1.

---

## A2. `preferred_date` accepts dates in the past `bug`

**Where:** `index.html:899` (no `min` attribute), `CONFIGURE-SUBMISSION-ENDPOINT.md:135-141`
(`validateOrder` only checks the field is non-empty).

**Problem.** A buyer can select a date that has already passed and the order is stored
without complaint. There is also no enforcement of production lead time.

**Fix, client side.** Set `min` when the form step is revealed, not at page load — a
tab left open overnight would otherwise carry a stale minimum. In `app.js`, inside the
`checkout-continue` click handler in `initCheckout` (`app.js:2670-2677`), after
`localizeCheckoutForm()`:

```javascript
const dateInput = document.querySelector('#checkout-form [name="preferred_date"]');
if (dateInput) {
  const lead = new Date();
  lead.setDate(lead.getDate() + (siteData.store.minLeadDays ?? 3));
  dateInput.min = [
    lead.getFullYear(),
    String(lead.getMonth() + 1).padStart(2, '0'),
    String(lead.getDate()).padStart(2, '0')
  ].join('-');
}
```

Build the string from local date parts as shown. Do **not** use `toISOString()` — the
studio is UTC+7, so that would produce yesterday's date for any order placed before
07:00 local.

Add `minLeadDays` to the `store` block in `site-content.js` with a default the owner
can change without touching `app.js`. Confirm the value with the owner (see B6) — `3`
above is a placeholder, not a researched number.

**Fix, server side.** In `validateOrder`, after the existing required-field loop:

```javascript
if (!/^\d{4}-\d{2}-\d{2}$/.test(order.preferred_date)) throw new Error('Invalid preferred date.');
```

Keep the server check to format only. A strict server-side lead-time check would reject
legitimate orders around midnight and during clock skew; the client `min` is the right
place for the business rule, and the studio confirms every date over WhatsApp anyway.

**Verify.** Add a test asserting the `min` attribute is set on the date input after the
continue handler runs, and that it is at least today's date.

---

## A3. WhatsApp message labels the discounted total as "subtotal" `bug`

**Where:** `app.js:319-320`.

**Problem.** Both language branches print the label "Product subtotal" /
"Subtotal produk" with the value `formatRp(state.estimatedProductTotal)`. Per
`app.js:298-300`, `estimatedProductTotal` is `subtotal − discount + wrapFee`, while the
actual subtotal is the separate `productSubtotal` field. Any customer with a bulk
discount on a custom bouquet sees a number labelled "subtotal" that is not the subtotal,
in the message that opens the payment conversation.

**Fix.** Change the label, not the value — the estimated total is the more useful number
to send:

- English: `Product subtotal:` → `Estimated product total:`
- Indonesian: `Subtotal produk:` → `Estimasi total produk:`

This matches the wording already used on the review screen (`app.js:2569`).

**Verify.** Suite 24 asserts `submittedMessage24.includes('Rp 60.000')`, which stays
true. Add an assertion that a cart with a discount produces a message whose label
matches the value being sent.

---

## A4. Cart is not cleared after a recorded order `bug`

**Where:** `app.js:2580-2593` (`showRecordedOrder`).

**Problem.** `showRecordedOrder` sets `checkoutAttempt.submitted = true` but leaves
`cart` untouched. After a successful order the buyer closes the modal, sees the same
items still in the sticky order bar, and reopening the review mints a **new** reference
(`app.js:2546`) for the identical basket. Two references, one intended order, no signal
in the sheet that they are the same.

**Fix.** Clear the cart once storage is confirmed. In `showRecordedOrder`, after
`checkoutAttempt.submitted = true`, reset `cart`, `orderNote`, and `customCounts` to
their empty state and call `renderAll()`. `checkoutAttempt.state` is already captured
by value at `app.js:2547`, so the success screen and the WhatsApp link keep rendering
the completed order correctly — verify this before shipping, as the success panel reads
`checkoutAttempt.state` at `app.js:2586` and `2592`.

Note the ordering constraint: `renderAll()` may re-render the modal region. Clear the
cart *after* the success panel's fields are populated, or confirm rendering does not
overwrite `#checkout-success`.

**Verify.** Add a test: submit successfully, then assert `getCart()` is empty and the
success reference still matches the submitted reference.

---

## A5. Duplicate submissions are silently swallowed `SPLIT` `bug`

**Where:** `CONFIGURE-SUBMISSION-ENDPOINT.md:104-106` (`findOrderRow` early return),
`app.js:2652-2655` (client ignores the `duplicate` flag).

**Problem.** `CHECKOUT-SETUP.md` requirement 6 says repeated references must be
"idempotent **or flag them for review**". The script is idempotent and flags nothing.
The realistic failure: submission succeeds, the response is lost on a flaky mobile
connection, the buyer corrects a typo in their address and submits again. The reference
is unchanged (`app.js:2546` only regenerates after `submitted`), so the second payload
is discarded, the buyer sees the success screen, and the studio ships to the old
address.

The Worker already relays `duplicate: true`, and `app.js:2654` reads `result.ok` and
`result.order_reference` but never `result.duplicate`.

**Fix, Apps Script.** Replace the early return so it records that a retry arrived,
writing to Internal Notes (column 35) on the existing row:

```javascript
const existingRow = findOrderRow(sheet, order.order_reference);
if (existingRow) {
  const notesCell = sheet.getRange(existingRow, 35);
  const previous = String(notesCell.getValue() || '');
  notesCell.setValue((previous ? previous + '\n' : '') +
    'Duplicate submission received ' + new Date().toISOString() + ' — re-check details with buyer.');
  return jsonResponse({ ok: true, order_reference: order.order_reference, duplicate: true });
}
```

**Fix, client.** In `submitWebsiteOrder`, pass the flag through to `showRecordedOrder`
and, when `result.duplicate === true`, add a line to the success copy telling the buyer
this reference was already recorded and to mention any corrections in the WhatsApp
message. Both languages.

**Verify.** Client half is testable (see A9). Apps Script half is not — see B1.

---

## A6. Server-side validation is weaker than the browser form `SPLIT` `security`

**Where:** `CONFIGURE-SUBMISSION-ENDPOINT.md:135-152` (`validateOrder`).

**Problem.** The form is the untrusted half of this system, so every constraint it
enforces must be re-enforced server side. Currently:

| Field | Browser | Apps Script |
|-------|---------|-------------|
| `buyer_whatsapp` | `pattern="[+0-9 ()-]{8,20}"` | same regex — correct |
| `recipient_whatsapp` | `pattern="[+0-9 ()-]{8,20}"` (`index.html:890`) | **truthy only** |
| `recipient_contact_permission` | 4 fixed options (`index.html:891`) | **truthy only** |
| `preferred_window` | 4 fixed options (`index.html:899`) | **unchecked** |
| `postal_code` | `inputmode="numeric"`, no pattern | **non-empty only** |

**Fix.** In `validateOrder`, extend the gift branch and add the missing checks:

```javascript
if (order.order_for === 'gift') {
  if (!/^[+0-9 ()-]{8,20}$/.test(order.recipient_whatsapp)) throw new Error('Invalid recipient WhatsApp number.');
  if (!['yes', 'buyer_first', 'surprise'].includes(order.recipient_contact_permission)) throw new Error('Invalid recipient contact permission.');
}
if (!/^\d{5}$/.test(String(order.postal_code).trim())) throw new Error('Invalid postal code.');
if (order.preferred_window && !['morning', 'afternoon', 'evening'].includes(order.preferred_window)) {
  throw new Error('Invalid preferred window.');
}
```

Indonesian postal codes are 5 digits, which is why `/^\d{5}$/` is safe here. Also add
`pattern="[0-9]{5}"` to the postal input at `index.html:897` so the buyer gets the error
in the form rather than as a generic save failure.

Keep the existing truthy check on `recipient_name`.

**Verify.** Client-side postal pattern is testable. Server half — see B1.

---

## A7. Data collected but never stored `SPLIT` `data`

**Where:** `CONFIGURE-SUBMISSION-ENDPOINT.md:112-119` (appendRow), Part 1 header row.

**Problem.** Four fields are sent by the browser and, in one case, validated as
mandatory, then dropped:

- `acknowledgement` — `validateOrder` throws without it, but there is no column and
  `appendRow` never writes it. There is no record that a customer accepted the
  "production starts after payment is confirmed" terms. This is the one that matters if
  an order is ever disputed.
- `submitted_language` — needed to know whether to reply in Indonesian or English.
- `currency` and `source` — low value now, useful if a second sales channel is added.

**Fix.** Extend the header row in Part 1 with four columns after Internal Notes
(`AJ`–`AM`): `Acknowledged`, `Language`, `Currency`, `Source`. Append the matching
values to `appendRow`:

```javascript
order.acknowledgement ? 'Yes' : 'No',
safeText(order.submitted_language),
safeText(order.currency),
safeText(order.source)
```

Adding at the end keeps every existing column letter stable, so the `AA`/`AB`/`AC`
formula in A1 and the `35` index in A5 stay correct. Do not insert columns in the
middle.

**Verify.** Not verifiable from this repo. See B2.

---

## A8. `anonymous_gift` is stored as `"on"` or blank `polish`

**Where:** `index.html:904`, `app.js:324-327` (`buildOrderSubmission`).

**Problem.** An unchecked checkbox is absent from `FormData` entirely, so
`buildOrderSubmission` never sets the key and the sheet cell is empty; when checked, the
browser submits the string `"on"`. The Anonymous Gift column therefore reads `on` or
blank rather than a real yes/no — a column that gets read under time pressure while
packing.

**Fix.** Normalise in `buildOrderSubmission` so the payload is explicit regardless of
checkbox state:

```javascript
anonymous_gift: formData.get('anonymous_gift') ? 'Ya' : 'Tidak',
```

Place it after the `...customer` spread so it overrides the raw value. Note that the
tests pass a `Map` shim for `formData` (`tests/verify-ordering.js:1409-1410`) which
supports `.get()`, so this is test-compatible — confirm before relying on it.

**Verify.** Extend suite 24 to assert both states produce `'Ya'` / `'Tidak'`.

---

## A9. No test coverage for the submission call itself `test`

**Where:** `tests/verify-ordering.js` suite 24 covers `buildOrderSubmission`,
`generateOrderReference`, and `buildPostSubmissionWhatsApp`, but nothing exercises
`submitWebsiteOrder` (`app.js:2631-2663`).

**Problem.** The six failure branches most likely to break silently in production are
all untested: missing endpoint, non-2xx response, non-JSON body, `ok: false`, reference
mismatch, and the button disable/re-enable in `finally`.

**Fix.** Add suite 25. Requirements:

- `submitWebsiteOrder` is not currently on the `window.KomorebiApp` export at
  `app.js:2790-2845`. Export it, or export a thin seam that lets a test drive it.
- Stub `fetch` on the sandbox global. The harness is a hand-rolled DOM mock in a `vm`
  context (`tests/verify-ordering.js:1-45`), not jsdom, so add `fetch` to the context
  object rather than reaching for a library.
- The mock element needs `disabled` and `textContent` to round-trip for the button
  assertions. Check whether `createMockElement` already supports this before adding.
- Assert for each branch: the error element carries the right message in the right
  language, the success panel is shown only on the success path, and the button is
  re-enabled with its original label in every case.

**Verify.** `npm test` reports 25 suites passing.

---

## A10. Small cleanups `polish`

- **`app.js:2657`** — the failure message tells the buyer to contact the studio *before*
  trying again, but the button re-enables immediately in `finally`. Since the reference
  is stable across retries and the server is idempotent, one retry is safe. Track
  attempts on `checkoutAttempt` and show the softer "please try again" copy on the
  first failure, reserving the contact-the-studio wording for the second.
- **`CONFIGURE-SUBMISSION-ENDPOINT.md:228`** — the Worker returns the Apps Script's raw
  `result.error` to the browser, surfacing internal strings like
  `"Orders worksheet was not found."` to any caller. Replace with a fixed generic
  message; the detail is already in the Worker log.
- **`CONFIGURE-SUBMISSION-ENDPOINT.md:206-212`** — no `Access-Control-Max-Age` header,
  so every submission pays for a preflight round trip. Add
  `'Access-Control-Max-Age': '86400'`.
- **`CONFIGURE-SUBMISSION-ENDPOINT.md:220`** — a non-JSON body throws and is reported as
  `502 "Order could not be stored"`. It is a client error; return `400`.
- **`CONFIGURE-SUBMISSION-ENDPOINT.md:88-90`** — the webhook secret comparison is not
  constant-time and Apps Script returns HTTP 200 even for `Unauthorized`. Negligible
  risk over this transport given network jitter. Noted for completeness; fix only if
  touching that function anyway.

---

# Part B — an AI agent cannot fix these

An agent has no access to the Google Sheet, the Apps Script editor, the Cloudflare
dashboard, or your DNS. It also should not make pricing and policy calls on your behalf.

## B1. Deploy the Apps Script changes `blocks A1, A5, A6`

Fixes A1, A5, and A6 are all rewrites of the `doPost` / `validateOrder` code that lives
in the Apps Script editor. The agent can only update the code block in the guide.

You must:

1. Open the spreadsheet → **Extensions → Apps Script**.
2. Replace the script with the updated block from `CONFIGURE-SUBMISSION-ENDPOINT.md`.
3. Re-enter your real `WEBHOOK_SECRET` — the guide's copy is a placeholder, and pasting
   over the file wipes the real value.
4. **Deploy → Manage deployments → edit the existing deployment → New version.** Do not
   create a *new deployment*; that mints a different `/exec` URL and your Worker would
   keep calling the old one.
5. Place one test order and confirm the Final Total cell now shows a formula.

Nothing about A1 can be verified from this repository. It is the highest-priority item
and it is entirely in your hands.

## B2. Add the four columns to the Orders sheet `blocks A7`

Add `Acknowledged`, `Language`, `Currency`, `Source` in `AJ1`–`AM1`, in that order, to
the right of Internal Notes. Do this **before** deploying the A7 script change, and do
not insert them mid-sheet — every column letter in the script and in the Final Total
formula depends on current positions.

## B3. Decide and configure abuse protection `security` — cannot be fully automated

**The finding.** The Worker's `origin !== env.ALLOWED_ORIGIN` check
(`CONFIGURE-SUBMISSION-ENDPOINT.md:215`) stops other websites' browsers and nothing
else. `Origin` is a request header; anyone can set it:

```
curl -X POST -H 'Origin: https://komorebicreations.com' -H 'Content-Type: application/json' \
  -d '{...}' https://komorebi-order-endpoint.ketut-ketut92.workers.dev
```

writes a row. There is no rate limit, no captcha, and no body size cap. The realistic
damage is not theft — it is junk rows in your orders sheet and Apps Script quota
exhaustion taking real checkout down for the rest of the day.

**Your options, cheapest first.**

1. **Cloudflare WAF rate limiting rule** — dashboard only, no code, ~5 minutes. Limit
   requests to the Worker route by IP, e.g. 5 per hour. Blunt but immediate, and it
   costs an agent nothing because there is nothing to write.
2. **Cloudflare Turnstile** — robust, free, ~30 minutes. Split work: **you** create the
   widget in the Cloudflare dashboard and add `TURNSTILE_SECRET` to the Worker's
   variables; **an agent** can then add the widget markup to the checkout form, submit
   the token in the payload, and add the `siteverify` call to the Worker code block. Ask
   for that once you have the sitekey.
3. **Body size cap** — an agent can add this to the Worker code block now; it needs no
   dashboard work, only a redeploy. Reject `Content-Length` over ~32 KB before
   `request.json()`.

Pick 1 or 2. Doing neither is a real exposure, but it is a business risk judgement about
how visible your store is, and that call is yours.

## B4. Confirm `ALLOWED_ORIGIN` covers every URL that serves the site `security`

Your canonical origin is `https://komorebicreations.com` (`CNAME`, `index.html:10`), and
the Worker accepts exactly one string. Anyone reaching the site on a different hostname
gets a silent CORS failure, surfaced to them as the generic "Kami belum dapat memastikan
pesanan tersimpan" — a lost order that looks like a server fault.

Check, in a browser, that these either redirect to the apex or are unreachable:

- `https://www.komorebicreations.com`
- `https://asuraor.github.io/komorebi-creations`

If either serves the site directly, tell an agent and it can change the Worker check to
test against a small allowlist array. But **you** need to confirm the actual DNS and
GitHub Pages behaviour first — the agent cannot see your DNS, and this sandbox is blocked
from reaching your domains.

## B5. Decide the policy on browser-supplied prices `business decision`

**The finding.** `CHECKOUT-SETUP.md` requirement 4 says the endpoint must "recalculate
current product prices rather than trusting browser totals". Neither hop does.
`safeNumber` (`CONFIGURE-SUBMISSION-ENDPOINT.md:169-173`) only checks the value is
finite and non-negative, so a crafted POST records an order at Rp 1, and `item_data` is
stored as raw JSON but never cross-checked against the totals.

Your documentation already mitigates this with the safety reminder — verify prices
before sending a Midtrans link. For a studio your size that is a defensible posture. But
it means the Estimated Product Total column is advisory, and every order needs manual
re-pricing before payment.

**Choose one:**

- **Keep manual verification.** Then rename the column to something like
  `Buyer-Reported Total` so nobody trusts it at 11pm, and keep the safety reminder
  prominent. An agent can do the rename in the docs; you do it in the sheet.
- **Recalculate server-side.** The Apps Script would need its own copy of the price
  table from `site-content.js` and would recompute from `item_data`, rejecting or
  flagging mismatches. An agent can write this. The cost is that **every price change
  now has to be made in two places** — the site and the script — and a missed update
  silently rejects real orders. That maintenance burden is the actual decision.

I would not pick for you. Option 1 is the right call while order volume is low enough
that you personally check each one; option 2 becomes worth it when it isn't.

## B6. Confirm your minimum lead time `business decision` — blocks A2

A2 needs a real number for `minLeadDays`. How many days ahead of delivery do you need an
order placed, given handmade production time? The `3` in A2 is a placeholder an agent
would otherwise ship as if it were researched.

## B7. Verify the live endpoint

This audit could not reach `komorebi-order-endpoint.ketut-ketut92.workers.dev` — the
sandbox blocks that egress. Before treating any finding above as confirmed in
production, place one real test order end to end and confirm exactly one row appears.
Everything in this document is derived from source code and documentation.

---

# Suggested order of work

| Step | Who | Items |
|------|-----|-------|
| 1 | You | B6 (lead time), B4 (check hostnames) — unblocks agent work |
| 2 | You | B2 (add four columns to the sheet) |
| 3 | Agent | A1, A5, A6, A7 (rewrite the Apps Script block), A10 Worker items |
| 4 | You | B1 (paste and redeploy Apps Script), redeploy Worker |
| 5 | Agent | A2, A3, A4, A8, A10 client items (repo code) |
| 6 | Agent | A9 (test coverage) |
| 7 | You | B3 (abuse protection), B5 (pricing policy decision) |
| 8 | You | B7 (end-to-end test order) |

Steps 3 and 5 can run in parallel — they touch different files.
