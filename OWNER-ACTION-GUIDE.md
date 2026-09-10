# Owner action guide — what you need to do before launch

This guide is written for you, the store owner, and assumes no programming background.
Everything a developer could implement in code has been done and is covered by automated
tests (see the bottom of this file). What is left are things only *you* can do: making a
few business decisions, and clicking through some Cloudflare/Google account setup that
only an account owner is allowed to do.

Do the sections in order — later ones depend on earlier ones.

---

## Step 1 — Three quick decisions

You don't need to touch any code for this step, just decide and (optionally) tell your
developer so they can type the values in for you, or follow "Where to type it" yourself.

### 1a. Minimum production lead time

How many calendar days of notice do you need before a preferred delivery/pickup date?
Pick the number you can reliably honour **in a busy week**, not your fastest-ever turnaround.

- **Where to type it:** open `site-content.js`, find `minimumLeadDays: 2,` near the top,
  and change `2` to your number.
- **Also update:** open `CONFIGURE-SUBMISSION-ENDPOINT.md`'s Apps Script code (Part 2),
  find `var MINIMUM_LEAD_DAYS = 2;` near the top, and change it to the same number, then
  redeploy the script (Part 2's "Deploy the Apps Script" section, "New version").
  **Both numbers must always match.**

### 1b. How long you keep completed orders

Decide how long rows containing customer names, phone numbers, and addresses stay in your
Google Sheet before you delete them (a common choice is "12 months after the order is
completed", which is what the site currently says).

- **Where to type it:** open `site-content.js`, find `dataRetentionNotice:` a few lines
  below `minimumLeadDays`, and edit the `id` (Indonesian) and `en` (English) text. This
  sentence is shown to every customer on the checkout form, next to the consent checkbox.

### 1c. Which inbox gets order notifications

Pick the email address that should get a short email every time a new order is saved
(reference, order type, verified total, and a link to the row — never the customer's
private details). This is set in Google Apps Script's Script Properties, not in the
website code — see Step 3 below.

---

## Step 2 — Understand what's already built

Before you touch any dashboard, it helps to know the shape of the system:

```text
Alxanthia website  →  Cloudflare Worker  →  Google Apps Script  →  Google Sheet
```

The website form, the Worker, and the Apps Script code are all **already written** and
tested. What's missing is you (a) deploying the Apps Script/Worker code (or redeploying it,
if you already had an older version running), and (b) two Cloudflare dashboard settings
that only an account owner can create. The full click-by-click instructions for all of this
live in **[`CONFIGURE-SUBMISSION-ENDPOINT.md`](CONFIGURE-SUBMISSION-ENDPOINT.md)** — this
guide tells you the order to do things in and why, but that file has the actual steps and
code to copy-paste.

**If you already had an order endpoint running before today**, read
`CONFIGURE-SUBMISSION-ENDPOINT.md`'s "Migrating an existing deployment" section first — the
Google Sheet's columns changed, and there's a one-time cleanup step (removing an old
formula) that must happen before you paste in the new code.

---

## Step 3 — Set up (or update) the Sheet and Apps Script

Follow **Part 1** and **Part 2** of `CONFIGURE-SUBMISSION-ENDPOINT.md` exactly, in order:

1. Create or update the Google Sheet with the new column headers (Part 1). Add the two
   dropdown lists (Payment Status, Work Phase) and protect the verified/total columns.
2. Paste the Apps Script code (Part 2) into **Extensions → Apps Script**.
3. Add your **Script Properties** (Part 2, step 6):
   - `WEBHOOK_SECRET` — make up a long random value (30+ letters/numbers). This is the
     shared password between the Worker and the Script; never share it or put it in the
     website files.
   - `OWNER_NOTIFY_EMAIL` — the inbox from Step 1c above. Leave blank if you'd rather not
     get emails yet — see the fallback in Step 6 below.
4. Deploy it as a **Web app** (Part 2, "Deploy the Apps Script") and copy the URL ending in
   `/exec`.

---

## Step 4 — Set up (or update) the Cloudflare Worker

Follow **Part 3** of `CONFIGURE-SUBMISSION-ENDPOINT.md`:

1. Paste the Worker code into your Cloudflare Worker (create one first if you don't have
   it yet).
2. Add the Worker's variables: `ALLOWED_ORIGIN`, `GOOGLE_SCRIPT_URL` (the `/exec` URL from
   Step 3), and `WEBHOOK_SECRET` (the exact same value you put in Apps Script's Script
   Properties — it must match exactly, character for character).
3. Leave `TURNSTILE_SECRET` unset for now — you'll add it in Step 5.
4. Copy the public Worker URL (ends in `.workers.dev`, or your own domain if you mapped one).
5. Open `site-content.js` and set `orderSubmissionUrl` to that URL, if it isn't set already
   (it currently already points at a Worker — double check it's the one you just deployed).

At this point, ordering already works end to end with real security controls (server-side
price checking, validation, deduplication) — it's just missing the last two abuse controls,
which are Steps 5 and 6 below. **Do not open the site to the public yet** (see Step 8).

---

## Step 5 — Create the Cloudflare Turnstile widget (bot check)

This is a free, invisible-to-most-users "are you human" check that stops scripted/bot
order spam. Follow `CONFIGURE-SUBMISSION-ENDPOINT.md`'s **Part 3a**:

1. In the Cloudflare dashboard, create a Turnstile widget for `alxanthia.com`.
2. Copy the **Site Key** into `site-content.js`'s `turnstileSiteKey` field (this one is
   safe to publish — it's not a secret).
3. Copy the **Secret Key** into the Worker's `TURNSTILE_SECRET` variable (this one IS a
   secret — never put it in `site-content.js` or anywhere in the website files).
4. Deploy both changes together and place one real test order to confirm the widget shows
   up on the order form and the order still saves successfully.

The checkout form and the Worker both already contain the code for this — they simply skip
the check while the keys are empty, so nothing breaks in the meantime. This step is what
turns the check on for real.

---

## Step 6 — Confirm rate limiting

Follow `CONFIGURE-SUBMISSION-ENDPOINT.md`'s "Confirm rate limiting (OWNER-06)" section: in
the Cloudflare dashboard, create or confirm a rule limiting requests to the order endpoint
to roughly **10 per minute per visitor**. This can only be verified by looking at your own
Cloudflare dashboard — nobody can check this for you from outside.

---

## Step 7 — Harden Google's side

A short, one-time checklist, all inside Google:

- [ ] In Apps Script **Project Settings**, set the time zone to **GMT+08:00 (Makassar)** if
      the option is available there (the code already fixes this independently, so this is
      a belt-and-braces double-check).
- [ ] Confirm the Google Sheet is **not** shared as "Anyone with the link" (Share button,
      top right) — share it only with named people who need it.
- [ ] Confirm the **Verified Product Subtotal**, **Verified Message Card Fee**, **Verified
      Total**, and **Final Total** columns are protected (Data → Protect sheets and ranges)
      so nobody can accidentally hand-edit the numbers you should trust.
- [ ] **If you left `OWNER_NOTIFY_EMAIL` blank in Step 3**, turn on Google Sheets' own
      built-in notifications instead, as a stand-in until you're ready to set the email
      property: open the Sheet → **Tools → Notification rules** → "Any changes are made" →
      "Notify me right away". Switch to the Script Property once you've tested it.
- [ ] Occasionally check **Apps Script → Executions** for repeated failures or unexpected
      spikes — this is where you'd notice if the endpoint is being abused or is broken.
- [ ] Set a recurring reminder to make a manual backup copy of the Orders spreadsheet
      (**File → Make a copy**) — monthly is reasonable for a small shop.

---

## Step 8 — Run the production acceptance test

Before removing the passcode/staging protection, actually place test orders end to end,
using the checklist in `CONFIGURE-SUBMISSION-ENDPOINT.md`'s **Part 5** and
`CHECKOUT-SETUP.md`'s **Launch test** section. In short, confirm (with real test data, not
real customer data):

- a single stem, a mini pot on its own, every package size, a minimum custom bouquet, and a
  mixed cart (two+ different product types in one order) all save correctly;
- with and without the message card;
- both delivery methods in Bali, and the out-of-Bali path;
- both languages (Indonesian and English);
- the **Verified Total** shown in the Sheet matches what the page showed the customer;
- clicking Save twice, or retrying after closing the tab mid-submission, never creates two
  rows for the same order;
- the WhatsApp message after a successful order matches the reference in the Sheet.

## Step 9 — Payment verification discipline

This is a standing rule, not a one-time setup step: **never** mark an order `Paid` in the
Sheet based on a WhatsApp screenshot or a customer's word. Only mark it `Paid` after you've
personally confirmed the payment in the Midtrans dashboard, or via an authenticated
Midtrans notification.

## Step 10 — Remove the staging gates together

Only once every step above is done and Step 8's test orders all worked correctly:

1. In `site-content.js`, set `auth.enabled` to `false`.
2. In `index.html`, change the robots meta tag to `index, follow`.
3. Confirm the canonical URL, `robots.txt`, and `sitemap.xml` all use
   `https://alxanthia.com/`.
4. Confirm the passcode screen and its "relock" control are gone from the live site.

Do all four in the same deployment — a half-changed state (say, indexed by Google but still
behind the passcode) is more confusing than either state on its own.

---

## What's already done for you

Everything below was implemented and is covered by automated tests as part of this pass —
you do not need to write or review any code for these, only to deploy the server-side
pieces above:

- Mini pots and mixed carts are accepted and correctly labelled by the server.
- The server recalculates every price itself from its own price list — a customer's
  browser can no longer change what gets charged or recorded, only what's *offered* to
  them for review before they submit.
- The Google Sheet uses a header-based schema (safe to reorder columns later) instead of
  fixed column letters, and no formula is ever pre-copied down empty rows.
- Real deduplication: a retry after a connection hiccup reuses the same hidden ID and
  never creates a duplicate order; a genuine conflict is refused rather than silently
  overwritten or duplicated.
- The full order form is validated on the server, not just the browser — tampered totals,
  invalid product IDs, wrong quantities, a bad postal code, or a too-soon date are all
  rejected server-side even if someone bypasses the website's own checks.
- A 20-second timeout, and clearly different messages for "definitely not saved, please
  retry" vs. "we're not sure, here's your reference, please contact us" vs. "someone
  already used this reference differently, please contact us".
- The checkout dialog can't be accidentally closed or escaped while an order is being
  saved.
- Reopening checkout after a successful order shows that same success screen again
  (with a "Start a new order" button), instead of silently starting a new attempt; a quiet
  "you have a recent order" link also appears if you leave and come back later, without
  ever storing your address, phone number, or gift message in the browser.
- The checkout dialog is fully bilingual (including all the new status/error messages),
  keeps focus and screen-reader labelling correct at every step, and its mobile layout no
  longer loses the close button when the form is long.
- A short, plain-language privacy notice sits next to the required acknowledgement
  checkbox.
- Cloudflare Turnstile (bot check) and a fixed set of public error messages are wired up
  end to end in the code — Steps 5–6 above are what turn them on.

### Automated test coverage

Run these locally any time you (or a future developer) change something:

```bash
npm test               # 26 client-side suites + 6 server-side pricing/validation suites
npm run test:browser   # 33 real-browser checks (Playwright), order endpoint mocked
```

None of these ever write to your production Google Sheet or call your real Cloudflare
Worker — the server-side suite runs the *actual* Apps Script code from
`CONFIGURE-SUBMISSION-ENDPOINT.md` in an isolated sandbox, and the browser suite replaces
network calls with fake responses before ever reaching a real endpoint.
