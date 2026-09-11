# Alxanthia Studio — Site Audit

**Audited:** 2026-09-11 · **Commit:** `7b8d390` · **Branch:** `claude/stoic-lamport-kla4th`
**Scope:** `index.html`, `app.js`, `site-content.js`, `styles.css`, `tests/`, `dist/`, deployment
and documentation files. The live production endpoint was **not** contacted and **no** test order
was submitted to the real Sheet.

This file is written to be actioned by an AI agent. Every finding has a stable ID, the exact
file and line, a reproduction where one exists, a concrete fix, and a verification command.
Work the sections in order — **A** blocks launch, **B** is high, **C** medium, **D** low.

---

## Summary

The site is in unusually good shape for a hand-built, zero-dependency storefront. Server-side
repricing, idempotency keys, typed failure handling, and the owner documentation are genuinely
well done (see *[What is already solid](#what-is-already-solid)* — do not "fix" these).

Three things block a public launch, and they compound: the passcode gate is decoration rather
than access control (**A2**), the order endpoint behind it is live and unprotected (**A3**), and
the test suite that would catch drift in that endpoint is currently red (**A1**).

| ID | Severity | Finding |
| :-- | :-- | :-- |
| [A1](#a1) | Blocking | `npm test` fails — a stale fixture hides suites S4–S6 |
| [A2](#a2) | Blocking | Passcode gate is cosmetic; full draft site is readable while "locked" |
| [A3](#a3) | Blocking | Live order endpoint has no bot check and no verified rate limit |
| [B1](#b1) | High | One typo in `site-content.js` breaks the site *and* drops the passcode gate |
| [B2](#b2) | High | Two deploy targets; `dist/` is a release behind and has no checkout |
| [B3](#b3) | High | Lead-time timezone mismatch rejects valid dates for WIB buyers |
| [C1](#c1) | Medium | No `maxlength` on fields the server caps |
| [C2](#c2) | Medium | No `<noscript>`; JS-off visitors see a permanent lock screen |
| [C3](#c3) | Medium | `node_modules/` and `dist/` committed; no `.gitignore`; no CI |
| [C4](#c4) | Medium | 28.3 MB of unreferenced images tracked in git |
| [C5](#c5) | Medium | JSON-LD publishes placeholder prices and an unconfirmed Instagram |
| [D1](#d1) | Low | Recent-order record never expires and embeds the buyer's name |
| [D2](#d2) | Low | Heading levels skip h2 → h4 |
| [D3](#d3) | Low | `sitemap.xml` stale `lastmod`; both hreflang alternates are the same URL |
| [D4](#d4) | Low | Google Fonts is render-blocking and sends visitor IPs to a third party |
| [D5](#d5) | Low | Three small touch targets |
| [D6](#d6) | Low | Order reference date segment uses the browser's timezone |
| [D7](#d7) | Low | No Content-Security-Policy |

---

## A — Blocking

<a id="a1"></a>
### A1. `npm test` fails on a stale fixture, hiding three suites

**Severity:** Blocking · **Files:** `tests/verify-server-pricing.js:169`, `:179`

`npm test` exits non-zero. Suite S4 dies on its very first assertion:

```
AssertionError [ERR_ASSERTION]: A well-formed order must validate
  at tests/verify-server-pricing.js:179
```

The cause: the fixture sends `buyer_whatsapp: '081234567890'` and calls `validateOrder()`
**directly**. But `validateOrder` requires E.164 (`CONFIGURE-SUBMISSION-ENDPOINT.md:282`,
`/^\+62\d{8,13}$/`), and normalization happens one layer up in `doPost`
(`CONFIGURE-SUBMISSION-ENDPOINT.md:163`). The test skips that layer, so a perfectly normal
Indonesian number is rejected.

**Production is not affected.** The browser normalizes at `app.js:533` before submitting, and
the Worker/Apps Script re-normalizes server-side. This is test drift left behind by commit
`15e64ce` ("Normalize buyer WhatsApp numbers to a single E.164 format").

The damage is what it *hides*: the assertion aborts the process, so the remaining ~18 tamper
assertions in S4 and all of S5 (lead time) and S6 never run.

**Fix** — do not just swap the literal to `+62…`; that would delete the coverage of the exact
case that regressed. Make the fixture exercise the real `doPost` path:

1. In `validOrder`, keep `buyer_whatsapp: '081234567890'` but normalize before validating, the
   way `doPost` does — e.g. have the helper return the order with
   `buyer_whatsapp: normalizeIndonesianPhone(...)` applied, pulling `normalizeIndonesianPhone`
   out of the sandbox alongside `validateOrder` at `tests/verify-server-pricing.js:77`.
2. Add explicit assertions that pin the contract both ways:
   - `normalizeIndonesianPhone('081234567890') === '+6281234567890'`
   - `validateOrder(validOrder({ buyer_whatsapp: '+6281234567890' })).ok === true`
   - `validateOrder(validOrder({ buyer_whatsapp: '081234567890' })).ok === false`
     — with a comment stating this is *by design*, because `doPost` normalizes first.

**Verify:** `npm test` → exit 0, and the S4/S5/S6 pass lines all print.

---

<a id="a2"></a>
### A2. The passcode gate is cosmetic — the whole draft site is readable while "locked"

**Severity:** Blocking · **Files:** `site-content.js:18-21`, `app.js:2637`, `:2649`, `:2650`, `:2677`, `styles.css:3933-3949`

`.lock-screen.unlocked` only sets `opacity: 0; visibility: hidden`. The entire page — prices,
catalogue, copy, structured data — is already in the DOM behind it.

**Reproduced** (headless Chromium, no passcode entered):

```
LOCK SCREEN VISIBLE ON LOAD: true
H1 TEXT READABLE WHILE LOCKED: "Bunga yang tak pernah layu — kami rangkai untuk Anda."
DOM chars while locked: 84767
```

`curl https://alxanthia.com/` returns the same. Three separate problems:

1. **The passcode is published.** `site-content.js:20` ships `passcode: "22062024"` to every
   visitor, and `app.js:2637/2649/2677` hardcode the same value as a fallback — so removing it
   from `site-content.js` alone would not remove it.
2. **The gate hides nothing.** View-source, JS disabled, `curl`, or any crawler that ignores
   `noindex` sees the full draft.
3. **`?unlock=<passcode>` leaks** (`app.js:2650`). The passcode ends up in browser history,
   `Referer` headers on outbound clicks, and any analytics or proxy log along the way.

**Pick one fix and state the choice in `README.md`:**

- **Option 1 (recommended, honest):** Treat the gate as what it is — a "not open yet" notice,
  not security. Replace the passcode screen with a static coming-soon page, keep the real site
  on an unlisted preview deploy, and delete `auth` from `site-content.js`, the `?unlock` branch
  at `app.js:2650`, and all three hardcoded `'22062024'` fallbacks.
- **Option 2 (real access control):** Put the preview behind Cloudflare Access or HTTP Basic Auth
  at the edge, so unauthenticated requests never receive the HTML at all. Then delete the
  client-side gate entirely.
- **Option 3 (minimum viable, if the gate must stay as-is):** Rotate the passcode to a value
  that is not a date and not reused anywhere else, delete the `?unlock` query-param branch, and
  remove the hardcoded fallbacks so the value lives in exactly one place. Document in
  `README.md` that this deters casual visitors only and protects nothing.

> The current passcode looks like a personal date (22-06-2024). Whichever option is chosen, do
> not reuse it elsewhere.

**Verify:** `curl -s https://<preview-url>/ | grep -c "Bunga yang tak pernah layu"` → `0` for
options 1 and 2. For option 3, `grep -rn "22062024" .` → no matches outside this audit file.

---

<a id="a3"></a>
### A3. The live order endpoint accepts writes with no bot check and no verified rate limit

**Severity:** Blocking · **Files:** `site-content.js:42`, `:47`, `CONFIGURE-SUBMISSION-ENDPOINT.md:632`, `:646`, `:761-765`

`orderSubmissionUrl` is already pointed at the live Worker
(`https://alxanthia-order-endpoint.ketut-ketut92.workers.dev`), but `turnstileSiteKey` is `""`.
The Worker skips its Turnstile check whenever `TURNSTILE_SECRET` is unset
(`CONFIGURE-SUBMISSION-ENDPOINT.md:646`), so today the only barrier is:

```js
if (origin !== env.ALLOWED_ORIGIN) return reply({ ok: false, error: 'Origin not allowed' }, 403, headers);
```

`Origin` is a browser-enforced header. Any non-browser client sets it freely, so this stops
cross-origin *browser* abuse and nothing else. The rate-limiting rule is a Cloudflare dashboard
step the repo explicitly cannot verify (`CONFIGURE-SUBMISSION-ENDPOINT.md:765`).

Net effect: a scripted client can write unlimited junk rows into the owner's private Orders
Sheet. Validation and server-side repricing are solid — so the rows will be *well-formed*
junk, which is harder to spot and harder to clean up. And because the passcode gate (**A2**)
publishes the endpoint URL to anyone who loads the page, "it's still in staging" is not
protection.

**Fix — in this order:**

1. Complete `OWNER-ACTION-GUIDE.md` Step 5: create the Turnstile widget, put the **site** key in
   `site-content.js:47`, the **secret** key in the Worker's `TURNSTILE_SECRET`, and deploy both
   together. The checkout code already handles the token (`app.js:3526-3530`).
2. Complete Step 6: the rate-limiting rule (~10 req/min/IP on the Worker route). Confirm it in
   the dashboard and note the confirmation date in `OWNER-ACTION-GUIDE.md`.
3. Until both are done, set `orderSubmissionUrl: ""` in `site-content.js:42`. The checkout already
   degrades correctly when it is blank (`app.js:3515-3518`) — it shows the "not configured"
   message rather than failing silently.

**Verify:** with Turnstile live, a `POST` carrying a spoofed `Origin` but no
`cf_turnstile_token` returns `403` and writes no row.

---

## B — High

<a id="b1"></a>
### B1. One typo in `site-content.js` breaks the site *and* drops the passcode gate

**Severity:** High · **Files:** `app.js:30`, `:68-72`, `index.html:1051-1052`

`loadData()` sets `siteData` only when `window.ALXANTHIA_DATA` exists (`app.js:68-72`), but
`siteData` starts as `null` (`app.js:30`) and there is no fallback, no boot guard, and no
`window.onerror` handler. `README.md` and `PANDUAN-KONTEN.md` both instruct a non-developer to
edit `site-content.js` by hand and warn them about quotes and commas — so this is a likely
failure, not a theoretical one.

**Reproduced** — served `site-content.js` with one stray comma:

```
page errors: Unexpected token ',' | Cannot read properties of null (reading 'auth')
lock screen visible: false          ← the gate is GONE
flower cards rendered: 0
visible body text: "…ALXANTHIA / EST. 2026 | BASED IN BALI / Bunga / Buket / Cara dibuat / FAQ…"
```

The page renders as a half-built shell: header and hero copy, no products, no prices, no way to
order — and because `init()` throws at `siteData.auth` *before* `setupAuth()` runs, the passcode
screen never appears. A content typo publishes the unfinished draft.

**Fix:**

1. Wrap the body of `init()` in `try/catch`.
2. On failure, reveal a static fallback block (hidden by default in `index.html`) that says the
   site is temporarily unavailable and links to the studio WhatsApp — hardcoded in the HTML, not
   read from `siteData`.
3. In the same `catch`, **keep the lock screen up** while `auth.enabled` cannot be read, so a
   broken build fails closed rather than open.
4. In `loadData()`, throw a clear, named error when `window.ALXANTHIA_DATA` is missing, so the
   console says *"site-content.js failed to load or has a syntax error"* instead of
   `Cannot read properties of null`.

**Verify:** re-run the reproduction (serve a deliberately broken `site-content.js`) — the
fallback message shows, the lock screen stays up, and the console names the real cause.

---

<a id="b2"></a>
### B2. Two deploy targets; `dist/` is a release behind and has no checkout

**Severity:** High · **Files:** `.openai/hosting.json`, `dist/` (76 tracked files), `CNAME`

`.openai/hosting.json` serves `dist/`. `CNAME` points GitHub Pages at the repository root. The
two are not the same site:

| | root | `dist/` |
| :-- | :-- | :-- |
| `app.js` | 166,146 B | 138,429 B |
| `site-content.js` | 50,906 B | 37,399 B |
| `idempotency` | 9 refs | **0** |
| `Turnstile` | 24 refs | **0** |
| `normalizeIndonesianPhone` | 3 refs | **0** |
| `minimumLeadDays`, `baliRegencies`, `messageCardPrice`, `turnstileSiteKey` | present | **absent** |

`dist/` was last touched at `2f6c506`; `app.js` has moved on through at least six commits since.
Anyone served from `dist/` gets a checkout with no idempotency key, no phone normalization, no
lead-time floor, and no Turnstile hook — exactly the protections **A3** depends on. There is no
build script in `package.json`, so `dist/` is a hand-copied snapshot that will drift again.

**Fix — choose one:**

- **If the OpenAI static host is not used:** delete `dist/` and `.openai/hosting.json`, and add
  `dist/` to `.gitignore` (see **C3**).
- **If it is used:** add a real `build` script that copies the root site into `dist/` (or point
  `hosting.json` at the root), and run it in CI so the two can never diverge silently.

**Verify:** `diff <(cat index.html app.js site-content.js styles.css) <(cat dist/index.html dist/app.js dist/site-content.js dist/styles.css)` → empty, or `dist/` no longer exists.

---

<a id="b3"></a>
### B3. Lead-time timezone mismatch rejects valid dates for WIB buyers

**Severity:** High · **Files:** `app.js:3388-3393`, `CONFIGURE-SUBMISSION-ENDPOINT.md:113`, `:309-317`

The date picker computes its `min` from the **buyer's** timezone:

```js
const minDate = new Date();                                   // app.js:3390
minDate.setDate(minDate.getDate() + (siteData.minimumLeadDays ?? 0));
```

The server computes the same floor in **Asia/Makassar** (`TIMEZONE`,
`CONFIGURE-SUBMISSION-ENDPOINT.md:113`). WITA is an hour ahead of WIB, so for a buyer in
Jakarta, Bandung, or Surabaya ordering between **23:00 and 24:00 WIB**, Bali is already on the
next calendar day — the server's floor is one day later than the picker's.

The buyer picks a date the widget offers, fills the whole form, submits, and gets
`"Some details could not be saved. Please check the form and try again."` (the Worker's fixed
public message for `VALIDATION`) — pointing at no field in particular. That window covers most
of Indonesia's population.

**Fix:** compute the client floor in Bali time so both sides agree:

```js
const baliToday = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Makassar' }).format(new Date());
const minDate = new Date(baliToday + 'T00:00:00');
minDate.setDate(minDate.getDate() + (siteData.minimumLeadDays ?? 0));
dateInput.min = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Makassar' }).format(minDate);
```

(`en-CA` yields `YYYY-MM-DD`, which is what `<input type="date">` expects.) Add a regression
test that pins the boundary: with the clock at `2026-09-11T16:30:00Z` (23:30 WIB, 00:30 WITA),
the client `min` must equal the server's `isValidLeadTimeDate` floor.

**Verify:** `npm test` passes with the new boundary test, and the picker's earliest selectable
date matches the server floor when the browser TZ is set to `Asia/Jakarta` at 23:30.

---

## C — Medium

<a id="c1"></a>
### C1. No `maxlength` on fields the server caps

**Severity:** Medium · **Files:** `index.html` (checkout form), `CONFIGURE-SUBMISSION-ENDPOINT.md:138`

The server enforces `MAX_TEXT = { buyer_name: 120, address: 300, city: 100, gift_message: 200,
recipient_name: 120, card_sender_name: 120 }`. Only two of those limits exist client-side —
`maxlength="200"` (gift message) and `maxlength="5"` (postal code). `buyer_name`, `address`,
`city`, `order-recipient-name`, and `order-card-sender-name` have none, so an over-long entry
is only discovered as the same generic `VALIDATION` message described in **B3**.

**Fix:** add `maxlength` to each field, mirroring `MAX_TEXT`, and add a comment naming
`CONFIGURE-SUBMISSION-ENDPOINT.md:138` as the source of truth so the two stay in sync.

**Verify:** each field's `maxlength` equals its `MAX_TEXT` entry.

---

<a id="c2"></a>
### C2. No `<noscript>`; with JS off the site is a permanent lock screen

**Severity:** Medium · **Files:** `index.html` (no `<noscript>` anywhere), `styles.css:3933-3949`

`.lock-screen` is visible by default and only hidden when JS adds `.unlocked`. With JS disabled
— now *and* after launch, when `auth.enabled` is `false` — the visitor sees a passcode prompt
that can never be satisfied. All product content is rendered by JS (`grid.innerHTML` at
`app.js:1044`, `:1141`, `:1282`), so there is nothing behind it either.

**Fix:** add a `<noscript>` block with the brand name, a one-line description, and the studio
WhatsApp link, plus a `<noscript><style>.lock-screen{display:none}</style></noscript>` so the
dead prompt is not what a JS-less visitor stares at. Pairs naturally with **B1**'s fallback.

**Verify:** load the page with JS disabled — the lock screen is gone and the fallback shows.

---

<a id="c3"></a>
### C3. `node_modules/` and `dist/` are committed; no `.gitignore`; no CI

**Severity:** Medium · **Files:** repository root

- `git ls-files node_modules | wc -l` → **194**
- `git ls-files dist | wc -l` → **76**
- No `.gitignore` exists.
- No `.github/workflows/` exists.

Committed `node_modules` means the Playwright version in git can drift from `package.json`, and
every dependency bump lands as a large, unreviewable diff. No CI means **A1** — a red
`npm test` — sat unnoticed on `main`.

**Fix:**

1. Add `.gitignore` with `node_modules/`, plus `dist/` if **B2** resolves toward deleting it.
2. `git rm -r --cached node_modules`.
3. Add `.github/workflows/test.yml`: `npm ci` → `npm test` → `npx playwright install --with-deps chromium` → `npm run test:browser`, on push and PR.

**Verify:** `git ls-files node_modules | wc -l` → `0`; CI runs green on the next push.

---

<a id="c4"></a>
### C4. 28.3 MB of unreferenced images tracked in git

**Severity:** Medium · **Files:** `img/`, `ALXANTHIA LOGO 2-02.png`, `alxanthia-logo-96.png`

Nineteen files in `img/` (28.3 MB) are referenced by no HTML, CSS, or JS: the source PNGs
(`hero.png`, `macro.png`, `rose.png`, `kit.png`, each ~2 MB), plus the entire `us-*` and `kit-*`
WebP sets. Two root logos are unreferenced too.

**This does not slow the site down** — the bouquet cards use `pkg.photoWebp || pkg.photo`
(`app.js:1296`), so the PNG fallbacks are never fetched, and a locked page load transfers only
~127 KB of images. It is repository and deploy weight: `dist/` alone is 41 MB, and `.git` is
39 MB for a four-file site.

**Fix:** move the master PNGs out of the deployed tree (a `sources/` directory excluded from
`dist/`, or off-repo entirely) and delete the orphaned `us-*` / `kit-*` derivatives once it is
confirmed those sections are gone for good. Keep every file that a `srcset` still names.

**Verify:** every remaining file under `img/` appears in at least one of `index.html`,
`app.js`, `site-content.js`, `styles.css`.

---

<a id="c5"></a>
### C5. JSON-LD publishes placeholder prices and an unconfirmed Instagram as official

**Severity:** Medium · **Files:** `index.html:36-313`, `site-content.js:29`

The structured data declares concrete `Offer` prices with `"availability": "InStock"` — while
`README.md` labels the whole price list a "draf placeholder" pending owner confirmation, and
row 6 of the owner-input table says the bouquet compositions are still drafts. It also publishes
`"sameAs": ["https://instagram.com/alxanthia"]`, which `README.md` row 3 marks ⏳ *Placeholder*.

`noindex` keeps this out of search today. At launch it becomes a public claim: search engines
may surface prices the studio has not committed to, and the `sameAs` asserts an Instagram
account the owner has not confirmed they control.

**Fix:** add to `OWNER-ACTION-GUIDE.md` Step 10 — before flipping `noindex`, confirm every
JSON-LD price against the final `site-content.js`, and either confirm the Instagram URL or
remove `sameAs`. Better: generate the JSON-LD offers from `siteData` at build time so they
cannot drift from the catalogue by hand.

**Verify:** every `price` in the JSON-LD matches `site-content.js`, and `sameAs` lists only
confirmed accounts.

---

## D — Low

<a id="d1"></a>
### D1. Recent-order record never expires and embeds the buyer's name
**Files:** `app.js:3091-3103`, `:3122-3138`, `:493-500`

`saveRecentOrder()` stores `timestamp`, but `renderRecentOrderBanner()` never reads it — the
banner persists forever. The stored `waUrl` is built by `buildPostSubmissionWhatsApp`, which
embeds `Nama: ${name}` — so the buyer's name sits in `localStorage` indefinitely on what may be
a shared or public device. The surrounding comment says to store nothing the privacy notice does
not already cover.

**Fix:** expire the record (14 days is a reasonable match for the order lifecycle) by checking
`timestamp` in `loadRecentOrder()`, and either omit the name from the stored `waUrl` or rebuild
the URL on demand from `reference` alone.

<a id="d2"></a>
### D2. Heading levels skip h2 → h4
**Files:** `index.html:553`, `:825`

`<h4 class="custom-builder-title">` follows an `<h2>` section title, as does
`<h4 class="kit-teaser-title">`. Screen-reader users navigating by heading level hit a gap.
Change both to `<h3>` and adjust the CSS selectors — purely structural, no visual change needed.

<a id="d3"></a>
### D3. `sitemap.xml` stale `lastmod`; hreflang alternates both point to the same URL
**Files:** `sitemap.xml`

`<lastmod>2026-09-07</lastmod>` predates several content commits. The `id` and `en` `xhtml:link`
alternates both resolve to `https://alxanthia.com/` — a single URL cannot be the canonical
alternate for two languages, so search engines discard the annotation. Since language is a
client-side toggle with no per-language URL, either drop the `xhtml:link` elements or keep only
`x-default`. Add "refresh `lastmod`" to `OWNER-ACTION-GUIDE.md` Step 10.

<a id="d4"></a>
### D4. Google Fonts is render-blocking and sends visitor IPs to a third party
**Files:** `index.html:316-320`

The stylesheet at `fonts.googleapis.com` blocks first render behind an extra DNS + TLS round
trip, and every visitor's IP and user-agent reach Google before they have consented to anything
— worth weighing against the privacy notice the checkout already shows. Self-hosting the two
families (Cormorant Garamond, Karla) as WOFF2 removes both issues and the `preconnect` pair.
Whether self-hosted or not, give every `font-family` a real fallback stack so a blocked or slow
font never leaves text invisible.

<a id="d5"></a>
### D5. Three small touch targets
**Files:** `index.html:656`, footer link list, category tab row

Measured in-browser at 390 px and 1280 px:

- `#card-note-toggle` — **20×20** at both sizes. Below WCAG 2.5.8 (AA, 24×24). It is wrapped in
  a `<label>`, so the effective hit area is larger in practice; verify with a real tap test
  before changing anything.
- Footer links — **16 px** tall on desktop (`.footer-link-whatsapp`, `.footer-link-ig`,
  `.footer-care`, `.footer-link-order`). Add vertical padding.
- Category tabs — **40 px** tall (`#cat-tab-all` and siblings). Above the 24 px AA floor, below
  the 44 px the rest of the site targets. Nudge to 44 px for consistency.

Everything `README.md` explicitly claims as ≥44×44 (`.btn-order-stem`, `.btn-add-bouquet`,
`.btn-choose-bouquet`, `.btn-channel`, `.btn-stepper`, `.btn-remove-line`, `.chip-wrap`) does
meet it — that claim is accurate.

<a id="d6"></a>
### D6. Order reference date segment uses the browser's timezone
**Files:** `app.js:467-474`

`generateOrderReference()` builds `ALX-YYMMDD-XXXX` from the buyer's local date, while the Sheet
timestamps in Bali time. A late-evening order from a western timezone can carry a reference dated
one day before its `Submitted At` row. Cosmetic, but confusing when reconciling orders by eye —
and it is the same root cause as **B3**, so fix both together. (The random segment itself is
sound: 32-character alphabet, 256-value bytes, no modulo bias.)

<a id="d7"></a>
### D7. No Content-Security-Policy
**Files:** `index.html`

GitHub Pages cannot set response headers, but a `<meta http-equiv="Content-Security-Policy">`
works for everything except `frame-ancestors`. Given that the site posts customer PII to an
external endpoint, a CSP is worth the few lines. Starting point, to be tested before shipping:

```
default-src 'self';
script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com;
style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
font-src https://fonts.gstatic.com;
img-src 'self' data:;
connect-src 'self' https://alxanthia-order-endpoint.ketut-ketut92.workers.dev;
frame-src https://challenges.cloudflare.com;
base-uri 'self';
form-action 'none'
```

`'unsafe-inline'` is required by the inline unlock script (`index.html:357`) and the inline
`style` attributes that `app.js` writes into card markup; dropping it means moving both to
external files or nonces. Tighten `connect-src` to the final endpoint, and `script-src`/
`frame-src` can lose the Cloudflare entries if Turnstile is not adopted.

---

## What is already solid

Verified during this audit — do not "fix" these:

- **Colour contrast passes WCAG AA** at 390 px and 1280 px — 0 failures across every text node,
  measured with correct alpha compositing of layered translucent backgrounds.
- **No horizontal overflow** at either breakpoint (`scrollWidth === clientWidth`, 0 overflowing
  elements).
- **No JavaScript errors** on load or during interaction.
- **Markup integrity:** 0 duplicate IDs, 0 broken internal anchors, 0 dangling
  `aria-controls`/`aria-labelledby`/`aria-describedby`, every form control labelled, exactly one
  `<h1>`, every `<img>` has `alt`.
- **XSS discipline holds.** All 22 `innerHTML` sites interpolate owner-controlled config only;
  every user-supplied value (gift note, buyer name, recipient/sender) goes through `textContent`.
  No `insertAdjacentHTML`, `document.write`, `eval`, or `new Function` anywhere.
- **Checkout architecture is well built:** server-side repricing from a server-owned catalogue,
  a real UUID idempotency key separate from the human-readable reference, payload hashing,
  typed failure handling (`success | duplicate | conflict | ambiguous | connection | rejected`),
  a 20-second timeout, and a strict success check requiring the reference to match. No secret
  reaches the browser.
- **Tests that do run are thorough:** 26 client integration suites and 39 real-browser
  assertions pass, including focus return, dialog ARIA, and clipboard-denial fallbacks.
  (The browser suite needs `npx playwright install chromium`, or
  `PLAYWRIGHT_CHROMIUM_PATH=/path/to/chromium`.)
- **Performance is healthy:** ~84 KB gzipped for the full critical path (HTML + CSS + both JS
  files), 6 requests on first load, hero image `fetchpriority="high"`, responsive `srcset`
  everywhere, WebP throughout, `loading="lazy"` below the fold.
- **`prefers-reduced-motion` is respected** in both CSS and JS.
- **`robots.txt` is correct for staging.** `Allow: /` alongside `noindex` is the right pairing —
  blocking the crawler in `robots.txt` would prevent it from ever reading the `noindex`.
- **Owner documentation is genuinely strong.** `OWNER-ACTION-GUIDE.md`,
  `CONFIGURE-SUBMISSION-ENDPOINT.md`, and `PANDUAN-KONTEN.md` are specific, sequenced, and
  honest about what the repository cannot verify. Client and server constants agree
  (`minimumLeadDays: 2` ↔ `MINIMUM_LEAD_DAYS = 2`; `catalogVersion: 1` ↔ `CATALOG_VERSION = 1`).

---

## Suggested order of work

1. **A1** — get `npm test` green so everything after is verifiable.
2. **C3** — add CI, so it stays green.
3. **B2** — settle the deploy target before shipping any fix to the wrong one.
4. **B1**, **B3**, **C1** — code fixes, each with a regression test.
5. **A2**, **A3** — the launch-gate decisions; **A3** needs owner action in two dashboards.
6. **C2**, **C4**, **C5**, then the **D** items.
