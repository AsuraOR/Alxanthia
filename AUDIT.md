# Alxanthia website audit and implementation brief

Audit date: 11 September 2026
Repository: [AsuraOR/Alxanthia](https://github.com/AsuraOR/Alxanthia)
Audited commit: [`7b8d390`](https://github.com/AsuraOR/Alxanthia/commit/7b8d3900cfec7491e4cbeac9833e44fd325bd31c)
Deliverable: review and repair instructions. No repository changes or deployments were made,
and no real order, payment, WhatsApp message, email, or production Sheet write was performed.

## 0. About this document

This is a **merge of two independent audits** of the same commit, reconciled into one brief.

- **Audit A** — a source audit with isolated runtime verification (simulated DOM, spreadsheet,
  and upstream fixtures). It contributed the checkout-reliability, storage, and Worker findings
  (`ALX-01`–`ALX-21`, `O-01`–`O-06`) and the phase/priority/acceptance structure of this document.
- **Audit B** — a working-tree audit with live headless-browser instrumentation. It contributed
  the measured accessibility, layout, and performance evidence, the fail-open boot defect
  (`ALX-22`), and `ALX-23`–`ALX-26`.

Every Audit A finding was independently re-verified against the working tree before being
carried over. **All of them held.** Where the two audits disagreed, §10 records the conflict and
the resolution — Audit B's severity grade on the preview curtain was wrong and has been
corrected. Audit B also ran two checks Audit A listed as outstanding; §3 reflects the combined
evidence.

Task IDs are stable. Use them in commits and the completion report.

---

## 1. Assessment

The current source has a useful foundation: a mixed-product cart, server-owned price
calculations, Indonesian/English copy, explicit product estimates, order references, and a manual
confirmation/payment workflow. Preserve the botanical identity and the simple architecture.

The highest priority is making the customer experience agree with the order actually stored. The
repository has stale deployment files, incomplete recovery after uncertain submissions, and a
success screen that can hide subsequent cart changes. These deserve attention before additional
visual polish.

Two defects reach every customer who opens the checkout form and were confirmed in a real
browser: all seven required-field indicators are destroyed on localization (`ALX-21`), and the
quantity stepper runs past the server's per-line cap (`ALX-06`). Both are P1 and both are
cheap to fix.

What is measurably sound is recorded in §9 — do not spend effort "fixing" it.

---

## 2. Instructions for the implementing AI agent

1. Read this report and any applicable repository instructions. Compare the current HEAD with the
   audited commit; reconfirm each finding before changing newer code.
2. Work in a branch and keep changes focused. Preserve the vanilla HTML/CSS/JavaScript stack,
   brand, existing products, current price arithmetic, and Indonesian/English support.
3. Use the task IDs below in commits and the completion report. Mark each as **Fixed**,
   **Already fixed**, **Needs owner input**, or **Not reproduced**, with evidence.
4. Preserve the order-request model: the studio reviews availability, delivery, and the final
   amount before payment. A recorded request is not a paid or production-approved order.
5. Preserve manual WhatsApp sending. The preferred owner workflow is a prepared message the owner
   reviews and sends. Do not introduce automatic messaging, a WhatsApp API integration, or
   automatic payment confirmation as part of these repairs.
6. Never solve a failing positive test by weakening server validation or deleting the assertion.
   Test the intended normalization/validation boundary.
7. Use synthetic customer information and intercept external calls during automated tests. Test
   rejection paths against local fixtures or a dedicated test deployment.
8. Backend deployment and Sheet migration are separate from editing Markdown. If the backend
   remains embedded in the setup guide, keep that runnable code and the instructions synchronized.
9. Do not remove staging protection or publish as an incidental consequence of fixing code.
   Prepare a concrete release candidate; follow the owner's deployment instructions.
10. Add regression coverage for the defects you fix. Avoid assertions that only search for
    implementation strings or merely repeat the implementation.
11. Do not invent prices, shipping commitments, refund rules, contact details, customer reviews,
    or account URLs. Keep owner decisions in the launch checklist.
12. Do not reproduce the preview-curtain passcode in reports, commits, or test fixtures.
13. Where a finding carries measured evidence (a viewport width, a contrast ratio, a byte count),
    re-measure after your change rather than reasoning that it should still hold.
14. At completion, provide changed files, task IDs, test results, deployment steps, and remaining
    owner actions.

---

## 3. Scope, limits, and verification results

**Method.** Audit A retrieved the repository through GitHub and verified local review files
against the audited Git blob hashes; Audit B worked from a fresh clone of the same commit.
Both reviewed root HTML, CSS, content/configuration, application code, committed `dist` files,
checkout/setup guides, and tests. Backend findings refer to the code embedded in
`CONFIGURE-SUBMISSION-ENDPOINT.md`; **a deployed copy might differ.**

**Limits that remain.**

- The public domain was not inspected. This is **not** evidence that the website is down.
- Neither the custom domain's active publishing directory nor the currently deployed
  Worker/Apps Script version was verified. See `O-01`.
- No real payment journey, no Core Web Vitals field measurement, and no physical-device testing.
- Browser measurements below were taken against a local static server at the audited commit, in
  headless Chromium. Treat them as strong signal, not as a substitute for real-device review.

| Check | Result | Meaning |
| --- | --- | --- |
| `node tests/verify-ordering.js` | **PASS** — 26 suites | Cart/pricing/rendering in the simulated DOM |
| `node tests/verify-server-pricing.js` | **FAIL at line 179** | Positive fixture holds an unnormalized phone number (`ALX-02`) |
| Server suites S1–S3 | PASS before the failure | Catalogue parity, order-mode resolution, pricing |
| Server suites S4–S6 | **Not completed** | Do not report all six as passing |
| `node tests/run-browser-runner.js` | **PASS** — 39 assertions | Ran after supplying a browser and a server; see note below |
| Referenced image paths | No missing paths | Does not prove live URLs or image suitability |
| Root source vs `dist` | Four principal files differ | Deployment can ship older behavior (`ALX-01`) |
| Colour contrast, 390 px and 1280 px | **0 failures** | Every text node meets WCAG AA (§9) |
| Horizontal overflow at 320/360/390/768/1440 px | **0 at every width** | Also 0 at 200% text zoom (§9) |
| Mini-pot grid at 320 px and 360 px | **2 columns** | Packages correctly drop to 1; pots do not (`ALX-17`) |
| Required-mark spans after checkout localization | **7 of 7 destroyed** | Confirmed in-browser (`ALX-21`) |
| Line quantity after 24 increments | **24** | Server cap is 20 (`ALX-06`) |
| JavaScript console errors on load and interaction | **0** | — |

> **Browser runner note.** The documented command fails out of the box for two environmental
> reasons, neither of them a site defect: it needs a Chromium binary
> (`npx playwright install chromium`, or `PLAYWRIGHT_CHROMIUM_PATH=…`) and it needs a server
> already listening on `:8080` — it does not start one. `ALX-02` covers fixing or documenting
> this. Once both were supplied, all 39 assertions passed, including focus return, dialog ARIA,
> and the clipboard-denial fallback.

---

## 4. Priorities and order

**P1** = fix before relying on public ordering.
**P2** = fix before launch where practical; customer clarity, reliability, or operational correctness.
**P3** = maintainability or later polish.

| Phase | Tasks | Purpose |
| --- | --- | --- |
| A — Establish a trustworthy baseline | `ALX-01`, `ALX-02` | Correct deployment output and test status |
| B — Make submission reliable | `ALX-03`–`ALX-08`, `ALX-10`–`ALX-11`, `ALX-22` | Preserve orders, enforce contracts, prevent misleading success, fail closed |
| C — Complete customer interactions | `ALX-09`, `ALX-12`–`ALX-18`, `ALX-21`, `ALX-24`, `ALX-25` | References, dates, drafts, navigation, mobile usability, accessibility |
| D — Metadata and maintenance | `ALX-19`, `ALX-20`, `ALX-23`, `ALX-26` | Accurate search/share information, manageable releases, defence in depth |
| E — Owner verification | `O-01`–`O-06` | Confirm deployment and business settings |

Finish backend contract decisions before updating `dist`. `ALX-03` and `ALX-05` share checkout
state; implement them coherently. `ALX-06` and `ALX-12` require matching client/server rules.
`ALX-07` and `ALX-09` share storage logic. `ALX-22` and `ALX-01` both touch what ships, so
sequence them together.

**Suggested start:** `ALX-02` first (get the suite green so everything after is verifiable), then
`ALX-20`'s CI so it stays green, then `ALX-01` so fixes land in the directory that actually ships.

---

## 5. Phase A — Baseline

### ALX-01 — Rebuild the actual publish directory

**Priority:** P1 · **Evidence:** Confirmed source/output mismatch; production impact depends on the active host.

The configured Sites output is `dist`, but the updated source is in the repository root, and
`package.json` has no build command to synchronize them.
[`.openai/hosting.json`](.openai/hosting.json) · [`package.json`](package.json)

| File | Root bytes | `dist` bytes |
| --- | ---: | ---: |
| `index.html` | 53,128 | 50,800 |
| `site-content.js` | 50,906 | 37,399 |
| `app.js` | 166,146 | 138,429 |
| `styles.css` | 96,612 | 89,497 |

The old `dist` submission handler lacks the current timeout/recovery behavior, and its payload
lacks the `idempotency_key` the documented backend now requires — **deploying that combination
would reject ordinary orders.** Re-verified by feature probe:

| Symbol | root `app.js` | `dist/app.js` |
| --- | ---: | ---: |
| `idempotency` | 9 | **0** |
| `Turnstile` | 24 | **0** |
| `normalizeIndonesianPhone` | 3 | **0** |
| `minimumLeadDays`, `baliRegencies`, `messageCardPrice`, `turnstileSiteKey` (in `site-content.js`) | present | **absent** |

`dist/` was last touched at `2f6c506`; `app.js` has moved through at least six commits since.
`CNAME` at the repository root points GitHub Pages at root, so two publishing targets currently
disagree about which build is the site.

**Fix**

- Identify which source directory each active host publishes (`O-01`).
- Add a deterministic static build that copies an explicit allowlist of public files into `dist`:
  HTML, app/config scripts, CSS, referenced images, icons, relevant public metadata.
- Exclude setup guides, tests, vendor directories, credentials, master image sources
  (`ALX-23`), and unrelated files.
- Run it for every release. Record a non-sensitive build/commit identifier for version matching.
- Avoid treating hand-editing both root and `dist` as the long-term solution.

**Acceptance**

- A clean build produces the latest checkout payload, including `idempotency_key`.
- Asset URLs resolve when serving the built directory.
- A build cannot silently retain an obsolete script from a previous output.
- The chosen publishing target is documented and the tested output is the output released.

---

### ALX-02 — Repair the failing server test fixture and cover the real boundaries

**Priority:** P1 · **Evidence:** Executed failure.

The positive fixture supplies `buyer_whatsapp` as a local `08…` number but calls `validateOrder`
directly, which expects `+62…`. Production `doPost` normalizes *before* validation, so the direct
call fails with “Invalid buyer WhatsApp number.”
[`tests/verify-server-pricing.js:169`](tests/verify-server-pricing.js#L169) ·
[`:179`](tests/verify-server-pricing.js#L179) ·
`CONFIGURE-SUBMISSION-ENDPOINT.md:163` (normalization) · `:282` (the `/^\+62\d{8,13}$/` check)

**Production is not affected** — the browser normalizes at `app.js:533` and the backend
re-normalizes. This is test drift from commit `15e64ce`. The damage is what it hides: the
assertion aborts the process, so roughly 18 further tamper assertions in S4 and the whole of
S5 and S6 never execute.

**Fix**

- Use a canonical number for direct validator tests; do not simply swap the literal and lose the
  coverage of the case that regressed.
- Separately exercise `doPost` with every accepted local format and assert the normalized stored
  value — pull `normalizeIndonesianPhone` out of the sandbox alongside `validateOrder` at
  `tests/verify-server-pricing.js:77` and pin the contract both ways:
  - `normalizeIndonesianPhone('081234567890') === '+6281234567890'`
  - `validateOrder(validOrder({ buyer_whatsapp: '+6281234567890' })).ok === true`
  - `validateOrder(validOrder({ buyer_whatsapp: '081234567890' })).ok === false` — with a comment
    stating this is *by design*, because `doPost` normalizes first.
- Retain negative phone cases and assert relevant error categories.
- Add meaningful coverage for the documented Worker and the storage/retry cases in `ALX-07`.
  Existing pure pricing tests do not cover storage transactions.
- Make the documented browser-test command start or reuse a test server and locate a browser, or
  state both prerequisites clearly (see the §3 note).

**Acceptance**

- Both network-free commands pass; S4–S6 actually execute.
- Invalid-input tests fail for their intended reason, not because every fixture shares an
  unrelated invalid phone.
- `npm run test:browser` either self-provisions its prerequisites or documents them.
- CI or a documented local release gate runs against the source that will be built (`ALX-20`).

---

## 6. Phase B — Reliable ordering

### ALX-03 — Preserve uncertain submissions across reloads and edits

**Priority:** P1 · **Evidence:** Reproduced in an isolated application harness; confirmed by source read.

`checkoutAttempt` exists only in memory. `persistCart` saves cart/finishing fields —
`cart, wrapKey, orderNote, customCounts, messageCardEnabled, orderRecipientName,
orderCardSenderName` — and **not** the pending reference or idempotency key
([`app.js:80-88`](app.js#L80-L88)). `saveRecentOrder` runs only after acknowledged success.
Reloading an unconfirmed attempt therefore generates a new UUID, so a request stored before its
response was lost can become a second real order on retry.

A non-`AbortError` from `fetch` is also labeled “The order was not saved.” A browser network
failure does not establish that the server failed to store it.

**Reproduction:** submit to a fixture that stores the order then drops the acknowledgement →
reload → re-enter details → retry → observe a new idempotency key rather than recovery.

**Fix**

- Persist the pending reference, UUID, fingerprint, status, and required recovery information
  *before* sending.
- Reuse the same key and canonical payload when retrying the same attempt.
- Treat uncertain transport failures as uncertain outcomes.
- Prevent cart edits after an uncertain submission from silently creating another request;
  provide a clear recovery or an explicitly separate new-request action.
- Use a short, documented retention period for temporary customer details if retaining an exact
  retry payload; otherwise provide secure status reconciliation without retaining them
  (coordinate with `ALX-18`).
- Do not expose order records through an unauthenticated lookup using only the short reference.

**Acceptance**

- Store-then-drop-response, followed by reload and retry, produces one row.
- Recovery preserves the reference and does not silently change the order.
- Editing a pending order has an explicit, tested outcome.
- A genuinely new order gets a new UUID.

---

### ALX-04 — Keep the timeout active through response-body parsing

**Priority:** P1 · **Evidence:** Confirmed source defect.

`clearTimeout(timeoutId)` fires as soon as `fetch` resolves — which is at *headers received* —
and `await response.json()` then runs with no timer at all. A response that sends headers
promptly and stalls its body leaves “Saving…” and the close guard active indefinitely.
[`app.js:3556`](app.js#L3556) (the clear) · [`app.js:3567`](app.js#L3567) (the unguarded parse)

Fetch resolving at headers, with the body as a separate asynchronous read, is specified
behaviour — see [MDN: Using Fetch](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch#handling_the_response).

**Fix**

- Keep one timeout active through request, body read, and response validation.
- Restore buttons/close controls and reset Turnstile in a `finally` block.
- Add an explicit `isSubmitting` guard at function entry.
- Handle failed parsing, unexpected exceptions, and aborts without losing the pending attempt.
- Bound Worker upstream calls too. An upstream timeout after dispatch remains an *uncertain*
  storage outcome, not a failure.

**Acceptance**

- Immediate headers plus a never-ending body exits within the configured timeout.
- Delayed headers, malformed JSON, and a lost connection all recover the controls.
- Repeated submit events during one in-flight attempt issue one request.
- Recovery behavior follows `ALX-03`.

---

### ALX-05 — Separate a recorded order from a newly changed cart

**Priority:** P1 · **Evidence:** Reproduced in an isolated application harness; confirmed by source read.

After success, adding a new product changes the cart, but `openCheckoutDialog` unconditionally
reopens the old success screen whenever `checkoutAttempt.submitted` is true:

```js
function openCheckoutDialog() {               // app.js:3281
  if (checkoutAttempt && checkoutAttempt.submitted) {
    reopenCheckoutSuccess();
    return;
  }
  openCheckoutReview();
}
```

In the probe, the cart contained a rose and a mini pot while the reopened dialog still showed
only the previously submitted rose. “Start a new order” then resets all cart state, discarding
the additions.

**Fix**

- Keep recorded-order recovery separate from the active shopping cart.
- Either clear the submitted cart snapshot on success and start an empty cart, or explicitly
  transition to a new draft when shopping resumes.
- Preserve products added after success.
- Keep the old reference accessible through the recent-order action.

**Acceptance**

- Submit → close → add a different product → Review order displays the new draft.
- The previous order remains recoverable without being resubmitted.
- Starting a new order does not discard post-success additions without a clear user choice.

---

### ALX-06 — Align client validation with the server and bound nested quantities

**Priority:** P1 · **Evidence:** Browser reproduction plus source findings.

**Measured in-browser:** clicking the line stepper 24 times yields a line quantity of **24**. The
server rejects anything above `MAX_QTY_PER_LINE = 20`. `bumpLineQty` applies no upper bound at
all ([`app.js:693-701`](app.js#L693-L701)), and the client enforces neither
`MAX_LINES_PER_ORDER = 20` nor `MAX_TOTAL_QTY = 60`
(`CONFIGURE-SUBMISSION-ENDPOINT.md:135-137`).

Conversely, nested custom counts are checked only as integers with a minimum.
`validateCustomStems` enforces `Number.isInteger(count) && count >= 1` and a *lower* bound on the
total, with **no upper bound**; `validateCustomAdditions` likewise. `MAX_TOTAL_QTY` counts line
quantities, not nested stems — so a single custom line at `qty: 1` containing 1,000,000 roses and
1,000,000 leaf additions passes validation, as reproduced in the isolated probe.
`CONFIGURE-SUBMISSION-ENDPOINT.md:351-379`

The browser phone pattern and missing text `maxlength` values also permit inputs that reach a
generic server rejection. The server caps
`MAX_TEXT = { buyer_name: 120, address: 300, city: 100, gift_message: 200, recipient_name: 120,
card_sender_name: 120 }` (`CONFIGURE-SUBMISSION-ENDPOINT.md:138`), but only two of those limits
exist client-side — `maxlength="200"` on the gift message and `maxlength="5"` on the postal code.
`buyer_name`, `address`, `city`, `order-recipient-name`, and `order-card-sender-name` have none.
A non-Indonesian country code is a further example.

**Fix**

- Share or parity-test validation rules: line count, per-line quantity, total units, supported
  identifiers, field lengths, and phone normalization.
- Enforce the existing 20/20/60 limits in the UI *and* on restored carts.
- Define finite safe bounds for stems per custom bouquet, additions, expanded total stems, and
  final numeric totals. Document capacity-related defaults for owner review.
- Validate `Number.isSafeInteger` and finite totals where appropriate.
- Add `maxlength` to every text field, mirroring `MAX_TEXT`, with a comment naming
  `CONFIGURE-SUBMISSION-ENDPOINT.md:138` as the source of truth.
- Give an inline explanation at the limit instead of allowing an order that will fail.
- Preserve the current Indonesian-number policy until the owner chooses international support;
  validate and explain it before submission.
- Return safe field/code errors the frontend can localize.

**Acceptance**

- 20 stems on one line behave as allowed; increasing to 21 is prevented with a useful message.
- Line-count and total-unit limits agree on both sides.
- Huge/unsafe nested counts and non-finite totals are rejected.
- Client and server agree for all documented phone formats and text-length boundaries.

---

### ALX-07 — Validate the Sheet schema and recover partial writes

**Priority:** P1 · **Evidence:** Both failure cases reproduced with a simulated spreadsheet.

`getHeaderMap` accepts missing and duplicate headers, and `buildRow` silently drops missing
columns. Because `findExisting` guards with `keyCol !== undefined`, removing the
“Idempotency Key” column disables deduplication entirely — identical retries appended two rows,
both returning success. `CONFIGURE-SUBMISSION-ENDPOINT.md:458-502`

Separately, `appendRow` happens before `setFinalTotalFormula`:

```js
sheet.appendRow(row);                                  // :251
const newRow = sheet.getLastRow();
setFinalTotalFormula(sheet, headers, newRow);
notifyOwner_(order.order_reference, …, sheet, newRow);
```

If the formula write fails, the row remains and the next identical retry returns duplicate
success *before* repairing it. The probe ended with one stored row and a permanently blank Final
Total formula. `notifyOwner_` sitting inside the same `try` compounds this: a mail failure
surfaces as `STORAGE_ERROR` after the order was already stored successfully.

**Fix**

- Validate required headers, uniqueness, and a supported schema version before any append.
- Fail with a clear operational error instead of silently omitting data.
- Make row initialization retryable: track completion, or repair missing required derived cells on
  duplicate lookup.
- Do not overwrite legitimate owner edits while repairing a row.
- Keep email notification best-effort and outside the core storage-success guarantee.
- Document an idempotent migration that preserves existing rows and does not pre-fill thousands
  of formula rows.

**Acceptance**

- Missing or duplicated required headers yield no appended order and an actionable diagnostic.
- A failure between append and formula initialization can recover to one complete row.
- Reordered columns still work.
- Blank shipping yields a blank final amount; shipping of zero correctly yields the verified amount.

---

### ALX-08 — Generate the fulfillment summary on the server

**Priority:** P1 · **Evidence:** Reproduced with the documented Apps Script.

Prices and total stems are recalculated server-side, but the human-readable “Order Summary”
column is taken straight from the browser:

```js
'Order Summary': safeText(order.order_summary),   // CONFIGURE-SUBMISSION-ENDPOINT.md:226
```

A valid one-rose order was stored with the summary “15 sunflowers” against a verified total of
Rp 60,000. An owner reading that column to prepare products would build the wrong order. The
server-side repricing that makes the *money* trustworthy does not extend to the text the studio
actually works from.

**Fix**

- Build the authoritative human-readable summary from validated `item_data` and the server
  catalogue.
- Include custom stem counts, leaf additions, and package/mini-pot identities.
- If retaining a browser summary for diagnostics, store it separately and label it
  submitted/unverified.
- Keep the submitted catalogue version separate from the server catalogue version; the row
  currently receives only the server constant.
- Continue using server-derived prices and safe spreadsheet text handling.

**Acceptance**

- Manipulating `order_summary` cannot alter the authoritative fulfillment instructions.
- The owner can understand every supported item without interpreting raw JSON.
- A stale catalogue can be diagnosed from the two version fields and the mismatch state.

---

### ALX-10 — Harden the Worker boundary and verify the exact public endpoint

**Priority:** P1 · **Evidence:** Source defects and local Worker probes; production security configuration is unverified.

The public Turnstile site key is blank (`site-content.js:47`) while the live Worker URL is already
configured (`site-content.js:42`), and the documented Worker skips Turnstile whenever
`TURNSTILE_SECRET` is missing (`CONFIGURE-SUBMISSION-ENDPOINT.md:646`). It parses the full request
without an early size limit and performs no top-level object check: JSON `null` throws an
unhandled exception, and a 40 KB fixture was forwarded upstream before rejection.
`CONFIGURE-SUBMISSION-ENDPOINT.md:621-673`

The only barrier in effect today is the origin comparison at
`CONFIGURE-SUBMISSION-ENDPOINT.md:632`:

```js
if (origin !== env.ALLOWED_ORIGIN) return reply({ ok: false, error: 'Origin not allowed' }, 403, headers);
```

`Origin` is browser-enforced. Any non-browser client sets it freely, so this stops cross-origin
*browser* abuse and nothing else.

The configured endpoint is on `workers.dev`, while the setup guide describes a domain-zone
rate-limiting rule (`CONFIGURE-SUBMISSION-ENDPOINT.md:761-766`). **A rule scoped to the website
domain does not protect requests sent to a different hostname**, so the documented control may
not cover the endpoint the site actually calls.

**Fix**

- Reject non-object JSON, oversized bodies, and unsupported content types before any external
  request.
- Enforce the actual byte limit while reading; `Content-Length` is an early check, not a guarantee.
- Validate required production configuration. Allow intentionally reduced checks only under an
  explicit local/test configuration.
- Require and validate Turnstile in production, including expected hostname and action.
- Implement and test rate limiting on the actual reachable Worker route. A
  [Worker rate-limit binding](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/)
  is one option; if moving to a protected custom route, address alternate public ingress.
  Note that rate-limit bindings are local to Cloudflare locations, not strict global quotas.
- Return consistent JSON/CORS errors including 413, 429, and upstream failures; keep customer data
  and secrets out of logs.
- Follow [server-side Turnstile validation](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/).
- Test deployment settings separately from source presence.
- Until Turnstile and rate limiting are both live, consider setting `orderSubmissionUrl` to `""`.
  The checkout already degrades correctly when it is blank (`app.js:3515-3518`), showing the
  “not configured” message rather than failing silently.

**Acceptance**

- Null, arrays, oversized input, missing production configuration, and invalid tokens all fail
  before reaching Google.
- Legitimate requests still succeed with the production widget.
- The exact public hostname the site calls returns the expected 429 in a controlled test.
- Missing configuration cannot silently disable production abuse protection.

---

### ALX-11 — Make the checkout button respect ordering availability

**Priority:** P1 · **Evidence:** Reproduced in an isolated harness; confirmed in-browser.

The main checkout button is enabled solely by cart validity — it ignores channel readiness and
endpoint availability:

```js
const enabled = cartHasSelection && !cartInvalid;   // app.js:2154
```

With both channels disabled, `isWhatsAppReady()` returned false while the checkout button stayed
enabled. Browser check with a valid cart confirmed `disabled === false` with no availability
input. The page can announce that ordering is paused and still offer order submission.

**Fix**

- Define a single explicit availability rule for website ordering, separate from cosmetic channel
  visibility.
- Respect the existing pause behavior, endpoint configuration, and a usable confirmation contact.
- Apply the same rule to every order-entry point.
- Keep catalog browsing available with a clear paused-state message.
- For a real production pause, enforce rejection on the backend too; a client flag is not an
  access control.

**Acceptance**

- A paused store cannot submit from any website CTA.
- A missing endpoint/contact produces a clear alternative before the customer fills the form.
- Resuming ordering restores all relevant CTAs consistently.

---

### ALX-22 — Fail closed when configuration cannot be read

**Priority:** P1 · **Evidence:** Reproduced in a real browser.

`loadData()` assigns `siteData` only when `window.ALXANTHIA_DATA` exists, but `siteData` starts as
`null` ([`app.js:30`](app.js#L30), [`app.js:68-72`](app.js#L68-L72)) with no fallback, no boot
guard, and no `window.onerror` handler. `README.md` and `PANDUAN-KONTEN.md` both instruct a
non-developer to hand-edit `site-content.js` and warn them about quotes and commas — so a parse
error is a likely failure mode, not a theoretical one.

Serving `site-content.js` with one stray comma produced:

```
page errors: Unexpected token ',' | Cannot read properties of null (reading 'auth')
lock screen visible: false          ← the preview curtain is GONE
flower cards rendered: 0
visible text: "…ALXANTHIA / EST. 2026 | BASED IN BALI / Bunga / Buket / Cara dibuat / FAQ…"
```

Two distinct consequences. The page renders as a half-built shell — header and hero copy, no
products, no prices, no way to order, and no message explaining why. And because `init()` throws
at `siteData.auth` *before* `setupAuth()` runs, the preview curtain never appears: **a content
typo publishes the unfinished draft.** The system fails open exactly when it should fail closed.

**Fix**

- Wrap the body of `init()` in `try/catch`.
- On failure, reveal a static fallback block (hidden by default in `index.html`) stating the site
  is temporarily unavailable and linking to the studio WhatsApp — hardcoded in the HTML, never
  read from `siteData`. Coordinate with `ALX-24`.
- In the same `catch`, **keep the curtain up** while `auth.enabled` cannot be read.
- In `loadData()`, throw a clear named error when `window.ALXANTHIA_DATA` is missing, so the
  console says *“site-content.js failed to load or has a syntax error”* rather than
  `Cannot read properties of null`.
- Related curtain hygiene, while in this code: the passcode is compared against a value
  hardcoded in three places (`app.js:2637`, `:2649`, `:2677`) in addition to `site-content.js`, so
  it cannot be rotated in one edit; and the `?unlock=` query parameter at `app.js:2650` places the
  passcode into browser history and outbound `Referer` headers. Consolidate to one source and
  drop the query-parameter branch. See §10 for why this is hygiene rather than a vulnerability.

**Acceptance**

- A deliberately broken `site-content.js` shows the fallback message, keeps the curtain up, and
  logs a diagnostic that names the real cause.
- A regression test covers the broken-config boot path.

---

## 7. Phase C — Customer interactions and operational clarity

### ALX-09 — Keep customer-facing references unique

**Priority:** P2 · **Evidence:** Reproduced with the documented Apps Script.

Different UUIDs sharing the same short order reference are both stored and both returned as
success; the second only gets an Internal Notes warning
(`CONFIGURE-SUBMISSION-ENDPOINT.md:192-197`). UUID deduplication protects retries but does not
make the customer-visible reference unique.

For scale context: the reference carries 4 characters from a 32-symbol alphabet — 1,048,576
combinations per day — so collisions are genuinely rare at studio volume. The defect is that the
*handling* is ambiguous rather than that collisions are frequent.

**Fix**

- Resolve short-reference collisions under the storage lock.
- Either allocate a unique final reference server-side and return it, or introduce a distinct
  collision response handled safely by the client.
- If the server returns a new canonical reference, update the frontend's exact-reference
  acknowledgement check deliberately.
- Preserve UUID idempotency and make payment/owner actions use an unambiguous identity.

**Acceptance**

- Two different valid orders forced to share a proposed reference receive distinct final references.
- Retrying each returns its original canonical reference.
- Owner lookup cannot ambiguously match two rows.

---

### ALX-12 — Use one date policy and reject impossible dates

**Priority:** P2 · **Evidence:** Source mismatch plus a reproduced invalid-date acceptance.

The client computes its minimum in the **visitor's** timezone
([`app.js:3388-3393`](app.js#L3388-L3393)) while the server starts from a **Bali** date
(`TIMEZONE = 'Asia/Makassar'`, `CONFIGURE-SUBMISSION-ENDPOINT.md:113`). WITA runs an hour ahead of
WIB, so for a buyer in Jakarta, Bandung, or Surabaya ordering between **23:00 and 24:00 WIB**,
Bali is already on the next calendar day and the server's floor is one day later than the
picker's. The buyer picks a date the widget offers, completes the form, and receives the Worker's
fixed `VALIDATION` message — which names no field. That window covers most of Indonesia's
population.

The server also accepts JavaScript's date rollover. Confirmed:
`new Date('2027-02-31T00:00:00')` yields **Wed Mar 03 2027**, not `Invalid Date`, so
`isValidLeadTimeDate('2027-02-31')` returns true (`CONFIGURE-SUBMISSION-ENDPOINT.md:309-317`).

Copy promises 2–3 working days for small orders and 3–4 for large bouquets
(`site-content.js:333-340`), while the input applies two calendar days to all orders. That is a
policy inconsistency to resolve, not proof that any existing order was late.

Related: `generateOrderReference` ([`app.js:467-474`](app.js#L467-L474)) also builds its
`YYMMDD` segment from the browser's local date, so a late-evening order from a western timezone
can carry a reference dated a day before its Sheet timestamp. Same root cause; fix together.
(The random segment itself is sound — a 32-character alphabet over 256-value bytes divides evenly,
so there is no modulo bias.)

**Fix**

- Base both client and server date-only calculations on `Asia/Makassar`, e.g.
  `new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Makassar' }).format(new Date())`
  — `en-CA` yields `YYYY-MM-DD`, which is what `<input type="date">` expects.
- Parse dates strictly and verify a date round-trip so rollovers are rejected.
- State whether the preference means dispatch, pickup/readiness, or arrival; include
  production/payment and shipping timing clearly.
- Match accepted dates and copy to the owner's chosen calendar/business-day policy and product
  sizes (`O-04`).
- Keep the date provisional until the studio confirms it.

**Acceptance**

- At `2026-09-11T16:30:00Z`, Jakarta and Bali browsers compute the same business-date minimum —
  pin this as a regression test.
- `2027-02-31` and similar impossible dates are rejected.
- Small and large orders follow the documented policy.

---

### ALX-13 — Exclude hidden card-recipient fields when the card is removed

**Priority:** P2 · **Evidence:** Reproduced in the application payload; confirmed by source read.

Disabling the card clears `giftMessage` in the normalized payload, but `recipientName` and
`cardSenderName` remain populated:

```js
giftMessage: messageCardEnabled ? orderNote : '',   // app.js:458  — gated
recipientName: orderRecipientName,                  // app.js:459  — NOT gated
cardSenderName: orderCardSenderName,                // app.js:460  — NOT gated
```

The UI hides their fields and the server stores them unconditionally
(`CONFIGURE-SUBMISSION-ENDPOINT.md:229-232`), so names the customer believed they had removed are
recorded anyway.

**Fix**

- Gate all card-specific submitted fields by `messageCardEnabled`.
- Either clear the draft fields or preserve them only as an explicitly local draft for re-enabling.
- Independently ignore or reject inactive card fields server-side.
- Apply the same condition to persistence, hashing, owner summaries, and tests.

**Acceptance**

- Enter recipient/sender → uncheck card → submit: no card names, text, or fee are recorded.
- Re-enabling the card has consistent documented draft behavior.

---

### ALX-14 — Persist custom leaf additions in the builder draft

**Priority:** P2 · **Evidence:** Reproduced; confirmed by source read.

`persistCart` saves `customCounts` but omits `customAdditions`
([`app.js:80-88`](app.js#L80-L88)), `restoreCartFromStorage` does not restore it, and
`bumpCustomAddition` never calls `persistCart` at all:

```js
function bumpCustomAddition(key, delta) {        // app.js:822
  …
  customAdditions[key] = Math.max(0, cur + delta);
  renderCustomBuilder();                          // no persistCart()
}
```

Two selected rounded-leaf additions became zero after restoring the draft. Committed custom cart
lines *do* preserve their additions, so only the in-progress draft is affected.

**Fix**

- Persist validated draft addition quantities alongside `customCounts`.
- Save after every addition change and reset.
- Apply `ALX-06` limits during restore.
- Keep draft changes separate from already committed bouquet lines.

**Acceptance**

- A reload preserves flower and leaf quantities and the draft estimate.
- Reset survives reload.
- Old or corrupt storage does not break the page.

---

### ALX-15 — Make “Edit selection” reveal a visible selection area

**Priority:** P2 · **Evidence:** Reproduced state; resulting scroll behavior needs browser confirmation.

The control always scrolls to `#collection` and never changes the active category:

```js
editBtn.onclick = () => { scrollToSection('#collection'); };   // app.js:2124
```

Category filters such as pots hide `#collection` (`setCategory`, `app.js:969`). The probe
remained in the pots category with collection `display:none` after editing — the button appears
to do nothing.

**Fix**

- Reveal the intended category before scrolling, or scroll to the visible category overview.
- Focus a useful heading or control after navigation.
- If the action only means “add more products,” label it accordingly.
- If implementing composition editing for a committed custom bouquet, use a dedicated per-line
  edit action that replaces that line rather than appending another.

**Acceptance**

- Edit works from every category filter.
- Keyboard users land at a visible, relevant control.
- Existing cart contents survive navigation.

---

### ALX-16 — Make cart labels describe the action and the products

**Priority:** P2 · **Evidence:** Source finding plus a reproduced mini-pot summary.

A bouquet button changes to “✓ Selected / ✓ Dipilih” but remains an add-one action — clicking
again increments quantity (`app.js:1236-1257`, `:1313-1318`). A selected-state label is
concealing an increment.

A mini-pot-only cart shows “0 tangkai” in the sticky bar, because the bar renders
`${cartTotals.stems} ${t.stemsWord}` ([`app.js:2468`](app.js#L2468)) and mini pots contribute no
stems.

**Fix**

- Use a clear repeat-add label such as “Add another” and show the quantity in the cart.
- Do not use a selected-state label to conceal an increment action.
- For the sticky bar, show the product name for a single item, or a correctly defined item count
  for mixed carts.
- Keep totals and announcements localized.

**Acceptance**

- A second click's effect is understandable before clicking.
- Pot-only and mixed carts have accurate summaries.
- Quantity changes remain visible and accessible.

---

### ALX-17 — Improve mobile product readability and detail access

**Priority:** P2 · **Evidence:** CSS/markup inspection, with grid behavior now measured.

At mobile widths, product descriptions are 12 px and clamped to three lines
(`styles.css:3273-3307`, `:3355-3374`). Only finished-stem images have an inspector
(`app.js:1197`); bouquet and mini-pot images lack an equivalent detail action
(`app.js:1293-1312`). This limits the information available when shoppers compare products.

**Measured, confirming the source-level inference:** at 320 px and 360 px the packages grid
correctly collapses to **1 column**, but the mini-pot grid stays at **2 columns**. Pot cards are
therefore roughly half of a 320 px viewport wide. Page-level layout is otherwise sound — 0
horizontal overflow at 320/360/390/768/1440 px and at 200% text zoom (§9).

**Fix**

- Retain the cream/botanical palette and restrained typography.
- Increase regularly read descriptions toward 14 px, subject to real device review.
- Extend the ≤360 px single-column fallback to the mini-pot grid.
- Ensure full descriptions, approximate size, included items, and studio-selected bouquet
  composition can all be accessed.
- Reuse the existing accessible inspector/detail pattern for all relevant product families.
- Distinguish illustrative custom-bouquet imagery from the exact selected composition.

**Acceptance**

- Verify 320, 360, 390, 768, and 1440 px and 200% text enlargement.
- No clipped essential copy, overlaps, horizontal page overflow, or unusable CTAs.
- Product details can be opened and closed by touch and keyboard.
- Do not claim a WCAG violation solely from a font-size value.

---

### ALX-18 — Add expiry and clear behavior for local order drafts

**Priority:** P2 · **Evidence:** Source finding.

Cart storage contains gift notes and names. Recent-order storage writes a `timestamp` and a
WhatsApp URL, but `loadRecentOrder` never applies an expiry
([`app.js:3091-3116`](app.js#L3091-L3116)) — the stored `timestamp` is written and never read.
The stored `waUrl` is built by `buildPostSubmissionWhatsApp`, which embeds `Nama: ${name}`
([`app.js:493-500`](app.js#L493-L500)), so the buyer's name persists indefinitely in
`localStorage` on what may be a shared device. Dismissing the recent-order banner only hides it
until reload (`app.js:3725-3728`). The surrounding code comment states the intent to store
nothing the privacy notice does not already cover.

**Fix**

- Define and document separate expiry policies for cart drafts, pending attempts, and
  recorded-order recovery. Roughly 14 days matches the order lifecycle for the recent-order record.
- Retain only the data needed for each purpose — either omit the name from the stored `waUrl` or
  rebuild the URL on demand from the reference.
- Make dismiss/clear behavior explicit and persistent where the wording promises dismissal.
- Coordinate expiry with `ALX-03` so uncertain orders do not lose safe recovery silently.
- Explain device-local draft storage in the privacy information; do not imply it follows the
  Sheet's deletion schedule automatically.

**Acceptance**

- Expired records are handled safely and do not reappear as “recent.”
- Shared-device users can clear saved draft information.
- Pending-order expiry leaves a reference/contact recovery path where needed.

---

### ALX-21 — Preserve required indicators during checkout localization

**Priority:** P1 (raised from P2) · **Evidence:** Confirmed in a real browser.

`localizeCheckoutForm` writes translated text with `setText` onto *parent* label spans such as
`#buyer-name-label`, which contain the nested required-mark spans. Setting `textContent` on the
parent removes those children, and the later required-mark entries in the same object literal
then find nothing — insertion order puts every `…-label` key before its matching `…-required` key.
[`index.html:976-1013`](index.html#L976-L1013) · [`app.js:3343-3359`](app.js#L3343-L3359)

**Measured after opening the checkout form:**

```
buyer-name-required      | exists: false
buyer-phone-required     | exists: false
location-type-required   | exists: false
address-required         | exists: false
city-required            | exists: false
postal-required          | exists: false
date-required            | exists: false

#buyer-name-label is now: <span id="buyer-name-label">Nama pemesan </span>
```

**All seven required indicators are destroyed**, every time, for every customer — not merely on
repeated language switches. HTML `required` validation still applies, so the form is not broken,
but nothing on screen tells the customer which fields are mandatory until submission fails.
This is raised to **P1**: it is on the critical purchase path, affects 100% of sessions, and the
fix is small.

**Fix**

- Put translated label text in a dedicated child node, or reconstruct the full label and required
  mark together and consistently.
- Preserve label associations, required state, `aria-describedby`, and field errors.
- Keep accessible names localized; wrapping-chip labels currently append English “wrap paper” in
  both languages.
- Verify focus return and error announcements in a real browser after fixing the DOM structure.

**Acceptance**

- Opening the checkout form once, and repeated language switches, both retain visible required
  indicators — assert the presence of all seven spans in the browser suite.
- Screen readers announce the correct localized label and required state.
- Validation errors remain associated with their controls.

---

### ALX-24 — Provide a no-JavaScript fallback

**Priority:** P2 · **Evidence:** Source finding.

`index.html` contains no `<noscript>` anywhere. `.lock-screen` is visible by default and only
hidden when JavaScript adds `.unlocked` (`styles.css:3933-3949`), so with scripting disabled a
visitor sees a passcode prompt that can never be satisfied — **now and after launch**, when
`auth.enabled` is `false`. All product content is rendered by JavaScript
(`app.js:1044`, `:1141`, `:1282`), so there is nothing behind it either.

**Fix**

- Add a `<noscript>` block with the brand name, a one-line description, and the studio WhatsApp
  link.
- Add `<noscript><style>.lock-screen{display:none}</style></noscript>` so a dead prompt is not
  what a scriptless visitor sees.
- Share this markup with `ALX-22`'s failure fallback.

**Acceptance**

- With JavaScript disabled the curtain is gone and a usable contact fallback shows.

---

### ALX-25 — Close the remaining measured accessibility gaps

**Priority:** P2 · **Evidence:** Measured in-browser at 390 px and 1280 px.

A full pass found the site in good shape (§9). Three specific gaps remain:

**Heading levels skip h2 → h4.** `<h4 class="custom-builder-title">` at
[`index.html:553`](index.html#L553) and `<h4 class="kit-teaser-title">` at
[`index.html:825`](index.html#L825) both follow an `<h2>` section title. Users navigating by
heading level hit a gap. Change both to `<h3>` and adjust the CSS selectors — no visual change
required.

**Small touch targets.** Measured sizes:

| Element | Size | Note |
| --- | --- | --- |
| `#card-note-toggle` | 20×20 | Below WCAG 2.5.8 (AA, 24×24). Wrapped in a `<label>`, so the effective hit area is larger — confirm with a real tap test before changing. |
| Footer links (`.footer-link-whatsapp`, `.footer-link-ig`, `.footer-care`, `.footer-link-order`) | 16 px tall | Desktop only. Add vertical padding. |
| Category tabs (`#cat-tab-all` and siblings) | 40 px tall | Above the 24 px AA floor, below the 44 px the rest of the site targets. |

Everything `README.md` explicitly claims as ≥44×44 — `.btn-order-stem`, `.btn-add-bouquet`,
`.btn-choose-bouquet`, `.btn-channel`, `.btn-stepper`, `.btn-remove-line`, `.chip-wrap` — does
meet it. That claim is accurate; do not "correct" it.

**Acceptance**

- Heading sequence contains no skipped level.
- Targets meet 24×24 minimum, with 44×44 as the house standard where practical.
- Re-measure rather than assume.

---

## 8. Phase D — Metadata and maintenance

### ALX-19 — Correct product metadata and social-image dimensions

**Priority:** P2 · **Evidence:** Confirmed source/content mismatch; image dimensions measured.

The JSON-LD assigns named per-flower bouquet offers (`index.html:72-131`), whereas the real
packages are studio-curated mixed bouquets with no flower-variety chooser
(`site-content.js:369-379`). Structured data therefore advertises products that cannot be ordered
as described.

It also declares the hero social image as 1122×1122 (`index.html:23-24`). **Measured from the
file: `img/hero-1122.webp` is 1122×1402.** The declared height is wrong by 280 px.

A further consideration for launch: the JSON-LD publishes concrete `Offer` prices with
`"availability": "InStock"` while `README.md` labels the whole price list a draft placeholder
pending owner confirmation, and marks the `sameAs` Instagram URL a placeholder. `noindex` keeps
this out of search today; at launch it becomes a public claim about prices the studio has not
committed to and an account the owner has not confirmed they control.

The sitemap points both language alternates at the identical URL, which does not distinguish
independently addressable language versions. `sitemap.xml`'s `lastmod` (2026-09-07) also predates
several content commits.

**Fix**

- Generate product metadata from the actual catalogue and purchasing choices — ideally at build
  time (`ALX-01`) so it cannot drift by hand.
- Represent mixed bouquet packages as mixed products rather than four sets of flower-specific
  offers.
- Include mini pots when appropriate; do not add fabricated stock or review data.
- Set the real dimensions of the existing social image.
- Before flipping `noindex`, confirm every JSON-LD price against final `site-content.js`, and
  either confirm the Instagram URL or remove `sameAs`.
- If maintaining separate language URLs, make them consistently addressable and align their
  canonical/hreflang metadata. Otherwise omit the misleading alternate mappings.
- Refresh `lastmod` as a release step.
- Keep `noindex` until the owner is ready to launch; it is intentional staging configuration.
  `robots.txt`'s `Allow: /` alongside `noindex` is **correct** and should not be "fixed" —
  blocking the crawler in `robots.txt` would prevent it from ever reading the `noindex`.

**Acceptance**

- Structured product names and prices match what can be ordered.
- Share image dimensions match the file.
- Language/canonical behavior is documented and internally consistent.
- Production indexing is an explicit release action.

---

### ALX-20 — Make backend and release files easier to maintain

**Priority:** P3 · **Evidence:** Repository structure.

The production backend source is embedded in a long Markdown guide
(`CONFIGURE-SUBMISSION-ENDPOINT.md:98-105`). `node_modules` is committed — **194 tracked files** —
with no `.gitignore` in the repository at all, and static output is manually duplicated
(**76 tracked files** under `dist/`). There is no `.github/workflows/`. This increases drift and
review noise; it does **not** mean these files are downloaded on every page view.

The absence of CI is why `ALX-02`'s red suite sat unnoticed on `main`.

**Fix**

- Consider extracting Apps Script and Worker code into dedicated versioned source files.
- Generate or link the copy/paste guide from those sources; do not create a second independently
  maintained implementation.
- Add parity checks for prices, supported identifiers, validation limits, and catalogue version.
- Add a `.gitignore` (`node_modules/`, plus `dist/` if `ALX-01` resolves toward deleting it) and
  `git rm -r --cached node_modules`, preserving `package.json` and the lockfile.
- Resolve `dist` handling through `ALX-01`.
- Add CI — `npm ci` → `npm test` → `npx playwright install --with-deps chromium` →
  `npm run test:browser`, on push and PR. Do not rewrite the app into a framework just to
  organize these files.

**Acceptance**

- A new contributor can identify the production frontend and backend entry points.
- There is one authoritative implementation of each backend.
- Changing a catalogue rule cannot silently leave another copy stale.
- A clean dependency install and build are reproducible, and CI runs green.

---

### ALX-23 — Remove unreferenced image weight from the tracked tree

**Priority:** P3 · **Evidence:** Measured.

Nineteen files under `img/` totalling **28.3 MB** are referenced by no HTML, CSS, or JavaScript:
the master PNGs (`hero.png`, `macro.png`, `rose.png`, `kit.png`, and others, each around 2 MB)
plus the entire `us-*` and `kit-*` WebP derivative sets. Two root logos
(`ALXANTHIA LOGO 2-02.png`, `alxanthia-logo-96.png`) are unreferenced as well.

**This does not slow the site down.** Bouquet cards render `src="${pkg.photoWebp || pkg.photo}"`
([`app.js:1296`](app.js#L1296)), so the PNG fallbacks are never fetched, and a first page load
transfers roughly 127 KB of images. The cost is repository and deploy weight: `dist/` alone is
41 MB and `.git` is 39 MB for what is a four-file site.

**Fix**

- Move master PNGs out of the deployed tree — a `sources/` directory excluded from the `ALX-01`
  build allowlist, or off-repo entirely.
- Delete the orphaned `us-*` and `kit-*` derivatives once it is confirmed those sections are gone
  for good.
- Keep every file that a `srcset` still names.

**Acceptance**

- Every remaining file under `img/` appears in at least one of `index.html`, `app.js`,
  `site-content.js`, `styles.css`.
- The built output contains only referenced assets.

---

### ALX-26 — Add a Content-Security-Policy

**Priority:** P3 · **Evidence:** Source finding.

There is no CSP. GitHub Pages cannot set response headers, but
`<meta http-equiv="Content-Security-Policy">` covers everything except `frame-ancestors`. Given
that the site posts customer PII to an external endpoint, this is worth the few lines as defence
in depth. Starting point, to be tested before shipping:

```
default-src 'self';
script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com;
style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
font-src https://fonts.gstatic.com;
img-src 'self' data:;
connect-src 'self' https://<the-final-worker-hostname>;
frame-src https://challenges.cloudflare.com;
base-uri 'self';
form-action 'none'
```

`'unsafe-inline'` is currently required by the inline unlock script (`index.html:357`) and the
inline `style` attributes `app.js` writes into card markup; dropping it means moving both to
external files or nonces. Tighten `connect-src` to the final endpoint once `ALX-10` settles it;
the Cloudflare entries can be removed if Turnstile is not adopted.

**Related, lower priority:** the Google Fonts stylesheet (`index.html:316-320`) blocks first
render behind an extra DNS and TLS round trip, and sends every visitor's IP and user-agent to a
third party before they have consented to anything — worth weighing against the privacy notice
the checkout already shows. Self-hosting the two families as WOFF2 removes both concerns and the
`preconnect` pair. Whether self-hosted or not, give every `font-family` a real fallback stack so
a blocked or slow font never leaves text invisible.

**Acceptance**

- The policy is present and the site functions fully with it enforced.
- No console CSP violations in a normal purchase journey.

---

## 9. Verified sound — do not "fix" these

Measured against the audited commit in headless Chromium, unless noted. Listed because a
subsequent agent should not spend effort here, and because several of these were open questions
in Audit A's scope limits.

- **Colour contrast passes WCAG AA** at 390 px and 1280 px — **0 failing text nodes**, computed
  with correct alpha compositing of layered translucent backgrounds. An earlier naive pass that
  ignored alpha produced false failures as low as 1.42; those were an artifact of the checking
  method, not of the site.
- **No horizontal overflow** at 320, 360, 390, 768, and 1440 px, nor at 200% text zoom
  (`scrollWidth === clientWidth`, 0 overflowing elements at every width).
- **No JavaScript console errors** on load or during interaction.
- **Markup integrity:** 0 duplicate IDs, 0 broken internal anchors, 0 dangling `aria-controls` /
  `aria-labelledby` / `aria-describedby`, every form control labelled, exactly one `<h1>`, every
  `<img>` carries `alt`.
- **XSS discipline holds.** All 22 `innerHTML` sites interpolate owner-controlled config only;
  every user-supplied value (gift note, buyer name, recipient/sender) goes through `textContent`.
  No `insertAdjacentHTML`, `document.write`, `eval`, or `new Function` anywhere.
- **No secret reaches the browser.** The webhook secret lives in the Worker; the client posts only
  the order payload.
- **Server-side repricing and idempotency design are sound** — a server-owned catalogue, a real
  UUID key separate from the human-readable reference, payload hashing, typed failure handling
  (`success | duplicate | conflict | ambiguous | connection | rejected`), a 20-second timeout, and
  a strict success check requiring the reference to match. The defects above are gaps in this
  design's edges, not in its shape.
- **`prefers-reduced-motion` is respected** in both CSS and JavaScript.
- **Performance is healthy:** roughly 84 KB gzipped for the full critical path (HTML + CSS + both
  JS files — 11.2 + 17.2 + 15.3 + 40.3 KB), 6 requests on first load, hero image
  `fetchpriority="high"`, responsive `srcset` throughout, WebP everywhere, `loading="lazy"` below
  the fold.
- **Client and server constants agree** where they are supposed to: `minimumLeadDays: 2` ↔
  `MINIMUM_LEAD_DAYS = 2`; `catalogVersion: 1` ↔ `CATALOG_VERSION = 1`.
- **Owner documentation is genuinely strong.** `OWNER-ACTION-GUIDE.md`,
  `CONFIGURE-SUBMISSION-ENDPOINT.md`, and `PANDUAN-KONTEN.md` are specific, sequenced, and honest
  about what the repository cannot verify.

---

## 10. Reconciliation notes

Where the two audits disagreed, and how each was settled.

**The preview curtain — severity.** Audit B graded the client-side passcode gate a **blocking
vulnerability**, on the grounds that the full DOM (84,767 characters, including the H1 and the
whole catalogue) is readable while "locked" and the passcode ships in a public file. Audit A
graded it a known convenience and directed that it not be reported as a newly discovered
authentication vulnerability, since `README.md` already documents it as a staging curtain.

**Audit A is correct and Audit B's grade was wrong.** A documented, intentional client-side
curtain is not a vulnerability discovery, and grading it Blocking crowded out the genuinely
blocking checkout defects. It is also not what protects the order endpoint — that is `ALX-10`'s
job, and treating the curtain as a security control is precisely the confusion to avoid.

What survives as actionable is narrower and moves into `ALX-22`: the gate **fails open** on a
config error (reproduced), the passcode is duplicated across four locations so it cannot be
rotated in one edit, and the `?unlock=` parameter leaks it into history and `Referer` headers.
Audit B's reproduction of the passcode value has been removed from this document, per instruction
12.

**`ALX-21` — severity raised.** Audit A graded it P2 with browser presentation "remaining to
verify." Browser verification showed all seven required markers destroyed on the first open, not
merely after repeated language switches. Raised to **P1**.

**Overlaps folded in, not duplicated.** Audit B's separate findings for text-field `maxlength`,
recent-order expiry, JSON-LD placeholder data, and committed `node_modules`/CI were merged into
`ALX-06`, `ALX-18`, `ALX-19`, and `ALX-20` respectively, since Audit A's framing of each was
broader. Audit B's order-reference timezone finding folded into `ALX-12`, which shares its root
cause.

**Scope limits narrowed.** Audit A listed the browser runner as "Not run" and recorded no browser
accessibility scan, Core Web Vitals, or viewport measurement. Those were subsequently run; §3 and
§9 carry the results, and `ALX-17`'s mini-pot grid inference is now measured rather than inferred.

**Independent re-verification.** Every Audit A finding carried into this document was re-checked
against the working tree — `ALX-03` through `ALX-16`, `ALX-19`, `ALX-21` — including direct
confirmation of `MAX_QTY_PER_LINE = 20` versus an unbounded client stepper, the unbounded
`validateCustomStems`, the browser-supplied `Order Summary`, the `clearTimeout`-before-`json()`
ordering, the ungated `recipientName`/`cardSenderName`, the missing `customAdditions`
persistence, the `2027-02-31` rollover, and the 1122×1402 hero image. **All held.** No Audit A
finding was downgraded or dropped.

---

## 11. Owner launch checks

These are configuration and business confirmations, not proof of defects in the live deployment.
Agents can prepare changes and instructions, but **must not invent the answers.**

| ID | Confirm | Evidence needed |
| --- | --- | --- |
| O-01 | Actual hosting path and versions | Which host serves alxanthia.com, which directory it publishes, and whether frontend/Worker/Apps Script match the release candidate |
| O-02 | Checkout abuse controls | Real Turnstile site/secret configuration and tested rate limiting on the endpoint the site actually calls — note the `workers.dev` hostname question in `ALX-10` |
| O-03 | Fulfillment choices | Whether self pickup remains offered. Earlier delivery-only intent and current pickup options should not be reconciled by silently guessing |
| O-04 | Timing and commercial copy | Calendar versus working days, large-order preparation, whether preferred date means ready/dispatch/arrival, how shipping is confirmed, cancellation/change and severe-damage handling |
| O-05 | Data and owner operations | Restricted Sheet access, notification delivery, actual retention/deletion process, monitored confirmation contact, verified final amount before sending payment links |
| O-06 | Public release | Remove the preview curtain and `noindex` together only when approved for launch; verify custom domain, contact links, share previews, and mobile ordering |

The client-side preview curtain is a convenience, not a server-side confidentiality control. The
`README.md` already acknowledges this. Do not report its presence as a newly discovered
authentication vulnerability, do not treat it as protection for the public order endpoint, and do
not reproduce its passcode in reports.

### Planned owner menu

The documented Apps Script contains no `onOpen`/custom-menu implementation for
“Alxanthia Orders → Verify & Prepare WhatsApp.” That is a planned owner-workflow enhancement, not
a prerequisite for fixing the customer checkout.

If implementing it under the owner's earlier request, retain Option 1: validate the selected row,
preview the verified totals and Midtrans link, and open a prepared message for the owner to send
manually. Do not label a draft as “sent,” automatically mark payment as paid, or switch to the
WhatsApp API.

---

## 12. Final validation matrix

Use the release candidate and a dedicated test backend. Keep automated network calls intercepted
unless explicitly running a controlled staging integration test.

| Area | Required scenarios |
| --- | --- |
| Products/pricing | Every stem, each mini pot, each package, custom bouquet, leaf additions, mixed cart, card on/off, wrap-fee boundary |
| Limits | Zero/negative/fractional/too-large quantities, 20→21 per line, total-unit and line-count boundaries, huge nested custom counts, supported phones and text lengths |
| Submission | Normal success, same-key duplicate, changed-payload conflict, forced short-reference collision, double submit |
| Recovery | Store then lose response; reload pending attempt; edit after uncertainty; slow headers; stalled body; malformed JSON |
| Post-success | Close/reopen unchanged order; add products after success; recover previous reference; start another order |
| Storage | Reordered columns, missing/duplicate headers, append succeeds/formula fails, safe repair, zero versus blank shipping |
| Configuration failure | Broken `site-content.js`: fallback shows, curtain stays up, diagnostic names the cause |
| UI | All category filters, Edit selection, repeated add, custom draft reload, card-detail clearing, store paused, unavailable endpoint |
| Accessibility | Keyboard-only navigation, radio arrows, modal focus/return, **visible required markers (all seven)**, field errors, reduced motion, text enlargement, heading sequence, target sizes |
| Devices | 320/360/390/768/1440 px, mobile soft keyboard, viewport height changes, browser Back/reload, JavaScript disabled |
| Metadata/output | Built assets, catalogue/schema parity, canonical/language behavior, image dimensions, intended indexing state |
| Operations | One test order arrives once with correct details; owner notification works; manual payment draft matches verified final total |

---

## 13. Completion report template

~~~text
Audited baseline:
Implemented commit:
Build/publish directory:

Fixed:
- ALX-__: files changed; resulting behavior; regression evidence

Already fixed / not reproduced:
- ALX-__: current-source evidence

Needs owner input:
- O-__: exact outstanding decision or setting

Validation:
- Cart/pricing suites:
- Server suites (S1-S6 all executed?):
- Worker/storage regression tests:
- Browser/device checks:
- Staging integration:
- Build-output verification:

Deployment:
- Frontend changes ready:
- Apps Script version/update required:
- Worker configuration/update required:
- Sheet migration required:
- Published: yes/no, only as authorized
~~~

A passing simulated DOM suite does not establish a passing browser experience. A passing browser
suite on a local server does not establish a passing real-device experience. A corrected
repository does not establish that copied Apps Script or Worker deployments have been updated.
Report each boundary separately.
