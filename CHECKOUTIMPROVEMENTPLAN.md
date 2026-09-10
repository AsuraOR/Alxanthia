# Checkout improvement plan — current implementation

**Updated:** 10 September 2026
**Scope reviewed:** `app.js`, `index.html`, `styles.css`, `site-content.js`,
`CONFIGURE-SUBMISSION-ENDPOINT.md`, `CHECKOUT-SETUP.md`, `README.md`, and both test runners.

## Current status

The native checkout is live and functional, the production Worker URL is configured, and
all **26 Node integration suites pass**. The website now supports a multi-item cart,
finished stems, florist packages, custom bouquets, mini pots, custom leaf additions,
scaled custom-bouquet wrapping fees, and a paid message card.

It is **not ready for unrestricted public orders yet**. The largest remaining risk is no
longer the front-end layout: the server instructions do not match the expanded catalogue
and still trust prices calculated in the customer's browser.

| Area | Current result |
| :-- | :-- |
| Node integration tests | ✅ 26/26 pass |
| Production endpoint configured | ✅ Yes |
| Apex-domain CORS preflight | ✅ Returns `204` for `https://alxanthia.com` |
| `www` handling | ✅ Redirects to `https://alxanthia.com/` |
| Mini-pot submission | 🔴 Apps Script rejects the `pot` order mode |
| Mixed-cart classification | 🔴 Reported as `custom`, not `mixed` |
| Server-owned price verification | 🔴 Not implemented |
| Strong idempotency | 🔴 Not implemented |
| Timeout and ambiguous-failure recovery | 🔴 Not implemented |
| Privacy notice | 🔴 Not implemented |
| Public launch switches | ⏳ Passcode and `noindex` intentionally remain enabled |

### Evidence markers

| Marker | Meaning |
| :-- | :-- |
| ✅ | Verified in the current repository or by a non-writing live check |
| 🔴 | Must be completed before public launch |
| 🟠 | Important, but may follow the first controlled launch |
| 👤 | Requires the store owner or a dashboard/account decision |

---

## What changed since the previous plan

These changes are already present and must be treated as the new checkout baseline:

- The hard-coded WhatsApp-number test was repaired. Tests now use
  `store.whatsappNumber`, and all 26 Node suites complete successfully. ✅
- Bulk discounts were removed. The old submitted/verified **discount** tasks are now
  obsolete. ✅
- Custom-bouquet wrapping now costs `Rp 35.000` for every three stems, rounded up per
  custom bouquet. ✅
- The message card is now an order-level `Rp 5.000` add-on. Its message,
  recipient name, and sender name only appear when the card is selected. ✅
- Mini pots and optional custom-bouquet leaf additions were added. ✅
- The checkout review now shows a price for each cart line and a separate message-card
  fee row. ✅
- The checkout form was simplified to buyer, location/delivery, preferred date, and
  acknowledgement. Recipient/sender details remain in the finishing section. ✅
- Bali and out-of-Bali fields are conditional, and self-pickup now explains that the
  studio address will be sent through WhatsApp. ✅
- Persistent bilingual inline field errors and `aria-invalid` were added. ✅
- `www.alxanthia.com` currently redirects to the allowed apex origin, so the old
  multi-origin blocker is closed. ✅

The previous tasks about `anonymous_gift`, discount columns, the hard-coded WhatsApp test,
and deciding whether `www` is a separate production origin should not be carried forward.

---

# Part 1 — Developer tasks

Complete the phases in order. Phase 0 changes the meaning and safety of stored orders;
coordinate it with the owner tasks in Part 2.

## Phase 0 — Make the server match the current shop

### 🔴 DEV-01 · Support mini pots and identify mixed carts correctly

The front end emits `order_mode: "pot"` for a pot-only cart, but the Apps Script in
`CONFIGURE-SUBMISSION-ENDPOINT.md` only allows `stem`, `package`, and `custom`. A customer
can build and submit a valid pot order in the website, but the server rejects it.

Also, `normalizedCheckoutState()` currently returns `custom` whenever a cart contains
more than one product type. That makes a mixed stem + pot + package order
indistinguishable from a custom bouquet at the order level.

**Change:**

1. Return `mixed` when the cart contains more than one line type.
2. Allow exactly `stem`, `pot`, `package`, `custom`, and `mixed` server-side.
3. Treat `item_data`, not `order_mode`, as the authoritative product list.
4. Add end-to-end tests for a pot-only order and a mixed cart.

**Done when:** both payloads reach the sheet once and receive the exact reference back.

### 🔴 DEV-02 · Recalculate every price on the server

The browser currently supplies `product_subtotal`, `message_card_fee`, and
`estimated_product_total`; the Worker forwards them unchanged. Anyone can alter those
values before submitting. This still contradicts requirement 4 in
`CHECKOUT-SETUP.md`.

Create a versioned, server-owned catalogue and calculate prices from `item_data`:

| Item | Server calculation to mirror |
| :-- | :-- |
| Finished stem | Allowlisted flower price × integer quantity |
| Mini pot | Allowlisted mini-pot price × integer quantity |
| Florist package | Allowlisted package price × integer quantity |
| Custom bouquet | Flower components + allowlisted additions + wrapping fee |
| Custom wrapping | `ceil(stems / 3) × Rp 35.000`, per custom bouquet, then × line quantity |
| Message card | `Rp 5.000` once per order when enabled |
| Discount | None — the bulk discount has been removed |
| Wrap colour | Allowlisted choice, no separate price |

Store both the submitted total and the server-verified total. If they differ, keep the
order but flag it for review and never invoice from the submitted value. Add a
`catalog_version` so an old browser tab can be diagnosed after prices change.

**Done when:** changing any browser price, item ID, addition ID, or quantity cannot change
the verified total stored by the server.

### 🔴 DEV-03 · Replace the Sheet schema and remove the copied-down formula

The current guide still tells the owner to copy a `Final Total` formula down the sheet.
Pre-filled formulas interfere with `appendRow()`, and the current columns discard
language, currency, source, and acknowledgement.

Update `CONFIGURE-SUBMISSION-ENDPOINT.md` to use a header-based schema rather than fixed
column letters. Include at least:

- `Order Reference`, `Idempotency Key`, `Payload Hash`, `Catalog Version`
- `Submitted At`, `Language`, `Currency`, `Source`, `Acknowledged`
- all buyer, location, delivery, item, finishing, and message-card fields
- `Submitted Product Subtotal`, `Submitted Message Card Fee`, `Submitted Total`
- `Verified Product Subtotal`, `Verified Message Card Fee`, `Verified Total`
- `Shipping Fee`, `Final Total`, payment, production, delivery, and internal-note fields

Have Apps Script write the row first, then set that row's `Final Total` formula. Keep it
blank until **both** verified total and shipping fee exist. Resolve columns by header name
so future insertions do not corrupt the mapping.

**Done when:** a new order lands in the correct columns with no formula pre-filled below
the last real order.

### 🔴 DEV-04 · Add a real idempotency key and payload hash

The human reference `ALX-YYMMDD-XXXX` has only four random characters and is currently
also used for deduplication. A collision can return false success while dropping a real
order.

Generate a UUID for each checkout attempt, keep the friendly reference for humans, and
deduplicate on the UUID. Store a deterministic payload hash with it.

- Same UUID + same hash: return `200`, `duplicate: true`.
- Same UUID + different hash: return `409 Conflict`.
- Same reference + different UUID: store or flag it; do not silently discard it.

Retries after an ambiguous failure must reuse the same UUID.

### 🔴 DEV-05 · Validate the complete payload and limit its size

Validation currently checks only a small set of required fields and non-negative totals.
Add server checks for:

- request body size before parsing;
- allowed product types and IDs, including pots and additions;
- integer quantities with sensible per-line and per-order maximums;
- custom-bouquet minimum stems and valid component counts;
- message-card price/state consistency and text length;
- buyer name/phone length and format;
- Bali regency/delivery-method combinations;
- out-of-Bali address/city lengths and a five-digit postal code;
- preferred date and the configured production lead time;
- `submitted_language`, `currency`, `source`, and exact acknowledgement value;
- maximum lengths for every free-text field.

Ignore or reject values belonging to the inactive location branch. Do not store arbitrary
extra object keys.

### 🔴 DEV-06 · Normalize booleans and require an exact acknowledgement

`message_card_enabled` is already sent as a Boolean, but the form checkbox still becomes
the HTML string `"on"`. Convert acknowledgement to a Boolean in
`buildOrderSubmission()` and require `true` server-side.

Also require the Worker response to contain both:

```javascript
result.ok === true && result.order_reference === checkoutAttempt.reference
```

The current optional reference check accepts `{ "ok": true }` with no reference.

### 🔴 DEV-07 · Add Turnstile, rate limiting, and safer secrets

The copied Worker uses CORS as its only abuse control. CORS does not stop scripts or bots.

1. Add Cloudflare Turnstile verification before forwarding an order.
2. Add a request-rate limit in Cloudflare (start around 10 submissions/minute/IP and
   adjust from logs).
3. Put the Apps Script secret in `PropertiesService.getScriptProperties()` rather than a
   source-code constant.
4. Return fixed public error codes; never relay raw Apps Script error text.
5. Log rejection code, reference, origin, and timestamp without logging private customer
   fields.

Dashboard actions pair with OWNER-05 and OWNER-06.

## Phase 1 — Make submission recoverable

### 🔴 DEV-08 · Add a 20-second timeout and typed failure states

Use `AbortController`/`AbortSignal` and separate these cases:

| Failure | Customer treatment |
| :-- | :-- |
| Correctable validation error | Show it beside the field; order was not saved |
| Definite connection failure | Say the order was not saved and allow retry |
| Timeout or server 5xx after send | Say saving is uncertain; show reference and contact/retry options |
| Duplicate payload | Restore the existing success state |
| Idempotency conflict | Stop and ask the customer to contact the studio |

Keep the same idempotency key on every retry of the same attempt.

### 🔴 DEV-09 · Guard the dialog during submission

Track `isSubmitting`. While true, disable the close/edit controls and prevent the
dialog's `cancel` event. This stops an order being stored after the customer has escaped
the dialog and missed the confirmation.

### 🔴 DEV-10 · Preserve successful-order state

After success, reopening checkout currently creates a new reference while leaving the
cart and form available for another submission.

- Reopen the existing success state by default.
- Add an explicit **Start a new order** action that clears the cart and form.
- Save a minimal recent-order record in `localStorage`: reference, idempotency key,
  timestamp, safe summary, and WhatsApp URL.
- On page load, show a quiet recent-order recovery link. Never store address, phone,
  email, or message-card text in `localStorage`.

### 🔴 DEV-11 · Enforce the real production lead time

The date input now rejects dates before **today**, which is an improvement, but it does
not include production time and the server does not verify the date.

Put an owner-editable `minimumLeadDays` in `site-content.js`, set the input minimum from
it, display the lead time in both languages, and mirror the rule server-side. Pair with
OWNER-01.

### 🟠 DEV-12 · Disable and clear inactive conditional fields

When switching between Bali and out-of-Bali, disable and clear the hidden branch so stale
values are not included in `FormData`. The server must still enforce the branch because
client-side disabling is not security.

## Phase 2 — Finish checkout UX and accessibility

### 🔴 DEV-13 · Complete success-screen localization

The title, body, and reference label are localized, but the success eyebrow, WhatsApp
button, copy button, and manual-copy fallback remain Indonesian in English mode. Move all
checkout strings into one localization map, including live-status text.

### 🔴 DEV-14 · Manage focus and the dialog name on every step

Give each step heading `tabindex="-1"`, focus it after review → form → success
transitions, and update the dialog's `aria-labelledby` to the visible heading. It
currently points to `#checkout-title` even while that heading is hidden.

### 🟠 DEV-15 · Complete field descriptions and required cues

Inline errors now receive `aria-describedby` and `aria-invalid`. Finish the work by:

- linking help text to its input/select;
- preserving both help and error IDs when an error appears;
- marking required fields visibly, not only in HTML;
- adding a WhatsApp-number example;
- adding `pattern="[0-9]{5}"` and `maxlength="5"` to postal code.

### 🔴 DEV-16 · Repair the mobile dialog structure

The close button is absolutely positioned inside scrolling content. On a long phone form
it scrolls out of view.

Create a fixed dialog header with the close control, make the content area the actual
scroll container, and add a sticky mobile footer with the current total and primary
action. Add **Back to review** beside Save and a simple two-step indicator.

### 🟠 DEV-17 · Finish the price breakdown

Per-line prices and the message-card fee are now shown. Add the remaining details:

- a separate custom-wrap fee row instead of hiding it inside product subtotal;
- an explicit “delivery calculated separately” row;
- consistent labels for submitted/estimated total;
- full-width, aligned success buttons on mobile.

### 🟠 DEV-18 · Improve copy-reference fallback

When clipboard permission is denied, show `Copy this manually: ALX-…` in a selectable
element instead of displaying the raw reference without explanation.

### 🟠 DEV-19 · Remove the invisible invalid-cart error path

`openCheckoutReview()` writes an invalid-cart message inside a dialog that is not opened
on that path. Route it to the order section's existing live region or remove the dead
branch.

## Phase 3 — Privacy and operations

### 🔴 DEV-20 · Add a short privacy notice

Explain what buyer and gift-recipient data is collected, why it is needed, where it is
stored, who can access it, and how long it is retained. Link it beside the
acknowledgement and include explicit consent for processing order data. Use the owner's
retention decision from OWNER-02.

### 🔴 DEV-21 · Notify the studio of a new stored order

After a successful append, send an owner notification containing only the operational
details needed to find and review the row. Notification failure must be caught and logged;
it must never turn a stored order into a failed checkout response.

### 🟠 DEV-22 · Add monitoring and a recovery queue

Create structured Worker logs and an alert for repeated upstream failures. After the
idempotency work is stable, add Cloudflare Queue/KV recovery for submissions that cannot
reach Google Apps Script. Never use the queue before replay is demonstrably idempotent.

### 🟠 DEV-23 · Add reference-only status lookup

A later release can provide order reference + status without exposing phone numbers,
addresses, or gift data. WhatsApp remains the immediate support path.

## Phase 4 — Tests and documentation

### 🔴 DEV-24 · Make the browser runner cross-platform and fix its real failure

`tests/run-browser-runner.js` still hard-codes a Windows Chrome path. Use the installed
Playwright package instead. The browser spec also still expects package selection to
preserve focus, while the current package handler sends focus to `#finish-label`.

**Done when:** the browser runner works on Windows, macOS, Linux, and CI and reports zero
failures.

### 🔴 DEV-25 · Add checkout/server regression coverage

Cover at least:

- pot-only and mixed carts;
- server repricing of every item and addition type;
- manipulated totals, IDs, quantities, card state, and wrap IDs;
- past/too-soon dates and invalid postcodes;
- repeated UUID with matching and conflicting hashes;
- timeout, offline, non-JSON, `409`, and stored-but-response-lost paths;
- closing/cancelling while submitting;
- complete English and Indonesian success screens;
- clipboard denial and recent-order recovery;
- checkout at 320, 390, 768, and 1440 px.

No test should write a row to the production Sheet.

### 🔴 DEV-26 · Bring every guide up to date

Update the documents in the same pull request as the server contract:

- `CONFIGURE-SUBMISSION-ENDPOINT.md`: new Sheet schema, Script Properties, current
  catalogue, repricing, Turnstile, idempotency, response codes, and no copied-down formula.
- `CHECKOUT-SETUP.md`: current payload, `pot`/`mixed` modes, verified totals, and recovery
  contract.
- `README.md`: real WhatsApp number status, configured submission URL, mini pots,
  additions, scaled wrap fee, paid message card, no bulk discount, and 26+ test count.

---

# Part 2 — Owner tasks

## Decisions needed before development

### 👤 OWNER-01 · Choose the minimum lead time

Choose the earliest safe order date in calendar days. Use the number you can honour in a
busy week, not the fastest order you have ever produced. This feeds DEV-11.

### 👤 OWNER-02 · Choose the data-retention period

Decide how long completed-order rows containing names, phone numbers, and addresses are
kept, and who may access them. This feeds DEV-20. Review the final notice for accuracy.

### 👤 OWNER-03 · Confirm the operational email

Choose the inbox that should receive new-order and failure notifications. Do not put
private credentials in the repository.

## Dashboard and Sheet work

### 🔴 👤 OWNER-04 · Migrate the Sheet together with DEV-03

Do not change columns while the old Apps Script is live. In one maintenance window:

1. pause public ordering or keep the passcode curtain active;
2. back up the current Sheet;
3. install the new header schema;
4. remove copied formulas below real rows;
5. deploy the new Apps Script and Worker;
6. submit one test order and verify every column;
7. protect verified-total and final-total columns.

Keep the Sheet restricted to the smallest necessary group.

### 🔴 👤 OWNER-05 · Create Cloudflare Turnstile keys

Create a Managed Turnstile widget for `alxanthia.com`. Give the public site key to the
developer and save the secret as a Worker secret named `TURNSTILE_SECRET`.

### 🔴 👤 OWNER-06 · Confirm Cloudflare rate limiting

Create or verify a rule for the order endpoint. Start around 10 requests per minute per
IP. The repository cannot prove whether a dashboard-only WAF rule already exists, so
confirm it manually.

### 🔴 👤 OWNER-07 · Harden Google Apps Script and Sheet access

- Set the Apps Script timezone to **GMT+08:00 Makassar** for Bali.
- Move the webhook secret into Script Properties.
- Confirm the Sheet is not shared as “Anyone with the link”.
- Protect calculated/verified columns.
- Review Apps Script Executions regularly for unexplained spikes or failures.
- Create a recoverable monthly backup.

### 🔴 👤 OWNER-08 · Enable immediate order notifications

Until DEV-21 is deployed, enable Google Sheet “Any changes are made → Notify right away”.
Replace this with the structured notification only after the new alert has been tested.

## Public-launch checklist

### 🔴 👤 OWNER-09 · Run the production acceptance test

With a test product and controlled data, verify:

- finished stem, package, custom bouquet, mini pot, and mixed cart;
- with and without the paid message card;
- Bali Grab/Gojek, Bali self-pickup, and out-of-Bali delivery;
- both languages;
- server-verified total, shipping fee, and final total;
- one browser retry produces one Sheet row;
- the success reference exactly matches the Sheet and WhatsApp message.

### 🔴 👤 OWNER-10 · Verify payment manually

Never mark an order `Paid` from a WhatsApp screenshot. Confirm it in the Midtrans
dashboard or an authenticated Midtrans notification.

### 🔴 👤 OWNER-11 · Remove both staging gates together

Only after all 🔴 tasks and the production acceptance test pass:

1. set `auth.enabled` to `false` in `site-content.js`;
2. change the robots meta tag to `index, follow` in the same deployment;
3. confirm canonical URL, `robots.txt`, and `sitemap.xml` all use
   `https://alxanthia.com/`;
4. confirm the passcode curtain and relock control are gone from the customer flow.

The passcode is a staging curtain, not security; it remains visible in client-side source.

---

## Recommended implementation order

1. **DEV-01–07 + OWNER-04–07:** catalogue compatibility, trusted pricing, Sheet schema,
   idempotency, validation, and abuse controls.
2. **DEV-08–12:** timeout, retries, success recovery, and lead time.
3. **DEV-13–20:** localization, accessibility, mobile checkout, and privacy.
4. **DEV-21–26:** notifications, monitoring, tests, and documentation.
5. **OWNER-09–11:** full production acceptance test and coordinated public launch.

## Behaviours that already work — preserve them

- WhatsApp is offered only after the endpoint confirms storage.
- The post-submission WhatsApp message excludes address, phone, message-card text, and
  recipient/sender details.
- Gift text is inserted with `textContent`, preventing markup execution.
- The Save button disables while its current request is running.
- The cart cannot open checkout until it contains a valid product.
- Formula-like spreadsheet text is escaped by the supplied Apps Script.
- Secrets are not present in front-end files.
- Multi-item totals, scaled custom wrapping, message-card fee, mini pots, additions, and
  cart persistence are covered by the passing Node suite.

---

## Verification record

- `node tests/verify-ordering.js`: **26/26 passed** on the reviewed `main` branch.
- Live `https://www.alxanthia.com`: redirects to `https://alxanthia.com/` and returns 200.
- Live Worker preflight from `https://alxanthia.com`: returns 204 with the expected CORS
  origin.
- The live page still serves `noindex, nofollow`, consistent with staging.
- No production order was submitted and no Sheet row was written during this review.
