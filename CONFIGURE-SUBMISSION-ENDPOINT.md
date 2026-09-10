# Configure the Alxanthia submission endpoint

This guide is written for the store owner. You do not need to know how to program: follow each step in order and copy the supplied code exactly.

## What you are setting up

```text
Alxanthia website form → Cloudflare Worker → Google Apps Script → Google Sheets
```

The website form is already present. It intentionally does not show a successful-order screen until an external endpoint confirms that the order was saved. The public endpoint setting is currently empty in `site-content.js`.

You will create:

1. a private Google Sheet containing the orders;
2. a Google Apps Script that writes to that sheet; and
3. a Cloudflare Worker that securely connects the website to the script.

Never paste your webhook secret, Google credentials, Cloudflare API token, or Midtrans credentials into the website repository.

---

## Part 1 — Create the Google Sheet

1. Sign in to the Google account that should own the orders.
2. Open <https://sheets.google.com> and create a blank spreadsheet.
3. Rename the spreadsheet **Alxanthia Orders**.
4. Rename its first worksheet tab **Orders**.
5. Click cell `A1` and paste this tab-separated header row:

```text
Order Reference	Submitted At	Buyer Name	Buyer WhatsApp	Location Type	Regency	Delivery Method	Address	City	Postal Code	Preferred Date	Order Mode	Order Summary	Item Data	Total Stems	Wrap	Message Card	Message Card Fee	Gift Message	Recipient Name	Card Sender Name	Product Subtotal	Estimated Product Total	Shipping Fee	Final Total	Midtrans Payment Link	Payment Status	Work Phase	Delivery Service	Tracking Link/Number	Internal Notes
```

6. If the headings stay in one cell, select it and choose **Data → Split text to columns → Tab**.
7. Choose **View → Freeze → 1 row**.
8. Select row 1 and choose **Data → Create a filter**.

A quick guide to the location columns: **Location Type** is `bali` or `luar_bali`. For a Bali order, **Regency** (kabupaten/kota) and **Delivery Method** (`grab_gojek` or `self_pickup`) are filled and **Address/City/Postal Code** stay blank — the customer books their own Grab/Gojek courier, or picks up in person, so no address is collected. For an out-of-Bali order, it's the reverse: **Address/City/Postal Code** are filled and **Regency/Delivery Method** stay blank. Always check **Location Type** first before reading the other columns.

### Add the status dropdowns

For **Payment Status** (column AA), choose **Data → Data validation → Dropdown** and add exactly:

```text
Awaiting confirmation
Awaiting payment
Paid
Expired
Refunded
Cancelled
```

For **Work Phase** (column AB), add exactly:

```text
Not started
Materials prepared
Flowers being made
Bouquet assembly
Quality check
Packed
Ready for dispatch
Shipped
Delivered
Cancelled
```

In cell `Y2` (**Final Total**), enter this formula and copy it down the column:

```excel
=IF(W2="","",W2+IF(X2="",0,X2))
```

Format the Product Subtotal, Message Card Fee, Estimated Product Total, Shipping Fee, and Final Total columns as Indonesian rupiah while keeping them numeric.

---

## Part 2 — Create the Google Apps Script

1. In the spreadsheet, choose **Extensions → Apps Script**.
2. Rename the project **Alxanthia Order Writer**.
3. Delete the example `myFunction` code.
4. Paste the code below.

```javascript
const SHEET_NAME = 'Orders';
const WEBHOOK_SECRET = 'REPLACE_WITH_YOUR_PRIVATE_RANDOM_SECRET';
const BALI_REGENCIES = ['Denpasar', 'Badung', 'Gianyar', 'Tabanan', 'Klungkung', 'Bangli', 'Karangasem', 'Buleleng', 'Jembrana'];

function doPost(event) {
  try {
    const request = JSON.parse(event.postData.contents || '{}');
    if (request.webhook_secret !== WEBHOOK_SECRET) {
      return jsonResponse({ ok: false, error: 'Unauthorized' });
    }

    const order = request.order || {};
    validateOrder(order);

    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
    if (!sheet) throw new Error('Orders worksheet was not found.');

    const lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try {
      if (findOrderRow(sheet, order.order_reference)) {
        return jsonResponse({ ok: true, order_reference: order.order_reference, duplicate: true });
      }

      const isBali = order.location_type === 'bali';
      sheet.appendRow([
        safeText(order.order_reference), new Date(), safeText(order.buyer_name),
        safeText(order.buyer_whatsapp), safeText(order.location_type),
        isBali ? safeText(order.regency) : '', isBali ? safeText(order.delivery_method) : '',
        isBali ? '' : safeText(order.address), isBali ? '' : safeText(order.city), isBali ? '' : safeText(order.postal_code),
        safeText(order.preferred_date), safeText(order.order_mode), safeText(order.order_summary),
        JSON.stringify(order.item_data || []), safeNumber(order.total_stems), safeText(order.wrap),
        order.message_card_enabled ? 'Yes' : 'No', safeNumber(order.message_card_fee || 0),
        safeText(order.gift_message), safeText(order.recipient_name), safeText(order.card_sender_name),
        safeNumber(order.product_subtotal), safeNumber(order.estimated_product_total),
        '', '', '', 'Awaiting confirmation', 'Not started', '', '', ''
      ]);
    } finally {
      lock.releaseLock();
    }

    return jsonResponse({ ok: true, order_reference: order.order_reference });
  } catch (error) {
    return jsonResponse({ ok: false, error: String(error.message || error) });
  }
}

function validateOrder(order) {
  const required = [
    'order_reference', 'buyer_name', 'buyer_whatsapp', 'location_type',
    'preferred_date', 'order_mode', 'order_summary', 'wrap'
  ];
  required.forEach(function (field) {
    if (!String(order[field] || '').trim()) throw new Error('Missing required field: ' + field);
  });
  if (!/^ALX-\d{6}-[A-HJ-NP-Z2-9]{4}$/.test(order.order_reference)) throw new Error('Invalid order reference.');
  if (!/^[+0-9 ()-]{8,20}$/.test(order.buyer_whatsapp)) throw new Error('Invalid buyer WhatsApp number.');
  if (!['bali', 'luar_bali'].includes(order.location_type)) throw new Error('Invalid location type.');
  if (order.location_type === 'bali') {
    if (BALI_REGENCIES.indexOf(order.regency) === -1) throw new Error('Invalid or missing regency for a Bali order.');
    if (['grab_gojek', 'self_pickup'].indexOf(order.delivery_method) === -1) throw new Error('Invalid delivery method for a Bali order.');
  } else {
    if (!String(order.address || '').trim()) throw new Error('Missing delivery address.');
    if (!String(order.city || '').trim()) throw new Error('Missing city.');
    if (!String(order.postal_code || '').trim()) throw new Error('Missing postal code.');
  }
  if (['stem', 'package', 'custom'].indexOf(order.order_mode) === -1) throw new Error('Invalid order mode.');
  if (['kraft', 'cream', 'sage', 'blush'].indexOf(order.wrap) === -1) throw new Error('Invalid wrapping option.');
  if (!order.acknowledgement) throw new Error('Acknowledgement is required.');
  ['total_stems', 'product_subtotal', 'estimated_product_total'].forEach(function (field) {
    if (!Number.isFinite(Number(order[field])) || Number(order[field]) < 0) throw new Error('Invalid number: ' + field);
  });
  if (order.message_card_fee !== undefined && (!Number.isFinite(Number(order.message_card_fee)) || Number(order.message_card_fee) < 0)) {
    throw new Error('Invalid number: message_card_fee');
  }
  if (!Array.isArray(order.item_data) || !order.item_data.length) throw new Error('Order items are missing.');
}

function findOrderRow(sheet, reference) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return null;
  const values = sheet.getRange(2, 1, lastRow - 1, 1).getDisplayValues();
  for (let index = 0; index < values.length; index += 1) {
    if (values[index][0] === reference) return index + 2;
  }
  return null;
}

function safeText(value) {
  const text = String(value || '');
  return /^[=+\-@]/.test(text) ? "'" + text : text;
}

function safeNumber(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) throw new Error('Invalid number.');
  return number;
}

function jsonResponse(value) {
  return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);
}
```

5. Replace `REPLACE_WITH_YOUR_PRIVATE_RANDOM_SECRET` with a unique random value of at least 30 letters and numbers.
6. Do not use the example text as the secret and do not share your secret.
7. Click **Save**. Do not click **Run**; `doPost` only works when it receives a web request.

### Deploy the Apps Script

1. Click **Deploy → New deployment**.
2. Click the gear beside **Select type**, then choose **Web app**.
3. Enter **Alxanthia order writer** as the description.
4. Choose **Execute as: Me**.
5. Choose **Who has access: Anyone**.
6. Click **Deploy**, select your Google account, and approve the requested spreadsheet access.
7. Copy the Web App URL ending in `/exec`. Keep it private for the next part.

If you ever change the list of Bali kabupaten/kota in `site-content.js` (`baliRegencies`), update the matching `BALI_REGENCIES` list in this script too, then redeploy (**Deploy → Manage deployments → edit → New version**) — otherwise the script will reject valid orders from a newly added regency.

---

## Part 3 — Create the Cloudflare Worker

1. Sign in or create a free account at <https://dash.cloudflare.com>.
2. Open **Workers & Pages → Create → Worker**.
3. Name it **alxanthia-order-endpoint** and deploy the starter Worker.
4. Open **Edit code**, delete the starter code, and paste:

```javascript
export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const headers = {
      'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Content-Type': 'application/json; charset=utf-8',
      'Vary': 'Origin'
    };

    if (origin !== env.ALLOWED_ORIGIN) return reply({ ok: false, error: 'Origin not allowed' }, 403, headers);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    if (request.method !== 'POST') return reply({ ok: false, error: 'Method not allowed' }, 405, headers);

    try {
      const order = await request.json();
      const googleResponse = await fetch(env.GOOGLE_SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
        body: JSON.stringify({ webhook_secret: env.WEBHOOK_SECRET, order })
      });
      const result = await googleResponse.json();
      if (!googleResponse.ok || result.ok !== true || result.order_reference !== order.order_reference) {
        return reply({ ok: false, error: result.error || 'Order was not stored' }, 502, headers);
      }
      return reply({ ok: true, order_reference: result.order_reference, duplicate: result.duplicate === true }, 200, headers);
    } catch (error) {
      return reply({ ok: false, error: 'Order could not be stored' }, 502, headers);
    }
  }
};

function reply(body, status, headers) {
  return new Response(JSON.stringify(body), { status, headers });
}
```

5. Click **Save and deploy**.
6. Open the Worker's **Settings → Variables and Secrets** (the label may be **Bindings**).
7. Add these values:

| Name | Value | Visibility |
| --- | --- | --- |
| `ALLOWED_ORIGIN` | Your exact website origin, such as `https://example.com`, with no trailing slash | Plain text |
| `GOOGLE_SCRIPT_URL` | The Google Apps Script URL ending in `/exec` | Secret if available |
| `WEBHOOK_SECRET` | The exact random secret used in Apps Script | Secret |

8. Save the variables and redeploy if Cloudflare asks.
9. Copy the public Worker URL, such as `https://alxanthia-order-endpoint.your-name.workers.dev`.

The Worker code itself never needs to change when you add fields, rename regencies, or adjust prices — it forwards whatever the website sends. Only Part 1 (Sheet columns) and Part 2 (Apps Script validation) need updating for that kind of change.

---

## Part 4 — Connect the website

In `site-content.js`, find:

```javascript
orderSubmissionUrl: "",
```

Change it to your public Worker URL:

```javascript
orderSubmissionUrl: "https://alxanthia-order-endpoint.your-name.workers.dev",
```

Only the Worker URL belongs here. Do not add the webhook secret, Apps Script URL, Google credentials, or Midtrans credentials.

If you prefer, send the public Worker URL to the developer maintaining the website. It is safe to share the public Worker URL; it is not safe to share any secret.

---

## Part 5 — Test one order

1. Deploy the updated website.
2. Open the production website and select one Gerbera.
3. Optionally check **Tambahkan kartu ucapan** and write a message, and fill in an optional recipient/sender name.
4. Open **Tinjau pesanan** and write down the reference.
5. Continue to the form. Fill in your name and WhatsApp number.
6. Test the **Di Bali** path: pick a kabupaten/kota and a delivery method (try both Grab/Gojek and Ambil sendiri).
7. Switch to **Luar Bali** and confirm the address/city/postal code fields appear instead, with the courier note beneath them.
8. Try picking a date before today — it must be rejected. Pick today or a later date.
9. Accept the acknowledgement and click **Simpan pesanan**.
10. Confirm the button temporarily reads **Menyimpan…**.
11. Confirm the website displays **Pesanan Anda sudah dicatat**.
12. Open the `Orders` sheet and confirm exactly one row was added with the same reference, with the location columns filled correctly for the path you tested (Bali columns filled and address columns blank, or vice versa).
13. Confirm Payment Status is **Awaiting confirmation** and Work Phase is **Not started**.
14. Click **Lanjut ke WhatsApp** and confirm the message has the reference, name, order, total, and date—but not the address, WhatsApp number, gift message, or recipient/sender name.

## Troubleshooting

### "Penyimpanan pesanan belum dikonfigurasi"

The Worker URL is still missing from `site-content.js`, or the updated website has not been deployed.

### "Kami belum dapat memastikan pesanan tersimpan"

1. Look in the Sheet for the displayed reference before retrying.
2. Open the Cloudflare Worker logs.
3. Confirm `ALLOWED_ORIGIN` exactly matches the website URL, including `www` if used and without a trailing slash.
4. Confirm `GOOGLE_SCRIPT_URL` ends in `/exec`.
5. Confirm the secrets in Apps Script and Cloudflare match exactly.
6. Confirm the Apps Script deployment executes as you and allows Anyone.

### Google Sheet stays empty

Confirm the worksheet is named exactly `Orders`, the Apps Script was created from that spreadsheet, and the deployed URL—not the editor URL—was placed in Cloudflare.

### A valid-looking Bali order is rejected

Check that the regency the customer picked is spelled exactly the same in `site-content.js`'s `baliRegencies` list and in the Apps Script's `BALI_REGENCIES` list — a mismatch after either one was edited is the most common cause.

## Safety reminder

Browser totals can be edited by a technically skilled visitor. Treat every submission as an order request. Before sending a Midtrans Payment Link, verify the current product price, stock/capacity, delivery details, delivery fee, and final total. Mark an order Paid only after Midtrans itself confirms the payment.
