# Set up the Alxanthia Studio Desk

This guide is written for the store owner. You do not need to know how to program: follow each step in order and copy the supplied code exactly.

## What you are setting up

```text
Website → Cloudflare Worker → Apps Script "Order Writer" → Orders sheet   (existing, do not touch)
                                                                ↕
                                          Apps Script "Studio Desk" (new, standalone)
                                                                ↕
                                        site-content.json on alxanthia.com (built from site-content.js; labels only)
```

The Studio Desk is a second, separate Apps Script project — a phone-friendly page for the maker
that reads the same `Orders` worksheet the order-writer script (set up in
`CONFIGURE-SUBMISSION-ENDPOINT.md`) already writes to, and writes back exactly five columns:
**Payment Plan**, **Payment Status**, **Shipping Fee**, **Work Phase**, **Internal Notes**. It never touches pricing,
never recalculates a total, and is a completely separate Apps Script project from the order writer —
a mistake in the Desk's code can never stop a customer's order from being saved.

Finished flowers now arrive in the Desk as two distinct variants. Each stem item contains a Boolean
`wrapped` value: `true` means **dengan kertas pembungkus** and includes the Rp5.000 per-flower fee
already verified by the Order Writer; `false` means **tanpa kertas pembungkus**. A paper **colour** is
shown only when the order contains a predefined or custom bouquet. The Desk still never calculates
either fee itself—it only displays the verified order data.

Never paste your Google account password, or any secret from `CONFIGURE-SUBMISSION-ENDPOINT.md`
(the webhook secret, Turnstile keys), into anything in this guide. The only secrets the Desk itself
uses — the allow-listed emails and the bank account details — live in this new script's own Script
Properties, set in Part 5 below.

---

## Part 1 — Get the spreadsheet ID

1. Open your **Alxanthia Orders** spreadsheet (the same one `CONFIGURE-SUBMISSION-ENDPOINT.md` set up).
2. Look at the address bar. The link looks like:
   `https://docs.google.com/spreadsheets/d/`**`1a2B3c4D5e6F7g8H9i0J`**`/edit#gid=0`
3. The bold middle part is the **spreadsheet ID**. Copy it into a note — you will paste it into a
   Script Property in Part 5.

---

## Part 2 — Add the payment plan and update the dropdown lists

The words the Desk uses for work stage and payment are changing to match what
`CONFIGURE-SUBMISSION-ENDPOINT.md` now documents. Old rows keep their old words until you fix them,
and the Desk cannot show a stage it does not recognise.

1. Add a column named **Payment Plan** immediately before **Payment Status**. Fill existing order rows
   with `Full`; new orders receive that default automatically. Do not add a dropdown to this column—the
   Desk writes either `Full` or `Deposit 50%`.
2. In the sheet, click the **Work Phase** column header to select the column.
3. **Data → Data validation**, click the existing rule, and replace the list with exactly these six
   lines:

   ```text
   Not started
   Assembly and packing
   Ready for dispatch
   Shipped
   Delivered
   Cancelled
   ```

4. Click the **Payment Status** column header and do the same with exactly these seven:

   ```text
   Unpaid
   Checking transfer
   Checking deposit
   Deposit paid
   Checking balance
   Paid
   Cancelled
   ```

5. Now fix the orders already in the sheet. Scroll through the `Work Phase` column and change any old
   value to its nearest new one:

   | Old value | Change it to |
   | --- | --- |
   | Materials prepared, Flowers being made, Bouquet assembly, Quality check, Packed | Assembly and packing |
   | Awaiting payment | *(payment column)* Unpaid |
   | Awaiting confirmation | *(payment column)* Checking transfer |
   | Expired, Refunded | *(payment column)* Cancelled |

   Anything already reading `Not started`, `Ready for dispatch`, `Shipped`, `Delivered`, `Paid` or
   `Cancelled` stays as it is.

---

## Part 3 — Share the spreadsheet with her

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

---

## Part 4 — Create the Studio Desk script

The Desk's actual source lives in two real files in this repository, not inline in this guide, so
the text you paste is exactly the text under test (`npm test` reads these files directly — see
`tests/verify-studio-desk.js`):

- [`studio-desk/Code.gs`](studio-desk/Code.gs) — the Apps Script server code.
- [`studio-desk/Index.html`](studio-desk/Index.html) — the Desk page.

1. Go to <https://script.google.com> and click **New project** (top left). This must be a brand-new,
   **standalone** project — do not use the "Alxanthia Order Writer" project from
   `CONFIGURE-SUBMISSION-ENDPOINT.md`, and do not open Apps Script from inside the spreadsheet's
   **Extensions** menu (that would bind it to the spreadsheet, which a spreadsheet can only have one
   of, and the order writer already is it).
2. Rename it **Alxanthia Studio Desk** (click the title).
3. Delete the sample `myFunction` code, then copy the entire contents of `studio-desk/Code.gs` into
   the editor and save (the disk icon).
4. Click the **+** next to *Files*, choose **HTML**, name it exactly `Index` (no `.html`), delete
   what is there, then copy the entire contents of `studio-desk/Index.html` in and save.

---

## Part 5 — Add the settings

In the same project, click the gear (**Project Settings**) in the left sidebar, scroll to **Script
Properties**, and click **Add script property** for each of these:

| Property | Value |
| --- | --- |
| `SPREADSHEET_ID` | the ID you copied in Part 1 |
| `DESK_ALLOWED_EMAILS` | her Google email and yours, separated by a comma |
| `BANK_NAME` | e.g. `BCA` |
| `BANK_NUMBER` | your studio account number |
| `BANK_HOLDER` | the account holder name |

Save. Changing the bank details later means editing these values — never the code. Nobody can open
the Desk and see any orders at all until `SPREADSHEET_ID` and `DESK_ALLOWED_EMAILS` are both set.

---

## Part 6 — Publish it

1. Top right: **Deploy → New deployment**.
2. Click the gear next to *Select type* and choose **Web app**.
3. Fill in:
   - **Description**: `v1`
   - **Execute as**: **User accessing the web app** ← this one matters; the default is wrong. The
     Desk relies on Google itself telling it who is signed in, so it can check that email against
     `DESK_ALLOWED_EMAILS`.
   - **Who has access**: **Anyone with a Google account**
4. Click **Deploy**.
5. Google will ask for permission. You will see a warning screen saying *"Google hasn't verified this
   app"* — that is normal for a private script you wrote yourself. Click **Advanced**, then **Go to
   Alxanthia Studio Desk (unsafe)**, then **Allow**. It is your own script accessing your own sheet.
6. Copy the **Web app URL** that ends in `/exec`. That is the Desk.

---

## Part 7 — Put it on her phone

Send her the `/exec` link, then walk her through adding it to her home screen so it opens like an app:

- **iPhone (Safari)**: open the link → the share button at the bottom → **Add to Home Screen**.
- **Android (Chrome)**: open the link → the ⋮ menu top right → **Add to Home screen**.

The first time she opens it, Google will ask her to sign in and approve the same permission screen
from Part 6. She will see the same "hasn't verified this app" warning and the same **Advanced → Go
to … → Allow** path. If her email is not yet in `DESK_ALLOWED_EMAILS`, the page will load but show
"Akun ini tidak punya akses ke Studio Desk" instead of the order queue — double-check Part 5.

---

## Part 8 — Check it works

Place one test order on the website, then on the Desk confirm:

- The new order appears in the queue with the right buyer, date and flowers.
- Searching with part of the buyer's name, order code, or WhatsApp number shows the matching order.
- Tapping **Kirim pesan** opens WhatsApp with the buyer's number, the right total, and your account
  details already typed into the message.
- Marking it *perlu dicek* and then *lunas* changes `Payment Status` in the sheet within a second, and
  tapping **Kirim konfirmasi lunas** on the now-paid ticket opens WhatsApp with the confirmation text.
- Typing an ongkir on an out-of-Bali order fills in `Final Total` in the sheet by itself.
- **Lanjut** changes `Work Phase` in the sheet.
- A note typed in the Desk appears in `Internal Notes`.
- Switching a new order to **DP 50%** shows the deposit/balance split and writes `Deposit 50%` to
  `Payment Plan`; once **Tandai DP diterima** or **Tandai perlu dicek** has been tapped, switching the
  plan is refused with *"Cara pembayaran tidak bisa diubah setelah transfer mulai diproses."*
- An order with DP received but no final payment cannot be advanced to **Dikirim** — the Desk refuses
  with *"Pelunasan harus diterima sebelum pesanan dikirim."*
- Tapping **Batalkan pesanan** asks for confirmation before writing anything, and a cancelled order
  shows **Aktifkan lagi** to restore it to `Unpaid`.
- Changing a flower's name in `site-content.js`, deploying the website (`npm run build` regenerates
  `site-content.json` for it automatically), then tapping **Muat ulang katalog** shows the new name on
  the Desk.
- Closing the phone's browser tab and reopening the `/exec` link still shows the order (a page
  reload always re-checks access and re-fetches the queue).

Then delete the test row from the sheet.

---

## Part 9 — Two things to remember afterwards

1. **Any code change needs a redeploy.** Editing the script is not enough: **Deploy → Manage
   deployments → edit (pencil) → Version: New version → Deploy**. The `/exec` link stays the same, so
   nothing on her phone needs changing.
2. **The Desk is the place to mark an order paid** — not the sheet. It is the only screen that shows
   the exact amount to check against, and the rule is still the one from
   `OWNER-ACTION-GUIDE.md` Step 9: confirm the money in your bank's mutasi, never from a screenshot.

---

## Troubleshooting

### The page shows "Akun ini tidak punya akses ke Studio Desk"

The signed-in Google account is not (or not yet) listed in the `DESK_ALLOWED_EMAILS` Script
Property from Part 5. Add it, exactly as her Google account's email, comma-separated from any other
allowed address, and reload the page — no redeploy needed, Script Properties take effect immediately.

### The page is stuck on "Memuat pesanan…" or shows an error screen

1. Open **Deploy → Manage deployments** and confirm the deployment executes as **User accessing the
   web app** and is shared with **Anyone with a Google account** (Part 6).
2. Confirm `SPREADSHEET_ID` (Part 5) is the ID from the address bar, not the whole URL.
3. Confirm the worksheet inside that spreadsheet is still named exactly `Orders`.
4. Tap **Coba lagi** on the error screen — it retries both the catalogue and the order list.

### A change she makes doesn't show up in the sheet

The page shows an error toast naming what went wrong when a save fails, and puts the control back
the way it was — it never fails silently. If the toast says the sheet is busy, wait a few seconds and
try again (another save was in progress). If it names a different problem, re-check Parts 1 and 5.

### Flower/pot/package names look outdated or generic

Tap **Muat ulang katalog** in the footer — it clears the six-hour cache and re-fetches
`site-content.json` immediately (built automatically from `site-content.js` by `npm run build` —
publishing the website is enough, there is nothing extra to do). If a quiet banner says the catalogue
couldn't be reloaded, `site-content.json` was unreachable or unparseable; the Desk keeps working from
its last good copy in the meantime, and order data and totals are unaffected either way (they come
from the sheet, never the catalogue).

### A finished order disappears from the queue sooner than expected

The 14-day window a Delivered order stays visible (`KEEP_DELIVERED_DAYS_PAST_PREFERRED_DATE`) is
counted from **Preferred Date** — when the customer wanted the flowers — not from the day you marked
it Delivered. If an order's Preferred Date was already weeks ago by the time you finish it, it can
drop out of the queue almost immediately after you mark it Delivered. This is expected behaviour, not
a bug: the Desk does not currently record a separate delivery date. If you need finished orders to
stay visible for a fixed number of days after you actually deliver them, that requires adding a
`Delivered At` column and is a deliberate, separate change — ask your developer.

### Money doesn't match what the customer was quoted

It can't — the Desk only ever shows `Verified Total` (plus `Shipping Fee` once you type it),
recalculated server-side by the order writer at submission time, never anything from the customer's
browser or from the Desk itself. If a total looks wrong, check `Price Mismatch` on that row in the
sheet directly (the Desk's gate surfaces this as "Harga ditandai REVIEW").
