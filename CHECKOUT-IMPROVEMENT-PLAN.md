# Checkout improvement plan

**Status:** the checkout is deployed and functional. It is not production-perfect.
The foundation is sound; the weaknesses are trusted pricing, spreadsheet correctness,
abuse protection, failure recovery, accessibility, and incomplete testing.

This document merges two independent audits of the checkout system as configured per
[`CONFIGURE-SUBMISSION-ENDPOINT.md`](CONFIGURE-SUBMISSION-ENDPOINT.md). No application
files were changed by either audit.

## How to use this document

It has two parts, for two different people:

- **Part 1 — Owner tasks** — things only the store owner can do: Google Sheet edits,
  Apps Script settings, Cloudflare dashboard, and decisions nobody else can make for
  you. **No coding required.**
- **Part 2 — Developer tasks** — code changes, written so an AI coding agent or a
  developer can work through them in order. Each task states the files, the problem,
  and what "done" means.

Some tasks are paired: the developer changes the code, the owner changes the sheet.
Those are cross-referenced. **Do the owner half and the developer half of a pair in the
same sitting**, or orders will land in the wrong columns in between.

### Evidence markers

| Marker | Meaning |
| :-- | :-- |
| ✅ | Reproduced in this workspace — code read, or run in headless Chromium at 390×844 with the endpoint stubbed (no test row was written to the production sheet). |
| ◐ | Verified by the second audit against the **live deployment**, which this workspace cannot reach. Trustworthy, but re-confirm after any change to the Worker. |

---

## Summary

| Phase | What it fixes | Owner tasks | Dev tasks |
| :-- | :-- | --: | --: |
| **0. Unblock** | The test suite is red, so nothing else can be verified | 0 | 3 |
| **1. Money & the sheet** | Wrong or missing numbers in the order record | 6 | 6 |
| **2. Trust & abuse** | Anyone can post fake orders; prices are taken on faith | 4 | 8 |
| **3. Recovery** | Customers stuck, duplicated, or unable to name their order | 0 | 8 |
| **4. Language & access** | Half-Indonesian English flow; screen-reader dead ends | 0 | 8 |
| **5. Mobile & clarity** | Long modal with no exit, no back, no anchored total | 0 | 6 |
| **6. Operations** | Nobody is told an order arrived | 5 | 4 |
| **7. Launch** | Privacy notice, passcode, search indexing | 4 | 4 |
| | | **19** | **47** |

**Launch blockers** are marked 🔴 throughout. Everything else can ship after launch,
but the 🔴 items should not.

---

# Part 1 — Owner tasks (no coding)

These are done in Google Sheets, the Apps Script editor, and the Cloudflare dashboard.
Take them in order. Where a task says *"pairs with DEV-xx"*, tell your developer or AI
agent to do that task at the same time.

## Phase 1 — Money and the sheet

### 🔴 OWNER-01 · Remove the Final Total formula from the sheet

**Why:** the setup guide told you to put a formula in cell `AC2` and copy it down the
Final Total column. That fights with the script. Every new order writes a blank into that
same column, and if you copied the formula down many rows, new orders get appended
*below* the whole block of formulas — leaving a gap and a row with no formula at all.
Either way the Final Total you read to invoice is wrong or empty. ✅

**Do this:**

1. Open the **Orders** sheet.
2. Select the whole **Final Total** column (column AC) *except* the header in row 1.
3. Press Delete to clear it completely.
4. Leave it empty. From now on the script fills it in, one row at a time.

*Pairs with DEV-04.* Do not place any formula in that column again.

### 🔴 OWNER-02 · Add the missing columns

**Why:** four pieces of information are sent by the website every time but have nowhere
to land. The most important is **Language** — it is the first thing you need to know
before you open WhatsApp and write to that person. **Acknowledged** matters because you
currently require customers to accept your terms and then keep no record that they did. ✅

**Do this** — add these headings to the right of your existing `Internal Notes` column:

| New heading | What goes in it |
| :-- | :-- |
| `Language` | `id` or `en` — which language the customer used |
| `Acknowledged` | `Yes` — proof they accepted your terms |
| `Source` | `website` — useful once you take orders elsewhere |
| `Catalog Version` | Which price list was live when they ordered |
| `Payload Hash` | A fingerprint of the submitted order, for duplicate checks |

*Pairs with DEV-05.* The script will not write to these until that task is done.

### 🔴 OWNER-03 · Split the money columns into "submitted" and "verified"

**Why:** the prices in the sheet come from the customer's own browser. A technically
skilled visitor can change them before sending. Right now they sit in the sheet looking
exactly like real, checked figures — which is how a wrong invoice gets sent. ◐

**Do this** — rename three existing headings, then add three new ones beside them:

| Rename this | To this |
| :-- | :-- |
| `Product Subtotal` | `Submitted Subtotal` |
| `Discount` | `Submitted Discount` |
| `Estimated Product Total` | `Submitted Total` |

Then add: `Verified Subtotal`, `Verified Discount`, `Verified Total`.

**The rule from here on:** you never invoice from a `Submitted` column. You check the
current price list, type the real figure into the `Verified` column, and the Final Total
calculates from that. *Pairs with DEV-07.*

### OWNER-04 · Set the Apps Script timezone

**Why:** timestamps currently use whatever timezone your Google account was created in,
not Bali's. It is invisible until you argue with someone about a delivery date. ✅

**Do this:**

1. In the spreadsheet: **Extensions → Apps Script**.
2. Click the gear icon (**Project Settings**) in the left sidebar.
3. Under **Time zone**, choose **(GMT+08:00) Makassar** — or **(GMT+07:00) Jakarta** if
   you work on WIB.
4. Go back to the editor and **Deploy → Manage deployments → Edit → Deploy** to republish.

### OWNER-05 · Protect the calculated columns

**Why:** one accidental paste over the Final Total column and your order history is wrong
with no warning.

**Do this:** select the `Final Total` and all three `Verified` columns → right-click →
**Protect range** → set to **Only you** can edit. The implementation plan already asked
for this (`revisions/komorebi-checkout-implementation-plan.md:460`); it has not been done.

### OWNER-06 · Restrict who can open the sheet

**Why:** this sheet holds full home addresses and phone numbers for real people, including
gift recipients who never visited your website.

**Do this:** **Share** → confirm it is **not** "Anyone with the link". Remove anyone who
does not need it. Check this again after anyone leaves the studio.

## Phase 2 — Stopping abuse

### 🔴 OWNER-07 · Turn on bot protection (Cloudflare Turnstile)

**Why:** the only thing currently protecting your endpoint is a browser rule called CORS.
CORS is not a lock. Any script can pretend to be your website and post orders in a loop.
That fills your sheet with junk containing real-looking personal data — and worse, Google
Apps Script has a daily limit. Once a bot burns through it, **real orders stop being
saved** until the next day, while you are asleep. ◐

**Do this:**

1. In the Cloudflare dashboard, go to **Turnstile** → **Add widget**.
2. Name it `alxanthia-checkout`, set the domain to `alxanthia.com`, mode **Managed**.
3. Copy the **Site Key** and the **Secret Key**.
4. Give the **Site Key** to your developer (it is safe to share — it goes in the website).
5. Add the **Secret Key** to the Worker: **Workers & Pages → your Worker → Settings →
   Variables and Secrets → Add**, name `TURNSTILE_SECRET`, type **Secret**.

*Pairs with DEV-11 and DEV-12.* It is free, and a real customer never sees it.

### 🔴 OWNER-08 · Add a rate limit to the Worker

**Do this:** in the Cloudflare dashboard, **Security → WAF → Rate limiting rules → Create
rule**. Match the path of your Worker route, set **10 requests per minute per IP**, action
**Block**. A real customer places one order; ten a minute is a machine.

### 🔴 OWNER-09 · Decide and confirm your domain

**Why:** the Worker allows exactly one web address. Your site is `alxanthia.com`. If any
customer reaches `www.alxanthia.com` instead, their order is silently rejected and they
see a scary error — and you will never be able to reproduce it, because it works fine on
your machine. ◐

**Do this:**

1. Open `https://www.alxanthia.com` on your phone, on mobile data, not on studio WiFi.
2. If it redirects to `https://alxanthia.com`, you are fine — tell your developer
   "www redirects".
3. If it loads and stays on `www.`, tell your developer "www stays" so they can add it to
   the allowed list (DEV-13).

### OWNER-10 · Decide your production lead time

**Why:** the delivery date field currently accepts **any** date, including dates in the
past — an order asking for delivery on 1 January 2020 goes through cleanly. ✅ But the
real constraint is not just "no past dates": you need 2–3 days to make flowers, so
tomorrow is usually impossible too.

**Decide and tell your developer:** *"the earliest date a customer may choose is N days
from today."* Pick the number you can honour on a busy week, not your best week.
*Pairs with DEV-18.*

## Phase 6 — Operations

### 🔴 OWNER-11 · Get notified when an order arrives

**Why:** right now, nothing tells you an order came in. You find out by remembering to
open a spreadsheet. That is the single most likely way you lose a real sale.

**Do this** (2 minutes, no coding):

1. In the **Orders** sheet: **Tools → Notification settings → Edit notifications**.
2. Choose **Any changes are made** and **Notify me right away**.
3. Save.

This is the crude version and it works today. *DEV-40 replaces it with a proper email
containing the order details.*

### OWNER-12 · Use clearer order statuses

**Why:** `Awaiting confirmation` does not say whether **you have checked the price yet**.
That is the one thing that must be true before you send a payment link.

**Do this:** edit the Payment Status dropdown (**Data → Data validation**) to read:

```text
Received - unverified
Verified
Awaiting payment
Paid
Expired
Refunded
Cancelled
```

New orders arrive as `Received - unverified`. You move them to `Verified` **only after**
you have checked the current price, stock, address, and delivery fee, and typed the real
figures into the `Verified` columns from OWNER-03. *Pairs with DEV-08.*

### OWNER-13 · Watch your Apps Script quota

Once a month, open the Apps Script editor → **Executions** in the left sidebar. If you see
failures, or far more runs than you had orders, something is submitting to your endpoint
that is not a customer. That is the early warning for OWNER-07.

### OWNER-14 · Write down how long you keep customer data

**Why:** you are storing home addresses indefinitely with no stated policy. Indonesia's
personal data law (UU PDP 27/2022) expects you to say what you collect, why, and for how
long.

**Decide:** how many months after delivery do you keep an order row? (12 months is a
common, defensible answer for a small studio.) Then put a reminder in your calendar to
delete or archive older rows. *Feeds into DEV-44, which writes the notice.*

### OWNER-15 · Back up the sheet

**Do this:** **File → Make a copy** monthly into a folder called `Orders Backup`. A sheet
is a database now; treat it like one.

## Phase 7 — Launch

### 🔴 OWNER-16 · Never mark an order Paid from a screenshot

Only ever set `Paid` after you have seen the payment in the **Midtrans dashboard**
yourself. A screenshot in WhatsApp is not evidence — it is the single easiest thing in
this whole system to fake. This is already in your setup guide; it is repeated here
because it is the one rule that costs you money directly.

### 🔴 OWNER-17 · Approve the privacy notice

Your developer will write a short privacy notice (DEV-44). You need to read it and confirm
two things are true: **who can see the data** (the answer from OWNER-06) and **how long you
keep it** (the answer from OWNER-14). Nobody else can answer those.

### 🔴 OWNER-18 · Launch switches — last, together

Only after the 🔴 items above are done and you have run the full test in
[`CHECKOUT-SETUP.md`](CHECKOUT-SETUP.md):

1. In `site-content.js`, change `auth.enabled: true` to `auth.enabled: false` — this
   removes the passcode gate. ✅
2. Ask your developer to do DEV-45 (remove the `noindex` tag) in the **same** deployment.

Doing only one of these is the common mistake: a passcode-free site that Google still
refuses to list, or a listed site nobody can enter.

### OWNER-19 · Understand what the passcode is and is not

The passcode `22062024` sits in plain text in `site-content.js`, which anyone can read by
viewing your website's source. ✅ It keeps casual visitors and search engines out while you
finish. It is **not** security and it never was. Do not put anything behind it that would
actually matter if a stranger saw it.

---

# Part 2 — Developer tasks (code)

Written for an AI coding agent. Work the phases in order — each phase makes the next one
verifiable. Do not skip Phase 0.

**Repository conventions:** vanilla JS, no build step, no framework. `site-content.js`
holds all owner-editable configuration. `npm test` runs `tests/verify-ordering.js`. Match
the surrounding code style.

## Phase 0 — Unblock the test suite

### 🔴 DEV-01 · Repair `npm test`

`npm test` fails at Suite 3 and stops. Every suite after it never runs — **including
Suite 24, which is the checkout payload and privacy test**. The safety net you need to
verify all 46 other tasks is currently switched off. ✅

The assertion hardcodes the old placeholder WhatsApp number, and the commit that
configured the submission endpoint also set the real one:

- `tests/verify-ordering.js:592` expects `https://wa.me/6281234567890?text=`
- `site-content.js:39` is now `628972000622`

**Fix:** read the number from the loaded config rather than hardcoding it, so the suite
tests behaviour rather than one particular phone number. Check the rest of the file for
the same pattern before assuming line 592 is the only occurrence.

**Done when:** `npm test` runs to completion and Suite 24 reports a result.

### 🔴 DEV-02 · Make the browser runner cross-platform

`tests/run-browser-runner.js:4` shells out to a hardcoded
`C:\Program Files\Google\Chrome\Application\chrome.exe`, so it cannot run on macOS, Linux,
or CI. ✅

Playwright is already a dev dependency. Drive `tests/browser-runner.html` through it and
delete the hardcoded path.

**Note:** the runner's tests themselves are fine — run through Playwright they produce 14
passes and one genuine failure (DEV-03). Do not "fix" the runner by changing its
assertions.

### 🔴 DEV-03 · Fix the package-selection focus bug

Reproduced in Chromium via the repo's own runner ✅:

```text
✖ FAIL: Package select preserves active button focus
        (active: step-label finish-label-pulse idx=null)
```

Choosing a bouquet package moves focus to `#finish-label` instead of leaving it on the
button the user just activated. A keyboard user loses their place in the package grid on
every selection. `tests/browser-runner.html:97` already asserts the correct behaviour —
the assertion is right and the app is wrong.

**Done when:** the runner reports 15 passes, 0 failures.

## Phase 1 — Money and the sheet

> Every task in this phase changes what a stored order **means**. Coordinate with
> OWNER-01 through OWNER-03 — the sheet columns must change in the same sitting as the
> script.

### 🔴 DEV-04 · Generate the Final Total formula per row

In `CONFIGURE-SUBMISSION-ENDPOINT.md`, Part 1 instructs the owner to put
`=IF(AA2="","",AA2+IF(AB2="",0,AB2))` in `AC2` and copy it down; Part 2's `appendRow`
writes `''` into that same position 29 on every order. `appendRow()` does not reliably
propagate a column formula, and rows pre-filled with a formula count as content — so
`getLastRow()` pushes each new order *below* the entire formula block. ✅

**Fix:** stop pre-filling the column (OWNER-01) and have the script write the formula onto
the row it just created:

```javascript
const row = sheet.getLastRow();
sheet.getRange(row, FINAL_TOTAL_COL).setFormula(
  '=IF(' + verifiedTotalCell + '="","",IF(' + shippingCell + '="","",' +
  verifiedTotalCell + '+' + shippingCell + '))'
);
```

Note the nested condition: **Final Total stays blank until Shipping Fee is entered.**
Treating a missing shipping fee as zero produces a confident, wrong total — worse than an
obviously empty cell.

Update the guide's Part 1 to match, and delete the `AC2` instruction. Column positions
shift once OWNER-02 and OWNER-03 are done, so derive them from named constants rather than
hardcoding `29`.

### 🔴 DEV-05 · Persist the fields that are already being sent

`submitted_language`, `currency`, `source` and `acknowledgement` are all sent by the
browser and validated by the script, then dropped — `appendRow` has no column for them. ✅
You enforce a consent you keep no record of, and you discard the one field that tells the
studio which language to reply in.

**Fix:** write all four into the columns added in OWNER-02.

### 🔴 DEV-06 · Send booleans as booleans

Reproduced payload ✅:

```json
"acknowledgement": "on"
```

...and `anonymous_gift` absent entirely when unchecked. That is HTML's default checkbox
behaviour, not a decision. The sheet therefore shows `on` for a surprise gift and blank
otherwise — and blank is indistinguishable from a field nobody answered.

**Fix:** normalize in `buildOrderSubmission` (`app.js:324`) to `'yes'` / `'no'` before
sending. Ambiguity in a picking list is how the wrong card ends up in the box.

### 🔴 DEV-07 · Separate submitted totals from verified totals

The Worker forwards `product_subtotal`, `discount_amount` and `estimated_product_total`
straight from the browser, and Apps Script only checks they are non-negative. A customer
can edit all of them, plus quantities and item IDs, before submitting. ◐

`CHECKOUT-SETUP.md` requirement 4 says the endpoint **must** "recalculate current product
prices rather than trusting browser totals". The shipped Worker does not. The two
documents currently contradict each other, which will mislead whoever maintains this next.

**Fix, in preference order:**

1. **Best** — mirror the price table in the Worker (or fetch a server-owned catalogue) and
   recompute the total from `item_data`. Store the recomputed figure in the `Verified`
   columns automatically, and flag any mismatch with the submitted figure in
   `Internal Notes`.
2. **Acceptable** — write submitted figures only into the `Submitted` columns (OWNER-03),
   leave `Verified` blank for the owner to fill, and amend requirement 4 in
   `CHECKOUT-SETUP.md` to say totals are advisory and manually verified.

Do not leave both documents standing as they are.

### DEV-08 · Default new orders to `Received - unverified`

Update the status the script writes on append to match OWNER-12's dropdown, so the sheet
distinguishes "we have this order" from "we have checked its price".

### DEV-09 · Record catalogue version and payload hash

Write a `Catalog Version` (bump it whenever prices change in `site-content.js`) and a
`Payload Hash` — a SHA-256 of the normalized order fields — into the columns from
OWNER-02. The hash makes DEV-15's conflict detection possible and lets you prove, months
later, exactly what was submitted.

## Phase 2 — Trust and abuse protection

### 🔴 DEV-10 · Validate the order properly on the server

`validateOrder` in `CONFIGURE-SUBMISSION-ENDPOINT.md` only confirms `item_data` is a
non-empty array. It does not check any of:

| Missing check | Why it matters |
| :-- | :-- |
| Product and package IDs exist | An unknown ID becomes an unfillable order |
| Quantities are positive integers within a maximum | Guards against a 9,999-stem order |
| Custom bouquet composition meets the minimum | The website enforces it; the server does not |
| `item_data` totals agree with `total_stems` | Catches tampering and bugs together |
| Price relationships (discount ≤ subtotal, total = subtotal − discount) | Internal consistency |
| Text field maximum lengths | A 50,000-character note breaks the sheet cell |
| `recipient_contact_permission` is one of the four allowed values | Free text here means a surprise gift gets spoiled |
| `buyer_email` is a plausible address when present | It is your fallback contact |
| `postal_code` is exactly 5 digits ✅ | `"abcde"` submitted cleanly |
| `preferred_date` parses and is ≥ today + lead time ✅ | `"2020-01-01"` submitted cleanly |

The last two are confirmed reproduced; the rest follow from reading the validator.

**Fix:** extend `validateOrder`. Reject with a specific, non-sensitive reason code per
failure so DEV-21 can show the customer something actionable. The client-side rules in
DEV-18 and DEV-19 are convenience, never the guarantee.

### 🔴 DEV-11 · Verify Turnstile in the Worker

Once the owner completes OWNER-07, add server-side verification: POST the token to
`https://challenges.cloudflare.com/turnstile/v0/siteverify` with `TURNSTILE_SECRET`, and
reject the order if it does not validate. Verifying on the server is the entire point — a
token checked only in the browser protects nothing.

### 🔴 DEV-12 · Add the Turnstile widget to the form

Render the widget in `#checkout-form` (`index.html:878`) using the Site Key from OWNER-07,
and include the token in the payload. Use the invisible/managed mode so a real customer
sees nothing.

### 🔴 DEV-13 · Accept an allowlist of origins

`ALLOWED_ORIGIN` is a single exact string; `CNAME` is `alxanthia.com`. Any customer
arriving at `www.alxanthia.com` — or the `github.io` address if it stays live — gets a
CORS rejection surfaced as the generic "we could not verify" message, on an order that
never existed. ◐

**Fix:** accept a comma-separated allowlist, match the incoming `Origin` against it, and
echo back the matching origin in `Access-Control-Allow-Origin`. Never echo an unvalidated
origin. Confirm the answer to OWNER-09 before choosing the list.

### 🔴 DEV-14 · Limit payload size

Reject requests over a sensible ceiling (16 KB is generous for this order shape) before
parsing, and cap `item_data` length. Without this, one request can consume an Apps Script
execution and a chunk of your daily quota.

### 🔴 DEV-15 · Strengthen idempotency, and reject conflicts

Two problems in the current dedupe:

1. `findOrderRow` matches on `order_reference` alone and returns success. With four
   characters from a 32-symbol alphabet (~1M combinations per day), a genuine collision
   between two different customers returns `ok: true, duplicate: true` — the second
   customer sees the success screen and the WhatsApp button while **nothing was stored**.
   Rare, but the failure mode is total, silent data loss that looks exactly like success. ✅
2. The reference is a *display* identifier shown to the customer. It should not also be the
   idempotency key.

**Fix:** generate a strong internal idempotency key (UUID v4) per checkout attempt, send it
alongside the human-readable reference, and dedupe on it. If a request arrives with a known
key but a **different payload hash** (DEV-09), return **HTTP 409** rather than a false
success. Keep the friendly `ALX-YYMMDD-XXXX` reference for humans.

### 🔴 DEV-16 · Require the exact acknowledgement

`app.js:2654` ✅:

```javascript
if (result.ok !== true || (result.order_reference && result.order_reference !== checkoutAttempt.reference)) throw ...
```

The `(result.order_reference && ...)` guard short-circuits when the field is missing — so a
response of `{"ok": true}` with **no reference at all** is accepted as proof of storage.
That defeats the system's best design decision, which is refusing to show success until
storage is confirmed.

**Fix:**

```javascript
if (result.ok !== true || result.order_reference !== checkoutAttempt.reference) throw ...
```

### DEV-17 · Do not relay backend error strings

The Worker forwards `result.error` from Apps Script verbatim on the 502 path. Today those
strings are benign, but they originate in server code and nothing constrains what a future
edit puts in them.

**Fix:** relay a fixed set of known validation codes; collapse everything else to a generic
message and log the detail server-side against the reference. This pairs with DEV-21 — the
customer gets *more* useful errors, just not raw ones.

## Phase 3 — Validation and failure recovery

### 🔴 DEV-18 · Enforce a minimum delivery date

No `min` attribute on `[name="preferred_date"]`, and the server only checks the field is
non-empty. ✅

**Fix:** set `min` to today + the lead time from OWNER-10 when the form opens, add the
matching server check (part of DEV-10), and state the lead time in the help text so the
disabled dates make sense. A `min` attribute is a hint to the browser, never a guarantee.

### DEV-19 · Constrain the postal code

`inputmode="numeric"` only suggests a keypad. Add `pattern="[0-9]{5}"` and `maxlength="5"`,
with `/^\d{5}$/` server-side. ✅

### 🔴 DEV-20 · Add a request timeout

`app.js:2651` calls `fetch` with no `AbortController`. If the Worker or Apps Script hangs
rather than failing, the button reads *Menyimpan…* until the browser gives up — minutes, on
mobile, with no explanation. ✅

**Fix:** `AbortSignal.timeout(20000)`. Give the timeout its own message: the order may or
may not have saved, so tell them to check with the studio before retrying — and keep the
same idempotency key so a retry cannot double-book.

### 🔴 DEV-21 · Distinguish failure causes

Offline, a 502, a CORS rejection and a validation refusal all land in the same `catch` and
produce the same sentence. ✅ A customer who could fix their own input is instead told to
contact the studio.

**Fix — three branches:**

| Case | Message |
| :-- | :-- |
| Validation rejection (code from DEV-17) | Show the reason next to the offending field; the order was not saved |
| Transport failure (offline, DNS, CORS) | "We could not reach the studio. Your order was not saved — please try again." |
| Ambiguous (timeout, 5xx after send) | The existing "contact us with reference ALX-…" message |

Only the third should alarm anyone. Add explicit **Retry** and **Copy reference** buttons
on the failure state.

### 🔴 DEV-22 · Guard the dialog during submission

Escape closes a native `<dialog>` and nothing guards it mid-flight. The request completes,
the row is written, and `showRecordedOrder` updates a dialog nobody is looking at — the
order exists but the customer never sees the reference or the WhatsApp handoff. ✅

**Fix:** track `isSubmitting`; `preventDefault()` on the dialog's `cancel` event and
disable the close button while it is set.

### 🔴 DEV-23 · Prevent accidental second orders

After success the cart still holds the same line ✅ — verified via `getCart()` immediately
after `showRecordedOrder`. Close the dialog, press *Tinjau pesanan* again, and
`app.js:2546` mints a fresh reference for an identical basket with the customer's details
still filled in, and no warning. The likeliest real duplicate is not a double-click; it is
a customer who is not sure the first one worked.

**Fix:** keep showing the success state when checkout is reopened after a successful order.
Offer an explicit **Start a new order** action, and only then clear the cart, reset the
form, and mint a new reference.

### 🔴 DEV-24 · Make the reference recoverable

The reference lives only in the `checkoutAttempt` variable. Close the success screen
without pressing WhatsApp — or reload — and the customer has an order in your sheet and no
way to name it. Your own troubleshooting section tells them to contact the studio quoting a
reference they no longer have. ✅

**Fix:** persist `{reference, idempotencyKey, savedAt, summary}` to `localStorage` on
success. On page load, if it is recent, show a quiet "Your last order: ALX-…" line with the
WhatsApp link. Cheap, and it removes an entire class of support message.

### DEV-25 · Add an order lookup independent of WhatsApp

Every path to "what happened to my order?" currently runs through WhatsApp. Give customers
a reference-based status lookup — even a simple page that reads a published, minimal status
view. Start with reference + status only; never expose addresses or phone numbers.

## Phase 4 — Language and accessibility

### 🔴 DEV-26 · Finish the English success screen

Reproduced with the site in English ✅ — an order completes and the final screen reads:

| Element | Renders as |
| :-- | :-- |
| Eyebrow (`index.html:914`) | **PESANAN DICATAT** |
| Heading | Your order request has been recorded. |
| Body | Continue to WhatsApp so our studio can confirm… |
| WhatsApp button (`index.html:918`) | **Lanjut ke WhatsApp →** |
| Copy button (`index.html:919`) | **Salin referensi pesanan** |

`showRecordedOrder` (`app.js:2580`) localizes four strings and leaves three untouched — and
the two it misses are the only two the customer has to press.

**Fix:** move the success step's strings into the same localization pass as
`localizeCheckoutForm`, so a missed string becomes structurally impossible rather than
something to remember. Include the `#copy-status` feedback text.

### 🔴 DEV-27 · Move focus after every step transition

After a successful submit, `document.activeElement` is still `#top` ✅. A screen-reader user
presses Save, the entire dialog content is replaced, and nothing announces it.

**Fix:** give each step's heading `tabindex="-1"` and focus it on transition — review → form
and form → success. The form step currently focuses the first input, which skips its own
heading.

### DEV-28 · Update `aria-labelledby` per step

`index.html:854` fixes `aria-labelledby="checkout-title"` on the dialog, but
`#checkout-title` lives inside `#checkout-review` and is hidden once the customer continues
✅. On two of three steps the dialog's accessible name points at hidden content.

**Fix:** repoint it at each step's own heading as steps change.

### DEV-29 · Associate help and error text with their fields

Every `.form-help` paragraph and every field error should be referenced by
`aria-describedby` on the input it describes, with `aria-invalid` set on failure. Currently
the help text is visually adjacent but programmatically unconnected.

### DEV-30 · Add inline, field-level errors

The form relies on `reportValidity()` plus one generic sentence in `#form-error`. Native
bubbles are inconsistent across browsers, appear in the *browser's* language rather than the
page's, and vanish on the next tap. On a form with four fieldsets and twelve-plus controls,
"complete the required fields" does not tell anyone which one.

**Fix:** render a message beneath each failing field, and make `#form-error` a summary that
scrolls to and focuses the first one.

### DEV-31 · Add visible required markers and input examples

Mark required fields visibly (not by colour alone), and show a format example under the
phone field — `0812 3456 7890` — so customers do not guess at the `+62` question.

### DEV-32 · Improve the clipboard fallback

When `navigator.clipboard` is unavailable or denied — common in an in-app browser, which is
exactly where an Instagram-sourced customer arrives — `app.js:2690` sets `#copy-status` to
the raw reference and nothing else. The customer sees a code appear with no reason for it.

**Fix:** "Copy this manually: ALX-…", in a selectable element.

### DEV-33 · Remove or reconnect the unreachable error

`openCheckoutReview` writes "Choose a valid product before continuing" into
`#checkout-error` when the cart is invalid — but that element is inside the dialog, which is
not open on that path, so the message can never be seen ✅. In practice `#btn-checkout` is
disabled for an empty cart, so this is dead code. The risk is that it reads like a working
safety net.

**Fix:** delete it, or route it to the order section's existing live region.

## Phase 5 — Mobile and clarity

### 🔴 DEV-34 · Fix the escaping close button

Measured at 390×844 ✅: `.checkout-panel` is declared `overflow: auto` (`styles.css:3774`)
but never becomes a scroll container — its `clientHeight` and `scrollHeight` are both
2292px. The **dialog** scrolls instead. Because the close button is `position: absolute`
against the panel (`styles.css:3576`), it rides up with the content: at the bottom of the
form it measures `top: -1378px`, far outside the viewport. A customer partway down a long
form has no visible way out except the browser's back gesture.

**Fix:** make the dialog a flex column, let `.checkout-panel` be the flex child that
scrolls, and move the close button into a non-scrolling header row. The dead `overflow`
rule then becomes the one doing the work.

### DEV-35 · Make the primary action sticky on mobile

The form is 2292px tall on an 844px screen — roughly three screens, with the total, the
reference and the Save button off-view for most of it. `styles.css:3801` only changes widths
at narrow sizes.

**Fix:** a sticky footer bar carrying the estimated total and the Save button. It shortens
the form perceptually and puts the commitment where the thumb already is.

### DEV-36 · Add a back-to-review button

The form step contains exactly one button — `save-order` ✅. Once past the review a customer
cannot check what they are buying without closing the whole dialog. On a phone, where the
summary line scrolled away long ago, this is where people abandon.

**Fix:** a secondary *Kembali ke ringkasan* / *Back to review* button beside Save, and pin
`#checkout-form-summary` rather than letting it scroll.

### DEV-37 · Add a step indicator

Show **1. Review · 2. Delivery details** at the top of the dialog, with the current step
marked. Two unlabelled screens feel like an unknown number of screens.

### DEV-38 · Show the price breakdown properly

The review step shows subtotal, discount and total. It should show **per-line prices**, the
**wrap fee as its own row** (it is currently folded silently into the subtotal by
`normalizedCheckoutState`), and a prominent row stating that **delivery is calculated
separately**. The most common pre-purchase question is "what will this actually cost me?"
and the answer is currently incomplete.

### DEV-39 · Align the success screen buttons

The narrow-screen rule targets `.checkout-actions > *` and
`.checkout-form > .btn-checkout-primary`. The success step's WhatsApp link and copy button
are in neither, so they render at content width — two stacked buttons of different lengths
with ragged edges, on the one screen you most want to feel finished. ✅

**Fix:** wrap them in a `.checkout-actions` container so they inherit the existing rule.

## Phase 6 — Operations

### 🔴 DEV-40 · Email the studio on every new order

Replace OWNER-11's crude sheet notification with a proper one: in `doPost`, after a
successful append, `MailApp.sendEmail` to the studio address with the reference, buyer name,
WhatsApp number, order summary, submitted total, and preferred date. Wrap it in its own
`try/catch` — **a failed notification must never fail the order**.

### DEV-41 · Log rejections in the Worker

When a customer sees "Kami belum dapat memastikan pesanan tersimpan", you find out only if
they tell you. There is no counter, no alert, no way to notice checkout has been failing for
six hours.

**Fix:** `console.log` a structured line on every rejection — reference, reason code, origin,
timestamp. Workers Logs retains it. Consider an alert on repeated 502s.

### DEV-42 · Add a recovery queue

When Apps Script is unreachable, the order is lost entirely. Write failed submissions to a
Cloudflare KV namespace or Queue and retry, so a Google outage delays orders instead of
destroying them. Keyed by idempotency key (DEV-15), a replay is safe.

### DEV-43 · Expand the test suite

Add coverage for the failure paths, which are currently untested:

- endpoint down; delayed response; invalid/non-JSON response
- the ambiguous case: stored successfully but the response was lost
- retry with the same idempotency key; duplicate-reference conflict → 409
- gift-field toggling (required attributes on and off)
- past dates and out-of-range quantities rejected server-side
- English success screen fully localized (regression guard for DEV-26)
- clipboard permission denied
- layouts at 320, 390, 768 and 1440 px

## Phase 7 — Launch

### 🔴 DEV-44 · Write the privacy notice

The form collects a name, phone number, email, full delivery address and — for gifts — a
third party's name and number, and stores them in a Google Sheet. The only checkbox concerns
production and payment timing. There is no statement of what the data is used for, how long
it is kept, or who can see it, and no separate consent for processing it. Under UU PDP
27/2022 that consent is expected to be explicit and informed — and the gift recipient's data
is collected without the recipient ever seeing a notice.

**Fix:** a short privacy statement linked from the form, plus a line in the acknowledgement
covering data use and retention. Use the owner's answers from OWNER-06 and OWNER-14. The
form already asks permission before contacting a gift recipient — that instinct is right, it
just needs writing down.

### 🔴 DEV-45 · Remove the `noindex` tag at launch

`index.html:13` carries `<meta name="robots" content="noindex, nofollow" />` ✅. Change it to
`index, follow` in the **same** deployment as OWNER-18's passcode change, and confirm
`sitemap.xml` and the canonical URL agree.

### DEV-46 · Update the owner-input list

`README.md`'s owner-input table still lists the WhatsApp number as `"6281234567890"` with
status *Placeholder*, though it is now set ✅. More importantly there is **no row for
`store.orderSubmissionUrl`** — the single parameter the entire checkout depends on. A future
owner reading that table would conclude the checkout has no configuration.

**Fix:** add a row for `store.orderSubmissionUrl` pointing at
`CONFIGURE-SUBMISSION-ENDPOINT.md`, and correct row 2.

### DEV-47 · Document the known gaps

`CHECKOUT-SETUP.md` specifies an endpoint contract in seven numbered requirements;
`CONFIGURE-SUBMISSION-ENDPOINT.md` supplies code meeting five of them, with nothing marking
which are outstanding — so the gap reads as complete.

**Fix:** add a "what this Worker does not do yet" section naming re-pricing (DEV-07) and
abuse protection (DEV-11). Known gaps written down are engineering; known gaps unwritten are
surprises.

---

## What already works — do not break these

Confirmed working. Treat each as a regression test for every change above.

| Behaviour | Verified |
| :-- | :-- |
| WhatsApp is offered **only after** the endpoint confirms storage | ✅ |
| The WhatsApp message deliberately excludes address, phone, email, gift message and notes | ✅ |
| Gift text is bound with `textContent` — no markup injection | ✅ |
| The submit button disables during the request | ✅ |
| The same reference is reused when retrying after an ambiguous failure | ✅ |
| The checkout button is disabled until the cart holds a valid product | ✅ |
| Apps Script escapes leading `=`, `+`, `-`, `@` against spreadsheet formula injection | ✅ |
| Secrets are correctly separated — no credentials in the repository | ✅ |
| The live site returns 200 and serves assets matching this workspace | ◐ |
| CORS accepts `https://alxanthia.com` and rejects missing or wrong origins | ◐ |
| The Worker → Apps Script path is alive (an invalid request reached validation without writing) | ◐ |

---

## Recommended order

1. **Phase 0** — repair the tests. Everything below is unverifiable until `npm test` is green.
2. **Phase 1** — sheet formula and the trusted-total model. These change what a stored order means.
3. **Phase 2** — validation, idempotency, abuse controls. Before real traffic arrives.
4. **Phase 3** — failure recovery. The changes that cut support volume most.
5. **Phases 4 & 5** — language, accessibility, mobile.
6. **Phase 6** — operational monitoring and the expanded test matrix.
7. **Phase 7** — privacy notice, then the launch switches, together.

---

## Provenance

Merged from two independent audits of the same commit.

**Audit A** (this workspace): static analysis of `app.js`, `index.html`, `styles.css`,
`site-content.js`, both setup guides and the implementation plan, plus live interaction in
headless Chromium at 390×844 with the submission endpoint stubbed. No test row was written
to the production sheet. The repo's own `tests/browser-runner.html` was executed via
Playwright.

**Audit B**: read-only checks against the live deployment, including origin/CORS behaviour
and a non-writing invalid request that reached Apps Script validation.

Findings unique to Audit B — the `app.js:2654` acknowledgement short-circuit, the
package-focus regression, the submitted-versus-verified column model, HTTP 409 conflict
handling, and the operational monitoring set — were independently re-verified here before
being merged. The two audits agreed on the Final Total defect, the trusted-totals problem,
the red test suite, and the accessibility and localization gaps.
